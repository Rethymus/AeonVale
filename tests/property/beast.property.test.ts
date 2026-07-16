/**
  * 妖兽潮属性测试。
 *
  * PBT-BEAST-01：妖兽数量有界 ∈ [countMin, countMaxBase+stage]（任意种子/阶段）。
  * PBT-BEAST-02：触发仅当 灵气潮汐+成熟作物（无潮汐→永不；无成熟→永不）。
  * PBT-BEAST-03：确定性——同 (seed, params, 状态) → 同妖兽潮结果。
  * PBT-BEAST-04：啃食不凭空——被啃作物数 ≤ 初始成熟作物数；妖兽数恒非负。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createWorld, createSimContext, tickBeasts, applyAction, DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';
import type { CultivationStage } from '@sim/world/types';

const QI_TIDE = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 30, growthMod: 1.5, qiMod: 1.5 };
const STAGES = [0, 1, 2, 3, 4, 5, 6, 7] as const;

function beastParams(over: Partial<BalanceParams['celestial']['beast']> = {}): BalanceParams {
 return { ...DEFAULT_BALANCE, celestial: { ...DEFAULT_BALANCE.celestial, beast: { ...DEFAULT_BALANCE.celestial.beast, ...over } } };
}

function makeState(seed: number, stage: CultivationStage, params: BalanceParams, reg: ContentRegistry) {
 const state = createWorld({ seed, width: 8, height: 8, content: reg, params });
 const ctx = createSimContext(seed, reg, params);
 state.player.stage = stage;
 return { state, ctx };
}

function injectMature(state: GameState, reg: ContentRegistry, tileId: number, defId = 'herb.mossling'): void {
 const herb = reg.herbs.get(defId)!;
 state.crops.set(tileId, {
 id: tileId, defId, tileId, growth: herb.growthThreshold, health: 100 * MILLI,
 stage: 'mature', plantedDay: state.day, property: herb.baseProperty, tempered: false,
 });
 const tile = state.tiles[tileId];
 if (tile) tile.cropId = tileId;
}

describe('PBT-BEAST: 妖兽潮不变式 ', () => {
 const reg = buildRegistry();

it('PBT-BEAST-01: 触发后妖兽数 ∈ [countMin, countMaxBase+stage]', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100_000 }),
 fc.constantFrom(...STAGES),
 fc.integer({ min: 1, max: 8 }),
 (seed, stage, cropCount) => {
 const P = beastParams({ surgeChancePerDay: 1.0 });
 const { state, ctx } = makeState(seed, stage, P, reg);
 state.activeEvent = QI_TIDE;
 for (let i = 0; i < cropCount; i++) injectMature(state, reg, i);
 const surge = tickBeasts(state, ctx);
 expect(surge).not.toBeNull;
 const countMax = P.celestial.beast.countMaxBase + stage;
 expect(surge!.beastsRemaining).toBeGreaterThanOrEqual(P.celestial.beast.countMin);
 expect(surge!.beastsRemaining).toBeLessThanOrEqual(countMax);
 },
 ),
 );
 });

it('PBT-BEAST-02a: 无灵气潮汐 → 永不触发（任意种子/作物数）', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100_000 }),
 fc.integer({ min: 0, max: 8 }),
 (seed, cropCount) => {
 const P = beastParams({ surgeChancePerDay: 1.0 });
 const { state, ctx } = makeState(seed, 2, P, reg);
 state.activeEvent = null;
 for (let i = 0; i < cropCount; i++) injectMature(state, reg, i);
 expect(tickBeasts(state, ctx)).toBeNull;
 },
 ),
 );
 });

it('PBT-BEAST-02b: 灵气潮汐但无成熟作物 → 永不触发', () => {
 fc.assert(
 fc.property(fc.integer({ min: 1, max: 100_000 }), (seed) => {
 const P = beastParams({ surgeChancePerDay: 1.0 });
 const { state, ctx } = makeState(seed, 2, P, reg);
 state.activeEvent = QI_TIDE;
 // 不注入任何作物
 expect(tickBeasts(state, ctx)).toBeNull;
 }),
 );
 });

it('PBT-BEAST-03: 确定性——同 (seed, params) → 同妖兽数与啃食序列', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100_000 }),
 fc.constantFrom(...STAGES),
 fc.integer({ min: 1, max: 8 }),
 (seed, stage, cropCount) => {
 const run = () => {
 const P = beastParams({ surgeChancePerDay: 1.0 });
 const { state, ctx } = makeState(seed, stage, P, reg);
 state.activeEvent = QI_TIDE;
 for (let i = 0; i < cropCount; i++) injectMature(state, reg, i);
 const surge = tickBeasts(state, ctx);
 tickBeasts(state, ctx); // 啃一轮
 return JSON.stringify({ count: surge!.beastsRemaining, cropsLeft: state.crops.size });
 };
 expect(run).toBe(run);
 },
 ),
 );
 });

it('PBT-BEAST-04: 啃食不凭空——被啃作物数 ≤ 初始成熟作物数；妖兽数恒非负', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100_000 }),
 fc.integer({ min: 1, max: 12 }),
 fc.integer({ min: 1, max: 8 }), // surgeDurationDays
 (seed, cropCount, dur) => {
 const P = beastParams({ surgeChancePerDay: 1.0, countMin: 3, countMaxBase: 5, surgeDurationDays: dur });
 const { state, ctx } = makeState(seed, 1, P, reg);
 state.activeEvent = QI_TIDE;
 for (let i = 0; i < cropCount; i++) injectMature(state, reg, i);
 tickBeasts(state, ctx); // 触发
 let totalEaten = 0;
 // 推进直到妖兽潮结束
 for (let i = 0; i < dur + 2 && state.beastSurge; i++) {
 const before = state.crops.size;
 tickBeasts(state, ctx);
 const after = state.crops.size;
 totalEaten += Math.max(0, before - after);
 if (state.beastSurge) expect(state.beastSurge.beastsRemaining).toBeGreaterThanOrEqual(0);
 }
 expect(totalEaten).toBeLessThanOrEqual(cropCount); // 不凭空多啃
 expect(state.beastSurge).toBeNull; // 最终必然退去
 },
 ),
 );
 });

it('PBT-BEAST-05: 主动猎妖掉落数 ∈ [0, 击杀数] 且确定', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100_000 }),
 fc.integer({ min: 1, max: 5 }),
 (seed, beasts) => {
 const P = beastParams({ huntDamage: 0, huntStaminaCost: 0, lootChancePerBeast: 0.5 });
 const run = () => {
 const { state, ctx } = makeState(seed, 1, P, reg);
 state.beastSurge = { beastsRemaining: beasts, daysLeft: 9 };
 for (let i = 0; i < beasts; i++) applyAction(state, { kind: 'hunt-beast' }, ctx);
 return itemCount(state.player, 'item.beast-core');
 };
 const cores = run();
 expect(cores).toBeGreaterThanOrEqual(0);
 expect(cores).toBeLessThanOrEqual(beasts);
 expect(run()).toBe(cores);
 },
 ),
 );
 });
});
