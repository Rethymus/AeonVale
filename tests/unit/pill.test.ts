import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyPill, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';
import { runTribulation } from '@sim/tribulation/tribulationSystem';

function setup(seed = 1) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx, reg };
}

describe('丹药服用 ', () => {
 it('生骨丹回血', () => {
 const { state, ctx } = setup();
 state.player.hp = 30_000;
 mutateItem(state.player, 'pill.bone-basic', 1);
 const r = applyPill(state, 'pill.bone-basic', ctx);
 expect(r.applied).toBe(true);
 expect(state.player.hp).toBe(60_000); // +30_000
 expect(state.player.inventory['pill.bone-basic']).toBeUndefined;
 });

it('净毒丹清丹毒（净效果 = 清毒 - 自身负荷）', () => {
 const { state, ctx } = setup();
 state.player.pillPoison = 50_000;
 mutateItem(state.player, 'pill.detox', 1);
 applyPill(state, 'pill.detox', ctx);
 // 清毒 25_000 - 自身负荷 2_000 = 净降 23_000 → 27_000
 expect(state.player.pillPoison).toBe(27_000);
 });

it('避雷丹设置护体减伤', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'pill.ward-basic', 1);
 applyPill(state, 'pill.ward-basic', ctx);
 expect(state.player.wardMitigation).toBe(0.4);
 });

it('无丹药时不消耗', () => {
 const { state, ctx } = setup();
 const r = applyPill(state, 'pill.ward-basic', ctx);
 expect(r.applied).toBe(false);
 });

it('护体减伤在天劫中生效且渡劫后消耗', () => {
 const reg = buildRegistry();
 const sA = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const sB = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const cA = createSimContext(5, reg, DEFAULT_BALANCE);
 const cB = createSimContext(5, reg, DEFAULT_BALANCE);
 mutateItem(sA.player, 'pill.ward-basic', 1);
 applyPill(sA, 'pill.ward-basic', cA); // A 有护体
 const rA = runTribulation(sA, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cA);
 const rB = runTribulation(sB, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cB);
 // A 受护体保护，掉血更少
 expect(rA.finalHpMilli).toBeGreaterThanOrEqual(rB.finalHpMilli);
 expect(sA.player.wardMitigation).toBe(0); // 渡劫后消耗
 });

it('淬体丹设置 temperBoostMult（下次天劫淬体 ×1.3）', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'pill.temper', 1);
 const r = applyPill(state, 'pill.temper', ctx);
 expect(r.applied).toBe(true);
 expect(state.player.temperBoostMult).toBe(1.3);
 });

it('无极淬体丹 temperBoost ×1.6，取最强不叠加', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'pill.temper', 1);
 applyPill(state, 'pill.temper', ctx); // 先 ×1.3
 expect(state.player.temperBoostMult).toBe(1.3);
 mutateItem(state.player, 'pill.temper-supreme', 1);
 applyPill(state, 'pill.temper-supreme', ctx); // 再 ×1.6 → 取最强
 expect(state.player.temperBoostMult).toBe(1.6);
 });

it('偷天避雷丹设置护体减伤 0.75（终极抗雷）', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'pill.ward-heaven', 1);
 applyPill(state, 'pill.ward-heaven', ctx);
 expect(state.player.wardMitigation).toBe(0.75);
 });

it('铁骨丹设置 ironBoneMitigation 0.2（整场减伤）', () => {
 const { state, ctx } = setup();
 mutateItem(state.player, 'pill.iron-bone', 1);
 applyPill(state, 'pill.iron-bone', ctx);
 expect(state.player.ironBoneMitigation).toBe(0.2);
 });

it('铁骨减伤在天劫中与避雷护体叠加，且渡劫后双双消耗', () => {
 const reg = buildRegistry();
 // 同时服避雷丹(0.4) + 铁骨丹(0.2) → 每雷 dmg = base × 0.6 × 0.8
 const sBoth = createWorld({ seed: 9, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const sNone = createWorld({ seed: 9, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const cBoth = createSimContext(9, reg, DEFAULT_BALANCE);
 const cNone = createSimContext(9, reg, DEFAULT_BALANCE);
 mutateItem(sBoth.player, 'pill.ward-basic', 1);
 mutateItem(sBoth.player, 'pill.iron-bone', 1);
 applyPill(sBoth, 'pill.ward-basic', cBoth);
 applyPill(sBoth, 'pill.iron-bone', cBoth);
 const rBoth = runTribulation(sBoth, { stage: 1, boltCount: 5, policy: { blockChance: 0 }, blastRadius: 100 }, cBoth);
 const rNone = runTribulation(sNone, { stage: 1, boltCount: 5, policy: { blockChance: 0 }, blastRadius: 100 }, cNone);
 expect(rBoth.finalHpMilli).toBeGreaterThan(rNone.finalHpMilli); // 减伤后掉血更少
 expect(sBoth.player.ironBoneMitigation).toBe(0); // 渡劫后消耗
 expect(sBoth.player.wardMitigation).toBe(0);
 });

it('temperBoostMult 在天劫中放大淬体且渡劫后消耗', () => {
 const reg = buildRegistry();
 const sBoost = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const sBase = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const cBoost = createSimContext(5, reg, DEFAULT_BALANCE);
 const cBase = createSimContext(5, reg, DEFAULT_BALANCE);
 mutateItem(sBoost.player, 'pill.temper-supreme', 1);
 applyPill(sBoost, 'pill.temper-supreme', cBoost); // ×1.6
 const rBoost = runTribulation(sBoost, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cBoost);
 const rBase = runTribulation(sBase, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cBase);
 expect(rBoost.temperingGainMilli).toBeGreaterThanOrEqual(rBase.temperingGainMilli);
 expect(sBoost.player.temperBoostMult).toBe(1); // 渡劫后消耗
 });

it('maxHpUp 效果：提升 maxHp 并填满 HP', () => {
 const reg = buildRegistry();
 // 注入含 maxHpUp 效果的测试丹药
 reg.pills.set('pill.test-maxhpup', {
 id: 'pill.test-maxhpup', displayName: '强骨试验丹',
 tier: 2 as const, effects: [{ kind: 'maxHpUp', power: 20_000 }], load: 0, stack: 5,
 });
 reg.items.set('pill.test-maxhpup', { id: 'pill.test-maxhpup', displayName: '强骨试验丹', category: 'pill' as const, stack: 5 });
 const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(1, reg, DEFAULT_BALANCE);
 const maxHpBefore = state.player.maxHp;
 state.player.hp = state.player.maxHp; // 满血
 mutateItem(state.player, 'pill.test-maxhpup', 1);
 const r = applyPill(state, 'pill.test-maxhpup', ctx);
 expect(r.applied).toBe(true);
 expect(state.player.maxHp).toBe(maxHpBefore + 20_000); // 上限提升
 expect(state.player.hp).toBe(state.player.maxHp); // HP 随上限提升
 });
});
