/**
 * M5 平衡扫参（docs/18 §7.3 终局劝退应对）。
 * 诊断（m5-diagnose）已定位死因：stage5+ 紫雷占 75-81% + 终HP 0% 碾压性击杀。
 * 本工具在紫雷/伤害旋钮上做粗粒度网格搜索，找同时命中 §7.2 目标的配置：
 *   veteran ∈ [0.75, 0.85]、normal ∈ [0.30, 0.45]
 *
 * 仅改 stage≥3 生效的旋钮（violetUnlockStage=3），M3 stage1-2 体验不受影响。
 * 非提交产物——调参决策辅助。
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { M5_NORMAL_PROXY_BOT, M5_VETERAN_PROXY_BOT, runSimulation, type BotPolicy } from './headless-run';

const SEEDS = Number(process.argv.slice(2).find((_, i, a) => a[i - 1] === '--seeds') ?? '192');
const SEED_START = Number(process.argv.slice(2).find((_, i, a) => a[i - 1] === '--seed-start') ?? '1');
const MAX_DAYS = 2000;

interface Config { name: string; vm: number; vs: number; ss: number; }
const CONFIGS: Config[] = [
  // 锁定跳变间隙 vm∈[1.15,1.16]：normal 在此从 ~0.30 跃迁到 ~0.49。
  { name: 'vm1.157-vs0.3-ss10', vm: 1.157, vs: 0.3, ss: 10 },
  { name: 'vm1.155-vs0.3-ss10', vm: 1.155, vs: 0.3, ss: 10 },
  { name: 'vm1.153-vs0.3-ss10', vm: 1.153, vs: 0.3, ss: 10 },
];

function apply(base: BalanceParams, c: Config): BalanceParams {
  const p: BalanceParams = structuredClone(base);
  p.lightning.bolt.violetDamageMult = c.vm;
  p.lightning.bolt.violetChanceSlope = c.vs;
  p.lightning.damage.stageSlope = c.ss;
  return p;
}

function rate(bot: BotPolicy, params: BalanceParams): { asc: number; death: number } {
  let asc = 0; let death = 0;
  for (let i = 0; i < SEEDS; i++) {
    const o = runSimulation(SEED_START + i, bot, params, { maxDays: MAX_DAYS });
    if (o.ascended) asc++;
    if (o.died) death++;
  }
  return { asc: asc / SEEDS, death: death / SEEDS };
}

const inBand = (r: number, lo: number, hi: number) => r >= lo && r <= hi;

console.log(`M5 扫参（${SEEDS} seeds/cohort，目标 normal∈[0.30,0.45] veteran∈[0.75,0.85]）`);
console.log('config'.padEnd(16) + 'normal(asc/death)'.padStart(20) + 'veteran(asc/death)'.padStart(20) + ' verdict');
for (const c of CONFIGS) {
  const params = apply(DEFAULT_BALANCE, c);
  const n = rate(M5_NORMAL_PROXY_BOT, params);
  const v = rate(M5_VETERAN_PROXY_BOT, params);
  const ok = inBand(n.asc, 0.30, 0.45) && inBand(v.asc, 0.75, 0.85);
  console.log(
    c.name.padEnd(16) +
      `${n.asc.toFixed(3)}/${n.death.toFixed(3)}`.padStart(20) +
      `${v.asc.toFixed(3)}/${v.death.toFixed(3)}`.padStart(20) +
      (ok ? ' ✅ HIT' : ''),
  );
}
