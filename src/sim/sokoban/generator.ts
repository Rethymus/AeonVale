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
import { consumeOneShotGuard, idx, inBounds, modifierAt, traceBeam } from './beam';
import {
  DIR_VECTORS,
  rotateCCW,
  rotateCW,
  type BeamTrace,
  type BlockKind,
  type BlockModifier,
  type Dir,
  type SokobanArchetype,
  type SokobanBoard,
  type SokobanChallenge,
  type SokobanFlavorTag,
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
  /** 与 blocks 平行；仅当板面存在非 none 修饰时才参与节点键。 */
  readonly modifiers: BlockModifier[];
  readonly depth: number;
  readonly movedBlockMask: number;
}

export interface GenerateBoardOptions {
  readonly requiredBlockKinds?: readonly Exclude<BlockKind, 'none'>[];
  /** 测试与教学场景用：跳过修饰阵石附着（docs/31 §3.3），保持旧种子行为。 */
  readonly disableModifiers?: boolean;
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
    // 修饰随阵石移动（与 logic.applyMove 同语义）。
    const modifiers = node.modifiers.slice();
    modifiers[bi] = modifiers[ti] ?? 'none';
    modifiers[ti] = 'none';
    return {
      player: { x: tx, y: ty },
      blocks,
      modifiers,
      depth: node.depth + 1,
      movedBlockMask: node.movedBlockMask | blockKindBit(targetBlock)
    };
  }
  return {
    player: { x: tx, y: ty },
    blocks: node.blocks,
    modifiers: node.modifiers,
    depth: node.depth + 1,
    movedBlockMask: node.movedBlockMask
  };
}

function beamReachesBody(board: SokobanBoard, blocks: BlockKind[], modifiers?: readonly BlockModifier[]): boolean {
  // 查询语义纯化：一次性守卫的耗尽在克隆上模拟，不改动调用方（BFS 节点）的数组，
  // 否则节点 key 与实际状态漂移会破 parents 链（曾致求解回溯成环）。
  const probeBlocks = [...blocks];
  const probeModifiers = modifiers ? [...modifiers] : undefined;
  const probe: SokobanBoard = { width: board.width, height: board.height, terrain: board.terrain, blocks: probeBlocks, blockModifiers: probeModifiers, sourcePos: board.sourcePos, sourceDir: board.sourceDir };
  let beam = traceBeam(probe);
  if (consumeOneShotGuard(probe, probeBlocks, probeModifiers, beam)) {
    beam = traceBeam(probe);
  }
  return beam.reachedBody;
}

function nodeKey(board: SokobanBoard, node: SearchNode): string {
  let k = `${node.player.x},${node.player.y}|`;
  let hasModifiers = false;
  for (let i = 0; i < node.blocks.length; i++) {
    const b = node.blocks[i];
    const m = node.modifiers[i] ?? 'none';
    if (b === 'none') continue;
    if (m !== 'none') hasModifiers = true;
    k += `${i}:${b}${m === 'none' ? '' : `:${m}`};`;
  }
  return hasModifiers ? `M|${k}` : k;
}

/** 有界 BFS 最短路求解器；maxMoves 用来认证“倒计时内必解”。 */
export function solveBoard(board: SokobanBoard, player: Vec2, options: SolveOptions = {}): SolveResult | null {
  const maxNodes = Math.max(1, Math.floor(options.maxNodes ?? MAX_SOLVE_NODES));
  const maxMoves = Math.max(0, Math.floor(options.maxMoves ?? Number.MAX_SAFE_INTEGER));
  const initial: SearchNode = {
    player: { ...player },
    blocks: [...board.blocks],
    modifiers: [...(board.blockModifiers ?? new Array(board.blocks.length).fill('none') as BlockModifier[])],
    depth: 0,
    movedBlockMask: 0
  };
  if (beamReachesBody(board, initial.blocks, initial.modifiers)) {
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
      if (beamReachesBody(board, next.blocks, next.modifiers)) {
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

/** 把水阵石放在雷路侧边，玩家必须将它推入 rift 才能续接光路。
 * docs/31 §3.3 宽脉桥：stage≥4 时以修饰族概率改凿 2 连格 rift 并给石附 wide——
 * 一石跨两断脉，玩家只需推一次即可续接双断口。 */
function installConductorBridge(
  board: SokobanBoard,
  path: readonly Vec2[],
  rng: Rng,
  options: { readonly wide: boolean }
): boolean {
  for (const candidate of randomized(straightPathCandidates(path), rng)) {
    const target = candidate.cell;
    if (!isPlainCell(board, target.x, target.y)) continue;
    for (const side of randomized(perpendicularVectors(candidate.dir), rng)) {
      const stone = { x: target.x - side.x, y: target.y - side.y };
      const stand = { x: target.x - side.x * 2, y: target.y - side.y * 2 };
      if (!isPlainCell(board, stone.x, stone.y) || !isPlainCell(board, stand.x, stand.y)) continue;
      const secondRift = { x: target.x + dv(candidate.dir).x, y: target.y + dv(candidate.dir).y };
      const useWide = options.wide && isPlainCell(board, secondRift.x, secondRift.y);
      board.terrain[idx(board, target.x, target.y)] = 'rift';
      const stoneIndex = idx(board, stone.x, stone.y);
      board.blocks[stoneIndex] = 'conductor';
      if (useWide) {
        board.terrain[idx(board, secondRift.x, secondRift.y)] = 'rift';
        if (!board.blockModifiers) {
          board.blockModifiers = new Array(board.blocks.length).fill('none') as BlockModifier[];
        }
        board.blockModifiers[stoneIndex] = 'wide';
      }
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
  const wideBridgeChance = !options.disableModifiers && stage >= 4 ? Math.min(0.1 + 0.02 * stage, 0.25) : 0;
  if (requiredBlockKinds.includes('conductor') && !installConductorBridge(board, path, rng, { wide: rng.chance(wideBridgeChance) })) return null;
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

/**
 * 劫式三型标签（docs/31 §4.3）：生成期确定性判定，多命中取 快>缠>势。
 * 快=余量极紧或含绝缘石；缠=保草目标 ≥2 且初始光路距任一灵草曼哈顿 ≤1；势=其余（折点多的默认势型）。
 */
export function deriveFlavorTag(input: {
  readonly certifiedMoves: number;
  readonly budgetSlack: number;
  readonly requiredBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly board: SokobanBoard;
  readonly bendCount?: number;
  readonly archetype?: SokobanArchetype;
}): SokobanFlavorTag {
  const slackRatio = input.certifiedMoves > 0 ? input.budgetSlack / input.certifiedMoves : 1;
  if (slackRatio <= 0.35 || input.requiredBlockKinds.includes('insulator')) return 'swift';
  const herbs: Vec2[] = [];
  for (let i = 0; i < input.board.terrain.length; i++) {
    if (input.board.terrain[i] === 'herb') {
      herbs.push({ x: i % input.board.width, y: Math.floor(i / input.board.width) });
    }
  }
  if (herbs.length >= 2) {
    const beam = traceBeam(input.board);
    const nearBeam = herbs.some(herb =>
      beam.cells.some(cell => Math.abs(cell.x - herb.x) + Math.abs(cell.y - herb.y) <= 1)
    );
    if (nearBeam) return 'entangling';
  }
  return 'momentum';
}

/** 修饰阵石附着（docs/31 §3.3）：stage≥4 起对 mirror 附 mirror-ccw、对 insulator 附 burning；在认证前完成。 */
function attachModifiers(stage: number, rng: Rng, board: SokobanBoard, options: GenerateBoardOptions): void {
  if (options.disableModifiers || stage < 4) return;
  const p = Math.min(0.1 + 0.02 * stage, 0.25);
  if (board.blockModifiers && board.blockModifiers.some(m => m !== 'none')) return; // 已附着（重试候选复用板面时不重复）
  const modifiers = board.blockModifiers ?? (new Array(board.blocks.length).fill('none') as BlockModifier[]);
  for (let i = 0; i < board.blocks.length; i++) {
    if (rng.intRange(1, 100) > Math.round(p * 100)) continue;
    if (board.blocks[i] === 'mirror') modifiers[i] = 'mirror-ccw';
    else if (board.blocks[i] === 'insulator') modifiers[i] = 'burning';
  }
  board.blockModifiers = modifiers;
}

/** 剥离全部修饰（保留 blockModifiers 数组以维持形状，全部置回 'none'）。 */
function stripModifiers(board: SokobanBoard): void {
  if (!board.blockModifiers) return;
  for (let i = 0; i < board.blockModifiers.length; i++) board.blockModifiers[i] = 'none';
}

/** 首步扇出（docs/31 §1.3）：对采纳候选的 4 个首步各有界重解，数仍在预算内得解的方向数。 */
function countFirstMoveFanout(
  board: SokobanBoard,
  player: Vec2,
  certifiedMoves: number,
  budget: number
): number {
  let fanout = 0;
  for (const dir of ALL_DIRS) {
    const probe: SearchNode = {
      player: { ...player },
      blocks: [...board.blocks],
      modifiers: [...(board.blockModifiers ?? (new Array(board.blocks.length).fill('none') as BlockModifier[]))],
      depth: 0,
      movedBlockMask: 0
    };
    const first = simulateMove(board, probe, dir);
    if (!first) continue;
    if (beamReachesBody(board, first.blocks, first.modifiers)) {
      fanout += 1;
      continue;
    }
    const rest = solveBoard(
      { ...board, blocks: first.blocks, blockModifiers: first.modifiers },
      first.player,
      { maxNodes: 4000, maxMoves: Math.max(0, budget - 1) }
    );
    if (rest) fanout += 1;
  }
  return Math.min(fanout, 4);
}

/**
 * 生成一颗可解且初始未解的棋盘；耗尽尝试返回 null（调用方走模板兜底）。
 * docs/31 §1.3：32 次重试升级为「难度带定向」——目标带 center=10+6·stage、半径 4；
 * 带内候选即刻采纳，全程未中带则取离 center 最近者（消除同 stage 步数方差）。
 */
export function generateBoard(stage: number, rng: Rng, options: GenerateBoardOptions = {}): GenResult | null {
  const bandCenter = 10 + 6 * stage;
  const bandRadius = 4;
  interface ScoredCandidate {
    readonly result: GenResult;
    readonly solverNodes: number;
    readonly fanout: number;
    readonly distance: number;
  }
  let fallback: ScoredCandidate | null = null;
  for (let attempt = 0; attempt < 32; attempt++) {
    const r = tryGenerate(stage, rng, options);
    if (!r) continue;
    if (!r.board.blockModifiers) {
      r.board.blockModifiers = new Array(r.board.blocks.length).fill('none') as BlockModifier[];
    }
    attachModifiers(stage, rng, r.board, options);
    const initialReaches = beamReachesBody(r.board, r.board.blocks, r.board.blockModifiers);
    if (initialReaches) {
      // 修饰版初始即解：剥离修饰按无修饰板复检（保证生成成功率不因修饰下降）。
      stripModifiers(r.board);
      if (beamReachesBody(r.board, r.board.blocks, r.board.blockModifiers)) continue;
    }
    let solution: ReturnType<typeof solveBoard> = solveBoard(r.board, r.player, { maxMoves: MAX_GENERATED_SOLUTION_MOVES });
    {
      const solved = solution;
      if (solved !== null && r.requiredBlockKinds.some(kind => !solved.movedBlockKinds.includes(kind))) {
        solution = null;
      }
    }
    if (!solution) {
      if (r.board.blockModifiers?.some(m => m !== 'none')) {
        stripModifiers(r.board);
        const stripped = solveBoard(r.board, r.player, { maxMoves: MAX_GENERATED_SOLUTION_MOVES });
        if (stripped && r.requiredBlockKinds.some(kind => !stripped.movedBlockKinds.includes(kind))) {
          continue;
        }
        if (stripped) {
          solution = stripped;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
    const budgetSlack = clamp(8 + stage * 2 + rng.intRange(0, 5), 8, 24);
    const moveBudget = solution.moves.length + budgetSlack;
    const candidate: GenResult = {
      ...r,
      moveBudget,
      challenge: {
        archetype: r.archetype,
        requiredBlockKinds: r.requiredBlockKinds,
        certifiedMoves: solution.moves.length,
        budgetSlack,
        preserveHerbsTarget: r.board.terrain.filter(terrain => terrain === 'herb').length,
        solverNodes: solution.exploredNodes,
        firstMoveFanout: 0,
        flavorTag: 'momentum'
      }
    };
    const distance = Math.abs(solution.moves.length - bandCenter);
    if (distance > bandRadius) {
      // 带外：留作保底，继续重试找更近的。
      if (!fallback || distance < fallback.distance) {
        fallback = { result: candidate, solverNodes: solution.exploredNodes, fanout: 0, distance };
      }
      continue;
    }
    const fanout = countFirstMoveFanout(r.board, r.player, solution.moves.length, moveBudget);
    const flavorTag = deriveFlavorTag({
      certifiedMoves: solution.moves.length,
      budgetSlack,
      requiredBlockKinds: r.requiredBlockKinds,
      board: r.board,
      bendCount: countMirrors(r.board),
      archetype: r.archetype
    });
    return { ...candidate, challenge: { ...candidate.challenge, firstMoveFanout: fanout, flavorTag } };
  }
  if (fallback) {
    // 保底：带外最近候选补全扇出与标签（有界求解，成本可控）。
    const board = fallback.result.board;
    const fanout = countFirstMoveFanout(board, fallback.result.player, fallback.result.challenge.certifiedMoves, fallback.result.moveBudget);
    const flavorTag = deriveFlavorTag({
      certifiedMoves: fallback.result.challenge.certifiedMoves,
      budgetSlack: fallback.result.challenge.budgetSlack,
      requiredBlockKinds: fallback.result.challenge.requiredBlockKinds,
      board,
      bendCount: countMirrors(board),
      archetype: fallback.result.challenge.archetype
    });
    return { ...fallback.result, challenge: { ...fallback.result.challenge, firstMoveFanout: fanout, flavorTag } };
  }
  return null;
}

function countMirrors(board: SokobanBoard): number {
  let n = 0;
  for (const block of board.blocks) {
    if (block === 'mirror') n += 1;
  }
  return n;
}
