/**
 * 蒙特卡洛平衡扫描器。
 *
 * 对关键参数在其 range 内网格扫描，每个 θ 跑 N 局无头对局，度量代理指标
 * （阶段到达/死亡率/突破次数）。用于自动发现"参数 → 体验"的敏感方向，
 * 为 CMA-ES 精调提供先验。这是"无人干预自动平衡"的最简形式。
 *
 * 用法：pnpm balance
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { runOne, NORMAL_BOT, type BotPolicy } from './headless-run';

const SEEDS = Array.from({ length: 8 }, (_, i) => i + 1);
const DAYS = 120;

interface Cell {
  label: string;
  params: BalanceParams;
  bot: BotPolicy;
}

function withHarvest(v: number): BalanceParams {
  return { ...DEFAULT_BALANCE, breakthrough: { ...DEFAULT_BALANCE.breakthrough, harvestCultivationPerTier: v } };
}
function withBolts(b: number): BotPolicy {
  return { ...NORMAL_BOT, tribulationBolts: b };
}
function withBeastLoot(chance: number): BalanceParams {
  return {
    ...DEFAULT_BALANCE,
    celestial: {
      ...DEFAULT_BALANCE.celestial,
      beast: { ...DEFAULT_BALANCE.celestial.beast, lootChancePerBeast: chance }
    }
  };
}

function measure(cell: Cell) {
  let deaths = 0;
  let stage = 0;
  let brk = 0;
  let surges = 0;
  let cropsLost = 0;
  let cores = 0;
  for (const seed of SEEDS) {
    const o = runOne(seed, DAYS, cell.bot, cell.params);
    if (o.died) deaths++;
    stage += o.stageReached;
    brk += o.breakthroughs;
    surges += o.beastSurges;
    cropsLost += o.cropsLostToBeasts;
    cores += o.beastCoresLooted;
  }
  const n = SEEDS.length;
  return {
    deathRate: Math.round((deaths / n) * 100),
    meanStage: Math.round((stage / n) * 100) / 100,
    meanBrk: Math.round((brk / n) * 100) / 100,
    meanSurges: Math.round((surges / n) * 100) / 100,
    meanCropsLost: Math.round((cropsLost / n) * 100) / 100,
    meanCores: Math.round((cores / n) * 100) / 100
  };
}

function main() {
  console.log(`蒙特卡洛平衡扫描（${SEEDS.length} 局 × ${DAYS} 日 / 单元格，normal bot）\n`);

  // 扫描 1：收获修为增益 → 推进速度
  console.log('== 扫描 A：harvestCultivationPerTier（越高→修为积累越快→推进越快） ==');
  console.log('harvestCult/tier | meanStage | deathRate% | meanBrk');
  for (const v of [2000, 5000, 10000, 20000]) {
    const m = measure({ label: `hc=${v}`, params: withHarvest(v), bot: NORMAL_BOT });
    console.log(`${String(v).padStart(16)} | ${String(m.meanStage).padStart(9)} | ${String(m.deathRate).padStart(9)} | ${m.meanBrk}`);
  }

  // 扫描 2：天劫雷数 → 难度/死亡率
  console.log('\n== 扫描 B：tribulationBolts（越多雷→越难→死亡率↑/推进↓） ==');
  console.log('tribulationBolts | meanStage | deathRate% | meanBrk');
  for (const b of [2, 3, 5, 8]) {
    const m = measure({ label: `bolts=${b}`, params: DEFAULT_BALANCE, bot: withBolts(b) });
    console.log(`${String(b).padStart(16)} | ${String(m.meanStage).padStart(9)} | ${String(m.deathRate).padStart(9)} | ${m.meanBrk}`);
  }

  // 扫描 3：妖兽内丹掉落 → 风险-收益可观测性
  console.log('\n== 扫描 C：lootChancePerBeast（越高→舔包收益↑，不应改变妖兽税） ==');
  console.log('lootChance/beast | meanSurges | meanCropsLost | meanCores | meanStage');
  for (const chance of [0, 0.3, 0.6, 1.0]) {
    const m = measure({ label: `loot=${chance}`, params: withBeastLoot(chance), bot: NORMAL_BOT });
    console.log(`${chance.toFixed(1).padStart(16)} | ${String(m.meanSurges).padStart(10)} | ${String(m.meanCropsLost).padStart(13)} | ${String(m.meanCores).padStart(9)} | ${m.meanStage}`);
  }

  console.log('\n解读：参数→指标的单调关系即"自动调参"的搜索方向。');
}

main;
