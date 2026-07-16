import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { mutateItem, mutateQualityItem } from '@sim/world/player';
import { inventoryPreviewSelection } from '@app/inventoryPreview';

describe('inventory preview selection', () => {
 it('prefers quality herbs from the player inventory for high-signal preview', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 21, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 mutateItem(state.player, 'seed.mossling', 2);
 mutateQualityItem(state.player, 'herb.dewroot', 'spirit', 3);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'herb.dewroot',
 title: '露根草',
 details: '随身背包\n灵品 × 3',
 iconId: 'icon.herb.dewroot',
 panelAssetId: undefined,
 });
 });

it('prefers seeds during the first sow objective even when herbs are also present', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 24, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.tiles[0]!.tilled = true;
 mutateItem(state.player, 'seed.mossling', 2);
 mutateQualityItem(state.player, 'herb.dewroot', 'spirit', 3);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'seed.mossling',
 title: '凡间青苔种子',
 details: '随身背包\n数量 × 2\n首轮目标：播进田里，先把炼丹和备劫材料种出来。',
 iconId: 'icon.seed.mossling',
 panelAssetId: undefined,
 });
 });

it('adds a harvest hint when the first mature herb is already pending pickup', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 26, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const tile = state.tiles[0]!;
 tile.tilled = true;
 tile.cropId = tile.id;
 state.crops.set(tile.id, {
 id: tile.id,
 defId: 'herb.mossling',
 tileId: tile.id,
 growth: 100_000,
 health: 100_000,
 stage: 'mature',
 plantedDay: state.day,
 property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
 tempered: false,
 });
 mutateQualityItem(state.player, 'herb.dewroot', 'spirit', 3);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'herb.dewroot',
 title: '露根草',
 details: '随身背包\n灵品 × 3\n首轮目标：成熟后收下第一株，接上炼丹、出货与备劫。',
 iconId: 'icon.herb.dewroot',
 panelAssetId: undefined,
 });
 });

it('prefers farmstead panel art during the first ship objective while preserving the carried item icon', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 27, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add('onboarding-first-harvest');
 mutateItem(state.player, 'herb.mossling', 1);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'herb.mossling',
 title: '凡间青苔',
 details: '随身背包\n数量 × 1\n首轮目标：投进出货箱，换补种、炉料与备劫灵石。',
 iconId: 'icon.herb.mossling',
 panelAssetId: 'facility.shipping-bin',
 });
 });

it('keeps shipping-bin panel art during the first sleep objective to reinforce the overnight shipment thread', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 28, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add('onboarding-first-shipment');
 mutateItem(state.player, 'item.spirit-stone', 2);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'item.spirit-stone',
 title: '灵石',
 details: '随身背包\n数量 × 2',
 iconId: 'icon.item.spirit-stone',
 panelAssetId: 'facility.shipping-bin',
 });
 });

it('prefers spirit stones during the market restock objective over stored seeds', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 25, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add('onboarding-first-shipping-settlement');
 state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 4 };
 state.storage.inventory['seed.dewroot'] = { itemId: 'seed.dewroot', count: 3 };

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'item.spirit-stone',
 title: '灵石',
 details: '随身背包\n数量 × 4\n首轮目标：去集市补种，先把资源循环续上。',
 iconId: 'icon.item.spirit-stone',
 panelAssetId: 'loc.valley-market',
 });
 });

it('keeps the real herb icon during the first second-water objective instead of collapsing back to farmstead art', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 29, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add('onboarding-first-market-restock');
 state.player.flags.add('onboarding-first-second-sow');
 mutateItem(state.player, 'herb.mossling', 2);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'herb.mossling',
 title: '凡间青苔',
 details: '随身背包\n数量 × 2\n首轮目标：补种后的新苗先浇水，稳住种田备战节奏。',
 iconId: 'icon.herb.mossling',
 panelAssetId: undefined,
 });
 });

it('switches to farmstead panel art during the first second-sow objective while preserving the seed icon', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 30, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add('onboarding-first-market-restock');
 mutateItem(state.player, 'seed.dewroot', 2);

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'seed.dewroot',
 title: '露根草种子',
 details: '随身背包\n数量 × 2\n首轮目标：回农庄补播，让第二轮药材不断档。',
 iconId: 'icon.seed.dewroot',
 panelAssetId: 'loc.farmstead',
 });
 });

it('falls back to storage contents while keeping the farmstead root panel thread', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 22, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 5 };

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'item.spirit-stone',
 title: '灵石',
 details: '农庄仓库\n数量 × 5',
 iconId: 'icon.item.spirit-stone',
 panelAssetId: 'loc.farmstead',
 });
 });

it('keeps the farmstead root panel thread when a high-signal quality item is only in storage', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 31, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.storage.qualityInventory.spirit ??= {};
 state.storage.qualityInventory.spirit['herb.dewroot'] = 2;

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toMatchObject({
 itemId: 'herb.dewroot',
 title: '露根草',
 details: '农庄仓库\n灵品 × 2',
 iconId: 'icon.herb.dewroot',
 panelAssetId: 'loc.farmstead',
 });
 });

it('returns null when both inventory and storage are empty', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 23, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 state.player.inventory = {};

const preview = inventoryPreviewSelection(state, reg);

expect(preview).toBeNull;
 });
});
