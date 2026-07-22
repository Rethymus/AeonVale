import { describe, expect, test } from 'vitest';
import { createCultivationRunState } from '@sim/cultivation-run/agenda';
import { deriveTribulationPreparation, type TribulationPreparation } from '@sim/cultivation-run/preparation';
import { evaluateTribulation } from '@sim/sokoban/power';
import type { SokobanState } from '@sim/sokoban/types';

function straightBeamState(status: SokobanState['status'] = 'won'): SokobanState {
  return {
    stage: 0,
    board: {
      width: 4,
      height: 1,
      terrain: ['source', 'empty', 'empty', 'body'],
      blocks: ['none', 'none', 'none', 'none'],
      sourcePos: { x: 0, y: 0 },
      sourceDir: 'right'
    },
    player: { x: 1, y: 0 },
    beam: {
      cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      reachedBody: status === 'won',
      herbsHit: []
    },
    scorched: [false, false, false, false],
    herbsTotal: 0,
    moveBudget: 10,
    movesUsed: status === 'lost' ? 10 : 2,
    status
  };
}

function preparation(overrides: Partial<TribulationPreparation>): TribulationPreparation {
  return {
    minTemperingPower: 80,
    maxSurvivablePower: 110,
    sweetSpotMinPower: 90,
    sweetSpotMaxPower: 100,
    moveBudgetBonus: 0,
    previewLevel: 0,
    undoCharges: 0,
    wardCharges: 0,
    protectedHerbCount: 0,
    unlockedBlockKinds: [],
    startingHerbs: [],
    sourcePowerBonus: 0,
    eventPowerModifierMilli: 1000,
    pressure: 20,
    mortalHeart: 50,
    ...overrides
  };
}

describe('D27-d · 当世准备', () => {
  test('苦练形成的体魄与耐力提高可承受雷威上限', () => {
    const baseline = deriveTribulationPreparation(createCultivationRunState());
    const trained = deriveTribulationPreparation(createCultivationRunState({
      overrides: { bodyFoundation: 3200, endurance: 1400, willpower: 800 }
    }));

    expect(trained.maxSurvivablePower).toBeGreaterThan(baseline.maxSurvivablePower);
  });

  test('炼丹、灵田、参悟资源映射为可见天劫工具', () => {
    const prep = deriveTribulationPreparation(createCultivationRunState({
      overrides: { pills: 4, herbs: 5, insight: 9, mortalHeart: 76 }
    }));

    expect(prep.undoCharges).toBe(1);
    expect(prep.wardCharges).toBe(2);
    expect(prep.protectedHerbCount).toBe(3);
    expect(prep.startingHerbs).toEqual([{ kind: 'conductive-moss', count: 3 }]);
    expect(prep.previewLevel).toBe(2);
    expect(prep.moveBudgetBonus).toBe(3);
  });

  test('丹药先分配护持，剩余丹药再折算撤步且不超库存', () => {
    const expected = [
      { pills: 0, wards: 0, undos: 0 },
      { pills: 1, wards: 1, undos: 0 },
      { pills: 2, wards: 2, undos: 0 },
      { pills: 3, wards: 2, undos: 0 },
      { pills: 4, wards: 2, undos: 1 },
      { pills: 6, wards: 2, undos: 2 }
    ];

    for (const row of expected) {
      const prep = deriveTribulationPreparation(createCultivationRunState({ overrides: { pills: row.pills } }));
      expect(prep.wardCharges).toBe(row.wards);
      expect(prep.undoCharges).toBe(row.undos);
      expect(prep.wardCharges + prep.undoCharges * 2).toBeLessThanOrEqual(row.pills);
    }
  });

  test('非有限显式修正回退到中性值，不污染 preparation', () => {
    const prep = deriveTribulationPreparation(createCultivationRunState(), {
      minTemperingPowerBonus: Number.NaN,
      maxSurvivablePowerBonus: Number.POSITIVE_INFINITY,
      moveBudgetBonus: Number.NEGATIVE_INFINITY,
      previewLevelBonus: Number.NaN,
      undoChargesBonus: Number.POSITIVE_INFINITY,
      wardChargesBonus: Number.NaN,
      protectedHerbCountBonus: Number.NEGATIVE_INFINITY,
      sourcePowerBonus: Number.POSITIVE_INFINITY,
      eventPowerModifierMilli: Number.NaN
    });

    expect(prep.eventPowerModifierMilli).toBe(1000);
    expect(prep.sourcePowerBonus).toBe(0);
    for (const value of [
      prep.minTemperingPower,
      prep.maxSurvivablePower,
      prep.sweetSpotMinPower,
      prep.sweetSpotMaxPower,
      prep.moveBudgetBonus,
      prep.previewLevel,
      prep.undoCharges,
      prep.wardCharges,
      prep.protectedHerbCount
    ]) expect(Number.isFinite(value)).toBe(true);
  });

  test('伤势与过高心压降低承雷上限', () => {
    const calm = deriveTribulationPreparation(createCultivationRunState({
      overrides: { bodyFoundation: 5000, endurance: 2000, pressure: 60, injury: 0 }
    }));
    const strained = deriveTribulationPreparation(createCultivationRunState({
      overrides: { bodyFoundation: 5000, endurance: 2000, pressure: 100, injury: 30 }
    }));

    expect(strained.maxSurvivablePower).toBeLessThan(calm.maxSurvivablePower);
  });
});

describe('D27-d · 雷威结果谱系', () => {
  test('同一条光路可由安全区间区分不足、完美、承受与过载', () => {
    const state = straightBeamState();

    expect(evaluateTribulation(state, preparation({ minTemperingPower: 100, maxSurvivablePower: 130, sweetSpotMinPower: 110, sweetSpotMaxPower: 120 })).result).toBe('insufficient');
    expect(evaluateTribulation(state, preparation({ minTemperingPower: 80, maxSurvivablePower: 110, sweetSpotMinPower: 90, sweetSpotMaxPower: 100 })).result).toBe('perfect');
    expect(evaluateTribulation(state, preparation({ minTemperingPower: 80, maxSurvivablePower: 110, sweetSpotMinPower: 80, sweetSpotMaxPower: 90 })).result).toBe('survived');
    expect(evaluateTribulation(state, preparation({ minTemperingPower: 50, maxSurvivablePower: 90, sweetSpotMinPower: 60, sweetSpotMaxPower: 80 })).result).toBe('overload');
  });

  test('步数耗尽优先判为 timeout', () => {
    expect(evaluateTribulation(straightBeamState('lost'), preparation({})).result).toBe('timeout');
  });

  test('天象修正显式改变雷威，不改棋盘', () => {
    const state = straightBeamState();
    const original = structuredClone(state);
    const normal = evaluateTribulation(state, preparation({ eventPowerModifierMilli: 1000 }));
    const surge = evaluateTribulation(state, preparation({ eventPowerModifierMilli: 1200 }));

    expect(surge.beamPower).toBeGreaterThan(normal.beamPower);
    expect(state).toEqual(original);
  });
});
