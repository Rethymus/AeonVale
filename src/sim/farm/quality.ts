import type { CropInstance } from './crop';
import type { Tile } from './tile';

export type CropQuality = 'mortal' | 'spirit' | 'treasure';

export interface FertilizerDef {
 itemId: string;
 displayName: string;
 fertilityGain: number;
 qiGain: number;
 staminaCost: number;
}

export const FERTILIZER_CATALOG: readonly FertilizerDef[] = [
 {
 itemId: 'item.spirit-compost',
 displayName: '灵壤肥',
 fertilityGain: 25_000,
 qiGain: 15_000,
 staminaCost: 4,
 },
];

export function getFertilizer(itemId: string): FertilizerDef | null {
 return FERTILIZER_CATALOG.find((fertilizer) => fertilizer.itemId === itemId) ?? null;
}

function clamp01(value: number): number {
 return Math.max(0, Math.min(1, value));
}

export function cropQualityScore(tile: Tile, crop: CropInstance): number {
 const fertility = clamp01(tile.fertility / 100_000);
 const qi = clamp01(tile.qiDensity / 100_000);
 const health = clamp01(crop.health / 100_000);
 const care = (tile.wateredToday ? 0.5 : 0) + (tile.channeledToday ? 0.5 : 0);
 const temperedBonus = crop.tempered ? 0.1 : 0;
 return clamp01(0.42 * fertility + 0.24 * qi + 0.22 * health + 0.12 * care + temperedBonus);
}

export function qualityFromScore(score: number): CropQuality {
 if (score >= 0.82) return 'treasure';
 if (score >= 0.62) return 'spirit';
 return 'mortal';
}

export function qualityBonusYield(quality: CropQuality): number {
 switch (quality) {
 case 'treasure':
 return 2;
 case 'spirit':
 return 1;
 case 'mortal':
 return 0;
 }
}
