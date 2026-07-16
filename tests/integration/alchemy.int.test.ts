/**
  * INT-02: 完整炼丹流程端到端。
 *
  * 覆盖路径：翻地 → 种苔 → 多日生长 → 收获 → 炼寒泥丸 → 出丹/废丹/炸炉闭环。
  * 断言：物品变化、丹毒累积、事件流、存档往返（PBT-06 延伸）。
 */
import { describe, it, expect } from 'vitest';
import {
 createWorld,
 createSimContext,
 simulateDay,
 DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { brewPills, resolveBrew } from '@sim/alchemy/alchemySystem';
import { mutateItem, itemCount } from '@sim/world/player';
import { roundTripEqual } from '@sim/serialize';
import type { PlayerAction } from '@sim/world/input';

function setup(seed = 42, w = 8, h = 8) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: w, height: h, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1 as 1;
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx, reg };
}

/** 找所有可种的壤土地块（跳过水域/岩石等）。 */
function findLoamTiles(state: ReturnType<typeof setup>['state']) {
 return state.tiles.filter((t) => t.soilType === 'loam' && t.blockType === 'none');
}

describe('INT-02: 炼丹端到端', () => {
 it('翻地→种苔→生长→收获：可从多种 seed 中找到一个成功收获的', () => {
 // 遍历多个种子，找一个在 50 天内能收获的（绕开全岩/全水地图）
 let harvested = false;
 for (let seed = 1; seed <= 10 && !harvested; seed++) {
 const { state, ctx } = setup(seed);
 const loam = findLoamTiles(state);
 if (loam.length === 0) continue;

const tile = loam[0]!;
 const at = { x: tile.x, y: tile.y };

// 给种子（没有种子则 sow 静默失败）
 mutateItem(state.player, 'seed.mossling', 3);

const tillSow: PlayerAction[] = [
 { kind: 'till', at },
 { kind: 'sow', at, seedId: 'seed.mossling' },
 ];
 simulateDay(state, { actions: tillSow }, ctx);
 if (state.crops.size === 0) continue; // 翻地/种植失败则跳过

// 最多 50 天供灵+浇水加速生长
 const care: PlayerAction[] = [
 { kind: 'water', at },
 { kind: 'channel-qi', at },
 ];
 let matured = false;
 const tileId = tile.id;
 for (let d = 0; d < 50; d++) {
 simulateDay(state, { actions: care }, ctx);
 const crop = state.crops.get(tileId);
 if (crop?.stage === 'mature') { matured = true; break; }
 }
 if (!matured) continue;

const harvestBefore = itemCount(state.player, 'herb.mossling');
 simulateDay(state, { actions: [{ kind: 'harvest', at }] }, ctx);
 const harvestAfter = itemCount(state.player, 'herb.mossling');
 if (harvestAfter > harvestBefore) {
 harvested = true;
 expect(harvestAfter).toBeGreaterThan(harvestBefore);
 }
 }
 expect(harvested).toBe(true);
 });

it('3× herb.mossling + 最优火候 17000 → 炼出寒泥丸', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'herb.mossling', 3);
 expect(itemCount(state.player, 'herb.mossling')).toBe(3);

const poisonBefore = state.player.pillPoison;
 const res = brewPills(state, {
 materials: [{ herbId: 'herb.mossling', qty: 3 }],
 avgHeatMilli: 17_000, // 区间 [10000,25000] 中点
 }, ctx);

expect(['pill', 'flawed']).toContain(res.outcome);
 expect(res.pillId).toBe('pill.cold-mud');
 expect(itemCount(state.player, 'herb.mossling')).toBe(0);
 expect(itemCount(state.player, 'pill.cold-mud')).toBeGreaterThan(0);
 expect(state.player.pillPoison).toBeGreaterThanOrEqual(poisonBefore);
 expect(state.events.some((e) => e.type === 'brew-success')).toBe(true);
 });

it('极低火候（1000）→ quality < 0.7（非高质量丹）', () => {
 // 以 herb.mossling 为中性草，recipe.cold-mud 目标为 neutral 对齐。
 // 火候 1000 远低于 [10000,25000]，heatScore 趋近 0。
 // 若 propAlign 足够高仍可能出 flawed，但 quality 必须 < 0.7（不出高质量丹）。
 const { state, ctx } = setup();
 const res = resolveBrew(state, {
 materials: [{ herbId: 'herb.mossling', qty: 3 }],
 avgHeatMilli: 1_000,
 }, ctx);
 // 不论 outcome，质量必须 < 0.7（fire score 太低）
 expect(res.quality).toBeLessThan(0.7);
 });

it('空背包炼丹 → 不消耗材料，返回 waste/outcome', () => {
 const { state, ctx } = setup();
 const before = itemCount(state.player, 'herb.mossling');
 const res = brewPills(state, {
 materials: [{ herbId: 'herb.mossling', qty: 3 }],
 avgHeatMilli: 17_000,
 }, ctx);
 // 材料不足 → brewPills 返回 waste 且不消耗
 expect(res.outcome).toBe('waste');
 expect(itemCount(state.player, 'herb.mossling')).toBe(before);
 });

it('炼丹后状态可序列化往返（PBT-06 INT 延伸）', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'herb.mossling', 3);
 brewPills(state, {
 materials: [{ herbId: 'herb.mossling', qty: 3 }],
 avgHeatMilli: 17_000,
 }, ctx);
 simulateDay(state, { actions: [] }, ctx);
 expect(roundTripEqual(state)).toBe(true);
 });

it('反方向草药（寒热冲突高火候）→ 函数不崩溃', () => {
 // dewroot（cold）+ suncap（hot），高火候可能炸炉
 const { state, ctx } = setup();
 mutateItem(state.player, 'herb.dewroot', 1);
 mutateItem(state.player, 'herb.suncap', 1);
 const hpBefore = state.player.hp;
 const res = brewPills(state, {
 materials: [{ herbId: 'herb.dewroot', qty: 1 }, { herbId: 'herb.suncap', qty: 1 }],
 avgHeatMilli: 60_000,
 }, ctx);
 // 不论结果，不崩溃
 expect(['exploded', 'waste', 'pill', 'flawed']).toContain(res.outcome);
 if (res.outcome === 'exploded') {
 expect(state.player.hp).toBeLessThan(hpBefore);
 expect(state.events.some((e) => e.type === 'furnace-explosion')).toBe(true);
 }
 });
});
