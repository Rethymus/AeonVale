/**
 * GameState 聚合根（docs/11 §1.14）。
 * 单一可变状态树；唯一修改路径 = sim 纯函数（simulateDay / simulateTick）。
 * M1 阶段聚焦种田；furnaces/arrays/lightnings/celestialEvents 在 M2/M3 扩充。
 */
import type { BalanceParams } from '../params';
import type { EntityId, GameEvent, Season } from './types';
import { MILLI } from './types';
import type { Tile } from '../farm/tile';
import type { CropInstance } from '../farm/crop';
import type { Player } from './player';
import { defaultPlayer } from './player';
import { deriveStreams, snapshotStreams, type RngState } from './rng';
import type { ContentRegistry } from '@content/defs';

/** 激活中的天象事件（docs/07 / docs/11 §1.13 CelestialEvent 运行态，简化）。 */
export interface ActiveCelestialEvent {
  defId: string;
  displayName: string;
  daysLeft: number;
  growthMod: number;
  qiMod: number;
}

/** 阵法实例（docs/05 §8 / docs/11 §1.12 Array）。 */
export interface ArrayInstance {
  id: number;
  defId: string;
  modifier: number; // 权重倍率（放置时从 def 拷贝，避免 targeting 热路径查 content）
  coreTileId: number;
  coverageTileIds: number[];
  power: number; // 耐久（M4 简化：暂不消耗）
  active: boolean;
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
  player: Player;
  events: GameEvent[]; // 本步产出事件（每步开头清空）
  activeEvent: ActiveCelestialEvent | null; // 激活中的天象事件
  flags: Set<string>;
  ending: string | null; // 结局 id（ascension/poison-death/tribulation-death/madness，docs/02）
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

/** 取瓦片（越界返回 undefined）。 */
export function tileAt(s: GameState, x: number, y: number): Tile | undefined {
  if (x < 0 || y < 0 || x >= s.width || y >= s.height) return undefined;
  return s.tiles[y * s.width + x];
}

/** 分配下一个实例 id。 */
export function nextEntityId(s: GameState): EntityId {
  return s.nextId++;
}

/** 由主种子创建新世界（确定性：同 seed ⇒ 同初始世界）。 */
export function createWorld(o: WorldInit): GameState {
  const rng = deriveStreams(o.seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < o.height; y++) {
    for (let x = 0; x < o.width; x++) {
      tiles.push({
        id: y * o.width + x,
        x,
        y,
        soilType: 'loam',
        fertility: o.params.growth.baseTillFertility * MILLI,
        qiDensity: 30 * MILLI, // 起始灵气偏低（凡间地≈死地感，docs/14 §2）
        moisture: 30 * MILLI,
        tilled: false,
        cropId: null,
        wateredToday: false,
        channeledToday: false,
        blockType: 'none',
        arrayId: null,
        consecutiveSameCropSeasons: 0,
      });
    }
  }
  const player = defaultPlayer(o.params.player.staminaCap * MILLI);
  player.position = { x: Math.floor(o.width / 2), y: Math.floor(o.height / 2) };
  return {
    version: 1,
    masterSeed: rng.master,
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
    player,
    events: [],
    activeEvent: null,
    ending: null,
    gameOver: false,
    flags: new Set(),
    rngSnapshot: snapshotStreams(rng),
    nextId: 1,
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
