/**
 * 内容注册表：加载并用 Zod 校验内容数据。
 * M1 内联种子内容；后续里程碑迁移到 content 各子目录下的 JSON 文件 + 热重载。
 * 物品（材料/种子）由灵草表自动派生，避免重复维护。
 */
import type { ArrayDef, CelestialEventDef, ContentRegistry, ItemDef, PillDef, RecipeDef, SpiritHerbDef } from './defs';
import { spiritHerbSchema, itemSchema } from './schemas';

/** 灵草原始数据（毫点）。 */
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
      { itemId: 'seed.mossling', count: 1, chance: 0.5 }
    ]
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
      { itemId: 'seed.dewroot', count: 1, chance: 0.5 }
    ]
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
      { itemId: 'seed.suncap', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.frostmarrow',
    displayName: '寒潭莲',
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
      { itemId: 'seed.frostmarrow', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.emberheart',
    displayName: '赤炎草',
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
      { itemId: 'seed.emberheart', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.metalpine',
    displayName: '雷击木',
    tier: 3 as const,
    baseProperty: { cold: 1_000, hot: 1_000, warm: 0, neutral: 2_000 },
    baseGrowth: 4_000,
    growthThreshold: 120_000,
    qiNeed: 35_000,
    qiDrainPerDay: 1_600,
    metalAttract: 3.2, // 金属性引雷草
    preferredSeason: 'autumn' as const,
    seedId: 'seed.metalpine',
    rawPoisonValue: 5_000,
    yield: [
      { itemId: 'herb.metalpine', count: 1 },
      { itemId: 'seed.metalpine', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.balmleaf', count: 1 },
      { itemId: 'seed.balmleaf', count: 1, chance: 0.5 }
    ]
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
    metalAttract: 2.4, // 第二种引雷草
    preferredSeason: 'spring' as const,
    seedId: 'seed.thunderreed',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.thunderreed', count: 1 },
      { itemId: 'seed.thunderreed', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.griefvein',
    displayName: '九死草',
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
    yield: [
      { itemId: 'herb.griefvein', count: 1 },
      { itemId: 'seed.griefvein', count: 1, chance: 0.5 }
    ]
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
    metalAttract: 4.0, // 最强引雷草（导雷核心布阵件）
    seedId: 'seed.ironwill-thorn',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.ironwill-thorn', count: 1 },
      { itemId: 'seed.ironwill-thorn', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.boneash-lily', count: 1 },
      { itemId: 'seed.boneash-lily', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.violet-ascend', count: 1 },
      { itemId: 'seed.violet-ascend', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.silentbell',
    displayName: '还魂草',
    tier: 3 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 7_000 }, // 强平性中和剂
    baseGrowth: 5_000,
    growthThreshold: 120_000,
    qiNeed: 30_000,
    qiDrainPerDay: 1_400,
    metalAttract: 0,
    seedId: 'seed.silentbell',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.silentbell', count: 1 },
      { itemId: 'seed.silentbell', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.voidmantle', count: 1 },
      { itemId: 'seed.voidmantle', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.solar-pith', count: 1 },
      { itemId: 'seed.solar-pith', count: 1, chance: 0.5 }
    ]
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
    yield: [
      { itemId: 'herb.dao-root', count: 1 },
      { itemId: 'seed.dao-root', count: 1, chance: 0.5 }
    ]
  },
  // —— M6 内容广度扩充：补早期种田多样性 + 温性/引雷草缺口 ——
  {
    id: 'herb.stonegrain',
    displayName: '粟石草',
    tier: 1 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 3_000 }, // 全季凡间 staple，强平性
    baseGrowth: 8_000,
    growthThreshold: 42_000,
    qiNeed: 6_000,
    qiDrainPerDay: 500,
    metalAttract: 0,
    seedId: 'seed.stonegrain',
    rawPoisonValue: 1_500,
    yield: [
      { itemId: 'herb.stonegrain', count: 1 },
      { itemId: 'seed.stonegrain', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.mistfern',
    displayName: '雾蕨',
    tier: 1 as const,
    baseProperty: { cold: 2_000, hot: 0, warm: 1_000, neutral: 1_000 },
    baseGrowth: 7_000,
    growthThreshold: 44_000,
    qiNeed: 7_000,
    qiDrainPerDay: 550,
    metalAttract: 0,
    preferredSeason: 'spring' as const,
    seedId: 'seed.mistfern',
    rawPoisonValue: 2_500,
    yield: [
      { itemId: 'herb.mistfern', count: 1 },
      { itemId: 'seed.mistfern', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.sunmoss',
    displayName: '烬阳苔',
    tier: 1 as const,
    baseProperty: { cold: 0, hot: 2_000, warm: 1_000, neutral: 1_000 },
    baseGrowth: 7_000,
    growthThreshold: 44_000,
    qiNeed: 7_000,
    qiDrainPerDay: 550,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.sunmoss',
    rawPoisonValue: 2_500,
    yield: [
      { itemId: 'herb.sunmoss', count: 1 },
      { itemId: 'seed.sunmoss', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.plumeweed',
    displayName: '羽绒草',
    tier: 2 as const,
    baseProperty: { cold: 0, hot: 0, warm: 4_000, neutral: 2_000 }, // 温性重度——填补原有温性药草稀缺
    baseGrowth: 6_000,
    growthThreshold: 78_000,
    qiNeed: 19_000,
    qiDrainPerDay: 1_000,
    metalAttract: 0,
    preferredSeason: 'autumn' as const,
    seedId: 'seed.plumeweed',
    rawPoisonValue: 2_000,
    yield: [
      { itemId: 'herb.plumeweed', count: 1 },
      { itemId: 'seed.plumeweed', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.tidegrass',
    displayName: '潮汐草',
    tier: 2 as const,
    baseProperty: { cold: 4_000, hot: 0, warm: 1_000, neutral: 1_000 },
    baseGrowth: 5_000,
    growthThreshold: 76_000,
    qiNeed: 20_000,
    qiDrainPerDay: 1_100,
    metalAttract: 0,
    preferredSeason: 'spring' as const,
    seedId: 'seed.tidegrass',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.tidegrass', count: 1 },
      { itemId: 'seed.tidegrass', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.embermoss',
    displayName: '烬心苔',
    tier: 2 as const,
    baseProperty: { cold: 0, hot: 4_000, warm: 1_000, neutral: 1_000 },
    baseGrowth: 5_000,
    growthThreshold: 76_000,
    qiNeed: 20_000,
    qiDrainPerDay: 1_100,
    metalAttract: 0,
    preferredSeason: 'summer' as const,
    seedId: 'seed.embermoss',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.embermoss', count: 1 },
      { itemId: 'seed.embermoss', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.jadewing',
    displayName: '翠翎草',
    tier: 3 as const,
    baseProperty: { cold: 1_000, hot: 1_000, warm: 1_000, neutral: 4_000 }, // 四性均衡的中和剂（三阶版）
    baseGrowth: 5_000,
    growthThreshold: 125_000,
    qiNeed: 32_000,
    qiDrainPerDay: 1_500,
    metalAttract: 0,
    seedId: 'seed.jadewing',
    rawPoisonValue: 4_000,
    yield: [
      { itemId: 'herb.jadewing', count: 1 },
      { itemId: 'seed.jadewing', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.fulgurseed',
    displayName: '雷种草',
    tier: 3 as const,
    baseProperty: { cold: 2_000, hot: 0, warm: 0, neutral: 3_000 },
    baseGrowth: 4_000,
    growthThreshold: 130_000,
    qiNeed: 33_000,
    qiDrainPerDay: 1_500,
    metalAttract: 2.0, // 第三种金属性引雷草（导雷布阵多样性）
    preferredSeason: 'spring' as const,
    seedId: 'seed.fulgurseed',
    rawPoisonValue: 4_500,
    yield: [
      { itemId: 'herb.fulgurseed', count: 1 },
      { itemId: 'seed.fulgurseed', count: 1, chance: 0.5 }
    ]
  },
  {
    id: 'herb.voidmoss',
    displayName: '绝灵苔',
    tier: 3 as const,
    baseProperty: { cold: 0, hot: 0, warm: 0, neutral: 0 }, // "空"：无灵性植物，药性全零
    baseGrowth: 4_000,
    growthThreshold: 120_000,
    qiNeed: 1_500, // 极低：不吸灵气反隔绝灵气
    qiDrainPerDay: 200,
    metalAttract: 0,
    preferredSeason: 'winter' as const,
    seedId: 'seed.voidmoss',
    rawPoisonValue: 1_000, // "空"无药性冲突
    yield: [
      { itemId: 'herb.voidmoss', count: 1 },
      { itemId: 'seed.voidmoss', count: 1, chance: 0.5 }
    ]
  }
];

/** 丹方原始数据（毫点；对齐，按已有 6 灵草适配）。 */
const RAW_RECIPES: RecipeDef[] = [
  {
    id: 'recipe.ward-pill',
    displayName: '承雷丹方',
    inputs: [
      { herbId: 'herb.metalpine', qty: 1 },
      { herbId: 'herb.frostmarrow', qty: 1 }
    ],
    idealHeatRange: [40_000, 55_000],
    targetProperty: { cold: 5_000, hot: 1_000, warm: 1_000, neutral: 4_000 },
    outputPillId: 'pill.ward-basic',
    difficulty: 2,
    reveal: 'known'
  },
  {
    id: 'recipe.bone-pill',
    displayName: '生骨丹方',
    inputs: [
      { herbId: 'herb.emberheart', qty: 1 },
      { herbId: 'herb.dewroot', qty: 1 }
    ],
    idealHeatRange: [45_000, 60_000],
    targetProperty: { cold: 2_000, hot: 5_000, warm: 2_000, neutral: 1_000 },
    outputPillId: 'pill.bone-basic',
    difficulty: 2,
    reveal: 'known'
  },
  {
    id: 'recipe.detox-pill',
    displayName: '净毒丹方',
    inputs: [{ herbId: 'herb.dewroot', qty: 2 }],
    idealHeatRange: [25_000, 40_000],
    targetProperty: { cold: 4_000, hot: 0, warm: 1_000, neutral: 4_000 },
    outputPillId: 'pill.detox',
    difficulty: 2,
    reveal: 'fragment'
  },
  {
    id: 'recipe.cold-mud',
    displayName: '寒泥丸（涌现）',
    inputs: [{ herbId: 'herb.mossling', qty: 3 }],
    idealHeatRange: [10_000, 25_000],
    targetProperty: { cold: 2_000, hot: 0, warm: 0, neutral: 6_000 },
    outputPillId: 'pill.cold-mud',
    difficulty: 1,
    reveal: 'emergent'
  },
  {
    id: 'recipe.temper-pill',
    displayName: '淬体丹方',
    inputs: [
      { herbId: 'herb.griefvein', qty: 1 },
      { herbId: 'herb.emberheart', qty: 1 },
      { herbId: 'herb.frostmarrow', qty: 1 }
    ],
    idealHeatRange: [50_000, 70_000],
    targetProperty: { cold: 5_000, hot: 5_000, warm: 0, neutral: 0 },
    outputPillId: 'pill.temper',
    difficulty: 3,
    reveal: 'fragment'
  },
  {
    id: 'recipe.ward-greater',
    displayName: '大承雷丹方',
    inputs: [
      { herbId: 'herb.ironwill-thorn', qty: 1 },
      { herbId: 'herb.frostmarrow', qty: 1 },
      { herbId: 'herb.balmleaf', qty: 1 }
    ],
    idealHeatRange: [45_000, 65_000],
    targetProperty: { cold: 6_000, hot: 1_000, warm: 2_000, neutral: 3_000 },
    outputPillId: 'pill.ward-greater',
    difficulty: 4,
    reveal: 'known'
  },
  {
    id: 'recipe.deep-detox',
    displayName: '涤髓丹方',
    inputs: [
      { herbId: 'herb.balmleaf', qty: 2 },
      { herbId: 'herb.boneash-lily', qty: 1 }
    ],
    idealHeatRange: [30_000, 50_000],
    targetProperty: { cold: 3_000, hot: 3_000, warm: 3_000, neutral: 5_000 },
    outputPillId: 'pill.deep-detox',
    difficulty: 4,
    reveal: 'fragment'
  },
  {
    id: 'recipe.ascend',
    displayName: '飞升丹方',
    inputs: [
      { herbId: 'herb.violet-ascend', qty: 2 },
      { herbId: 'herb.dao-root', qty: 1 },
      { herbId: 'herb.boneash-lily', qty: 2 }
    ],
    idealHeatRange: [65_000, 85_000],
    targetProperty: { cold: 4_000, hot: 4_000, warm: 4_000, neutral: 10_000 }, // [4,4,4,10]
    outputPillId: 'pill.ascend',
    difficulty: 5,
    reveal: 'fragment' // stage5 终局残卷
  },
  {
    id: 'recipe.temper-supreme',
    displayName: '无极淬体方',
    inputs: [
      { herbId: 'herb.griefvein', qty: 2 },
      { herbId: 'herb.boneash-lily', qty: 1 },
      { herbId: 'herb.violet-ascend', qty: 1 }
    ],
    idealHeatRange: [60_000, 80_000],
    targetProperty: { cold: 6_000, hot: 6_000, warm: 2_000, neutral: 2_000 }, // [6,6,2,2]
    outputPillId: 'pill.temper-supreme',
    difficulty: 5,
    reveal: 'fragment' // stage4 残卷
  },
  {
    id: 'recipe.ward-heaven',
    displayName: '偷天承雷方',
    inputs: [
      { herbId: 'herb.ironwill-thorn', qty: 1 },
      { herbId: 'herb.violet-ascend', qty: 1 },
      { herbId: 'herb.dao-root', qty: 1 }
    ],
    idealHeatRange: [50_000, 70_000],
    targetProperty: { cold: 5_000, hot: 5_000, warm: 5_000, neutral: 8_000 }, // [5,5,5,8]
    outputPillId: 'pill.ward-heaven',
    difficulty: 5,
    reveal: 'fragment' // stage5 + 飞升线
  },
  {
    id: 'recipe.iron-bone',
    displayName: '铁骨丹方',
    inputs: [
      { herbId: 'herb.solar-pith', qty: 1 },
      { herbId: 'herb.emberheart', qty: 2 },
      { herbId: 'herb.boneash-lily', qty: 1 }
    ],
    idealHeatRange: [55_000, 75_000],
    targetProperty: { cold: 1_000, hot: 6_000, warm: 2_000, neutral: 2_000 }, // [1,6,2,2]
    outputPillId: 'pill.iron-bone',
    difficulty: 4,
    reveal: 'fragment' // 残卷 + stage3
  },
  // —— M6 广度：新材料路径涌现（同效丹、不同料/火候）
  {
    id: 'recipe.ward-fulgur',
    displayName: '雷种承雷方（涌现）',
    inputs: [
      { herbId: 'herb.fulgurseed', qty: 1 },
      { herbId: 'herb.tidegrass', qty: 1 }
    ],
    idealHeatRange: [40_000, 55_000],
    targetProperty: { cold: 5_000, hot: 1_000, warm: 1_000, neutral: 3_000 },
    outputPillId: 'pill.ward-basic',
    difficulty: 2,
    reveal: 'emergent'
  },
  {
    id: 'recipe.bone-herbal',
    displayName: '草本生骨方（涌现）',
    inputs: [
      { herbId: 'herb.stonegrain', qty: 1 },
      { herbId: 'herb.sunmoss', qty: 1 },
      { herbId: 'herb.plumeweed', qty: 1 }
    ],
    idealHeatRange: [45_000, 60_000],
    targetProperty: { cold: 1_000, hot: 3_000, warm: 3_000, neutral: 3_000 },
    outputPillId: 'pill.bone-basic',
    difficulty: 2,
    reveal: 'emergent'
  },
  {
    id: 'recipe.detox-plume',
    displayName: '温润解毒方（涌现）',
    inputs: [{ herbId: 'herb.plumeweed', qty: 2 }],
    idealHeatRange: [25_000, 40_000],
    targetProperty: { cold: 1_000, hot: 0, warm: 4_000, neutral: 3_000 },
    outputPillId: 'pill.detox',
    difficulty: 2,
    reveal: 'fragment'
  },
  {
    id: 'recipe.neutral-pearl',
    displayName: '太一珠方（涌现）',
    inputs: [
      { herbId: 'herb.silentbell', qty: 1 },
      { herbId: 'herb.dao-root', qty: 1 }
    ],
    idealHeatRange: [40_000, 60_000],
    targetProperty: { cold: 0, hot: 0, warm: 0, neutral: 12_000 }, // [0,0,0,12]
    outputPillId: 'pill.neutral-pearl',
    difficulty: 5,
    reveal: 'emergent'
  }
];

/** 天象事件原始数据（对齐 /）。 */
const RAW_EVENTS: CelestialEventDef[] = [
  { id: 'event.qi-tide', displayName: '灵气潮汐', type: 'joy', weight: 10, durationDays: 5, growthMod: 1.5, qiMod: 1.5, desc: '远方大能突破，灵气暴涨，灵草疯长——但也会引来妖兽。' },
  { id: 'event.spirit-bloom', displayName: '百草丰登', type: 'joy', weight: 8, durationDays: 3, growthMod: 1.3, qiMod: 1.0, desc: '天地灵气充沛，万物向荣。' },
  { id: 'event.qi-depletion', displayName: '灵气枯竭', type: 'grief', weight: 6, durationDays: 7, growthMod: 0.4, qiMod: 0.4, desc: '天地闭合，灵气断绝，灵草停滞甚至枯萎。靠存粮熬过。' },
  { id: 'event.bad-harvest', displayName: '灾年', type: 'grief', weight: 6, durationDays: 5, growthMod: 0.5, qiMod: 1.0, desc: '凡间作物歉收，唯有挖残脉或寻一线灵机。' },
  { id: 'event.demonic-pass', displayName: '魔修过境', type: 'crisis', weight: 5, durationDays: 1, growthMod: 1.0, qiMod: 1.0, desc: '正魔交战波及山谷，农田或毁，但战后或可舔包。' },
  { id: 'event.wandering-immortal', displayName: '游方散仙至', type: 'opportunity', weight: 4, durationDays: 1, growthMod: 1.0, qiMod: 1.0, grants: [{ kind: 'seed-by-stage', count: 2, chance: 1 }], desc: '散仙偶至，赠你两粒与自身修为相称的灵草种子。' },
  { id: 'event.purple-omen', displayName: '紫雷前兆', type: 'crisis', weight: 1, durationDays: 7, growthMod: 1.0, qiMod: 1.0, forced: true, desc: 'stage4 修为圆满，天穹泛紫——紫雷劫倒计时开启，终局线浮现。' },
  // —— M6 节奏层：四季节日（日历强制；forced 排除随机池，seasonal 定日触发）——
  { id: 'event.spring-festival', displayName: '灵芽节', type: 'joy', weight: 0, durationDays: 2, growthMod: 1.2, qiMod: 1.2, forced: true, seasonal: { season: 'spring', day: 14 }, desc: '仲春之日，万物萌发。灵气与生长小旺，春耕之喜。' },
  { id: 'event.summer-festival', displayName: '炎阳祭', type: 'joy', weight: 0, durationDays: 2, growthMod: 1.1, qiMod: 1.3, forced: true, seasonal: { season: 'summer', day: 14 }, desc: '仲夏祭典，天地灵气充盈。生长略旺、灵气大涨。' },
  { id: 'event.autumn-festival', displayName: '金秋会', type: 'joy', weight: 0, durationDays: 2, growthMod: 1.3, qiMod: 1.0, forced: true, seasonal: { season: 'autumn', day: 14 }, desc: '秋收时节，灵草加速成熟。丰收之季。' },
  { id: 'event.winter-festival', displayName: '寒岁祭', type: 'grief', weight: 0, durationDays: 2, growthMod: 0.9, qiMod: 0.9, forced: true, seasonal: { season: 'winter', day: 28 }, desc: '岁末肃杀，天地闭藏。灵气与生长略衰，宜守不宜攻。' },
  // —— T1 内容补齐：用现有 grants 机制可落地的天象 ——
  {
    id: 'event.forgotten-tomb',
    displayName: '古修遗冢',
    type: 'opportunity',
    weight: 3,
    durationDays: 1,
    growthMod: 1.0,
    qiMod: 1.0,
    grants: [
      { kind: 'item', itemId: 'item.recipe-fragment', count: 1, chance: 0.7 },
      { kind: 'item', itemId: 'item.broken-talisman', count: 1, chance: 0.4 }
    ],
    desc: '残冢现于雾中，探索或得残卷与破损法宝——高风险高回报。'
  },
  { id: 'event.demon-seed-rain', displayName: '魔种雨', type: 'opportunity', weight: 4, durationDays: 1, growthMod: 1.1, qiMod: 1.0, grants: [{ kind: 'item', itemId: 'seed.griefvein', count: 2, chance: 0.8 }], desc: '天降异种，可种九死草——收益伴生妖兽风险。' },
  // —— T8 天象机制扩展：携带机制倍率的剩余事件 ——
  { id: 'event.heaven-eye', displayName: '天道注视', type: 'crisis', weight: 5, durationDays: 1, growthMod: 1.0, qiMod: 1.0, damageMod: 1.3, desc: '天道注视偷天者，当次天劫强度 +30%。务必备大承雷丹。' },
  { id: 'event.blood-moon', displayName: '血月', type: 'crisis', weight: 4, durationDays: 1, growthMod: 1.0, qiMod: 1.0, madnessMod: 2, desc: '血月当空，妖兽狂化，走火累积翻倍——宜静守，不宜炼丹。' },
  { id: 'event.kindling-flame', displayName: '炉心焰', type: 'opportunity', weight: 5, durationDays: 3, growthMod: 1.0, qiMod: 1.0, alchemyTolMod: 10, desc: '地火涌动，炼丹火候易控，炸炉容差 +10。趁机炼高难丹方。' }
];

/** 阵法原始数据。 */
const RAW_ARRAYS: ArrayDef[] = [
  { id: 'array.lightning-rod', displayName: '引雷阵', type: 'rod', modifier: 4.0, radius: 2, needsMetalCore: true, desc: '以金属性灵草为阵眼，把范围内天雷锁向阵心（种田即布阵）。' },
  { id: 'array.insulation', displayName: '绝缘阵', type: 'insulation', modifier: 0.3, radius: 1, needsMetalCore: false, desc: '绝缘垫层铺设，把范围内天雷分流到阵缘，稳住核心药草。' },
  // R3-B1 引水阵：清晨自动浇灌覆盖圈灵田（对标星露谷洒水器 Lv2/6/9 分级）。stage 4+ 中期内容，不前移序章（守 docs/02:88）。
  // waterAmountMilli 单位为毫（MILLI=1000）；modifier 1.0 不参与雷权重。
  { id: 'array.water-channel-1', displayName: '引水阵', type: 'water', modifier: 1.0, radius: 1, needsMetalCore: false, waterAmountMilli: 20000, stageMin: 4, desc: '以阵核牵引灵水，每日清晨自动浇灌覆盖圈灵田，把日常浇水从日循环移除（洗髓境方可布设）。' },
  { id: 'array.water-channel-2', displayName: '引水阵·扩脉', type: 'water', modifier: 1.0, radius: 2, needsMetalCore: false, waterAmountMilli: 30000, stageMin: 5, desc: '扩脉引水阵，覆盖更广、水量更足（凝血境方可布设）。' },
  { id: 'array.water-channel-3', displayName: '引水阵·广泽', type: 'water', modifier: 1.0, radius: 3, needsMetalCore: false, waterAmountMilli: 40000, stageMin: 6, desc: '广泽引水阵，覆盖整片灵田（雷骨境方可布设）。' }
];

/** 独立物品（非灵草派生）：货币/知识/战利品/工具。 */
const RAW_STANDALONE_ITEMS: ItemDef[] = [
  { id: 'item.beast-core', displayName: '妖兽内丹', category: 'material', stack: 5, description: '妖兽退去后遗留的内丹，蕴含狂暴灵气，强力炼丹材料。' },
  { id: 'item.dried-herb', displayName: '晾晒灵草', category: 'material', stack: 30, description: '经晾晒架脱水后的灵草材料，药性平稳，适合出货或后续加工。' },
  { id: 'item.sealed-herb', displayName: '封藏灵草', category: 'material', stack: 20, description: '以灵壤肥封存药性的灵草工匠品，适合换取灵石或作为后续高阶加工底材。' },
  { id: 'item.herbal-wine', displayName: '灵草药酒', category: 'material', stack: 15, description: '以晾晒灵草为底、灵石为引酿成的药酒，药性温润醇厚，出货价更高，亦可留作体修行气活血的自用饮品。' },
  { id: 'item.spirit-poultice', displayName: '灵药膏', category: 'material', stack: 12, description: '以灵壤肥为底、浓缩晾晒灵草药性熬成的外敷膏剂，止血生肌、拔毒外出，是体修硬扛雷劫后的续命膏。' },
  { id: 'item.spirit-compost', displayName: '灵壤肥', category: 'material', stack: 20, description: '以灵壤、草木灰与微量兽骨粉调成的肥料，可提升地块肥力与灵气，帮助灵草结出更高品质。' },
  { id: 'item.spirit-stone', displayName: '灵石', category: 'currency', stack: 50, description: '修仙界通用货币；可碎回灵气，也是散仙交易媒介。' },
  { id: 'item.recipe-fragment', displayName: '残卷', category: 'knowledge', stack: 8, description: '丹方残卷，集齐可还原丹方；散仙交易/古修遗冢产出。' },
  { id: 'item.broken-talisman', displayName: '破损法宝', category: 'material', stack: 3, description: '魔修过境遗留的法宝残骸，可拆材料或换残卷。' },
  { id: 'item.array-core', displayName: '阵核', category: 'material', stack: 10, description: '由破损法宝熔炼出的阵法核心，可作为控场阵法与高阶设施的关键材料。' },
  { id: 'item.rust-hoe', displayName: '铁锈锄', category: 'tool', stack: 1, description: '翻地工具，耐久 50。持有翻地消耗耐久；无则徒手。没有飞剑，没有法宝——这把豁了口的锄头，就是我全部的"金手指"。' },
  { id: 'item.sickle', displayName: '镰刀', category: 'tool', stack: 1, description: '收获工具，耐久 80。持有收获消耗耐久；无则徒手。' },
  { id: 'item.water-pail', displayName: '灵水桶', category: 'tool', stack: 1, description: '浇水工具，高耐久。持有浇水消耗耐久；无则徒手。' }
];

/** 丹药原始数据（毫点；对齐）。 */
const RAW_PILLS: PillDef[] = [
  {
    id: 'pill.ward-basic',
    displayName: '承雷丹',
    tier: 2,
    effects: [{ kind: 'lightningWard', power: 0.4 }],
    load: 5_000,
    stack: 20
  },
  {
    id: 'pill.bone-basic',
    displayName: '生骨丹',
    tier: 2,
    effects: [{ kind: 'heal', power: 30_000 }],
    load: 4_000,
    stack: 20
  },
  {
    id: 'pill.detox',
    displayName: '净毒丹',
    tier: 2,
    effects: [{ kind: 'detox', power: 25_000 }],
    load: 2_000,
    stack: 20
  },
  {
    id: 'pill.cold-mud',
    displayName: '寒泥丸',
    tier: 1,
    effects: [],
    load: 2_000,
    stack: 30
  },
  {
    id: 'pill.temper',
    displayName: '淬体丹',
    tier: 3,
    effects: [{ kind: 'temperBoost', power: 1.3 }],
    load: 8_000,
    stack: 20
  },
  {
    id: 'pill.ward-greater',
    displayName: '大承雷丹',
    tier: 4,
    effects: [{ kind: 'lightningWard', power: 0.6 }],
    load: 7_000,
    stack: 20
  },
  {
    id: 'pill.deep-detox',
    displayName: '涤髓丹',
    tier: 4,
    effects: [{ kind: 'detox', power: 75_000 }],
    load: 15_000,
    stack: 20
  },
  {
    id: 'pill.madness',
    displayName: '走火丹',
    tier: 3,
    effects: [{ kind: 'madness', power: 40 }], // 累积走火值，突破时可能走火入魔
    load: 6_000,
    stack: 10
  },
  {
    id: 'pill.ascend',
    displayName: '飞升丹',
    tier: 5,
    effects: [{ kind: 'ascend', power: 0 }], // 飞升前夜（stage≥7）服用触发飞升结局
    load: 0,
    stack: 5
  },
  {
    id: 'pill.temper-supreme',
    displayName: '无极淬体丹',
    tier: 5,
    effects: [{ kind: 'temperBoost', power: 1.6 }], // 下次天劫淬体效率 ×1.6
    load: 15_000,
    stack: 10
  },
  {
    id: 'pill.ward-heaven',
    displayName: '偷天承雷丹',
    tier: 5,
    effects: [{ kind: 'lightningWard', power: 0.75 }], // 单次承雷减伤 0.75
    load: 12_000,
    stack: 10
  },
  {
    id: 'pill.iron-bone',
    displayName: '铁骨丹',
    tier: 4,
    effects: [{ kind: 'ironBone', power: 0.2 }], // 整场天劫减伤 0.2
    load: 10_000,
    stack: 10
  },
  {
    id: 'pill.neutral-pearl',
    displayName: '太一珠',
    tier: 5,
    // 全属性微涨→永久 +maxHP。
    effects: [{ kind: 'maxHpUp', power: 10_000 }],
    load: 0,
    stack: 5
  }
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
      description: `灵草材料·${h.displayName}（${['', '一', '二', '三', '四', '五'][h.tier]}阶）`
    });
    items.push({
      id: h.seedId,
      displayName: `${h.displayName}种子`,
      category: 'seed',
      stack: 30,
      description: `${h.displayName}的种子，可种植。`
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

  // schemaHash：内容指纹。简化哈希。
  const schemaHash = simpleHash([...herbs.keys()].join(',') + '|' + [...items.keys()].join(',') + '|' + [...recipes.keys()].join(',') + '|' + [...events.keys()].join(',') + '|' + [...arrays.keys()].join(','));
  const compatibleSchemaHashes = ['1eb5f343', 'c7b88545', '2d0d866a', '8650fece', 'e20ed1b', '467bd1a7', 'c61ab843', '3ab8890e', '82d7db93', 'c1e2cc08']; // …/ T1 终态(3ab8890e) / T8 天象机制扩展前：旧档可无损继续读取。
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
