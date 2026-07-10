/**
 * 内容注册表：加载 + Zod 校验内容数据（docs/11 §4 / docs/15）。
 * M1 内联种子内容（对齐 docs/15 §1 首批灵草）；后续里程碑迁移到 content 各子目录下的 JSON 文件 + 热重载。
 * 物品（材料/种子）由灵草表自动派生，避免重复维护。
 */
import type { ArrayDef, CelestialEventDef, ContentRegistry, ItemDef, PillDef, RecipeDef, SpiritHerbDef } from './defs';
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
  {
    id: 'herb.balmleaf',
    displayName: '和合叶',
    tier: 2 as const,
    baseProperty: { cold: 1_000, hot: 1_000, warm: 2_000, neutral: 4_000 },
    baseGrowth: 6_000,
    growthThreshold: 75_000,
    qiNeed: 18_000,
    qiDrainPerDay: 1_000,
    metalAttract: 0,
    preferredSeason: 'autumn' as const,
    seedId: 'seed.balmleaf',
    rawPoisonValue: 2_000,
    yield: [{ itemId: 'herb.balmleaf', count: 1 }, { itemId: 'seed.balmleaf', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.thunderreed',
    displayName: '引雷芦',
    tier: 3 as const,
    baseProperty: { cold: 2_000, hot: 0, warm: 0, neutral: 3_000 },
    baseGrowth: 4_000,
    growthThreshold: 130_000,
    qiNeed: 32_000,
    qiDrainPerDay: 1_500,
    metalAttract: 2.4, // 第二种避雷草
    preferredSeason: 'spring' as const,
    seedId: 'seed.thunderreed',
    rawPoisonValue: 4_000,
    yield: [{ itemId: 'herb.thunderreed', count: 1 }, { itemId: 'seed.thunderreed', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.griefvein',
    displayName: '断肠藤',
    tier: 3 as const,
    baseProperty: { cold: 5_000, hot: 4_000, warm: 0, neutral: 0 }, // 寒热同体：核心脆弱药草，丹毒极高
    baseGrowth: 4_000,
    growthThreshold: 140_000,
    qiNeed: 38_000,
    qiDrainPerDay: 1_800,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.griefvein',
    rawPoisonValue: 9_000,
    yield: [{ itemId: 'herb.griefvein', count: 1 }, { itemId: 'seed.griefvein', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.ironwill-thorn',
    displayName: '铁心刺',
    tier: 4 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 5_000 },
    baseGrowth: 3_000,
    growthThreshold: 220_000,
    qiNeed: 52_000,
    qiDrainPerDay: 2_000,
    metalAttract: 4.0, // 最强避雷草（塔防核心布防件）
    seedId: 'seed.ironwill-thorn',
    rawPoisonValue: 4_000,
    yield: [{ itemId: 'herb.ironwill-thorn', count: 1 }, { itemId: 'seed.ironwill-thorn', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.boneash-lily',
    displayName: '劫灰百合',
    tier: 4 as const,
    baseProperty: { cold: 3_000, hot: 3_000, warm: 3_000, neutral: 2_000 }, // 四性均衡万能调平剂
    baseGrowth: 3_000,
    growthThreshold: 200_000,
    qiNeed: 55_000,
    qiDrainPerDay: 2_200,
    metalAttract: 0.8,
    preferredSeason: 'autumn' as const,
    seedId: 'seed.boneash-lily',
    rawPoisonValue: 3_000,
    yield: [{ itemId: 'herb.boneash-lily', count: 1 }, { itemId: 'seed.boneash-lily', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.violet-ascend',
    displayName: '紫极芝',
    tier: 5 as const,
    baseProperty: { cold: 4_000, hot: 4_000, warm: 4_000, neutral: 4_000 }, // 终极料
    baseGrowth: 2_000,
    growthThreshold: 360_000,
    qiNeed: 80_000,
    qiDrainPerDay: 3_000,
    metalAttract: 1.2,
    seedId: 'seed.violet-ascend',
    rawPoisonValue: 6_000,
    yield: [{ itemId: 'herb.violet-ascend', count: 1 }, { itemId: 'seed.violet-ascend', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.silentbell',
    displayName: '噤声铃',
    tier: 3 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 7_000 }, // 强平性中和剂
    baseGrowth: 5_000,
    growthThreshold: 120_000,
    qiNeed: 30_000,
    qiDrainPerDay: 1_400,
    metalAttract: 0,
    seedId: 'seed.silentbell',
    rawPoisonValue: 4_000,
    yield: [{ itemId: 'herb.silentbell', count: 1 }, { itemId: 'seed.silentbell', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.voidmantle',
    displayName: '虚衾蕈',
    tier: 4 as const,
    baseProperty: { cold: 7_000, hot: 0, warm: 1_000, neutral: 1_000 }, // 极寒
    baseGrowth: 3_000,
    growthThreshold: 210_000,
    qiNeed: 58_000,
    qiDrainPerDay: 2_400,
    metalAttract: 0,
    preferredSeason: 'winter' as const,
    seedId: 'seed.voidmantle',
    rawPoisonValue: 7_000,
    yield: [{ itemId: 'herb.voidmantle', count: 1 }, { itemId: 'seed.voidmantle', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.solar-pith',
    displayName: '太阳髓',
    tier: 4 as const,
    baseProperty: { cold: 0, hot: 7_000, warm: 1_000, neutral: 1_000 }, // 极热（与虚衾蕈相反必炸）
    baseGrowth: 3_000,
    growthThreshold: 210_000,
    qiNeed: 58_000,
    qiDrainPerDay: 2_400,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.solar-pith',
    rawPoisonValue: 7_000,
    yield: [{ itemId: 'herb.solar-pith', count: 1 }, { itemId: 'seed.solar-pith', count: 1, chance: 0.5 }],
  },
  {
    id: 'herb.dao-root',
    displayName: '大道残根',
    tier: 5 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 10_000 }, // 传说级中和剂
    baseGrowth: 2_000,
    growthThreshold: 400_000,
    qiNeed: 85_000,
    qiDrainPerDay: 3_200,
    metalAttract: 0,
    seedId: 'seed.dao-root',
    rawPoisonValue: 5_000,
    yield: [{ itemId: 'herb.dao-root', count: 1 }, { itemId: 'seed.dao-root', count: 1, chance: 0.5 }],
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
  {
    id: 'recipe.temper-pill',
    displayName: '淬体丹方',
    inputs: [{ herbId: 'herb.griefvein', qty: 1 }, { herbId: 'herb.emberheart', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }],
    idealHeatRange: [50_000, 70_000],
    targetProperty: { cold: 5_000, hot: 5_000, warm: 0, neutral: 0 },
    outputPillId: 'pill.temper',
    difficulty: 3,
    reveal: 'fragment',
  },
  {
    id: 'recipe.ward-greater',
    displayName: '大避雷丹方',
    inputs: [{ herbId: 'herb.ironwill-thorn', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }, { herbId: 'herb.balmleaf', qty: 1 }],
    idealHeatRange: [45_000, 65_000],
    targetProperty: { cold: 6_000, hot: 1_000, warm: 2_000, neutral: 3_000 },
    outputPillId: 'pill.ward-greater',
    difficulty: 4,
    reveal: 'known',
  },
  {
    id: 'recipe.deep-detox',
    displayName: '涤髓丹方',
    inputs: [{ herbId: 'herb.balmleaf', qty: 2 }, { herbId: 'herb.boneash-lily', qty: 1 }],
    idealHeatRange: [30_000, 50_000],
    targetProperty: { cold: 3_000, hot: 3_000, warm: 3_000, neutral: 5_000 },
    outputPillId: 'pill.deep-detox',
    difficulty: 4,
    reveal: 'fragment',
  },
  {
    id: 'recipe.ascend',
    displayName: '飞升丹方',
    inputs: [
      { herbId: 'herb.violet-ascend', qty: 2 },
      { herbId: 'herb.dao-root', qty: 1 },
      { herbId: 'herb.boneash-lily', qty: 2 },
    ],
    idealHeatRange: [65_000, 85_000],
    targetProperty: { cold: 4_000, hot: 4_000, warm: 4_000, neutral: 10_000 }, // docs/15 §2 [4,4,4,10]
    outputPillId: 'pill.ascend',
    difficulty: 5,
    reveal: 'fragment', // stage5 终局残卷（docs/15 §2）
  },
  {
    id: 'recipe.temper-supreme',
    displayName: '无极淬体方',
    inputs: [
      { herbId: 'herb.griefvein', qty: 2 },
      { herbId: 'herb.boneash-lily', qty: 1 },
      { herbId: 'herb.violet-ascend', qty: 1 },
    ],
    idealHeatRange: [60_000, 80_000],
    targetProperty: { cold: 6_000, hot: 6_000, warm: 2_000, neutral: 2_000 }, // docs/15 §2 [6,6,2,2]
    outputPillId: 'pill.temper-supreme',
    difficulty: 5,
    reveal: 'fragment', // stage4 残卷（docs/15 §2）
  },
  {
    id: 'recipe.ward-heaven',
    displayName: '偷天避雷方',
    inputs: [
      { herbId: 'herb.ironwill-thorn', qty: 1 },
      { herbId: 'herb.violet-ascend', qty: 1 },
      { herbId: 'herb.dao-root', qty: 1 },
    ],
    idealHeatRange: [50_000, 70_000],
    targetProperty: { cold: 5_000, hot: 5_000, warm: 5_000, neutral: 8_000 }, // docs/15 §2 [5,5,5,8]
    outputPillId: 'pill.ward-heaven',
    difficulty: 5,
    reveal: 'fragment', // stage5 + 飞升线（docs/15 §2）
  },
  {
    id: 'recipe.iron-bone',
    displayName: '铁骨丹方',
    inputs: [
      { herbId: 'herb.solar-pith', qty: 1 },
      { herbId: 'herb.emberheart', qty: 2 },
      { herbId: 'herb.boneash-lily', qty: 1 },
    ],
    idealHeatRange: [55_000, 75_000],
    targetProperty: { cold: 1_000, hot: 6_000, warm: 2_000, neutral: 2_000 }, // docs/15 §2 [1,6,2,2]
    outputPillId: 'pill.iron-bone',
    difficulty: 4,
    reveal: 'fragment', // 残卷 + stage3（docs/15 §2）
  },
];

/** 天象事件原始数据（对齐 docs/15 §4 / docs/07）。 */
const RAW_EVENTS: CelestialEventDef[] = [
  { id: 'event.qi-tide', displayName: '灵气潮汐', type: 'joy', weight: 10, durationDays: 5, growthMod: 1.5, qiMod: 1.5, desc: '远方大能突破，灵气暴涨，灵草疯长——但也会引来妖兽。' },
  { id: 'event.spirit-bloom', displayName: '百草丰登', type: 'joy', weight: 8, durationDays: 3, growthMod: 1.3, qiMod: 1.0, desc: '天地灵气充沛，万物向荣。' },
  { id: 'event.qi-depletion', displayName: '灵气枯竭', type: 'grief', weight: 6, durationDays: 7, growthMod: 0.4, qiMod: 0.4, desc: '天地闭合，灵气断绝，灵草停滞甚至枯萎。靠存粮熬过。' },
  { id: 'event.bad-harvest', displayName: '灾年', type: 'grief', weight: 6, durationDays: 5, growthMod: 0.5, qiMod: 1.0, desc: '凡间作物歉收，唯有挖残脉或寻一线灵机。' },
  { id: 'event.demonic-pass', displayName: '魔修过境', type: 'crisis', weight: 5, durationDays: 1, growthMod: 1.0, qiMod: 1.0, desc: '正魔交战波及山谷，农田或毁，但战后或可舔包。' },
  { id: 'event.wandering-immortal', displayName: '游方散仙至', type: 'opportunity', weight: 4, durationDays: 1, growthMod: 1.0, qiMod: 1.0, desc: '散仙偶至，可换稀有种子或残谱。' },
];

/** 阵法原始数据（docs/05 §8 / docs/15 §5）。 */
const RAW_ARRAYS: ArrayDef[] = [
  { id: 'array.lightning-rod', displayName: '引雷阵', type: 'rod', modifier: 4.0, radius: 2, needsMetalCore: true, desc: '以金属性灵草为阵眼，把范围内天雷锁向阵心（种田即布防）。' },
  { id: 'array.insulation', displayName: '绝缘阵', type: 'insulation', modifier: 0.3, radius: 1, needsMetalCore: false, desc: '绝缘垫层铺设，把范围内天雷排斥开，保护核心药草。' },
];

/** 独立物品（非灵草派生）：妖兽战利品等（docs/07 §3.3 舔包 / §3.4.3 雷兽内丹）。 */
const RAW_STANDALONE_ITEMS: ItemDef[] = [
  { id: 'item.beast-core', displayName: '妖兽内丹', category: 'material', stack: 5, description: '妖兽退去后遗留的内丹，蕴含狂暴灵气，强力炼丹材料（docs/07 §3.4.3）。' },
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
  {
    id: 'pill.temper',
    displayName: '淬体丹',
    tier: 3,
    effects: [{ kind: 'temperBoost', power: 1.3 }],
    load: 8_000,
    stack: 20,
  },
  {
    id: 'pill.ward-greater',
    displayName: '大避雷丹',
    tier: 4,
    effects: [{ kind: 'lightningWard', power: 0.6 }],
    load: 7_000,
    stack: 20,
  },
  {
    id: 'pill.deep-detox',
    displayName: '涤髓丹',
    tier: 4,
    effects: [{ kind: 'detox', power: 75_000 }],
    load: 15_000,
    stack: 20,
  },
  {
    id: 'pill.madness',
    displayName: '走火丹',
    tier: 3,
    effects: [{ kind: 'madness', power: 40 }], // 累积走火值，突破时可能走火入魔（docs/02）
    load: 6_000,
    stack: 10,
  },
  {
    id: 'pill.ascend',
    displayName: '飞升丹',
    tier: 5,
    effects: [{ kind: 'ascend', power: 0 }], // 飞升前夜（stage≥7）服用触发飞升结局（docs/15 §3）
    load: 0,
    stack: 5,
  },
  {
    id: 'pill.temper-supreme',
    displayName: '无极淬体丹',
    tier: 5,
    effects: [{ kind: 'temperBoost', power: 1.6 }], // 下次天劫淬体效率 ×1.6（docs/15 §3）
    load: 15_000,
    stack: 10,
  },
  {
    id: 'pill.ward-heaven',
    displayName: '偷天避雷丹',
    tier: 5,
    effects: [{ kind: 'lightningWard', power: 0.75 }], // 单次抗雷减伤 0.75（docs/15 §3）
    load: 12_000,
    stack: 10,
  },
  {
    id: 'pill.iron-bone',
    displayName: '铁骨丹',
    tier: 4,
    effects: [{ kind: 'ironBone', power: 0.2 }], // 整场天劫减伤 0.2（docs/15 §3）
    load: 10_000,
    stack: 10,
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
  const events = new Map<string, CelestialEventDef>();
  for (const e of RAW_EVENTS) events.set(e.id, e);
  const arrays = new Map<string, ArrayDef>();
  for (const a of RAW_ARRAYS) arrays.set(a.id, a);
  for (const it of RAW_STANDALONE_ITEMS) {
    const parsed = itemSchema.parse(it);
    items.set(parsed.id, parsed as ItemDef);
  }

  // schemaHash：内容指纹（docs/11 §3.2）。简化哈希。
  const schemaHash = simpleHash(
    [...herbs.keys()].join(',') + '|' + [...items.keys()].join(',') + '|' + [...recipes.keys()].join(',') + '|' + [...events.keys()].join(',') + '|' + [...arrays.keys()].join(','),
  );
  const compatibleSchemaHashes = ['1eb5f343', 'c7b88545', '2d0d866a', '8650fece']; // M0–M3 / M4（飞升丹前）/ M5（高tier丹药前）/ M5（铁骨丹前）：新增内容可无损补默认字段继续读取旧档。
  return { herbs, items, recipes, pills, events, arrays, seedToHerb, schemaHash, compatibleSchemaHashes };
}

export function isSchemaHashCompatible(registry: ContentRegistry, savedHash: string | undefined): boolean {
  return savedHash === registry.schemaHash || registry.compatibleSchemaHashes.includes(savedHash ?? '');
}

function simpleHash(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
