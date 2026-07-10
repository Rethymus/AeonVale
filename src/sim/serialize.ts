/**
 * 确定性序列化与存档（docs/11 §3 / §5 / docs/10 §6.5）。
 *
 * - canonicalSerialize：递归排序 key + 浮点四舍五入，保证 JSON 哈希稳定（JS 对象 key 顺序不保证）。
 * - serializeState / deserializeState：GameState ↔ 纯 JSON（Map→有序数组，Set→有序数组）。
 * - stateHash：用于 Golden Replay 回归比对（docs/17 §7）。
 * - saveGame / loadSave：原子存档包装（含版本号 / schemaHash）。
 */
import type { GameState } from './world/state';
import { MILLI } from './world/types';

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
    return `{${keys.map((k) => `"${k}":${canonicalSerialize(o[k])}`).join(',')}}`;
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
  return {
    version: state.version,
    masterSeed: state.masterSeed,
    tick: state.tick,
    day: state.day,
    seasonDay: state.seasonDay,
    season: state.season,
    year: state.year,
    width: state.width,
    height: state.height,
    tiles: state.tiles,
    crops: [...state.crops.entries()],
    arrays: [...state.arrays.entries()],
    player: { ...p, inventory: p.inventory, flags: [...p.flags].sort() },
    activeEvent: state.activeEvent,
    flags: [...state.flags].sort(),
    rngSnapshot: state.rngSnapshot,
    nextId: state.nextId,
    // 丢弃 events（每步瞬态）
  };
}

/** 从纯 JSON 重建 GameState。 */
export function deserializeState(raw: unknown): GameState {
  const o = raw as Record<string, unknown>;
  const playerRaw = o.player as Record<string, unknown>;
  const crops = new Map<number, unknown>();
  for (const [k, v] of (o.crops as [string, unknown][])) {
    crops.set(Number(k), v);
  }
  const arrays = new Map<number, unknown>();
  for (const [k, v] of (o.arrays as [string, unknown][])) {
    arrays.set(Number(k), v);
  }
  const player = {
    ...playerRaw,
    flags: new Set(playerRaw.flags as string[]),
  } as GameState['player'];
  return {
    version: o.version as number,
    masterSeed: o.masterSeed as number,
    tick: o.tick as number,
    day: o.day as number,
    seasonDay: o.seasonDay as number,
    season: o.season as GameState['season'],
    year: o.year as number,
    width: o.width as number,
    height: o.height as number,
    tiles: o.tiles as GameState['tiles'],
    crops: crops as GameState['crops'],
    arrays: arrays as GameState['arrays'],
    player,
    events: [],
    activeEvent: (o.activeEvent ?? null) as GameState['activeEvent'],
    flags: new Set(o.flags as string[]),
    rngSnapshot: o.rngSnapshot as GameState['rngSnapshot'],
    nextId: o.nextId as number,
  };
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
    state: serializeState(state),
  };
}

/** 存档往返等价检查（结构相等，用于 PBT-06 / INT-06，docs/17）。 */
export function roundTripEqual(state: GameState): boolean {
  const hashBefore = stateHash(state);
  const restored = deserializeState(serializeState(state));
  const hashAfter = stateHash(restored);
  return hashBefore === hashAfter;
}

void MILLI; // 保留导入（毫点常量供未来扩展使用）
