import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  createCultivationRunState,
  resolveCultivationAgenda,
  type CultivationActivityId,
  type CultivationAgenda,
  type CultivationRunState
} from '@sim/cultivation-run';

function agenda(...slots: CultivationActivityId[]): CultivationAgenda {
  return { slots };
}

function resolve(state: CultivationRunState, ...slots: CultivationActivityId[]) {
  return resolveCultivationAgenda(state, agenda(...slots));
}

describe('D27-b 修仙日程 · 状态与六格契约', () => {
  it('创建确定的默认一世状态', () => {
    expect(createCultivationRunState()).toEqual({
      seed: 1,
      stage: 0,
      agendaIndex: 0,
      status: 'active',
      lifespanRemainingDays: DEFAULT_BALANCE.bodyCultivation.lifespanStartDays,
      bodyFoundation: 0,
      endurance: 0,
      willpower: 0,
      pillPoison: 0,
      heavenDebt: 0,
      daoAttention: 0,
      pressure: DEFAULT_BALANCE.cultivationRun.startPressure,
      mortalHeart: DEFAULT_BALANCE.cultivationRun.startMortalHeart,
      insight: 0,
      injury: 0,
      herbs: 0,
      food: DEFAULT_BALANCE.cultivationRun.startFood,
      spiritStones: 0,
      pills: 0
    });
  });

  it.each([
    ['不足六格', agenda('farming', 'rest', 'training', 'livelihood', 'insight')],
    ['超过六格', agenda('farming', 'rest', 'training', 'livelihood', 'insight', 'alchemy', 'farming')]
  ])('%s时拒绝结算', (_label, invalidAgenda) => {
    const initial = createCultivationRunState();
    const result = resolveCultivationAgenda(initial, invalidAgenda);

    expect(result).toMatchObject({
      ok: false,
      state: initial,
      slots: [],
      error: { code: 'invalid-slot-count', slotIndex: null, activity: null }
    });
    expect(initial.agendaIndex).toBe(0);
  });
});

describe('D27-b 修仙日程 · 顺序依赖与原子性', () => {
  it('灵田在前可供本轮炼丹使用，炼丹在前则因无灵草而失败', () => {
    const initial = createCultivationRunState();
    const farmingFirst = resolve(initial, 'farming', 'alchemy', 'farming', 'farming', 'farming', 'farming');
    const alchemyFirst = resolve(initial, 'alchemy', 'farming', 'farming', 'farming', 'farming', 'farming');

    expect(farmingFirst.ok).toBe(true);
    if (farmingFirst.ok) {
      expect(farmingFirst.slots[0]?.delta.herbs).toBeGreaterThan(0);
      expect(farmingFirst.slots[1]?.delta.herbs).toBe(-DEFAULT_BALANCE.cultivationRun.activities.alchemy.herbCost);
      expect(farmingFirst.state.pills).toBeGreaterThan(0);
    }
    expect(alchemyFirst).toMatchObject({
      ok: false,
      state: initial,
      slots: [],
      error: { code: 'insufficient-herbs', slotIndex: 0, activity: 'alchemy' }
    });
  });

  it('谋生在前可支付本轮参悟，参悟在前则因无灵石而失败', () => {
    const initial = createCultivationRunState();
    const livelihoodFirst = resolve(initial, 'livelihood', 'insight', 'farming', 'farming', 'farming', 'farming');
    const insightFirst = resolve(initial, 'insight', 'livelihood', 'farming', 'farming', 'farming', 'farming');

    expect(livelihoodFirst.ok).toBe(true);
    if (livelihoodFirst.ok) {
      expect(livelihoodFirst.slots[0]?.delta.spiritStones).toBeGreaterThan(0);
      expect(livelihoodFirst.slots[1]?.delta.spiritStones).toBe(
        -DEFAULT_BALANCE.cultivationRun.activities.insight.spiritStoneCost
      );
      expect(livelihoodFirst.state.insight).toBeGreaterThan(0);
    }
    expect(insightFirst).toMatchObject({
      ok: false,
      state: initial,
      slots: [],
      error: { code: 'insufficient-spirit-stones', slotIndex: 0, activity: 'insight' }
    });
  });

  it('后续格失败时回滚此前已结算的收益且不改写输入状态', () => {
    const initial = createCultivationRunState();
    const snapshot = structuredClone(initial);
    const result = resolve(initial, 'farming', 'alchemy', 'alchemy', 'farming', 'farming', 'farming');

    expect(result).toMatchObject({
      ok: false,
      state: snapshot,
      slots: [],
      error: { code: 'insufficient-herbs', slotIndex: 2, activity: 'alchemy' }
    });
    expect(result.state).not.toBe(initial);
    expect(initial).toEqual(snapshot);
  });
});

describe('D27-b 修仙日程 · 压力、重复与歇息顺序', () => {
  it('连续重复苦练的第二格与第三格正向收益逐级递减', () => {
    const initial = createCultivationRunState({ overrides: { food: 6, pressure: 0, mortalHeart: 100 } });
    const result = resolve(initial, 'training', 'training', 'training', 'training', 'training', 'training');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots.map(slot => slot.efficiencyMilli)).toEqual([1000, 850, 700, 700, 700, 700]);
    expect(result.slots[0]?.delta.bodyFoundation).toBeGreaterThan(result.slots[1]?.delta.bodyFoundation ?? 0);
    expect(result.slots[1]?.delta.bodyFoundation).toBeGreaterThan(result.slots[2]?.delta.bodyFoundation ?? 0);
    expect(result.slots[2]?.delta.bodyFoundation).toBe(result.slots[3]?.delta.bodyFoundation);
  });

  it('前一格把心压推过阈值后，紧随其后的活动立即降效', () => {
    const threshold = DEFAULT_BALANCE.cultivationRun.pressurePenaltyThreshold;
    const initial = createCultivationRunState({ overrides: { pressure: threshold - 1 } });
    const result = resolve(initial, 'livelihood', 'farming', 'livelihood', 'farming', 'livelihood', 'farming');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.slots[0]?.efficiencyMilli).toBe(1000);
    expect(result.slots[0]?.delta.pressure).toBeGreaterThan(0);
    expect(initial.pressure + (result.slots[0]?.delta.pressure ?? 0)).toBeGreaterThanOrEqual(threshold);
    expect(result.slots[1]?.efficiencyMilli).toBe(DEFAULT_BALANCE.cultivationRun.pressurePenaltyEfficiencyMilli);
    expect(result.slots[1]?.delta.herbs).toBeLessThan(DEFAULT_BALANCE.cultivationRun.activities.farming.herbGain);
  });

  it('苦练后歇息可处理本轮伤势，先歇息再苦练则留下伤势', () => {
    const initial = createCultivationRunState();
    const trainThenRest = resolve(initial, 'training', 'rest', 'farming', 'farming', 'farming', 'farming');
    const restThenTrain = resolve(initial, 'rest', 'training', 'farming', 'farming', 'farming', 'farming');

    expect(trainThenRest.ok).toBe(true);
    expect(restThenTrain.ok).toBe(true);
    if (!trainThenRest.ok || !restThenTrain.ok) return;
    expect(trainThenRest.state.injury).toBe(0);
    expect(restThenTrain.state.injury).toBe(DEFAULT_BALANCE.cultivationRun.activities.training.injuryGain);
    expect(trainThenRest.state.injury).toBeLessThan(restThenTrain.state.injury);
  });
});

describe('D27-b 修仙日程 · 寿元边界', () => {
  it('寿元只差一天时在最后一格失败，并原子回滚整轮日程', () => {
    const farmingCost = DEFAULT_BALANCE.cultivationRun.activities.farming.timeCostDays;
    const initial = createCultivationRunState({
      overrides: { lifespanRemainingDays: farmingCost * DEFAULT_BALANCE.cultivationRun.slotsPerAgenda - 1 }
    });
    const snapshot = structuredClone(initial);
    const result = resolve(initial, 'farming', 'farming', 'farming', 'farming', 'farming', 'farming');

    expect(result).toMatchObject({
      ok: false,
      state: snapshot,
      slots: [],
      error: { code: 'insufficient-lifespan', slotIndex: 5, activity: 'farming' }
    });
    expect(initial).toEqual(snapshot);
  });
});
