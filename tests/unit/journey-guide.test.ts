import { describe, expect, it } from 'vitest';
import {
  buildJourneyGuide,
  formatJourneyGuideBody,
  formatJourneyGuideSummary,
  isJourneyTeachingActive,
  isJourneyTeachingDialogueBeat,
  journeyGuideDetailLines,
  journeyGuidePrimaryLine,
  JOURNEY_STAGE_COUNT,
  type JourneyGuideObjectiveId
} from '@app/journeyGuide';
import type { OnboardingObjectiveId } from '@sim/story/onboarding';

const LEGACY_OBJECTIVES: readonly OnboardingObjectiveId[] = [
  'first-till',
  'first-sow',
  'first-water',
  'first-harvest',
  'first-ship',
  'first-sleep',
  'first-market-restock',
  'first-second-sow',
  'first-second-water',
  'first-loop-complete'
];

describe('journey guide', () => {
  it('covers every public-demo onboarding objective with frozen stage copy', () => {
    for (const objectiveId of LEGACY_OBJECTIVES) {
      const guide = buildJourneyGuide(objectiveId);
      expect(guide.totalStages).toBe(JOURNEY_STAGE_COUNT);
      expect(guide.completed).toBe(false);
      expect(Object.isFrozen(guide)).toBe(true);
      expect(guide.progressLabel.length).toBeGreaterThan(0);
      expect(guide.currentAction.length).toBeGreaterThan(0);
      expect(guide.motivation.length).toBeGreaterThan(0);
      expect(guide.cta.length).toBeGreaterThan(0);
    }
  });

  it('maps the early farm loop into stage 1 herbs journey copy', () => {
    expect(buildJourneyGuide('first-till')).toMatchObject({
      stage: 1,
      stageId: 'herbs',
      progressLabel: '1/4 · 获得灵草',
      currentAction: '面对空地翻出第一块灵田',
      cta: '开始翻地'
    });
    expect(buildJourneyGuide('first-market-restock').currentAction).toBe('补充种子并返回农庄');
    expect(buildJourneyGuide('first-loop-complete')).toMatchObject({
      stage: 2,
      stageId: 'alchemy',
      progressLabel: '2/4 · 炼制丹药'
    });
  });

  it('keeps the later public-demo stages distinct and progressive', () => {
    expect(buildJourneyGuide('journey-alchemy')).toMatchObject({
      stage: 2,
      stageId: 'alchemy',
      progressLabel: '2/4 · 炼制丹药',
      cta: '开始炼丹',
      completed: false
    });
    expect(buildJourneyGuide('journey-tribulation')).toMatchObject({
      stage: 3,
      stageId: 'tribulation',
      progressLabel: '3/4 · 教学天劫',
      cta: '开始教学天劫'
    });
    expect(buildJourneyGuide('journey-aftermath')).toMatchObject({
      stage: 4,
      stageId: 'aftermath',
      progressLabel: '4/4 · 战后结算',
      cta: '查看战后结算'
    });
  });

  it('returns a stable completed free-play guide for explicit completion and absent objectives', () => {
    const explicit = buildJourneyGuide('journey-complete');
    const absent = buildJourneyGuide(null);
    expect(explicit).toEqual(absent);
    expect(explicit).toMatchObject({
      stage: 4,
      stageId: 'aftermath',
      progressLabel: '4/4 · 纵切片完成',
      completed: true,
      currentAction: '自由经营：播种、炼丹、备劫与外出都可自选',
      motivation: '教学纵切片已结束，后续节奏由你安排，不再强制教学引导',
      cta: '自由经营'
    });
    expect(Object.isFrozen(explicit)).toBe(true);
  });

  it('treats journey-complete and null as free-play (teaching inactive)', () => {
    expect(isJourneyTeachingActive('first-till')).toBe(true);
    expect(isJourneyTeachingActive('journey-alchemy')).toBe(true);
    expect(isJourneyTeachingActive('journey-tribulation')).toBe(true);
    expect(isJourneyTeachingActive('journey-aftermath')).toBe(true);
    expect(isJourneyTeachingActive('journey-complete')).toBe(false);
    expect(isJourneyTeachingActive(null)).toBe(false);
  });

  it('identifies residual day-1 teaching dialogue beats to suppress after complete', () => {
    expect(isJourneyTeachingDialogueBeat('first-till')).toBe(true);
    expect(isJourneyTeachingDialogueBeat('first-mature')).toBe(true);
    expect(isJourneyTeachingDialogueBeat('first-pill')).toBe(false);
    expect(isJourneyTeachingDialogueBeat('intro')).toBe(false);
  });

  it('soft-collapses secondary journey detail while keeping full copy available', () => {
    const guide = buildJourneyGuide('first-till');
    expect(journeyGuidePrimaryLine(guide)).toBe('面对空地翻出第一块灵田');
    expect(journeyGuideDetailLines(guide)).toEqual(['意义：灵草是炼丹、布阵与备劫的第一批资源', '行动：开始翻地']);
    expect(formatJourneyGuideBody(guide, 'compact')).toBe('面对空地翻出第一块灵田');
    expect(formatJourneyGuideBody(guide, 'compact')).not.toContain('\n');
    expect(formatJourneyGuideBody(guide, 'full')).toBe(
      ['面对空地翻出第一块灵田', '意义：灵草是炼丹、布阵与备劫的第一批资源', '行动：开始翻地'].join('\n')
    );
    expect(formatJourneyGuideSummary(guide)).toBe('1/4 · 获得灵草 · 面对空地翻出第一块灵田');
  });

  it('keeps guide copy independent of concrete keyboard, touch, or DOM controls', () => {
    const objectiveIds: readonly (JourneyGuideObjectiveId | null)[] = [
      ...LEGACY_OBJECTIVES,
      'journey-alchemy',
      'journey-tribulation',
      'journey-aftermath',
      'journey-complete',
      null
    ];
    for (const objectiveId of objectiveIds) {
      const guide = buildJourneyGuide(objectiveId);
      const text = `${guide.progressLabel}\n${guide.currentAction}\n${guide.motivation}\n${guide.cta}`;
      expect(text).not.toMatch(/Shift|Enter|Escape|F\d|page\.|querySelector|button/i);
    }
  });
});
