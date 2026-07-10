/**
 * 天象因果链集成测试（docs/07 §3.1 / docs/18 M4 退出标准）。
 *
 * M4 退出标准：妖兽潮因果链（潮汐→翻倍成熟→引兽）可触发可复现。
 * 通过完整 simulateDay 管线（tickCelestial → applyFarmDayEnd → tickBeasts）端到端验证。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, simulateDay, DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { mutateItem } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';

const QI_TIDE = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 30, growthMod: 1.5, qiMod: 1.5 };

function beastParams(over: Partial<BalanceParams['celestial']['beast']> = {}): BalanceParams {
  return { ...DEFAULT_BALANCE, celestial: { ...DEFAULT_BALANCE.celestial, beast: { ...DEFAULT_BALANCE.celestial.beast, ...over } } };
}

function setup(seed = 7, params: BalanceParams = DEFAULT_BALANCE) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 8, height: 8, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  return { state, ctx, reg };
}

/** 在前 N 个可种植地块注入成熟灵草（绕过生长期，聚焦因果链触发与复现）。 */
function injectMatureCrops(state: GameState, reg: ContentRegistry, count: number): number {
  const loams = state.tiles.filter((t) => t.soilType === 'loam' && t.blockType === 'none').slice(0, count);
  for (const tile of loams) {
    const herb = reg.herbs.get('herb.mossling')!;
    state.crops.set(tile.id, {
      id: tile.id, defId: 'herb.mossling', tileId: tile.id, growth: herb.growthThreshold,
      health: 100 * MILLI, stage: 'mature', plantedDay: state.day, property: herb.baseProperty, tempered: false,
    });
    tile.cropId = tile.id;
  }
  return loams.length;
}

/** 收集多日事件类型序列（用于可复现断言）。 */
function runChain(seed: number, days: number, params: BalanceParams): { types: string[]; cropsLost: number; surges: number } {
  const { state, ctx, reg } = setup(seed, params);
  state.player.stage = 2 as 2;
  state.activeEvent = QI_TIDE;
  const cropsBefore = injectMatureCrops(state, reg, 5);
  const types: string[] = [];
  for (let d = 0; d < days; d++) {
    const evs = simulateDay(state, { actions: [] }, ctx);
    for (const e of evs) types.push(e.type);
  }
  const surges = types.filter((t) => t === 'beast-surge-start').length;
  const cropsLost = cropsBefore - state.crops.size;
  return { types, cropsLost, surges };
}

describe('天象因果链：灵气潮汐→妖兽潮 (docs/07 §3.1 / M4 退出标准)', () => {
  it('妖兽潮因果链可触发：潮汐活跃+成熟作物→引兽→啃食', () => {
    const P = beastParams({ surgeChancePerDay: 1.0 });
    const r = runChain(7, 6, P);
    expect(r.surges).toBeGreaterThanOrEqual(1); // 触发妖兽潮
    expect(r.types).toContain('beast-eat-crop'); // 啃食成熟作物
    expect(r.cropsLost).toBeGreaterThan(0); // 田间作物确实减少
  });

  it('可复现：同种子同参数 → 同事件序列（确定性）', () => {
    const P = beastParams({ surgeChancePerDay: 1.0 });
    const r1 = runChain(42, 8, P);
    const r2 = runChain(42, 8, P);
    expect(r1.types).toEqual(r2.types); // 逐事件一致
    expect(r1.cropsLost).toBe(r2.cropsLost);
    expect(r1.surges).toBe(r2.surges);
  });

  it('无灵气潮汐 → 妖兽潮永不触发（即便有成熟作物）', () => {
    const P = beastParams({ surgeChancePerDay: 1.0 });
    const { state, ctx, reg } = setup(7, P);
    state.player.stage = 2 as 2;
    state.activeEvent = null; // 无潮汐
    injectMatureCrops(state, reg, 5);
    const types: string[] = [];
    for (let d = 0; d < 6; d++) for (const e of simulateDay(state, { actions: [] }, ctx)) types.push(e.type);
    expect(types).not.toContain('beast-surge-start');
    expect(types).not.toContain('beast-eat-crop');
  });

  it('完整因果：潮汐生长加成→灵草当日成熟→同日引兽', () => {
    // 种一株接近成熟的灵草，潮汐加成使其当日成熟 → 同日 tickBeasts 引兽
    const P = beastParams({ surgeChancePerDay: 1.0 });
    const { state, ctx, reg } = setup(11, P);
    state.player.stage = 2 as 2;
    mutateItem(state.player, 'seed.mossling', 10);
    const loam = state.tiles.find((t) => t.soilType === 'loam' && t.blockType === 'none')!;
    const herb = reg.herbs.get('herb.mossling')!;
    // 翻地+种植
    simulateDay(state, { actions: [{ kind: 'till', at: { x: loam.x, y: loam.y } }, { kind: 'sow', at: { x: loam.x, y: loam.y }, seedId: 'seed.mossling' }] }, ctx);
    // 强制接近成熟（差 1 毫点）
    const crop = state.crops.get(loam.id)!;
    crop.growth = herb.growthThreshold - 1;
    crop.stage = 'growing';
    // 激活灵气潮汐（×1.5 生长加成）
    state.activeEvent = QI_TIDE;
    // 推进 1 日：浇水+供灵 → 潮汐加成使其成熟 → 同日引兽
    const evs = simulateDay(state, { actions: [{ kind: 'water', at: { x: loam.x, y: loam.y } }, { kind: 'channel-qi', at: { x: loam.x, y: loam.y } }] }, ctx);
    const types = evs.map((e) => e.type);
    expect(types).toContain('crop-mature'); // 潮汐加成令其成熟
    expect(types).toContain('beast-surge-start'); // 成熟即引兽（因果链闭环）
  });

  it('妖兽潮结束后田间无残留 surge 状态（可序列化）', () => {
    const P = beastParams({ surgeChancePerDay: 1.0, surgeDurationDays: 1, countMin: 1, countMaxBase: 1 });
    const { state, ctx, reg } = setup(7, P);
    state.player.stage = 0 as 0;
    state.activeEvent = QI_TIDE;
    injectMatureCrops(state, reg, 2);
    // 推进至妖兽潮必然结束（duration=1）
    for (let d = 0; d < 5; d++) simulateDay(state, { actions: [] }, ctx);
    expect(state.beastSurge).toBeNull(); // 无残留
  });
});
