/**
 * 天劫系统：劫雷淬体 + 精准控血（docs/05 §4 / docs/14 §6）。
 *
 * 灵魂曲线（docs/14 §6.2）：temperingGain = 实受伤害 × exposure × temperingEff(stage) × nearDeathBonus(最终HP)。
 * nearDeathBonus 倒钟形峰值在最终 HP 5–10%（×2.5）——奖励"差点死但没死"的走钢丝。
 *
 * runTribulation：给定阶段/雷数/玩家策略，确定性解析整场天劫（无头可复现）。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { pickTarget, chebyshev } from './targeting';

export interface TribulationPolicy {
  blockChance: number; // 完美擦弹概率（玩家技巧，docs/05 §4.4）
}

export interface TribulationOptions {
  stage: number;
  boltCount: number;
  policy: TribulationPolicy;
  blastRadius?: number; // 命中半径（格，docs/05 §4.1 BlastRadius；默认 1）
}

export interface TribulationResult {
  survived: boolean;
  finalHpMilli: number;
  bolts: number;
  temperingGainMilli: number;
  hits: { direct: number; rod: number; miss: number; blocked: number };
}

/** 单雷基值（毫点 HP，docs/14 §6.1 / P017–018）。 */
export function boltBaseDamage(stage: number, params: SimContext['params']): number {
  return (params.lightning.damage.base + params.lightning.damage.stageSlope * stage) * 1000;
}

/** 控血收益系数（倒钟形，docs/14 §6.2 表）。finalHpRatio ∈ [0,1]。 */
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
export function runTribulation(
  state: GameState,
  opts: TribulationOptions,
  ctx: SimContext,
): TribulationResult {
  const { stage, boltCount, policy } = opts;
  const blastRadius = opts.blastRadius ?? 1;
  const tp = ctx.params.lightning.tempering;
  const base = boltBaseDamage(stage, ctx.params);
  let rawTempering = 0;
  const hits = { direct: 0, rod: 0, miss: 0, blocked: 0 };
  const rng = ctx.rng.lightning;

  for (let i = 0; i < boltCount; i++) {
    const tile = pickTarget(state, ctx, rng);
    const onPlayer = chebyshev(tile, state.player.position) <= blastRadius;
    let isRod = false;
    if (tile.cropId != null) {
      const crop = state.crops.get(tile.id); // crops Map 以 tile.id 为键
      if (crop) {
        const herb = ctx.content.herbs.get(crop.defId);
        if (herb && herb.metalAttract > 0) isRod = true;
      }
    }

    if (onPlayer) {
      // 避雷护体减伤（docs/06 §7.2，服避雷丹设置，渡劫消耗）
      let dmg = base * (1 - state.player.wardMitigation);
      // 擦弹判定：始终消费 rng（保证不同 blockChance 下落点序列一致、可比较）
      const blocked = rng.next() < policy.blockChance;
      if (blocked) {
        // 完美擦弹：伤害 ×0.3，淬体 ×1.5（docs/05 §4.4）
        dmg = dmg * 0.3;
        hits.blocked++;
        rawTempering += dmg * tp.exposureDirect * tp.perfectBlockQualityBonus;
      } else {
        hits.direct++;
        rawTempering += dmg * tp.exposureDirect;
      }
      state.player.hp = Math.max(0, state.player.hp - Math.round(dmg));
      if (state.player.hp <= 0) break;
    } else if (isRod) {
      // 避雷草/阵代接：传少量淬体（docs/05 §4.2 RodHit 0.25）
      hits.rod++;
      rawTempering += base * tp.exposureRod;
    } else {
      hits.miss++;
    }
  }

  const eff = tp.effBase + tp.effStageSlope * stage; // temperingEff(stage)：后期效率下降
  const finalRatio = state.player.hp / state.player.maxHp;
  const tempering = Math.round(rawTempering * eff * nearDeathBonus(finalRatio, ctx.params));

  state.player.cultivation += tempering;
  state.player.temperingStack += tempering;
  state.player.wardMitigation = 0; // 护体渡劫后消耗
  const survived = state.player.hp > 0;
  emit(state, 'tribulation-end', { survived, tempering, hits });

  return {
    survived,
    finalHpMilli: state.player.hp,
    bolts: boltCount,
    temperingGainMilli: tempering,
    hits,
  };
}
