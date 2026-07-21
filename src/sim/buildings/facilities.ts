/**
 * 农庄设施空间化：把 Stardew-like 加工入口落到具体地块上。
 * sim 只记录确定性状态，不关心渲染和输入设备。
 */
import type { ArrayInstance, FacilityInstance, FacilityKind, GameState, GuardBeast } from '@sim/world/state';
import { emit, nextEntityId, tileAt } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { CropQuality } from '@sim/farm/quality';
import { inventoryCanFitRewards, itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';
import { hasRelationshipPerk } from '@sim/social/relationshipEvents';
import { farmExpansionTier, hasUpgrade } from './upgrades';
import { storageCanFitRewards, storageItemCount, storeItemInStorage, takeItemFromStorage } from '@sim/storage/storage';

export interface PlaceFacilityResult {
  ok: boolean;
  facility: FacilityInstance | null;
  reason?: string;
}

export interface FacilityCost {
  itemId: string;
  count: number;
}

export interface PlaceFacilityOptions {
  free?: boolean;
}

export interface FacilityJobResult {
  ok: boolean;
  facility: FacilityInstance | null;
  reason?: string;
}

export interface FacilityRecipeInput {
  itemId: string;
  count: number;
  role?: 'input' | 'catalyst';
  missingReason: string;
}

export interface FacilityRecipeDef {
  id: string;
  facilityKind: FacilityKind;
  displayName: string;
  inputs: readonly FacilityRecipeInput[];
  outputItemId: string;
  outputCount: number;
  days: number;
}

export const FACILITY_LABEL: Record<FacilityKind, string> = {
  'drying-rack': '晾晒架',
  'sealing-cabinet': '封藏柜',
  'talisman-furnace': '炼符炉'
};

export const FACILITY_BUILD_COSTS: Record<FacilityKind, readonly FacilityCost[]> = {
  'drying-rack': [
    { itemId: 'item.spirit-stone', count: 3 },
    { itemId: 'herb.mossling', count: 2 }
  ],
  'sealing-cabinet': [
    { itemId: 'item.spirit-stone', count: 8 },
    { itemId: 'item.dried-herb', count: 2 },
    { itemId: 'item.broken-talisman', count: 1 }
  ],
  'talisman-furnace': [
    { itemId: 'item.spirit-stone', count: 10 },
    { itemId: 'item.broken-talisman', count: 2 },
    { itemId: 'item.dried-herb', count: 1 }
  ]
};

export const FACILITY_EXPANSION_REQUIREMENT: Record<FacilityKind, number> = {
  'drying-rack': 0,
  'sealing-cabinet': 1,
  'talisman-furnace': 2
};

interface FacilityPlacementBand {
  minDistance: number;
  maxDistance: number;
  label: string;
}

export const FACILITY_PLACEMENT_BANDS: Record<FacilityKind, FacilityPlacementBand> = {
  'drying-rack': { minDistance: 0, maxDistance: 1, label: '农庄核心区' },
  'sealing-cabinet': { minDistance: 1, maxDistance: 2, label: '中院加工区' },
  'talisman-furnace': { minDistance: 2, maxDistance: 3, label: '外院工坊区' }
};

const DRIED_HERB_ID = 'item.dried-herb';
const SEALED_HERB_ID = 'item.sealed-herb';
const SPIRIT_COMPOST_ID = 'item.spirit-compost';
const BROKEN_TALISMAN_ID = 'item.broken-talisman';
const SPIRIT_STONE_ID = 'item.spirit-stone';
const ARRAY_CORE_ID = 'item.array-core';

export const FACILITY_RECIPES: Record<string, FacilityRecipeDef> = {
  'recipe.facility.sealed-herb': {
    id: 'recipe.facility.sealed-herb',
    facilityKind: 'sealing-cabinet',
    displayName: '封藏灵草',
    inputs: [
      { itemId: DRIED_HERB_ID, count: 2, role: 'input', missingReason: '晾晒灵草不足' },
      { itemId: SPIRIT_COMPOST_ID, count: 1, role: 'catalyst', missingReason: '灵壤肥不足' }
    ],
    outputItemId: SEALED_HERB_ID,
    outputCount: 1,
    days: 2
  },
  'recipe.facility.array-core': {
    id: 'recipe.facility.array-core',
    facilityKind: 'talisman-furnace',
    displayName: '熔炼阵核',
    inputs: [
      { itemId: BROKEN_TALISMAN_ID, count: 1, role: 'input', missingReason: '破损法宝不足' },
      { itemId: SPIRIT_STONE_ID, count: 2, role: 'catalyst', missingReason: '灵石不足' }
    ],
    outputItemId: ARRAY_CORE_ID,
    outputCount: 1,
    days: 1
  }
};

function effectiveFacilityRecipe(state: GameState, recipe: FacilityRecipeDef): FacilityRecipeDef {
  if (recipe.id !== 'recipe.facility.array-core' || !hasRelationshipPerk(state, 'array-smith-160')) return recipe;
  return {
    ...recipe,
    inputs: recipe.inputs.map(input => (input.itemId === SPIRIT_STONE_ID ? { ...input, count: 1 } : input))
  };
}

export function facilityAt(state: GameState, tileId: number): FacilityInstance | null {
  for (const facility of state.facilities.values()) {
    if (facility.tileId === tileId) return facility;
  }
  return null;
}

export function facilityExpansionRequirement(kind: FacilityKind): number {
  return FACILITY_EXPANSION_REQUIREMENT[kind];
}

export function facilityPlacementBand(kind: FacilityKind): FacilityPlacementBand {
  return FACILITY_PLACEMENT_BANDS[kind];
}

function facilityExpansionRequirementText(kind: FacilityKind): string {
  const requiredTier = facilityExpansionRequirement(kind);
  return requiredTier <= 0 ? '无需农庄扩建' : `需农庄扩建${requiredTier}阶`;
}

export function facilityPlacementRuleText(kind: FacilityKind): string {
  return `需建在${facilityPlacementBand(kind).label}`;
}

function tileDistanceFromFarmCenter(state: GameState, x: number, y: number): number {
  const centerX = Math.floor(state.width / 2);
  const centerY = Math.floor(state.height / 2);
  return Math.max(Math.abs(x - centerX), Math.abs(y - centerY));
}

function violatesPlacementBand(state: GameState, kind: FacilityKind, x: number, y: number): boolean {
  const distance = tileDistanceFromFarmCenter(state, x, y);
  const band = facilityPlacementBand(kind);
  return distance < band.minDistance || distance > band.maxDistance;
}

function failPlacement(state: GameState, kind: FacilityKind, x: number, y: number, reason: string, requiredExpansionTier?: number): PlaceFacilityResult {
  emit(state, 'facility-place-failed', {
    kind,
    x,
    y,
    reason,
    requiredExpansionTier: requiredExpansionTier ?? null,
    currentExpansionTier: farmExpansionTier(state)
  });
  return { ok: false, facility: null, reason };
}

export function placeFacility(state: GameState, kind: FacilityKind, x: number, y: number, options: PlaceFacilityOptions = {}): PlaceFacilityResult {
  const currentExpansionTier = farmExpansionTier(state);
  const requiredExpansionTier = facilityExpansionRequirement(kind);
  if (currentExpansionTier < requiredExpansionTier) {
    return failPlacement(state, kind, x, y, `${FACILITY_LABEL[kind]}${facilityExpansionRequirementText(kind)}`, requiredExpansionTier);
  }
  const tile = tileAt(state, x, y);
  if (!tile) return failPlacement(state, kind, x, y, '越界');
  if (violatesPlacementBand(state, kind, x, y)) {
    return failPlacement(state, kind, x, y, `${FACILITY_LABEL[kind]}${facilityPlacementRuleText(kind)}`);
  }
  if (tile.blockType !== 'none' || tile.tilled || tile.cropId !== null || tile.arrayId !== null) {
    return failPlacement(state, kind, x, y, '地块已占用');
  }
  if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') {
    return failPlacement(state, kind, x, y, '地形不可建造');
  }
  const costs = FACILITY_BUILD_COSTS[kind];
  if (!options.free) {
    for (const cost of costs) {
      if (itemCount(state.player, cost.itemId) < cost.count) return failPlacement(state, kind, x, y, '材料不足');
    }
    for (const cost of costs) mutateItem(state.player, cost.itemId, -cost.count);
  }
  const id = nextEntityId(state);
  const facility: FacilityInstance = { id, kind, tileId: tile.id, job: null };
  state.facilities.set(id, facility);
  tile.blockType = 'building';
  emit(state, 'facility-place', { id, kind, tileId: tile.id, x, y, costs: options.free ? [] : costs });
  return { ok: true, facility };
}

function qualityYieldBonus(quality?: CropQuality): number {
  switch (quality) {
    case 'spirit':
      return 1;
    case 'treasure':
      return 2;
    case 'mortal':
    case undefined:
      return 0;
  }
}

export function adjacentFacility(state: GameState, x: number, y: number, kind: FacilityKind): FacilityInstance | null {
  const offsets = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];
  for (const d of offsets) {
    const tile = tileAt(state, x + d.x, y + d.y);
    if (!tile) continue;
    const facility = facilityAt(state, tile.id);
    if (facility?.kind === kind) return facility;
  }
  return null;
}

export function hasAdjacentFacility(state: GameState, x: number, y: number, kind: FacilityKind): boolean {
  return adjacentFacility(state, x, y, kind) !== null;
}

export function startDryingJob(state: GameState, facilityId: number, herbItemId: string, ctx: SimContext, quality?: CropQuality): FacilityJobResult {
  const facility = state.facilities.get(facilityId) ?? null;
  if (!facility || facility.kind !== 'drying-rack') return { ok: false, facility, reason: '不是晾晒架' };
  if (facility.job) return { ok: false, facility, reason: '设施忙碌' };
  if (!ctx.content.herbs.has(herbItemId)) return { ok: false, facility, reason: '不是灵草' };
  const available = quality ? qualityItemCount(state.player, herbItemId, quality) : itemCount(state.player, herbItemId);
  if (available < 1) return { ok: false, facility, reason: '材料不足' };
  if (quality) mutateQualityItem(state.player, herbItemId, quality, -1);
  else mutateItem(state.player, herbItemId, -1);
  facility.job = { inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, outputCount: 1 + qualityYieldBonus(quality), daysRemaining: 1 };
  emit(state, 'facility-job-start', { facilityId, kind: facility.kind, inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, outputCount: facility.job.outputCount, daysRemaining: facility.job.daysRemaining, quality });
  return { ok: true, facility };
}

function facilityKindMismatchReason(kind: FacilityKind): string {
  switch (kind) {
    case 'drying-rack':
      return '不是晾晒架';
    case 'sealing-cabinet':
      return '不是封藏柜';
    case 'talisman-furnace':
      return '不是炼符炉';
  }
}

export function startFacilityRecipeJob(state: GameState, facilityId: number, recipeId: string): FacilityJobResult {
  const baseRecipe = FACILITY_RECIPES[recipeId];
  const recipe = baseRecipe ? effectiveFacilityRecipe(state, baseRecipe) : undefined;
  const facility = state.facilities.get(facilityId) ?? null;
  if (!recipe) return { ok: false, facility, reason: '无此设施配方' };
  if (!facility || facility.kind !== recipe.facilityKind) return { ok: false, facility, reason: facilityKindMismatchReason(recipe.facilityKind) };
  if (facility.job) return { ok: false, facility, reason: '设施忙碌' };
  for (const input of recipe.inputs) {
    if (itemCount(state.player, input.itemId) < input.count) return { ok: false, facility, reason: input.missingReason };
  }
  for (const input of recipe.inputs) mutateItem(state.player, input.itemId, -input.count);
  const primaryInput = recipe.inputs.find(input => input.role !== 'catalyst') ?? recipe.inputs[0]!;
  const catalystInput = recipe.inputs.find(input => input.role === 'catalyst');
  facility.job = { inputItemId: primaryInput.itemId, outputItemId: recipe.outputItemId, outputCount: recipe.outputCount, daysRemaining: recipe.days };
  emit(state, 'facility-job-start', {
    facilityId,
    kind: facility.kind,
    recipeId: recipe.id,
    inputItemId: primaryInput.itemId,
    inputCount: primaryInput.count,
    catalystItemId: catalystInput?.itemId,
    catalystCount: catalystInput?.count,
    outputItemId: recipe.outputItemId,
    outputCount: recipe.outputCount,
    daysRemaining: recipe.days
  });
  return { ok: true, facility };
}

export function startSealingJob(state: GameState, facilityId: number): FacilityJobResult {
  return startFacilityRecipeJob(state, facilityId, 'recipe.facility.sealed-herb');
}

export function startFurnaceJob(state: GameState, facilityId: number): FacilityJobResult {
  return startFacilityRecipeJob(state, facilityId, 'recipe.facility.array-core');
}

function canAutoLoadFacility(state: GameState, facility: FacilityInstance): boolean {
  if (!hasUpgrade(state, 'farm-autoload-1')) return false;
  if (facility.kind === 'talisman-furnace') return false;
  return state.guardBeasts.some(beast => beast.vigor > 0);
}

function autoStartFacilityJob(state: GameState, facility: FacilityInstance, ctx: SimContext): boolean {
  if (facility.job || !canAutoLoadFacility(state, facility)) return false;

  if (facility.kind === 'drying-rack') {
    const herbItemId = Object.keys(state.storage.inventory)
      .filter(itemId => ctx.content.herbs.has(itemId) && storageItemCount(state.storage, itemId) > 0)
      .sort()[0];
    if (!herbItemId) return false;
    if (!takeItemFromStorage(state.storage, herbItemId, 1)) return false;
    facility.job = { inputItemId: herbItemId, outputItemId: DRIED_HERB_ID, outputCount: 1, daysRemaining: 1 };
    emit(state, 'facility-job-autostart', { facilityId: facility.id, kind: facility.kind, inputItemId: herbItemId, source: 'storage' });
    return true;
  }

  if (facility.kind === 'sealing-cabinet') {
    if (storageItemCount(state.storage, DRIED_HERB_ID) < 2) return false;
    if (storageItemCount(state.storage, SPIRIT_COMPOST_ID) < 1) return false;
    if (!takeItemFromStorage(state.storage, DRIED_HERB_ID, 2)) return false;
    if (!takeItemFromStorage(state.storage, SPIRIT_COMPOST_ID, 1)) {
      storeItemInStorage(state.storage, DRIED_HERB_ID, 2);
      return false;
    }
    facility.job = { inputItemId: DRIED_HERB_ID, outputItemId: SEALED_HERB_ID, outputCount: 1, daysRemaining: 2 };
    emit(state, 'facility-job-autostart', {
      facilityId: facility.id,
      kind: facility.kind,
      inputItemId: DRIED_HERB_ID,
      catalystItemId: SPIRIT_COMPOST_ID,
      source: 'storage'
    });
    return true;
  }

  return false;
}

function autoStoreFinishedJob(state: GameState, facility: FacilityInstance, ctx?: SimContext): boolean {
  const job = facility.job;
  if (!job || job.daysRemaining > 0 || !hasUpgrade(state, 'farm-autoload-1')) return false;
  if (ctx && !storageCanFitRewards(state.storage, [{ itemId: job.outputItemId, count: job.outputCount }], ctx.content)) return false;
  if (!storeItemInStorage(state.storage, job.outputItemId, job.outputCount, ctx?.content)) return false;
  facility.job = null;
  emit(state, 'facility-auto-store', { facilityId: facility.id, kind: facility.kind, outputItemId: job.outputItemId, outputCount: job.outputCount });
  return true;
}

function chebyshevDistance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function nearbyActiveArray(state: GameState, facility: FacilityInstance, ctx: SimContext, defId: string): ArrayInstance | null {
  const tile = state.tiles[facility.tileId];
  if (!tile) return null;
  for (const arr of state.arrays.values()) {
    if (!arr.active || arr.defId !== defId) continue;
    const core = state.tiles[arr.coreTileId];
    if (!core) continue;
    const radius = ctx.content.arrays.get(arr.defId)?.radius ?? 0;
    if (chebyshevDistance(tile, core) <= radius + 1) return arr;
  }
  return null;
}

function bondedAssistBeast(state: GameState, ctx: SimContext): GuardBeast | null {
  const threshold = ctx.params.celestial.beast.guardBondCostReductionThreshold;
  for (const beast of state.guardBeasts) {
    if (beast.bond >= threshold && beast.vigor > 0) return beast;
  }
  return null;
}

function facilityLayoutSupportDays(state: GameState, facility: FacilityInstance): number {
  const tile = state.tiles[facility.tileId];
  if (!tile) return 0;

  if (facility.kind === 'sealing-cabinet' && farmExpansionTier(state) >= 1) {
    if (hasAdjacentFacility(state, tile.x, tile.y, 'drying-rack')) {
      emit(state, 'facility-layout-support', {
        facilityId: facility.id,
        kind: facility.kind,
        sourceKind: 'drying-rack',
        daysReduced: 1
      });
      return 1;
    }
  }

  if (facility.kind === 'talisman-furnace' && farmExpansionTier(state) >= 2) {
    if (hasAdjacentFacility(state, tile.x, tile.y, 'sealing-cabinet')) {
      emit(state, 'facility-layout-support', {
        facilityId: facility.id,
        kind: facility.kind,
        sourceKind: 'sealing-cabinet',
        daysReduced: 1
      });
      return 1;
    }
  }

  return 0;
}

function facilitySupportDays(state: GameState, facility: FacilityInstance, ctx?: SimContext): number {
  const layoutSupport = facilityLayoutSupportDays(state, facility);
  if (!ctx) return layoutSupport;

  if (facility.kind === 'talisman-furnace') {
    const rod = nearbyActiveArray(state, facility, ctx, 'array.lightning-rod');
    if (!rod) return layoutSupport;
    emit(state, 'facility-job-support', { facilityId: facility.id, kind: facility.kind, arrayDefId: rod.defId, daysReduced: 1 });
    return layoutSupport + 1;
  }

  if (facility.kind === 'drying-rack' || facility.kind === 'sealing-cabinet') {
    const insulation = nearbyActiveArray(state, facility, ctx, 'array.insulation');
    if (!insulation) return layoutSupport;
    const beast = bondedAssistBeast(state, ctx);
    if (!beast) return layoutSupport;
    beast.vigor -= 1;
    emit(state, 'facility-job-support', {
      facilityId: facility.id,
      kind: facility.kind,
      arrayDefId: insulation.defId,
      beastId: beast.id,
      daysReduced: 1,
      beastVigor: beast.vigor
    });
    return layoutSupport + 1;
  }

  return layoutSupport;
}

export function advanceFacilityJobs(state: GameState, ctx?: SimContext): void {
  if (ctx) {
    for (const facility of state.facilities.values()) autoStartFacilityJob(state, facility, ctx);
  }

  for (const facility of state.facilities.values()) {
    if (!facility.job || facility.job.daysRemaining <= 0) continue;
    const daysReduced = 1 + facilitySupportDays(state, facility, ctx);
    facility.job.daysRemaining = Math.max(0, facility.job.daysRemaining - daysReduced);
    emit(state, 'facility-job-tick', { facilityId: facility.id, kind: facility.kind, daysRemaining: facility.job.daysRemaining, daysReduced });
  }

  for (const facility of state.facilities.values()) autoStoreFinishedJob(state, facility, ctx);
}

export function collectFacility(state: GameState, facilityId: number, ctx?: SimContext): FacilityJobResult {
  const facility = state.facilities.get(facilityId) ?? null;
  if (!facility) return { ok: false, facility, reason: '无此设施' };
  if (!facility.job) return { ok: false, facility, reason: '无可收取产物' };
  if (facility.job.daysRemaining > 0) return { ok: false, facility, reason: '尚未完成' };
  const job = facility.job;
  if (ctx && !inventoryCanFitRewards(state.player, [{ itemId: job.outputItemId, count: job.outputCount }], ctx.content)) return { ok: false, facility, reason: '储物戒已满' };
  if (!mutateItem(state.player, job.outputItemId, job.outputCount)) return { ok: false, facility, reason: '储物戒已满' };
  facility.job = null;
  emit(state, 'facility-collect', { facilityId, kind: facility.kind, outputItemId: job.outputItemId, outputCount: job.outputCount });
  return { ok: true, facility };
}
