/**
 * D27-b 六类基础活动结算。
 *
 * 每次调用都返回新状态；失败不改输入。资源检查按结算顺序发生，因此“灵田→炼丹”与
 * “谋生→参悟”天然成立，而无需额外脚本规则。
 */
import { withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { clampInt, combinedEfficiencyMilli, mitigatedPressureGain, scaledBenefit } from './pressure';
import { cultivationActivityUpgradeModifiers } from './activity-upgrades';
import { cultivationStageCaps } from './progression';
import type { CultivationInsightEffectTag } from './insight';
import { cultivationActivityIsUnlocked } from './types';
import type {
  CultivationActivityDelta,
  CultivationActivityId,
  CultivationActivityResolution,
  CultivationAgendaErrorCode,
  CultivationRunState
} from './types';

export interface ResolveCultivationActivityResult {
  readonly ok: boolean;
  readonly state: CultivationRunState;
  readonly resolution?: CultivationActivityResolution;
  readonly error?: CultivationAgendaErrorCode;
}

export function cloneCultivationRunState(state: CultivationRunState): CultivationRunState {
  return { ...state };
}

export function activityTimeCostDays(activity: CultivationActivityId, params: BalanceParams): number {
  const p = withDefaultBalanceParams(params).cultivationRun.activities;
  return p[activity].timeCostDays;
}

function deltaOf(before: CultivationRunState, after: CultivationRunState): CultivationActivityDelta {
  return {
    lifespanRemainingDays: after.lifespanRemainingDays - before.lifespanRemainingDays,
    bodyFoundation: after.bodyFoundation - before.bodyFoundation,
    endurance: after.endurance - before.endurance,
    willpower: after.willpower - before.willpower,
    pillPoison: after.pillPoison - before.pillPoison,
    pressure: after.pressure - before.pressure,
    mortalHeart: after.mortalHeart - before.mortalHeart,
    insight: after.insight - before.insight,
    injury: after.injury - before.injury,
    herbs: after.herbs - before.herbs,
    food: after.food - before.food,
    spiritStones: after.spiritStones - before.spiritStones,
    pills: after.pills - before.pills
  };
}

function requireResource(current: number, cost: number, code: CultivationAgendaErrorCode): CultivationAgendaErrorCode | null {
  return current >= cost ? null : code;
}

export function resolveCultivationActivity(
  state: CultivationRunState,
  activity: CultivationActivityId,
  consecutiveCount: number,
  slotIndex: number,
  params: BalanceParams,
  insightEffectTags: readonly CultivationInsightEffectTag[] = []
): ResolveCultivationActivityResult {
  const resolved = withDefaultBalanceParams(params);
  const p = resolved.cultivationRun;
  const timeCostDays = p.activities[activity].timeCostDays;
  if (state.status !== 'active') return { ok: false, state, error: 'run-ended' };
  if (!cultivationActivityIsUnlocked(activity, state.stage)) return { ok: false, state, error: 'activity-locked' };
  if (state.lifespanRemainingDays < timeCostDays) return { ok: false, state, error: 'insufficient-lifespan' };

  let resourceError: CultivationAgendaErrorCode | null = null;
  if (activity === 'training') resourceError = requireResource(state.food, p.activities.training.foodCost, 'insufficient-food');
  else if (activity === 'alchemy') resourceError = requireResource(state.herbs, p.activities.alchemy.herbCost, 'insufficient-herbs');
  else if (activity === 'insight') resourceError = requireResource(state.spiritStones, p.activities.insight.spiritStoneCost, 'insufficient-spirit-stones');
  else if (activity === 'rest') resourceError = requireResource(state.food, p.activities.rest.foodCost, 'insufficient-food');
  else if (activity === 'meridian') resourceError = requireResource(state.food, p.activities.meridian.foodCost, 'insufficient-food');
  else if (activity === 'arrayStudy') resourceError = requireResource(state.spiritStones, p.activities.arrayStudy.spiritStoneCost, 'insufficient-spirit-stones');
  else if (activity === 'lightningBath') resourceError = requireResource(state.herbs, p.activities.lightningBath.herbCost, 'insufficient-herbs');
  else if (activity === 'heavenTheft') resourceError = requireResource(state.spiritStones, p.activities.heavenTheft.spiritStoneCost, 'insufficient-spirit-stones');
  if (resourceError) return { ok: false, state, error: resourceError };

  const before = cloneCultivationRunState(state);
  const next = cloneCultivationRunState(state);
  const efficiencyMilli = combinedEfficiencyMilli(state, consecutiveCount, resolved);
  const upgrade = cultivationActivityUpgradeModifiers(activity, insightEffectTags);
  const benefitEfficiencyMilli = scaledBenefit(efficiencyMilli, upgrade.benefitMultiplierMilli);
  next.lifespanRemainingDays -= timeCostDays;

  switch (activity) {
    case 'training': {
      const def = p.activities.training;
      next.food -= def.foodCost;
      next.bodyFoundation += scaledBenefit(def.bodyFoundationGain, benefitEfficiencyMilli);
      next.endurance += scaledBenefit(def.enduranceGain, benefitEfficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, benefitEfficiencyMilli);
      next.injury += scaledBenefit(
        def.injuryGain + Math.max(0, consecutiveCount - 1) * p.repeatInjuryStep,
        upgrade.riskMultiplierMilli
      );
      next.pressure += scaledBenefit(
        mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved),
        upgrade.riskMultiplierMilli
      );
      break;
    }
    case 'farming': {
      const def = p.activities.farming;
      next.herbs += scaledBenefit(def.herbGain, benefitEfficiencyMilli);
      next.food += scaledBenefit(def.foodGain, benefitEfficiencyMilli);
      next.mortalHeart += scaledBenefit(def.mortalHeartGain, benefitEfficiencyMilli);
      next.pressure -= scaledBenefit(def.pressureRelief, benefitEfficiencyMilli);
      break;
    }
    case 'alchemy': {
      const def = p.activities.alchemy;
      next.herbs -= def.herbCost;
      next.pills += scaledBenefit(def.pillGain, benefitEfficiencyMilli);
      next.insight += scaledBenefit(def.insightGain, benefitEfficiencyMilli);
      next.pillPoison += scaledBenefit(def.poisonGain, upgrade.riskMultiplierMilli);
      next.pressure += scaledBenefit(
        mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved),
        upgrade.riskMultiplierMilli
      );
      break;
    }
    case 'livelihood': {
      const def = p.activities.livelihood;
      next.spiritStones += scaledBenefit(def.spiritStoneGain, efficiencyMilli);
      next.mortalHeart -= def.mortalHeartLoss;
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
    case 'insight': {
      const def = p.activities.insight;
      next.spiritStones -= def.spiritStoneCost;
      next.insight += scaledBenefit(def.insightGain, efficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, efficiencyMilli);
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
    case 'rest': {
      const def = p.activities.rest;
      next.food -= def.foodCost;
      next.pressure -= scaledBenefit(def.pressureRelief, efficiencyMilli);
      next.mortalHeart += scaledBenefit(def.mortalHeartGain, efficiencyMilli);
      next.injury -= scaledBenefit(def.injuryRelief, efficiencyMilli);
      next.pillPoison -= scaledBenefit(def.poisonRelief, efficiencyMilli);
      break;
    }
    case 'meridian': {
      const def = p.activities.meridian;
      next.food -= def.foodCost;
      next.bodyFoundation += scaledBenefit(def.bodyFoundationGain, efficiencyMilli);
      next.endurance += scaledBenefit(def.enduranceGain, efficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, efficiencyMilli);
      next.injury += def.injuryGain;
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
    case 'arrayStudy': {
      const def = p.activities.arrayStudy;
      next.spiritStones -= def.spiritStoneCost;
      next.insight += scaledBenefit(def.insightGain, efficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, efficiencyMilli);
      next.mortalHeart += scaledBenefit(def.mortalHeartGain, efficiencyMilli);
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
    case 'lightningBath': {
      const def = p.activities.lightningBath;
      next.herbs -= def.herbCost;
      next.bodyFoundation += scaledBenefit(def.bodyFoundationGain, efficiencyMilli);
      next.endurance += scaledBenefit(def.enduranceGain, efficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, efficiencyMilli);
      next.pillPoison += def.poisonGain;
      next.injury += def.injuryGain;
      next.heavenDebt += def.heavenDebtGain;
      next.daoAttention += def.daoAttentionGain;
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
    case 'heavenTheft': {
      const def = p.activities.heavenTheft;
      next.spiritStones -= def.spiritStoneCost;
      next.bodyFoundation += scaledBenefit(def.bodyFoundationGain, efficiencyMilli);
      next.willpower += scaledBenefit(def.willpowerGain, efficiencyMilli);
      next.insight += scaledBenefit(def.insightGain, efficiencyMilli);
      next.injury += def.injuryGain;
      next.heavenDebt += def.heavenDebtGain;
      next.daoAttention += def.daoAttentionGain;
      next.pressure += mitigatedPressureGain(def.pressureGain, state, consecutiveCount, resolved);
      break;
    }
  }

  const pressureCrisis = before.pressure < p.pressureCap && next.pressure >= p.pressureCap;
  const poisonCap = resolved.pillPoison.cap * 1000;
  const poisonCrisis = before.pillPoison < poisonCap && next.pillPoison >= poisonCap;
  next.pressure = clampInt(next.pressure, 0, p.pressureCap);
  next.mortalHeart = clampInt(next.mortalHeart, 0, p.mortalHeartCap);
  next.injury = clampInt(next.injury, 0, p.injuryCap);
  next.pillPoison = clampInt(next.pillPoison, 0, poisonCap);
  const stageCaps = cultivationStageCaps(state.stage, resolved);
  next.bodyFoundation = clampInt(next.bodyFoundation, 0, stageCaps.bodyFoundation);
  next.endurance = clampInt(next.endurance, 0, stageCaps.endurance);
  next.willpower = clampInt(next.willpower, 0, stageCaps.willpower);
  next.status = next.lifespanRemainingDays === 0 ? 'lifespan-ended' : 'active';

  return {
    ok: true,
    state: next,
    resolution: {
      slotIndex,
      activity,
      consecutiveCount,
      efficiencyMilli,
      pressureCrisis,
      poisonCrisis,
      delta: deltaOf(before, next)
    }
  };
}
