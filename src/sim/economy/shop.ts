/**
 * 基础坊市：把出货获得的灵石稳定换回种子/工具，形成种田经济闭环。
 *
 * 与散仙交易不同，坊市是常驻、固定价格、确定性购买；高阶种子仍由阶段门槛控制，
 * 避免绕过探索、猎妖、天象赠种等获取路径。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { inventoryCanFitRewards, itemCount, mutateItem } from '@sim/world/player';
import { hasRelationshipPerk } from '@sim/social/relationshipEvents';
import { FIRST_MARKET_RESTOCK_FLAG } from '@sim/story/onboarding';

export interface ShopItem {
  itemId: string;
  displayName: string;
  price: number;
  stageMin: number;
}

export interface BuyShopResult {
  ok: boolean;
  item: ShopItem | null;
  count: number;
  totalPrice: number;
  reason?: string;
}

export const SHOP_CATALOG: readonly ShopItem[] = [
  { itemId: 'seed.mossling', displayName: '凡间青苔种', price: 1, stageMin: 0 },
  { itemId: 'seed.stonegrain', displayName: '粟石草种', price: 1, stageMin: 0 },
  { itemId: 'seed.dewroot', displayName: '露根草种', price: 2, stageMin: 0 },
  { itemId: 'seed.suncap', displayName: '朝阳菇种', price: 2, stageMin: 0 },
  { itemId: 'seed.mistfern', displayName: '雾蕨种', price: 2, stageMin: 0 },
  { itemId: 'seed.sunmoss', displayName: '烬阳苔种', price: 2, stageMin: 0 },
  { itemId: 'item.spirit-compost', displayName: '灵壤肥', price: 3, stageMin: 0 },
  { itemId: 'seed.frostmarrow', displayName: '寒潭莲种', price: 4, stageMin: 1 },
  { itemId: 'seed.emberheart', displayName: '赤炎草种', price: 4, stageMin: 1 },
  { itemId: 'seed.balmleaf', displayName: '和合叶种', price: 5, stageMin: 1 },
  { itemId: 'seed.metalpine', displayName: '雷击木种', price: 8, stageMin: 2 },
  { itemId: 'seed.thunderreed', displayName: '引雷芦种', price: 8, stageMin: 2 },
  { itemId: 'item.rust-hoe', displayName: '铁锈锄', price: 6, stageMin: 0 },
  { itemId: 'item.sickle', displayName: '镰刀', price: 6, stageMin: 0 },
  { itemId: 'item.water-pail', displayName: '灵水桶', price: 8, stageMin: 0 }
];

function effectiveShopItem(state: GameState, item: ShopItem): ShopItem {
  if (item.itemId === 'item.spirit-compost' && hasRelationshipPerk(state, 'herb-gatherer-160')) {
    return { ...item, price: Math.max(1, item.price - 1) };
  }
  // 深交（320）：采药女把和合叶种这类常用药草种子也按故交价让利一格灵石。
  if (item.itemId === 'seed.balmleaf' && hasRelationshipPerk(state, 'herb-gatherer-320')) {
    return { ...item, price: Math.max(1, item.price - 1) };
  }
  return item;
}

export function getShopItems(state: GameState): ShopItem[] {
  return SHOP_CATALOG.filter(item => state.player.stage >= item.stageMin).map(item => effectiveShopItem(state, item));
}

export function buyShopItem(state: GameState, itemId: string, count = 1, ctx?: SimContext): BuyShopResult {
  if (!Number.isInteger(count) || count <= 0) {
    return { ok: false, item: null, count, totalPrice: 0, reason: '数量无效' };
  }
  const baseItem = SHOP_CATALOG.find(entry => entry.itemId === itemId) ?? null;
  if (!baseItem) return { ok: false, item: null, count, totalPrice: 0, reason: '无此商品' };
  const item = effectiveShopItem(state, baseItem);
  if (state.player.stage < item.stageMin) return { ok: false, item, count, totalPrice: item.price * count, reason: '阶段不足' };

  const totalPrice = item.price * count;
  if (itemCount(state.player, 'item.spirit-stone') < totalPrice) {
    return { ok: false, item, count, totalPrice, reason: '灵石不足' };
  }

  mutateItem(state.player, 'item.spirit-stone', -totalPrice);
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: item.itemId, count }], ctx.content)) {
    mutateItem(state.player, 'item.spirit-stone', totalPrice);
    return { ok: false, item, count, totalPrice, reason: '储物戒已满' };
  }
  const received = mutateItem(state.player, item.itemId, count);
  if (!received) {
    mutateItem(state.player, 'item.spirit-stone', totalPrice);
    return { ok: false, item, count, totalPrice, reason: '储物戒已满' };
  }

  if (item.itemId.startsWith('seed.')) {
    state.player.flags.add(FIRST_MARKET_RESTOCK_FLAG);
  }

  emit(state, 'shop-buy', { itemId: item.itemId, count, totalPrice });
  return { ok: true, item, count, totalPrice };
}
