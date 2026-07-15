import { describe, expect, it } from 'vitest';
import type { Tile } from '@sim/farm/tile';
import type { CropInstance } from '@sim/farm/crop';
import { tileReadinessState, tileVisualState } from '@render/tileVisuals';

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

function makeCrop(overrides: Partial<CropInstance> = {}): CropInstance {
 return {
 id: 1,
 defId: 'herb.mossling',
 tileId: 1,
 growth: 0,
 health: 100_000,
 stage: 'seed',
 plantedDay: 1,
 property: { cold: 0, hot: 0, warm: 0, neutral: 1_000 },
 tempered: false,
 ...overrides,
 };
}

describe('tile visual state helper', () => {
 it('keeps untouched ground visually quiet', () => {
 expect(tileVisualState(makeTile())).toEqual({
 dampAlpha: 0,
 qiGlowAlpha: 0,
 showWaterMark: false,
 showChannelMark: false,
 });
 });

it('shows explicit same-day care markers on tilled tiles', () => {
 expect(tileVisualState(makeTile({ tilled: true, wateredToday: true, channeledToday: true }))).toEqual({
 dampAlpha: 0,
 qiGlowAlpha: 0,
 showWaterMark: true,
 showChannelMark: true,
 });
 });

it('derives dampness and qi glow intensity from tile resources', () => {
 const state = tileVisualState(makeTile({ tilled: true, moisture: 70_000, qiDensity: 70_000 }));

expect(state.dampAlpha).toBeGreaterThan(0.2);
 expect(state.qiGlowAlpha).toBeGreaterThan(0.3);
 expect(state.showWaterMark).toBe(false);
 expect(state.showChannelMark).toBe(false);
 });
});

describe('tile readiness helper', () => {
 it('marks mature crops as harvest-ready', () => {
 expect(tileReadinessState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'mature' }))).toEqual({
 kind: 'harvest-ready',
 showHarvestHalo: true,
 showPlantCue: false,
 showTillCue: false,
 showBlockedCue: false,
 actionable: true,
 });
 });

it('marks empty tilled ground as plant-ready', () => {
 expect(tileReadinessState(makeTile({ tilled: true }))).toEqual({
 kind: 'plant-ready',
 showHarvestHalo: false,
 showPlantCue: true,
 showTillCue: false,
 showBlockedCue: false,
 actionable: true,
 });
 });

it('marks raw usable ground as till-ready', () => {
 expect(tileReadinessState(makeTile())).toEqual({
 kind: 'till-ready',
 showHarvestHalo: false,
 showPlantCue: false,
 showTillCue: true,
 showBlockedCue: false,
 actionable: true,
 });
 });

it('marks obstructed or unusable ground as blocked', () => {
 expect(tileReadinessState(makeTile({ blockType: 'tree' }))).toEqual({
 kind: 'blocked',
 showHarvestHalo: false,
 showPlantCue: false,
 showTillCue: false,
 showBlockedCue: true,
 actionable: false,
 });
 expect(tileReadinessState(makeTile({ soilType: 'water' }))).toEqual({
 kind: 'blocked',
 showHarvestHalo: false,
 showPlantCue: false,
 showTillCue: false,
 showBlockedCue: true,
 actionable: false,
 });
 });

it('keeps non-mature occupied tiles idle when no direct action is available', () => {
 expect(tileReadinessState(makeTile({ tilled: true, cropId: 1 }), makeCrop({ stage: 'growing' }))).toEqual({
 kind: 'idle',
 showHarvestHalo: false,
 showPlantCue: false,
 showTillCue: false,
 showBlockedCue: false,
 actionable: false,
 });
 });
});
