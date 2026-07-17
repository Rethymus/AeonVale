/**
 * 角色/NPC 在世界层的「在场感」辅助（纯 render，零 sim）。
 * T2：朝向可读、脚底阴影、高灵气地块轻量灵气微粒。
 */

export type Facing4 = 'up' | 'down' | 'left' | 'right';

/** left 镜像 scale.x = -1，其余 1。 */
export function facingScaleX(facing: Facing4): number {
  return facing === 'left' ? -1 : 1;
}

/** 朝向指示相对角色中心的像素偏移（与 TILE≈42 对齐）。 */
export function facingIndicatorOffset(facing: Facing4, distance = 12): { x: number; y: number } {
  switch (facing) {
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
    case 'up':
      return { x: 0, y: -distance };
    case 'down':
      return { x: 0, y: distance };
  }
}

export interface FootShadowSpec {
  readonly width: number;
  readonly height: number;
  readonly alpha: number;
  readonly yOffset: number;
}

export function footShadowSpec(kind: 'player' | 'npc' = 'player'): FootShadowSpec {
  if (kind === 'npc') {
    return { width: 18, height: 6, alpha: 0.28, yOffset: 14 };
  }
  return { width: 22, height: 7, alpha: 0.34, yOffset: 15 };
}

/** 灵气微粒相位 0..1；ambient 驱动。 */
export function qiSparklePhase(ambientTimeMs: number, salt: number): number {
  const t = Number.isFinite(ambientTimeMs) ? ambientTimeMs : 0;
  const u = (t / 1800 + salt * 0.17) % 1;
  return u < 0 ? u + 1 : u;
}

/**
 * 高灵气地块是否绘制微粒（与 tileVisuals.qiGlowAlpha 同源阈值）。
 * qiDensity 为毫点。
 */
export function shouldDrawQiSparkles(qiDensityMilli: number, tilled: boolean): boolean {
  if (!tilled) return false;
  return qiDensityMilli >= 40_000;
}
