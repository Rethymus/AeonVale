import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { resolvePreviewTexture } from '@app/previewTexture';
import type { RuntimeRenderAssets } from '@render/renderer';

function assets(): RuntimeRenderAssets {
  const player = new Texture({ source: Texture.EMPTY.source });
  const facility = Texture.EMPTY;
  const shippingFacility = new Texture({ source: Texture.EMPTY.source });
  const location = new Texture({ source: Texture.EMPTY.source });
  const npc = new Texture({ source: Texture.EMPTY.source });
  const guardBeast = new Texture({ source: Texture.EMPTY.source });
  const guardBeastWolf = new Texture({ source: Texture.EMPTY.source });
  const tile = new Texture({ source: Texture.EMPTY.source });
  const icon = new Texture({ source: Texture.EMPTY.source });
  const logo = new Texture({ source: Texture.EMPTY.source });
  const portrait = new Texture({ source: Texture.EMPTY.source });
  const fullPortrait = new Texture({ source: Texture.EMPTY.source });
  const mapSprite = new Texture({ source: Texture.EMPTY.source });
  const inventoryIcon = new Texture({ source: Texture.EMPTY.source });
  return {
    player,
    guardBeast,
    guardBeastVariants: { 'sprite.guard-beast-wolf': guardBeastWolf },
    cropHerbs: {},
    cropSeeds: {},
    facilities: { 'drying-rack': facility, 'shipping-bin': shippingFacility },
    locations: { greenhouse: location },
    logos: { 'logo.full': logo },
    hotbarIcons: {},
    itemIcons: { 'icon.herb.mossling': icon },
    npcs: { 'sprite.npc.herb-gatherer': npc },
    portraits: { 'portrait.avatar.herb-gatherer-v1': portrait, 'portrait.player-default-v1': fullPortrait },
    mapSprites: { 'map-sprite.herb-gatherer-v1': mapSprite },
    inventoryIcons: { 'inventory-icon.item.rust-hoe-v1': inventoryIcon },
    tiles: { 'tile.wet-loam': tile }
  };
}

describe('preview texture resolver', () => {
  it('resolves player, facility, location, npc, guard beast variants, tile, logo, and item asset ids', () => {
    const renderAssets = assets();

    expect(resolvePreviewTexture(renderAssets, 'sprite.player')).toBe(renderAssets.player);
    expect(resolvePreviewTexture(renderAssets, 'facility.drying-rack')).toBe(renderAssets.facilities['drying-rack']);
    expect(resolvePreviewTexture(renderAssets, 'facility.shipping-bin')).toBe(renderAssets.facilities['shipping-bin']);
    expect(resolvePreviewTexture(renderAssets, 'loc.greenhouse')).toBe(renderAssets.locations.greenhouse);
    expect(resolvePreviewTexture(renderAssets, 'sprite.npc.herb-gatherer')).toBe(renderAssets.npcs['sprite.npc.herb-gatherer']);
    expect(resolvePreviewTexture(renderAssets, 'sprite.guard-beast')).toBe(renderAssets.guardBeast);
    expect(resolvePreviewTexture(renderAssets, 'sprite.guard-beast-wolf')).toBe(renderAssets.guardBeastVariants?.['sprite.guard-beast-wolf']);
    expect(resolvePreviewTexture(renderAssets, 'sprite.guard-beast-boar')).toBe(renderAssets.guardBeast);
    expect(resolvePreviewTexture(renderAssets, 'tile.wet-loam')).toBe(renderAssets.tiles['tile.wet-loam']);
    expect(resolvePreviewTexture(renderAssets, 'logo.full')).toBe(renderAssets.logos['logo.full']);
    expect(resolvePreviewTexture(renderAssets, 'icon.herb.mossling')).toBe(renderAssets.itemIcons['icon.herb.mossling']);
    expect(resolvePreviewTexture(renderAssets, 'portrait.avatar.herb-gatherer-v1')).toBe(renderAssets.portraits?.['portrait.avatar.herb-gatherer-v1']);
    expect(resolvePreviewTexture(renderAssets, 'portrait.player-default-v1')).toBe(renderAssets.portraits?.['portrait.player-default-v1']);
    expect(resolvePreviewTexture(renderAssets, 'map-sprite.herb-gatherer-v1')).toBe(renderAssets.mapSprites?.['map-sprite.herb-gatherer-v1']);
    expect(resolvePreviewTexture(renderAssets, 'inventory-icon.item.rust-hoe-v1')).toBe(renderAssets.inventoryIcons?.['inventory-icon.item.rust-hoe-v1']);
  });

  it('returns explicit fallback only when asset id is absent', () => {
    const renderAssets = assets();
    const fallback = new Texture({ source: Texture.EMPTY.source });

    expect(resolvePreviewTexture(renderAssets, undefined, fallback)).toBe(fallback);
    expect(resolvePreviewTexture(renderAssets, 'loc.festival-ground', fallback)).toBeUndefined;
    expect(resolvePreviewTexture(renderAssets, 'icon.unknown', fallback)).toBeUndefined;
  });
});
