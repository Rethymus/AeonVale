import { describe, it, expect } from 'vitest';
import { advanceDay, courierHaulGroundItems, createWorld, createSimContext, DEFAULT_BALANCE } from '@sim';
import { nextEntityId } from '@sim/world/state';
import type { GameState, SimContext } from '@sim';
import { buildRegistry } from '@content/registry';

function setup(seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  // 关天象/妖兽 gate，隔离 courier 搬运行为（仿 golden-replay fixture 零 knob 套路）。
  const params = {
    ...DEFAULT_BALANCE,
    celestial: {
      ...DEFAULT_BALANCE.celestial,
      eventGateProbability: 0,
      beast: { ...DEFAULT_BALANCE.celestial.beast, surgeChancePerDay: 0 }
    }
  };
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params });
  const ctx = createSimContext(seed, reg, params);
  return { state, ctx };
}

function addBeast(state: GameState, vigor: number, maxVigor: number, specialty: 'courier' | 'field-ward'): number {
  const id = nextEntityId(state);
  state.guardBeasts.push({ id, vigor, maxVigor, bond: 0, specialty });
  return id;
}

function dropGround(state: GameState, itemId: string, count: number): void {
  state.groundItems.push({ id: nextEntityId(state), itemId, count, pos: { x: 1, y: 1 } });
}

describe('R3-B2 守田兽自主代理（courier 归仓）', () => {
  it('courier 专长兽日终自动拾取地面物归仓（ACS 傀儡范式，docs/20 D-28）', () => {
    const { state, ctx } = setup();
    addBeast(state, 3, 5, 'courier');
    dropGround(state, 'herb.mossling', 2);
    expect(state.groundItems).toHaveLength(1);

    advanceDay(state, ctx);

    expect(state.groundItems).toHaveLength(0);
    expect(state.storage.inventory['herb.mossling']?.count ?? 0).toBe(2);
    expect(state.events.some(e => e.type === 'guard-beast-courier-haul')).toBe(true);
  });

  it('非 courier 专长兽不搬运（专长门控，差异化分工）', () => {
    const { state, ctx } = setup();
    addBeast(state, 3, 5, 'field-ward');
    dropGround(state, 'herb.mossling', 2);

    advanceDay(state, ctx);

    expect(state.groundItems).toHaveLength(1); // 未搬运
    expect(state.storage.inventory['herb.mossling']?.count ?? 0).toBe(0);
  });

  it('每搬一项扣 vigor，vigor 耗尽则停（阀 B 天然封顶，护田优先、搬运末位）', () => {
    const { state, ctx } = setup();
    // vigor 1 + maxVigor 1：recover 不增（min(1, 1+1)=1），仅够搬 1 项。
    addBeast(state, 1, 1, 'courier');
    dropGround(state, 'herb.mossling', 1);
    dropGround(state, 'item.spirit-stone', 1);

    advanceDay(state, ctx);

    expect(state.groundItems).toHaveLength(1); // 第 2 项 vigor 不够
    expect(state.guardBeasts[0]!.vigor).toBe(0);
  });

  it('目标仓库同物品满栈时不搬运、不扣 vigor、不超堆叠', () => {
    const { state, ctx } = setup();
    const beastId = addBeast(state, 3, 5, 'courier');
    state.storage.capacity = 1;
    state.storage.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 30 };
    dropGround(state, 'herb.mossling', 1);

    courierHaulGroundItems(state, ctx);

    expect(state.groundItems).toHaveLength(1);
    expect(state.storage.inventory['herb.mossling']?.count ?? 0).toBe(30);
    expect(state.guardBeasts.find(beast => beast.id === beastId)?.vigor).toBe(3);
    expect(state.events.some(e => e.type === 'guard-beast-courier-haul')).toBe(false);
  });

  it('后续物品入仓失败时不会复制已经搬走的地面物', () => {
    const { state, ctx } = setup();
    addBeast(state, 3, 5, 'courier');
    state.storage.capacity = 2;
    state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 50 };
    dropGround(state, 'herb.mossling', 1);
    dropGround(state, 'item.spirit-stone', 1);

    courierHaulGroundItems(state, ctx);

    expect(state.storage.inventory['herb.mossling']?.count ?? 0).toBe(1);
    expect(state.storage.inventory['item.spirit-stone']?.count ?? 0).toBe(50);
    expect(state.groundItems).toHaveLength(1);
    expect(state.groundItems[0]).toMatchObject({ itemId: 'item.spirit-stone', count: 1 });
  });

  it('阀 A：搬运不涨 bodyFoundation（守 docs/00 C5，自动化只减劳作不减挣扎）', () => {
    const { state, ctx } = setup();
    addBeast(state, 3, 5, 'courier');
    dropGround(state, 'herb.mossling', 2);
    const before = state.player.bodyFoundation;

    advanceDay(state, ctx);

    expect(state.player.bodyFoundation).toBe(before);
  });
});
