/**
 * R4′ 布阵导流 —— 程序化棋盘生成（docs/26 §4 可重玩性核心，§7 标的头号风险）。
 *
 * 策略：构造式 cw 光路 + 前推扰乱 + BFS 求解器验证 + 模板兜底。
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
import { DIR_VECTORS, rotateCW, type BlockKind, type Dir, type SokobanBoard, type Terrain } from './types';

const ALL_DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const MAX_SOLVE_NODES = 20000;

export interface GenResult {
  readonly board: SokobanBoard;
  readonly player: Vec2;
  readonly moveBudget: number;
}

interface SearchNode {
  readonly player: Vec2;
  readonly blocks: BlockKind[];
}

function dv(dir: Dir): Vec2 {
  return DIR_VECTORS[dir];
}

/** 纯版推箱模拟（不改原 board），返回新状态或 null（非法移动）。 */
function simulateMove(board: SokobanBoard, node: SearchNode, dir: Dir): SearchNode | null {
  const d = dv(dir);
  const tx = node.player.x + d.x;
  const ty = node.player.y + d.y;
  if (!inBounds(board, tx, ty)) return null;
  const ti = idx(board, tx, ty);
  const terrain = board.terrain[ti] ?? 'empty';
  if (terrain === 'wall' || terrain === 'source' || terrain === 'herb') return null;
  const targetBlock = node.blocks[ti] ?? 'none';
  if (targetBlock !== 'none') {
    const bx = tx + d.x;
    const by = ty + d.y;
    if (!inBounds(board, bx, by)) return null;
    const bi = idx(board, bx, by);
    const bTerrain = board.terrain[bi] ?? 'empty';
    if (bTerrain === 'wall' || bTerrain === 'source' || bTerrain === 'herb') return null;
    if ((node.blocks[bi] ?? 'none') !== 'none') return null;
    const blocks = node.blocks.slice();
    blocks[bi] = targetBlock;
    blocks[ti] = 'none';
    return { player: { x: tx, y: ty }, blocks };
  }
  return { player: { x: tx, y: ty }, blocks: node.blocks };
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

/** 有界 BFS 求解器：从初始状态出发，是否存在动作序列让雷光到身体。 */
export function isSolvable(board: SokobanBoard, player: Vec2, maxNodes = MAX_SOLVE_NODES): boolean {
  const initial: SearchNode = { player: { ...player }, blocks: [...board.blocks] };
  if (beamReachesBody(board, initial.blocks)) return true; // 含初始已解
  const visited = new Set<string>([nodeKey(board, initial)]);
  const queue: SearchNode[] = [initial];
  let nodes = 0;
  while (queue.length > 0 && nodes < maxNodes) {
    const cur = queue.shift()!;
    nodes += 1;
    for (const dir of ALL_DIRS) {
      const next = simulateMove(board, cur, dir);
      if (!next) continue;
      const key = nodeKey(board, next);
      if (visited.has(key)) continue;
      if (beamReachesBody(board, next.blocks)) return true;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
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
  const edge = rng.intRange(0, 3);
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

function tryGenerate(stage: number, rng: Rng): GenResult | null {
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

  // 稀疏 off-path 灵草
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

  const board: SokobanBoard = { width: n, height: n, terrain, blocks, sourcePos: source, sourceDir: dir };
  const moveBudget = 18 + bends * 8 + stage * 4;
  return { board, player, moveBudget };
}

/** 生成一颗可解且初始未解的棋盘；耗尽尝试返回 null（调用方走模板兜底）。 */
export function generateBoard(stage: number, rng: Rng): GenResult | null {
  for (let attempt = 0; attempt < 16; attempt++) {
    const r = tryGenerate(stage, rng);
    if (!r) continue;
    const initialReaches = beamReachesBody(r.board, r.board.blocks);
    if (initialReaches) continue; // 初始已解 → 重排（至少要推一步）
    if (isSolvable(r.board, r.player)) return r;
  }
  return null;
}
