/** D27-b 六格日程：状态构造、合法性检查与原子顺序结算。 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { activityTimeCostDays, cloneCultivationRunState, resolveCultivationActivity } from './activities';
import { clampInt } from './pressure';
import type { CultivationInsightEffectTag } from './insight';
import { CULTIVATION_RUN_MAX_STAGE } from './types';
import type {
  CultivationActivityId,
  CultivationAgenda,
  CultivationAgendaResolution,
  CultivationRunState
} from './types';

const NON_NEGATIVE_KEYS = [
  'agendaIndex',
  'lifespanRemainingDays',
  'bodyFoundation',
  'endurance',
  'willpower',
  'pillPoison',
  'heavenDebt',
  'daoAttention',
  'insight',
  'herbs',
  'food',
  'spiritStones',
  'pills'
] as const;

export interface CreateCultivationRunOptions {
  readonly seed?: number;
  readonly params?: BalanceParams;
  readonly overrides?: Partial<Omit<CultivationRunState, 'seed'>>;
}

export interface CultivationAgendaContext {
  readonly insightEffectTags?: readonly CultivationInsightEffectTag[];
}

export function createCultivationRunState(options: CreateCultivationRunOptions = {}): CultivationRunState {
  const params = withDefaultBalanceParams(options.params ?? DEFAULT_BALANCE);
  const state: CultivationRunState = {
    seed: options.seed ?? 1,
    stage: 0,
    agendaIndex: 0,
    status: 'active',
    lifespanRemainingDays: params.bodyCultivation.lifespanStartDays,
    bodyFoundation: 0,
    endurance: 0,
    willpower: 0,
    pillPoison: 0,
    heavenDebt: 0,
    daoAttention: 0,
    pressure: params.cultivationRun.startPressure,
    mortalHeart: params.cultivationRun.startMortalHeart,
    insight: 0,
    injury: 0,
    herbs: 0,
    food: params.cultivationRun.startFood,
    spiritStones: 0,
    pills: 0,
    ...options.overrides
  };
  state.pressure = clampInt(state.pressure, 0, params.cultivationRun.pressureCap);
  state.mortalHeart = clampInt(state.mortalHeart, 0, params.cultivationRun.mortalHeartCap);
  state.injury = clampInt(state.injury, 0, params.cultivationRun.injuryCap);
  state.pillPoison = clampInt(state.pillPoison, 0, params.pillPoison.cap * 1000);
  state.status = state.lifespanRemainingDays <= 0 ? 'lifespan-ended' : state.status;
  return state;
}

export function cultivationRunStateError(state: CultivationRunState, params: BalanceParams = DEFAULT_BALANCE): string | null {
  const resolved = withDefaultBalanceParams(params);
  if (!Number.isInteger(state.seed) || !Number.isInteger(state.stage) || state.stage < 0 || state.stage > CULTIVATION_RUN_MAX_STAGE) return 'stage-or-seed';
  for (const key of NON_NEGATIVE_KEYS) {
    const value = state[key];
    if (!Number.isInteger(value) || value < 0) return key;
  }
  if (!Number.isInteger(state.pressure) || state.pressure < 0 || state.pressure > resolved.cultivationRun.pressureCap) return 'pressure';
  if (!Number.isInteger(state.mortalHeart) || state.mortalHeart < 0 || state.mortalHeart > resolved.cultivationRun.mortalHeartCap) return 'mortalHeart';
  if (!Number.isInteger(state.injury) || state.injury < 0 || state.injury > resolved.cultivationRun.injuryCap) return 'injury';
  if (state.pillPoison > resolved.pillPoison.cap * 1000) return 'pillPoison';
  if (state.status === 'active' && state.lifespanRemainingDays <= 0) return 'active-without-lifespan';
  if (state.status === 'lifespan-ended' && state.lifespanRemainingDays !== 0) return 'ended-with-lifespan';
  if (state.status === 'ascended' && state.stage !== CULTIVATION_RUN_MAX_STAGE) return 'ascended-before-final-stage';
  return null;
}

export function agendaTimeCostDays(agenda: CultivationAgenda, params: BalanceParams = DEFAULT_BALANCE): number {
  return agenda.slots.reduce((sum, activity) => sum + activityTimeCostDays(activity, params), 0);
}

export function resolveCultivationAgenda(
  state: CultivationRunState,
  agenda: CultivationAgenda,
  params: BalanceParams = DEFAULT_BALANCE,
  context: CultivationAgendaContext = {}
): CultivationAgendaResolution {
  const resolved = withDefaultBalanceParams(params);
  const original = cloneCultivationRunState(state);
  if (cultivationRunStateError(state, resolved)) {
    return { ok: false, state: original, slots: [], error: { code: 'invalid-state', slotIndex: null, activity: null } };
  }
  if (state.status !== 'active') {
    return { ok: false, state: original, slots: [], error: { code: 'run-ended', slotIndex: null, activity: null } };
  }
  if (agenda.slots.length !== resolved.cultivationRun.slotsPerAgenda) {
    return { ok: false, state: original, slots: [], error: { code: 'invalid-slot-count', slotIndex: null, activity: null } };
  }

  let working = cloneCultivationRunState(state);
  const slotResults = [];
  let previous: CultivationActivityId | null = null;
  let consecutiveCount = 0;

  for (let slotIndex = 0; slotIndex < agenda.slots.length; slotIndex++) {
    const activity = agenda.slots[slotIndex]!;
    consecutiveCount = activity === previous ? consecutiveCount + 1 : 1;
    const result = resolveCultivationActivity(
      working,
      activity,
      consecutiveCount,
      slotIndex,
      resolved,
      context.insightEffectTags
    );
    if (!result.ok || !result.resolution) {
      return {
        ok: false,
        state: original,
        slots: [],
        error: { code: result.error ?? 'invalid-state', slotIndex, activity }
      };
    }
    working = result.state;
    slotResults.push(result.resolution);
    previous = activity;
  }

  working.agendaIndex += 1;
  return { ok: true, state: working, slots: slotResults };
}
