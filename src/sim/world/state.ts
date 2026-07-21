/**
 * GameState 聚合根。
 * 单一可变状态树；唯一修改路径 = sim 纯函数（simulateDay / simulateTick）。
 * M1 阶段聚焦种田；furnaces/arrays/lightnings/celestialEvents 在 M2/M3 扩充。
 */
import type { BalanceParams } from '../params';
import { withDefaultBalanceParams } from '../params';
import type { EntityId, GameEvent, Season, Vec2 } from './types';
import { MILLI } from './types';
import type { CropQuality } from '@sim/farm/quality';
import type { Tile } from '../farm/tile';
import type { CropInstance } from '../farm/crop';
import type { Player } from './player';
import { defaultPlayer } from './player';
import { deriveStreams, snapshotStreams, type RngState } from './rng';
import type { ContentRegistry } from '@content/defs';
import type { RelationshipState } from '@sim/social/relationships';
import type { InventorySlot, QualityInventory } from './player';

export interface StorageState {
  inventory: Record<string, InventorySlot>;
  qualityInventory: QualityInventory;
  capacity: number;
}

export type InventoryContainerId = 'player' | 'storage' | 'shipping';
export type InventoryPanelId = InventoryContainerId | 'furnace';
export type InventorySortKey = 'layout' | 'category' | 'name' | 'count';

export interface InventoryViewState {
  activeTab: InventoryPanelId;
  pageByContainer: Partial<Record<InventoryContainerId, number>>;
  searchTerm: string;
  sortKey: InventorySortKey;
}

export interface InventoryLayoutState {
  orders: Partial<Record<InventoryContainerId, string[]>>;
  view: InventoryViewState;
}

export function createDefaultInventoryViewState(): InventoryViewState {
  return {
    activeTab: 'player',
    pageByContainer: {},
    searchTerm: '',
    sortKey: 'layout'
  };
}

export function createDefaultInventoryLayoutState(): InventoryLayoutState {
  return { orders: {}, view: createDefaultInventoryViewState() };
}

export function inventorySlotKey(itemId: string, quality?: CropQuality): string {
  return quality ? `quality:${quality}:${itemId}` : itemId;
}

export function parseInventorySlotKey(key: string): { itemId: string; quality?: CropQuality } | null {
  if (key.startsWith('quality:')) {
    const [, quality, ...rest] = key.split(':');
    const itemId = rest.join(':');
    if (!itemId) return null;
    if (quality === 'mortal' || quality === 'spirit' || quality === 'treasure') return { itemId, quality };
    return null;
  }
  return key.length > 0 ? { itemId: key } : null;
}

export interface InventorySlotSnapshot {
  key: string;
  itemId: string;
  count: number;
  quality?: CropQuality;
}

const INVENTORY_QUALITY_ORDER: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

function compareInventorySlotSnapshot(a: InventorySlotSnapshot, b: InventorySlotSnapshot): number {
  const aQualityRank = a.quality ? INVENTORY_QUALITY_ORDER.indexOf(a.quality) + 1 : 0;
  const bQualityRank = b.quality ? INVENTORY_QUALITY_ORDER.indexOf(b.quality) + 1 : 0;
  if (aQualityRank !== bQualityRank) return aQualityRank - bQualityRank;
  const byItem = a.itemId.localeCompare(b.itemId, 'zh-CN');
  if (byItem !== 0) return byItem;
  return a.key.localeCompare(b.key, 'zh-CN');
}

export function inventorySlotsForContainer(state: GameState, container: InventoryContainerId): InventorySlotSnapshot[] {
  const slots: InventorySlotSnapshot[] = [];

  if (container === 'player') {
    for (const [itemId, entry] of Object.entries(state.player.inventory)) {
      if ((entry?.count ?? 0) > 0) slots.push({ key: itemId, itemId, count: entry.count });
    }
    const qualityInventory = state.player.qualityInventory ?? {};
    for (const quality of INVENTORY_QUALITY_ORDER) {
      const batch = qualityInventory[quality];
      if (!batch) continue;
      for (const [itemId, count] of Object.entries(batch)) {
        if (count > 0) slots.push({ key: inventorySlotKey(itemId, quality), itemId, count, quality });
      }
    }
    return slots.sort(compareInventorySlotSnapshot);
  }

  if (container === 'storage') {
    for (const [itemId, entry] of Object.entries(state.storage.inventory)) {
      if ((entry?.count ?? 0) > 0) slots.push({ key: itemId, itemId, count: entry.count });
    }
    const qualityInventory = state.storage.qualityInventory ?? {};
    for (const quality of INVENTORY_QUALITY_ORDER) {
      const batch = qualityInventory[quality];
      if (!batch) continue;
      for (const [itemId, count] of Object.entries(batch)) {
        if (count > 0) slots.push({ key: inventorySlotKey(itemId, quality), itemId, count, quality });
      }
    }
    return slots.sort(compareInventorySlotSnapshot);
  }

  for (const [itemId, count] of Object.entries(state.shippingBin)) {
    if (count > 0) slots.push({ key: itemId, itemId, count });
  }
  const qualityShipping = state.qualityShippingBin ?? {};
  for (const quality of INVENTORY_QUALITY_ORDER) {
    const batch = qualityShipping[quality];
    if (!batch) continue;
    for (const [itemId, count] of Object.entries(batch)) {
      if (count > 0) slots.push({ key: inventorySlotKey(itemId, quality), itemId, count, quality });
    }
  }
  return slots.sort(compareInventorySlotSnapshot);
}

export function resolveInventoryOrder(baseOrder: readonly string[] | undefined, currentKeys: readonly string[]): string[] {
  const current = new Set(currentKeys);
  const order = (baseOrder ?? []).filter(key => current.has(key));
  const seen = new Set(order);
  for (const key of [...currentKeys].sort((a, b) => a.localeCompare(b, 'zh-CN'))) {
    if (!seen.has(key)) {
      order.push(key);
      seen.add(key);
    }
  }
  return order;
}

export interface ExplorationState {
  deepestRuinLevel: number;
}

export interface SpecialOrderState {
  id: string;
  progress: number;
  daysLeft: number;
  acceptedDay: number;
}

export type FacilityKind = 'drying-rack' | 'sealing-cabinet' | 'talisman-furnace';

export interface FacilityJob {
  inputItemId: string;
  outputItemId: string;
  outputCount: number;
  daysRemaining: number;
}

export interface FacilityInstance {
  id: number;
  kind: FacilityKind;
  tileId: number;
  job: FacilityJob | null;
}

/** 激活中的天象事件。 */
export interface ActiveCelestialEvent {
  defId: string;
  displayName: string;
  daysLeft: number;
  growthMod: number;
  qiMod: number;
  /** 天劫伤害倍率（T8 heaven-eye 等；缺省=1）。仅在 def 定义时拷贝，保持旧档/金回放哈希稳定。 */
  damageMod?: number;
  /** 走火累积倍率（T8 blood-moon 等；缺省=1）。 */
  madnessMod?: number;
  /** 炼丹炸炉容差加成（T8 kindling-flame 等；缺省=0）。 */
  alchemyTolMod?: number;
}

/**
 * 妖兽潮运行态。
 * 因果链：event.qi-tide 活跃 → 灵草疯长成熟 → 触发妖兽潮 → 每日啃食成熟作物 → 退去。
 * 确定性：触发与啃食均走 ctx.rng.beast 流。
 */
export interface BeastSurge {
  beastsRemaining: number; // 本次妖兽潮规模（潮期间恒定，用于每日啃食上限与退去时战利品结算）
  daysLeft: number; // 妖兽潮剩余天数（到 0 强制退去）
}

/** 驯养巡守兽：体修不走传统驭兽宗路数，只把妖兽驯作灵田守卫。 */
export interface GuardBeast {
  id: number;
  vigor: number; // 当前巡守精力；拦截妖兽会消耗，日终恢复
  maxVigor: number;
  bond: number; // 羁绊；投喂照料提升，高羁绊巡守更稳
  specialty: 'field-ward' | 'array-warden' | 'courier' | null; // 成功守田/协防后固化的长期分工
}

export interface GuardBeastPatrolAssignment {
  beastId: number;
  tileId: number;
  assignedDay: number;
}

/** 阵法实例。 */
export interface ArrayInstance {
  id: number;
  defId: string;
  modifier: number; // 权重倍率（放置时从 def 拷贝，避免 targeting 热路径查 content）
  coreTileId: number;
  coverageTileIds: number[];
  power: number; // 耐久（M4 简化：暂不消耗）
  active: boolean;
}

export type TribulationCountdownStatus = 'idle' | 'countdown' | 'due';
export type TribulationCountdownSource = 'active' | 'delay' | 'heaven-debt' | 'dao-attention' | 'lifespan' | null;

/**
 * 主动引劫/天道催讨运行态。
 * 第一版仅实现日级准备窗与到期状态；秒级临战切场后续接入。
 */
export interface TribulationState {
  status: TribulationCountdownStatus;
  source: TribulationCountdownSource;
  daysRemaining: number;
  stage: number;
  readyDays: number; // 已满足引劫条件但仍未引劫的累计天数
  startedDay: number | null;
}

export type TutorialTribulationPhase = 'idle' | 'active' | 'aftermath';
export type TutorialTribulationOutcome = 'survived' | 'rescued' | null;

export interface TutorialTribulationHits {
  direct: number;
  rod: number;
  miss: number;
  blocked: number;
  violet: number;
}

/** 公开试玩三雷教学的最小持久状态；正式天劫状态与数值完全独立。 */
export interface TutorialTribulationState {
  phase: TutorialTribulationPhase;
  boltIndex: number;
  warnedTileId: number | null;
  startingHpMilli: number;
  failureLatched: boolean;
  rawTemperingMilli: number;
  hits: TutorialTribulationHits;
  outcome: TutorialTribulationOutcome;
  finalHpBeforeRescueMilli: number | null;
  rewardMilli: number;
}

export type PostAscensionMode = 'none' | 'choice-pending' | 'ascended-away' | 'stayed-in-world';

export interface PostAscensionState {
  mode: PostAscensionMode;
  ascensionDay: number | null;
  victoryRecorded: boolean;
}

export interface StayingWorldState {
  wardingPressure: number;
  quietHarmony: number;
  neglectedWardingDays: number;
  neglectedQuietDays: number;
  greenhouseClimate: number;
  greenhouseCareStreak: number;
  stableDays: number;
  lastEvaluatedDay: number;
  currentIncidentId: string | null;
  currentIncidentDay: number;
  resolvedIncidentDay: number;
}

/** 场景地面物品：可被玩家走上去拾取（确定性，无 RNG/IO）。 */
export interface GroundItem {
  id: EntityId;
  itemId: string;
  count: number;
  quality?: CropQuality;
  pos: Vec2;
}

export interface GameState {
  readonly version: number;
  masterSeed: number;
  tick: number;
  day: number; // 全局第几日（从 1）
  seasonDay: number; // 当季第几日 1..daysPerSeason
  season: Season;
  year: number;
  width: number;
  height: number;
  tiles: Tile[];
  crops: Map<EntityId, CropInstance>; // key = tileId（每格至多一作物）
  arrays: Map<EntityId, ArrayInstance>; // 阵法实例
  facilities: Map<EntityId, FacilityInstance>; // 农庄设施：晾晒架/封藏柜等可放置加工点
  player: Player;
  events: GameEvent[]; // 本步产出事件（每步开头清空）
  tribulation: TribulationState; // 主动引劫 / 天道催讨准备窗运行态
  tutorialTribulation: TutorialTribulationState; // 公开试玩三雷教学；默认 idle 时不序列化
  postAscension: PostAscensionState; // 飞升达成后的结局分歧：离界或留世
  stayingWorld: StayingWorldState; // 留世后的跨日守境/安居状态
  activeEvent: ActiveCelestialEvent | null; // 激活中的天象事件
  recentCelestialEventIds: string[]; // 最近 3 次天象，用于重复事件权重惩罚
  beastSurge: BeastSurge | null; // 激活中的妖兽潮
  guardBeasts: GuardBeast[]; // 驯养巡守兽：拦截妖兽潮啃食成熟灵草
  guardBeastPatrols: GuardBeastPatrolAssignment[]; // 守田兽哨指派的巡逻地块：改写护田与留世协防优先级
  groundItems: GroundItem[]; // 场景地面物品：走上去按 Space 拾取
  storage: StorageState; // 农庄仓库/箱子：长期材料与品质灵草存放
  inventoryLayout: InventoryLayoutState; // 背包/仓库/出货箱的格子顺序（持久化 UI 布局）
  exploration: ExplorationState; // 外出探索进度：遗迹层数等 Stardew-like 长线目标
  shippingBin: Record<string, number>; // 当日出货箱：itemId → count，日终结算为灵石
  qualityShippingBin: QualityInventory; // 品质出货箱：quality → itemId → count
  social: Record<string, RelationshipState>; // NPC 好感与每日赠礼记录
  specialOrders: Record<string, SpecialOrderState>; // 跨日特别订单：长期收集/交付目标
  flags: Set<string>;
  ending: string | null; // 结局 id（ascension/poison-death/tribulation-death/madness）
  gameOver: boolean; // 游戏结束（达成结局）
  rngSnapshot: Record<string, RngState>; // 各 RNG 流快照（存档/回放）
  nextId: number; // 下一实例 id
}

export interface WorldInit {
  seed: number | string;
  width: number;
  height: number;
  content: ContentRegistry;
  params: BalanceParams;
}

export function createDefaultStayingWorldState(): StayingWorldState {
  return {
    wardingPressure: 18 * MILLI,
    quietHarmony: 62 * MILLI,
    neglectedWardingDays: 0,
    neglectedQuietDays: 0,
    greenhouseClimate: 42 * MILLI,
    greenhouseCareStreak: 0,
    stableDays: 0,
    lastEvaluatedDay: 0,
    currentIncidentId: null,
    currentIncidentDay: 0,
    resolvedIncidentDay: 0
  };
}

export function createDefaultPostAscensionState(): PostAscensionState {
  return {
    mode: 'none',
    ascensionDay: null,
    victoryRecorded: false
  };
}

export function createDefaultTutorialTribulationState(): TutorialTribulationState {
  return {
    phase: 'idle',
    boltIndex: 0,
    warnedTileId: null,
    startingHpMilli: 0,
    failureLatched: false,
    rawTemperingMilli: 0,
    hits: { direct: 0, rod: 0, miss: 0, blocked: 0, violet: 0 },
    outcome: null,
    finalHpBeforeRescueMilli: null,
    rewardMilli: 0
  };
}

/** 取瓦片（越界返回 undefined）。 */
export function tileAt(s: GameState, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return undefined;
  return s.tiles[y * s.width + x];
}

/** 分配下一个实例 id。 */
export function nextEntityId(s: GameState): EntityId {
  return s.nextId++;
}

/**
 * 在指定坐标放置一个地面物品（确定性，无 RNG/IO）。
 * 由未来特性调用（如第一幕遗物落地）；返回新分配的实例 id。
 */
export function placeGroundItem(
  s: GameState,
  opts: { itemId: string; count: number; pos: Vec2; quality?: CropQuality }
): EntityId {
  const id = nextEntityId(s);
  s.groundItems.push({ id, itemId: opts.itemId, count: opts.count, ...(opts.quality ? { quality: opts.quality } : {}), pos: { x: opts.pos.x, y: opts.pos.y } });
  return id;
}

/** 取指定坐标上的首个地面物品（同格多物按放入顺序取第一个）。 */
export function groundItemAtIndex(s: GameState, pos: Vec2): GroundItem | undefined {
  return s.groundItems.find(g => g.pos.x === pos.x && g.pos.y === pos.y);
}

/** 由主种子创建新世界（确定性：同 seed ⇒ 同初始世界）。 */
export function createWorld(o: WorldInit): GameState {
  const params = withDefaultBalanceParams(o.params);
  const rng = deriveStreams(o.seed);
  const masterSeed = typeof o.seed === 'number' ? o.seed >>> 0 : rng.master;
  const tiles: Tile[] = [];
  for (let y = 0; y < o.height; y++) {
    for (let x = 0; x < o.width; x++) {
      // 地形生成：水域/岩石/金属矿散布，种田即布阵的导电性基础
      // 中心 3×3 保留为可种植的凡人居所
      const isCenter = Math.abs(x - Math.floor(o.width / 2)) <= 1 && Math.abs(y - Math.floor(o.height / 2)) <= 1;
      let soilType: Tile['soilType'] = 'loam';
      let blockType: Tile['blockType'] = 'none';
      let fertility = params.growth.baseTillFertility * MILLI;
      if (!isCenter) {
        const r = rng.world.next();
        if (r < 0.08) {
          soilType = 'water';
          blockType = 'water';
          fertility = 0;
        } else if (r < 0.13) {
          soilType = 'rock';
          blockType = 'rock';
          fertility = 0;
        } else if (r < 0.15) {
          soilType = 'metal-ore'; // 金属矿：强引雷、不可种
          blockType = 'rock';
          fertility = 0;
        }
      }
      tiles.push({
        id: y * o.width + x,
        x,
        y,
        soilType,
        fertility,
        qiDensity: 30 * MILLI, // 起始灵气偏低（凡间地≈死地感）
        moisture: 30 * MILLI,
        tilled: false,
        cropId: null,
        wateredToday: false,
        channeledToday: false,
        blockType,
        arrayId: null,
        consecutiveSameCropSeasons: 0,
        lastHarvestedCropDefId: null
      });
    }
  }
  const player = defaultPlayer(params.player.staminaCap * MILLI);
  player.position = { x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) };
  player.lifespanRemainingDays = params.bodyCultivation.lifespanStartDays;
  return {
    version: 1,
    masterSeed,
    tick: 0,
    day: 1,
    seasonDay: 1,
    season: 'spring',
    year: 1,
    width: o.width,
    height: o.height,
    tiles,
    crops: new Map(),
    arrays: new Map(),
    facilities: new Map(),
    player,
    events: [],
    tribulation: { status: 'idle', source: null, daysRemaining: 0, stage: 0, readyDays: 0, startedDay: null },
    tutorialTribulation: createDefaultTutorialTribulationState(),
    postAscension: createDefaultPostAscensionState(),
    stayingWorld: createDefaultStayingWorldState(),
    activeEvent: null,
    recentCelestialEventIds: [],
    beastSurge: null,
    guardBeasts: [],
    guardBeastPatrols: [],
    groundItems: [],
    storage: { inventory: {}, qualityInventory: {}, capacity: 48 },
    inventoryLayout: createDefaultInventoryLayoutState(),
    exploration: { deepestRuinLevel: 0 },
    shippingBin: {},
    qualityShippingBin: {},
    social: {},
    specialOrders: {},
    ending: null,
    gameOver: false,
    flags: new Set(),
    rngSnapshot: snapshotStreams(rng),
    nextId: 1
  };
}

/** 清空本步事件（每步开头调用）。 */
export function clearEvents(s: GameState): void {
  s.events.length = 0;
}

/** 记录事件。 */
export function emit(s: GameState, type: string, payload?: unknown): void {
  s.events.push({ type, tick: s.tick, day: s.day, payload });
}
