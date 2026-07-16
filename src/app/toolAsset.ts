import type { ToolActionKind } from '@sim';

export function toolActionAssetId(action: ToolActionKind): string {
  switch (action) {
    case 'till':
      return 'icon.item.rust-hoe';
    case 'water':
      return 'icon.item.water-pail';
    case 'harvest':
      return 'icon.item.sickle';
  }
}

export function upgradeToolAssetId(upgradeId: string): string | null {
  if (upgradeId === 'tool-hoe-1') return toolActionAssetId('till');
  if (upgradeId === 'tool-pail-1') return toolActionAssetId('water');
  if (upgradeId === 'tool-sickle-1') return toolActionAssetId('harvest');
  return null;
}
