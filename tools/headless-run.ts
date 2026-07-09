/**
 * 无头模拟 Harness（docs/17 §4）。
 * 无 DOM/GPU，直接驱动 sim 层跑成千上万局种子化对局 → 产出统计 → 喂蒙特卡洛调参。
 *
 * 用法：
 *   pnpm headless                # 跑 1 局 demo
 *   pnpm headless -- --seeds 50  # 跑 50 局聚合
 *
 * 这是"无人干预开发"的引擎：任何 sim 改动后跑此即可回归 + 发现死锁/失衡。
 */
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, tileAt } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { DayInput, PlayerAction } from '@sim/world/input';
import { stateHash } from '@sim/serialize';

/** 策略 bot 策略参数（docs/17 §5 Stratabots 分层）。 */
export interface BotPolicy {
  name: string;
  plotSize: number; // 经营地块数
  seedId: string;
  careDaily: boolean; // 是否每日浇水供灵
  restIfPoisonAbove: number; // 丹毒超此则休息
}

export const ROOKIE_BOT: BotPolicy = { name: 'rookie', plotSize: 1, seedId: 'seed.mossling', careDaily: false, restIfPoisonAbove: 95 };
export const NORMAL_BOT: BotPolicy = { name: 'normal', plotSize: 3, seedId: 'seed.mossling', careDaily: true, restIfPoisonAbove: 70 };

export interface RunOutcome {
  seed: number;
  days: number;
  survived: boolean;
  died: boolean;
  deathCause: string | null;
  harvests: number;
  maxPillPoison: number; // 0..100
  finalHerbs: number;
  stateHash: string;
}

/** 单局模拟：用 bot 策略驱动 N 日。 */
export function runOne(seed: number, days: number, bot: BotPolicy): RunOutcome {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  // 初始种子
  mutateItem(state.player, bot.seedId, bot.plotSize * 4);

  const plotTiles: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < bot.plotSize; i++) plotTiles.push({ x: 2 + i, y: 3 });

  let harvests = 0;
  let maxPillPoison = 0;
  let died = false;
  let deathCause: string | null = null;
  let tilledSetup = false;

  for (let d = 0; d < days; d++) {
    if (state.player.pillPoison >= DEFAULT_BALANCE.pillPoison.cap * 1000) {
      died = true;
      deathCause = 'pillPoison';
      break;
    }
    const actions: PlayerAction[] = [];

    // 一次性翻地+播种
    if (!tilledSetup) {
      for (const p of plotTiles) {
        actions.push({ kind: 'till', at: p });
        actions.push({ kind: 'sow', at: p, seedId: bot.seedId });
      }
      tilledSetup = true;
    }

    // 每日照料 + 收获
    for (const p of plotTiles) {
      const t = tileAt(state, p.x, p.y);
      if (!t) continue;
      if (bot.careDaily && t.cropId != null) {
        actions.push({ kind: 'water', at: p });
        actions.push({ kind: 'channel-qi', at: p });
      }
      const crop = t.cropId != null ? state.crops.get(t.id) : undefined;
      if (crop && crop.stage === 'mature') {
        actions.push({ kind: 'harvest', at: p });
        // 补种
        if (itemCount(state.player, bot.seedId) > 0) actions.push({ kind: 'sow', at: p, seedId: bot.seedId });
      }
    }

    if (state.player.pillPoison / 1000 > bot.restIfPoisonAbove) actions.push({ kind: 'rest' });

    const events = simulateDay(state, { actions }, ctx);
    for (const e of events) {
      if (e.type === 'harvest') harvests++;
    }
    maxPillPoison = Math.max(maxPillPoison, state.player.pillPoison / 1000);
  }

  const finalHerbs = Object.entries(state.player.inventory)
    .filter(([id]) => id.startsWith('herb.'))
    .reduce((s, [, slot]) => s + (slot?.count ?? 0), 0);

  return {
    seed,
    days: state.day - 1,
    survived: !died,
    died,
    deathCause,
    harvests,
    maxPillPoison: Math.round(maxPillPoison * 10) / 10,
    finalHerbs,
    stateHash: stateHash(state),
  };
}

export interface Aggregate {
  bot: string;
  runs: number;
  deaths: number;
  deathRate: number;
  meanHarvests: number;
  meanMaxPoison: number;
  hashStable: boolean; // 同种子两次运行 hash 是否一致（确定性自检）
}

/** 批量聚合（docs/17 §4.2）。 */
export function runMonteCarlo(seeds: number[], bot: BotPolicy, days: number): Aggregate {
  let deaths = 0;
  let totalHarvests = 0;
  let totalPoison = 0;
  let hashStable = true;
  for (const seed of seeds) {
    const o = runOne(seed, days, bot);
    if (o.died) deaths++;
    totalHarvests += o.harvests;
    totalPoison += o.maxPillPoison;
    // 确定性自检：同 seed 再跑一次，hash 必须一致
    const o2 = runOne(seed, days, bot);
    if (o.stateHash !== o2.stateHash) hashStable = false;
  }
  const runs = seeds.length;
  return {
    bot: bot.name,
    runs,
    deaths,
    deathRate: deaths / runs,
    meanHarvests: Math.round((totalHarvests / runs) * 10) / 10,
    meanMaxPoison: Math.round((totalPoison / runs) * 10) / 10,
    hashStable,
  };
}

// —— CLI ——
function main() {
  const args = process.argv.slice(2);
  const seedsIdx = args.indexOf('--seeds');
  const n = seedsIdx >= 0 ? Number(args[seedsIdx + 1]) : 1;
  const days = 60;

  if (n <= 1) {
    const o = runOne(1, days, NORMAL_BOT);
    console.log('— 单局 demo (normal bot, 60 日) —');
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
