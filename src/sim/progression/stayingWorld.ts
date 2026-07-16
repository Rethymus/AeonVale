import type { GameState, StayingWorldState } from '@sim/world/state';
import { createDefaultStayingWorldState, emit } from '@sim/world/state';
import { MILLI, clampMilli } from '@sim/world/types';
import { greenhouseClimateCareGainBonus, greenhouseClimateNeglectBuffer, greenhouseCultivationBalance, greenhouseVisitFlag } from '@sim/social/greenhouse';
import { insulationClimateControlBonus } from '@sim/tribulation/arrays';
import { arrayWardenInsulationClimateBoost } from '@sim/celestial/beastSystem';
import { teaShedVisitFlag } from '@sim/social/teaShed';
import { hasResolvedStayingWorldIncidentForDay, refreshStayingWorldIncident } from './stayingWorldIncidents';

function hasCommissionCompletionForDay(state: GameState, day: number): boolean {
  const prefix = `commission.${day}.`;
  for (const flag of state.flags) {
    if (flag.startsWith(prefix)) return true;
  }
  return false;
}

function clampPressure(value: number): number {
  return clampMilli(value, 0, 100 * MILLI);
}

function clampHarmony(value: number): number {
  return clampMilli(value, 0, 100 * MILLI);
}

function clampGreenhouseClimate(value: number): number {
  return clampMilli(value, 0, 100 * MILLI);
}

export function ensureStayingWorldState(state: GameState): StayingWorldState {
  const current = state.stayingWorld ?? createDefaultStayingWorldState();
  const normalized: StayingWorldState = {
    ...createDefaultStayingWorldState(),
    ...current,
    wardingPressure: clampPressure(current.wardingPressure ?? 18 * MILLI),
    quietHarmony: clampHarmony(current.quietHarmony ?? 62 * MILLI),
    neglectedWardingDays: Math.max(0, Math.floor(current.neglectedWardingDays ?? 0)),
    neglectedQuietDays: Math.max(0, Math.floor(current.neglectedQuietDays ?? 0)),
    greenhouseClimate: clampGreenhouseClimate(current.greenhouseClimate ?? 42 * MILLI),
    greenhouseCareStreak: Math.max(0, Math.floor(current.greenhouseCareStreak ?? 0)),
    stableDays: Math.max(0, Math.floor(current.stableDays ?? 0)),
    lastEvaluatedDay: Math.max(0, Math.floor(current.lastEvaluatedDay ?? 0)),
    currentIncidentId: typeof current.currentIncidentId === 'string' ? current.currentIncidentId : null,
    currentIncidentDay: Math.max(0, Math.floor(current.currentIncidentDay ?? 0)),
    resolvedIncidentDay: Math.max(0, Math.floor(current.resolvedIncidentDay ?? 0))
  };
  if (state.stayingWorld) Object.assign(state.stayingWorld, normalized);
  else state.stayingWorld = normalized;
  return state.stayingWorld;
}

export function startStayingWorld(state: GameState): void {
  const staying = ensureStayingWorldState(state);
  state.stayingWorld = {
    ...createDefaultStayingWorldState(),
    wardingPressure: staying.wardingPressure,
    quietHarmony: staying.quietHarmony,
    neglectedWardingDays: staying.neglectedWardingDays,
    neglectedQuietDays: staying.neglectedQuietDays,
    greenhouseClimate: staying.greenhouseClimate,
    greenhouseCareStreak: staying.greenhouseCareStreak,
    stableDays: staying.stableDays,
    currentIncidentId: staying.currentIncidentId,
    currentIncidentDay: staying.currentIncidentDay,
    resolvedIncidentDay: staying.resolvedIncidentDay,
    lastEvaluatedDay: Math.max(0, state.day - 1)
  };
  refreshStayingWorldIncident(state);
}

export function advanceStayingWorldDay(state: GameState): void {
  if (state.postAscension.mode !== 'stayed-in-world') return;
  const staying = ensureStayingWorldState(state);
  const evaluatedDay = Math.max(1, state.day - 1);
  if (staying.lastEvaluatedDay >= evaluatedDay) return;

  const wardingDone = hasCommissionCompletionForDay(state, evaluatedDay) || hasResolvedStayingWorldIncidentForDay(state, evaluatedDay) || state.events.some(event => event.type === 'special-order-progress' || event.type === 'special-order-complete');
  const quietTeaDone = state.flags.has(teaShedVisitFlag(evaluatedDay));
  const quietGreenhouseDone = state.flags.has(greenhouseVisitFlag(evaluatedDay));
  const quietDone = quietTeaDone || quietGreenhouseDone;
  const insulationClimateBonus = insulationClimateControlBonus(state);
  // 阵守巡守兽在绝缘阵覆盖内巡逻 → 额外强化暖棚控温。
  const wardenClimateBoost = arrayWardenInsulationClimateBoost(state);
  const cultivationBalance = greenhouseCultivationBalance(state);

  const beforePressure = staying.wardingPressure;
  const beforeHarmony = staying.quietHarmony;

  let pressureDelta = 4 * MILLI;
  if (wardingDone) {
    staying.neglectedWardingDays = 0;
    pressureDelta = state.events.some(event => event.type === 'special-order-complete') ? -14 * MILLI : -10 * MILLI;
  } else {
    staying.neglectedWardingDays += 1;
    pressureDelta += Math.min(12 * MILLI, staying.neglectedWardingDays * 3 * MILLI);
  }

  let harmonyDelta = -3 * MILLI;
  if (quietTeaDone && quietGreenhouseDone) {
    staying.neglectedQuietDays = 0;
    harmonyDelta = 11 * MILLI;
  } else if (quietDone) {
    staying.neglectedQuietDays = 0;
    harmonyDelta = 6 * MILLI;
  } else {
    staying.neglectedQuietDays += 1;
    harmonyDelta -= Math.min(10 * MILLI, staying.neglectedQuietDays * 2 * MILLI);
  }

  const beforeGreenhouseClimate = staying.greenhouseClimate;
  if (quietGreenhouseDone) {
    staying.greenhouseCareStreak += 1;
    const climateGain = 6 * MILLI + Math.min(6 * MILLI, staying.greenhouseCareStreak * MILLI) + greenhouseClimateCareGainBonus(state) + cultivationBalance.diversityBonus - cultivationBalance.monoculturePenalty + (insulationClimateBonus.careGainBonus + wardenClimateBoost.careGainBonus) * MILLI;
    staying.greenhouseClimate = clampGreenhouseClimate(staying.greenhouseClimate + climateGain);
  } else {
    staying.greenhouseCareStreak = 0;
    const climateLoss = Math.max(MILLI, 5 * MILLI + Math.min(9 * MILLI, staying.neglectedQuietDays * MILLI) - greenhouseClimateNeglectBuffer(state) - (insulationClimateBonus.neglectBuffer + wardenClimateBoost.neglectBuffer) * MILLI);
    staying.greenhouseClimate = clampGreenhouseClimate(staying.greenhouseClimate - climateLoss);
  }

  staying.wardingPressure = clampPressure(staying.wardingPressure + pressureDelta);
  staying.quietHarmony = clampHarmony(staying.quietHarmony + harmonyDelta);
  staying.lastEvaluatedDay = evaluatedDay;

  const stableToday = staying.wardingPressure <= 35 * MILLI && staying.quietHarmony >= 60 * MILLI;
  staying.stableDays = stableToday ? staying.stableDays + 1 : 0;

  if (staying.wardingPressure !== beforePressure || staying.quietHarmony !== beforeHarmony) {
    emit(state, 'staying-world-day-evaluated', {
      day: evaluatedDay,
      wardingDone,
      quietTeaDone,
      quietGreenhouseDone,
      wardingPressure: staying.wardingPressure,
      quietHarmony: staying.quietHarmony,
      greenhouseClimate: staying.greenhouseClimate,
      greenhouseCareStreak: staying.greenhouseCareStreak,
      greenhouseCultivationDiversityBonus: cultivationBalance.diversityBonus,
      greenhouseCultivationMonoculturePenalty: cultivationBalance.monoculturePenalty,
      insulationClimateCareGainBonus: insulationClimateBonus.careGainBonus * MILLI,
      insulationClimateNeglectBuffer: insulationClimateBonus.neglectBuffer * MILLI,
      stableDays: staying.stableDays
    });
  }

  if (beforeGreenhouseClimate < 65 * MILLI && staying.greenhouseClimate >= 65 * MILLI) {
    emit(state, 'greenhouse-climate-stabilized', {
      day: evaluatedDay,
      greenhouseClimate: staying.greenhouseClimate,
      greenhouseCareStreak: staying.greenhouseCareStreak
    });
  }
  if (beforeGreenhouseClimate >= 35 * MILLI && staying.greenhouseClimate < 35 * MILLI) {
    emit(state, 'greenhouse-climate-slipping', {
      day: evaluatedDay,
      greenhouseClimate: staying.greenhouseClimate
    });
  }

  if (beforePressure < 60 * MILLI && staying.wardingPressure >= 60 * MILLI) {
    emit(state, 'staying-world-pressure-rising', { day: evaluatedDay, wardingPressure: staying.wardingPressure });
  }
  if (beforeHarmony >= 45 * MILLI && staying.quietHarmony < 45 * MILLI) {
    emit(state, 'staying-world-harmony-falling', { day: evaluatedDay, quietHarmony: staying.quietHarmony });
  }
  if (staying.stableDays > 0 && staying.stableDays % 3 === 0) {
    emit(state, 'staying-world-stability-built', {
      day: evaluatedDay,
      stableDays: staying.stableDays,
      wardingPressure: staying.wardingPressure,
      quietHarmony: staying.quietHarmony
    });
  }
  if (staying.stableDays > 0 && staying.stableDays % 7 === 0) {
    // 连续稳住 7 日的“安居红利”：和谐回升、压力回落，奖励长期把留世日子过稳。
    staying.quietHarmony = clampHarmony(staying.quietHarmony + 5 * MILLI);
    staying.wardingPressure = clampPressure(staying.wardingPressure - 5 * MILLI);
    emit(state, 'staying-world-stability-milestone', {
      day: evaluatedDay,
      stableDays: staying.stableDays,
      quietHarmony: staying.quietHarmony,
      wardingPressure: staying.wardingPressure,
      harmonyBonus: 5 * MILLI,
      pressureRelief: 5 * MILLI
    });
  }

  refreshStayingWorldIncident(state);
}
