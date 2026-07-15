import { describe, it, expect } from 'vitest';
import { applyAction, buyFestivalStallItem, createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, getFestivalStallItems, participateFestival, Rng, selectCelestialEvent, tickCelestial, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { stateHash, deserializeState, serializeState } from '@sim/serialize';
import type { CelestialEventDef } from '@content/defs';
import { itemCount, mutateItem } from '@sim/world/player';

const NO_FESTIVAL: BalanceParams = {
 ...DEFAULT_BALANCE,
 celestial: { ...DEFAULT_BALANCE.celestial, festivals: { enabled: false } },
};

function setup(seed = 1, params: BalanceParams = DEFAULT_BALANCE) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params });
 const ctx = createSimContext(seed, reg, params);
 return { state, ctx, reg };
}

function event(id: string, weight: number): CelestialEventDef {
 return { id, displayName: id, type: 'joy', weight, durationDays: 1, growthMod: 1, qiMod: 1, desc: '' };
}

describe('天象奇遇引擎 ', () => {
 it('纯权重抽样忽略零权重，并对相同 RNG 状态保持确定性', () => {
 const defs = [event('zero', 0), event('left', 1), event('right', 3)];
 const run = () => {
 const rng = new Rng(17);
 return Array.from({ length: 50 }, () => selectCelestialEvent(defs, [], rng)?.id);
 };
 expect(run).toEqual(run);
 expect(run).not.toContain('zero');
 expect(selectCelestialEvent([event('zero', 0)], [], new Rng(1))).toBeNull;
 });

it('近三次重复事件应用 ×0.4 权重惩罚，三次外历史不影响选择', () => {
 const defs = [event('recent', 10), event('other', 10)];
 const seed = 12;
 const base = selectCelestialEvent(defs, [], new Rng(seed))?.id;
 const recent = selectCelestialEvent(defs, ['recent'], new Rng(seed))?.id;
 const stale = selectCelestialEvent(defs, ['recent', 'x', 'y', 'z'], new Rng(seed))?.id;
 expect(base).toBe('recent');
 expect(recent).toBe('other');
 expect(stale).toBe(base);
 });

it('最近天象历史可存档往返，旧存档缺字段时回退为空', () => {
 const { state } = setup();
 state.recentCelestialEventIds = ['event.qi-tide', 'event.bad-year'];
 expect(deserializeState(serializeState(state)).recentCelestialEventIds).toEqual(state.recentCelestialEventIds);

const raw = serializeState(state) as Record<string, unknown>;
 delete raw.recentCelestialEventIds;
 expect(deserializeState(raw).recentCelestialEventIds).toEqual([]);

raw.recentCelestialEventIds = 'malformed';
 expect(deserializeState(raw).recentCelestialEventIds).toEqual([]);
 });

it('长时间模拟会触发至少一次天象事件', () => {
 const { state, ctx } = setup(7);
 let triggered = false;
 for (let d = 0; d < 200; d++) {
 simulateDay(state, { actions: [] }, ctx);
 if (state.activeEvent) triggered = true;
 }
 expect(triggered).toBe(true); // gate 0.25/日，200 日几乎必然触发
 });

it('事件有持续天数，到期后自动结束', () => {
 const { state, ctx } = setup(42, NO_FESTIVAL); // 关节日，避免日历事件干扰结束观测
 let startDay = -1;
 let observedActive = 0;
 for (let d = 0; d < 300 && startDay < 0; d++) {
 simulateDay(state, { actions: [] }, ctx);
 if (state.activeEvent) {
 if (startDay < 0) startDay = state.day;
 observedActive++;
 }
 }
 // 继续跑到事件结束
 for (let d = 0; d < 30 && state.activeEvent; d++) {
 simulateDay(state, { actions: [] }, ctx);
 observedActive++;
 }
 expect(startDay).toBeGreaterThan(0);
 expect(observedActive).toBeGreaterThan(0);
 expect(state.activeEvent).toBeNull; // 最终结束
 });

it('事件类型来自定义表（喜/悲/危机/机）', () => {
 const { reg } = setup();
 const types = new Set([...reg.events.values()].map((e) => e.type));
 expect(types.has('joy')).toBe(true);
 expect(types.has('grief')).toBe(true);
 });

it('同种子同输入 → 同事件序列（确定性，stateHash 一致）', () => {
 const run = (seed: number) => {
 const { state, ctx } = setup(seed);
 for (let d = 0; d < 100; d++) simulateDay(state, { actions: [] }, ctx);
 return stateHash(state);
 };
 expect(run(99)).toBe(run(99));
 });

it('季节节日按日历强制触发（春·灵芽节）', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 14;
 tickCelestial(state, ctx);
 expect(state.activeEvent?.defId).toBe('event.spring-festival');
 expect(state.activeEvent?.growthMod).toBeGreaterThan(1); // 节日增益
 });

it('festivals.enabled=false 时节日不触发（旧 fixture / 测试兼容）', () => {
 const { state, ctx } = setup(1, NO_FESTIVAL);
 state.season = 'autumn';
 state.seasonDay = 14; // 金秋会日历日
 tickCelestial(state, ctx);
 expect(state.activeEvent?.defId).not.toBe('event.autumn-festival');
 });

it('节日与进行中天象互斥（不抢占）', () => {
 const { state, ctx } = setup();
 state.season = 'summer';
 state.seasonDay = 14; // 炎阳祭日
 state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 3, growthMod: 1.5, qiMod: 1.5 };
 tickCelestial(state, ctx);
 expect(state.activeEvent?.defId).toBe('event.qi-tide'); // 未被节日抢占
 });

it('玩家可参与季节节日并获得一次性奖励', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 14;
 tickCelestial(state, ctx);

const result = participateFestival(state, ctx);

expect(result).toMatchObject({ ok: true, eventId: 'event.spring-festival' });
 expect(itemCount(state.player, 'seed.dewroot')).toBe(2);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
 expect(state.events).toContainEqual(expect.objectContaining({ type: 'festival-participate' }));
 });

it('同一次节日不可重复参与', () => {
 const { state, ctx } = setup();
 state.season = 'autumn';
 state.seasonDay = 14;
 tickCelestial(state, ctx);

expect(participateFestival(state, ctx).ok).toBe(true);
 const stones = itemCount(state.player, 'item.spirit-stone');
 const second = participateFestival(state, ctx);

expect(second).toMatchObject({ ok: false, reason: '本次节日已参与', eventId: 'event.autumn-festival' });
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(stones);
 });

it('非节日天象不能参与节日', () => {
 const { state, ctx } = setup();
 state.activeEvent = { defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 2, growthMod: 1.5, qiMod: 1.5 };
 expect(participateFestival(state, ctx)).toMatchObject({ ok: false, reason: '当前没有可参与节日' });
 expect(state.events).not.toContainEqual(expect.objectContaining({ type: 'festival-participate' }));
 });

it('节日参与可通过 PlayerAction 分发，并结算体修向奖励', () => {
 const { state, ctx } = setup();
 state.season = 'summer';
 state.seasonDay = 14;
 state.player.stamina = 10_000;
 tickCelestial(state, ctx);

applyAction(state, { kind: 'participate-festival' }, ctx);

expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
 expect(state.player.stamina).toBe(25_000);
 expect(state.player.bodyFoundation).toBe(500);
 expect(state.player.willpower).toBe(250);
 });

it('背包满时节日物品奖励整体回滚', () => {
 const { state, ctx } = setup();
 state.season = 'spring';
 state.seasonDay = 14;
 state.player.inventoryCapacity = 1;
 mutateItem(state.player, 'item.spirit-stone', 1);
 tickCelestial(state, ctx);

const result = participateFestival(state, ctx);

expect(result).toMatchObject({ ok: false, reason: '背包已满', eventId: 'event.spring-festival' });
 expect(itemCount(state.player, 'seed.dewroot')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 });

it('节日摊位仅在当前节日开放，并按节日切换商品', () => {
 const { state, ctx } = setup();
 expect(getFestivalStallItems(state)).toEqual([]);

state.season = 'autumn';
 state.seasonDay = 14;
 tickCelestial(state, ctx);

expect(getFestivalStallItems(state).map((item) => item.itemId)).toEqual(['seed.metalpine', 'item.recipe-fragment']);
 });

it('可在节日摊位用灵石购买限购商品', () => {
 const { state, ctx } = setup();
 state.season = 'winter';
 state.seasonDay = 28;
 tickCelestial(state, ctx);
 mutateItem(state.player, 'item.spirit-stone', 5);

const result = buyFestivalStallItem(state, 'item.array-core', ctx);

expect(result).toMatchObject({ ok: true, totalPrice: 5, item: { itemId: 'item.array-core' } });
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'item.array-core')).toBe(1);
 expect(state.events).toContainEqual(expect.objectContaining({ type: 'festival-stall-buy' }));
 expect(getFestivalStallItems(state).map((item) => item.itemId)).not.toContain('item.array-core');
 });

it('节日摊位校验非节日、灵石不足与重复购买', () => {
 const { state, ctx } = setup();
 expect(buyFestivalStallItem(state, 'seed.balmleaf', ctx)).toMatchObject({ ok: false, reason: '当前没有节日摊位' });

state.season = 'spring';
 state.seasonDay = 14;
 tickCelestial(state, ctx);
 expect(buyFestivalStallItem(state, 'seed.balmleaf', ctx)).toMatchObject({ ok: false, reason: '灵石不足' });

mutateItem(state.player, 'item.spirit-stone', 6);
 expect(buyFestivalStallItem(state, 'seed.balmleaf', ctx).ok).toBe(true);
 expect(buyFestivalStallItem(state, 'seed.balmleaf', ctx)).toMatchObject({ ok: false, reason: '本次节日已购' });
 });

it('buy-festival-stall-item 玩家动作接入动作系统', () => {
 const { state, ctx } = setup();
 state.season = 'summer';
 state.seasonDay = 14;
 tickCelestial(state, ctx);
 mutateItem(state.player, 'item.spirit-stone', 4);

applyAction(state, { kind: 'buy-festival-stall-item', itemId: 'item.beast-core' }, ctx);

expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'item.beast-core')).toBe(1);
 });
});
