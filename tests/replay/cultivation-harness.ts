/**
 * 修途主模式（D27 偷天换劫）Golden Replay harness。
 *
 * 纯 sim 层驱动一条完整生命周期，不经 DOM / app 层：
 *   createCultivationRunState → resolveCultivationAgenda（多轮六格日程，携带参悟效果标签）
 *   → sampleCultivationEvent + resolveCultivationEventChoice → unlockCultivationInsightNode
 *   → deriveTribulationPreparation（interpretCultivationTribulationTags 接线）
 *   → createPuzzle → applyPreparationToPuzzle → createTribulationSession → transitionTribulationSession
 *   → applyCultivationTribulationOutcome（两次渡劫：解盘结算 + 闲置超时身死）
 *   → createCultivationAshEpitaph → deriveCultivationLegacyCandidates → transitionToHeir（换代）。
 *
 * 确定性契约：本链路无环境随机——事件抽样是 seed/agendaIndex/ordinal 的整数哈希，
 * 棋盘生成只消费 `new Rng('sokoban:<stage>:<salt>')`；规范化 = canonicalSerialize
 * （递归排序 key + 浮点 1e-6 量化）后取 node:crypto sha256。链路中没有天然非确定字段
 * （无天象噪声、无 Date.now / Math.random），故无需像旧世界 fixture 那样清零 celestial 噪声。
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { canonicalSerialize } from '@sim/serialize';
import {
  CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA,
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
  type ApplyCultivationTribulationOutcomeResult,
  type CultivationActivityCounts,
  type CultivationActivityId,
  type CultivationEventHistoryTag,
  type CultivationInsightEffectTag,
  type CultivationInsightNodeId,
  type CultivationRunState
} from '@sim/cultivation-run';
import {
  applyPreparationToPuzzle,
  createPuzzle,
  createTribulationSession,
  solveBoard,
  transitionTribulationSession,
  type Dir,
  type TribulationSessionAction,
  type TribulationSessionState
} from '@sim/sokoban';

// ---------------------------------------------------------------------------
// Fixture schema
// ---------------------------------------------------------------------------

const number_ = z.number();

const pinnedBodyCultivationSchema = z
  .object({
    foundationCap: z.array(number_),
    pushUpGain: number_,
    sitUpGain: number_,
    squatGain: number_,
    longRunGain: number_,
    pushUpStaminaCost: number_,
    sitUpStaminaCost: number_,
    squatStaminaCost: number_,
    longRunStaminaCost: number_,
    endurancePerSet: number_,
    willpowerPerSet: number_,
    tribulationWillpowerDivisor: number_,
    heavenDebtPerInvoke: number_,
    daoAttentionPerInvoke: number_,
    lifespanStartDays: number_,
    lifespanDailyLoss: number_,
    lifespanBreakthroughGain: number_
  })
  .strict();

const pinnedTribulationSchema = z
  .object({
    baseMinTemperingPower: number_,
    stageMinTemperingPower: number_,
    willpowerPerMinPower: number_,
    baseMaxSurvivablePower: number_,
    stageMaxSurvivablePower: number_,
    bodyFoundationPerMaxPower: number_,
    endurancePerMaxPower: number_,
    injuryPerMaxPowerPenalty: number_,
    pressurePenaltyThreshold: number_,
    pressurePerMaxPowerPenalty: number_,
    minimumSafeWidth: number_,
    sweetSpotInsetMilli: number_,
    insightPerPreviewLevel: number_,
    maxPreviewLevel: number_,
    mortalHeartPerMoveBudgetBonus: number_,
    pillsPerUndoCharge: number_,
    maxUndoCharges: number_,
    maxWardCharges: number_,
    maxPreparedHerbs: number_,
    baseSourcePower: number_,
    pathCellLossMilli: number_,
    minimumPathConductivityMilli: number_,
    mirrorModifierMilli: number_,
    conductorModifierMilli: number_,
    herbHitModifierMilli: number_,
    timeoutBodyDamage: number_,
    perfectTemperingGainMultiplier: number_,
    survivedTemperingGainMultiplier: number_,
    insufficientTemperingGainMultiplier: number_
  })
  .strict();

const pinnedActivitiesSchema = z
  .object({
    training: z.object({ timeCostDays: number_, foodCost: number_, bodyFoundationGain: number_, enduranceGain: number_, willpowerGain: number_, pressureGain: number_, injuryGain: number_ }).strict(),
    farming: z.object({ timeCostDays: number_, herbGain: number_, foodGain: number_, pressureRelief: number_, mortalHeartGain: number_ }).strict(),
    alchemy: z.object({ timeCostDays: number_, herbCost: number_, pillGain: number_, insightGain: number_, poisonGain: number_, pressureGain: number_ }).strict(),
    livelihood: z.object({ timeCostDays: number_, spiritStoneGain: number_, pressureGain: number_, mortalHeartLoss: number_ }).strict(),
    insight: z.object({ timeCostDays: number_, spiritStoneCost: number_, insightGain: number_, willpowerGain: number_, pressureGain: number_ }).strict(),
    rest: z.object({ timeCostDays: number_, foodCost: number_, pressureRelief: number_, mortalHeartGain: number_, injuryRelief: number_, poisonRelief: number_ }).strict(),
    meridian: z.object({ timeCostDays: number_, foodCost: number_, bodyFoundationGain: number_, enduranceGain: number_, willpowerGain: number_, pressureGain: number_, injuryGain: number_ }).strict(),
    arrayStudy: z.object({ timeCostDays: number_, spiritStoneCost: number_, insightGain: number_, willpowerGain: number_, pressureGain: number_, mortalHeartGain: number_ }).strict(),
    lightningBath: z.object({ timeCostDays: number_, herbCost: number_, bodyFoundationGain: number_, enduranceGain: number_, willpowerGain: number_, poisonGain: number_, pressureGain: number_, injuryGain: number_, heavenDebtGain: number_, daoAttentionGain: number_ }).strict(),
    heavenTheft: z.object({ timeCostDays: number_, spiritStoneCost: number_, bodyFoundationGain: number_, willpowerGain: number_, insightGain: number_, pressureGain: number_, injuryGain: number_, heavenDebtGain: number_, daoAttentionGain: number_ }).strict()
  })
  .strict();

const pinnedCultivationRunSchema = z
  .object({
    slotsPerAgenda: number_,
    pressureCap: number_,
    mortalHeartCap: number_,
    injuryCap: number_,
    startPressure: number_,
    startMortalHeart: number_,
    startFood: number_,
    repeatSecondEfficiencyMilli: number_,
    repeatLaterEfficiencyMilli: number_,
    repeatPressureStep: number_,
    repeatInjuryStep: number_,
    pressurePenaltyThreshold: number_,
    pressurePenaltyEfficiencyMilli: number_,
    mortalHeartPressureDivisor: number_,
    tribulation: pinnedTribulationSchema,
    activities: pinnedActivitiesSchema
  })
  .strict();

const pinnedPillPoisonSchema = z
  .object({
    cap: number_,
    softCapThreshold: number_,
    decayBase: number_,
    detoxPillBonusMax: number_,
    restBonusMax: number_,
    rawEatMultBase: number_,
    rawEatMultStageSlope: number_,
    poisonResistCap: number_
  })
  .strict();

export interface CultivationReplayPinnedParams {
  readonly bodyCultivation: BalanceParams['bodyCultivation'];
  readonly cultivationRun: BalanceParams['cultivationRun'];
  readonly pillPoison: BalanceParams['pillPoison'];
}

const pinnedParamsSchema = z
  .object({
    bodyCultivation: pinnedBodyCultivationSchema,
    cultivationRun: pinnedCultivationRunSchema,
    pillPoison: pinnedPillPoisonSchema
  })
  .strict();

const activityIdSchema = z.enum([
  'training',
  'farming',
  'livelihood',
  'rest',
  'alchemy',
  'insight',
  'meridian',
  'arrayStudy',
  'lightningBath',
  'heavenTheft'
]);

const dirSchema = z.enum(['up', 'down', 'left', 'right']);

const sessionActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), dir: dirSchema }).strict(),
  z.object({ type: z.literal('undo') }).strict(),
  z.object({ type: z.literal('set-ward'), enabled: z.boolean() }).strict()
]);

const initialOverridesSchema = z
  .object({
    stage: z.number().int().min(0).max(6),
    lifespanRemainingDays: z.number().int().positive(),
    bodyFoundation: z.number().int().nonnegative(),
    endurance: z.number().int().nonnegative(),
    willpower: z.number().int().nonnegative(),
    pillPoison: z.number().int().nonnegative(),
    heavenDebt: z.number().int().nonnegative(),
    daoAttention: z.number().int().nonnegative(),
    injury: z.number().int().nonnegative(),
    herbs: z.number().int().nonnegative(),
    food: z.number().int().nonnegative(),
    spiritStones: z.number().int().nonnegative(),
    pills: z.number().int().nonnegative(),
    insight: z.number().int().nonnegative()
  })
  .strict();

const planSchema = z
  .object({
    seed: z.number().int().positive(),
    heirSeed: z.number().int().positive(),
    lifeIdentity: z.object({ name: z.string().min(1), portraitId: z.string().min(1) }).strict(),
    heirIdentity: z.object({ name: z.string().min(1), portraitId: z.string().min(1) }).strict(),
    initialOverrides: initialOverridesSchema,
    agendas: z.array(z.array(activityIdSchema).min(1)).min(2),
    eventChoices: z.array(z.object({ ordinal: z.number().int().nonnegative(), choiceIndex: z.union([z.literal(0), z.literal(1)]) }).strict()),
    insightTargets: z.array(z.string().min(1)),
    legacySelection: z.object({ knowledgeId: z.string().min(1), relicId: z.string().min(1) }).strict(),
    puzzleSalts: z.array(z.number().int().nonnegative()).length(2),
    tribulationOneActions: z.array(sessionActionSchema),
    idleActionLimit: z.number().int().positive()
  })
  .strict();

const factsSchema = z
  .object({
    firstTribulationResult: z.string(),
    firstSettlementKind: z.string(),
    stageAfterFirstSettlement: z.number().int(),
    secondTribulationResult: z.string(),
    secondSettlementKind: z.string(),
    finalStatus: z.string(),
    finalStage: z.number().int(),
    heirStage: z.number().int(),
    eventIds: z.array(z.string()),
    unlockedNodeIds: z.array(z.string())
  })
  .strict();

export const cultivationReplayFixtureSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    description: z.string().min(1),
    params: pinnedParamsSchema,
    plan: planSchema,
    facts: factsSchema,
    steps: z
      .array(
        z
          .object({
            phase: z.string().min(1),
            label: z.string().min(1),
            expected: z.string().regex(/^[0-9a-f]{64}$/)
          })
          .strict()
      )
      .min(1)
  })
  .strict();

export type CultivationReplayFixture = z.infer<typeof cultivationReplayFixtureSchema>;
export type CultivationReplayPlan = CultivationReplayFixture['plan'];

/**
 * `--init` 授权前的作者计划：tribulationOneActions 为 null 时由 solver 现场推导
 * （首手 move → undo → 完整解），随后烘焙进 fixture；复放必须使用非 null 脚本。
 */
export interface CultivationReplayAuthorPlan extends Omit<CultivationReplayPlan, 'tribulationOneActions'> {
  tribulationOneActions: readonly TribulationSessionAction[] | null;
}

// ---------------------------------------------------------------------------
// Fixture I/O
// ---------------------------------------------------------------------------

const replayDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
export const cultivationFixtureDirectory = resolve(replayDir, 'fixtures', 'cultivation');
export const cultivationReplayFixturePath = resolve(cultivationFixtureDirectory, 'cultivation-run-lifecycle.replay.json');

export function loadCultivationReplayFixture(path: string = cultivationReplayFixturePath): CultivationReplayFixture {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return cultivationReplayFixtureSchema.parse(raw);
}

export function serializeCultivationReplayFixture(fixture: CultivationReplayFixture): string {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

export function writeCultivationReplayFixture(
  fixture: CultivationReplayFixture,
  path: string = cultivationReplayFixturePath
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, serializeCultivationReplayFixture(fixture));
}

// ---------------------------------------------------------------------------
// Deterministic hashing
// ---------------------------------------------------------------------------

/** 规范化状态哈希：canonicalSerialize（排序 key + 1e-6 浮点量化）→ node:crypto sha256。 */
export function cultivationSnapshotHash(value: unknown): string {
  return createHash('sha256').update(canonicalSerialize(value), 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export interface CultivationReplayStepActual {
  readonly phase: string;
  readonly label: string;
  readonly hash: string;
}

export type CultivationReplayFacts = z.infer<typeof factsSchema>;

export interface CultivationReplayRun {
  readonly steps: readonly CultivationReplayStepActual[];
  readonly facts: CultivationReplayFacts;
  /** 仅当 plan.tribulationOneActions === null（--init 授权推导）时非 null。 */
  readonly authoredTribulationOneActions: readonly TribulationSessionAction[] | null;
}

/** 第二次渡劫的闲置步序：固定方向循环，纯输入派生，禁随机。 */
const IDLE_DIR_CYCLE: readonly Dir[] = ['up', 'right', 'down', 'left'];

type RecordStep = (phase: string, label: string, snapshot: unknown) => void;

type SettledTribulation = Extract<ApplyCultivationTribulationOutcomeResult, { readonly ok: true }>;

interface TribulationRecord {
  readonly session: TribulationSessionState;
  readonly settlement: SettledTribulation;
  /** 实际执行的动作脚本（含授权推导产物）。 */
  readonly executedActions: readonly TribulationSessionAction[];
}

function describeSessionAction(action: TribulationSessionAction): string {
  if (action.type === 'move') return `move:${action.dir}`;
  if (action.type === 'undo') return 'undo';
  return `set-ward:${action.enabled ? 'on' : 'off'}`;
}

function authorSolvedActionScript(session: TribulationSessionState): readonly TribulationSessionAction[] {
  const solution = solveBoard(session.puzzle.board, session.puzzle.player, { maxMoves: session.puzzle.moveBudget });
  if (!solution || solution.moves.length === 0) {
    throw new Error('tribulation-1: prepared board has no certified solution');
  }
  // 第一手后插入一次 undo：钉住撤步、丹药折算与快照回滚链路，再重走完整解。
  const authored: TribulationSessionAction[] = [
    { type: 'move', dir: solution.moves[0]! },
    { type: 'undo' }
  ];
  for (const dir of solution.moves) authored.push({ type: 'move', dir });
  return authored;
}

function runTribulationPhase(
  state: CultivationRunState,
  params: BalanceParams,
  salt: number,
  phasePrefix: string,
  actions: readonly TribulationSessionAction[] | null,
  modifierTags: readonly string[] | null,
  record: RecordStep
): TribulationRecord {
  const tagEffects = modifierTags === null
    ? { preparationModifiers: {}, boardModifierTags: [] as readonly string[], ignoredTags: [] as readonly string[] }
    : interpretCultivationTribulationTags(modifierTags);
  const preparation = deriveTribulationPreparation(state, tagEffects.preparationModifiers, params);
  record('derive-preparation', `${phasePrefix}:derive-preparation`, preparation);

  const basePuzzle = createPuzzle(state.stage, salt);
  record('create-puzzle', `${phasePrefix}:create-puzzle:stage-${state.stage}:salt-${salt}`, basePuzzle);

  const placement = applyPreparationToPuzzle(basePuzzle, preparation, tagEffects.boardModifierTags);
  record(
    'apply-preparation',
    `${phasePrefix}:apply-preparation`,
    {
      state: placement.state,
      preparedHerbIndices: placement.preparedHerbIndices,
      inventoryHerbIndices: placement.inventoryHerbIndices,
      eventHerbIndices: placement.eventHerbIndices,
      placedBlockKinds: placement.placedBlockKinds,
      appliedBoardModifierTags: placement.appliedBoardModifierTags,
      ignoredBoardModifierTags: placement.ignoredBoardModifierTags
    }
  );

  let session = createTribulationSession(placement.state, preparation, params);
  record('create-session', `${phasePrefix}:create-session`, session);

  let scripted: readonly TribulationSessionAction[];
  if (actions !== null) {
    scripted = actions;
  } else if (phasePrefix === 'tribulation-1') {
    scripted = authorSolvedActionScript(session);
  } else {
    throw new Error(`${phasePrefix}: null action script is only allowed for tribulation-1 authoring`);
  }

  for (let index = 0; index < scripted.length; index++) {
    if (session.outcome !== null) break; // session 已终局，后续动作都是无效空转，不记录
    const action = scripted[index]!;
    const transition = transitionTribulationSession(session, action, params);
    session = transition.state;
    const transitionError = transition.ok ? null : transition.error;
    record(
      'session-action',
      `${phasePrefix}:action-${index + 1}:${describeSessionAction(action)}:${transitionError === null ? 'ok' : `rejected-${transitionError.code}`}`,
      { ok: transition.ok, error: transitionError, state: session }
    );
  }
  if (!session.outcome) throw new Error(`${phasePrefix}: action script left the session unresolved`);

  const preparedHerbsScorched = placement.inventoryHerbIndices.filter(index => session.puzzle.scorched[index]).length;
  const settlement = applyCultivationTribulationOutcome({ state, outcome: session.outcome, preparedHerbsScorched }, params);
  if (!settlement.ok) throw new Error(`${phasePrefix}: settlement rejected: ${settlement.error}`);
  record(
    'settlement',
    `${phasePrefix}:settlement:${settlement.settlement.kind}`,
    { state: settlement.state, settlement: settlement.settlement, outcome: session.outcome }
  );
  return { session, settlement, executedActions: scripted };
}

export function runCultivationReplayPlan(plan: CultivationReplayAuthorPlan, params: BalanceParams): CultivationReplayRun {
  const steps: CultivationReplayStepActual[] = [];
  const record: RecordStep = (phase, label, snapshot) => {
    steps.push({ phase, label, hash: cultivationSnapshotHash(snapshot) });
  };

  let state = createCultivationRunState({ seed: plan.seed, params, overrides: plan.initialOverrides });
  record('create-run', 'create-run', state);

  const activityCounts: Partial<Record<CultivationActivityId, number>> = {};
  const historyTags: CultivationEventHistoryTag[] = [];
  const tribulationTagPool: string[] = [];
  const eventIds: string[] = [];
  let unlockedNodeIds: readonly CultivationInsightNodeId[] = [];
  let effectTags: readonly CultivationInsightEffectTag[] = [];

  const rounds = Math.max(plan.agendas.length, plan.eventChoices.length, plan.insightTargets.length);
  for (let round = 0; round < rounds; round++) {
    const agendaSlots = plan.agendas[round];
    if (agendaSlots) {
      const resolution = resolveCultivationAgenda(state, { slots: agendaSlots }, params, { insightEffectTags: effectTags });
      if (!resolution.ok) throw new Error(`agenda-${round + 1} rejected: ${resolution.error.code}@${resolution.error.slotIndex}`);
      state = resolution.state;
      for (const slot of agendaSlots) activityCounts[slot] = (activityCounts[slot] ?? 0) + 1;
      record('agenda', `agenda-${round + 1}`, { state, slots: resolution.slots });
    }

    const eventChoice = plan.eventChoices[round];
    if (eventChoice) {
      const event = sampleCultivationEvent(state, eventChoice.ordinal, params);
      if (!event) throw new Error(`event-${round + 1}: no candidate sampled`);
      const choice = event.choices[eventChoice.choiceIndex];
      if (!choice) throw new Error(`event-${round + 1}: choice index out of range`);
      const eventResolution = resolveCultivationEventChoice(state, event.id, choice.id, params);
      if (!eventResolution.ok) throw new Error(`event-${round + 1} ${event.id}/${choice.id} rejected: ${eventResolution.error.code}`);
      state = eventResolution.state;
      eventIds.push(event.id);
      historyTags.push(...eventResolution.resolution.historyTags);
      tribulationTagPool.push(...eventResolution.resolution.tribulationTags);
      record('event', `event-${round + 1}:${event.id}:${choice.id}`, { state, resolution: eventResolution.resolution });
    }

    const insightTarget = plan.insightTargets[round];
    if (insightTarget) {
      const unlock = unlockCultivationInsightNode({
        state,
        unlockedNodeIds,
        targetNodeId: insightTarget,
        budget: {
          agendaIndex: state.agendaIndex,
          unlockedThisAgenda: 0,
          maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
        }
      });
      if (!unlock.ok) throw new Error(`insight-${round + 1} ${insightTarget} rejected: ${unlock.error.code}`);
      state = unlock.state;
      unlockedNodeIds = unlock.unlockedNodeIds;
      effectTags = unlock.effectTags;
      record('insight', `insight-${round + 1}:${insightTarget}`, { state, unlockedNodeIds, effectTags, budget: unlock.budget });
    }
  }

  // 第一次渡劫：真实解盘，结算必须非致命，生命继续（breakthrough / insufficient / death-prevented）。
  const first = runTribulationPhase(
    state,
    params,
    plan.puzzleSalts[0]!,
    'tribulation-1',
    plan.tribulationOneActions,
    [...tribulationTagPool, ...effectTags],
    record
  );
  if (first.settlement.settlement.kind === 'death') {
    throw new Error('tribulation-1 resolved fatally; lifecycle plan expects a survivable first tribulation');
  }
  state = first.settlement.state;

  // 第二次渡劫：固定方向循环闲置到步数预算耗尽（timeout 致命）→ 身死进入传承。
  const idleActions: TribulationSessionAction[] = [];
  for (let index = 0; index < plan.idleActionLimit; index++) {
    idleActions.push({ type: 'move', dir: IDLE_DIR_CYCLE[index % IDLE_DIR_CYCLE.length]! });
  }
  const second = runTribulationPhase(state, params, plan.puzzleSalts[1]!, 'tribulation-2', idleActions, null, record);
  if (second.settlement.settlement.kind !== 'death') {
    throw new Error(`tribulation-2 settled as ${second.settlement.settlement.kind}; lifecycle plan expects timeout death`);
  }
  state = second.settlement.state;

  // 劫灰传承：碑记 → 候选 → 选定知识/遗物 → 换代。
  const epitaph = createCultivationAshEpitaph({
    identity: plan.lifeIdentity,
    highestStage: second.settlement.settlement.stageBefore,
    conclusion: { kind: 'death', cause: 'tribulation-timeout' },
    activityCounts: activityCounts as CultivationActivityCounts,
    eventHistoryTags: historyTags,
    unlockedKnowledgeNodeIds: unlockedNodeIds,
    herbsScorched: first.settlement.settlement.herbsLost + second.settlement.settlement.herbsLost,
    herbsPreserved: state.herbs,
    representativeHerb: 'conductive-moss'
  });
  record('epitaph', 'epitaph', epitaph);

  const candidates = deriveCultivationLegacyCandidates(epitaph);
  record('legacy-candidates', 'legacy-candidates', candidates);

  const heir = transitionToHeir({
    previousState: state,
    epitaph,
    selection: plan.legacySelection,
    heirIdentity: plan.heirIdentity,
    heirSeed: plan.heirSeed,
    params
  });
  if (!heir.ok) throw new Error(`heir transition rejected: ${heir.error.code}`);
  record(
    'heir',
    'heir',
    {
      state: heir.state,
      heirIdentity: heir.legacy.heirIdentity,
      selectedKnowledgeId: heir.legacy.selectedKnowledge.id,
      selectedRelicId: heir.legacy.selectedRelic.id,
      inheritedKnowledgeNodeIds: heir.legacy.inheritedKnowledgeNodeIds
    }
  );

  return {
    steps,
    facts: {
      firstTribulationResult: first.session.outcome!.result,
      firstSettlementKind: first.settlement.settlement.kind,
      stageAfterFirstSettlement: first.settlement.settlement.stageAfter,
      secondTribulationResult: second.session.outcome!.result,
      secondSettlementKind: second.settlement.settlement.kind,
      finalStatus: state.status,
      finalStage: state.stage,
      heirStage: heir.state.stage,
      eventIds,
      unlockedNodeIds: [...unlockedNodeIds]
    },
    authoredTribulationOneActions: plan.tribulationOneActions === null ? first.executedActions : null
  };
}

export function resolveCultivationReplayParams(pinned: CultivationReplayPinnedParams): BalanceParams {
  return withDefaultBalanceParams({
    ...DEFAULT_BALANCE,
    bodyCultivation: pinned.bodyCultivation,
    cultivationRun: pinned.cultivationRun,
    pillPoison: pinned.pillPoison
  });
}

export function runCultivationReplayFixture(fixture: CultivationReplayFixture): CultivationReplayRun {
  return runCultivationReplayPlan(fixture.plan, resolveCultivationReplayParams(fixture.params));
}

// ---------------------------------------------------------------------------
// Authoring（仅供 tools/update-cultivation-replay.ts --init）
// ---------------------------------------------------------------------------

export const CULTIVATION_LIFECYCLE_AUTHOR_PLAN: CultivationReplayAuthorPlan = {
  seed: 20260905,
  heirSeed: 20260907,
  lifeIdentity: { name: '回放前世', portraitId: 'portrait:replay-life' },
  heirIdentity: { name: '回放后来人', portraitId: 'portrait:replay-heir' },
  initialOverrides: {
    stage: 2,
    lifespanRemainingDays: 640,
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
    pills: 4,
    insight: 3
  },
  agendas: [
    ['farming', 'farming', 'alchemy', 'livelihood', 'insight', 'rest'],
    ['training', 'farming', 'livelihood', 'insight', 'rest', 'rest'],
    ['farming', 'farming', 'farming', 'rest', 'livelihood', 'rest']
  ],
  eventChoices: [
    // 事件抽样是 seed/agendaIndex/ordinal 的整数哈希：两轮 ordinal=5 均落在天象事件，
    // 让事件 tribulationTags（starting-herb:thunder / preview-level / source-power）真实进入引劫准备与棋盘落位。
    { ordinal: 5, choiceIndex: 1 },
    { ordinal: 5, choiceIndex: 1 }
  ],
  insightTargets: ['foundation-rhythm', 'field-breathing'],
  legacySelection: { knowledgeId: 'knowledge:foundation-rhythm', relicId: 'relic:annotated-notebook' },
  puzzleSalts: [11, 29],
  tribulationOneActions: null,
  idleActionLimit: 512
};

/** 从作者计划生成完整 fixture（含烘焙的第一劫动作脚本、事实与逐步哈希）。 */
export function authorCultivationReplayFixture(): CultivationReplayFixture {
  const pinned: CultivationReplayPinnedParams = {
    bodyCultivation: structuredClone(DEFAULT_BALANCE.bodyCultivation),
    cultivationRun: structuredClone(DEFAULT_BALANCE.cultivationRun),
    pillPoison: structuredClone(DEFAULT_BALANCE.pillPoison)
  };
  const params = resolveCultivationReplayParams(pinned);

  const authored = runCultivationReplayPlan(CULTIVATION_LIFECYCLE_AUTHOR_PLAN, params);
  if (!authored.authoredTribulationOneActions) throw new Error('authoring run did not derive tribulation-1 actions');
  const bakedPlan: CultivationReplayPlan = {
    ...CULTIVATION_LIFECYCLE_AUTHOR_PLAN,
    tribulationOneActions: [...authored.authoredTribulationOneActions]
  };

  // 复跑烘焙脚本，验证与授权推导逐哈希一致（自检确定性）。
  const rerun = runCultivationReplayPlan(bakedPlan, params);
  if (
    rerun.steps.length !== authored.steps.length
    || rerun.steps.some((step, index) => step.hash !== authored.steps[index]!.hash)
  ) {
    throw new Error('authoring is not deterministic: baked action replay diverged');
  }

  return {
    schemaVersion: 1,
    id: 'cultivation-run-lifecycle-v1',
    description:
      '修途主模式（偷天换劫）纯 sim 全生命周期：三轮六格日程（含参悟效果标签反馈）→ 事件选择 ×2 → ' +
      '参悟解锁 ×2 → 引劫准备/生成/落位 → 第一次渡劫（烘焙解 + 撤步）结算 → 第二次渡劫（闲置超时）身死 → ' +
      '劫灰碑记/传承候选/换代。哈希 = canonicalSerialize 后 sha256；本链路无环境噪声，无需 celestial 清零。',
    params: pinned,
    plan: bakedPlan,
    facts: rerun.facts,
    steps: rerun.steps.map(step => ({ phase: step.phase, label: step.label, expected: step.hash }))
  };
}
