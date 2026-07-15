import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FERTILIZER_CATALOG, tileAt } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem, qualityItemCount } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(seed = 17): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

function tillableAt(state: GameState): { x: number; y: number } {
 const tile = state.tiles.find(
 (candidate) =>
 !candidate.tilled &&
 candidate.blockType === 'none' &&
 candidate.soilType !== 'water' &&
 candidate.soilType !== 'rock' &&
 candidate.soilType !== 'metal-ore',
 );
 if (!tile) throw new Error('test world has no tillable tile');
 return { x: tile.x, y: tile.y };
}

function matureMossling(state: GameState, ctx: SimContext, x: number, y: number): void {
 mutateItem(state.player, 'seed.mossling', 1);
 applyAction(state, { kind: 'till', at: { x, y } }, ctx);
 applyAction(state, { kind: 'sow', at: { x, y }, seedId: 'seed.mossling' }, ctx);
 const tile = tileAt(state, x, y)!;
 const crop = state.crops.get(tile.id)!;
 crop.growth = ctx.content.herbs.get('herb.mossling')!.growthThreshold;
 crop.stage = 'mature';
}

describe('肥料与收获品质', () => {
 it('灵壤肥可施在已翻地地块：消耗物品并提升肥力/灵气', () => {
 const { state, ctx } = setup();
 const at = tillableAt(state);
 applyAction(state, { kind: 'till', at }, ctx);
 const tile = tileAt(state, at.x, at.y)!;
 tile.fertility = 40_000;
 tile.qiDensity = 20_000;
 mutateItem(state.player, 'item.spirit-compost', 1);

applyAction(state, { kind: 'fertilize', at, itemId: 'item.spirit-compost' }, ctx);

expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 expect(tile.fertility).toBe(65_000);
 expect(tile.qiDensity).toBe(35_000);
 expect(state.events.some((e) => e.type === 'fertilize')).toBe(true);
 });

it('未翻地、无肥料或非肥料物品时拒绝施肥', () => {
 const { state, ctx } = setup();
 const at = tillableAt(state);
 mutateItem(state.player, 'item.spirit-compost', 1);
 mutateItem(state.player, 'item.beast-core', 1);
 const tile = tileAt(state, at.x, at.y)!;
 const fertilityBefore = tile.fertility;

applyAction(state, { kind: 'fertilize', at, itemId: 'item.spirit-compost' }, ctx);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
 expect(tile.fertility).toBe(fertilityBefore);

applyAction(state, { kind: 'till', at }, ctx);
 applyAction(state, { kind: 'fertilize', at, itemId: 'item.beast-core' }, ctx);
 expect(itemCount(state.player, 'item.beast-core')).toBe(1);

applyAction(state, { kind: 'fertilize', at: { x: 3, y: 3 }, itemId: 'item.spirit-compost' }, ctx);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
 });

it('肥沃且当日照料的成熟灵草收获更高品质并给额外主产物', () => {
 const { state, ctx } = setup();
 const at = tillableAt(state);
 matureMossling(state, ctx, at.x, at.y);
 const tile = tileAt(state, at.x, at.y)!;
 tile.fertility = 100_000;
 tile.qiDensity = 100_000;
 tile.wateredToday = true;
 tile.channeledToday = true;

applyAction(state, { kind: 'harvest', at }, ctx);

const harvest = state.events.find((e) => e.type === 'harvest')!;
 expect(harvest.payload).toMatchObject({ quality: 'treasure', bonusYield: 2 });
 expect(itemCount(state.player, 'herb.mossling')).toBe(3);
 expect(qualityItemCount(state.player, 'herb.mossling', 'treasure')).toBe(3);
 });

it('贫瘠且未照料的成熟灵草保持凡品，不给品质加产', () => {
 const { state, ctx } = setup();
 const at = tillableAt(state);
 matureMossling(state, ctx, at.x, at.y);
 const tile = tileAt(state, at.x, at.y)!;
 tile.fertility = 5_000;
 tile.qiDensity = 5_000;
 const crop = state.crops.get(tile.id)!;
 crop.health = 50_000;

applyAction(state, { kind: 'harvest', at }, ctx);

const harvest = state.events.find((e) => e.type === 'harvest')!;
 expect(harvest.payload).toMatchObject({ quality: 'mortal', bonusYield: 0 });
 expect(itemCount(state.player, 'herb.mossling')).toBe(1);
 expect(qualityItemCount(state.player, 'herb.mossling', 'mortal')).toBe(1);
 });

it('肥料表包含早期可用的灵壤肥', () => {
 expect(FERTILIZER_CATALOG).toContainEqual(expect.objectContaining({ itemId: 'item.spirit-compost', staminaCost: 4 }));
 });
});
