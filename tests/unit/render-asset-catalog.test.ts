import { describe, expect, it } from 'vitest';
import { AssetStore, validateManifest, type AssetManifest } from '@io/assets';
import { runtimeNpcAssetIds } from '@app/renderAssetCatalog';

function storeWithNpcAssets(spriteIds: readonly string[]): AssetStore {
  const manifest: AssetManifest = validateManifest({
    version: 1,
    sprites: spriteIds.map((id, index) => ({
      id,
      path: `sprites/${index}.png`,
      type: 'png',
      checksum: `${index}`.padStart(64, '0'),
      license: 'AI-Generated',
      source: 'test fixture'
    })),
    audio: [],
    fonts: [],
    shaders: []
  });
  return new AssetStore(manifest);
}

describe('runtime npc asset catalog', () => {
  it('includes clear sim-backed portraits, fallback preview sprites, and all manifest sprite.npc assets', () => {
    const store = storeWithNpcAssets(['sprite.npc.herb-gatherer', 'sprite.npc.market-merchant', 'sprite.npc.mysterious-guest', 'icon.item.spirit-stone']);

    const ids = runtimeNpcAssetIds(store);

    expect(ids).toContain('sprite.npc.wandering-cultivator');
    expect(ids).toContain('portrait.avatar.herb-gatherer-v1');
    expect(ids).toContain('portrait.avatar.array-smith-lu-v1');
    expect(ids).toContain('sprite.npc.herb-gatherer');
    expect(ids).toContain('sprite.npc.market-merchant');
    expect(ids).toContain('sprite.npc.mysterious-guest');
    expect(ids).not.toContain('icon.item.spirit-stone');
  });

  it('deduplicates asset ids contributed by catalog, fallback list, and manifest', () => {
    const store = storeWithNpcAssets(['sprite.npc.herb-gatherer', 'sprite.npc.market-merchant', 'sprite.npc.market-merchant'].filter((id, index, all) => all.indexOf(id) === index));

    const ids = runtimeNpcAssetIds(store);
    const merchantIds = ids.filter(id => id === 'sprite.npc.market-merchant');

    expect(merchantIds).toHaveLength(1);
  });
});
