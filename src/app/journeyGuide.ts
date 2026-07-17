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
  'journey-complete': Object.freeze({
    stage: 4,
    totalStages: JOURNEY_STAGE_COUNT,
    stageId: 'aftermath',
    progressLabel: '4/4 · 纵切片完成',
    currentAction: '自由经营：照料灵田、炼丹与备劫',
    motivation: '教学已完成。不必再做「翻地开田」的新手提示。',
    cta: '自由修行',
    completed: true
  })
};

const COMPLETED_GUIDE = GUIDES['journey-complete'];

/** 教学目标是否仍应驱动「第一轮」翻地/播种文案。 */
export function isJourneyTeachingActive(objectiveId: JourneyGuideObjectiveId | null): boolean {
  if (objectiveId == null) return false;
  return objectiveId !== 'journey-complete';
}

export function buildJourneyGuide(objectiveId: JourneyGuideObjectiveId | null): JourneyGuide {
  if (objectiveId == null || objectiveId === 'journey-complete') return COMPLETED_GUIDE;
  return GUIDES[objectiveId] ?? COMPLETED_GUIDE;
}
