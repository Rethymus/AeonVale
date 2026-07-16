import { DEFAULT_BALANCE, currentFestivalEventId, getActiveSpecialOrders, getActiveLocationDirectory, getCurrentMainlineQuest, getCurrentNpcQuest, getCurrentRuinChapter, getCurrentStayingWorldIncident, getDailyCommission, getNpcDailySchedules, greenhouseVisitFlag, hasResolvedStayingWorldIncidentForDay, hasParticipatedCurrentFestival, locationIdForDisplayName, nextArchiveDonation, nextArchiveMilestone, storageUsed, teaShedVisitFlag, type LocationId } from '@sim';
import { locationServiceActorAssetId } from '@app/locationPreview';
import { itemIconAssetId } from '@app/itemIcons';
import type { GameState } from '@sim/world/state';
import { itemCount } from '@sim/world/player';
import { readyForBreakthrough } from '@sim/progression/progression';

export interface FarmsteadPropPlacement {
  assetId: 'facility.storage-chest' | 'facility.shipping-bin';
  x: number;
  y: number;
  status: 'idle' | 'ready';
}

export interface NpcWorldPreviewPlacement {
  npcId: string;
  npcName: string;
  assetId: string;
  locationId: LocationId;
  x: number;
  y: number;
  birthday: boolean;
  hasQuest: boolean;
  questReady: boolean;
}

export interface LocationWorldPreviewPlacement {
  locationId: LocationId;
  assetId: string;
  taskAssetId?: string;
  serviceAssetId?: string;
  x: number;
  y: number;
  npcCount: number;
  birthday: boolean;
  hasQuest: boolean;
  questReady: boolean;
  serviceReady: boolean;
  serviceDone: boolean;
  taskReady: boolean;
}

function farmsteadTaskReady(state: GameState): boolean {
  const readyFacility = Array.from(state.facilities.values()).some(facility => (facility.job?.daysRemaining ?? 1) <= 0);
  if (readyFacility) return true;

  const queuedShipping = Object.values(state.shippingBin).some(count => count > 0) || Object.values(state.qualityShippingBin).some(batch => Object.values(batch ?? {}).some(count => count > 0));
  if (queuedShipping) return true;

  return storageUsed(state.storage) >= state.storage.capacity;
}

function marketTaskReady(state: GameState): boolean {
  const commission = getDailyCommission(state);
  if (commission && commission.npcId === 'npc.wandering-cultivator' && itemCount(state.player, commission.request.itemId) >= commission.request.count) {
    return true;
  }
  return getActiveSpecialOrders(state).some(order => order.remaining <= 0 && order.npcId === 'npc.wandering-cultivator');
}

function commissionTaskLocationId(state: GameState): LocationId | null {
  const commission = getDailyCommission(state);
  if (!commission || itemCount(state.player, commission.request.itemId) < commission.request.count) return null;

  switch (commission.npcId) {
    case 'npc.herb-gatherer':
      return commission.request.itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot';
    case 'npc.array-smith':
      return 'ruin-gate';
    case 'npc.wandering-cultivator':
      return commission.request.itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market';
    default:
      return 'valley-market';
  }
}

function specialOrderTaskLocationId(state: GameState): LocationId | null {
  const order = getActiveSpecialOrders(state).find(entry => entry.remaining <= 0) ?? null;
  if (!order) return null;

  switch (order.npcId) {
    case 'npc.herb-gatherer':
      return order.request.itemId === 'herb.mossling' ? 'creek-field' : 'herb-plot';
    case 'npc.array-smith':
      return 'ruin-gate';
    case 'npc.wandering-cultivator':
      return order.request.itemId === 'item.beast-core' ? 'spirit-vein' : 'valley-market';
    default:
      return 'valley-market';
  }
}

function ruinGateTaskReady(state: GameState): boolean {
  const chapter = getCurrentRuinChapter(state);
  if (chapter?.completed) return true;

  if (nextArchiveMilestone(state)) return true;

  const donation = nextArchiveDonation(state);
  if (donation && itemCount(state.player, donation.request.itemId) >= donation.request.count) return true;

  const mainline = getCurrentMainlineQuest(state);
  if (mainline?.id === 'mainline.archive-clue' && mainline.completed) return true;

  return false;
}

function incidentTaskLocationId(state: GameState): LocationId | null {
  const incident = getCurrentStayingWorldIncident(state);
  if (!incident || hasResolvedStayingWorldIncidentForDay(state, state.day)) return null;
  switch (incident.id) {
    case 'incident.beast-trace':
      return 'spirit-vein';
    case 'incident.array-fray':
      return 'ruin-gate';
    case 'incident.herb-relief':
      return 'creek-field';
    default:
      return null;
  }
}

function locationServiceWorldState(state: GameState, locationId: LocationId): Pick<LocationWorldPreviewPlacement, 'serviceReady' | 'serviceDone' | 'taskReady' | 'serviceAssetId'> {
  const incidentTaskLocation = incidentTaskLocationId(state);
  const commissionTaskLocation = commissionTaskLocationId(state);
  const specialOrderTaskLocation = specialOrderTaskLocationId(state);
  switch (locationId) {
    case 'farmstead':
      return { serviceReady: false, serviceDone: false, taskReady: farmsteadTaskReady(state) };
    case 'valley-market':
      return {
        serviceReady: false,
        serviceDone: false,
        taskReady: commissionTaskLocation === 'valley-market' || specialOrderTaskLocation === 'valley-market' || marketTaskReady(state)
      };
    case 'ruin-gate':
      return {
        serviceReady: false,
        serviceDone: false,
        taskReady: incidentTaskLocation === 'ruin-gate' || commissionTaskLocation === 'ruin-gate' || specialOrderTaskLocation === 'ruin-gate' || ruinGateTaskReady(state)
      };
    case 'spirit-vein':
    case 'creek-field':
    case 'herb-plot':
      return {
        serviceReady: false,
        serviceDone: false,
        taskReady: incidentTaskLocation === locationId || commissionTaskLocation === locationId || specialOrderTaskLocation === locationId
      };
    case 'array-shed': {
      const breakthroughReady = readyForBreakthrough(state, DEFAULT_BALANCE);
      return {
        serviceReady: breakthroughReady,
        serviceDone: false,
        taskReady: false,
        serviceAssetId: breakthroughReady ? 'sprite.npc.array-smith' : undefined
      };
    }
    case 'tea-shed': {
      if (state.postAscension.mode !== 'stayed-in-world') return { serviceReady: false, serviceDone: false, taskReady: false };
      const done = state.flags.has(teaShedVisitFlag(state.day));
      return {
        serviceReady: !done,
        serviceDone: done,
        taskReady: false,
        serviceAssetId: locationServiceActorAssetId('show-tea-shed')
      };
    }
    case 'greenhouse': {
      if (state.postAscension.mode !== 'stayed-in-world') return { serviceReady: false, serviceDone: false, taskReady: false };
      const done = state.flags.has(greenhouseVisitFlag(state.day));
      return {
        serviceReady: !done,
        serviceDone: done,
        taskReady: false,
        serviceAssetId: locationServiceActorAssetId('show-greenhouse')
      };
    }
    case 'festival-ground': {
      if (!currentFestivalEventId(state)) return { serviceReady: false, serviceDone: false, taskReady: false };
      const done = hasParticipatedCurrentFestival(state);
      return {
        serviceReady: !done,
        serviceDone: done,
        taskReady: false,
        serviceAssetId: locationServiceActorAssetId('browse-festival-stall')
      };
    }
    default:
      return { serviceReady: false, serviceDone: false, taskReady: false };
  }
}

const LOCATION_WORLD_ANCHORS: Readonly<Record<LocationId, { x: number; y: number }>> = {
  farmstead: { x: 0.18, y: 0.24 },
  'valley-market': { x: 0.9, y: 0.18 },
  'festival-ground': { x: 0.84, y: 0.48 },
  'valley-outskirts': { x: 0.08, y: 0.48 },
  'ruin-gate': { x: 0.9, y: 0.62 },
  'spirit-vein': { x: 0.92, y: 0.8 },
  'tea-shed': { x: 0.12, y: 0.84 },
  'herb-plot': { x: 0.24, y: 0.2 },
  'creek-field': { x: 0.22, y: 0.72 },
  'drying-yard': { x: 0.42, y: 0.84 },
  greenhouse: { x: 0.74, y: 0.84 },
  'array-shed': { x: 0.72, y: 0.26 },
  'ore-slope': { x: 0.92, y: 0.36 }
};

const WORLD_PREVIEW_OFFSETS = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 }
] as const;

const AMBIENT_LOCATION_NPC_ASSETS: Readonly<Partial<Record<LocationId, readonly string[]>>> = {
  farmstead: ['sprite.npc.processing-artisan'],
  'valley-market': ['sprite.npc.market-merchant'],
  'festival-ground': ['sprite.npc.market-merchant'],
  'tea-shed': ['sprite.npc.tea-shed-elder'],
  'herb-plot': ['sprite.npc.herb-gatherer'],
  'creek-field': ['sprite.npc.herb-gatherer'],
  'drying-yard': ['sprite.npc.processing-artisan'],
  greenhouse: ['sprite.npc.herb-gatherer'],
  'array-shed': ['sprite.npc.array-smith'],
  'valley-outskirts': ['sprite.npc.patrol-guard'],
  'ruin-gate': ['sprite.npc.patrol-guard'],
  'spirit-vein': ['sprite.npc.patrol-guard'],
  'ore-slope': ['sprite.npc.patrol-guard']
};

const AMBIENT_NPC_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  'sprite.npc.market-merchant': '集市商贩',
  'sprite.npc.tea-shed-elder': '茶棚老人',
  'sprite.npc.processing-artisan': '晒坊匠人',
  'sprite.npc.herb-gatherer': '采药女',
  'sprite.npc.array-smith': '阵匠老陆',
  'sprite.npc.patrol-guard': '巡谷守卫'
};

function clampTile(value: number, max: number): number {
  if (max <= 0) return 0;
  if (value <= 0) return 0;
  if (value >= max) return max;
  return value;
}

function anchorTile(width: number, height: number, locationId: LocationId): { x: number; y: number } {
  const anchor = LOCATION_WORLD_ANCHORS[locationId] ?? LOCATION_WORLD_ANCHORS['valley-outskirts'];
  return {
    x: clampTile(Math.round((width - 1) * anchor.x), width - 1),
    y: clampTile(Math.round((height - 1) * anchor.y), height - 1)
  };
}

function queuedShippingCount(state: GameState): number {
  const normal = Object.values(state.shippingBin).filter(count => count > 0).length;
  const quality = Object.values(state.qualityShippingBin).reduce((total, batch) => total + Object.values(batch ?? {}).filter(count => count > 0).length, 0);
  return normal + quality;
}

export function farmsteadPropPlacements(state: GameState): FarmsteadPropPlacement[] {
  const anchor = anchorTile(state.width, state.height, 'farmstead');
  return [
    {
      assetId: 'facility.storage-chest',
      x: clampTile(anchor.x + 1, state.width - 1),
      y: clampTile(anchor.y, state.height - 1),
      status: storageUsed(state.storage) >= state.storage.capacity ? 'ready' : 'idle'
    },
    {
      assetId: 'facility.shipping-bin',
      x: clampTile(anchor.x, state.width - 1),
      y: clampTile(anchor.y + 1, state.height - 1),
      status: queuedShippingCount(state) > 0 ? 'ready' : 'idle'
    }
  ];
}

function npcWorldAssetId(npcId: string): string {
  return `sprite.${npcId}`;
}

function locationWorldAssetId(locationId: LocationId): string {
  return `loc.${locationId}`;
}

function groupedAnchorTile(width: number, height: number, locationId: LocationId): { x: number; y: number } {
  return anchorTile(width, height, locationId);
}

function firstRecordItemId(record: Readonly<Record<string, number>>): string | undefined {
  return Object.entries(record).find(([, count]) => count > 0)?.[0];
}

function firstQualityRecordItemId(record: Readonly<Record<string, Readonly<Record<string, number>> | undefined>>): string | undefined {
  for (const batch of Object.values(record)) {
    const itemId = firstRecordItemId(batch ?? {});
    if (itemId) return itemId;
  }
  return undefined;
}

function firstStorageInventoryItemId(state: GameState): string | undefined {
  return Object.entries(state.storage.inventory).find(([, slot]) => slot.count > 0)?.[0];
}

function farmsteadTaskBadgeAssetId(state: GameState): string | undefined {
  const readyFacility = Array.from(state.facilities.values()).find(facility => (facility.job?.daysRemaining ?? 1) <= 0);
  if (readyFacility) {
    const outputItemId = readyFacility.job?.outputItemId;
    return (outputItemId ? itemIconAssetId(outputItemId) : undefined) ?? `facility.${readyFacility.kind}`;
  }

  const shippingItemId = firstRecordItemId(state.shippingBin) ?? firstQualityRecordItemId(state.qualityShippingBin);
  if (shippingItemId) return itemIconAssetId(shippingItemId) ?? 'facility.shipping-bin';

  const storageItemId = firstStorageInventoryItemId(state) ?? firstQualityRecordItemId(state.storage.qualityInventory);
  if (storageItemId) return itemIconAssetId(storageItemId) ?? 'facility.storage-chest';

  return undefined;
}

function ruinGateTaskBadgeAssetId(state: GameState): string | undefined {
  const chapter = getCurrentRuinChapter(state);
  if (chapter?.completed && chapter.reward.itemId) {
    return itemIconAssetId(chapter.reward.itemId);
  }

  const milestone = nextArchiveMilestone(state);
  if (milestone?.reward.itemId) {
    return itemIconAssetId(milestone.reward.itemId);
  }

  const donation = nextArchiveDonation(state);
  if (donation && itemCount(state.player, donation.request.itemId) >= donation.request.count) {
    return itemIconAssetId(donation.request.itemId);
  }

  const mainline = getCurrentMainlineQuest(state);
  if (mainline?.id === 'mainline.archive-clue' && mainline.completed && mainline.reward.itemId) {
    return itemIconAssetId(mainline.reward.itemId);
  }

  return undefined;
}

function incidentTaskBadgeAssetId(state: GameState, locationId: LocationId): string | undefined {
  const incident = getCurrentStayingWorldIncident(state);
  if (!incident || hasResolvedStayingWorldIncidentForDay(state, state.day)) return undefined;
  if (incidentTaskLocationId(state) !== locationId) return undefined;
  return itemIconAssetId(incident.itemId);
}

function commissionTaskBadgeAssetId(state: GameState, locationId: LocationId): string | undefined {
  const commission = getDailyCommission(state);
  if (!commission || itemCount(state.player, commission.request.itemId) < commission.request.count) return undefined;
  if (commissionTaskLocationId(state) !== locationId) return undefined;
  return itemIconAssetId(commission.request.itemId);
}

function specialOrderTaskBadgeAssetId(state: GameState, locationId: LocationId): string | undefined {
  const order = getActiveSpecialOrders(state).find(entry => entry.remaining <= 0) ?? null;
  if (!order || specialOrderTaskLocationId(state) !== locationId) return undefined;
  return itemIconAssetId(order.request.itemId);
}

export function locationTaskBadgeAssetId(state: GameState, locationId: LocationId): string | undefined {
  const incidentBadge = incidentTaskBadgeAssetId(state, locationId);
  if (incidentBadge) return incidentBadge;

  const commissionBadge = commissionTaskBadgeAssetId(state, locationId);
  if (commissionBadge) return commissionBadge;

  const specialOrderBadge = specialOrderTaskBadgeAssetId(state, locationId);
  if (specialOrderBadge) return specialOrderBadge;

  switch (locationId) {
    case 'farmstead':
      return farmsteadTaskBadgeAssetId(state);
    case 'ruin-gate':
      return ruinGateTaskBadgeAssetId(state);
    default:
      return undefined;
  }
}

function placementForLocation(state: GameState, locationId: LocationId, groupIndex: number): Pick<NpcWorldPreviewPlacement, 'locationId' | 'x' | 'y'> {
  const offset = WORLD_PREVIEW_OFFSETS[groupIndex] ?? WORLD_PREVIEW_OFFSETS[WORLD_PREVIEW_OFFSETS.length - 1]!;
  const anchor = groupedAnchorTile(state.width, state.height, locationId);
  return {
    locationId,
    x: clampTile(anchor.x + offset.x, state.width - 1),
    y: clampTile(anchor.y + offset.y, state.height - 1)
  };
}

function ambientNpcWorldPreviewPlacements(state: GameState, scheduledCounts: ReadonlyMap<LocationId, number>, scheduledAssetIds: ReadonlyMap<LocationId, ReadonlySet<string>>): NpcWorldPreviewPlacement[] {
  return getActiveLocationDirectory(state)
    .flatMap(location => {
      const scheduledIds = scheduledAssetIds.get(location.id) ?? new Set<string>();
      const assetIds = (AMBIENT_LOCATION_NPC_ASSETS[location.id] ?? []).filter(assetId => !scheduledIds.has(assetId));
      const existingCount = scheduledCounts.get(location.id) ?? 0;
      return assetIds.map((assetId, index) => {
        const placement = placementForLocation(state, location.id, existingCount + index);
        return {
          npcId: assetId,
          npcName: AMBIENT_NPC_DISPLAY_NAMES[assetId] ?? location.displayName,
          assetId,
          locationId: placement.locationId,
          x: placement.x,
          y: placement.y,
          birthday: false,
          hasQuest: false,
          questReady: false
        };
      });
    })
    .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.assetId.localeCompare(b.assetId));
}

function ambientVisibleNpcCount(state: GameState, locationId: LocationId, scheduledAssetIds: ReadonlyMap<LocationId, ReadonlySet<string>>): number {
  const activeDirectoryIds = new Set(getActiveLocationDirectory(state).map(location => location.id));
  if (!activeDirectoryIds.has(locationId)) return 0;

  const scheduledIds = scheduledAssetIds.get(locationId) ?? new Set<string>();
  return (AMBIENT_LOCATION_NPC_ASSETS[locationId] ?? []).filter(assetId => !scheduledIds.has(assetId)).length;
}

export function locationWorldPreviewPlacements(state: GameState): LocationWorldPreviewPlacement[] {
  const grouped = new Map<LocationId, { npcCount: number; birthday: boolean; hasQuest: boolean; questReady: boolean }>();
  const incidentTaskLocation = incidentTaskLocationId(state);
  const scheduledAssetIds = new Map<LocationId, Set<string>>();
  const breakthroughReady = readyForBreakthrough(state, DEFAULT_BALANCE);

  for (const schedule of getNpcDailySchedules(state)) {
    const locationId = locationIdForDisplayName(schedule.location);
    const quest = getCurrentNpcQuest(state, schedule.npc.id);
    const existing = grouped.get(locationId) ?? { npcCount: 0, birthday: false, hasQuest: false, questReady: false };
    grouped.set(locationId, {
      npcCount: existing.npcCount + 1,
      birthday: existing.birthday || schedule.birthday,
      hasQuest: existing.hasQuest || Boolean(quest),
      questReady: existing.questReady || Boolean(quest?.completed)
    });

    const locationAssetIds = scheduledAssetIds.get(locationId) ?? new Set<string>();
    locationAssetIds.add(npcWorldAssetId(schedule.npc.id));
    scheduledAssetIds.set(locationId, locationAssetIds);
  }

  for (const location of getActiveLocationDirectory(state)) {
    if (!grouped.has(location.id)) {
      grouped.set(location.id, { npcCount: 0, birthday: false, hasQuest: false, questReady: false });
    }
  }

  if (incidentTaskLocation && !grouped.has(incidentTaskLocation)) {
    grouped.set(incidentTaskLocation, { npcCount: 0, birthday: false, hasQuest: false, questReady: false });
  }

  if (breakthroughReady && !grouped.has('array-shed')) {
    grouped.set('array-shed', { npcCount: 0, birthday: false, hasQuest: false, questReady: false });
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([locationId, status]) => {
      const anchor = groupedAnchorTile(state.width, state.height, locationId);
      return {
        locationId,
        assetId: locationWorldAssetId(locationId),
        taskAssetId: locationTaskBadgeAssetId(state, locationId),
        x: anchor.x,
        y: anchor.y,
        npcCount: status.npcCount + ambientVisibleNpcCount(state, locationId, scheduledAssetIds),
        birthday: status.birthday,
        hasQuest: status.hasQuest,
        questReady: status.questReady,
        ...locationServiceWorldState(state, locationId)
      };
    });
}

export function npcWorldPreviewPlacements(state: GameState): NpcWorldPreviewPlacement[] {
  const schedules = getNpcDailySchedules(state)
    .map(schedule => ({
      schedule,
      locationId: locationIdForDisplayName(schedule.location),
      quest: getCurrentNpcQuest(state, schedule.npc.id)
    }))
    .sort((a, b) => a.locationId.localeCompare(b.locationId) || a.schedule.npc.id.localeCompare(b.schedule.npc.id));

  const scheduledCounts = new Map<LocationId, number>();
  const scheduledAssetIds = new Map<LocationId, Set<string>>();
  const scheduledPlacements = schedules.map((entry, index, all) => {
    const sameLocationEntries = all.filter(candidate => candidate.locationId === entry.locationId);
    const groupIndex = sameLocationEntries.findIndex(candidate => candidate.schedule.npc.id === entry.schedule.npc.id);
    const placement = placementForLocation(state, entry.locationId, groupIndex);
    scheduledCounts.set(entry.locationId, sameLocationEntries.length);
    const locationAssetIds = scheduledAssetIds.get(entry.locationId) ?? new Set<string>();
    locationAssetIds.add(npcWorldAssetId(entry.schedule.npc.id));
    scheduledAssetIds.set(entry.locationId, locationAssetIds);
    return {
      npcId: entry.schedule.npc.id,
      npcName: entry.schedule.npc.displayName,
      assetId: npcWorldAssetId(entry.schedule.npc.id),
      locationId: placement.locationId,
      x: placement.x,
      y: placement.y,
      birthday: entry.schedule.birthday,
      hasQuest: Boolean(entry.quest),
      questReady: Boolean(entry.quest?.completed)
    };
  });

  return [...scheduledPlacements, ...ambientNpcWorldPreviewPlacements(state, scheduledCounts, scheduledAssetIds)].sort((a, b) => a.locationId.localeCompare(b.locationId) || a.x - b.x || a.y - b.y || a.assetId.localeCompare(b.assetId));
}
