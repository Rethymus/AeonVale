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

let SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
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

const START = { min: 6, source: 125 };

function main(): void {
  const args = process.argv.slice(2);
  const exhaustive = args.includes('--exhaustive');
  const itersIndex = args.indexOf('--iters');
  const seedStartIndex = args.indexOf('--seed-start');
  const seedsCountIndex = args.indexOf('--seeds');
  const startMinIndex = args.indexOf('--start-min');
  const startSourceIndex = args.indexOf('--start-source');
  const iters = itersIndex >= 0 ? Number(args[itersIndex + 1]) : ITERS;
  if (!Number.isInteger(iters) || iters <= 0) throw new Error('--iters must be a positive integer');
  if (seedStartIndex >= 0) {
    const start = Number(args[seedStartIndex + 1]);
    const count = seedsCountIndex >= 0 ? Number(args[seedsCountIndex + 1]) : SEEDS.length;
    if (!Number.isInteger(start) || start <= 0 || !Number.isInteger(count) || count <= 0) throw new Error('--seed-start/--seeds must be positive integers');
    SEEDS = Array.from({ length: count }, (_, i) => start + i);
  }
  if (startMinIndex >= 0) {
    const v = Number(args[startMinIndex + 1]);
    if (!Number.isInteger(v)) throw new Error('--start-min must be an integer');
    START.min = v;
  }
  if (startSourceIndex >= 0) {
    const v = Number(args[startSourceIndex + 1]);
    if (!Number.isInteger(v)) throw new Error('--start-source must be an integer');
    START.source = v;
  }

  if (exhaustive) {
    runExhaustive();
    return;
  }
  const rng = new Rng(42);
  let current = { ...START };
  let best = evaluate(withTribulation(current.min, current.source));
  console.log(`修途邻域 hill-climb（${iters} 轮，2 策略 × ${SEEDS.length} 种子(${SEEDS[0]}..${SEEDS[SEEDS.length - 1]}) × ${GENERATIONS} 代/评估，起点 (${current.min},${current.source})）`);
  console.log(`目标: hybridAsc≈0.875 asceticAsc≈0.65 asceticGate≈0.2`);
  console.log(`起点 (${current.min},${current.source}): hybrid=${best.hybridAsc.toFixed(3)} ascetic=${best.asceticAsc.toFixed(3)} gate=${best.asceticGate.toFixed(3)} penalty=${best.penalty.toFixed(3)}\n`);

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

function runExhaustive(): void {
  interface Cell {
    readonly min: number;
    readonly source: number;
    readonly hybridAsc: number;
    readonly asceticAsc: number;
    readonly asceticGate: number;
    readonly penalty: number;
  }
  const cells: Cell[] = [];
  const seedsNote = `${SEEDS.length} 种子(${SEEDS[0]}..${SEEDS[SEEDS.length - 1]})`;
  console.log(`全景观穷举：min 5-7 × source 120-130（33 格 × 2 策略 × ${seedsNote} × ${GENERATIONS} 代）`);
  let done = 0;
  for (let min = 5; min <= 7; min++) {
    for (let source = 120; source <= 130; source++) {
      const ev = evaluate(withTribulation(min, source));
      cells.push({ min, source, hybridAsc: ev.hybridAsc, asceticAsc: ev.asceticAsc, asceticGate: ev.asceticGate, penalty: ev.penalty });
      done += 1;
      console.error(`[exhaustive] ${done}/33 (${min},${source}) penalty=${ev.penalty.toFixed(3)}`);
    }
  }

  const byPenalty = [...cells].sort((a, b) => a.penalty - b.penalty);
  console.log('\n== 复合罚排名（前 8） ==');
  for (const cell of byPenalty.slice(0, 8)) {
    console.log(`  (${cell.min},${cell.source}) penalty=${cell.penalty.toFixed(3)} hybrid=${cell.hybridAsc.toFixed(3)} ascetic=${cell.asceticAsc.toFixed(3)} gate=${cell.asceticGate.toFixed(3)}`);
  }

  // Pareto 前沿（NSGA-II 式非支配集）：目标 hybridAsc↑ / asceticAsc↑ / |gate−0.2|↓
  const gateErr = (c: Cell): number => Math.abs(c.asceticGate - 0.2);
  const dominates = (a: Cell, b: Cell): boolean => {
    const oa = [a.hybridAsc, a.asceticAsc, -gateErr(a)];
    const ob = [b.hybridAsc, b.asceticAsc, -gateErr(b)];
    return oa.every((v, i) => v >= ob[i]!) && oa.some((v, i) => v > ob[i]!);
  };
  const front = cells.filter(c => !cells.some(o => dominates(o, c)));
  console.log('\n== Pareto 非支配前沿 ==');
  for (const c of front.sort((a, b) => a.min - b.min || a.source - b.source)) {
    console.log(`  (${c.min},${c.source}) hybrid=${c.hybridAsc.toFixed(3)} ascetic=${c.asceticAsc.toFixed(3)} gate=${c.asceticGate.toFixed(3)} penalty=${c.penalty.toFixed(3)}`);
  }

  const globalBest = byPenalty[0]!;
  const sweet = cells.find(c => c.min === 6 && c.source === 125)!;
  console.log(`\n全局最优点: (${globalBest.min},${globalBest.source}) penalty=${globalBest.penalty.toFixed(3)}`);
  console.log(`(6,125) penalty=${sweet.penalty.toFixed(3)}｜${globalBest.penalty < sweet.penalty ? '存在更优格——需复核' : '(6,125) 穷举确认全局最优'}`);
  console.log('适用性结论：2 维离散 33 格空间内穷举严格强于 CMA-ES/NSGA-II（元启发式仅适用于高维/连续/不可枚举空间）；参数空间扩至 ≥3 维或连续化时应换回元启发式。');
}

main();
