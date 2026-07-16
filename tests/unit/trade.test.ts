/**
  * 散仙交易系统。
  * 确定性、无 RNG：阶段过滤、成功兑换、材料不足、阶段不足、容量满回滚原子性。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, getTradeOffers, executeTrade, markRelationshipEventSeen } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(stage = 1, seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = stage as GameState['player']['stage'];
 return { state, ctx };
}

describe('散仙交易', () => {
 it('getTradeOffers 按阶段过滤', () => {
 const o1 = getTradeOffers(setup(1).state);
 expect(o1.map((o) => o.id)).toContain('trade.beastcore-stone');
 expect(o1.map((o) => o.id)).toContain('trade.stone-frostmarrow');
 expect(o1.some((o) => o.stageMin > 1)).toBe(false);
 const o3 = getTradeOffers(setup(3).state);
 expect(o3.map((o) => o.id)).toContain('trade.stone-ironwill');
 });

it('executeTrade 成功：扣 give、加 receive、发 trade 事件', () => {
 const { state } = setup(1);
 mutateItem(state.player, 'item.beast-core', 2);
 state.events.length = 0;
 const r = executeTrade(state, 'trade.beastcore-stone');
 expect(r.ok).toBe(true);
 expect(state.player.inventory['item.beast-core']!.count).toBe(1);
 expect(state.player.inventory['item.spirit-stone']!.count).toBe(3);
 expect(state.events.some((e) => e.type === 'trade')).toBe(true);
 });

it('材料不足：拒绝且不扣物品', () => {
 const { state } = setup(2);
 const r = executeTrade(state, 'trade.stone-fragment');
 expect(r.ok).toBe(false);
 expect(r.reason).toBe('材料不足');
 expect(state.player.inventory['item.spirit-stone']).toBeUndefined;
 });

it('阶段不足：拒绝', () => {
 const { state } = setup(1);
 mutateItem(state.player, 'item.spirit-stone', 10);
 const r = executeTrade(state, 'trade.stone-metalpine'); // stageMin 2
 expect(r.ok).toBe(false);
 expect(r.reason).toBe('修为不足');
 expect(state.player.inventory['item.spirit-stone']!.count).toBe(10);
 });

it('容量满：回滚 give（原子性）', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 1, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1 as GameState['player']['stage'];
 const seedIds = [...reg.herbs.values()].slice(0, 15).map((h) => h.seedId);
 for (const sid of seedIds) mutateItem(state.player, sid, 1);
 mutateItem(state.player, 'item.beast-core', 2); // 第 16 格，count=2 保证扣 1 后槽位仍在
 expect(Object.keys(state.player.inventory).length).toBe(16);
 const r = executeTrade(state, 'trade.beastcore-stone');
 expect(r.ok).toBe(false);
 expect(r.reason).toBe('储物戒已满');
 expect(state.player.inventory['item.beast-core']!.count).toBe(2); // 回滚
 expect(state.player.inventory['item.spirit-stone']).toBeUndefined;
 });

it('未知交易 id：拒绝', () => {
 const { state } = setup(1);
 expect(executeTrade(state, 'trade.nope').ok).toBe(false);
 });

it('游方散修关系事件解锁熟人交易', () => {
 const { state } = setup(1);
 expect(getTradeOffers(state).map((offer) => offer.id)).not.toContain('trade.familiar-beastcore-fragment');
 expect(executeTrade(state, 'trade.familiar-beastcore-fragment')).toMatchObject({ ok: false, reason: '无此交易' });

markRelationshipEventSeen(state, 'wandering-cultivator-160');
 expect(getTradeOffers(state).map((offer) => offer.id)).toContain('trade.familiar-beastcore-fragment');

mutateItem(state.player, 'item.beast-core', 2);
 const traded = executeTrade(state, 'trade.familiar-beastcore-fragment');

expect(traded.ok).toBe(true);
 expect(itemCount(state.player, 'item.beast-core')).toBe(0);
 expect(itemCount(state.player, 'item.recipe-fragment')).toBe(1);
 });

it('游方散修深交（320）解锁故交溢价交易：封藏灵草换灵石、药酒换残卷', () => {
 const { state } = setup(3);
 // 未深交前不出现
 expect(getTradeOffers(state).map((offer) => offer.id)).not.toContain('trade.familiar-sealed-stone');
 expect(getTradeOffers(state).map((offer) => offer.id)).not.toContain('trade.familiar-wine-fragment');
 expect(executeTrade(state, 'trade.familiar-sealed-stone')).toMatchObject({ ok: false, reason: '无此交易' });

markRelationshipEventSeen(state, 'wandering-cultivator-320');
 expect(getTradeOffers(state).map((offer) => offer.id)).toContain('trade.familiar-sealed-stone');
 expect(getTradeOffers(state).map((offer) => offer.id)).toContain('trade.familiar-wine-fragment');

// 封藏灵草 → 6 灵石
 mutateItem(state.player, 'item.sealed-herb', 1);
 const r = executeTrade(state, 'trade.familiar-sealed-stone');
 expect(r.ok).toBe(true);
 expect(itemCount(state.player, 'item.sealed-herb')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(6);

// 药酒 ×2 → 1 残卷
 mutateItem(state.player, 'item.herbal-wine', 2);
 const r2 = executeTrade(state, 'trade.familiar-wine-fragment');
 expect(r2.ok).toBe(true);
 expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
 expect(itemCount(state.player, 'item.recipe-fragment')).toBe(1);
 });
});
