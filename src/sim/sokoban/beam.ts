/**
 * 雷光追踪：从雷源沿 sourceDir 步进，金阵石折 90°cw、水阵石可接续断裂雷脉、绝缘石/墙阻断、到身体=胜、穿灵草=烧毁。
 * 纯函数、确定性、零随机（仅依赖板面状态）。步数上限防 mirror 成环死循环。
 */
import type { Vec2 } from '@sim/world/types';
import {
  DIR_VECTORS,
  rotateCCW,
  rotateCW,
  type BeamTrace,
  type BlockKind,
  type BlockModifier,
  type SokobanBoard,
  type Terrain
} from './types';

const MAX_BEAM_STEPS_MULT = 4;

export function idx(board: { readonly width: number }, x: number, y: number): number {
  return y * board.width + x;
}

export function inBounds(board: { readonly width: number; readonly height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

/** 读取格位修饰；blockModifiers 缺省（旧档/模板）视为全 'none'。 */
export function modifierAt(board: { readonly blockModifiers?: readonly BlockModifier[] }, i: number): BlockModifier {
  return board.blockModifiers?.[i] ?? 'none';
}

/** 宽脉桥（docs/31 §3.3）：任一四邻格上的 wide 水阵石可为本 rift 格续脉（一石跨两断脉）。 */
function riftBridgedByWide(board: SokobanBoard, x: number, y: number): boolean {
  const neighbors = [
    { x: x - 1, y },
    { x: x + 1, y },
    { x, y: y - 1 },
    { x, y: y + 1 }
  ];
  for (const n of neighbors) {
    if (!inBounds(board, n.x, n.y)) continue;
    const i = idx(board, n.x, n.y);
    if ((board.blocks[i] ?? 'none') === 'conductor' && modifierAt(board, i) === 'wide') return true;
  }
  return false;
}

export function traceBeam(board: SokobanBoard): BeamTrace {
  const cells: Vec2[] = [];
  const herbsHit: Vec2[] = [];
  let reachedBody = false;
  const dv = DIR_VECTORS[board.sourceDir];
  let x = board.sourcePos.x + dv.x;
  let y = board.sourcePos.y + dv.y;
  let dir = board.sourceDir;
  const maxSteps = board.width * board.height * MAX_BEAM_STEPS_MULT;

  for (let step = 0; step < maxSteps; step++) {
    if (!inBounds(board, x, y)) break;
    const i = idx(board, x, y);
    const terrain = board.terrain[i] ?? 'empty';
    if (terrain === 'wall' || terrain === 'source') break;
    const block = board.blocks[i] ?? 'none';
    cells.push({ x, y });
    if (terrain === 'rift' && block !== 'conductor' && !riftBridgedByWide(board, x, y)) break;
    if (block === 'insulator') break;
    // 护脉草（docs/31 §3.3）：替身体挡一次雷——该次光路在此截断，随后由 move 应用耗尽它。
    if (terrain === 'herb-shield') break;
    if (terrain === 'body') {
      reachedBody = true;
      break;
    }
    if (terrain === 'herb' || terrain === 'herb-thunder') herbsHit.push({ x, y });
    if (block === 'mirror') {
      // 逆折镜（mirror-ccw 修饰）折向逆时针，基型金阵石折向顺时针（docs/31 §3.3）。
      dir = modifierAt(board, i) === 'mirror-ccw' ? rotateCCW(dir) : rotateCW(dir);
    }
    const step2 = DIR_VECTORS[dir];
    x += step2.x;
    y += step2.y;
  }

  return { cells, reachedBody, herbsHit };
}

/**
 * 一次性守卫的耗尽判定（docs/31 §3.3，有状态光路的唯一状态迁移）：
 * 光路被截断时检查末格——焚绝缘（insulator+burning）自毁为空、护脉草（herb-shield）
 * 耗尽为空地。返回是否发生耗尽；调用方耗尽后需重追光路。
 * 纯板面判定 + 就地迁移；solver 与 applyMove 共用本函数保证语义一致。
 */
export function consumeOneShotGuard(
  board: { readonly width: number; readonly terrain: Terrain[] },
  blocks: BlockKind[],
  modifiers: BlockModifier[] | undefined,
  beam: BeamTrace
): boolean {
  if (beam.reachedBody || beam.cells.length === 0) return false;
  const last = beam.cells[beam.cells.length - 1]!;
  const i = idx(board, last.x, last.y);
  if ((blocks[i] ?? 'none') === 'insulator' && (modifiers?.[i] ?? 'none') === 'burning') {
    blocks[i] = 'none';
    if (modifiers) modifiers[i] = 'none';
    return true;
  }
  if ((board.terrain[i] ?? 'empty') === 'herb-shield') {
    board.terrain[i] = 'empty';
    return true;
  }
  return false;
}
