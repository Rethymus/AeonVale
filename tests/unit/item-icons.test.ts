import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRegistry } from '@content/registry';
import { itemIconAssetId } from '@app/itemIcons';

describe('item icon helper', () => {
  const reg = buildRegistry();
  const manifest = JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8')) as Record<string, unknown>;
  const manifestIds = new Set(
    Object.values(manifest)
      .filter(Array.isArray)
      .flatMap(entries => entries)
      .map(entry => (entry as { id?: string }).id)
      .filter((id): id is string => typeof id === 'string')
  );

  it('maps direct item families to manifest-backed icon ids', () => {
    expect(itemIconAssetId('item.spirit-stone')).toBe('icon.item.spirit-stone');
    expect(itemIconAssetId('seed.mossling')).toBe('icon.seed.mossling');
    expect(itemIconAssetId('pill.ascend')).toBe('icon.pill.ascend');
    expect(itemIconAssetId('herb.mossling')).toBe('icon.herb.mossling');
  });

  it('can remap legacy item ids onto current manifest-backed icon assets', () => {
    expect(itemIconAssetId('item.inner-core')).toBe('icon.item.beast-core');
  });

  it('can resolve herb icon from seed id through content registry', () => {
    expect(itemIconAssetId('seed.frostmarrow', reg)).toBe('icon.seed.frostmarrow');
    expect(itemIconAssetId('unknown.item', reg)).toBeUndefined;
  });

  it('keeps all manifest-backed high-frequency content families resolvable to real icon assets', () => {
    const directFamilies = [...reg.items.keys(), ...reg.herbs.keys(), ...reg.pills.keys()];

    for (const contentId of directFamilies) {
      const iconId = itemIconAssetId(contentId, reg);
      expect(iconId, `${contentId} should resolve to an icon id`).toBeDefined;
      expect(manifestIds.has(iconId!), `${contentId} should resolve to a manifest-backed icon asset`).toBe(true);
    }

    for (const seedId of reg.seedToHerb.keys()) {
      const iconId = itemIconAssetId(seedId, reg);
      expect(iconId, `${seedId} should resolve to an icon id`).toBeDefined;
      expect(manifestIds.has(iconId!), `${seedId} should resolve to a manifest-backed icon asset`).toBe(true);
    }
  });
});
