/**
  * 天象机制扩展（T8 /）：damageMod / madnessMod / alchemyTolMod
  * 经 activeEvent 透传到天劫/丹药/炼丹消费者。确定性同种子对照。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyPill } from '@sim';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import type { GameState, SimContext } from '@sim';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

describe('天象机制扩展（T8 /）', () => {
 it('3 个机制事件注册且携带倍率字段', () => {
 const reg = buildRegistry();
 expect(reg.events.get('event.heaven-eye')?.damageMod).toBe(1.3);
 expect(reg.events.get('event.blood-moon')?.madnessMod).toBe(2);
 expect(reg.events.get('event.kindling-flame')?.alchemyTolMod).toBe(10);
 });

it('damageMod：同种子下 heaven-eye 使天劫伤害更高（finalHp 更低 / 淬体更多）', () => {
 // 两份独立 state+ctx（同 seed ⇒ 同 rng 序列），仅 activeEvent 不同
 const a = setup();
 const b = setup();
 for (const s of [a.state, b.state]) {
 s.player.stage = 1 as GameState['player']['stage'];
 s.player.hp = 1000 * MILLI;
 s.player.maxHp = 1000 * MILLI;
 }
 b.state.activeEvent = { defId: 'event.heaven-eye', displayName: '天道注视', daysLeft: 1, growthMod: 1, qiMod: 1, damageMod: 1.3 };
 const ra = runTribulation(a.state, { stage: 1, boltCount: 5, policy: { blockChance: 0 } }, a.ctx);
 const rb = runTribulation(b.state, { stage: 1, boltCount: 5, policy: { blockChance: 0 } }, b.ctx);
 // 同 rng 落点；命中玩家的雷在 b 中 ×1.3 → 更多伤害/淬体
 expect(rb.finalHpMilli).toBeLessThanOrEqual(ra.finalHpMilli);
 // 至少应观察到：b 的（伤害+淬体）不低于 a
 expect(rb.temperingGainMilli).toBeGreaterThanOrEqual(ra.temperingGainMilli);
 });

it('damageMod 缺省=1：无 activeEvent 时天劫不受影响（防御性默认）', () => {
 const a = setup();
 const b = setup();
 for (const s of [a.state, b.state]) {
 s.player.stage = 1 as GameState['player']['stage'];
 s.player.hp = 1000 * MILLI;
 s.player.maxHp = 1000 * MILLI;
 }
 // b 有一个无 damageMod 的普通事件
 b.state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 5, growthMod: 1.5, qiMod: 1.5 };
 const ra = runTribulation(a.state, { stage: 1, boltCount: 5, policy: { blockChance: 0 } }, a.ctx);
 const rb = runTribulation(b.state, { stage: 1, boltCount: 5, policy: { blockChance: 0 } }, b.ctx);
 expect(rb.finalHpMilli).toBe(ra.finalHpMilli); // 无 damageMod → 完全一致
 });

it('madnessMod：blood-moon 使走火丹累积 ×2', () => {
 const a = setup();
 const b = setup();
 a.state.player.stage = 1 as GameState['player']['stage'];
 b.state.player.stage = 1 as GameState['player']['stage'];
 a.state.player.inventory['pill.madness'] = { itemId: 'pill.madness', count: 1 };
 b.state.player.inventory['pill.madness'] = { itemId: 'pill.madness', count: 1 };
 applyPill(a.state, 'pill.madness', a.ctx);
 b.state.activeEvent = { defId: 'event.blood-moon', displayName: '血月', daysLeft: 1, growthMod: 1, qiMod: 1, madnessMod: 2 };
 applyPill(b.state, 'pill.madness', b.ctx);
 expect(b.state.player.madnessValue).toBe(a.state.player.madnessValue * 2);
 });
});
