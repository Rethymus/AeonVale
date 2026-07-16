import type { Tile } from '@sim/farm/tile';
import { isPlantable, isTillable } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';

export interface TileVisualState {
  dampAlpha: number;
  qiGlowAlpha: number;
  showWaterMark: boolean;
  showChannelMark: boolean;
}

export type TileReadinessKind = 'harvest-ready' | 'plant-ready' | 'till-ready' | 'blocked' | 'idle';

export interface TileReadinessState {
  kind: TileReadinessKind;
  showHarvestHalo: boolean;
  showPlantCue: boolean;
  showTillCue: boolean;
  showBlockedCue: boolean;
  actionable: boolean;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function tileVisualState(tile: Tile): TileVisualState {
  const dampAlpha = tile.tilled ? clamp01((tile.moisture - 10_000) / 60_000) * 0.22 : 0;
  const qiGlowAlpha = tile.tilled ? clamp01((tile.qiDensity - 18_000) / 52_000) * 0.35 : 0;

  return {
    dampAlpha,
    qiGlowAlpha,
    showWaterMark: tile.tilled && tile.wateredToday,
    showChannelMark: tile.tilled && tile.channeledToday
  };
}

export function tileReadinessState(tile: Tile, crop?: CropInstance | null): TileReadinessState {
  if (crop?.stage === 'mature') {
    return {
      kind: 'harvest-ready',
      showHarvestHalo: true,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: false,
      actionable: true
    };
  }

  if (isPlantable(tile)) {
    return {
      kind: 'plant-ready',
      showHarvestHalo: false,
      showPlantCue: true,
      showTillCue: false,
      showBlockedCue: false,
      actionable: true
    };
  }

  if (isTillable(tile)) {
    return {
      kind: 'till-ready',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: true,
      showBlockedCue: false,
      actionable: true
    };
  }

  if (tile.blockType !== 'none' || tile.soilType === 'rock' || tile.soilType === 'water' || tile.soilType === 'metal-ore') {
    return {
      kind: 'blocked',
      showHarvestHalo: false,
      showPlantCue: false,
      showTillCue: false,
      showBlockedCue: true,
      actionable: false
    };
  }

  return {
    kind: 'idle',
    showHarvestHalo: false,
    showPlantCue: false,
    showTillCue: false,
    showBlockedCue: false,
    actionable: false
  };
}
