import type { Tile } from '@sim/farm/tile';
import { isPlantable, isTillable } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';
import { ColorPalette, type ColorPaletteKey } from './ColorPalette';

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

export type TileSurfaceKind = 'tillable' | 'plantable' | 'occupied' | 'blocked';
export type TileGrainKind = 'fine' | 'coarse' | 'none';

export interface TileSurfaceVisualState {
  surfaceKind: TileSurfaceKind;
  baseTone: ColorPaletteKey;
  baseToneAlpha: number;
  grainKind: TileGrainKind;
  grainTone: ColorPaletteKey;
  grainDensity: number;
  grainAlpha: number;
  furrowAlpha: number;
}

export interface TileSurfaceGrainSample {
  /** 归一化地块内坐标，renderer 再映射到像素。 */
  readonly ox: number;
  readonly oy: number;
  readonly size: number;
  readonly alphaScale: number;
}

export interface TileSelectionVisualInput {
  readonly selected: boolean;
  readonly actionable: boolean;
  readonly ambientTimeMs: number;
  readonly reducedMotion: boolean;
}

export interface TileSelectionVisualState {
  readonly selectionMaskAlpha: number;
  readonly selectionEdgeAlpha: number;
  readonly breathPhase: number;
}

export interface QiFlowVisualState {
  readonly lineCount: 0 | 1 | 2 | 3;
  readonly concentration: number;
  readonly alpha: number;
  readonly lineWidth: number;
  readonly speed: number;
  readonly amplitude: number;
  readonly phase: number;
}

/** 翻地基色（较未翻深一档，配合 contrast 再叠暗） */
export const TILLED_SOIL_FILL = ColorPalette.soilDeep;
/** 翻地描边色 */
export const TILLED_SOIL_BORDER = ColorPalette.soilShadow;
/** 浇水水洼高光色 */
export const WATER_SHEEN_COLOR = ColorPalette.waterSheen;

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

/**
 * 地表语义只读 Tile/Crop；不读取玩家位置，也不把当前选择态塞回 Tile。
 */
export function tileSurfaceVisualState(tile: Tile, crop?: CropInstance | null): TileSurfaceVisualState {
  const occupied = crop != null || tile.cropId != null;
  const blocked = tile.blockType !== 'none' || tile.soilType === 'rock' || tile.soilType === 'water' || tile.soilType === 'metal-ore';

  if (blocked) {
    return {
      surfaceKind: 'blocked',
      baseTone: 'mountainMuted',
      baseToneAlpha: 0.38,
      grainKind: 'coarse',
      grainTone: 'inkDeep',
      grainDensity: 7,
      grainAlpha: 0.46,
      furrowAlpha: 0
    };
  }

  if (occupied) {
    return {
      surfaceKind: 'occupied',
      baseTone: 'soilDeep',
      baseToneAlpha: 0.32,
      grainKind: 'fine',
      grainTone: 'soilHighlight',
      grainDensity: 5,
      grainAlpha: 0.22,
      furrowAlpha: 0.34
    };
  }

  if (isPlantable(tile)) {
    return {
      surfaceKind: 'plantable',
      baseTone: 'soilDeep',
      baseToneAlpha: 0.44,
      grainKind: 'fine',
      grainTone: 'soilHighlight',
      grainDensity: 7,
      grainAlpha: 0.25,
      furrowAlpha: 0.68
    };
  }

  if (isTillable(tile)) {
    return {
      surfaceKind: 'tillable',
      baseTone: 'soilFertile',
      baseToneAlpha: 0.24,
      grainKind: 'fine',
      grainTone: 'paperWarm',
      grainDensity: 10,
      grainAlpha: 0.2,
      furrowAlpha: 0
    };
  }

  return {
    surfaceKind: 'blocked',
    baseTone: 'mountainMuted',
    baseToneAlpha: 0.36,
    grainKind: 'coarse',
    grainTone: 'inkDeep',
    grainDensity: 7,
    grainAlpha: 0.44,
    furrowAlpha: 0
  };
}

function grainHash(tile: Pick<Tile, 'id' | 'x' | 'y'>, sampleIndex: number, channel: number): number {
  let value = Math.imul(tile.id + 1, 1_597_334_677) ^ Math.imul(tile.x + 17, 381_201_581) ^ Math.imul(tile.y + 31, 958_282_617) ^ Math.imul(sampleIndex + 1, 1_103_515_245) ^ Math.imul(channel + 1, 668_265_263);
  value = Math.imul(value ^ (value >>> 16), 2_246_822_507);
  value = Math.imul(value ^ (value >>> 13), 3_266_489_909);
  return (value ^ (value >>> 16)) >>> 0;
}

function grainUnit(tile: Pick<Tile, 'id' | 'x' | 'y'>, sampleIndex: number, channel: number): number {
  return grainHash(tile, sampleIndex, channel) / 4_294_967_295;
}

/** 同一 Tile/索引始终得到同一颗粒；不同 Tile 会产生稳定差异。 */
export function tileSurfaceGrainSample(tile: Pick<Tile, 'id' | 'x' | 'y'>, grainKind: TileGrainKind, sampleIndex: number): TileSurfaceGrainSample {
  if (grainKind === 'none') return { ox: 0.5, oy: 0.5, size: 0, alphaScale: 0 };
  const coarse = grainKind === 'coarse';
  return {
    ox: 0.12 + grainUnit(tile, sampleIndex, 0) * 0.76,
    oy: 0.12 + grainUnit(tile, sampleIndex, 1) * 0.76,
    size: coarse ? 2 + (grainHash(tile, sampleIndex, 2) % 2) : 1,
    alphaScale: 0.65 + grainUnit(tile, sampleIndex, 3) * 0.35
  };
}

/** 玩家面前格的月白遮罩 + 灵气青边缘；reduced motion 时相位冻结。 */
export function tileSelectionVisualState(input: TileSelectionVisualInput): TileSelectionVisualState {
  if (!input.selected) return { selectionMaskAlpha: 0, selectionEdgeAlpha: 0, breathPhase: 0 };

  const safeTime = Number.isFinite(input.ambientTimeMs) ? Math.max(0, input.ambientTimeMs) : 0;
  const breathPhase = input.reducedMotion ? 0.5 : (safeTime % 1800) / 1800;
  const breath = 0.5 + Math.sin(breathPhase * Math.PI * 2) * 0.5;
  const edgeBase = input.actionable ? 0.72 : 0.5;

  return {
    selectionMaskAlpha: input.actionable ? 0.125 : 0.09,
    selectionEdgeAlpha: edgeBase * (0.88 + breath * 0.12),
    breathPhase
  };
}

/** 灵气浓度到轻量流线的单调映射；只读 tile，不改模拟状态。 */
export function qiFlowVisualState(tile: Pick<Tile, 'id' | 'x' | 'y' | 'qiDensity' | 'blockType' | 'soilType' | 'tilled'>, ambientTimeMs: number, reducedMotion: boolean): QiFlowVisualState {
  const farmable = tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore';
  const rawConcentration = clamp01((tile.qiDensity - 30_000) / 70_000);
  const preparedBaseline = tile.tilled && tile.qiDensity >= 30_000 ? 0.125 : 0;
  const concentration = Math.max(rawConcentration, preparedBaseline);
  const visible = tile.tilled ? tile.qiDensity >= 30_000 : tile.qiDensity >= 60_000;
  if (!farmable || !visible) {
    return { lineCount: 0, concentration: 0, alpha: 0, lineWidth: 0, speed: 0, amplitude: 0, phase: 0 };
  }

  const lineCount: 1 | 2 | 3 = concentration < 1 / 3 ? 1 : concentration < 2 / 3 ? 2 : 3;
  const speed = 0.72 + concentration * 0.38;
  const basePhase = (tile.id * 0.618_033_988_75 + tile.x * 0.071 + tile.y * 0.113) % 1;
  const safeTime = Number.isFinite(ambientTimeMs) ? Math.max(0, ambientTimeMs) : 0;
  const phase = reducedMotion ? basePhase : (basePhase + (safeTime / 6000) * speed) % 1;

  return {
    lineCount,
    concentration,
    // 可见度地板：此前 alpha≈0.43 / width≈1.7 在人眼与视觉复核下都读为「均匀棕色」，
    // 像素门禁虽绿但属亚感知（见 2026-07-18 P0-4 复核）。抬到 alpha≈0.63 / width≈2.4
    // 后仍为低饱和灵气青/月白，不引入霓虹，浓度差依旧单调。
    alpha: 0.62 + concentration * 0.1,
    lineWidth: 2.35 + concentration * 0.1,
    speed,
    amplitude: 1.3 + concentration * 1.7,
    phase
  };
}

/**
 * 作物生长反馈（P1-1）：从 growth/threshold 派生 25/50/75/100% 阶段的纯展示状态。
 * 不改 sim 的 CropStage / growth / 事件 schema；仅作 render 反馈。reduced-motion 冻结脉冲相位。
 */
export interface CropGrowthFeedbackState {
  /** 归一化生长进度 0..1（growth / threshold，安全夹紧） */
  progress: number;
  /** 25% 起出现的「聚灵收束」线条 alpha，随浓度单调增强 */
  qiGatherAlpha: number;
  /** 75% 起的「雷性成形」冷青银 tint alpha，随浓度单调增强 */
  temperTintAlpha: number;
  /** 100%（mature）金青辉光 alpha；非成熟为 0 */
  matureGlowAlpha: number;
  /** 成熟脉冲相位 0..1（约 1400ms 周期）；非成熟为 0；reduced-motion 固定 0.5 */
  maturePulsePhase: number;
}

const CROP_MATURE_PULSE_MS = 1400;

export function cropGrowthFeedbackState(
  crop: Pick<CropInstance, 'growth' | 'stage'>,
  threshold: number,
  ambientTimeMs: number,
  reducedMotion: boolean
): CropGrowthFeedbackState {
  const safeThreshold = threshold > 0 ? threshold : 1;
  const progress = clamp01(crop.growth / safeThreshold);
  const qiGatherAlpha = progress >= 0.25 ? clamp01((progress - 0.25) / 0.5) * 0.55 : 0;
  const temperTintAlpha = progress >= 0.75 ? clamp01((progress - 0.75) / 0.25) * 0.5 : 0;
  const mature = crop.stage === 'mature' || progress >= 1;
  const matureGlowAlpha = mature ? 0.65 : 0;
  const safeTime = Number.isFinite(ambientTimeMs) ? Math.max(0, ambientTimeMs) : 0;
  const maturePulsePhase = !mature ? 0 : reducedMotion ? 0.5 : (safeTime % CROP_MATURE_PULSE_MS) / CROP_MATURE_PULSE_MS;
  return { progress, qiGatherAlpha, temperTintAlpha, matureGlowAlpha, maturePulsePhase };
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
