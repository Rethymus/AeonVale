import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, tileAt } from '@sim';
import { buildRegistry } from '@content/registry';
import { tileWeight, computeWeights, normalize, pickTarget } from '@sim/tribulation/targeting';
import { runTribulation, nearDeathBonus, boltBaseDamage } from '@sim/tribulation/tribulationSystem';
import { mutateItem } from '@sim/world/player';
import { Rng } from '@sim/world/rng';

function setup(seed = 1) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx, reg };
}

describe('天雷 Targeting ', () => {
 it('权重归一化后和为 1', () => {
 const { state, ctx } = setup();
 const { weights } = computeWeights(state, ctx, new Rng(1));
 const probs = normalize(weights);
 const sum = probs.reduce((a, b) => a + b, 0);
 expect(sum).toBeCloseTo(1, 6);
 });

it('金属性灵草格权重 > 空地（种田即布防）', () => {
 const { state, ctx } = setup();
 // 同一格 (1,1)（远离玩家中心）：种植雷击木前后的权重对比，隔离金属因子
 const t = tileAt(state, 1, 1)!;
 const wBefore = tileWeight(state, ctx, t, 0.5); // 空地
 t.tilled = true;
 state.crops.set(t.id, {
 id: 1, defId: 'herb.metalpine', tileId: t.id, growth: 0, health: 100_000,
 stage: 'seed', plantedDay: 1, property: { cold: 0, hot: 0, warm: 0, neutral: 0 }, tempered: false,
 });
 t.cropId = 1;
 const wAfter = tileWeight(state, ctx, t, 0.5); // 种了金属性草
 expect(wAfter).toBeGreaterThan(wBefore);
 });

it('绝缘垫层格权重 < 普通农田', () => {
 const { state, ctx } = setup();
 const loam = tileAt(state, 2, 2)!;
 const insulated = tileAt(state, 3, 3)!;
 insulated.soilType = 'insulated';
 const wLoam = tileWeight(state, ctx, loam, 0.5);
 const wIns = tileWeight(state, ctx, insulated, 0.5);
 expect(wIns).toBeLessThan(wLoam);
 });

it('pickTarget 确定性（同 rng 状态同结果）', () => {
 const { state, ctx } = setup();
 const r1 = new Rng(99);
 const r2 = new Rng(99);
 const a = pickTarget(state, ctx, r1);
 const b = pickTarget(state, ctx, r2);
 expect(a.id).toBe(b.id);
 });
});

describe('劫雷淬体 ', () => {
 it('boltBaseDamage 随阶段递增', () => {
 expect(boltBaseDamage(1, DEFAULT_BALANCE)).toBeLessThan(boltBaseDamage(5, DEFAULT_BALANCE));
 });

it('nearDeathBonus 倒钟形：低 HP 峰值，高 HP 低值', () => {
 const peak = nearDeathBonus(0.05, DEFAULT_BALANCE);
 const safe = nearDeathBonus(0.9, DEFAULT_BALANCE);
 expect(peak).toBe(DEFAULT_BALANCE.lightning.tempering.nearDeathPeak); // 2.5
 expect(safe).toBe(DEFAULT_BALANCE.lightning.tempering.nearDeathSafe); // 0.6
 expect(peak).toBeGreaterThan(safe);
 expect(nearDeathBonus(0, DEFAULT_BALANCE)).toBe(0); // 死亡=0
 });

it('runTribulation：玩家被劈掉血 + 累积淬体', () => {
 const { state, ctx } = setup();
 const cultivBefore = state.player.cultivation;
 const res = runTribulation(state, { stage: 1, boltCount: 3, policy: { blockChance: 0 } }, ctx);
 expect(res.bolts).toBe(3);
 expect(state.player.cultivation).toBeGreaterThanOrEqual(cultivBefore); // 淬体累积
 // 命中分类之和 = boltCount
 expect(res.hits.direct + res.hits.rod + res.hits.miss + res.hits.blocked).toBe(3);
 });

it('玩家初始在中心，大概率被命中（playerProximity）', () => {
 const { state, ctx } = setup();
 let directHits = 0;
 for (let s = 0; s < 20; s++) {
 const { state: st, ctx: c } = setup(s + 1);
 const r = runTribulation(st, { stage: 1, boltCount: 5, policy: { blockChance: 0 } }, c);
 directHits += r.hits.direct + r.hits.blocked;
 }
 // 5 雷 × 20 局 = 100 雷中，应有显著比例命中玩家
 expect(directHits).toBeGreaterThan(10);
 });

it('擦弹策略：blockChance 高 → 更多 blocked 命中、更少掉血', () => {
 const seed = 7;
 const reg = buildRegistry();
 const s1 = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const s2 = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const c1 = createSimContext(seed, reg, DEFAULT_BALANCE);
 const c2 = createSimContext(seed, reg, DEFAULT_BALANCE);
 const noBlock = runTribulation(s1, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, c1);
 const fullBlock = runTribulation(s2, { stage: 1, boltCount: 8, policy: { blockChance: 1 } }, c2);
 expect(fullBlock.hits.blocked).toBeGreaterThan(noBlock.hits.blocked);
 expect(fullBlock.finalHpMilli).toBeGreaterThanOrEqual(noBlock.finalHpMilli);
 });

it('未被接雷也未命中玩家的落雷会把目标地块烧成焦土', () => {
 const { state, ctx } = setup(21);
 state.player.position = { x: 0, y: 0 };

const target = tileAt(state, 5, 5)!;
 target.blockType = 'none';
 target.soilType = 'loam';
 target.tilled = true;
 target.moisture = 60_000;
 target.qiDensity = 70_000;

runTribulation(state, { stage: 1, boltCount: 12, policy: { blockChance: 0 }, blastRadius: 0 }, ctx);

const scorchedTile = state.tiles.find((tile) => tile.soilType === 'scorched');
 expect(scorchedTile).toBeDefined;
 expect(scorchedTile?.tilled).toBe(false);
 expect(scorchedTile?.moisture).toBe(0);
 });
});
