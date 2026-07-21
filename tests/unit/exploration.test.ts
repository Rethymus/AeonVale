/**
 * 外出寻访：山谷/遗迹/残脉资源获取。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, delveRuin, exploreSite } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(seed = 1, stage = 0): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stage = stage as GameState['player']['stage'];
  return { state, ctx };
}

describe('外出寻访', () => {
  it('山谷寻访消耗体力并产出早期资源', () => {
    const { state, ctx } = setup(3, 0);
    const staminaBefore = state.player.stamina;
    const result = exploreSite(state, 'valley', ctx);
    expect(result.ok).toBe(true);
    expect(state.player.stamina).toBe(staminaBefore - 18_000);
    expect(result.grants.length).toBeGreaterThan(0);
    expect(state.events.some(e => e.type === 'explore')).toBe(true);
  });

  it('体力不足时拒绝且不产出', () => {
    const { state, ctx } = setup(4, 0);
    state.player.stamina = 1_000;
    const result = exploreSite(state, 'ruin', ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('体力不足');
    expect(state.events.length).toBe(0);
    expect(Object.keys(state.player.inventory).length).toBe(0);
  });

  it('同种子同阶段同地点结果确定', () => {
    const a = setup(9, 1);
    const b = setup(9, 1);
    const ra = exploreSite(a.state, 'ruin', a.ctx);
    const rb = exploreSite(b.state, 'ruin', b.ctx);
    expect(ra).toEqual(rb);
    expect(a.state.player.inventory).toEqual(b.state.player.inventory);
  });

  it('残脉低阶只稳定产灵石，高阶可额外发现引雷种', () => {
    const low = setup(1, 0);
    exploreSite(low.state, 'spirit-vein', low.ctx);
    expect(itemCount(low.state.player, 'item.spirit-stone')).toBeGreaterThan(0);
    expect(itemCount(low.state.player, 'seed.metalpine')).toBe(0);

    const high = setup(1, 2);
    exploreSite(high.state, 'spirit-vein', high.ctx);
    expect(itemCount(high.state.player, 'item.spirit-stone')).toBeGreaterThan(0);
  });

  it('explore 玩家动作接入动作系统', () => {
    const { state, ctx } = setup(12, 0);
    applyAction(state, { kind: 'explore', site: 'valley' }, ctx);
    expect(state.player.stamina).toBe(DEFAULT_BALANCE.player.staminaCap * 1000 - 18_000);
    expect(state.events.some(e => e.type === 'explore')).toBe(true);
  });

  it('深入遗迹会推进层数、消耗气血体力并给出传承材料', () => {
    const { state, ctx } = setup(13, 1);
    const hpBefore = state.player.hp;
    const staminaBefore = state.player.stamina;

    const result = delveRuin(state, ctx);

    expect(result).toMatchObject({ ok: true, level: 1, deepestLevel: 1, milestone: false });
    expect(state.exploration.deepestRuinLevel).toBe(1);
    expect(state.player.stamina).toBe(staminaBefore - result.staminaCost * 1000);
    expect(state.player.hp).toBe(hpBefore - result.damage * 1000);
    expect(result.grants.length).toBeGreaterThan(0);
    expect(state.events.some(e => e.type === 'ruin-delve')).toBe(true);
  });

  it('遗迹奖励目标满栈时不深入、不扣资源且恢复掉落 RNG', () => {
    const { state, ctx } = setup(13, 1);
    state.player.inventory['item.recipe-fragment'] = { itemId: 'item.recipe-fragment', count: 8 };
    const hpBefore = state.player.hp;
    const staminaBefore = state.player.stamina;
    const rngBefore = ctx.rng.drop.snapshot();

    const result = delveRuin(state, ctx);

    expect(result).toMatchObject({ ok: false, reason: '背包已满' });
    expect(state.exploration.deepestRuinLevel).toBe(0);
    expect(state.player.hp).toBe(hpBefore);
    expect(state.player.stamina).toBe(staminaBefore);
    expect(itemCount(state.player, 'item.recipe-fragment')).toBe(8);
    expect(ctx.rng.drop.snapshot()).toBe(rngBefore);
    expect(state.events.some(e => e.type === 'ruin-delve')).toBe(false);
  });

  it('每五层遗迹触发里程碑并额外给稀有种子', () => {
    const { state, ctx } = setup(14, 2);
    state.player.maxHp = 500_000;
    state.player.hp = 500_000;
    state.player.stamina = 500_000;
    let result = delveRuin(state, ctx);
    expect(result.ok).toBe(true);
    for (let i = 0; i < 4; i++) {
      result = delveRuin(state, ctx);
      expect(result.ok).toBe(true);
    }

    expect(result.level).toBe(5);
    expect(result.milestone).toBe(true);
    expect(state.exploration.deepestRuinLevel).toBe(5);
    expect(state.events.some(e => e.type === 'ruin-milestone' && (e.payload as { level?: number }).level === 5)).toBe(true);
    expect(result.grants.some(g => g.itemId.startsWith('seed.'))).toBe(true);
  });

  it('气血不足时不会深入遗迹', () => {
    const { state, ctx } = setup(15, 0);
    state.player.hp = 1_000;
    const result = delveRuin(state, ctx);
    expect(result).toMatchObject({ ok: false, reason: '气血不足' });
    expect(state.exploration.deepestRuinLevel).toBe(0);
    expect(state.events.length).toBe(0);
  });

  it('delve-ruin 玩家动作接入动作系统', () => {
    const { state, ctx } = setup(16, 1);
    applyAction(state, { kind: 'delve-ruin' }, ctx);
    expect(state.exploration.deepestRuinLevel).toBe(1);
    expect(state.events.some(e => e.type === 'ruin-delve')).toBe(true);
  });
});
