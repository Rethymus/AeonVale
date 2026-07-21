import type { ContentRegistry } from '@content/defs';
import type { CropQuality } from '@sim/farm/quality';
import type { GameState } from '@sim/world/state';
import { getOnboardingObjectiveId, type OnboardingObjectiveId } from '@sim/story/onboarding';
import { itemIconAssetId } from './itemIcons';

export interface InventoryPreviewSelection {
  itemId: string;
  title: string;
  details: string;
  iconId?: string;
  panelAssetId?: string;
}

function objectivePanelAssetId(itemId: string, objectiveId: OnboardingObjectiveId | null): string | undefined {
  switch (objectiveId) {
    case 'first-ship':
    case 'first-sleep':
      return 'facility.shipping-bin';
    case 'first-second-sow':
      return 'loc.farmstead';
    case 'first-market-restock':
      return 'loc.valley-market';
    default:
      return undefined;
  }
}

function sectionPanelAssetId(section: InventorySection): string | undefined {
  switch (section) {
    case 'shipping-quality':
    case 'shipping-normal':
      return 'facility.shipping-bin';
    case 'storage-quality':
    case 'storage-normal':
      return 'loc.farmstead';
    default:
      return undefined;
  }
}

const QUALITY_LABEL: Record<CropQuality, string> = {
  mortal: '凡品',
  spirit: '灵品',
  treasure: '珍品'
};

const QUALITY_ORDER: readonly CropQuality[] = ['treasure', 'spirit', 'mortal'];
const ITEM_GROUP_ORDER = ['seed.', 'herb.', 'pill.', 'item.'] as const;

type InventorySection = 'player-quality' | 'player-normal' | 'storage-quality' | 'storage-normal' | 'shipping-quality' | 'shipping-normal';

interface PreviewCandidate {
  section: InventorySection;
  itemId: string;
  count: number;
  quality?: CropQuality;
}

function itemSortRank(itemId: string): number {
  const idx = ITEM_GROUP_ORDER.findIndex(prefix => itemId.startsWith(prefix));
  return idx >= 0 ? idx : ITEM_GROUP_ORDER.length;
}

function sortedItemIds(entries: Iterable<string>): string[] {
  return [...entries].sort((a, b) => itemSortRank(a) - itemSortRank(b) || a.localeCompare(b, 'zh-CN'));
}

function sectionBaseRank(section: InventorySection): number {
  switch (section) {
    case 'player-quality':
      return 400;
    case 'player-normal':
      return 300;
    case 'storage-quality':
      return 200;
    case 'storage-normal':
      return 100;
    case 'shipping-quality':
      return 80;
    case 'shipping-normal':
      return 40;
  }
}

function objectiveBonus(itemId: string, objectiveId: OnboardingObjectiveId | null): number {
  switch (objectiveId) {
    case 'first-sow':
    case 'first-second-sow':
      return itemId.startsWith('seed.') ? 500 : 0;
    case 'first-water':
    case 'first-harvest':
    case 'first-ship':
      return itemId.startsWith('herb.') ? 500 : itemId.startsWith('seed.') ? 100 : 0;
    case 'first-market-restock':
      return itemId === 'item.spirit-stone' ? 700 : itemId.startsWith('seed.') ? 250 : 0;
    case 'first-sleep':
      return itemId === 'item.spirit-stone' ? 350 : itemId.startsWith('herb.') ? 150 : 0;
    case 'first-second-water':
      return itemId.startsWith('herb.') ? 450 : itemId.startsWith('seed.') ? 150 : 0;
    default:
      return 0;
  }
}

function candidateScore(candidate: PreviewCandidate, objectiveId: OnboardingObjectiveId | null): number {
  const qualityBonus = candidate.quality === 'treasure' ? 30 : candidate.quality === 'spirit' ? 20 : candidate.quality === 'mortal' ? 10 : 0;
  return sectionBaseRank(candidate.section) + objectiveBonus(candidate.itemId, objectiveId) + qualityBonus;
}

function objectiveHintLine(itemId: string, objectiveId: OnboardingObjectiveId | null): string {
  switch (objectiveId) {
    case 'first-sow':
      return itemId.startsWith('seed.') ? '首轮目标：播进田里，先把炼丹和备劫材料种出来。' : '';
    case 'first-water':
      return itemId.startsWith('herb.') ? '首轮目标：先浇稳第一轮水，后面才有炼丹材料。' : '';
    case 'first-harvest':
      return itemId.startsWith('herb.') ? '首轮目标：成熟后收下第一株，接上炼丹、出货与备劫。' : '';
    case 'first-ship':
      return itemId.startsWith('herb.') ? '首轮目标：投进出货箱，换补种、炉料与备劫灵石。' : '';
    case 'first-market-restock':
      return itemId === 'item.spirit-stone' ? '首轮目标：去集市补种，先把资源循环续上。' : itemId.startsWith('seed.') ? '首轮目标：补货后带回田里，继续产炼丹材料。' : '';
    case 'first-second-sow':
      return itemId.startsWith('seed.') ? '首轮目标：回农庄补播，让第二轮药材不断档。' : '';
    case 'first-second-water':
      return itemId.startsWith('herb.') ? '首轮目标：补种后的新苗先浇水，稳住种田备战节奏。' : '';
    default:
      return '';
  }
}

function pushCandidate(candidates: PreviewCandidate[], section: InventorySection, itemId: string, count: number, quality?: CropQuality): void {
  if (count <= 0) return;
  candidates.push({ section, itemId, count, quality });
}

function collectCandidates(state: GameState): PreviewCandidate[] {
  const candidates: PreviewCandidate[] = [];

  for (const quality of QUALITY_ORDER) {
    const batch = state.player.qualityInventory?.[quality] ?? {};
    for (const itemId of sortedItemIds(Object.keys(batch).filter(id => (batch[id] ?? 0) > 0))) {
      pushCandidate(candidates, 'player-quality', itemId, batch[itemId] ?? 0, quality);
    }
  }

  for (const itemId of sortedItemIds(Object.keys(state.player.inventory).filter(id => (state.player.inventory[id]?.count ?? 0) > 0))) {
    pushCandidate(candidates, 'player-normal', itemId, state.player.inventory[itemId]?.count ?? 0);
  }

  for (const quality of QUALITY_ORDER) {
    const batch = state.storage.qualityInventory?.[quality] ?? {};
    for (const itemId of sortedItemIds(Object.keys(batch).filter(id => (batch[id] ?? 0) > 0))) {
      pushCandidate(candidates, 'storage-quality', itemId, batch[itemId] ?? 0, quality);
    }
  }

  for (const itemId of sortedItemIds(Object.keys(state.storage.inventory).filter(id => (state.storage.inventory[id]?.count ?? 0) > 0))) {
    pushCandidate(candidates, 'storage-normal', itemId, state.storage.inventory[itemId]?.count ?? 0);
  }

  for (const quality of QUALITY_ORDER) {
    const batch = state.qualityShippingBin?.[quality] ?? {};
    for (const itemId of sortedItemIds(Object.keys(batch).filter(id => (batch[id] ?? 0) > 0))) {
      pushCandidate(candidates, 'shipping-quality', itemId, batch[itemId] ?? 0, quality);
    }
  }

  for (const itemId of sortedItemIds(Object.keys(state.shippingBin).filter(id => (state.shippingBin[id] ?? 0) > 0))) {
    pushCandidate(candidates, 'shipping-normal', itemId, state.shippingBin[itemId] ?? 0);
  }

  return candidates;
}

export function inventoryPreviewSelection(state: GameState, content: ContentRegistry): InventoryPreviewSelection | null {
  const objectiveId = getOnboardingObjectiveId(state);
  const candidate = collectCandidates(state).sort((a, b) => candidateScore(b, objectiveId) - candidateScore(a, objectiveId) || itemSortRank(a.itemId) - itemSortRank(b.itemId) || a.itemId.localeCompare(b.itemId, 'zh-CN'))[0];
  if (!candidate) return null;

  const title = content.items.get(candidate.itemId)?.displayName ?? candidate.itemId;
  const where = candidate.section.startsWith('player') ? '随身背包' : candidate.section.startsWith('storage') ? '农庄仓库' : '出货箱';
  const quantityLine = candidate.quality ? `${QUALITY_LABEL[candidate.quality]} × ${candidate.count}` : `数量 × ${candidate.count}`;
  const hintLine = objectiveHintLine(candidate.itemId, objectiveId);

  return {
    itemId: candidate.itemId,
    title,
    details: [where, quantityLine, hintLine].filter(line => line.length > 0).join('\n'),
    iconId: itemIconAssetId(candidate.itemId, content),
    panelAssetId: objectivePanelAssetId(candidate.itemId, objectiveId) ?? sectionPanelAssetId(candidate.section)
  };
}
