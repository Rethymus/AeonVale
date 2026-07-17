import type { Tile } from '@sim/farm/tile';
import { isPlantable, isTillable } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';

export interface TileVisualState {
  dampAlpha: number;
  qiGlowAlpha: number;
  showWaterMark: boolean;
  showChannelMark: boolean;
  /** 翻地土块描边/填充对比（0..1） */
  tilledEdgeAlpha: number;
  /** 浇水后水洼高光（0..1），比 damp 更易扫读 */
  waterSheenAlpha: number;
  /** 播种后种子点是否强调（无贴图时） */
  showSeedPip: boolean;
  /** 可收获态上扬/辉光强调 */
  harvestLift: boolean;
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

export function tileVisualState(tile: Tile, crop?: CropInstance | null): TileVisualState {
  const dampAlpha = tile.tilled ? clamp01((tile.moisture - 10_000) / 60_000) * 0.28 : 0;
  const qiGlowAlpha = tile.tilled ? clamp01((tile.qiDensity - 18_000) / 52_000) * 0.35 : 0;
  const watered = tile.tilled && tile.wateredToday;
  const seedStage = crop?.stage === 'seed';

  return {
    dampAlpha,
    qiGlowAlpha,
    showWaterMark: watered,
    showChannelMark: tile.tilled && tile.channeledToday,
    tilledEdgeAlpha: tile.tilled ? (watered ? 0.72 : 0.55) : 0,
    waterSheenAlpha: watered ? 0.38 + clamp01((tile.moisture - 20_000) / 50_000) * 0.25 : 0,
    showSeedPip: Boolean(tile.tilled && seedStage),
    harvestLift: crop?.stage === 'mature'
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
