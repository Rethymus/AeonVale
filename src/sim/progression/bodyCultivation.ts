import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { createDefaultPostAscensionState } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { BalanceParams } from '@sim/params';

/** 旧存档/测试夹具补齐体修字段，保证后续计算不读到 undefined。 */
export function normalizeBodyCultivation(state: GameState, params: BalanceParams): void {
  const p = state.player;
  p.bodyFoundation = Math.max(0, p.bodyFoundation ?? 0, p.cultivation ?? 0);
  p.endurance ??= 0;
  p.willpower ??= 0;
  p.heavenDebt ??= 0;
  p.daoAttention ??= 0;
  p.lifespanRemainingDays ??= params.bodyCultivation.lifespanStartDays;
  state.tribulation ??= {
    status: 'idle',
    source: null,
    daysRemaining: 0,
    stage: 0,
    readyDays: 0,
    startedDay: null
  };
  state.tribulation.status ??= 'idle';
  state.tribulation.source ??= null;
  state.tribulation.daysRemaining ??= 0;
  state.tribulation.stage ??= 0;
  state.tribulation.readyDays ??= 0;
  state.tribulation.startedDay ??= null;
  state.postAscension ??= createDefaultPostAscensionState();
  state.postAscension.mode ??= 'none';
  state.postAscension.ascensionDay ??= null;
  state.postAscension.victoryRecorded ??= false;
}

export function isPostAscensionProgressionFrozen(state: GameState): boolean {
  return state.postAscension?.mode === 'stayed-in-world';
}

export function bodyFoundationCap(stage: number, params: BalanceParams): number {
  return params.bodyCultivation.foundationCap[stage - 1] ?? Number.POSITIVE_INFINITY;
}

export function readyToInvokeTribulation(state: GameState, params: BalanceParams): boolean {
  normalizeBodyCultivation(state, params);
  if (isPostAscensionProgressionFrozen(state)) return false;
  const { stage, bodyFoundation } = state.player;
  if (stage < 1 || stage > 6) return false;
  if (bodyFoundation < bodyFoundationCap(stage, params)) return false;
  if (stage !== 4) return true;
  return state.flags.has('purple-omen-fired') && state.activeEvent?.defId !== 'event.purple-omen';
}

function tribulationWindowDays(state: GameState, params: BalanceParams): number {
  const stagePenalty = Math.min(Math.max(0, state.player.stage - 1), 4);
  return Math.max(3, params.breakthrough.tTribBase - stagePenalty);
}

function tribulationDebtThreshold(state: GameState, params: BalanceParams): number {
  return params.bodyCultivation.heavenDebtPerInvoke * Math.max(2, state.player.stage + 1);
}

function tribulationAttentionThreshold(state: GameState, params: BalanceParams): number {
  return params.bodyCultivation.daoAttentionPerInvoke * Math.max(2, state.player.stage);
}

function tribulationLifespanWarningDays(state: GameState, params: BalanceParams): number {
  return Math.max(3, Math.min(30, tribulationWindowDays(state, params) + state.player.stage));
}

function setTribulationIdle(state: GameState): void {
  state.tribulation.status = 'idle';
  state.tribulation.source = null;
  state.tribulation.daysRemaining = 0;
  state.tribulation.stage = 0;
  state.tribulation.startedDay = null;
}

export function startTribulationCountdown(state: GameState, ctx: SimContext, source: Exclude<GameState['tribulation']['source'], null>): boolean {
  normalizeBodyCultivation(state, ctx.params);
  if (!readyToInvokeTribulation(state, ctx.params)) return false;
  if (state.tribulation.status === 'countdown' || state.tribulation.status === 'due') return false;
  const daysRemaining = tribulationWindowDays(state, ctx.params);
  state.tribulation.status = 'countdown';
  state.tribulation.source = source;
  state.tribulation.daysRemaining = daysRemaining;
  state.tribulation.stage = state.player.stage;
  state.tribulation.startedDay = state.day;
  emit(state, 'tribulation-countdown-started', {
    source,
    stage: state.player.stage,
    daysRemaining
  });
  return true;
}

export function invokeTribulation(state: GameState, ctx: SimContext): boolean {
  normalizeBodyCultivation(state, ctx.params);
  if (!readyToInvokeTribulation(state, ctx.params)) return false;
  if (state.tribulation.status === 'countdown' || state.tribulation.status === 'due') return false;
  recordTribulationInvocation(state, ctx);
  state.tribulation.readyDays = 0;
  return startTribulationCountdown(state, ctx, 'active');
}

export function shouldStartForcedTribulationCountdown(state: GameState, params: BalanceParams): Exclude<GameState['tribulation']['source'], null> | null {
  normalizeBodyCultivation(state, params);
  if (!readyToInvokeTribulation(state, params)) return null;
  if (state.tribulation.status === 'countdown' || state.tribulation.status === 'due') return null;
  if (state.player.lifespanRemainingDays <= tribulationLifespanWarningDays(state, params)) return 'lifespan';
  if (state.player.heavenDebt >= tribulationDebtThreshold(state, params)) return 'heaven-debt';
  if (state.player.daoAttention >= tribulationAttentionThreshold(state, params)) return 'dao-attention';
  if (state.tribulation.readyDays >= tribulationWindowDays(state, params)) return 'delay';
  return null;
}

export function advanceTribulationDay(state: GameState, ctx: SimContext): void {
  normalizeBodyCultivation(state, ctx.params);

  if (readyToInvokeTribulation(state, ctx.params) && state.tribulation.status === 'idle') {
    state.tribulation.readyDays += 1;
  } else if (!readyToInvokeTribulation(state, ctx.params) && state.tribulation.status === 'idle') {
    state.tribulation.readyDays = 0;
  }

  const forcedSource = shouldStartForcedTribulationCountdown(state, ctx.params);
  if (forcedSource) startTribulationCountdown(state, ctx, forcedSource);

  if (state.tribulation.status !== 'countdown') return;

  state.tribulation.daysRemaining = Math.max(0, state.tribulation.daysRemaining - 1);
  emit(state, 'tribulation-countdown-advanced', {
    source: state.tribulation.source,
    stage: state.tribulation.stage,
    daysRemaining: state.tribulation.daysRemaining
  });

  if (state.tribulation.daysRemaining > 0) return;

  state.tribulation.status = 'due';
  emit(state, 'tribulation-collection-due', {
    source: state.tribulation.source,
    stage: state.tribulation.stage
  });
}

export function clearTribulationCountdown(state: GameState): void {
  state.tribulation.readyDays = 0;
  setTribulationIdle(state);
}

/** 主动引劫即向天道暴露自身：增加因果债和天道注视。 */
export function recordTribulationInvocation(state: GameState, ctx: SimContext): void {
  normalizeBodyCultivation(state, ctx.params);
  const cfg = ctx.params.bodyCultivation;
  state.player.heavenDebt += cfg.heavenDebtPerInvoke;
  state.player.daoAttention += cfg.daoAttentionPerInvoke;
  emit(state, 'tribulation-invoked', {
    heavenDebt: state.player.heavenDebt,
    daoAttention: state.player.daoAttention
  });
}

export function advanceLifespanDay(state: GameState, ctx: SimContext): void {
  normalizeBodyCultivation(state, ctx.params);
  const p = state.player;
  p.lifespanRemainingDays -= ctx.params.bodyCultivation.lifespanDailyLoss;
  if (p.lifespanRemainingDays <= 0 && !state.gameOver) {
    p.lifespanRemainingDays = 0;
    state.ending = 'lifespan-death';
    state.gameOver = true;
    emit(state, 'ending', { ending: 'lifespan-death' });
  }
}
