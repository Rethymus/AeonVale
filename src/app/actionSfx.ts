import type { SfxId } from '@io/audio';
import type { GameEvent } from '@sim';

function eventDamage(event: GameEvent): number {
 const payload = event.payload as { damage?: unknown } | undefined;
 return typeof payload?.damage === 'number' ? payload.damage : 0;
}

export function actionSfxQueue(events: readonly GameEvent[]): SfxId[] {
 const queued = new Set<SfxId>();
 for (const event of events) {
 if (event.type === 'ruin-delve' && eventDamage(event) > 0) queued.add('hurt');
 if (event.type === 'beast-hunted' && eventDamage(event) > 0) queued.add('hurt');
 }
 return [...queued];
}
