/**
 * 天雷 Targeting（docs/05 §3 / docs/14 §5）。
 * 乘性权重公式（docs/20 R4）：weight = metalAttract × conductivity × arrayModifier × playerProximity × epicenter × noise。
 * "种田即布防"的数学桥梁：金属性灵草(metalAttract↑)吸雷、绝缘垫层(conductivity 0.1)排雷。
 * 可种子化：noise 由注入 rng 生成，同 state+rng ⇒ 同落点序列。
 */
import type { GameState } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { Tile } from '@sim/farm/tile';
import { SOIL_CONDUCTIVITY } from '@sim/farm/tile';
import type { Rng } from '@sim/world/rng';
import type { Vec2 } from '@sim/world/types';
import { arrayModifierFor } from './arrays';

export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** 纯函数：单格权重（noise01 由外部 rng 预生成，便于属性测试）。 */
export function tileWeight(state: GameState, ctx: SimContext, tile: Tile, noise01: number): number {
  const tp = ctx.params.lightning.targeting;
  // metalAttract：该格作物的金属吸引（金属性灵草=活避雷针）
  let metal = 1;
  if (tile.cropId != null) {
    const crop = state.crops.get(tile.id); // crops Map 以 tile.id 为键
    if (crop) {
      const herb = ctx.content.herbs.get(crop.defId);
      if (herb) metal = 1 + herb.metalAttract;
    }
  }
  const conductivity = SOIL_CONDUCTIVITY[tile.soilType] ?? 1.0;
  const arrayMod = arrayModifierFor(state, tile.id); // 引雷阵/绝缘阵（docs/05 §8）
  const d = chebyshev(tile, state.player.position);
  const prox = 1 + tp.playerProximityCoef / (1 + d);
  const center: Vec2 = { x: state.width / 2, y: state.height / 2 };
  const diag = Math.max(1, Math.hypot(state.width, state.height));
  const epi = 1 + tp.epicenterWeight * (1 - chebyshev(tile, center) / diag);
  const noise = 1 + (noise01 * 2 - 1) * tp.noise;
  const w = metal * conductivity * arrayMod * prox * epi * noise;
  return w < 0 ? 0 : w;
}

/** 可被劈中的格子（docs/05 §3.1）。 */
export function strikeableTiles(state: GameState): Tile[] {
  return state.tiles.filter((t) => t.blockType === 'none');
}

/** 计算所有候选格权重（noise 由 rng 生成）。返回 {tiles, weights}。 */
export function computeWeights(
  state: GameState,
  ctx: SimContext,
  rng: Rng,
): { tiles: Tile[]; weights: number[] } {
  const tiles = strikeableTiles(state);
  const weights = tiles.map((t) => tileWeight(state, ctx, t, rng.next()));
  return { tiles, weights };
}

/** 归一化概率（docs/17 PBT-03：和应为 1）。 */
export function normalize(weights: number[]): number[] {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return weights.map(() => 1 / weights.length);
  return weights.map((w) => w / total);
}

/** 加权抽样（消费 rng 一次）。 */
export function weightedPick(tiles: Tile[], weights: number[], rng: Rng): Tile {
  const probs = normalize(weights);
  let r = rng.next();
  let acc = 0;
  for (let i = 0; i < tiles.length; i++) {
    acc += probs[i] ?? 0;
    if (r < acc) return tiles[i]!;
  }
  return tiles[tiles.length - 1]!;
}

/** 选定落点（computeWeights + weightedPick）。 */
export function pickTarget(state: GameState, ctx: SimContext, rng: Rng): Tile {
  const { tiles, weights } = computeWeights(state, ctx, rng);
  return weightedPick(tiles, weights, rng);
}
