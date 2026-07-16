/**
 * 农庄仓库/箱子：Stardew-like 长期材料管理，分离随身背包与农场仓储。
 */
import { describe, expect, it } from 'vitest';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, depositItem, depositQualityItem, performUpgrade, storageItemCount, storageQualityItemCount, storageUsed, withdrawItem, withdrawQualityItem, advanceFacilityJobs, placeFacility, upgradeFlag } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { buildRegistry } from '@content/registry';
import { inventoryUsed, itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

function setup(seed = 12) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('农庄仓库/箱子', () => {
  it('普通物品可存入仓库并从随身背包移除', () => {
    const { state } = setup();
    mutateItem(state.player, 'seed.mossling', 5);

    const result = depositItem(state, 'seed.mossling', 3);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'seed.mossling')).toBe(2);
    expect(storageItemCount(state.storage, 'seed.mossling')).toBe(3);
    expect(storageUsed(state.storage)).toBe(1);
    expect(state.events.some(e => e.type === 'storage-deposit')).toBe(true);
  });

  it('普通物品可取回随身背包，且背包满时失败不扣仓库', () => {
    const { state } = setup();
    state.storage.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 4 };

    expect(withdrawItem(state, 'seed.mossling', 2).ok).toBe(true);
    expect(itemCount(state.player, 'seed.mossling')).toBe(2);
    expect(storageItemCount(state.storage, 'seed.mossling')).toBe(2);

    state.player.inventoryCapacity = inventoryUsed(state.player);
    state.storage.inventory['seed.dewroot'] = { itemId: 'seed.dewroot', count: 1 };
    const blocked = withdrawItem(state, 'seed.dewroot', 1);

    expect(blocked.ok).toBe(false);
    expect(blocked.reason).toBe('储物戒已满');
    expect(storageItemCount(state.storage, 'seed.dewroot')).toBe(1);
    expect(itemCount(state.player, 'seed.dewroot')).toBe(0);
  });

  it('仓库容量满时新增槽位失败，已有槽位仍可叠加', () => {
    const { state } = setup();
    state.storage.capacity = 1;
    mutateItem(state.player, 'seed.mossling', 5);
    mutateItem(state.player, 'seed.dewroot', 1);

    expect(depositItem(state, 'seed.mossling', 2).ok).toBe(true);
    expect(depositItem(state, 'seed.mossling', 1).ok).toBe(true);
    const full = depositItem(state, 'seed.dewroot', 1);

    expect(full.ok).toBe(false);
    expect(full.reason).toBe('仓库已满');
    expect(itemCount(state.player, 'seed.dewroot')).toBe(1);
    expect(storageItemCount(state.storage, 'seed.dewroot')).toBe(0);
  });

  it('品质灵草按品质批次存取，保留独立数量', () => {
    const { state } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 3);

    expect(depositQualityItem(state, 'herb.mossling', 'spirit', 2).ok).toBe(true);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(1);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(2);

    expect(withdrawQualityItem(state, 'herb.mossling', 'spirit', 1).ok).toBe(true);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(2);
    expect(storageQualityItemCount(state.storage, 'herb.mossling', 'spirit')).toBe(1);
  });

  it('动作系统接入仓库存取，并可随存档往返保留', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 6);
    mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 1);

    applyAction(state, { kind: 'deposit-item', itemId: 'item.spirit-stone', count: 4 }, ctx);
    applyAction(state, { kind: 'deposit-quality-item', itemId: 'herb.dewroot', quality: 'treasure', count: 1 }, ctx);
    applyAction(state, { kind: 'withdraw-item', itemId: 'item.spirit-stone', count: 1 }, ctx);
    applyAction(state, { kind: 'withdraw-quality-item', itemId: 'herb.dewroot', quality: 'treasure', count: 1 }, ctx);

    expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
    expect(storageItemCount(state.storage, 'item.spirit-stone')).toBe(3);
    expect(qualityItemCount(state.player, 'herb.dewroot', 'treasure')).toBe(1);
    expect(storageQualityItemCount(state.storage, 'herb.dewroot', 'treasure')).toBe(0);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('数量无效或不足时不改变状态', () => {
    const { state } = setup();
    mutateItem(state.player, 'seed.mossling', 1);
    const invalid = depositItem(state, 'seed.mossling', 0);
    const poor = depositItem(state, 'seed.mossling', 2);

    expect(invalid.ok).toBe(false);
    expect(poor.ok).toBe(false);
    expect(itemCount(state.player, 'seed.mossling')).toBe(1);
    expect(storageItemCount(state.storage, 'seed.mossling')).toBe(0);
  });

  it('农庄协同升级后，晾晒架可从仓库自动取料并在完成后自动回仓', () => {
    const { state } = setup();
    state.player.stage = 1 as 1;
    state.guardBeasts.push({ id: 11, vigor: 3, maxVigor: 3, bond: 0, specialty: null });
    mutateItem(state.player, 'item.spirit-stone', 14);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.beast-core', 1);
    expect(performUpgrade(state, 'farm-autoload-1').ok).toBe(true);

    const placed = placeFacility(state, 'drying-rack', 2, 2, { free: true }).facility!;
    expect(depositItem(state, 'herb.mossling', 1).ok).toBe(false);
    mutateItem(state.player, 'herb.mossling', 1);
    expect(depositItem(state, 'herb.mossling', 1).ok).toBe(true);

    advanceFacilityJobs(state, ctxForSeed(12));

    expect(placed.job).toBeNull;
    expect(storageItemCount(state.storage, 'herb.mossling')).toBe(0);
    expect(storageItemCount(state.storage, 'item.dried-herb')).toBe(1);
    expect(state.events.some(e => e.type === 'facility-job-autostart')).toBe(true);
    expect(state.events.some(e => e.type === 'facility-auto-store')).toBe(true);
  });

  it('农庄协同升级后，封藏柜可使用仓库材料自动周转', () => {
    const { state } = setup();
    state.player.stage = 1 as 1;
    state.flags.add(upgradeFlag('farmstead-expansion-1'));
    state.guardBeasts.push({ id: 12, vigor: 3, maxVigor: 3, bond: 0, specialty: null });
    mutateItem(state.player, 'item.spirit-stone', 14);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.beast-core', 1);
    expect(performUpgrade(state, 'farm-autoload-1').ok).toBe(true);

    placeFacility(state, 'sealing-cabinet', 1, 1, { free: true });
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-compost', 1);
    expect(depositItem(state, 'item.dried-herb', 2).ok).toBe(true);
    expect(depositItem(state, 'item.spirit-compost', 1).ok).toBe(true);

    const ctx = ctxForSeed(12);
    advanceFacilityJobs(state, ctx);
    advanceFacilityJobs(state, ctx);

    expect(storageItemCount(state.storage, 'item.dried-herb')).toBe(0);
    expect(storageItemCount(state.storage, 'item.spirit-compost')).toBe(0);
    expect(storageItemCount(state.storage, 'item.sealed-herb')).toBe(1);
  });

  it('未解锁协同升级时，不会发生仓库到设施的自动周转', () => {
    const { state } = setup();
    const placed = placeFacility(state, 'drying-rack', 2, 2, { free: true }).facility!;
    state.guardBeasts.push({ id: 13, vigor: 3, maxVigor: 3, bond: 0, specialty: null });
    mutateItem(state.player, 'herb.mossling', 1);
    expect(depositItem(state, 'herb.mossling', 1).ok).toBe(true);

    advanceFacilityJobs(state, ctxForSeed(12));

    expect(placed.job).toBeNull;
    expect(storageItemCount(state.storage, 'herb.mossling')).toBe(1);
    expect(storageItemCount(state.storage, 'item.dried-herb')).toBe(0);
    expect(state.events.some(e => e.type === 'facility-job-autostart')).toBe(false);
  });
});

function ctxForSeed(seed: number) {
  const reg = buildRegistry();
  return createSimContext(seed, reg, DEFAULT_BALANCE);
}
