import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { archiveDonationCount } from '@sim/collection/archive';
import { specialOrderCompleteFlag } from '@sim/social/commissions';
import type { SimContext } from '@sim/world/context';
import { inventoryCanFitRewards, itemCount, mutateItem } from '@sim/world/player';

export interface MainlineQuestReward {
  itemId?: string;
  count?: number;
  bodyFoundation?: number;
  willpower?: number;
  lifespanDays?: number;
}

export interface MainlineQuestDef {
  id: string;
  title: string;
  description: string;
  objective: string;
  reward: MainlineQuestReward;
  isAvailable: (state: GameState) => boolean;
  isComplete: (state: GameState) => boolean;
}

export interface MainlineQuestStatus extends MainlineQuestDef {
  claimed: boolean;
  available: boolean;
  completed: boolean;
  current: boolean;
}

export interface MainlineQuestResult {
  ok: boolean;
  quest: MainlineQuestDef | null;
  reason?: string;
}

const FLAG_PREFIX = 'mainline-quest:';

export function mainlineQuestFlag(questId: string): string {
  return FLAG_PREFIX + questId;
}

export function isMainlineQuestClaimed(state: GameState, questId: string): boolean {
  return state.flags.has(mainlineQuestFlag(questId));
}

export const MAINLINE_QUEST_CATALOG: readonly MainlineQuestDef[] = [
  {
    id: 'mainline.mortal-discipline',
    title: '凡骨开篇',
    description: '以穿越者最朴素的苦练法硬扛凡身，把这具被判无灵根的凡骨先练到能承药承痛。',
    objective: '累计完成四项基础苦练，让体魄达到 400、耐力达到 80、意志达到 80。',
    reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 200 },
    isAvailable: () => true,
    isComplete: state => state.player.bodyFoundation >= 400 && state.player.endurance >= 80 && state.player.willpower >= 80
  },
  {
    id: 'mainline.herb-path',
    title: '药草入骨',
    description: '凡人不能吞吐灵力，就让灵草先入手、再入炉、最后入骨。',
    objective: '持有青苔与露根草各 1 份，证明灵田已能支撑早期淬体。',
    reward: { itemId: 'item.recipe-fragment', count: 1, willpower: 120 },
    isAvailable: state => isMainlineQuestClaimed(state, 'mainline.mortal-discipline'),
    isComplete: state => itemCount(state.player, 'herb.mossling') >= 1 && itemCount(state.player, 'herb.dewroot') >= 1
  },
  {
    id: 'mainline.archive-clue',
    title: '残卷寻脉',
    description: '没落体修没有宗门，只能把残卷、旧器和遗迹里的只言片语拼回一条路。',
    objective: '完成 1 次藏经阁捐献，拿到第一条关于古体修的线索。',
    reward: { itemId: 'item.spirit-stone', count: 6, bodyFoundation: 300 },
    isAvailable: state => isMainlineQuestClaimed(state, 'mainline.herb-path'),
    isComplete: state => archiveDonationCount(state) >= 1
  },
  {
    id: 'mainline.valley-order',
    title: '山谷立名',
    description: '体修在低境界常被视作粗鄙蛮力，先靠做事立名，再让山谷的人承认你不是废物。',
    objective: '完成特别订单“淬体药草储备”，证明你已能稳定供应炼体资源。',
    reward: { itemId: 'item.array-core', count: 1, willpower: 240 },
    isAvailable: state => isMainlineQuestClaimed(state, 'mainline.archive-clue'),
    isComplete: state => state.flags.has(specialOrderCompleteFlag('special-order.herb-stockpile'))
  },
  {
    id: 'mainline.defy-heaven',
    title: '我命由我',
    description: '真正的体修不是等雷来，而是明知折寿损命，仍主动向天要一个答案。',
    objective: '主动引劫后，让因果债达到 3000、天道注视达到 5000，正式落子与天道对弈。',
    reward: { itemId: 'item.spirit-stone', count: 12, lifespanDays: 30, bodyFoundation: 500 },
    isAvailable: state => isMainlineQuestClaimed(state, 'mainline.valley-order'),
    isComplete: state => state.player.heavenDebt >= 3000 && state.player.daoAttention >= 5000
  }
];

function grantReward(state: GameState, reward: MainlineQuestReward): boolean {
  if (reward.itemId && reward.count) {
    if (!mutateItem(state.player, reward.itemId, reward.count)) return false;
  }
  state.player.bodyFoundation += reward.bodyFoundation ?? 0;
  state.player.cultivation += reward.bodyFoundation ?? 0;
  state.player.willpower += reward.willpower ?? 0;
  state.player.lifespanRemainingDays += reward.lifespanDays ?? 0;
  return true;
}

function rollbackReward(state: GameState, reward: MainlineQuestReward): void {
  if (reward.itemId && reward.count) mutateItem(state.player, reward.itemId, -reward.count);
  state.player.bodyFoundation -= reward.bodyFoundation ?? 0;
  state.player.cultivation -= reward.bodyFoundation ?? 0;
  state.player.willpower -= reward.willpower ?? 0;
  state.player.lifespanRemainingDays -= reward.lifespanDays ?? 0;
}

export function getMainlineQuests(state: GameState): MainlineQuestStatus[] {
  const current = getCurrentMainlineQuest(state)?.id ?? null;
  return MAINLINE_QUEST_CATALOG.map(quest => ({
    ...quest,
    claimed: isMainlineQuestClaimed(state, quest.id),
    available: quest.isAvailable(state),
    completed: quest.isComplete(state),
    current: current === quest.id
  }));
}

export function getCurrentMainlineQuest(state: GameState): MainlineQuestStatus | null {
  for (const quest of MAINLINE_QUEST_CATALOG) {
    if (!quest.isAvailable(state)) continue;
    if (isMainlineQuestClaimed(state, quest.id)) continue;
    return {
      ...quest,
      claimed: false,
      available: true,
      completed: quest.isComplete(state),
      current: true
    };
  }
  return null;
}

function canFitReward(state: GameState, reward: MainlineQuestReward, ctx?: SimContext): boolean {
  if (!ctx || !reward.itemId || !reward.count) return true;
  return inventoryCanFitRewards(state.player, [{ itemId: reward.itemId, count: reward.count }], ctx.content);
}

export function claimMainlineQuest(state: GameState, questId: string, ctx?: SimContext): MainlineQuestResult {
  const quest = MAINLINE_QUEST_CATALOG.find(entry => entry.id === questId) ?? null;
  if (!quest) return { ok: false, quest: null, reason: '无此主线委托' };
  if (!quest.isAvailable(state)) return { ok: false, quest, reason: '主线未解锁' };
  if (isMainlineQuestClaimed(state, quest.id)) return { ok: false, quest, reason: '已领取' };
  if (!quest.isComplete(state)) return { ok: false, quest, reason: '进度未成' };
  if (!canFitReward(state, quest.reward, ctx)) return { ok: false, quest, reason: '储物戒已满' };
  if (!grantReward(state, quest.reward)) {
    return { ok: false, quest, reason: '储物戒已满' };
  }

  state.flags.add(mainlineQuestFlag(quest.id));
  const nextQuest = MAINLINE_QUEST_CATALOG.find(entry => entry.isAvailable(state) && !isMainlineQuestClaimed(state, entry.id)) ?? null;
  emit(state, 'mainline-quest-claim', {
    questId: quest.id,
    title: quest.title,
    reward: quest.reward,
    nextQuestId: nextQuest?.id ?? null,
    nextQuestTitle: nextQuest?.title ?? null
  });
  return { ok: true, quest };
}
