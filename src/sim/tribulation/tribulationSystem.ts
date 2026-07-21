/**
 * 天劫系统：劫雷淬体 + 精准控血。
 *
 * 灵魂曲线：temperingGain = 实受伤害 × exposure × temperingEff(stage) × nearDeathBonus(最终HP)。
 * nearDeathBonus 倒钟形峰值在最终 HP 5–10%（×2.5）——奖励"差点死但没死"的走钢丝。
 *
 * runTribulation：给定阶段/雷数/玩家策略，确定性解析整场天劫（无头可复现）。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { Rng } from '@sim/world/rng';
import { pickTarget, chebyshev } from './targeting';
import { coveringRodArray } from './arrays';
import { normalizeBodyCultivation } from '@sim/progression/bodyCultivation';

function scorchTileAfterStrike(state: GameState, tileId: number): void {
  const tile = state.tiles.find(entry => entry.id === tileId);
  if (!tile) return;
  if (tile.blockType !== 'none') return;
  if (tile.soilType === 'rock' || tile.soilType === 'water' || tile.soilType === 'metal-ore' || tile.soilType === 'insulated') return;
  tile.soilType = 'scorched';
  tile.tilled = false;
  tile.wateredToday = false;
  tile.channeledToday = false;
  tile.moisture = 0;
  tile.qiDensity = Math.min(tile.qiDensity, 10_000);
}

export interface TribulationPolicy {
  blockChance: number; // 完美擦弹概率（玩家技巧）
}

export interface TribulationOptions {
  stage: number;
  boltCount: number;
  policy: TribulationPolicy;
  blastRadius?: number; // 命中半径（格；默认 1）
}

export interface TribulationResult {
  survived: boolean;
  finalHpMilli: number;
  bolts: number;
  temperingGainMilli: number;
  hits: { direct: number; rod: number; miss: number; blocked: number; violet: number };
}

export type TribulationHitType = 'direct' | 'rod' | 'miss' | 'blocked';

export interface TribulationBoltOptions {
  stage: number;
  policy: TribulationPolicy;
  blastRadius?: number;
  targetTileId?: number;
  damageModOverride?: number;
}

export interface TribulationBoltResolution {
  targetTileId: number;
  hitType: TribulationHitType;
  isViolet: boolean;
  damageMilli: number;
  hpBeforeMilli: number;
  hpAfterMilli: number;
  rawTemperingMilli: number;
}

/** 单雷基值（毫点 HP）。 */
export function boltBaseDamage(stage: number, params: SimContext['params']): number {
  return (params.lightning.damage.base + params.lightning.damage.stageSlope * stage) * 1000;
}

/** stage 对应的紫雷占比。stage<unlock → 0，否则线性并钳到 [0,1]。 */
export function violetChance(stage: number, params: SimContext['params']): number {
  const bp = params.lightning.bolt;
  if (stage < bp.violetUnlockStage) return 0;
  const raw = bp.violetChanceBase + bp.violetChanceSlope * (stage - bp.violetUnlockStage);
  return Math.max(0, Math.min(1, raw));
}

/** 控血收益系数（倒钟形）。finalHpRatio ∈ [0,1]。 */
export function nearDeathBonus(finalHpRatio: number, params: SimContext['params']): number {
  const tp = params.lightning.tempering;
  if (finalHpRatio <= 0) return 0;
  if (finalHpRatio <= tp.nearDeathPeakBand) return tp.nearDeathPeak; // (0, 10%] → 2.5
  if (finalHpRatio <= 0.25) return 2.0; // (10%, 25%] → 2.0
  if (finalHpRatio <= 0.5) return 1.3; // (25%, 50%] → 1.3
  if (finalHpRatio <= 0.8) return 1.0; // (50%, 80%] → 1.0
  return tp.nearDeathSafe; // >80% → 0.6（未受淬炼）
}

/** 解析单雷，不结算整场淬体，也不消费任何承雷稳脉效果。 */
export function resolveTribulationBolt(state: GameState, opts: TribulationBoltOptions, ctx: SimContext, rng: Rng = ctx.rng.lightning): TribulationBoltResolution {
  const { stage, policy } = opts;
  const tp = ctx.params.lightning.tempering;
  const bp = ctx.params.lightning.bolt;
  const vChance = violetChance(stage, ctx.params);
  let isViolet = false;
  if (vChance > 0) isViolet = rng.next() < vChance;
  const tempMult = isViolet ? bp.violetTemperingMult : 1;
  const typeRadius = isViolet ? bp.violetBlastRadius : 1;
  const blastRadius = opts.blastRadius ?? typeRadius;
  const damageMod = opts.damageModOverride ?? state.activeEvent?.damageMod ?? 1;
  const base = boltBaseDamage(stage, ctx.params) * (isViolet ? bp.violetDamageMult : 1) * damageMod;
  const tile = (opts.targetTileId == null ? undefined : state.tiles.find(entry => entry.id === opts.targetTileId)) ?? pickTarget(state, ctx, rng);
  const hpBeforeMilli = state.player.hp;
  const onPlayer = chebyshev(tile, state.player.position) <= blastRadius;
  let isRod = false;
  const rodArr = coveringRodArray(state, tile.id);
  if (rodArr) {
    isRod = true;
    rodArr.power -= 10;
    if (rodArr.power <= 0) {
      rodArr.power = 0;
      rodArr.active = false;
      emit(state, 'array-depleted', { defId: rodArr.defId });
    }
  } else if (tile.cropId != null) {
    const crop = state.crops.get(tile.id);
    if (crop) {
      const herb = ctx.content.herbs.get(crop.defId);
      if (herb && herb.metalAttract > 0) isRod = true;
    }
  }

  let hitType: TribulationHitType;
  let rawTemperingMilli = 0;
  if (onPlayer) {
    let damage = base * (1 - state.player.wardMitigation) * (1 - (state.player.ironBoneMitigation ?? 0));
    const blocked = rng.next() < policy.blockChance;
    if (blocked) {
      damage *= 0.3;
      hitType = 'blocked';
      rawTemperingMilli = damage * tp.exposureDirect * tp.perfectBlockQualityBonus * tempMult;
    } else {
      hitType = 'direct';
      rawTemperingMilli = damage * tp.exposureDirect * tempMult;
    }
    state.player.hp = Math.max(0, state.player.hp - Math.round(damage));
  } else if (isRod) {
    hitType = 'rod';
    rawTemperingMilli = base * tp.exposureRod * tempMult;
  } else {
    hitType = 'miss';
    scorchTileAfterStrike(state, tile.id);
  }

  return {
    targetTileId: tile.id,
    hitType,
    isViolet,
    damageMilli: hpBeforeMilli - state.player.hp,
    hpBeforeMilli,
    hpAfterMilli: state.player.hp,
    rawTemperingMilli
  };
}

/** 解析整场天劫（确定性）。 */
export function runTribulation(state: GameState, opts: TribulationOptions, ctx: SimContext): TribulationResult {
  normalizeBodyCultivation(state, ctx.params);
  const { stage, boltCount, policy } = opts;
  const tp = ctx.params.lightning.tempering;
  let rawTempering = 0;
  const hits = { direct: 0, rod: 0, miss: 0, blocked: 0, violet: 0 };
  const rng = ctx.rng.lightning;

  for (let i = 0; i < boltCount; i++) {
    const bolt = resolveTribulationBolt(state, { stage, policy, blastRadius: opts.blastRadius }, ctx, rng);
    hits[bolt.hitType] += 1;
    if (bolt.isViolet) hits.violet += 1;
    rawTempering += bolt.rawTemperingMilli;
    if (state.player.hp <= 0) break;
  }

  const eff = tp.effBase + tp.effStageSlope * stage; // temperingEff(stage)：后期效率下降
  const finalRatio = state.player.hp / state.player.maxHp;
  const tbm = state.player.temperBoostMult ?? 1; // 淬体丹倍率（旧档无此字段→1）
  const tempering = Math.round(rawTempering * eff * nearDeathBonus(finalRatio, ctx.params) * tbm);

  state.player.cultivation += tempering;
  state.player.bodyFoundation += tempering;
  state.player.willpower += Math.round(tempering / ctx.params.bodyCultivation.tribulationWillpowerDivisor);
  state.player.temperingStack += tempering;
  state.player.wardMitigation = 0; // 承雷稳脉渡劫后消耗
  state.player.temperBoostMult = 1; // 淬体倍率渡劫后消耗
  state.player.ironBoneMitigation = 0; // 铁骨减伤渡劫后消耗
  const survived = state.player.hp > 0;
  emit(state, 'tribulation-end', { survived, tempering, hits });

  return {
    survived,
    finalHpMilli: state.player.hp,
    bolts: boltCount,
    temperingGainMilli: tempering,
    hits
  };
}
