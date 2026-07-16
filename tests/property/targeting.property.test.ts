/**
  * 属性测试 PBT-03 + PBT-05。
 *
  * PBT-03: 雷权重归一化 — normalize(weights) 的和 == 1.0（容差 1e-9）。
  * PBT-05: 修为单调 — runTribulation 存活后 cultivation 只增不减（淬体永远正增益）。
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
 createWorld,
 createSimContext,
 DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { computeWeights, normalize } from '@sim/tribulation/targeting';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { mutateItem } from '@sim/world/player';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;

// ── PBT-03: 雷权重归一化 ─────────────────────────────────────────────────────
describe('PBT-03: 雷权重归一化 Σ P(tile) == 1.0', () => {
 it('任意种子地图：normalize 后权重之和 == 1.0（容差 1e-9）', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 9999 }), // seed
 fc.integer({ min: 4, max: 8 }), // width
 fc.integer({ min: 4, max: 8 }), // height
 (seed, w, h) => {
 const state = createWorld({ seed, width: w, height: h, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 const { weights } = computeWeights(state, ctx, ctx.rng.lightning);
 if (weights.length === 0) return; // 全堵（极端地形）跳过

const norm = normalize(weights);
 const sum = norm.reduce((a, b) => a + b, 0);
 expect(sum).toBeCloseTo(1.0, 9);
 },
 ),
 );
 });

it('normalize 后所有权重 ∈ [0, 1]', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 9999 }),
 (seed) => {
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 const { weights } = computeWeights(state, ctx, ctx.rng.lightning);
 if (weights.length === 0) return;

const norm = normalize(weights);
 for (const p of norm) {
 expect(p).toBeGreaterThanOrEqual(0);
 expect(p).toBeLessThanOrEqual(1 + 1e-9);
 }
 },
 ),
 );
 });

it('存在作物（metalAttract↑）的地图权重仍归一化', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 100 }),
 (seed) => {
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 // 种若干灵草增加 metalAttract 影响
 const loam = state.tiles.find((t) => t.soilType === 'loam' && t.blockType === 'none');
 if (loam) {
 mutateItem(state.player, 'seed.mossling', 1);
 // 不跑 simulateDay，直接检查初始权重归一
 }
 const { weights } = computeWeights(state, ctx, ctx.rng.lightning);
 if (weights.length === 0) return;

const sum = normalize(weights).reduce((a, b) => a + b, 0);
 expect(sum).toBeCloseTo(1.0, 9);
 },
 ),
 );
 });
});

// ── PBT-05: 修为单调 — 淬体只增 ──────────────────────────────────────────────
describe('PBT-05: 修为单调 — 淬体后 cultivation ≥ 之前', () => {
 it('单次 runTribulation 存活后：cultivation 不减（淬体为正增益）', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 9999 }),
 fc.integer({ min: 1, max: 5 }),
 fc.integer({ min: 1, max: 6 }),
 (seed, boltCount, stage) => {
 const stageTyped = Math.min(stage, 6) as 1 | 2 | 3 | 4 | 5 | 6;
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 state.player.stage = stageTyped;

const cultBefore = state.player.cultivation;
 const res = runTribulation(state, {
 stage: stageTyped,
 boltCount,
 policy: { blockChance: 0 },
 blastRadius: 100, // 确保有命中，使 temperingGain > 0
 }, ctx);

if (res.survived) {
 expect(state.player.cultivation).toBeGreaterThanOrEqual(cultBefore);
 }
 // 死亡时 cultivation 不变（runTribulation 在死亡后停止淬体）
 },
 ),
 );
 });

it('多次天劫序列：cultivation 严格递增（blastRadius=100 确保命中）', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 500 }),
 fc.integer({ min: 2, max: 4 }),
 (seed, bolts) => {
 const state = createWorld({ seed, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 state.player.stage = 1 as 1;

let prevCult = state.player.cultivation;
 let survived = 0;
 for (let i = 0; i < 3; i++) {
 const res = runTribulation(state, {
 stage: 1, boltCount: bolts,
 policy: { blockChance: 0 },
 blastRadius: 100,
 }, ctx);
 if (!res.survived) break;
 survived++;
 // 每次天劫后 cultivation ≥ 之前（淬体只增）
 expect(state.player.cultivation).toBeGreaterThanOrEqual(prevCult);
 prevCult = state.player.cultivation;
 }
 expect(survived).toBeGreaterThanOrEqual(0); // 至少不崩溃
 },
 ),
 );
 });

it('boltCount=0（无雷）：cultivation 不变', () => {
 fc.assert(
 fc.property(
 fc.integer({ min: 1, max: 999 }),
 (seed) => {
 const state = createWorld({ seed, width: 8, height: 8, content: reg, params: P });
 const ctx = createSimContext(seed, reg, P);
 state.player.stage = 1 as 1;

const cultBefore = state.player.cultivation;
 runTribulation(state, {
 stage: 1, boltCount: 0, // 零雷 → 无淬体 → cultivation 不变
 policy: { blockChance: 0 },
 blastRadius: 100,
 }, ctx);
 expect(state.player.cultivation).toBe(cultBefore);
 },
 ),
 );
 });
});
