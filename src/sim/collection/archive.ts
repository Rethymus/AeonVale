/**
 * 藏经阁捐献：Stardew 博物馆/收集图鉴的修仙化版本。
 * 玩家把残卷、破损法宝、阵核等遗迹产物交给山谷藏经阁，换取一次性知识回报。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { itemCount, mutateItem } from '@sim/world/player';

export interface ArchiveDonationReward {
  itemId?: string;
  count?: number;
  bodyFoundation?: number;
  willpower?: number;
}

export interface ArchiveDonationDef {
  id: string;
  title: string;
  description: string;
  stageMin: number;
  request: { itemId: string; count: number };
  reward: ArchiveDonationReward;
}

export interface ArchiveDonationStatus extends ArchiveDonationDef {
  donated: boolean;
  available: boolean;
}

export interface ArchiveDonationResult {
  ok: boolean;
  donation: ArchiveDonationDef | null;
  reason?: string;
}

export interface ArchiveMilestoneDef {
  id: string;
  title: string;
  description: string;
  requiredDonations: number;
  reward: ArchiveDonationReward;
}

export interface ArchiveMilestoneStatus extends ArchiveMilestoneDef {
  claimed: boolean;
  available: boolean;
  donationCount: number;
}

export interface ArchiveMilestoneResult {
  ok: boolean;
  milestone: ArchiveMilestoneDef | null;
  reason?: string;
}

const FLAG_PREFIX = 'archive-donation:';
const MILESTONE_FLAG_PREFIX = 'archive-milestone:';

export const ARCHIVE_DONATION_CATALOG: readonly ArchiveDonationDef[] = [
  {
    id: 'archive.recipe-fragment-primer',
    title: '残卷启蒙',
    description: '把散落丹方残页交给藏经阁誊录，换回可用于早期周转的灵石。',
    stageMin: 0,
    request: { itemId: 'item.recipe-fragment', count: 1 },
    reward: { itemId: 'item.spirit-stone', count: 4 }
  },
  {
    id: 'archive.broken-talisman-anatomy',
    title: '法宝拆解录',
    description: '记录破损法宝的纹路与材质，让凡骨也能理解灵器受力。',
    stageMin: 1,
    request: { itemId: 'item.broken-talisman', count: 1 },
    reward: { bodyFoundation: 1_200 }
  },
  {
    id: 'archive.array-core-proof',
    title: '阵核反推题',
    description: '以阵核作样本反推旧阵几何，强化以阵控场的悟性路线。',
    stageMin: 2,
    request: { itemId: 'item.array-core', count: 1 },
    reward: { willpower: 1_000, bodyFoundation: 800 }
  },
  {
    id: 'archive.herbal-wine-vintage',
    title: '灵酒陈酿录',
    description: '把自酿灵草药酒交藏经阁品鉴留档，换回体修行气活血的心得与少量灵石。',
    stageMin: 3,
    request: { itemId: 'item.herbal-wine', count: 1 },
    reward: { itemId: 'item.spirit-stone', count: 5, bodyFoundation: 600 }
  },
  {
    id: 'archive.poultice-formula',
    title: '膏药方誊录',
    description: '把外敷灵药膏的配方法门誊录存档，强化体修硬扛雷劫的续命底子。',
    stageMin: 3,
    request: { itemId: 'item.spirit-poultice', count: 1 },
    reward: { bodyFoundation: 1_000, willpower: 500 }
  },
  {
    id: 'archive.compost-manual',
    title: '灵壤肥农书',
    description: '把自堆灵壤肥的配比心得整理成农书，换回少量灵石与体修根基。',
    stageMin: 1,
    request: { itemId: 'item.spirit-compost', count: 2 },
    reward: { itemId: 'item.spirit-stone', count: 3, bodyFoundation: 300 }
  },
  {
    id: 'archive.sealed-herb-codex',
    title: '封藏灵草图鉴',
    description: '把封藏灵草的成色与药性整理入图鉴，强化体修识药辨性的悟性。',
    stageMin: 2,
    request: { itemId: 'item.sealed-herb', count: 1 },
    reward: { willpower: 800, bodyFoundation: 400 }
  }
];

export const ARCHIVE_MILESTONE_CATALOG: readonly ArchiveMilestoneDef[] = [
  {
    id: 'archive-milestone.first-shelf',
    title: '一架初成',
    description: '第一份藏经让旧书架重新有了次序，阁中回赠灵壤肥扶持灵田。',
    requiredDonations: 1,
    reward: { itemId: 'item.spirit-compost', count: 2 }
  },
  {
    id: 'archive-milestone.array-shelf',
    title: '阵题成册',
    description: '累计誊录足够残篇后，藏经阁开放一枚旧阵核供你反推阵理。',
    requiredDonations: 2,
    reward: { itemId: 'item.array-core', count: 1 }
  },
  {
    id: 'archive-milestone.body-lineage',
    title: '凡骨谱系',
    description: '三份遗物拼出没落体修传承的轮廓，帮助你把苦练化为根基。',
    requiredDonations: 3,
    reward: { bodyFoundation: 1_500, willpower: 800 }
  },
  {
    id: 'archive-milestone.craftsman-shelf',
    title: '工匠谱成',
    description: '把自酿灵酒与膏药方都誊录归档后，藏经阁回赠灵壤肥，扶持你继续钻研工匠道。',
    requiredDonations: 4,
    reward: { itemId: 'item.spirit-compost', count: 3 }
  },
  {
    id: 'archive-milestone.five-shelf',
    title: '五架典藏',
    description: '五份遗物/工匠谱归档，藏经阁初具规模，阁主以开悟心得助你把苦练化为根基。',
    requiredDonations: 5,
    reward: { bodyFoundation: 1_500, willpower: 1_000 }
  },
  {
    id: 'archive-milestone.six-shelf',
    title: '六架归真',
    description: '六份典藏归档，阁主赠你一袋灵壤肥与更深一层体修心得，助你在飞升边上把根再扎稳一寸。',
    requiredDonations: 6,
    reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 1_800, willpower: 1_200 }
  },
  {
    id: 'archive-milestone.full-codex',
    title: '典藏大成',
    description: '七份典藏尽数归档，藏经阁为你补齐全套体修传承，根基与悟性一并大开。',
    requiredDonations: 7,
    reward: { itemId: 'item.spirit-stone', count: 10, bodyFoundation: 2_500, willpower: 1_500 }
  }
];

export function archiveDonationFlag(donationId: string): string {
  return FLAG_PREFIX + donationId;
}

export function archiveMilestoneFlag(milestoneId: string): string {
  return MILESTONE_FLAG_PREFIX + milestoneId;
}

export function isArchiveDonationComplete(state: GameState, donationId: string): boolean {
  return state.flags.has(archiveDonationFlag(donationId));
}

export function getArchiveDonations(state: GameState): ArchiveDonationStatus[] {
  return ARCHIVE_DONATION_CATALOG.map(donation => ({
    ...donation,
    donated: isArchiveDonationComplete(state, donation.id),
    available: state.player.stage >= donation.stageMin
  }));
}

export function nextArchiveDonation(state: GameState): ArchiveDonationStatus | null {
  return getArchiveDonations(state).find(donation => donation.available && !donation.donated) ?? null;
}

export function archiveDonationCount(state: GameState): number {
  return ARCHIVE_DONATION_CATALOG.filter(donation => isArchiveDonationComplete(state, donation.id)).length;
}

export function isArchiveMilestoneClaimed(state: GameState, milestoneId: string): boolean {
  return state.flags.has(archiveMilestoneFlag(milestoneId));
}

export function getArchiveMilestones(state: GameState): ArchiveMilestoneStatus[] {
  const donationCount = archiveDonationCount(state);
  return ARCHIVE_MILESTONE_CATALOG.map(milestone => ({
    ...milestone,
    donationCount,
    claimed: isArchiveMilestoneClaimed(state, milestone.id),
    available: donationCount >= milestone.requiredDonations
  }));
}

export function nextArchiveMilestone(state: GameState): ArchiveMilestoneStatus | null {
  return getArchiveMilestones(state).find(milestone => milestone.available && !milestone.claimed) ?? null;
}

function grantReward(state: GameState, reward: ArchiveDonationReward): boolean {
  if (reward.itemId && reward.count) {
    if (!mutateItem(state.player, reward.itemId, reward.count)) return false;
  }
  state.player.bodyFoundation += reward.bodyFoundation ?? 0;
  state.player.cultivation += reward.bodyFoundation ?? 0;
  state.player.willpower += reward.willpower ?? 0;
  return true;
}

function rollbackReward(state: GameState, reward: ArchiveDonationReward): void {
  if (reward.itemId && reward.count) mutateItem(state.player, reward.itemId, -reward.count);
  state.player.bodyFoundation -= reward.bodyFoundation ?? 0;
  state.player.cultivation -= reward.bodyFoundation ?? 0;
  state.player.willpower -= reward.willpower ?? 0;
}

export function donateToArchive(state: GameState, donationId: string): ArchiveDonationResult {
  const donation = ARCHIVE_DONATION_CATALOG.find(entry => entry.id === donationId) ?? null;
  if (!donation) return { ok: false, donation: null, reason: '无此藏经条目' };
  if (state.player.stage < donation.stageMin) return { ok: false, donation, reason: '修为不足' };
  const flag = archiveDonationFlag(donation.id);
  if (state.flags.has(flag)) return { ok: false, donation, reason: '已捐献' };
  if (itemCount(state.player, donation.request.itemId) < donation.request.count) return { ok: false, donation, reason: '物品不足' };

  mutateItem(state.player, donation.request.itemId, -donation.request.count);
  if (!grantReward(state, donation.reward)) {
    mutateItem(state.player, donation.request.itemId, donation.request.count);
    rollbackReward(state, donation.reward);
    return { ok: false, donation, reason: '储物戒已满' };
  }

  state.flags.add(flag);
  emit(state, 'archive-donate', { donationId: donation.id, request: donation.request, reward: donation.reward });
  return { ok: true, donation };
}

export function claimArchiveMilestone(state: GameState, milestoneId: string): ArchiveMilestoneResult {
  const milestone = ARCHIVE_MILESTONE_CATALOG.find(entry => entry.id === milestoneId) ?? null;
  if (!milestone) return { ok: false, milestone: null, reason: '无此藏经里程碑' };
  const donationCount = archiveDonationCount(state);
  if (donationCount < milestone.requiredDonations) return { ok: false, milestone, reason: '捐献不足' };
  const flag = archiveMilestoneFlag(milestone.id);
  if (state.flags.has(flag)) return { ok: false, milestone, reason: '已领取' };

  if (!grantReward(state, milestone.reward)) {
    rollbackReward(state, milestone.reward);
    return { ok: false, milestone, reason: '储物戒已满' };
  }

  state.flags.add(flag);
  emit(state, 'archive-milestone', { milestoneId: milestone.id, requiredDonations: milestone.requiredDonations, reward: milestone.reward });
  return { ok: true, milestone };
}
