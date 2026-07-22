/** D27-b 心压 / 凡心 / 连续重复的纯数值规则。 */
import type { BalanceParams } from '@sim/params';
import type { CultivationRunState } from './types';

export function clampInt(value: number, min: number, max: number): number {
  const finite = Number.isFinite(value) ? Math.round(value) : min;
  return finite < min ? min : finite > max ? max : finite;
}

/** 连续同活动收益递减：第 1 次满额，第 2 次二档，第 3 次起三档。 */
export function repeatEfficiencyMilli(consecutiveCount: number, params: BalanceParams): number {
  if (consecutiveCount <= 1) return 1000;
  if (consecutiveCount === 2) return params.cultivationRun.repeatSecondEfficiencyMilli;
  return params.cultivationRun.repeatLaterEfficiencyMilli;
}

/** 高心压在活动开始时降低本格正向收益。 */
export function pressureEfficiencyMilli(state: CultivationRunState, params: BalanceParams): number {
  return state.pressure >= params.cultivationRun.pressurePenaltyThreshold
    ? params.cultivationRun.pressurePenaltyEfficiencyMilli
    : 1000;
}

export function combinedEfficiencyMilli(state: CultivationRunState, consecutiveCount: number, params: BalanceParams): number {
  return Math.round((repeatEfficiencyMilli(consecutiveCount, params) * pressureEfficiencyMilli(state, params)) / 1000);
}

/** 凡心只缓冲正向心压，不把压力收益倒转为减压。 */
export function mitigatedPressureGain(baseGain: number, state: CultivationRunState, consecutiveCount: number, params: BalanceParams): number {
  if (baseGain <= 0) return baseGain;
  const mortalHeartMitigation = Math.floor(state.mortalHeart / params.cultivationRun.mortalHeartPressureDivisor);
  const repeatStress = Math.max(0, consecutiveCount - 1) * params.cultivationRun.repeatPressureStep;
  return Math.max(0, baseGain + repeatStress - mortalHeartMitigation);
}

export function scaledBenefit(value: number, efficiencyMilli: number): number {
  return Math.round((value * efficiencyMilli) / 1000);
}
