/**
 * R4′ 程序化棋盘生成器测试（docs/26 §4）。
 * 核心：生成的棋盘【可解】且【初始未解】（至少要推一步），确定性 + 多样性。
 */
import { describe, expect, test } from 'vitest';
import { generateBoard, solveBoard } from '@sim/sokoban/generator';
import { traceBeam } from '@sim/sokoban/beam';
import { createPuzzle } from '@sim/sokoban/logic';
import { Rng } from '@sim/world/rng';

describe('sokoban generator · 可解性与初始未解', () => {
  test('多 stage/seed：均可解、初始未解、源在界内', () => {
    for (const stage of [0, 1, 2, 3, 5] as const) {
      for (let seed = 0; seed < 6; seed++) {
        const rng = new Rng(`sokoban:${stage}:${seed}`);
        const g = generateBoard(stage, rng);
        expect(g, `stage ${stage} seed ${seed} 应生成成功`).not.toBeNull();
        if (!g) continue;
        const initBeam = traceBeam(g.board);
        expect(initBeam.reachedBody, `stage ${stage} seed ${seed} 初始必须未解`).toBe(false);
        const solution = solveBoard(g.board, g.player, { maxMoves: g.moveBudget });
        expect(solution, `stage ${stage} seed ${seed} 必须在预算内可解`).not.toBeNull();
        expect(solution?.moves.length).toBe(g.challenge.certifiedMoves);
        expect(g.moveBudget - g.challenge.certifiedMoves).toBe(g.challenge.budgetSlack);
        for (const kind of g.challenge.requiredBlockKinds) {
          expect(solution?.movedBlockKinds, `${kind} 必须参与最短解`).toContain(kind);
        }
        expect(g.board.sourcePos.x).toBeGreaterThanOrEqual(0);
        expect(g.board.sourcePos.x).toBeLessThan(g.board.width);
        expect(g.board.sourcePos.y).toBeGreaterThanOrEqual(0);
        expect(g.board.sourcePos.y).toBeLessThan(g.board.height);
      }
    }
  });
});

describe('sokoban generator · 确定性与多样性', () => {
  test('createPuzzle 同 stage+seedSalt ⇒ 同棋盘/玩家', () => {
    const a = createPuzzle(2, 7);
    const b = createPuzzle(2, 7);
    expect(a.board.terrain).toEqual(b.board.terrain);
    expect(a.board.blocks).toEqual(b.board.blocks);
    expect(a.player).toEqual(b.player);
  });

  test('多样性：同 stage 多个 seedSalt 产生 ≥3 种不同棋盘', () => {
    const sigs = new Set<string>();
    for (let seed = 0; seed < 6; seed++) {
      const s = createPuzzle(2, seed);
      sigs.add(JSON.stringify(s.board.terrain) + JSON.stringify(s.board.blocks) + JSON.stringify(s.player));
    }
    expect(sigs.size).toBeGreaterThanOrEqual(3);
  });

  test('劫式组合：中后期样本实际出现封脉、断脉与复合阵', () => {
    const archetypes = new Set<string>();
    for (let stage = 1; stage <= 6; stage += 1) {
      for (let seed = 0; seed < 8; seed += 1) archetypes.add(createPuzzle(stage, seed).challenge?.archetype ?? 'none');
    }
    expect(archetypes.has('sealed-meridian')).toBe(true);
    expect(archetypes.has('broken-meridian')).toBe(true);
    expect(archetypes.has('compound-array')).toBe(true);
  });
});
