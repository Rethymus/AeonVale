/**
 * 地块 Tile。
 * 瓦片是世界最小空间单元；同时承载"种田"与"塔防布防"双重语义。
 */
import type { EntityId, SoilType } from '@sim/world/types';

export type BlockType = 'none' | 'rock' | 'tree' | 'building' | 'water';

export interface Tile {
  id: number; // = y * width + x
  x: number;
  y: number;
  soilType: SoilType;
  fertility: number; // 毫点 0..100000
  qiDensity: number; // 毫点 0..100000
  moisture: number; // 毫点 0..100000（浇水提升）
  tilled: boolean;
  cropId: EntityId | null; // 占用此瓦片的作物实例 id（=null 空地）
  wateredToday: boolean;
  channeledToday: boolean; // 当日是否供灵
  blockType: BlockType;
  arrayId: EntityId | null; // 所属阵法（M2 引入）
  /** 连作追踪：同属性连种季数 */
  consecutiveSameCropSeasons: number;
  /** 上一次在此地收成的灵草，用于把连作压力约束到真正的同种连作。 */
  lastHarvestedCropDefId: string | null;
}

/**
 * 土壤导电性表。
 * R5 裁定：直接作乘性权重倍率，区间 0.1–1.8。
 * 这是"种田即布防"的数学桥梁——平时铺什么土，战时引不引雷。
 */
export const SOIL_CONDUCTIVITY: Record<SoilType, number> = {
  'wet-loam': 1.8, // 浇水后/水边：强导电
  water: 1.8, // 水域：强导电
  'metal-ore': 1.5, // 金属矿露头：强引雷（不可种）
  scorched: 1.2, // 焦土：雷击/魔修过境后
  loam: 1.0, // 普通农田：基准
  'spirit-loam': 1.0, // 灵壤
  'dry-sand': 0.5, // 干沙：弱导电
  rock: 0.3, // 岩石
  insulated: 0.1 // 绝缘垫层（玩家铺设）：几乎不引雷
};

/** 肥力上限（毫点） */
export const FERTILITY_CAP_MILLI = 100 * 1000;

/** 该土壤是否可种植 */
export function isPlantable(t: Tile): boolean {
  return t.tilled && t.blockType === 'none' && t.cropId === null && t.soilType !== 'metal-ore' && t.soilType !== 'rock' && t.soilType !== 'water';
}

/** 该土壤是否可翻地 */
export function isTillable(t: Tile): boolean {
  return !t.tilled && t.blockType === 'none' && t.soilType !== 'water' && t.soilType !== 'rock' && t.soilType !== 'metal-ore';
}
