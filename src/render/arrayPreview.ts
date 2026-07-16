import type { GameState } from '@sim/world/state';

export function arrayCoreFacilityKind(defId: string): 'array-eye' | 'array-flag' {
  return defId === 'array.lightning-rod' ? 'array-eye' : 'array-flag';
}

export interface ArrayWorldPreviewPlacement {
  arrayId: number;
  tileId: number;
  assetId: `facility.${'array-eye' | 'array-flag'}`;
  status: 'active' | 'idle';
  coverageTileIds: readonly number[];
}

export function arrayWorldPreviewPlacements(state: GameState): ArrayWorldPreviewPlacement[] {
  return Array.from(state.arrays.values())
    .sort((a, b) => a.coreTileId - b.coreTileId || a.id - b.id)
    .map(arr => ({
      arrayId: arr.id,
      tileId: arr.coreTileId,
      assetId: `facility.${arrayCoreFacilityKind(arr.defId)}`,
      status: arr.active && arr.power > 0 ? 'active' : 'idle',
      coverageTileIds: arr.coverageTileIds
    }));
}
