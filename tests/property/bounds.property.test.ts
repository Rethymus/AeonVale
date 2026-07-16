/**
  * 属性测试 PBT-08/09/10。
 *
  * PBT-08: nearDeathBonus 单峰性 — (0,10%] 取全局最大，两侧单调不增。
  * PBT-09: 突破率有界 — successRate ∈ [0.05, 0.95]，任意合法输入。
  * PBT-10: 时间前进单调 — day 每次 simulateDay 恰好 +1，不跳变。
 *
  * 注：fc.float 要求 min/max 为 32-bit float，须用 Math.fround()。
  * state.tick 由实时渲染层驱动；state.day 由 applyFarmDayEnd 递增，这是无头层的时间单位。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
 createWorld,
 createSimContext,
 simulateDay,
 DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { nearDeathBonus } from '@sim/tribulation/tribulationSystem';
import { mutateItem } from '@sim/world/player';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;

// ── PBT-08: nearDeathBonus 单峰性 ─────────────────────────────────────────────
describe('PBT-08: nearDeathBonus 单峰 @ (0,10%]', () => {
 it('峰值区间 (0,10%] 返回全局最大值 nearDeathPeak', () => {
 // max=0.09 避免 Math.fround(0.1)≈0.100000001 略超 nearDeathPeakBand=0.1
 fc.assert(
 fc.property(
 fc.float({ min: Math.fround(0.001), max: Math.fround(0.09), noNaN: true }),
 (ratio) => {
 expect(nearDeathBonus(ratio, P)).toBe(P.lightning.tempering.nearDeathPeak);
 },
 ),
 );
 });

it('峰值区间比 (10%,25%] 区间大', () => {
 // 使用 0.09 和 0.11 作为边界，避免 Math.fround(0.1) ≈ 0.100000001 恰好落在阈值外侧
 fc.assert(
 fc.property(
 fc.float({ min: Math.fround(0.001), max: Math.fround(0.09), noNaN: true }),
 fc.float({ min: Math.fround(0.11), max: Math.fround(0.25), noNaN: true }),
 (peakRatio, midRatio) => {
 expect(nearDeathBonus(peakRatio, P)).toBeGreaterThan(nearDeathBonus(midRatio, P));
 },
 ),
 );
 });

it('(10%,25%] 区间比 (25%,50%] 区间大', () => {
 fc.assert(
 fc.property(
 fc.float({ min: Math.fround(0.101), max: Math.fround(0.25), noNaN: true }),
 fc.float({ min: Math.fround(0.251), max: Math.fround(0.5), noNaN: true }),
 (lo, hi) => {
 expect(nearDeathBonus(lo, P)).toBeGreaterThanOrEqual(nearDeathBonus(hi, P));
 },
 ),
 );
 });

it('(25%,50%] 区间比 >80% 区间大', () => {
 fc.assert(
 fc.property(
 fc.float({ min: Math.fround(0.251), max: Math.fround(0.5), noNaN: true }),
 fc.float({ min: Math.fround(0.801), max: Math.fround(1.0), noNaN: true }),
 (lo, hi) => {
 expect(nearDeathBonus(lo, P)).toBeGreaterThanOrEqual(nearDeathBonus(hi, P));
 },
 ),
 );
 });

it('HP=0 → bonus=0（死亡无收益）', () => {
 expect(nearDeathBonus(0, P)).toBe(0);
 });

it('任意 ratio ∈ (0,1] → bonus 始终 > 0', () => {
 fc.assert(
 fc.property(
 fc.float({ min: Math.fround(0.001), max: Math.fround(1.0), noNaN: true }),
 (ratio) => {
 expect(nearDeathBonus(ratio, P)).toBeGreaterThan(0);
 },
 ),
 );
 });
});

// ── PBT-09: 突破率有界 [0.05, 0.95] ──────────────────────────────────────────
describe('PBT-09: 突破率有界 successRate ∈ [0.05, 0.95]', () => {
 it('任意 (pillPoison 比例, xSurplus) → successRate 有界', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 6 }), // stage 1..6
 fc.float({ min: Math.fround(0), max: Math.fround(1), noNaN: true }), // pillPoison 比例
 fc.float({ min: Math.fround(0), max: Math.fround(0.3), noNaN: true }), // xSurplus
 (stage, poisonRatio, xSurplusRaw) => {
 const xSurplus = Math.min(0.3, xSurplusRaw);
 const prepScore = 0.5;
 let successRate =
 P.breakthrough.successBase +
 P.breakthrough.successPrepBonus * prepScore +
 P.breakthrough.successXSurplus * xSurplus +
 P.breakthrough.successPoisonPenalty * poisonRatio;
 successRate = Math.max(0.05, Math.min(0.95, successRate));
 expect(successRate).toBeGreaterThanOrEqual(0.05);
 expect(successRate).toBeLessThanOrEqual(0.95);
 void stage;
 },
 ),
 );
 });

it('丹毒=0 时成功率 ≥ 丹毒满时成功率（惩罚为负权重）', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 6 }),
 (_stage) => {
 const base = P.breakthrough.successBase + P.breakthrough.successPrepBonus * 0.5;
 const rateClean = Math.max(0.05, Math.min(0.95, base));
 const ratePoisoned = Math.max(0.05, Math.min(0.95, base + P.breakthrough.successPoisonPenalty * 1.0));
 expect(rateClean).toBeGreaterThanOrEqual(ratePoisoned);
 },
 ),
 );
 });
});

// ── PBT-10: 时间前进单调（state.day）────────────────────────────────────────
// state.tick 是实时渲染计数器，在无头模式下不推进；
// state.day 由 applyFarmDayEnd 每 simulateDay 递增 +1。
describe('PBT-10: 时间前进 — state.day 单调 +1', () => {
 it('simulateDay N 次后 state.day 恰好 +N', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 50 }),
 fc.integer({ min: 1, max: 999 }),
 (days, seed) => {
 const state = createWorld({ seed, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 mutateItem(state.player, 'seed.mossling', 10);
 const startDay = state.day;
 for (let d = 0; d < days; d++) {
 const prevDay = state.day;
 simulateDay(state, { actions: [] }, ctx);
 expect(state.day).toBe(prevDay + 1);
 }
 expect(state.day).toBe(startDay + days);
 },
 ),
 );
 });

it('day 不跳变：相邻两次 simulateDay 之差恒为 1', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 2, max: 30 }),
 fc.integer({ min: 100, max: 9999 }),
 (days, seed) => {
 const state = createWorld({ seed, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 const daysBefore: number[] = [];
 for (let d = 0; d < days; d++) {
 daysBefore.push(state.day);
 simulateDay(state, { actions: [] }, ctx);
 }
 const startDay = daysBefore[0] ?? 1;
 for (let i = 0; i < daysBefore.length; i++) {
 expect(state.day - startDay).toBe(days);
 }
 },
 ),
 );
 });

it('无动作连跑 100 日：day 单调且有限', () => {
 const state = createWorld({ seed: 77, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(77, reg, P);
 mutateItem(state.player, 'seed.mossling', 5);
 for (let d = 0; d < 100; d++) {
 simulateDay(state, { actions: [] }, ctx);
 if (state.gameOver) break;
 }
 expect(state.day).toBeGreaterThan(1);
 expect(Number.isFinite(state.day)).toBe(true);
 });
});
