import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { advanceDay, applyAction, applyMvpStarterKit, createSimContext, createSimContextFromState, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG, getPublicDemoObjectiveId, tileAt, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, TUTORIAL_TRIBULATION_REWARD_MILLI } from '@sim';
import { deserializeState, roundTripEqual, serializeState } from '@sim/serialize';
import { itemCount } from '@sim/world/player';

describe('公开试玩纯 sim 纵切片', () => {
  it('收获灵草后立即进入炼丹，再完成三雷与 Aftermath', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 20260710, width: 8, height: 8, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(20260710, content, DEFAULT_BALANCE);
    applyMvpStarterKit(state, DEFAULT_BALANCE);
    const at = { x: 4, y: 4 };

    expect(getPublicDemoObjectiveId(state)).toBe('first-till');
    applyAction(state, { kind: 'till', at }, ctx);
    applyAction(state, { kind: 'sow', at, seedId: 'seed.mossling' }, ctx);
    applyAction(state, { kind: 'water', at }, ctx);
    for (let day = 0; day < 20; day++) {
      const crop = state.crops.get(tileAt(state, at.x, at.y)!.id);
      if (crop?.stage === 'mature') break;
      advanceDay(state, ctx);
      if (state.crops.get(tileAt(state, at.x, at.y)!.id)?.stage !== 'mature') {
        applyAction(state, { kind: 'water', at }, ctx);
      }
    }
    applyAction(state, { kind: 'harvest', at }, ctx);

    expect(getPublicDemoObjectiveId(state)).toBe('journey-alchemy');
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);
    expect(getPublicDemoObjectiveId(state)).toBe('journey-tribulation');

    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    while (state.tutorialTribulation.phase === 'active') {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    }
    expect(getPublicDemoObjectiveId(state)).toBe('journey-aftermath');
    expect(roundTripEqual(state)).toBe(true);

    applyAction(state, { kind: 'acknowledge-tutorial-aftermath' }, ctx);
    expect(getPublicDemoObjectiveId(state)).toBe('journey-complete');
    expect(roundTripEqual(state)).toBe(true);
  });

  it('致命失败结算跨存档后补包重炼，半血仅服 ward 且无阵法即可再战成功', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 20260716, width: 1, height: 1, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(20260716, content, DEFAULT_BALANCE);
    state.player.flags.add(FIRST_HARVEST_FLAG);
    applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
    applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, ctx);
    state.player.hp = 1;
    applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    for (let index = 0; index < TUTORIAL_TRIBULATION_BOLT_COUNT; index++) {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    }

    expect(state.tutorialTribulation).toMatchObject({ phase: 'aftermath', boltIndex: 3, failureLatched: true, outcome: 'rescued' });
    expect(state.player.hp).toBe(50_000);
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(0);
    expect(state.gameOver).toBe(false);

    const restored = deserializeState(serializeState(state));
    const restoredCtx = createSimContextFromState(restored, content, DEFAULT_BALANCE);
    applyAction(restored, { kind: 'acknowledge-tutorial-aftermath' }, restoredCtx);
    expect(restored.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)).toBe(false);
    expect(restored.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG)).toBe(true);
    expect(getPublicDemoObjectiveId(restored)).toBe('journey-alchemy');

    applyAction(restored, { kind: 'brew-tutorial-pill', avgHeatMilli: 47_000 }, restoredCtx);
    applyAction(restored, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, restoredCtx);
    expect(restored.player.hp).toBe(50_000);
    expect(restored.player.wardMitigation).toBe(0.4);
    expect(restored.arrays.size).toBe(0);
    applyAction(restored, { kind: 'start-tutorial-tribulation' }, restoredCtx);
    for (let index = 0; index < TUTORIAL_TRIBULATION_BOLT_COUNT; index++) {
      applyAction(restored, { kind: 'resolve-tutorial-bolt' }, restoredCtx);
    }

    expect(restored.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: 3,
      failureLatched: false,
      outcome: 'survived',
      rewardMilli: TUTORIAL_TRIBULATION_REWARD_MILLI
    });
    expect(restored.player.hp).toBe(10_400);
    expect(restored.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
    expect(restored.player.stage).toBe(0);
    expect(restored.gameOver).toBe(false);
    expect(restored.ending).toBeNull();

    applyAction(restored, { kind: 'acknowledge-tutorial-aftermath' }, restoredCtx);
    expect(getPublicDemoObjectiveId(restored)).toBe('journey-complete');
  });
});
