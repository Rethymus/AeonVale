import type { CropQuality } from '@sim/farm/quality';
import { shippingUnitPrice } from '@sim/economy/shipping';
import { FIRST_HARVEST_FLAG, FIRST_SHIPMENT_FLAG } from '@sim/story/onboarding';
import { storageItemCount, storageQualityItemCount, storageUsed, storeItemInStorage, storeQualityItemInStorage, takeItemFromStorage, takeQualityItemFromStorage } from '@sim/storage/storage';
import type { SimContext } from '@sim/world/context';
import { emit, placeGroundItem, type GameState, type InventoryContainerId } from '@sim/world/state';
import { inventoryUsed, mutateNormalItem, mutateQualityItem, normalItemCount, qualityItemCount } from '@sim/world/player';

export interface InventoryTransferRequest {
  from: InventoryContainerId;
  to: InventoryContainerId;
  itemId: string;
  count: number;
  quality?: CropQuality;
}

export interface InventoryTransferResult {
  ok: boolean;
  from: InventoryContainerId;
  to: InventoryContainerId;
  itemId: string;
  count: number;
  quality?: CropQuality;
  reason?: string;
}

export interface InventoryDropRequest {
  itemId: string;
  count: number;
  quality?: CropQuality;
}

export interface InventoryDropResult {
  ok: boolean;
  itemId: string;
  count: number;
  quality?: CropQuality;
  reason?: string;
}

function invalidTransfer(request: InventoryTransferRequest): InventoryTransferResult | null {
  if (!Number.isInteger(request.count) || request.count <= 0) {
    return { ok: false, ...request, reason: '数量无效' };
  }
  return null;
}

function invalidDrop(request: InventoryDropRequest): InventoryDropResult | null {
  if (!Number.isInteger(request.count) || request.count <= 0) {
    return { ok: false, ...request, reason: '数量无效' };
  }
  return null;
}

function sourceCount(state: GameState, container: InventoryContainerId, itemId: string, quality?: CropQuality): number {
  if (container === 'player') return quality ? qualityItemCount(state.player, itemId, quality) : normalItemCount(state.player, itemId);
  if (container === 'storage') return quality ? storageQualityItemCount(state.storage, itemId, quality) : storageItemCount(state.storage, itemId);
  return quality ? state.qualityShippingBin[quality]?.[itemId] ?? 0 : state.shippingBin[itemId] ?? 0;
}

function targetCapacityReason(container: InventoryContainerId): string {
  return container === 'player' ? '储物戒已满' : '仓库已满';
}

function itemStackLimit(ctx: SimContext, itemId: string, fallbackCount: number): number {
  const stack = ctx.content.items.get(itemId)?.stack;
  return typeof stack === 'number' && Number.isInteger(stack) && stack > 0 ? stack : Math.max(1, fallbackCount);
}

function limitedContainerUsed(state: GameState, container: Extract<InventoryContainerId, 'player' | 'storage'>): number {
  return container === 'player' ? inventoryUsed(state.player) : storageUsed(state.storage);
}

function limitedContainerCapacity(state: GameState, container: Extract<InventoryContainerId, 'player' | 'storage'>): number {
  return container === 'player' ? state.player.inventoryCapacity : state.storage.capacity;
}

function limitedTargetRoom(state: GameState, ctx: SimContext, container: Extract<InventoryContainerId, 'player' | 'storage'>, itemId: string, count: number, quality?: CropQuality): { count: number; reason?: string } {
  const maxStack = itemStackLimit(ctx, itemId, count);
  const current = sourceCount(state, container, itemId, quality);

  if (current > 0) {
    const room = Math.max(0, maxStack - current);
    return room > 0 ? { count: Math.min(count, room) } : { count: 0, reason: '堆叠已满' };
  }

  if (limitedContainerUsed(state, container) >= limitedContainerCapacity(state, container)) {
    return { count: 0, reason: targetCapacityReason(container) };
  }

  return { count: Math.min(count, maxStack) };
}

function addToContainer(state: GameState, ctx: SimContext, container: InventoryContainerId, itemId: string, count: number, quality?: CropQuality): boolean {
  if (container === 'player') return quality ? mutateQualityItem(state.player, itemId, quality, count) : mutateNormalItem(state.player, itemId, count);
  if (container === 'storage') return quality ? storeQualityItemInStorage(state.storage, itemId, quality, count, ctx.content) : storeItemInStorage(state.storage, itemId, count, ctx.content);
  if (quality) {
    const batch = (state.qualityShippingBin[quality] ??= {});
    batch[itemId] = (batch[itemId] ?? 0) + count;
  } else {
    state.shippingBin[itemId] = (state.shippingBin[itemId] ?? 0) + count;
  }
  return true;
}

function removeFromContainer(state: GameState, container: InventoryContainerId, itemId: string, count: number, quality?: CropQuality): boolean {
  if (container === 'player') return quality ? mutateQualityItem(state.player, itemId, quality, -count) : mutateNormalItem(state.player, itemId, -count);
  if (container === 'storage') return quality ? takeQualityItemFromStorage(state.storage, itemId, quality, count) : takeItemFromStorage(state.storage, itemId, count);

  if (quality) {
    const batch = state.qualityShippingBin[quality];
    const current = batch?.[itemId] ?? 0;
    if (!batch || current < count) return false;
    const next = current - count;
    if (next <= 0) delete batch[itemId];
    else batch[itemId] = next;
    if (Object.keys(batch).length === 0) delete state.qualityShippingBin[quality];
    return true;
  }

  const current = state.shippingBin[itemId] ?? 0;
  if (current < count) return false;
  const next = current - count;
  if (next <= 0) delete state.shippingBin[itemId];
  else state.shippingBin[itemId] = next;
  return true;
}

function emitContainerEvents(state: GameState, ctx: SimContext, request: InventoryTransferRequest): void {
  if (request.to === 'storage') {
    emit(state, request.quality ? 'storage-deposit-quality' : 'storage-deposit', request.quality ? { itemId: request.itemId, quality: request.quality, count: request.count } : { itemId: request.itemId, count: request.count });
  } else if (request.from === 'storage') {
    emit(state, request.quality ? 'storage-withdraw-quality' : 'storage-withdraw', request.quality ? { itemId: request.itemId, quality: request.quality, count: request.count } : { itemId: request.itemId, count: request.count });
  }

  if (request.to === 'shipping') {
    const unitPrice = shippingUnitPrice(ctx, request.itemId, request.quality, state);
    if (state.player.flags.has(FIRST_HARVEST_FLAG)) state.player.flags.add(FIRST_SHIPMENT_FLAG);
    emit(state, request.quality ? 'ship-quality-item' : 'ship-item', request.quality ? { itemId: request.itemId, quality: request.quality, count: request.count, unitPrice } : { itemId: request.itemId, count: request.count, unitPrice });
  } else if (request.from === 'shipping') {
    emit(state, request.quality ? 'unship-quality-item' : 'unship-item', request.quality ? { itemId: request.itemId, quality: request.quality, count: request.count } : { itemId: request.itemId, count: request.count });
  }

  emit(state, 'inventory-transfer', request);
}

export function transferInventoryItem(state: GameState, ctx: SimContext, request: InventoryTransferRequest): InventoryTransferResult {
  const invalid = invalidTransfer(request);
  if (invalid) return invalid;
  if (request.from === request.to) return { ok: true, ...request };
  if (sourceCount(state, request.from, request.itemId, request.quality) < request.count) {
    return { ok: false, ...request, reason: request.from === 'shipping' ? '出货箱数量不足' : request.from === 'storage' ? '仓库数量不足' : '数量不足' };
  }
  if (request.to === 'shipping' && shippingUnitPrice(ctx, request.itemId, request.quality, state) <= 0) {
    return { ok: false, ...request, reason: '不可出货' };
  }
  const movable =
    request.to === 'player' || request.to === 'storage'
      ? limitedTargetRoom(state, ctx, request.to, request.itemId, request.count, request.quality)
      : { count: request.count };
  if (movable.count <= 0) {
    const reason = request.to === 'player' || request.to === 'storage' ? (movable.reason ?? targetCapacityReason(request.to)) : '移动失败';
    return { ok: false, ...request, reason };
  }

  const movedRequest: InventoryTransferRequest = { ...request, count: movable.count };
  if (!removeFromContainer(state, request.from, request.itemId, movedRequest.count, request.quality)) {
    return { ok: false, ...request, reason: '数量不足' };
  }
  if (!addToContainer(state, ctx, request.to, request.itemId, movedRequest.count, request.quality)) {
    addToContainer(state, ctx, request.from, request.itemId, movedRequest.count, request.quality);
    return { ok: false, ...request, reason: request.to === 'shipping' ? '不可出货' : targetCapacityReason(request.to) };
  }

  emitContainerEvents(state, ctx, movedRequest);
  return { ok: true, ...movedRequest };
}

export function dropInventoryItem(state: GameState, request: InventoryDropRequest): InventoryDropResult {
  const invalid = invalidDrop(request);
  if (invalid) return invalid;
  if (sourceCount(state, 'player', request.itemId, request.quality) < request.count) {
    return { ok: false, ...request, reason: '数量不足' };
  }
  if (!removeFromContainer(state, 'player', request.itemId, request.count, request.quality)) {
    return { ok: false, ...request, reason: '数量不足' };
  }
  placeGroundItem(state, { itemId: request.itemId, count: request.count, quality: request.quality, pos: { ...state.player.position } });
  emit(state, 'inventory-drop', request);
  return { ok: true, ...request };
}
