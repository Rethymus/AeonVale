import { getOnboardingObjectiveId } from '@sim/story/onboarding';
import type { GameState } from './state';
import { getNpcDailySchedules } from '@sim/social/relationships';

export type LocationId = 'farmstead' | 'valley-market' | 'festival-ground' | 'valley-outskirts' | 'ruin-gate' | 'spirit-vein' | 'tea-shed' | 'herb-plot' | 'creek-field' | 'drying-yard' | 'greenhouse' | 'array-shed' | 'ore-slope';

export type LocationService = 'encounter' | 'tea-rest' | 'greenhouse-tending' | 'festival-ritual' | 'shop' | 'festival-stall' | 'trade' | 'commission-board' | 'explore-valley' | 'explore-ruin' | 'delve-ruin' | 'archive' | 'explore-spirit-vein' | 'processing' | 'arrays' | 'farm-work';

export interface LocationDef {
  id: LocationId;
  displayName: string;
  description: string;
  services: readonly LocationService[];
}

export interface LocationStatus extends LocationDef {
  active: boolean;
  npcs: string[];
  serviceLabels: string[];
  closedServiceLabels: string[];
}

export type LocationServiceCommand = 'show-location-encounter' | 'show-tea-shed' | 'show-greenhouse' | 'show-festival' | 'browse-shop' | 'browse-festival-stall' | 'browse-trade' | 'show-commission' | 'explore-valley' | 'explore-ruin' | 'delve-ruin' | 'show-archive' | 'explore-spirit-vein' | 'show-processing' | 'show-arrays' | 'show-farm-work';

export interface LocationServiceOption {
  locationId: LocationId;
  service: LocationService;
  label: string;
  command: LocationServiceCommand;
  commandLabel: string;
}

export interface QuickLocationServiceBinding {
  locationId: LocationId;
  service: LocationService;
}

export interface PreferredLocationSelection {
  locationId: LocationId;
  command: LocationServiceCommand;
}

export interface LocationEncounter {
  locationId: LocationId;
  npcId: string;
  npcName: string;
  title: string;
  lines: readonly string[];
  birthday: boolean;
}

export interface LocationServiceAvailability {
  open: boolean;
  reason: string | null;
}

const SERVICE_LABELS: Record<LocationService, string> = {
  encounter: '偶遇',
  'tea-rest': '歇脚听闻',
  'greenhouse-tending': '暖棚养护',
  'festival-ritual': '参与节日',
  shop: '商店',
  'festival-stall': '节日摊位',
  trade: '交易',
  'commission-board': '委托',
  'explore-valley': '山谷寻访',
  'explore-ruin': '遗迹寻访',
  'delve-ruin': '深入遗迹',
  archive: '藏经',
  'explore-spirit-vein': '残脉探查',
  processing: '加工',
  arrays: '阵法',
  'farm-work': '耕作'
};

const SERVICE_COMMANDS: Record<LocationService, { command: LocationServiceCommand; commandLabel: string }> = {
  encounter: { command: 'show-location-encounter', commandLabel: '查看偶遇' },
  'tea-rest': { command: 'show-tea-shed', commandLabel: '歇脚听闻' },
  'greenhouse-tending': { command: 'show-greenhouse', commandLabel: '暖棚养护' },
  'festival-ritual': { command: 'show-festival', commandLabel: '参与节日' },
  shop: { command: 'browse-shop', commandLabel: '浏览商店' },
  'festival-stall': { command: 'browse-festival-stall', commandLabel: '浏览节日摊位' },
  trade: { command: 'browse-trade', commandLabel: '查看交易' },
  'commission-board': { command: 'show-commission', commandLabel: '查看委托' },
  'explore-valley': { command: 'explore-valley', commandLabel: '前往寻访' },
  'explore-ruin': { command: 'explore-ruin', commandLabel: '搜寻遗迹' },
  'delve-ruin': { command: 'delve-ruin', commandLabel: '深入一层' },
  archive: { command: 'show-archive', commandLabel: '捐献藏经' },
  'explore-spirit-vein': { command: 'explore-spirit-vein', commandLabel: '探查残脉' },
  processing: { command: 'show-processing', commandLabel: '查看加工' },
  arrays: { command: 'show-arrays', commandLabel: '查看阵法' },
  'farm-work': { command: 'show-farm-work', commandLabel: '查看农事' }
};

const QUICK_LOCATION_SERVICE_BINDINGS: Readonly<Record<'staying-commission' | 'tea-shed' | 'greenhouse', QuickLocationServiceBinding>> = {
  'staying-commission': { locationId: 'valley-market', service: 'commission-board' },
  'tea-shed': { locationId: 'tea-shed', service: 'tea-rest' },
  greenhouse: { locationId: 'greenhouse', service: 'greenhouse-tending' }
};

const LOCATION_DEFS: readonly LocationDef[] = [
  { id: 'farmstead', displayName: '农庄', description: '主角以凡骨苦练、种灵草与炼体的据点。', services: ['farm-work', 'processing', 'arrays'] },
  { id: 'valley-market', displayName: '山谷集市', description: '散修、商贩与委托汇聚之处。', services: ['shop', 'trade', 'commission-board'] },
  { id: 'festival-ground', displayName: '节日会场', description: '天象节庆期间开放的临时会场。', services: [] },
  { id: 'valley-outskirts', displayName: '山谷', description: '农庄外缘，可采集早期灵草与散碎灵石。', services: ['explore-valley'] },
  { id: 'ruin-gate', displayName: '遗迹门口', description: '旧阵残纹与体修传承残响所在。', services: ['explore-ruin', 'delve-ruin', 'archive'] },
  { id: 'spirit-vein', displayName: '残脉入口', description: '灵气残脉边缘，收益更高但更耗体力。', services: ['explore-spirit-vein'] },
  { id: 'tea-shed', displayName: '旧茶棚', description: '冬日传闻与散修消息的落脚点。', services: ['tea-rest'] },
  { id: 'herb-plot', displayName: '露根药圃', description: '春日辨草与低阶灵苗的常见去处。', services: [] },
  { id: 'creek-field', displayName: '溪边药田', description: '盛夏药露聚集的田埂。', services: [] },
  { id: 'drying-yard', displayName: '晾晒架旁', description: '秋收药材分拣与晾晒的位置。', services: ['processing'] },
  { id: 'greenhouse', displayName: '暖棚', description: '灵苗过冬的简易暖棚。', services: ['greenhouse-tending'] },
  { id: 'array-shed', displayName: '阵器棚', description: '阵核、符炉与农庄小阵修补处。', services: ['arrays'] },
  { id: 'ore-slope', displayName: '矿石坡', description: '导雷金石与阵材矿砂出没处。', services: [] }
];

export const LOCATION_CATALOG: readonly LocationDef[] = LOCATION_DEFS;

const LOCATION_BY_DISPLAY_NAME: Readonly<Record<string, LocationId>> = {
  农庄: 'farmstead',
  山谷集市: 'valley-market',
  节日会场: 'festival-ground',
  山谷: 'valley-outskirts',
  遗迹门口: 'ruin-gate',
  残脉入口: 'spirit-vein',
  旧茶棚: 'tea-shed',
  露根药圃: 'herb-plot',
  溪边药田: 'creek-field',
  晾晒架旁: 'drying-yard',
  暖棚: 'greenhouse',
  阵器棚: 'array-shed',
  阵坊: 'array-shed',
  矿石坡: 'ore-slope'
};

const PORTFOLIO_HIDDEN_DIRECTORY_LOCATIONS = new Set<LocationId>(['herb-plot', 'creek-field', 'drying-yard', 'array-shed', 'ore-slope']);

function revealedPortfolioLocation(location: LocationDef, serviceStates: ReadonlyArray<{ service: LocationService; availability: LocationServiceAvailability }>, npcs: readonly string[]): boolean {
  if (location.id === 'herb-plot' || location.id === 'creek-field' || location.id === 'drying-yard') return npcs.length > 0;
  return false;
}

function activeFestival(state: GameState): boolean {
  return Boolean(state.activeEvent?.defId?.endsWith('-festival'));
}

function marketRestDay(state: GameState): boolean {
  return state.seasonDay % 7 === 0;
}

function visibleInDirectory(state: GameState, location: LocationDef, serviceStates: ReadonlyArray<{ service: LocationService; availability: LocationServiceAvailability }>, npcs: readonly string[]): boolean {
  if (PORTFOLIO_HIDDEN_DIRECTORY_LOCATIONS.has(location.id)) {
    return revealedPortfolioLocation(location, serviceStates, npcs);
  }
  if (location.id === 'tea-shed' || location.id === 'greenhouse') {
    return serviceStates.some(entry => entry.service !== 'encounter' && entry.availability.open);
  }
  if (location.id === 'festival-ground') return activeFestival(state) || npcs.length > 0;
  if (location.id === 'farmstead') return true;
  return serviceStates.length > 0;
}

function visibleInOnboardingDirectory(state: GameState, locationId: LocationId): boolean | null {
  const objectiveId = getOnboardingObjectiveId(state);
  switch (objectiveId) {
    case 'first-till':
    case 'first-sow':
    case 'first-water':
    case 'first-harvest':
    case 'first-ship':
    case 'first-sleep':
      return locationId === 'farmstead';
    case 'first-market-restock':
      return locationId === 'valley-market' || locationId === 'farmstead';
    case 'first-second-sow':
    case 'first-second-water':
      return locationId === 'farmstead';
    default:
      return null;
  }
}

function locationServiceAvailability(state: GameState, locationId: LocationId, service: LocationService): LocationServiceAvailability {
  const objectiveId = getOnboardingObjectiveId(state);
  if (locationId === 'tea-shed' && service === 'tea-rest' && state.postAscension.mode !== 'stayed-in-world') {
    return { open: false, reason: '留世后开放' };
  }
  if (locationId === 'greenhouse' && service === 'greenhouse-tending' && state.postAscension.mode !== 'stayed-in-world') {
    return { open: false, reason: '留世后开放' };
  }
  if (activeFestival(state) && locationId !== 'festival-ground' && (service === 'shop' || service === 'trade' || service === 'commission-board')) {
    return { open: false, reason: '节日停市' };
  }
  if (locationId === 'valley-market' && marketRestDay(state) && (service === 'shop' || service === 'trade')) {
    if (service === 'shop' && objectiveId === 'first-market-restock') return { open: true, reason: null };
    return { open: false, reason: '集市盘账' };
  }
  return { open: true, reason: null };
}

export function getLocationServiceAvailability(state: GameState, locationId: LocationId, service: LocationService): LocationServiceAvailability {
  return locationServiceAvailability(state, locationId, service);
}

function encounterLines(state: GameState, locationId: LocationId, npcId: string, npcName: string, birthday: boolean): readonly string[] {
  if (activeFestival(state)) {
    return birthday ? [`${npcName}在人群里向你举杯。`, '今日是生辰，也是节日；凡人能记住这一天，便算有心。'] : [`${npcName}站在节日会场边缘。`, '热闹不是灵修独有的东西，山谷里的人也要靠这些日子喘口气。'];
  }
  if (birthday) return [`${npcName}今日少见地停下手中事务。`, '若有合适礼物，今日赠出，情分会记得更深。'];
  if (npcId === 'npc.wandering-cultivator') {
    if (locationId === 'valley-market') return ['游方散修掂着灵石，扫过你背后的药篓。', '山谷集市认货不认根骨；有草、有丹、有妖兽内丹，就能换路。'];
    if (locationId === 'spirit-vein') return ['游方散修蹲在残脉入口，指尖沾着碎石粉。', '灵修嫌这里灵气驳杂，体修倒能拿它磨骨。'];
    if (locationId === 'tea-shed') return ['旧茶棚里，游方散修压低声音讲起宗门传闻。', '高阶体修极少，可一旦成了，连灵修大宗也不敢轻慢。'];
  }
  if (npcId === 'npc.herb-gatherer') {
    if (locationId === 'herb-plot') return ['采药女拨开露根药圃的新芽。', '炼体耗草，比炼丹更狠；别只盯着一季收成。'];
    if (locationId === 'creek-field') return ['溪边药田水汽很重，采药女把药露收入小瓶。', '淬体疼归疼，药性跟不上，疼过以后只剩伤。'];
    if (locationId === 'drying-yard') return ['晾晒架旁草香发苦。', '药材火候、晒候、封候都差一点，入体时便多一分风险。'];
    if (locationId === 'greenhouse') return ['暖棚里，采药女替过冬灵苗拢土。', '慢一点没关系，能活到下一场天劫才最要紧。'];
  }
  if (npcId === 'npc.array-smith') {
    if (locationId === 'array-shed') return ['阵匠老陆把阵核摆成规整的几何。', '你看阵纹像看算式，这悟性若放在灵修宗门，也算异类。'];
    if (locationId === 'ore-slope') return ['矿石坡上，阵匠老陆敲开一块导雷金石。', '体修手短，阵法补场；先让敌人站到你拳头够得到的地方。'];
    if (locationId === 'ruin-gate') return ['遗迹门口的旧阵残纹像断掉的公式。', '前人留下的不是答案，是足够你反推的题面。'];
  }
  return [`${npcName}在此处处理杂务。`, '山谷日子不大，却每日都有去处。'];
}

export function locationIdForDisplayName(name: string): LocationId {
  return LOCATION_BY_DISPLAY_NAME[name] ?? 'valley-outskirts';
}

export function getLocationDirectory(state: GameState): LocationStatus[] {
  const npcNamesByLocation = new Map<LocationId, string[]>();
  for (const schedule of getNpcDailySchedules(state)) {
    const id = locationIdForDisplayName(schedule.location);
    const names = npcNamesByLocation.get(id) ?? [];
    names.push(schedule.npc.displayName);
    npcNamesByLocation.set(id, names);
  }

  const festival = activeFestival(state);
  return LOCATION_DEFS.map(location => {
    const dynamicServices: LocationService[] = [...location.services];
    if (location.id === 'festival-ground' && festival) dynamicServices.push('festival-ritual', 'festival-stall');
    const npcs = npcNamesByLocation.get(location.id) ?? [];
    if (npcs.length > 0) dynamicServices.unshift('encounter');
    const serviceStates = dynamicServices.map(service => ({ service, availability: locationServiceAvailability(state, location.id, service) }));
    return {
      ...location,
      services: dynamicServices,
      active: visibleInDirectory(state, location, serviceStates, npcs),
      npcs,
      serviceLabels: serviceStates.filter(entry => entry.availability.open).map(entry => SERVICE_LABELS[entry.service]),
      closedServiceLabels: serviceStates.filter(entry => !entry.availability.open).map(entry => `${SERVICE_LABELS[entry.service]}休`)
    };
  });
}

export function getLocationEncounters(state: GameState, locationId: LocationId): LocationEncounter[] {
  return getNpcDailySchedules(state)
    .filter(schedule => locationIdForDisplayName(schedule.location) === locationId)
    .map(schedule => ({
      locationId,
      npcId: schedule.npc.id,
      npcName: schedule.npc.displayName,
      title: `${schedule.npc.displayName}：${schedule.activity}`,
      lines: encounterLines(state, locationId, schedule.npc.id, schedule.npc.displayName, schedule.birthday),
      birthday: schedule.birthday
    }));
}

export function getActiveLocationDirectory(state: GameState): LocationStatus[] {
  return getLocationDirectory(state).filter(location => {
    if (!location.active) return false;
    const onboardingVisible = visibleInOnboardingDirectory(state, location.id);
    return onboardingVisible ?? true;
  });
}

export function getLocationServiceOptions(state: GameState, locationId: LocationId): LocationServiceOption[] {
  const location = getLocationDirectory(state).find(entry => entry.id === locationId);
  if (!location || !location.active) return [];
  return location.services
    .filter(service => locationServiceAvailability(state, locationId, service).open)
    .map(service => {
      const command = SERVICE_COMMANDS[service];
      return {
        locationId,
        service,
        label: SERVICE_LABELS[service],
        command: command.command,
        commandLabel: command.commandLabel
      };
    });
}

export function locationServiceIndexFromDigitKey(key: string): number | null {
  if (key === '0') return 9;
  if (key >= '1' && key <= '9') return Number(key) - 1;
  return null;
}

export function locationIndexFromDigitCode(code: string): number | null {
  if (code === 'Digit0') return 9;
  if (/^Digit[1-9]$/.test(code)) return Number(code.slice(-1)) - 1;
  return null;
}

export function getQuickLocationServiceOption(state: GameState, quickId: keyof typeof QUICK_LOCATION_SERVICE_BINDINGS): LocationServiceOption | null {
  if (quickId === 'staying-commission') {
    const locationId = state.postAscension.mode === 'stayed-in-world' ? 'ruin-gate' : 'valley-market';
    const service = 'commission-board';
    const availability = locationServiceAvailability(state, locationId, service);
    if (!availability.open) return null;
    const command = SERVICE_COMMANDS[service];
    return {
      locationId,
      service,
      label: SERVICE_LABELS[service],
      command: command.command,
      commandLabel: command.commandLabel
    };
  }

  const binding = QUICK_LOCATION_SERVICE_BINDINGS[quickId];
  if (!binding) return null;
  return getLocationServiceOptions(state, binding.locationId).find(option => option.service === binding.service) ?? null;
}

export function getPreferredLocationSelection(state: GameState): PreferredLocationSelection | null {
  const objectiveId = getOnboardingObjectiveId(state);
  if (objectiveId === 'first-market-restock') {
    const option = getLocationServiceOptions(state, 'valley-market').find(entry => entry.command === 'browse-shop');
    return option ? { locationId: option.locationId, command: option.command } : null;
  }
  if (objectiveId === 'first-second-sow') {
    const option = getLocationServiceOptions(state, 'farmstead').find(entry => entry.command === 'show-farm-work');
    return option ? { locationId: option.locationId, command: option.command } : null;
  }
  if (objectiveId === 'first-loop-complete') {
    const option = getLocationServiceOptions(state, 'farmstead').find(entry => entry.command === 'show-processing');
    return option ? { locationId: option.locationId, command: option.command } : null;
  }
  return null;
}

export function locationSummary(state: GameState): string[] {
  return getLocationDirectory(state)
    .filter(location => location.active && (location.npcs.length > 0 || location.serviceLabels.length > 0 || location.closedServiceLabels.length > 0))
    .map(location => {
      const labels = [...location.serviceLabels, ...location.closedServiceLabels];
      const services = labels.length > 0 ? labels.join('/') : '无服务';
      const npcs = location.npcs.length > 0 ? `；${location.npcs.join('、')}` : '';
      return `${location.displayName}（${services}${npcs}）`;
    });
}
