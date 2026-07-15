/**
  * 妖兽潮系统单元测试。
  * 直接测试 tickBeasts 纯函数：触发条件 / 啃食 / 退去 / 确定性。
  * 因果链：event.qi-tide 活跃 + 成熟作物 → 引兽 → 啃食 → 退去。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, tickBeasts, applyAction, DEFAULT_BALANCE, placeArray, tileAt, guardBeastMasteryReady, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { MILLI } from '@sim/world/types';
import { itemCount } from '@sim/world/player';
import type { GameState, GuardBeast } from '@sim/world/state';
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

function lastEvent(state: GameState, type: string) {
 for (let i = state.events.length - 1; i >= 0; i--) {
 const event = state.events[i];
 if (event?.type === type) return event;
 }
 return undefined;
}

describe('妖兽潮系统 tickBeasts ', () => {
 it('无灵气潮汐 → 不触发妖兽潮', () => {
 const { state, ctx, reg } = setup(1);
 state.activeEvent = null;
 injectMature(state, reg, 0);
 expect(tickBeasts(state, ctx)).toBeNull;
 expect(state.beastSurge).toBeNull;
 });

it('灵气潮汐但无成熟作物 → 不触发', () => {
 const { state, ctx } = setup(1, beastParams({ surgeChancePerDay: 1.0 }));
 state.activeEvent = QI_TIDE;
 expect(tickBeasts(state, ctx)).toBeNull;
 expect(state.beastSurge).toBeNull;
 });

it('surgeChancePerDay=0 → 永不触发（即便潮汐+成熟作物）', () => {
 const { state, ctx, reg } = setup(1, beastParams({ surgeChancePerDay: 0.0 }));
 state.activeEvent = QI_TIDE;
 injectMature(state, reg, 0);
 expect(tickBeasts(state, ctx)).toBeNull;
 });

it('灵气潮汐 + 成熟作物 + 概率命中 → 触发，妖兽数 ∈ [countMin, countMaxBase+stage]', () => {
 const { state, ctx, reg } = setup(1, beastParams({ surgeChancePerDay: 1.0, countMin: 3, countMaxBase: 5 }));
 state.activeEvent = QI_TIDE;
 state.player.stage = 2 as 2;
 injectMature(state, reg, 0);
 const surge = tickBeasts(state, ctx);
 expect(surge).not.toBeNull;
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
 expect(state.beastSurge).toBeNull;
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
 expect(state.beastSurge).toBeNull;
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

describe('主动猎妖战利品', () => {
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
 expect(state.beastSurge).toBeNull;
 expect(itemCount(state.player, 'item.beast-core')).toBe(1);
 });

it('lootChancePerBeast=0 → 猎妖成功但无掉落', () => {
 const { state, ctx } = setup(7, beastParams({ lootChancePerBeast: 0 }));
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 applyAction(state, { kind: 'hunt-beast' }, ctx);
 expect(state.beastSurge).toBeNull;
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

describe('巡守兽护田（体修农庄看门犬式防护）', () => {
 it('可消耗内丹与灵石驯养巡守兽，并受栏位限制', () => {
 const { state, ctx } = setup(7, beastParams({ tameCoreCost: 2, tameSpiritStoneCost: 4, guardVigorMax: 3 }));
 state.player.stage = 0 as 0;
 state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 2 };
 state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 4 };

applyAction(state, { kind: 'tame-guard-beast' }, ctx);
 expect(state.guardBeasts).toHaveLength(1);
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ vigor: 3, maxVigor: 3, bond: 0, specialty: null }));
 expect(itemCount(state.player, 'item.beast-core')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(countEvents(state, 'guard-beast-tamed')).toBe(1);

state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 2 };
 state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 4 };
 applyAction(state, { kind: 'tame-guard-beast' }, ctx);
 expect(state.guardBeasts).toHaveLength(1);
 expect(itemCount(state.player, 'item.beast-core')).toBe(2);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(4);
 });

it('巡守兽先拦截妖兽，减少成熟灵草损失并消耗精力', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 99, vigor: 2, maxVigor: 3, bond: 0, specialty: null });
 state.beastSurge = { beastsRemaining: 3, daysLeft: 2 };
 for (let i = 0; i < 4; i++) injectMature(state, reg, i);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]!.vigor).toBe(0);
 expect(state.crops.size).toBe(3); // 3 只来袭，2 次被拦，实际只损失 1 株
 expect(countEvents(state, 'guard-beast-block')).toBe(2);
 expect(countEvents(state, 'beast-eat-crop')).toBe(1);
 expect(countEvents(state, 'guard-beast-patrol')).toBe(1);
 });

it('巡守兽日终恢复精力，下一轮可继续护田', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 1 }));
 state.guardBeasts.push({ id: 1, vigor: 0, maxVigor: 2, bond: 0, specialty: null });
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 injectMature(state, reg, 0);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]!.vigor).toBe(0); // 先恢复到 1，再拦截 1 次
 expect(state.crops.size).toBe(1);
 expect(countEvents(state, 'guard-beast-recover')).toBe(1);
 expect(countEvents(state, 'guard-beast-block')).toBe(1);
 expect(countEvents(state, 'beast-eat-crop')).toBe(0);
 });

it('资源不足时驯养失败且不改变库存', () => {
 const { state, ctx } = setup(7, beastParams({ tameCoreCost: 2, tameSpiritStoneCost: 4 }));
 state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 1 };
 state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 4 };

applyAction(state, { kind: 'tame-guard-beast' }, ctx);

expect(state.guardBeasts).toHaveLength(0);
 expect(itemCount(state.player, 'item.beast-core')).toBe(1);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(4);
 expect(countEvents(state, 'guard-beast-tamed')).toBe(0);
 });

it('高境界玩家驯养巡守兽自带更高起始羁绊', () => {
 const { state, ctx } = setup(7, beastParams({ tameCoreCost: 1, tameSpiritStoneCost: 1, guardBondMax: 100 }));
 state.player.stage = 5;
 state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 1 };
 state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };

applyAction(state, { kind: 'tame-guard-beast' }, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ bond: 8 })); // (5-1)*2
 expect(lastEvent(state, 'guard-beast-tamed')?.payload).toEqual(expect.objectContaining({ startingBond: 8 }));
 });

it('可投喂灵草照料巡守兽，恢复精力并提升羁绊', () => {
 const { state, ctx } = setup(7, beastParams({ guardFeedVigorGain: 2, guardFeedBondGain: 15, guardBondMax: 20 }));
 state.guardBeasts.push({ id: 1, vigor: 0, maxVigor: 3, bond: 10, specialty: null });
 state.player.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 1 };

applyAction(state, { kind: 'feed-guard-beast', herbItemId: 'herb.mossling' }, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ vigor: 2, bond: 20 }));
 expect(itemCount(state.player, 'herb.mossling')).toBe(0);
 expect(countEvents(state, 'guard-beast-fed')).toBe(1);
 });

it('投喂高阶灵草（tier≥2）额外提升羁绊', () => {
 const { state, ctx } = setup(7, beastParams({ guardFeedBondGain: 10, guardBondMax: 100 }));
 state.guardBeasts.push({ id: 1, vigor: 0, maxVigor: 3, bond: 0, specialty: null });

state.player.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 1 };
 applyAction(state, { kind: 'feed-guard-beast', herbItemId: 'herb.mossling' }, ctx);
 expect(state.guardBeasts[0]?.bond).toBe(10); // tier1：10 + 0（无加成）

state.player.inventory['herb.frostmarrow'] = { itemId: 'herb.frostmarrow', count: 1 };
 applyAction(state, { kind: 'feed-guard-beast', herbItemId: 'herb.frostmarrow' }, ctx);
 expect(state.guardBeasts[0]?.bond).toBe(25); // +15（10 + ceil(10/2)=5）

state.player.inventory['herb.metalpine'] = { itemId: 'herb.metalpine', count: 1 };
 applyAction(state, { kind: 'feed-guard-beast', herbItemId: 'herb.metalpine' }, ctx);
 expect(state.guardBeasts[0]?.bond).toBe(45); // +20（10 + 10）
 expect(lastEvent(state, 'guard-beast-fed')?.payload).toEqual(expect.objectContaining({ herbTier: 3, bondGain: 20, bondTierBonus: 10 }));
 });

it('高羁绊巡守兽以更低精力成本护田', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 2, guardVigorCostReduced: 1, guardBondCostReductionThreshold: 50, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: 50, specialty: null });
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };
 for (let i = 0; i < 2; i++) injectMature(state, reg, i);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]!.vigor).toBe(0);
 expect(state.crops.size).toBe(2);
 expect(countEvents(state, 'guard-beast-block')).toBe(2);
 expect(countEvents(state, 'beast-eat-crop')).toBe(0);
 });

it('巡守兽成功护田会获得羁绊成长，并写入事件负载', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0, guardBondGainPerBlock: 4, guardBondMax: 12 }));
 state.guardBeasts.push({ id: 21, vigor: 2, maxVigor: 3, bond: 5, specialty: null });
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };
 injectMature(state, reg, 0);
 injectMature(state, reg, 1);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 21, vigor: 0, bond: 12 }));
 const blockEvents = state.events.filter((event) => event.type === 'guard-beast-block');
 expect(blockEvents).toHaveLength(2);
 expect(blockEvents[0]?.payload).toEqual(expect.objectContaining({ id: 21, bond: 9, bondGain: 4 }));
 expect(blockEvents[1]?.payload).toEqual(expect.objectContaining({ id: 21, bond: 12, bondGain: 4 }));
 });

it('高羁绊巡守兽在成功护田后会固化为守田专长，并写入事件负载', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0, guardBondGainPerBlock: 4, guardBondMax: 40 }));
 state.guardBeasts.push({ id: 31, vigor: 1, maxVigor: 3, bond: 28, specialty: null });
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 injectMature(state, reg, 0);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 31, vigor: 0, bond: 32, specialty: 'field-ward' }));
 expect(lastEvent(state, 'guard-beast-specialty-unlocked')?.payload).toEqual(expect.objectContaining({ id: 31, specialty: 'field-ward', bond: 32 }));
 expect(lastEvent(state, 'guard-beast-block')?.payload).toEqual(expect.objectContaining({ id: 31, specialty: 'field-ward', specialtyUnlocked: 'field-ward' }));
 });

it('引雷阵会把妖兽优先引向覆盖的成熟灵草，形成诱饵田', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorRecoveryPerDay: 0 }));
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };

injectMature(state, reg, tileAt(state, 0, 0)!.id, 'herb.mossling');
 injectMature(state, reg, tileAt(state, 4, 4)!.id, 'herb.metalpine');

const rod = placeArray(state, 'array.lightning-rod', 4, 4, ctx, { free: true });
 expect(rod.placed).toBe(true);

tickBeasts(state, ctx);

expect(state.crops.has(tileAt(state, 4, 4)!.id)).toBe(false);
 expect(state.crops.has(tileAt(state, 0, 0)!.id)).toBe(true);
 });

it('绝缘阵会让妖兽绕开被护住的成熟灵草，优先啃食未布防地块', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorRecoveryPerDay: 0 }));
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };

injectMature(state, reg, tileAt(state, 0, 0)!.id, 'herb.mossling');
 injectMature(state, reg, tileAt(state, 4, 4)!.id, 'herb.dewroot');

const insulation = placeArray(state, 'array.insulation', 0, 0, ctx, { free: true });
 expect(insulation.placed).toBe(true);

tickBeasts(state, ctx);

expect(state.crops.has(tileAt(state, 0, 0)!.id)).toBe(true);
 expect(state.crops.has(tileAt(state, 4, 4)!.id)).toBe(false);
 });

it('当田里只剩绝缘阵护住的成熟灵草且没有引雷诱饵田时，妖兽会被直接驱离', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorRecoveryPerDay: 0 }));
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };

const protectedTileIdA = tileAt(state, 0, 0)!.id;
 const protectedTileIdB = tileAt(state, 1, 0)!.id;
 injectMature(state, reg, protectedTileIdA, 'herb.mossling');
 injectMature(state, reg, protectedTileIdB, 'herb.dewroot');

expect(placeArray(state, 'array.insulation', 0, 0, ctx, { free: true }).placed).toBe(true);

tickBeasts(state, ctx);

expect(state.beastSurge).toBeNull;
 expect(state.crops.has(protectedTileIdA)).toBe(true);
 expect(state.crops.has(protectedTileIdB)).toBe(true);
 expect(countEvents(state, 'beast-eat-crop')).toBe(0);
 expect(lastEvent(state, 'beast-surge-repelled')?.payload).toEqual(expect.objectContaining({
 beastsRemaining: 2,
 insulatedTileIds: [protectedTileIdA, protectedTileIdB],
 insulationArrayCount: 1,
 }));
 expect(lastEvent(state, 'beast-surge-end')?.payload).toEqual(expect.objectContaining({ beastsRemaining: 2, repelled: true }));
 });

it('巡守兽会优先保住绝缘阵覆盖的成熟灵草，再放弃外围地块', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 5, vigor: 1, maxVigor: 3, bond: 0, specialty: null });
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };

const protectedTileId = tileAt(state, 0, 0)!.id;
 const baitTileId = tileAt(state, 4, 4)!.id;
 injectMature(state, reg, protectedTileId, 'herb.dewroot');
 injectMature(state, reg, baitTileId, 'herb.metalpine');

const insulation = placeArray(state, 'array.insulation', 0, 0, ctx, { free: true });
 expect(insulation.placed).toBe(true);
 const rod = placeArray(state, 'array.lightning-rod', 4, 4, ctx, { free: true });
 expect(rod.placed).toBe(true);

tickBeasts(state, ctx);

expect(state.crops.has(protectedTileId)).toBe(true);
 expect(state.crops.has(baitTileId)).toBe(false);
 expect(countEvents(state, 'guard-beast-block')).toBe(1);
 const patrol = lastEvent(state, 'guard-beast-patrol');
 expect(patrol?.payload).toEqual(expect.objectContaining({ blocked: 1, eaten: 1, protectedTileIds: [protectedTileId] }));
 });

it('无绝缘阵时巡守兽会优先保普通田，让引雷诱饵田继续承担引兽风险', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 6, vigor: 1, maxVigor: 3, bond: 0, specialty: null });
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };

const plainTileId = tileAt(state, 0, 0)!.id;
 const baitTileId = tileAt(state, 4, 4)!.id;
 injectMature(state, reg, plainTileId, 'herb.dewroot');
 injectMature(state, reg, baitTileId, 'herb.metalpine');

const rod = placeArray(state, 'array.lightning-rod', 4, 4, ctx, { free: true });
 expect(rod.placed).toBe(true);

tickBeasts(state, ctx);

expect(state.crops.has(baitTileId)).toBe(false);
 expect(state.crops.has(plainTileId)).toBe(true);
 const patrol = lastEvent(state, 'guard-beast-patrol');
 expect(patrol?.payload).toEqual(expect.objectContaining({ protectedTileIds: [plainTileId] }));
 });

it('守田兽哨可把巡守兽指派到指定地块，并让该地块在妖兽潮中优先受护', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 12, vigor: 1, maxVigor: 3, bond: 0, specialty: null });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };

const patrolTileId = tileAt(state, 4, 4)!.id;
 const exposedTileId = tileAt(state, 0, 0)!.id;
 injectMature(state, reg, patrolTileId, 'herb.metalpine');
 injectMature(state, reg, exposedTileId, 'herb.dewroot');

applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 12, tileId: patrolTileId }, ctx);
 tickBeasts(state, ctx);

expect(state.guardBeastPatrols).toEqual([{ beastId: 12, tileId: patrolTileId, assignedDay: state.day }]);
 expect(state.crops.has(patrolTileId)).toBe(true);
 expect(state.crops.has(exposedTileId)).toBe(false);
 expect(lastEvent(state, 'guard-beast-patrol-assigned')?.payload).toEqual(expect.objectContaining({ beastId: 12, tileId: patrolTileId }));
 expect(lastEvent(state, 'guard-beast-patrol')?.payload).toEqual(expect.objectContaining({ protectedTileIds: [patrolTileId] }));
 });

it('守田专长会让巡逻地块在同优先级竞争中压过普通护田目标', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0 }));
 state.guardBeasts.push({ id: 15, vigor: 1, maxVigor: 3, bond: 40, specialty: 'field-ward' });
 state.player.inventory['item.guard-beast-whistle'] = { itemId: 'item.guard-beast-whistle', count: 1 };
 state.beastSurge = { beastsRemaining: 2, daysLeft: 2 };

const insulationTileId = tileAt(state, 0, 0)!.id;
 const patrolTileId = tileAt(state, 4, 4)!.id;
 injectMature(state, reg, insulationTileId, 'herb.dewroot');
 injectMature(state, reg, patrolTileId, 'herb.metalpine');

const insulation = placeArray(state, 'array.insulation', 0, 0, ctx, { free: true });
 const rod = placeArray(state, 'array.lightning-rod', 4, 4, ctx, { free: true });
 expect(insulation.placed).toBe(true);
 expect(rod.placed).toBe(true);

applyAction(state, { kind: 'assign-guard-beast-patrol', beastId: 15, tileId: patrolTileId }, ctx);
 tickBeasts(state, ctx);

expect(state.crops.has(patrolTileId)).toBe(true);
 expect(state.crops.has(insulationTileId)).toBe(false);
 expect(lastEvent(state, 'guard-beast-patrol')?.payload).toEqual(expect.objectContaining({ protectedTileIds: [patrolTileId] }));
 });
});

describe('巡守兽专长精通 ', () => {
 const mkBeast = (bond: number, specialty: GuardBeast['specialty']): GuardBeast => ({
 id: 1, vigor: 3, maxVigor: 3, bond, specialty,
 });

it('guardBeastMasteryReady 仅在已固化专长且羁绊≥80 时为真', () => {
 expect(guardBeastMasteryReady(mkBeast(85, 'field-ward'))).toBe(true);
 expect(guardBeastMasteryReady(mkBeast(80, 'array-warden'))).toBe(true);
 expect(guardBeastMasteryReady(mkBeast(100, 'courier'))).toBe(true);
 expect(guardBeastMasteryReady(mkBeast(85, null))).toBe(false);
 expect(guardBeastMasteryReady(mkBeast(79, 'field-ward'))).toBe(false);
 });

it('已固化专长的巡守兽在拦截中羁绊跨越精通阈值时，发出专长精通解锁事件', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0, guardBondGainPerBlock: 4, guardBondMax: 100 }));
 state.guardBeasts.push({ id: 77, vigor: 2, maxVigor: 3, bond: 78, specialty: 'field-ward' });
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 injectMature(state, reg, 0);

tickBeasts(state, ctx);

expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 77, bond: 82, specialty: 'field-ward' }));
 expect(countEvents(state, 'guard-beast-mastery-unlocked')).toBe(1);
 expect(lastEvent(state, 'guard-beast-mastery-unlocked')?.payload).toEqual(expect.objectContaining({ id: 77, specialty: 'field-ward', bond: 82 }));
 });

it('先靠投喂涨满羁绊、再首次拦截固化专长时，固化当下补发精通解锁事件', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0, guardBondGainPerBlock: 4, guardBondMax: 100 }));
 state.guardBeasts.push({ id: 78, vigor: 2, maxVigor: 3, bond: 78, specialty: null });
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 injectMature(state, reg, 0);

tickBeasts(state, ctx);

// 首次拦截：羁绊 78→82 跨越 80，同时首次固化 field-ward → 固化时补发精通事件。
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ id: 78, bond: 82, specialty: 'field-ward' }));
 expect(countEvents(state, 'guard-beast-specialty-unlocked')).toBe(1);
 expect(countEvents(state, 'guard-beast-mastery-unlocked')).toBe(1);
 });

it('羁绊未达精通阈值时固化的专长不触发精通解锁', () => {
 const { state, ctx, reg } = setup(7, beastParams({ guardVigorCostPerBlock: 1, guardVigorRecoveryPerDay: 0, guardBondGainPerBlock: 4, guardBondMax: 100 }));
 state.guardBeasts.push({ id: 79, vigor: 2, maxVigor: 3, bond: 28, specialty: null });
 state.beastSurge = { beastsRemaining: 1, daysLeft: 2 };
 injectMature(state, reg, 0);

tickBeasts(state, ctx);

// bond 28→32 固化 field-ward，但远未到 80 → 无精通事件。
 expect(state.guardBeasts[0]).toEqual(expect.objectContaining({ bond: 32, specialty: 'field-ward' }));
 expect(countEvents(state, 'guard-beast-specialty-unlocked')).toBe(1);
 expect(countEvents(state, 'guard-beast-mastery-unlocked')).toBe(0);
 });

it('专长精通层巡守兽日终精力恢复更快', () => {
 const { state, ctx } = setup(7, beastParams({ guardVigorRecoveryPerDay: 1, guardVigorMax: 5 }));
 state.guardBeasts.push({ id: 1, vigor: 0, maxVigor: 5, bond: 85, specialty: 'field-ward' });
 state.guardBeasts.push({ id: 2, vigor: 0, maxVigor: 5, bond: 40, specialty: 'field-ward' });

tickBeasts(state, ctx); // 无妖兽潮 → 仅日终精力恢复

expect(state.guardBeasts[0]!.vigor).toBe(2); // 精通层：1（基础）+ 1（精通加成）
 expect(state.guardBeasts[1]!.vigor).toBe(1); // 普通层：1（基础）
 });
});
