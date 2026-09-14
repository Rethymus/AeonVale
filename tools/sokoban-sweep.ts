/**
 * 天劫 Sokoban 难度带全量扫描（docs/31 §1.3 验证 + P3 数据底座）。
 *
 * 只读驱动 @sim/sokoban 纯函数（不进 sim 改动）：对每阶 × N 个 seedSalt 生成棋盘，
 * 采集认证步数带 adherence、预算松紧、劫式三型/阵型分布、修饰附着率、首步扇出、
 * 求解器规模与模板兜底率；并抽验 (stage, salt) 级确定性。
 *
 * 运行：node node_modules/tsx/dist/cli.mjs tools/sokoban-sweep.ts [--salts 200] [--stages 0-6]
 */
import { createPuzzle, generateBoard, bandCenterForStage, SOKOBAN_BAND_RADIUS, type SokobanState } from '@sim/sokoban';
import { Rng } from '@sim/core/rng';

interface Row {
  stage: number;
  salt: number;
  certified: number;
  budget: number;
  slack: number;
  slackRatio: number;
  flavor: string;
  archetype: string;
  required: string;
  fanout: number;
  solverNodes: number;
  herbs: number;
  width: number;
  height: number;
  modifiers: number;
  fallback: boolean;
}

function rowFor(stage: number, salt: number): Row {
  const state: SokobanState = createPuzzle(stage, salt, undefined, {});
  const c = state.challenge!;
  const fallback = generateBoard(stage, new Rng(`sokoban:${stage}:${salt}`), {}) == null;
  const modifiers = (state.board.blockModifiers ?? []).filter(m => m !== 'none').length;
  return {
    stage,
    salt,
    certified: c.certifiedMoves,
    budget: state.moveBudget,
    slack: c.budgetSlack,
    slackRatio: c.certifiedMoves > 0 ? c.budgetSlack / c.certifiedMoves : 1,
    flavor: c.flavorTag,
    archetype: c.archetype,
    required: [...c.requiredBlockKinds].sort().join('+'),
    fanout: c.firstMoveFanout,
    solverNodes: c.solverNodes,
    herbs: state.herbsTotal,
    width: state.board.width,
    height: state.board.height,
    modifiers,
    fallback
  };
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[idx]!;
}

function summarizeStage(rows: readonly Row[], stage: number): string {
  const bandCenter = bandCenterForStage(stage);
  const bandRadius = SOKOBAN_BAND_RADIUS;
  const certs = rows.map(r => r.certified).sort((a, b) => a - b);
  const inBand = rows.filter(r => Math.abs(r.certified - bandCenter) <= bandRadius);
  const fallbacks = rows.filter(r => r.fallback);
  const flavors = new Map<string, number>();
  const archetypes = new Map<string, number>();
  const requireds = new Map<string, number>();
  for (const r of rows) {
    flavors.set(r.flavor, (flavors.get(r.flavor) ?? 0) + 1);
    archetypes.set(r.archetype, (archetypes.get(r.archetype) ?? 0) + 1);
    requireds.set(r.required, (requireds.get(r.required) ?? 0) + 1);
  }
  const fmt = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(' ');
  const modRows = rows.filter(r => r.modifiers > 0);
  const lowFanout = rows.filter(r => r.fanout <= 1);
  const heavySolver = rows.filter(r => r.solverNodes >= 4000);
  return [
    `stage ${stage}（带心 ${bandCenter} ±${bandRadius}，n=${rows.length}）`,
    `  认证步: min=${certs[0]} p25=${quantile(certs, 0.25)} 中位=${quantile(certs, 0.5)} p75=${quantile(certs, 0.75)} max=${certs.at(-1)}`,
    `  带内率: ${inBand.length}/${rows.length}（${((inBand.length / rows.length) * 100).toFixed(1)}%）｜模板兜底: ${fallbacks.length}`,
    `  松紧比中位: ${(rows.map(r => r.slackRatio).sort((a, b) => a - b)[Math.floor(rows.length / 2)]!).toFixed(2)}｜低扇出(≤1): ${lowFanout.length}｜重解(≥4000节点): ${heavySolver.length}`,
    `  劫式三型: ${fmt(flavors)}｜阵型: ${fmt(archetypes)}`,
    `  必需石: ${fmt(requireds)}｜修饰附着: ${modRows.length}/${rows.length}`,
    `  灵草数: ${[...new Set(rows.map(r => r.herbs))].sort((a, b) => a - b).join(',')}｜板面: ${[...new Set(rows.map(r => `${r.width}x${r.height}`))].join(',')}`
  ].join('\n');
}

// ── 参数 ──
const args = process.argv.slice(2);
const saltArg = args.find(a => a.startsWith('--salts'))?.split('=')[1] ?? args[args.indexOf('--salts') + 1];
const stageArg = args.find(a => a.startsWith('--stages'))?.split('=')[1] ?? args[args.indexOf('--stages') + 1];
const SALTS = Number(saltArg ?? 200);
const [s0, s1] = stageArg ? stageArg.split('-').map(Number) : [0, 6];
const STAGES: number[] = Array.from({ length: (s1 ?? 6) - (s0 ?? 0) + 1 }, (_, i) => (s0 ?? 0) + i);

console.log(`sokoban sweep: stages ${STAGES[0]}..${STAGES.at(-1)} × salts 0..${SALTS - 1}`);
const t0 = Date.now();
const allRows: Row[] = [];
for (const stage of STAGES) {
  const rows: Row[] = [];
  const stageT0 = Date.now();
  for (let salt = 0; salt < SALTS; salt++) {
    rows.push(rowFor(stage, salt));
    if ((salt + 1) % 10 === 0) console.error(`  [stage ${stage}] ${salt + 1}/${SALTS}（${((Date.now() - stageT0) / 1000).toFixed(1)}s）`);
  }
  allRows.push(...rows);
  console.log(summarizeStage(rows, stage));
}

// 确定性抽验：每阶抽 5 个 salt 重跑比对 JSON
let determinismViolations = 0;
for (const stage of STAGES) {
  for (const salt of [0, 7, 33, 64, SALTS - 1]) {
    const a = createPuzzle(stage, salt);
    const b = createPuzzle(stage, salt);
    if (JSON.stringify(a) !== JSON.stringify(b)) determinismViolations += 1;
  }
}
console.log(`\n确定性抽验: ${determinismViolations === 0 ? '通过（0 违例）' : `失败 ${determinismViolations} 例`}`);
console.log(`总耗时: ${((Date.now() - t0) / 1000).toFixed(1)}s ｜ 样本 ${allRows.length}`);
