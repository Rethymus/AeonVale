/**
 * 无头模拟 Harness。核心 smoke 循环与 M5 assisted campaign proxy 共用同一确定性引擎。
 *
 * M5 proxy 会明确记录所有合成的渡劫/飞升辅助；其结果不是自然玩家通关率。
 */
import { fileURLToPath } from 'node:url';
import { applyPill, checkGameEnd, createSimContext, createWorld, DEFAULT_BALANCE, resolveAscensionChoice, simulateDay, tileAt, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { DayInput, PlayerAction } from '@sim/world/input';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { breakthrough, readyForBreakthrough, stageQiCap } from '@sim/progression/progression';

export type PreparationProfile = 'none' | 'basic-assisted' | 'expert-assisted';
export type AscensionProfile = 'none' | 'pill-assisted-at-stage7';
export type ProgressionProfile = 'natural' | 'cap-assisted';
export type RecoveryProfile = 'full-before-tribulation' | 'inherit-limited';
export type RunEndReason = 'ascended' | 'tribulation-death' | 'poison-death' | 'madness' | 'other-ending' | 'timeout';

export interface BotPolicy {
  name: string;
  plotSize: number;
  seedId: string;
  careDaily: boolean;
  tribulationBolts: number;
  blockChance: number;
  huntBeasts: boolean;
  preparationProfile: PreparationProfile;
  ascensionProfile: AscensionProfile;
  progressionProfile: ProgressionProfile;
  recoveryProfile: RecoveryProfile;
  limitedRecoveryRatio: number;
}

export const ROOKIE_BOT: BotPolicy = {
  name: 'rookie',
  plotSize: 1,
  seedId: 'seed.mossling',
  careDaily: false,
  tribulationBolts: 3,
  blockChance: 0,
  huntBeasts: false,
  preparationProfile: 'none',
  ascensionProfile: 'none',
  progressionProfile: 'natural',
  recoveryProfile: 'full-before-tribulation',
  limitedRecoveryRatio: 1
};
export const NORMAL_BOT: BotPolicy = {
  name: 'normal',
  plotSize: 3,
  seedId: 'seed.mossling',
  careDaily: true,
  tribulationBolts: 3,
  blockChance: 0,
  huntBeasts: true,
  preparationProfile: 'none',
  ascensionProfile: 'none',
  progressionProfile: 'natural',
  recoveryProfile: 'full-before-tribulation',
  limitedRecoveryRatio: 1
};
/** M5 normal proxy：显式注入资源门槛与基础渡劫准备，不能作为自然玩家行为解释。 */
export const M5_NORMAL_PROXY_BOT: BotPolicy = {
  ...NORMAL_BOT,
  name: 'normal',
  preparationProfile: 'basic-assisted',
  ascensionProfile: 'pill-assisted-at-stage7',
  progressionProfile: 'cap-assisted'
};
/** M5 veteran proxy：更高擦弹率与基础辅助准备，目标是与 normal 拉开但不无敌。 */
export const M5_VETERAN_PROXY_BOT: BotPolicy = {
  ...M5_NORMAL_PROXY_BOT,
  name: 'veteran',
  plotSize: 5,
  tribulationBolts: 5,
  blockChance: 0.52
};
/** M6 校准原型：渡劫之间继承 HP，每次准备最多恢复 60% maxHP。 */
export const M5_NORMAL_HP_INHERIT_PROXY_BOT: BotPolicy = {
  ...M5_NORMAL_PROXY_BOT,
  name: 'normal-hp-inherit',
  recoveryProfile: 'inherit-limited',
  limitedRecoveryRatio: 0.6
};
/** M6 校准原型：veteran 与 normal 使用相同的有限治疗/HP 继承规则。 */
export const M5_VETERAN_HP_INHERIT_PROXY_BOT: BotPolicy = {
  ...M5_VETERAN_PROXY_BOT,
  name: 'veteran-hp-inherit',
  recoveryProfile: 'inherit-limited',
  limitedRecoveryRatio: 0.6
};
/** @deprecated Use M5_VETERAN_PROXY_BOT for assisted campaign certification. */
export const VETERAN_BOT = M5_VETERAN_PROXY_BOT;

export interface SyntheticAssistance {
  preparationEvents: number;
  ascensionPillsGranted: number;
  progressionCapsGranted: number;
  healedMilli: number;
  itemsGranted: Record<string, number>;
  arraysGranted: number;
}

export interface TribulationAttempt {
  stage: number;
  bolts: number;
  violetBolts: number;
  survived: boolean;
  finalHpRatio: number;
  temperingGainMilli: number;
}

export interface PurpleOmenTrace {
  encountered: boolean;
  triggeredDay: number | null;
  expiredDay: number | null;
  blockedBreakthroughDays: number;
  deadlocked: boolean;
  deadlockReason: string | null;
}

export interface RunOutcome {
  seed: number;
  days: number; // 兼容旧调用；等同 simulatedDays
  simulatedDays: number;
  maxDays: number;
  stageReached: number;
  breakthroughs: number;
  tribulations: number;
  died: boolean;
  deathCause: string | null;
  endReason: RunEndReason;
  ascended: boolean;
  ascensionDay: number | null;
  harvests: number;
  maxPillPoison: number;
  lowHpTribulationRate: number;
  tribulationFinalHpRatios: number[];
  tribulationAttempts: TribulationAttempt[];
  purpleOmen: PurpleOmenTrace;
  assistance: SyntheticAssistance;
  beastSurges: number;
  cropsLostToBeasts: number;
  beastCoresLooted: number;
}

export interface RunConfig {
  maxDays: number;
  stopOnGameOver?: boolean;
}

function emptyAssistance(): SyntheticAssistance {
  return { preparationEvents: 0, ascensionPillsGranted: 0, progressionCapsGranted: 0, healedMilli: 0, itemsGranted: {}, arraysGranted: 0 };
}

function grant(state: GameState, assistance: SyntheticAssistance, itemId: string, count: number): boolean {
  const granted = mutateItem(state.player, itemId, count);
  if (granted) {
    assistance.itemsGranted[itemId] = (assistance.itemsGranted[itemId] ?? 0) + count;
  }
  return granted;
}

function prepareTribulation(state: GameState, bot: BotPolicy, assistance: SyntheticAssistance, ctx: Parameters<typeof applyPill>[2]): void {
  if (bot.preparationProfile === 'none') return;
  assistance.preparationEvents++;
  const pillId = bot.preparationProfile === 'expert-assisted' ? 'pill.ward-heaven' : 'pill.ward-greater';
  if (!grant(state, assistance, pillId, 1) || !applyPill(state, pillId, ctx).applied) return;
  if (bot.preparationProfile === 'expert-assisted') state.player.ironBoneMitigation = 0.2;
  const before = state.player.hp;
  state.player.hp = bot.recoveryProfile === 'inherit-limited' ? Math.min(state.player.maxHp, state.player.hp + Math.round(state.player.maxHp * bot.limitedRecoveryRatio)) : state.player.maxHp;
  assistance.healedMilli += state.player.hp - before;
  const coverage = state.tiles.filter(t => Math.max(Math.abs(t.x - state.player.position.x), Math.abs(t.y - state.player.position.y)) <= 1).map(t => t.id);
  const ids = bot.preparationProfile === 'expert-assisted' ? [9001, 9002] : [9001];
  for (const id of ids) {
    const existing = state.arrays.get(id);
    if (!existing || !existing.active || existing.power <= 0) {
      state.arrays.set(id, { id, defId: 'array.lightning-rod', modifier: 4, coreTileId: coverage[0] ?? 0, coverageTileIds: coverage, power: 100, active: true });
      assistance.arraysGranted++;
    }
  }
}

function classifyEnd(state: GameState): RunEndReason | null {
  if (!state.gameOver) return null;
  if (state.ending === 'ascension') return 'ascended';
  if (state.ending === 'tribulation-death') return 'tribulation-death';
  if (state.ending === 'poison-death') return 'poison-death';
  if (state.ending === 'madness') return 'madness';
  return 'other-ending';
}

/** 单局确定性模拟。M5 运行需显式选用较长 maxDays；duration 单位始终为 game-days。 */
export function runSimulation(seed: number, bot: BotPolicy, params: BalanceParams = DEFAULT_BALANCE, config: RunConfig): RunOutcome {
  const reg = buildRegistry();
  const state: GameState = createWorld({ seed, width: 8, height: 8, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  state.player.stage = 1 as GameState['player']['stage'];
  mutateItem(state.player, bot.seedId, bot.plotSize * 6);

  const plot: Array<{ x: number; y: number }> = [];
  for (const tile of state.tiles) {
    if (plot.length >= bot.plotSize) break;
    if (tile.soilType === 'loam' && tile.blockType === 'none') plot.push({ x: tile.x, y: tile.y });
  }

  let harvests = 0;
  let maxPillPoison = 0;
  let breakthroughs = 0;
  let beastSurges = 0;
  let cropsLostToBeasts = 0;
  let beastCoresLooted = 0;
  let tilled = false;
  let ascensionDay: number | null = null;
  let endReason: RunEndReason = 'timeout';
  const attempts: TribulationAttempt[] = [];
  const finalHpRatios: number[] = [];
  const assistance = emptyAssistance();
  const purpleOmen: PurpleOmenTrace = { encountered: false, triggeredDay: null, expiredDay: null, blockedBreakthroughDays: 0, deadlocked: false, deadlockReason: null };

  for (let d = 0; d < config.maxDays; d++) {
    const priorOmen = state.activeEvent?.defId === 'event.purple-omen';
    const actions: PlayerAction[] = [];
    if (bot.huntBeasts && state.beastSurge && state.player.hp > params.celestial.beast.huntDamage * 1000) actions.push({ kind: 'hunt-beast' });
    if (!tilled) {
      for (const p of plot) {
        actions.push({ kind: 'till', at: p });
        actions.push({ kind: 'sow', at: p, seedId: bot.seedId });
      }
      tilled = true;
    }
    for (const p of plot) {
      const tile = tileAt(state, p.x, p.y);
      if (!tile) continue;
      if (bot.careDaily && tile.cropId != null) actions.push({ kind: 'water', at: p }, { kind: 'channel-qi', at: p });
      const crop = tile.cropId != null ? state.crops.get(tile.id) : undefined;
      if (crop?.stage === 'mature') {
        actions.push({ kind: 'harvest', at: p });
        if (itemCount(state.player, bot.seedId) > 0) actions.push({ kind: 'sow', at: p, seedId: bot.seedId });
      }
    }
    const events = simulateDay(state, { actions } as DayInput, ctx);
    for (const event of events) {
      if (event.type === 'harvest') harvests++;
      else if (event.type === 'beast-surge-start') beastSurges++;
      else if (event.type === 'beast-eat-crop') cropsLostToBeasts++;
      else if (event.type === 'beast-loot') beastCoresLooted += (event.payload as { cores: number }).cores;
    }
    maxPillPoison = Math.max(maxPillPoison, state.player.pillPoison / 1000);

    const omenActive = state.activeEvent?.defId === 'event.purple-omen';
    if (omenActive && !purpleOmen.encountered) {
      purpleOmen.encountered = true;
      purpleOmen.triggeredDay = state.day;
    }
    if (priorOmen && !omenActive) purpleOmen.expiredDay = state.day;
    if (omenActive && state.player.stage === 4 && state.player.cultivation >= params.breakthrough.xCap[3]!) purpleOmen.blockedBreakthroughDays++;

    // M5 proxy 仅跳过长期种田资源门槛；真实前兆、天劫、突破和飞升结局仍由 sim 系统处理。
    if (bot.progressionProfile === 'cap-assisted' && state.player.stage >= 1 && state.player.stage <= 6 && !omenActive) {
      const cap = stageQiCap(state.player.stage, params);
      if (state.player.cultivation < cap) {
        state.player.cultivation = cap;
        assistance.progressionCapsGranted++;
      }
    }

    while (readyForBreakthrough(state, params) && !state.gameOver) {
      prepareTribulation(state, bot, assistance, ctx);
      const stage = state.player.stage;
      const result = runTribulation(state, { stage, boltCount: bot.tribulationBolts + stage, policy: { blockChance: bot.blockChance } }, ctx);
      const ratio = result.survived ? result.finalHpMilli / (state.player.maxHp || 1) : 0;
      finalHpRatios.push(ratio);
      attempts.push({ stage, bolts: result.bolts, violetBolts: result.hits.violet, survived: result.survived, finalHpRatio: ratio, temperingGainMilli: result.temperingGainMilli });
      checkGameEnd(state, ctx);
      if (!result.survived || state.gameOver) break;
      const hpAfterTribulation = state.player.hp;
      const maxHpBeforeBreakthrough = state.player.maxHp;
      if (breakthrough(state, ctx, true).success) {
        breakthroughs++;
        if (bot.recoveryProfile === 'inherit-limited') {
          const inheritedRatio = hpAfterTribulation / Math.max(1, maxHpBeforeBreakthrough);
          state.player.hp = Math.max(1, Math.min(state.player.maxHp, Math.round(state.player.maxHp * inheritedRatio)));
        }
      } else break;
    }

    if (state.player.stage >= 7 && bot.ascensionProfile === 'pill-assisted-at-stage7' && !state.gameOver) {
      if (grant(state, assistance, 'pill.ascend', 1)) {
        assistance.ascensionPillsGranted++;
        applyPill(state, 'pill.ascend', ctx);
        if (state.postAscension.mode === 'choice-pending') resolveAscensionChoice(state, 'ascend-away');
      }
      if (state.ending === 'ascension') ascensionDay = state.day - 1;
    }
    const classified = classifyEnd(state);
    if (classified && (config.stopOnGameOver ?? true)) {
      endReason = classified;
      break;
    }
  }

  if (purpleOmen.encountered && purpleOmen.expiredDay === null && !state.gameOver && state.day > (purpleOmen.triggeredDay ?? state.day) + 7) {
    purpleOmen.deadlocked = true;
    purpleOmen.deadlockReason = 'omen did not expire after seven day-end ticks';
  }
  if (purpleOmen.expiredDay !== null && state.player.stage === 4 && state.player.cultivation >= params.breakthrough.xCap[3]! && !readyForBreakthrough(state, params) && !state.gameOver) {
    purpleOmen.deadlocked = true;
    purpleOmen.deadlockReason = 'stage4 eligibility was not restored after omen expiry';
  }

  const lowHpCount = finalHpRatios.filter(ratio => ratio < 0.25).length;
  const ascended = state.ending === 'ascension';
  const died = state.ending === 'tribulation-death' || state.ending === 'poison-death';
  if (ascended) endReason = 'ascended';
  else if (classifyEnd(state)) endReason = classifyEnd(state)!;
  return {
    seed,
    days: state.day - 1,
    simulatedDays: state.day - 1,
    maxDays: config.maxDays,
    stageReached: state.player.stage,
    breakthroughs,
    tribulations: attempts.length,
    died,
    deathCause: died ? state.ending : null,
    endReason,
    ascended,
    ascensionDay,
    harvests,
    maxPillPoison: Math.round(maxPillPoison * 10) / 10,
    lowHpTribulationRate: finalHpRatios.length ? Math.round((lowHpCount / finalHpRatios.length) * 100) / 100 : 0,
    tribulationFinalHpRatios: finalHpRatios,
    tribulationAttempts: attempts,
    purpleOmen,
    assistance,
    beastSurges,
    cropsLostToBeasts,
    beastCoresLooted
  };
}

/** 旧调用兼容：固定日数 smoke/proxy。 */
export function runOne(seed: number, days: number, bot: BotPolicy, params: BalanceParams = DEFAULT_BALANCE): RunOutcome {
  return runSimulation(seed, bot, params, { maxDays: days });
}

export interface Aggregate {
  bot: string;
  runs: number;
  deaths: number;
  deathRate: number;
  meanStage: number;
  meanBreakthroughs: number;
  meanHarvests: number;
  meanMaxPoison: number;
  meanBeastSurges: number;
  meanCropsLostToBeasts: number;
  meanBeastCoresLooted: number;
  hashStable: boolean;
}

export function runMonteCarlo(seeds: number[], bot: BotPolicy, days: number, params: BalanceParams = DEFAULT_BALANCE): Aggregate {
  if (!seeds.length) throw new RangeError('runMonteCarlo requires at least one seed');
  let deaths = 0,
    stages = 0,
    breakthroughs = 0,
    harvests = 0,
    poison = 0,
    surges = 0,
    losses = 0,
    cores = 0;
  let hashStable = true;
  for (const seed of seeds) {
    const one = runOne(seed, days, bot, params);
    const two = runOne(seed, days, bot, params);
    if (JSON.stringify(one) !== JSON.stringify(two)) hashStable = false;
    deaths += Number(one.died);
    stages += one.stageReached;
    breakthroughs += one.breakthroughs;
    harvests += one.harvests;
    poison += one.maxPillPoison;
    surges += one.beastSurges;
    losses += one.cropsLostToBeasts;
    cores += one.beastCoresLooted;
  }
  const n = seeds.length;
  return {
    bot: bot.name,
    runs: n,
    deaths,
    deathRate: deaths / n,
    meanStage: Math.round((stages / n) * 100) / 100,
    meanBreakthroughs: Math.round((breakthroughs / n) * 100) / 100,
    meanHarvests: Math.round((harvests / n) * 10) / 10,
    meanMaxPoison: Math.round((poison / n) * 10) / 10,
    meanBeastSurges: Math.round((surges / n) * 100) / 100,
    meanCropsLostToBeasts: Math.round((losses / n) * 100) / 100,
    meanBeastCoresLooted: Math.round((cores / n) * 100) / 100,
    hashStable
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const index = args.indexOf('--seeds');
  const count = index >= 0 ? Number(args[index + 1]) : 1;
  const days = 120;
  if (count <= 1) console.log(JSON.stringify(runOne(1, days, NORMAL_BOT), null, 2));
  else {
    const seeds = Array.from({ length: count }, (_, i) => i + 1);
    console.log(`— 蒙特卡洛批量 (${count} 局 × ${days} game-days) —`);
    for (const bot of [ROOKIE_BOT, NORMAL_BOT, VETERAN_BOT]) console.log(JSON.stringify(runMonteCarlo(seeds, bot, days)));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main;
