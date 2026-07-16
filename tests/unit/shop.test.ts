/**
  * 基础商店：出货得灵石后，稳定购买种子/工具，闭合经济循环。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, buyShopItem, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_MARKET_RESTOCK_FLAG, getShopItems, markRelationshipEventSeen } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(stage = 0, seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = stage as GameState['player']['stage'];
 return { state, ctx };
}

describe('基础商店经济闭环', () => {
 it('按阶段过滤可购买商品', () => {
 const early = getShopItems(setup(0).state).map((item) => item.itemId);
 expect(early).toContain('seed.mossling');
 expect(early).toContain('item.spirit-compost');
 expect(early).toContain('item.water-pail');
 expect(early).not.toContain('seed.metalpine');

const stage2 = getShopItems(setup(2).state).map((item) => item.itemId);
 expect(stage2).toContain('seed.metalpine');
 });

it('购买成功：扣灵石、加商品、发 shop-buy 事件', () => {
 const { state } = setup(0);
 mutateItem(state.player, 'item.spirit-stone', 3);
 const r = buyShopItem(state, 'seed.mossling', 2);
 expect(r.ok).toBe(true);
 expect(r.totalPrice).toBe(2);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
 expect(itemCount(state.player, 'seed.mossling')).toBe(2);
 expect(state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG)).toBe(true);
 expect(state.events.some((e) => e.type === 'shop-buy')).toBe(true);
 });

it('灵石不足、阶段不足、未知商品均拒绝且不变更背包', () => {
 const { state } = setup(0);
 mutateItem(state.player, 'item.spirit-stone', 2);

const poor = buyShopItem(state, 'seed.suncap', 2);
 expect(poor.ok).toBe(false);
 expect(poor.reason).toBe('灵石不足');
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(2);
 expect(itemCount(state.player, 'seed.suncap')).toBe(0);

const gated = buyShopItem(state, 'seed.metalpine', 1);
 expect(gated.ok).toBe(false);
 expect(gated.reason).toBe('阶段不足');
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(2);

const unknown = buyShopItem(state, 'item.nope', 1);
 expect(unknown.ok).toBe(false);
 expect(unknown.reason).toBe('无此商品');
 });

it('容量满时回滚灵石扣款', () => {
 const { state, ctx } = setup(0);
 const seedIds = [...ctx.content.herbs.values()].slice(0, 15).map((h) => h.seedId);
 for (const sid of seedIds) mutateItem(state.player, sid, 1);
 mutateItem(state.player, 'item.spirit-stone', 10);
 expect(Object.keys(state.player.inventory).length).toBe(16);

const r = buyShopItem(state, 'item.water-pail', 1);
 expect(r.ok).toBe(false);
 expect(r.reason).toBe('储物戒已满');
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(10);
 expect(itemCount(state.player, 'item.water-pail')).toBe(0);
 });

it('buy-shop-item 玩家动作接入动作系统', () => {
 const { state, ctx } = setup(0);
 mutateItem(state.player, 'item.spirit-stone', 1);
 applyAction(state, { kind: 'buy-shop-item', itemId: 'seed.mossling', count: 1 }, ctx);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'seed.mossling')).toBe(1);
 });

it('商店可购买灵壤肥，支持农场品质循环', () => {
 const { state } = setup(0);
 mutateItem(state.player, 'item.spirit-stone', 3);
 const r = buyShopItem(state, 'item.spirit-compost', 1);
 expect(r.ok).toBe(true);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
 expect(state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG)).toBe(false);
 });

it('采药女关系事件解锁灵壤肥折扣并影响实际购买价格', () => {
 const { state } = setup(0);
 expect(getShopItems(state).find((item) => item.itemId === 'item.spirit-compost')?.price).toBe(3);

markRelationshipEventSeen(state, 'herb-gatherer-160');
 expect(getShopItems(state).find((item) => item.itemId === 'item.spirit-compost')?.price).toBe(2);

mutateItem(state.player, 'item.spirit-stone', 2);
 const r = buyShopItem(state, 'item.spirit-compost', 1);

expect(r.ok).toBe(true);
 expect(r.totalPrice).toBe(2);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
 });

it('采药女深交（320）解锁和合叶种折扣', () => {
 const { state } = setup(1);
 expect(getShopItems(state).find((item) => item.itemId === 'seed.balmleaf')?.price).toBe(5);

markRelationshipEventSeen(state, 'herb-gatherer-320');
 expect(getShopItems(state).find((item) => item.itemId === 'seed.balmleaf')?.price).toBe(4);

mutateItem(state.player, 'item.spirit-stone', 4);
 const r = buyShopItem(state, 'seed.balmleaf', 1);
 expect(r.ok).toBe(true);
 expect(r.totalPrice).toBe(4);
 expect(itemCount(state.player, 'seed.balmleaf')).toBe(1);
 });
});
