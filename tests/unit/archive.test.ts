/**
 * 藏经阁捐献：博物馆/图鉴式收集目标，把遗迹产物转为体修与阵法悟性收益。
 */
import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { applyAction, archiveDonationCount, archiveDonationFlag, archiveMilestoneFlag, claimArchiveMilestone, createSimContext, createWorld, DEFAULT_BALANCE, donateToArchive, getArchiveDonations, getArchiveMilestones, isArchiveDonationComplete, isArchiveMilestoneClaimed, nextArchiveDonation, nextArchiveMilestone, type GameState, type SimContext } from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { itemCount, mutateItem } from '@sim/world/player';

function setup(stage = 0, seed = 1): { state: GameState; ctx: SimContext } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  state.player.stage = stage as GameState['player']['stage'];
  return { state, ctx };
}

describe('藏经阁捐献', () => {
  it('按阶段开放藏经条目，并选择当前第一个未捐条目', () => {
    const { state } = setup(0);
    const stage0 = getArchiveDonations(state);
    expect(stage0.map(entry => ({ id: entry.id, available: entry.available }))).toEqual([
      { id: 'archive.recipe-fragment-primer', available: true },
      { id: 'archive.broken-talisman-anatomy', available: false },
      { id: 'archive.array-core-proof', available: false },
      { id: 'archive.herbal-wine-vintage', available: false },
      { id: 'archive.poultice-formula', available: false },
      { id: 'archive.compost-manual', available: false },
      { id: 'archive.sealed-herb-codex', available: false }
    ]);
    expect(nextArchiveDonation(state)?.id).toBe('archive.recipe-fragment-primer');

    state.player.stage = 2 as GameState['player']['stage'];
    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
    expect(nextArchiveDonation(state)?.id).toBe('archive.broken-talisman-anatomy');
  });

  it('捐献残卷会消耗请求物、给灵石并写入一次性标记', () => {
    const { state } = setup(0);
    mutateItem(state.player, 'item.recipe-fragment', 1);

    const result = donateToArchive(state, 'archive.recipe-fragment-primer');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.recipe-fragment')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(4);
    expect(isArchiveDonationComplete(state, 'archive.recipe-fragment-primer')).toBe(true);
    expect(state.events.at(-1)).toMatchObject({ type: 'archive-donate', payload: { donationId: 'archive.recipe-fragment-primer' } });
  });

  it('高阶藏经条目奖励体魄和意志，不占用背包', () => {
    const { state } = setup(2);
    mutateItem(state.player, 'item.array-core', 1);

    const result = donateToArchive(state, 'archive.array-core-proof');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.array-core')).toBe(0);
    expect(state.player.bodyFoundation).toBe(800);
    expect(state.player.cultivation).toBe(800);
    expect(state.player.willpower).toBe(1_000);
  });

  it('修为不足、物品不足、重复捐献均拒绝且不变更资源', () => {
    const { state } = setup(0);
    mutateItem(state.player, 'item.broken-talisman', 1);
    expect(donateToArchive(state, 'archive.broken-talisman-anatomy')).toMatchObject({ ok: false, reason: '修为不足' });
    expect(itemCount(state.player, 'item.broken-talisman')).toBe(1);

    expect(donateToArchive(state, 'archive.recipe-fragment-primer')).toMatchObject({ ok: false, reason: '物品不足' });

    mutateItem(state.player, 'item.recipe-fragment', 1);
    expect(donateToArchive(state, 'archive.recipe-fragment-primer').ok).toBe(true);
    expect(donateToArchive(state, 'archive.recipe-fragment-primer')).toMatchObject({ ok: false, reason: '已捐献' });
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(4);
  });

  it('奖励物因储物戒满无法接收时回滚请求物', () => {
    const { state } = setup(0);
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.recipe-fragment', 2);

    const result = donateToArchive(state, 'archive.recipe-fragment-primer');

    expect(result).toMatchObject({ ok: false, reason: '储物戒已满' });
    expect(itemCount(state.player, 'item.recipe-fragment')).toBe(2);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(isArchiveDonationComplete(state, 'archive.recipe-fragment-primer')).toBe(false);
  });

  it('donate-archive 玩家动作接入动作系统，完成记录可存档往返', () => {
    const { state, ctx } = setup(1);
    mutateItem(state.player, 'item.broken-talisman', 1);

    applyAction(state, { kind: 'donate-archive', donationId: 'archive.broken-talisman-anatomy' }, ctx);

    expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
    expect(state.player.bodyFoundation).toBe(1_200);
    expect(isArchiveDonationComplete(state, 'archive.broken-talisman-anatomy')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('按累计捐献数开放藏经里程碑，并选择第一个未领取奖励', () => {
    const { state } = setup(2);
    expect(archiveDonationCount(state)).toBe(0);
    expect(getArchiveMilestones(state).map(entry => ({ id: entry.id, available: entry.available, claimed: entry.claimed }))).toEqual([
      { id: 'archive-milestone.first-shelf', available: false, claimed: false },
      { id: 'archive-milestone.array-shelf', available: false, claimed: false },
      { id: 'archive-milestone.body-lineage', available: false, claimed: false },
      { id: 'archive-milestone.craftsman-shelf', available: false, claimed: false },
      { id: 'archive-milestone.five-shelf', available: false, claimed: false },
      { id: 'archive-milestone.six-shelf', available: false, claimed: false },
      { id: 'archive-milestone.full-codex', available: false, claimed: false }
    ]);
    expect(nextArchiveMilestone(state)).toBeNull;

    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
    state.flags.add(archiveDonationFlag('archive.broken-talisman-anatomy'));
    expect(archiveDonationCount(state)).toBe(2);
    expect(nextArchiveMilestone(state)?.id).toBe('archive-milestone.first-shelf');

    state.flags.add(archiveMilestoneFlag('archive-milestone.first-shelf'));
    expect(nextArchiveMilestone(state)?.id).toBe('archive-milestone.array-shelf');
  });

  it('领取藏经里程碑奖励会给物品并写入一次性标记', () => {
    const { state } = setup(1);
    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));

    const result = claimArchiveMilestone(state, 'archive-milestone.first-shelf');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(2);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.first-shelf')).toBe(true);
    expect(state.events.at(-1)).toMatchObject({ type: 'archive-milestone', payload: { milestoneId: 'archive-milestone.first-shelf' } });
    expect(claimArchiveMilestone(state, 'archive-milestone.first-shelf')).toMatchObject({ ok: false, reason: '已领取' });
  });

  it('里程碑奖励因储物戒满无法接收时不写入领取标记', () => {
    const { state } = setup(1);
    state.player.inventoryCapacity = 1;
    mutateItem(state.player, 'item.recipe-fragment', 1);
    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));

    const result = claimArchiveMilestone(state, 'archive-milestone.first-shelf');

    expect(result).toMatchObject({ ok: false, reason: '储物戒已满' });
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.first-shelf')).toBe(false);
  });

  it('claim-archive-milestone 玩家动作接入动作系统，属性奖励可存档往返', () => {
    const { state, ctx } = setup(2);
    state.flags.add(archiveDonationFlag('archive.recipe-fragment-primer'));
    state.flags.add(archiveDonationFlag('archive.broken-talisman-anatomy'));
    state.flags.add(archiveDonationFlag('archive.array-core-proof'));

    applyAction(state, { kind: 'claim-archive-milestone', milestoneId: 'archive-milestone.body-lineage' }, ctx);

    expect(state.player.bodyFoundation).toBe(1_500);
    expect(state.player.cultivation).toBe(1_500);
    expect(state.player.willpower).toBe(800);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.body-lineage')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });
});

describe('藏经阁工匠谱（灵酒/膏药捐献 + 工匠谱里程碑）', () => {
  it('捐献灵草药酒换回灵石与体修根基', () => {
    const { state } = setup(3);
    mutateItem(state.player, 'item.herbal-wine', 1);

    const result = donateToArchive(state, 'archive.herbal-wine-vintage');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(5);
    expect(state.player.bodyFoundation).toBe(600);
    expect(isArchiveDonationComplete(state, 'archive.herbal-wine-vintage')).toBe(true);
  });

  it('捐献灵药膏换回体修根基与意志', () => {
    const { state } = setup(3);
    mutateItem(state.player, 'item.spirit-poultice', 1);

    const result = donateToArchive(state, 'archive.poultice-formula');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-poultice')).toBe(0);
    expect(state.player.bodyFoundation).toBe(1_000);
    expect(state.player.willpower).toBe(500);
  });

  it('修为不足（stage<3）时不可捐献工匠谱条目', () => {
    const { state } = setup(2);
    mutateItem(state.player, 'item.herbal-wine', 1);

    const result = donateToArchive(state, 'archive.herbal-wine-vintage');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('修为不足');
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(1);
  });

  it('累计 4 份捐献后可领取工匠谱里程碑（灵壤肥×3）', () => {
    const { state } = setup(3);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'item.broken-talisman', 1);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.herbal-wine', 1);
    donateToArchive(state, 'archive.recipe-fragment-primer');
    donateToArchive(state, 'archive.broken-talisman-anatomy');
    donateToArchive(state, 'archive.array-core-proof');
    donateToArchive(state, 'archive.herbal-wine-vintage');
    expect(archiveDonationCount(state)).toBe(4);

    const result = claimArchiveMilestone(state, 'archive-milestone.craftsman-shelf');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(3);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.craftsman-shelf')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });
});

describe('藏经阁收藏线补全（灵壤肥/封藏灵草捐献）', () => {
  it('捐献双份灵壤肥换回灵石与体修根基', () => {
    const { state } = setup(1);
    mutateItem(state.player, 'item.spirit-compost', 2);

    const result = donateToArchive(state, 'archive.compost-manual');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(3);
    expect(state.player.bodyFoundation).toBe(300);
  });

  it('捐献封藏灵草换回意志与体修根基', () => {
    const { state } = setup(2);
    mutateItem(state.player, 'item.sealed-herb', 1);

    const result = donateToArchive(state, 'archive.sealed-herb-codex');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(0);
    expect(state.player.willpower).toBe(800);
    expect(state.player.bodyFoundation).toBe(400);
  });

  it('捐满全部 7 份典藏后可领取典藏大成里程碑（灵石×10 + 根基/意志）', () => {
    const { state } = setup(3);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'item.broken-talisman', 1);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.herbal-wine', 1);
    mutateItem(state.player, 'item.spirit-poultice', 1);
    mutateItem(state.player, 'item.spirit-compost', 2);
    mutateItem(state.player, 'item.sealed-herb', 1);
    for (const id of ['archive.recipe-fragment-primer', 'archive.broken-talisman-anatomy', 'archive.array-core-proof', 'archive.herbal-wine-vintage', 'archive.poultice-formula', 'archive.compost-manual', 'archive.sealed-herb-codex']) {
      expect(donateToArchive(state, id).ok).toBe(true);
    }
    expect(archiveDonationCount(state)).toBe(7);

    const before = itemCount(state.player, 'item.spirit-stone');
    const result = claimArchiveMilestone(state, 'archive-milestone.full-codex');

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(before + 10);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.full-codex')).toBe(true);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('累计 6 份捐献后可领取六架归真里程碑（灵壤肥×2 + 根基/意志）', () => {
    const { state } = setup(3);
    mutateItem(state.player, 'item.recipe-fragment', 1);
    mutateItem(state.player, 'item.broken-talisman', 1);
    mutateItem(state.player, 'item.array-core', 1);
    mutateItem(state.player, 'item.herbal-wine', 1);
    mutateItem(state.player, 'item.spirit-poultice', 1);
    mutateItem(state.player, 'item.spirit-compost', 2);
    for (const id of ['archive.recipe-fragment-primer', 'archive.broken-talisman-anatomy', 'archive.array-core-proof', 'archive.herbal-wine-vintage', 'archive.poultice-formula', 'archive.compost-manual']) {
      expect(donateToArchive(state, id).ok).toBe(true);
    }
    expect(archiveDonationCount(state)).toBe(6);

    const result = claimArchiveMilestone(state, 'archive-milestone.six-shelf');

    expect(result.ok).toBe(true);
    expect(isArchiveMilestoneClaimed(state, 'archive-milestone.six-shelf')).toBe(true);
  });
});
