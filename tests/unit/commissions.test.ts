/**
  * 公告板委托：Stardew 式日常请求，把产物、奖励与 NPC 好感连接起来。
 */
import { describe, expect, it } from 'vitest';
import { acceptSpecialOrder, advanceSpecialOrdersDay, applyAction, claimSpecialOrder, commissionFlag, completeCommission, createSimContext, createWorld, DEFAULT_BALANCE, getActiveSpecialOrders, getAvailableCommissions, getDailyCommission, getDailySpecialOrder, getRelationship, getShopItems, hasRelationshipPerk, specialOrderCompleteFlag, submitSpecialOrderItems, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(stage = 0, seed = 1): { state: GameState; ctx: SimContext } {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = stage as GameState['player']['stage'];
 return { state, ctx };
}

describe('公告板委托', () => {
 it('按阶段过滤委托，并按日期确定性轮转今日委托', () => {
 const { state } = setup(0);
 expect(getAvailableCommissions(state).map((c) => c.id)).toEqual(['commission.dewroot-tonic', 'commission.mossling-salve']);
 expect(getDailyCommission(state)?.id).toBe('commission.dewroot-tonic');
 state.day = 2;
 expect(getDailyCommission(state)?.id).toBe('commission.mossling-salve');
 state.player.stage = 2;
 expect(getAvailableCommissions(state).map((c) => c.id)).toContain('commission.recipe-fragment-copy');
 });

it('留世后解锁镇守人间委托，未留世时不会混入普通日轮转', () => {
 const { state } = setup(7);
 expect(getAvailableCommissions(state).map((c) => c.id)).not.toContain('commission.human-ward-patrol');
 expect(getAvailableCommissions(state).map((c) => c.id)).not.toContain('commission.mortal-array-upkeep');

state.postAscension.mode = 'stayed-in-world';
 expect(getAvailableCommissions(state).map((c) => c.id)).toContain('commission.human-ward-patrol');
 expect(getAvailableCommissions(state).map((c) => c.id)).toContain('commission.mortal-array-upkeep');

state.day = 6;
 expect(getDailyCommission(state)?.id).toBe('commission.human-ward-patrol');
 state.day = 7;
 expect(getDailyCommission(state)?.id).toBe('commission.mortal-array-upkeep');
 });

it('留世后的镇守委托可以正常完成并持久化', () => {
 const { state, ctx } = setup(7);
 state.postAscension.mode = 'stayed-in-world';
 state.day = 6;
 mutateItem(state.player, 'item.beast-core', 2);

const commission = getDailyCommission(state)!;
 expect(commission.id).toBe('commission.human-ward-patrol');

const r = completeCommission(state, commission.id, ctx);

expect(r.ok).toBe(true);
 expect(itemCount(state.player, 'item.beast-core')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(16);
 expect(state.flags.has(commissionFlag(state.day, commission.id))).toBe(true);
 expect(roundTripEqual(state)).toBe(true);
 });

it('完成委托会消耗请求物、奖励灵石、增加委托人好感并写入日标记', () => {
 const { state, ctx } = setup(0);
 mutateItem(state.player, 'herb.dewroot', 2);
 const commission = getDailyCommission(state)!;
 const r = completeCommission(state, commission.id, ctx);
 expect(r.ok).toBe(true);
 expect(itemCount(state.player, 'herb.dewroot')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
 expect(getRelationship(state, commission.npcId).affection).toBe(45);
 expect(state.flags.has(commissionFlag(state.day, commission.id))).toBe(true);
 const event = state.events.find((e) => e.type === 'commission-complete')!;
 expect(event.payload).toMatchObject({ relationshipEvent: null });
 });

it('委托好感达标时自动触发一次性关系事件并解锁对应玩法', () => {
 const { state, ctx } = setup(0);
 getRelationship(state, 'npc.herb-gatherer').affection = 130;
 mutateItem(state.player, 'herb.dewroot', 2);

const r = completeCommission(state, 'commission.dewroot-tonic', ctx);

expect(r.ok).toBe(true);
 expect(hasRelationshipPerk(state, 'herb-gatherer-160')).toBe(true);
 expect(getShopItems(state).find((item) => item.itemId === 'item.spirit-compost')?.price).toBe(2);
 const event = state.events.find((e) => e.type === 'commission-complete')!;
 expect(event.payload).toMatchObject({ relationshipEvent: { id: 'herb-gatherer-160', npcName: '采药女', title: '药性护骨' } });
 expect(completeCommission(state, 'commission.dewroot-tonic', ctx)).toMatchObject({ ok: false, reason: '今日已完成' });
 });

it('物品不足、过期委托、重复提交均拒绝且不变更资源', () => {
 const { state, ctx } = setup(0);
 const daily = getDailyCommission(state)!;
 const poor = completeCommission(state, daily.id, ctx);
 expect(poor.ok).toBe(false);
 expect(poor.reason).toBe('物品不足');
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);

const expired = completeCommission(state, 'commission.mossling-salve', ctx);
 expect(expired.ok).toBe(false);
 expect(expired.reason).toBe('委托已过期');

mutateItem(state.player, 'herb.dewroot', 4);
 expect(completeCommission(state, daily.id, ctx).ok).toBe(true);
 const duplicate = completeCommission(state, daily.id, ctx);
 expect(duplicate.ok).toBe(false);
 expect(duplicate.reason).toBe('今日已完成');
 expect(itemCount(state.player, 'herb.dewroot')).toBe(2);
 });

it('奖励灵石因储物戒满无法接收时回滚请求物', () => {
 const { state, ctx } = setup(0);
 state.player.inventoryCapacity = 1;
 mutateItem(state.player, 'herb.dewroot', 3);
 const commission = getDailyCommission(state)!;
 const r = completeCommission(state, commission.id, ctx);
 expect(r.ok).toBe(false);
 expect(r.reason).toBe('储物戒已满');
 expect(itemCount(state.player, 'herb.dewroot')).toBe(3);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 });

it('complete-commission 玩家动作接入动作系统，完成记录可存档往返', () => {
 const { state, ctx } = setup(0);
 mutateItem(state.player, 'herb.dewroot', 2);
 applyAction(state, { kind: 'complete-commission', commissionId: 'commission.dewroot-tonic' }, ctx);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
 expect(roundTripEqual(state)).toBe(true);
 });

it('特别订单按日期与阶段确定性轮转，可接取后转为活动状态', () => {
 const { state } = setup(0);
 expect(getDailySpecialOrder(state)?.id).toBe('special-order.herb-stockpile');

const result = acceptSpecialOrder(state, 'special-order.herb-stockpile');

expect(result.ok).toBe(true);
 expect(getActiveSpecialOrders(state).map((order) => order.id)).toEqual(['special-order.herb-stockpile']);
 expect(getDailySpecialOrder(state)).toBeNull;
 expect(state.events.at(-1)).toMatchObject({ type: 'special-order-accept', payload: { orderId: 'special-order.herb-stockpile' } });
 });

it('特别订单支持分批提交并在满额后领取奖励', () => {
 const { state } = setup(0);
 expect(acceptSpecialOrder(state, 'special-order.herb-stockpile').ok).toBe(true);
 mutateItem(state.player, 'herb.mossling', 6);
 mutateItem(state.player, 'herb.mossling', 4);

expect(submitSpecialOrderItems(state, 'special-order.herb-stockpile', 6).ok).toBe(true);
 expect(itemCount(state.player, 'herb.mossling')).toBe(4);
 expect(getActiveSpecialOrders(state)[0]?.progress).toBe(6);

expect(submitSpecialOrderItems(state, 'special-order.herb-stockpile', 8).ok).toBe(true);
 expect(itemCount(state.player, 'herb.mossling')).toBe(0);
 expect(getActiveSpecialOrders(state)[0]?.remaining).toBe(0);

const claim = claimSpecialOrder(state, 'special-order.herb-stockpile');
 expect(claim.ok).toBe(true);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(12);
 expect(state.player.bodyFoundation).toBe(500);
 expect(state.player.cultivation).toBe(500);
 expect(state.flags.has(specialOrderCompleteFlag('special-order.herb-stockpile'))).toBe(true);
 });

it('特别订单会随日终推进倒计时并在到期时过期', () => {
 const { state } = setup(0);
 expect(acceptSpecialOrder(state, 'special-order.herb-stockpile').ok).toBe(true);

for (let i = 0; i < 7; i++) advanceSpecialOrdersDay(state);

expect(getActiveSpecialOrders(state)).toEqual([]);
 expect(state.events.at(-1)).toMatchObject({ type: 'special-order-expired', payload: { orderId: 'special-order.herb-stockpile' } });
 });

it('特别订单奖励灵石因储物戒满无法接收时不清除订单', () => {
 const { state } = setup(0);
 state.player.inventoryCapacity = 1;
 expect(acceptSpecialOrder(state, 'special-order.herb-stockpile').ok).toBe(true);
 mutateItem(state.player, 'item.recipe-fragment', 1);
 state.specialOrders['special-order.herb-stockpile']!.progress = 10;

const claim = claimSpecialOrder(state, 'special-order.herb-stockpile');

expect(claim).toMatchObject({ ok: false, reason: '储物戒已满' });
 expect(getActiveSpecialOrders(state)[0]?.remaining).toBe(0);
 expect(state.flags.has(specialOrderCompleteFlag('special-order.herb-stockpile'))).toBe(false);
 });

it('特别订单动作接入动作系统，状态可存档往返', () => {
 const { state, ctx } = setup(0);
 applyAction(state, { kind: 'accept-special-order', orderId: 'special-order.herb-stockpile' }, ctx);
 mutateItem(state.player, 'herb.mossling', 10);
 applyAction(state, { kind: 'submit-special-order', orderId: 'special-order.herb-stockpile', count: 10 }, ctx);
 applyAction(state, { kind: 'claim-special-order', orderId: 'special-order.herb-stockpile' }, ctx);

expect(state.flags.has(specialOrderCompleteFlag('special-order.herb-stockpile'))).toBe(true);
 expect(roundTripEqual(state)).toBe(true);
 });
});
