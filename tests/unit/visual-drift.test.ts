import { describe, expect, it } from 'vitest';

import {
  evaluateVisualDrift,
  sampleToBaseline,
  DEFAULT_VISUAL_TOLERANCE,
  type VisualSample
} from '../browser/visualDrift';

function sample(painted: number, sampled: number, colors: number): VisualSample {
  return { painted, sampled, colors };
}

describe('evaluateVisualDrift (soft visual gate)', () => {
  it('creates a baseline on first run without warning', () => {
    const v = evaluateVisualDrift(sample(500, 1000, 120), null);
    expect(v.warn).toBe(false);
    expect(v.reason).toContain('no-baseline');
  });

  it('passes when the sample is within tolerance', () => {
    const baseline = sampleToBaseline(sample(500, 1000, 120)); // ratio 0.5, colors 120
    const v = evaluateVisualDrift(sample(560, 1000, 130), baseline);
    expect(v.warn).toBe(false);
    expect(v.paintedRatioDelta).toBeCloseTo(0.06, 2);
  });

  it('warns when paint coverage drifts beyond tolerance', () => {
    const baseline = sampleToBaseline(sample(500, 1000, 120));
    const v = evaluateVisualDrift(sample(200, 1000, 125), baseline); // ratio 0.2 vs 0.5 → Δ0.3
    expect(v.warn).toBe(true);
    expect(v.reason).toContain('绘制率');
  });

  it('warns when color richness drifts beyond tolerance', () => {
    const baseline = sampleToBaseline(sample(500, 1000, 120));
    const v = evaluateVisualDrift(sample(510, 1000, 40), baseline); // colors 40 vs 120 → ~67% rel
    expect(v.warn).toBe(true);
    expect(v.reason).toContain('色彩');
  });

  it('respects a custom tighter tolerance', () => {
    const baseline = sampleToBaseline(sample(500, 1000, 120));
    const v = evaluateVisualDrift(sample(520, 1000, 120), baseline, { paintedRatioAbs: 0.01, colorsRel: 0.01 });
    // Δratio 0.02 > 0.01 → warn under tight tolerance (would pass under default).
    expect(v.warn).toBe(true);
  });

  it('default tolerance is generous enough for small animation jitter', () => {
    expect(DEFAULT_VISUAL_TOLERANCE.paintedRatioAbs).toBeGreaterThan(0.05);
    expect(DEFAULT_VISUAL_TOLERANCE.colorsRel).toBeGreaterThan(0.1);
  });
});
