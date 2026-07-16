import { describe, expect, it } from 'vitest';
import { toolActionAssetId, upgradeToolAssetId } from '@app/toolAsset';

describe('tool asset helpers', () => {
 it('maps core farm actions to their runtime tool icons', () => {
 expect(toolActionAssetId('till')).toBe('icon.item.rust-hoe');
 expect(toolActionAssetId('water')).toBe('icon.item.water-pail');
 expect(toolActionAssetId('harvest')).toBe('icon.item.sickle');
 });

it('maps tool upgrades onto the same shared tool icon chain', () => {
 expect(upgradeToolAssetId('tool-hoe-1')).toBe('icon.item.rust-hoe');
 expect(upgradeToolAssetId('tool-pail-1')).toBe('icon.item.water-pail');
 expect(upgradeToolAssetId('tool-sickle-1')).toBe('icon.item.sickle');
 expect(upgradeToolAssetId('farmstead-expansion-1')).toBeNull;
 });
});
