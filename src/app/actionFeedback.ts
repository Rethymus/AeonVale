import { toolAreaSize, toolStaminaMultiplier, type GameState, type SimContext } from '@sim';
import { inventoryCanFitRewards, type InventoryReward } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import { canPlantOffSeasonInGreenhouse, isOffSeasonSeed } from '@sim/social/greenhouse';
import { getFertilizer } from '@sim/farm/quality';
import { normalizeFarmsteadRootAssetId } from './farmsteadFocus';
import { itemIconAssetId } from './itemIcons';
import { normalizeGuidanceLine } from './onboardingObjective';
import { toolActionAssetId } from './toolAsset';

export type FarmActionFeedbackKind = 'till' | 'sow' | 'water' | 'harvest' | 'channel-qi' | 'fertilize';

export interface FarmTileSnapshot {
 id: number;
 x: number;
 y: number;
 tilled: boolean;
 cropId: number | null;
 wateredToday: boolean;
 channeledToday: boolean;
 moisture: number;
 fertility: number;
 qiDensity: number;
}

export interface FarmActionFeedbackOptions {
 seedId?: string;
 itemId?: string;
}

export interface SowUnavailableToastOptions {
 seedId?: string;
 assetIdOverride?: string;
}

export interface SowSuccessToastOptions {
 seedId?: string;
 seedName: string;
 switchedHotbar?: boolean;
 nextStep?: string;
 assetIdOverride?: string;
}

export interface FarmActionOutcome {
 succeeded: boolean;
 affectedTiles: Array<{ x: number; y: number }>;
}

export interface FarmActionToastPresentation {
 message: string;
 assetId?: string;
}

export interface CultivationPanelToastPresentation {
 message: string;
 assetId?: string;
}

export interface OverlayToastPresentation {
 message: string;
 assetId?: string;
}

export interface ArrayPlacementToastPresentation {
 message: string;
 assetId?: string;
}

export type OverlayToastKind =
 | 'exit-location-selection'
 | 'exit-interaction-panel'
 | 'pause'
 | 'resume'
 | 'open-inventory'
 | 'close-inventory';

export type FarmActionSuccessKind = 'till' | 'water' | 'harvest' | 'channel-qi';

export type ArrayPlacementKind = 'lightning-rod' | 'insulation';

export type FarmActionBlockedReason =
 | 'out-of-bounds'
 | 'blocked-soil'
 | 'untilled'
 | 'occupied'
 | 'no-crop'
 | 'no-seed'
 | 'off-season'
 | 'already-watered'
 | 'already-channeled'
 | 'not-mature'
 | 'inventory-full'
 | 'invalid-fertilizer'
 | 'no-fertilizer'
 | 'not-enough-stamina';

export function snapshotFarmTiles(state: GameState): FarmTileSnapshot[] {
 return state.tiles.map((tile) => ({
 id: tile.id,
 x: tile.x,
 y: tile.y,
 tilled: tile.tilled,
 cropId: tile.cropId,
 wateredToday: tile.wateredToday,
 channeledToday: tile.channeledToday,
 moisture: tile.moisture,
 fertility: tile.fertility,
 qiDensity: tile.qiDensity,
 }));
}

export function deriveFarmActionOutcome(
 kind: FarmActionFeedbackKind,
 before: readonly FarmTileSnapshot[],
 after: readonly FarmTileSnapshot[],
): FarmActionOutcome {
 const beforeById = new Map(before.map((tile) => [tile.id, tile] as const));
 const affectedTiles: Array<{ x: number; y: number }> = [];

for (const tile of after) {
 const prev = beforeById.get(tile.id);
 if (!prev) continue;
 if (!didFarmActionAffectTile(kind, prev, tile)) continue;
 affectedTiles.push({ x: tile.x, y: tile.y });
 }

return {
 succeeded: affectedTiles.length > 0,
 affectedTiles,
 };
}

export function farmActionBlockedReason(
 state: GameState,
 ctx: SimContext,
 kind: FarmActionFeedbackKind,
 at: { x: number; y: number },
 options?: FarmActionFeedbackOptions,
): FarmActionBlockedReason | null {
 const tile = state.tiles.find((entry) => entry.x === at.x && entry.y === at.y);
 if (!tile) return 'out-of-bounds';

switch (kind) {
 case 'till': {
 const area = crossTileArea(state, at, toolAreaSize(state, 'till'));
 const tillable = area.filter((entry) => isTillableForFeedback(entry));
 if (tillable.length === 0) {
 if (tile.cropId != null) return 'occupied';
 return 'blocked-soil';
 }
 return hasEnoughStamina(state, ctx.params.player.tillStaminaCost * toolStaminaMultiplier(state, 'till')) ? null : 'not-enough-stamina';
 }
 case 'sow': {
 const seedId = options?.seedId;
 if (tile.tilled !== true) return 'untilled';
 if (tile.blockType !== 'none' || tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') return 'blocked-soil';
 if (tile.cropId != null) return 'occupied';
 if (!seedId) return 'no-seed';
 const herb = ctx.content.seedToHerb.get(seedId);
 if (!herb) return 'no-seed';
 if (isOffSeasonSeed(state, herb) && !canPlantOffSeasonInGreenhouse(state, herb)) return 'off-season';
 if ((state.player.inventory[seedId]?.count ?? 0) + totalQualityCount(state, seedId) <= 0) return 'no-seed';
 return hasEnoughStamina(state, ctx.params.player.channelStaminaCost) ? null : 'not-enough-stamina';
 }
 case 'water': {
 const area = crossTileArea(state, at, toolAreaSize(state, 'water'));
 const crops = area.filter((entry) => entry.cropId != null);
 if (crops.length === 0) return 'no-crop';
 const needsWater = crops.some((entry) => !entry.wateredToday || entry.moisture < 100 * MILLI);
 if (!needsWater) return 'already-watered';
 return hasEnoughStamina(state, ctx.params.player.waterStaminaCost * toolStaminaMultiplier(state, 'water')) ? null : 'not-enough-stamina';
 }
 case 'harvest': {
 if (tile.cropId == null) return 'no-crop';
 const crop = state.crops.get(tile.id);
 if (!crop) return 'no-crop';
 const herb = ctx.content.herbs.get(crop.defId);
 if (!herb) return 'no-crop';
 if (crop.growth < herb.growthThreshold) return 'not-mature';
 if (!canFitPotentialHarvestRewards(state, ctx, tile.id)) return 'inventory-full';
 return hasEnoughStamina(state, ctx.params.player.waterStaminaCost * toolStaminaMultiplier(state, 'harvest')) ? null : 'not-enough-stamina';
 }
 case 'channel-qi':
 if (tile.cropId == null) return 'no-crop';
 if (tile.channeledToday) return 'already-channeled';
 return hasEnoughStamina(state, ctx.params.player.channelStaminaCost) ? null : 'not-enough-stamina';
 case 'fertilize': {
 const fertilizerId = options?.itemId;
 const fertilizer = fertilizerId ? getFertilizer(fertilizerId) : null;
 if (!fertilizerId) return 'no-fertilizer';
 if (!fertilizer) return 'invalid-fertilizer';
 if (tile.tilled !== true) return 'untilled';
 if (tile.blockType !== 'none') return 'blocked-soil';
 if ((state.player.inventory[fertilizerId]?.count ?? 0) + totalQualityCount(state, fertilizerId) <= 0) return 'no-fertilizer';
 return hasEnoughStamina(state, fertilizer.staminaCost) ? null : 'not-enough-stamina';
 }
 }
}

function didFarmActionAffectTile(
 kind: FarmActionFeedbackKind,
 before: FarmTileSnapshot,
 after: FarmTileSnapshot,
): boolean {
 switch (kind) {
 case 'till':
 return !before.tilled && after.tilled;
 case 'sow':
 return before.cropId == null && after.cropId != null;
 case 'water':
 return after.cropId != null && (!before.wateredToday && after.wateredToday || after.moisture > before.moisture);
 case 'harvest':
 return before.cropId != null && after.cropId == null;
 case 'channel-qi':
 return after.cropId != null && !before.channeledToday && after.channeledToday;
 case 'fertilize':
 return after.fertility > before.fertility || after.qiDensity > before.qiDensity;
 }
}

export function farmActionBlockedToast(kind: FarmActionFeedbackKind, reason: FarmActionBlockedReason | null): string {
 switch (kind) {
 case 'till':
 switch (reason) {
 case 'occupied':
 return '此地已有灵草，占着无法翻耕';
 case 'not-enough-stamina':
 return '体力不足，暂时翻不动这片地';
 default:
 return '此地无法翻耕';
 }
 case 'sow':
 switch (reason) {
 case 'untilled':
 return '这块地还没翻，先整好再播种';
 case 'occupied':
 return '此地已有灵草，没法再播一株';
 case 'off-season':
 return '这类灵种离季，需先借暖棚苗床养护';
 case 'no-seed':
 return '手头没有可播下的种子，先去集市补货续上药材循环';
 case 'not-enough-stamina':
 return '体力不足，暂时播不动这粒种子';
 default:
 return '此地无法播种';
 }
 case 'water':
 switch (reason) {
 case 'already-watered':
 return '这片灵草今天已经浇过了';
 case 'not-enough-stamina':
 return '体力不足，暂时提不起水桶';
 default:
 return '此地暂无可浇灵草';
 }
 case 'harvest':
 switch (reason) {
 case 'not-mature':
 return '灵草还没熟，再等一等';
 case 'inventory-full':
 return '储物戒已满，先腾出空位再收获';
 case 'not-enough-stamina':
 return '体力不足，暂时收不动这株灵草';
 default:
 return '此地暂无可收灵草';
 }
 case 'channel-qi':
 switch (reason) {
 case 'already-channeled':
 return '这株灵草今天已经供过灵了';
 case 'not-enough-stamina':
 return '体力不足，暂时引不动灵气';
 default:
 return '此地暂无可供灵草';
 }
 case 'fertilize':
 switch (reason) {
 case 'untilled':
 return '这块地还没翻，先整好再施肥';
 case 'no-fertilizer':
 return '手头没有可施的灵壤肥';
 case 'invalid-fertilizer':
 return '这件东西没法拿来施肥';
 case 'not-enough-stamina':
 return '体力不足，暂时施不动这把肥';
 default:
 return '此地无法施肥';
 }
 }
}

export function farmActionBlockedToastPresentation(
 kind: FarmActionFeedbackKind,
 reason: FarmActionBlockedReason | null,
 options?: FarmActionFeedbackOptions,
): FarmActionToastPresentation {
 return {
 message: farmActionBlockedToast(kind, reason),
 assetId: blockedFarmActionAssetId(kind, options),
 };
}

export function sowUnavailableToastPresentation(options?: SowUnavailableToastOptions): FarmActionToastPresentation {
 const normalizedRootAssetId = options?.assetIdOverride
 ? normalizeFarmsteadRootAssetId(options.assetIdOverride)
 : undefined;
 return {
 message: '无可播种种子，先去集市补货续上第二轮药材',
 assetId: options?.seedId
 ? itemIconAssetId(options.seedId) ?? normalizedRootAssetId ?? 'loc.farmstead'
 : normalizedRootAssetId ?? 'loc.valley-market',
 };
}

export function fertilizeSuccessToastPresentation(assetIdOverride?: string): FarmActionToastPresentation {
 return {
 message: '施下灵壤肥：稳住药材品质',
 assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead',
 };
}

export function cultivationPanelToastPresentation(
 visible: boolean,
 assetIdOverride?: string,
): CultivationPanelToastPresentation {
 return {
 message: visible ? '打开功法/修炼总览' : '关闭功法/修炼总览',
 assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead',
 };
}

export function overlayToastPresentation(
 kind: OverlayToastKind,
 assetIdOverride?: string,
): OverlayToastPresentation {
 const normalizedRootAssetId = assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : undefined;
 switch (kind) {
 case 'exit-location-selection':
 return {
 message: '退出地点选择',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 case 'exit-interaction-panel':
 return {
 message: '退出交互面板',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 case 'pause':
 return {
 message: '已暂停',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 case 'resume':
 return {
 message: '继续行动',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 case 'open-inventory':
 return {
 message: '打开背包/仓库',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 case 'close-inventory':
 return {
 message: '关闭背包/仓库',
 assetId: normalizedRootAssetId ?? 'loc.farmstead',
 };
 }
}

export function farmActionSuccessToastPresentation(kind: FarmActionSuccessKind): FarmActionToastPresentation {
 switch (kind) {
 case 'till':
 return {
 message: '翻地：为下一轮药材开田',
 assetId: 'loc.farmstead',
 };
 case 'water':
 return {
 message: '浇水：稳住药材成长',
 assetId: 'loc.farmstead',
 };
 case 'harvest':
 return {
 message: '收获：可炼丹、出货或备劫',
 assetId: 'loc.farmstead',
 };
 case 'channel-qi':
 return {
 message: '供灵：提高药材成色与修行余量',
 assetId: 'loc.farmstead',
 };
 }
}

export function sowSuccessToastPresentation(options: SowSuccessToastOptions): FarmActionToastPresentation {
 const switchedSuffix = options.switchedHotbar ? '（已切换热栏）' : '';
 const guidance = normalizeGuidanceLine(options.nextStep ?? '');
 return {
 message: `播种 ${options.seedName}：第二轮药材已接上${switchedSuffix}${guidance ? `｜${guidance}` : ''}`,
 assetId: options.assetIdOverride ? normalizeFarmsteadRootAssetId(options.assetIdOverride) : 'loc.farmstead',
 };
}

export function restSuccessToastPresentation(assetIdOverride?: string): FarmActionToastPresentation {
 return {
 message: '静修（回血+清毒）',
 assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead',
 };
}

export function arrayPlacementToastPresentation(
 kind: ArrayPlacementKind,
 options: {
 placed: boolean;
 reason?: string;
 costText?: string;
 },
): ArrayPlacementToastPresentation {
 const actionLabel = kind === 'lightning-rod' ? '布设引雷阵（金属性草为阵眼）' : '布设绝缘阵';
 const assetId = kind === 'lightning-rod' ? 'facility.array-eye' : 'facility.array-flag';
 if (options.placed) {
 return {
 message: actionLabel,
 assetId,
 };
 }

return {
 message: `${options.reason ?? '不可放置'}${options.costText ? `：需${options.costText}` : ''}`,
 assetId,
 };
}

function totalQualityCount(state: GameState, itemId: string): number {
 return Object.values(state.player.qualityInventory ?? {}).reduce((sum, batch) => sum + (batch?.[itemId] ?? 0), 0);
}

function blockedFarmActionAssetId(kind: FarmActionFeedbackKind, options?: FarmActionFeedbackOptions): string {
 switch (kind) {
 case 'till':
 return toolActionAssetId('till');
 case 'sow':
 return options?.seedId ? itemIconAssetId(options.seedId) ?? 'loc.valley-market' : 'loc.valley-market';
 case 'water':
 return toolActionAssetId('water');
 case 'harvest':
 return toolActionAssetId('harvest');
 case 'channel-qi':
 return 'icon.item.array-core';
 case 'fertilize':
 return options?.itemId ? itemIconAssetId(options.itemId) ?? 'icon.item.spirit-compost' : 'icon.item.spirit-compost';
 }
}

function crossTileArea(state: GameState, at: { x: number; y: number }, maxCount: number): GameState['tiles'] {
 const offsets = [
 { x: 0, y: 0 },
 { x: 0, y: -1 },
 { x: 1, y: 0 },
 { x: 0, y: 1 },
 { x: -1, y: 0 },
 ];
 return offsets
 .slice(0, Math.max(1, Math.min(maxCount, offsets.length)))
 .map((offset) => state.tiles.find((tile) => tile.x === at.x + offset.x && tile.y === at.y + offset.y))
 .filter((tile): tile is GameState['tiles'][number] => Boolean(tile));
}

function isTillableForFeedback(tile: GameState['tiles'][number]): boolean {
 return !tile.tilled && tile.blockType === 'none' && tile.cropId == null && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore';
}

function hasEnoughStamina(state: GameState, cost: number): boolean {
 return state.player.stamina >= cost * MILLI;
}

function canFitPotentialHarvestRewards(state: GameState, ctx: SimContext, tileId: number): boolean {
 const tile = state.tiles.find((entry) => entry.id === tileId);
 if (!tile || tile.cropId == null) return false;
 const crop = state.crops.get(tile.id);
 if (!crop) return false;
 const herb = ctx.content.herbs.get(crop.defId);
 if (!herb) return false;

const rewards: InventoryReward[] = [];
 const [mainYield, ...secondaryYields] = herb.yield;
 if (mainYield && mainYield.count > 0) {
 rewards.push({ itemId: mainYield.itemId, quality: 'mortal', count: mainYield.count });
 }
 for (const yieldDef of secondaryYields) {
 if ((yieldDef.chance ?? 1) <= 0 || yieldDef.count <= 0) continue;
 rewards.push({ itemId: yieldDef.itemId, count: yieldDef.count });
 }

return inventoryCanFitRewards(state.player, rewards);
}
