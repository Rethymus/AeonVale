import type { SfxId } from '@io/audio';
import type { GameEvent } from '@sim';

const END_DAY_EVENT_SFX: ReadonlyArray<readonly [eventType: string, sfxId: SfxId]> = [
  ['season-change', 'season'],
  ['beast-surge-start', 'beast-spawn'],
  ['tribulation-collection-due', 'warn']
];

function settlementTotal(event: GameEvent): number {
  const payload = event.payload as { total?: unknown } | undefined;
  return typeof payload?.total === 'number' ? payload.total : 0;
}

export function endDaySfxQueue(events: readonly GameEvent[]): SfxId[] {
  const queued = new Set<SfxId>();
  for (const event of events) {
    for (const [eventType, sfxId] of END_DAY_EVENT_SFX) {
      if (event.type === eventType) queued.add(sfxId);
    }
    // 出货结算入账：jsfxr 风格明亮"叮"（仅实际获得灵石时）。
    if (event.type === 'shipping-settlement' && settlementTotal(event) > 0) queued.add('coin');
  }
  return [...queued];
}
