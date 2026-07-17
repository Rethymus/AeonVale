import { describe, expect, it } from 'vitest';

import { endDaySfxQueue } from '@app/endDaySfx';
import type { GameEvent } from '@sim';

function event(type: string, payload?: Record<string, unknown>): GameEvent {
  return { type, payload, tick: 0, day: 1 };
}

describe('endDaySfxQueue', () => {
  it('maps season changes, beast surges, and due tribulations to the expected end-of-day SFX', () => {
    expect(endDaySfxQueue([event('crop-mature'), event('season-change'), event('beast-surge-start'), event('tribulation-collection-due')])).toEqual(['season', 'beast-spawn', 'warn']);
  });

  it('deduplicates repeated end-of-day trigger events and ignores unrelated events', () => {
    expect(endDaySfxQueue([event('season-change'), event('season-change'), event('shipping-settlement'), event('beast-surge-start'), event('beast-surge-start'), event('tribulation-collection-due'), event('tribulation-collection-due')])).toEqual(['season', 'beast-spawn', 'warn']);
  });

  it('maps a paid shipping settlement to the coin SFX', () => {
    expect(endDaySfxQueue([event('shipping-settlement', { total: 12 })])).toEqual(['coin']);
  });

  it('does not queue coin when the settlement paid nothing', () => {
    expect(endDaySfxQueue([event('shipping-settlement', { total: 0 })])).toEqual([]);
  });

  it('returns an empty queue when the day produced no mapped audio events', () => {
    expect(endDaySfxQueue([event('crop-mature'), event('shipping-settlement')])).toEqual([]);
  });
});
