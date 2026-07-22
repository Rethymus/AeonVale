import { describe, expect, test } from 'vitest';
import { CULTIVATION_FINAL_STAGE, CULTIVATION_REALMS, cultivationRealmAt, createCultivationAshEpitaph, isCultivationProgressionStage, isFinalCultivationStage, nextCultivationStage, resolveCultivationProgression } from '@sim/cultivation-run';

describe('D27-f · 六境进程与终局', () => {
  test('六境目录固定为察漏至归一，并与凡骨 stage 0 分离', () => {
    expect(CULTIVATION_REALMS).toEqual([
      { stage: 1, name: '察漏' },
      { stage: 2, name: '引路' },
      { stage: 3, name: '借势' },
      { stage: 4, name: '淬骨' },
      { stage: 5, name: '守我' },
      { stage: 6, name: '归一' }
    ]);
    expect(cultivationRealmAt(0)).toBeNull();
    expect(cultivationRealmAt(4)).toEqual({ stage: 4, name: '淬骨' });
    expect(cultivationRealmAt(7)).toBeNull();
  });

  test('stage 0 兼容进入第一境，只有第六境是终境且没有下一境', () => {
    expect(nextCultivationStage(0)).toBe(1);
    expect(nextCultivationStage(5)).toBe(6);
    expect(nextCultivationStage(6)).toBeNull();
    expect(isFinalCultivationStage(5)).toBe(false);
    expect(isFinalCultivationStage(CULTIVATION_FINAL_STAGE)).toBe(true);
  });

  test('非法阶段不被吸收到六境进程', () => {
    for (const stage of [-1, 1.5, 7, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(isCultivationProgressionStage(stage)).toBe(false);
      expect(nextCultivationStage(stage)).toBeNull();
      expect(resolveCultivationProgression(stage, 'tribulation-succeeded')).toEqual({
        ok: false,
        error: 'invalid-stage',
        stageBefore: stage
      });
    }
  });

  test('非终境渡劫成功只推进一境，不提前生成碑记终局', () => {
    expect(resolveCultivationProgression(0, 'tribulation-succeeded')).toEqual({
      ok: true,
      kind: 'stage-advanced',
      terminal: false,
      stageBefore: 0,
      stageAfter: 1,
      epitaphData: null
    });
    expect(resolveCultivationProgression(5, 'tribulation-succeeded')).toEqual({
      ok: true,
      kind: 'stage-advanced',
      terminal: false,
      stageBefore: 5,
      stageAfter: 6,
      epitaphData: null
    });
  });

  test('第六境渡劫成功收束为身体存活的飞升终局', () => {
    expect(resolveCultivationProgression(6, 'tribulation-succeeded')).toEqual({
      ok: true,
      kind: 'ascended',
      terminal: true,
      stageBefore: 6,
      stageAfter: 6,
      epitaphData: {
        highestStage: 6,
        conclusion: { kind: 'ending', ending: 'ascended' }
      }
    });
  });

  test('任一合法阶段寿元耗尽都保留最高阶段并生成稳定死因', () => {
    expect(resolveCultivationProgression(3, 'lifespan-exhausted')).toEqual({
      ok: true,
      kind: 'lifespan-ended',
      terminal: true,
      stageBefore: 3,
      stageAfter: 3,
      epitaphData: {
        highestStage: 3,
        conclusion: { kind: 'death', cause: 'lifespan-ended' }
      }
    });
  });

  test('终局事实可直接并入劫灰碑记，不需要界面层重新解释', () => {
    const progression = resolveCultivationProgression(6, 'tribulation-succeeded');
    expect(progression.ok).toBe(true);
    if (!progression.ok || !progression.epitaphData) return;

    const epitaph = createCultivationAshEpitaph({
      identity: { name: '无名', portraitId: 'portrait.default' },
      ...progression.epitaphData,
      eventHistoryTags: [],
      unlockedKnowledgeNodeIds: [],
      herbsScorched: 0,
      herbsPreserved: 0
    });

    expect(epitaph.highestStage).toBe(6);
    expect(epitaph.conclusion).toEqual({ kind: 'ending', ending: 'ascended' });
  });
});
