/**
 * 药性向量数学。
 * 内部四轴 [cold,hot,warm,neutral]（毫点）；玩家面投影为寒热轴 hot−cold。
 * 炸炉主轴 conflict = |hot − cold|。
 */
import type { PropertyVector } from '@sim/world/types';

export const ZERO_PROPERTY: PropertyVector = { cold: 0, hot: 0, warm: 0, neutral: 0 };

export function add(a: PropertyVector, b: PropertyVector): PropertyVector {
  return { cold: a.cold + b.cold, hot: a.hot + b.hot, warm: a.warm + b.warm, neutral: a.neutral + b.neutral };
}

export function scale(a: PropertyVector, k: number): PropertyVector {
  return { cold: a.cold * k, hot: a.hot * k, warm: a.warm * k, neutral: a.neutral * k };
}

/** 一维寒热轴投影（玩家面平衡条用）。 */
export function coldHotAxis(v: PropertyVector): number {
  return v.hot - v.cold;
}

/** 寒热冲突量级（炸炉主判定）。毫点。 */
export function conflictMagnitude(v: PropertyVector): number {
  return Math.abs(v.hot - v.cold);
}

/** L1 范数（四轴绝对值和）。 */
export function l1Norm(v: PropertyVector): number {
  return Math.abs(v.cold) + Math.abs(v.hot) + Math.abs(v.warm) + Math.abs(v.neutral);
}

/** L1 距离。 */
export function l1Distance(a: PropertyVector, b: PropertyVector): number {
  return l1Norm({ cold: a.cold - b.cold, hot: a.hot - b.hot, warm: a.warm - b.warm, neutral: a.neutral - b.neutral });
}

/** 平衡度评分：clamp(1 − L1距离/norm, 0, 1)。 */
export function balanceScore(furnaceVec: PropertyVector, targetVec: PropertyVector, norm: number): number {
  if (norm <= 0) return 0;
  const d = l1Distance(furnaceVec, targetVec);
  const s = 1 - d / norm;
  return s < 0 ? 0 : s > 1 ? 1 : s;
}

/** 由药性派生"自然理想火候"（寒草喜低温，热草喜高温）。返回毫点 0..100000。 */
export function naturalHeat(v: PropertyVector): number {
  const axis = coldHotAxis(v); // 毫点，寒负热正
  // axis 0 → 50；axis ±6000 → 50 ∓ ~30
  let h = 50_000 - (axis / 6_000) * 30_000;
  if (h < 10_000) h = 10_000;
  if (h > 90_000) h = 90_000;
  return Math.round(h);
}

/**
 * 火候-材料提取系数。
 * 简化为线性衰减：在 naturalHeat 处峰值 1.0，±30(毫点×1000) 外归零。
 * （首版线性；后续可换 sin 拱形）
 */
export function extraction(heatMilli: number, herbNaturalHeat: number): number {
  const tol = 30_000;
  const d = Math.abs(heatMilli - herbNaturalHeat);
  const e = 1 - d / tol;
  return e < 0 ? 0 : e > 1 ? 1 : e;
}
