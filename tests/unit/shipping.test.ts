/**
 * 出货箱经济循环：白天入箱，日终结算为灵石。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, FIRST_HARVEST_FLAG, FIRST_SHIPMENT_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG, getOnboardingObjectiveId, settleShipping, shipItem, unshipItem, unshipQualityItem, shippingUnitPrice, simulateDay } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';
import type { GameState, SimContext } from '@sim';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('出货箱经济循环', () => {
  it('按灵草阶位推导出货单价', () => {
    const { ctx } = setup();
    expect(shippingUnitPrice(ctx, 'herb.mossling')).toBe(1);
    expect(shippingUnitPrice(ctx, 'herb.metalpine')).toBe(7);
    expect(shippingUnitPrice(ctx, 'seed.metalpine')).toBe(4);
    expect(shippingUnitPrice(ctx, 'item.beast-core')).toBe(3);
    expect(shippingUnitPrice(ctx, 'item.array-core')).toBe(12);
    expect(shippingUnitPrice(ctx, 'item.spirit-stone')).toBe(0);
  });

  it('当日委托需求会抬高对应出货单价', () => {
    const { state, ctx } = setup();

    expect(shippingUnitPrice(ctx, 'herb.dewroot')).toBe(1);
    expect(shippingUnitPrice(ctx, 'herb.dewroot', undefined, state)).toBe(3);
    expect(shippingUnitPrice(ctx, 'herb.mossling', undefined, state)).toBe(3);
  });

  it('ship-item 从背包扣除并加入出货箱', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 3);
    state.player.flags.add(FIRST_HARVEST_FLAG);
    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 2 }, ctx);
    expect(itemCount(state.player, 'herb.mossling')).toBe(1);
    expect(state.shippingBin['herb.mossling']).toBe(2);
    expect(state.player.flags.has(FIRST_SHIPMENT_FLAG)).toBe(true);
    expect(state.events.some(e => e.type === 'ship-item')).toBe(true);
  });

  it('首收前出货 starter kit 草药不会跳过真实农务引导', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 1);

    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 1 }, ctx);

    expect(state.shippingBin['herb.mossling']).toBe(1);
    expect(state.player.flags.has(FIRST_SHIPMENT_FLAG)).toBe(false);
    expect(getOnboardingObjectiveId(state)).toBe('first-till');
  });

  it('不可出货物品与数量不足不会改变状态', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 5);
    applyAction(state, { kind: 'ship-item', itemId: 'item.spirit-stone', count: 1 }, ctx);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(5);
    expect(state.shippingBin['item.spirit-stone']).toBeUndefined();

    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 1 }, ctx);
    expect(state.shippingBin['herb.mossling']).toBeUndefined();
  });

  it('普通出货不会把品质批次降级消耗', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 1);

    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 1 }, ctx);
    const direct = shipItem(state, 'herb.mossling', 1, ctx);

    expect(direct.ok).toBe(false);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(1);
    expect(state.shippingBin['herb.mossling']).toBeUndefined();
    expect(state.events.some(e => e.type === 'ship-item')).toBe(false);
  });

  it('日终结算清空出货箱并发放灵石', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.dewroot', 2);
    mutateItem(state.player, 'item.beast-core', 1);
    applyAction(state, { kind: 'ship-item', itemId: 'herb.dewroot', count: 2 }, ctx);
    applyAction(state, { kind: 'ship-item', itemId: 'item.beast-core', count: 1 }, ctx);

    const result = settleShipping(state, ctx);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(9);
    expect(state.shippingBin).toEqual({});
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(9);
    expect(state.player.flags.has(FIRST_SHIPPING_SETTLEMENT_FLAG)).toBe(true);
    expect(state.events.some(e => e.type === 'shipping-settlement')).toBe(true);
  });

  it('出货结算事件会携带热需来源，供 UI 摘要直接展示', () => {
    const { state, ctx } = setup();
    state.player.stage = 1;
    mutateItem(state.player, 'herb.dewroot', 1);
    applyAction(state, { kind: 'ship-item', itemId: 'herb.dewroot', count: 1 }, ctx);

    settleShipping(state, ctx);
    const settlement = state.events.find(e => e.type === 'shipping-settlement');
    const lines = (settlement?.payload as { lines?: Array<{ itemId?: string; demand?: { source?: string; priceBonus?: number } }> } | undefined)?.lines ?? [];

    expect(lines).toContainEqual(
      expect.objectContaining({
        itemId: 'herb.dewroot',
        demand: expect.objectContaining({ source: 'commission', priceBonus: 2 })
      })
    );
  });

  it('simulateDay 在日终自动结算出货箱', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 1);
    simulateDay(state, { actions: [{ kind: 'ship-item', itemId: 'herb.mossling', count: 1 }] }, ctx);
    expect(state.shippingBin).toEqual({});
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
  });

  it('背包无空位且没有灵石槽时保留出货箱并发阻塞事件', () => {
    const { state, ctx } = setup();
    const seedIds = [...ctx.content.herbs.values()].slice(0, 15).map(h => h.seedId);
    for (const sid of seedIds) mutateItem(state.player, sid, 1);
    mutateItem(state.player, 'herb.mossling', 2);
    applyAction(state, { kind: 'ship-item', itemId: 'herb.mossling', count: 1 }, ctx);
    expect(Object.keys(state.player.inventory).length).toBe(16);

    const result = settleShipping(state, ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('储物戒已满');
    expect(state.shippingBin['herb.mossling']).toBe(1);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(state.events.some(e => e.type === 'shipping-blocked')).toBe(true);
  });

  it('日终结算只在灵石栈有足够空间时发放并清空出货箱', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 49);
    state.shippingBin['seed.mossling'] = 1;

    const result = settleShipping(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.total).toBe(1);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(state.shippingBin).toEqual({});
  });

  it('日终结算不会让已满灵石栈超堆叠，且保留出货箱', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.spirit-stone', 50);
    state.shippingBin['herb.mossling'] = 1;

    const result = settleShipping(state, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('灵石堆叠已满');
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(state.shippingBin['herb.mossling']).toBe(1);
    expect(state.events.some(e => e.type === 'shipping-blocked')).toBe(true);
    expect(state.events.some(e => e.type === 'shipping-settlement')).toBe(false);
  });

  it('日终大额结算超过单个新灵石栈时阻塞并保留出货箱', () => {
    const { state, ctx } = setup();
    state.shippingBin['item.array-core'] = 5;

    const result = settleShipping(state, ctx);

    expect(result.ok).toBe(false);
    expect(result.total).toBe(60);
    expect(result.reason).toBe('灵石堆叠已满');
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(state.shippingBin['item.array-core']).toBe(5);
  });

  it('direct unship 遵守普通物品目标堆叠上限', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.beast-core', 5);
    state.shippingBin['item.beast-core'] = 1;

    const result = unshipItem(state, 'item.beast-core', 1, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(itemCount(state.player, 'item.beast-core')).toBe(5);
    expect(state.shippingBin['item.beast-core']).toBe(1);
  });

  it('direct unship 遵守品质批次目标堆叠上限', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 30);
    state.qualityShippingBin.spirit = { 'herb.mossling': 1 };

    const result = unshipQualityItem(state, 'herb.mossling', 'spirit', 1, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(30);
    expect(state.qualityShippingBin.spirit?.['herb.mossling']).toBe(1);
  });
});
