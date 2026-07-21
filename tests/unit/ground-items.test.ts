import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyAction, placeGroundItem, groundItemAtIndex } from '@sim';
import { serializeState, deserializeState, stateHash } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { itemCount, qualityItemCount } from '@sim/world/player';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('场景拾取 ground items', () => {
  it('放置后走至该格拾取 → 入背包且地面清空', () => {
    const { state, ctx } = setup();
    const pos = { ...state.player.position };
    placeGroundItem(state, { itemId: 'item.spirit-stone', count: 3, pos });
    expect(state.groundItems).toHaveLength(1);
    expect(groundItemAtIndex(state, pos)?.itemId).toBe('item.spirit-stone');

    const before = itemCount(state.player, 'item.spirit-stone');
    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    expect(itemCount(state.player, 'item.spirit-stone')).toBe(before + 3);
    expect(state.groundItems).toHaveLength(0);
    expect(state.events.some(e => e.type === 'pickup')).toBe(true);
  });

  it('背包满时拾取被阻：物品留在原地、背包不变、发 pickup-blocked', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    // 占满唯一槽位（与地面物不同 id，确保新槽位无法开辟）
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };
    const pos = { ...state.player.position };
    placeGroundItem(state, { itemId: 'item.beast-core', count: 2, pos });
    expect(state.groundItems).toHaveLength(1);

    const beforeBeast = itemCount(state.player, 'item.beast-core');
    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    // 仍在地面
    expect(state.groundItems).toHaveLength(1);
    expect(groundItemAtIndex(state, pos)?.itemId).toBe('item.beast-core');
    // 背包不变
    expect(itemCount(state.player, 'item.beast-core')).toBe(beforeBeast);
    expect(state.events.some(e => e.type === 'pickup-blocked')).toBe(true);
    expect(state.events.some(e => e.type === 'pickup')).toBe(false);
  });

  it('满包但同物品未满栈时只拾取可堆叠数量，剩余留在地面', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 49 };
    const pos = { ...state.player.position };
    placeGroundItem(state, { itemId: 'item.spirit-stone', count: 3, pos });

    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(state.groundItems).toHaveLength(1);
    expect(groundItemAtIndex(state, pos)?.count).toBe(2);
    expect(state.events.some(e => e.type === 'pickup')).toBe(true);
    expect(state.events.some(e => e.type === 'pickup-blocked')).toBe(false);
  });

  it('满包且同物品已满栈时拾取被阻，地面数量不变', () => {
    const { state, ctx } = setup();
    state.player.inventoryCapacity = 1;
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 50 };
    const pos = { ...state.player.position };
    placeGroundItem(state, { itemId: 'item.spirit-stone', count: 3, pos });

    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    expect(itemCount(state.player, 'item.spirit-stone')).toBe(50);
    expect(state.groundItems).toHaveLength(1);
    expect(groundItemAtIndex(state, pos)?.count).toBe(3);
    expect(state.events.some(e => e.type === 'pickup-blocked')).toBe(true);
    expect(state.events.some(e => e.type === 'pickup')).toBe(false);
  });

  it('带品质的地面物品拾取进入品质批次', () => {
    const { state, ctx } = setup();
    const pos = { ...state.player.position };
    placeGroundItem(state, { itemId: 'herb.mossling', count: 2, pos, quality: 'spirit' });

    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(2);
    expect(state.groundItems).toHaveLength(0);
    expect(state.events.some(e => e.type === 'pickup')).toBe(true);
  });

  it('脚下无物时拾取为空操作（无事件）', () => {
    const { state, ctx } = setup();
    applyAction(state, { kind: 'pickup-ground-item' }, ctx);

    expect(state.groundItems).toHaveLength(0);
    expect(state.events.some(e => e.type === 'pickup')).toBe(false);
    expect(state.events.some(e => e.type === 'pickup-blocked')).toBe(false);
  });

  it('序列化往返：空世界不写键、放置后往返一致（向后兼容）', () => {
    const { state } = setup();
    // 空世界：不序列化 groundItems 键，保持旧档 stateHash 逐字节稳定
    const emptySerialized = serializeState(state) as Record<string, unknown>;
    expect(emptySerialized).not.toHaveProperty('groundItems');
    // 旧档（无 groundItems 键）反序列化为空数组
    const legacy = deserializeState({ ...emptySerialized });
    expect(legacy.groundItems).toEqual([]);

    // 放置后：键出现且哈希往返一致
    placeGroundItem(state, { itemId: 'item.spirit-stone', count: 2, pos: { ...state.player.position } });
    const restored = deserializeState(serializeState(state));
    expect(restored.groundItems).toHaveLength(1);
    expect(restored.groundItems[0]?.itemId).toBe('item.spirit-stone');
    expect(restored.groundItems[0]?.count).toBe(2);
    expect(stateHash(state)).toBe(stateHash(restored));
  });
});
