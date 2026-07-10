import { describe, it, expect } from 'vitest';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, Rng, selectCelestialEvent, tickCelestial, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { stateHash, deserializeState, serializeState } from '@sim/serialize';
import type { CelestialEventDef } from '@content/defs';

const NO_FESTIVAL: BalanceParams = {
  ...DEFAULT_BALANCE,
  celestial: { ...DEFAULT_BALANCE.celestial, festivals: { enabled: false } },
};

function setup(seed = 1, params: BalanceParams = DEFAULT_BALANCE) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  return { state, ctx, reg };
}

function event(id: string, weight: number): CelestialEventDef {
  return { id, displayName: id, type: 'joy', weight, durationDays: 1, growthMod: 1, qiMod: 1, desc: '' };
}

describe('天象奇遇引擎 (docs/07 / 14 §7)', () => {
  it('纯权重抽样忽略零权重，并对相同 RNG 状态保持确定性', () => {
    const defs = [event('zero', 0), event('left', 1), event('right', 3)];
    const run = () => {
      const rng = new Rng(17);
      return Array.from({ length: 50 }, () => selectCelestialEvent(defs, [], rng)?.id);
    };
    expect(run()).toEqual(run());
    expect(run()).not.toContain('zero');
    expect(selectCelestialEvent([event('zero', 0)], [], new Rng(1))).toBeNull();
  });

  it('近三次重复事件应用 ×0.4 权重惩罚，三次外历史不影响选择', () => {
    const defs = [event('recent', 10), event('other', 10)];
    const seed = 12;
    const base = selectCelestialEvent(defs, [], new Rng(seed))?.id;
    const recent = selectCelestialEvent(defs, ['recent'], new Rng(seed))?.id;
    const stale = selectCelestialEvent(defs, ['recent', 'x', 'y', 'z'], new Rng(seed))?.id;
    expect(base).toBe('recent');
    expect(recent).toBe('other');
    expect(stale).toBe(base);
  });

  it('最近天象历史可存档往返，旧存档缺字段时回退为空', () => {
    const { state } = setup();
    state.recentCelestialEventIds = ['event.qi-tide', 'event.bad-year'];
    expect(deserializeState(serializeState(state)).recentCelestialEventIds).toEqual(state.recentCelestialEventIds);

    const raw = serializeState(state) as Record<string, unknown>;
    delete raw.recentCelestialEventIds;
    expect(deserializeState(raw).recentCelestialEventIds).toEqual([]);

    raw.recentCelestialEventIds = 'malformed';
    expect(deserializeState(raw).recentCelestialEventIds).toEqual([]);
  });

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
    const { state, ctx } = setup(42, NO_FESTIVAL); // 关节日，避免日历事件干扰结束观测
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

  it('季节节日按日历强制触发（春·灵芽节，docs/15 §4 节奏层）', () => {
    const { state, ctx } = setup();
    state.season = 'spring';
    state.seasonDay = 14;
    tickCelestial(state, ctx);
    expect(state.activeEvent?.defId).toBe('event.spring-festival');
    expect(state.activeEvent?.growthMod).toBeGreaterThan(1); // 节日增益
  });

  it('festivals.enabled=false 时节日不触发（旧 fixture / 测试兼容）', () => {
    const { state, ctx } = setup(1, NO_FESTIVAL);
    state.season = 'autumn';
    state.seasonDay = 14; // 金秋会日历日
    tickCelestial(state, ctx);
    expect(state.activeEvent?.defId).not.toBe('event.autumn-festival');
  });

  it('节日与进行中天象互斥（不抢占）', () => {
    const { state, ctx } = setup();
    state.season = 'summer';
    state.seasonDay = 14; // 炎阳祭日
    state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 3, growthMod: 1.5, qiMod: 1.5 };
    tickCelestial(state, ctx);
    expect(state.activeEvent?.defId).toBe('event.qi-tide'); // 未被节日抢占
  });
});
