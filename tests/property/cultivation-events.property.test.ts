/** D27-c 事件层：确定性、纯度、有界与失败原子性。 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import { createCultivationRunState, cultivationRunStateError } from '@sim/cultivation-run/agenda';
import {
  CULTIVATION_EVENTS,
  cultivationEventCandidates,
  resolveCultivationEventChoice,
  sampleCultivationEvent,
  type CultivationEventId,
  type CultivationEventResource
} from '@sim/cultivation-run/events';
import { CULTIVATION_RUN_MAX_STAGE, type CultivationRunState } from '@sim/cultivation-run/types';

const P = DEFAULT_BALANCE;
const POISON_CAP = P.pillPoison.cap * 1000;

const fundedStateArb: fc.Arbitrary<CultivationRunState> = fc
  .record({
    seed: fc.integer({ min: 1, max: 999_999 }),
    stage: fc.integer({ min: 0, max: CULTIVATION_RUN_MAX_STAGE }),
    agendaIndex: fc.integer({ min: 0, max: 10_000 }),
    lifespanRemainingDays: fc.integer({ min: 10, max: 840 }),
    bodyFoundation: fc.integer({ min: 0, max: 1_000_000 }),
    endurance: fc.integer({ min: 0, max: 1_000_000 }),
    willpower: fc.integer({ min: 0, max: 1_000_000 }),
    pillPoison: fc.integer({ min: 0, max: POISON_CAP }),
    heavenDebt: fc.integer({ min: 0, max: 1_000_000 }),
    daoAttention: fc.integer({ min: 0, max: 1_000_000 }),
    pressure: fc.integer({ min: 0, max: P.cultivationRun.pressureCap }),
    mortalHeart: fc.integer({ min: 0, max: P.cultivationRun.mortalHeartCap }),
    insight: fc.integer({ min: 10, max: 10_000 }),
    injury: fc.integer({ min: 0, max: P.cultivationRun.injuryCap }),
    herbs: fc.integer({ min: 10, max: 1_000 }),
    food: fc.integer({ min: 10, max: 1_000 }),
    spiritStones: fc.integer({ min: 10, max: 1_000 }),
    pills: fc.integer({ min: 10, max: 1_000 })
  })
  .map(({ seed, ...overrides }) => createCultivationRunState({ seed, params: P, overrides }));

interface ResourceFailureCase {
  readonly eventId: CultivationEventId;
  readonly choiceId: string;
  readonly resource: CultivationEventResource;
  readonly amount: number;
  readonly minStage: number;
}

const RESOURCE_FAILURE_CASES: readonly ResourceFailureCase[] = CULTIVATION_EVENTS.flatMap(event =>
  event.choices.flatMap(choice =>
    choice.costs
      .filter(cost => cost.resource !== 'lifespanRemainingDays' || cost.amount > 1)
      .map(cost => ({
        eventId: event.id,
        choiceId: choice.id,
        resource: cost.resource,
        amount: cost.amount,
        minStage: event.minStage
      }))
  )
);

const failureCaseArb = fc.constantFrom(...RESOURCE_FAILURE_CASES);

function expectSuccessfulResolution(state: CultivationRunState, ordinal: number) {
  const event = sampleCultivationEvent(state, ordinal, P);
  expect(event).not.toBeNull();
  if (!event) throw new Error('合法 active 状态必须拥有事件候选');
  const choice = event.choices[ordinal % event.choices.length]!;
  const result = resolveCultivationEventChoice(state, event.id, choice.id, P);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`资源充足的事件选择失败：${result.error.code}`);
  return result;
}

describe('D27-c · 修仙事件性质', () => {
  test('PBT-D27-06 候选抽样确定性：同 seed、阶段、agendaIndex、ordinal 得到同一事件', () => {
    fc.assert(
      fc.property(fundedStateArb, fc.integer({ min: 0, max: 100_000 }), (state, ordinal) => {
        const before = structuredClone(state);
        const a = sampleCultivationEvent(state, ordinal, P);
        const b = sampleCultivationEvent(structuredClone(state), ordinal, P);
        expect(a?.id).toBe(b?.id);
        expect(cultivationEventCandidates(state, P).map(event => event.id)).toContain(a?.id);
        expect(state).toEqual(before);
      })
    );
  });

  test('PBT-D27-07 选择确定性与纯度：同状态和选择得到相同结果且不修改输入', () => {
    fc.assert(
      fc.property(fundedStateArb, fc.integer({ min: 0, max: 100_000 }), (state, ordinal) => {
        const event = sampleCultivationEvent(state, ordinal, P)!;
        const choice = event.choices[ordinal % event.choices.length]!;
        const before = structuredClone(state);
        const a = resolveCultivationEventChoice(state, event.id, choice.id, P);
        const b = resolveCultivationEventChoice(structuredClone(state), event.id, choice.id, P);
        expect(a).toEqual(b);
        expect(state).toEqual(before);
      })
    );
  });

  test('PBT-D27-08 成功结算后压力轴、丹毒、伤势有界且所有资源非负', () => {
    fc.assert(
      fc.property(fundedStateArb, fc.integer({ min: 0, max: 100_000 }), (state, ordinal) => {
        const { state: next } = expectSuccessfulResolution(state, ordinal);

        expect(next.pressure).toBeGreaterThanOrEqual(0);
        expect(next.pressure).toBeLessThanOrEqual(P.cultivationRun.pressureCap);
        expect(next.mortalHeart).toBeGreaterThanOrEqual(0);
        expect(next.mortalHeart).toBeLessThanOrEqual(P.cultivationRun.mortalHeartCap);
        expect(next.pillPoison).toBeGreaterThanOrEqual(0);
        expect(next.pillPoison).toBeLessThanOrEqual(POISON_CAP);
        expect(next.injury).toBeGreaterThanOrEqual(0);
        expect(next.injury).toBeLessThanOrEqual(P.cultivationRun.injuryCap);
        for (const value of [
          next.lifespanRemainingDays,
          next.bodyFoundation,
          next.endurance,
          next.willpower,
          next.heavenDebt,
          next.daoAttention,
          next.insight,
          next.herbs,
          next.food,
          next.spiritStones,
          next.pills
        ]) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(value)).toBe(true);
        }
        expect(cultivationRunStateError(next, P)).toBeNull();
      })
    );
  });

  test('PBT-D27-09 任一资源前置不足都失败，且不会扣除其他已满足成本', () => {
    fc.assert(
      fc.property(failureCaseArb, fc.integer({ min: 1, max: 999_999 }), (failureCase, seed) => {
        const state = createCultivationRunState({
          seed,
          params: P,
          overrides: {
            stage: failureCase.minStage,
            lifespanRemainingDays: 20,
            herbs: 20,
            food: 20,
            spiritStones: 20,
            insight: 20,
            pills: 20
          }
        });
        state[failureCase.resource] = failureCase.amount - 1;
        expect(cultivationRunStateError(state, P)).toBeNull();
        const before = structuredClone(state);

        const result = resolveCultivationEventChoice(state, failureCase.eventId, failureCase.choiceId, P);
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.code).toBe('insufficient-resource');
          expect(result.error.resource).toBe(failureCase.resource);
          expect(result.state).toEqual(before);
        }
        expect(state).toEqual(before);
      })
    );
  });
});
