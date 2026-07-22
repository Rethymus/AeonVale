/**
 * R4-a 雷劫炼体 roguelite —— 镜像自 tribulationSystem.ts 的纯公式。
 *
 * 这些公式与 src/sim/tribulation/tribulationSystem.ts 的 boltBaseDamage / violetChance / nearDeathBonus
 * 完全一致（只吃 BalanceParams 或基本类型，不依赖 GameState/SimContext）。
 * 此处内联而非 import，是为了让原型切片不拖入 tribulationSystem 的重依赖图（arrays/state/bodyCultivation），
 * 保持切片轻量隔离。R4-b 接入正式 resolveDueTribulation 时，这些会被真实函数取代。
 */
import type { BalanceParams } from '@sim/params';
import type { Vec2 } from '@sim/world/types';

/** 单雷基值（毫点 HP）。镜像 boltBaseDamage。 */
export function boltBaseDamage(stage: number, params: BalanceParams): number {
  return (params.lightning.damage.base + params.lightning.damage.stageSlope * stage) * 1000;
}

/** stage 对应的紫雷占比。stage<unlock → 0，否则线性并钳到 [0,1]。镜像 violetChance。 */
export function violetChance(stage: number, params: BalanceParams): number {
  const bp = params.lightning.bolt;
  if (stage < bp.violetUnlockStage) return 0;
  const raw = bp.violetChanceBase + bp.violetChanceSlope * (stage - bp.violetUnlockStage);
  return Math.max(0, Math.min(1, raw));
}

/** 控血收益系数（倒钟形）。finalHpRatio ∈ [0,1]。镜像 nearDeathBonus。 */
export function nearDeathBonus(finalHpRatio: number, params: BalanceParams): number {
  const tp = params.lightning.tempering;
  if (finalHpRatio <= 0) return 0;
  if (finalHpRatio <= tp.nearDeathPeakBand) return tp.nearDeathPeak; // (0, 10%] → 2.5
  if (finalHpRatio <= 0.25) return 2.0; // (10%, 25%]
  if (finalHpRatio <= 0.5) return 1.3; // (25%, 50%]
  if (finalHpRatio <= 0.8) return 1.0; // (50%, 80%]
  return tp.nearDeathSafe; // >80%
}

/** 棋盘距离。镜像 targeting.ts chebyshev。 */
export function chebyshev(a: Vec2, b: Vec2): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
