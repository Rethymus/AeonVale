import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { farmsteadRootContextAssetId, getFarmsteadFocus, normalizeFarmsteadRootAssetId } from '@app/farmsteadFocus';
import { stageQiCap } from '@sim/progression/progression';

function clearCarriedSeeds(state: ReturnType<typeof createWorld>): void {
 for (const itemId of Object.keys(state.player.inventory)) {
 if (itemId.startsWith('seed.')) delete state.player.inventory[itemId];
 }
}

describe('farmstead focus root-context normalization', () => {
 it('pulls root-context facility assets back to the farmstead root thread', () => {
 expect(normalizeFarmsteadRootAssetId('facility.sealing-cabinet')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('facility.shipping-bin')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('facility.storage-chest')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('facility.drying-rack')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('facility.talisman-furnace')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('facility.array-eye')).toBe('loc.farmstead');
 expect(normalizeFarmsteadRootAssetId('loc.herb-plot')).toBe('loc.herb-plot');
 });

it('keeps a ready sealing cabinet directly on the farmstead root thread for high-level contexts', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 71, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.facilities.set(1, {
 id: 1,
 kind: 'sealing-cabinet',
 tileId: state.tiles[0]!.id,
 job: { inputItemId: 'herb.dewroot', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 },
 });

expect(getFarmsteadFocus(state).assetId).toBe('loc.farmstead');
 expect(farmsteadRootContextAssetId(state)).toBe('loc.farmstead');
 });

it('keeps queued shipping and full storage on the farmstead root thread for high-level contexts', () => {
 const reg = buildRegistry();
 const shippingState = createWorld({ seed: 72, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 shippingState.shippingBin['herb.mossling'] = 2;

expect(getFarmsteadFocus(shippingState).assetId).toBe('loc.farmstead');
 expect(farmsteadRootContextAssetId(shippingState)).toBe('loc.farmstead');

const storageState = createWorld({ seed: 73, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 storageState.storage.capacity = 1;
 storageState.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

expect(getFarmsteadFocus(storageState).assetId).toBe('loc.farmstead');
 expect(farmsteadRootContextAssetId(storageState)).toBe('loc.farmstead');
 });

it('switches the farmstead root context asset to array-shed when breakthrough is ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 93, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

state.player.stage = 1;
 state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
 state.player.cultivation = state.player.bodyFoundation;

expect(getFarmsteadFocus(state).assetId).toBe('loc.herb-plot');
 expect(farmsteadRootContextAssetId(state)).toBe('loc.array-shed');
 });

it('routes empty tilled plots without carried seeds toward market restock instead of claiming sow is available', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 74, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 clearCarriedSeeds(state);

const tile = state.tiles[0]!;
 tile.blockType = 'none';
 tile.soilType = 'loam';
 tile.tilled = true;

expect(getFarmsteadFocus(state)).toMatchObject({
 kind: 'empty-tilled-no-seed',
 briefingLine: '农务：已翻 1 块空田，先去集市补种子',
 locationReason: '已有 1 块翻好的空田，但身上没有种子，先去集市补货再回田里。',
 assetId: 'loc.valley-market',
 });
 expect(farmsteadRootContextAssetId(state)).toBe('loc.valley-market');
 });
});
