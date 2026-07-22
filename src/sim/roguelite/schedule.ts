/**
 * R4-a 雷劫炼体 roguelite —— 种子化劈雷时刻表（= 天道预告源）。
 *
 * 预告即真：落点与紫雷在渡劫开始前就从 rng.lightning 确定性地生成（Slay the Spire intents 哲学——
 * 把 RNG 惩罚变成策略准备）。逐雷结算不再重投落点/紫雷，玩家看到什么就扛什么。
 *
 * tileWeight 镜像 targeting.ts 的乘性公式，去掉 crop/array/activeEvent 依赖，改用本切片的
 * rodPower（引雷草）/ insulated（绝缘垫）两个布阵变量。
 */
import type { BalanceParams } from '@sim/params';
import { SOIL_CONDUCTIVITY } from '@sim/farm/tile';
import type { Rng } from '@sim/world/rng';
import type { Vec2 } from '@sim/world/types';
import {
  BOLT_BASE_SPACING_SEC,
  STAGE_BOLT_COUNT,
  type BoltSpec,
  type CombatField,
  type CombatTile,
  type StrikeSchedule
} from './combatTypes';
import { violetChance } from './formulas';

/** 安全取格。越界返回 undefined。 */
export function tileAt(field: CombatField, x: number, y: number): CombatTile | undefined {
  if (x < 0 || y < 0 || x >= field.width || y >= field.height) return undefined;
  return field.tiles[y * field.width + x];
}

/** 阶段雷数（钳到元组范围）。 */
export function stageBoltCount(stage: number): number {
  const idx = Math.min(Math.max(stage, 0), STAGE_BOLT_COUNT.length - 1);
  return STAGE_BOLT_COUNT[idx] ?? 3;
}

/**
 * 单格乘性权重。镜像 targeting.ts tileWeight：
 *   metal(引雷草) × conductivity(土壤) × arrayMod(绝缘垫) × proximity(玩家邻近) × epicenter(中心) × noise。
 * 注：原型把"引雷草"近似为 metalAttractCoef 一档（正式版按具体灵草 metalAttract 分档）。
 */
export function tileWeight(
  field: CombatField,
  tile: CombatTile,
  playerPos: Vec2,
  params: BalanceParams,
  noise01: number
): number {
  const tp = params.lightning.targeting;
  const metal = 1 + (tile.rodPower > 0 ? tp.metalAttractCoef : 0);
  const conductivity = SOIL_CONDUCTIVITY[tile.soilType] ?? 1;
  const arrayMod = tile.insulated ? tp.arrayInsulate : 1;
  const d = Math.max(Math.abs(tile.x - playerPos.x), Math.abs(tile.y - playerPos.y));
  const prox = 1 + tp.playerProximityCoef / (1 + d);
  const center: Vec2 = { x: field.width / 2, y: field.height / 2 };
  const diag = Math.max(1, Math.hypot(field.width, field.height));
  const epi = 1 + tp.epicenterWeight * (1 - Math.max(Math.abs(tile.x - center.x), Math.abs(tile.y - center.y)) / diag);
  const noise = 1 + (noise01 * 2 - 1) * tp.noise;
  const w = metal * conductivity * arrayMod * prox * epi * noise;
  return w < 0 ? 0 : w;
}

/** 加权抽样落点（消费 rng）。镜像 targeting.ts computeWeights + weightedPick。 */
function pickTarget(field: CombatField, playerPos: Vec2, params: BalanceParams, rng: Rng): CombatTile {
  const tiles = field.tiles;
  const weights = tiles.map(t => tileWeight(field, t, playerPos, params, rng.next()));
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) {
    const fb = tiles[rng.nextInt(tiles.length)];
    return fb ?? tiles[0]!;
  }
  let r = rng.next() * total;
  for (let i = 0; i < tiles.length; i++) {
    r -= weights[i] ?? 0;
    if (r < 0) return tiles[i] ?? tiles[0]!;
  }
  return tiles[tiles.length - 1]!;
}

/**
 * 生成种子化劈雷时刻表（= 天道预告）。确定性：同 field + 同 stage + 同 playerPos + 同 rng ⇒ 同时刻表。
 */
export function generateStrikeSchedule(
  field: CombatField,
  stage: number,
  playerPos: Vec2,
  params: BalanceParams,
  rng: Rng
): StrikeSchedule {
  const count = stageBoltCount(stage);
  const vChance = violetChance(stage, params);
  const bolts: BoltSpec[] = [];
  for (let i = 0; i < count; i++) {
    const target = pickTarget(field, playerPos, params, rng);
    const isViolet = vChance > 0 && rng.chance(vChance);
    const landAfterSec = BOLT_BASE_SPACING_SEC * (i + 1) + rng.floatRange(-0.3, 0.4);
    bolts.push({ index: i, target: { x: target.x, y: target.y }, isViolet, landAfterSec });
  }
  return { stage, bolts };
}
