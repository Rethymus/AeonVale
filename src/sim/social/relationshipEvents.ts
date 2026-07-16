import type { GameState } from '@sim/world/state';
import { getRelationship, NPC_CATALOG } from './relationships';

export interface RelationshipEventDef {
  id: string;
  npcId: string;
  affectionRequired: number;
  title: string;
  lines: readonly string[];
}

export interface RelationshipEvent extends RelationshipEventDef {
  npcName: string;
}

const FLAG_PREFIX = 'rel-event:';

export const RELATIONSHIP_EVENT_CATALOG: readonly RelationshipEventDef[] = [
  {
    id: 'wandering-cultivator-160',
    npcId: 'npc.wandering-cultivator',
    affectionRequired: 160,
    title: '市井换路',
    lines: ['游方散修把摊布往你这边挪了半尺。', '「灵根是宗门的门票，路却不只一条。你若以药草、兽核和丹丸换消息，山谷集市会认你这个人。」', '从今日起，他会更认真地替你留意散修交易中的炼体线索。']
  },
  {
    id: 'wandering-cultivator-320',
    npcId: 'npc.wandering-cultivator',
    affectionRequired: 320,
    title: '故交通衢',
    lines: ['游方散修收起了那套客气话，把你让到摊后，翻出一只压箱底的旧锦匣。', '「能在山谷站稳脚跟的凡骨，他见过的不多。封藏灵草、自酿药酒这些自家好货，往后他按故交的价收——只认货，不认灵根。」', '这不再是散仙与散仙的客气，而是把后路交托一点的信任。']
  },
  {
    id: 'herb-gatherer-160',
    npcId: 'npc.herb-gatherer',
    affectionRequired: 160,
    title: '药性护骨',
    lines: ['采药女把一束露根草按药性分成三份。', '「炼体不是把疼痛硬吞下去。药性接得上，淬体才是淬体；接不上，只是受伤。」', '她开始教你辨别哪些灵草适合天劫前温骨，哪些只适合炼丹。']
  },
  {
    id: 'herb-gatherer-320',
    npcId: 'npc.herb-gatherer',
    affectionRequired: 320,
    title: '药引同道',
    lines: ['采药女把你领进暖棚最深处，掀开一领旧蒲席，底下是一蓬灰白、几乎不吸灵气的苔。', '「这是绝灵苔——空亦有空之用。你那身空灵根的底子，正该用它来养，而不是硬填。」', '她把留种的绝灵苔分了你一捧，这是只传同道的不传之秘。']
  },
  {
    id: 'array-smith-160',
    npcId: 'npc.array-smith',
    affectionRequired: 160,
    title: '阵中近身',
    lines: ['阵匠老陆用石子在地上排出一圈阵位。', '「体修手短，那就让敌人自己进圈。阵法不是灵修专利，算得清、站得稳，凡骨也能控场。」', '他认可了你把数理直觉用于阵纹反推的路子。']
  },
  {
    id: 'array-smith-320',
    npcId: 'npc.array-smith',
    affectionRequired: 320,
    title: '阵骨同参',
    lines: ['阵匠老陆把你领到遗迹最深的那面残阵前，把炭笔塞进你手里，让你接着他描的那半道阵纹往下画。', '「阵路这东西，到了骨头里就不是灵修那套定式了。你能把雷引进田里护苗，就能把阵理吃进肉里——这叫以阵淬骨。」', '他不再把你当客人，而是当个能一起描残阵的同参。']
  }
];

export function relationshipEventFlag(eventId: string): string {
  return FLAG_PREFIX + eventId;
}

function withNpcName(event: RelationshipEventDef): RelationshipEvent | null {
  const npc = NPC_CATALOG.find(entry => entry.id === event.npcId);
  if (!npc) return null;
  return { ...event, npcName: npc.displayName };
}

export function isRelationshipEventSeen(state: GameState, eventId: string): boolean {
  return state.flags.has(relationshipEventFlag(eventId));
}

export function markRelationshipEventSeen(state: GameState, eventId: string): void {
  state.flags.add(relationshipEventFlag(eventId));
}

export function availableRelationshipEvents(state: GameState, npcId?: string): RelationshipEvent[] {
  return RELATIONSHIP_EVENT_CATALOG.filter(event => (npcId ? event.npcId === npcId : true))
    .filter(event => !isRelationshipEventSeen(state, event.id))
    .filter(event => getRelationship(state, event.npcId).affection >= event.affectionRequired)
    .map(withNpcName)
    .filter((event): event is RelationshipEvent => Boolean(event));
}

export function nextRelationshipEvent(state: GameState, npcId?: string): RelationshipEvent | null {
  return availableRelationshipEvents(state, npcId)[0] ?? null;
}

export function claimRelationshipEvent(state: GameState, npcId?: string): RelationshipEvent | null {
  const event = nextRelationshipEvent(state, npcId);
  if (!event) return null;
  markRelationshipEventSeen(state, event.id);
  return event;
}

export function hasRelationshipPerk(state: GameState, eventId: string): boolean {
  return isRelationshipEventSeen(state, eventId);
}
