/**
 * 修途邻域 hill-climb（docs/32 §20）：验证 §18 推荐点 (min=6, source=125)
 * 在其邻域（min 5-7 × source 120-130）内是否局部最优。
 *
 * 适应度（越大越好，0 为完美）= 双路线飞升贴近目标 + 教学门带：
 *   penalty = |hybridAsc - 0.875| + |asceticAsc - 0.65| + |asceticGate - 0.2| × 2
 *   - hybrid 飞升目标 0.875（§18 甜点实测）
 *   - ascetic 飞升目标 0.65（苦修可成但容错更低的路线分化语义）
 *   - ascetic stage-0 过载死目标 0.2（教学门存在但有幸存者）
 *
 * 评估 = 2 策略 × 8 种子 × 换代上限 4（复用 cultivation-metrics 的确定性
 * runLife）；hill-climb 骨架与 tools/balance-tune.ts 一致。确定性：同
 * (seed,policy,params) 复跑一致，爬山序列由固定种子 Rng 驱动。
 *
 * 用法：node node_modules/tsx/dist/cli.mjs tools/cultivation-tune.ts [--iters 24]
 */
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from '@sim/params';
import { Rng } from '@sim/world/rng';
import { runLife, type LifeOutcome, type PolicyId } from './cultivation-metrics';

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const GENERATIONS = 4;
const ITERS = 24;

interface Knob {
  key: 'min' | 'source';
  label: string;
  min: number;
  max: number;
  step: number;
}

const KNOBS: readonly Knob[] = [
  { key: 'min', label: 'minSlope', min: 5, max: 7, step: 1 },
  { key: 'source', label: 'sourcePower', min: 120, max: 130, step: 5 }
];

interface EvalResult {
  readonly hybridAsc: number;
  readonly asceticAsc: number;
  readonly asceticGate: number;
  readonly penalty: number;
}

function evaluate(params: BalanceParams): EvalResult {
  const outcomes = new Map<PolicyId, LifeOutcome[]>();
  for (const policy of ['hybrid', 'ascetic'] as const) {
    outcomes.set(policy, SEEDS.map(seed => runLife(seed, policy, params, GENERATIONS)));
  }
  const rate = (policy: PolicyId): number => {
    const o = outcomes.get(policy)!;
    return o.filter(x => x.finalStatus === 'ascended').length / o.length;
  };
  const hybridAsc = rate('hybrid');
  const asceticAsc = rate('ascetic');
  const asceticGate = outcomes.get('ascetic')!.filter(o => o.deathCause === 'tribulation-overload' && o.maxStage === 0).length / SEEDS.length;
  const penalty = Math.abs(hybridAsc - 0.875) + Math.abs(asceticAsc - 0.65) + Math.abs(asceticGate - 0.2) * 2;
  return { hybridAsc, asceticAsc, asceticGate, penalty };
}

function withTribulation(min: number, source: number): BalanceParams {
  const base = withDefaultBalanceParams(DEFAULT_BALANCE);
  return {
    ...base,
    cultivationRun: {
      ...base.cultivationRun,
      tribulation: {
        ...base.cultivationRun.tribulation,
        stageMinTemperingPower: min,
        baseSourcePower: source
      }
    }
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const itersIndex = args.indexOf('--iters');
  const iters = itersIndex >= 0 ? Number(args[itersIndex + 1]) : ITERS;
  if (!Number.isInteger(iters) || iters <= 0) throw new Error('--iters must be a positive integer');

  const rng = new Rng(42);
  let current = { min: 6, source: 125 };
  let best = evaluate(withTribulation(current.min, current.source));
  console.log(`修途邻域 hill-climb（${iters} 轮，2 策略 × ${SEEDS.length} 种子 × ${GENERATIONS} 代/评估）`);
  console.log(`目标: hybridAsc≈0.875 asceticAsc≈0.65 asceticGate≈0.2`);
  console.log(`起点 (6,125): hybrid=${best.hybridAsc.toFixed(3)} ascetic=${best.asceticAsc.toFixed(3)} gate=${best.asceticGate.toFixed(3)} penalty=${best.penalty.toFixed(3)}\n`);

  let improvements = 0;
  for (let iter = 0; iter < iters; iter++) {
    const knob = KNOBS[rng.intRange(0, KNOBS.length - 1)]!;
    const dir = rng.chance(0.5) ? 1 : -1;
    const next = {
      min: current.min + (knob.key === 'min' ? dir * knob.step : 0),
      source: current.source + (knob.key === 'source' ? dir * knob.step : 0)
    };
    next.min = Math.max(knobMin('min'), Math.min(knobMax('min'), next.min));
    next.source = Math.max(knobMin('source'), Math.min(knobMax('source'), next.source));
    if (next.min === current.min && next.source === current.source) continue;

    const ev = evaluate(withTribulation(next.min, next.source));
    if (ev.penalty < best.penalty) {
      improvements++;
      console.log(`iter${String(iter).padStart(2)} 改进: (${next.min},${next.source}) hybrid=${ev.hybridAsc.toFixed(3)} ascetic=${ev.asceticAsc.toFixed(3)} gate=${ev.asceticGate.toFixed(3)} penalty=${ev.penalty.toFixed(3)}`);
      current = next;
      best = ev;
    }
  }

  console.log(`\n=== 调参完成（${improvements} 次改进）===`);
  console.log(`最优点: (min=${current.min}, source=${current.source}) penalty=${best.penalty.toFixed(3)}`);
  if (improvements === 0) console.log('(6,125) 在邻域内局部最优：无改进方向。');
}

function knobMin(key: Knob['key']): number {
  return KNOBS.find(k => k.key === key)!.min;
}
function knobMax(key: Knob['key']): number {
  return KNOBS.find(k => k.key === key)!.max;
}

main();
