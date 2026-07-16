import { describe, expect, it } from 'vitest';
import { MIN_TOUCH_TARGET_PX, computeViewportLayout, type Rect, type SafeAreaInsets } from '@render/viewportLayout';

function right(rect: Rect): number {
  return rect.x + rect.width;
}

function bottom(rect: Rect): number {
  return rect.y + rect.height;
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < right(b) && right(a) > b.x && a.y < bottom(b) && bottom(a) > b.y;
}

function expectInside(inner: Rect, outer: Rect): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(right(inner)).toBeLessThanOrEqual(right(outer));
  expect(bottom(inner)).toBeLessThanOrEqual(bottom(outer));
}

describe('responsive viewport layout', () => {
  it('uses a world-first desktop layout and expands beyond the former 960px cap', () => {
    const layout = computeViewportLayout({ width: 1440, height: 900, touchCapable: false });

    expect(layout.profile).toBe('desktop');
    expect(layout.canvas).toMatchObject({ width: 1440, height: 810 });
    expect(layout.canvas!.y).toBe(45);
    expect(layout.regions).not.toBeNull();
    expect(layout.regions!.world.width / layout.regions!.content.width).toBeGreaterThanOrEqual(0.72);
    expect(layout.regions!.world.width / layout.regions!.content.width).toBeLessThanOrEqual(0.78);
    expect(overlaps(layout.regions!.world, layout.regions!.objectiveRail)).toBe(false);
    expect(overlaps(layout.regions!.statusBar, layout.regions!.content)).toBe(false);
    expect(overlaps(layout.regions!.content, layout.regions!.actionBar)).toBe(false);
    expect(layout.touch).toBeNull();
  });

  it('fills a 736x414 landscape viewport and enables safe 44px touch controls', () => {
    const layout = computeViewportLayout({ width: 736, height: 414, touchCapable: true });

    expect(layout.profile).toBe('compact-landscape');
    expect(layout.canvas).toEqual({ x: 0, y: 0, width: 736, height: 414 });
    expect(layout.touch).not.toBeNull();

    const targets = Object.values(layout.touch!.targets);
    for (const target of targets) {
      expect(target.width).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      expect(target.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);
      expectInside(target, layout.safeBounds);
    }
    for (let i = 0; i < targets.length; i += 1) {
      for (let j = i + 1; j < targets.length; j += 1) {
        expect(overlaps(targets[i]!, targets[j]!)).toBe(false);
      }
    }
  });

  it('does not claim touch playability when the landscape short side is below 360px', () => {
    const layout = computeViewportLayout({ width: 640, height: 320, touchCapable: true });

    expect(layout.profile).toBe('compact-landscape');
    expect(layout.touch).toBeNull();
  });

  it('returns a portrait gate instead of a compressed game layout', () => {
    const layout = computeViewportLayout({ width: 390, height: 844, touchCapable: true });

    expect(layout.profile).toBe('portrait-blocked');
    expect(layout.canvas).toBeNull();
    expect(layout.regions).toBeNull();
    expect(layout.touch).toBeNull();
    expect(layout.orientationGate).toEqual(layout.safeBounds);
  });

  it('keeps canvas and touch targets inside non-zero safe-area insets', () => {
    const safeArea: SafeAreaInsets = { top: 12, right: 24, bottom: 18, left: 20 };
    const layout = computeViewportLayout({ width: 844, height: 390, touchCapable: true, safeArea });

    expect(layout.profile).toBe('compact-landscape');
    expect(layout.safeBounds).toEqual({ x: 20, y: 12, width: 800, height: 360 });
    expectInside(layout.canvas!, layout.safeBounds);
    for (const target of Object.values(layout.touch!.targets)) expectInside(target, layout.safeBounds);
  });

  it('rejects invalid viewport and safe-area geometry', () => {
    expect(() => computeViewportLayout({ width: 0, height: 414, touchCapable: true })).toThrow(/positive finite/);
    expect(() => computeViewportLayout({ width: 736, height: Number.NaN, touchCapable: true })).toThrow(/positive finite/);
    expect(() => computeViewportLayout({ width: 736, height: 414, touchCapable: true, safeArea: { top: 0, right: 400, bottom: 0, left: 400 } })).toThrow(/safe area/i);
  });
});
