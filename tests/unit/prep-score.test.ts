/**
  * prepScore 集成测试。
 *
  * 验证"种田—炼丹—布阵—渡劫"闭环在数值上的体现：
  * - 有阵法 + 有避雷丹 → 高 prepScore → 高突破成功率
  * - 无准备 → prepScore=0 → 成功率降低
 */
import { describe, it, expect } from 'vitest';
import {
 createWorld,
 createSimContext,
 DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { computePrepScore, breakthrough, stageQiCap } from '@sim/progression/progression';
import { mutateItem, itemCount } from '@sim/world/player';

function setup(seed = 1, stage: 1 | 2 | 3 = 1) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = stage;
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx, reg };
}

describe('prepScore: 突破准备度评分', () => {
 it('无阵法 + 无避雷丹 → prepScore=0.0', () => {
 const { state } = setup();
 expect(computePrepScore(state)).toBe(0.0);
 });

it('有避雷丹（ward-basic）→ pillScore=1.0 → prepScore=0.6', () => {
 const { state } = setup();
 mutateItem(state.player, 'pill.ward-basic', 1);
 // arrayScore=0, pillScore=1.0 → 0.4×0 + 0.6×1.0 = 0.6
 expect(computePrepScore(state)).toBeCloseTo(0.6);
 });

it('有大避雷丹（ward-greater）→ pillScore=1.0 → prepScore=0.6', () => {
 const { state } = setup();
 mutateItem(state.player, 'pill.ward-greater', 1);
 expect(computePrepScore(state)).toBeCloseTo(0.6);
 });

it('2 个激活阵法 + 无丹 → arrayScore=1.0 → prepScore=0.4', () => {
 const { state } = setup();
 // 直接注入激活阵法（测试 computePrepScore，不测试 placeArray 前置条件）
 state.arrays.set(1, { id: 1, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 100, active: true });
 state.arrays.set(2, { id: 2, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 1, coverageTileIds: [], power: 100, active: true });
 // arrayScore = min(2/2, 1.0) = 1.0, pillScore = 0 → 0.4×1 + 0.6×0 = 0.4
 expect(computePrepScore(state)).toBeCloseTo(0.4);
 });

it('1 阵法 → arrayScore=0.5 → prepScore=0.2（无丹）', () => {
 const { state } = setup();
 state.arrays.set(1, { id: 1, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 100, active: true });
 expect(computePrepScore(state)).toBeCloseTo(0.2);
 });

it('满准备（2+阵 + 避雷丹）→ prepScore=1.0', () => {
 const { state } = setup();
 mutateItem(state.player, 'pill.ward-basic', 1);
 state.arrays.set(1, { id: 1, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 100, active: true });
 state.arrays.set(2, { id: 2, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 1, coverageTileIds: [], power: 100, active: true });
 expect(computePrepScore(state)).toBeCloseTo(1.0);
 });

it('非激活阵法不计入 arrayScore', () => {
 const { state } = setup();
 // 添加一个非激活阵法
 state.arrays.set(1, { id: 1, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 0, active: false });
 expect(computePrepScore(state)).toBe(0.0);
 });

it('高 prepScore 使突破成功率更高（统计验证）', () => {
 // 对比组：满准备 vs 无准备，各30局，满准备成功率应更高
 let successFull = 0, successNone = 0;
 const TRIALS = 30;
 for (let s = 0; s < TRIALS; s++) {
 // 满准备
 {
 const { state, ctx } = setup(s, 1);
 state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 5000;
 mutateItem(state.player, 'pill.ward-basic', 1);
 state.arrays.set(1, { id: 1, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 0, coverageTileIds: [], power: 100, active: true });
 state.arrays.set(2, { id: 2, defId: 'array.lightning-rod', modifier: 4.0, coreTileId: 1, coverageTileIds: [], power: 100, active: true });
 const r = breakthrough(state, ctx, true);
 if (r.success) successFull++;
 expect(r.prepScore).toBeCloseTo(1.0);
 }
 // 无准备
 {
 const { state, ctx } = setup(s, 1);
 state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 5000;
 const r = breakthrough(state, ctx, true);
 if (r.success) successNone++;
 expect(r.prepScore).toBe(0.0);
 }
 }
 // 满准备成功率 ≥ 无准备（prepBonus 为正权重）
 expect(successFull).toBeGreaterThanOrEqual(successNone);
 });

it('BreakthroughResult.prepScore 字段正确返回', () => {
 const { state, ctx } = setup(1, 1);
 state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 1000;
 mutateItem(state.player, 'pill.ward-basic', 1);
 const r = breakthrough(state, ctx, true);
 expect(r.prepScore).toBeCloseTo(0.6); // 有丹无阵
 expect(r.prepScore).toBeGreaterThanOrEqual(0);
 expect(r.prepScore).toBeLessThanOrEqual(1.0);
 });
});
