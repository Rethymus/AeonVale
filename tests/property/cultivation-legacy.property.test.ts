/** D27-e 劫灰传承：确定性、纯度、有限继承与失败原子性。 */
import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  CULTIVATION_ACTIVITY_IDS,
  CULTIVATION_INSIGHT_NODE_IDS,
  createCultivationAshEpitaph,
  createCultivationRunState,
  deriveCultivationLegacyCandidates,
  transitionToHeir,
  type CultivationActivityId,
  type CultivationEventHistoryTag,
  type TransitionToHeirRequest
} from '@sim/cultivation-run';

const EVENT_TRACES = [
  'returned-porridge-bowl',
  'patched-furnace-by-hand',
  'kept-mother-seeds',
  'rehafted-old-hoe',
  'kept-thunder-plot',
  'copied-breakthrough-sky-pattern',
  'protected-herb-basket',
  'copied-xiao-wuji-sword-scar'
] as const satisfies readonly CultivationEventHistoryTag[];

const activityCountsArb = fc.tuple(
  ...CULTIVATION_ACTIVITY_IDS.map(() => fc.integer({ min: 0, max: 30 }))
).map(values => Object.fromEntries(
  CULTIVATION_ACTIVITY_IDS.map((activity, index) => [activity, values[index] ?? 0])
) as Record<CultivationActivityId, number>);

const previousStateArb = fc.record({
  seed: fc.integer({ min: 1, max: 999_999 }),
  stage: fc.integer({ min: 1, max: 7 }),
  agendaIndex: fc.integer({ min: 1, max: 100 }),
  lifespanRemainingDays: fc.integer({ min: 1, max: 839 }),
  bodyFoundation: fc.integer({ min: 1, max: 1_000_000 }),
  endurance: fc.integer({ min: 1, max: 1_000_000 }),
  willpower: fc.integer({ min: 1, max: 1_000_000 }),
  pillPoison: fc.integer({ min: 1, max: DEFAULT_BALANCE.pillPoison.cap * 1000 }),
  heavenDebt: fc.integer({ min: 1, max: 1_000_000 }),
  daoAttention: fc.integer({ min: 1, max: 1_000_000 }),
  pressure: fc.integer({ min: 0, max: DEFAULT_BALANCE.cultivationRun.pressureCap }),
  mortalHeart: fc.integer({ min: 0, max: DEFAULT_BALANCE.cultivationRun.mortalHeartCap }),
  insight: fc.integer({ min: 1, max: 10_000 }),
  injury: fc.integer({ min: 1, max: DEFAULT_BALANCE.cultivationRun.injuryCap }),
  herbs: fc.integer({ min: 1, max: 1_000 }),
  food: fc.integer({ min: 1, max: 1_000 }),
  spiritStones: fc.integer({ min: 1, max: 1_000 }),
  pills: fc.integer({ min: 1, max: 1_000 })
}).map(({ seed, ...overrides }) => createCultivationRunState({ seed, overrides }));

const epitaphInputArb = fc.record({
  highestStage: fc.integer({ min: 0, max: 7 }),
  activityCounts: activityCountsArb,
  eventHistoryTags: fc.uniqueArray(fc.constantFrom(...EVENT_TRACES), { maxLength: EVENT_TRACES.length }),
  unlockedKnowledgeNodeIds: fc.uniqueArray(fc.constantFrom(...CULTIVATION_INSIGHT_NODE_IDS), {
    maxLength: CULTIVATION_INSIGHT_NODE_IDS.length
  }),
  herbsScorched: fc.integer({ min: 0, max: 100 }),
  herbsPreserved: fc.integer({ min: 0, max: 100 })
});

const legalTransitionArb: fc.Arbitrary<TransitionToHeirRequest> = fc.record({
  previousState: previousStateArb,
  epitaphInput: epitaphInputArb,
  heirSeed: fc.integer({ min: 1, max: 999_999 }),
  knowledgeIndex: fc.nat(),
  relicIndex: fc.nat()
}).map(({ previousState, epitaphInput, heirSeed, knowledgeIndex, relicIndex }) => {
  const epitaph = createCultivationAshEpitaph({
    identity: { name: '前人', portraitId: 'portrait.predecessor' },
    conclusion: { kind: 'death', cause: 'tribulation-overload' },
    representativeHerb: '引雷草',
    ...epitaphInput
  });
  const candidates = deriveCultivationLegacyCandidates(epitaph);
  const knowledge = candidates.knowledge[knowledgeIndex % candidates.knowledge.length]!;
  const relic = candidates.relics[relicIndex % candidates.relics.length]!;
  return {
    previousState,
    epitaph,
    selection: { knowledgeId: knowledge.id, relicId: relic.id },
    heirIdentity: { name: '后来人', portraitId: 'portrait.heir' },
    heirSeed
  };
});

describe('D27-e · 劫灰传承性质', () => {
  test('PBT-D27-12 确定性与纯度：相同前世、碑记和选择得到相同后继且不修改输入', () => {
    fc.assert(
      fc.property(legalTransitionArb, request => {
        const before = structuredClone(request);
        const a = transitionToHeir(request);
        const b = transitionToHeir(structuredClone(request));
        expect(a).toEqual(b);
        expect(request).toEqual(before);
      })
    );
  });

  test('PBT-D27-13 跨世隔离：身体、伤势、丹毒与当世库存归零，只叠加所选固定效果', () => {
    fc.assert(
      fc.property(legalTransitionArb, request => {
        const result = transitionToHeir(request);
        expect(result.ok).toBe(true);
        if (!result.ok) return;

        const baseline = createCultivationRunState({ seed: request.heirSeed });
        const knowledgeEffect = result.legacy.selectedKnowledge.startingEffect;
        const relicEffect = result.legacy.selectedRelic.startingEffect;
        expect(result.state.bodyFoundation).toBe(baseline.bodyFoundation);
        expect(result.state.endurance).toBe(baseline.endurance);
        expect(result.state.willpower).toBe(baseline.willpower);
        expect(result.state.injury).toBe(baseline.injury);
        expect(result.state.pillPoison).toBe(baseline.pillPoison);
        expect(result.state.heavenDebt).toBe(baseline.heavenDebt);
        expect(result.state.daoAttention).toBe(baseline.daoAttention);
        expect(result.state.herbs).toBe(baseline.herbs + knowledgeEffect.herbs + relicEffect.herbs);
        expect(result.state.food).toBe(baseline.food + knowledgeEffect.food + relicEffect.food);
        expect(result.state.spiritStones).toBe(
          baseline.spiritStones + knowledgeEffect.spiritStones + relicEffect.spiritStones
        );
        expect(result.state.pills).toBe(baseline.pills + knowledgeEffect.pills + relicEffect.pills);
        expect(result.state.insight).toBe(baseline.insight + knowledgeEffect.insight + relicEffect.insight);
        expect(result.state.stage).toBe(0);
        expect(result.state.agendaIndex).toBe(0);
      })
    );
  });

  test('PBT-D27-14 候选有界且唯一：任意合法碑记最多给八项知识和四件遗物', () => {
    fc.assert(
      fc.property(epitaphInputArb, input => {
        const epitaph = createCultivationAshEpitaph({
          identity: { name: '前人', portraitId: 'portrait.predecessor' },
          conclusion: { kind: 'death', cause: 'other' },
          representativeHerb: null,
          ...input
        });
        const candidates = deriveCultivationLegacyCandidates(epitaph);
        const knowledgeIds = candidates.knowledge.map(candidate => candidate.id);
        const relicIds = candidates.relics.map(candidate => candidate.id);

        expect(knowledgeIds.length).toBeGreaterThanOrEqual(1);
        expect(knowledgeIds.length).toBeLessThanOrEqual(8);
        expect(relicIds.length).toBeGreaterThanOrEqual(1);
        expect(relicIds.length).toBeLessThanOrEqual(4);
        expect(new Set(knowledgeIds).size).toBe(knowledgeIds.length);
        expect(new Set(relicIds).size).toBe(relicIds.length);
      })
    );
  });

  test('PBT-D27-15 非法选择原子失败：不生成后继、不修改前世且返回原状态引用', () => {
    fc.assert(
      fc.property(legalTransitionArb, fc.boolean(), (legalRequest, invalidKnowledge) => {
        const request: TransitionToHeirRequest = {
          ...legalRequest,
          selection: invalidKnowledge
            ? { ...legalRequest.selection, knowledgeId: 'knowledge:not-offered' }
            : { ...legalRequest.selection, relicId: 'relic:not-offered' }
        };
        const before = structuredClone(request);
        const result = transitionToHeir(request);

        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.error.code).toBe(invalidKnowledge ? 'knowledge-not-offered' : 'relic-not-offered');
        expect(result.state).toBe(request.previousState);
        expect(request).toEqual(before);
      })
    );
  });
});
