/**
 * 无头模拟 Harness（docs/17 §4）。完整核心循环：farm→引劫→淬体→突破。
 * 用法：pnpm headless ｜ pnpm headless -- --seeds 50
 */
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { DayInput, PlayerAction } from '@sim/world/input';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { readyForBreakthrough, breakthrough } from '@sim/progression/progression';

export interface BotPolicy {
  name: string;
  plotSize: number;
  seedId: string;
  careDaily: boolean;
  tribulationBolts: number; // 引劫基础雷数（+stage）
  blockChance: number;
  /** true = 每次天劫前注入避雷丹+2激活阵法（模拟炼丹-布阵完整准备，测试 prepScore 闭环） */
  simulatePrepared: boolean;
}

export const ROOKIE_BOT: BotPolicy = { name: 'rookie', plotSize: 1, seedId: 'seed.mossling', careDaily: false, tribulationBolts: 3, blockChance: 0, simulatePrepared: false };
export const NORMAL_BOT: BotPolicy = { name: 'normal', plotSize: 3, seedId: 'seed.mossling', careDaily: true, tribulationBolts: 3, blockChance: 0, simulatePrepared: false };
/**
 * 老手 bot：炼丹-布阵-渡劫完整准备（docs/17 §5.3 / docs/14 §8.3 prepScore）。
 * simulatePrepared=true：每次天劫前注入避雷丹+2激活阵法 → prepScore=1.0 → 最高突破成功率。
 * blockChance=0.6：高擦弹率降低死亡风险，模拟熟练玩家。
 * 验证目标：veteran 突破率 > normal，prepScore 闭环生效。
 */
export const VETERAN_BOT: BotPolicy = { name: 'veteran', plotSize: 5, seedId: 'seed.mossling', careDaily: true, tribulationBolts: 5, blockChance: 0.6, simulatePrepared: true };

export interface RunOutcome {
  seed: number;
  days: number;
  stageReached: number;
  breakthroughs: number;
  tribulations: number;
  died: boolean;
  deathCause: string | null;
  harvests: number;
  maxPillPoison: number;
  /** 天劫中最终 HP < 25% maxHp 的比例（M3 退出标准：veteran ≥ 50%）。 */
  lowHpTribulationRate: number;
  /** 每次天劫的最终 HP 比例列表（用于调试/分布分析）。 */
  tribulationFinalHpRatios: number[];
  /** 妖兽潮触发次数（M4 因果链：灵气潮汐→引兽，docs/07 §3.1）。 */
  beastSurges: number;
  /** 被妖兽啃食的成熟作物数（M4 妖兽税，影响推进速度）。 */
  cropsLostToBeasts: number;
}

/** 单局模拟（完整循环）。params/bot 可注入，用于平衡扫描。 */
export function runOne(seed: number, days: number, bot: BotPolicy, params: BalanceParams = DEFAULT_BALANCE): RunOutcome {
  const reg = buildRegistry();
  const state: GameState = createWorld({ seed, width: 8, height: 8, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  state.player.stage = 1 as GameState['player']['stage'];
  mutateItem(state.player, bot.seedId, bot.plotSize * 6);

  // 自适应选地：跳过水域/岩石/金属矿，找可种植的普通地块（地形适应）
  const plot: Array<{ x: number; y: number }> = [];
  for (const t of state.tiles) {
    if (plot.length >= bot.plotSize) break;
    if (t.soilType === 'loam' && t.blockType === 'none') plot.push({ x: t.x, y: t.y });
  }

  let harvests = 0;
  let maxPillPoison = 0;
  let breakthroughs = 0;
  let tribulations = 0;
  let beastSurges = 0;
  let cropsLostToBeasts = 0;
  let died = false;
  let deathCause: string | null = null;
  let tilled = false;
  const tribulationFinalHpRatios: number[] = [];

  for (let d = 0; d < days; d++) {
    if (state.player.pillPoison >= params.pillPoison.cap * 1000) { died = true; deathCause = 'pillPoison'; break; }
    if (state.player.hp <= 0) { died = true; deathCause = 'tribulation'; break; }

    const actions: PlayerAction[] = [];
    if (!tilled) {
      for (const p of plot) { actions.push({ kind: 'till', at: p }); actions.push({ kind: 'sow', at: p, seedId: bot.seedId }); }
      tilled = true;
    }
    for (const p of plot) {
      const t = tileAt(state, p.x, p.y);
      if (!t) continue;
      if (bot.careDaily && t.cropId != null) { actions.push({ kind: 'water', at: p }); actions.push({ kind: 'channel-qi', at: p }); }
      const crop = t.cropId != null ? state.crops.get(t.id) : undefined;
      if (crop && crop.stage === 'mature') {
        actions.push({ kind: 'harvest', at: p });
        if (itemCount(state.player, bot.seedId) > 0) actions.push({ kind: 'sow', at: p, seedId: bot.seedId });
      }
    }
    const events = simulateDay(state, { actions } as DayInput, ctx);
    for (const e of events) {
      if (e.type === 'harvest') harvests++;
      else if (e.type === 'beast-surge-start') beastSurges++;
      else if (e.type === 'beast-eat-crop') cropsLostToBeasts++;
    }
    maxPillPoison = Math.max(maxPillPoison, state.player.pillPoison / 1000);

    while (readyForBreakthrough(state, params)) {
      tribulations++;
      // simulatePrepared: 注入避雷丹 + 2激活阵法（模拟炼丹-布阵准备，测试 prepScore 闭环）
      if (bot.simulatePrepared) {
        mutateItem(state.player, 'pill.ward-basic', 1);
        state.player.wardMitigation = 0.4; // 服避雷丹
        // 注入2个激活阵法（prepScore=1.0）
        if (!state.arrays.has(9001)) state.arrays.set(9001, { id: 9001, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 100, active: true });
        if (!state.arrays.has(9002)) state.arrays.set(9002, { id: 9002, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 1, coverageTileIds: [], power: 100, active: true });
      }
      const res = runTribulation(state, { stage: state.player.stage, boltCount: bot.tribulationBolts + state.player.stage, policy: { blockChance: bot.blockChance } }, ctx);
      // 记录天劫最终 HP 比例（M3 退出标准控血 proxy）
      const hpRatio = res.survived ? res.finalHpMilli / (state.player.maxHp || 1) : 0;
      tribulationFinalHpRatios.push(hpRatio);
      if (!res.survived) { died = true; deathCause = 'tribulation'; break; }
      const br = breakthrough(state, ctx, true);
      if (br.success) breakthroughs++;
      else break;
      if (state.player.stage >= 7) break;
    }
    if (died) break;
  }

  const lowHpCount = tribulationFinalHpRatios.filter((r) => r < 0.25).length;
  const lowHpTribulationRate = tribulationFinalHpRatios.length > 0
    ? lowHpCount / tribulationFinalHpRatios.length
    : 0;
  return { seed, days: state.day - 1, stageReached: state.player.stage, breakthroughs, tribulations, died, deathCause, harvests, maxPillPoison: Math.round(maxPillPoison * 10) / 10, lowHpTribulationRate: Math.round(lowHpTribulationRate * 100) / 100, tribulationFinalHpRatios, beastSurges, cropsLostToBeasts };
}

export interface Aggregate {
  bot: string; runs: number; deaths: number; deathRate: number;
  meanStage: number; meanBreakthroughs: number; meanHarvests: number; meanMaxPoison: number;
  hashStable: boolean;
}

export function runMonteCarlo(seeds: number[], bot: BotPolicy, days: number, params: BalanceParams = DEFAULT_BALANCE): Aggregate {
  let deaths = 0, totalStage = 0, totalBrk = 0, totalHarv = 0, totalPoi = 0;
  let hashStable = true;
  for (const seed of seeds) {
    const o = runOne(seed, days, bot, params);
    if (o.died) deaths++;
    totalStage += o.stageReached; totalBrk += o.breakthroughs; totalHarv += o.harvests; totalPoi += o.maxPillPoison;
    const o2 = runOne(seed, days, bot, params);
    if (JSON.stringify(o) !== JSON.stringify(o2)) hashStable = false;
  }
  const runs = seeds.length;
  return {
    bot: bot.name, runs, deaths, deathRate: deaths / runs,
    meanStage: Math.round((totalStage / runs) * 100) / 100,
    meanBreakthroughs: Math.round((totalBrk / runs) * 100) / 100,
    meanHarvests: Math.round((totalHarv / runs) * 10) / 10,
    meanMaxPoison: Math.round((totalPoi / runs) * 10) / 10,
    hashStable,
  };
}

function main() {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--seeds');
  const n = idx >= 0 ? Number(args[idx + 1]) : 1;
  const days = 120;
  if (n <= 1) {
    const o = runOne(1, days, NORMAL_BOT);
    console.log(`— 单局 demo (normal bot, ${days} 日) —`);
    console.log(JSON.stringify(o, null, 2));
    return;
  }
  const seeds = Array.from({ length: n }, (_, i) => i + 1);
  console.log(`— 蒙特卡洛批量 (${n} 局 × ${days} 日) —`);
  for (const bot of [ROOKIE_BOT, NORMAL_BOT, VETERAN_BOT]) console.log(JSON.stringify(runMonteCarlo(seeds, bot, days)));
}

main();
