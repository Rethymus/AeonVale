import { describe, expect, it } from 'vitest';
import type { Tile } from '@sim/farm/tile';
import { tileAssetId } from '@render/tileAsset';

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
 ...overrides,
 };
}

describe('tile asset helper', () => {
 it('keeps dry tiles on their soil-specific art id', () => {
 expect(tileAssetId(makeTile())).toBe('tile.loam');
 expect(tileAssetId(makeTile({ soilType: 'spirit-loam', tilled: true, moisture: 20_000 }))).toBe('tile.spirit-loam');
 expect(tileAssetId(makeTile({ soilType: 'rock', blockType: 'tree' }))).toBe('tile.rock');
 });

it('promotes tilled wet ground to the shared wet-loam art id', () => {
 expect(tileAssetId(makeTile({ tilled: true, wateredToday: true }))).toBe('tile.wet-loam');
 expect(tileAssetId(makeTile({ tilled: true, soilType: 'spirit-loam', moisture: 70_000 }))).toBe('tile.wet-loam');
 });

it('promotes insulation-covered farmable ground to the insulated tile art id', () => {
 expect(tileAssetId(makeTile({ soilType: 'loam', tilled: true }), { insulationCovered: true })).toBe('tile.insulated');
 expect(tileAssetId(makeTile({ soilType: 'spirit-loam', tilled: false }), { insulationCovered: true })).toBe('tile.insulated');
 });

it('keeps hard obstacles on their own art even when insulation coverage is present', () => {
 expect(tileAssetId(makeTile({ soilType: 'rock' }), { insulationCovered: true })).toBe('tile.rock');
 expect(tileAssetId(makeTile({ soilType: 'water' }), { insulationCovered: true })).toBe('tile.water');
 expect(tileAssetId(makeTile({ soilType: 'metal-ore' }), { insulationCovered: true })).toBe('tile.metal-ore');
 });
});
