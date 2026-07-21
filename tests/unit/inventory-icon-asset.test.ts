import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildRegistry } from '@content/registry';
import { itemIconAssetId } from '@app/itemIcons';
import { inventoryIconAssetId, inventoryIconUrl } from '@app/inventoryUI';
import { validateManifest, type AssetManifest } from '@io/assets';

const manifest: AssetManifest = validateManifest(JSON.parse(readFileSync(resolve('assets/manifest.json'), 'utf-8')));
const spritesById = new Map(manifest.sprites.map(entry => [entry.id, entry]));
const baseIcons = manifest.sprites.filter(entry => entry.id.startsWith('icon.'));
const inventoryIcons = manifest.sprites.filter(entry => entry.id.startsWith('inventory-icon.'));

function inventoryIdForIcon(iconId: string): string {
  return `inventory-${iconId}-v1`;
}

function readPngSize(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  expect(buf[0]).toBe(0x89);
  expect(buf.subarray(1, 4).toString('ascii')).toBe('PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe('inventory icon assets', () => {
  it('has exactly one 64px inventory card for every base icon asset', () => {
    expect(baseIcons.length).toBeGreaterThan(70);
    expect(inventoryIcons).toHaveLength(baseIcons.length);

    for (const icon of baseIcons) {
      const inventoryId = inventoryIdForIcon(icon.id);
      expect(spritesById.has(inventoryId), `${icon.id} should have ${inventoryId}`).toBe(true);
    }
  });

  it('keeps every inventory-card file present, 64px, and checksum-stable', () => {
    for (const entry of inventoryIcons) {
      const filePath = resolve('assets', entry.path);
      expect(() => statSync(filePath), `${entry.id} file should exist`).not.toThrow();

      const size = readPngSize(filePath);
      expect(size, `${entry.id} should be 64x64`).toEqual({ width: 64, height: 64 });

      const digest = createHash('sha256').update(readFileSync(filePath)).digest('hex');
      expect(digest, `${entry.id} checksum should match manifest`).toBe(entry.checksum);
    }
  });

  it('resolves every current registry item id to an existing inventory-card asset', () => {
    const reg = buildRegistry();
    const itemIds = [...reg.items.keys()].sort();

    expect(itemIds.length).toBeGreaterThan(70);

    for (const itemId of itemIds) {
      const iconId = itemIconAssetId(itemId, reg);
      expect(iconId, `${itemId} should resolve to a base icon`).toBeDefined();

      const inventoryId = inventoryIconAssetId(itemId, reg);
      expect(inventoryId, `${itemId} should resolve to an inventory icon`).toBe(inventoryIdForIcon(iconId!));
      expect(spritesById.has(inventoryId!), `${itemId} inventory icon should be in manifest`).toBe(true);
      expect(inventoryIconUrl(itemId, reg), `${itemId} inventory icon URL should point to the card file`).toBe(`./inventory-icons/${inventoryId}.png`);
    }
  });
});
