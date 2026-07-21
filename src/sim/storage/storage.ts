/**
 * 农庄仓库/箱子：把长期材料从随身背包分离出来，补上 Stardew-like 的存取管理。
 * sim 层保持纯函数：不做 IO，不依赖渲染；失败路径必须两边状态不变。
 */
import type { CropQuality } from '@sim/farm/quality';
import type { GameState, StorageState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { inventoryCanFitRewards, mutateNormalItem, mutateQualityItem, normalItemCount, qualityItemCount } from '@sim/world/player';
import type { ContentRegistry } from '@content/defs';

const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];
type StorageStackContent = Pick<ContentRegistry, 'items'>;

export interface StorageResult {
  ok: boolean;
  itemId: string;
  count: number;
  quality?: CropQuality;
  reason?: string;
}

export type StorageReward = { itemId: string; count: number } | { itemId: string; quality: CropQuality; count: number };

export function storageUsed(storage: StorageState): number {
  let used = Object.keys(storage.inventory).filter(id => (storage.inventory[id]?.count ?? 0) > 0).length;
  for (const quality of QUALITY_ORDER) {
    const batch = storage.qualityInventory[quality];
    if (!batch) continue;
    used += Object.values(batch).filter(count => count > 0).length;
  }
  return used;
}

export function storageItemCount(storage: StorageState, itemId: string): number {
  return storage.inventory[itemId]?.count ?? 0;
}

export function storageQualityItemCount(storage: StorageState, itemId: string, quality: CropQuality): number {
  return storage.qualityInventory[quality]?.[itemId] ?? 0;
}

function storageRewardStackLimit(content: StorageStackContent | undefined, itemId: string, fallbackCount: number): number {
  if (!content) return Number.POSITIVE_INFINITY;
  const stack = content.items.get(itemId)?.stack;
  return typeof stack === 'number' && Number.isInteger(stack) && stack > 0 ? stack : Math.max(1, fallbackCount);
}

export function storageReceivableCount(storage: StorageState, itemId: string, count: number, content?: StorageStackContent, quality?: CropQuality): number {
  if (!Number.isInteger(count) || count <= 0) return 0;
  const maxStack = storageRewardStackLimit(content, itemId, count);
  const current = quality ? storageQualityItemCount(storage, itemId, quality) : storageItemCount(storage, itemId);
  if (current > 0) return Math.min(count, Math.max(0, maxStack - current));
  if (storageUsed(storage) >= storage.capacity) return 0;
  return Math.min(count, maxStack);
}

export function storageCanFitRewards(storage: StorageState, rewards: readonly StorageReward[], content?: StorageStackContent): boolean {
  const normalCounts = new Map<string, number>();
  for (const [itemId, slot] of Object.entries(storage.inventory)) {
    if ((slot?.count ?? 0) > 0) normalCounts.set(itemId, slot.count);
  }

  const qualityCounts = new Map<string, number>();
  for (const quality of QUALITY_ORDER) {
    const batch = storage.qualityInventory[quality];
    if (!batch) continue;
    for (const [itemId, count] of Object.entries(batch)) {
      if (count > 0) qualityCounts.set(`${quality}:${itemId}`, count);
    }
  }

  let usedSlots = storageUsed(storage);
  for (const reward of rewards) {
    if (reward.count <= 0) continue;
    const maxStack = storageRewardStackLimit(content, reward.itemId, reward.count);
    if ('quality' in reward) {
      const key = `${reward.quality}:${reward.itemId}`;
      const current = qualityCounts.get(key) ?? 0;
      if (current <= 0) usedSlots += 1;
      const next = current + reward.count;
      if (usedSlots > storage.capacity || next > maxStack) return false;
      qualityCounts.set(key, next);
      continue;
    }

    const current = normalCounts.get(reward.itemId) ?? 0;
    if (current <= 0) usedSlots += 1;
    const next = current + reward.count;
    if (usedSlots > storage.capacity || next > maxStack) return false;
    normalCounts.set(reward.itemId, next);
  }
  return true;
}

function mutateStorageItem(storage: StorageState, itemId: string, delta: number): boolean {
  const slot = storage.inventory[itemId];
  if (delta < 0) {
    if ((slot?.count ?? 0) < -delta) return false;
    slot!.count += delta;
    if (slot!.count <= 0) delete storage.inventory[itemId];
    return true;
  }
  if (delta > 0) {
    if (!slot) {
      if (storageUsed(storage) >= storage.capacity) return false;
      storage.inventory[itemId] = { itemId, count: delta };
    } else {
      slot.count += delta;
    }
  }
  return true;
}

function mutateStorageQualityItem(storage: StorageState, itemId: string, quality: CropQuality, delta: number): boolean {
  const batch = storage.qualityInventory[quality];
  const current = batch?.[itemId] ?? 0;
  if (delta < 0) {
    if (current < -delta) return false;
    if (!batch) return false;
    const next = current + delta;
    if (next <= 0) delete batch[itemId];
    else batch[itemId] = next;
    if (Object.keys(batch).length === 0) delete storage.qualityInventory[quality];
    return true;
  }
  if (delta > 0) {
    if (current <= 0 && storageUsed(storage) >= storage.capacity) return false;
    const targetBatch = batch ?? (storage.qualityInventory[quality] = {});
    targetBatch[itemId] = current + delta;
  }
  return true;
}

function validCount(itemId: string, count: number): StorageResult | null {
  if (!Number.isInteger(count) || count <= 0) return { ok: false, itemId, count, reason: '数量无效' };
  return null;
}

export function storeItemInStorage(storage: StorageState, itemId: string, count: number, content?: StorageStackContent): boolean {
  const invalid = validCount(itemId, count);
  if (invalid) return false;
  if (content && !storageCanFitRewards(storage, [{ itemId, count }], content)) return false;
  return mutateStorageItem(storage, itemId, count);
}

export function takeItemFromStorage(storage: StorageState, itemId: string, count: number): boolean {
  const invalid = validCount(itemId, count);
  if (invalid) return false;
  return mutateStorageItem(storage, itemId, -count);
}

export function storeQualityItemInStorage(storage: StorageState, itemId: string, quality: CropQuality, count: number, content?: StorageStackContent): boolean {
  const invalid = validCount(itemId, count);
  if (invalid) return false;
  if (content && !storageCanFitRewards(storage, [{ itemId, quality, count }], content)) return false;
  return mutateStorageQualityItem(storage, itemId, quality, count);
}

export function takeQualityItemFromStorage(storage: StorageState, itemId: string, quality: CropQuality, count: number): boolean {
  const invalid = validCount(itemId, count);
  if (invalid) return false;
  return mutateStorageQualityItem(storage, itemId, quality, -count);
}

export function depositItem(state: GameState, itemId: string, count: number, content?: StorageStackContent): StorageResult {
  const invalid = validCount(itemId, count);
  if (invalid) return invalid;
  if (normalItemCount(state.player, itemId) < count) return { ok: false, itemId, count, reason: '数量不足' };
  if (content && !storageCanFitRewards(state.storage, [{ itemId, count }], content)) return { ok: false, itemId, count, reason: '仓库已满' };
  if (!storeItemInStorage(state.storage, itemId, count, content)) return { ok: false, itemId, count, reason: '仓库已满' };
  mutateNormalItem(state.player, itemId, -count);
  emit(state, 'storage-deposit', { itemId, count });
  return { ok: true, itemId, count };
}

export function withdrawItem(state: GameState, itemId: string, count: number, content?: StorageStackContent): StorageResult {
  const invalid = validCount(itemId, count);
  if (invalid) return invalid;
  if (storageItemCount(state.storage, itemId) < count) return { ok: false, itemId, count, reason: '仓库数量不足' };
  if (content && !inventoryCanFitRewards(state.player, [{ itemId, count }], content)) return { ok: false, itemId, count, reason: '储物戒已满' };
  if (!mutateNormalItem(state.player, itemId, count)) return { ok: false, itemId, count, reason: '储物戒已满' };
  mutateStorageItem(state.storage, itemId, -count);
  emit(state, 'storage-withdraw', { itemId, count });
  return { ok: true, itemId, count };
}

export function depositQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number, content?: StorageStackContent): StorageResult {
  const invalid = validCount(itemId, count);
  if (invalid) return { ...invalid, quality };
  if (qualityItemCount(state.player, itemId, quality) < count) return { ok: false, itemId, quality, count, reason: '数量不足' };
  if (content && !storageCanFitRewards(state.storage, [{ itemId, quality, count }], content)) return { ok: false, itemId, quality, count, reason: '仓库已满' };
  if (!storeQualityItemInStorage(state.storage, itemId, quality, count, content)) return { ok: false, itemId, quality, count, reason: '仓库已满' };
  mutateQualityItem(state.player, itemId, quality, -count);
  emit(state, 'storage-deposit-quality', { itemId, quality, count });
  return { ok: true, itemId, quality, count };
}

export function withdrawQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number, content?: StorageStackContent): StorageResult {
  const invalid = validCount(itemId, count);
  if (invalid) return { ...invalid, quality };
  if (storageQualityItemCount(state.storage, itemId, quality) < count) return { ok: false, itemId, quality, count, reason: '仓库数量不足' };
  if (content && !inventoryCanFitRewards(state.player, [{ itemId, quality, count }], content)) return { ok: false, itemId, quality, count, reason: '储物戒已满' };
  if (!mutateQualityItem(state.player, itemId, quality, count)) return { ok: false, itemId, quality, count, reason: '储物戒已满' };
  mutateStorageQualityItem(state.storage, itemId, quality, -count);
  emit(state, 'storage-withdraw-quality', { itemId, quality, count });
  return { ok: true, itemId, quality, count };
}
