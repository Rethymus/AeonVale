import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, storageItemCount, storageQualityItemCount } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { transferInventoryItem } from '@sim/inventory/transfers';
import { itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

function setup(seed = 72) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('产品级背包转移闭环', () => {
  it('从背包移动普通槽位到仓库时不会消耗同 itemId 的品质批次', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 4);
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 2);

    const result = transferInventoryItem(state, ctx, {
      from: 'player',
      to: 'storage',
      itemId: 'herb.mossling',
      count: 3
    });

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(3);
    expect(state.player.inventory['herb.mossling']?.count).toBe(1);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(2);
    expect(storageItemCount(state.storage, 'herb.mossling')).toBe(3);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(0);
  });

  it('支持仓库与出货箱之间按品质批次双向拖拽转移', () => {
    const { state, ctx } = setup();
    state.storage.qualityInventory.spirit = { 'herb.mossling': 3 };

    const shipped = transferInventoryItem(state, ctx, {
      from: 'storage',
      to: 'shipping',
      itemId: 'herb.mossling',
      quality: 'spirit',
      count: 2
    });
    expect(shipped.ok).toBe(true);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(1);
    expect(state.qualityShippingBin.spirit?.['herb.mossling']).toBe(2);
    expect(state.events.some(e => e.type === 'ship-quality-item')).toBe(true);

    const unshipped = transferInventoryItem(state, ctx, {
      from: 'shipping',
      to: 'storage',
      itemId: 'herb.mossling',
      quality: 'spirit',
      count: 1
    });

    expect(unshipped.ok).toBe(true);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(2);
    expect(state.qualityShippingBin.spirit?.['herb.mossling']).toBe(1);
    expect(state.events.some(e => e.type === 'unship-quality-item')).toBe(true);
  });

  it('拒绝把不可出货物移入出货箱且状态不变', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 5);

    const result = transferInventoryItem(state, ctx, {
      from: 'player',
      to: 'shipping',
      itemId: 'item.spirit-stone',
      count: 1
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('不可出货');
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(5);
    expect(state.shippingBin['item.spirit-stone']).toBeUndefined();
  });

  it('目标行囊已有半满堆叠时只移动可容纳数量并保留来源剩余', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.spirit-stone', 49);
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 3 };

    const result = transferInventoryItem(state, ctx, {
      from: 'storage',
      to: 'player',
      itemId: 'item.spirit-stone',
      count: 3
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(storageItemCount(state.storage, 'item.spirit-stone')).toBe(2);
    expect(state.events.at(-1)).toMatchObject({ type: 'inventory-transfer', payload: { count: 1 } });
  });

  it('目标行囊已有满堆叠时拒绝移动且两边状态不变', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.spirit-stone', 50);
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 3 };

    const result = transferInventoryItem(state, ctx, {
      from: 'storage',
      to: 'player',
      itemId: 'item.spirit-stone',
      count: 3
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(storageItemCount(state.storage, 'item.spirit-stone')).toBe(3);
    expect(state.events.some(e => e.type === 'inventory-transfer')).toBe(false);
  });

  it('目标仓库已有半满堆叠时只补齐上限，不会超堆叠', () => {
    const { state, ctx } = setup();
    state.storage.capacity = 1;
    state.storage.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 4 };
    mutateItem(state.player, 'item.beast-core', 3);

    const result = transferInventoryItem(state, ctx, {
      from: 'player',
      to: 'storage',
      itemId: 'item.beast-core',
      count: 3
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(storageItemCount(state.storage, 'item.beast-core')).toBe(5);
    expect(itemCount(state.player, 'item.beast-core')).toBe(2);
  });

  it('目标仓库已有满堆叠时拒绝移动且不吞物', () => {
    const { state, ctx } = setup();
    state.storage.capacity = 1;
    state.storage.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 5 };
    mutateItem(state.player, 'item.beast-core', 3);

    const result = transferInventoryItem(state, ctx, {
      from: 'player',
      to: 'storage',
      itemId: 'item.beast-core',
      count: 1
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(storageItemCount(state.storage, 'item.beast-core')).toBe(5);
    expect(itemCount(state.player, 'item.beast-core')).toBe(3);
  });

  it('品质批次转移同样只填满目标堆叠空间', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 29);
    state.storage.qualityInventory.spirit = { 'herb.mossling': 3 };

    const result = transferInventoryItem(state, ctx, {
      from: 'storage',
      to: 'player',
      itemId: 'herb.mossling',
      quality: 'spirit',
      count: 3
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(30);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(2);
  });

  it('品质批次目标满堆叠时拒绝移动且不改状态', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 30);
    state.storage.qualityInventory.spirit = { 'herb.mossling': 3 };

    const result = transferInventoryItem(state, ctx, {
      from: 'storage',
      to: 'player',
      itemId: 'herb.mossling',
      quality: 'spirit',
      count: 1
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(30);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(3);
  });

  it('出货箱撤回到行囊时也遵守普通物品堆叠空间', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.beast-core', 4);
    state.shippingBin['item.beast-core'] = 3;

    const result = transferInventoryItem(state, ctx, {
      from: 'shipping',
      to: 'player',
      itemId: 'item.beast-core',
      count: 3
    });

    expect(result.ok).toBe(true);
    expect(result.count).toBe(1);
    expect(itemCount(state.player, 'item.beast-core')).toBe(5);
    expect(state.shippingBin['item.beast-core']).toBe(2);
  });

  it('出货箱撤回品质批次到满行囊堆叠时失败且不吞物', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 30);
    state.qualityShippingBin.spirit = { 'herb.mossling': 1 };

    const result = transferInventoryItem(state, ctx, {
      from: 'shipping',
      to: 'player',
      itemId: 'herb.mossling',
      quality: 'spirit',
      count: 1
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('堆叠已满');
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(30);
    expect(state.qualityShippingBin.spirit?.['herb.mossling']).toBe(1);
  });

  it('动作系统可移动物品并通过存档往返保留容器数量', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'seed.mossling', 5);

    applyAction(state, { kind: 'move-item', from: 'player', to: 'storage', itemId: 'seed.mossling', count: 4 }, ctx);

    expect(itemCount(state.player, 'seed.mossling')).toBe(1);
    expect(storageItemCount(state.storage, 'seed.mossling')).toBe(4);
    expect(state.events.some(e => e.type === 'inventory-transfer')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('旧仓储动作系统同样遵守目标堆叠上限', () => {
    const { state, ctx } = setup();
    state.storage.capacity = 1;
    state.storage.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 5 };
    mutateItem(state.player, 'item.beast-core', 1);

    applyAction(state, { kind: 'deposit-item', itemId: 'item.beast-core', count: 1 }, ctx);

    expect(storageItemCount(state.storage, 'item.beast-core')).toBe(5);
    expect(itemCount(state.player, 'item.beast-core')).toBe(1);
    expect(state.events.some(e => e.type === 'storage-deposit')).toBe(false);
  });

  it('旧仓储普通动作不会把品质批次降级成普通库存', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 1);

    applyAction(state, { kind: 'deposit-item', itemId: 'herb.mossling', count: 1 }, ctx);

    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(1);
    expect(storageItemCount(state.storage, 'herb.mossling')).toBe(0);
    expect(state.events.some(e => e.type === 'storage-deposit')).toBe(false);
  });

  it('动作系统可按品质丢弃到场景掉落物并通过存档往返保留', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 2);

    applyAction(state, { kind: 'drop-item', itemId: 'herb.dewroot', quality: 'treasure', count: 1 }, ctx);

    expect(qualityItemCount(state.player, 'herb.dewroot', 'treasure')).toBe(1);
    expect(state.groundItems).toHaveLength(1);
    expect(state.groundItems[0]).toMatchObject({
      itemId: 'herb.dewroot',
      quality: 'treasure',
      count: 1,
      pos: state.player.position
    });
    expect(state.events.some(e => e.type === 'inventory-drop')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });
});
