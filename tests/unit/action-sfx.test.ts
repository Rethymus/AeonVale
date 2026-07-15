import { describe, expect, it } from 'vitest';

import { actionSfxQueue } from '@app/actionSfx';
import type { GameEvent } from '@sim';

function event(type: string, payload?: Record<string, unknown>): GameEvent {
 return { type, payload, tick: 0, day: 1 };
}

describe('actionSfxQueue', () => {
 it('maps ruin delve and beast hunt damage events to hurt SFX', () => {
 expect(actionSfxQueue([
 event('ruin-delve', { damage: 8 }),
 event('beast-hunted', { damage: 4 }),
 ])).toEqual(['hurt']);
 });

it('ignores non-damaging or unrelated action events', () => {
 expect(actionSfxQueue([
 event('ruin-delve', { damage: 0 }),
 event('beast-hunted', { damage: 0 }),
 event('beast-loot', { itemId: 'item.beast-core' }),
 event('explore', { grants: [{ itemId: 'item.recipe-fragment', count: 1 }] }),
 ])).toEqual([]);
 });

it('deduplicates repeated hurt-producing events in the same action batch', () => {
 expect(actionSfxQueue([
 event('beast-hunted', { damage: 4 }),
 event('beast-hunted', { damage: 4 }),
 event('ruin-delve', { damage: 8 }),
 ])).toEqual(['hurt']);
 });
});
