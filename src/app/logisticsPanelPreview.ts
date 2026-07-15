import type { ContentRegistry } from '@content/defs';
import type { CropQuality } from '@sim/farm/quality';
import { itemIconAssetId } from './itemIcons';

export interface LogisticsPreview {
 title: string;
 details: string;
 assetId?: string;
 panelAssetId?: string;
}

export interface LogisticsToastPresentation {
 message: string;
 assetId?: string;
}

export interface StoragePreviewChoice {
 itemId: string;
 count: number;
 quality?: CropQuality;
}

export interface ShippingPreviewChoice {
 itemId: string;
 count: number;
 quality?: CropQuality;
 unitPrice: number;
}

const QUALITY_LABEL: Record<CropQuality, string> = {
 mortal: '凡品',
 spirit: '灵品',
 treasure: '珍品',
};

function logisticsAssetId(_kind: 'storage' | 'shipping'): string {
 return 'loc.farmstead';
}

function itemName(itemId: string, content: ContentRegistry): string {
 return content.items.get(itemId)?.displayName ?? itemId;
}

function qualityLine(quality?: CropQuality): string {
 return quality ? `\n${QUALITY_LABEL[quality]}` : '';
}

export function storagePanelPreview(
 mode: 'deposit' | 'withdraw',
 choice: StoragePreviewChoice,
 used: number,
 capacity: number,
 content: ContentRegistry,
): LogisticsPreview {
 const statusLine = mode === 'deposit'
 ? '高频材料入仓，给采收、补种、炼丹与阵材周转腾位'
 : '取回要加工、炼丹、布阵或出货的物资';
 return {
 title: itemName(choice.itemId, content),
 details: [
 mode === 'deposit' ? '存入仓库' : '取出仓库',
 `数量 × ${choice.count}${qualityLine(choice.quality)}`,
 `仓库占用 ${used}/${capacity}`,
 statusLine,
 ].join('\n'),
 assetId: itemIconAssetId(choice.itemId, content),
 panelAssetId: logisticsAssetId('storage'),
 };
}

export function storageToastPresentation(
 mode: 'deposit' | 'withdraw',
 choice: StoragePreviewChoice,
 indexLabel: string,
 confirmHint: string,
 content: ContentRegistry,
): LogisticsToastPresentation {
 return {
 message: `${mode === 'deposit' ? '仓储-存入' : '仓储-取出'}${indexLabel}：${itemName(choice.itemId, content)}${choice.quality ? `·${QUALITY_LABEL[choice.quality]}` : ''}×${choice.count}｜Tab切换·${confirmHint}`,
 assetId: logisticsAssetId('storage'),
 };
}

export function storageUnavailableToastPresentation(mode: 'deposit' | 'withdraw'): LogisticsToastPresentation {
 return {
 message: mode === 'deposit' ? '背包无可存物品' : '仓库为空',
 assetId: logisticsAssetId('storage'),
 };
}

export function shippingPanelPreview(
 mode: 'normal' | 'quality',
 choice: ShippingPreviewChoice,
 content: ContentRegistry,
): LogisticsPreview {
 const total = choice.unitPrice * choice.count;
 const statusLine = mode === 'normal'
 ? '回笼灵石，补种、炉料与备劫消耗不断档'
 : '兑现高品质收成，换更稳的丹药、阵材与备劫余量';
 return {
 title: itemName(choice.itemId, content),
 details: [
 mode === 'normal' ? '普通出货' : '品质出货',
 mode === 'quality'
 ? `${QUALITY_LABEL[choice.quality ?? 'mortal']} × ${choice.count}`
 : `数量 × ${choice.count}`,
 `单价 灵石 × ${choice.unitPrice}｜本次 × ${total}`,
 statusLine,
 ].join('\n'),
 assetId: itemIconAssetId(choice.itemId, content),
 panelAssetId: logisticsAssetId('shipping'),
 };
}

export function shippingToastPresentation(
 mode: 'normal' | 'quality',
 choice: ShippingPreviewChoice,
 indexLabel: string,
 confirmHint: string,
 content: ContentRegistry,
): LogisticsToastPresentation {
 return {
 message: `${mode === 'normal' ? '出货' : '品质出货'}${indexLabel}：${itemName(choice.itemId, content)}${mode === 'quality' ? `·${QUALITY_LABEL[choice.quality ?? 'mortal']}` : ''}×${choice.count}｜Tab切换·${confirmHint}`,
 assetId: logisticsAssetId('shipping'),
 };
}

export function shippingUnavailableToastPresentation(mode: 'normal' | 'quality'): LogisticsToastPresentation {
 return {
 message: mode === 'normal' ? '无普通物品可出货' : '无品质灵草可出货',
 assetId: logisticsAssetId('shipping'),
 };
}
