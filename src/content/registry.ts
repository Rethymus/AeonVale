/**
 * 内容注册表：加载 + Zod 校验内容数据（docs/11 §4 / docs/15）。
 * M1 内联种子内容（对齐 docs/15 §1 首批灵草）；后续里程碑迁移到 content 各子目录下的 JSON 文件 + 热重载。
 * 物品（材料/种子）由灵草表自动派生，避免重复维护。
 */
import type { ContentRegistry, ItemDef, PillDef, RecipeDef, SpiritHerbDef } from './defs';
import { spiritHerbSchema, itemSchema } from './schemas';

/** 灵草原始数据（毫点；对齐 docs/15-content-tables.md §1）。 */
const RAW_HERBS = [
  {
    id: 'herb.mossling',
    displayName: '凡间青苔',
    tier: 1 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 3000 },
    baseGrowth: 8_000,
    growthThreshold: 40_000,
    qiNeed: 5_000,
    qiDrainPerDay: 400,
    metalAttract: 0,
    seedId: 'seed.mossling',
    rawPoisonValue: 1_000,
    yield: [
      { itemId: 'herb.mossling', count: 1 },
      { itemId: 'seed.mossling', count: 1, chance: 0.5 },
    ],
  },
  {
    id: 'herb.dewroot',
    displayName: '露根草',
    tier: 1 as const,
    baseProperty: { cold: 2_000, hot: 0, warm: 1_000, neutral: 1_000 },
    baseGrowth: 7_000,
    growthThreshold: 45_000,
    qiNeed: 8_000,
    qiDrainPerDay: 600,
    metalAttract: 0,
    preferredSeason: 'spring' as const,
    seedId: 'seed.dewroot',
    rawPoisonValue: 3_000,
    yield: [
      { itemId: 'herb.dewroot', count: 1 },
      { itemId: 'seed.dewroot', count: 1, chance: 0.5 },
    ],
  },
  {
    id: 'herb.suncap',
    displayName: '朝阳菇',
    tier: 1 as const,
    baseProperty: { cold: 0, hot: 2_000, warm: 1_000, neutral: 1_000 },
    baseGrowth: 7_000,
    growthThreshold: 45_000,
    qiNeed: 8_000,
    qiDrainPerDay: 600,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.suncap',
    rawPoisonValue: 3_000,
    yield: [
      { itemId: 'herb.suncap', count: 1 },
      { itemId: 'seed.suncap', count: 1, chance: 0.5 },
    ],
  },
  {
    id: 'herb.frostmarrow',
    displayName: '寒髓草',
    tier: 2 as const,
    baseProperty: { cold: 6_000, hot: 0, warm: 2_000, neutral: 0 },
    baseGrowth: 5_000,
    growthThreshold: 80_000,
    qiNeed: 20_000,
    qiDrainPerDay: 1_200,
    metalAttract: 0,
    preferredSeason: 'winter' as const,
    seedId: 'seed.frostmarrow',
    rawPoisonValue: 8_000,
    yield: [
      { itemId: 'herb.frostmarrow', count: 1 },
      { itemId: 'seed.frostmarrow', count: 1, chance: 0.5 },
    ],
  },
  {
    id: 'herb.emberheart',
    displayName: '赤焰心',
    tier: 2 as const,
    baseProperty: { cold: 0, hot: 6_000, warm: 2_000, neutral: 0 },
    baseGrowth: 5_000,
    growthThreshold: 80_000,
    qiNeed: 20_000,
    qiDrainPerDay: 1_200,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.emberheart',
    rawPoisonValue: 8_000,
    yield: [
      { itemId: 'herb.emberheart', count: 1 },
      { itemId: 'seed.emberheart', count: 1, chance: 0.5 },
    ],
  },
  {
    id: 'herb.metalpine',
    displayName: '金雷引',
    tier: 3 as const,
    baseProperty: { cold: 1_000, hot: 1_000, warm: 0, neutral: 2_000 },
    baseGrowth: 4_000,
    growthThreshold: 120_000,
    qiNeed: 35_000,
    qiDrainPerDay: 1_600,
    metalAttract: 3.2, // 金属性避雷草（docs/15 / 14 P012 特化）
    preferredSeason: 'autumn' as const,
    seedId: 'seed.metalpine',
    rawPoisonValue: 5_000,
    yield: [
      { itemId: 'herb.metalpine', count: 1 },
      { itemId: 'seed.metalpine', count: 1, chance: 0.5 },
    ],
  },
];

/** 丹方原始数据（毫点；对齐 docs/15 §2，按已有 6 灵草适配）。 */
const RAW_RECIPES: RecipeDef[] = [
  {
    id: 'recipe.ward-pill',
    displayName: '避雷丹方',
    inputs: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }],
    idealHeatRange: [40_000, 55_000],
    targetProperty: { cold: 5_000, hot: 1_000, warm: 1_000, neutral: 4_000 },
    outputPillId: 'pill.ward-basic',
    difficulty: 2,
    reveal: 'known',
  },
  {
    id: 'recipe.bone-pill',
    displayName: '生骨丹方',
    inputs: [{ herbId: 'herb.emberheart', qty: 1 }, { herbId: 'herb.dewroot', qty: 1 }],
    idealHeatRange: [45_000, 60_000],
    targetProperty: { cold: 2_000, hot: 5_000, warm: 2_000, neutral: 1_000 },
    outputPillId: 'pill.bone-basic',
    difficulty: 2,
    reveal: 'known',
  },
  {
    id: 'recipe.detox-pill',
    displayName: '净毒丹方',
    inputs: [{ herbId: 'herb.dewroot', qty: 2 }],
    idealHeatRange: [25_000, 40_000],
    targetProperty: { cold: 4_000, hot: 0, warm: 1_000, neutral: 4_000 },
    outputPillId: 'pill.detox',
    difficulty: 2,
    reveal: 'fragment',
  },
  {
    id: 'recipe.cold-mud',
    displayName: '寒泥丸（涌现）',
    inputs: [{ herbId: 'herb.mossling', qty: 3 }],
    idealHeatRange: [10_000, 25_000],
    targetProperty: { cold: 2_000, hot: 0, warm: 0, neutral: 6_000 },
    outputPillId: 'pill.cold-mud',
    difficulty: 1,
    reveal: 'emergent',
  },
];

/** 丹药原始数据（毫点；对齐 docs/15 §3）。 */
const RAW_PILLS: PillDef[] = [
  {
    id: 'pill.ward-basic',
    displayName: '避雷丹',
    tier: 2,
    effects: [{ kind: 'lightningWard', power: 0.4 }],
    load: 5_000,
    stack: 20,
  },
  {
    id: 'pill.bone-basic',
    displayName: '生骨丹',
    tier: 2,
    effects: [{ kind: 'heal', power: 30_000 }],
    load: 4_000,
    stack: 20,
  },
  {
    id: 'pill.detox',
    displayName: '净毒丹',
    tier: 2,
    effects: [{ kind: 'detox', power: 25_000 }],
    load: 2_000,
    stack: 20,
  },
  {
    id: 'pill.cold-mud',
    displayName: '寒泥丸',
    tier: 1,
    effects: [],
    load: 2_000,
    stack: 30,
  },
];

/** 由灵草派生物品（材料 + 种子），减少重复维护。 */
function deriveItems(herbs: Iterable<SpiritHerbDef>): ItemDef[] {
  const items: ItemDef[] = [];
  for (const h of herbs) {
    items.push({
      id: h.id,
      displayName: h.displayName,
      category: 'material',
      stack: 30,
      description: `灵草材料·${h.displayName}（${['', '一', '二', '三', '四', '五'][h.tier]}阶）`,
    });
    items.push({
      id: h.seedId,
      displayName: `${h.displayName}种子`,
      category: 'seed',
      stack: 30,
      description: `${h.displayName}的种子，可种植。`,
    });
  }
  return items;
}

/** 构建 + 校验内容注册表。校验失败抛错（含路径）。 */
export function buildRegistry(): ContentRegistry {
  const herbs = new Map<string, SpiritHerbDef>();
  for (const raw of RAW_HERBS) {
    const parsed = spiritHerbSchema.parse(raw);
    herbs.set(parsed.id, parsed as SpiritHerbDef);
  }
  const items = new Map<string, ItemDef>();
  for (const raw of deriveItems(herbs.values())) {
    const parsed = itemSchema.parse(raw);
    items.set(parsed.id, parsed as ItemDef);
  }
  const seedToHerb = new Map<string, SpiritHerbDef>();
  for (const h of herbs.values()) seedToHerb.set(h.seedId, h);

  const recipes = new Map<string, RecipeDef>();
  for (const r of RAW_RECIPES) recipes.set(r.id, r);
  const pills = new Map<string, PillDef>();
  for (const p of RAW_PILLS) pills.set(p.id, p);
  // 丹药品类也注册为可堆叠物品（便于背包/快捷栏统一处理）
  for (const p of RAW_PILLS) {
    items.set(p.id, { id: p.id, displayName: p.displayName, category: 'pill', stack: p.stack });
  }

  // schemaHash：内容指纹（docs/11 §3.2）。简化哈希。
  const schemaHash = simpleHash(
    [...herbs.keys()].join(',') + '|' + [...items.keys()].join(',') + '|' + [...recipes.keys()].join(','),
  );
  return { herbs, items, recipes, pills, seedToHerb, schemaHash };
}

function simpleHash(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
