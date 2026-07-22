/**
 * D27-d：把日程准备真正投射到天劫棋盘。
 *
 * 该适配器不负责生成基础谜题，只在既有可解棋盘上确定性放置准备灵草、
 * 已解锁阵石和事件障碍。每次结构修改后都重新验证可解性；无法安全落位的
 * 内容会显式进入 ignoredBoardModifierTags，避免把“HUD 有数值”伪装成已接线。
 */
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import { idx, traceBeam } from './beam';
import { isSolvable } from './generator';
import type { BlockKind, SokobanState, Terrain } from './types';

export interface PreparedPuzzlePlacement {
  readonly state: SokobanState;
  /** 所有由准备适配器新增的灵草（库存灵草 + 事件赠予）。 */
  readonly preparedHerbIndices: readonly number[];
  /** 仅来自当世灵田库存；结算 preparedHerbsScorched 时只统计这一组。 */
  readonly inventoryHerbIndices: readonly number[];
  /** 事件额外生成，不得从当世灵草库存重复扣除。 */
  readonly eventHerbIndices: readonly number[];
  readonly placedBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly appliedBoardModifierTags: readonly string[];
  readonly ignoredBoardModifierTags: readonly string[];
}

function cloneState(state: SokobanState): SokobanState {
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

function candidateIndices(state: SokobanState): number[] {
  const beamIndices = new Set(state.beam.cells.map(cell => idx(state.board, cell.x, cell.y)));
  const playerIndex = idx(state.board, state.player.x, state.player.y);
  const candidates: Array<{ readonly index: number; readonly beamDistance: number }> = [];

  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      const index = idx(state.board, x, y);
      if (index === playerIndex) continue;
      if (state.board.terrain[index] !== 'empty' || state.board.blocks[index] !== 'none') continue;
      let beamDistance = Number.POSITIVE_INFINITY;
      for (const cell of state.beam.cells) {
        beamDistance = Math.min(beamDistance, Math.abs(cell.x - x) + Math.abs(cell.y - y));
      }
      candidates.push({ index, beamDistance: beamIndices.has(index) ? -1 : beamDistance });
    }
  }

  return candidates
    .sort((a, b) => a.beamDistance - b.beamDistance || a.index - b.index)
    .map(candidate => candidate.index);
}

function refreshDerivedState(state: SokobanState): void {
  state.beam = traceBeam(state.board);
  state.scorched = new Array(state.board.width * state.board.height).fill(false) as boolean[];
  state.status = 'playing';
  state.movesUsed = 0;
}

function remainsPlayable(state: SokobanState): boolean {
  return !traceBeam(state.board).reachedBody && isSolvable(state.board, state.player);
}

function tryPlaceTerrain(state: SokobanState, terrain: Terrain): number | null {
  for (const index of candidateIndices(state)) {
    const previous = state.board.terrain[index]!;
    state.board.terrain[index] = terrain;
    if (remainsPlayable(state)) {
      refreshDerivedState(state);
      return index;
    }
    state.board.terrain[index] = previous;
  }
  return null;
}

function tryPlaceBlock(state: SokobanState, kind: Exclude<BlockKind, 'none'>): boolean {
  for (const index of candidateIndices(state)) {
    state.board.blocks[index] = kind;
    if (remainsPlayable(state)) {
      refreshDerivedState(state);
      return true;
    }
    state.board.blocks[index] = 'none';
  }
  return false;
}

function nonNegativeFloor(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function requestedPreparedHerbs(preparation: TribulationPreparation): number {
  const fromPreparation = preparation.startingHerbs.reduce(
    (sum, herb) => sum + nonNegativeFloor(herb.count),
    0
  );
  return Math.min(nonNegativeFloor(preparation.protectedHerbCount), fromPreparation);
}

export function applyPreparationToPuzzle(
  baseState: SokobanState,
  preparation: TribulationPreparation,
  boardModifierTags: readonly string[] = []
): PreparedPuzzlePlacement {
  const state = cloneState(baseState);
  const preparedHerbIndices: number[] = [];
  const inventoryHerbIndices: number[] = [];
  const eventHerbIndices: number[] = [];
  const placedBlockKinds: Exclude<BlockKind, 'none'>[] = [];
  const appliedBoardModifierTags: string[] = [];
  const ignoredBoardModifierTags: string[] = [];

  const herbCount = requestedPreparedHerbs(preparation);
  for (let count = 0; count < herbCount; count += 1) {
    const placedIndex = tryPlaceTerrain(state, 'herb');
    if (placedIndex === null) break;
    preparedHerbIndices.push(placedIndex);
    inventoryHerbIndices.push(placedIndex);
  }
  if (boardModifierTags.includes('starting-herb:thunder')) {
    const eventHerbIndex = tryPlaceTerrain(state, 'herb');
    if (eventHerbIndex === null) ignoredBoardModifierTags.push('starting-herb:thunder');
    else {
      preparedHerbIndices.push(eventHerbIndex);
      eventHerbIndices.push(eventHerbIndex);
      appliedBoardModifierTags.push('starting-herb:thunder');
    }
  }

  for (const kind of preparation.unlockedBlockKinds) {
    if (tryPlaceBlock(state, kind)) placedBlockKinds.push(kind);
  }

  for (const tag of boardModifierTags) {
    if (tag === 'starting-herb:thunder') continue;
    if (tag === 'sword-scar-obstacle:1') {
      if (tryPlaceTerrain(state, 'wall') !== null) appliedBoardModifierTags.push(tag);
      else ignoredBoardModifierTags.push(tag);
      continue;
    }
    // 当前棋盘类型只有一个雷源；第二雷源必须等多源 beam 契约落地，不能偷换成数值加成。
    ignoredBoardModifierTags.push(tag);
  }

  refreshDerivedState(state);
  return {
    state: {
      ...state,
      herbsTotal: state.board.terrain.filter(terrain => terrain === 'herb').length
    },
    preparedHerbIndices,
    inventoryHerbIndices,
    eventHerbIndices,
    placedBlockKinds,
    appliedBoardModifierTags,
    ignoredBoardModifierTags
  };
}
