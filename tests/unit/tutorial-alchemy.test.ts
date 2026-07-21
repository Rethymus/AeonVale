import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { applyAction, brewPills, brewTutorialWardPill, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG } from '@sim';
import { itemCount, mutateItem } from '@sim/world/player';

describe('教学炼丹药包', () => {
  it('虚拟药包不发高阶材料，失败可重试，成功只产一枚正式承雷丹', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 11, width: 6, height: 6, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(11, content, DEFAULT_BALANCE);
    state.player.flags.add(FIRST_HARVEST_FLAG);

    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);

    expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
    expect(itemCount(state.player, 'herb.metalpine')).toBe(0);
    expect(itemCount(state.player, 'herb.frostmarrow')).toBe(0);
    expect(state.events.at(-1)).toMatchObject({
      type: 'tutorial-alchemy-kit-ready',
      payload: { recipeId: 'recipe.ward-pill' }
    });

    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 0 }, ctx);

    expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(false);
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(0);
    expect(state.events.at(-1)).toMatchObject({
      type: 'tutorial-brew-resolved',
      payload: { outcome: 'waste', completed: false, retryable: true }
    });

    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);

    expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(false);
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(true);
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(1);
    expect(state.events.at(-1)).toMatchObject({
      type: 'tutorial-brew-resolved',
      payload: { pillId: 'pill.ward-basic', completed: true, retryable: false }
    });

    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);

    expect(itemCount(state.player, 'pill.ward-basic')).toBe(1);
    expect(itemCount(state.player, 'herb.metalpine')).toBe(0);
    expect(itemCount(state.player, 'herb.frostmarrow')).toBe(0);
  });

  it('背包满时不消耗虚拟药包，腾出槽位后仍只产一枚', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 12, width: 6, height: 6, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(12, content, DEFAULT_BALANCE);
    state.player.flags.add(FIRST_HARVEST_FLAG);
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    mutateItem(state.player, 'item.spirit-stone', 1);
    state.player.inventoryCapacity = 1;
    const poisonBefore = state.player.pillPoison;

    const rejected = brewTutorialWardPill(state, 47_000, ctx);

    expect(rejected).toMatchObject({ attempted: false, completed: false, retryable: true, brew: null, reason: 'inventory-full' });
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
    expect(state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(false);
    expect(state.player.pillPoison).toBe(poisonBefore);
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(0);
    expect(state.events.at(-1)).toMatchObject({ type: 'tutorial-brew-rejected', payload: { reason: 'inventory-full' } });

    mutateItem(state.player, 'item.spirit-stone', -1);
    const completed = brewTutorialWardPill(state, 47_000, ctx);

    expect(completed).toMatchObject({ attempted: true, completed: true, retryable: false });
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(1);
  });

  it('正式非教学废丹仍消耗材料并累积原有丹毒副作用', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 13, width: 6, height: 6, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(13, content, DEFAULT_BALANCE);
    mutateItem(state.player, 'herb.metalpine', 1);
    mutateItem(state.player, 'herb.frostmarrow', 1);

    const result = brewPills(
      state,
      {
        materials: [
          { herbId: 'herb.metalpine', qty: 1 },
          { herbId: 'herb.frostmarrow', qty: 1 }
        ],
        avgHeatMilli: 0
      },
      ctx
    );

    expect(result).toMatchObject({ outcome: 'waste', poisonGainMilli: 3_000 });
    expect(state.player.pillPoison).toBe(3_000);
    expect(itemCount(state.player, 'herb.metalpine')).toBe(0);
    expect(itemCount(state.player, 'herb.frostmarrow')).toBe(0);
    expect(state.events.at(-1)).toMatchObject({ type: 'brew-waste' });
  });
});
