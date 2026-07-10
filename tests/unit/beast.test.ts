/**
 * 妖兽潮系统单元测试（docs/07 §3.1 / docs/18 M4）。
 * 直接测试 tickBeasts 纯函数：触发条件 / 啃食 / 退去 / 确定性。
 * 因果链：event.qi-tide 活跃 + 成熟作物 → 引兽 → 啃食 → 退去。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, tickBeasts, applyAction, DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { itemCount } from '@sim/world/player';
import type { GameState } from '@sim/world/state';
import type { ContentRegistry } from '@content/defs';

const QI_TIDE = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 10, growthMod: 1.5, qiMod: 1.5 };

function beastParams(over: Partial<BalanceParams['celestial']['beast']> = {}): BalanceParams {
  return { ...DEFAULT_BALANCE, celestial: { ...DEFAULT_BALANCE.celestial, beast: { ...DEFAULT_BALANCE.celestial.beast, ...over } } };
}

function setup(seed = 1, params: BalanceParams = DEFAULT_BALANCE) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  return { state, ctx, reg };
}

/** 直接注入一株成熟灵草到指定地块（绕过种植动作前置，隔离测试 tickBeasts）。 */
function injectMature(state: GameState, reg: ContentRegistry, tileId: number, defId = 'herb.mossling'): void {
  const herb = reg.herbs.get(defId)!;
  state.crops.set(tileId, {
    id: tileId, defId, tileId, growth: herb.growthThreshold, health: 100 * MILLI,
    stage: 'mature', plantedDay: state.day, property: herb.baseProperty, tempered: false,
  });
  const tile = state.tiles[tileId];
  if (tile) tile.cropId = tileId;
}

function countEvents(state: GameState, type: string): number {
  return state.events.filter((e) => e.type === type).length;
}

describe('妖兽潮系统 tickBeasts (docs/07 §3.1 / M4)', () => {
  it('无灵气潮汐 → 不触发妖兽潮', () => {
    const { state, ctx, reg } = setup(1);
    state.activeEvent = null;
    injectMature(state, reg, 0);
    expect(tickBeasts(state, ctx)).toBeNull();
    expect(state.beastSurge).toBeNull();
  });

  it('灵气潮汐但无成熟作物 → 不触发', () => {
    const { state, ctx } = setup(1, beastParams({ surgeChancePerDay: 1.0 }));
    state.activeEvent = QI_TIDE;
    expect(tickBeasts(state, ctx)).toBeNull();
    expect(state.beastSurge).toBeNull();
  });

  it('surgeChancePerDay=0 → 永不触发（即便潮汐+成熟作物）', () => {
    const { state, ctx, reg } = setup(1, beastParams({ surgeChancePerDay: 0.0 }));
    state.activeEvent = QI_TIDE;
    injectMature(state, reg, 0);
    expect(tickBeasts(state, ctx)).toBeNull();
  });

  it('灵气潮汐 + 成熟作物 + 概率命中 → 触发，妖兽数 ∈ [countMin, countMaxBase+stage]', () => {
    const { state, ctx, reg } = setup(1, beastParams({ surgeChancePerDay: 1.0, countMin: 3, countMaxBase: 5 }));
    state.activeEvent = QI_TIDE;
    state.player.stage = 2 as 2;
    injectMature(state, reg, 0);
    const surge = tickBeasts(state, ctx);
    expect(surge).not.toBeNull();
    expect(surge!.beastsRemaining).toBeGreaterThanOrEqual(3);
    expect(surge!.beastsRemaining).toBeLessThanOrEqual(5 + 2);
    expect(surge!.daysLeft).toBe(3);
    expect(countEvents(state, 'beast-surge-start')).toBe(1);
  });

  it('妖兽每日啃食成熟作物（每只每日 1 株），妖兽数恒定', () => {
    const { state, ctx, reg } = setup(7, beastParams({ surgeChancePerDay: 1.0, countMin: 2, countMaxBase: 2, surgeDurationDays: 5 }));
    state.activeEvent = QI_TIDE;
    state.player.stage = 0 as 0; // countMax=2，intRange(2,3)=2 → 恒为 2 只
    for (let i = 0; i < 4; i++) injectMature(state, reg, i); // 4 株成熟
    tickBeasts(state, ctx); // 触发
    expect(state.beastSurge!.beastsRemaining).toBe(2);
    tickBeasts(state, ctx); // 啃 2 株
    expect(state.beastSurge!.beastsRemaining).toBe(2); // 妖兽数恒定（不因吃饱离去）
    expect(state.crops.size).toBe(2);
    expect(countEvents(state, 'beast-eat-crop')).toBe(2);
  });

  it('surgeDurationDays 到时强制退去（即便仍有成熟作物）', () => {
    const { state, ctx, reg } = setup(7, beastParams({ surgeChancePerDay: 1.0, countMin: 2, countMaxBase: 2, surgeDurationDays: 1 }));
    state.activeEvent = QI_TIDE;
    state.player.stage = 0 as 0;
    for (let i = 0; i < 6; i++) injectMature(state, reg, i); // 6 株（多于妖兽）
    tickBeasts(state, ctx); // 触发，daysLeft=1
    tickBeasts(state, ctx); // 啃 2，daysLeft→0 → 强制退去
    expect(state.beastSurge).toBeNull();
    expect(state.crops.size).toBe(4); // 仍剩 4 株（到时退去，未吃完）
    expect(countEvents(state, 'beast-surge-end')).toBe(1);
  });

  it('某日无成熟作物 → 妖兽提前退去（不空守空田）', () => {
    const { state, ctx, reg } = setup(7, beastParams({ surgeChancePerDay: 1.0, countMin: 2, countMaxBase: 2, surgeDurationDays: 9 }));
    state.activeEvent = QI_TIDE;
    state.player.stage = 0 as 0;
    injectMature(state, reg, 0); // 仅 1 株
    injectMature(state, reg, 1);
    tickBeasts(state, ctx); // 触发 2 只
    tickBeasts(state, ctx); // 啃 2 株 → 田间清空
    expect(state.crops.size).toBe(0);
    tickBeasts(state, ctx); // 今日无食 → 退去
    expect(state.beastSurge).toBeNull();
  });

  it('确定性：同种子同状态 → 同妖兽数 / 同啃食序列', () => {
    const run = (seed: number) => {
      const { state, ctx, reg } = setup(seed, beastParams({ surgeChancePerDay: 1.0, countMin: 3, countMaxBase: 5 }));
      state.activeEvent = QI_TIDE;
      state.player.stage = 2 as 2;
      for (let i = 0; i < 6; i++) injectMature(state, reg, i);
      const surge = tickBeasts(state, ctx);
      tickBeasts(state, ctx); // 啃一轮
      return { count: surge!.beastsRemaining, cropsLeft: state.crops.size };
    };
    expect(JSON.stringify(run(5))).toBe(JSON.stringify(run(5)));
  });
});

describe('主动猎妖战利品（docs/07 §3.4.3）', () => {
  it('被动退去无内丹，主动猎妖承担代价后才掉落', () => {
    const P = beastParams({ huntStaminaCost: 20, huntDamage: 8, lootChancePerBeast: 1.0 });
    const { state, ctx } = setup(7, P);
    state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };
    const hpBefore = state.player.hp;
    const staminaBefore = state.player.stamina;
    applyAction(state, { kind: 'hunt-beast' }, ctx);
    expect(state.beastSurge?.beastsRemaining).toBe(1);
    expect(state.player.hp).toBe(hpBefore - 8 * MILLI);
    expect(state.player.stamina).toBe(staminaBefore - 20 * MILLI);
    expect(itemCount(state.player, 'item.beast-core')).toBe(1);
    expect(countEvents(state, 'beast-loot')).toBe(1);

    tickBeasts(state, ctx); // 最后一只被动退去，不追加猎妖奖励
    expect(state.beastSurge).toBeNull();
    expect(itemCount(state.player, 'item.beast-core')).toBe(1);
  });

  it('lootChancePerBeast=0 → 猎妖成功但无掉落', () => {
    const { state, ctx } = setup(7, beastParams({ lootChancePerBeast: 0 }));
    state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
    applyAction(state, { kind: 'hunt-beast' }, ctx);
    expect(state.beastSurge).toBeNull();
    expect(itemCount(state.player, 'item.beast-core')).toBe(0);
    expect(countEvents(state, 'beast-loot')).toBe(0);
    expect(countEvents(state, 'beast-hunted')).toBe(1);
  });

  it('掉落确定且每次猎妖至多一颗', () => {
    const run = (seed: number) => {
      const { state, ctx } = setup(seed, beastParams({ lootChancePerBeast: 0.5 }));
      state.beastSurge = { beastsRemaining: 5, daysLeft: 9 };
      for (let i = 0; i < 5; i++) {
        state.player.stamina = 100 * MILLI;
        state.player.hp = state.player.maxHp;
        applyAction(state, { kind: 'hunt-beast' }, ctx);
      }
      return itemCount(state.player, 'item.beast-core');
    };
    const cores = run(3);
    expect(cores).toBeGreaterThanOrEqual(0);
    expect(cores).toBeLessThanOrEqual(5);
    expect(run(3)).toBe(cores);
  });

  it('背包满且无内丹格时不虚报掉落', () => {
    const { state, ctx } = setup(7, beastParams({ lootChancePerBeast: 1 }));
    state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
    state.player.inventoryCapacity = 1;
    state.player.inventory['item.compost'] = { itemId: 'item.compost', count: 1 };
    applyAction(state, { kind: 'hunt-beast' }, ctx);
    expect(itemCount(state.player, 'item.beast-core')).toBe(0);
    expect(countEvents(state, 'beast-loot')).toBe(0);
  });

  it('内丹达到 stack=5 后不再超堆', () => {
    const { state, ctx } = setup(7, beastParams({ huntDamage: 0, huntStaminaCost: 0, lootChancePerBeast: 1 }));
    state.beastSurge = { beastsRemaining: 2, daysLeft: 3 };
    state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 5 };
    applyAction(state, { kind: 'hunt-beast' }, ctx);
    expect(itemCount(state.player, 'item.beast-core')).toBe(5);
    expect(countEvents(state, 'beast-loot')).toBe(0);
  });
});
