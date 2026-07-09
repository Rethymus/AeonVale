/**
 * 内容定义接口（数据驱动，docs/11 §4 / docs/15）。
 * sim 层只读这些 Def；运行时实例（CropInstance 等）在 sim/world 与各系统。
 * 这些接口与 src/content/schemas.ts 的 Zod schema 一一对应（schema 校验后得到这些类型）。
 */
import type { PropertyVector, Season } from '@sim/world/types';

export type Tier = 1 | 2 | 3 | 4 | 5;

export interface YieldDrop {
  itemId: string;
  count: number;
  chance?: number; // 缺省=1.0
}

/** 灵草定义（docs/15 §1 灵草目录 / docs/11 §1.3 SpiritHerbDef） */
export interface SpiritHerbDef {
  id: string;
  displayName: string;
  tier: Tier;
  baseProperty: PropertyVector; // 毫点
  baseGrowth: number; // G/日（毫点）
  growthThreshold: number; // 成熟阈值（毫点）
  qiNeed: number; // 理想灵气（毫点）
  qiDrainPerDay: number; // 毫点
  metalAttract: number; // 避雷吸引权重（0..，docs/14 P012 基线 0.8×tier）
  preferredSeason?: Season;
  weakSeason?: Season;
  seedId: string;
  rawPoisonValue: number; // 生食丹毒（毫点）
  yield: YieldDrop[];
}

export type ItemCategory =
  | 'tool'
  | 'material'
  | 'seed'
  | 'pill'
  | 'equipment'
  | 'knowledge'
  | 'consumable'
  | 'currency'
  | 'array-part';

/** 物品定义（docs/15 §5） */
export interface ItemDef {
  id: string;
  displayName: string;
  category: ItemCategory;
  stack: number;
  description?: string;
}

/**
 * 内容注册表：启动时一次性加载 + Zod 校验全部内容表（docs/11 §4.3）。
 * sim/render/io 全层只读引用此对象。
 */
export interface ContentRegistry {
  herbs: Map<string, SpiritHerbDef>;
  items: Map<string, ItemDef>;
  recipes: Map<string, RecipeDef>;
  pills: Map<string, PillDef>;
  events: Map<string, CelestialEventDef>;
  /** seedId → 灵草（便捷查询） */
  seedToHerb: Map<string, SpiritHerbDef>;
  /** 内容指纹（用于存档版本对齐，docs/11 §3.2 schemaHash） */
  schemaHash: string;
  // 后续里程碑扩充：events, tribulations, arrays
}

/** 丹药效果（docs/15 §3） */
export type PillEffectKind =
  | 'heal' // 回 HP
  | 'maxHpUp' // 永久提升 HP 上限
  | 'lightningWard' // 单次抗雷减伤
  | 'ironBone' // 整场减伤
  | 'detox' // 清丹毒
  | 'temperBoost' // 淬体效率提升
  | 'madness'; // 走火（副作用）

export interface PillEffect {
  kind: PillEffectKind;
  power: number; // 毫点（如 heal 30 → 30000）
  durationDays?: number;
}

/** 丹药定义（docs/15 §3 / docs/11 §1.5） */
export interface PillDef {
  id: string;
  displayName: string;
  tier: Tier;
  effects: PillEffect[];
  load: number; // 服用后增加的丹毒（毫点；负=清毒）
  stack: number;
}

/** 丹方输入材料 */
export interface RecipeInput {
  herbId: string;
  qty: number;
}

/** 丹方定义（docs/15 §2 / docs/11 §1.6）。非线性：同料异火出异丹。 */
export interface RecipeDef {
  id: string;
  displayName: string;
  inputs: RecipeInput[]; // 材料多重集
  idealHeatRange: [number, number]; // 毫点 0..100000
  targetProperty: PropertyVector; // 目标药性
  outputPillId: string;
  difficulty: number; // 1..5，影响容差
  reveal: 'known' | 'fragment' | 'emergent';
}

/** 天象类型（docs/15 §4 / docs/07） */
export type CelestialType = 'joy' | 'grief' | 'crisis' | 'opportunity';

/** 天象事件定义（docs/15 §4）。周期触发，调制全局灵气/生长（凡人无法改大势）。 */
export interface CelestialEventDef {
  id: string;
  displayName: string;
  type: CelestialType;
  weight: number; // 基础权重
  durationDays: number;
  growthMod: number; // 灵草生长倍率
  qiMod: number; // 灵气再生倍率
  desc: string;
}
