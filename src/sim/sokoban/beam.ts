/**
 * 雷光追踪：从雷源沿 sourceDir 步进，金阵石折 90°cw、水阵石可接续断裂雷脉、绝缘石/墙阻断、到身体=胜、穿灵草=烧毁。
 * 纯函数、确定性、零随机（仅依赖板面状态）。步数上限防 mirror 成环死循环。
 */
import type { Vec2 } from '@sim/world/types';
import { DIR_VECTORS, rotateCW, type BeamTrace, type SokobanBoard } from './types';

const MAX_BEAM_STEPS_MULT = 4;

export function idx(board: { readonly width: number }, x: number, y: number): number {
  return y * board.width + x;
}

export function inBounds(board: { readonly width: number; readonly height: number }, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
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
    if (terrain === 'rift' && block !== 'conductor') break;
    if (block === 'insulator') break;
    if (terrain === 'body') {
      reachedBody = true;
      break;
    }
    if (terrain === 'herb') herbsHit.push({ x, y });
    if (block === 'mirror') dir = rotateCW(dir); // 金阵石：折射后按新方向继续
    const step2 = DIR_VECTORS[dir];
    x += step2.x;
    y += step2.y;
  }

  return { cells, reachedBody, herbsHit };
}
