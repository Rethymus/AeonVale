/**
  * 玩家 Player。
  * 「空灵根」凡人（被世人误判为无灵根）：HP 脆弱、丹毒风险，以苦练与天劫淬体打磨肉身。
 */
import type { Direction, EntityId, Vec2, CultivationStage } from './types';
import { MILLI } from './types';
import type { CropQuality } from '@sim/farm/quality';

export interface InventorySlot {
 itemId: string;
 count: number;
 durability?: number; // 工具/装备
}

export type QualityInventory = Partial<Record<CropQuality, Record<string, number>>>;

export type InventoryReward =
 | { itemId: string; count: number }
 | { itemId: string; quality: CropQuality; count: number };

const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

export interface Player {
 hp: number; // 毫点
 maxHp: number; // 毫点
 pillPoison: number; // 丹毒毫点 0..100000（满即暴毙）
 cultivation: number; // 兼容旧存档/回放的淬体进度通道；新逻辑以 bodyFoundation 为主
 bodyFoundation: number; // 当前阶段体魄根基（毫点）：训练、丹药、天劫淬体累积
 endurance: number; // 耐力（毫点）：长期苦练积累，影响后续体修扩展
 willpower: number; // 意志（毫点）：痛苦承受与逆天改命资源
 heavenDebt: number; // 偷天/引劫积累的因果债（毫点）
 daoAttention: number; // 天道注视度（毫点），越高越容易被天象/劫难针对
 lifespanRemainingDays: number; // 大限倒计时；突破可争回寿元
 stage: CultivationStage; // 0..7
 madnessValue: number; // 走火值
 temperingStack: number; // 淬体积淀（毫点）
 wardMitigation: number; // 避雷护体减伤 0..1（服避雷丹设置，渡劫时消耗）
 temperBoostMult: number; // 淬体效率倍率（服淬体丹设置，下次天劫淬体 ×此值后消耗）
 ironBoneMitigation: number; // 铁骨整场减伤 0..1（服铁骨丹设置，整场天劫减伤后消耗）
 stamina: number; // 当日体力毫点
 position: Vec2; // 所在瓦片坐标
 facing: Direction;
 /** 简化背包：itemId → {count, durability?} */
 inventory: Record<string, InventorySlot>;
 /** 灵草品质批次：quality → itemId → count。普通接口会把它计入材料总量。 */
 qualityInventory: QualityInventory;
 inventoryCapacity: number;
 flags: Set<string>; // 解锁标记（首次炼丹/首次硬抗雷…）
}

export function defaultPlayer(staminaCapMilli: number): Player {
 return {
 hp: 100 * MILLI,
 maxHp: 100 * MILLI,
 pillPoison: 0,
 cultivation: 0,
 bodyFoundation: 0,
 endurance: 0,
 willpower: 0,
 heavenDebt: 0,
 daoAttention: 0,
 lifespanRemainingDays: 840,
 stage: 0,
 madnessValue: 0,
 temperingStack: 0,
 wardMitigation: 0,
 temperBoostMult: 1,
 ironBoneMitigation: 0,
 stamina: staminaCapMilli,
 position: { x: 0, y: 0 },
 facing: 'down',
 inventory: {},
 qualityInventory: {},
 inventoryCapacity: 16,
 flags: new Set(),
 };
}

function qualityInventory(p: Player): QualityInventory {
 p.qualityInventory ??= {};
 return p.qualityInventory;
}

function nonEmptyQualitySlotCount(p: Player): number {
 const inv = qualityInventory(p);
 let count = 0;
 for (const quality of QUALITY_ORDER) {
 const batch = inv[quality];
 if (!batch) continue;
 count += Object.values(batch).filter((n) => n > 0).length;
 }
 return count;
}

/** 背包物品总数（用于容量压力） */
export function inventoryUsed(p: Player): number {
 return Object.keys(p.inventory).length + nonEmptyQualitySlotCount(p);
}

export function qualityItemCount(p: Player, itemId: string, quality: CropQuality): number {
 return qualityInventory(p)[quality]?.[itemId] ?? 0;
}

export function totalQualityItemCount(p: Player, itemId: string): number {
 return QUALITY_ORDER.reduce((sum, quality) => sum + qualityItemCount(p, itemId, quality), 0);
}

/** 增减指定品质的灵草批次。新增批次会占用一个背包槽位。 */
export function mutateQualityItem(p: Player, itemId: string, quality: CropQuality, delta: number): boolean {
 const inv = qualityInventory(p);
 const batch = (inv[quality] ??= {});
 const current = batch[itemId] ?? 0;
 if (delta < 0) {
 if (current < -delta) return false;
 const next = current + delta;
 if (next <= 0) delete batch[itemId];
 else batch[itemId] = next;
 if (Object.keys(batch).length === 0) delete inv[quality];
 return true;
 }
 if (delta > 0) {
 if (current <= 0 && inventoryUsed(p) >= p.inventoryCapacity) return false;
 batch[itemId] = current + delta;
 return true;
 }
 return true;
}

function consumeQualityItems(p: Player, itemId: string, count: number): boolean {
 let remaining = count;
 for (const quality of QUALITY_ORDER) {
 const available = qualityItemCount(p, itemId, quality);
 if (available <= 0) continue;
 const take = Math.min(available, remaining);
 mutateQualityItem(p, itemId, quality, -take);
 remaining -= take;
 if (remaining <= 0) return true;
 }
 return remaining <= 0;
}

/** 增减物品（count 可负）。返回是否成功（容量/数量约束）。 */
export function mutateItem(p: Player, itemId: string, delta: number): boolean {
 const slot = p.inventory[itemId];
 if (delta < 0) {
 const need = -delta;
 if (itemCount(p, itemId) < need) return false;
 const fromNormal = Math.min(slot?.count ?? 0, need);
 if (slot && fromNormal > 0) {
 slot.count -= fromNormal;
 if (slot.count <= 0) delete p.inventory[itemId];
 }
 const remaining = need - fromNormal;
 if (remaining > 0) consumeQualityItems(p, itemId, remaining);
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
 return (p.inventory[itemId]?.count ?? 0) + totalQualityItemCount(p, itemId);
}

/**
  * 预检一组奖励是否能完整装入背包；不允许“收获成功但部分掉落丢失”。
 */
export function inventoryCanFitRewards(p: Player, rewards: readonly InventoryReward[]): boolean {
 const reservedNormal = new Set<string>();
 const reservedQuality = new Set<string>();
 let neededSlots = 0;

for (const reward of rewards) {
 if (reward.count <= 0) continue;
 if ('quality' in reward) {
 const current = qualityItemCount(p, reward.itemId, reward.quality);
 const key = `${reward.quality}:${reward.itemId}`;
 if (current <= 0 && !reservedQuality.has(key)) {
 reservedQuality.add(key);
 neededSlots += 1;
 }
 continue;
 }

const current = p.inventory[reward.itemId]?.count ?? 0;
 if (current <= 0 && !reservedNormal.has(reward.itemId)) {
 reservedNormal.add(reward.itemId);
 neededSlots += 1;
 }
 }

return inventoryUsed(p) + neededSlots <= p.inventoryCapacity;
}
