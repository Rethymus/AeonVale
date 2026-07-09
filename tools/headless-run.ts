/**
 * 无头模拟 Harness（docs/17 §4）。
 * 无 DOM/GPU，直接驱动 sim 跑成千上万局种子化对局 → 产出统计 → 喂蒙特卡洛调参。
 * 完整核心循环：farm(收获积修为)→修为满→引劫→淬体→突破→下一阶段。
 *
 * 用法：pnpm headless ｜ pnpm headless -- --seeds 50
 */
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt } from '@sim';
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
}

export const ROOKIE_BOT: BotPolicy = { name: 'rookie', plotSize: 1, seedId: 'seed.mossling', careDaily: false };
export const NORMAL_BOT: BotPolicy = { name: 'normal', plotSize: 3, seedId: 'seed.mossling', careDaily: true };

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
  hashStable: boolean;
}

/** 单局模拟：farm → 引劫 → 突破 完整循环。 */
export function runOne(seed: number, days: number, bot: BotPolicy): RunOutcome {
  const reg = buildRegistry();
  const state: GameState = createWorld({ seed, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stage = 1 as GameState['player']['stage']; // 跳过凡骨教程，已开始偷天诀
  mutateItem(state.player, bot.seedId, bot.plotSize * 6);

  const plot: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < bot.plotSize; i++) plot.push({ x: 2 + i, y: 3 });

  let harvests = 0;
  let maxPillPoison = 0;
  let breakthroughs = 0;
  let tribulations = 0;
  let died = false;
  let deathCause: string | null = null;
  let tilled = false;

  for (let d = 0; d < days; d++) {
    if (state.player.pillPoison >= DEFAULT_BALANCE.pillPoison.cap * 1000) {
      died = true; deathCause = 'pillPoison'; break;
    }
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
    for (const e of events) if (e.type === 'harvest') harvests++;
    maxPillPoison = Math.max(maxPillPoison, state.player.pillPoison / 1000);

    // 修为满 → 引劫 + 突破（核心循环闭环）
    while (readyForBreakthrough(state, DEFAULT_BALANCE)) {
      tribulations++;
      const res = runTribulation(state, { stage: state.player.stage, boltCount: 3 + state.player.stage, policy: { blockChance: 0 } }, ctx);
      if (!res.survived) { died = true; deathCause = 'tribulation'; break; }
      const br = breakthrough(state, ctx, true);
      if (br.success) breakthroughs++;
      else break; // 险胜/走火，重攒
      if (state.player.stage >= 7) break;
    }
    if (died) break;
  }

  return {
    seed,
    days: state.day - 1,
    stageReached: state.player.stage,
    breakthroughs,
    tribulations,
    died,
    deathCause,
    harvests,
    maxPillPoison: Math.round(maxPillPoison * 10) / 10,
    hashStable: true, // 下方 aggregate 复核
  };
}

export interface Aggregate {
  bot: string;
  runs: number;
  deaths: number;
  meanStage: number;
  meanBreakthroughs: number;
  meanHarvests: number;
  meanMaxPoison: number;
  hashStable: boolean;
}

export function runMonteCarlo(seeds: number[], bot: BotPolicy, days: number): Aggregate {
  let deaths = 0;
  let totalStage = 0;
  let totalBrk = 0;
  let totalHarv = 0;
  let totalPoi = 0;
  let hashStable = true;
  for (const seed of seeds) {
    const o = runOne(seed, days, bot);
    if (o.died) deaths++;
    totalStage += o.stageReached;
    totalBrk += o.breakthroughs;
    totalHarv += o.harvests;
    totalPoi += o.maxPillPoison;
    // 确定性自检：同 seed 两次 runOne 的 outcome 必须完全一致
    const o2 = runOne(seed, days, bot);
    if (JSON.stringify(o) !== JSON.stringify(o2)) hashStable = false;
  }
  const runs = seeds.length;
  return {
    bot: bot.name,
    runs,
    deaths,
    meanStage: Math.round((totalStage / runs) * 10) / 10,
    meanBreakthroughs: Math.round((totalBrk / runs) * 10) / 10,
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
    console.log(`— 单局 demo (normal bot, ${days} 日，完整循环) —`);
    console.log(JSON.stringify(o, null, 2));
    return;
  }
  const seeds = Array.from({ length: n }, (_, i) => i + 1);
  console.log(`— 蒙特卡洛批量 (${n} 局 × ${days} 日) —`);
  for (const bot of [ROOKIE_BOT, NORMAL_BOT]) {
    const agg = runMonteCarlo(seeds, bot, days);
    console.log(JSON.stringify(agg));
  }
}

main();
