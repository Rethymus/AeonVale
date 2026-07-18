import { describe, expect, it } from 'vitest';
import type { Tile } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';
import { cropGrowthFeedbackState, harvestLiftRadiusBonus, qiFlowVisualState, seedFallbackRadius, tileSelectionVisualState, tileReadinessState, tileSurfaceGrainSample, tileSurfaceVisualState, tileVisualState } from '@render/tileVisuals';

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

describe('tile surface semantic helper', () => {
  it('classifies tillable, plantable, occupied, and blocked ground', () => {
    expect(tileSurfaceVisualState(makeTile()).surfaceKind).toBe('tillable');
    expect(tileSurfaceVisualState(makeTile({ tilled: true })).surfaceKind).toBe('plantable');
    expect(tileSurfaceVisualState(makeTile({ tilled: true, cropId: 1 }), makeCrop()).surfaceKind).toBe('occupied');
    expect(tileSurfaceVisualState(makeTile({ soilType: 'rock' })).surfaceKind).toBe('blocked');
  });

  it('uses fine dense grain for farmable soil and coarse sparse grain for blocked ground', () => {
    const tillable = tileSurfaceVisualState(makeTile());
    const blocked = tileSurfaceVisualState(makeTile({ soilType: 'water', blockType: 'water' }));

    expect(tillable.grainKind).toBe('fine');
    expect(tillable.grainDensity).toBeGreaterThan(blocked.grainDensity);
    expect(blocked.grainKind).toBe('coarse');
    expect(blocked.baseTone).toBe('mountainMuted');
  });

  it('makes prepared soil darker and more orderly than raw tillable ground', () => {
    const tillable = tileSurfaceVisualState(makeTile());
    const plantable = tileSurfaceVisualState(makeTile({ tilled: true }));

    expect(plantable.baseTone).toBe('soilDeep');
    expect(plantable.baseToneAlpha).toBeGreaterThan(tillable.baseToneAlpha);
    expect(plantable.furrowAlpha).toBeGreaterThan(0);
    expect(tillable.furrowAlpha).toBe(0);
  });

  it('generates deterministic grain that varies by tile', () => {
    const tile = makeTile({ id: 17, x: 3, y: 1 });
    const same = tileSurfaceGrainSample(tile, 'fine', 2);
    const repeat = tileSurfaceGrainSample(tile, 'fine', 2);
    const neighbor = tileSurfaceGrainSample(makeTile({ id: 18, x: 4, y: 1 }), 'fine', 2);

    expect(repeat).toEqual(same);
    expect(neighbor).not.toEqual(same);
    expect(same.ox).toBeGreaterThanOrEqual(0.12);
    expect(same.ox).toBeLessThanOrEqual(0.88);
    expect(same.oy).toBeGreaterThanOrEqual(0.12);
    expect(same.oy).toBeLessThanOrEqual(0.88);
  });
});

describe('tile selection semantic helper', () => {
  it('returns zero visual output when the tile is not selected', () => {
    expect(tileSelectionVisualState({ selected: false, actionable: true, ambientTimeMs: 900, reducedMotion: false })).toEqual({
      selectionMaskAlpha: 0,
      selectionEdgeAlpha: 0,
      breathPhase: 0
    });
  });

  it('uses a moon-white mask and stronger breathing edge for actionable targets', () => {
    const actionable = tileSelectionVisualState({ selected: true, actionable: true, ambientTimeMs: 450, reducedMotion: false });
    const blocked = tileSelectionVisualState({ selected: true, actionable: false, ambientTimeMs: 450, reducedMotion: false });

    expect(actionable.selectionMaskAlpha).toBeCloseTo(0.125);
    expect(actionable.selectionEdgeAlpha).toBeGreaterThan(blocked.selectionEdgeAlpha);
    expect(actionable.breathPhase).toBeCloseTo(0.25);
  });

  it('freezes the breathing phase while reduced motion is enabled', () => {
    const early = tileSelectionVisualState({ selected: true, actionable: true, ambientTimeMs: 100, reducedMotion: true });
    const late = tileSelectionVisualState({ selected: true, actionable: true, ambientTimeMs: 50_000, reducedMotion: true });

    expect(early).toEqual(late);
    expect(early.breathPhase).toBe(0.5);
  });
});

describe('qi flow visual helper', () => {
  it('keeps sub-threshold or blocked ground visually quiet', () => {
    expect(qiFlowVisualState(makeTile({ qiDensity: 20_000 }), 1000, false).lineCount).toBe(0);
    expect(qiFlowVisualState(makeTile({ qiDensity: 100_000, soilType: 'rock' }), 1000, false)).toMatchObject({
      lineCount: 0,
      alpha: 0,
      phase: 0
    });
  });

  it('keeps untouched baseline fields quiet while prepared soil breathes', () => {
    expect(qiFlowVisualState(makeTile({ qiDensity: 30_000, tilled: false }), 1000, false).lineCount).toBe(0);
    expect(qiFlowVisualState(makeTile({ qiDensity: 30_000, tilled: true }), 1000, false).lineCount).toBe(1);
  });

  it('maps rising concentration monotonically to denser and deeper flow', () => {
    const low = qiFlowVisualState(makeTile({ qiDensity: 30_000, tilled: true }), 1000, false);
    const medium = qiFlowVisualState(makeTile({ qiDensity: 60_000, tilled: true }), 1000, false);
    const high = qiFlowVisualState(makeTile({ qiDensity: 100_000, tilled: true }), 1000, false);

    expect([low.lineCount, medium.lineCount, high.lineCount]).toEqual([1, 2, 3]);
    expect(medium.alpha).toBeGreaterThan(low.alpha);
    expect(high.alpha).toBeGreaterThan(medium.alpha);
    expect(high.lineWidth).toBeGreaterThanOrEqual(medium.lineWidth);
    expect(high.speed).toBeGreaterThanOrEqual(medium.speed);
    expect(high.amplitude).toBeGreaterThanOrEqual(medium.amplitude);
    expect(high.lineCount).toBeLessThanOrEqual(3);
  });

  it('is deterministic for the same tile/time and moves at another time', () => {
    const tile = makeTile({ id: 33, x: 5, y: 2, qiDensity: 70_000 });
    const first = qiFlowVisualState(tile, 1200, false);
    const repeat = qiFlowVisualState(tile, 1200, false);
    const later = qiFlowVisualState(tile, 2400, false);

    expect(repeat).toEqual(first);
    expect(later.phase).not.toBe(first.phase);
    expect(later.lineCount).toBe(first.lineCount);
    expect(later.alpha).toBe(first.alpha);
  });

  it('freezes phase under reduced motion while preserving density', () => {
    const tile = makeTile({ id: 44, x: 2, y: 3, qiDensity: 100_000 });
    const early = qiFlowVisualState(tile, 100, true);
    const late = qiFlowVisualState(tile, 50_000, true);

    expect(late).toEqual(early);
    expect(early.lineCount).toBe(3);
    expect(early.alpha).toBeGreaterThan(0);
  });
});

describe('crop growth feedback state', () => {
  it('reports zero progress and no overlays at seed (growth 0)', () => {
    const fb = cropGrowthFeedbackState(makeCrop({ growth: 0, stage: 'seed' }), 100_000, 0, false);
    expect(fb.progress).toBe(0);
    expect(fb.qiGatherAlpha).toBe(0);
    expect(fb.temperTintAlpha).toBe(0);
    expect(fb.matureGlowAlpha).toBe(0);
    expect(fb.maturePulsePhase).toBe(0);
  });

  it('clamps progress to 1 and marks mature at full growth even if sim stage lags', () => {
    const fb = cropGrowthFeedbackState(makeCrop({ growth: 100_000, stage: 'growing' }), 100_000, 0, false);
    expect(fb.progress).toBe(1);
    expect(fb.matureGlowAlpha).toBeGreaterThan(0);
  });

  it('keeps qi-gather and temper alpha monotonic and on-bounds across 25/50/75/100', () => {
    const ratios = [0.249, 0.25, 0.5, 0.749, 0.75, 0.99, 1];
    let prevQi = -1;
    let prevTemper = -1;
    for (const r of ratios) {
      const fb = cropGrowthFeedbackState(makeCrop({ growth: r * 100_000, stage: r >= 1 ? 'mature' : 'growing' }), 100_000, 0, false);
      expect(fb.qiGatherAlpha).toBeGreaterThanOrEqual(prevQi);
      expect(fb.temperTintAlpha).toBeGreaterThanOrEqual(prevTemper);
      prevQi = fb.qiGatherAlpha;
      prevTemper = fb.temperTintAlpha;
    }
    expect(cropGrowthFeedbackState(makeCrop({ growth: 0.249 * 100_000, stage: 'growing' }), 100_000, 0, false).qiGatherAlpha).toBe(0);
    expect(cropGrowthFeedbackState(makeCrop({ growth: 0.3 * 100_000, stage: 'growing' }), 100_000, 0, false).qiGatherAlpha).toBeGreaterThan(0);
    expect(cropGrowthFeedbackState(makeCrop({ growth: 0.749 * 100_000, stage: 'growing' }), 100_000, 0, false).temperTintAlpha).toBe(0);
    expect(cropGrowthFeedbackState(makeCrop({ growth: 0.8 * 100_000, stage: 'growing' }), 100_000, 0, false).temperTintAlpha).toBeGreaterThan(0);
  });

  it('freezes mature pulse phase under reduced motion and varies it otherwise', () => {
    const crop = makeCrop({ growth: 100_000, stage: 'mature' });
    expect(cropGrowthFeedbackState(crop, 100_000, 100, true).maturePulsePhase).toBe(cropGrowthFeedbackState(crop, 100_000, 50_000, true).maturePulsePhase);
    expect(cropGrowthFeedbackState(crop, 100_000, 100, false).maturePulsePhase).not.toBe(cropGrowthFeedbackState(crop, 100_000, 50_000, false).maturePulsePhase);
  });

  it('treats non-positive threshold safely without NaN', () => {
    const fb = cropGrowthFeedbackState(makeCrop({ growth: 50_000, stage: 'growing' }), 0, 0, false);
    expect(Number.isFinite(fb.progress)).toBe(true);
  });
});
