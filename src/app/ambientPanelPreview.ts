import type { ContentRegistry } from '@content/defs';
import { DEFAULT_BALANCE, getActiveLocationDirectory, getLocationEncounters, getLocationServiceOptions, getPreferredLocationSelection, LOCATION_CATALOG, type LocationId, type LocationStatus } from '@sim';
import type { LocationServiceOption } from '@sim/world/locations';
import type { GameState } from '@sim/world/state';
import { getOnboardingObjectiveId, type OnboardingObjectiveId } from '@sim/story/onboarding';
import { readyForBreakthrough } from '@sim/progression/progression';
import { frontTilePreview, type FrontTilePreview } from './frontTilePreview';
import { inventoryPreviewSelection, type InventoryPreviewSelection } from './inventoryPreview';
import { collectFarmsteadActionSignals, formatLocationActionSignalLine } from './locationActionSignals';
import { farmsteadFocusPreviewLocationId, getFarmsteadFocus } from './farmsteadFocus';
import { locationPreviewFocusReason } from './locationFocusReason';
import { locationPreviewAssetId } from './locationPreview';
import { collectLocationNpcSignals, firstPriorityLocationNpcSignal, formatLocationNpcSignalLine } from './locationNpcSignals';
import { tribulationPrepFocusReason, tribulationPrepStatusLine } from './tribulationPrepText';

export interface AmbientPanelPreview {
  title: string;
  details: string;
  assetId?: string;
}

type AmbientPreviewSurface = 'front' | 'inventory';

function onboardingPreferredSurface(objectiveId: OnboardingObjectiveId | null): AmbientPreviewSurface {
  switch (objectiveId) {
    case 'first-sow':
    case 'first-ship':
    case 'first-sleep':
    case 'first-market-restock':
    case 'first-second-sow':
      return 'inventory';
    case 'first-till':
    case 'first-water':
    case 'first-harvest':
    case 'first-second-water':
    case 'first-loop-complete':
    default:
      return 'front';
  }
}

function normalizeFrontPreview(preview: FrontTilePreview | null): AmbientPanelPreview | null {
  if (!preview) return null;
  return {
    title: preview.title,
    details: preview.details,
    assetId: preview.assetId
  };
}

function normalizeInventoryPreview(preview: InventoryPreviewSelection | null): AmbientPanelPreview | null {
  if (!preview) return null;
  return {
    title: preview.title,
    details: preview.details,
    assetId: preview.panelAssetId ?? preview.iconId
  };
}

function formatLocationPreviewDetails(location: LocationStatus, service: LocationServiceOption | null, encounterNames: readonly string[], signalLine: string, focusReason?: string, actionLine?: string): string {
  const serviceLine = service ? `去处：${service.label} -> ${service.commandLabel}` : '去处：今日先回这里整顿农务与行程';
  const encounterLine = locationEncounterLine(location, encounterNames);
  return [location.description, signalLine, focusReason ? `现在来：${focusReason}` : '', actionLine ?? '', serviceLine, encounterLine].filter(line => line.length > 0).join('\n');
}

function locationEncounterLine(location: LocationStatus, encounterNames: readonly string[]): string {
  const encounterLine = encounterNames.length > 0 ? `人物：${encounterNames.join('、')}` : location.npcs.length > 0 ? `人物：${location.npcs.join('、')}` : '人物：今日先按眼前去处推进';
  return encounterLine;
}

function locationStatusById(state: GameState, locationId: LocationId): LocationStatus | null {
  return getActiveLocationDirectory(state).find(entry => entry.id === locationId) ?? null;
}

function firstReadyFarmsteadFacility(state: GameState): 'drying-rack' | 'talisman-furnace' | null {
  const readyFacilities = Array.from(state.facilities.values()).filter(facility => (facility.job?.daysRemaining ?? 1) <= 0);

  if (readyFacilities.some(facility => facility.kind === 'drying-rack')) return 'drying-rack';
  if (readyFacilities.some(facility => facility.kind === 'talisman-furnace')) return 'talisman-furnace';
  return null;
}

function farmsteadFallbackSelection(state: GameState, baseLocation: LocationStatus): { location: LocationStatus; service: LocationServiceOption | null; actionLocationId: LocationId } {
  const farmsteadServices = getLocationServiceOptions(state, 'farmstead');
  const farmsteadFocus = getFarmsteadFocus(state);
  const readyFacilityKind = firstReadyFarmsteadFacility(state);

  if (readyFacilityKind === 'drying-rack') {
    const service = farmsteadServices.find(entry => entry.command === 'show-processing') ?? getLocationServiceOptions(state, 'drying-yard').find(entry => entry.command === 'show-processing') ?? null;
    return { location: baseLocation, service, actionLocationId: 'farmstead' };
  }

  if (readyFacilityKind === 'talisman-furnace') {
    const service = farmsteadServices.find(entry => entry.command === 'show-arrays') ?? getLocationServiceOptions(state, 'array-shed').find(entry => entry.command === 'show-arrays') ?? null;
    return { location: baseLocation, service, actionLocationId: 'farmstead' };
  }

  const farmsteadSignals = collectFarmsteadActionSignals(state);
  if (farmsteadSignals.readyFacilityCount > 0 || farmsteadSignals.queuedShippingCount > 0 || farmsteadSignals.storageFull) {
    const service = farmsteadServices.find(entry => entry.command === 'show-farm-work') ?? farmsteadServices[0] ?? null;
    return { location: baseLocation, service, actionLocationId: 'farmstead' };
  }

  const previewLocationId = farmsteadFocusPreviewLocationId(farmsteadFocus);
  if (previewLocationId !== 'farmstead') {
    const previewLocation = locationStatusById(state, previewLocationId) ?? { ...LOCATION_CATALOG.find(entry => entry.id === previewLocationId)!, active: true, npcs: [], serviceLabels: [], closedServiceLabels: [] };
    const service = getLocationServiceOptions(state, previewLocationId)[0] ?? farmsteadServices.find(entry => entry.command === 'show-farm-work') ?? farmsteadServices[0] ?? null;
    return { location: previewLocation, service, actionLocationId: 'farmstead' };
  }

  return {
    location: baseLocation,
    service: farmsteadServices[0] ?? null,
    actionLocationId: 'farmstead'
  };
}

function locationFallbackPreview(state: GameState): AmbientPanelPreview | null {
  const activeLocations = getActiveLocationDirectory(state);
  if (activeLocations.length === 0) return null;

  if (readyForBreakthrough(state, DEFAULT_BALANCE)) {
    const location = activeLocations.find(entry => entry.id === 'array-shed') ?? { ...LOCATION_CATALOG.find(entry => entry.id === 'array-shed')!, active: true, npcs: [], serviceLabels: [], closedServiceLabels: [] };
    const encounters = getLocationEncounters(state, location.id);
    const signalLine = formatLocationNpcSignalLine(collectLocationNpcSignals(state, encounters), '去向');
    const actionLine = formatLocationActionSignalLine(state, 'array-shed', '要务') ?? `要务：${tribulationPrepStatusLine(state)}`;

    return {
      title: location.displayName,
      details: [location.description, signalLine, `现在来：${tribulationPrepFocusReason(state)}`, actionLine, '去处：阵法布设 -> 查看阵法', '人物：今日先按眼前去处推进'].filter(line => line && line.length > 0).join('\n'),
      assetId: locationPreviewAssetId('array-shed')
    };
  }

  const objectiveId = getOnboardingObjectiveId(state);
  const preferred = getPreferredLocationSelection(state);
  const prioritySignal = firstPriorityLocationNpcSignal(state);
  const location = (objectiveId === 'first-loop-complete' && prioritySignal ? prioritySignal.location : null) ?? (preferred ? activeLocations.find(entry => entry.id === preferred.locationId) : null) ?? prioritySignal?.location ?? activeLocations[0] ?? null;
  if (!location) return null;

  const baseServices = getLocationServiceOptions(state, location.id);
  const baseService = (preferred && preferred.locationId === location.id ? baseServices.find(entry => entry.command === preferred.command) : null) ?? baseServices[0] ?? null;

  const fallbackSelection = !preferred && location.id === 'farmstead' ? farmsteadFallbackSelection(state, location) : { location, service: baseService, actionLocationId: location.id };

  const previewLocation = fallbackSelection.location;
  const service = fallbackSelection.service;
  const encounters = getLocationEncounters(state, previewLocation.id);
  const encounterNames = encounters.map(entry => entry.npcName);
  const signalLine = formatLocationNpcSignalLine(collectLocationNpcSignals(state, encounters), '去向');
  const routeFocusReason = locationPreviewFocusReason(state, objectiveId, previewLocation.id, service?.command ?? null, encounters.length);
  const focusReason = fallbackSelection.actionLocationId === 'farmstead' ? (objectiveId === 'first-loop-complete' && service?.command === 'show-processing' ? routeFocusReason : getFarmsteadFocus(state).locationReason) : routeFocusReason;
  const actionLine = formatLocationActionSignalLine(state, fallbackSelection.actionLocationId, '要务');

  return {
    title: previewLocation.displayName,
    details: formatLocationPreviewDetails(previewLocation, service, encounterNames, signalLine, focusReason, actionLine),
    assetId: locationPreviewAssetId(previewLocation.id)
  };
}

export function ambientPanelPreview(state: GameState, content: ContentRegistry, inventoryVisible: boolean): AmbientPanelPreview | null {
  const front = normalizeFrontPreview(frontTilePreview(state, content));
  const inventory = normalizeInventoryPreview(inventoryPreviewSelection(state, content));
  const location = locationFallbackPreview(state);

  if (!inventoryVisible) return front ?? inventory ?? location;

  const preferredSurface = onboardingPreferredSurface(getOnboardingObjectiveId(state));
  if (preferredSurface === 'inventory') return inventory ?? front ?? location;
  return front ?? inventory ?? location;
}
