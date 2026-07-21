import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { inventoryIconAssetId, inventoryIconUrl, recipeWorkbenchProjection } from '@app/inventoryUI';

describe('inventoryUI icon mapping', () => {
  it('maps itemId "prefix.slug" → ./inventory-icons/inventory-icon.{prefix}.{slug}-v1.png (document-relative, base-safe)', () => {
    expect(inventoryIconUrl('item.spirit-stone')).toBe('./inventory-icons/inventory-icon.item.spirit-stone-v1.png');
    expect(inventoryIconUrl('herb.mossling')).toBe('./inventory-icons/inventory-icon.herb.mossling-v1.png');
    expect(inventoryIconUrl('pill.ward-basic')).toBe('./inventory-icons/inventory-icon.pill.ward-basic-v1.png');
    expect(inventoryIconUrl('item.rust-hoe')).toBe('./inventory-icons/inventory-icon.item.rust-hoe-v1.png');
  });

  it('falls back gracefully for ids without a dot', () => {
    expect(inventoryIconUrl('loose')).toBe('./inventory-icons/inventory-icon.loose-v1.png');
  });

  it('keeps slugs that contain hyphens (e.g. ironwill-thorn) intact', () => {
    expect(inventoryIconUrl('herb.ironwill-thorn')).toBe('./inventory-icons/inventory-icon.herb.ironwill-thorn-v1.png');
  });

  it('uses manifest-backed item icon mapping for dedicated processed materials', () => {
    const reg = buildRegistry();

    expect(inventoryIconAssetId('item.herbal-wine', reg)).toBe('inventory-icon.item.herbal-wine-v1');
    expect(inventoryIconUrl('item.herbal-wine', reg)).toBe('./inventory-icons/inventory-icon.item.herbal-wine-v1.png');
    expect(inventoryIconAssetId('item.spirit-poultice', reg)).toBe('inventory-icon.item.spirit-poultice-v1');
    expect(inventoryIconUrl('item.spirit-poultice', reg)).toBe('./inventory-icons/inventory-icon.item.spirit-poultice-v1.png');
  });

  it('projects recipe inputs into a nine-palace workbench while reserving the furnace center', () => {
    const reg = buildRegistry();
    const ward = reg.recipes.get('recipe.ward-pill')!;
    const detox = reg.recipes.get('recipe.detox-pill')!;

    expect(recipeWorkbenchProjection(ward).map(cell => [cell.index, cell.role, cell.requiredItemId, cell.furnace])).toEqual([
      [0, '君', 'herb.metalpine', false],
      [1, '臣', 'herb.frostmarrow', false],
      [2, '佐', null, false],
      [3, '引', null, false],
      [4, '炉心', null, true],
      [5, '辅', null, false],
      [6, '使', null, false],
      [7, '余', null, false],
      [8, '封', null, false]
    ]);
    expect(recipeWorkbenchProjection(detox).filter(cell => cell.requiredItemId === 'herb.dewroot').map(cell => cell.index)).toEqual([0, 1]);
  });
});
