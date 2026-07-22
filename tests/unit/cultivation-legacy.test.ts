import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  createCultivationAshEpitaph,
  createCultivationRunState,
  deriveCultivationLegacyCandidates,
  transitionToHeir,
  validateCultivationLegacySelection,
  type CultivationAshEpitaph
} from '@sim/cultivation-run';

function epitaph(): CultivationAshEpitaph {
  return createCultivationAshEpitaph({
    identity: { name: '沈砚', portraitId: 'portrait.cultivator.01' },
    highestStage: 3,
    conclusion: { kind: 'death', cause: 'tribulation-overload' },
    activityCounts: { training: 4, farming: 6, alchemy: 2, livelihood: 1, insight: 3, rest: 2 },
    eventHistoryTags: ['kept-mother-seeds', 'patched-furnace-by-hand'],
    unlockedKnowledgeNodeIds: ['foundation-rhythm', 'field-breathing'],
    herbsScorched: 2,
    herbsPreserved: 3,
    representativeHerb: '引雷草'
  });
}

describe('D27-e · 劫灰传承核心', () => {
  test('碑记收束身份、凡业倾向、事件遗书与灵草损失', () => {
    const record = epitaph();

    expect(record.identity).toEqual({ name: '沈砚', portraitId: 'portrait.cultivator.01' });
    expect(record.highestStage).toBe(3);
    expect(record.conclusion).toEqual({ kind: 'death', cause: 'tribulation-overload' });
    expect(record.vocation.primaryActivity).toBe('farming');
    expect(record.vocation.activityCounts.farming).toBe(6);
    expect(record.eventHistoryTags).toEqual(['kept-mother-seeds', 'patched-furnace-by-hand']);
    expect(record.testament).toContain('炉缝');
    expect(record.herbLegacy).toEqual({
      scorchedCount: 2,
      preservedCount: 3,
      representativeHerb: '引雷草'
    });
  });

  test('候选只来自固定知识目录与实际经历，并保持有限且唯一', () => {
    const candidates = deriveCultivationLegacyCandidates(epitaph());

    expect(candidates.knowledge.map(candidate => candidate.id)).toEqual([
      'knowledge:field-notes',
      'knowledge:foundation-rhythm',
      'knowledge:field-breathing'
    ]);
    expect(candidates.relics.map(candidate => candidate.id)).toEqual([
      'relic:old-hoe',
      'relic:cracked-furnace',
      'relic:annotated-notebook',
      'relic:field-jade'
    ]);
    expect(new Set(candidates.knowledge.map(candidate => candidate.id)).size).toBe(candidates.knowledge.length);
    expect(new Set(candidates.relics.map(candidate => candidate.id)).size).toBe(candidates.relics.length);
  });

  test('合法选择恰好应用一项知识和一件遗物，不复制前世身体与消耗品', () => {
    const previousState = createCultivationRunState({
      seed: 71,
      overrides: {
        stage: 3,
        agendaIndex: 9,
        lifespanRemainingDays: 17,
        bodyFoundation: 98_000,
        endurance: 76_000,
        willpower: 54_000,
        injury: 88,
        pillPoison: 44_000,
        heavenDebt: 12_000,
        daoAttention: 9_000,
        pressure: 96,
        mortalHeart: 7,
        insight: 80,
        herbs: 19,
        food: 14,
        spiritStones: 31,
        pills: 8
      }
    });
    const result = transitionToHeir({
      previousState,
      epitaph: epitaph(),
      selection: {
        knowledgeId: 'knowledge:foundation-rhythm',
        relicId: 'relic:cracked-furnace'
      },
      heirIdentity: { name: '陆禾', portraitId: 'portrait.cultivator.02' },
      heirSeed: 72
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const baseline = createCultivationRunState({ seed: 72 });
    expect(result.state).toEqual({ ...baseline, insight: baseline.insight + 2, pills: baseline.pills + 1 });
    expect(result.state.bodyFoundation).toBe(0);
    expect(result.state.endurance).toBe(0);
    expect(result.state.willpower).toBe(0);
    expect(result.state.injury).toBe(0);
    expect(result.state.pillPoison).toBe(0);
    expect(result.state.herbs).toBe(0);
    expect(result.state.food).toBe(DEFAULT_BALANCE.cultivationRun.startFood);
    expect(result.state.spiritStones).toBe(0);
    expect(result.state.pills).toBe(1);
    expect(result.legacy.selectedKnowledge.id).toBe('knowledge:foundation-rhythm');
    expect(result.legacy.selectedRelic.id).toBe('relic:cracked-furnace');
    expect(result.legacy.inheritedKnowledgeNodeIds).toEqual(['foundation-rhythm']);
  });

  test('非法知识或遗物选择被明确拒绝，且原子保留前世状态引用', () => {
    const record = epitaph();
    const candidates = deriveCultivationLegacyCandidates(record);
    expect(validateCultivationLegacySelection(candidates, {
      knowledgeId: 'knowledge:missing',
      relicId: 'relic:old-hoe'
    })).toMatchObject({ ok: false, error: { code: 'knowledge-not-offered' } });
    expect(validateCultivationLegacySelection(candidates, {
      knowledgeId: 'knowledge:field-notes',
      relicId: 'relic:missing'
    })).toMatchObject({ ok: false, error: { code: 'relic-not-offered' } });

    const previousState = createCultivationRunState({ seed: 91, overrides: { herbs: 9, pills: 4 } });
    const before = structuredClone(previousState);
    const result = transitionToHeir({
      previousState,
      epitaph: record,
      selection: { knowledgeId: 'knowledge:missing', relicId: 'relic:old-hoe' },
      heirIdentity: { name: '无名', portraitId: 'portrait.cultivator.03' },
      heirSeed: 92
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'knowledge-not-offered' } });
    expect(result.state).toBe(previousState);
    expect(previousState).toEqual(before);
  });

  test('无事件痕迹时遗书由真实结局生成，凡业并列按固定活动顺序裁定', () => {
    const record = createCultivationAshEpitaph({
      identity: { name: '顾迟', portraitId: 'portrait.cultivator.04' },
      highestStage: 1,
      conclusion: { kind: 'death', cause: 'tribulation-timeout' },
      activityCounts: { training: 3, farming: 3 },
      eventHistoryTags: [],
      unlockedKnowledgeNodeIds: [],
      herbsScorched: 0,
      herbsPreserved: 0
    });

    expect(record.vocation.primaryActivity).toBe('training');
    expect(record.testament).toContain('步数耗尽');
    expect(record.herbLegacy.representativeHerb).toBeNull();
  });
});
