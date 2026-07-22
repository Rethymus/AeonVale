/**
 * D27-b 修仙日程纯 sim 性质测试。
 *
 * 生成器只产生 cultivationRunStateError 可接受、且足以支付任意六格日程的状态：
 * 最坏时间 6 * 14 = 84 日，资源最坏需求为食物 6、灵草 12、灵石 6。
 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  CULTIVATION_ACTIVITY_IDS,
  CULTIVATION_RUN_MAX_STAGE,
  agendaTimeCostDays,
  createCultivationRunState,
  cultivationRunStateError,
  resolveCultivationAgenda,
  type CultivationAgenda,
  type CultivationRunState
} from '@sim/cultivation-run';

const P = DEFAULT_BALANCE;
const POISON_CAP = P.pillPoison.cap * 1000;
const MAX_AGENDA_TIME_COST = P.cultivationRun.slotsPerAgenda
  * Math.max(...CULTIVATION_ACTIVITY_IDS.map(activity => P.cultivationRun.activities[activity].timeCostDays));

const activityArb = fc.constantFrom(...CULTIVATION_ACTIVITY_IDS);

const agendaArb: fc.Arbitrary<CultivationAgenda> = fc
  .array(activityArb, {
    minLength: P.cultivationRun.slotsPerAgenda,
    maxLength: P.cultivationRun.slotsPerAgenda
  })
  .map(slots => ({ slots }));

const fundedStateArb: fc.Arbitrary<CultivationRunState> = fc
  .record({
    seed: fc.integer({ min: 1, max: 999_999 }),
    stage: fc.integer({ min: 0, max: CULTIVATION_RUN_MAX_STAGE }),
    agendaIndex: fc.integer({ min: 0, max: 10_000 }),
    lifespanRemainingDays: fc.integer({ min: MAX_AGENDA_TIME_COST, max: 840 }),
    bodyFoundation: fc.integer({ min: 0, max: 1_000_000 }),
    endurance: fc.integer({ min: 0, max: 1_000_000 }),
    willpower: fc.integer({ min: 0, max: 1_000_000 }),
    pillPoison: fc.integer({ min: 0, max: POISON_CAP }),
    heavenDebt: fc.integer({ min: 0, max: 1_000_000 }),
    daoAttention: fc.integer({ min: 0, max: 1_000_000 }),
    pressure: fc.integer({ min: 0, max: P.cultivationRun.pressureCap }),
    mortalHeart: fc.integer({ min: 0, max: P.cultivationRun.mortalHeartCap }),
    insight: fc.integer({ min: 0, max: 10_000 }),
    injury: fc.integer({ min: 0, max: P.cultivationRun.injuryCap }),
    herbs: fc.integer({ min: 12, max: 1_000 }),
    food: fc.integer({ min: 6, max: 1_000 }),
    spiritStones: fc.integer({ min: 6, max: 1_000 }),
    pills: fc.integer({ min: 0, max: 1_000 })
  })
  .map(({ seed, ...overrides }) => createCultivationRunState({ seed, params: P, overrides }));

function resolveFundedAgenda(state: CultivationRunState, agenda: CultivationAgenda) {
  expect(cultivationRunStateError(state, P)).toBeNull();
  const result = resolveCultivationAgenda(state, agenda, P);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`合法且资源充足的日程结算失败：${result.error.code}`);
  return result;
}

describe('D27-b · 修仙日程性质', () => {
  test('PBT-D27-01 确定性：同状态 + 同日程得到完全相同结果', () => {
    fc.assert(
      fc.property(fundedStateArb, agendaArb, (state, agenda) => {
        const a = resolveCultivationAgenda(structuredClone(state), structuredClone(agenda), P);
        const b = resolveCultivationAgenda(structuredClone(state), structuredClone(agenda), P);
        expect(a).toEqual(b);
      })
    );
  });

  test('PBT-D27-02 纯度：结算不修改输入状态或日程', () => {
    fc.assert(
      fc.property(fundedStateArb, agendaArb, (state, agenda) => {
        const stateBefore = structuredClone(state);
        const agendaBefore = structuredClone(agenda);
        resolveFundedAgenda(state, agenda);
        expect(state).toEqual(stateBefore);
        expect(agenda).toEqual(agendaBefore);
      })
    );
  });

  test('PBT-D27-03 时间守恒：成功结算消耗恰好等于六格活动时间之和', () => {
    fc.assert(
      fc.property(fundedStateArb, agendaArb, (state, agenda) => {
        const result = resolveFundedAgenda(state, agenda);
        const expectedCost = agendaTimeCostDays(agenda, P);
        const elapsed = state.lifespanRemainingDays - result.state.lifespanRemainingDays;
        const deltaElapsed = -result.slots.reduce((sum, slot) => sum + slot.delta.lifespanRemainingDays, 0);

        expect(elapsed).toBe(expectedCost);
        expect(deltaElapsed).toBe(expectedCost);
        expect(result.state.agendaIndex).toBe(state.agendaIndex + 1);
      })
    );
  });

  test('PBT-D27-04 有界与非负：压力轴、丹毒、伤势和资源始终留在合法区间', () => {
    fc.assert(
      fc.property(fundedStateArb, agendaArb, (state, agenda) => {
        const { state: next } = resolveFundedAgenda(state, agenda);

        expect(next.pressure).toBeGreaterThanOrEqual(0);
        expect(next.pressure).toBeLessThanOrEqual(P.cultivationRun.pressureCap);
        expect(next.mortalHeart).toBeGreaterThanOrEqual(0);
        expect(next.mortalHeart).toBeLessThanOrEqual(P.cultivationRun.mortalHeartCap);
        expect(next.pillPoison).toBeGreaterThanOrEqual(0);
        expect(next.pillPoison).toBeLessThanOrEqual(POISON_CAP);
        expect(next.injury).toBeGreaterThanOrEqual(0);
        expect(next.injury).toBeLessThanOrEqual(P.cultivationRun.injuryCap);

        for (const resource of [
          next.lifespanRemainingDays,
          next.insight,
          next.herbs,
          next.food,
          next.spiritStones,
          next.pills
        ]) {
          expect(resource).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(resource)).toBe(true);
        }
      })
    );
  });

  test('PBT-D27-05 单调递减：连续苦练的效率与正向收益均不回升', () => {
    const trainingAgenda: CultivationAgenda = {
      slots: Array.from({ length: P.cultivationRun.slotsPerAgenda }, () => 'training' as const)
    };

    fc.assert(
      fc.property(fundedStateArb, state => {
        const result = resolveFundedAgenda(state, trainingAgenda);

        for (let index = 1; index < result.slots.length; index++) {
          const previous = result.slots[index - 1]!;
          const current = result.slots[index]!;
          expect(current.efficiencyMilli).toBeLessThanOrEqual(previous.efficiencyMilli);
          expect(current.delta.bodyFoundation).toBeLessThanOrEqual(previous.delta.bodyFoundation);
          expect(current.delta.endurance).toBeLessThanOrEqual(previous.delta.endurance);
          expect(current.delta.willpower).toBeLessThanOrEqual(previous.delta.willpower);
        }
      })
    );
  });
});
