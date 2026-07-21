import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, settleShipping, shippingLines, shippingUnitPrice } from '@sim';
import { buildRegistry } from '@content/registry';
import { deserializeState, serializeState } from '@sim/serialize';
import { inventoryUsed, itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

function setup(seed = 31) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('品质库存与品质出货', () => {
  it('品质库存计入物品总数与背包槽位，并能被普通消耗接口使用', () => {
    const { state } = setup();
    expect(mutateQualityItem(state.player, 'herb.mossling', 'spirit', 2)).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(2);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(2);
    expect(inventoryUsed(state.player)).toBe(1);

    expect(mutateItem(state.player, 'herb.mossling', -1)).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(1);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(1);
  });

  it('普通消耗优先扣普通库存，不够时再扣品质批次', () => {
    const { state } = setup();
    mutateItem(state.player, 'herb.mossling', 1);
    mutateQualityItem(state.player, 'herb.mossling', 'mortal', 1);
    mutateQualityItem(state.player, 'herb.mossling', 'treasure', 1);

    expect(mutateItem(state.player, 'herb.mossling', -2)).toBe(true);
    expect(state.player.inventory['herb.mossling']).toBeUndefined();
    expect(qualityItemCount(state.player, 'herb.mossling', 'mortal')).toBe(0);
    expect(qualityItemCount(state.player, 'herb.mossling', 'treasure')).toBe(1);
  });

  it('品质灵草可单独出货，并按品质倍率结算灵石', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.metalpine', 'spirit', 2);
    expect(shippingUnitPrice(ctx, 'herb.metalpine')).toBe(7);
    expect(shippingUnitPrice(ctx, 'herb.metalpine', 'spirit', state)).toBe(11);
    expect(shippingUnitPrice(ctx, 'herb.metalpine', 'treasure', state)).toBe(14);

    applyAction(state, { kind: 'ship-quality-item', itemId: 'herb.metalpine', quality: 'spirit', count: 2 }, ctx);

    expect(qualityItemCount(state.player, 'herb.metalpine', 'spirit')).toBe(0);
    expect(state.qualityShippingBin.spirit?.['herb.metalpine']).toBe(2);
    expect(shippingLines(state, ctx)).toContainEqual({
      itemId: 'herb.metalpine',
      quality: 'spirit',
      count: 2,
      unitPrice: 11,
      total: 22
    });

    const settled = settleShipping(state, ctx);
    expect(settled.ok).toBe(true);
    expect(settled.total).toBe(22);
    expect(state.qualityShippingBin).toEqual({});
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(22);
  });

  it('数量不足或不可出货时不改变品质库存', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'treasure', 1);

    applyAction(state, { kind: 'ship-quality-item', itemId: 'herb.mossling', quality: 'treasure', count: 2 }, ctx);
    expect(qualityItemCount(state.player, 'herb.mossling', 'treasure')).toBe(1);
    expect(state.qualityShippingBin.treasure?.['herb.mossling']).toBeUndefined();

    mutateQualityItem(state.player, 'item.spirit-stone', 'treasure', 1);
    applyAction(state, { kind: 'ship-quality-item', itemId: 'item.spirit-stone', quality: 'treasure', count: 1 }, ctx);
    expect(qualityItemCount(state.player, 'item.spirit-stone', 'treasure')).toBe(1);
  });

  it('品质库存失败路径不会留下空品质批次', () => {
    const { state } = setup();

    expect(mutateQualityItem(state.player, 'herb.mossling', 'spirit', -1)).toBe(false);
    expect(state.player.qualityInventory.spirit).toBeUndefined();

    state.player.inventoryCapacity = 0;
    expect(mutateQualityItem(state.player, 'herb.mossling', 'spirit', 1)).toBe(false);
    expect(state.player.qualityInventory.spirit).toBeUndefined();
  });

  it('序列化往返保留品质库存与品质出货箱', () => {
    const { state } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'treasure', 3);
    state.qualityShippingBin.spirit = { 'herb.dewroot': 2 };

    const restored = deserializeState(serializeState(state));

    expect(qualityItemCount(restored.player, 'herb.mossling', 'treasure')).toBe(3);
    expect(restored.qualityShippingBin.spirit?.['herb.dewroot']).toBe(2);
  });
});
