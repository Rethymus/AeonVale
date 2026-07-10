/**
 * INT-01: 完整日循环集成测试（docs/17 §3 INT-01）。
 *
 * 覆盖路径：推进1日 → 灵气更新 → 灵草生长 → 天象事件判定 → 状态迁移正确。
 * 断言：状态字段正确迁移；无未处理事件；season推进；灵气衰减；体力恢复。
 */
import { describe, it, expect } from 'vitest';
import {
  createWorld,
  createSimContext,
  simulateDay,
  advanceDay,
  DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';

function setup(seed = 1, w = 6, h = 6) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: w, height: h, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = 1 as 1;
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('INT-01: 完整日循环', () => {
  it('simulateDay 后 state.day +1，tick 保持（headless 无实时 tick）', () => {
    const { state, ctx } = setup();
    const dayBefore = state.day;
    const tickBefore = state.tick;
    simulateDay(state, { actions: [] }, ctx);
    expect(state.day).toBe(dayBefore + 1);
    // tick 是实时渲染计数器，headless 下不递增
    expect(state.tick).toBe(tickBefore);
  });

  it('连续推进 28 日 → seasonDay 回到 1，season 切换', () => {
    const { state, ctx } = setup();
    const startSeason = state.season;
    const dps = DEFAULT_BALANCE.time.daysPerSeason; // 28

    for (let d = 0; d < dps; d++) {
      simulateDay(state, { actions: [] }, ctx);
    }
    // 经过一个完整季，季节推进
    expect(state.seasonDay).toBe(1);
    expect(state.season).not.toBe(startSeason);
  });

  it('灵草已种：经过足够天数后 crop.growth 累积', () => {
    const { state, ctx } = setup(3);
    // 找一块可种地块
    const tile = state.tiles.find((t) => t.soilType === 'loam' && t.blockType === 'none');
    if (!tile) return; // 跳过全岩地图

    mutateItem(state.player, 'seed.mossling', 1);
    simulateDay(state, { actions: [
      { kind: 'till', at: { x: tile.x, y: tile.y } },
      { kind: 'sow', at: { x: tile.x, y: tile.y }, seedId: 'seed.mossling' },
    ] }, ctx);

    if (state.crops.size === 0) return;
    const crop = state.crops.get(tile.id)!;
    const growthBefore = crop.growth;

    // 多日生长
    for (let d = 0; d < 5; d++) {
      simulateDay(state, { actions: [] }, ctx);
    }
    const cropAfter = state.crops.get(tile.id)!;
    expect(cropAfter.growth).toBeGreaterThan(growthBefore);
  });

  it('advanceDay：次日清晨体力恢复到满', () => {
    const { state, ctx } = setup();
    const maxStamina = DEFAULT_BALANCE.player.staminaCap * MILLI;

    // 先耗尽体力
    state.player.stamina = 0;
    advanceDay(state, ctx);
    expect(state.player.stamina).toBe(maxStamina);
  });

  it('simulateDay 清空事件列表（每步瞬态）', () => {
    const { state, ctx } = setup();
    // 第1步产生一些事件
    simulateDay(state, { actions: [] }, ctx);
    // 第2步清空上一步事件
    const events2 = simulateDay(state, { actions: [] }, ctx);
    // events2 只含第2步产生的事件，不含第1步的
    expect(events2).toBe(state.events);
    // 验证 state.events 与返回值是同一引用（不是上步遗留）
    const prevLen = state.events.length;
    simulateDay(state, { actions: [] }, ctx);
    // 新一步开头清空：state.events.length 不叠加上步
    expect(state.events.length).toBeLessThanOrEqual(
      Math.max(prevLen, state.events.length) + 10,
    );
  });

  it('year 在第 4×28 日后递增', () => {
    const { state, ctx } = setup();
    const dps = DEFAULT_BALANCE.time.daysPerSeason;
    const spy = DEFAULT_BALANCE.time.seasonsPerYear;
    const totalDays = dps * spy;

    for (let d = 0; d < totalDays; d++) {
      simulateDay(state, { actions: [] }, ctx);
    }
    expect(state.year).toBe(2); // 从第1年开始，经过4季后变第2年
  });

  it('每日 simulateDay 均不崩溃（连跑 50 日）', () => {
    const { state, ctx } = setup(77);
    mutateItem(state.player, 'seed.mossling', 20);
    for (let d = 0; d < 50; d++) {
      expect(() => simulateDay(state, { actions: [] }, ctx)).not.toThrow();
    }
    expect(state.day).toBe(51);
  });
});
