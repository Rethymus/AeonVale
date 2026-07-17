import { describe, expect, it } from 'vitest';
import { buildJourneyGuide, isJourneyTeachingActive, JOURNEY_STAGE_COUNT, type JourneyGuideObjectiveId } from '@app/journeyGuide';
import type { OnboardingObjectiveId } from '@sim/story/onboarding';

const LEGACY_OBJECTIVES: readonly OnboardingObjectiveId[] = ['first-till', 'first-sow', 'first-water', 'first-harvest', 'first-ship', 'first-sleep', 'first-market-restock', 'first-second-sow', 'first-second-water', 'first-loop-complete'];

describe('journey guide', () => {
  it('maps every existing onboarding objective to a compact four-stage guide', () => {
    for (const objectiveId of LEGACY_OBJECTIVES) {
      const guide = buildJourneyGuide(objectiveId);
      expect(guide.stage).toBeGreaterThanOrEqual(1);
      expect(guide.stage).toBeLessThanOrEqual(JOURNEY_STAGE_COUNT);
      expect(guide.totalStages).toBe(4);
      expect(guide.currentAction.length).toBeGreaterThan(0);
      expect(guide.motivation.length).toBeGreaterThan(0);
      expect(guide.cta.length).toBeGreaterThan(0);
      expect(guide.currentAction).not.toContain('\n');
      expect(guide.motivation).not.toContain('\n');
      expect(guide.cta).not.toContain('\n');
    }
  });

  it('keeps active farm objectives in stage one with objective-specific actions', () => {
    expect(buildJourneyGuide('first-till')).toMatchObject({
      stage: 1,
      stageId: 'herbs',
      progressLabel: '1/4 · 获得灵草',
      currentAction: '面对空地翻出第一块灵田',
      cta: '开始翻地',
      completed: false
    });
    expect(buildJourneyGuide('first-water').currentAction).toBe('给刚播下的灵草浇水');
    expect(buildJourneyGuide('first-harvest').currentAction).toBe('照料并收获第一批灵草');
    expect(buildJourneyGuide('first-market-restock').currentAction).toBe('补充种子并返回农庄');
  });

  it('hands a completed legacy farm loop to the alchemy stage', () => {
    expect(buildJourneyGuide('first-loop-complete')).toEqual(
      expect.objectContaining({
        stage: 2,
        stageId: 'alchemy',
        progressLabel: '2/4 · 炼制丹药',
        currentAction: '前往丹炉准备首枚备劫丹',
        cta: '打开丹炉',
        completed: false
      })
    );
  });

  it('maps the new vertical-slice objectives to alchemy, tribulation, and aftermath', () => {
    expect(buildJourneyGuide('journey-alchemy')).toMatchObject({
      stage: 2,
      stageId: 'alchemy',
      currentAction: '选择材料并炼出首枚备劫丹',
      cta: '开始炼丹'
    });
    expect(buildJourneyGuide('journey-tribulation')).toMatchObject({
      stage: 3,
      stageId: 'tribulation',
      progressLabel: '3/4 · 教学天劫',
      currentAction: '准备并完成教学小天劫',
      cta: '开始教学天劫'
    });
    expect(buildJourneyGuide('journey-aftermath')).toMatchObject({
      stage: 4,
      stageId: 'aftermath',
      progressLabel: '4/4 · 战后结算',
      currentAction: '查看损失、收益与淬体进度',
      cta: '查看战后结算'
    });
  });

  it('returns a stable completed guide for explicit completion and absent objectives', () => {
    const explicit = buildJourneyGuide('journey-complete');
    const absent = buildJourneyGuide(null);
    expect(explicit).toEqual(absent);
    expect(explicit).toMatchObject({
      stage: 4,
      stageId: 'aftermath',
      progressLabel: '4/4 · 纵切片完成',
      completed: true,
      cta: '自由修行'
    });
    expect(explicit.currentAction).toContain('自由经营');
    expect(explicit.motivation).toContain('教学已完成');
    expect(Object.isFrozen(explicit)).toBe(true);
    expect(isJourneyTeachingActive('journey-complete')).toBe(false);
    expect(isJourneyTeachingActive(null)).toBe(false);
    expect(isJourneyTeachingActive('first-till')).toBe(true);
  });

  it('keeps guide copy independent of concrete keyboard, touch, or DOM controls', () => {
    const objectiveIds: readonly (JourneyGuideObjectiveId | null)[] = [...LEGACY_OBJECTIVES, 'journey-alchemy', 'journey-tribulation', 'journey-aftermath', 'journey-complete', null];
    for (const objectiveId of objectiveIds) {
      const text = Object.values(buildJourneyGuide(objectiveId)).join(' ');
      expect(text).not.toMatch(/Shift|Enter|Escape|F\d|page\.|querySelector|button/i);
    }
  });
});
