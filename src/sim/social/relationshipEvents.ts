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
 lines: [
 '游方散修把摊布往你这边挪了半尺。',
 '「灵根是宗门的门票，路却不只一条。你若以药草、兽核和丹丸换消息，山谷集市会认你这个人。」',
 '从今日起，他会更认真地替你留意散修交易中的炼体线索。',
 ],
 },
 {
 id: 'herb-gatherer-160',
 npcId: 'npc.herb-gatherer',
 affectionRequired: 160,
 title: '药性护骨',
 lines: [
 '采药女把一束露根草按药性分成三份。',
 '「炼体不是把疼痛硬吞下去。药性接得上，淬体才是淬体；接不上，只是受伤。」',
 '她开始教你辨别哪些灵草适合天劫前温骨，哪些只适合炼丹。',
 ],
 },
 {
 id: 'array-smith-160',
 npcId: 'npc.array-smith',
 affectionRequired: 160,
 title: '阵中近身',
 lines: [
 '阵匠老陆用石子在地上排出一圈阵位。',
 '「体修手短，那就让敌人自己进圈。阵法不是灵修专利，算得清、站得稳，凡骨也能控场。」',
 '他认可了你把数理直觉用于阵纹反推的路子。',
 ],
 },
];

export function relationshipEventFlag(eventId: string): string {
 return FLAG_PREFIX + eventId;
}

function withNpcName(event: RelationshipEventDef): RelationshipEvent | null {
 const npc = NPC_CATALOG.find((entry) => entry.id === event.npcId);
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
 return RELATIONSHIP_EVENT_CATALOG
 .filter((event) => (npcId ? event.npcId === npcId : true))
 .filter((event) => !isRelationshipEventSeen(state, event.id))
 .filter((event) => getRelationship(state, event.npcId).affection >= event.affectionRequired)
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
