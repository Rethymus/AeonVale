import { describe, it, expect } from 'vitest';
import { advanceDay, createWorld, createSimContext, DEFAULT_BALANCE, tileAt, placeArray } from '@sim';
import { tileWeight } from '@sim/tribulation/targeting';
import { activeArrayCount, activeArraysCoveringTile, arrayModifierFor, coveringRodArray, hasActiveArrayCoverage, insulationClimateControlBonus } from '@sim/tribulation/arrays';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 7, height: 7, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('阵法系统 ', () => {
  it('引雷阵需金属性灵草作阵眼，无则放置失败', () => {
    const { state, ctx } = setup();
    const r = placeArray(state, 'array.lightning-rod', 3, 3, ctx, { free: true });
    expect(r.placed).toBe(false);
    expect(r.reason).toContain('金属性');
  });

  it('布设阵法默认消耗阵核与灵石，材料不足时失败', () => {
    const { state, ctx } = setup();

    expect(placeArray(state, 'array.insulation', 3, 3, ctx).placed).toBe(false);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.spirit-stone', 2);

    const r = placeArray(state, 'array.insulation', 3, 3, ctx);

    expect(r.placed).toBe(true);
    expect(itemCount(state.player, 'item.array-core')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    const placed = state.events.find(e => e.type === 'place-array')!;
    expect((placed.payload as { costs?: unknown[] }).costs?.length).toBe(2);
  });

  it('种金属性草后可放置引雷阵，覆盖圈权重提升', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 3, 3)!;
    t.tilled = true;
    state.crops.set(t.id, {
      id: 1,
      defId: 'herb.metalpine',
      tileId: t.id,
      growth: 0,
      health: 100 * MILLI,
      stage: 'seed',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    t.cropId = 1;
    const wBefore = tileWeight(state, ctx, t, 0.5);
    const r = placeArray(state, 'array.lightning-rod', 3, 3, ctx, { free: true });
    expect(r.placed).toBe(true);
    const wAfter = tileWeight(state, ctx, t, 0.5);
    expect(wAfter).toBeGreaterThan(wBefore); // 引雷阵 ×4 吸引
    expect(arrayModifierFor(state, t.id)).toBe(4.0);
  });

  it('绝缘阵降低覆盖圈权重（分流稳住核心）', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 3, 3)!;
    const wBefore = tileWeight(state, ctx, t, 0.5);
    placeArray(state, 'array.insulation', 3, 3, ctx, { free: true });
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
    placeArray(state, 'array.lightning-rod', 1, 1, ctx, { free: true });
    expect(coveringRodArray(state, t.id)).toBeDefined;
    expect(coveringRodArray(state, tileAt(state, 6, 6)!.id)).toBeUndefined;
  });

  it('可查询某格上的激活阵法覆盖列表与指定阵法覆盖', () => {
    const { state, ctx } = setup();
    const core = tileAt(state, 3, 3)!;
    core.tilled = true;
    state.crops.set(core.id, {
      id: 1,
      defId: 'herb.metalpine',
      tileId: core.id,
      growth: 0,
      health: 100 * MILLI,
      stage: 'seed',
      plantedDay: 1,
      property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
      tempered: false
    });
    core.cropId = 1;

    placeArray(state, 'array.lightning-rod', 3, 3, ctx, { free: true });
    placeArray(state, 'array.insulation', 4, 3, ctx, { free: true });

    const covered = activeArraysCoveringTile(state, core.id);
    expect(covered).toHaveLength(2);
    expect(hasActiveArrayCoverage(state, core.id, 'array.lightning-rod')).toBe(true);
    expect(hasActiveArrayCoverage(state, core.id, 'array.insulation')).toBe(true);
    expect(hasActiveArrayCoverage(state, tileAt(state, 0, 0)!.id, 'array.insulation')).toBe(false);
  });

  it('绝缘阵数量会提供暖棚控温加成', () => {
    const { state, ctx } = setup();
    expect(activeArrayCount(state, 'array.insulation')).toBe(0);
    expect(insulationClimateControlBonus(state)).toEqual({ careGainBonus: 0, neglectBuffer: 0 });

    placeArray(state, 'array.insulation', 1, 1, ctx, { free: true });
    expect(activeArrayCount(state, 'array.insulation')).toBe(1);
    expect(insulationClimateControlBonus(state)).toEqual({ careGainBonus: 1, neglectBuffer: 1 });

    placeArray(state, 'array.insulation', 5, 5, ctx, { free: true });
    expect(activeArrayCount(state, 'array.insulation')).toBe(2);
    expect(insulationClimateControlBonus(state)).toEqual({ careGainBonus: 2, neglectBuffer: 2 });
  });

  it('引雷阵代接雷时损耗，耗尽则失效', () => {
    const { state, ctx } = setup();
    const t = tileAt(state, 1, 1)!;
    t.tilled = true;
    state.crops.set(t.id, { id: 1, defId: 'herb.metalpine', tileId: t.id, growth: 0, health: 100_000, stage: 'seed', plantedDay: 1, property: { cold: 0, hot: 0, warm: 0, neutral: 0 }, tempered: false });
    t.cropId = 1;
    placeArray(state, 'array.lightning-rod', 1, 1, ctx, { free: true });
    state.player.position = { x: 6, y: 6 }; // 玩家远离阵法，让雷多落在阵法覆盖区
    const arr = state.arrays.values().next().value!;
    const powerBefore = arr.power;
    runTribulation(state, { stage: 3, boltCount: 40, policy: { blockChance: 0 } }, ctx);
    // 40 雷中应有部分被阵法代接 → power 下降或已失效
    expect(arr.power < powerBefore || !arr.active).toBe(true);
  });
});

describe('R3-B1 引水阵（自动化浇水）', () => {
  it('stage 门控：引水阵 stage 4/5/6 分级，不前移到序章（守 docs/02:88）', () => {
    const { state, ctx } = setup();
    // stage 0（默认凡骨）→ 拒绝
    let r = placeArray(state, 'array.water-channel-1', 3, 3, ctx, { free: true });
    expect(r.placed).toBe(false);
    expect(r.reason).toContain('4');
    // stage 3 仍拒绝（stageMin 4）
    state.player.stage = 3;
    expect(placeArray(state, 'array.water-channel-1', 3, 3, ctx, { free: true }).placed).toBe(false);
    // stage 4 放 1 级成功；2 级（stageMin 5）仍拒
    state.player.stage = 4;
    expect(placeArray(state, 'array.water-channel-1', 3, 3, ctx, { free: true }).placed).toBe(true);
    expect(placeArray(state, 'array.water-channel-2', 3, 3, ctx, { free: true }).placed).toBe(false);
    // stage 5 放 2 级；stage 6 放 3 级
    state.player.stage = 5;
    expect(placeArray(state, 'array.water-channel-2', 3, 3, ctx, { free: true }).placed).toBe(true);
    state.player.stage = 6;
    expect(placeArray(state, 'array.water-channel-3', 3, 3, ctx, { free: true }).placed).toBe(true);
  });

  it('清晨自动浇灌覆盖圈灵田，非覆盖格不浇（对标星露谷洒水器；纯确定性）', () => {
    const { state, ctx } = setup();
    state.player.stage = 4;
    const center = tileAt(state, 3, 3)!;
    const off = tileAt(state, 6, 6)!;
    placeArray(state, 'array.water-channel-1', 3, 3, ctx, { free: true });
    advanceDay(state, ctx);
    expect(center.wateredToday).toBe(true);
    expect(center.moisture).toBeGreaterThan(0);
    expect(off.wateredToday).toBe(false);
  });

  it('moisture 封顶 100*MILLI，守 docs/00 C5 不让自动化掏空浇水劳动', () => {
    const { state, ctx } = setup();
    state.player.stage = 4;
    const center = tileAt(state, 3, 3)!;
    center.moisture = 95 * MILLI;
    placeArray(state, 'array.water-channel-1', 3, 3, ctx, { free: true });
    advanceDay(state, ctx);
    expect(center.moisture).toBeLessThanOrEqual(100 * MILLI);
    expect(center.wateredToday).toBe(true);
  });

  it('默认消耗阵核+灵石+灵壤肥，材料不足失败', () => {
    const { state, ctx } = setup();
    state.player.stage = 4;
    expect(placeArray(state, 'array.water-channel-1', 3, 3, ctx).placed).toBe(false);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.spirit-stone', 2);
    mutateItem(state.player, 'item.spirit-compost', 1);
    const r = placeArray(state, 'array.water-channel-1', 3, 3, ctx);
    expect(r.placed).toBe(true);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
  });
});
