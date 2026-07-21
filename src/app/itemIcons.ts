import type { ContentRegistry } from '@content/defs';

const LEGACY_ITEM_ICON_ALIASES: Readonly<Record<string, string>> = {
  'item.inner-core': 'icon.item.beast-core'
};

export function itemIconAssetId(itemId: string, content?: ContentRegistry): string | undefined {
  const alias = LEGACY_ITEM_ICON_ALIASES[itemId];
  if (alias) return alias;

  if (itemId.startsWith('item.')) return `icon.item.${itemId.slice('item.'.length)}`;
  if (itemId.startsWith('seed.')) return `icon.seed.${itemId.slice('seed.'.length)}`;
  if (itemId.startsWith('pill.')) return `icon.pill.${itemId.slice('pill.'.length)}`;
  if (itemId.startsWith('herb.')) return `icon.herb.${itemId.slice('herb.'.length)}`;

  const herb = content?.seedToHerb.get(itemId);
  if (herb) return `icon.herb.${herb.id.slice('herb.'.length)}`;

  return undefined;
}
