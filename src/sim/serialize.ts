/**
 * 确定性序列化与存档。
 *
 * - canonicalSerialize：递归排序 key + 浮点四舍五入，保证 JSON 哈希稳定（JS 对象 key 顺序不保证）。
 * - serializeState / deserializeState：GameState ↔ 纯 JSON（Map→有序数组，Set→有序数组）。
 * - stateHash：用于 Golden Replay 回归比对。
 * - saveGame / loadSave()：原子存档包装（含版本号 / schemaHash）。
 */
import type { GameState, InventoryContainerId, InventoryLayoutState, InventoryPanelId, InventorySortKey, InventoryViewState } from './world/state';
import { MILLI } from './world/types';
import { DEFAULT_BALANCE } from './params';
import { normalizeBodyCultivation } from './progression/bodyCultivation';
import { createDefaultInventoryLayoutState, createDefaultInventoryViewState, createDefaultPostAscensionState, createDefaultStayingWorldState, createDefaultTutorialTribulationState, inventorySlotsForContainer, resolveInventoryOrder } from './world/state';

const INVENTORY_CONTAINERS: readonly InventoryContainerId[] = ['player', 'storage', 'shipping'];
const INVENTORY_PANELS: readonly InventoryPanelId[] = ['player', 'storage', 'shipping', 'furnace'];
const INVENTORY_SORT_KEYS: readonly InventorySortKey[] = ['layout', 'category', 'name', 'count'];

function shouldSerializeStayingWorld(state: GameState): boolean {
  if (state.postAscension.mode === 'stayed-in-world') return true;
  const defaults = createDefaultStayingWorldState();
  const current = state.stayingWorld;
  return current.wardingPressure !== defaults.wardingPressure || current.quietHarmony !== defaults.quietHarmony || current.neglectedWardingDays !== defaults.neglectedWardingDays || current.neglectedQuietDays !== defaults.neglectedQuietDays || current.greenhouseClimate !== defaults.greenhouseClimate || current.greenhouseCareStreak !== defaults.greenhouseCareStreak || current.stableDays !== defaults.stableDays || current.lastEvaluatedDay !== defaults.lastEvaluatedDay || current.currentIncidentId !== defaults.currentIncidentId || current.currentIncidentDay !== defaults.currentIncidentDay || current.resolvedIncidentDay !== defaults.resolvedIncidentDay;
}

function shouldSerializeTutorialTribulation(state: GameState): boolean {
  return state.tutorialTribulation != null && state.tutorialTribulation.phase !== 'idle';
}

function normalizeTiles(state: GameState): GameState['tiles'] {
  return state.tiles.map(tile => ({
    ...tile,
    consecutiveSameCropSeasons: Math.max(0, Math.floor(tile.consecutiveSameCropSeasons ?? 0)),
    lastHarvestedCropDefId: typeof tile.lastHarvestedCropDefId === 'string' ? tile.lastHarvestedCropDefId : null
  }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasFiniteNumbers(record: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.every(field => typeof record[field] === 'number' && Number.isFinite(record[field]));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string');
}

function isInventoryRecord(value: unknown): value is Record<string, { itemId: string; count: number; durability?: number }> {
  if (!isRecord(value)) return false;
  return Object.values(value).every(slot => {
    if (!isRecord(slot) || typeof slot.itemId !== 'string' || typeof slot.count !== 'number' || !Number.isFinite(slot.count)) return false;
    return slot.durability === undefined || (typeof slot.durability === 'number' && Number.isFinite(slot.durability));
  });
}

function isInventoryLayoutRecord(value: unknown): value is InventoryLayoutState {
  if (!isRecord(value)) return false;
  const orders = value.orders;
  if (orders !== undefined) {
    if (!isRecord(orders)) return false;
    if (!Object.entries(orders).every(([key, order]) => INVENTORY_CONTAINERS.includes(key as InventoryContainerId) && isStringArray(order))) return false;
  }
  const view = value.view;
  if (view === undefined) return true;
  if (!isRecord(view)) return false;
  if (view.activeTab !== undefined && !INVENTORY_PANELS.includes(view.activeTab as InventoryPanelId)) return false;
  if (view.searchTerm !== undefined && typeof view.searchTerm !== 'string') return false;
  if (view.sortKey !== undefined && !INVENTORY_SORT_KEYS.includes(view.sortKey as InventorySortKey)) return false;
  if (view.pageByContainer !== undefined) {
    if (!isRecord(view.pageByContainer)) return false;
    if (
      !Object.entries(view.pageByContainer).every(
        ([key, page]) => INVENTORY_CONTAINERS.includes(key as InventoryContainerId) && typeof page === 'number' && Number.isFinite(page)
      )
    ) {
      return false;
    }
  }
  return true;
}

function isSerializedEntryList(value: unknown): value is [string | number, unknown][] {
  return (
    Array.isArray(value) &&
    value.every(entry => {
      if (!Array.isArray(entry) || entry.length !== 2) return false;
      const key = entry[0];
      return (typeof key === 'number' && Number.isFinite(key)) || (typeof key === 'string' && key.trim() !== '' && Number.isFinite(Number(key)));
    })
  );
}

function assertSerializedStateShape(raw: unknown): asserts raw is Record<string, unknown> {
  if (!isRecord(raw)) throw new TypeError('Invalid saved state root');
  if (!hasFiniteNumbers(raw, ['version', 'masterSeed', 'tick', 'day', 'seasonDay', 'year', 'width', 'height', 'nextId'])) {
    throw new TypeError('Invalid saved state counters');
  }
  if (!['spring', 'summer', 'autumn', 'winter'].includes(String(raw.season))) throw new TypeError('Invalid saved state season');
  if (!Array.isArray(raw.tiles) || raw.tiles.length !== Number(raw.width) * Number(raw.height) || !raw.tiles.every(isRecord)) {
    throw new TypeError('Invalid saved state tiles');
  }
  if (!isSerializedEntryList(raw.crops) || !isSerializedEntryList(raw.arrays)) throw new TypeError('Invalid saved state entity maps');
  if (raw.facilities !== undefined && !isSerializedEntryList(raw.facilities)) throw new TypeError('Invalid saved state facilities');

  const player = raw.player;
  if (!isRecord(player) || !hasFiniteNumbers(player, ['hp', 'maxHp', 'pillPoison', 'cultivation', 'stage', 'stamina', 'inventoryCapacity'])) {
    throw new TypeError('Invalid saved player state');
  }
  if (!isRecord(player.position) || !hasFiniteNumbers(player.position, ['x', 'y'])) throw new TypeError('Invalid saved player position');
  if (!['up', 'down', 'left', 'right'].includes(String(player.facing))) throw new TypeError('Invalid saved player facing');
  if (!isInventoryRecord(player.inventory) || !isStringArray(player.flags)) throw new TypeError('Invalid saved player inventory');
  if (raw.inventoryLayout !== undefined && !isInventoryLayoutRecord(raw.inventoryLayout)) throw new TypeError('Invalid saved inventory layout');
  if (!isStringArray(raw.flags) || !isRecord(raw.rngSnapshot) || !Object.values(raw.rngSnapshot).every(value => typeof value === 'number' && Number.isFinite(value))) {
    throw new TypeError('Invalid saved state metadata');
  }
}

/** 递归规范序列化：key 字典序、数组保序、number 取整到 6 位小数。 */
export function canonicalSerialize(obj: unknown): string {
  if (Array.isArray(obj)) {
    return `[${obj.map(canonicalSerialize).join(',')}]`;
  }
  if (obj && typeof obj === 'object') {
    if (obj instanceof Map) {
      const entries = [...obj.entries()].sort((a, b) => cmp(a[0], b[0]));
      return `{|${entries.map(([k, v]) => `${JSON.stringify(String(k))}:${canonicalSerialize(v)}`).join(',')}|}`;
    }
    if (obj instanceof Set) {
      const arr = [...obj].sort((a, b) => cmp(a, b));
      return canonicalSerialize(arr);
    }
    const o = obj as Record<string, unknown>;
    const keys = Object.keys(o).sort();
    return `{${keys.map(k => `"${k}":${canonicalSerialize(o[k])}`).join(',')}}`;
  }
  if (typeof obj === 'number') {
    return String(Math.round(obj * 1e6) / 1e6);
  }
  return JSON.stringify(obj);
}

function cmp(a: unknown, b: unknown): number {
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function inventoryLayoutSnapshot(state: GameState): InventoryLayoutState {
  const orders: InventoryLayoutState['orders'] = {};
  for (const container of INVENTORY_CONTAINERS) {
    const baseOrder = state.inventoryLayout?.orders?.[container];
    if (!baseOrder || baseOrder.length === 0) continue;
    const keys = inventorySlotsForContainer(state, container).map(slot => slot.key);
    const order = resolveInventoryOrder(baseOrder, keys);
    if (order.length > 0) orders[container] = order;
  }
  return { orders, view: inventoryViewSnapshot(state.inventoryLayout?.view) };
}

function inventoryViewSnapshot(view: InventoryViewState | undefined): InventoryViewState {
  const defaults = createDefaultInventoryViewState();
  const pageByContainer: InventoryViewState['pageByContainer'] = {};
  for (const container of INVENTORY_CONTAINERS) {
    const page = view?.pageByContainer?.[container];
    if (typeof page === 'number' && Number.isFinite(page) && page > 0) pageByContainer[container] = Math.floor(page);
  }
  const activeTab = view?.activeTab && INVENTORY_PANELS.includes(view.activeTab) ? view.activeTab : defaults.activeTab;
  const sortKey = view?.sortKey && INVENTORY_SORT_KEYS.includes(view.sortKey) ? view.sortKey : defaults.sortKey;
  const searchTerm = typeof view?.searchTerm === 'string' ? view.searchTerm.slice(0, 80) : defaults.searchTerm;
  return { activeTab, pageByContainer, searchTerm, sortKey };
}

function shouldSerializeInventoryView(view: InventoryViewState): boolean {
  const defaults = createDefaultInventoryViewState();
  return (
    view.activeTab !== defaults.activeTab ||
    view.sortKey !== defaults.sortKey ||
    view.searchTerm.trim().length > 0 ||
    Object.values(view.pageByContainer).some(page => typeof page === 'number' && Number.isFinite(page) && page > 0)
  );
}

function shouldSerializeInventoryLayout(layout: InventoryLayoutState): boolean {
  return Object.values(layout.orders).some(order => Array.isArray(order) && order.length > 0) || shouldSerializeInventoryView(layout.view);
}

function deserializeInventoryLayout(raw: unknown): InventoryLayoutState {
  const fallback = createDefaultInventoryLayoutState();
  if (!isInventoryLayoutRecord(raw)) return fallback;
  const ordersRaw = isRecord(raw.orders) ? raw.orders : {};
  const orders: InventoryLayoutState['orders'] = {};
  for (const container of INVENTORY_CONTAINERS) {
    const order = ordersRaw[container];
    if (isStringArray(order) && order.length > 0) orders[container] = [...order];
  }
  return { orders, view: inventoryViewSnapshot(isRecord(raw.view) ? (raw.view as Partial<InventoryViewState> as InventoryViewState) : undefined) };
}

/** FNV-1a 哈希字符串 → hex（非加密，仅用于等价比较）。 */
export function stateHash(state: GameState): string {
  const s = canonicalSerialize(serializeState(state));
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

/** 把 GameState 转为纯 JSON 结构（Map→entries，Set→array）。 */
export function serializeState(state: GameState): unknown {
  const p = state.player;
  const inventoryLayout = inventoryLayoutSnapshot(state);
  const postAscension = state.postAscension.victoryRecorded
    ? state.postAscension
    : {
        mode: state.postAscension.mode,
        ascensionDay: state.postAscension.ascensionDay
      };
  const serialized: Record<string, unknown> = {
    version: state.version,
    masterSeed: state.masterSeed,
    tick: state.tick,
    day: state.day,
    seasonDay: state.seasonDay,
    season: state.season,
    year: state.year,
    width: state.width,
    height: state.height,
    tiles: normalizeTiles(state),
    crops: [...state.crops.entries()],
    arrays: [...state.arrays.entries()],
    facilities: [...state.facilities.entries()],
    player: { ...p, inventory: p.inventory, flags: [...p.flags].sort() },
    tribulation: state.tribulation,
    postAscension,
    activeEvent: state.activeEvent,
    recentCelestialEventIds: state.recentCelestialEventIds.filter((id): id is string => typeof id === 'string').slice(-3),
    beastSurge: state.beastSurge,
    guardBeasts: state.guardBeasts,
    storage: state.storage,
    exploration: state.exploration,
    shippingBin: state.shippingBin,
    qualityShippingBin: state.qualityShippingBin,
    ending: state.ending,
    gameOver: state.gameOver,
    specialOrders: state.specialOrders,
    flags: [...state.flags].sort(),
    rngSnapshot: state.rngSnapshot,
    nextId: state.nextId
    // 丢弃 events（每步瞬态）
  };
  if (state.guardBeastPatrols.length > 0) serialized.guardBeastPatrols = state.guardBeastPatrols;
  // 仅在非空时序列化：保持空世界的 stateHash 与旧档逐字节一致（golden replay 稳定）
  if (state.groundItems.length > 0) serialized.groundItems = state.groundItems;
  if (shouldSerializeInventoryLayout(inventoryLayout)) serialized.inventoryLayout = inventoryLayout;
  if (shouldSerializeStayingWorld(state)) serialized.stayingWorld = state.stayingWorld;
  if (shouldSerializeTutorialTribulation(state)) serialized.tutorialTribulation = state.tutorialTribulation;
  if (Object.keys(state.social ?? {}).length > 0) serialized.social = state.social;
  return serialized;
}

/** 从纯 JSON 重建 GameState。 */
export function deserializeState(raw: unknown): GameState {
  assertSerializedStateShape(raw);
  const o = raw;
  const playerRaw = o.player as Record<string, unknown>;
  const crops = new Map<number, unknown>();
  for (const [k, v] of o.crops as [string, unknown][]) {
    crops.set(Number(k), v);
  }
  const arrays = new Map<number, unknown>();
  for (const [k, v] of o.arrays as [string, unknown][]) {
    arrays.set(Number(k), v);
  }
  const facilities = new Map<number, unknown>();
  for (const [k, v] of (o.facilities as [string, unknown][] | undefined) ?? []) {
    const facility = v as Record<string, unknown>;
    facilities.set(Number(k), { ...facility, job: facility.job ?? null });
  }
  const player = {
    ...playerRaw,
    qualityInventory: { ...((playerRaw.qualityInventory as GameState['player']['qualityInventory'] | undefined) ?? {}) },
    flags: new Set(playerRaw.flags as string[])
  } as GameState['player'];
  const recentHistory = Array.isArray(o.recentCelestialEventIds) ? o.recentCelestialEventIds.filter((id): id is string => typeof id === 'string').slice(-3) : [];
  const stayingWorld = {
    ...createDefaultStayingWorldState(),
    ...((o.stayingWorld as GameState['stayingWorld'] | undefined) ?? {})
  } as GameState['stayingWorld'];
  const tutorialDefaults = createDefaultTutorialTribulationState();
  const tutorialRaw = (o.tutorialTribulation as Partial<GameState['tutorialTribulation']> | undefined) ?? {};
  const tutorialTribulation = {
    ...tutorialDefaults,
    ...tutorialRaw,
    hits: {
      ...tutorialDefaults.hits,
      ...(tutorialRaw.hits ?? {})
    }
  } as GameState['tutorialTribulation'];
  const state = {
    version: o.version as number,
    masterSeed: o.masterSeed as number,
    tick: o.tick as number,
    day: o.day as number,
    seasonDay: o.seasonDay as number,
    season: o.season as GameState['season'],
    year: o.year as number,
    width: o.width as number,
    height: o.height as number,
    tiles: ((o.tiles as GameState['tiles']) ?? []).map(tile => ({
      ...tile,
      consecutiveSameCropSeasons: Math.max(0, Math.floor(tile.consecutiveSameCropSeasons ?? 0)),
      lastHarvestedCropDefId: typeof tile.lastHarvestedCropDefId === 'string' ? tile.lastHarvestedCropDefId : null
    })),
    crops: crops as GameState['crops'],
    arrays: arrays as GameState['arrays'],
    facilities: facilities as GameState['facilities'],
    player,
    events: [],
    tribulation: (o.tribulation ?? {
      status: 'idle',
      source: null,
      daysRemaining: 0,
      stage: 0,
      readyDays: 0,
      startedDay: null
    }) as GameState['tribulation'],
    tutorialTribulation,
    postAscension: {
      ...createDefaultPostAscensionState(),
      ...((o.postAscension as GameState['postAscension'] | undefined) ?? {})
    } as GameState['postAscension'],
    stayingWorld,
    activeEvent: (o.activeEvent ?? null) as GameState['activeEvent'],
    recentCelestialEventIds: recentHistory,
    beastSurge: (o.beastSurge ?? null) as GameState['beastSurge'],
    guardBeasts: [...((o.guardBeasts as GameState['guardBeasts'] | undefined) ?? [])].map(beast => ({
      ...beast,
      bond: beast.bond ?? 0,
      specialty: beast.specialty ?? null
    })),
    guardBeastPatrols: [...((o.guardBeastPatrols as GameState['guardBeastPatrols'] | undefined) ?? [])],
    groundItems: [...((o.groundItems as GameState['groundItems'] | undefined) ?? [])],
    inventoryLayout: deserializeInventoryLayout(o.inventoryLayout),
    storage: {
      inventory: { ...((o.storage as GameState['storage'] | undefined)?.inventory ?? {}) },
      qualityInventory: { ...((o.storage as GameState['storage'] | undefined)?.qualityInventory ?? {}) },
      capacity: (o.storage as GameState['storage'] | undefined)?.capacity ?? 48
    },
    exploration: { deepestRuinLevel: Math.max(0, Math.floor((o.exploration as GameState['exploration'] | undefined)?.deepestRuinLevel ?? 0)) },
    shippingBin: { ...((o.shippingBin as Record<string, number> | undefined) ?? {}) },
    qualityShippingBin: { ...((o.qualityShippingBin as GameState['qualityShippingBin'] | undefined) ?? {}) },
    social: { ...((o.social as GameState['social'] | undefined) ?? {}) },
    specialOrders: { ...((o.specialOrders as GameState['specialOrders'] | undefined) ?? {}) },
    ending: (o.ending ?? null) as GameState['ending'],
    gameOver: Boolean(o.gameOver),
    flags: new Set(o.flags as string[]),
    rngSnapshot: o.rngSnapshot as GameState['rngSnapshot'],
    nextId: o.nextId as number
  };
  normalizeBodyCultivation(state, DEFAULT_BALANCE);
  return state;
}

export interface SaveGame {
  formatVersion: number;
  gameVersion: string;
  schemaHash: string;
  createdAt: number;
  state: unknown;
}

export function saveGame(state: GameState, schemaHash: string): SaveGame {
  return {
    formatVersion: 1,
    gameVersion: '0.1.0',
    schemaHash,
    createdAt: 0, // 由 io 层填实际时间（不进 sim，保确定性）
    state: serializeState(state)
  };
}

/** 存档往返等价检查（结构相等，用于 PBT-06 / INT-06）。 */
export function roundTripEqual(state: GameState): boolean {
  const hashBefore = stateHash(state);
  const restored = deserializeState(serializeState(state));
  const hashAfter = stateHash(restored);
  return hashBefore === hashAfter;
}

void MILLI; // 保留导入（毫点常量供未来扩展使用）
