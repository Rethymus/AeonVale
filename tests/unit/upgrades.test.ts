/**
 * 永久升级：资源 sink + 长期能力成长，贴近 Stardew 的背包/设施升级节奏。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, farmExpansionTier, getAvailableUpgrades, hasUpgrade, performUpgrade, placeFacility, tileAt, toolAreaSize, toolStaminaMultiplier, upgradeFlag, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { inventoryUsed, itemCount, mutateItem } from '@sim/world/player';

function setup(stage = 0, seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stage = stage as GameState['player']['stage'];
  return { state, ctx };
}

describe('永久升级与储物戒扩容', () => {
  it('列出当前阶段尚未完成的升级', () => {
    const { state } = setup(0);
    expect(getAvailableUpgrades(state).map(u => u.id)).toEqual(['farmstead-expansion-1', 'storage-ring-1', 'tool-hoe-1', 'tool-pail-1', 'tool-sickle-1']);
    state.player.stage = 2;
    expect(getAvailableUpgrades(state).map(u => u.id)).toEqual(['farmstead-expansion-1', 'farmstead-expansion-2', 'storage-ring-1', 'storage-ring-2', 'storage-ring-3', 'tool-hoe-1', 'tool-pail-1', 'tool-sickle-1', 'farm-autoload-1']);
    state.player.stage = 7;
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('farmstead-expansion-3');
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('farmstead-expansion-3');
    state.flags.add(upgradeFlag('storage-ring-1'));
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('storage-ring-1');
  });

  it('暖棚苗床扩建只在留世后开放，并写入对应升级标记', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'herb.dewroot', 3);

    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('greenhouse-nursery-1');
    expect(performUpgrade(state, 'greenhouse-nursery-1')).toMatchObject({ ok: false, reason: '需留世后方可扩建' });

    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('greenhouse-nursery-1');
    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(hasUpgrade(state, 'greenhouse-nursery-1')).toBe(true);
  });

  it('暖棚二阶扩建需要先完成一阶，并在留世后才可解锁', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 44);
    mutateItem(state.player, 'item.array-core', 3);
    mutateItem(state.player, 'item.recipe-fragment', 3);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);

    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('greenhouse-nursery-1');
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('greenhouse-nursery-2');
    expect(performUpgrade(state, 'greenhouse-nursery-2')).toMatchObject({ ok: false, reason: '需留世后方可扩建' });

    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('greenhouse-nursery-1');
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('greenhouse-nursery-2');
    expect(performUpgrade(state, 'greenhouse-nursery-2')).toMatchObject({ ok: false, reason: '需先完成前置扩建' });

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('greenhouse-nursery-2');

    const result = performUpgrade(state, 'greenhouse-nursery-2');
    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'greenhouse-nursery-2')).toBe(true);
  });

  it('暖棚三阶扩建需要先完成二阶，并继续作为留世后的长期升级目标', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.recipe-fragment', 6);
    mutateItem(state.player, 'herb.dewroot', 3);
    mutateItem(state.player, 'herb.mistfern', 4);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    mutateItem(state.player, 'herb.sunmoss', 4);

    expect(performUpgrade(state, 'greenhouse-nursery-3')).toMatchObject({ ok: false, reason: '需留世后方可扩建' });

    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('greenhouse-nursery-3');
    expect(performUpgrade(state, 'greenhouse-nursery-3')).toMatchObject({ ok: false, reason: '需先完成前置扩建' });

    expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
    expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('greenhouse-nursery-3');

    const result = performUpgrade(state, 'greenhouse-nursery-3');
    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'greenhouse-nursery-3')).toBe(true);
  });

  it('农庄扩建会解锁外围一圈可耕作地并写入扩建层级', () => {
    const { state } = setup(0, 4);
    mutateItem(state.player, 'item.spirit-stone', 10);
    mutateItem(state.player, 'herb.mossling', 3);

    const before = tileAt(state, 1, 1);
    expect(before).toBeDefined;
    expect(before?.blockType).not.toBe('building');

    const result = performUpgrade(state, 'farmstead-expansion-1');

    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'farmstead-expansion-1')).toBe(true);
    expect(farmExpansionTier(state)).toBe(1);
    const expandedTile = tileAt(state, 1, 1);
    expect(expandedTile?.blockType).toBe('none');
    expect(expandedTile?.soilType).toBe('loam');
    expect(expandedTile?.fertility ?? 0).toBeGreaterThanOrEqual(40_000);
  });

  it('农庄扩建一阶与二阶会分别解锁封藏柜和炼符炉建造', () => {
    const { state } = setup(2, 8);
    mutateItem(state.player, 'item.spirit-stone', 28);
    mutateItem(state.player, 'herb.mossling', 3);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'herb.stonegrain', 4);

    expect(placeFacility(state, 'sealing-cabinet', 1, 1, { free: true })).toMatchObject({ ok: false, reason: '封藏柜需农庄扩建1阶' });
    expect(placeFacility(state, 'talisman-furnace', 0, 3, { free: true })).toMatchObject({ ok: false, reason: '炼符炉需农庄扩建2阶' });

    expect(performUpgrade(state, 'farmstead-expansion-1').ok).toBe(true);
    expect(placeFacility(state, 'sealing-cabinet', 1, 1, { free: true }).ok).toBe(true);
    expect(placeFacility(state, 'talisman-furnace', 0, 3, { free: true })).toMatchObject({ ok: false, reason: '炼符炉需农庄扩建2阶' });

    expect(performUpgrade(state, 'farmstead-expansion-2').ok).toBe(true);
    expect(placeFacility(state, 'talisman-furnace', 0, 3, { free: true }).ok).toBe(true);
  });

  it('二阶农庄扩建会继续扩大地块并提升扩建层级', () => {
    const { state } = setup(2, 5);
    mutateItem(state.player, 'item.spirit-stone', 18);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'herb.stonegrain', 4);

    expect(tileAt(state, 0, 0)?.blockType).not.toBe('building');

    const result = performUpgrade(state, 'farmstead-expansion-2');

    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'farmstead-expansion-2')).toBe(true);
    expect(farmExpansionTier(state)).toBe(2);
    expect(tileAt(state, 0, 0)?.blockType).toBe('none');
    expect(tileAt(state, 0, 0)?.soilType).toBe('loam');
  });

  it('三阶农庄扩建需要留世后才能解锁并继续扩大地块', () => {
    const { state } = setup(7, 6);
    mutateItem(state.player, 'item.spirit-stone', 30);
    mutateItem(state.player, 'item.array-core', 2);
    mutateItem(state.player, 'item.beast-core', 2);
    mutateItem(state.player, 'herb.mistfern', 4);

    expect(performUpgrade(state, 'farmstead-expansion-3')).toMatchObject({ ok: false, reason: '需留世后方可扩建' });

    state.postAscension.mode = 'stayed-in-world';
    const result = performUpgrade(state, 'farmstead-expansion-3');

    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'farmstead-expansion-3')).toBe(true);
    expect(farmExpansionTier(state)).toBe(3);
    expect(tileAt(state, 0, 0)?.blockType).toBe('none');
    expect(tileAt(state, 0, 0)?.soilType).toBe('loam');
  });

  it('升级成功会扣材料、写入 flags、增加背包容量并发事件', () => {
    const { state } = setup(0);
    mutateItem(state.player, 'item.spirit-stone', 8);
    const r = performUpgrade(state, 'storage-ring-1');
    expect(r.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(state.player.inventoryCapacity).toBe(24);
    expect(hasUpgrade(state, 'storage-ring-1')).toBe(true);
    expect(state.events.some(e => e.type === 'upgrade')).toBe(true);
  });

  it('材料不足、重复升级、阶段不足和未知升级均拒绝且不扣材料', () => {
    const { state } = setup(0);
    mutateItem(state.player, 'item.spirit-stone', 7);

    const poor = performUpgrade(state, 'storage-ring-1');
    expect(poor.ok).toBe(false);
    expect(poor.reason).toBe('材料不足');
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(7);
    expect(state.player.inventoryCapacity).toBe(16);

    mutateItem(state.player, 'item.spirit-stone', 1);
    expect(performUpgrade(state, 'storage-ring-1').ok).toBe(true);
    const duplicate = performUpgrade(state, 'storage-ring-1');
    expect(duplicate.ok).toBe(false);
    expect(duplicate.reason).toBe('已完成升级');

    const gated = performUpgrade(state, 'storage-ring-2');
    expect(gated.ok).toBe(false);
    expect(gated.reason).toBe('阶段不足');

    const unknown = performUpgrade(state, 'storage-ring-x');
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toBe('无此升级');
  });

  it('扩容后可以新增原本因满背包失败的物品', () => {
    const { state } = setup(0);
    const itemIds = ['seed.mossling', 'seed.dewroot', 'seed.suncap', 'seed.stonegrain', 'seed.mistfern', 'seed.sunmoss', 'seed.frostmarrow', 'seed.emberheart', 'seed.balmleaf', 'seed.metalpine', 'seed.thunderreed', 'herb.mossling', 'herb.dewroot', 'item.rust-hoe', 'item.sickle'];
    for (const id of itemIds) mutateItem(state.player, id, 1);
    mutateItem(state.player, 'item.spirit-stone', 8);
    expect(inventoryUsed(state.player)).toBe(16);
    expect(mutateItem(state.player, 'item.water-pail', 1)).toBe(false);

    expect(performUpgrade(state, 'storage-ring-1').ok).toBe(true);
    expect(mutateItem(state.player, 'item.water-pail', 1)).toBe(true);
    expect(itemCount(state.player, 'item.water-pail')).toBe(1);
  });

  it('upgrade 玩家动作接入动作系统，flags 可随存档往返保留', () => {
    const { state, ctx } = setup(0);
    mutateItem(state.player, 'item.spirit-stone', 8);
    applyAction(state, { kind: 'upgrade', upgradeId: 'storage-ring-1' }, ctx);
    expect(hasUpgrade(state, 'storage-ring-1')).toBe(true);
    expect(state.player.inventoryCapacity).toBe(24);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('工具升级会扣除材料并降低对应农事动作体力消耗', () => {
    const { state, ctx } = setup(0);
    mutateItem(state.player, 'item.spirit-stone', 6);
    mutateItem(state.player, 'item.broken-talisman', 1);
    const before = state.player.stamina;
    expect(performUpgrade(state, 'tool-hoe-1').ok).toBe(true);
    expect(hasUpgrade(state, 'tool-hoe-1')).toBe(true);
    expect(toolAreaSize(state, 'till')).toBe(5);

    applyAction(state, { kind: 'till', at: { x: 2, y: 2 } }, ctx);

    expect(before - state.player.stamina).toBe(DEFAULT_BALANCE.player.tillStaminaCost * 0.75 * 1000);
  });

  it('农庄协同升级需要中期材料并写入解锁标记', () => {
    const { state } = setup(1);
    mutateItem(state.player, 'item.spirit-stone', 14);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.beast-core', 1);

    const result = performUpgrade(state, 'farm-autoload-1');

    expect(result.ok).toBe(true);
    expect(hasUpgrade(state, 'farm-autoload-1')).toBe(true);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(itemCount(state.player, 'item.array-core')).toBe(0);
    expect(itemCount(state.player, 'item.beast-core')).toBe(0);
  });

  it('农庄扩建标记可随存档往返保留', () => {
    const { state, ctx } = setup(0, 7);
    mutateItem(state.player, 'item.spirit-stone', 10);
    mutateItem(state.player, 'herb.mossling', 3);

    applyAction(state, { kind: 'upgrade', upgradeId: 'farmstead-expansion-1' }, ctx);

    expect(hasUpgrade(state, 'farmstead-expansion-1')).toBe(true);
    expect(farmExpansionTier(state)).toBe(1);
    expect(roundTripEqual(state)).toBe(true);
  });
});

describe('留世锦囊扩容 ', () => {
  it('留世后方可扩建，扩容储物戒 12 格；未留世不可见', () => {
    const { state } = setup(2);
    mutateItem(state.player, 'item.spirit-stone', 20);
    mutateItem(state.player, 'item.spirit-compost', 2);
    mutateItem(state.player, 'item.sealed-herb', 1);
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('storage-satchel-stayed');
    expect(performUpgrade(state, 'storage-satchel-stayed').ok).toBe(false);
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('storage-satchel-stayed');
    const before = state.player.inventoryCapacity;
    const result = performUpgrade(state, 'storage-satchel-stayed');
    expect(result.ok).toBe(true);
    expect(state.player.inventoryCapacity).toBe(before + 12);
    expect(hasUpgrade(state, 'storage-satchel-stayed')).toBe(true);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(0);
  });
});

describe('留世辟土扩建 ', () => {
  it('留世且已完成三阶扩建后可辟土至四阶（更大田面）', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 50);
    mutateItem(state.player, 'item.array-core', 4);
    mutateItem(state.player, 'item.beast-core', 4);
    mutateItem(state.player, 'herb.frostmarrow', 4);
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('farmstead-expansion-4');
    state.flags.add(upgradeFlag('farmstead-expansion-3'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('farmstead-expansion-4');
    expect(farmExpansionTier(state)).toBe(3);
    const result = performUpgrade(state, 'farmstead-expansion-4');
    expect(result.ok).toBe(true);
    expect(farmExpansionTier(state)).toBe(4);
    expect(hasUpgrade(state, 'farmstead-expansion-4')).toBe(true);
  });
});

describe('留世大开田 ', () => {
  it('留世后可扩建工具作用范围（浇水/收获 +1 格）', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 24);
    mutateItem(state.player, 'item.sealed-herb', 2);
    mutateItem(state.player, 'item.spirit-compost', 2);
    const waterBefore = toolAreaSize(state, 'water');
    const harvestBefore = toolAreaSize(state, 'harvest');
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('tool-area-stayed');
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('tool-area-stayed');
    const result = performUpgrade(state, 'tool-area-stayed');
    expect(result.ok).toBe(true);
    expect(toolAreaSize(state, 'water')).toBe(waterBefore + 1);
    expect(toolAreaSize(state, 'harvest')).toBe(harvestBefore + 1);
    expect(hasUpgrade(state, 'tool-area-stayed')).toBe(true);
  });
});

describe('留世省力 ', () => {
  it('留世后可省力浇灌与收获（体力消耗 ×0.85）', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 22);
    mutateItem(state.player, 'item.herbal-wine', 2);
    mutateItem(state.player, 'item.spirit-compost', 2);
    const before = toolStaminaMultiplier(state, 'water');
    state.postAscension.mode = 'stayed-in-world';
    const result = performUpgrade(state, 'tool-stamina-stayed');
    expect(result.ok).toBe(true);
    expect(toolStaminaMultiplier(state, 'water')).toBeCloseTo(before * 0.85);
    expect(toolStaminaMultiplier(state, 'harvest')).toBeCloseTo(before * 0.85);
    expect(hasUpgrade(state, 'tool-stamina-stayed')).toBe(true);
  });
});

describe('留世广辟 ', () => {
  it('留世且完成四阶后可广辟至五阶（最大田面）', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 80);
    mutateItem(state.player, 'item.array-core', 6);
    mutateItem(state.player, 'item.beast-core', 6);
    mutateItem(state.player, 'herb.thunderreed', 4);
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('farmstead-expansion-5');
    state.flags.add(upgradeFlag('farmstead-expansion-4'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('farmstead-expansion-5');
    const result = performUpgrade(state, 'farmstead-expansion-5');
    expect(result.ok).toBe(true);
    expect(farmExpansionTier(state)).toBe(5);
    expect(hasUpgrade(state, 'farmstead-expansion-5')).toBe(true);
  });
});

describe('留世锦囊·扩 ', () => {
  it('留世锦囊一阶后可再扩容 16 格', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 40);
    mutateItem(state.player, 'item.sealed-herb', 3);
    mutateItem(state.player, 'item.herbal-wine', 2);
    state.postAscension.mode = 'stayed-in-world';
    expect(getAvailableUpgrades(state).map(u => u.id)).not.toContain('storage-satchel-stayed-2');
    state.flags.add(upgradeFlag('storage-satchel-stayed'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('storage-satchel-stayed-2');
    const before = state.player.inventoryCapacity;
    const result = performUpgrade(state, 'storage-satchel-stayed-2');
    expect(result.ok).toBe(true);
    expect(state.player.inventoryCapacity).toBe(before + 16);
    expect(hasUpgrade(state, 'storage-satchel-stayed-2')).toBe(true);
  });
});

describe('留世工具二阶 ', () => {
  it('留世大开田·扩：浇水/收获再 +1 格', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 40);
    mutateItem(state.player, 'item.sealed-herb', 3);
    mutateItem(state.player, 'item.array-core', 2);
    state.postAscension.mode = 'stayed-in-world';
    state.flags.add(upgradeFlag('tool-area-stayed'));
    const wBefore = toolAreaSize(state, 'water');
    expect(performUpgrade(state, 'tool-area-stayed-2').ok).toBe(true);
    expect(toolAreaSize(state, 'water')).toBe(wBefore + 1);
  });
  it('留世省力·深：浇水/收获体力再 ×0.85', () => {
    const { state } = setup(7);
    mutateItem(state.player, 'item.spirit-stone', 38);
    mutateItem(state.player, 'item.herbal-wine', 3);
    mutateItem(state.player, 'item.spirit-poultice', 1);
    state.postAscension.mode = 'stayed-in-world';
    state.flags.add(upgradeFlag('tool-stamina-stayed'));
    const sBefore = toolStaminaMultiplier(state, 'harvest');
    expect(performUpgrade(state, 'tool-stamina-stayed-2').ok).toBe(true);
    expect(toolStaminaMultiplier(state, 'harvest')).toBeCloseTo(sBefore * 0.85);
  });
});

describe('储物戒四阶扩容 ', () => {
  it('高境界（stage≥4）且完成三阶后可扩容四阶（+16 格）', () => {
    const { state } = setup(4);
    mutateItem(state.player, 'item.spirit-stone', 45);
    mutateItem(state.player, 'item.recipe-fragment', 3);
    mutateItem(state.player, 'item.array-core', 1);
    state.flags.add(upgradeFlag('storage-ring-3'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('storage-ring-4');
    const before = state.player.inventoryCapacity;
    const result = performUpgrade(state, 'storage-ring-4');
    expect(result.ok).toBe(true);
    expect(state.player.inventoryCapacity).toBe(before + 16);
    expect(hasUpgrade(state, 'storage-ring-4')).toBe(true);
  });
});

describe('高境界工具二阶 ', () => {
  it('凡铁锄·淬锋：翻地再省力、再扩域', () => {
    const { state } = setup(4);
    mutateItem(state.player, 'item.spirit-stone', 20);
    mutateItem(state.player, 'item.broken-talisman', 2);
    mutateItem(state.player, 'item.array-core', 1);
    state.flags.add(upgradeFlag('tool-hoe-1'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('tool-hoe-2');
    const aBefore = toolAreaSize(state, 'till');
    const sBefore = toolStaminaMultiplier(state, 'till');
    expect(performUpgrade(state, 'tool-hoe-2').ok).toBe(true);
    expect(toolAreaSize(state, 'till')).toBe(aBefore + 2);
    expect(toolStaminaMultiplier(state, 'till')).toBeCloseTo(sBefore * 0.8);
  });
  it('镰刀·再淬：收获更省力（无扩域，沿用 sickle 不扩域）', () => {
    const { state } = setup(4);
    mutateItem(state.player, 'item.spirit-stone', 20);
    mutateItem(state.player, 'item.broken-talisman', 2);
    mutateItem(state.player, 'item.array-core', 1);
    state.flags.add(upgradeFlag('tool-sickle-1'));
    const sBefore = toolStaminaMultiplier(state, 'harvest');
    expect(performUpgrade(state, 'tool-sickle-2').ok).toBe(true);
    expect(toolStaminaMultiplier(state, 'harvest')).toBeCloseTo(sBefore * 0.8);
  });
});

describe('高境界储物戒五阶与工具三阶 ', () => {
  it('储物戒五阶扩容 +20 格（需四阶）', () => {
    const { state } = setup(6);
    mutateItem(state.player, 'item.spirit-stone', 70);
    mutateItem(state.player, 'item.recipe-fragment', 4);
    mutateItem(state.player, 'item.array-core', 2);
    state.flags.add(upgradeFlag('storage-ring-4'));
    expect(getAvailableUpgrades(state).map(u => u.id)).toContain('storage-ring-5');
    const before = state.player.inventoryCapacity;
    expect(performUpgrade(state, 'storage-ring-5').ok).toBe(true);
    expect(state.player.inventoryCapacity).toBe(before + 20);
  });
  it('凡铁锄·雷淬（三阶）：翻地再省力、再扩域', () => {
    const { state } = setup(6);
    mutateItem(state.player, 'item.spirit-stone', 38);
    mutateItem(state.player, 'item.array-core', 2);
    mutateItem(state.player, 'item.beast-core', 2);
    state.flags.add(upgradeFlag('tool-hoe-2'));
    const aBefore = toolAreaSize(state, 'till');
    const sBefore = toolStaminaMultiplier(state, 'till');
    expect(performUpgrade(state, 'tool-hoe-3').ok).toBe(true);
    expect(toolAreaSize(state, 'till')).toBe(aBefore + 1);
    expect(toolStaminaMultiplier(state, 'till')).toBeCloseTo(sBefore * 0.85);
  });
});
