/**
 * 种田系统：灵气驱动的生长 + 土壤 + 季节（docs/08 / docs/14 §2/§4）。
 * 全部为纯函数或对 state 的确定性变更；无 IO、无渲染、无 Math.random。
 *
 * 核心公式（docs/14 §4）：
 *   growthPerDay = baseGrowth × qiFactor × soilFactor × seasonFactor × celestialFactor × careFactor
 * 灵气模型（docs/14 §2）：Q(t+1) = Q + regen − herbDrain − decay，构成"灵气足→长得快→吸得多→灵气降"负反馈。
 */
import type { BalanceParams } from '../params';
import type { Season } from '@sim/world/types';
import { MILLI, nextSeason } from '@sim/world/types';
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { SpiritHerbDef } from '@content/defs';
import type { Tile } from './tile';
import type { CropInstance } from './crop';
import { stageFromGrowth } from './crop';

/** 灵气因子：饱和曲线 + 过载奖励（docs/14 §4.1）。qiDensity/qiNeed 均毫点 → 无量纲比。 */
export function qiFactor(qiDensityMilli: number, qiNeedMilli: number, cap: number): number {
  if (qiNeedMilli <= 0) return 1;
  const r = qiDensityMilli / qiNeedMilli;
  return r < 0 ? 0 : r > cap ? cap : r;
}

/** 土壤因子：递减收益（docs/14 §4.1）。fertilityNorm 0..1。 */
export function soilFactor(fertilityNorm: number, min: number): number {
  const f = fertilityNorm < 0 ? 0 : fertilityNorm > 1 ? 1 : fertilityNorm;
  return min + (1 - min) * Math.sqrt(f);
}

/** 季节因子（docs/08 §4.2）。 */
export function seasonFactor(
  herb: SpiritHerbDef,
  season: Season,
  optimal: number,
  weak: number,
): number {
  if (herb.preferredSeason === season) return optimal;
  if (herb.weakSeason === season) return weak;
  return 1;
}

/** 照料因子（docs/08 §2.2(f)）：灵草无灵不长（channel 必需）。 */
export function careFactor(watered: boolean, channeled: boolean): number {
  if (watered && channeled) return 1.0;
  if (watered) return 0.5; // 仅浇水
  if (channeled) return 0.3; // 仅供灵（凡间作物可，灵草严重不足）
  return 0.1; // 双漏（几近枯死）
}

/** 单株灵草的日生长增量（毫点）。纯函数，便于单测/属性测试。 */
export function growthPerDay(
  herb: SpiritHerbDef,
  tile: Tile,
  season: Season,
  params: BalanceParams,
  celestialMod = 1,
): number {
  const qi = qiFactor(tile.qiDensity, herb.qiNeed, params.growth.qiFactorCap);
  const soil = soilFactor(tile.fertility / (100 * MILLI), params.growth.soilFactorMin);
  const seas = seasonFactor(herb, season, params.growth.seasonOptimalBonus, params.growth.seasonWeakPenalty);
  const care = careFactor(tile.wateredToday, tile.channeledToday);
  return herb.baseGrowth * qi * soil * seas * celestialMod * care;
}

/** 单株灵草当日灵气吸收（毫点，docs/14 §2.2）。灵气越足吸得越多（正反馈）。 */
export function herbQiDemand(herb: SpiritHerbDef, tile: Tile, params: BalanceParams): number {
  const qi = qiFactor(tile.qiDensity, herb.qiNeed, params.growth.qiFactorCap);
  return herb.qiDrainPerDay * qi;
}

/** 地块灵气日更新（docs/14 §2.1）。原地变更。 */
export function updateTileQi(tile: Tile, drainMilli: number, params: BalanceParams, veinMul = 1, celestialMod = 1): void {
  const regen = params.qi.regenBase * MILLI * veinMul * celestialMod;
  const decay = params.qi.qiDecayPerDay * MILLI * (tile.qiDensity / (100 * MILLI));
  let q = tile.qiDensity + regen - drainMilli - decay;
  if (q < 0) q = 0;
  if (q > 100 * MILLI) q = 100 * MILLI;
  tile.qiDensity = Math.round(q);
}

/**
 * 日终结算：推进所有作物生长 + 灵气/土壤更新 + 玩家状态 + 季节推进（docs/08 §2）。
 * 这是种田的核心推进函数；无头模拟每日调用一次。
 */
export function applyFarmDayEnd(state: GameState, ctx: SimContext, growthMod = 1, qiMod = 1): void {
  const { params, content } = ctx;
  // 1. 作物生长 + 灵气/土壤消耗
  for (const [tileId, crop] of state.crops) {
    const tile = state.tiles[tileId];
    if (!tile || crop.stage === 'withered') continue;
    const herb = content.herbs.get(crop.defId);
    if (!herb) continue;

    if (crop.growth < herb.growthThreshold) {
      const delta = growthPerDay(herb, tile, state.season, params, growthMod);
      crop.growth = Math.round(crop.growth + delta);
      if (crop.growth >= herb.growthThreshold) {
        crop.growth = herb.growthThreshold;
        crop.stage = 'mature';
        emit(state, 'crop-mature', { defId: herb.id, tileId });
      } else {
        crop.stage = stageFromGrowth(crop.growth, herb.growthThreshold);
      }
    } else {
      // 过熟衰减（docs/08 §2.3）
      crop.growth = Math.round(crop.growth - params.growth.overripeDecay * MILLI);
      if (crop.growth <= 0) {
        crop.stage = 'withered';
        crop.growth = 0;
        emit(state, 'crop-withered', { defId: herb.id, tileId });
      }
    }

    // 灵气吸收（即使未成熟也吸气，构成负反馈）
    updateTileQi(tile, herbQiDemand(herb, tile, params), params, 1, qiMod);

    // 土壤肥力消耗
    tile.fertility = Math.max(0, tile.fertility - params.growth.fertilityDrain * MILLI);

    // 健康度：双漏且灵草 → 衰减健康
    if (!tile.wateredToday && !tile.channeledToday && crop.stage !== 'mature') {
      crop.health = Math.max(0, crop.health - 5 * MILLI);
    }
  }

  // 2. 空地块灵气自然再生
  for (const tile of state.tiles) {
    if (tile.cropId === null) {
      updateTileQi(tile, 0, ctx.params, 1, qiMod);
    }
    // 湿度/日标记重置
    tile.wateredToday = false;
    tile.channeledToday = false;
    tile.moisture = Math.max(0, tile.moisture - 10 * MILLI);
  }

  // 3. 玩家日终：丹毒衰减（体力在清晨重置，见 simulateDay；docs/06 §1.2 / 14 §3.2）
  const p = state.player;
  p.pillPoison = Math.max(0, p.pillPoison - ctx.params.pillPoison.decayBase * MILLI);

  // 4. 时间推进
  state.day += 1;
  state.seasonDay += 1;
  if (state.seasonDay > ctx.params.time.daysPerSeason) {
    state.seasonDay = 1;
    const ns = nextSeason(state.season);
    if (ns === 'spring') state.year += 1;
    state.season = ns;
    emit(state, 'season-change', { season: ns, year: state.year });
  }
}
