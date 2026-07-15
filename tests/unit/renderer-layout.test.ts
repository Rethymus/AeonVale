import { describe, expect, it } from 'vitest';
import {
 briefingBoxHeight,
 facilityWorldBadgeAssetId,
 farmsteadPropBadgeAssetId,
 isBriefingHeroAsset,
 itemPreviewBoxHeight,
 locationWorldBadgeLayout,
 locationServiceWorldBadgeAssetId,
 locationTaskWorldBadgeAssetId,
} from '@render/renderer';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';

describe('renderer layout sizing', () => {
 it('keeps today briefing at baseline height for short text and grows for denser copy', () => {
 expect(briefingBoxHeight(40)).toBe(70);
 expect(briefingBoxHeight(72)).toBe(88);
 });

it('keeps item preview at baseline height for compact details and grows for logistics copy', () => {
 expect(itemPreviewBoxHeight(60)).toBe(112);
 expect(itemPreviewBoxHeight(94)).toBe(130);
 });

it('treats location, npc, and facility assets as hero art in today briefing', () => {
 expect(isBriefingHeroAsset('loc.farmstead')).toBe(true);
 expect(isBriefingHeroAsset('sprite.npc.herb-gatherer')).toBe(true);
 expect(isBriefingHeroAsset('facility.shipping-bin')).toBe(true);
 expect(isBriefingHeroAsset('tile.scorched')).toBe(true);
 expect(isBriefingHeroAsset('logo.full')).toBe(true);
 expect(isBriefingHeroAsset('logo.emblem')).toBe(true);
 expect(isBriefingHeroAsset('icon.herb.mossling')).toBe(false);
 expect(isBriefingHeroAsset('icon.item.rust-hoe')).toBe(false);
 expect(isBriefingHeroAsset()).toBe(false);
 });

it('resolves finished facility world badges to manifest-backed item icons when available', () => {
 expect(facilityWorldBadgeAssetId('item.dried-herb')).toBe('icon.item.dried-herb');
 expect(facilityWorldBadgeAssetId('item.sealed-herb')).toBe('icon.item.sealed-herb');
 expect(facilityWorldBadgeAssetId('item.array-core')).toBe('icon.item.array-core');
 expect(facilityWorldBadgeAssetId('herb.mossling')).toBe('icon.herb.mossling');
 expect(facilityWorldBadgeAssetId).toBeUndefined;
 });

it('resolves farmstead logistics props to manifest-backed item icons when data exists', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 77, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
 state.shippingBin['item.dried-herb'] = 2;
 state.storage.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 3 };

expect(farmsteadPropBadgeAssetId(state, 'facility.shipping-bin')).toBe('icon.item.dried-herb');
 expect(farmsteadPropBadgeAssetId(state, 'facility.storage-chest')).toBe('icon.herb.mossling');
 });

it('falls back for empty logistics props and can read quality bins', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 78, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
 state.qualityShippingBin.spirit = { 'herb.dewroot': 1 };
 state.storage.qualityInventory.treasure = { 'herb.mistfern': 1 };

expect(farmsteadPropBadgeAssetId(state, 'facility.shipping-bin')).toBe('icon.herb.dewroot');
 expect(farmsteadPropBadgeAssetId(state, 'facility.storage-chest')).toBe('icon.herb.mistfern');

const emptyState = createWorld({ seed: 79, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
 expect(farmsteadPropBadgeAssetId(emptyState, 'facility.shipping-bin')).toBeUndefined;
 expect(farmsteadPropBadgeAssetId(emptyState, 'facility.storage-chest')).toBeUndefined;
 });

it('accepts icon-backed or facility-backed location task badges and ignores unrelated assets', () => {
 expect(locationTaskWorldBadgeAssetId('icon.herb.dewroot')).toBe('icon.herb.dewroot');
 expect(locationTaskWorldBadgeAssetId('icon.item.dried-herb')).toBe('icon.item.dried-herb');
 expect(locationTaskWorldBadgeAssetId('icon.item.array-core')).toBe('icon.item.array-core');
 expect(locationTaskWorldBadgeAssetId('facility.shipping-bin')).toBe('facility.shipping-bin');
 expect(locationTaskWorldBadgeAssetId('loc.ruin-gate')).toBeUndefined;
 expect(locationTaskWorldBadgeAssetId).toBeUndefined;
 });

it('accepts service badges backed by npc portraits or icons and ignores location art', () => {
 expect(locationServiceWorldBadgeAssetId('sprite.npc.tea-shed-elder')).toBe('sprite.npc.tea-shed-elder');
 expect(locationServiceWorldBadgeAssetId('sprite.npc.market-merchant')).toBe('sprite.npc.market-merchant');
 expect(locationServiceWorldBadgeAssetId('icon.item.spirit-stone')).toBe('icon.item.spirit-stone');
 expect(locationServiceWorldBadgeAssetId('loc.greenhouse')).toBeUndefined;
 expect(locationServiceWorldBadgeAssetId).toBeUndefined;
 });

it('separates service and task landmark badges when both are present on the same place', () => {
 expect(locationWorldBadgeLayout({
 hasBirthday: false,
 hasQuest: false,
 hasService: true,
 hasTask: true,
 npcCount: 1,
 })).toMatchObject({
 service: { x: 10, y: 32 },
 task: { x: 32, y: 32 },
 });
 });

it('shifts task badge away from the crowd marker when both are present', () => {
 expect(locationWorldBadgeLayout({
 hasBirthday: false,
 hasQuest: false,
 hasService: false,
 hasTask: true,
 npcCount: 3,
 })).toMatchObject({
 crowd: { x: 27, y: 27 },
 task: { x: 23, y: 32 },
 });
 });
});
