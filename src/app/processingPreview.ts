import type { ContentRegistry } from '@content/defs';
import type { CropQuality } from '@sim/farm/quality';
import { FACILITY_RECIPES } from '@sim';
import { itemIconAssetId } from './itemIcons';

export interface ProcessingPanelPreview {
 title: string;
 details: string;
 iconId?: string;
 panelAssetId?: string;
}

export interface ProcessingToastPresentation {
 message: string;
 assetId?: string;
}

function processingFacilityAssetId(mode: 'drying' | 'sealing' | 'furnace'): string {
 switch (mode) {
 case 'drying':
 return 'facility.drying-rack';
 case 'sealing':
 return 'facility.sealing-cabinet';
 case 'furnace':
 return 'facility.talisman-furnace';
 }
}

function recipeInputLine(itemId: string, count: number, content: ContentRegistry): string {
 const name = content.items.get(itemId)?.displayName ?? itemId;
 return `${name} × ${count}`;
}

function processingPurposeLine(outputItemId: string): string {
 switch (outputItemId) {
 case 'item.sealed-herb':
 return '用途：炼丹、交付或备劫药材';
 case 'item.array-core':
 return '用途：布阵与抗劫防线';
 default:
 return '用途：接上农庄加工循环';
 }
}

function dryingOutputCount(quality?: CropQuality): number {
 switch (quality) {
 case 'spirit':
 return 2;
 case 'treasure':
 return 3;
 case 'mortal':
 case undefined:
 return 1;
 }
}

function qualityLine(quality?: CropQuality): string {
 switch (quality) {
 case 'mortal':
 return '品质：凡品';
 case 'spirit':
 return '品质：灵品｜额外产出 +1';
 case 'treasure':
 return '品质：珍品｜额外产出 +2';
 case undefined:
 return '品质：普通批次';
 }
}

export function dryingProcessingPanelPreview(
 choice: { itemId: string; count: number; quality?: CropQuality },
 content: ContentRegistry,
): ProcessingPanelPreview {
 const inputName = content.items.get(choice.itemId)?.displayName ?? choice.itemId;
 const outputName = content.items.get('item.dried-herb')?.displayName ?? '晾晒灵草';
 const outputCount = dryingOutputCount(choice.quality);

 return {
 title: inputName,
 details: `晾晒加工\n库存 ${choice.count} 株｜本次投入 1 株\n产出：${outputName} × ${outputCount}\n${qualityLine(choice.quality)}\n用途：先稳货性，再接封藏、炼丹与阵法前置`,
 iconId: itemIconAssetId(choice.itemId, content),
 panelAssetId: processingFacilityAssetId('drying'),
 };
}

export function staticProcessingPanelPreview(mode: 'sealing' | 'furnace', content: ContentRegistry): ProcessingPanelPreview {
 const recipeId = mode === 'sealing' ? 'recipe.facility.sealed-herb' : 'recipe.facility.array-core';
 const recipe = FACILITY_RECIPES[recipeId];
 if (!recipe) {
 return {
 title: mode === 'sealing' ? '封藏灵草' : '阵核',
 details: '配方缺失',
 };
 }
 const outputName = content.items.get(recipe.outputItemId)?.displayName ?? recipe.outputItemId;
 const lines = recipe.inputs.map((input) => recipeInputLine(input.itemId, input.count, content));

return {
 title: outputName,
 details: `${recipe.displayName}\n耗时 ${recipe.days} 日\n材料：${lines.join('、')}\n${processingPurposeLine(recipe.outputItemId)}`,
 iconId: itemIconAssetId(recipe.outputItemId, content),
 panelAssetId: processingFacilityAssetId(mode),
 };
}

export function processingToastPresentation(
 mode: 'drying' | 'sealing' | 'furnace',
 title: string,
 indexLabel: string | null,
 confirmHint: string,
 assetId?: string,
): ProcessingToastPresentation {
 const prefix = mode === 'drying'
 ? `加工-晾晒${indexLabel ?? ''}`
 : mode === 'sealing'
 ? '加工-封藏'
 : '加工-熔炼';
 return {
 message: `${prefix}：${title}｜Tab切换·${confirmHint}`,
 assetId: assetId ?? processingFacilityAssetId(mode),
 };
}

export function processingUnavailableToastPresentation(mode: 'drying'): ProcessingToastPresentation {
 return {
 message: mode === 'drying' ? '无可晾晒灵草' : '当前无可加工条目',
 assetId: processingFacilityAssetId(mode),
 };
}

export function processingPositionRequiredToastPresentation(
 mode: 'drying' | 'sealing' | 'furnace',
): ProcessingToastPresentation {
 return {
 message: mode === 'drying'
 ? '需站在晾晒架旁加工'
 : mode === 'sealing'
 ? '需站在封藏柜旁加工'
 : '需站在炼符炉旁加工',
 assetId: processingFacilityAssetId(mode),
 };
}

export function processingRecipeUnavailableToastPresentation(
 mode: 'furnace',
): ProcessingToastPresentation {
 return {
 message: mode === 'furnace' ? '无此丹方' : '当前无此配方',
 assetId: processingFacilityAssetId(mode),
 };
}

export function brewResultToastPresentation(
 outcome: 'pill' | 'exploded' | 'flawed' | 'waste',
 options: { name: string; furnaceHeat: number },
): ProcessingToastPresentation {
 switch (outcome) {
 case 'pill':
 return {
 message: `炼成 ${options.name}（炉温${options.furnaceHeat}）｜可服用备劫或稳住修行`,
 assetId: 'facility.talisman-furnace',
 };
 case 'exploded':
 return {
 message: '炸炉！丹毒反噬，先调火候再耗药材',
 assetId: 'facility.talisman-furnace',
 };
 case 'flawed':
 return {
 message: '残丹：炉温偏离，药力不足以稳妥备劫',
 assetId: 'facility.talisman-furnace',
 };
 case 'waste':
 return {
 message: '废丹：火候不当，材料已损耗',
 assetId: 'facility.talisman-furnace',
 };
 }
}

export function furnaceRecipeToastPresentation(recipeName: string): ProcessingToastPresentation {
 return {
 message: `丹方：${recipeName}`,
 assetId: 'facility.talisman-furnace',
 };
}

export function furnaceHeatToastPresentation(furnaceHeat: number): ProcessingToastPresentation {
 return {
 message: `炉温 ${furnaceHeat}`,
 assetId: 'facility.talisman-furnace',
 };
}

export function furnaceVisibilityToastPresentation(visible: boolean): ProcessingToastPresentation {
 return {
 message: visible ? '打开丹炉（Y 切丹方·[/] 调火候·B 炼制）' : '关闭丹炉',
 assetId: 'facility.talisman-furnace',
 };
}
