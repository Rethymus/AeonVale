/**
 * 玩家 Player（docs/11 §1.9）。
 * 「绝灵之体」凡人：无灵根、HP 脆弱、丹毒风险、修为由天劫淬体累积。
 */
import type { Direction, EntityId, Vec2, CultivationStage } from './types';
import { MILLI } from './types';

export interface InventorySlot {
  itemId: string;
  count: number;
  durability?: number; // 工具/装备
}

export interface Player {
  hp: number; // 毫点
  maxHp: number; // 毫点
  pillPoison: number; // 丹毒毫点 0..100000（满即暴毙）
  cultivation: number; // 当前阶段修为（毫点，累积到 xCap 触发天劫倒计时）
  stage: CultivationStage; // 0..7
  madnessValue: number; // 走火值（docs/09 §3.3）
  temperingStack: number; // 淬体积淀（毫点）
  wardMitigation: number; // 避雷护体减伤 0..1（服避雷丹设置，渡劫时消耗，docs/06 §7.2）
  temperBoostMult: number; // 淬体效率倍率（服淬体丹设置，下次天劫淬体 ×此值后消耗，docs/15 §3）
  stamina: number; // 当日体力毫点
  position: Vec2; // 所在瓦片坐标
  facing: Direction;
  /** 简化背包：itemId → {count, durability?}（docs/11 §1.8 储物戒，后续可拆 StorageRing） */
  inventory: Record<string, InventorySlot>;
  inventoryCapacity: number;
  flags: Set<string>; // 解锁标记（首次炼丹/首次硬抗雷…）
}

export function defaultPlayer(staminaCapMilli: number): Player {
  return {
    hp: 100 * MILLI,
    maxHp: 100 * MILLI,
    pillPoison: 0,
    cultivation: 0,
    stage: 0,
    madnessValue: 0,
    temperingStack: 0,
    wardMitigation: 0,
    temperBoostMult: 1,
    stamina: staminaCapMilli,
    position: { x: 0, y: 0 },
    facing: 'down',
    inventory: {},
    inventoryCapacity: 16,
    flags: new Set(),
  };
}

/** 背包物品总数（用于容量压力，docs/16 §4） */
export function inventoryUsed(p: Player): number {
  return Object.keys(p.inventory).length;
}

/** 增减物品（count 可负）。返回是否成功（容量/数量约束）。 */
export function mutateItem(p: Player, itemId: string, delta: number): boolean {
  const slot = p.inventory[itemId];
  if (delta < 0) {
    if (!slot || slot.count < -delta) return false;
    slot.count += delta;
    if (slot.count <= 0) delete p.inventory[itemId];
    return true;
  }
  if (delta > 0) {
    if (!slot) {
      if (inventoryUsed(p) >= p.inventoryCapacity) return false;
      p.inventory[itemId] = { itemId, count: delta };
    } else {
      slot.count += delta;
    }
    return true;
  }
  return true;
}

export function itemCount(p: Player, itemId: string): number {
  return p.inventory[itemId]?.count ?? 0;
}
