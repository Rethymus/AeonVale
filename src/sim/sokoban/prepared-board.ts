/**
 * D27-d：把日程准备真正投射到天劫棋盘。
 *
 * 该适配器不负责生成基础谜题，只在既有可解棋盘上确定性放置准备灵草、
 * 已解锁阵石和事件障碍。每次结构修改后都重新验证可解性；无法安全落位的
 * 内容会显式进入 ignoredBoardModifierTags，避免把“HUD 有数值”伪装成已接线。
 */
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import { idx, traceBeam } from './beam';
import { solveBoard } from './generator';
import type { BlockKind, SokobanState, Terrain } from './types';

export interface PreparedPuzzlePlacement {
  readonly state: SokobanState;
  /** 所有由准备适配器新增的灵草（库存灵草 + 事件赠予）。 */
  readonly preparedHerbIndices: readonly number[];
  /** 仅来自当世灵田库存；结算 preparedHerbsScorched 时只统计这一组。 */
  readonly inventoryHerbIndices: readonly number[];
  /** 事件额外生成，不得从当世灵草库存重复扣除。 */
  readonly eventHerbIndices: readonly number[];
  /** 本次准备实际接入棋盘、且被最短解使用的阵石。 */
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
  const solution = solveBoard(state.board, state.player, { maxMoves: state.moveBudget - state.movesUsed });
  return !traceBeam(state.board).reachedBody
    && solution !== null
    && (state.challenge?.requiredBlockKinds.every(kind => solution.movedBlockKinds.includes(kind)) ?? true);
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
  if (state.board.blocks.includes(kind)) {
    const solution = solveBoard(state.board, state.player, { maxMoves: state.moveBudget - state.movesUsed });
    return solution?.movedBlockKinds.includes(kind) ?? false;
  }

  // 水阵石必须与断裂雷脉成套出现，否则“直通”与空地没有玩法差异。
  if (kind === 'conductor') {
    const beamCandidates = state.beam.cells
      .map(cell => idx(state.board, cell.x, cell.y))
      .filter(index => state.board.terrain[index] === 'empty' && state.board.blocks[index] === 'none');
    for (const targetIndex of beamCandidates) {
      const tx = targetIndex % state.board.width;
      const ty = Math.floor(targetIndex / state.board.width);
      const sideVectors = [{ x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 }] as const;
      for (const side of sideVectors) {
        const sx = tx - side.x;
        const sy = ty - side.y;
        const px = tx - side.x * 2;
        const py = ty - side.y * 2;
        if (sx < 0 || sy < 0 || px < 0 || py < 0 || sx >= state.board.width || px >= state.board.width || sy >= state.board.height || py >= state.board.height) continue;
        const stoneIndex = idx(state.board, sx, sy);
        const standIndex = idx(state.board, px, py);
        if (state.board.terrain[stoneIndex] !== 'empty' || state.board.blocks[stoneIndex] !== 'none') continue;
        if (state.board.terrain[standIndex] !== 'empty' || state.board.blocks[standIndex] !== 'none') continue;
        state.board.terrain[targetIndex] = 'rift';
        state.board.blocks[stoneIndex] = kind;
        const solution = solveBoard(state.board, state.player, { maxMoves: state.moveBudget - state.movesUsed });
        if (solution?.movedBlockKinds.includes(kind)) {
          refreshDerivedState(state);
          return true;
        }
        state.board.terrain[targetIndex] = 'empty';
        state.board.blocks[stoneIndex] = 'none';
      }
    }
    return false;
  }

  // 绝缘石优先封住当前雷路，确保它是需要移开的“闸门”，不是无关摆设。
  if (kind === 'insulator') {
    for (const cell of state.beam.cells) {
      const index = idx(state.board, cell.x, cell.y);
      if (state.board.terrain[index] !== 'empty' || state.board.blocks[index] !== 'none') continue;
      state.board.blocks[index] = kind;
      const solution = solveBoard(state.board, state.player, { maxMoves: state.moveBudget - state.movesUsed });
      if (solution?.movedBlockKinds.includes(kind)) {
        refreshDerivedState(state);
        return true;
      }
      state.board.blocks[index] = 'none';
    }
    return false;
  }

  for (const index of candidateIndices(state)) {
    state.board.blocks[index] = kind;
    const solution = solveBoard(state.board, state.player, { maxMoves: state.moveBudget - state.movesUsed });
    if (!traceBeam(state.board).reachedBody && solution?.movedBlockKinds.includes(kind)) {
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

  // 先接入会改变解题结构的阵石，再把灵草与事件放进剩余的预算内安全格。
  for (const kind of preparation.unlockedBlockKinds) {
    if (tryPlaceBlock(state, kind)) placedBlockKinds.push(kind);
  }

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
  const certified = solveBoard(state.board, state.player, { maxMoves: state.moveBudget });
  const effectivePlacedBlockKinds = certified
    ? placedBlockKinds.filter(kind => certified.movedBlockKinds.includes(kind))
    : [];
  const requiredBlockKinds = [...new Set([
    ...(state.challenge?.requiredBlockKinds ?? []),
    ...effectivePlacedBlockKinds
  ])];
  const challenge = certified
    ? {
        archetype: requiredBlockKinds.includes('conductor') && requiredBlockKinds.includes('insulator')
          ? 'compound-array' as const
          : requiredBlockKinds.includes('conductor')
            ? 'broken-meridian' as const
            : requiredBlockKinds.includes('insulator')
              ? 'sealed-meridian' as const
              : state.challenge?.archetype ?? 'turning-rune' as const,
        requiredBlockKinds,
        certifiedMoves: certified.moves.length,
        budgetSlack: Math.max(0, state.moveBudget - certified.moves.length),
        preserveHerbsTarget: state.board.terrain.filter(terrain => terrain === 'herb').length
      }
    : state.challenge;
  return {
    state: {
      ...state,
      herbsTotal: state.board.terrain.filter(terrain => terrain === 'herb').length,
      ...(challenge ? { challenge } : {})
    },
    preparedHerbIndices,
    inventoryHerbIndices,
    eventHerbIndices,
    placedBlockKinds: effectivePlacedBlockKinds,
    appliedBoardModifierTags,
    ignoredBoardModifierTags
  };
}
