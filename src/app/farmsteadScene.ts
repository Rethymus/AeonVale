import type { GameState } from '@sim/world/state';

export type FarmsteadSceneZoneKind = 'legacy-field' | 'herb-plot' | 'courtyard' | 'homestead' | 'workyard' | 'gate' | 'wild';

export type FarmsteadSceneObjectKind = 'house' | 'storage' | 'shipping' | 'furnace' | 'array-shed' | 'map-gate';

export interface FarmsteadSceneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FarmsteadSceneObject {
  kind: FarmsteadSceneObjectKind;
  title: string;
  details: string;
  actionLabel: string;
  assetId: string;
  x: number;
  y: number;
  blocks: boolean;
  footprint?: FarmsteadSceneRect;
}

export interface FarmsteadSceneLayout {
  enabled: boolean;
  herbPlot: FarmsteadSceneRect;
  pathY: number;
  house: FarmsteadSceneRect;
  objects: readonly FarmsteadSceneObject[];
}

export type FarmsteadFarmActionKind = 'till' | 'sow' | 'water' | 'harvest' | 'channel-qi' | 'fertilize';

const MIN_SCENE_WIDTH = 10;
const MIN_SCENE_HEIGHT = 7;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function rectContains(rect: FarmsteadSceneRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
}

function singleTileFootprint(x: number, y: number): FarmsteadSceneRect {
  return { x, y, width: 1, height: 1 };
}

export function farmsteadSceneEnabled(size: Pick<GameState, 'width' | 'height'>): boolean {
  return size.width >= MIN_SCENE_WIDTH && size.height >= MIN_SCENE_HEIGHT;
}

export function farmsteadSceneLayout(state: Pick<GameState, 'width' | 'height'>): FarmsteadSceneLayout {
  const enabled = farmsteadSceneEnabled(state);
  if (!enabled) {
    return {
      enabled: false,
      herbPlot: { x: 0, y: 0, width: Math.max(0, state.width), height: Math.max(0, state.height) },
      pathY: Math.max(0, Math.floor(state.height / 2)),
      house: { x: 0, y: 0, width: 0, height: 0 },
      objects: []
    };
  }

  const centerX = Math.floor(state.width / 2);
  const centerY = Math.floor(state.height / 2);
  const plotWidth = Math.min(5, state.width);
  const plotHeight = Math.min(4, state.height);
  const herbPlot = {
    x: clamp(centerX - 4, 0, state.width - plotWidth),
    y: clamp(centerY, 0, state.height - plotHeight),
    width: plotWidth,
    height: plotHeight
  };
  const pathY = clamp(centerY, 0, state.height - 1);
  const house = {
    x: clamp(1, 0, state.width - 2),
    y: clamp(1, 0, state.height - 2),
    width: 2,
    height: 2
  };
  const storageX = clamp(house.x + house.width, 0, state.width - 1);
  const storageY = clamp(house.y + 1, 0, state.height - 1);
  const shippingX = clamp(house.x + 1, 0, state.width - 1);
  const shippingY = clamp(house.y + house.height, 0, state.height - 1);
  const workX = clamp(state.width - 4, 0, state.width - 1);
  const furnaceY = clamp(centerY - 2, 0, state.height - 1);
  const arrayX = clamp(herbPlot.x + herbPlot.width, 0, state.width - 1);
  const arrayY = clamp(herbPlot.y + herbPlot.height - 2, 0, state.height - 1);
  const gateX = clamp(state.width - 2, 0, state.width - 1);
  const gateY = clamp(herbPlot.y + herbPlot.height - 1, 0, state.height - 1);

  const objects: readonly FarmsteadSceneObject[] = [
    {
      kind: 'house',
      title: '简陋屋舍',
      details: '面前屋舍\n可回屋静修，让体力和气血缓一口气',
      actionLabel: '静修',
      assetId: 'loc.farmstead',
      x: house.x,
      y: house.y,
      blocks: true,
      footprint: house
    },
    {
      kind: 'storage',
      title: '仓储木箱',
      details: '面前仓储\n整理随身物品、材料和品质药材',
      actionLabel: '整理仓储',
      assetId: 'facility.storage-chest',
      x: storageX,
      y: storageY,
      blocks: true,
      footprint: singleTileFootprint(storageX, storageY)
    },
    {
      kind: 'shipping',
      title: '出货箱',
      details: '面前出货箱\n把可售药材和材料投入，翌日结算灵石',
      actionLabel: '出货',
      assetId: 'facility.shipping-bin',
      x: shippingX,
      y: shippingY,
      blocks: true,
      footprint: singleTileFootprint(shippingX, shippingY)
    },
    {
      kind: 'furnace',
      title: '丹炉',
      details: '面前丹炉\n把药材炼成丹药，服务体修、承雷与淬体准备',
      actionLabel: '炼丹',
      assetId: 'facility.talisman-furnace',
      x: workX,
      y: furnaceY,
      blocks: true,
      footprint: singleTileFootprint(workX, furnaceY)
    },
    {
      kind: 'array-shed',
      title: '阵器棚',
      details: '面前阵器棚\n建造阵器设施，选择阵法后点目标地格布设',
      actionLabel: '建造/布阵',
      assetId: 'facility.array-flag',
      x: arrayX,
      y: arrayY,
      blocks: true,
      footprint: singleTileFootprint(arrayX, arrayY)
    },
    {
      kind: 'map-gate',
      title: '谷口山径',
      details: '面前出口\n前往集市、遗迹、灵脉和其他山谷地点',
      actionLabel: '外出',
      assetId: 'loc.valley-outskirts',
      x: gateX,
      y: gateY,
      blocks: true,
      footprint: singleTileFootprint(gateX, gateY)
    }
  ];

  return { enabled, herbPlot, pathY, house, objects };
}

export function farmsteadSceneObjectAt(state: Pick<GameState, 'width' | 'height'>, x: number, y: number): FarmsteadSceneObject | null {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return null;
  return layout.objects.find(object => rectContains(object.footprint ?? singleTileFootprint(object.x, object.y), x, y)) ?? null;
}

export function farmsteadSceneObjectByKind(state: Pick<GameState, 'width' | 'height'>, kind: FarmsteadSceneObjectKind): FarmsteadSceneObject | null {
  return farmsteadSceneLayout(state).objects.find(object => object.kind === kind) ?? null;
}

export function frontFarmsteadSceneObject(state: GameState): FarmsteadSceneObject | null {
  const p = state.player;
  const dx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
  const dy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
  return farmsteadSceneObjectAt(state, p.position.x + dx, p.position.y + dy);
}

export function isFarmsteadFarmPlotTile(state: Pick<GameState, 'width' | 'height'>, x: number, y: number): boolean {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return true;
  return rectContains(layout.herbPlot, x, y);
}

export function farmsteadSceneTileKind(state: Pick<GameState, 'width' | 'height'>, x: number, y: number): FarmsteadSceneZoneKind {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return 'legacy-field';
  if (rectContains(layout.herbPlot, x, y)) return 'herb-plot';
  const object = farmsteadSceneObjectAt(state, x, y);
  if (object?.kind === 'map-gate') return 'gate';
  if (object?.kind === 'furnace' || object?.kind === 'array-shed') return 'workyard';
  if (rectContains(layout.house, x, y) || x <= layout.house.x + layout.house.width + 1) return 'homestead';
  if (x >= state.width - 4) return y >= layout.pathY ? 'gate' : 'workyard';
  if (y === layout.pathY || y === layout.pathY + 1) return 'courtyard';
  return 'wild';
}

export function canUseFarmActionOnFarmsteadTile(kind: FarmsteadFarmActionKind, state: GameState, x: number, y: number): boolean {
  if (isFarmsteadFarmPlotTile(state, x, y)) return true;

  const tile = state.tiles.find(entry => entry.x === x && entry.y === y);
  if (!tile) return false;

  if ((kind === 'water' || kind === 'harvest' || kind === 'channel-qi') && tile.cropId != null) return true;
  return false;
}

export function firstFarmsteadFarmPlotTile(state: GameState): { x: number; y: number } | null {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) {
    const tile = state.tiles.find(entry => entry.blockType === 'none' && entry.soilType !== 'water' && entry.soilType !== 'rock' && entry.soilType !== 'metal-ore') ?? null;
    return tile ? { x: tile.x, y: tile.y } : null;
  }

  for (let y = layout.herbPlot.y; y < layout.herbPlot.y + layout.herbPlot.height; y += 1) {
    for (let x = layout.herbPlot.x; x < layout.herbPlot.x + layout.herbPlot.width; x += 1) {
      const tile = state.tiles.find(entry => entry.x === x && entry.y === y);
      if (tile && tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore') return { x, y };
    }
  }
  return null;
}

export function firstNonFarmsteadFarmPlotTile(state: GameState): { x: number; y: number } | null {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return null;
  const objects = layout.objects.map(object => object.footprint ?? singleTileFootprint(object.x, object.y));
  return (
    state.tiles.find(tile => {
      if (isFarmsteadFarmPlotTile(state, tile.x, tile.y)) return false;
      if (objects.some(rect => rectContains(rect, tile.x, tile.y))) return false;
      return tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore';
    }) ?? null
  );
}

function clearFarmsteadObjectFootprintState(state: GameState, footprintTileIds: ReadonlySet<number>): boolean {
  let changed = false;
  for (const tileId of footprintTileIds) {
    if (state.crops.delete(tileId)) changed = true;
  }
  for (const [id, array] of [...state.arrays.entries()]) {
    if (footprintTileIds.has(array.coreTileId)) {
      state.arrays.delete(id);
      changed = true;
      continue;
    }
    const filteredCoverage = array.coverageTileIds.filter(tileId => !footprintTileIds.has(tileId));
    if (filteredCoverage.length !== array.coverageTileIds.length) {
      array.coverageTileIds = filteredCoverage;
      changed = true;
    }
  }
  return changed;
}

export function applyFarmsteadSceneLayout(state: GameState, options?: { resetHerbPlot?: boolean }): boolean {
  const layout = farmsteadSceneLayout(state);
  if (!layout.enabled) return false;
  let changed = false;
  const objectFootprintTileIds = new Set<number>();

  if (options?.resetHerbPlot === true) {
    for (const tile of state.tiles) {
      if (!rectContains(layout.herbPlot, tile.x, tile.y)) continue;
      if (tile.cropId != null || tile.arrayId != null) continue;
      if (tile.blockType !== 'none') {
        tile.blockType = 'none';
        changed = true;
      }
      if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') {
        tile.soilType = 'loam';
        changed = true;
      }
    }
  }

  for (const object of layout.objects) {
    if (!object.blocks) continue;
    const footprint = object.footprint ?? singleTileFootprint(object.x, object.y);
    for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
      for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
        const tile = state.tiles.find(entry => entry.x === x && entry.y === y);
        if (!tile) continue;
        objectFootprintTileIds.add(tile.id);
        if (tile.cropId != null) {
          tile.cropId = null;
          changed = true;
        }
        if (tile.tilled) {
          tile.tilled = false;
          changed = true;
        }
        if (tile.arrayId != null) {
          state.arrays.delete(tile.arrayId);
          tile.arrayId = null;
          changed = true;
        }
        if (tile.wateredToday) {
          tile.wateredToday = false;
          changed = true;
        }
        if (tile.channeledToday) {
          tile.channeledToday = false;
          changed = true;
        }
        if (tile.blockType !== 'building') {
          tile.blockType = 'building';
          changed = true;
        }
        if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') {
          tile.soilType = 'loam';
          changed = true;
        }
      }
    }
  }
  if (objectFootprintTileIds.size > 0 && clearFarmsteadObjectFootprintState(state, objectFootprintTileIds)) changed = true;
  return changed;
}
