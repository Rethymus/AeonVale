import { describe, expect, it } from 'vitest';
import {
  worldDecorDensity,
  worldDecorPlacements,
  worldDecorSeed,
  worldDecorUnit,
  type WorldDecorTileLike
} from '@render/worldDecor';

function grid(w: number, h: number, overrides: Partial<WorldDecorTileLike> = {}): WorldDecorTileLike[] {
  const tiles: WorldDecorTileLike[] = [];
  let id = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      tiles.push({
        id: id++,
        x,
        y,
        soilType: 'loam',
        tilled: false,
        cropId: null,
        blockType: 'none',
        ...overrides
      });
    }
  }
  return tiles;
}

describe('worldDecor', () => {
  it('is deterministic for the same layout', () => {
    const tiles = grid(8, 6);
    const a = worldDecorPlacements(8, 6, tiles);
    const b = worldDecorPlacements(8, 6, tiles);
    expect(a).toEqual(b);
  });

  it('keeps unit noise in [0,1)', () => {
    for (let i = 0; i < 50; i++) {
      const u = worldDecorUnit(worldDecorSeed(i % 7, (i * 3) % 5, i));
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });

  it('bounds density and skips tilled/water/rock', () => {
    const tiles = grid(10, 10);
    tiles[0] = { ...tiles[0]!, tilled: true };
    tiles[1] = { ...tiles[1]!, soilType: 'water' };
    tiles[2] = { ...tiles[2]!, soilType: 'rock' };
    const placements = worldDecorPlacements(10, 10, tiles, { maxDensity: 0.22 });
    expect(worldDecorDensity(placements, tiles.length)).toBeLessThanOrEqual(0.22 + 1e-9);
    for (const p of placements) {
      expect(!(p.x === 0 && p.y === 0)).toBe(true);
    }
  });

  it('returns empty for empty inputs', () => {
    expect(worldDecorPlacements(0, 0, [])).toEqual([]);
  });
});
