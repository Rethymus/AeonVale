import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createSimContextFromState, createWorld, DEFAULT_BALANCE, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_TRIBULATION_COMPLETED_FLAG, TUTORIAL_TRIBULATION_REWARDED_FLAG, TUTORIAL_TRIBULATION_REWARD_MILLI } from '@sim';
import { deserializeState, serializeState, stateHash } from '@sim/serialize';

describe('教学天劫存档兼容', () => {
  it('默认状态不序列化且不改变既有新世界 stateHash', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 1, width: 4, height: 4, content, params: DEFAULT_BALANCE });
    const serialized = serializeState(state) as Record<string, unknown>;

    expect(serialized).not.toHaveProperty('tutorialTribulation');
    expect(stateHash(state)).toBe('78e26943');
  });

  it('旧档缺失教学状态时补 idle 默认值', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 2, width: 4, height: 4, content, params: DEFAULT_BALANCE });
    const raw = serializeState(state) as Record<string, unknown>;
    delete raw.tutorialTribulation;

    const restored = deserializeState(raw);

    expect(restored.tutorialTribulation).toEqual({
      phase: 'idle',
      boltIndex: 0,
      warnedTileId: null,
      startingHpMilli: 0,
      failureLatched: false,
      rawTemperingMilli: 0,
      hits: { direct: 0, rod: 0, miss: 0, blocked: 0, violet: 0 },
      outcome: null,
      finalHpBeforeRescueMilli: null,
      rewardMilli: 0
    });
    expect(stateHash(restored)).toBe(stateHash(state));
  });

  it('中途存档恢复后继续解析与连续三雷结果相同', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 23, width: 1, height: 1, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(23, content, DEFAULT_BALANCE);
    state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);

    const serialized = serializeState(state) as Record<string, unknown>;
    expect(serialized).toHaveProperty('tutorialTribulation');
    const restored = deserializeState(serialized);
    const restoredCtx = createSimContextFromState(restored, content, DEFAULT_BALANCE);

    while (state.tutorialTribulation.phase === 'active') applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    while (restored.tutorialTribulation.phase === 'active') applyAction(restored, { kind: 'resolve-tutorial-bolt' }, restoredCtx);

    expect(stateHash(restored)).toBe(stateHash(state));
    expect(restored.tutorialTribulation).toEqual(state.tutorialTribulation);
  });

  it('旧 active 教学档缺失失败锁存字段时补 false 默认值', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 24, width: 1, height: 1, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(24, content, DEFAULT_BALANCE);
    state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    const raw = serializeState(state) as Record<string, unknown>;
    delete (raw.tutorialTribulation as Record<string, unknown>).failureLatched;

    const restored = deserializeState(raw);

    expect(restored.tutorialTribulation).toMatchObject({ phase: 'active', failureLatched: false });
  });

  it('首雷致命的失败锁存可跨存档恢复并完成余下两雷', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 25, width: 1, height: 1, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(25, content, DEFAULT_BALANCE);
    state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
    state.player.hp = 1;
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    expect(state.tutorialTribulation).toMatchObject({ phase: 'active', boltIndex: 1, failureLatched: true });
    expect(state.gameOver).toBe(false);

    const restored = deserializeState(serializeState(state));
    const restoredCtx = createSimContextFromState(restored, content, DEFAULT_BALANCE);
    applyAction(restored, { kind: 'resolve-tutorial-bolt' }, restoredCtx);
    applyAction(restored, { kind: 'resolve-tutorial-bolt' }, restoredCtx);

    expect(restored.tutorialTribulation).toMatchObject({
      phase: 'aftermath',
      boltIndex: 3,
      failureLatched: true,
      outcome: 'rescued',
      finalHpBeforeRescueMilli: 0
    });
    expect(restored.player.hp).toBe(50_000);
    expect(restored.gameOver).toBe(false);
    expect(restored.ending).toBeNull();
  });

  it('成功 Aftermath 跨存档保留完成与发奖门禁，重复加载不会重复发奖', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 29, width: 1, height: 1, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(29, content, DEFAULT_BALANCE);
    state.player.flags.add(TUTORIAL_ALCHEMY_BREWED_FLAG);
    applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
    while (state.tutorialTribulation.phase === 'active') {
      applyAction(state, { kind: 'resolve-tutorial-bolt' }, ctx);
    }

    const restored = deserializeState(serializeState(state));
    const restoredCtx = createSimContextFromState(restored, content, DEFAULT_BALANCE);

    expect(restored.player.flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)).toBe(true);
    expect(restored.player.flags.has(TUTORIAL_TRIBULATION_REWARDED_FLAG)).toBe(true);
    expect(restored.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);

    applyAction(restored, { kind: 'acknowledge-tutorial-aftermath' }, restoredCtx);
    const reloaded = deserializeState(serializeState(restored));
    const reloadedCtx = createSimContextFromState(reloaded, content, DEFAULT_BALANCE);
    applyAction(reloaded, { kind: 'start-tutorial-tribulation' }, reloadedCtx);

    expect(reloaded.tutorialTribulation.phase).toBe('idle');
    expect(reloaded.player.cultivation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
    expect(reloaded.player.bodyFoundation).toBe(TUTORIAL_TRIBULATION_REWARD_MILLI);
  });
});
