/**
  * 自动平衡调参器：局部搜索 / hill-climb。
 *
  * 在平衡参数空间上 hill-climb：扰动一个旋钮 → 跑 N 局无头对局 → 计算 fitness（逼近目标代理指标）
  * → 接受改进。自动发现比默认更贴目标体验的参数。
 *
  * 目标（120 日 normal bot）：
  * meanStage ≈ 2.5（推进到 stage 2-3）、deathRate ≈ 0.15（险而可破，不劝退）
 *
  * 用法：pnpm tune
 */
import { DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { runOne, NORMAL_BOT } from './headless-run';
import { Rng } from '@sim/world/rng';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const DAYS = 120;
const TARGET = { meanStage: 2.5, meanBrk: 1.5, deathRate: 0.15 };
const ITERS = 40;

interface EvalResult {
 meanStage: number;
 meanBrk: number;
 deathRate: number;
 fitness: number;
}

function evaluate(params: BalanceParams): EvalResult {
 let stage = 0;
 let brk = 0;
 let deaths = 0;
 for (const seed of SEEDS) {
 const o = runOne(seed, DAYS, NORMAL_BOT, params);
 stage += o.stageReached;
 brk += o.breakthroughs;
 if (o.died) deaths++;
 }
 const n = SEEDS.length;
 const meanStage = stage / n;
 const meanBrk = brk / n;
 const deathRate = deaths / n;
 // fitness：meanBrk 作主信号（比离散 stage 更敏感），deathRate 权重 ×2（难度锚点）
 const fitness = -(
 Math.abs(meanStage - TARGET.meanStage) +
 Math.abs(meanBrk - TARGET.meanBrk) +
 Math.abs(deathRate - TARGET.deathRate) * 2
 );
 return { meanStage, meanBrk, deathRate, fitness };
}

interface Knob {
 path: string[];
 min: number;
 max: number;
 step: number;
 label: string;
}

const KNOBS: Knob[] = [
 { path: ['breakthrough', 'harvestCultivationPerTier'], min: 1000, max: 15000, step: 2500, label: 'harvestCult/tier' },
 { path: ['lightning', 'damage', 'stageSlope'], min: 4, max: 14, step: 2, label: 'damageStageSlope' },
 { path: ['breakthrough', 'successBase'], min: 0.3, max: 0.7, step: 0.1, label: 'successBase' },
];

function getParam(p: BalanceParams, path: string[]): number {
 let cur: unknown = p;
 for (const k of path) cur = (cur as Record<string, unknown>)[k];
 return cur as number;
}

function setParam(p: BalanceParams, path: string[], v: number): BalanceParams {
 const clone = { ...p } as Record<string, unknown>;
 let cur: Record<string, unknown> = clone;
 for (let i = 0; i < path.length - 1; i++) {
 const k = path[i]!;
 cur[k] = { ...(cur[k] as Record<string, unknown>) };
 cur = cur[k] as Record<string, unknown>;
 }
 cur[path[path.length - 1]!] = v;
 return clone as unknown as BalanceParams;
}

function perturb(p: BalanceParams, rng: Rng): { params: BalanceParams; knob: Knob } {
 const k = rng.pick(KNOBS);
 const cur = getParam(p, k.path);
 const dir = rng.chance(0.5) ? 1 : -1;
 let v = cur + dir * k.step;
 if (v < k.min) v = k.min;
 if (v > k.max) v = k.max;
 return { params: setParam(p, k.path, v), knob: k };
}

function snapshot(p: BalanceParams): Record<string, number> {
 return {
 'harvestCult/tier': p.breakthrough.harvestCultivationPerTier,
 damageStageSlope: p.lightning.damage.stageSlope,
 successBase: p.breakthrough.successBase,
 };
}

function main() {
 const rng = new Rng(42);
 const baseEv = evaluate(DEFAULT_BALANCE);
 let best = { params: DEFAULT_BALANCE, ...baseEv };
 console.log(`自动平衡调参（hill-climb ${ITERS} 轮，${SEEDS.length} 局/${ITERS} 轮）`);
 console.log(`目标: meanStage≈${TARGET.meanStage} meanBrk≈${TARGET.meanBrk} deathRate≈${TARGET.deathRate}\n`);
 console.log(`初始: meanStage=${baseEv.meanStage.toFixed(2)} meanBrk=${baseEv.meanBrk.toFixed(2)} deathRate=${baseEv.deathRate.toFixed(2)} f=${baseEv.fitness.toFixed(3)} ${JSON.stringify(snapshot(DEFAULT_BALANCE))}\n`);

let improvements = 0;
 for (let iter = 0; iter < ITERS; iter++) {
 const { params, knob } = perturb(best.params, rng);
 const ev = evaluate(params);
 if (ev.fitness > best.fitness) {
 improvements++;
 console.log(`iter${String(iter).padStart(2)} 改进: stage=${ev.meanStage.toFixed(2)} brk=${ev.meanBrk.toFixed(2)} death=${ev.deathRate.toFixed(2)} f=${ev.fitness.toFixed(3)} (${knob.label}→${getParam(params, knob.path)})`);
 best = { params, ...ev };
 }
 }

console.log(`\n=== 调参完成（${improvements} 次改进）===`);
 console.log(`before: stage=${baseEv.meanStage.toFixed(2)} brk=${baseEv.meanBrk.toFixed(2)} death=${baseEv.deathRate.toFixed(2)} f=${baseEv.fitness.toFixed(3)}`);
 console.log(`after : stage=${best.meanStage.toFixed(2)} brk=${best.meanBrk.toFixed(2)} death=${best.deathRate.toFixed(2)} f=${best.fitness.toFixed(3)}`);
 console.log(`调优后旋钮: ${JSON.stringify(snapshot(best.params))}`);
}

main;
