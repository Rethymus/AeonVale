import { describe, expect, it } from 'vitest';
import { DEFAULT_BALANCE } from '@sim';
import { bodyLeakPresentation, BODY_LAYER_NAMES } from '@app/bodyLeakPresentation';

describe('body leak presentation', () => {
  it('stage 0 (凡骨) leaves all seven layers leaking', () => {
    const fb = bodyLeakPresentation({ stage: 0, bodyFoundation: 0 }, DEFAULT_BALANCE);
    expect(fb.stage).toBe(0);
    expect(fb.sealedCount).toBe(0);
    expect(fb.currentProgress).toBe(0);
    expect(fb.layers).toHaveLength(7);
    expect(fb.layers.every(l => l.status === 'leaking')).toBe(true);
  });

  it('seals layers up to stage and shows bodyFoundation/cap(stage) on the next layer', () => {
    // stage 1: cap(1) = foundationCap[0] = 100_000；50k → 进度 0.5
    const fb = bodyLeakPresentation({ stage: 1, bodyFoundation: 50_000 }, DEFAULT_BALANCE);
    expect(fb.sealedCount).toBe(1);
    expect(fb.currentProgress).toBeCloseTo(0.5, 5);
    expect(fb.layers[0]?.status).toBe('sealed');           // 皮膜
    expect(fb.layers[0]?.progress).toBe(1);
    expect(fb.layers[1]?.status).toBe('progressing');      // 骨架
    expect(fb.layers[1]?.progress).toBeCloseTo(0.5, 5);
    expect(fb.layers[2]?.status).toBe('leaking');          // 经脉及以后
    expect(fb.layers[6]?.name).toBe('空窍·丹田');
  });

  it('marks the current next layer ready (progress 1) when bodyFoundation meets the cap', () => {
    const cap3 = DEFAULT_BALANCE.bodyCultivation.foundationCap[2] ?? 400_000; // stage 3
    const fb = bodyLeakPresentation({ stage: 3, bodyFoundation: cap3 }, DEFAULT_BALANCE);
    expect(fb.sealedCount).toBe(3);
    expect(fb.currentProgress).toBe(1);
    expect(fb.layers[3]?.status).toBe('progressing');
    expect(fb.layers[3]?.progress).toBe(1);
  });

  it('stage 7 seals every layer (飞升前夜)', () => {
    const fb = bodyLeakPresentation({ stage: 7, bodyFoundation: 9_999_999 }, DEFAULT_BALANCE);
    expect(fb.sealedCount).toBe(7);
    expect(fb.currentProgress).toBe(1);
    expect(fb.layers.every(l => l.status === 'sealed')).toBe(true);
  });

  it('clamps progress for out-of-range bodyFoundation and handles garbage safely', () => {
    const over = bodyLeakPresentation({ stage: 1, bodyFoundation: 999_999_999 }, DEFAULT_BALANCE);
    expect(over.currentProgress).toBe(1);
    expect(over.layers[1]?.progress).toBe(1);
    const neg = bodyLeakPresentation({ stage: 2, bodyFoundation: -50 }, DEFAULT_BALANCE);
    expect(neg.currentProgress).toBe(0);
    const nan = bodyLeakPresentation({ stage: 2, bodyFoundation: Number.NaN }, DEFAULT_BALANCE);
    expect(nan.currentProgress).toBe(0);
  });

  it('exposes seven canonical layer names in cultivation order', () => {
    expect(BODY_LAYER_NAMES).toEqual(['皮膜', '骨架', '经脉', '髓海', '血脉', '雷骨', '空窍·丹田']);
  });
});
