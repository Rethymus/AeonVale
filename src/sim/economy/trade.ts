/**
 * 散仙交易。
 *
 * 凡人无法开店，但偶至的游方散仙接受以战利品/灵石换取种子与残卷。
 * 设计为**确定性**：固定汇率目录，无随机——交易是玩家主动决策的资源转换，
 * 不消耗 RNG 流（保护天象/妖兽确定性）。修为门槛按 阶段解锁。
 *
 * sim 安全：纯追加模块，不触碰已调参的种田/炼丹/天劫数值。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { inventoryCanFitRewards, mutateItem, itemCount } from '@sim/world/player';
import { hasRelationshipPerk } from '@sim/social/relationshipEvents';

/** 单条交易要约：以 give 换 receive，受 stageMin 门槛约束。 */
export interface TradeOffer {
  id: string;
  displayName: string;
  give: { itemId: string; qty: number };
  receive: { itemId: string; qty: number };
  stageMin: number;
}

/**
 * 交易目录。汇率偏向散仙（凡人议价弱）。
 * 内丹/法宝→灵石/残卷；灵石→种子。种子类按阶段开放高价稀有草。
 */
export const TRADE_CATALOG: readonly TradeOffer[] = [
  { id: 'trade.beastcore-stone', displayName: '内丹换灵石', give: { itemId: 'item.beast-core', qty: 1 }, receive: { itemId: 'item.spirit-stone', qty: 3 }, stageMin: 1 },
  { id: 'trade.talisman-fragment', displayName: '法宝换残卷', give: { itemId: 'item.broken-talisman', qty: 1 }, receive: { itemId: 'item.recipe-fragment', qty: 1 }, stageMin: 2 },
  { id: 'trade.stone-fragment', displayName: '灵石换残卷', give: { itemId: 'item.spirit-stone', qty: 5 }, receive: { itemId: 'item.recipe-fragment', qty: 1 }, stageMin: 2 },
  { id: 'trade.stone-frostmarrow', displayName: '灵石换寒潭莲种', give: { itemId: 'item.spirit-stone', qty: 2 }, receive: { itemId: 'seed.frostmarrow', qty: 1 }, stageMin: 1 },
  { id: 'trade.stone-metalpine', displayName: '灵石换雷击木种', give: { itemId: 'item.spirit-stone', qty: 4 }, receive: { itemId: 'seed.metalpine', qty: 1 }, stageMin: 2 },
  { id: 'trade.stone-ironwill', displayName: '灵石换铁心刺种', give: { itemId: 'item.spirit-stone', qty: 8 }, receive: { itemId: 'seed.ironwill-thorn', qty: 1 }, stageMin: 3 }
];

const FAMILIAR_TRADE_OFFERS: readonly TradeOffer[] = [{ id: 'trade.familiar-beastcore-fragment', displayName: '熟人：内丹换残卷', give: { itemId: 'item.beast-core', qty: 2 }, receive: { itemId: 'item.recipe-fragment', qty: 1 }, stageMin: 1 }];

/**
 * 故交深交（wandering-cultivator-320）后解锁的溢价交易。
 * 游方散修按故交价收购玩家自产的高阶加工货（封藏灵草/灵药酒），
 * 给这些出货/自用/归档之外的货品第四条经济去路——且汇率偏向玩家，区别于散仙阶段的讨价弱。
 */
const FAMILIAR_TRADE_OFFERS_T2: readonly TradeOffer[] = [
  { id: 'trade.familiar-sealed-stone', displayName: '故交：封藏灵草换灵石', give: { itemId: 'item.sealed-herb', qty: 1 }, receive: { itemId: 'item.spirit-stone', qty: 6 }, stageMin: 3 },
  { id: 'trade.familiar-wine-fragment', displayName: '故交：药酒换残卷', give: { itemId: 'item.herbal-wine', qty: 2 }, receive: { itemId: 'item.recipe-fragment', qty: 1 }, stageMin: 3 }
];

function tradeCatalogForState(state: GameState): readonly TradeOffer[] {
  let offers: readonly TradeOffer[] = TRADE_CATALOG;
  if (hasRelationshipPerk(state, 'wandering-cultivator-160')) {
    offers = [...offers, ...FAMILIAR_TRADE_OFFERS];
  }
  if (hasRelationshipPerk(state, 'wandering-cultivator-320')) {
    offers = [...offers, ...FAMILIAR_TRADE_OFFERS_T2];
  }
  return offers;
}

/** 当前可见的交易（按阶段过滤）。 */
export function getTradeOffers(state: GameState): TradeOffer[] {
  return tradeCatalogForState(state).filter(o => state.player.stage >= o.stageMin);
}

export interface TradeResult {
  ok: boolean;
  offer: TradeOffer | null;
  reason?: string;
}

/**
 * 执行一笔交易。校验阶段→材料→容量；容量满时回滚 give。
 * 成功发出 'trade' 事件（give/receive），供 UI 反馈。
 */
export function executeTrade(state: GameState, offerId: string, ctx?: SimContext): TradeResult {
  const offer = tradeCatalogForState(state).find(o => o.id === offerId) ?? null;
  if (!offer) return { ok: false, offer: null, reason: '无此交易' };
  if (state.player.stage < offer.stageMin) return { ok: false, offer, reason: '修为不足' };
  if (itemCount(state.player, offer.give.itemId) < offer.give.qty) {
    return { ok: false, offer, reason: '材料不足' };
  }
  // 先扣 give；若 receive 因容量失败则回滚，保证原子性。
  mutateItem(state.player, offer.give.itemId, -offer.give.qty);
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: offer.receive.itemId, count: offer.receive.qty }], ctx.content)) {
    mutateItem(state.player, offer.give.itemId, offer.give.qty);
    return { ok: false, offer, reason: '储物戒已满' };
  }
  const got = mutateItem(state.player, offer.receive.itemId, offer.receive.qty);
  if (!got) {
    mutateItem(state.player, offer.give.itemId, offer.give.qty);
    return { ok: false, offer, reason: '储物戒已满' };
  }
  emit(state, 'trade', { offerId: offer.id, give: offer.give, receive: offer.receive });
  return { ok: true, offer };
}
