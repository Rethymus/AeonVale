/**
 * R4′ 布阵导流 sim 切片单测。
 * 用合成棋盘精确验证：beam 追踪（直达/墙阻/绝缘阻/金阵石折射/水阵石直通/灵草记录）、
 * 推箱（移动/被墙挡）、胜负（推箱后雷光到身体=胜、步数耗尽=负）、确定性。AAA。
 */
import { describe, expect, test } from 'vitest';
import { traceBeam } from '@sim/sokoban/beam';
import { applyMove, createPuzzle } from '@sim/sokoban/logic';
import type { BlockKind, Dir, SokobanBoard, SokobanState, Terrain } from '@sim/sokoban/types';
import type { Vec2 } from '@sim/world/types';

function board(spec: {
  w: number;
  h: number;
  rows: readonly string[];
  source: Vec2;
  dir: Dir;
  blocks?: ReadonlyArray<{ kind: Exclude<BlockKind, 'none'>; x: number; y: number }>;
}): SokobanBoard {
  const { w, h, rows, source, dir, blocks = [] } = spec;
  const terrain: Terrain[] = [];
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? '.';
      terrain.push(ch === '#' ? 'wall' : ch === 'B' ? 'body' : ch === 'H' ? 'herb' : ch === 'S' ? 'source' : 'empty');
    }
  }
  const bl: BlockKind[] = new Array(w * h).fill('none') as BlockKind[];
  for (const b of blocks) bl[b.y * w + b.x] = b.kind;
  return { width: w, height: h, terrain, blocks: bl, sourcePos: source, sourceDir: dir };
}

function state(b: SokobanBoard, player: Vec2, moveBudget: number): SokobanState {
  return {
    stage: 0,
    board: b,
    player,
    beam: traceBeam(b),
    scorched: new Array(b.width * b.height).fill(false) as boolean[],
    herbsTotal: b.terrain.filter(t => t === 'herb').length,
    moveBudget,
    movesUsed: 0,
    status: 'playing'
  };
}

describe('sokoban · beam 追踪', () => {
  test('直线直达身体', () => {
    const b = board({ w: 4, h: 1, rows: ['S..B'], source: { x: 0, y: 0 }, dir: 'right' });
    const beam = traceBeam(b);
    expect(beam.reachedBody).toBe(true);
    expect(beam.cells.map(c => c.x)).toEqual([1, 2, 3]);
  });

  test('墙阻断', () => {
    const b = board({ w: 5, h: 1, rows: ['S.#.B'], source: { x: 0, y: 0 }, dir: 'right' });
    expect(traceBeam(b).reachedBody).toBe(false);
  });

  test('绝缘石阻断（可推阵石）', () => {
    const b = board({ w: 5, h: 1, rows: ['S...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'insulator', x: 2, y: 0 }] });
    expect(traceBeam(b).reachedBody).toBe(false);
  });

  test('金阵石折射 right→down，再到身体', () => {
    const b = board({ w: 4, h: 4, rows: ['S...', '....', '....', '...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'mirror', x: 3, y: 0 }] });
    const beam = traceBeam(b);
    expect(beam.reachedBody).toBe(true);
    expect(beam.cells).toContainEqual({ x: 3, y: 0 });
    expect(beam.cells).toContainEqual({ x: 3, y: 3 });
  });

  test('水阵石直通（不折射）', () => {
    const b = board({ w: 5, h: 1, rows: ['S...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'conductor', x: 2, y: 0 }] });
    expect(traceBeam(b).reachedBody).toBe(true);
  });

  test('穿灵草记录烧毁且不阻断', () => {
    const b = board({ w: 5, h: 1, rows: ['S.H.B'], source: { x: 0, y: 0 }, dir: 'right' });
    const beam = traceBeam(b);
    expect(beam.herbsHit).toEqual([{ x: 2, y: 0 }]);
    expect(beam.reachedBody).toBe(true);
  });
});

describe('sokoban · 推箱与胜负', () => {
  test('推箱移动阵石与玩家；折射后雷光到身体=胜', () => {
    // 雷源(0,0)→右；金阵石在 (2,0)，玩家在 (1,0)。初始雷光被镜折射下行，未到身体(3,3)。
    const b = board({ w: 4, h: 4, rows: ['S...', '....', '....', '...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'mirror', x: 2, y: 0 }] });
    const s = state(b, { x: 1, y: 0 }, 10);
    expect(s.beam.reachedBody).toBe(false);
    // 把金阵石从 (2,0) 推到 (3,0)：玩家右推 → 雷光在 (3,0) 折下行至 (3,3) 身体
    const out = applyMove(s, { kind: 'move', dir: 'right' });
    expect(out.ok).toBe(true);
    expect(s.player).toEqual({ x: 2, y: 0 });
    expect(s.board.blocks[3]).toBe('mirror'); // (3,0) idx=0*4+3=3
    expect(s.status).toBe('won');
  });

  test('箱子后方是墙 → 推不动，玩家不动、不耗步', () => {
    const b = board({ w: 4, h: 1, rows: ['S..#'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'mirror', x: 2, y: 0 }] });
    const s = state(b, { x: 1, y: 0 }, 10);
    const out = applyMove(s, { kind: 'move', dir: 'right' });
    expect(out.ok).toBe(false);
    expect(s.player).toEqual({ x: 1, y: 0 });
    expect(s.movesUsed).toBe(0);
  });

  test('步数预算耗尽且未到身体=负', () => {
    const b = board({ w: 4, h: 4, rows: ['S...', '....', '....', '...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'mirror', x: 2, y: 0 }] });
    const s = state(b, { x: 1, y: 0 }, 1);
    applyMove(s, { kind: 'move', dir: 'down' }); // 走开，不引雷到身体
    expect(s.status).toBe('lost');
  });

  test('结束后拒动（胜后）', () => {
    const b = board({ w: 4, h: 4, rows: ['S...', '....', '....', '...B'], source: { x: 0, y: 0 }, dir: 'right', blocks: [{ kind: 'mirror', x: 2, y: 0 }] });
    const s = state(b, { x: 1, y: 0 }, 10);
    applyMove(s, { kind: 'move', dir: 'right' }); // 推镜到 (3,0) → 雷光到身体 → won
    expect(s.status).toBe('won');
    expect(applyMove(s, { kind: 'move', dir: 'left' }).ok).toBe(false);
  });
});

describe('sokoban · 确定性', () => {
  test('createPuzzle 同 stage ⇒ 同棋盘/玩家/雷光', () => {
    const a = createPuzzle(0);
    const b = createPuzzle(0);
    expect(a.board.terrain).toEqual(b.board.terrain);
    expect(a.board.blocks).toEqual(b.board.blocks);
    expect(a.player).toEqual(b.player);
    expect(a.beam.cells).toEqual(b.beam.cells);
  });
});
