import type { SfxId } from '@io/audio';
import type { GameEvent } from '@sim';

const END_DAY_EVENT_SFX: ReadonlyArray<readonly [eventType: string, sfxId: SfxId]> = [
 ['season-change', 'season'],
 ['beast-surge-start', 'beast-spawn'],
 ['tribulation-collection-due', 'warn'],
];

export function endDaySfxQueue(events: readonly GameEvent[]): SfxId[] {
 const queued = new Set<SfxId>();
 for (const event of events) {
 for (const [eventType, sfxId] of END_DAY_EVENT_SFX) {
 if (event.type === eventType) queued.add(sfxId);
 }
 }
 return [...queued];
}
