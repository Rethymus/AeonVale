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

/** 解析整场天劫（确定性）。 */
export function runTribulation(state: GameState, opts: TribulationOptions, ctx: SimContext): TribulationResult {
  normalizeBodyCultivation(state, ctx.params);
  const { stage, boltCount, policy } = opts;
  const tp = ctx.params.lightning.tempering;
  const bp = ctx.params.lightning.bolt;
  const baseCyan = boltBaseDamage(stage, ctx.params);
  const vChance = violetChance(stage, ctx.params);
  const ironBone = state.player.ironBoneMitigation ?? 0; // 铁骨整场减伤（旧档无此字段→0）
  let rawTempering = 0;
  const hits = { direct: 0, rod: 0, miss: 0, blocked: 0, violet: 0 };
  const rng = ctx.rng.lightning;

  for (let i = 0; i < boltCount; i++) {
    // 紫雷判定：仅 stage≥unlock 消费 rng，保证 stage1–2 序列不变
    let isViolet = false;
    if (vChance > 0) isViolet = rng.next() < vChance;
    if (isViolet) hits.violet++;
    const tempMult = isViolet ? bp.violetTemperingMult : 1.0;
    const typeRadius = isViolet ? bp.violetBlastRadius : 1;
    const blastRadius = opts.blastRadius ?? typeRadius;
    const base = baseCyan * (isViolet ? bp.violetDamageMult : 1.0) * (state.activeEvent?.damageMod ?? 1);

    const tile = pickTarget(state, ctx, rng);
    const onPlayer = chebyshev(tile, state.player.position) <= blastRadius;
    let isRod = false;
    const rodArr = coveringRodArray(state, tile.id);
    if (rodArr) {
      // 引雷阵代接雷：阵法损耗，耗尽则失效
      isRod = true;
      rodArr.power -= 10;
      if (rodArr.power <= 0) {
        rodArr.power = 0;
        rodArr.active = false;
        emit(state, 'array-depleted', { defId: rodArr.defId });
      }
    } else if (tile.cropId != null) {
      const crop = state.crops.get(tile.id); // crops Map 以 tile.id 为键
      if (crop) {
        const herb = ctx.content.herbs.get(crop.defId);
        if (herb && herb.metalAttract > 0) isRod = true;
      }
    }

    if (onPlayer) {
      // 避雷护体减伤+ 铁骨整场减伤
      let dmg = base * (1 - state.player.wardMitigation) * (1 - ironBone);
      // 擦弹判定：始终消费 rng（保证不同 blockChance 下落点序列一致、可比较）
      const blocked = rng.next() < policy.blockChance;
      if (blocked) {
        // 完美擦弹：伤害 ×0.3，淬体 ×1.5
        dmg = dmg * 0.3;
        hits.blocked++;
        rawTempering += dmg * tp.exposureDirect * tp.perfectBlockQualityBonus * tempMult;
      } else {
        hits.direct++;
        rawTempering += dmg * tp.exposureDirect * tempMult;
      }
      state.player.hp = Math.max(0, state.player.hp - Math.round(dmg));
      if (state.player.hp <= 0) break;
    } else if (isRod) {
      // 避雷草/阵代接：传少量淬体
      hits.rod++;
      rawTempering += base * tp.exposureRod * tempMult;
    } else {
      hits.miss++;
      scorchTileAfterStrike(state, tile.id);
    }
  }

  const eff = tp.effBase + tp.effStageSlope * stage; // temperingEff(stage)：后期效率下降
  const finalRatio = state.player.hp / state.player.maxHp;
  const tbm = state.player.temperBoostMult ?? 1; // 淬体丹倍率（旧档无此字段→1）
  const tempering = Math.round(rawTempering * eff * nearDeathBonus(finalRatio, ctx.params) * tbm);

  state.player.cultivation += tempering;
  state.player.bodyFoundation += tempering;
  state.player.willpower += Math.round(tempering / ctx.params.bodyCultivation.tribulationWillpowerDivisor);
  state.player.temperingStack += tempering;
  state.player.wardMitigation = 0; // 护体渡劫后消耗
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
