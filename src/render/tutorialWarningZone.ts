/**
 * 教学天劫落雷预警区（纯 render 辅助）。
 * 用 ambientTimeMs 驱动脉动 alpha，不改 sim；Chebyshev r≤1 与 isPlayerInTutorialWarningZone 一致。
 */

export interface WarningZoneTile {
  readonly x: number;
  readonly y: number;
  readonly isCenter: boolean;
}

/** 0.35–0.70 的脉动，供描边/填充 alpha。 */
export function tutorialWarningPulse(ambientTimeMs: number): number {
  const t = Number.isFinite(ambientTimeMs) ? ambientTimeMs : 0;
  return 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t / 420));
}

/** 中心格 + 八邻域，裁世界边界。 */
export function tutorialWarningZoneTiles(
  centerX: number,
  centerY: number,
  worldW: number,
  worldH: number
): readonly WarningZoneTile[] {
  const out: WarningZoneTile[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = centerX + dx;
      const y = centerY + dy;
      if (x < 0 || y < 0 || x >= worldW || y >= worldH) continue;
      out.push({ x, y, isCenter: dx === 0 && dy === 0 });
    }
  }
  return out;
}

export type AlchemyHeatBand = 'low' | 'ideal' | 'high';

/** 火候相对理想区间的读图带（DOM data-heat-band）。 */
export function alchemyHeatBand(heatPercent: number, idealLo: number, idealHi: number): AlchemyHeatBand {
  const h = Math.max(0, Math.min(100, Math.round(heatPercent)));
  const lo = Math.max(0, Math.min(100, Math.round(idealLo)));
  const hi = Math.max(lo, Math.min(100, Math.round(idealHi)));
  if (h < lo) return 'low';
  if (h > hi) return 'high';
  return 'ideal';
}
