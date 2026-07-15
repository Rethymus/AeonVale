/**
  * 天象因果链集成测试。
 *
  * M4 退出标准：妖兽潮因果链（潮汐→翻倍成熟→引兽）可触发可复现。
  * 通过完整 simulateDay 管线（tickCelestial → applyFarmDayEnd → tickBeasts）端到端验证。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, simulateDay, DEFAULT_BALANCE, placeArray, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { mutateItem, itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';

function qiTide(daysLeft = 30) {
 return { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft, growthMod: 1.5, qiMod: 1.5 };
}

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
 state.activeEvent = qiTide();
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

describe('天象因果链：灵气潮汐→妖兽潮 ', () => {
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
 state.activeEvent = qiTide();
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
 state.activeEvent = qiTide();
 injectMatureCrops(state, reg, 2);
 // 推进至妖兽潮必然结束（duration=1）
 for (let d = 0; d < 5; d++) simulateDay(state, { actions: [] }, ctx);
 expect(state.beastSurge).toBeNull; // 无残留
 });

it('当成熟作物只剩绝缘阵覆盖区且无引雷诱饵田时，次日会在完整日循环中驱离妖兽潮', () => {
 const P = {
 ...beastParams({ surgeChancePerDay: 1.0, surgeDurationDays: 3, countMin: 2, countMaxBase: 2 }),
 growth: { ...DEFAULT_BALANCE.growth, overripeDecay: 0 },
 } satisfies BalanceParams;
 const { state, ctx, reg } = setup(19, P);
 state.player.stage = 0 as 0;
 state.activeEvent = qiTide();

const protectedA = state.tiles.find((tile) => tile.x === 1 && tile.y === 1)!;
 const protectedB = state.tiles.find((tile) => tile.x === 2 && tile.y === 1)!;
 const herb = reg.herbs.get('herb.mossling')!;
 for (const tile of [protectedA, protectedB]) {
 state.crops.set(tile.id, {
 id: tile.id,
 defId: 'herb.mossling',
 tileId: tile.id,
 growth: herb.growthThreshold,
 health: 100 * MILLI,
 stage: 'mature',
 plantedDay: state.day,
 property: herb.baseProperty,
 tempered: false,
 });
 tile.cropId = tile.id;
 }
 expect(placeArray(state, 'array.insulation', 1, 1, ctx, { free: true }).placed).toBe(true);

const dayOne = simulateDay(state, { actions: [] }, ctx).map((event) => event.type);
 expect(dayOne).toContain('beast-surge-start');
 expect(state.beastSurge).not.toBeNull;

const dayTwo = simulateDay(state, { actions: [] }, ctx).map((event) => event.type);
 expect(dayTwo).toContain('beast-surge-repelled');
 expect(dayTwo).toContain('beast-surge-end');
 expect(dayTwo).not.toContain('beast-eat-crop');
 expect(state.beastSurge).toBeNull;
 expect(state.crops.size).toBe(2);
 });

it('潮汐引兽后必须主动猎妖才获得内丹（风险-收益闭环）', () => {
 const P = beastParams({ surgeChancePerDay: 1.0, surgeDurationDays: 3, countMin: 3, countMaxBase: 3, huntDamage: 1, huntStaminaCost: 1, lootChancePerBeast: 1.0 });
 const { state, ctx, reg } = setup(13, P);
 state.player.stage = 0 as 0;
 state.activeEvent = qiTide();
 injectMatureCrops(state, reg, 4);
 const start = simulateDay(state, { actions: [] }, ctx).map((e) => e.type);
 expect(start).toContain('beast-surge-start');
 expect(itemCount(state.player, 'item.beast-core')).toBe(0);

const hunted = simulateDay(state, { actions: [{ kind: 'hunt-beast' }] }, ctx).map((e) => e.type);
 expect(hunted).toContain('beast-hunted');
 expect(hunted).toContain('beast-loot');
 expect(itemCount(state.player, 'item.beast-core')).toBe(1);
 });
});
