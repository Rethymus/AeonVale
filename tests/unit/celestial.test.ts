import { describe, it, expect } from 'vitest';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';
import { stateHash } from '@sim/serialize';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('天象奇遇引擎 (docs/07 / 14 §7)', () => {
  it('长时间模拟会触发至少一次天象事件', () => {
    const { state, ctx } = setup(7);
    let triggered = false;
    for (let d = 0; d < 200; d++) {
      simulateDay(state, { actions: [] }, ctx);
      if (state.activeEvent) triggered = true;
    }
    expect(triggered).toBe(true); // gate 0.25/日，200 日几乎必然触发
  });

  it('事件有持续天数，到期后自动结束', () => {
    const { state, ctx } = setup(42);
    let startDay = -1;
    let observedActive = 0;
    for (let d = 0; d < 300 && startDay < 0; d++) {
      simulateDay(state, { actions: [] }, ctx);
      if (state.activeEvent) {
        if (startDay < 0) startDay = state.day;
        observedActive++;
      }
    }
    // 继续跑到事件结束
    for (let d = 0; d < 30 && state.activeEvent; d++) {
      simulateDay(state, { actions: [] }, ctx);
      observedActive++;
    }
    expect(startDay).toBeGreaterThan(0);
    expect(observedActive).toBeGreaterThan(0);
    expect(state.activeEvent).toBeNull(); // 最终结束
  });

  it('事件类型来自定义表（喜/悲/危机/机）', () => {
    const { reg } = setup();
    const types = new Set([...reg.events.values()].map((e) => e.type));
    expect(types.has('joy')).toBe(true);
    expect(types.has('grief')).toBe(true);
  });

  it('同种子同输入 → 同事件序列（确定性，stateHash 一致）', () => {
    const run = (seed: number) => {
      const { state, ctx } = setup(seed);
      for (let d = 0; d < 100; d++) simulateDay(state, { actions: [] }, ctx);
      return stateHash(state);
    };
    expect(run(99)).toBe(run(99));
  });
});
