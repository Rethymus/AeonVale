/**
 * 作物实例 CropInstance。
 * 地里正在长的一棵灵草。Def 引用 SpiritHerbDef；实例持有运行时状态。
 */
import type { CropStage, EntityId, PropertyVector } from '@sim/world/types';

export interface CropInstance {
  id: EntityId;
  defId: string; // → SpiritHerbDef.id
  tileId: number;
  growth: number; // 生长进度毫点 0..growthThreshold
  health: number; // 毫点 0..100000
  stage: CropStage;
  plantedDay: number; // 全局第几日种下
  property: PropertyVector; // 当前药性（受土壤/季节调制；初始=def.baseProperty）
  tempered: boolean; // 是否被雷淬过（M2 影响药性变异）
  greenhouseProtected?: boolean; // 暖棚苗：允许离季育苗，并在生长时不吃弱季惩罚
}

/** 由生长进度推算视觉阶段 */
export function stageFromGrowth(growth: number, threshold: number): CropStage {
  if (growth <= 0) return 'seed';
  if (growth >= threshold) return 'mature';
  const r = growth / threshold;
  if (r < 0.33) return 'sprout';
  return 'growing';
}

export function isMature(c: CropInstance, threshold: number): boolean {
  return c.growth >= threshold;
}
