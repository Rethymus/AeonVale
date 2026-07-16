import type { GameState } from '@sim';
import type { LocationId } from '@sim/world/locations';
import { DEFAULT_BALANCE } from '@sim';
import { readyForBreakthrough } from '@sim/progression/progression';
import { collectFarmsteadActionSignals } from './locationActionSignals';

export type FarmsteadFocusKind =
 | 'mature'
 | 'dry'
 | 'low-qi'
 | 'scorched'
 | 'empty-tilled'
 | 'empty-tilled-no-seed'
 | 'ready-facility'
 | 'queued-shipping'
 | 'storage-full'
 | 'untilled'
 | 'fallback';

export interface FarmsteadFocus {
 kind: FarmsteadFocusKind;
 briefingLine: string;
 locationReason?: string;
 assetId: string;
}

export function normalizeFarmsteadRootAssetId(assetId: string): string {
 if (assetId.startsWith('facility.')) {
 return 'loc.farmstead';
 }
 return assetId;
}

export function farmsteadFocusPreviewLocationId(focus: FarmsteadFocus): LocationId {
 switch (focus.kind) {
 case 'mature':
 case 'dry':
 case 'low-qi':
 case 'empty-tilled':
 case 'untilled':
 return 'herb-plot';
 case 'empty-tilled-no-seed':
 return 'valley-market';
 case 'ready-facility':
 if (focus.assetId === 'loc.drying-yard') return 'drying-yard';
 if (focus.assetId === 'loc.array-shed') return 'array-shed';
 return 'farmstead';
 case 'scorched':
 case 'queued-shipping':
 case 'storage-full':
 case 'fallback':
 default:
 return 'farmstead';
 }
}

function farmsteadReadyFacilityAssetId(kind: 'drying-rack' | 'sealing-cabinet' | 'talisman-furnace'): string {
 switch (kind) {
 case 'drying-rack':
 return 'loc.drying-yard';
 case 'talisman-furnace':
 return 'loc.array-shed';
 case 'sealing-cabinet':
 return 'loc.farmstead';
 default:
 return 'loc.farmstead';
 }
}

function firstReadyFacilityKind(state: GameState): 'drying-rack' | 'sealing-cabinet' | 'talisman-furnace' | null {
 const readyFacilities = Array.from(state.facilities.values())
 .filter((facility) => (facility.job?.daysRemaining ?? 1) <= 0);

if (readyFacilities.some((facility) => facility.kind === 'drying-rack')) return 'drying-rack';
 if (readyFacilities.some((facility) => facility.kind === 'talisman-furnace')) return 'talisman-furnace';
 if (readyFacilities.some((facility) => facility.kind === 'sealing-cabinet')) return 'sealing-cabinet';
 return null;
}

function hasCarriedSeed(state: GameState): boolean {
 return Object.entries(state.player.inventory).some(([itemId, stack]) => itemId.startsWith('seed.') && (stack?.count ?? 0) > 0);
}

export function getFarmsteadFocus(state: GameState): FarmsteadFocus {
 let mature = 0;
 let dry = 0;
 let lowQi = 0;
 let scorched = 0;
 let emptyTilled = 0;
 let untilled = 0;

for (const tile of state.tiles) {
 const crop = state.crops.get(tile.id);
 if (crop) {
 if (crop.stage === 'mature') {
 mature += 1;
 } else {
 if (!tile.wateredToday && tile.moisture < 55_000) dry += 1;
 if (!tile.channeledToday && tile.qiDensity < 55_000) lowQi += 1;
 }
 continue;
 }

if (tile.tilled && tile.blockType === 'none') emptyTilled += 1;
 if (!tile.tilled && tile.blockType === 'none' && tile.soilType === 'scorched') {
 scorched += 1;
 continue;
 }
 if (!tile.tilled && tile.blockType === 'none' && tile.soilType !== 'rock' && tile.soilType !== 'water' && tile.soilType !== 'metal-ore') {
 untilled += 1;
 }
 }

if (mature > 0) {
 return {
 kind: 'mature',
 briefingLine: `农务：先收 ${mature} 株成熟灵草`,
 locationReason: `田里已有 ${mature} 株灵草成熟，先回去把这一轮收成收住。`,
 assetId: 'loc.herb-plot',
 };
 }
 if (dry > 0) {
 return {
 kind: 'dry',
 briefingLine: `农务：优先补水 ${dry} 块灵田`,
 locationReason: `有 ${dry} 块灵田正缺水，先回农庄把当日水路补稳。`,
 assetId: 'loc.herb-plot',
 };
 }
 if (lowQi > 0) {
 return {
 kind: 'low-qi',
 briefingLine: `农务：可补灵 ${lowQi} 块灵田`,
 locationReason: `有 ${lowQi} 块灵田灵气偏弱，回去补灵后生长才稳。`,
 assetId: 'loc.herb-plot',
 };
 }
 if (scorched > 0) {
 return {
 kind: 'scorched',
 briefingLine: `农务：先翻新 ${scorched} 块焦土地`,
 locationReason: `昨夜还留着 ${scorched} 块焦土地，先回去把田面翻新。`,
 assetId: 'tile.scorched',
 };
 }
 if (emptyTilled > 0) {
 if (!hasCarriedSeed(state)) {
 return {
 kind: 'empty-tilled-no-seed',
 briefingLine: `农务：已翻 ${emptyTilled} 块空田，先去集市补种子`,
 locationReason: `已有 ${emptyTilled} 块翻好的空田，但身上没有种子，先去集市补货再回田里。`,
 assetId: 'loc.valley-market',
 };
 }
 return {
 kind: 'empty-tilled',
 briefingLine: `农务：可补种 ${emptyTilled} 块已翻地`,
 locationReason: `已有 ${emptyTilled} 块翻好的空田，先回农庄把补种接上。`,
 assetId: 'loc.herb-plot',
 };
 }

const farmsteadSignals = collectFarmsteadActionSignals(state);
 if (farmsteadSignals.readyFacilityCount > 0) {
 const readyFacilityKind = firstReadyFacilityKind(state);
 return {
 kind: 'ready-facility',
 briefingLine: `农务：先收 ${farmsteadSignals.readyFacilityCount} 座已完成设施`,
 locationReason: '农庄里已有设施完工，先回去把这一轮产出收住。',
 assetId: readyFacilityKind ? farmsteadReadyFacilityAssetId(readyFacilityKind) : 'loc.farmstead',
 };
 }
 if (farmsteadSignals.queuedShippingCount > 0) {
 return {
 kind: 'queued-shipping',
 briefingLine: `农务：先清 ${farmsteadSignals.queuedShippingCount} 项待结出货`,
 locationReason: '昨夜回款还挂在箱里，先回农庄把出货结清。',
 assetId: 'loc.farmstead',
 };
 }
 if (farmsteadSignals.storageFull) {
 return {
 kind: 'storage-full',
 briefingLine: '农务：仓储已满，先清仓再安排采收与外出',
 locationReason: '仓储已经顶满，先回去清仓再安排采收与外出。',
 assetId: 'loc.farmstead',
 };
 }
 if (untilled > 0) {
 return {
 kind: 'untilled',
 briefingLine: `农务：可新翻 ${untilled} 块空地`,
 locationReason: `农庄里还有 ${untilled} 块空地可开，回去扩一小片田更顺手。`,
 assetId: 'loc.herb-plot',
 };
 }

return {
 kind: 'fallback',
 briefingLine: '农务：先稳住灵田，再安排出货、采购或外出',
 locationReason: '翻地、补种、浇水、收获与出货都从这里收口。',
 assetId: 'loc.farmstead',
 };
}

export function farmsteadRootContextAssetId(state: GameState): string {
 if (readyForBreakthrough(state, DEFAULT_BALANCE)) return 'loc.array-shed';
 return normalizeFarmsteadRootAssetId(getFarmsteadFocus(state).assetId);
}
