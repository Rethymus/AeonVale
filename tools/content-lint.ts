/**
 * 内容数据完整性校验工具（docs/15 / docs/11 §4）。
 *
 * 校验规则：
 *   灵草：tier ∈ {1,2,3,4}、growthThreshold > 0、rawPoisonValue ≥ 0、baseProperty 分量 ≥ 0
 *         seedId 对应物品存在、yield 物品 id 存在于物品表
 *   丹药：tier ∈ {1,2,3,4}、load ≥ 0、effects 中 power 合法
 *   配方：inputs 中所有 herbId 存在、outputPillId 存在、idealHeatRange[0] ≤ [1]
 *   天象：weight > 0、durationDays > 0、growthMod > 0、qiMod > 0
 *   阵法：modifier > 0、radius > 0
 *
 * 用法：pnpm content:lint
 */
import { buildRegistry } from '@content/registry';

const reg = buildRegistry();
let errors = 0;
let warnings = 0;

function fail(msg: string) {
  console.error(`  ✗ ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(`  ⚠ WARN: ${msg}`);
  warnings++;
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

// ── 物品表 ────────────────────────────────────────────────────────────────────
console.log('\n── 物品表（items）──');
for (const [id, item] of reg.items) {
  if (!item.displayName || item.displayName.trim() === '') fail(`${id}: displayName 为空`);
}
ok(`${reg.items.size} 个物品校验完成`);

// ── 灵草表 ────────────────────────────────────────────────────────────────────
console.log('\n── 灵草表（herbs）──');
for (const [id, herb] of reg.herbs) {
  if (![1, 2, 3, 4, 5].includes(herb.tier)) fail(`${id}: tier=${herb.tier} 不合法`);
  if (herb.growthThreshold <= 0) fail(`${id}: growthThreshold=${herb.growthThreshold} ≤ 0`);
  if (herb.baseGrowth <= 0) fail(`${id}: baseGrowth=${herb.baseGrowth} ≤ 0`);
  if (herb.rawPoisonValue < 0) fail(`${id}: rawPoisonValue=${herb.rawPoisonValue} < 0`);
  if (herb.metalAttract < 0) fail(`${id}: metalAttract=${herb.metalAttract} < 0`);
  const { cold, hot, warm, neutral } = herb.baseProperty;
  for (const [comp, val] of Object.entries({ cold, hot, warm, neutral })) {
    if (val < 0) fail(`${id}: baseProperty.${comp}=${val} < 0`);
  }
  // seedId 存在
  if (herb.seedId && !reg.items.has(herb.seedId)) {
    fail(`${id}: seedId='${herb.seedId}' 不在物品表`);
  }
  // yield 物品 id 存在
  for (const y of herb.yield) {
    if (!reg.items.has(y.itemId)) fail(`${id}: yield.itemId='${y.itemId}' 不在物品表`);
    if (y.count <= 0) fail(`${id}: yield.count=${y.count} ≤ 0`);
    if (y.chance !== undefined && (y.chance < 0 || y.chance > 1)) {
      fail(`${id}: yield.chance=${y.chance} 超出 [0,1]`);
    }
  }
  if (herb.qiNeed <= 0) warn(`${id}: qiNeed=${herb.qiNeed} ≤ 0（可能是零灵气草药）`);
}
ok(`${reg.herbs.size} 种灵草校验完成`);

// ── 丹药表 ────────────────────────────────────────────────────────────────────
console.log('\n── 丹药表（pills）──');
for (const [id, pill] of reg.pills) {
  if (![1, 2, 3, 4, 5].includes(pill.tier)) fail(`${id}: tier=${pill.tier} 不合法`);
  if (pill.load < 0) fail(`${id}: load=${pill.load} < 0`);
  if (pill.stack !== undefined && pill.stack <= 0) fail(`${id}: stack=${pill.stack} ≤ 0`);
  for (const eff of pill.effects) {
    const known = ['heal', 'detox', 'lightningWard', 'maxHpUp', 'madness', 'temperBoost', 'ascend', 'ironBone'];
    if (!known.includes(eff.kind)) warn(`${id}: 未知 effect.kind='${eff.kind}'`);
    if ('power' in eff && (eff as { power: number }).power < 0) {
      fail(`${id}: effect.${eff.kind}.power < 0`);
    }
  }
}
ok(`${reg.pills.size} 种丹药校验完成`);

// ── 配方表 ────────────────────────────────────────────────────────────────────
console.log('\n── 配方表（recipes）──');
for (const [id, recipe] of reg.recipes) {
  for (const inp of recipe.inputs) {
    if (!reg.herbs.has(inp.herbId)) fail(`${id}: inputs.herbId='${inp.herbId}' 不在灵草表`);
    if (inp.qty <= 0) fail(`${id}: inputs.qty=${inp.qty} ≤ 0`);
  }
  if (recipe.inputs.length === 0) fail(`${id}: inputs 为空`);
  if (recipe.outputPillId && !reg.pills.has(recipe.outputPillId)) {
    fail(`${id}: outputPillId='${recipe.outputPillId}' 不在丹药表`);
  }
  const [lo, hi] = recipe.idealHeatRange;
  if (lo > hi) fail(`${id}: idealHeatRange [${lo},${hi}] 下界 > 上界`);
  if (lo < 0) fail(`${id}: idealHeatRange 下界 < 0`);
  if (recipe.difficulty < 1 || recipe.difficulty > 5) {
    warn(`${id}: difficulty=${recipe.difficulty} 超出 [1,5]`);
  }
}
ok(`${reg.recipes.size} 种配方校验完成`);

// ── 天象表 ────────────────────────────────────────────────────────────────────
console.log('\n── 天象表（events）──');
for (const [id, ev] of reg.events) {
  if (ev.weight <= 0) fail(`${id}: weight=${ev.weight} ≤ 0`);
  if (ev.durationDays <= 0) fail(`${id}: durationDays=${ev.durationDays} ≤ 0`);
  if (ev.growthMod <= 0) fail(`${id}: growthMod=${ev.growthMod} ≤ 0`);
  if (ev.qiMod <= 0) fail(`${id}: qiMod=${ev.qiMod} ≤ 0`);
  const known = ['joy', 'grief', 'crisis', 'opportunity'];
  if (!known.includes(ev.type)) warn(`${id}: 未知天象类型 type='${ev.type}'`);
}
ok(`${reg.events.size} 种天象校验完成`);

// ── 阵法表 ────────────────────────────────────────────────────────────────────
console.log('\n── 阵法表（arrays）──');
for (const [id, arr] of reg.arrays) {
  if (arr.modifier <= 0) fail(`${id}: modifier=${arr.modifier} ≤ 0`);
  if (arr.radius <= 0) fail(`${id}: radius=${arr.radius} ≤ 0`);
  const known = ['rod', 'insulation'];
  if (!known.includes(arr.type)) warn(`${id}: 未知阵法类型 type='${arr.type}'`);
}
ok(`${reg.arrays.size} 种阵法校验完成`);

// ── 汇总 ──────────────────────────────────────────────────────────────────────
console.log(`\n── 汇总 ──`);
console.log(`总物品: ${reg.items.size} 灵草: ${reg.herbs.size} 丹药: ${reg.pills.size} 配方: ${reg.recipes.size} 天象: ${reg.events.size} 阵法: ${reg.arrays.size}`);
if (errors > 0) {
  console.error(`\n✗ content-lint 失败：${errors} 个错误，${warnings} 个警告`);
  process.exit(1);
} else {
  console.log(`\n✓ content-lint 通过（${warnings} 个警告）`);
  process.exit(0);
}
