import { describe, expect, it } from 'vitest';
import { createCultivationRunState } from '@sim/cultivation-run/agenda';
import {
  createCultivationRunMachineState,
  transitionCultivationRunMachine,
  type CultivationRunMachineAction,
  type CultivationRunMachineState
} from '@app/cultivationRun/machine';

const FULL_AGENDA = ['farming', 'training', 'rest', 'livelihood', 'insight', 'alchemy'] as const;

function fundedMachine(): CultivationRunMachineState {
  return createCultivationRunMachineState(
    createCultivationRunState({
      seed: 73,
      overrides: {
        stage: 2,
        lifespanRemainingDays: 840,
        insight: 100,
        herbs: 100,
        food: 100,
        spiritStones: 100
      }
    })
  );
}

function step(state: CultivationRunMachineState, action: CultivationRunMachineAction): CultivationRunMachineState {
  const result = transitionCultivationRunMachine(state, action);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`状态机 transition 失败：${result.error.code}`);
  return result.state;
}

function reachEvent(state = fundedMachine()): CultivationRunMachineState {
  const drafted = step(state, { type: 'set-agenda-draft', slots: FULL_AGENDA });
  const resolving = step(drafted, { type: 'submit-agenda' });
  expect(resolving.phase).toBe('schedule-resolving');
  expect(resolving.lastAgendaSlots).toHaveLength(6);
  return step(resolving, { type: 'continue-agenda-resolution' });
}

function reachInsight(state = fundedMachine()): CultivationRunMachineState {
  const eventState = reachEvent(state);
  const choiceId = eventState.currentEvent?.choices[0].id;
  if (!choiceId) throw new Error('确定性事件缺少首个选项');
  return step(eventState, { type: 'choose-event', choiceId });
}

describe('D27-c 应用层修仙状态机', () => {
  it('完成 planning→event→insight→planning，再跳过参悟进入 tribulation', () => {
    const initial = fundedMachine();
    expect(initial).toMatchObject({
      phase: 'planning',
      settledAgendaCount: 0,
      agendaDraft: [],
      currentEvent: null,
      insightNodeIds: []
    });

    const eventState = reachEvent(initial);
    expect(eventState.phase).toBe('event');
    expect(eventState.currentEvent).not.toBeNull();
    expect(eventState.settledAgendaCount).toBe(1);
    expect(eventState.runState.agendaIndex).toBe(1);
    expect(eventState.activityCounts).toEqual({
      training: 1,
      farming: 1,
      alchemy: 1,
      livelihood: 1,
      insight: 1,
      rest: 1,
      meridian: 0,
      arrayStudy: 0,
      lightningBath: 0,
      heavenTheft: 0
    });

    const choiceId = eventState.currentEvent!.choices[0].id;
    const insightState = step(eventState, { type: 'choose-event', choiceId });
    expect(insightState.phase).toBe('insight');
    expect(insightState.eventResolution).toMatchObject({
      eventId: eventState.currentEvent!.id,
      choiceId
    });
    expect(insightState.eventHistoryTags).toEqual(insightState.eventResolution!.historyTags);
    expect(insightState.tribulationTags).toEqual(insightState.eventResolution!.tribulationTags);
    expect(insightState.insightBudget).toMatchObject({ agendaIndex: 1, unlockedThisAgenda: 0 });

    const unlocked = step(insightState, { type: 'unlock-insight', targetNodeId: 'foundation-rhythm' });
    expect(unlocked.phase).toBe('insight');
    expect(unlocked.insightNodeIds).toEqual(['foundation-rhythm']);
    expect(unlocked.insightEffectTags).toEqual(['activity:training:foundation-rhythm']);
    expect(unlocked.insightBudget.unlockedThisAgenda).toBe(1);

    const timingChoice = step(unlocked, { type: 'leave-insight' });
    expect(timingChoice.phase).toBe('tribulation-choice');
    const nextPlanning = step(timingChoice, { type: 'choose-tribulation-timing', choice: 'prepare' });
    expect(nextPlanning).toMatchObject({
      phase: 'planning',
      agendaDraft: [],
      currentEvent: null,
      eventResolution: null,
      settledAgendaCount: 1
    });
    expect(nextPlanning.insightNodeIds).toEqual(['foundation-rhythm']);

    const secondEvent = reachEvent(nextPlanning);
    const secondChoiceId = secondEvent.currentEvent!.choices[0].id;
    const secondInsight = step(secondEvent, { type: 'choose-event', choiceId: secondChoiceId });
    const secondTimingChoice = step(secondInsight, { type: 'leave-insight' });
    const tribulation = step(secondTimingChoice, { type: 'choose-tribulation-timing', choice: 'invoke' });

    expect(tribulation.phase).toBe('tribulation');
    expect(tribulation.settledAgendaCount).toBe(2);
    expect(tribulation.runState.agendaIndex).toBe(2);
    expect(tribulation.insightNodeIds).toEqual(['foundation-rhythm']);
  });

  it('只完成一轮日程时允许主动引劫并累加因果债与天道注视', () => {
    const insightState = reachInsight();
    const timingChoice = step(insightState, { type: 'leave-insight' });
    const tribulation = step(timingChoice, { type: 'choose-tribulation-timing', choice: 'invoke' });

    expect(tribulation.phase).toBe('tribulation');
    expect(tribulation.runState.heavenDebt).toBeGreaterThan(insightState.runState.heavenDebt);
    expect(tribulation.runState.daoAttention).toBeGreaterThan(insightState.runState.daoAttention);
  });

  it('第二轮日课后天道催讨关闭继续准备选项', () => {
    const firstInsight = reachInsight();
    const firstChoice = step(firstInsight, { type: 'leave-insight' });
    const nextPlanning = step(firstChoice, { type: 'choose-tribulation-timing', choice: 'prepare' });
    const secondInsight = reachInsight(nextPlanning);
    const forcedChoice = step(secondInsight, { type: 'leave-insight' });
    const result = transitionCultivationRunMachine(forcedChoice, {
      type: 'choose-tribulation-timing',
      choice: 'prepare'
    });

    expect(result).toMatchObject({
      ok: false,
      state: forcedChoice,
      error: {
        code: 'preparation-window-closed',
        actionType: 'choose-tribulation-timing',
        phase: 'tribulation-choice'
      }
    });
    expect(result.state).toBe(forcedChoice);
  });

  it('一整轮都排不下时可以封卷寿终，仍够最短日程时拒绝提前结束', () => {
    const shortLife = createCultivationRunMachineState(createCultivationRunState({
      overrides: { lifespanRemainingDays: 41 }
    }));
    const ended = step(shortLife, { type: 'conclude-lifespan' });
    expect(ended).toMatchObject({
      phase: 'lifespan-ended',
      runState: { lifespanRemainingDays: 0, status: 'lifespan-ended' }
    });

    const enoughLife = createCultivationRunMachineState(createCultivationRunState({
      overrides: { lifespanRemainingDays: 42 }
    }));
    const result = transitionCultivationRunMachine(enoughLife, { type: 'conclude-lifespan' });
    expect(result).toMatchObject({
      ok: false,
      state: enoughLife,
      error: { code: 'lifespan-still-sufficient' }
    });
  });

  it('日程恰好耗尽余寿时先保留逐格结算，再进入寿终', () => {
    const exactLife = createCultivationRunMachineState(createCultivationRunState({
      overrides: {
        stage: 2,
        lifespanRemainingDays: 61,
        insight: 100,
        herbs: 100,
        food: 100,
        spiritStones: 100
      }
    }));
    const drafted = step(exactLife, { type: 'set-agenda-draft', slots: FULL_AGENDA });
    const resolving = step(drafted, { type: 'submit-agenda' });
    expect(resolving).toMatchObject({
      phase: 'schedule-resolving',
      currentEvent: null,
      runState: { lifespanRemainingDays: 0, status: 'lifespan-ended' }
    });
    const ended = step(resolving, { type: 'continue-agenda-resolution' });
    expect(ended.phase).toBe('lifespan-ended');
  });

  it('同一初态与日程产生完全相同的确定性事件状态', () => {
    const a = reachEvent(fundedMachine());
    const b = reachEvent(fundedMachine());
    expect(a).toEqual(b);
  });

  it('非法日程结算失败时保持整个 machine state 不变并透传 agenda 错误', () => {
    const drafted = step(fundedMachine(), {
      type: 'set-agenda-draft',
      slots: ['farming', 'training', 'rest', 'livelihood', 'insight']
    });
    const before = structuredClone(drafted);
    const result = transitionCultivationRunMachine(drafted, { type: 'submit-agenda' });

    expect(result).toMatchObject({
      ok: false,
      state: before,
      error: {
        code: 'agenda-resolution-failed',
        actionType: 'submit-agenda',
        phase: 'planning',
        cause: { system: 'agenda', error: { code: 'invalid-slot-count' } }
      }
    });
    expect(result.state).toBe(drafted);
    expect(drafted).toEqual(before);
  });

  it('事件选择失败时原子保留 event state 并透传 choice-not-found', () => {
    const eventState = reachEvent();
    const before = structuredClone(eventState);
    const result = transitionCultivationRunMachine(eventState, {
      type: 'choose-event',
      choiceId: 'missing-choice'
    });

    expect(result).toMatchObject({
      ok: false,
      state: before,
      error: {
        code: 'event-resolution-failed',
        cause: { system: 'event', error: { code: 'choice-not-found' } }
      }
    });
    expect(result.state).toBe(eventState);
    expect(eventState).toEqual(before);
  });

  it('参悟缺少拓扑前置时原子保留 insight state 并透传诊断', () => {
    const insightState = reachInsight();
    const before = structuredClone(insightState);
    const result = transitionCultivationRunMachine(insightState, {
      type: 'unlock-insight',
      targetNodeId: 'field-breathing'
    });

    expect(result).toMatchObject({
      ok: false,
      state: before,
      error: {
        code: 'insight-unlock-failed',
        cause: {
          system: 'insight',
          error: { code: 'missing-prerequisite', missingPrerequisiteNodeIds: ['foundation-rhythm'] }
        }
      }
    });
    expect(result.state).toBe(insightState);
    expect(insightState).toEqual(before);
  });

  it('错误 phase 的 action 被拒绝且不改写状态', () => {
    const initial = fundedMachine();
    const result = transitionCultivationRunMachine(initial, { type: 'choose-event', choiceId: 'anything' });

    expect(result).toMatchObject({
      ok: false,
      state: initial,
      error: { code: 'invalid-phase', actionType: 'choose-event', phase: 'planning', cause: null }
    });
    expect(result.state).toBe(initial);
  });
});
