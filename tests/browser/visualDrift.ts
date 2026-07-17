/**
 * 视觉 snapshot 软门：纯函数漂移评估（体验门，dev 辅助）。
 *
 * 动态 Pixi 画面的逐像素回归极易抖动，故采用"绘制率 + 色彩丰富度"两枚粗指标，
 * 与基线比较；超出容差仅告警（软门），永不硬性失败 CI。基线 JSON 由首次运行写入。
 */

export interface VisualSample {
  /** 采样像素数。 */
  readonly sampled: number;
  /** 非透明（已绘制）像素数。 */
  readonly painted: number;
  /** 不同颜色数（色彩丰富度）。 */
  readonly colors: number;
}

export interface VisualBaseline {
  readonly paintedRatio: number;
  readonly colors: number;
}

export interface VisualDriftTolerance {
  /** 绘制率允许的绝对偏差（0..1）。 */
  readonly paintedRatioAbs: number;
  /** 色彩丰富度允许的相对偏差（0..1）。 */
  readonly colorsRel: number;
}

export const DEFAULT_VISUAL_TOLERANCE: VisualDriftTolerance = Object.freeze({
  paintedRatioAbs: 0.15,
  colorsRel: 0.4
});

export interface VisualDriftVerdict {
  readonly warn: boolean;
  readonly reason: string;
  readonly paintedRatio: number;
  readonly paintedRatioDelta: number;
  readonly colorsDeltaRel: number;
}

export function sampleToBaseline(sample: VisualSample): VisualBaseline {
  const paintedRatio = sample.sampled > 0 ? sample.painted / sample.sampled : 0;
  return { paintedRatio, colors: sample.colors };
}

/** 比较当前采样与基线，返回软门判定（warn=true 表示漂移超容差，需人眼复核）。 */
export function evaluateVisualDrift(
  sample: VisualSample,
  baseline: VisualBaseline | null,
  tolerance: VisualDriftTolerance = DEFAULT_VISUAL_TOLERANCE
): VisualDriftVerdict {
  const current = sampleToBaseline(sample);
  if (baseline === null) {
    return {
      warn: false,
      reason: 'no-baseline：首次运行，已写入新基线（后续运行开始比较）',
      paintedRatio: current.paintedRatio,
      paintedRatioDelta: 0,
      colorsDeltaRel: 0
    };
  }
  const paintedRatioDelta = Math.abs(current.paintedRatio - baseline.paintedRatio);
  const colorsDeltaRel = baseline.colors > 0 ? Math.abs(current.colors - baseline.colors) / baseline.colors : 0;
  const warn = paintedRatioDelta > tolerance.paintedRatioAbs || colorsDeltaRel > tolerance.colorsRel;
  const parts: string[] = [];
  if (paintedRatioDelta > tolerance.paintedRatioAbs) parts.push(`绘制率 Δ=${paintedRatioDelta.toFixed(3)}>${tolerance.paintedRatioAbs}`);
  if (colorsDeltaRel > tolerance.colorsRel) parts.push(`色彩 Δ=${(colorsDeltaRel * 100).toFixed(0)}%>${(tolerance.colorsRel * 100).toFixed(0)}%`);
  return {
    warn,
    reason: warn ? `视觉漂移超容差：${parts.join('；')}` : '视觉快照在容差内',
    paintedRatio: current.paintedRatio,
    paintedRatioDelta,
    colorsDeltaRel
  };
}
