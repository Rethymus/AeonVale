import type { AssetStore } from '@io/assets';
import { EXTRA_NPC_PREVIEW_ASSET_IDS, NPC_PREVIEW_IDS, npcPortraitAssetId } from './locationPreview';

export function runtimeNpcAssetIds(store: AssetStore): string[] {
  const catalogNpcAssetIds = NPC_PREVIEW_IDS.map(npcId => npcPortraitAssetId(npcId)).filter((id): id is string => Boolean(id));
  const manifestNpcAssetIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('sprite.npc.'));

  return [...new Set([...catalogNpcAssetIds, ...EXTRA_NPC_PREVIEW_ASSET_IDS, ...manifestNpcAssetIds])];
}
