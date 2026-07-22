import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import {
  TRIBULATION_SESSION_PILL_IDS,
  createTribulationSession,
  transitionTribulationSession,
  type TribulationSessionAction,
  type TribulationSessionState
} from '@sim/sokoban/tribulation-session';
import { evaluateTribulation } from '@sim/sokoban/power';
import { traceBeam } from '@sim/sokoban/beam';
import type { BlockKind, SokobanBoard, SokobanState, Terrain } from '@sim/sokoban/types';

function preparation(overrides: Partial<TribulationPreparation> = {}): TribulationPreparation {
  return {
    minTemperingPower: 0,
    maxSurvivablePower: 60,
    sweetSpotMinPower: 20,
    sweetSpotMaxPower: 40,
    moveBudgetBonus: 0,
    previewLevel: 0,
    undoCharges: 0,
    wardCharges: 0,
    protectedHerbCount: 0,
    unlockedBlockKinds: [],
    startingHerbs: [],
    sourcePowerBonus: 0,
    eventPowerModifierMilli: 1000,
    pressure: 20,
    mortalHeart: 50,
    ...overrides
  };
}

function stateFrom(spec: {
  readonly rows: readonly string[];
  readonly blocks?: ReadonlyArray<{ readonly kind: Exclude<BlockKind, 'none'>; readonly x: number; readonly y: number }>;
  readonly player: { readonly x: number; readonly y: number };
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
      const kind: Terrain = cell === 'S'
        ? 'source'
        : cell === 'B'
          ? 'body'
          : cell === '#'
            ? 'wall'
            : cell === 'H'
              ? 'herb'
              : 'empty';
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
    herbsTotal: terrain.filter(cell => cell === 'herb').length,
    moveBudget: spec.moveBudget ?? 10,
    movesUsed: 0,
    status: 'playing'
  };
}

function overloadPuzzle(): SokobanState {
  return stateFrom({
    rows: ['S...', '....', '....', '...B'],
    blocks: [{ kind: 'mirror', x: 2, y: 0 }],
    player: { x: 1, y: 0 }
  });
}

function timeoutPuzzle(): SokobanState {
  return stateFrom({
    rows: ['S#..', '....', '...B'],
    player: { x: 0, y: 1 },
    moveBudget: 1
  });
}

function undoPuzzle(): SokobanState {
  return stateFrom({
    rows: ['S...', '....', '....', 'B...'],
    blocks: [{ kind: 'mirror', x: 2, y: 1 }],
    player: { x: 1, y: 1 }
  });
}

function step(state: TribulationSessionState, action: TribulationSessionAction): TribulationSessionState {
  const result = transitionTribulationSession(state, action);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`session action failed: ${result.error.code}`);
  return result.state;
}

describe('D27-d · 天劫 session 撤步', () => {
  test('合法 move 保存完整快照；undo 恢复棋盘且只消费资源、不返还资源', () => {
    const puzzle = undoPuzzle();
    const puzzleBefore = structuredClone(puzzle);
    const session = createTribulationSession(puzzle, preparation({ undoCharges: 1 }));
    const sessionBefore = structuredClone(session);

    const moved = step(session, { type: 'move', dir: 'right' });
    expect(moved.puzzle.player).toEqual({ x: 2, y: 1 });
    expect(moved.puzzle.board.blocks[7]).toBe('mirror');
    expect(moved.puzzle.movesUsed).toBe(1);
    expect(moved.undoSnapshots).toHaveLength(1);
    expect(puzzle).toEqual(puzzleBefore);
    expect(session).toEqual(sessionBefore);

    const undone = step(moved, { type: 'undo' });
    expect(undone.puzzle).toEqual(puzzleBefore);
    expect(undone.undoSnapshots).toEqual([]);
    expect(undone.undoChargesRemaining).toBe(0);
    expect(undone.pillsConsumed).toEqual([
      TRIBULATION_SESSION_PILL_IDS.undo,
      TRIBULATION_SESSION_PILL_IDS.undo
    ]);

    const failedAgain = transitionTribulationSession(undone, { type: 'undo' });
    expect(failedAgain).toMatchObject({ ok: false, state: undone, error: { code: 'no-undo-charges' } });
    expect(failedAgain.state).toBe(undone);
  });

  test('非法 move 与无快照 undo 原子失败', () => {
    const blocked = stateFrom({
      rows: ['S..#', '...B'],
      blocks: [{ kind: 'mirror', x: 2, y: 0 }],
      player: { x: 1, y: 0 }
    });
    const session = createTribulationSession(blocked, preparation({ undoCharges: 1 }));
    const before = structuredClone(session);

    const move = transitionTribulationSession(session, { type: 'move', dir: 'right' });
    expect(move).toMatchObject({ ok: false, state: before, error: { code: 'move-rejected' } });
    expect(move.state).toBe(session);
    expect(session).toEqual(before);

    const undo = transitionTribulationSession(session, { type: 'undo' });
    expect(undo).toMatchObject({ ok: false, state: before, error: { code: 'no-undo-snapshot' } });
    expect(undo.state).toBe(session);
    expect(session).toEqual(before);
  });
});

describe('D27-d · 天劫 session 护持', () => {
  test('护持必须显式启用；未启用的 overload 仍致命且不消费 charge', () => {
    const session = createTribulationSession(overloadPuzzle(), preparation({ wardCharges: 1 }));
    const resolved = step(session, { type: 'move', dir: 'right' });

    expect(resolved.outcome).toMatchObject({ result: 'overload', fatal: true, deathPrevented: false, wardConsumed: false });
    expect(resolved.wardChargesRemaining).toBe(1);
    expect(resolved.pillsConsumed).toEqual([]);
  });

  test('显式启用护持后，overload 降为非致命重伤并填充 pillsConsumed', () => {
    let session = createTribulationSession(overloadPuzzle(), preparation({ wardCharges: 1 }));
    session = step(session, { type: 'set-ward', enabled: true });
    session = step(session, { type: 'move', dir: 'right' });

    expect(session.outcome).toMatchObject({
      result: 'overload',
      fatal: false,
      deathPrevented: true,
      wardConsumed: true
    });
    expect(session.outcome?.bodyDamage).toBeGreaterThan(0);
    expect(session.wardChargesRemaining).toBe(0);
    expect(session.wardEnabled).toBe(false);
    expect(session.pillsConsumed).toEqual([TRIBULATION_SESSION_PILL_IDS.ward]);
    expect(session.outcome?.pillsConsumed).toEqual(session.pillsConsumed);
  });

  test('timeout 同样可由已启用护持保命', () => {
    let session = createTribulationSession(timeoutPuzzle(), preparation({ wardCharges: 1 }));
    session = step(session, { type: 'set-ward', enabled: true });
    session = step(session, { type: 'move', dir: 'right' });

    expect(session.outcome).toMatchObject({ result: 'timeout', fatal: false, deathPrevented: true, wardConsumed: true });
    expect(session.outcome?.bodyDamage).toBe(DEFAULT_BALANCE.cultivationRun.tribulation.timeoutBodyDamage);
  });

  test('普通结果保持 evaluateTribulation 数值兼容且不误耗护持', () => {
    const prep = preparation({
      minTemperingPower: 80,
      maxSurvivablePower: 100,
      sweetSpotMinPower: 85,
      sweetSpotMaxPower: 90,
      wardCharges: 1
    });
    let session = createTribulationSession(overloadPuzzle(), prep);
    session = step(session, { type: 'set-ward', enabled: true });
    session = step(session, { type: 'move', dir: 'right' });
    const expected = evaluateTribulation(session.puzzle, prep);

    expect(session.outcome).toMatchObject(expected);
    expect(session.outcome).toMatchObject({ fatal: false, deathPrevented: false, wardConsumed: false });
    expect(session.outcome?.pillsConsumed).toEqual(expected.pillsConsumed);
    expect(session.wardChargesRemaining).toBe(1);
  });

  test('终局后 undo 不返还已消费护持，并额外消费撤步丹药', () => {
    let session = createTribulationSession(overloadPuzzle(), preparation({ wardCharges: 1, undoCharges: 1 }));
    session = step(session, { type: 'set-ward', enabled: true });
    session = step(session, { type: 'move', dir: 'right' });
    expect(session.outcome?.deathPrevented).toBe(true);

    session = step(session, { type: 'undo' });
    expect(session.puzzle).toEqual(overloadPuzzle());
    expect(session.outcome).toBeNull();
    expect(session.wardChargesRemaining).toBe(0);
    expect(session.undoChargesRemaining).toBe(0);
    expect(session.pillsConsumed).toEqual([
      TRIBULATION_SESSION_PILL_IDS.ward,
      TRIBULATION_SESSION_PILL_IDS.undo,
      TRIBULATION_SESSION_PILL_IDS.undo
    ]);
  });

  test('无护持次数时启用动作原子失败', () => {
    const session = createTribulationSession(overloadPuzzle(), preparation());
    const before = structuredClone(session);
    const result = transitionTribulationSession(session, { type: 'set-ward', enabled: true });

    expect(result).toMatchObject({ ok: false, state: before, error: { code: 'no-ward-charges' } });
    expect(result.state).toBe(session);
    expect(session).toEqual(before);
  });
});
