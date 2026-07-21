import type { Texture } from 'pixi.js';
import type { GameState } from '@sim/world/state';
import { DEFAULT_BALANCE, NPC_CATALOG, LOCATION_CATALOG, getLocationServiceAvailability, getLocationServiceOptions, getOnboardingObjectiveId, type CalendarEntry } from '@sim';
import type { LocationEncounter, LocationId, LocationServiceCommand, LocationServiceOption, LocationStatus } from '@sim/world/locations';
import { readyForBreakthrough } from '@sim/progression/progression';
import { farmsteadFocusPreviewLocationId, getFarmsteadFocus, normalizeFarmsteadRootAssetId } from './farmsteadFocus';
import { formatLocationNpcSignalLine, type LocationNpcSignals } from './locationNpcSignals';
import { calendarSummaryPreviewAssetId } from './calendarPreviewAsset';

export type LocationPreviewNpcSignals = LocationNpcSignals;

export interface LocationPreviewPortraits {
  primary?: Texture;
  secondary?: Texture;
}

export interface LocationPreviewSummaryInput {
  location: LocationStatus;
  services: readonly LocationServiceOption[];
  selectedService: LocationServiceOption | null;
  encounters: readonly LocationEncounter[];
  npcSignals?: LocationPreviewNpcSignals;
  actionSignalLine?: string;
  focusReason?: string;
}

export interface LocationSelectionToastPresentation {
  message: string;
  assetId?: string;
}

export interface LocationPreviewSummaryContext {
  location: LocationStatus;
  services: readonly LocationServiceOption[];
  selectedService: LocationServiceOption | null;
  command: LocationServiceCommand | null;
}

export interface LocationAvailabilityToastPresentation {
  message: string;
  assetId?: string;
}

export interface LocationNavigationToastPresentation {
  message: string;
  assetId?: string;
}

export interface LocationShortcutFailureToastPresentation {
  message: string;
  assetId?: string;
}

function locationServiceUnavailableMessage(state: GameState | null, location: LocationStatus): string {
  const objectiveId = state ? getOnboardingObjectiveId(state) : null;

  if (objectiveId === 'first-market-restock') {
    return `${location.displayName}当前先放一放｜先去集市补种，把第二轮炼丹材料接上`;
  }

  if (objectiveId === 'first-second-sow') {
    return `${location.displayName}当前先放一放｜先回农庄补播，让第二轮药材不断档`;
  }

  if (location.services.length === 1 && location.services[0] === 'encounter') {
    return `${location.displayName}此刻只有行踪可看｜先记住人在哪，再决定要不要跟进`;
  }

  if (location.npcs.length > 0) {
    return `${location.displayName}眼下暂无可执行服务｜可先看看人在做什么再转主线`;
  }

  return `${location.displayName}眼下暂无可执行服务｜先回农庄收口农务、出货与备劫准备`;
}

function explorationShortcutFailureMessage(state: GameState, locationId: LocationId, command: LocationServiceCommand): string {
  const objectiveId = getOnboardingObjectiveId(state);

  if (objectiveId === 'first-market-restock') {
    return command === 'browse-shop' ? '当前先去集市补种｜把第二轮药材和炼丹材料接上后再分心' : '当前先去集市补种｜外出探索放到补种和资源循环之后';
  }

  if (objectiveId === 'first-second-sow') {
    return command === 'show-farm-work' ? '当前先回农庄补播｜把新种子落土后再转别处' : '当前先回农庄补播｜先把第二轮药材种回田里再外出';
  }

  if (command === 'browse-festival-stall') {
    return '节日摊位当前不可浏览｜先看会场事务或稍后再来';
  }

  if (locationId === 'valley-market') {
    if (command === 'browse-shop') {
      const availability = getLocationServiceAvailability(state, locationId, 'shop');
      if (!availability.open && availability.reason === '节日停市') return '集市今日随节停市｜先去会场看当期货与事务';
      if (!availability.open && availability.reason === '集市盘账') return '集市今日盘账歇市｜先清农庄内务，明日再来';
      return '山谷集市今日无坊市可逛｜先去告示板或回农庄推进';
    }
    if (command === 'browse-trade') {
      const availability = getLocationServiceAvailability(state, locationId, 'trade');
      if (!availability.open && availability.reason === '节日停市') return '集市今日随节停市｜先去会场看当期货与事务';
      if (!availability.open && availability.reason === '集市盘账') return '集市今日盘账歇市｜先把待卖货整好，明日再来';
      return '山谷集市今日无交易可看｜先备货或转去别处推进';
    }
  }

  if (locationId === 'valley-outskirts' && command === 'explore-valley') {
    return '山谷今日无可寻访地点｜先稳住农务出货，再决定探遗迹残脉';
  }

  if (locationId === 'ruin-gate' && command === 'explore-ruin') {
    return '遗迹门口今日不可寻访｜先从山谷补种补材，备好丹药再试探';
  }

  if (locationId === 'ruin-gate' && command === 'delve-ruin') {
    return '遗迹今日不可深入｜先补足体力、丹药与阵材，再压深层';
  }

  if (locationId === 'spirit-vein' && command === 'explore-spirit-vein') {
    return '残脉入口今日不可探查｜先把补给、药材和脚下农务稳住';
  }

  return '当前无可执行地点服务';
}

export function describeLocationSelectionSummary(location: LocationStatus | null, services: readonly LocationServiceOption[], selectedService: LocationServiceOption | null): string {
  if (!location) return '今日无可用地点';
  const npcText = location.npcs.length > 0 ? `；${location.npcs.join('、')}` : '';
  if (services.length === 0 || !selectedService) {
    return `${location.displayName}（${location.npcs.length > 0 ? '先看行踪' : '先回主线'}${npcText}）`;
  }
  return `${location.displayName}（${selectedService.label}：${selectedService.commandLabel}${npcText}）`;
}

export const LOCATION_PREVIEW_LOCATION_IDS = LOCATION_CATALOG.map(location => location.id);
export const NPC_PREVIEW_IDS = NPC_CATALOG.map(npc => npc.id);
export const EXTRA_NPC_PREVIEW_ASSET_IDS = ['map-sprite.market-merchant-v1', 'map-sprite.tea-shed-elder-v1', 'map-sprite.processing-artisan-v1', 'map-sprite.patrol-guard-v1'] as const;

const NPC_PORTRAIT_ASSET_ID_BY_NPC_ID: Readonly<Record<string, string>> = {
  'npc.herb-gatherer': 'portrait.avatar.herb-gatherer-v1',
  'npc.array-smith': 'portrait.avatar.array-smith-lu-v1'
};

const EXTRA_NPC_PREVIEW_ASSET_ID_BY_NPC_ID: Readonly<Record<string, string>> = {
  'npc.market-merchant': 'map-sprite.market-merchant-v1',
  'npc.tea-shed-elder': 'map-sprite.tea-shed-elder-v1',
  'npc.processing-artisan': 'map-sprite.processing-artisan-v1',
  'npc.patrol-guard': 'map-sprite.patrol-guard-v1'
};

const EXTRA_NPC_PREVIEW_ASSET_ID_BY_NAME: Readonly<Record<string, string>> = {
  采药女: 'portrait.avatar.herb-gatherer-v1',
  阵匠老陆: 'portrait.avatar.array-smith-lu-v1',
  集市商贩: 'map-sprite.market-merchant-v1',
  茶棚老人: 'map-sprite.tea-shed-elder-v1',
  晒坊匠人: 'map-sprite.processing-artisan-v1',
  巡谷守卫: 'map-sprite.patrol-guard-v1'
};

const LOCATION_FALLBACK_NPC_ASSET_IDS: Readonly<Record<LocationId, readonly string[]>> = {
  farmstead: ['map-sprite.processing-artisan-v1'],
  'valley-market': ['map-sprite.market-merchant-v1', 'map-sprite.patrol-guard-v1'],
  'festival-ground': ['map-sprite.market-merchant-v1'],
  'valley-outskirts': ['map-sprite.patrol-guard-v1'],
  'ruin-gate': ['map-sprite.patrol-guard-v1'],
  'spirit-vein': ['map-sprite.patrol-guard-v1'],
  'tea-shed': ['map-sprite.tea-shed-elder-v1'],
  'herb-plot': ['portrait.avatar.herb-gatherer-v1'],
  'creek-field': ['portrait.avatar.herb-gatherer-v1'],
  'drying-yard': ['map-sprite.processing-artisan-v1'],
  greenhouse: ['portrait.avatar.herb-gatherer-v1'],
  'array-shed': ['portrait.avatar.array-smith-lu-v1'],
  'ore-slope': ['map-sprite.patrol-guard-v1']
};

const LOCATION_SERVICE_TOAST_ASSET_IDS: Readonly<Partial<Record<LocationServiceCommand, string>>> = {
  'browse-shop': 'map-sprite.market-merchant-v1',
  'browse-trade': 'map-sprite.market-merchant-v1',
  'show-farm-work': 'loc.farmstead',
  'show-tea-shed': 'map-sprite.tea-shed-elder-v1',
  'show-greenhouse': 'portrait.avatar.herb-gatherer-v1',
  'show-festival': 'loc.festival-ground',
  'browse-festival-stall': 'map-sprite.market-merchant-v1',
  'show-archive': 'loc.ruin-gate',
  'explore-ruin': 'loc.ruin-gate',
  'delve-ruin': 'loc.ruin-gate',
  'explore-valley': 'loc.valley-outskirts',
  'explore-spirit-vein': 'loc.spirit-vein'
};

export function locationServiceActorAssetId(command: LocationServiceCommand): string | undefined {
  switch (command) {
    case 'browse-shop':
    case 'browse-trade':
    case 'browse-festival-stall':
      return 'map-sprite.market-merchant-v1';
    case 'show-tea-shed':
      return 'map-sprite.tea-shed-elder-v1';
    case 'show-greenhouse':
      return 'portrait.avatar.herb-gatherer-v1';
    default:
      return undefined;
  }
}

export function locationPreviewAssetId(locationId: LocationId): string {
  return `loc.${locationId}`;
}

export function locationPreviewThreadLocationId(state: GameState, locationId: LocationId, selectedCommand: LocationServiceCommand | null): LocationId {
  if (locationId !== 'farmstead') return locationId;
  if (selectedCommand !== null && selectedCommand !== 'show-farm-work') return locationId;
  if (readyForBreakthrough(state, DEFAULT_BALANCE)) return 'array-shed';
  return farmsteadFocusPreviewLocationId(getFarmsteadFocus(state));
}

export function locationSelectionToastPresentation(prefix: '地点' | '服务', location: LocationStatus, selectedService: LocationServiceOption | null, hint: string, focusReason?: string, actionSignalLine?: string, assetIdOverride?: string): LocationSelectionToastPresentation {
  const rootRedirectToArrayShed = location.id === 'farmstead' && selectedService?.command === 'show-farm-work' && normalizeFarmsteadRootAssetId(assetIdOverride ?? '') === 'loc.array-shed';
  const arrayShedCatalogEntry = rootRedirectToArrayShed ? LOCATION_CATALOG.find(entry => entry.id === 'array-shed') : null;
  const toastLocation = rootRedirectToArrayShed
    ? arrayShedCatalogEntry
      ? {
          ...arrayShedCatalogEntry,
          active: true,
          npcs: location.npcs,
          serviceLabels: [],
          closedServiceLabels: []
        }
      : location
    : location;
  const toastService: LocationServiceOption | null =
    rootRedirectToArrayShed && selectedService
      ? {
          ...selectedService,
          locationId: 'array-shed',
          service: 'arrays',
          label: '阵法布设',
          command: 'show-arrays',
          commandLabel: '查看阵法'
        }
      : selectedService;
  const npcText = toastLocation.npcs.length > 0 ? `；${toastLocation.npcs.join('、')}` : '';
  const focusText = focusReason ? `｜现在来：${focusReason}` : '';
  const actionText = actionSignalLine ? `｜${actionSignalLine}` : '';
  const message = toastService ? `${prefix}：${toastLocation.displayName}（${toastService.label}：${toastService.commandLabel}${npcText}）${focusText}${actionText}｜${hint}` : `${prefix}：${toastLocation.displayName}（${toastLocation.npcs.length > 0 ? '先看行踪' : '先回主线'}${npcText}）${focusText}${actionText}｜${hint}`;

  let serviceAssetId = locationPreviewAssetId(location.id);
  if (toastService) {
    if (toastService.command === 'show-processing') {
      if (location.id === 'farmstead') {
        serviceAssetId = 'loc.farmstead';
      } else {
        serviceAssetId = 'loc.drying-yard';
      }
    } else if (toastService.command === 'show-arrays') {
      if (location.id === 'farmstead') {
        serviceAssetId = 'loc.farmstead';
      } else {
        serviceAssetId = 'loc.array-shed';
      }
    } else {
      serviceAssetId = locationServiceActorAssetId(toastService.command) ?? LOCATION_SERVICE_TOAST_ASSET_IDS[toastService.command] ?? locationPreviewAssetId(toastLocation.id);
    }
  }

  if (assetIdOverride) {
    serviceAssetId = location.id === 'farmstead' && selectedService?.command === 'show-farm-work' ? normalizeFarmsteadRootAssetId(assetIdOverride) : assetIdOverride;
  }

  return {
    message,
    assetId: serviceAssetId
  };
}

export function locationPreviewSummaryContext(state: GameState, location: LocationStatus, services: readonly LocationServiceOption[], selectedService: LocationServiceOption | null, encounters: readonly LocationEncounter[]): LocationPreviewSummaryContext {
  const selectedCommand = selectedService?.command ?? null;
  const previewThreadLocationId = locationPreviewThreadLocationId(state, location.id, selectedCommand);
  if (location.id === 'farmstead' && previewThreadLocationId === 'array-shed' && (selectedCommand === null || selectedCommand === 'show-farm-work')) {
    const arrayShedCatalog = LOCATION_CATALOG.find(entry => entry.id === 'array-shed')!;
    const threadLocation = {
      ...arrayShedCatalog,
      active: true,
      npcs: encounters.map(entry => entry.npcName),
      serviceLabels: [],
      closedServiceLabels: []
    };
    const threadServices = getLocationServiceOptions(state, 'array-shed');
    const threadSelectedService = threadServices.find(entry => entry.command === 'show-arrays') ?? {
      locationId: 'array-shed',
      service: 'arrays',
      label: '阵法布设',
      command: 'show-arrays',
      commandLabel: '查看阵法'
    };
    return {
      location: threadLocation,
      services: threadServices.length > 0 ? threadServices : [threadSelectedService],
      selectedService: threadSelectedService,
      command: threadSelectedService?.command ?? 'show-arrays'
    };
  }

  return {
    location,
    services,
    selectedService,
    command: selectedCommand
  };
}

export function locationDirectoryEmptyToastPresentation(assetIdOverride?: string): LocationAvailabilityToastPresentation {
  return {
    message: '今日暂无可切换地点｜先回农庄收口农务与修行资源',
    assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead'
  };
}

export function locationServiceUnavailableToastPresentation(location: LocationStatus, state?: GameState): LocationAvailabilityToastPresentation {
  return {
    message: locationServiceUnavailableMessage(state ?? null, location),
    assetId: locationPreviewAssetId(location.id)
  };
}

export function locationEncounterUnavailableToastPresentation(location: LocationStatus): LocationAvailabilityToastPresentation {
  return {
    message: `${location.displayName}眼下暂无停留人物｜先按当前地点动线推进`,
    assetId: locationPreviewAssetId(location.id)
  };
}

export function locationShortcutFailureToastPresentation(locationId: LocationId, messageOrState: string | GameState, command?: LocationServiceCommand): LocationShortcutFailureToastPresentation {
  const message = typeof messageOrState === 'string' ? messageOrState : explorationShortcutFailureMessage(messageOrState, locationId, command ?? 'show-location-encounter');
  return {
    message,
    assetId: locationPreviewAssetId(locationId)
  };
}

export function calendarSummaryToastPresentation(today: string, upcoming: string, todayEntries: readonly CalendarEntry[] = [], upcomingEntries: readonly CalendarEntry[] = []): LocationNavigationToastPresentation {
  return {
    message: `今日日程：${today}｜近七日：${upcoming}`,
    assetId: calendarSummaryPreviewAssetId(todayEntries, upcomingEntries)
  };
}

export function legacyConfirmUnavailableToastPresentation(assetIdOverride?: string): LocationNavigationToastPresentation {
  return {
    message: '旧确认键当前无对象｜先用地点或服务确认推进',
    assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead'
  };
}

export function npcPortraitAssetId(npcId: string): string | undefined {
  return NPC_PORTRAIT_ASSET_ID_BY_NPC_ID[npcId] ?? (NPC_PREVIEW_IDS.includes(npcId) ? `sprite.${npcId}` : undefined);
}

export function previewNpcPortraitAssetId(npcId: string): string | undefined {
  return npcPortraitAssetId(npcId) ?? EXTRA_NPC_PREVIEW_ASSET_ID_BY_NPC_ID[npcId] ?? (EXTRA_NPC_PREVIEW_ASSET_IDS.includes(npcId as (typeof EXTRA_NPC_PREVIEW_ASSET_IDS)[number]) ? npcId : undefined);
}

export function previewNpcPortraitAssetIdFromName(npcName: string): string | undefined {
  return EXTRA_NPC_PREVIEW_ASSET_ID_BY_NAME[npcName];
}

export function locationPreviewNpcIds(location: LocationStatus, npcNameToId: ReadonlyMap<string, string>): string[] {
  return location.npcs.map(name => npcNameToId.get(name)).filter((npcId): npcId is string => typeof npcId === 'string');
}

export function locationPreviewPortraitAssetIds(location: LocationStatus, npcIds: readonly string[]): string[] {
  const assetIds = npcIds.map(npcId => previewNpcPortraitAssetId(npcId)).filter((assetId): assetId is string => typeof assetId === 'string');
  const fallbackAssetIds = LOCATION_FALLBACK_NPC_ASSET_IDS[location.id] ?? [];
  return [...new Set([...assetIds, ...fallbackAssetIds])];
}

export function locationPreviewPortraits(portraitAssetIds: readonly string[], textures: Readonly<Record<string, Texture | undefined>>): LocationPreviewPortraits {
  const [primaryId, secondaryId] = portraitAssetIds;
  return {
    primary: primaryId ? textures[primaryId] : undefined,
    secondary: secondaryId ? textures[secondaryId] : undefined
  };
}

function serviceListText(services: readonly LocationServiceOption[], encounters: readonly LocationEncounter[]): string {
  if (services.length === 0) {
    return encounters.length > 0 ? '今日先看行踪，再决定要不要跟进' : '今日先回农庄收口农务与修行资源';
  }
  return services.map((entry, index) => `${index + 1}. ${entry.label}`).join(' / ');
}

function encounterHeadline(encounters: readonly LocationEncounter[]): string {
  if (encounters.length === 0) return '人物：今日先按当前地点动线推进';
  const names = encounters.map(entry => entry.npcName).join('、');
  const firstLine = encounters[0]?.lines[0];
  return firstLine ? `人物：${names}｜${firstLine}` : `人物：${names}`;
}

function encounterTip(encounters: readonly LocationEncounter[]): string {
  if (encounters.length === 0) return '偶遇：今日先按农务与地点动线推进';
  const line = encounters[0]?.lines[1] ?? encounters[0]?.lines[0] ?? '可前往查看偶遇详情';
  return `偶遇：${encounters[0]?.title ?? '在场修士'}｜${line}`;
}

export function buildLocationPreviewSummary(input: LocationPreviewSummaryInput): string {
  const { location, services, selectedService, encounters, npcSignals, actionSignalLine, focusReason } = input;
  const currentLine = selectedService ? `当前：${selectedService.label} -> ${selectedService.commandLabel}` : encounters.length > 0 ? '当前：先看行踪' : '当前：先回农庄收口';
  return [location.description, currentLine, focusReason ? `现在来：${focusReason}` : '', formatLocationNpcSignalLine(npcSignals), actionSignalLine ?? '', `可选：${serviceListText(services, encounters)}`, encounterHeadline(encounters), encounterTip(encounters), '点选地点与服务进入，Esc 返回农庄'].filter(line => line.length > 0).join('\n');
}
