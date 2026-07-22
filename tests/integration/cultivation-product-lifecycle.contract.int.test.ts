import { describe, expect, test } from 'vitest';
import {
  createCultivationRunMachineState,
  transitionCultivationRunMachine,
  type CultivationRunMachineAction,
  type CultivationRunMachineState
} from '@app/cultivationRun/machine';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  applyCultivationTribulationOutcome,
  CULTIVATION_FINAL_STAGE,
  createCultivationAshEpitaph,
  createCultivationRunState,
  deriveCultivationLegacyCandidates,
  deriveTribulationPreparation,
  resolveCultivationProgression,
  type CultivationActivityId,
  type CultivationRunState
} from '@sim/cultivation-run';
import type { TribulationSessionOutcome } from '@sim/sokoban';

const MIXED_AGENDA = [
  'farming',
  'training',
  'rest',
  'livelihood',
  'insight',
  'alchemy'
] as const satisfies readonly CultivationActivityId[];

function step(
  state: CultivationRunMachineState,
  action: CultivationRunMachineAction
): CultivationRunMachineState {
  const result = transitionCultivationRunMachine(state, action);
  if (!result.ok) throw new Error(`${action.type} failed: ${result.error.code}`);
  return result.state;
}

function resolveAgendaToInsight(state: CultivationRunMachineState): {
  readonly eventState: CultivationRunMachineState;
  readonly insightState: CultivationRunMachineState;
} {
  const drafted = step(state, { type: 'set-agenda-draft', slots: MIXED_AGENDA });
  const resolving = step(drafted, { type: 'submit-agenda' });
  const eventState = step(resolving, { type: 'continue-agenda-resolution' });
  const choiceId = eventState.currentEvent?.choices[0].id;
  if (!choiceId) throw new Error('sampled event has no first choice');
  return {
    eventState,
    insightState: step(eventState, { type: 'choose-event', choiceId })
  };
}

function fundedFirstLife(seed = 7): CultivationRunMachineState {
  return createCultivationRunMachineState(
    createCultivationRunState({
      seed,
      overrides: {
        insight: 100,
        herbs: 100,
        food: 100,
        spiritStones: 100,
        pills: 10
      }
    })
  );
}

function perfectOutcomeFor(state: CultivationRunState): TribulationSessionOutcome {
  const preparation = deriveTribulationPreparation(state);
  const beamPower = preparation.sweetSpotMinPower;
  return {
    reachedBody: true,
    beamPower,
    result: 'perfect',
    movesUsed: 1,
    herbsScorched: 0,
    pillsConsumed: [],
    bodyDamage: 0,
    temperingGain: beamPower * DEFAULT_BALANCE.cultivationRun.tribulation.perfectTemperingGainMultiplier,
    breakdown: {
      sourcePower: beamPower,
      pathConductivityMilli: 1_000,
      arrayStoneModifierMilli: 1_000,
      herbModifierMilli: 1_000,
      eventModifierMilli: 1_000,
      beamPower
    },
    fatal: false,
    deathPrevented: false,
    wardConsumed: false
  };
}

describe('D27-f · 产品生命周期契约', () => {
  test('现有路径可从首世日程遇到确定性天象，主动继续筹备一次后进入天劫', () => {
    const opening = fundedFirstLife();
    expect(opening).toMatchObject({
      phase: 'planning',
      settledAgendaCount: 0,
      tribulationAgendaTarget: 2,
      runState: { seed: 7, stage: 0, agendaIndex: 0, status: 'active' }
    });

    const first = resolveAgendaToInsight(opening);
    expect(first.eventState.currentEvent).toMatchObject({
      id: 'purple-cloud-over-fields',
      category: 'celestial-omen'
    });
    const learned = step(first.insightState, {
      type: 'unlock-insight',
      targetNodeId: 'foundation-rhythm'
    });
    const timingChoice = step(learned, { type: 'leave-insight' });
    expect(timingChoice.phase).toBe('tribulation-choice');

    const invokedEarly = step(timingChoice, {
      type: 'choose-tribulation-timing',
      choice: 'invoke'
    });
    expect(invokedEarly.phase).toBe('tribulation');
    expect(invokedEarly.runState.heavenDebt).toBeGreaterThan(learned.runState.heavenDebt);
    expect(invokedEarly.runState.daoAttention).toBeGreaterThan(learned.runState.daoAttention);

    const continued = step(timingChoice, {
      type: 'choose-tribulation-timing',
      choice: 'prepare'
    });

    expect(continued).toMatchObject({
      phase: 'planning',
      settledAgendaCount: 1,
      runState: { stage: 0, agendaIndex: 1, status: 'active' }
    });
    expect(continued.runState.lifespanRemainingDays)
      .toBeLessThan(opening.runState.lifespanRemainingDays);
    expect(continued.eventHistoryTags).toEqual(first.insightState.eventResolution?.historyTags);
    expect(continued.tribulationTags).toEqual(first.insightState.eventResolution?.tribulationTags);

    const second = resolveAgendaToInsight(continued);
    const ready = step(second.insightState, {
      type: 'unlock-insight',
      targetNodeId: 'field-breathing'
    });
    const secondTimingChoice = step(ready, { type: 'leave-insight' });
    const tribulation = step(secondTimingChoice, {
      type: 'choose-tribulation-timing',
      choice: 'invoke'
    });

    expect(tribulation).toMatchObject({
      phase: 'tribulation',
      settledAgendaCount: 2,
      runState: { stage: 0, agendaIndex: 2, status: 'active' }
    });
    expect(tribulation.insightNodeIds).toEqual(['foundation-rhythm', 'field-breathing']);
    expect(tribulation.eventHistoryTags.length).toBeGreaterThanOrEqual(2);
  });

  test('现有纯结算可把同一世推进到第六境，并能表达飞升记录端点', () => {
    let state = fundedFirstLife().runState;
    const initialLifespan = state.lifespanRemainingDays;

    for (let expectedStage = 1; expectedStage <= CULTIVATION_FINAL_STAGE; expectedStage += 1) {
      const progression = resolveCultivationProgression(state.stage, 'tribulation-succeeded');
      expect(progression).toMatchObject({
        ok: true,
        kind: 'stage-advanced',
        terminal: false,
        stageBefore: expectedStage - 1,
        stageAfter: expectedStage
      });
      const result = applyCultivationTribulationOutcome({
        state,
        outcome: perfectOutcomeFor(state),
        preparedHerbsScorched: 0
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.settlement).toMatchObject({
        kind: 'breakthrough',
        stageBefore: expectedStage - 1,
        stageAfter: expectedStage
      });
      state = result.state;
    }

    expect(state).toMatchObject({ stage: CULTIVATION_FINAL_STAGE, status: 'active' });
    expect(state.lifespanRemainingDays).toBe(
      initialLifespan
        + CULTIVATION_FINAL_STAGE * DEFAULT_BALANCE.bodyCultivation.lifespanBreakthroughGain
    );

    const finalProgression = resolveCultivationProgression(state.stage, 'tribulation-succeeded');
    expect(finalProgression).toMatchObject({
      ok: true,
      kind: 'ascended',
      terminal: true,
      stageBefore: CULTIVATION_FINAL_STAGE,
      stageAfter: CULTIVATION_FINAL_STAGE,
      epitaphData: {
        highestStage: CULTIVATION_FINAL_STAGE,
        conclusion: { kind: 'ending', ending: 'ascended' }
      }
    });
    if (!finalProgression.ok || !finalProgression.epitaphData) return;

    const finalSettlement = applyCultivationTribulationOutcome({
      state,
      outcome: perfectOutcomeFor(state),
      preparedHerbsScorched: 0
    });
    expect(finalSettlement).toMatchObject({
      ok: true,
      state: { stage: CULTIVATION_FINAL_STAGE, status: 'ascended' },
      settlement: {
        kind: 'ascended',
        stageBefore: CULTIVATION_FINAL_STAGE,
        stageAfter: CULTIVATION_FINAL_STAGE,
        lifespanGained: 0
      }
    });

    const endingRecord = createCultivationAshEpitaph({
      identity: { name: '首世', portraitId: 'portrait:first-life' },
      ...finalProgression.epitaphData,
      eventHistoryTags: [],
      unlockedKnowledgeNodeIds: [],
      herbsScorched: 0,
      herbsPreserved: state.herbs
    });
    expect(endingRecord).toMatchObject({
      highestStage: CULTIVATION_FINAL_STAGE,
      conclusion: { kind: 'ending', ending: 'ascended' }
    });
  });

  test('日程寿尽与不足以再排一轮都进入显式终止态，并能生成劫灰事实', () => {
    const agendaDays = MIXED_AGENDA.reduce(
      (days, activity) => days + DEFAULT_BALANCE.cultivationRun.activities[activity].timeCostDays,
      0
    );
    const expiring = createCultivationRunMachineState(createCultivationRunState({
      seed: 61,
      overrides: {
        lifespanRemainingDays: agendaDays,
        insight: 10,
        herbs: 10,
        food: 10,
        spiritStones: 10
      }
    }));
    const drafted = step(expiring, { type: 'set-agenda-draft', slots: MIXED_AGENDA });
    const resolving = step(drafted, { type: 'submit-agenda' });
    expect(resolving).toMatchObject({
      phase: 'schedule-resolving',
      currentEvent: null,
      runState: { lifespanRemainingDays: 0, status: 'lifespan-ended' }
    });
    const exhausted = step(resolving, { type: 'continue-agenda-resolution' });
    expect(exhausted).toMatchObject({
      phase: 'lifespan-ended',
      runState: {
      lifespanRemainingDays: 0,
      status: 'lifespan-ended'
      }
    });

    const progression = resolveCultivationProgression(
      exhausted.runState.stage,
      'lifespan-exhausted'
    );
    expect(progression).toMatchObject({
      ok: true,
      kind: 'lifespan-ended',
      terminal: true,
      epitaphData: { conclusion: { kind: 'death', cause: 'lifespan-ended' } }
    });
    if (!progression.ok || !progression.epitaphData) return;

    const epitaph = createCultivationAshEpitaph({
      identity: { name: '寿尽者', portraitId: 'portrait:lifespan-ended' },
      ...progression.epitaphData,
      activityCounts: exhausted.activityCounts,
      eventHistoryTags: [],
      unlockedKnowledgeNodeIds: [],
      herbsScorched: 0,
      herbsPreserved: exhausted.runState.herbs
    });
    const candidates = deriveCultivationLegacyCandidates(epitaph);

    expect(epitaph.conclusion).toEqual({ kind: 'death', cause: 'lifespan-ended' });
    expect(candidates.knowledge.length).toBeGreaterThan(0);
    expect(candidates.relics.length).toBeGreaterThan(0);

    const minimumAgendaDays = DEFAULT_BALANCE.cultivationRun.slotsPerAgenda
      * Math.min(...Object.values(DEFAULT_BALANCE.cultivationRun.activities).map(activity => activity.timeCostDays));
    const stranded = createCultivationRunMachineState(createCultivationRunState({
      seed: 62,
      overrides: { lifespanRemainingDays: minimumAgendaDays - 1 }
    }));
    const concluded = step(stranded, { type: 'conclude-lifespan' });
    expect(concluded).toMatchObject({
      phase: 'lifespan-ended',
      runState: { lifespanRemainingDays: 0, status: 'lifespan-ended' }
    });
  });

});
