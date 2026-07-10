import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, tileAt, placeArray } from '@sim';
import { tileWeight } from '@sim/tribulation/targeting';
import { arrayModifierFor, coveringRodArray } from '@sim/tribulation/arrays';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 7, height: 7, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('阵法系统 (docs/05 §8 种田即布防)', () => {
  it('引雷阵需金属性灵草作阵眼，无则放置失败', () => {
    const { state, ctx } = setup();
    const r = placeArray(state, 'array.lightning-rod', 3, 3, ctx);
    expect(r.placed).toBe(false);
    expect(r.reason).toContain('金属性');
  });

  it('种金属性草后可放置引雷阵，覆盖圈权重提升', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 3, 3)!;
    t.tilled = true;
    state.crops.set(t.id, {
      id: 1, defId: 'herb.metalpine', tileId: t.id, growth: 0, health: 100 * MILLI,
      stage: 'seed', plantedDay: 1, property: { cold: 0, hot: 0, warm: 0, neutral: 0 }, tempered: false,
    });
    t.cropId = 1;
    const wBefore = tileWeight(state, ctx, t, 0.5);
    const r = placeArray(state, 'array.lightning-rod', 3, 3, ctx);
    expect(r.placed).toBe(true);
    const wAfter = tileWeight(state, ctx, t, 0.5);
    expect(wAfter).toBeGreaterThan(wBefore); // 引雷阵 ×4 吸引
    expect(arrayModifierFor(state, t.id)).toBe(4.0);
  });

  it('绝缘阵降低覆盖圈权重（保护核心）', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 3, 3)!;
    const wBefore = tileWeight(state, ctx, t, 0.5);
    placeArray(state, 'array.insulation', 3, 3, ctx);
    const wAfter = tileWeight(state, ctx, t, 0.5);
    expect(wAfter).toBeLessThan(wBefore); // 绝缘阵 ×0.3 排斥
    expect(arrayModifierFor(state, t.id)).toBeCloseTo(0.3, 5);
  });

  it('coveringRodArray 找到覆盖该格的引雷阵', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 1, 1)!;
    t.tilled = true;
    state.crops.set(t.id, { id: 1, defId: 'herb.metalpine', tileId: t.id, growth: 0, health: 100_000, stage: 'seed', plantedDay: 1, property: { cold: 0, hot: 0, warm: 0, neutral: 0 }, tempered: false });
    t.cropId = 1;
    placeArray(state, 'array.lightning-rod', 1, 1, ctx);
    expect(coveringRodArray(state, t.id)).toBeDefined();
    expect(coveringRodArray(state, tileAt(state, 6, 6)!.id)).toBeUndefined();
  });

  it('引雷阵代接雷时损耗，耗尽则失效（docs/05 §8.1）', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 1, 1)!;
    t.tilled = true;
    state.crops.set(t.id, { id: 1, defId: 'herb.metalpine', tileId: t.id, growth: 0, health: 100_000, stage: 'seed', plantedDay: 1, property: { cold: 0, hot: 0, warm: 0, neutral: 0 }, tempered: false });
    t.cropId = 1;
    placeArray(state, 'array.lightning-rod', 1, 1, ctx);
    state.player.position = { x: 6, y: 6 }; // 玩家远离阵法，让雷多落在阵法覆盖区
    const arr = state.arrays.values().next().value!;
    const powerBefore = arr.power;
    runTribulation(state, { stage: 3, boltCount: 40, policy: { blockChance: 0 } }, ctx);
    // 40 雷中应有部分被阵法代接 → power 下降或已失效
    expect(arr.power < powerBefore || !arr.active).toBe(true);
  });
});
