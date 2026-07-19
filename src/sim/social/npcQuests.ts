import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { archiveDonationCount } from '@sim/collection/archive';
import { specialOrderCompleteFlag } from '@sim/social/commissions';
import { getRelationship, NPC_CATALOG } from '@sim/social/relationships';
import { hasRelationshipPerk } from '@sim/social/relationshipEvents';
import { itemCount, mutateItem } from '@sim/world/player';

export interface NpcQuestReward {
  itemId?: string;
  count?: number;
  bodyFoundation?: number;
  willpower?: number;
  lifespanDays?: number;
}

export interface NpcQuestDef {
  id: string;
  npcId: string;
  title: string;
  description: string;
  objective: string;
  reward: NpcQuestReward;
  isAvailable: (state: GameState) => boolean;
  isComplete: (state: GameState) => boolean;
}

export interface NpcQuestStatus extends NpcQuestDef {
  npcName: string;
  claimed: boolean;
  available: boolean;
  completed: boolean;
  current: boolean;
}

export interface NpcQuestResult {
  ok: boolean;
  quest: NpcQuestDef | null;
  reason?: string;
}

const FLAG_PREFIX = 'npc-quest:';

export function npcQuestFlag(questId: string): string {
  return FLAG_PREFIX + questId;
}

export function isNpcQuestClaimed(state: GameState, questId: string): boolean {
  return state.flags.has(npcQuestFlag(questId));
}

function npcQuestStepClaimed(state: GameState, questId: string): boolean {
  return isNpcQuestClaimed(state, questId);
}

export const NPC_QUEST_CATALOG: readonly NpcQuestDef[] = [
  {
    id: 'npc-quest.herb-gatherer-bone-guard',
    npcId: 'npc.herb-gatherer',
    title: '温骨识药',
    description: '采药女愿意继续教你，但前提是你真能把灵草种到够用，而不是只会逞强受痛。',
    objective: '在采药女好感事件后，持有露根草 4 份、雾蕨 2 份，并让体魄达到 1200。',
    reward: { itemId: 'item.spirit-compost', count: 2, bodyFoundation: 180 },
    isAvailable: state => hasRelationshipPerk(state, 'herb-gatherer-160'),
    isComplete: state => itemCount(state.player, 'herb.dewroot') >= 4 && itemCount(state.player, 'herb.mistfern') >= 2 && state.player.bodyFoundation >= 1200
  },
  {
    id: 'npc-quest.herb-gatherer-thunder-brew',
    npcId: 'npc.herb-gatherer',
    title: '引劫护脉',
    description: '她知道你迟早要主动引劫，便要求你先证明自己有足够的药材储备去保住筋骨。',
    objective: '完成特别订单“淬体药草储备”，并主动引劫一次。',
    reward: { itemId: 'item.recipe-fragment', count: 1, willpower: 220, lifespanDays: 12 },
    isAvailable: state => npcQuestStepClaimed(state, 'npc-quest.herb-gatherer-bone-guard'),
    isComplete: state => state.flags.has(specialOrderCompleteFlag('special-order.herb-stockpile')) && state.player.heavenDebt >= 3000
  },
  {
    id: 'npc-quest.array-smith-circle-step',
    npcId: 'npc.array-smith',
    title: '近身入阵',
    description: '阵匠老陆认可了你的数理直觉，但要你先拿出足够像样的残件，证明你不是只会空谈。',
    objective: '在阵匠好感事件后，持有破损法宝 2 件与阵核 1 枚。',
    reward: { itemId: 'item.spirit-stone', count: 8, willpower: 200 },
    isAvailable: state => hasRelationshipPerk(state, 'array-smith-160'),
    isComplete: state => itemCount(state.player, 'item.broken-talisman') >= 2 && itemCount(state.player, 'item.array-core') >= 1
  },
  {
    id: 'npc-quest.array-smith-ruin-proof',
    npcId: 'npc.array-smith',
    title: '旧阵回声',
    description: '真正的阵路不在棚里，在遗迹里。你得把拆解、藏经与控场理解拼成一条自己的路。',
    objective: '完成 2 次藏经阁捐献，并完成特别订单“旧阵残件清点”。',
    reward: { itemId: 'item.array-core', count: 1, willpower: 360, bodyFoundation: 120 },
    isAvailable: state => npcQuestStepClaimed(state, 'npc-quest.array-smith-circle-step'),
    isComplete: state => archiveDonationCount(state) >= 2 && state.flags.has(specialOrderCompleteFlag('special-order.array-scrap'))
  },
  {
    id: 'npc-quest.wandering-cultivator-market-path',
    npcId: 'npc.wandering-cultivator',
    title: '散路换骨',
    description: '游方散修不在乎你有没有灵根，他只在乎你能不能拿出真货，在山谷站稳脚跟。',
    objective: '在游方散修好感事件后，持有妖兽内丹 2 枚与灵石 10 颗。',
    reward: { itemId: 'item.recipe-fragment', count: 1, bodyFoundation: 220 },
    isAvailable: state => hasRelationshipPerk(state, 'wandering-cultivator-160'),
    isComplete: state => itemCount(state.player, 'item.beast-core') >= 2 && itemCount(state.player, 'item.spirit-stone') >= 10
  },
  {
    id: 'npc-quest.wandering-cultivator-field-watch',
    npcId: 'npc.wandering-cultivator',
    title: '守田留命',
    description: '他看出你把妖兽当护田巡守的心思，于是要你先撑过一次真正的山谷风险，再谈后路。',
    objective: '完成特别订单“守田兽口粮试验”，并至少驯养 1 只巡守兽。',
    reward: { itemId: 'item.beast-core', count: 1, bodyFoundation: 260, lifespanDays: 8 },
    isAvailable: state => npcQuestStepClaimed(state, 'npc-quest.wandering-cultivator-market-path'),
    isComplete: state => state.flags.has(specialOrderCompleteFlag('special-order.beast-watch')) && state.guardBeasts.length >= 1
  },
  {
    id: 'npc-quest.wandering-cultivator-deep-road',
    npcId: 'npc.wandering-cultivator',
    title: '故交引路',
    description: '游方散修终于愿意为你这号凡骨在外面的路上押一注名声。前提是你拿得出配得上这名声的自产好货，证明你不是只会替他跑腿。',
    objective: '在游方散修深交（320）后，持有封藏灵草 2 份、灵药酒 1 壶，并把体魄练到 2000。',
    reward: { itemId: 'item.recipe-fragment', count: 2, willpower: 320, lifespanDays: 12 },
    isAvailable: state => hasRelationshipPerk(state, 'wandering-cultivator-320'),
    isComplete: state => itemCount(state.player, 'item.sealed-herb') >= 2 && itemCount(state.player, 'item.herbal-wine') >= 1 && state.player.bodyFoundation >= 2000
  },
  {
    id: 'npc-quest.herb-gatherer-voidmoss-bond',
    npcId: 'npc.herb-gatherer',
    title: '空苔养骨',
    description: '采药女把绝灵苔的不传之秘交了给你，可这味空草得你自己种出来、自己养进骨头里，才算真接得住。',
    objective: '在采药女深交（320）后，自种绝灵苔 2 份，并把体魄练到 2200。',
    reward: { itemId: 'item.sealed-herb', count: 2, bodyFoundation: 300, lifespanDays: 10 },
    isAvailable: state => hasRelationshipPerk(state, 'herb-gatherer-320'),
    isComplete: state => itemCount(state.player, 'herb.voidmoss') >= 2 && state.player.bodyFoundation >= 2200
  },
  {
    id: 'npc-quest.array-smith-formation-master',
    npcId: 'npc.array-smith',
    title: '以阵淬骨',
    description: '阵匠老陆要你把阵理从脑子吃进肉里——攒够阵材、扛住定力，他才认你这号能同参残阵的体修。',
    objective: '在阵匠深交（320）后，持有阵核 2 枚、破损法宝 3 件，定力达 1500。',
    reward: { itemId: 'item.array-core', count: 2, willpower: 400, lifespanDays: 10 },
    isAvailable: state => hasRelationshipPerk(state, 'array-smith-320'),
    isComplete: state => itemCount(state.player, 'item.array-core') >= 2 && itemCount(state.player, 'item.broken-talisman') >= 3 && state.player.willpower >= 1500
  }
];

function grantReward(state: GameState, reward: NpcQuestReward): boolean {
  if (reward.itemId && reward.count) {
    if (!mutateItem(state.player, reward.itemId, reward.count)) return false;
  }
  state.player.bodyFoundation += reward.bodyFoundation ?? 0;
  state.player.cultivation += reward.bodyFoundation ?? 0;
  state.player.willpower += reward.willpower ?? 0;
  state.player.lifespanRemainingDays += reward.lifespanDays ?? 0;
  return true;
}

function withNpcName(quest: NpcQuestDef, state: GameState, currentId: string | null): NpcQuestStatus | null {
  const npc = NPC_CATALOG.find(entry => entry.id === quest.npcId);
  if (!npc) return null;
  return {
    ...quest,
    npcName: npc.displayName,
    claimed: isNpcQuestClaimed(state, quest.id),
    available: quest.isAvailable(state),
    completed: quest.isComplete(state),
    current: currentId === quest.id
  };
}

export function getNpcQuestLine(state: GameState, npcId: string): NpcQuestStatus[] {
  const currentId = getCurrentNpcQuest(state, npcId)?.id ?? null;
  return NPC_QUEST_CATALOG.filter(quest => quest.npcId === npcId)
    .map(quest => withNpcName(quest, state, currentId))
    .filter((quest): quest is NpcQuestStatus => Boolean(quest));
}

export function getCurrentNpcQuest(state: GameState, npcId?: string): NpcQuestStatus | null {
  const candidates = npcId ? NPC_QUEST_CATALOG.filter(quest => quest.npcId === npcId) : NPC_QUEST_CATALOG;
  for (const quest of candidates) {
    if (!quest.isAvailable(state)) continue;
    if (isNpcQuestClaimed(state, quest.id)) continue;
    const status = withNpcName(quest, state, quest.id);
    if (status) return status;
  }
  return null;
}

export function claimNpcQuest(state: GameState, questId: string): NpcQuestResult {
  const quest = NPC_QUEST_CATALOG.find(entry => entry.id === questId) ?? null;
  if (!quest) return { ok: false, quest: null, reason: '无此人物委托' };
  if (!quest.isAvailable(state)) return { ok: false, quest, reason: '人物委托未解锁' };
  if (isNpcQuestClaimed(state, quest.id)) return { ok: false, quest, reason: '已领取' };
  if (!quest.isComplete(state)) return { ok: false, quest, reason: '进度未成' };
  if (!grantReward(state, quest.reward)) return { ok: false, quest, reason: '储物戒已满' };

  state.flags.add(npcQuestFlag(quest.id));
  const nextQuest = getCurrentNpcQuest(state, quest.npcId);
  const relationship = getRelationship(state, quest.npcId);
  emit(state, 'npc-quest-claim', {
    questId: quest.id,
    npcId: quest.npcId,
    npcName: NPC_CATALOG.find(entry => entry.id === quest.npcId)?.displayName ?? quest.npcId,
    title: quest.title,
    reward: quest.reward,
    affection: relationship.affection,
    nextQuestId: nextQuest?.id ?? null,
    nextQuestTitle: nextQuest?.title ?? null
  });
  return { ok: true, quest };
}
