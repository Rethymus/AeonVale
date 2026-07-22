import { describe, expect, it } from 'vitest';
import { createCultivationRunState } from '@sim/cultivation-run';
import {
  CULTIVATION_INSIGHT_EFFECT_TAGS,
  CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA,
  CULTIVATION_INSIGHT_NODES,
  unlockCultivationInsightNode,
  type CultivationInsightAgendaBudget,
  type CultivationInsightNodeCategory,
  type CultivationInsightNodeId
} from '@sim/cultivation-run/insight';

function budget(agendaIndex: number, unlockedThisAgenda = 0): CultivationInsightAgendaBudget {
  return {
    agendaIndex,
    unlockedThisAgenda,
    maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
  };
}

describe('D27-c 残卷参悟 · 固定图契约', () => {
  it('固定为七节点 DAG，并覆盖五类首切片节点', () => {
    const categories = new Set<CultivationInsightNodeCategory>(CULTIVATION_INSIGHT_NODES.map(node => node.category));
    const known = new Set(CULTIVATION_INSIGHT_NODES.map(node => node.id));

    expect(CULTIVATION_INSIGHT_NODES).toHaveLength(7);
    expect(categories).toEqual(
      new Set(['activity-upgrade', 'array-stone', 'pill-recipe', 'tribulation-intel', 'narrative-annotation'])
    );
    for (const node of CULTIVATION_INSIGHT_NODES) {
      expect(node.insightCost).toBeGreaterThan(0);
      expect(node.prerequisiteNodeIds.every(prerequisite => known.has(prerequisite))).toBe(true);
    }
  });

  it('解锁起始节点恰好消费悟痕，返回累计效果且不修改输入', () => {
    const state = createCultivationRunState({ overrides: { insight: 9 } });
    const unlockedNodeIds: CultivationInsightNodeId[] = [];
    const agendaBudget = budget(state.agendaIndex);
    const stateBefore = structuredClone(state);
    const idsBefore = structuredClone(unlockedNodeIds);
    const budgetBefore = structuredClone(agendaBudget);

    const result = unlockCultivationInsightNode({
      state,
      unlockedNodeIds,
      targetNodeId: 'foundation-rhythm',
      budget: agendaBudget
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.insight).toBe(7);
    expect(result.unlockedNodeIds).toEqual(['foundation-rhythm']);
    expect(result.effectTags).toEqual(['activity:training:foundation-rhythm']);
    expect(result.budget.unlockedThisAgenda).toBe(1);
    expect(state).toEqual(stateBefore);
    expect(unlockedNodeIds).toEqual(idsBefore);
    expect(agendaBudget).toEqual(budgetBefore);
  });

  it.each([
    ['field-breathing', ['foundation-rhythm']],
    ['clear-furnace-sequence', ['foundation-rhythm']],
    ['thunder-guiding-stone', ['field-breathing']],
    ['warding-pill-formula', ['clear-furnace-sequence']],
    ['violet-omen-rubbing', ['thunder-guiding-stone', 'warding-pill-formula']],
    ['ash-annotated-vow', ['violet-omen-rubbing']]
  ] as const)('节点 %s 缺少相邻前置时原子拒绝', (targetNodeId, expectedMissing) => {
    const state = createCultivationRunState({ overrides: { insight: 100 } });
    const stateBefore = structuredClone(state);
    const result = unlockCultivationInsightNode({
      state,
      unlockedNodeIds: [],
      targetNodeId,
      budget: budget(state.agendaIndex)
    });

    expect(result).toMatchObject({
      ok: false,
      state: stateBefore,
      unlockedNodeIds: [],
      error: { code: 'missing-prerequisite', missingPrerequisiteNodeIds: expectedMissing }
    });
    expect(state).toEqual(stateBefore);
  });

  it('悟痕不足时不扣资源、不追加节点', () => {
    const state = createCultivationRunState({ overrides: { insight: 1 } });
    const result = unlockCultivationInsightNode({
      state,
      unlockedNodeIds: [],
      targetNodeId: 'foundation-rhythm',
      budget: budget(state.agendaIndex)
    });

    expect(result).toMatchObject({
      ok: false,
      state,
      unlockedNodeIds: [],
      error: { code: 'insufficient-insight' }
    });
    expect(state.insight).toBe(1);
  });

  it('调用方沿用返回的 budget 时，同一轮第二次解锁被拒绝', () => {
    const state = createCultivationRunState({ overrides: { insight: 20 } });
    const first = unlockCultivationInsightNode({
      state,
      unlockedNodeIds: [],
      targetNodeId: 'foundation-rhythm',
      budget: budget(state.agendaIndex)
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = unlockCultivationInsightNode({
      state: first.state,
      unlockedNodeIds: first.unlockedNodeIds,
      targetNodeId: 'field-breathing',
      budget: first.budget
    });
    expect(second).toMatchObject({
      ok: false,
      state: first.state,
      unlockedNodeIds: first.unlockedNodeIds,
      error: { code: 'agenda-unlock-limit-reached' }
    });
  });

  it('拒绝伪造的非拓扑历史与未知目标', () => {
    const state = createCultivationRunState({ overrides: { insight: 20 } });
    const invalidHistory = unlockCultivationInsightNode({
      state,
      unlockedNodeIds: ['field-breathing', 'foundation-rhythm'],
      targetNodeId: 'clear-furnace-sequence',
      budget: budget(state.agendaIndex)
    });
    const unknownTarget = unlockCultivationInsightNode({
      state,
      unlockedNodeIds: [],
      targetNodeId: 'not-a-node',
      budget: budget(state.agendaIndex)
    });

    expect(invalidHistory).toMatchObject({ ok: false, error: { code: 'invalid-unlocked-topology' } });
    expect(unknownTarget).toMatchObject({ ok: false, error: { code: 'unknown-target-node' } });
  });

  it('沿完整路径解锁后返回全部七项效果标签', () => {
    const order: readonly CultivationInsightNodeId[] = [
      'foundation-rhythm',
      'field-breathing',
      'clear-furnace-sequence',
      'thunder-guiding-stone',
      'warding-pill-formula',
      'violet-omen-rubbing',
      'ash-annotated-vow'
    ];
    let state = createCultivationRunState({ overrides: { insight: 100 } });
    let unlockedNodeIds: readonly CultivationInsightNodeId[] = [];
    let effectTags: readonly string[] = [];

    for (const targetNodeId of order) {
      const result = unlockCultivationInsightNode({
        state,
        unlockedNodeIds,
        targetNodeId,
        budget: budget(state.agendaIndex)
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = { ...result.state, agendaIndex: result.state.agendaIndex + 1 };
      unlockedNodeIds = result.unlockedNodeIds;
      effectTags = result.effectTags;
    }

    expect(unlockedNodeIds).toEqual(order);
    expect(effectTags).toEqual(CULTIVATION_INSIGHT_EFFECT_TAGS);
  });
});
