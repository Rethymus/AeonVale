/**
 * 内容数据完整性校验工具。
 *
 * 校验规则：
 * 灵草：tier ∈ {1,2,3,4,5}、growthThreshold > 0、rawPoisonValue ≥ 0、baseProperty 分量 ≥ 0
 * seedId 对应物品存在、yield 物品 id 存在于物品表
 * 丹药：tier ∈ {1,2,3,4}、load ≥ 0、effects 中 power 合法
 * 配方：inputs 中所有 herbId 存在、outputPillId 存在、idealHeatRange[0] ≤ [1]
 * 天象：weight > 0、durationDays > 0、growthMod > 0、qiMod > 0
 * 阵法：modifier > 0、radius > 0
 * i18n：词典死键（无静态引用且不匹配动态前缀）与缺键（静态引用但词典缺失）
 *
 * 用法：pnpm content:lint
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildRegistry } from '@content/registry';

const reg = buildRegistry();
let errors = 0;
let warnings = 0;

function fail(msg: string) {
  console.error(` ✗ ERROR: ${msg}`);
  errors++;
}

function warn(msg: string) {
  console.warn(` ⚠ WARN: ${msg}`);
  warnings++;
}

function ok(msg: string) {
  console.log(` ✓ ${msg}`);
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
  if (!ev.forced && ev.weight <= 0) fail(`${id}: weight=${ev.weight} ≤ 0`); // forced/seasonal 事件不走随机池，权重无意义
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

// ── i18n 词典键校验 ───────────────────────────────────────────────────────────
// 运行时以 `t('字面量')`、`tList('字面量')` 或动态前缀（`t(\`ui.objective.${id}\`)`、
// `t('ending.' + id)`）取词。词典里既无静态引用又不匹配任何动态前缀的键视为死键；
// 静态引用但词典缺失的键视为缺键（t() 会把裸键渲染给玩家）。两向都算错误。
{
  console.log('\n── i18n 词典（zh-CN）──');
  type Dict = Record<string, unknown>;
  const dict = JSON.parse(readFileSync(new URL('../src/content/locales/zh-CN.json', import.meta.url), 'utf8')) as Dict;
  const leaves: string[] = [];
  (function walk(node: Dict, path: string) {
    for (const [key, value] of Object.entries(node)) {
      const full = path ? `${path}.${key}` : key;
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) walk(value as Dict, full);
      else leaves.push(full);
    }
  })(dict, '');

  // 动态前缀：这些键在运行时按前缀拼接，静态扫描无法穷举。
  const dynamicPrefixes = ['ui.objective.', 'ui.hud.season.', 'ending.', 'narration.ending.', 'narration.heartPulse.'];
  const isDynamic = (key: string) => dynamicPrefixes.some(prefix => key.startsWith(prefix));

  const sources: string[] = [];
  const collectTs = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) collectTs(full);
      else if (entry.name.endsWith('.ts')) sources.push(readFileSync(full, 'utf8'));
    }
  };
  collectTs('src');
  // 只扫描 src/（玩家可见文本的生产引用）；剥离注释，避免把讲解文字里的 t('…') 当引用。
  const stripped = sources.map(text =>
    text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  );

  const literalKeys = new Set<string>();
  const keyLikeStrings = new Set<string>();
  const dynamicSeen = new Set<string>();
  for (const text of stripped) {
    for (const match of text.matchAll(/\bt(?:List)?\(\s*['"]([^'"]+)['"]\s*[,)]/g)) literalKeys.add(match[1]!);
    for (const match of text.matchAll(/['"]([a-z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9-]+)+)['"]/g)) keyLikeStrings.add(match[1]!);
    for (const match of text.matchAll(/\bt(?:List)?\(\s*`([^`$]+)\$\{/g)) dynamicSeen.add(match[1]!);
  }

  // 插值测试锚点：仅由 i18n 插值单测使用的键（对应渲染文本尚未外部化，见 docs/21 §8.3）。
  const testAnchorKeys = new Set(['ui.hud.day', 'ui.hud.year']);

  let dead = 0;
  for (const key of leaves) {
    if (literalKeys.has(key) || keyLikeStrings.has(key) || isDynamic(key) || testAnchorKeys.has(key)) continue;
    fail(`i18n 死键（词典有、代码无引用且非动态前缀）：${key}`);
    dead++;
  }
  let missing = 0;
  for (const key of literalKeys) {
    if (leaves.includes(key)) continue;
    fail(`i18n 缺键（代码引用、词典没有，玩家会看到裸键）：${key}`);
    missing++;
  }
  for (const prefix of dynamicSeen) {
    if (dynamicPrefixes.some(p => prefix.startsWith(p))) continue;
    fail(`i18n 未登记的动态前缀（请把它加入 content-lint 的 dynamicPrefixes）：${prefix}`);
    missing++;
  }
  if (dead === 0 && missing === 0) ok(`${leaves.length} 个词典键校验完成（动态前缀 ${dynamicPrefixes.length} 组）`);
}

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
