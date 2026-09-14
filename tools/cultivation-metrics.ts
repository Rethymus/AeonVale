/**
 * 修途版 m5 健康指标（docs/32 §10 锁定项）。
 *
 * 基于 tests/replay/cultivation-harness 的同一确定性 sim 链路
 * （agenda → event → insight → preparation → createPuzzle → session →
 * settlement → epitaph → heir），做多种子全生命周期蒙特卡洛，聚合：
 *   - 终局分布（ascended / tribulation-ended / lifespan-ended / 代数封顶）
 *   - 死因分布（tribulation-overload / tribulation-timeout / lifespan-ended）
 *   - 渡劫结果分布（perfect / survived / insufficient / overload / timeout）
 *   - 换代代数与最高境界分布
 *
 * 渡劫策略 = solver 最优解（"天机代打"代理）；日程策略三型（balanced /
 * herbalist / ascetic，按境界解锁替换）。无 Math.random/Date.now：所有
 * 派生选择走注入 Rng 命名流，(seed, policy) ⇒ 完全可复现。
 *
 * 用法：node node_modules/tsx/dist/cli.mjs tools/cultivation-metrics.ts
 *       [--seeds 8] [--generations 4] [--policy all] [--check]
 * --check：与 CALIBRATED_BANDS（真实数据校准）比对，出带即 exit 1。
 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { Rng } from '@sim/core/rng';
import {
  CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA,
  CULTIVATION_INSIGHT_NODE_IDS,
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

export type PolicyId = 'balanced' | 'herbalist' | 'ascetic' | 'hybrid';

/** 每次引劫前的日程轮数（与 app 层 presenter 常量一致的值，纯 sim 驱动不复用 app 代码）。 */
const AGENDA_ROUNDS_PER_TRIBULATION = 2;
const SLOTS_PER_AGENDA = 6;
const MAX_ROUNDS_PER_LIFE = 24;
const MAX_TRIBULATIONS_PER_LIFE = 12;

const POLICY_TEMPLATES: Readonly<Record<PolicyId, readonly CultivationActivityId[]>> = {
  balanced: ['farming', 'farming', 'livelihood', 'rest', 'alchemy', 'insight'],
  herbalist: ['farming', 'farming', 'farming', 'rest', 'alchemy', 'farming'],
  ascetic: ['training', 'farming', 'livelihood', 'rest', 'training', 'meridian'],
  // docs/32 §14：训练+丹道混合型——体魄与护持丹药同步成型，冲击飞升路径的代理。
  hybrid: ['training', 'training', 'training', 'alchemy', 'farming', 'rest']
};

/** 境界未解锁的槽位替换为低阶通用活动（保持模板节奏与自持性）。 */
function policySlots(policy: PolicyId, stage: number, rng: Rng, food = Infinity, herbs = Infinity): CultivationActivityId[] {
  const template = POLICY_TEMPLATES[policy];
  const unlock: Record<string, number> = {
    training: 0, farming: 0, livelihood: 0, rest: 0,
    alchemy: 1, insight: 2, meridian: 3, arrayStudy: 4, lightningBath: 5, heavenTheft: 6
  };
  const slots = Array.from({ length: SLOTS_PER_AGENDA }, (_, i) => {
    const activity = template[i % template.length]!;
    if (stage >= (unlock[activity] ?? 0)) return activity;
    const fallback: CultivationActivityId[] = ['farming', 'livelihood', 'rest'];
    return fallback[rng.intRange(0, fallback.length - 1)]!;
  });
  // 资源自适应（确定性：纯状态读）：食物见底换下一格苦练为灵田；灵草不足换
  // 下一格炼丹为灵田——防饿死/断草卡局，等价真人的保底调度。
  if (food < 8) {
    const idx = slots.indexOf('training');
    if (idx >= 0) slots[idx] = 'farming';
  }
  if (herbs < 2) {
    const idx = slots.indexOf('alchemy');
    if (idx >= 0) slots[idx] = 'farming';
  }
  return slots;
}

function solverOptimalActions(session: TribulationSessionState, inventoryPills: number): readonly TribulationSessionAction[] {
  const solution = solveBoard(session.puzzle.board, session.puzzle.player, { maxMoves: session.puzzle.moveBudget });
  if (!solution) return [];
  const actions: TribulationSessionAction[] = [];
  // 代理写实：有护持充能且包裹里有实体丹时开局开盾（tag 充能不含丹——结算消耗
  // 护脉丹实体，无丹开盾会让结算陷入 invalid-consumption 死局；真人同样不会开）。
  if (session.wardChargesRemaining > 0 && !session.wardEnabled && inventoryPills >= 1) actions.push({ type: 'set-ward', enabled: true });
  for (const dir of solution.moves) actions.push({ type: 'move', dir });
  return actions;
}

interface TribulationRecord {
  readonly result: string;
  readonly settlementKind: string;
  readonly stage: number;
}

export interface LifeOutcome {
  readonly finalStatus: string;
  readonly deathCause: string | null;
  readonly maxStage: number;
  readonly generations: number;
  readonly tribulations: readonly TribulationRecord[];
}

type RecordStep = (label: string) => void;

function runTribulation(
  state: CultivationRunState,
  params: BalanceParams,
  salt: number,
  tribulationTags: readonly string[],
  effectTags: readonly CultivationInsightEffectTag[],
  note: RecordStep
): { session: TribulationSessionState; settlement: Extract<ApplyCultivationTribulationOutcomeResult, { ok: true }> } | null {
  const tagEffects = interpretCultivationTribulationTags([...tribulationTags, ...effectTags]);
  const preparation = deriveTribulationPreparation(state, tagEffects.preparationModifiers, params);
  const basePuzzle = createPuzzle(state.stage, salt, undefined, {
    requiredBlockKinds: preparation.unlockedBlockKinds
  });
  const placement = applyPreparationToPuzzle(basePuzzle, preparation, tagEffects.boardModifierTags);
  let session = createTribulationSession(placement.state, preparation, params);
  const scripted = solverOptimalActions(session, state.pills);
  note(`tribulation:stage-${state.stage}:moves-${scripted.length}`);
  for (const action of scripted) {
    if (session.outcome !== null) break;
    session = transitionTribulationSession(session, action, params).state;
  }
  if (!session.outcome) {
    if (process.env.CM_DEBUG) {
      console.error(`[cm-debug] unsolved: stage=${state.stage} salt=${salt} budget=${session.puzzle.moveBudget} moves=${scripted.length} ward=${session.wardChargesRemaining}`);
    }
    return null; // solver 未在预算内解出（策略能力外的板）
  }
  const preparedHerbsScorched = placement.inventoryHerbIndices.filter(index => session.puzzle.scorched[index]).length;
  const settlement = applyCultivationTribulationOutcome(
    { state, outcome: session.outcome, preparedHerbsScorched },
    params
  );
  if (!settlement.ok) {
    if (process.env.CM_DEBUG) {
      console.error(`[cm-debug] settlement rejected: stage=${state.stage} result=${session.outcome!.result} code=${settlement.error} pills=${state.pills} pillsConsumed=${session.outcome.pillsConsumed.length} wardEnabled=${session.wardEnabled} wardCharges=${session.wardChargesRemaining} prepWard=${preparation.wardCharges} salt=${salt} tags=${JSON.stringify([...tribulationTags])}`);
    }
    return null;
  }
  return { session, settlement };
}

export function runLife(seed: number, policy: PolicyId, params: BalanceParams, maxGenerations: number): LifeOutcome {
  const tribulations: TribulationRecord[] = [];
  let generations = 0;
  let finalStatus = 'generations-capped';
  let deathCause: string | null = null;
  let maxStage = 0;
  let lifeIndex = 0;
  let insufficientStreak = 0;

  let state: CultivationRunState | null = null;

  outer: while (lifeIndex < maxGenerations) {
    if (state === null) {
      state = createCultivationRunState({ seed, params });
    }
    generations += 1;
    lifeIndex += 1;
    const rng = new Rng(`cultivation-metrics:${policy}:${seed}:${lifeIndex}`);
    const activityCounts: Partial<Record<CultivationActivityId, number>> = {};
    const historyTags: CultivationEventHistoryTag[] = [];
    const tribulationTagPool: string[] = [];
    let unlockedNodeIds: readonly CultivationInsightNodeId[] = [];
    let effectTags: readonly CultivationInsightEffectTag[] = [];

    for (let round = 0; round < MAX_ROUNDS_PER_LIFE; round++) {
      if (state.status !== 'active') break;

      // 两轮六格日程（每次引劫前），失败先降级全歇息、再失败按余寿尽处理。
      let planned = true;
      for (let agendaRound = 0; agendaRound < AGENDA_ROUNDS_PER_TRIBULATION; agendaRound++) {
        const slots = policySlots(policy, state.stage, rng, state.food, state.herbs);
        if (process.env.CM_DEBUG) console.error(`[cm] slots life=${lifeIndex}: ${slots.join(",")}`);
        let resolution = resolveCultivationAgenda(state, { slots }, params, { insightEffectTags: effectTags });
        if (!resolution.ok) {
          const fallbackSlots = Array.from({ length: SLOTS_PER_AGENDA }, () => 'rest' as CultivationActivityId);
          resolution = resolveCultivationAgenda(state, { slots: fallbackSlots }, params, { insightEffectTags: effectTags });
        }
        if (!resolution.ok || resolution.state.status === 'lifespan-ended') {
          planned = false;
          state = resolution.ok ? resolution.state : state;
          break;
        }
        state = resolution.state;
        for (const slot of slots) activityCounts[slot] = (activityCounts[slot] ?? 0) + 1;
      }
      if (process.env.CM_DEBUG) console.error(`[cm] life=${lifeIndex} round=${round} planned=${planned} status=${state.status} stage=${state.stage} food=${state.food} herbs=${state.herbs} pills=${state.pills} lifespan=${state.lifespanRemainingDays}`);
      if (!planned || state.status === 'lifespan-ended') {
        // 规划被卡 = 余寿/资源枯竭（app 层「封卷归灰」语义）：走传承换代续世。
        deathCause = 'lifespan-ended';
        finalStatus = state.status === 'lifespan-ended' ? 'lifespan-ended' : 'planning-blocked';
        maxStage = Math.max(maxStage, state.stage);
        const epitaph = createCultivationAshEpitaph({
          identity: { name: `metrics-life-${seed}-${lifeIndex}`, portraitId: 'portrait:metrics-life' },
          highestStage: state.stage,
          conclusion: { kind: 'death', cause: 'lifespan-ended' },
          activityCounts: activityCounts as CultivationActivityCounts,
          eventHistoryTags: historyTags,
          unlockedKnowledgeNodeIds: unlockedNodeIds,
          herbsScorched: 0,
          herbsPreserved: state.herbs,
          representativeHerb: 'conductive-moss'
        });
        const candidates = deriveCultivationLegacyCandidates(epitaph);
        const knowledge = candidates.knowledge[0];
        const relic = candidates.relics[0];
        if (!knowledge || !relic) throw new Error('legacy candidates empty; cannot transition heir');
        const heir = transitionToHeir({
          previousState: state,
          epitaph,
          selection: { knowledgeId: knowledge.id, relicId: relic.id },
          heirIdentity: { name: `metrics-heir-${seed}-${lifeIndex}`, portraitId: 'portrait:metrics-heir' },
          heirSeed: seed * 10 + lifeIndex,
          params
        });
        if (!heir.ok) throw new Error(`heir transition rejected: ${heir.error.code}`);
        state = heir.state;
        continue outer;
      }

      // 事件：ordinal/choice 走种子流，保持确定性且跨 seed 有变化。
      const ordinal = 1 + rng.intRange(0, 11);
      const event = sampleCultivationEvent(state, ordinal, params);
      if (event) {
        const choiceIndex = rng.intRange(0, 1) as 0 | 1;
        const choice = event.choices[choiceIndex];
        if (choice) {
          const resolution = resolveCultivationEventChoice(state, event.id, choice.id, params);
          if (resolution.ok) {
            state = resolution.state;
            historyTags.push(...resolution.resolution.historyTags);
            tribulationTagPool.push(...resolution.resolution.tribulationTags);
          }
        }
      }

      // 参悟：按固定顺序取首个未解锁且可负担的节点。
      if (state.insight >= 2) {
        for (const nodeId of CULTIVATION_INSIGHT_NODE_IDS) {
          if (unlockedNodeIds.includes(nodeId)) continue;
          const unlock = unlockCultivationInsightNode({
            state,
            unlockedNodeIds,
            targetNodeId: nodeId,
            budget: {
              agendaIndex: state.agendaIndex,
              unlockedThisAgenda: 0,
              maxUnlocksPerAgenda: CULTIVATION_INSIGHT_MAX_UNLOCKS_PER_AGENDA
            }
          });
          if (unlock.ok) {
            state = unlock.state;
            unlockedNodeIds = unlock.unlockedNodeIds;
            effectTags = unlock.effectTags;
            break;
          }
        }
      }

      // 引劫（solver 最优）。
      const salt = rng.intRange(0, 1_000_000);
      const ran = runTribulation(state, params, salt, tribulationTagPool, effectTags, () => undefined);
      if (process.env.CM_DEBUG && ran) console.error(`[cm] trib life=${lifeIndex} round=${round} stage=${state.stage} -> ${ran.session.outcome!.result}/${ran.settlement.settlement.kind}`);
      if (!ran) {
        // 板不可解/结算拒绝属策略外能力缺口，按"天劫悬而未决"封代记录。
        finalStatus = 'unsolvable-board';
        maxStage = Math.max(maxStage, state.stage);
        break outer;
      }
      tribulations.push({
        result: ran.session.outcome!.result,
        settlementKind: ran.settlement.settlement.kind,
        stage: state.stage
      });
      insufficientStreak = ran.settlement.settlement.kind === 'insufficient' ? insufficientStreak + 1 : 0;
      maxStage = Math.max(maxStage, state.stage);
      state = ran.settlement.state;

      if (ran.settlement.settlement.kind === 'ascended') {
        finalStatus = 'ascended';
        break outer;
      }
      if (ran.settlement.settlement.kind === 'death') {
        const cause = ran.session.outcome!.result === 'overload' ? 'tribulation-overload' : 'tribulation-timeout';
        deathCause = cause;
        finalStatus = 'tribulation-ended';
        // 劫灰传承 → 换代续世。
        const epitaph = createCultivationAshEpitaph({
          identity: { name: `metrics-life-${seed}-${lifeIndex}`, portraitId: 'portrait:metrics-life' },
          highestStage: ran.settlement.settlement.stageBefore,
          conclusion: { kind: 'death', cause: cause as 'tribulation-overload' | 'tribulation-timeout' },
          activityCounts: activityCounts as CultivationActivityCounts,
          eventHistoryTags: historyTags,
          unlockedKnowledgeNodeIds: unlockedNodeIds,
          herbsScorched: ran.settlement.settlement.herbsLost,
          herbsPreserved: state.herbs,
          representativeHerb: 'conductive-moss'
        });
        const candidates = deriveCultivationLegacyCandidates(epitaph);
        const knowledge = candidates.knowledge[0];
        const relic = candidates.relics[0];
        if (!knowledge || !relic) throw new Error('legacy candidates empty; cannot transition heir');
        const heir = transitionToHeir({
          previousState: state,
          epitaph,
          selection: { knowledgeId: knowledge.id, relicId: relic.id },
          heirIdentity: { name: `metrics-heir-${seed}-${lifeIndex}`, portraitId: 'portrait:metrics-heir' },
          heirSeed: seed * 10 + lifeIndex,
          params
        });
        if (!heir.ok) throw new Error(`heir transition rejected: ${heir.error.code}`);
        state = heir.state;
        continue outer; // 新一世
      }
      // 雷威不足墙（docs/32 §14）：连续多次 insufficient 说明体魄成长追不上
      // 该阶甜蜜区下限——代理无法换策略，收束此 campaign 而非无限磨回合。
      if (insufficientStreak >= 4) {
        finalStatus = 'insufficient-wall';
        break outer;
      }
      // breakthrough / insufficient / death-prevented：继续下一轮准备。
      if (tribulations.length >= MAX_TRIBULATIONS_PER_LIFE * lifeIndex) {
        finalStatus = 'rounds-capped';
        break outer;
      }
    }
    if (finalStatus === 'generations-capped') {
      // 内层轮数封顶仍未终局。
      finalStatus = state.status === 'active' ? 'rounds-capped' : state.status;
    }
  }

  return { finalStatus, deathCause, maxStage, generations, tribulations };
}

// ---------------------------------------------------------------------------
// 聚合
// ---------------------------------------------------------------------------

function counts(values: readonly string[]): string {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ');
}

function wilson(successes: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

/**
 * 基线带（2026-09-13 §19 新参数实施后复校准：min=6/source=125 已是 DEFAULT_BALANCE，
 * seed-start=1 × seeds=32 × 4 策略 × 换代上限 4，共 795 次渡劫 / 128 campaign）。
 * 带含义：点估计落在 [min, max] 视为健康；--check 出带 exit 1。
 * 注意：带描述「天机代打 + 四型日程」代理的策略能力锚点，不是玩家趣味目标；
 * 变更 sim 平衡参数或代理策略后必须重校准。
 */
type BandKey = 'ascensionRate' | 'overloadShare' | 'perfectShare' | 'meanGenerations' | 'maxStageMedian';

const CALIBRATED_BANDS: Readonly<Record<PolicyId, Record<BandKey, { min: number; max: number }>>> = {
  balanced: { ascensionRate: { min: 0, max: 0.05 }, overloadShare: { min: 0.95, max: 1 }, perfectShare: { min: 0, max: 0.05 }, meanGenerations: { min: 3.5, max: 4 }, maxStageMedian: { min: 0, max: 0 } },
  herbalist: { ascensionRate: { min: 0, max: 0.05 }, overloadShare: { min: 0.95, max: 1 }, perfectShare: { min: 0, max: 0.05 }, meanGenerations: { min: 3.5, max: 4 }, maxStageMedian: { min: 0, max: 0 } },
  // ascetic ascensionRate 带覆盖种子窗方差实测 59-81%。
  ascetic: { ascensionRate: { min: 0.45, max: 0.85 }, overloadShare: { min: 0.9, max: 1 }, perfectShare: { min: 0.12, max: 0.24 }, meanGenerations: { min: 1.8, max: 3.1 }, maxStageMedian: { min: 5, max: 6 } },
  hybrid: { ascensionRate: { min: 0.65, max: 0.92 }, overloadShare: { min: 0, max: 0.05 }, perfectShare: { min: 0.17, max: 0.28 }, meanGenerations: { min: 1, max: 1.3 }, maxStageMedian: { min: 5, max: 6 } }
} as const;

interface Options {
  readonly overrides: readonly { path: string; value: number }[];
  seedStart: number;
  seeds: number;
  generations: number;
  policy: PolicyId | 'all';
  check: boolean;
}

function parseOptions(args: string[]): Options {
  const overrides: { path: string; value: number }[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== '--override') continue;
    const raw = args[i + 1];
    if (!raw || !raw.includes('=')) throw new Error('--override expects path=value');
    const eq = raw.indexOf('=');
    const parsed = Number(raw.slice(eq + 1));
    if (!Number.isFinite(parsed)) throw new Error(`--override value must be numeric: ${raw}`);
    overrides.push({ path: raw.slice(0, eq), value: parsed });
  }
  const value = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const seeds = Number(value('--seeds') ?? 8);
  const seedStart = Number(value('--seed-start') ?? 1);
  const generations = Number(value('--generations') ?? 4);
  const policy = (value('--policy') ?? 'all') as PolicyId | 'all';
  if (!Number.isInteger(seeds) || seeds <= 0) throw new Error('--seeds must be a positive integer');
  if (!Number.isInteger(seedStart) || seedStart <= 0) throw new Error('--seed-start must be a positive integer');
  if (!Number.isInteger(generations) || generations <= 0) throw new Error('--generations must be a positive integer');
  if (!['balanced', 'herbalist', 'ascetic', 'hybrid', 'all'].includes(policy)) throw new Error('--policy must be balanced|herbalist|ascetic|hybrid|all');
  return { overrides, seedStart, seeds, generations, policy, check: args.includes('--check') };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const params = withDefaultBalanceParams(DEFAULT_BALANCE);
  for (const override of options.overrides) {
    const segments = override.path.split('.');
    let node: Record<string, unknown> = params as unknown as Record<string, unknown>;
    for (let i = 0; i < segments.length - 1; i++) {
      const next = node[segments[i]!];
      if (!next || typeof next !== 'object') throw new Error(`--override path invalid: ${override.path}`);
      node = next as Record<string, unknown>;
    }
    const leaf = segments.at(-1)!;
    if (!(leaf in node)) throw new Error(`--override leaf missing: ${override.path}`);
    node[leaf] = override.value;
  }
  if (options.overrides.length) {
    console.log(`参数覆盖: ${options.overrides.map(o => `${o.path}=${o.value}`).join(' · ')}`);
  }
  const policies: readonly PolicyId[] = options.policy === 'all' ? ['balanced', 'herbalist', 'ascetic', 'hybrid'] : [options.policy];

  const perPolicy = new Map<PolicyId, LifeOutcome[]>();
  for (const policy of policies) {
    const outcomes: LifeOutcome[] = [];
    for (let seed = options.seedStart; seed < options.seedStart + options.seeds; seed++) {
      outcomes.push(runLife(seed, policy, params, options.generations));
    }
    perPolicy.set(policy, outcomes);
  }

  const failures: string[] = [];
  console.log(`修途健康指标（m5 主模式版）· seeds=${options.seedStart}..${options.seedStart + options.seeds - 1} × 策略 ${[...policies].join('/')} × 换代上限 ${options.generations}`);
  console.log('渡劫策略 = solver 最优（天机代打）；日程策略按境界解锁替换；确定性：同 (seed,policy) 复跑一致。\n');

  for (const [policy, outcomes] of perPolicy) {
    const total = outcomes.length;
    const statuses = outcomes.map(o => o.finalStatus);
    const deaths = outcomes.filter(o => o.deathCause !== null).map(o => o.deathCause!);
    const tribResults = outcomes.flatMap(o => o.tribulations.map(t => t.result));
    const generationsValues = outcomes.map(o => o.generations);
    const stages = outcomes.map(o => o.maxStage);
    const ascended = statuses.filter(s => s === 'ascended').length;
    const [lo, hi] = wilson(ascended, total);
    const perfectShare = tribResults.length > 0 ? tribResults.filter(r => r === 'perfect').length / tribResults.length : 0;
    const overloadShare = deaths.length > 0 ? deaths.filter(c => c === 'tribulation-overload').length / deaths.length : 0;
    const meanGenerations = generationsValues.reduce((a, b) => a + b, 0) / Math.max(1, total);
    const stageMedian = median(stages);

    console.log(`== ${policy}（n=${total}，渡劫 ${tribResults.length} 次） ==`);
    console.log(`  终局: ${counts(statuses)}`);
    console.log(`  死因: ${deaths.length > 0 ? counts(deaths) : '无身死'}`);
    console.log(`  渡劫结果: ${counts(tribResults)}`);
    console.log(`  换代代数: mean=${meanGenerations.toFixed(2)} median=${median(generationsValues)} max=${Math.max(...generationsValues, 0)}`);
    console.log(`  最高境界: ${counts(stages.map(String))}（median=${stageMedian}）`);
    console.log(
      `  飞升率 ${((ascended / total) * 100).toFixed(1)}% Wilson[${lo.toFixed(3)}, ${hi.toFixed(3)}]｜perfect 占比 ${(perfectShare * 100).toFixed(1)}%｜overload 死因占比 ${(overloadShare * 100).toFixed(1)}%\n`
    );

    if (options.check) {
      const bands = CALIBRATED_BANDS[policy];
      const band = (name: BandKey, value: number): void => {
        const spec = bands[name];
        if (value < spec.min || value > spec.max) failures.push(`${policy}.${name}=${value.toFixed(3)} 出带 [${spec.min}, ${spec.max}]`);
      };
      band('ascensionRate', ascended / total);
      band('overloadShare', overloadShare);
      band('perfectShare', perfectShare);
      band('meanGenerations', meanGenerations);
      band('maxStageMedian', stageMedian);
    }
  }

  if (options.check) {
    if (failures.length) {
      console.log('基线带检查失败：');
      for (const failure of failures) console.log(`  - ${failure}`);
      process.exitCode = 1;
    } else {
      console.log('基线带检查通过（CALIBRATED_BANDS 见源码注释，变更平衡参数后需重校准）。');
    }
  }
}

const isDirectRun = process.argv[1] !== undefined && (process.argv[1].endsWith('cultivation-metrics.ts') || process.argv[1].endsWith('cultivation-metrics'));
if (isDirectRun) main();
