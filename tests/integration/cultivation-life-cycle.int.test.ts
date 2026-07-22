import { describe, expect, test } from 'vitest';
import {
  CULTIVATION_ACTIVITY_IDS,
  applyCultivationTribulationOutcome,
  createCultivationAshEpitaph,
  createCultivationRunState,
  deriveCultivationLegacyCandidates,
  deriveTribulationPreparation,
  interpretCultivationTribulationTags,
  resolveCultivationAgenda,
  resolveCultivationEventChoice,
  sampleCultivationEvent,
  transitionToHeir,
  unlockCultivationInsightNode,
  type CultivationActivityCounts,
  type CultivationActivityId,
  type CultivationEventDefinition,
  type CultivationRunState,
  type ResolveCultivationEventChoiceResult,
  type TribulationPreparation
} from '@sim/cultivation-run';
import { traceBeam } from '@sim/sokoban/beam';
import {
  createTribulationSession,
  transitionTribulationSession,
  TRIBULATION_SESSION_PILL_IDS,
  type TribulationSessionState
} from '@sim/sokoban/tribulation-session';
import type { BlockKind, SokobanState, Terrain } from '@sim/sokoban/types';

const LIFE_AGENDA = [
  'farming',
  'alchemy',
  'livelihood',
  'insight',
  'rest',
  'farming'
] as const satisfies readonly CultivationActivityId[];

const INVENTORY_FIELDS = ['herbs', 'food', 'spiritStones', 'pills'] as const;

type SuccessfulEventResolution = Extract<ResolveCultivationEventChoiceResult, { readonly ok: true }>;

function activityCounts(slots: readonly CultivationActivityId[]): CultivationActivityCounts {
  const counts = Object.fromEntries(CULTIVATION_ACTIVITY_IDS.map(activity => [activity, 0])) as Record<CultivationActivityId, number>;
  for (const activity of slots) counts[activity] += 1;
  return counts;
}

function chooseAffordableEvent(
  state: CultivationRunState,
  event: CultivationEventDefinition
): SuccessfulEventResolution {
  for (const choice of event.choices) {
    const result = resolveCultivationEventChoice(state, event.id, choice.id);
    if (result.ok && result.state.pills > 0) return result;
  }
  throw new Error(`No affordable event choice preserved a ward pill for ${event.id}`);
}

function buildLifeUntilTribulation(seed: number) {
  const initial = createCultivationRunState({
    seed,
    overrides: {
      stage: 2,
      lifespanRemainingDays: 720,
      bodyFoundation: 2_000,
      endurance: 1_400,
      willpower: 1_000,
      pillPoison: 5_000,
      heavenDebt: 1_200,
      daoAttention: 900,
      injury: 20,
      herbs: 10,
      food: 20,
      spiritStones: 10,
      pills: 2,
      insight: 10
    }
  });
  const initialSnapshot = { ...initial };

  const agenda = resolveCultivationAgenda(initial, { slots: LIFE_AGENDA });
  if (!agenda.ok) throw new Error(`Agenda failed: ${agenda.error.code}`);

  const event = sampleCultivationEvent(agenda.state, 0);
  if (!event) throw new Error('No event sampled for an active life');
  const eventResolution = chooseAffordableEvent(agenda.state, event);

  const insight = unlockCultivationInsightNode({
    state: eventResolution.state,
    unlockedNodeIds: [],
    targetNodeId: 'foundation-rhythm',
    budget: {
      agendaIndex: eventResolution.state.agendaIndex,
      unlockedThisAgenda: 0,
      maxUnlocksPerAgenda: 1
    }
  });
  if (!insight.ok) throw new Error(`Insight unlock failed: ${insight.error.code}`);

  const tags = [
    ...eventResolution.resolution.tribulationTags,
    ...insight.effectTags
  ];
  const tagEffects = interpretCultivationTribulationTags(tags);
  const preparation = deriveTribulationPreparation(
    insight.state,
    tagEffects.preparationModifiers
  );

  return {
    initial,
    initialSnapshot,
    agenda,
    event,
    eventResolution,
    insight,
    tagEffects,
    preparation
  };
}

/**
 * 一步把金阵石推到右上角；三枚导体把雷威抬到肉身上限以上。
 * (4,1) 的草代表本世带入的灵草，初态不会被雷路命中，终局会被烧毁。
 */
function oneMoveOverloadPuzzle(): SokobanState {
  const width = 5;
  const height = 5;
  const terrain = new Array<Terrain>(width * height).fill('empty');
  const blocks = new Array<BlockKind>(width * height).fill('none');
  terrain[0] = 'source';
  terrain[9] = 'herb';
  terrain[24] = 'body';
  blocks[3] = 'mirror';
  blocks[9] = 'conductor';
  blocks[14] = 'conductor';
  blocks[19] = 'conductor';
  const board = {
    width,
    height,
    terrain,
    blocks,
    sourcePos: { x: 0, y: 0 },
    sourceDir: 'right' as const
  };
  return {
    stage: 0,
    board,
    player: { x: 2, y: 0 },
    beam: traceBeam(board),
    scorched: new Array<boolean>(width * height).fill(false),
    herbsTotal: 1,
    moveBudget: 5,
    movesUsed: 0,
    status: 'playing'
  };
}

function resolveOverload(
  preparation: TribulationPreparation,
  wardEnabled: boolean
): TribulationSessionState {
  let session = createTribulationSession(oneMoveOverloadPuzzle(), preparation);
  if (wardEnabled) {
    const ward = transitionTribulationSession(session, { type: 'set-ward', enabled: true });
    if (!ward.ok) throw new Error(`Ward failed: ${ward.error.code}`);
    session = ward.state;
  }
  const moved = transitionTribulationSession(session, { type: 'move', dir: 'right' });
  if (!moved.ok) throw new Error(`Tribulation move failed: ${moved.error.code}`);
  if (!moved.state.outcome) throw new Error('Tribulation did not resolve after terminal move');
  return moved.state;
}

describe('D27 · 一世到后来人的纯 sim 集成', () => {
  test('日课→事件→悟道→劫死→劫灰传承可复现，后来人不继承身体与库存', () => {
    const life = buildLifeUntilTribulation(27);
    const replay = buildLifeUntilTribulation(27);

    expect(life).toEqual(replay);
    expect(life.initial).toEqual(life.initialSnapshot);
    expect(life.agenda.state.agendaIndex).toBe(1);
    expect(life.insight.unlockedNodeIds).toEqual(['foundation-rhythm']);

    for (const field of INVENTORY_FIELDS) {
      const agendaDelta = life.agenda.slots.reduce(
        (sum, slot) => sum + slot.delta[field],
        0
      );
      expect(life.agenda.state[field] - life.initial[field]).toBe(agendaDelta);
      expect(
        life.eventResolution.state[field] - life.agenda.state[field]
      ).toBe(life.eventResolution.resolution.delta[field]);
      expect(life.insight.state[field]).toBe(life.eventResolution.state[field]);
      expect(life.insight.state[field]).toBeGreaterThanOrEqual(0);
    }
    expect(life.insight.state.insight).toBe(life.eventResolution.state.insight - 2);

    const session = resolveOverload(life.preparation, false);
    const outcome = session.outcome!;
    expect(outcome).toMatchObject({
      result: 'overload',
      fatal: true,
      deathPrevented: false,
      wardConsumed: false,
      herbsScorched: 1
    });
    expect(outcome.beamPower).toBeGreaterThan(life.preparation.maxSurvivablePower);
    expect(resolveOverload(replay.preparation, false).outcome).toEqual(outcome);

    const death = applyCultivationTribulationOutcome({
      state: life.insight.state,
      outcome,
      preparedHerbsScorched: outcome.herbsScorched
    });
    expect(death.ok).toBe(true);
    if (!death.ok) return;
    expect(death.settlement.kind).toBe('death');
    expect(death.state.status).toBe('tribulation-ended');
    expect(death.state.herbs).toBe(life.insight.state.herbs - 1);
    expect(death.state.pills).toBe(life.insight.state.pills);

    const epitaph = createCultivationAshEpitaph({
      identity: { name: '前世', portraitId: 'portrait:first-life' },
      highestStage: death.settlement.stageBefore,
      conclusion: { kind: 'death', cause: 'tribulation-overload' },
      activityCounts: activityCounts(LIFE_AGENDA),
      eventHistoryTags: life.eventResolution.resolution.historyTags,
      unlockedKnowledgeNodeIds: life.insight.unlockedNodeIds,
      herbsScorched: death.settlement.herbsLost,
      herbsPreserved: death.state.herbs,
      representativeHerb: 'conductive-moss'
    });
    const candidates = deriveCultivationLegacyCandidates(epitaph);
    const knowledge = candidates.knowledge.find(
      candidate => candidate.id === 'knowledge:foundation-rhythm'
    );
    const relic = candidates.relics.find(
      candidate => candidate.id === 'relic:annotated-notebook'
    );
    expect(knowledge).toBeDefined();
    expect(relic).toBeDefined();
    if (!knowledge || !relic) return;

    const heirSeed = 2701;
    const baselineHeir = createCultivationRunState({ seed: heirSeed });
    const heir = transitionToHeir({
      previousState: death.state,
      epitaph,
      selection: { knowledgeId: knowledge.id, relicId: relic.id },
      heirIdentity: { name: '后来人', portraitId: 'portrait:heir' },
      heirSeed
    });
    expect(heir.ok).toBe(true);
    if (!heir.ok) return;

    expect(death.state).toMatchObject({
      bodyFoundation: expect.any(Number),
      endurance: expect.any(Number),
      willpower: expect.any(Number),
      pillPoison: expect.any(Number),
      injury: expect.any(Number)
    });
    expect(death.state.bodyFoundation).toBeGreaterThan(0);
    expect(death.state.endurance).toBeGreaterThan(0);
    expect(death.state.pillPoison).toBeGreaterThan(0);
    expect(heir.state).toMatchObject({
      stage: baselineHeir.stage,
      agendaIndex: baselineHeir.agendaIndex,
      status: baselineHeir.status,
      bodyFoundation: baselineHeir.bodyFoundation,
      endurance: baselineHeir.endurance,
      willpower: baselineHeir.willpower,
      pillPoison: baselineHeir.pillPoison,
      heavenDebt: baselineHeir.heavenDebt,
      daoAttention: baselineHeir.daoAttention,
      injury: baselineHeir.injury
    });

    for (const field of INVENTORY_FIELDS) {
      const fixedLegacyEffect = knowledge.startingEffect[field] + relic.startingEffect[field];
      expect(heir.state[field]).toBe(baselineHeir[field] + fixedLegacyEffect);
      expect(heir.state[field]).not.toBe(death.state[field]);
    }
    expect(heir.state.insight).toBe(
      baselineHeir.insight + knowledge.startingEffect.insight + relic.startingEffect.insight
    );
    expect(heir.legacy.inheritedKnowledgeNodeIds).toEqual(['foundation-rhythm']);
    expect(heir.legacy.predecessor).toEqual(epitaph);
  });

  test('显式护脉把同一次过载改为存活，并严格扣除一草一丹', () => {
    const life = buildLifeUntilTribulation(27);
    expect(life.preparation.wardCharges).toBeGreaterThan(0);

    const session = resolveOverload(life.preparation, true);
    const outcome = session.outcome!;
    expect(outcome).toMatchObject({
      result: 'overload',
      fatal: false,
      deathPrevented: true,
      wardConsumed: true,
      herbsScorched: 1
    });
    expect(outcome.pillsConsumed).toEqual([TRIBULATION_SESSION_PILL_IDS.ward]);
    expect(session.wardChargesRemaining).toBe(life.preparation.wardCharges - 1);

    const survived = applyCultivationTribulationOutcome({
      state: life.insight.state,
      outcome,
      preparedHerbsScorched: outcome.herbsScorched
    });
    expect(survived.ok).toBe(true);
    if (!survived.ok) return;

    expect(survived.settlement).toMatchObject({
      kind: 'death-prevented',
      herbsLost: 1,
      pillsConsumed: 1,
      stageBefore: life.insight.state.stage,
      stageAfter: life.insight.state.stage
    });
    expect(survived.state.status).toBe('active');
    expect(survived.state.herbs).toBe(life.insight.state.herbs - 1);
    expect(survived.state.pills).toBe(life.insight.state.pills - 1);
    expect(survived.state.food).toBe(life.insight.state.food);
    expect(survived.state.spiritStones).toBe(life.insight.state.spiritStones);
    expect(survived.state.injury).toBeGreaterThan(life.insight.state.injury);
  });
});
