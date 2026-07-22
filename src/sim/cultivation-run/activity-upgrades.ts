/** D27-c：把已悟残卷的活动效果标签翻译为后续日课的纯数值修正。 */
import type { CultivationInsightEffectTag } from './insight';
import type { CultivationActivityId } from './types';

export type CultivationActivityUpgradeEffectTag = Extract<
  CultivationInsightEffectTag,
  `activity:${string}`
>;

export interface CultivationInsightActivityUpgradeRule {
  readonly tag: CultivationActivityUpgradeEffectTag;
  readonly activity: Extract<CultivationActivityId, 'training' | 'farming' | 'alchemy'>;
  /** 只放大正向产出；1000 = 不变。 */
  readonly benefitMultiplierMilli: number;
  /** 只缩放该活动产生的心压、伤势或丹毒；1000 = 不变。 */
  readonly riskMultiplierMilli: number;
}

/**
 * 首切片固定契约。标签不叠加：同一节点即使被重复传入，也只应用一次。
 * 数值在 D27-c 玩家面验证后再迁入正式平衡参数表。
 */
export const CULTIVATION_INSIGHT_ACTIVITY_UPGRADE_RULES = [
  {
    tag: 'activity:training:foundation-rhythm',
    activity: 'training',
    benefitMultiplierMilli: 1125,
    riskMultiplierMilli: 850
  },
  {
    tag: 'activity:farming:field-breathing',
    activity: 'farming',
    benefitMultiplierMilli: 1250,
    riskMultiplierMilli: 1000
  },
  {
    tag: 'activity:alchemy:clear-furnace',
    activity: 'alchemy',
    benefitMultiplierMilli: 1250,
    riskMultiplierMilli: 750
  }
] as const satisfies readonly CultivationInsightActivityUpgradeRule[];

export const NEUTRAL_CULTIVATION_ACTIVITY_UPGRADE = {
  benefitMultiplierMilli: 1000,
  riskMultiplierMilli: 1000
} as const;

export interface CultivationActivityUpgradeModifiers {
  readonly benefitMultiplierMilli: number;
  readonly riskMultiplierMilli: number;
}

export function cultivationActivityUpgradeModifiers(
  activity: CultivationActivityId,
  insightEffectTags: readonly CultivationInsightEffectTag[] = []
): CultivationActivityUpgradeModifiers {
  const rule = CULTIVATION_INSIGHT_ACTIVITY_UPGRADE_RULES.find(
    candidate => candidate.activity === activity && insightEffectTags.includes(candidate.tag)
  );
  return rule
    ? {
        benefitMultiplierMilli: rule.benefitMultiplierMilli,
        riskMultiplierMilli: rule.riskMultiplierMilli
      }
    : { ...NEUTRAL_CULTIVATION_ACTIVITY_UPGRADE };
}
