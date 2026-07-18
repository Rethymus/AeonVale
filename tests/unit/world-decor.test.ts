import { describe, expect, it } from 'vitest';
import type { Graphics } from 'pixi.js';
import {
  WORLD_DECOR_HARD_CAP,
  WORLD_DECOR_MAX_DENSITY,
  paintWorldDecor,
  worldDecorPlacements,
  worldDecorSeed,
  type WorldDecorKind,
  type WorldDecorPlacement,
  type WorldDecorTileView
} from '@render/worldDecor';

describe('paintWorldDecor · 常驻微动 (tMs)', () => {
  // 链式 no-op Graphics 替身：任意方法调用回自身（roundRect().fill() 等链式不报错）
  function fakeGraphics(): Graphics {
    const g = new Proxy({} as Record<string, (...a: unknown[]) => unknown>, { get: () => () => g });
    return g as unknown as Graphics;
  }
  const kinds: WorldDecorKind[] = ['path-stone', 'grass-tuft', 'pebble', 'mist-band', 'fence-post'];

  it('每种装饰在静态(tMs=0)与微动(tMs>0)时钟下均不抛', () => {
    for (const kind of kinds) {
      const placement: WorldDecorPlacement = { kind, x: 1, y: 1, ox: 0.5, oy: 0.5, variant: 0 };
      expect(() => paintWorldDecor(fakeGraphics(), placement, 0, 0, 32)).not.toThrow();
      expect(() => paintWorldDecor(fakeGraphics(), placement, 0, 0, 32, 12345)).not.toThrow();
    }
  });
});

function makeTile(overrides: Partial<WorldDecorTileView> & Pick<WorldDecorTileView, 'id' | 'x' | 'y'>): WorldDecorTileView {
  return {
    soilType: 'loam',
    tilled: false,
    cropId: null,
    blockType: 'none',
    ...overrides
  };
}

function grid(width: number, height: number, paint?: (x: number, y: number, id: number) => Partial<WorldDecorTileView>): WorldDecorTileView[] {
  const tiles: WorldDecorTileView[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const id = y * width + x;
      tiles.push(makeTile({ id, x, y, ...(paint?.(x, y, id) ?? {}) }));
    }
  }
  return tiles;
}

describe('worldDecorSeed', () => {
  it('is deterministic for the same tileId', () => {
    expect(worldDecorSeed(42)).toBe(worldDecorSeed(42));
    expect(worldDecorSeed(0)).toBe(worldDecorSeed(0));
  });

  it('is deterministic for the same x,y pair', () => {
    expect(worldDecorSeed(3, 7)).toBe(worldDecorSeed(3, 7));
    expect(worldDecorSeed(0, 0)).toBe(worldDecorSeed(0, 0));
  });

  it('varies across coordinates and ids', () => {
    expect(worldDecorSeed(1, 2)).not.toBe(worldDecorSeed(2, 1));
    expect(worldDecorSeed(10)).not.toBe(worldDecorSeed(11));
  });
});

describe('worldDecorPlacements', () => {
  it('returns the same placements for the same seed world', () => {
    const tiles = grid(14, 9);
    const a = worldDecorPlacements(14, 9, tiles, { hasFacilities: true });
    const b = worldDecorPlacements(14, 9, tiles, { hasFacilities: true });
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('keeps density bounded relative to map size', () => {
    const width = 14;
    const height = 9;
    const tiles = grid(width, height);
    const placements = worldDecorPlacements(width, height, tiles, { hasFacilities: true });
    const maxByDensity = Math.floor(width * height * WORLD_DECOR_MAX_DENSITY);
    expect(placements.length).toBeLessThanOrEqual(maxByDensity);
    expect(placements.length).toBeLessThanOrEqual(WORLD_DECOR_HARD_CAP);
    expect(placements.length / (width * height)).toBeLessThanOrEqual(WORLD_DECOR_MAX_DENSITY);
  });

  it('never places on water or rock tiles when soil type is known', () => {
    const width = 10;
    const height = 8;
    const tiles = grid(width, height, (x, y) => {
      if (x === 0) return { soilType: 'water', blockType: 'water' };
      if (y === 0) return { soilType: 'rock', blockType: 'rock' };
      if (x === width - 1) return { soilType: 'metal-ore', blockType: 'rock' };
      return {};
    });

    const placements = worldDecorPlacements(width, height, tiles, { hasFacilities: true });
    for (const p of placements) {
      const tile = tiles[p.y * width + p.x]!;
      expect(tile.soilType).not.toBe('water');
      expect(tile.soilType).not.toBe('rock');
      expect(tile.soilType).not.toBe('metal-ore');
      expect(tile.blockType).toBe('none');
    }
  });

  it('skips tilled, cropped, and center-critical tiles', () => {
    const width = 11;
    const height = 9;
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const tiles = grid(width, height, (x, y) => {
      if (x === 1 && y === 1) return { tilled: true };
      if (x === 2 && y === 2) return { cropId: 99 };
      return {};
    });

    const placements = worldDecorPlacements(width, height, tiles);
    for (const p of placements) {
      expect(p.x === 1 && p.y === 1).toBe(false);
      expect(p.x === 2 && p.y === 2).toBe(false);
      expect(Math.abs(p.x - cx) <= 2 && Math.abs(p.y - cy) <= 2).toBe(false);
    }
  });

  it('only emits mist bands on far y rows', () => {
    const width = 12;
    const height = 8;
    const tiles = grid(width, height);
    const placements = worldDecorPlacements(width, height, tiles);
    for (const p of placements.filter(entry => entry.kind === 'mist-band')) {
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it('only emits fence posts when facilities exist', () => {
    const tiles = grid(14, 9);
    const without = worldDecorPlacements(14, 9, tiles, { hasFacilities: false });
    const withFacilities = worldDecorPlacements(14, 9, tiles, { hasFacilities: true });
    expect(without.every(p => p.kind !== 'fence-post')).toBe(true);
    // 有设施时允许出现篱笆（若边格全被挡则可能为 0，但默认全 loam 应有）
    expect(withFacilities.some(p => p.kind === 'fence-post')).toBe(true);
  });

  it('includes path stones on the soft diagonal or edge path', () => {
    const tiles = grid(14, 9);
    const placements = worldDecorPlacements(14, 9, tiles);
    const pathStones = placements.filter(p => p.kind === 'path-stone');
    expect(pathStones.length).toBeGreaterThan(0);
  });

  it('returns empty for empty inputs', () => {
    expect(worldDecorPlacements(0, 0, [])).toEqual([]);
    expect(worldDecorPlacements(14, 9, [])).toEqual([]);
  });
});
