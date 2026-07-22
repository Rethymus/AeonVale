/**
 * R4′ 布阵导流 —— 棋盘构建 + 推箱 reducer + 胜负。
 *
 * applyMove 纯函数（可变状态、无 IO、无随机）：推-only Sokoban（只能推不能拉）→ 重算雷光 →
 * 烧毁灵草 → 判胜（雷光到身体=突破）/判负（步数预算耗尽）。
 * 棋盘来自手工模板（docs/26 §7：生成器质量是关键风险，原型先手工模板，程序生成留后续）。
 */
import { Rng } from '@sim/world/rng';
import type { Vec2 } from '@sim/world/types';
import { idx, inBounds, traceBeam } from './beam';
import { generateBoard, solveBoard, type GenerateBoardOptions } from './generator';
import {
  DIR_VECTORS,
  type BlockKind,
  type Dir,
  type SokobanAction,
  type SokobanActionOutcome,
  type SokobanBoard,
  type SokobanChallenge,
  type SokobanState,
  type Terrain
} from './types';

interface Template {
  readonly width: number;
  readonly height: number;
  readonly terrain: readonly string[]; // 行串：. 空  # 墙  S 雷源  B 身体  H 灵草
  readonly sourceDir: Dir;
  readonly blocks: ReadonlyArray<{ readonly kind: Exclude<BlockKind, 'none'>; readonly x: number; readonly y: number }>;
  readonly player: Vec2;
  readonly moveBudget: number;
}

/** 模板 A·入门：雷源(0,0)→右，身体(5,5)；把金阵石推到 (5,0) 折光下行至身体。 */
const TPL_A: Template = {
  width: 6,
  height: 6,
  terrain: ['S.....', '......', '......', '......', '......', '.....B'],
  sourceDir: 'right',
  blocks: [{ kind: 'mirror', x: 2, y: 2 }],
  player: { x: 0, y: 5 },
  moveBudget: 25
};

/** 模板 B·双折：雷源(0,0)→右，身体(0,5)；两块金阵石折出 ↘↙ 光路。灵草(4,0) 惩罚莽撞直射。 */
const TPL_B: Template = {
  width: 6,
  height: 6,
  terrain: ['S...H.', '......', '......', '......', '......', 'B.....'],
  sourceDir: 'right',
  blocks: [
    { kind: 'mirror', x: 3, y: 1 },
    { kind: 'mirror', x: 3, y: 4 }
  ],
  player: { x: 2, y: 3 },
  moveBudget: 35
};

const TEMPLATES: readonly Template[] = [TPL_A, TPL_B];

function buildBoard(tpl: Template): { board: SokobanBoard; herbsTotal: number } {
  const terrain: Terrain[] = [];
  let sourcePos: Vec2 = { x: 0, y: 0 };
  let herbsTotal = 0;
  for (let y = 0; y < tpl.height; y++) {
    const row = tpl.terrain[y] ?? '';
    for (let x = 0; x < tpl.width; x++) {
      const ch = row[x] ?? '.';
      let t: Terrain = 'empty';
      if (ch === '#') t = 'wall';
      else if (ch === 'S') {
        t = 'source';
        sourcePos = { x, y };
      } else if (ch === 'B') t = 'body';
      else if (ch === 'H') {
        t = 'herb';
        herbsTotal += 1;
      }
      terrain.push(t);
    }
  }
  const blocks: BlockKind[] = new Array(tpl.width * tpl.height).fill('none') as BlockKind[];
  for (const b of tpl.blocks) {
    if (inBounds({ width: tpl.width, height: tpl.height }, b.x, b.y)) blocks[idx({ width: tpl.width }, b.x, b.y)] = b.kind;
  }
  const board: SokobanBoard = { width: tpl.width, height: tpl.height, terrain, blocks, sourcePos, sourceDir: tpl.sourceDir };
  return { board, herbsTotal };
}

function makeState(
  stage: number,
  board: SokobanBoard,
  player: Vec2,
  moveBudget: number,
  challenge?: SokobanChallenge
): SokobanState {
  return {
    stage,
    board,
    player: { ...player },
    beam: traceBeam(board),
    scorched: new Array(board.width * board.height).fill(false) as boolean[],
    herbsTotal: board.terrain.filter(t => t === 'herb').length,
    moveBudget,
    movesUsed: 0,
    status: 'playing',
    ...(challenge ? { challenge } : {})
  };
}

/**
 * 开局：优先程序化生成（docs/26 §4），seedSalt 控制同阶不同布局；生成失败回退手工模板。
 * 确定性：同 stage + seedSalt ⇒ 同棋盘（可复现 / 可蒙特卡洛调参）。
 */
export function createPuzzle(
  stage: number,
  seedSalt = 0,
  rng?: Rng,
  options: GenerateBoardOptions = {}
): SokobanState {
  const safeStage = Math.max(0, stage);
  const r = rng ?? new Rng(`sokoban:${safeStage}:${seedSalt}`);
  const gen = generateBoard(safeStage, r, options);
  if (gen) return makeState(safeStage, gen.board, gen.player, gen.moveBudget, gen.challenge);
  const tpl = TEMPLATES[safeStage % TEMPLATES.length] ?? TEMPLATES[0]!;
  const { board } = buildBoard(tpl);
  const solution = solveBoard(board, tpl.player, { maxMoves: tpl.moveBudget });
  const certifiedMoves = solution?.moves.length ?? tpl.moveBudget;
  return makeState(safeStage, board, tpl.player, Math.max(tpl.moveBudget, certifiedMoves + 8), {
    archetype: 'turning-rune',
    requiredBlockKinds: ['mirror'],
    certifiedMoves,
    budgetSlack: Math.max(0, tpl.moveBudget - certifiedMoves),
    preserveHerbsTarget: board.terrain.filter(terrain => terrain === 'herb').length
  });
}

/** 还存活的灵草数（未被烧毁）。 */
export function herbsAliveOf(state: SokobanState): number {
  let alive = 0;
  for (let i = 0; i < state.board.terrain.length; i++) {
    if (state.board.terrain[i] === 'herb' && !state.scorched[i]) alive += 1;
  }
  return alive;
}

function canEnter(t: Terrain): boolean {
  return t === 'empty' || t === 'body';
}

function canBlockRest(kind: Exclude<BlockKind, 'none'>, terrain: Terrain): boolean {
  return canEnter(terrain) || (kind === 'conductor' && terrain === 'rift');
}

export function applyMove(state: SokobanState, action: SokobanAction): SokobanActionOutcome {
  if (state.status !== 'playing') return { ok: false, reason: 'not-playing' };
  if (action.kind !== 'move') return { ok: false, reason: 'unknown-action' };
  const dv = DIR_VECTORS[action.dir];
  const board = state.board;
  const tx = state.player.x + dv.x;
  const ty = state.player.y + dv.y;
  if (!inBounds(board, tx, ty)) return { ok: false, reason: 'out-of-bounds' };
  const ti = idx(board, tx, ty);
  const targetTerrain = board.terrain[ti] ?? 'empty';
  if (!canEnter(targetTerrain)) return { ok: false, reason: 'blocked-by-fixed' };
  const targetBlock = board.blocks[ti] ?? 'none';

  if (targetBlock !== 'none') {
    // 推箱：检查箱子后方
    const bx = tx + dv.x;
    const by = ty + dv.y;
    if (!inBounds(board, bx, by)) return { ok: false, reason: 'push-off-board' };
    const bi = idx(board, bx, by);
    if (!canBlockRest(targetBlock, board.terrain[bi] ?? 'empty')) return { ok: false, reason: 'push-into-obstacle' };
    if ((board.blocks[bi] ?? 'none') !== 'none') return { ok: false, reason: 'push-into-block' };
    board.blocks[bi] = targetBlock;
    board.blocks[ti] = 'none';
  }
  state.player = { x: tx, y: ty };
  state.movesUsed += 1;
  state.beam = traceBeam(board);
  for (const herb of state.beam.herbsHit) state.scorched[idx(board, herb.x, herb.y)] = true;

  if (state.beam.reachedBody) state.status = 'won';
  else if (state.movesUsed >= state.moveBudget) state.status = 'lost';
  return { ok: true };
}
