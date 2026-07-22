/**
 * R4′ 布阵导流 —— 程序化棋盘生成（docs/26 §4 可重玩性核心，§7 标的头号风险）。
 *
 * 策略：构造式 cw 光路 + 劫式约束组合 + 最短路认证 + 模板兜底。
 *   1) tryGenerate：构造一条"源 → 直线 → cw 折 → … → 身体"的右转光路，mirror 放折点；
 *      把每个 mirror 沿入射方向后退 k 格作为初始位置（玩家须前推复位）→ 构造上保证可解。
 *   2) isSolvable：有界 BFS 求解器（状态 = 玩家位 + blocks 快照），安全网 + 测试用。
 *   3) generateBoard：tryGenerate + isSolvable 验证 + 强制"初始未解"（至少要推一步）+ 重试；耗尽则 null（调用方兜底）。
 *
 * 守纯度：仅用注入的 Rng，无 Math.random/Date.now。求解器有 maxNodes 上限防爆炸。
 */
import type { Rng } from '@sim/world/rng';
import type { Vec2 } from '@sim/world/types';
import { idx, inBounds, traceBeam } from './beam';
import {
  DIR_VECTORS,
  rotateCW,
  type BlockKind,
  type Dir,
  type SokobanArchetype,
  type SokobanBoard,
  type SokobanChallenge,
  type Terrain
} from './types';

const ALL_DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const MAX_SOLVE_NODES = 40000;
const MAX_GENERATED_SOLUTION_MOVES = 96;

export interface GenResult {
  readonly board: SokobanBoard;
  readonly player: Vec2;
  readonly moveBudget: number;
  readonly challenge: SokobanChallenge;
}

interface SearchNode {
  readonly player: Vec2;
  readonly blocks: BlockKind[];
  readonly depth: number;
  readonly movedBlockMask: number;
}

export interface SolveOptions {
  readonly maxNodes?: number;
  readonly maxMoves?: number;
}

export interface SolveResult {
  readonly moves: readonly Dir[];
  readonly movedBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly exploredNodes: number;
}

function dv(dir: Dir): Vec2 {
  return DIR_VECTORS[dir];
}

function canPlayerEnter(terrain: Terrain): boolean {
  return terrain === 'empty' || terrain === 'body';
}

function canBlockRest(kind: Exclude<BlockKind, 'none'>, terrain: Terrain): boolean {
  return canPlayerEnter(terrain) || (kind === 'conductor' && terrain === 'rift');
}

function blockKindBit(kind: Exclude<BlockKind, 'none'>): number {
  if (kind === 'mirror') return 1;
  if (kind === 'conductor') return 2;
  return 4;
}

function blockKindsFromMask(mask: number): Exclude<BlockKind, 'none'>[] {
  const result: Exclude<BlockKind, 'none'>[] = [];
  if ((mask & 1) !== 0) result.push('mirror');
  if ((mask & 2) !== 0) result.push('conductor');
  if ((mask & 4) !== 0) result.push('insulator');
  return result;
}

/** 纯版推箱模拟（不改原 board），返回新状态或 null（非法移动）。 */
function simulateMove(board: SokobanBoard, node: SearchNode, dir: Dir): SearchNode | null {
  const d = dv(dir);
  const tx = node.player.x + d.x;
  const ty = node.player.y + d.y;
  if (!inBounds(board, tx, ty)) return null;
  const ti = idx(board, tx, ty);
  const terrain = board.terrain[ti] ?? 'empty';
  if (!canPlayerEnter(terrain)) return null;
  const targetBlock = node.blocks[ti] ?? 'none';
  if (targetBlock !== 'none') {
    const bx = tx + d.x;
    const by = ty + d.y;
    if (!inBounds(board, bx, by)) return null;
    const bi = idx(board, bx, by);
    const bTerrain = board.terrain[bi] ?? 'empty';
    if (!canBlockRest(targetBlock, bTerrain)) return null;
    if ((node.blocks[bi] ?? 'none') !== 'none') return null;
    const blocks = node.blocks.slice();
    blocks[bi] = targetBlock;
    blocks[ti] = 'none';
    return {
      player: { x: tx, y: ty },
      blocks,
      depth: node.depth + 1,
      movedBlockMask: node.movedBlockMask | blockKindBit(targetBlock)
    };
  }
  return {
    player: { x: tx, y: ty },
    blocks: node.blocks,
    depth: node.depth + 1,
    movedBlockMask: node.movedBlockMask
  };
}

function beamReachesBody(board: SokobanBoard, blocks: BlockKind[]): boolean {
  return traceBeam({ width: board.width, height: board.height, terrain: board.terrain, blocks, sourcePos: board.sourcePos, sourceDir: board.sourceDir }).reachedBody;
}

function nodeKey(board: SokobanBoard, node: SearchNode): string {
  let k = `${node.player.x},${node.player.y}|`;
  for (let i = 0; i < node.blocks.length; i++) {
    const b = node.blocks[i];
    if (b !== 'none') k += `${i}:${b};`;
  }
  return k;
}

/** 有界 BFS 最短路求解器；maxMoves 用来认证“倒计时内必解”。 */
export function solveBoard(board: SokobanBoard, player: Vec2, options: SolveOptions = {}): SolveResult | null {
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? MAX_SOLVE_NODES));
  const maxMoves = Math.max(0, Math.floor(options.maxMoves ?? Number.MAX_SAFE_INTEGER));
  const initial: SearchNode = {
    player: { ...player },
    blocks: [...board.blocks],
    depth: 0,
    movedBlockMask: 0
  };
  if (beamReachesBody(board, initial.blocks)) {
    return { moves: [], movedBlockKinds: [], exploredNodes: 0 };
  }
  const visited = new Set<string>([nodeKey(board, initial)]);
  const parents = new Map<string, { readonly previous: string; readonly dir: Dir }>();
  const queue: SearchNode[] = [initial];
  let head = 0;
  let nodes = 0;
  while (head < queue.length && nodes < maxNodes) {
    const cur = queue[head++]!;
    nodes += 1;
    if (cur.depth >= maxMoves) continue;
    const currentKey = nodeKey(board, cur);
    for (const dir of ALL_DIRS) {
      const next = simulateMove(board, cur, dir);
      if (!next) continue;
      const key = nodeKey(board, next);
      if (visited.has(key)) continue;
      parents.set(key, { previous: currentKey, dir });
      if (beamReachesBody(board, next.blocks)) {
        const moves: Dir[] = [];
        let cursor = key;
        while (parents.has(cursor)) {
          const parent = parents.get(cursor)!;
          moves.push(parent.dir);
          cursor = parent.previous;
        }
        moves.reverse();
        return {
          moves,
          movedBlockKinds: blockKindsFromMask(next.movedBlockMask),
          exploredNodes: nodes
        };
      }
      visited.add(key);
      queue.push(next);
    }
  }
  return null;
}

/** 兼容旧调用：第三参数仍是节点上限，第四参数可选步数上限。 */
export function isSolvable(
  board: SokobanBoard,
  player: Vec2,
  maxNodes = MAX_SOLVE_NODES,
  maxMoves = Number.MAX_SAFE_INTEGER
): boolean {
  return solveBoard(board, player, { maxNodes, maxMoves }) !== null;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

interface BuiltPath {
  readonly path: Vec2[];
  readonly bendCells: Vec2[];
  readonly incomingDir: Dir[];
  readonly body: Vec2;
  readonly source: Vec2;
  readonly dir: Dir;
}

/** 单次 cw 光路构造：失败（越界/自交/退化）返回 null，由调用方重试。 */
function buildPath(n: number, bends: number, rng: Rng): BuiltPath | null {
  const edge = rng.intRange(0, 4);
  let source: Vec2;
  let dir: Dir;
  if (edge === 0) {
    source = { x: rng.intRange(1, n - 2), y: 0 };
    dir = 'down';
  } else if (edge === 1) {
    source = { x: rng.intRange(1, n - 2), y: n - 1 };
    dir = 'up';
  } else if (edge === 2) {
    source = { x: 0, y: rng.intRange(1, n - 2) };
    dir = 'right';
  } else {
    source = { x: n - 1, y: rng.intRange(1, n - 2) };
    dir = 'left';
  }
  const path: Vec2[] = [];
  const bendCells: Vec2[] = [];
  const incomingDir: Dir[] = [];
  let pos: Vec2 = { ...source };
  let curDir = dir;
  for (let s = 0; s <= bends; s++) {
    const len = rng.intRange(2, Math.max(2, n - 2));
    for (let step = 0; step < len; step++) {
      pos = { x: pos.x + dv(curDir).x, y: pos.y + dv(curDir).y };
      if (!inBounds({ width: n, height: n }, pos.x, pos.y)) return null;
      if (path.some(p => p.x === pos.x && p.y === pos.y)) return null;
      path.push({ ...pos });
    }
    if (s < bends) {
      bendCells.push({ ...pos });
      incomingDir.push(curDir);
      curDir = rotateCW(curDir);
    }
  }
  if (path.length < 2) return null;
  const body: Vec2 = { ...pos };
  if (body.x === source.x && body.y === source.y) return null;
  return { path, bendCells, incomingDir, body, source, dir };
}

export interface GenerateBoardOptions {
  readonly requiredBlockKinds?: readonly Exclude<BlockKind, 'none'>[];
}

interface GenCandidate {
  readonly board: SokobanBoard;
  readonly player: Vec2;
  readonly requiredBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly archetype: SokobanArchetype;
}

function randomized<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = rng.intRange(0, i + 1);
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

function directionBetween(a: Vec2, b: Vec2): Dir | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 1 && dy === 0) return 'right';
  if (dx === -1 && dy === 0) return 'left';
  if (dx === 0 && dy === 1) return 'down';
  if (dx === 0 && dy === -1) return 'up';
  return null;
}

function perpendicularVectors(dir: Dir): readonly Vec2[] {
  return dir === 'left' || dir === 'right'
    ? [{ x: 0, y: -1 }, { x: 0, y: 1 }]
    : [{ x: -1, y: 0 }, { x: 1, y: 0 }];
}

function isPlainCell(board: SokobanBoard, x: number, y: number): boolean {
  if (!inBounds(board, x, y)) return false;
  const i = idx(board, x, y);
  return board.terrain[i] === 'empty' && board.blocks[i] === 'none';
}

function straightPathCandidates(path: readonly Vec2[]): Array<{ readonly cell: Vec2; readonly dir: Dir }> {
  const result: Array<{ readonly cell: Vec2; readonly dir: Dir }> = [];
  for (let i = 1; i < path.length - 1; i += 1) {
    const previous = path[i - 1]!;
    const cell = path[i]!;
    const next = path[i + 1]!;
    const incoming = directionBetween(previous, cell);
    const outgoing = directionBetween(cell, next);
    if (incoming && incoming === outgoing) result.push({ cell, dir: incoming });
  }
  return result;
}

/** 把水阵石放在雷路侧边，玩家必须将它推入 rift 才能续接光路。 */
function installConductorBridge(board: SokobanBoard, path: readonly Vec2[], rng: Rng): boolean {
  for (const candidate of randomized(straightPathCandidates(path), rng)) {
    const target = candidate.cell;
    if (!isPlainCell(board, target.x, target.y)) continue;
    for (const side of randomized(perpendicularVectors(candidate.dir), rng)) {
      const stone = { x: target.x - side.x, y: target.y - side.y };
      const stand = { x: target.x - side.x * 2, y: target.y - side.y * 2 };
      if (!isPlainCell(board, stone.x, stone.y) || !isPlainCell(board, stand.x, stand.y)) continue;
      board.terrain[idx(board, target.x, target.y)] = 'rift';
      board.blocks[idx(board, stone.x, stone.y)] = 'conductor';
      return true;
    }
  }
  return false;
}

/** 把绝缘石封在必经雷路上，玩家必须横向推出雷路。 */
function installInsulatorSeal(board: SokobanBoard, path: readonly Vec2[], rng: Rng): boolean {
  for (const candidate of randomized(straightPathCandidates(path), rng)) {
    const target = candidate.cell;
    if (!isPlainCell(board, target.x, target.y)) continue;
    for (const side of randomized(perpendicularVectors(candidate.dir), rng)) {
      const destination = { x: target.x + side.x, y: target.y + side.y };
      const stand = { x: target.x - side.x, y: target.y - side.y };
      if (!isPlainCell(board, destination.x, destination.y) || !isPlainCell(board, stand.x, stand.y)) continue;
      board.blocks[idx(board, target.x, target.y)] = 'insulator';
      return true;
    }
  }
  return false;
}

function selectedFeatureKinds(
  stage: number,
  rng: Rng,
  requested: readonly Exclude<BlockKind, 'none'>[]
): readonly Exclude<BlockKind, 'none'>[] {
  const selected = new Set<Exclude<BlockKind, 'none'>>(['mirror']);
  for (const kind of requested) selected.add(kind);
  if (stage >= 1 && rng.chance(Math.min(0.45 + stage * 0.04, 0.75))) selected.add('insulator');
  if (stage >= 2 && rng.chance(Math.min(0.4 + stage * 0.05, 0.8))) selected.add('conductor');
  if (stage >= 4 && selected.size === 1) selected.add(rng.chance(0.5) ? 'conductor' : 'insulator');
  return ['mirror', 'conductor', 'insulator'].filter(kind => selected.has(kind as Exclude<BlockKind, 'none'>)) as Exclude<BlockKind, 'none'>[];
}

function archetypeFor(kinds: readonly Exclude<BlockKind, 'none'>[]): SokobanArchetype {
  const conductor = kinds.includes('conductor');
  const insulator = kinds.includes('insulator');
  if (conductor && insulator) return 'compound-array';
  if (conductor) return 'broken-meridian';
  if (insulator) return 'sealed-meridian';
  return 'turning-rune';
}

function tryGenerate(stage: number, rng: Rng, options: GenerateBoardOptions): GenCandidate | null {
  const n = clamp(5 + Math.floor(stage / 2), 5, 9);
  const bends = clamp(1 + Math.floor(stage / 2), 1, 3);
  let chosen: BuiltPath | null = null;
  for (let inner = 0; inner < 16 && !chosen; inner++) chosen = buildPath(n, bends, rng);
  if (!chosen) return null;
  const { path, bendCells, incomingDir, body, source, dir } = chosen;

  const terrain: Terrain[] = new Array(n * n).fill('empty') as Terrain[];
  terrain[idx({ width: n }, source.x, source.y)] = 'source';
  terrain[idx({ width: n }, body.x, body.y)] = 'body';
  const onPath = (x: number, y: number): boolean => path.some(p => p.x === x && p.y === y);

  // mirror：全部先放折点（解位置），只扰乱【最后一个】折点的 mirror（k=1，前推一格）。
  // 单 mirror 前推在开放网格必可解（避开多 mirror 互相挡路的死锁）；多 mirror 扰乱留后续（求解器+重试）。
  const blocks: BlockKind[] = new Array(n * n).fill('none') as BlockKind[];
  for (const bend of bendCells) blocks[idx({ width: n }, bend.x, bend.y)] = 'mirror';
  if (bendCells.length > 0) {
    const last = bendCells[bendCells.length - 1]!;
    const din = incomingDir[incomingDir.length - 1]!;
    const bendIdx = idx({ width: n }, last.x, last.y);
    const sx = last.x - dv(din).x;
    const sy = last.y - dv(din).y;
    const sIdx = idx({ width: n }, sx, sy);
    if (sIdx !== bendIdx && inBounds({ width: n, height: n }, sx, sy) && onPath(sx, sy) && !(sx === source.x && sy === source.y) && !(sx === body.x && sy === body.y)) {
      blocks[bendIdx] = 'none';
      blocks[sIdx] = 'mirror';
    }
    // 否则保留折点解位置；generateBoard 的 initial-reaches 检查会触发重试。
  }

  const board: SokobanBoard = { width: n, height: n, terrain, blocks, sourcePos: source, sourceDir: dir };
  const requiredBlockKinds = selectedFeatureKinds(stage, rng, options.requiredBlockKinds ?? []);
  if (requiredBlockKinds.includes('conductor') && !installConductorBridge(board, path, rng)) return null;
  if (requiredBlockKinds.includes('insulator') && !installInsulatorSeal(board, path, rng)) return null;

  // 稀疏 off-path 灵草；生成器只放可保全目标，准备适配器再加入库存灵草。
  const herbCount = Math.min(stage, 3);
  let placed = 0;
  for (let t = 0; t < 40 && placed < herbCount; t++) {
    const cx = rng.intRange(0, n - 1);
    const cy = rng.intRange(0, n - 1);
    const ci = idx({ width: n }, cx, cy);
    if (terrain[ci] !== 'empty' || blocks[ci] !== 'none') continue;
    if (onPath(cx, cy)) continue;
    terrain[ci] = 'herb';
    placed += 1;
  }

  // 玩家起点：off-path 空格
  let player: Vec2 | null = null;
  for (let t = 0; t < 40; t++) {
    const cx = rng.intRange(0, n - 1);
    const cy = rng.intRange(0, n - 1);
    const ci = idx({ width: n }, cx, cy);
    if (terrain[ci] === 'empty' && blocks[ci] === 'none' && !onPath(cx, cy)) {
      player = { x: cx, y: cy };
      break;
    }
  }
  if (!player) return null;

  return { board, player, requiredBlockKinds, archetype: archetypeFor(requiredBlockKinds) };
}

/** 生成一颗可解且初始未解的棋盘；耗尽尝试返回 null（调用方走模板兜底）。 */
export function generateBoard(stage: number, rng: Rng, options: GenerateBoardOptions = {}): GenResult | null {
  for (let attempt = 0; attempt < 32; attempt++) {
    const r = tryGenerate(stage, rng, options);
    if (!r) continue;
    const initialReaches = beamReachesBody(r.board, r.board.blocks);
    if (initialReaches) continue; // 初始已解 → 重排（至少要推一步）
    const solution = solveBoard(r.board, r.player, { maxMoves: MAX_GENERATED_SOLUTION_MOVES });
    if (!solution) continue;
    if (r.requiredBlockKinds.some(kind => !solution.movedBlockKinds.includes(kind))) continue;
    const budgetSlack = clamp(8 + stage * 2 + rng.intRange(0, 5), 8, 24);
    const moveBudget = solution.moves.length + budgetSlack;
    return {
      ...r,
      moveBudget,
      challenge: {
        archetype: r.archetype,
        requiredBlockKinds: r.requiredBlockKinds,
        certifiedMoves: solution.moves.length,
        budgetSlack,
        preserveHerbsTarget: r.board.terrain.filter(terrain => terrain === 'herb').length
      }
    };
  }
  return null;
}
