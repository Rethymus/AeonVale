import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import type { FestivalStallItem, ShopItem, TradeOffer } from '@sim';
import {
 shopPanelPreview,
 shopResultToastPresentation,
 shopToastPresentation,
 shopUnavailableToastPresentation,
 tradePanelPreview,
 tradeResultToastPresentation,
 tradeToastPresentation,
 tradeUnavailableToastPresentation,
} from '@app/commercePanelPreview';

describe('commerce panel preview', () => {
 it('describes trade preview with receive icon as the visual subject', () => {
 const reg = buildRegistry();
 const offer: TradeOffer = {
 id: 'trade.stone-frostmarrow',
 displayName: '灵石换寒髓种',
 give: { itemId: 'item.spirit-stone', qty: 2 },
 receive: { itemId: 'seed.frostmarrow', qty: 1 },
 stageMin: 1,
 };

expect(tradePanelPreview(offer, reg)).toEqual({
 title: '灵石换寒髓种',
 details: '散修交易\n得 寒潭莲种子 × 1\n付 灵石 × 2',
 assetId: 'icon.seed.frostmarrow',
 panelAssetId: 'loc.valley-market',
 });
 });

it('builds trade toast from preview asset ids', () => {
 const reg = buildRegistry();
 const offer: TradeOffer = {
 id: 'trade.beastcore-stone',
 displayName: '内丹换灵石',
 give: { itemId: 'item.beast-core', qty: 1 },
 receive: { itemId: 'item.spirit-stone', qty: 3 },
 stageMin: 1,
 };

expect(tradeToastPresentation(offer, '（1/3）', '空格/E/回车成交·Esc返回', reg)).toEqual({
 message: '交易（1/3）：内丹换灵石｜Tab切换·空格/E/回车成交·Esc返回',
 assetId: 'loc.valley-market',
 });
 });

it('describes shop and festival stall previews with item art', () => {
 const reg = buildRegistry();
 const shopItem: ShopItem = { itemId: 'item.spirit-compost', displayName: '灵壤肥', price: 3, stageMin: 0 };
 const stallItem: FestivalStallItem = { eventId: 'event.spring-festival', itemId: 'seed.balmleaf', displayName: '和合叶种', price: 3 };

expect(shopPanelPreview('shop', shopItem, reg)).toEqual({
 title: '灵壤肥',
 details: '商店\n灵石 × 3',
 assetId: 'icon.item.spirit-compost',
 panelAssetId: 'loc.valley-market',
 });
 expect(shopPanelPreview('festival-stall', stallItem, reg)).toEqual({
 title: '和合叶种',
 details: '节日摊位\n灵石 × 3',
 assetId: 'icon.seed.balmleaf',
 panelAssetId: 'loc.festival-ground',
 });
 });

it('builds shop and festival stall toasts from preview asset ids', () => {
 const reg = buildRegistry();
 const shopItem: ShopItem = { itemId: 'seed.dewroot', displayName: '露根草种', price: 2, stageMin: 0 };
 const stallItem: FestivalStallItem = { eventId: 'event.winter-festival', itemId: 'item.array-core', displayName: '阵核', price: 5 };

expect(shopToastPresentation('shop', shopItem, '（2/6）', '空格/E/回车购买·Esc返回', reg)).toEqual({
 message: '商店（2/6）：露根草种｜Tab切换·空格/E/回车购买·Esc返回',
 assetId: 'loc.valley-market',
 });
 expect(shopToastPresentation('festival-stall', stallItem, '（1/2）', '空格/E/回车购买·Esc返回', reg)).toEqual({
 message: '节日摊位（1/2）：阵核｜Tab切换·空格/E/回车购买·Esc返回',
 assetId: 'loc.festival-ground',
 });
 });

it('keeps unavailable commerce failures anchored to the current venue thread', () => {
 expect(tradeUnavailableToastPresentation('stage-gated')).toEqual({
 message: '无可交易（修为过低）',
 assetId: 'loc.valley-market',
 });
 expect(tradeUnavailableToastPresentation('empty')).toEqual({
 message: '无可交易',
 assetId: 'loc.valley-market',
 });
 expect(shopUnavailableToastPresentation('shop')).toEqual({
 message: '商店暂未开张',
 assetId: 'loc.valley-market',
 });
 expect(shopUnavailableToastPresentation('festival-stall')).toEqual({
 message: '节日摊位已收摊',
 assetId: 'loc.festival-ground',
 });
 });

it('keeps commerce root browsing surfaces anchored to place art while success result toasts stay item-specific', () => {
 const reg = buildRegistry();
 const shopItem: ShopItem = { itemId: 'seed.dewroot', displayName: '露根草种', price: 2, stageMin: 0 };
 const offer: TradeOffer = {
 id: 'trade.beastcore-stone',
 displayName: '内丹换灵石',
 give: { itemId: 'item.beast-core', qty: 1 },
 receive: { itemId: 'item.spirit-stone', qty: 3 },
 stageMin: 1,
 };

expect(shopPanelPreview('shop', shopItem, reg).panelAssetId).toBe('loc.valley-market');
 expect(tradePanelPreview(offer, reg).panelAssetId).toBe('loc.valley-market');
 expect(shopResultToastPresentation('shop', shopItem, 'success', reg).assetId).toBe('icon.seed.dewroot');
 expect(tradeResultToastPresentation(offer, 'success', reg).assetId).toBe('icon.item.spirit-stone');
 });

it('keeps trade success item-led but returns failure toasts to the market thread asset', () => {
 const reg = buildRegistry();
 const offer: TradeOffer = {
 id: 'trade.beastcore-stone',
 displayName: '内丹换灵石',
 give: { itemId: 'item.beast-core', qty: 1 },
 receive: { itemId: 'item.spirit-stone', qty: 3 },
 stageMin: 1,
 };

expect(tradeResultToastPresentation(offer, 'success', reg)).toEqual({
 message: '交易成功：得 灵石×3',
 assetId: 'icon.item.spirit-stone',
 });
 expect(tradeResultToastPresentation(offer, 'failure', reg, '修为不足')).toEqual({
 message: '交易失败：修为不足',
 assetId: 'loc.valley-market',
 });
 });

it('keeps shop and festival success item-led but returns failure toasts to the venue thread asset', () => {
 const reg = buildRegistry();
 const shopItem: ShopItem = { itemId: 'seed.dewroot', displayName: '露根草种', price: 2, stageMin: 0 };
 const stallItem: FestivalStallItem = { eventId: 'event.winter-festival', itemId: 'item.array-core', displayName: '阵核', price: 5 };

expect(shopResultToastPresentation('shop', shopItem, 'success', reg)).toEqual({
 message: '购得 露根草种×1',
 assetId: 'icon.seed.dewroot',
 });
 expect(shopResultToastPresentation('shop', shopItem, 'failure', reg)).toEqual({
 message: '购买失败：露根草种',
 assetId: 'loc.valley-market',
 });
 expect(shopResultToastPresentation('festival-stall', stallItem, 'success', reg)).toEqual({
 message: '节日购得 阵核×1',
 assetId: 'icon.item.array-core',
 });
 expect(shopResultToastPresentation('festival-stall', stallItem, 'failure', reg)).toEqual({
 message: '节日购买失败：阵核',
 assetId: 'loc.festival-ground',
 });
 });
});
