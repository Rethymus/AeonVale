/**
 * D27-c 应用层纯状态机。
 *
 * 只编排现有日程、事件与参悟 sim；不读取 DOM、时钟、存储，也不创建天劫棋盘。
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim/params';
import { createCultivationRunState, resolveCultivationAgenda } from '@sim/cultivation-run/agenda';
import { resolveCultivationEventChoice, sampleCultivationEvent, type CultivationEventDefinition, type CultivationEventError, type CultivationEventHistoryTag, type CultivationEventResolution, type CultivationTribulationTag } from '@sim/cultivation-run/events';
import { CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA, unlockCultivationInsightNode, type CultivationInsightAgendaBudget, type CultivationInsightEffectTag, type CultivationInsightNodeId, type CultivationInsightUnlockError } from '@sim/cultivation-run/insight';
import { CULTIVATION_ACTIVITY_IDS, type CultivationActivityId, type CultivationActivityCounts, type CultivationActivityResolution, type CultivationAgendaError, type CultivationRunState } from '@sim/cultivation-run/types';

export type CultivationRunMachinePhase =
  | 'planning'
  | 'schedule-resolving'
  | 'event'
  | 'insight'
  | 'tribulation-choice'
  | 'tribulation'
  | 'lifespan-ended';

export interface CultivationRunMachineState {
  readonly phase: CultivationRunMachinePhase;
  readonly runState: CultivationRunState;
  readonly agendaDraft: readonly CultivationActivityId[];
  readonly settledAgendaCount: number;
  readonly tribulationAgendaTarget: number;
  readonly currentEvent: CultivationEventDefinition | null;
  readonly lastAgendaSlots: readonly CultivationActivityResolution[];
  readonly activityCounts: CultivationActivityCounts;
  readonly eventResolution: CultivationEventResolution | null;
  readonly eventHistoryTags: readonly CultivationEventHistoryTag[];
  readonly tribulationTags: readonly CultivationTribulationTag[];
  readonly insightNodeIds: readonly CultivationInsightNodeId[];
  readonly insightEffectTags: readonly CultivationInsightEffectTag[];
  readonly insightBudget: CultivationInsightAgendaBudget;
}

export type CultivationRunMachineAction =
  | { readonly type: 'set-agenda-draft'; readonly slots: readonly string[] }
  | { readonly type: 'submit-agenda' }
  | { readonly type: 'continue-agenda-resolution' }
  | { readonly type: 'choose-event'; readonly choiceId: string }
  | { readonly type: 'unlock-insight'; readonly targetNodeId: string }
  | { readonly type: 'leave-insight' }
  | { readonly type: 'choose-tribulation-timing'; readonly choice: 'prepare' | 'invoke' }
  | { readonly type: 'conclude-lifespan' };

export type CultivationRunMachineErrorCode =
  | 'invalid-phase'
  | 'unknown-activity'
  | 'agenda-resolution-failed'
  | 'event-sampling-failed'
  | 'current-event-missing'
  | 'event-resolution-failed'
  | 'insight-unlock-failed'
  | 'tribulation-not-ready'
  | 'preparation-window-closed'
  | 'lifespan-still-sufficient';

export type CultivationRunMachineErrorCause = { readonly system: 'agenda'; readonly error: CultivationAgendaError } | { readonly system: 'event'; readonly error: CultivationEventError } | { readonly system: 'insight'; readonly error: CultivationInsightUnlockError };

export interface CultivationRunMachineError {
  readonly code: CultivationRunMachineErrorCode;
  readonly actionType: CultivationRunMachineAction['type'];
  readonly phase: CultivationRunMachinePhase;
  readonly cause: CultivationRunMachineErrorCause | null;
}

export type CultivationRunMachineTransition = { readonly ok: true; readonly state: CultivationRunMachineState } | { readonly ok: false; readonly state: CultivationRunMachineState; readonly error: CultivationRunMachineError };

function insightBudget(agendaIndex: number, unlockedThisAgenda = 0): CultivationInsightAgendaBudget {
  return {
    agendaIndex,
    unlockedThisAgenda,
    maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
  };
}

function emptyActivityCounts(): CultivationActivityCounts {
  return {
    training: 0,
    farming: 0,
    alchemy: 0,
    livelihood: 0,
    insight: 0,
    rest: 0
  };
}

function addAgendaActivityCounts(counts: CultivationActivityCounts, slots: readonly CultivationActivityResolution[]): CultivationActivityCounts {
  const next = { ...counts };
  for (const slot of slots) next[slot.activity] += 1;
  return next;
}

export function createCultivationRunMachineState(runState: CultivationRunState = createCultivationRunState()): CultivationRunMachineState {
  return {
    phase: 'planning',
    runState: { ...runState },
    agendaDraft: [],
    settledAgendaCount: runState.agendaIndex,
    tribulationAgendaTarget: runState.agendaIndex + 2,
    currentEvent: null,
    lastAgendaSlots: [],
    activityCounts: emptyActivityCounts(),
    eventResolution: null,
    eventHistoryTags: [],
    tribulationTags: [],
    insightNodeIds: [],
    insightEffectTags: [],
    insightBudget: insightBudget(runState.agendaIndex)
  };
}

function reject(state: CultivationRunMachineState, action: CultivationRunMachineAction, code: CultivationRunMachineErrorCode, cause: CultivationRunMachineErrorCause | null = null): CultivationRunMachineTransition {
  return {
    ok: false,
    state,
    error: { code, actionType: action.type, phase: state.phase, cause }
  };
}

function accepted(state: CultivationRunMachineState): CultivationRunMachineTransition {
  return { ok: true, state };
}

function isCultivationActivityId(value: string): value is CultivationActivityId {
  return (CULTIVATION_ACTIVITY_IDS as readonly string[]).includes(value);
}

function minimumAgendaTimeCostDays(params: BalanceParams): number {
  const minimumActivityDays = Math.min(
    ...CULTIVATION_ACTIVITY_IDS.map(activity => params.cultivationRun.activities[activity].timeCostDays)
  );
  return params.cultivationRun.slotsPerAgenda * minimumActivityDays;
}

export function transitionCultivationRunMachine(state: CultivationRunMachineState, action: CultivationRunMachineAction, params: BalanceParams = DEFAULT_BALANCE): CultivationRunMachineTransition {
  if (action.type === 'set-agenda-draft') {
    if (state.phase !== 'planning') return reject(state, action, 'invalid-phase');
    if (!action.slots.every(isCultivationActivityId)) return reject(state, action, 'unknown-activity');
    return accepted({ ...state, agendaDraft: [...action.slots] });
  }

  if (action.type === 'submit-agenda') {
    if (state.phase !== 'planning') return reject(state, action, 'invalid-phase');
    const agendaResult = resolveCultivationAgenda(state.runState, { slots: state.agendaDraft }, params, { insightEffectTags: state.insightEffectTags });
    if (!agendaResult.ok) {
      return reject(state, action, 'agenda-resolution-failed', { system: 'agenda', error: agendaResult.error });
    }
    const event = agendaResult.state.status === 'active'
      ? sampleCultivationEvent(agendaResult.state, state.settledAgendaCount, params)
      : null;
    if (agendaResult.state.status === 'active' && !event) return reject(state, action, 'event-sampling-failed');
    return accepted({
      ...state,
      phase: 'schedule-resolving',
      runState: agendaResult.state,
      settledAgendaCount: state.settledAgendaCount + 1,
      currentEvent: event,
      lastAgendaSlots: agendaResult.slots,
      activityCounts: addAgendaActivityCounts(state.activityCounts, agendaResult.slots),
      eventResolution: null
    });
  }

  if (action.type === 'continue-agenda-resolution') {
    if (state.phase !== 'schedule-resolving') return reject(state, action, 'invalid-phase');
    if (state.runState.status === 'lifespan-ended') {
      return accepted({ ...state, phase: 'lifespan-ended' });
    }
    if (!state.currentEvent) return reject(state, action, 'current-event-missing');
    return accepted({ ...state, phase: 'event' });
  }

  if (action.type === 'choose-event') {
    if (state.phase !== 'event') return reject(state, action, 'invalid-phase');
    if (!state.currentEvent) return reject(state, action, 'current-event-missing');
    const eventResult = resolveCultivationEventChoice(state.runState, state.currentEvent.id, action.choiceId, params);
    if (!eventResult.ok) {
      return reject(state, action, 'event-resolution-failed', { system: 'event', error: eventResult.error });
    }
    return accepted({
      ...state,
      phase: eventResult.state.status === 'lifespan-ended' ? 'lifespan-ended' : 'insight',
      runState: eventResult.state,
      eventResolution: eventResult.resolution,
      eventHistoryTags: [...state.eventHistoryTags, ...eventResult.resolution.historyTags],
      tribulationTags: [...state.tribulationTags, ...eventResult.resolution.tribulationTags],
      insightBudget: insightBudget(eventResult.state.agendaIndex)
    });
  }

  if (action.type === 'unlock-insight') {
    if (state.phase !== 'insight') return reject(state, action, 'invalid-phase');
    const insightResult = unlockCultivationInsightNode({
      state: state.runState,
      unlockedNodeIds: state.insightNodeIds,
      targetNodeId: action.targetNodeId,
      budget: state.insightBudget
    });
    if (!insightResult.ok) {
      return reject(state, action, 'insight-unlock-failed', { system: 'insight', error: insightResult.error });
    }
    return accepted({
      ...state,
      runState: insightResult.state,
      insightNodeIds: insightResult.unlockedNodeIds,
      insightEffectTags: insightResult.effectTags,
      insightBudget: insightResult.budget
    });
  }

  if (action.type === 'leave-insight') {
    if (state.phase !== 'insight') return reject(state, action, 'invalid-phase');
    return accepted({ ...state, phase: 'tribulation-choice' });
  }

  if (action.type === 'choose-tribulation-timing') {
    if (state.phase !== 'tribulation-choice') return reject(state, action, 'invalid-phase');
    if (action.choice === 'invoke') {
      const earliestInvocationAgenda = Math.max(1, state.tribulationAgendaTarget - 1);
      if (state.settledAgendaCount < earliestInvocationAgenda) {
        return reject(state, action, 'tribulation-not-ready');
      }
      return accepted({
        ...state,
        phase: 'tribulation',
        runState: {
          ...state.runState,
          heavenDebt: state.runState.heavenDebt + Math.max(0, Math.floor(params.bodyCultivation.heavenDebtPerInvoke)),
          daoAttention: state.runState.daoAttention + Math.max(0, Math.floor(params.bodyCultivation.daoAttentionPerInvoke))
        }
      });
    }
    if (state.settledAgendaCount >= state.tribulationAgendaTarget) {
      return reject(state, action, 'preparation-window-closed');
    }
    return accepted({
      ...state,
      phase: 'planning',
      agendaDraft: [],
      currentEvent: null,
      eventResolution: null,
      insightBudget: insightBudget(state.runState.agendaIndex)
    });
  }

  if (state.phase !== 'planning') return reject(state, action, 'invalid-phase');
  if (state.runState.lifespanRemainingDays >= minimumAgendaTimeCostDays(params)) {
    return reject(state, action, 'lifespan-still-sufficient');
  }
  return accepted({
    ...state,
    phase: 'lifespan-ended',
    runState: {
      ...state.runState,
      lifespanRemainingDays: 0,
      status: 'lifespan-ended'
    }
  });
}
