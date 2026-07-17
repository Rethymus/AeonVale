import type { OnboardingObjectiveId } from '@sim/story/onboarding';

export const JOURNEY_STAGE_COUNT = 4 as const;

export type JourneyStage = 1 | 2 | 3 | 4;
export type JourneyStageId = 'herbs' | 'alchemy' | 'tribulation' | 'aftermath';
export type JourneySliceObjectiveId = 'journey-alchemy' | 'journey-tribulation' | 'journey-aftermath' | 'journey-complete';
export type JourneyGuideObjectiveId = OnboardingObjectiveId | JourneySliceObjectiveId;

export interface JourneyGuide {
  readonly stage: JourneyStage;
  readonly totalStages: typeof JOURNEY_STAGE_COUNT;
  readonly stageId: JourneyStageId;
  readonly progressLabel: string;
  readonly currentAction: string;
  readonly motivation: string;
  readonly cta: string;
  readonly completed: boolean;
}

type ActiveJourneyGuide = Omit<JourneyGuide, 'totalStages' | 'completed'>;

function activeGuide(guide: ActiveJourneyGuide): JourneyGuide {
  return Object.freeze({ ...guide, totalStages: JOURNEY_STAGE_COUNT, completed: false });
}

const FARM_MOTIVATION = '灵草是炼丹、布阵与备劫的第一批资源';

const GUIDES: Readonly<Record<JourneyGuideObjectiveId, JourneyGuide>> = {
  'first-till': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '面对空地翻出第一块灵田',
    motivation: FARM_MOTIVATION,
    cta: '开始翻地'
  }),
  'first-sow': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '把第一颗灵草种子播进灵田',
    motivation: FARM_MOTIVATION,
    cta: '选择种子'
  }),
  'first-water': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '给刚播下的灵草浇水',
    motivation: '稳定照料才能把种子变成可炼丹的材料',
    cta: '浇灌灵草'
  }),
  'first-harvest': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '照料并收获第一批灵草',
    motivation: '收获会开启炼丹与教学天劫的准备路线',
    cta: '收获灵草'
  }),
  'first-ship': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '整理第一批灵草并完成首轮出货',
    motivation: '出货能把余量换成维持农庄循环的资源',
    cta: '打开出货箱'
  }),
  'first-sleep': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '结束今日农务并查看结算',
    motivation: '日结算会把本轮劳动转成下一步可用资源',
    cta: '结束本日'
  }),
  'first-market-restock': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '补充种子并返回农庄',
    motivation: '稳定的种子库存能避免后续炼丹材料断档',
    cta: '前往集市'
  }),
  'first-second-sow': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '把补充的种子播回灵田',
    motivation: '第二轮播种会把一次教学动作接成可重复日常',
    cta: '继续播种'
  }),
  'first-second-water': activeGuide({
    stage: 1,
    stageId: 'herbs',
    progressLabel: '1/4 · 获得灵草',
    currentAction: '给第二轮新苗完成首次浇水',
    motivation: '稳定农务后就可以把注意力转向炼丹和备劫',
    cta: '浇灌新苗'
  }),
  'first-loop-complete': activeGuide({
    stage: 2,
    stageId: 'alchemy',
    progressLabel: '2/4 · 炼制丹药',
    currentAction: '前往丹炉准备首枚备劫丹',
    motivation: '备劫丹会把农庄收获转成抵御天雷的手段',
    cta: '打开丹炉'
  }),
  'journey-alchemy': activeGuide({
    stage: 2,
    stageId: 'alchemy',
    progressLabel: '2/4 · 炼制丹药',
    currentAction: '选择材料并炼出首枚备劫丹',
    motivation: '这枚丹药会为第一次教学天劫提供容错',
    cta: '开始炼丹'
  }),
  'journey-tribulation': activeGuide({
    stage: 3,
    stageId: 'tribulation',
    progressLabel: '3/4 · 教学天劫',
    currentAction: '准备并完成教学小天劫',
    motivation: '亲历雷预警与走位后才能理解种田即备战',
    cta: '开始教学天劫'
  }),
  'journey-aftermath': activeGuide({
    stage: 4,
    stageId: 'aftermath',
    progressLabel: '4/4 · 战后结算',
    currentAction: '查看损失、收益与淬体进度',
    motivation: '结算会解释本次选择如何改变下一轮准备',
    cta: '查看战后结算'
  }),
  // V1-L01：完成后用自由经营文案，避免 day-1 教学残留
  'journey-complete': Object.freeze({
    stage: 4,
    totalStages: JOURNEY_STAGE_COUNT,
    stageId: 'aftermath',
    progressLabel: '4/4 · 纵切片完成',
    currentAction: '自由经营：播种、炼丹、备劫与外出都可自选',
    motivation: '教学纵切片已结束，后续节奏由你安排，不再强制教学引导',
    cta: '自由经营',
    completed: true
  })
};

const COMPLETED_GUIDE = GUIDES['journey-complete'];

/** Day-1 farm teaching narrative beats that must not reappear after journey-complete. */
export const JOURNEY_TEACHING_DIALOGUE_BEAT_IDS = Object.freeze(['first-till', 'first-mature'] as const);

export type JourneyTeachingDialogueBeatId = (typeof JOURNEY_TEACHING_DIALOGUE_BEAT_IDS)[number];

/** True while the public-demo / onboarding journey still drives forced teaching steps. */
export function isJourneyTeachingActive(objectiveId: JourneyGuideObjectiveId | null): boolean {
  return objectiveId != null && objectiveId !== 'journey-complete';
}

export function isJourneyTeachingDialogueBeat(beatId: string): boolean {
  return (JOURNEY_TEACHING_DIALOGUE_BEAT_IDS as readonly string[]).includes(beatId);
}

export function buildJourneyGuide(objectiveId: JourneyGuideObjectiveId | null): JourneyGuide {
  if (objectiveId == null || objectiveId === 'journey-complete') return COMPLETED_GUIDE;
  return GUIDES[objectiveId] ?? COMPLETED_GUIDE;
}

/** Always-visible primary objective line for cozy HUD density (V1-T6). */
export function journeyGuidePrimaryLine(guide: JourneyGuide): string {
  return guide.currentAction;
}

/** Secondary log/detail lines — default-collapsed in progressive disclosure UI. */
export function journeyGuideDetailLines(guide: JourneyGuide): readonly string[] {
  return [`意义：${guide.motivation}`, `行动：${guide.cta}`];
}

/**
 * Full body keeps every line for a11y/debug; compact shows only the primary objective.
 * Info is never removed — only presentation density changes.
 */
export function formatJourneyGuideBody(guide: JourneyGuide, density: 'compact' | 'full' = 'full'): string {
  if (density === 'compact') return journeyGuidePrimaryLine(guide);
  return [journeyGuidePrimaryLine(guide), ...journeyGuideDetailLines(guide)].join('\n');
}

export function formatJourneyGuideSummary(guide: JourneyGuide): string {
  return `${guide.progressLabel} · ${journeyGuidePrimaryLine(guide)}`;
}
