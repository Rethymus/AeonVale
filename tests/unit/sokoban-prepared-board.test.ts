import { describe, expect, test } from 'vitest';
import { createCultivationRunState, deriveTribulationPreparation } from '@sim/cultivation-run';
import { createPuzzle } from '@sim/sokoban/logic';
import { applyPreparationToPuzzle } from '@sim/sokoban/prepared-board';
import { isSolvable } from '@sim/sokoban/generator';

describe('D27-d · 日程准备进入棋盘', () => {
  test('同一棋盘与同一准备得到完全相同的灵草和阵石落位', () => {
    const preparation = deriveTribulationPreparation(
      createCultivationRunState({ overrides: { herbs: 3, insight: 8 } }),
      { unlockedBlockKinds: ['conductor'] }
    );
    const base = createPuzzle(0, 13);

    const a = applyPreparationToPuzzle(base, preparation, ['starting-herb:thunder']);
    const b = applyPreparationToPuzzle(base, preparation, ['starting-herb:thunder']);

    expect(a).toEqual(b);
    expect(a.preparedHerbIndices.length).toBeGreaterThan(0);
    expect(a.placedBlockKinds).toEqual(['conductor']);
    expect(a.appliedBoardModifierTags).toContain('starting-herb:thunder');
    expect(isSolvable(a.state.board, a.state.player)).toBe(true);
  });

  test('有灵田准备时棋盘出现可烧毁灵草，无准备时不凭空增加', () => {
    const base = createPuzzle(0, 17);
    const empty = deriveTribulationPreparation(createCultivationRunState());
    const farmed = deriveTribulationPreparation(createCultivationRunState({ overrides: { herbs: 3 } }));

    const withoutHerbs = applyPreparationToPuzzle(base, empty);
    const withHerbs = applyPreparationToPuzzle(base, farmed);

    expect(withoutHerbs.preparedHerbIndices).toHaveLength(0);
    expect(withHerbs.preparedHerbIndices).toHaveLength(3);
    expect(withHerbs.state.herbsTotal).toBe(base.herbsTotal + 3);
    for (const index of withHerbs.preparedHerbIndices) {
      expect(withHerbs.state.board.terrain[index]).toBe('herb');
      expect(withHerbs.state.scorched[index]).toBe(false);
    }
  });

  test('事件起始灵草独立于当世灵田库存，且与准备灵草分别计数', () => {
    const base = createPuzzle(0, 19);
    const empty = deriveTribulationPreparation(createCultivationRunState());
    const farmed = deriveTribulationPreparation(createCultivationRunState({ overrides: { herbs: 3 } }));

    const eventOnly = applyPreparationToPuzzle(base, empty, ['starting-herb:thunder']);
    const combined = applyPreparationToPuzzle(base, farmed, ['starting-herb:thunder']);

    expect(eventOnly.preparedHerbIndices).toHaveLength(1);
    expect(eventOnly.inventoryHerbIndices).toHaveLength(0);
    expect(eventOnly.eventHerbIndices).toHaveLength(1);
    expect(eventOnly.state.herbsTotal).toBe(base.herbsTotal + 1);
    expect(eventOnly.appliedBoardModifierTags).toContain('starting-herb:thunder');
    expect(combined.preparedHerbIndices).toHaveLength(4);
    expect(combined.inventoryHerbIndices).toHaveLength(3);
    expect(combined.eventHerbIndices).toHaveLength(1);
    expect(combined.state.herbsTotal).toBe(base.herbsTotal + 4);
  });

  test('剑痕只在不破坏可解性时落为真实障碍，第二雷源保持显式未消费', () => {
    const base = createPuzzle(1, 5);
    const preparation = deriveTribulationPreparation(createCultivationRunState());
    const result = applyPreparationToPuzzle(base, preparation, [
      'sword-scar-obstacle:1',
      'second-lightning-source:1'
    ]);

    expect(result.appliedBoardModifierTags).toContain('sword-scar-obstacle:1');
    expect(result.ignoredBoardModifierTags).toContain('second-lightning-source:1');
    expect(result.state.board.terrain).toContain('wall');
    expect(isSolvable(result.state.board, result.state.player)).toBe(true);
    expect(result.state.beam.reachedBody).toBe(false);
  });

  test('不修改调用方传入的基础棋盘与准备数据', () => {
    const base = createPuzzle(0, 23);
    const preparation = deriveTribulationPreparation(
      createCultivationRunState({ overrides: { herbs: 2 } }),
      { unlockedBlockKinds: ['conductor'] }
    );
    const baseBefore = structuredClone(base);
    const preparationBefore = structuredClone(preparation);

    applyPreparationToPuzzle(base, preparation, ['starting-herb:thunder']);

    expect(base).toEqual(baseBefore);
    expect(preparation).toEqual(preparationBefore);
  });
});
