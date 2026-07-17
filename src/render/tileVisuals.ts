import type { Tile } from '@sim/farm/tile';
import { isPlantable, isTillable } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';

/**
 * 农作地块四态（空 / 翻地 / 播种 / 浇水）与成熟可读性的纯 render 状态。
 * 不依赖 ambient 时间即可正确；ambient 仅作 polish。
 */
export interface TileVisualState {
  dampAlpha: number;
  qiGlowAlpha: number;
  showWaterMark: boolean;
  showChannelMark: boolean;
  /** 翻地土块填充对比（0..1）——与空地拉开色差 */
  tilledContrastAlpha: number;
  /** 翻地土块描边对比（0..1） */
  tilledBorderAlpha: number;
  /** 浇水后水洼高光（0..1），比 damp 更易扫读 */
  waterSheenAlpha: number;
  /** 播种种子阶段：无贴图时是否强调种子点 */
  seedVisible: boolean;
  /** 种子绘制缩放（1 = 基线） */
  seedScale: number;
  /** 可收获态上扬 / 辉光强调 */
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

/** 翻地基色（较未翻深一档，配合 contrast 再叠暗） */
export const TILLED_SOIL_FILL = 0x4a3318;
/** 翻地描边色 */
export const TILLED_SOIL_BORDER = 0x2a1a0c;
/** 浇水水洼高光色 */
export const WATER_SHEEN_COLOR = 0x5a9ec8;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * 由 tile + 可选 crop 推导四态视觉差分。
 * - empty（未翻）：全部对比 / 水 / 种 为 0
 * - tilled：tilledContrast/Border 抬升
 * - sown（seed）：seedVisible + seedScale
 * - watered：waterSheen + damp + 水渍标记更强
 * - mature：harvestLift
 */
export function tileVisualState(tile: Tile, crop?: CropInstance | null): TileVisualState {
  const tilled = tile.tilled;
  const watered = tilled && tile.wateredToday;
  const seedStage = crop?.stage === 'seed';
  const mature = crop?.stage === 'mature';

  // 湿度暗层：翻地才有；浇水当日额外抬一点上限感
  const moistureDamp = tilled ? clamp01((tile.moisture - 10_000) / 60_000) * 0.28 : 0;
  const dampAlpha = watered ? Math.max(moistureDamp, 0.16) : moistureDamp;

  const qiGlowAlpha = tilled ? clamp01((tile.qiDensity - 18_000) / 52_000) * 0.35 : 0;

  // 翻地对比：浇水后略加深，强调「湿润泥土」
  const tilledContrastAlpha = tilled ? (watered ? 0.78 : 0.55) : 0;
  const tilledBorderAlpha = tilled ? (watered ? 0.7 : 0.48) : 0;

  // 水洼高光：仅浇水当日；湿度越高越亮
  const waterSheenAlpha = watered ? 0.36 + clamp01((tile.moisture - 20_000) / 50_000) * 0.28 : 0;

  return {
    dampAlpha,
    qiGlowAlpha,
    showWaterMark: watered,
    showChannelMark: tilled && tile.channeledToday,
    tilledContrastAlpha,
    tilledBorderAlpha,
    waterSheenAlpha,
    seedVisible: Boolean(tilled && seedStage),
    seedScale: seedStage ? 1.35 : 1,
    harvestLift: Boolean(mature)
  };
}

/** 成熟作物相对默认半径的上扬增量（像素级，render 用） */
export function harvestLiftRadiusBonus(state: Pick<TileVisualState, 'harvestLift'>): number {
  return state.harvestLift ? 3 : 0;
}

/** 种子回退图元半径（基线 3，按 seedScale 放大） */
export function seedFallbackRadius(state: Pick<TileVisualState, 'seedVisible' | 'seedScale'>, base = 3): number {
  if (!state.seedVisible) return base;
  return base * state.seedScale;
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
