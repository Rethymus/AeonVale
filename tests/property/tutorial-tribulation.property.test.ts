import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, TUTORIAL_TRIBULATION_REWARD_MILLI } from '@sim';
import { stateHash } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';

const content = buildRegistry();

function run(initialHpMilli: number, useWard: boolean) {
  const state = createWorld({ seed: 31, width: 1, height: 1, content, params: DEFAULT_BALANCE });
  const ctx = createSimContext(31, content, DEFAULT_BALANCE);
  state.player.hp = initialHpMilli;
  state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
  if (useWard) {
    mutateItem(state.player, 'pill.ward-basic', 1);
    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
  }
  applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
  while (state.tutorialTribulation.phase === 'active') {
    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
  }
  return state;
}

describe('PBT-教学天劫不变式', () => {
  it('任意合法初始 HP 与 ward 选择下均有界、可救回且奖励至多一次', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.boolean(), (initialHpMilli, useWard) => {
        const state = run(initialHpMilli, useWard);

        expect(state.tutorialTribulation.boltIndex).toBe(TUTORIAL_TRIBULATION_BOLT_COUNT);
        expect(state.events.filter(event => event.type === 'tutorial-tribulation-bolt-warned')).toHaveLength(TUTORIAL_TRIBULATION_BOLT_COUNT);
        expect(state.events.filter(event => event.type === 'tutorial-tribulation-bolt-resolved')).toHaveLength(TUTORIAL_TRIBULATION_BOLT_COUNT);
        expect(state.tutorialTribulation.hits.direct + state.tutorialTribulation.hits.rod + state.tutorialTribulation.hits.miss + state.tutorialTribulation.hits.blocked).toBe(TUTORIAL_TRIBULATION_BOLT_COUNT);
        expect(state.player.hp).toBeGreaterThan(0);
        expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
        expect(state.player.stage).toBe(0);
        expect(state.gameOver).toBe(false);
        expect(state.ending).toBeNull();
        expect(state.tutorialTribulation.failureLatched).toBe(state.tutorialTribulation.outcome === 'rescued');
        expect(state.tutorialTribulation.rewardMilli).toBeGreaterThanOrEqual(0);
        expect(state.tutorialTribulation.rewardMilli).toBeLessThanOrEqual(TUTORIAL_TRIBULATION_REWARD_MILLI);
        expect(state.player.cultivation).toBe(state.tutorialTribulation.rewardMilli);
      })
    );
  });

  it('相同初始状态与动作序列产生相同完整状态哈希', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100_000 }), fc.boolean(), (initialHpMilli, useWard) => {
        const first = run(initialHpMilli, useWard);
        const second = run(initialHpMilli, useWard);
        expect(first.events).toEqual(second.events);
        expect(stateHash(first)).toBe(stateHash(second));
      })
    );
  });
});
