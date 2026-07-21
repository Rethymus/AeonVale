/**
 * 种田系统：灵气驱动的生长 + 土壤 + 季节。
 * 全部为纯函数或对 state 的确定性变更；无 IO、无渲染、无 Math.random()。
 *
 * 核心公式：
 * growthPerDay = baseGrowth × qiFactor × soilFactor × seasonFactor × celestialFactor × careFactor
 * 灵气模型：Q(t+1) = Q + regen − herbDrain − decay，构成"灵气足→长得快→吸得多→灵气降"负反馈。
 */
import type { BalanceParams } from '../params';
import type { Season } from '@sim/world/types';
import { MILLI, nextSeason } from '@sim/world/types';
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { SpiritHerbDef } from '@content/defs';
import { greenhouseProtectedGrowthMultiplier, greenhouseProtectedHealthDelta } from '@sim/social/greenhouse';
import { hasActiveArrayCoverage, coveringWaterArray } from '@sim/tribulation/arrays';
import { arrayWardenResonanceForTile } from '@sim/celestial/beastSystem';
import type { Tile } from './tile';
import type { CropInstance } from './crop';
import { stageFromGrowth } from './crop';

const INSULATION_ARRAY_MOISTURE_RETENTION = 5 * MILLI;
const INSULATION_ARRAY_HEALTH_PROTECTION = 3 * MILLI;
const LIGHTNING_ROD_ARRAY_QI_REGEN_BONUS = 0.15;
/** 绝缘阵控场稳气，空地块灵气自然再生微益（弱于引雷阵聚灵）。 */
const INSULATION_ARRAY_QI_REGEN_BONUS = 0.08;

/** 灵气因子：饱和曲线 + 过载奖励。qiDensity/qiNeed 均毫点 → 无量纲比。 */
export function qiFactor(qiDensityMilli: number, qiNeedMilli: number, cap: number): number {
  if (qiNeedMilli <= 0) return 1;
  const r = qiDensityMilli / qiNeedMilli;
  return r < 0 ? 0 : r > cap ? cap : r;
}

/** 土壤因子：递减收益。fertilityNorm 0..1。 */
export function soilFactor(fertilityNorm: number, min: number): number {
  const f = fertilityNorm < 0 ? 0 : fertilityNorm > 1 ? 1 : fertilityNorm;
  return min + (1 - min) * Math.sqrt(f);
}

/** 季节因子。 */
export function seasonFactor(herb: SpiritHerbDef, season: Season, optimal: number, weak: number): number {
  if (herb.preferredSeason === season) return optimal;
  if (herb.weakSeason === season) return weak;
  return 1;
}

/** 照料因子：灵草无灵不长（channel 必需）。 */
export function careFactor(watered: boolean, channeled: boolean): number {
  if (watered && channeled) return 1.0;
  if (watered) return 0.5; // 仅浇水
  if (channeled) return 0.3; // 仅供灵（凡间作物可，灵草严重不足）
  return 0.1; // 双漏（几近枯死）
}

/** 单株灵草的日生长增量（毫点）。纯函数，便于单测/属性测试。 */
export function growthPerDay(herb: SpiritHerbDef, tile: Tile, season: Season, params: BalanceParams, celestialMod = 1, greenhouseProtected = false): number {
  const qi = qiFactor(tile.qiDensity, herb.qiNeed, params.growth.qiFactorCap);
  const soil = soilFactor(tile.fertility / (100 * MILLI), params.growth.soilFactorMin);
  const seas = greenhouseProtected ? 1 : seasonFactor(herb, season, params.growth.seasonOptimalBonus, params.growth.seasonWeakPenalty);
  const care = careFactor(tile.wateredToday, tile.channeledToday);
  return herb.baseGrowth * qi * soil * seas * celestialMod * care;
}

/** 单株灵草当日灵气吸收（毫点）。灵气越足吸得越多（正反馈）。 */
export function herbQiDemand(herb: SpiritHerbDef, tile: Tile, params: BalanceParams): number {
  const qi = qiFactor(tile.qiDensity, herb.qiNeed, params.growth.qiFactorCap);
  return herb.qiDrainPerDay * qi;
}

/** 地块灵气日更新。原地变更。 */
export function updateTileQi(tile: Tile, drainMilli: number, params: BalanceParams, veinMul = 1, celestialMod = 1): void {
  const regen = params.qi.regenBase * MILLI * veinMul * celestialMod;
  const decay = params.qi.qiDecayPerDay * MILLI * (tile.qiDensity / (100 * MILLI));
  let q = tile.qiDensity + regen - drainMilli - decay;
  if (q < 0) q = 0;
  if (q > 100 * MILLI) q = 100 * MILLI;
  tile.qiDensity = Math.round(q);
}

/**
 * 日终结算：推进所有作物生长 + 灵气/土壤更新 + 玩家状态 + 季节推进。
 * 这是种田的核心推进函数；无头模拟每日调用一次。
 */
export function applyFarmDayEnd(state: GameState, ctx: SimContext, growthMod = 1, qiMod = 1): void {
  const { params, content } = ctx;
  const greenhouseGrowthMod = greenhouseProtectedGrowthMultiplier(state);
  const greenhouseHealthDelta = greenhouseProtectedHealthDelta(state);
  // 1. 作物生长 + 灵气/土壤消耗
  for (const [tileId, crop] of state.crops) {
    const tile = state.tiles[tileId];
    if (!tile || crop.stage === 'withered') continue;
    const herb = content.herbs.get(crop.defId);
    if (!herb) continue;
    const greenhouseProtected = crop.greenhouseProtected === true;
    const insulated = hasActiveArrayCoverage(state, tileId, 'array.insulation');
    const lightningRodCovered = hasActiveArrayCoverage(state, tileId, 'array.lightning-rod');
    // 阵守巡守兽在活跃阵法覆盖内巡逻 → 阵法农庄共振：放大该阵法自身领域的农务收益。
    const resonance = arrayWardenResonanceForTile(state, tileId);
    const tileQiMod = lightningRodCovered && herb.metalAttract > 0 ? qiMod + LIGHTNING_ROD_ARRAY_QI_REGEN_BONUS + (resonance?.qiRegenBonus ?? 0) : qiMod;

    if (crop.growth < herb.growthThreshold) {
      const delta = growthPerDay(herb, tile, state.season, params, greenhouseProtected ? growthMod * greenhouseGrowthMod : growthMod, greenhouseProtected);
      crop.growth = Math.round(crop.growth + delta);
      if (crop.growth >= herb.growthThreshold) {
        crop.growth = herb.growthThreshold;
        crop.stage = 'mature';
        emit(state, 'crop-mature', { defId: herb.id, tileId });
      } else {
        crop.stage = stageFromGrowth(crop.growth, herb.growthThreshold);
      }
    } else {
      // 过熟衰减；引雷阵覆盖的金属性灵草受天雷淬炼，过熟衰减减半。
      const overripeDecayMilli = lightningRodCovered && herb.metalAttract > 0 ? Math.round(params.growth.overripeDecay * 0.5 * MILLI) : params.growth.overripeDecay * MILLI;
      crop.growth = Math.round(crop.growth - overripeDecayMilli);
      if (crop.growth <= 0) {
        crop.stage = 'withered';
        crop.growth = 0;
        emit(state, 'crop-withered', { defId: herb.id, tileId });
      }
    }

    // 灵气吸收（即使未成熟也吸气，构成负反馈）
    updateTileQi(tile, herbQiDemand(herb, tile, params), params, 1, tileQiMod);

    // 土壤肥力消耗
    tile.fertility = Math.max(0, tile.fertility - params.growth.fertilityDrain * MILLI);

    if (greenhouseProtected && crop.stage !== 'mature') {
      crop.health = Math.max(0, Math.min(100 * MILLI, crop.health + greenhouseHealthDelta));
      if (crop.health <= 0) {
        crop.stage = 'withered';
        crop.growth = 0;
        emit(state, 'crop-withered', { defId: herb.id, tileId });
      }
    }

    if (insulated && crop.stage !== 'mature') {
      crop.health = Math.min(100 * MILLI, crop.health + INSULATION_ARRAY_HEALTH_PROTECTION + (resonance?.healthProtectionBonus ?? 0));
    }

    // 健康度：双漏且灵草 → 衰减健康
    if (!tile.wateredToday && !tile.channeledToday && crop.stage !== 'mature') {
      crop.health = Math.max(0, crop.health - 5 * MILLI);
    }
  }

  // 2. 空地块灵气自然再生
  for (const tile of state.tiles) {
    const lightningRodCovered = hasActiveArrayCoverage(state, tile.id, 'array.lightning-rod');
    const insulatedTile = hasActiveArrayCoverage(state, tile.id, 'array.insulation');
    // 引雷阵聚灵；绝缘阵控场稳气，空地块灵气自然再生亦有微益。
    const tileQiMod = lightningRodCovered ? qiMod + LIGHTNING_ROD_ARRAY_QI_REGEN_BONUS : insulatedTile ? qiMod + INSULATION_ARRAY_QI_REGEN_BONUS : qiMod;
    if (tile.cropId === null) {
      updateTileQi(tile, 0, ctx.params, 1, tileQiMod);
    }
    // 湿度/日标记重置
    tile.wateredToday = false;
    tile.channeledToday = false;
    const tileResonance = insulatedTile ? arrayWardenResonanceForTile(state, tile.id) : null;
    tile.moisture = Math.max(0, tile.moisture - 10 * MILLI + (insulatedTile ? INSULATION_ARRAY_MOISTURE_RETENTION + (tileResonance?.moistureRetentionBonus ?? 0) : 0));
    // R3-B1 引水阵：次日清晨自动浇灌覆盖圈灵田（对标星露谷洒水器；纯确定性零 RNG）。
    // 阀：覆盖内取最强单阵不堆叠 + moisture 上限 100*MILLI 天然封顶，守 docs/00 C5（凡人挣扎不被自动化掏空）。
    if (!tile.wateredToday) {
      const waterArr = coveringWaterArray(state, tile.id, content.arrays);
      if (waterArr) {
        const waterAmount = content.arrays.get(waterArr.defId)?.waterAmountMilli ?? 0;
        if (waterAmount > 0) {
          tile.wateredToday = true;
          tile.moisture = Math.min(100 * MILLI, tile.moisture + waterAmount);
        }
      }
    }
  }

  // 3. 玩家日终：过夜休养回血 + 丹毒衰减（体力在清晨重置，见 simulateDay）
  const p = state.player;
  p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp * 0.05)); // 过夜回 5% 气血
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
