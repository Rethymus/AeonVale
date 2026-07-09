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
  /** seedId → 灵草（便捷查询） */
  seedToHerb: Map<string, SpiritHerbDef>;
  /** 内容指纹（用于存档版本对齐，docs/11 §3.2 schemaHash） */
  schemaHash: string;
  // 后续里程碑扩充：recipes, pills, events, tribulations, arrays
}
