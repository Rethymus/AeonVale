import { describe, expect, it } from 'vitest';
import { applyMvpStarterKit, createWorld, DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';
import { itemCount } from '@sim/world/player';

describe('MVP 开局物资', () => {
  it('只暴露首轮农务闭环需要的最小资源集', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 1, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

    applyMvpStarterKit(state, DEFAULT_BALANCE);

    expect(itemCount(state.player, 'seed.mossling')).toBe(6);
    expect(itemCount(state.player, 'seed.dewroot')).toBe(3);
    expect(itemCount(state.player, 'herb.mossling')).toBe(3);
    expect(itemCount(state.player, 'herb.dewroot')).toBe(2);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(2);

    expect(state.player.inventory['item.rust-hoe']?.durability).toBe(DEFAULT_BALANCE.tools.hoeDurability);
    expect(state.player.inventory['item.sickle']?.durability).toBe(DEFAULT_BALANCE.tools.sickleDurability);
    expect(state.player.inventory['item.water-pail']?.durability).toBe(DEFAULT_BALANCE.tools.pailDurability);

    expect(itemCount(state.player, 'seed.suncap')).toBe(0);
    expect(itemCount(state.player, 'seed.stonegrain')).toBe(0);
    expect(itemCount(state.player, 'seed.mistfern')).toBe(0);
    expect(itemCount(state.player, 'seed.sunmoss')).toBe(0);
    expect(itemCount(state.player, 'herb.metalpine')).toBe(0);
    expect(itemCount(state.player, 'herb.frostmarrow')).toBe(0);
    expect(itemCount(state.player, 'herb.emberheart')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
  });
});
