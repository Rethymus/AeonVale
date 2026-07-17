import { describe, expect, it } from 'vitest';
import {
  facingIndicatorOffset,
  facingScaleX,
  footShadowSpec,
  qiSparklePhase,
  shouldDrawQiSparkles
} from '@render/characterPresence';

describe('characterPresence', () => {
  it('mirrors only when facing left', () => {
    expect(facingScaleX('left')).toBe(-1);
    expect(facingScaleX('right')).toBe(1);
    expect(facingScaleX('up')).toBe(1);
    expect(facingScaleX('down')).toBe(1);
  });

  it('places facing indicator outside the body', () => {
    expect(facingIndicatorOffset('right', 12)).toEqual({ x: 12, y: 0 });
    expect(facingIndicatorOffset('left', 12)).toEqual({ x: -12, y: 0 });
    expect(facingIndicatorOffset('up', 12)).toEqual({ x: 0, y: -12 });
    expect(facingIndicatorOffset('down', 12)).toEqual({ x: 0, y: 12 });
  });

  it('gives player a larger foot shadow than npcs', () => {
    const player = footShadowSpec('player');
    const npc = footShadowSpec('npc');
    expect(player.width).toBeGreaterThan(npc.width);
    expect(player.alpha).toBeGreaterThan(0.2);
    expect(npc.alpha).toBeGreaterThan(0.2);
  });

  it('keeps qi sparkle phase in unit interval', () => {
    for (const t of [0, 900, 1800, 2700, 5400]) {
      const p = qiSparklePhase(t, 3);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(1);
    }
    expect(qiSparklePhase(Number.NaN, 0)).toBeGreaterThanOrEqual(0);
  });

  it('only sparkles on tilled high-qi tiles', () => {
    expect(shouldDrawQiSparkles(50_000, true)).toBe(true);
    expect(shouldDrawQiSparkles(50_000, false)).toBe(false);
    expect(shouldDrawQiSparkles(10_000, true)).toBe(false);
    expect(shouldDrawQiSparkles(40_000, true)).toBe(true);
  });
});
