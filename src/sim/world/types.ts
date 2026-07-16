/**
  * sim 层共享类型（无 IO、无渲染依赖）。
  * 字段用毫点（milli-point）整数以保证确定性。
 */

/** 药性向量（四轴内部真源）。各分量毫点 0..10000。玩家面投影为寒热轴 = hot−cold。 */
export interface PropertyVector {
 cold: number;
 hot: number;
 warm: number;
 neutral: number;
}

/** 土壤类型。conductivity 见 farm/tile.ts 的导电性表。 */
export type SoilType =
 | 'loam' // 普通农田（基准导电 1.0）
 | 'wet-loam' // 湿润泥土（1.8 强导电）
 | 'dry-sand' // 干燥沙土（0.5 弱导电）
 | 'scorched' // 焦土（1.2，需翻新）
 | 'insulated' // 绝缘垫层（0.1，玩家铺设）
 | 'spirit-loam' // 灵壤（高肥）
 | 'metal-ore' // 金属矿露头（1.5 强引雷，不可种）
 | 'rock' // 岩石（0.3，不可种）
 | 'water'; // 水域（1.8 强导电）

/** 季节 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

/** 作物阶段 */
export type CropStage = 'seed' | 'sprout' | 'growing' | 'mature' | 'withered';

/** 方向 */
export type Direction = 'up' | 'down' | 'left' | 'right';

/** 整数坐标 */
export interface Vec2 {
 x: number;
 y: number;
}

/** 实例 ID（自增整数）。Def ID 用字符串（见 content）。 */
export type EntityId = number;

/** 修炼阶段 */
export type CultivationStage = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 毫点工具：1.0 = 1000。用于 HP/丹毒/灵气/药性等确定性数值。 */
export const MILLI = 1000;
export const fpToMilli = (v: number): number => Math.round(v * MILLI);
export const milliToFp = (v: number): number => v / MILLI;
export const clampMilli = (v: number, min = 0, max = 100 * MILLI): number =>
 v < min ? min : v > max ? max : v;

/** 通用事件基类（sim 产出 → render 订阅驱动动画）。 */
export interface GameEvent {
 readonly type: string;
 readonly tick: number;
 readonly day: number;
 readonly payload?: unknown;
}

/** 季节顺序工具 */
const SEASON_ORDER: readonly Season[] = ['spring', 'summer', 'autumn', 'winter'];
export function nextSeason(s: Season): Season {
 return SEASON_ORDER[(SEASON_ORDER.indexOf(s) + 1) % SEASON_ORDER.length]!;
}
export function seasonIndex(s: Season): number {
 return SEASON_ORDER.indexOf(s);
}
