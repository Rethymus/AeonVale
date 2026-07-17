import { describe, expect, it } from 'vitest';
import type { Tile } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';
import {
  harvestLiftRadiusBonus,
  seedFallbackRadius,
  tileReadinessState,
  tileVisualState
} from '@render/tileVisuals';

function makeTile(overrides: Partial<Tile> = {}): Tile {
  return {
    id: 1,
    x: 0,
    y: 0,
    soilType: 'loam',
    fertility: 50_000,
    qiDensity: 10_000,
    moisture: 0,
    tilled: false,
    cropId: null,
    wateredToday: false,
    channeledToday: false,
    blockType: 'none',
    arrayId: null,
    consecutiveSameCropSeasons: 0,
    lastHarvestedCropDefId: null,
    ...overrides
  };
}

function makeCrop(overrides: Partial<CropInstance> = {}): CropInstance {
  return {
    id: 1,
    defId: 'herb.mossling',
    tileId: 1,
    growth: 0,
    health: 100_000,
    stage: 'seed',
    plantedDay: 1,
    property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
    tempered: false,
    ...overrides
  };
}

describe('tile visual state helper', () => {
  it('keeps untouched ground visually quiet (empty)', () => {
    expect(tileVisualState(makeTile())).toEqual({
      dampAlpha: 0,
      qiGlowAlpha: 0,
      showWaterMark: false,
      showChannelMark: false,
      tilledContrastAlpha: 0,
      tilledBorderAlpha: 0,
      waterSheenAlpha: 0,
      seedVisible: false,
      seedScale: 1,
      harvestLift: false
    });
  });

  it('marks tilled soil with contrast and border (tilled, not watered)', () => {
    const state = tileVisualState(makeTile({ tilled: true }));
    expect(state.tilledContrastAlpha).toBeGreaterThan(0.4);
    expect(state.tilledBorderAlpha).toBeGreaterThan(0.3);
    expect(state.waterSheenAlpha).toBe(0);
    expect(state.showWaterMark).toBe(false);
    expect(state.seedVisible).toBe(false);
    expect(state.harvestLift).toBe(false);
  });

  it('shows explicit same-day care markers and sheen on watered tilled tiles', () => {
    const state = tileVisualState(makeTile({ tilled: true, wateredToday: true, channeledToday: true, moisture: 40_000 }));
    expect(state.showWaterMark).toBe(true);
    expect(state.showChannelMark).toBe(true);
    expect(state.tilledContrastAlpha).toBeGreaterThan(0.6);
    expect(state.waterSheenAlpha).toBeGreaterThan(0.3);
    expect(state.dampAlpha).toBeGreaterThan(0);
  });

  it('derives dampness and qi glow intensity from tile resources', () => {
    const state = tileVisualState(makeTile({ tilled: true, moisture: 70_000, qiDensity: 70_000 }));

    expect(state.dampAlpha).toBeGreaterThan(0.2);
    expect(state.qiGlowAlpha).toBeGreaterThan(0.3);
    expect(state.showWaterMark).toBe(false);
    expect(state.showChannelMark).toBe(false);
    expect(state.tilledContrastAlpha).toBeGreaterThan(0.4);
  });

  it('makes empty < tilled < watered contrast progression distinct', () => {
    const empty = tileVisualState(makeTile());
    const tilled = tileVisualState(makeTile({ tilled: true }));
    const watered = tileVisualState(makeTile({ tilled: true, wateredToday: true, moisture: 50_000 }));

    expect(empty.tilledContrastAlpha).toBe(0);
    expect(tilled.tilledContrastAlpha).toBeGreaterThan(empty.tilledContrastAlpha);
    expect(watered.tilledContrastAlpha).toBeGreaterThan(tilled.tilledContrastAlpha);
    expect(watered.waterSheenAlpha).toBeGreaterThan(tilled.waterSheenAlpha);
    expect(watered.showWaterMark).toBe(true);
    expect(tilled.showWaterMark).toBe(false);
  });

  it('emphasizes planted seed stage (sown)', () => {
    const seed = tileVisualState(makeTile({ tilled: true }), makeCrop({ stage: 'seed' }));
    expect(seed.seedVisible).toBe(true);
    expect(seed.seedScale).toBeGreaterThan(1);
    expect(seed.harvestLift).toBe(false);
    expect(seedFallbackRadius(seed, 3)).toBeGreaterThan(3);

    const emptyTilled = tileVisualState(makeTile({ tilled: true }));
    expect(emptyTilled.seedVisible).toBe(false);
    expect(emptyTilled.seedScale).toBe(1);
  });

  it('emphasizes mature harvest lift', () => {
    const mature = tileVisualState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'mature' }));
    expect(mature.harvestLift).toBe(true);
    expect(mature.seedVisible).toBe(false);
    expect(harvestLiftRadiusBonus(mature)).toBe(3);

    const growing = tileVisualState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'growing' }));
    expect(growing.harvestLift).toBe(false);
    expect(harvestLiftRadiusBonus(growing)).toBe(0);
  });

  it('does not require crop for watered/tilled correctness', () => {
    const watered = tileVisualState(makeTile({ tilled: true, wateredToday: true, moisture: 60_000 }));
    expect(watered.waterSheenAlpha).toBeGreaterThan(0.3);
    expect(watered.seedVisible).toBe(false);
    expect(watered.harvestLift).toBe(false);
  });
});

describe('tile readiness helper', () => {
  it('marks mature crops as harvest-ready', () => {
    expect(tileReadinessState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'mature' }))).toEqual({
      kind: 'harvest-ready',
      showHarvestHalo: true,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: false,
      actionable: true
    });
  });

  it('marks empty tilled ground as plant-ready', () => {
    expect(tileReadinessState(makeTile({ tilled: true }))).toEqual({
      kind: 'plant-ready',
      showHarvestHalo: false,
      showPlantCue: true,
      showTillCue: false,
      showBlockedCue: false,
      actionable: true
    });
  });

  it('marks raw usable ground as till-ready', () => {
    expect(tileReadinessState(makeTile())).toEqual({
      kind: 'till-ready',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: true,
      showBlockedCue: false,
      actionable: true
    });
  });

  it('marks obstructed or unusable ground as blocked', () => {
    expect(tileReadinessState(makeTile({ blockType: 'tree' }))).toEqual({
      kind: 'blocked',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: true,
      actionable: false
    });
    expect(tileReadinessState(makeTile({ soilType: 'water' }))).toEqual({
      kind: 'blocked',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: true,
      actionable: false
    });
  });

  it('keeps non-mature occupied tiles idle when no direct action is available', () => {
    expect(tileReadinessState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'growing' }))).toEqual({
      kind: 'idle',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: false,
      actionable: false
    });
  });
});
