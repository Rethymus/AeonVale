import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import {
  TRIBULATION_SESSION_PILL_IDS,
  createTribulationSession,
  transitionTribulationSession,
  type TribulationSessionAction,
  type TribulationSessionState
} from '@sim/sokoban/tribulation-session';
import { traceBeam } from '@sim/sokoban/beam';
import type { BlockKind, Dir, SokobanBoard, SokobanState, Terrain } from '@sim/sokoban/types';

function preparation(undoCharges: number, wardCharges: number): TribulationPreparation {
  return {
    minTemperingPower: 0,
    maxSurvivablePower: 60,
    sweetSpotMinPower: 20,
    sweetSpotMaxPower: 40,
    moveBudgetBonus: 0,
    previewLevel: 0,
    undoCharges,
    wardCharges,
    protectedHerbCount: 0,
    unlockedBlockKinds: [],
    startingHerbs: [],
    sourcePowerBonus: 0,
    eventPowerModifierMilli: 1000,
    pressure: 20,
    mortalHeart: 50
  };
}

function boardState(spec: {
  readonly rows: readonly string[];
  readonly player: { readonly x: number; readonly y: number };
  readonly blocks?: ReadonlyArray<{ readonly kind: Exclude<BlockKind, 'none'>; readonly x: number; readonly y: number }>;
  readonly moveBudget?: number;
}): SokobanState {
  const height = spec.rows.length;
  const width = spec.rows[0]?.length ?? 0;
  const terrain: Terrain[] = [];
  let sourcePos = { x: 0, y: 0 };
  for (let y = 0; y < height; y++) {
    const row = spec.rows[y] ?? '';
    for (let x = 0; x < width; x++) {
      const cell = row[x] ?? '.';
      const kind: Terrain = cell === 'S' ? 'source' : cell === 'B' ? 'body' : cell === '#' ? 'wall' : 'empty';
      if (kind === 'source') sourcePos = { x, y };
      terrain.push(kind);
    }
  }
  const blocks = new Array(width * height).fill('none') as BlockKind[];
  for (const block of spec.blocks ?? []) blocks[block.y * width + block.x] = block.kind;
  const board: SokobanBoard = { width, height, terrain, blocks, sourcePos, sourceDir: 'right' };
  return {
    stage: 0,
    board,
    player: { ...spec.player },
    beam: traceBeam(board),
    scorched: new Array(width * height).fill(false) as boolean[],
    herbsTotal: 0,
    moveBudget: spec.moveBudget ?? 50,
    movesUsed: 0,
    status: 'playing'
  };
}

function freePuzzle(): SokobanState {
  return boardState({
    rows: ['S#.....', '.......', '......B'],
    player: { x: 3, y: 1 }
  });
}

function overloadPuzzle(): SokobanState {
  return boardState({
    rows: ['S...', '....', '....', '...B'],
    blocks: [{ kind: 'mirror', x: 2, y: 0 }],
    player: { x: 1, y: 0 }
  });
}

function blockedPuzzle(): SokobanState {
  return boardState({
    rows: ['S..#', '...B'],
    blocks: [{ kind: 'mirror', x: 2, y: 0 }],
    player: { x: 1, y: 0 }
  });
}

const actionArbitrary: fc.Arbitrary<TribulationSessionAction> = fc.oneof(
  fc.constantFrom<Dir>('up', 'down', 'left', 'right').map(dir => ({ type: 'move' as const, dir })),
  fc.constant({ type: 'undo' as const }),
  fc.boolean().map(enabled => ({ type: 'set-ward' as const, enabled }))
);

function runActions(
  initial: TribulationSessionState,
  actions: readonly TribulationSessionAction[]
): TribulationSessionState {
  let state = initial;
  for (const action of actions) {
    const transition = transitionTribulationSession(state, action);
    if (transition.ok) state = transition.state;
  }
  return state;
}

describe('D27-d · 天劫 session 性质', () => {
  test('PBT-D27-12 确定性与纯度：同状态、准备和动作序列得到同一结果且不改输入', () => {
    fc.assert(fc.property(fc.array(actionArbitrary, { maxLength: 30 }), actions => {
      const puzzle = freePuzzle();
      const prep = preparation(2, 2);
      const puzzleBefore = structuredClone(puzzle);
      const prepBefore = structuredClone(prep);
      const a = runActions(createTribulationSession(puzzle, prep), actions);
      const b = runActions(createTribulationSession(puzzle, prep), actions);

      expect(a).toEqual(b);
      expect(puzzle).toEqual(puzzleBefore);
      expect(prep).toEqual(prepBefore);
    }));
  });

  test('PBT-D27-13 次数与丹药守恒：消费不超过 preparation 分配的 charge 与药量', () => {
    fc.assert(fc.property(
      fc.integer({ min: 0, max: 3 }),
      fc.integer({ min: 0, max: 3 }),
      (undoCharges, wardCharges) => {
        let state = createTribulationSession(overloadPuzzle(), preparation(undoCharges, wardCharges));
        const maxCycles = undoCharges + 1;
        for (let cycle = 0; cycle < maxCycles; cycle++) {
          if (state.wardChargesRemaining > 0) {
            const armed = transitionTribulationSession(state, { type: 'set-ward', enabled: true });
            expect(armed.ok).toBe(true);
            if (armed.ok) state = armed.state;
          }
          const terminal = transitionTribulationSession(state, { type: 'move', dir: 'right' });
          expect(terminal.ok).toBe(true);
          if (!terminal.ok) return;
          state = terminal.state;
          if (cycle < undoCharges) {
            const undone = transitionTribulationSession(state, { type: 'undo' });
            expect(undone.ok).toBe(true);
            if (!undone.ok) return;
            state = undone.state;
          }
        }

        const undoPills = state.pillsConsumed.filter(id => id === TRIBULATION_SESSION_PILL_IDS.undo).length;
        const wardPills = state.pillsConsumed.filter(id => id === TRIBULATION_SESSION_PILL_IDS.ward).length;
        const pillsPerUndo = DEFAULT_BALANCE.cultivationRun.tribulation.pillsPerUndoCharge;
        expect(state.undoChargesRemaining).toBeGreaterThanOrEqual(0);
        expect(state.wardChargesRemaining).toBeGreaterThanOrEqual(0);
        expect(undoCharges - state.undoChargesRemaining).toBeLessThanOrEqual(undoCharges);
        expect(wardCharges - state.wardChargesRemaining).toBeLessThanOrEqual(wardCharges);
        expect(undoPills).toBe((undoCharges - state.undoChargesRemaining) * pillsPerUndo);
        expect(wardPills).toBe(wardCharges - state.wardChargesRemaining);
        expect(state.pillsConsumed.length).toBeLessThanOrEqual(
          undoCharges * pillsPerUndo + wardCharges
        );
        if (state.outcome) expect(state.outcome.pillsConsumed).toEqual(state.pillsConsumed);
      }
    ));
  });

  test('PBT-D27-14 非法动作原子失败：状态引用与所有深层字段保持不变', () => {
    const invalidAction = fc.constantFrom<'blocked-move' | 'undo' | 'ward'>('blocked-move', 'undo', 'ward');
    fc.assert(fc.property(invalidAction, actionKind => {
      const state = createTribulationSession(blockedPuzzle(), preparation(actionKind === 'undo' ? 1 : 0, 0));
      const before = structuredClone(state);
      const action: TribulationSessionAction = actionKind === 'blocked-move'
        ? { type: 'move', dir: 'right' }
        : actionKind === 'undo'
          ? { type: 'undo' }
          : { type: 'set-ward', enabled: true };
      const result = transitionTribulationSession(state, action);

      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
      expect(state).toEqual(before);
    }));
  });
});
