/**
 * R4-a 雷劫炼体 roguelite —— 渡劫战斗切片：类型与常量。
 *
 * 主模式转向（docs/25）的 go/no-go 原型 sim 切片：
 *   备劫（在单块战术灵田布阵）→ 种子化劈雷时刻表（= 天道预告）→ 逐雷承劫 → 存活/死亡。
 *
 * 红线（守 docs/00 C3/C4、CONTRIBUTING）：sim 层纯函数、确定、无 IO；
 * 随机一律走 Rng（@sim/world/rng 的 deriveStreams），禁止 Math.random / Date.now / performance.now。
 * 半实时手感（走位/擦弹时机）由 app 层 rAF 驱动，本层只产出"种子化有序时刻表 + 逐雷纯结算"。
 *
 * 本切片不碰 GameState / SimContext / 金标准回放；整合进正式 resolveDueTribulation 是 R4-b 的事。
 */
import type { SoilType, Vec2 } from '@sim/world/types';

/** 战斗田尺寸（原型：单屏一棋盘）。 */
export const COMBAT_FIELD_WIDTH = 7;
export const COMBAT_FIELD_HEIGHT = 5;

/** 各阶段雷数（镜像 standardTribulationBoltCount：stage0/1=3 … stage5/6=8）。元组类型便于安全索引。 */
export const STAGE_BOLT_COUNT: readonly [number, number, number, number, number, number, number] = [3, 4, 5, 6, 7, 8, 8];

/** 每雷之间的逻辑间隔基准（秒），供 app 层 rAF 排程播放；种子化抖动见 schedule.ts。 */
export const BOLT_BASE_SPACING_SEC = 2.2;

/** 引雷草初始"引雷针"蓄能（毫点；被雷命中后递减，镜像 rod array power）。 */
export const ROD_INITIAL_POWER = 30;
/** 引雷草每被命中一次消耗的蓄能。 */
export const ROD_POWER_LOSS_PER_HIT = 10;

/** 铁骨丹减伤（正式值在 pillSystem 内容表；原型取 0.25）。 */
export const IRONBONE_MITIGATION = 0.25;
/** 淬体丹淬体倍率（正式值在内容表；原型取 1.5）。 */
export const TEMPER_BOOST_MULT = 1.5;

export type CombatStatus = 'prep' | 'resolving' | 'survived' | 'dead';

/**
 * 战斗格：种田即布阵的最小单元。
 * rodPower>0 = 金属性灵草作引雷针（吸雷）；insulated = 绝缘垫（排雷）。
 * soilType 提供基础导电性（wet-loam 强导电 / dry-sand 弱 / metal-ore 强引雷）。
 */
export interface CombatTile {
  readonly x: number;
  readonly y: number;
  soilType: SoilType;
  rodPower: number;
  insulated: boolean;
}

export interface CombatField {
  readonly width: number;
  readonly height: number;
  tiles: CombatTile[]; // length = width*height，索引 = y*width+x
}

/** 单道劈雷的种子化规格（= 天道预告内容：落点 + 是否紫雷 + 落下逻辑时刻）。 */
export interface BoltSpec {
  readonly index: number;
  readonly target: Vec2;
  readonly isViolet: boolean;
  readonly landAfterSec: number;
}

export interface StrikeSchedule {
  readonly stage: number;
  readonly bolts: readonly BoltSpec[];
}

export interface CombatHits {
  direct: number;
  rod: number;
  miss: number;
  blocked: number;
  violet: number;
}

/** 渡劫战斗状态（sim 层可变，镜像 GameState 的可变 sim 惯例：原位修改，避免深拷贝）。 */
export interface CombatState {
  readonly seed: number;
  readonly stage: number;
  field: CombatField;
  schedule: StrikeSchedule;
  status: CombatStatus;
  bodyPos: Vec2;
  hpMilli: number;
  maxHpMilli: number;
  wardMitigation: number;
  ironBoneMitigation: number;
  temperBoostMult: number;
  pillsWard: number;
  pillsIronBone: number;
  pillsTemper: number;
  boltIndex: number;
  rawTemperingMilli: number;
  hits: CombatHits;
  result: CombatResult | null;
}

export interface CombatResult {
  readonly survived: boolean;
  readonly finalHpMilli: number;
  readonly temperingGainMilli: number;
  readonly boltsResolved: number;
}

export type CombatPill = 'ward' | 'ironbone' | 'temper';

export type CombatAction =
  | { kind: 'place-rod'; x: number; y: number }
  | { kind: 'place-insulator'; x: number; y: number }
  | { kind: 'clear-tile'; x: number; y: number }
  | { kind: 'consume-pill'; pill: CombatPill }
  | { kind: 'begin-tribulation' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'resolve-bolt'; perfectBlock: boolean };

export interface CombatActionOutcome {
  readonly ok: boolean;
  readonly reason?: string;
}
