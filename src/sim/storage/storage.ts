/**
  * 农庄仓库/箱子：把长期材料从随身背包分离出来，补上 Stardew-like 的存取管理。
  * sim 层保持纯函数：不做 IO，不依赖渲染；失败路径必须两边状态不变。
 */
import type { CropQuality } from '@sim/farm/quality';
import type { GameState, StorageState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

export interface StorageResult {
 ok: boolean;
 itemId: string;
 count: number;
 quality?: CropQuality;
 reason?: string;
}

export function storageUsed(storage: StorageState): number {
 let used = Object.keys(storage.inventory).filter((id) => (storage.inventory[id]?.count ?? 0) > 0).length;
 for (const quality of QUALITY_ORDER) {
 const batch = storage.qualityInventory[quality];
 if (!batch) continue;
 used += Object.values(batch).filter((count) => count > 0).length;
 }
 return used;
}

export function storageItemCount(storage: StorageState, itemId: string): number {
 return storage.inventory[itemId]?.count ?? 0;
}

export function storageQualityItemCount(storage: StorageState, itemId: string, quality: CropQuality): number {
 return storage.qualityInventory[quality]?.[itemId] ?? 0;
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
 const batch = (storage.qualityInventory[quality] ??= {});
 const current = batch[itemId] ?? 0;
 if (delta < 0) {
 if (current < -delta) return false;
 const next = current + delta;
 if (next <= 0) delete batch[itemId];
 else batch[itemId] = next;
 if (Object.keys(batch).length === 0) delete storage.qualityInventory[quality];
 return true;
 }
 if (delta > 0) {
 if (current <= 0 && storageUsed(storage) >= storage.capacity) return false;
 batch[itemId] = current + delta;
 }
 return true;
}

function validCount(itemId: string, count: number): StorageResult | null {
 if (!Number.isInteger(count) || count <= 0) return { ok: false, itemId, count, reason: '数量无效' };
 return null;
}

export function storeItemInStorage(storage: StorageState, itemId: string, count: number): boolean {
 const invalid = validCount(itemId, count);
 if (invalid) return false;
 return mutateStorageItem(storage, itemId, count);
}

export function takeItemFromStorage(storage: StorageState, itemId: string, count: number): boolean {
 const invalid = validCount(itemId, count);
 if (invalid) return false;
 return mutateStorageItem(storage, itemId, -count);
}

export function depositItem(state: GameState, itemId: string, count: number): StorageResult {
 const invalid = validCount(itemId, count);
 if (invalid) return invalid;
 if (itemCount(state.player, itemId) < count) return { ok: false, itemId, count, reason: '数量不足' };
 if (!mutateStorageItem(state.storage, itemId, count)) return { ok: false, itemId, count, reason: '仓库已满' };
 mutateItem(state.player, itemId, -count);
 emit(state, 'storage-deposit', { itemId, count });
 return { ok: true, itemId, count };
}

export function withdrawItem(state: GameState, itemId: string, count: number): StorageResult {
 const invalid = validCount(itemId, count);
 if (invalid) return invalid;
 if (storageItemCount(state.storage, itemId) < count) return { ok: false, itemId, count, reason: '仓库数量不足' };
 if (!mutateItem(state.player, itemId, count)) return { ok: false, itemId, count, reason: '储物戒已满' };
 mutateStorageItem(state.storage, itemId, -count);
 emit(state, 'storage-withdraw', { itemId, count });
 return { ok: true, itemId, count };
}

export function depositQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number): StorageResult {
 const invalid = validCount(itemId, count);
 if (invalid) return { ...invalid, quality };
 if (qualityItemCount(state.player, itemId, quality) < count) return { ok: false, itemId, quality, count, reason: '数量不足' };
 if (!mutateStorageQualityItem(state.storage, itemId, quality, count)) return { ok: false, itemId, quality, count, reason: '仓库已满' };
 mutateQualityItem(state.player, itemId, quality, -count);
 emit(state, 'storage-deposit-quality', { itemId, quality, count });
 return { ok: true, itemId, quality, count };
}

export function withdrawQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number): StorageResult {
 const invalid = validCount(itemId, count);
 if (invalid) return { ...invalid, quality };
 if (storageQualityItemCount(state.storage, itemId, quality) < count) return { ok: false, itemId, quality, count, reason: '仓库数量不足' };
 if (!mutateQualityItem(state.player, itemId, quality, count)) return { ok: false, itemId, quality, count, reason: '储物戒已满' };
 mutateStorageQualityItem(state.storage, itemId, quality, -count);
 emit(state, 'storage-withdraw-quality', { itemId, quality, count });
 return { ok: true, itemId, quality, count };
}
