import type { ContentRegistry } from '@content/defs';
import type { CropQuality } from '@sim/farm/quality';
import { shippingLines } from '@sim/economy/shipping';
import type { SimContext } from '@sim/world/context';
import type { GameState } from '@sim/world/state';
import { itemIconAssetId } from '@app/itemIcons';

export interface InventoryIconStripEntry {
 itemId: string;
 count: number;
 iconId: string;
 section: 'inventory' | 'storage' | 'shipping';
 quality?: CropQuality;
}

const QUALITY_ORDER: readonly CropQuality[] = ['treasure', 'spirit', 'mortal'];
const SECTION_LIMITS: Record<InventoryIconStripEntry['section'], number> = {
 inventory: 4,
 storage: 3,
 shipping: 3,
};

function pushIfIcon(
 out: InventoryIconStripEntry[],
 seen: Set<string>,
 section: InventoryIconStripEntry['section'],
 itemId: string,
 count: number,
 content: ContentRegistry,
 quality?: CropQuality,
): void {
 if (count <= 0) return;
 const iconId = itemIconAssetId(itemId, content);
 if (!iconId) return;
 const key = `${section}:${itemId}:${quality ?? 'normal'}`;
 if (seen.has(key)) return;
 seen.add(key);
 out.push({ itemId, count, iconId, section, quality });
}

export function inventoryIconStripEntries(state: GameState, content: ContentRegistry, ctx?: SimContext): InventoryIconStripEntry[] {
 const entries: InventoryIconStripEntry[] = [];
 const seen = new Set<string>();

for (const quality of QUALITY_ORDER) {
 const batch = state.player.qualityInventory?.[quality] ?? {};
 for (const [itemId, count] of Object.entries(batch).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
 if (entries.filter((entry) => entry.section === 'inventory').length >= SECTION_LIMITS.inventory) break;
 pushIfIcon(entries, seen, 'inventory', itemId, count, content, quality);
 }
 }
 for (const [itemId, slot] of Object.entries(state.player.inventory)
 .filter(([, slot]) => (slot?.count ?? 0) > 0)
 .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0) || a[0].localeCompare(b[0]))) {
 if (entries.filter((entry) => entry.section === 'inventory').length >= SECTION_LIMITS.inventory) break;
 pushIfIcon(entries, seen, 'inventory', itemId, slot!.count, content);
 }

for (const [itemId, slot] of Object.entries(state.storage.inventory)
 .filter(([, slot]) => (slot?.count ?? 0) > 0)
 .sort((a, b) => (b[1]?.count ?? 0) - (a[1]?.count ?? 0) || a[0].localeCompare(b[0]))) {
 if (entries.filter((entry) => entry.section === 'storage').length >= SECTION_LIMITS.storage) break;
 pushIfIcon(entries, seen, 'storage', itemId, slot!.count, content);
 }
 for (const quality of QUALITY_ORDER) {
 const batch = state.storage.qualityInventory?.[quality] ?? {};
 for (const [itemId, count] of Object.entries(batch).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
 if (entries.filter((entry) => entry.section === 'storage').length >= SECTION_LIMITS.storage) break;
 pushIfIcon(entries, seen, 'storage', itemId, count, content, quality);
 }
 }

if (ctx) {
 for (const line of shippingLines(state, ctx).sort((a, b) => b.total - a.total || a.itemId.localeCompare(b.itemId))) {
 if (entries.filter((entry) => entry.section === 'shipping').length >= SECTION_LIMITS.shipping) break;
 pushIfIcon(entries, seen, 'shipping', line.itemId, line.count, content, line.quality);
 }
 }

return entries;
}
