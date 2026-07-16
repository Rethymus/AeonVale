import type { Texture } from 'pixi.js';
import type { RuntimeRenderAssets } from '@render/renderer';
import type { FacilityKind, LocationId } from '@sim';

export function resolvePreviewTexture(renderAssets: RuntimeRenderAssets, assetId?: string, fallback?: Texture): Texture | undefined {
  if (!assetId) return fallback;
  if (assetId === 'sprite.player') {
    return renderAssets.player;
  }
  if (assetId.startsWith('facility.')) {
    return renderAssets.facilities[assetId.slice('facility.'.length) as FacilityKind];
  }
  if (assetId.startsWith('loc.')) {
    return renderAssets.locations[assetId.slice('loc.'.length) as LocationId];
  }
  if (assetId.startsWith('sprite.npc.')) {
    return renderAssets.npcs[assetId];
  }
  if (assetId.startsWith('sprite.guard-beast')) {
    return renderAssets.guardBeastVariants?.[assetId] ?? renderAssets.guardBeast;
  }
  if (assetId.startsWith('cg.ending-')) {
    return renderAssets.endingCg[assetId.slice('cg.ending-'.length)];
  }
  if (assetId.startsWith('tile.')) {
    return renderAssets.tiles[assetId];
  }
  if (assetId.startsWith('logo.')) {
    return renderAssets.logos[assetId];
  }
  return renderAssets.itemIcons[assetId];
}
