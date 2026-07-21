/**
 * 出货箱经济循环（Stardew-like daily shipping）。
 *
 * 玩家白天把灵草/种子/战利品投入出货箱，日终统一结算为灵石。
 * 定价按内容表推导，保持 sim 确定性且避免维护另一份大型经济表。
 */
import type { ItemDef, SpiritHerbDef } from '@content/defs';
import type { SimContext } from '@sim/world/context';
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { inventoryUsed, mutateNormalItem, mutateQualityItem, normalItemCount, qualityItemCount } from '@sim/world/player';
import type { CropQuality } from '@sim/farm/quality';
import { FIRST_HARVEST_FLAG, FIRST_SHIPMENT_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG } from '@sim/story/onboarding';
import { marketDemandForItem } from './market';

export interface ShipResult {
  ok: boolean;
  itemId: string;
  count: number;
  unitPrice: number;
  quality?: CropQuality;
  reason?: string;
}

export interface ShippingLine {
  itemId: string;
  count: number;
  unitPrice: number;
  total: number;
  quality?: CropQuality;
}

export interface ShippingSettlement {
  ok: boolean;
  total: number;
  lines: ShippingLine[];
  reason?: string;
}

const HERB_PRICE_BY_TIER = [0, 1, 3, 7, 14, 25] as const;
const SEED_PRICE_BY_TIER = [0, 1, 2, 4, 7, 12] as const;
const PILL_PRICE_BY_TIER = [0, 3, 8, 16, 32, 60] as const;
const QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

function herbByItemId(ctx: SimContext, itemId: string): SpiritHerbDef | undefined {
  return ctx.content.herbs.get(itemId);
}

function herbBySeedId(ctx: SimContext, itemId: string): SpiritHerbDef | undefined {
  return ctx.content.seedToHerb.get(itemId);
}

function itemDef(ctx: SimContext, itemId: string): ItemDef | undefined {
  return ctx.content.items.get(itemId);
}

function itemStackLimit(ctx: SimContext, itemId: string, fallbackCount: number): number {
  const stack = itemDef(ctx, itemId)?.stack;
  return typeof stack === 'number' && Number.isInteger(stack) && stack > 0 ? stack : Math.max(1, fallbackCount);
}

function canReceiveNormalItem(state: GameState, ctx: SimContext, itemId: string, count: number): { ok: boolean; reason?: string } {
  const maxStack = itemStackLimit(ctx, itemId, count);
  const current = normalItemCount(state.player, itemId);
  if (current > 0) {
    return current + count <= maxStack ? { ok: true } : { ok: false, reason: itemId === 'item.spirit-stone' ? '灵石堆叠已满' : '堆叠已满' };
  }
  if (inventoryUsed(state.player) >= state.player.inventoryCapacity) return { ok: false, reason: '储物戒已满' };
  return count <= maxStack ? { ok: true } : { ok: false, reason: itemId === 'item.spirit-stone' ? '灵石堆叠已满' : '堆叠已满' };
}

function canReceiveQualityItem(state: GameState, ctx: SimContext, itemId: string, quality: CropQuality, count: number): { ok: boolean; reason?: string } {
  const maxStack = itemStackLimit(ctx, itemId, count);
  const current = qualityItemCount(state.player, itemId, quality);
  if (current > 0) return current + count <= maxStack ? { ok: true } : { ok: false, reason: '堆叠已满' };
  if (inventoryUsed(state.player) >= state.player.inventoryCapacity) return { ok: false, reason: '储物戒已满' };
  return count <= maxStack ? { ok: true } : { ok: false, reason: '堆叠已满' };
}

/** 返回灵石单价；0 表示不可通过出货箱出售。 */
export function shippingUnitPrice(ctx: SimContext, itemId: string, quality?: CropQuality, state?: GameState): number {
  const herb = herbByItemId(ctx, itemId);
  if (herb) return applyDemandBonus(applyQualityPrice(HERB_PRICE_BY_TIER[herb.tier], quality), itemId, state);

  const seedHerb = herbBySeedId(ctx, itemId);
  if (seedHerb) return applyDemandBonus(SEED_PRICE_BY_TIER[seedHerb.tier], itemId, state);

  const pill = ctx.content.pills.get(itemId);
  if (pill) return applyDemandBonus(PILL_PRICE_BY_TIER[pill.tier], itemId, state);

  const item = itemDef(ctx, itemId);
  if (!item) return 0;
  if (item.id === 'item.beast-core') return applyDemandBonus(3, itemId, state);
  if (item.id === 'item.broken-talisman') return applyDemandBonus(4, itemId, state);
  if (item.id === 'item.dried-herb') return applyDemandBonus(2, itemId, state);
  if (item.id === 'item.sealed-herb') return applyDemandBonus(7, itemId, state);
  if (item.id === 'item.herbal-wine') return applyDemandBonus(12, itemId, state);
  if (item.id === 'item.spirit-poultice') return applyDemandBonus(9, itemId, state);
  if (item.id === 'item.array-core') return applyDemandBonus(12, itemId, state);
  return 0;
}

function applyDemandBonus(base: number, itemId: string, state?: GameState): number {
  if (base <= 0 || !state) return base;
  const demand = marketDemandForItem(state, itemId);
  return demand ? base + demand.priceBonus : base;
}

function applyQualityPrice(base: number, quality?: CropQuality): number {
  if (base <= 0) return 0;
  switch (quality) {
    case 'spirit':
      return Math.ceil(base * 1.5);
    case 'treasure':
      return base * 2;
    case 'mortal':
    case undefined:
      return base;
  }
}

export function shippingItemCount(state: GameState, itemId: string): number {
  return state.shippingBin[itemId] ?? 0;
}

export function shippingQualityItemCount(state: GameState, itemId: string, quality: CropQuality): number {
  return state.qualityShippingBin[quality]?.[itemId] ?? 0;
}

function mutateShippingItem(state: GameState, itemId: string, delta: number): boolean {
  const current = state.shippingBin[itemId] ?? 0;
  if (delta < 0) {
    if (current < -delta) return false;
    const next = current + delta;
    if (next <= 0) delete state.shippingBin[itemId];
    else state.shippingBin[itemId] = next;
    return true;
  }
  if (delta > 0) {
    state.shippingBin[itemId] = current + delta;
    return true;
  }
  return true;
}

function mutateShippingQualityItem(state: GameState, itemId: string, quality: CropQuality, delta: number): boolean {
  const batch = state.qualityShippingBin[quality];
  const current = batch?.[itemId] ?? 0;
  if (delta < 0) {
    if (current < -delta) return false;
    if (!batch) return false;
    const next = current + delta;
    if (next <= 0) delete batch[itemId];
    else batch[itemId] = next;
    if (Object.keys(batch).length === 0) delete state.qualityShippingBin[quality];
    return true;
  }
  if (delta > 0) {
    const targetBatch = batch ?? (state.qualityShippingBin[quality] = {});
    targetBatch[itemId] = current + delta;
    return true;
  }
  return true;
}

export function canShipItem(ctx: SimContext, itemId: string): boolean {
  return shippingUnitPrice(ctx, itemId) > 0;
}

/**
 * 白天入箱：先从背包扣除，再加入 shippingBin。失败不变更状态。
 */
export function shipItem(state: GameState, itemId: string, count: number, ctx: SimContext): ShipResult {
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, itemId, count, unitPrice: 0, reason: '数量无效' };
  }
  const unitPrice = shippingUnitPrice(ctx, itemId, undefined, state);
  if (unitPrice <= 0) return { ok: false, itemId, count, unitPrice, reason: '不可出货' };
  if (normalItemCount(state.player, itemId) < count) {
    return { ok: false, itemId, count, unitPrice, reason: '数量不足' };
  }
  mutateNormalItem(state.player, itemId, -count);
  mutateShippingItem(state, itemId, count);
  if (state.player.flags.has(FIRST_HARVEST_FLAG)) state.player.flags.add(FIRST_SHIPMENT_FLAG);
  emit(state, 'ship-item', { itemId, count, unitPrice });
  return { ok: true, itemId, count, unitPrice };
}

/** 白天投入指定品质批次；用于灵草品质经济，失败不变更状态。 */
export function shipQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number, ctx: SimContext): ShipResult {
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, itemId, quality, count, unitPrice: 0, reason: '数量无效' };
  }
  const unitPrice = shippingUnitPrice(ctx, itemId, quality, state);
  if (unitPrice <= 0) return { ok: false, itemId, quality, count, unitPrice, reason: '不可出货' };
  if (qualityItemCount(state.player, itemId, quality) < count) {
    return { ok: false, itemId, quality, count, unitPrice, reason: '数量不足' };
  }
  mutateQualityItem(state.player, itemId, quality, -count);
  mutateShippingQualityItem(state, itemId, quality, count);
  if (state.player.flags.has(FIRST_HARVEST_FLAG)) state.player.flags.add(FIRST_SHIPMENT_FLAG);
  emit(state, 'ship-quality-item', { itemId, quality, count, unitPrice });
  return { ok: true, itemId, quality, count, unitPrice };
}

export function unshipItem(state: GameState, itemId: string, count: number, ctx: SimContext): ShipResult {
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, itemId, count, unitPrice: 0, reason: '数量无效' };
  }
  if (shippingItemCount(state, itemId) < count) return { ok: false, itemId, count, unitPrice: 0, reason: '出货箱数量不足' };
  const receive = canReceiveNormalItem(state, ctx, itemId, count);
  if (!receive.ok) return { ok: false, itemId, count, unitPrice: 0, reason: receive.reason ?? '储物戒已满' };
  if (!mutateNormalItem(state.player, itemId, count)) return { ok: false, itemId, count, unitPrice: 0, reason: '储物戒已满' };
  mutateShippingItem(state, itemId, -count);
  emit(state, 'unship-item', { itemId, count });
  return { ok: true, itemId, count, unitPrice: 0 };
}

export function unshipQualityItem(state: GameState, itemId: string, quality: CropQuality, count: number, ctx: SimContext): ShipResult {
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, itemId, quality, count, unitPrice: 0, reason: '数量无效' };
  }
  if (shippingQualityItemCount(state, itemId, quality) < count) return { ok: false, itemId, quality, count, unitPrice: 0, reason: '出货箱数量不足' };
  const receive = canReceiveQualityItem(state, ctx, itemId, quality, count);
  if (!receive.ok) return { ok: false, itemId, quality, count, unitPrice: 0, reason: receive.reason ?? '储物戒已满' };
  if (!mutateQualityItem(state.player, itemId, quality, count)) return { ok: false, itemId, quality, count, unitPrice: 0, reason: '储物戒已满' };
  mutateShippingQualityItem(state, itemId, quality, -count);
  emit(state, 'unship-quality-item', { itemId, quality, count });
  return { ok: true, itemId, quality, count, unitPrice: 0 };
}

export function shippingLines(state: GameState, ctx: SimContext): ShippingLine[] {
  const normalLines: ShippingLine[] = Object.entries(state.shippingBin)
    .filter(([, count]) => count > 0)
    .map(([itemId, count]) => {
      const unitPrice = shippingUnitPrice(ctx, itemId, undefined, state);
      return { itemId, count, unitPrice, total: unitPrice * count };
    })
    .filter(line => line.unitPrice > 0);

  const qualityLines: ShippingLine[] = QUALITY_ORDER.flatMap(quality => {
    const batch = state.qualityShippingBin[quality] ?? {};
    return Object.entries(batch)
      .filter(([, count]) => count > 0)
      .map(([itemId, count]) => {
        const unitPrice = shippingUnitPrice(ctx, itemId, quality, state);
        return { itemId, quality, count, unitPrice, total: unitPrice * count };
      })
      .filter(line => line.unitPrice > 0);
  });

  return [...normalLines, ...qualityLines].sort((a, b) => {
    const byItem = a.itemId.localeCompare(b.itemId);
    if (byItem !== 0) return byItem;
    return String(a.quality ?? '').localeCompare(String(b.quality ?? ''));
  });
}

/**
 * 日终结算：把出货箱转换为灵石。若背包容量无法接收灵石，保留出货箱并发阻塞事件。
 */
export function settleShipping(state: GameState, ctx: SimContext): ShippingSettlement {
  const lines = shippingLines(state, ctx);
  const total = lines.reduce((sum, line) => sum + line.total, 0);
  if (total <= 0) return { ok: true, total: 0, lines };

  const payment = canReceiveNormalItem(state, ctx, 'item.spirit-stone', total);
  if (!payment.ok) {
    emit(state, 'shipping-blocked', { total, lines });
    return { ok: false, total, lines, reason: payment.reason ?? '储物戒已满' };
  }
  const gotPaid = mutateNormalItem(state.player, 'item.spirit-stone', total);
  if (!gotPaid) {
    emit(state, 'shipping-blocked', { total, lines });
    return { ok: false, total, lines, reason: '储物戒已满' };
  }

  state.shippingBin = {};
  state.qualityShippingBin = {};
  state.player.flags.add(FIRST_SHIPPING_SETTLEMENT_FLAG);
  emit(state, 'shipping-settlement', {
    total,
    lines: lines.map(line => {
      const demand = marketDemandForItem(state, line.itemId);
      return demand ? { ...line, demand } : line;
    })
  });
  return { ok: true, total, lines };
}
