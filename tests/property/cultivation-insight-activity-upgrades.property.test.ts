/** D27-c 活动参悟强化：确定性、纯度、单向收益与非叠加性质。 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  createCultivationRunState,
  resolveCultivationActivity,
  type CultivationActivityId,
  type CultivationInsightEffectTag
} from '@sim/cultivation-run';

type UpgradedActivity = Extract<CultivationActivityId, 'training' | 'farming' | 'alchemy'>;

interface UpgradeCase {
  readonly activity: UpgradedActivity;
  readonly consecutiveCount: number;
  readonly state: ReturnType<typeof createCultivationRunState>;
}

const TAG_BY_ACTIVITY: Readonly<Record<UpgradedActivity, CultivationInsightEffectTag>> = {
  training: 'activity:training:foundation-rhythm',
  farming: 'activity:farming:field-breathing',
  alchemy: 'activity:alchemy:clear-furnace'
};

const caseArb: fc.Arbitrary<UpgradeCase> = fc.record({
  seed: fc.integer({ min: 1, max: 999_999 }),
  activity: fc.constantFrom<UpgradedActivity>('training', 'farming', 'alchemy'),
  consecutiveCount: fc.integer({ min: 1, max: 8 }),
  pressure: fc.integer({ min: 0, max: DEFAULT_BALANCE.cultivationRun.pressureCap }),
  mortalHeart: fc.integer({ min: 0, max: DEFAULT_BALANCE.cultivationRun.mortalHeartCap }),
  injury: fc.integer({ min: 0, max: DEFAULT_BALANCE.cultivationRun.injuryCap }),
  pillPoison: fc.integer({ min: 0, max: DEFAULT_BALANCE.pillPoison.cap * 1000 })
}).map(input => ({
  activity: input.activity,
  consecutiveCount: input.consecutiveCount,
  state: createCultivationRunState({
    seed: input.seed,
    overrides: {
      stage: 6,
      lifespanRemainingDays: 840,
      food: 100,
      herbs: 100,
      spiritStones: 100,
      pressure: input.pressure,
      mortalHeart: input.mortalHeart,
      injury: input.injury,
      pillPoison: input.pillPoison
    }
  })
}));

function resolveCase(
  input: UpgradeCase,
  tags: readonly CultivationInsightEffectTag[]
) {
  const result = resolveCultivationActivity(
    input.state,
    input.activity,
    input.consecutiveCount,
    0,
    DEFAULT_BALANCE,
    tags
  );
  expect(result.ok).toBe(true);
  if (!result.ok || !result.resolution) throw new Error(result.error ?? 'missing-resolution');
  return result;
}

describe('D27-c · 活动参悟强化性质', () => {
  test('PBT-D27-16 确定性与纯度：同状态和 tags 得到同结果且不修改输入', () => {
    fc.assert(
      fc.property(caseArb, input => {
        const tags = [TAG_BY_ACTIVITY[input.activity]];
        const before = structuredClone(input);
        const a = resolveCase(input, tags);
        const b = resolveCase(input, tags);
        expect(a).toEqual(b);
        expect(input).toEqual(before);
      })
    );
  });

  test('PBT-D27-17 单向强化：正向收益不降低，苦练/炼丹风险不升高', () => {
    fc.assert(
      fc.property(caseArb, input => {
        const baseline = resolveCase(input, []).resolution!;
        const upgraded = resolveCase(input, [TAG_BY_ACTIVITY[input.activity]]).resolution!;

        if (input.activity === 'training') {
          expect(upgraded.delta.bodyFoundation).toBeGreaterThanOrEqual(baseline.delta.bodyFoundation);
          expect(upgraded.delta.endurance).toBeGreaterThanOrEqual(baseline.delta.endurance);
          expect(upgraded.delta.willpower).toBeGreaterThanOrEqual(baseline.delta.willpower);
          expect(upgraded.delta.injury).toBeLessThanOrEqual(baseline.delta.injury);
          expect(upgraded.delta.pressure).toBeLessThanOrEqual(baseline.delta.pressure);
        } else if (input.activity === 'farming') {
          expect(upgraded.delta.herbs).toBeGreaterThanOrEqual(baseline.delta.herbs);
          expect(upgraded.delta.food).toBeGreaterThanOrEqual(baseline.delta.food);
          expect(upgraded.delta.mortalHeart).toBeGreaterThanOrEqual(baseline.delta.mortalHeart);
          expect(upgraded.delta.pressure).toBeLessThanOrEqual(baseline.delta.pressure);
        } else {
          expect(upgraded.delta.pills).toBeGreaterThanOrEqual(baseline.delta.pills);
          expect(upgraded.delta.insight).toBeGreaterThanOrEqual(baseline.delta.insight);
          expect(upgraded.delta.pillPoison).toBeLessThanOrEqual(baseline.delta.pillPoison);
          expect(upgraded.delta.pressure).toBeLessThanOrEqual(baseline.delta.pressure);
        }
      })
    );
  });

  test('PBT-D27-18 幂等：重复传入同一已悟标签不会重复叠加', () => {
    fc.assert(
      fc.property(caseArb, input => {
        const tag = TAG_BY_ACTIVITY[input.activity];
        expect(resolveCase(input, [tag, tag, tag])).toEqual(resolveCase(input, [tag]));
      })
    );
  });
});
