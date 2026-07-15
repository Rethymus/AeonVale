import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as Pv from '@sim/alchemy/property';
import { extraction, naturalHeat, conflictMagnitude, balanceScore } from '@sim/alchemy/property';
import { summarizePairings, lookupRelation } from '@sim/alchemy/compatibility';
import { DEFAULT_BALANCE, createWorld, createSimContext } from '@sim';
import { resolveBrew } from '@sim/alchemy/alchemySystem';
import { buildRegistry } from '@content/registry';

const reg = buildRegistry();
const herbIds = [...reg.herbs.keys()];

describe('炼丹属性测试 ', () => {
 it('PBT-extraction: 提取系数有界 [0,1]', () => {
 fc.assert(
 fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 0, max: 100_000 }), (heat, nat) => {
 const e = extraction(heat, nat);
 expect(e).toBeGreaterThanOrEqual(0);
 expect(e).toBeLessThanOrEqual(1);
 }),
 );
 });

it('PBT-conflict: 寒热冲突量级非负', () => {
 fc.assert(
 fc.property(fc.record({ cold: fc.integer(), hot: fc.integer(), warm: fc.integer(), neutral: fc.integer() }), (v) => {
 expect(conflictMagnitude(v)).toBeGreaterThanOrEqual(0);
 }),
 );
 });

it('PBT-balanceScore: 有界 [0,1]', () => {
 fc.assert(
 fc.property(
 fc.record({ cold: fc.integer(), hot: fc.integer(), warm: fc.integer(), neutral: fc.integer() }),
 fc.record({ cold: fc.integer(), hot: fc.integer(), warm: fc.integer(), neutral: fc.integer() }),
 (a, b) => {
 const s = balanceScore(a, b, 20_000);
 expect(s).toBeGreaterThanOrEqual(0);
 expect(s).toBeLessThanOrEqual(1);
 },
 ),
 );
 });

it('PBT-炸炉确定性：同 (材料,火候,阶段) ⇒ 同 outcome（resolveBrew 纯函数）', () => {
 const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
 fc.assert(
 fc.property(
 fc.array(fc.record({ herbId: fc.constantFrom(...herbIds), qty: fc.integer({ min: 1, max: 3 }) }), { minLength: 1, maxLength: 4 }),
 fc.integer({ min: 0, max: 100_000 }),
 (materials, heat) => {
 const r1 = resolveBrew(state, { materials, avgHeatMilli: heat }, ctx);
 const r2 = resolveBrew(state, { materials, avgHeatMilli: heat }, ctx);
 expect(r1.outcome).toBe(r2.outcome);
 expect(r1.quality).toBe(r2.quality);
 },
 ),
 );
 });

it('PBT-七情对称性：lookupRelation(a,b) === lookupRelation(b,a)', () => {
 fc.assert(
 fc.property(fc.constantFrom(...herbIds), fc.constantFrom(...herbIds), (a, b) => {
 const r1 = lookupRelation(a, b);
 const r2 = lookupRelation(b, a);
 expect(r1?.relation).toBe(r2?.relation);
 }),
 );
 });

it('PBT-药性聚合有界：不超各输入加权和（守恒）', () => {
 const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
 const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 fc.assert(
 fc.property(
 fc.array(fc.record({ herbId: fc.constantFrom(...herbIds), qty: fc.integer({ min: 1, max: 2 }) }), { minLength: 1, maxLength: 3 }),
 fc.integer({ min: 0, max: 100_000 }),
 (materials, heat) => {
 const res = resolveBrew(state, { materials, avgHeatMilli: heat }, ctx);
 // 聚合向量任一分量 ≤ 输入材料该分量加权和（提取系数 ≤1，不凭空产生）
 let maxInput = 0;
 for (const m of materials) {
 const h = reg.herbs.get(m.herbId);
 if (h) maxInput += Pv.l1Norm(h.baseProperty) * m.qty;
 }
 expect(Pv.l1Norm(res.furnaceVec)).toBeLessThanOrEqual(maxInput + 1);
 },
 ),
 );
 });
});
