import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  CULTIVATION_INSIGHT_ACTIVITY_UPGRADE_RULES,
  createCultivationRunState,
  cultivationActivityUpgradeModifiers,
  resolveCultivationAgenda,
  type CultivationAgenda,
  type CultivationInsightEffectTag
} from '@sim/cultivation-run';

const AGENDA: CultivationAgenda = {
  slots: ['training', 'farming', 'alchemy', 'livelihood', 'rest', 'farming']
};

function resolveWith(tags: readonly CultivationInsightEffectTag[]) {
  const state = createCultivationRunState({
    overrides: { food: 8, herbs: 8, spiritStones: 2, pressure: 20, mortalHeart: 50 }
  });
  const result = resolveCultivationAgenda(state, AGENDA, DEFAULT_BALANCE, { insightEffectTags: tags });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.code);
  return result;
}

describe('D27-c · 参悟节点强化后续日课', () => {
  test('固定规则一一对应苦练、灵田、炼丹，且中性契约不改变旧行为', () => {
    expect(CULTIVATION_INSIGHT_ACTIVITY_UPGRADE_RULES.map(rule => [rule.tag, rule.activity])).toEqual([
      ['activity:training:foundation-rhythm', 'training'],
      ['activity:farming:field-breathing', 'farming'],
      ['activity:alchemy:clear-furnace', 'alchemy']
    ]);
    expect(cultivationActivityUpgradeModifiers('rest', [
      'activity:training:foundation-rhythm'
    ])).toEqual({ benefitMultiplierMilli: 1000, riskMultiplierMilli: 1000 });
  });

  test('吐纳记骨提高苦练三项正收益并降低伤势与心压', () => {
    const baseline = resolveWith([]).slots[0]!;
    const upgraded = resolveWith(['activity:training:foundation-rhythm']).slots[0]!;

    expect(upgraded.delta.bodyFoundation).toBeGreaterThan(baseline.delta.bodyFoundation);
    expect(upgraded.delta.endurance).toBeGreaterThan(baseline.delta.endurance);
    expect(upgraded.delta.willpower).toBeGreaterThan(baseline.delta.willpower);
    expect(upgraded.delta.injury).toBeLessThan(baseline.delta.injury);
    expect(upgraded.delta.pressure).toBeLessThan(baseline.delta.pressure);
  });

  test('田息同调提高灵田的灵草、食物、凡心与减压收益', () => {
    const baseline = resolveWith([]).slots[1]!;
    const upgraded = resolveWith(['activity:farming:field-breathing']).slots[1]!;

    expect(upgraded.delta.herbs).toBeGreaterThan(baseline.delta.herbs);
    expect(upgraded.delta.food).toBeGreaterThan(baseline.delta.food);
    expect(upgraded.delta.mortalHeart).toBeGreaterThan(baseline.delta.mortalHeart);
    expect(upgraded.delta.pressure).toBeLessThanOrEqual(baseline.delta.pressure);
  });

  test('澄炉次第不增加资源成本，并降低炼丹丹毒与心压', () => {
    const baseline = resolveWith([]).slots[2]!;
    const upgraded = resolveWith(['activity:alchemy:clear-furnace']).slots[2]!;

    expect(upgraded.delta.herbs).toBe(baseline.delta.herbs);
    expect(upgraded.delta.pills).toBeGreaterThanOrEqual(baseline.delta.pills);
    expect(upgraded.delta.insight).toBeGreaterThanOrEqual(baseline.delta.insight);
    expect(upgraded.delta.pillPoison).toBeLessThan(baseline.delta.pillPoison);
    expect(upgraded.delta.pressure).toBeLessThan(baseline.delta.pressure);
  });

  test('标签只影响对应活动，重复传入同一标签不会叠加', () => {
    const baseline = resolveWith([]);
    const single = resolveWith(['activity:farming:field-breathing']);
    const duplicate = resolveWith([
      'activity:farming:field-breathing',
      'activity:farming:field-breathing'
    ]);

    expect(single).toEqual(duplicate);
    expect(single.slots[0]).toEqual(baseline.slots[0]);
    expect(single.slots[2]).toEqual(baseline.slots[2]);
  });
});
