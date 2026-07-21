import { toolActionAssetId } from './toolAsset';

export type HotbarSlotKind = 'till' | 'water' | 'harvest' | 'channel-qi' | 'seed';

export interface HotbarSlot {
  kind: HotbarSlotKind;
  seedId?: string;
}

export interface HotbarToastPresentation {
  message: string;
  assetId?: string;
}

export const HOTBAR_SLOTS: readonly HotbarSlot[] = [{ kind: 'till' }, { kind: 'water' }, { kind: 'harvest' }, { kind: 'channel-qi' }, { kind: 'seed', seedId: 'seed.mossling' }, { kind: 'seed', seedId: 'seed.dewroot' }, { kind: 'seed', seedId: 'seed.suncap' }, { kind: 'seed', seedId: 'seed.stonegrain' }, { kind: 'seed', seedId: 'seed.mistfern' }, { kind: 'seed', seedId: 'seed.sunmoss' }];

export const HOTBAR_SLOT_COUNT = HOTBAR_SLOTS.length;

export function hotbarIndexFromDigitKey(key: string): number | null {
  if (key === '0') return 9;
  if (key >= '1' && key <= '9') return Number(key) - 1;
  return null;
}

export function cycleHotbarIndex(index: number, delta: number): number {
  const count = HOTBAR_SLOT_COUNT;
  const base = ((index % count) + count) % count;
  const step = delta % count;
  return (base + step + count) % count;
}

export function findNextHotbarIndex(startIndex: number, delta: number, predicate: (slot: HotbarSlot, index: number) => boolean): number | null {
  if (delta === 0) return predicate(HOTBAR_SLOTS[startIndex] ?? HOTBAR_SLOTS[0]!, startIndex) ? startIndex : null;
  let idx = startIndex;
  for (let i = 0; i < HOTBAR_SLOT_COUNT; i += 1) {
    idx = cycleHotbarIndex(idx, delta);
    const slot = HOTBAR_SLOTS[idx] ?? HOTBAR_SLOTS[0]!;
    if (predicate(slot, idx)) return idx;
  }
  return null;
}

export function findNextOwnedSeedHotbarIndex(startIndex: number, delta: number, seedCount: (seedId: string) => number): number | null {
  return findNextHotbarIndex(startIndex, delta, slot => slot.kind === 'seed' && (slot.seedId ? seedCount(slot.seedId) > 0 : false));
}

export function ownedSeedHotbarIndex(seedId: string, seedCount: (seedId: string) => number): number | null {
  const idx = HOTBAR_SLOTS.findIndex(slot => slot.kind === 'seed' && slot.seedId === seedId);
  if (idx < 0) return null;
  return seedCount(seedId) > 0 ? idx : null;
}

export function hotbarWheelDelta(deltaY: number): number {
  if (deltaY === 0) return 0;
  return deltaY > 0 ? 1 : -1;
}

export function hotbarSlotDisplayName(slot: HotbarSlot, resolveSeedName: (seedId: string) => string, resolveActionName: (kind: Exclude<HotbarSlotKind, 'seed'>) => string): string {
  if (slot.kind === 'seed') return resolveSeedName(slot.seedId ?? '');
  return resolveActionName(slot.kind);
}

export function hotbarStatusText(index: number, resolveSeedName: (seedId: string) => string, resolveActionName: (kind: Exclude<HotbarSlotKind, 'seed'>) => string): string {
  const slot = HOTBAR_SLOTS[index] ?? HOTBAR_SLOTS[0]!;
  const digit = index === 9 ? '0' : String(index + 1);
  return `热栏[${digit}] ${hotbarSlotDisplayName(slot, resolveSeedName, resolveActionName)}｜1-0直选`;
}

export function hotbarToastPresentation(index: number, resolveSeedName: (seedId: string) => string, resolveActionName: (kind: Exclude<HotbarSlotKind, 'seed'>) => string): HotbarToastPresentation {
  const slot = HOTBAR_SLOTS[index] ?? HOTBAR_SLOTS[0]!;
  return {
    message: hotbarStatusText(index, resolveSeedName, resolveActionName),
    assetId: hotbarSlotAssetId(slot)
  };
}

export function hotbarSlotAssetId(slot: HotbarSlot): string | undefined {
  if (slot.kind === 'seed') {
    return slot.seedId ? `icon.${slot.seedId}` : undefined;
  }

  if (slot.kind !== 'channel-qi') {
    return toolActionAssetId(slot.kind);
  }

  switch (slot.kind) {
    case 'channel-qi':
      return 'icon.item.array-core';
  }
}
