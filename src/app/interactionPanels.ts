export type InteractionPanelState = { kind: 'none' } | { kind: 'farm-action' } | { kind: 'npc-action' } | { kind: 'build' } | { kind: 'upgrade' } | { kind: 'npc'; mode: 'browse' | 'gift' | 'quest' } | { kind: 'festival' } | { kind: 'shop'; festival: boolean } | { kind: 'trade' } | { kind: 'commission' } | { kind: 'tea-shed' } | { kind: 'greenhouse' } | { kind: 'storage'; mode: 'deposit' | 'withdraw' } | { kind: 'shipping'; mode: 'normal' | 'quality' } | { kind: 'processing'; mode: 'drying' | 'sealing' | 'furnace' } | { kind: 'facility-collect' };

export function interactionPanelActive(panel: InteractionPanelState): boolean {
  return panel.kind !== 'none';
}

export function cycleSelection(current: number, length: number, reverse = false): number {
  if (length <= 0) return 0;
  return (current + (reverse ? length - 1 : 1)) % length;
}

export function normalizeSelection(current: number, length: number): number {
  if (length <= 0) return 0;
  return ((current % length) + length) % length;
}

export function selectionLabel(index: number, length: number): string {
  if (length <= 0) return '[0/0]';
  return `[${normalizeSelection(index, length) + 1}/${length}]`;
}

export type FarmActionKind = 'build' | 'facility-collect' | 'storage-deposit' | 'storage-withdraw' | 'processing-drying' | 'processing-sealing' | 'processing-furnace' | 'shipping-normal' | 'shipping-quality' | 'upgrade';

export const FARM_ACTION_ORDER: readonly FarmActionKind[] = ['build', 'facility-collect', 'storage-deposit', 'storage-withdraw', 'processing-drying', 'processing-sealing', 'processing-furnace', 'shipping-normal', 'shipping-quality', 'upgrade'];

export function farmActionIndexFromDigitKey(key: string): number | null {
  if (key === '0') return 9;
  if (key >= '1' && key <= '9') return Number(key) - 1;
  return null;
}

export function npcActionIndexFromDigitKey(key: string): number | null {
  if (key < '1' || key > '3') return null;
  return Number(key) - 1;
}

export function farmActionLabel(kind: FarmActionKind): string {
  switch (kind) {
    case 'build':
      return '建造';
    case 'facility-collect':
      return '设施收取';
    case 'storage-deposit':
      return '仓储-存入';
    case 'storage-withdraw':
      return '仓储-取出';
    case 'processing-drying':
      return '加工-晾晒';
    case 'processing-sealing':
      return '加工-封藏';
    case 'processing-furnace':
      return '加工-熔炼';
    case 'shipping-normal':
      return '出货';
    case 'shipping-quality':
      return '品质出货';
    case 'upgrade':
      return '扩建';
  }
}
