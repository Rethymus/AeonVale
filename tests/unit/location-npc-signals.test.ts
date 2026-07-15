import { describe, expect, it } from 'vitest';
import { firstPriorityLocationNpcSignal } from '@app/locationNpcSignals';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { FIRST_SECOND_WATER_FLAG } from '@sim/story/onboarding';
import { relationshipEventFlag } from '@sim/social/relationshipEvents';
import { mutateItem } from '@sim/world/player';

describe('location npc signals', () => {
 it('breaks same-priority npc signal ties deterministically instead of depending on directory order', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 81, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);
 state.flags.add(relationshipEventFlag('array-smith-160'));
 state.flags.add(relationshipEventFlag('wandering-cultivator-160'));
 mutateItem(state.player, 'item.broken-talisman', 2);
 mutateItem(state.player, 'item.array-core', 1);
 mutateItem(state.player, 'item.beast-core', 2);
 mutateItem(state.player, 'item.spirit-stone', 10);

const signal = firstPriorityLocationNpcSignal(state);

expect(signal?.location.id).toBe('valley-market');
 expect(signal?.signals.questReadyNames).toEqual(['游方散修']);
 });

it('falls back to a stable locale order when same-priority npc signal strength is tied', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 82, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);
 state.season = 'summer';
 state.seasonDay = 8;
 state.day = 5;

const signal = firstPriorityLocationNpcSignal(state);

expect(signal?.location.id).toBe('creek-field');
 expect(signal?.signals.birthdayNames).toEqual(['采药女']);
 });
});
