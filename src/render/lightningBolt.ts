/**
 * 教学/天劫招牌电光：分形中点位移折线（纯渲染，不进 sim）。
 * 视觉语言：白芯 + 紫边 + 命中点光晕，替代「只有全屏白闪」。
 */

export interface LightningPoint {
  readonly x: number;
  readonly y: number;
}

export interface LightningBoltGeometry {
  readonly trunk: readonly LightningPoint[];
  readonly branch?: readonly LightningPoint[];
  readonly impact: LightningPoint;
}

export interface GenerateLightningOptions {
  /** 迭代次数（越大越碎）。默认 5。 */
  readonly iterations?: number;
  /** 中点最大横向抖动（像素）。默认 48。 */
  readonly amplitude?: number;
  /** 可选：注入 [0,1) 随机，便于单测确定性。 */
  readonly random?: () => number;
}

/**
 * 自天空落点生成折线主干（可选短分叉）。
 * start 默认在 impact 正上方屏幕外缘附近由调用方传入。
 */
export function generateLightningBolt(start: LightningPoint, impact: LightningPoint, opts: GenerateLightningOptions = {}): LightningBoltGeometry {
  const iterations = Math.max(1, Math.min(7, opts.iterations ?? 5));
  const amplitude = opts.amplitude ?? 48;
  const random = opts.random ?? Math.random;

  let points: LightningPoint[] = [start, impact];
  let amp = amplitude;
  for (let iter = 0; iter < iterations; iter++) {
    const next: LightningPoint[] = [points[0]!];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const mx = (a.x + b.x) / 2 + (random() * 2 - 1) * amp;
      const my = (a.y + b.y) / 2 + (random() * 2 - 1) * (amp * 0.35);
      next.push({ x: mx, y: my }, b);
    }
    points = next;
    amp *= 0.55;
  }

  // 短分叉：取主干中段一点斜出
  let branch: LightningPoint[] | undefined;
  if (points.length >= 6) {
    const mid = Math.floor(points.length * 0.45);
    const origin = points[mid]!;
    const tip = {
      x: origin.x + (random() * 2 - 1) * 36,
      y: origin.y + 18 + random() * 40
    };
    branch = [origin, { x: (origin.x + tip.x) / 2 + (random() * 2 - 1) * 12, y: (origin.y + tip.y) / 2 }, tip];
  }

  return { trunk: points, branch, impact };
}

export interface LightningDrawStyle {
  readonly alpha: number;
  readonly coreColor?: number;
  readonly glowColor?: number;
  readonly coreWidth?: number;
  readonly glowWidth?: number;
}

/** 在 Pixi Graphics 上描电光（白芯紫边 + 命中点）。 */
export function strokeLightningBolt(
  g: { moveTo(x: number, y: number): unknown; lineTo(x: number, y: number): unknown; stroke(style: object): unknown; circle(x: number, y: number, r: number): { fill(style: object): unknown } },
  geom: LightningBoltGeometry,
  style: LightningDrawStyle
): void {
  const alpha = Math.max(0, Math.min(1, style.alpha));
  if (alpha <= 0) return;
  const glowColor = style.glowColor ?? 0xb48cff;
  const coreColor = style.coreColor ?? 0xffffff;
  const glowWidth = style.glowWidth ?? 5.5;
  const coreWidth = style.coreWidth ?? 2.2;

  const drawPoly = (pts: readonly LightningPoint[], width: number, color: number, a: number) => {
    if (pts.length < 2) return;
    g.moveTo(pts[0]!.x, pts[0]!.y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i]!.x, pts[i]!.y);
    g.stroke({ width, color, alpha: a, cap: 'round', join: 'round' });
  };

  drawPoly(geom.trunk, glowWidth, glowColor, alpha * 0.85);
  if (geom.branch) drawPoly(geom.branch, glowWidth * 0.7, glowColor, alpha * 0.55);
  drawPoly(geom.trunk, coreWidth, coreColor, alpha);
  if (geom.branch) drawPoly(geom.branch, coreWidth * 0.75, coreColor, alpha * 0.75);

  const r = 6 + alpha * 10;
  g.circle(geom.impact.x, geom.impact.y, r + 6).fill({ color: glowColor, alpha: alpha * 0.35 });
  g.circle(geom.impact.x, geom.impact.y, r).fill({ color: coreColor, alpha: alpha * 0.85 });
}
