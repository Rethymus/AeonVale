import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import {
  applyFarmsteadSceneLayout,
  canUseFarmActionOnFarmsteadTile,
  farmsteadSceneEnabled,
  farmsteadSceneLayout,
  farmsteadSceneTileKind,
  farmsteadSceneObjectAt,
  firstFarmsteadFarmPlotTile,
  firstNonFarmsteadFarmPlotTile,
  isFarmsteadFarmPlotTile
} from '@app/farmsteadScene';

describe('farmstead scene layout', () => {
  it('gives the formal farmstead a bounded herb plot and fixed scene objects', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    applyFarmsteadSceneLayout(state, { resetHerbPlot: true });

    const layout = farmsteadSceneLayout(state);
    expect(farmsteadSceneEnabled(state)).toBe(true);
    expect(layout.herbPlot).toEqual({ x: 3, y: 4, width: 5, height: 4 });
    expect(isFarmsteadFarmPlotTile(state, 3, 4)).toBe(true);
    expect(isFarmsteadFarmPlotTile(state, 7, 7)).toBe(true);
    expect(isFarmsteadFarmPlotTile(state, 2, 4)).toBe(false);
    expect(farmsteadSceneObjectAt(state, 3, 2)?.kind).toBe('storage');
    expect(farmsteadSceneObjectAt(state, 2, 3)?.kind).toBe('shipping');
    expect(farmsteadSceneObjectAt(state, 10, 2)?.kind).toBe('furnace');
    expect(farmsteadSceneObjectAt(state, 8, 6)?.kind).toBe('array-shed');
    expect(farmsteadSceneObjectAt(state, 12, 7)?.kind).toBe('map-gate');
    expect(state.tiles.find(tile => tile.x === 3 && tile.y === 2)?.blockType).toBe('building');
  });

  it('migrates legacy farm state under scene objects into blocked footprints', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    const objectTiles = farmsteadSceneLayout(state).objects.flatMap(object => {
      const footprint = object.footprint ?? { x: object.x, y: object.y, width: 1, height: 1 };
      const points: Array<{ x: number; y: number }> = [];
      for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
        for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) points.push({ x, y });
      }
      return points;
    });

    for (const point of objectTiles) {
      const tile = state.tiles.find(entry => entry.x === point.x && entry.y === point.y)!;
      tile.blockType = 'none';
      tile.soilType = 'rock';
      tile.tilled = true;
      tile.cropId = tile.id;
      tile.wateredToday = true;
      tile.channeledToday = true;
      tile.arrayId = 10_000 + tile.id;
      state.crops.set(tile.id, {
        id: tile.id,
        defId: 'herb.mossling',
        tileId: tile.id,
        growth: 0,
        health: 100_000,
        stage: 'seed',
        plantedDay: state.day,
        property: { cold: 0, hot: 0, warm: 0, neutral: 10_000 },
        tempered: false
      });
      state.arrays.set(tile.arrayId, {
        id: tile.arrayId,
        defId: 'array.insulation',
        modifier: 0.5,
        coreTileId: tile.id,
        coverageTileIds: [tile.id],
        power: 100,
        active: true
      });
    }
    const coveredOnlyTile = state.tiles.find(tile => !objectTiles.some(point => point.x === tile.x && point.y === tile.y))!;
    const coveredObjectTile = state.tiles.find(tile => objectTiles.some(point => point.x === tile.x && point.y === tile.y))!;
    state.arrays.set(99_999, {
      id: 99_999,
      defId: 'array.insulation',
      modifier: 0.5,
      coreTileId: coveredOnlyTile.id,
      coverageTileIds: [coveredOnlyTile.id, coveredObjectTile.id],
      power: 100,
      active: true
    });

    expect(applyFarmsteadSceneLayout(state)).toBe(true);

    for (const point of objectTiles) {
      const tile = state.tiles.find(entry => entry.x === point.x && entry.y === point.y)!;
      expect(tile.blockType).toBe('building');
      expect(tile.soilType).toBe('loam');
      expect(tile.tilled).toBe(false);
      expect(tile.cropId).toBeNull();
      expect(tile.wateredToday).toBe(false);
      expect(tile.channeledToday).toBe(false);
      expect(tile.arrayId).toBeNull();
      expect(state.crops.has(tile.id)).toBe(false);
      expect([...state.arrays.values()].some(array => array.coreTileId === tile.id || array.coverageTileIds.includes(tile.id))).toBe(false);
    }
    expect(state.arrays.get(99_999)?.coverageTileIds).toEqual([coveredOnlyTile.id]);
  });

  it('composes the default farmstead from multiple non-farm valley zones', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    applyFarmsteadSceneLayout(state, { resetHerbPlot: true });

    const zones = new Set(state.tiles.map(tile => farmsteadSceneTileKind(state, tile.x, tile.y)));
    expect(zones.has('herb-plot')).toBe(true);
    expect(zones.has('courtyard')).toBe(true);
    expect(zones.has('homestead')).toBe(true);
    expect(zones.has('workyard')).toBe(true);
    expect(zones.has('gate')).toBe(true);
    expect(zones.has('wild')).toBe(true);
  });

  it('keeps small fixture worlds on legacy all-ground farming semantics', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });

    expect(farmsteadSceneEnabled(state)).toBe(false);
    expect(farmsteadSceneLayout(state).objects).toEqual([]);
    expect(isFarmsteadFarmPlotTile(state, 0, 0)).toBe(true);
    expect(isFarmsteadFarmPlotTile(state, 3, 3)).toBe(true);
  });

  it('blocks new farm work outside the herb plot while preserving care for legacy crops', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    applyFarmsteadSceneLayout(state, { resetHerbPlot: true });

    const farmPoint = firstFarmsteadFarmPlotTile(state);
    const outsidePoint = firstNonFarmsteadFarmPlotTile(state);
    expect(farmPoint).not.toBeNull();
    expect(outsidePoint).not.toBeNull();
    expect(canUseFarmActionOnFarmsteadTile('till', state, farmPoint!.x, farmPoint!.y)).toBe(true);
    expect(canUseFarmActionOnFarmsteadTile('till', state, outsidePoint!.x, outsidePoint!.y)).toBe(false);
    expect(canUseFarmActionOnFarmsteadTile('sow', state, outsidePoint!.x, outsidePoint!.y)).toBe(false);

    const outsideTile = state.tiles.find(tile => tile.x === outsidePoint!.x && tile.y === outsidePoint!.y)!;
    outsideTile.cropId = outsideTile.id;
    expect(canUseFarmActionOnFarmsteadTile('water', state, outsidePoint!.x, outsidePoint!.y)).toBe(true);
    expect(canUseFarmActionOnFarmsteadTile('harvest', state, outsidePoint!.x, outsidePoint!.y)).toBe(true);
    expect(canUseFarmActionOnFarmsteadTile('channel-qi', state, outsidePoint!.x, outsidePoint!.y)).toBe(true);
  });
});
