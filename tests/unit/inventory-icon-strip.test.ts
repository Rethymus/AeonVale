import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE } from '@sim';
import { mutateItem, mutateQualityItem } from '@sim/world/player';
import { inventoryIconStripEntries } from '@render/inventoryIconStrip';

describe('inventory icon strip entries', () => {
 it('prefers high-signal player inventory entries before storage and shipping', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 41, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(41, reg, DEFAULT_BALANCE);

mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 1);
 mutateItem(state.player, 'seed.mossling', 2);
 state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 5 };
 state.shippingBin['item.dried-herb'] = 2;

const entries = inventoryIconStripEntries(state, reg, ctx);

expect(entries.slice(0, 2)).toEqual([
 {
 itemId: 'herb.dewroot',
 count: 1,
 iconId: 'icon.herb.dewroot',
 quality: 'treasure',
 section: 'inventory',
 },
 {
 itemId: 'seed.mossling',
 count: 2,
 iconId: 'icon.seed.mossling',
 section: 'inventory',
 },
 ]);
 expect(entries).toContainEqual({
 itemId: 'item.spirit-stone',
 count: 5,
 iconId: 'icon.item.spirit-stone',
 section: 'storage',
 });
 expect(entries).toContainEqual({
 itemId: 'item.dried-herb',
 count: 2,
 iconId: 'icon.item.dried-herb',
 section: 'shipping',
 });
 });

it('omits entries that do not resolve to a registered icon asset id', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 42, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });

state.player.inventory['unknown.item'] = { itemId: 'unknown.item', count: 3 };

const entries = inventoryIconStripEntries(state, reg);

expect(entries.find((entry) => entry.itemId === 'unknown.item')).toBeUndefined;
 });
});
