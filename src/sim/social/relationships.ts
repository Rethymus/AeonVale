/**
 * NPC 好感：固定角色 + 每日送礼限制 + 偏好礼物。
 * 这是 Stardew 式社交循环的最小骨架，后续可挂剧情、坊市折扣与事件邀约。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { itemCount, mutateItem } from '@sim/world/player';
import type { Season } from '@sim/world/types';

export interface NpcDef {
  id: string;
  displayName: string;
  role: string;
  birthday: { season: Season; day: number };
  schedule: readonly NpcScheduleRule[];
  loved: readonly string[];
  likedPrefixes: readonly string[];
}

export interface NpcScheduleRule {
  season?: Season;
  location: string;
  activity: string;
}

export interface NpcDailySchedule {
  npc: NpcDef;
  location: string;
  activity: string;
  birthday: boolean;
}

export interface RelationshipState {
  affection: number;
  lastGiftDay: number;
}

export interface GiftResult {
  ok: boolean;
  npc: NpcDef | null;
  affectionGain: number;
  birthday: boolean;
  reason?: string;
}

export const NPC_CATALOG: readonly NpcDef[] = [
  {
    id: 'npc.wandering-cultivator',
    displayName: '游方散修',
    role: '交易',
    birthday: { season: 'spring', day: 18 },
    schedule: [
      { season: 'spring', location: '山谷集市', activity: '收购新芽与散修杂货' },
      { season: 'summer', location: '残脉入口', activity: '等候换取残脉见闻' },
      { season: 'autumn', location: '山谷集市', activity: '摆摊换取兽核与灵石' },
      { season: 'winter', location: '旧茶棚', activity: '讲述远方宗门传闻' }
    ],
    loved: ['item.spirit-stone', 'item.beast-core'],
    likedPrefixes: ['pill.']
  },
  {
    id: 'npc.herb-gatherer',
    displayName: '采药女',
    role: '灵草',
    birthday: { season: 'summer', day: 8 },
    schedule: [
      { season: 'spring', location: '露根药圃', activity: '辨认新生灵草' },
      { season: 'summer', location: '溪边药田', activity: '采集盛夏药露' },
      { season: 'autumn', location: '晾晒架旁', activity: '分拣秋收药材' },
      { season: 'winter', location: '暖棚', activity: '照看过冬灵苗' }
    ],
    loved: ['herb.dewroot', 'herb.mistfern'],
    likedPrefixes: ['herb.', 'seed.']
  },
  {
    id: 'npc.array-smith',
    displayName: '阵匠老陆',
    role: '阵法',
    birthday: { season: 'autumn', day: 22 },
    schedule: [
      { season: 'spring', location: '阵器棚', activity: '修补农庄小阵' },
      { season: 'summer', location: '矿石坡', activity: '挑选导雷金石' },
      { season: 'autumn', location: '阵器棚', activity: '打磨阵核与符炉' },
      { season: 'winter', location: '遗迹门口', activity: '测绘旧阵残纹' }
    ],
    loved: ['item.recipe-fragment', 'item.broken-talisman'],
    likedPrefixes: ['item.']
  }
];

export function ensureSocialState(state: GameState): Record<string, RelationshipState> {
  state.social ??= {};
  return state.social;
}

export function getRelationship(state: GameState, npcId: string): RelationshipState {
  const social = ensureSocialState(state);
  social[npcId] ??= { affection: 0, lastGiftDay: 0 };
  return social[npcId]!;
}

export function getNpcList(state: GameState): Array<NpcDef & RelationshipState> {
  return NPC_CATALOG.map(npc => ({ ...npc, ...(state.social?.[npc.id] ?? { affection: 0, lastGiftDay: 0 }) }));
}

export function isNpcBirthday(state: GameState, npc: NpcDef): boolean {
  return npc.birthday.season === state.season && npc.birthday.day === state.seasonDay;
}

export function npcScheduleForDay(state: GameState, npcId: string): NpcDailySchedule | null {
  const npc = NPC_CATALOG.find(entry => entry.id === npcId) ?? null;
  if (!npc) return null;
  if (state.activeEvent?.defId?.endsWith('-festival')) {
    return { npc, location: '节日会场', activity: `参与${state.activeEvent.displayName}`, birthday: isNpcBirthday(state, npc) };
  }
  const rule = npc.schedule.find(entry => entry.season === state.season) ?? npc.schedule[0];
  if (!rule) return { npc, location: '山谷', activity: '处理杂务', birthday: isNpcBirthday(state, npc) };
  return { npc, location: rule.location, activity: rule.activity, birthday: isNpcBirthday(state, npc) };
}

export function getNpcDailySchedules(state: GameState): NpcDailySchedule[] {
  return NPC_CATALOG.map(npc => npcScheduleForDay(state, npc.id)).filter((entry): entry is NpcDailySchedule => Boolean(entry));
}

function giftValue(npc: NpcDef, itemId: string): number {
  if (npc.loved.includes(itemId)) return 80;
  if (npc.likedPrefixes.some(prefix => itemId.startsWith(prefix))) return 35;
  return 10;
}

export function giveGift(state: GameState, npcId: string, itemId: string): GiftResult {
  const npc = NPC_CATALOG.find(entry => entry.id === npcId) ?? null;
  if (!npc) return { ok: false, npc: null, affectionGain: 0, birthday: false, reason: '无此人物' };
  const rel = getRelationship(state, npc.id);
  const birthday = isNpcBirthday(state, npc);
  if (rel.lastGiftDay === state.day) return { ok: false, npc, affectionGain: 0, birthday, reason: '今日已赠礼' };
  if (itemCount(state.player, itemId) <= 0) return { ok: false, npc, affectionGain: 0, birthday, reason: '物品不足' };

  mutateItem(state.player, itemId, -1);
  const affectionGain = giftValue(npc, itemId) * (birthday ? 2 : 1);
  rel.affection = Math.min(1000, rel.affection + affectionGain);
  rel.lastGiftDay = state.day;
  emit(state, 'gift', { npcId: npc.id, itemId, affectionGain, affection: rel.affection, birthday });
  return { ok: true, npc, affectionGain, birthday };
}

export function bestGiftItemForNpc(state: GameState, npcId: string): string | null {
  const npc = NPC_CATALOG.find(entry => entry.id === npcId);
  if (!npc) return null;
  for (const itemId of npc.loved) if (itemCount(state.player, itemId) > 0) return itemId;
  for (const itemId of Object.keys(state.player.inventory)) {
    if (npc.likedPrefixes.some(prefix => itemId.startsWith(prefix)) && itemCount(state.player, itemId) > 0) return itemId;
  }
  return null;
}
