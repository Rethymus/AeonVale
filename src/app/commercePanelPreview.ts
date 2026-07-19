import type { ContentRegistry } from '@content/defs';
import type { TradeOffer } from '@sim';
import type { ShopItem, FestivalStallItem } from '@sim';
import { itemIconAssetId } from './itemIcons';

export interface CommercePanelPreview {
  title: string;
  details: string;
  assetId?: string;
  panelAssetId?: string;
}

export interface CommerceToastPresentation {
  message: string;
  assetId?: string;
}

export function tradeUnavailableToastPresentation(reason: 'stage-gated' | 'empty'): CommerceToastPresentation {
  return {
    message: reason === 'stage-gated' ? '无可交易（修为过低）' : '无可交易',
    assetId: 'loc.valley-market'
  };
}

export function shopUnavailableToastPresentation(kind: 'shop' | 'festival-stall'): CommerceToastPresentation {
  return {
    message: kind === 'festival-stall' ? '节日摊位已收摊' : '坊市暂未开张',
    assetId: kind === 'festival-stall' ? 'loc.festival-ground' : 'loc.valley-market'
  };
}

export function tradePanelPreview(offer: TradeOffer, content: ContentRegistry): CommercePanelPreview {
  const giveName = content.items.get(offer.give.itemId)?.displayName ?? offer.give.itemId;
  const receiveName = content.items.get(offer.receive.itemId)?.displayName ?? offer.receive.itemId;

  return {
    title: offer.displayName,
    details: `散修交易\n得 ${receiveName} × ${offer.receive.qty}\n付 ${giveName} × ${offer.give.qty}`,
    assetId: itemIconAssetId(offer.receive.itemId, content),
    panelAssetId: 'loc.valley-market'
  };
}

export function tradeToastPresentation(offer: TradeOffer, indexLabel: string, confirmHint: string, content: ContentRegistry): CommerceToastPresentation {
  const preview = tradePanelPreview(offer, content);
  return {
    message: `交易${indexLabel}：${preview.title}｜Tab切换·${confirmHint}`,
    assetId: preview.panelAssetId ?? preview.assetId
  };
}

export function tradeResultToastPresentation(offer: TradeOffer, outcome: 'success' | 'failure', content: ContentRegistry, reason?: string): CommerceToastPresentation {
  const preview = tradePanelPreview(offer, content);
  const receiveName = content.items.get(offer.receive.itemId)?.displayName ?? offer.receive.itemId;
  return {
    message: outcome === 'success' ? `交易成功：得 ${receiveName}×${offer.receive.qty}` : `交易失败：${reason ?? preview.title}`,
    assetId: outcome === 'success' ? preview.assetId : (preview.panelAssetId ?? preview.assetId)
  };
}

export function shopPanelPreview(kind: 'shop' | 'festival-stall', item: ShopItem | FestivalStallItem, content: ContentRegistry): CommercePanelPreview {
  return {
    title: item.displayName,
    details: `${kind === 'festival-stall' ? '节日摊位' : '坊市'}\n灵石 × ${item.price}`,
    assetId: itemIconAssetId(item.itemId, content),
    panelAssetId: kind === 'festival-stall' ? 'loc.festival-ground' : 'loc.valley-market'
  };
}

export function shopToastPresentation(kind: 'shop' | 'festival-stall', item: ShopItem | FestivalStallItem, indexLabel: string, confirmHint: string, content: ContentRegistry): CommerceToastPresentation {
  const preview = shopPanelPreview(kind, item, content);
  return {
    message: `${kind === 'festival-stall' ? '节日摊位' : '坊市'}${indexLabel}：${preview.title}｜Tab切换·${confirmHint}`,
    assetId: preview.panelAssetId ?? preview.assetId
  };
}

export function shopResultToastPresentation(kind: 'shop' | 'festival-stall', item: ShopItem | FestivalStallItem, outcome: 'success' | 'failure', content: ContentRegistry): CommerceToastPresentation {
  const preview = shopPanelPreview(kind, item, content);
  const action = kind === 'festival-stall' ? '节日购得' : '购得';
  const failure = kind === 'festival-stall' ? '节日购买失败' : '购买失败';
  return {
    message: outcome === 'success' ? `${action} ${item.displayName}×1` : `${failure}：${item.displayName}`,
    assetId: outcome === 'success' ? preview.assetId : (preview.panelAssetId ?? preview.assetId)
  };
}
