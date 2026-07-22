/**
 * D27-d 天劫操作 session：在 Sokoban reducer 外编排撤步、护持与终局结算。
 *
 * 纯函数边界：无 IO、时钟或隐式随机；所有成功 action 返回新状态，失败保持输入原子不变。
 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import { applyMove } from './logic';
import { evaluateTribulation, type TribulationOutcome } from './power';
import type { Dir, SokobanState } from './types';

export const TRIBULATION_SESSION_PILL_IDS = {
  undo: 'tribulation-undo-pill',
  ward: 'tribulation-ward-pill'
} as const;

export type TribulationSessionPillId =
  (typeof TRIBULATION_SESSION_PILL_IDS)[keyof typeof TRIBULATION_SESSION_PILL_IDS];

export interface TribulationSessionOutcome extends TribulationOutcome {
  /** 未启用或已耗尽护持时，overload / timeout 仍是致命结果。 */
  readonly fatal: boolean;
  /** 本次原本致命的结果是否被显式启用的护持拦下。 */
  readonly deathPrevented: boolean;
  readonly wardConsumed: boolean;
}

export interface TribulationSessionState {
  readonly puzzle: SokobanState;
  readonly preparation: TribulationPreparation;
  readonly undoChargesRemaining: number;
  readonly wardChargesRemaining: number;
  readonly wardEnabled: boolean;
  /** 每个元素都是一次合法 move 之前的完整棋盘快照。 */
  readonly undoSnapshots: readonly SokobanState[];
  /** 逐枚记录已消费丹药；撤步按 P100 枚数展开。 */
  readonly pillsConsumed: readonly TribulationSessionPillId[];
  readonly outcome: TribulationSessionOutcome | null;
}

export type TribulationSessionAction =
  | { readonly type: 'move'; readonly dir: Dir }
  | { readonly type: 'undo' }
  | { readonly type: 'set-ward'; readonly enabled: boolean };

export type TribulationSessionErrorCode =
  | 'session-resolved'
  | 'move-rejected'
  | 'no-undo-snapshot'
  | 'no-undo-charges'
  | 'no-ward-charges';

export interface TribulationSessionError {
  readonly code: TribulationSessionErrorCode;
  readonly actionType: TribulationSessionAction['type'];
  readonly moveReason?: string;
}

export type TribulationSessionTransition =
  | { readonly ok: true; readonly state: TribulationSessionState }
  | {
      readonly ok: false;
      readonly state: TribulationSessionState;
      readonly error: TribulationSessionError;
    };

function normalizedCharge(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function cloneSokobanState(state: SokobanState): SokobanState {
  return {
    ...state,
    board: {
      ...state.board,
      terrain: [...state.board.terrain],
      blocks: [...state.board.blocks],
      sourcePos: { ...state.board.sourcePos }
    },
    player: { ...state.player },
    beam: {
      ...state.beam,
      cells: state.beam.cells.map(cell => ({ ...cell })),
      herbsHit: state.beam.herbsHit.map(cell => ({ ...cell }))
    },
    scorched: [...state.scorched]
  };
}

function clonePreparation(preparation: TribulationPreparation): TribulationPreparation {
  return {
    ...preparation,
    undoCharges: normalizedCharge(preparation.undoCharges),
    wardCharges: normalizedCharge(preparation.wardCharges),
    unlockedBlockKinds: [...preparation.unlockedBlockKinds],
    startingHerbs: preparation.startingHerbs.map(herb => ({ ...herb }))
  };
}

function cloneOutcome(outcome: TribulationSessionOutcome | null): TribulationSessionOutcome | null {
  if (!outcome) return null;
  return {
    ...outcome,
    pillsConsumed: [...outcome.pillsConsumed],
    breakdown: { ...outcome.breakdown }
  };
}

function cloneSession(state: TribulationSessionState): TribulationSessionState {
  return {
    ...state,
    puzzle: cloneSokobanState(state.puzzle),
    preparation: clonePreparation(state.preparation),
    undoSnapshots: state.undoSnapshots.map(cloneSokobanState),
    pillsConsumed: [...state.pillsConsumed],
    outcome: cloneOutcome(state.outcome)
  };
}

function isFatalResult(outcome: TribulationOutcome): boolean {
  return outcome.result === 'overload' || outcome.result === 'timeout';
}

function resolveTerminalOutcome(
  state: TribulationSessionState,
  params: BalanceParams
): TribulationSessionState {
  const base = evaluateTribulation(state.puzzle, state.preparation, params);
  const fatalWithoutWard = isFatalResult(base);
  const wardConsumed = fatalWithoutWard && state.wardEnabled && state.wardChargesRemaining > 0;
  const pillsConsumed = wardConsumed
    ? [...state.pillsConsumed, TRIBULATION_SESSION_PILL_IDS.ward]
    : [...state.pillsConsumed];
  const outcome: TribulationSessionOutcome = {
    ...base,
    pillsConsumed,
    fatal: fatalWithoutWard && !wardConsumed,
    deathPrevented: wardConsumed,
    wardConsumed
  };
  return {
    ...state,
    wardChargesRemaining: wardConsumed
      ? state.wardChargesRemaining - 1
      : state.wardChargesRemaining,
    wardEnabled: wardConsumed ? false : state.wardEnabled,
    pillsConsumed,
    outcome
  };
}

export function createTribulationSession(
  puzzle: SokobanState,
  preparation: TribulationPreparation,
  params: BalanceParams = DEFAULT_BALANCE
): TribulationSessionState {
  const clonedPreparation = clonePreparation(preparation);
  const initial: TribulationSessionState = {
    puzzle: cloneSokobanState(puzzle),
    preparation: clonedPreparation,
    undoChargesRemaining: clonedPreparation.undoCharges,
    wardChargesRemaining: clonedPreparation.wardCharges,
    wardEnabled: false,
    undoSnapshots: [],
    pillsConsumed: [],
    outcome: null
  };
  return initial.puzzle.status === 'playing' ? initial : resolveTerminalOutcome(initial, params);
}

function reject(
  state: TribulationSessionState,
  action: TribulationSessionAction,
  code: TribulationSessionErrorCode,
  moveReason?: string
): TribulationSessionTransition {
  return {
    ok: false,
    state,
    error: {
      code,
      actionType: action.type,
      ...(moveReason === undefined ? {} : { moveReason })
    }
  };
}

function accept(state: TribulationSessionState): TribulationSessionTransition {
  return { ok: true, state };
}

function transitionMove(
  state: TribulationSessionState,
  action: Extract<TribulationSessionAction, { readonly type: 'move' }>,
  params: BalanceParams
): TribulationSessionTransition {
  if (state.outcome) return reject(state, action, 'session-resolved');
  const next = cloneSession(state);
  const snapshot = cloneSokobanState(next.puzzle);
  const move = applyMove(next.puzzle, { kind: 'move', dir: action.dir });
  if (!move.ok) return reject(state, action, 'move-rejected', move.reason);
  const moved: TribulationSessionState = {
    ...next,
    undoSnapshots: [...next.undoSnapshots, snapshot]
  };
  return accept(
    moved.puzzle.status === 'playing'
      ? moved
      : resolveTerminalOutcome(moved, params)
  );
}

function transitionUndo(
  state: TribulationSessionState,
  action: Extract<TribulationSessionAction, { readonly type: 'undo' }>,
  params: BalanceParams
): TribulationSessionTransition {
  if (state.undoChargesRemaining <= 0) return reject(state, action, 'no-undo-charges');
  if (state.undoSnapshots.length === 0) return reject(state, action, 'no-undo-snapshot');
  const next = cloneSession(state);
  const snapshot = next.undoSnapshots[next.undoSnapshots.length - 1]!;
  const pillsPerUndoCharge = Math.max(
    1,
    Math.floor(withDefaultBalanceParams(params).cultivationRun.tribulation.pillsPerUndoCharge)
  );
  const undoPills = Array.from(
    { length: pillsPerUndoCharge },
    () => TRIBULATION_SESSION_PILL_IDS.undo
  );
  return accept({
    ...next,
    puzzle: cloneSokobanState(snapshot),
    undoChargesRemaining: next.undoChargesRemaining - 1,
    undoSnapshots: next.undoSnapshots.slice(0, -1),
    pillsConsumed: [...next.pillsConsumed, ...undoPills],
    outcome: null
  });
}

function transitionWard(
  state: TribulationSessionState,
  action: Extract<TribulationSessionAction, { readonly type: 'set-ward' }>
): TribulationSessionTransition {
  if (state.outcome) return reject(state, action, 'session-resolved');
  if (action.enabled && state.wardChargesRemaining <= 0) {
    return reject(state, action, 'no-ward-charges');
  }
  return accept({ ...cloneSession(state), wardEnabled: action.enabled });
}

export function transitionTribulationSession(
  state: TribulationSessionState,
  action: TribulationSessionAction,
  params: BalanceParams = DEFAULT_BALANCE
): TribulationSessionTransition {
  switch (action.type) {
    case 'move':
      return transitionMove(state, action, params);
    case 'undo':
      return transitionUndo(state, action, params);
    case 'set-ward':
      return transitionWard(state, action);
  }
}
