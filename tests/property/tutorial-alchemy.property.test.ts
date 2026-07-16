import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG } from '@sim';
import { itemCount } from '@sim/world/player';

const content = buildRegistry();

describe('PBT-教学炼丹不变式', () => {
  it('任意次数错误火候都不累积持久伤害，随后正确火候仍只产一枚正式丹', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 80 }), failedAttempts => {
        const state = createWorld({ seed: 41, width: 6, height: 6, content, params: DEFAULT_BALANCE });
        const ctx = createSimContext(41, content, DEFAULT_BALANCE);
        state.player.flags.add(FIRST_HARVEST_FLAG);
        applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
        const hpBefore = state.player.hp;
        const poisonBefore = state.player.pillPoison;

        for (let attempt = 0; attempt < failedAttempts; attempt++) {
          applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 0 }, ctx);
        }

        expect(state.player.hp).toBe(hpBefore);
        expect(state.player.pillPoison).toBe(poisonBefore);
        expect(state.gameOver).toBe(false);
        expect(state.ending).toBeNull();
        expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
        expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(false);
        expect(itemCount(state.player, 'pill.ward-basic')).toBe(0);
        expect(state.events.some(event => event.type === 'brew-waste' || event.type === 'furnace-explosion')).toBe(false);

        applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);
        applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);

        expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(false);
        expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(true);
        expect(itemCount(state.player, 'pill.ward-basic')).toBe(1);
        expect(state.gameOver).toBe(false);
        expect(state.ending).toBeNull();
      }),
      { examples: [[80]] }
    );
  });
});
