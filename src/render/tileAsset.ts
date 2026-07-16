import type { Tile } from '@sim/farm/tile';

export interface TileAssetVisualOverrides {
  insulationCovered?: boolean;
}

export function tileAssetId(tile: Tile, overrides: TileAssetVisualOverrides = {}): string {
  if (overrides.insulationCovered && tile.soilType !== 'rock' && tile.soilType !== 'water' && tile.soilType !== 'metal-ore') {
    return 'tile.insulated';
  }
  if (tile.tilled && (tile.wateredToday || tile.moisture >= 55_000)) {
    return 'tile.wet-loam';
  }
  return `tile.${tile.soilType}`;
}
