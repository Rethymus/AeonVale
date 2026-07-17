import { describe, expect, it } from 'vitest';
import {
  ensureReadablePlayerTint,
  facingIndicatorOffset,
  facingScaleX,
  footShadowSpec,
  playerPresenceOverlay,
  qiSparklePhase,
  shouldDrawQiSparkles,
  type Facing4
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

  it('uses a warm readable player tint (not pure black/white)', () => {
    const tint = ensureReadablePlayerTint();
    expect(tint).not.toBe(0x000000);
    expect(tint).not.toBe(0xffffff);
    const r = (tint >> 16) & 0xff;
    const g = (tint >> 8) & 0xff;
    const b = tint & 0xff;
    // 暖调：R 最高，B 相对较低
    expect(r).toBeGreaterThan(0xb0);
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(0x80);
  });

  it('builds presence overlay with robe/head bands and translucent sprite alpha', () => {
    const overlay = playerPresenceOverlay('down');
    expect(overlay.tint).toBe(ensureReadablePlayerTint());
    expect(overlay.spriteAlpha).toBeGreaterThan(0.3);
    expect(overlay.spriteAlpha).toBeLessThan(1);
    expect(overlay.bands.length).toBeGreaterThanOrEqual(4);

    const kinds = new Set(overlay.bands.map(b => b.kind));
    expect(kinds.has('robe')).toBe(true);
    expect(kinds.has('head')).toBe(true);

    const layers = new Set(overlay.bands.map(b => b.layer));
    expect(layers.has('under')).toBe(true);
    expect(layers.has('over')).toBe(true);

    for (const band of overlay.bands) {
      expect(band.alpha).toBeGreaterThan(0);
      expect(band.alpha).toBeLessThanOrEqual(1);
      expect(band.rx).toBeGreaterThan(0);
      expect(band.ry).toBeGreaterThan(0);
      // 朱砂/暖袍/肤色/鎏金：非纯黑
      expect(band.color).not.toBe(0x000000);
      expect(band.color).not.toBe(0x0e0e14);
    }
  });

  it('shifts presence bands with facing for directional readability', () => {
    const facings: Facing4[] = ['left', 'right', 'up', 'down'];
    const overlays = Object.fromEntries(facings.map(f => [f, playerPresenceOverlay(f)])) as Record<
      Facing4,
      ReturnType<typeof playerPresenceOverlay>
    >;

    const leftRobe = overlays.left.bands.find(b => b.kind === 'robe' && b.layer === 'under')!;
    const rightRobe = overlays.right.bands.find(b => b.kind === 'robe' && b.layer === 'under')!;
    const upRobe = overlays.up.bands.find(b => b.kind === 'robe' && b.layer === 'under')!;
    const downRobe = overlays.down.bands.find(b => b.kind === 'robe' && b.layer === 'under')!;

    expect(leftRobe.ox).toBeLessThan(rightRobe.ox);
    expect(upRobe.oy).toBeLessThan(downRobe.oy);
  });
});
