import type { GameEvent } from '@sim';

const TOOL_NAMES: Record<string, string> = {
  'item.rust-hoe': '铁锈锄',
  'item.water-pail': '灵水桶',
  'item.sickle': '镰刀'
};

const LOW_DURABILITY_THRESHOLD = 3;

export interface ToolFeedbackToastPresentation {
  message: string;
  assetId?: string;
}

function toolName(itemId: string | undefined): string {
  if (!itemId) return '农具';
  return TOOL_NAMES[itemId] ?? itemId;
}

function toolAssetId(itemId: string | undefined, assetIdOverride?: string): string | undefined {
  switch (itemId) {
    case 'item.rust-hoe':
      return 'icon.item.rust-hoe';
    case 'item.water-pail':
      return 'icon.item.water-pail';
    case 'item.sickle':
      return 'icon.item.sickle';
    default:
      return assetIdOverride ?? 'portrait.avatar.player-v1';
  }
}

export function toolFeedbackToastPresentation(events: readonly GameEvent[], assetIdOverride?: string): ToolFeedbackToastPresentation | null {
  const brokeEvent = [...events].reverse().find(event => event.type === 'tool-broke');
  if (brokeEvent) {
    const payload = (brokeEvent.payload ?? {}) as { itemId?: string };
    return {
      message: `${toolName(payload.itemId)}已损坏，先修补再续农务`,
      assetId: toolAssetId(payload.itemId, assetIdOverride)
    };
  }

  const wornEvent = [...events].reverse().find(event => event.type === 'tool-worn');
  if (!wornEvent) return null;
  const payload = (wornEvent.payload ?? {}) as { itemId?: string; durability?: number };
  if (typeof payload.durability !== 'number' || payload.durability < 0 || payload.durability > LOW_DURABILITY_THRESHOLD) {
    return null;
  }

  return {
    message: `${toolName(payload.itemId)}耐久仅剩 ${payload.durability}，尽快修补以免断了药田节奏`,
    assetId: toolAssetId(payload.itemId, assetIdOverride)
  };
}

export function toolFeedbackToast(events: readonly GameEvent[]): string | null {
  return toolFeedbackToastPresentation(events)?.message ?? null;
}
