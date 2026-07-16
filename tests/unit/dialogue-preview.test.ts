import { describe, expect, it } from 'vitest';
import type { LocationEncounter } from '@sim/world/locations';
import { buildEncounterDialogueBeat, buildRelationshipDialogueBeat } from '@app/dialoguePreview';

function encounter(overrides: Partial<LocationEncounter> = {}): LocationEncounter {
 return {
 locationId: 'valley-market',
 npcId: 'npc.wandering-cultivator',
 npcName: '游方散修',
 title: '集市看货',
 lines: ['游方散修掂着灵石，扫过你背后的药篓。', '山谷集市认货不认根骨；有草、有丹、有妖兽内丹，就能换路。'],
 birthday: false,
 ...overrides,
 };
}

describe('dialogue preview helper', () => {
 it('builds encounter dialogue beats with npc portrait assets', () => {
 expect(buildEncounterDialogueBeat('valley-market', encounter(), 2)).toMatchObject({
 id: 'encounter-valley-market-npc.wandering-cultivator-2',
 lines: [
 '游方散修·集市看货',
 '游方散修掂着灵石，扫过你背后的药篓。',
 '山谷集市认货不认根骨；有草、有丹、有妖兽内丹，就能换路。',
 '现在可做：去集市交易或委托板，把手头灵草、丹药和兽核变成后路。',
 ],
 assetId: 'sprite.npc.wandering-cultivator',
 });
 });

it('adds actionable fallback guidance for encounters without a bespoke branch', () => {
 expect(buildEncounterDialogueBeat('farmstead', encounter({
 locationId: 'farmstead',
 npcId: 'npc.unknown',
 npcName: '陌生修士',
 title: '短暂停步',
 lines: ['他在田埂边停下脚步。'],
 }), 1)).toMatchObject({
 id: 'encounter-farmstead-npc.unknown-1',
 lines: [
 '陌生修士·短暂停步',
 '他在田埂边停下脚步。',
 '现在可做：先记住陌生修士今日在此，围绕这条动线安排接下来的半天。',
 ],
 assetId: undefined,
 });
 });

it('uses preview-only npc portraits for ambient town figures when ids are provided outside the sim catalog', () => {
 expect(buildEncounterDialogueBeat('tea-shed', encounter({
 locationId: 'tea-shed',
 npcId: 'npc.tea-shed-elder',
 npcName: '茶棚老人',
 title: '守棚添茶',
 lines: ['他把茶壶放回炉边，抬手示意你坐下。'],
 }), 3)).toMatchObject({
 id: 'encounter-tea-shed-npc.tea-shed-elder-3',
 assetId: 'sprite.npc.tea-shed-elder',
 });
 });

it('builds relationship dialogue beats from explicit npc ids', () => {
 const npcNameToId = new Map([['采药女', 'npc.herb-gatherer']]);

expect(buildRelationshipDialogueBeat({
 id: 'herb-gatherer-160',
 npcId: 'npc.herb-gatherer',
 npcName: '采药女',
 title: '药性护骨',
 lines: ['她开始教你辨别哪些灵草适合天劫前温骨。'],
 }, npcNameToId)).toMatchObject({
 id: 'herb-gatherer-160',
 lines: [
 '采药女·药性护骨',
 '她开始教你辨别哪些灵草适合天劫前温骨。',
 '现在可做：去露根药圃补露根草和雾蕨，再把体魄练到 1200。',
 ],
 assetId: 'sprite.npc.herb-gatherer',
 });
 });

it('falls back to npc name lookup when payload omits npc id', () => {
 const npcNameToId = new Map([['阵匠老陆', 'npc.array-smith']]);

expect(buildRelationshipDialogueBeat({
 id: 'array-smith-160',
 npcName: '阵匠老陆',
 title: '阵中近身',
 lines: ['他认可了你把数理直觉用于阵纹反推的路子。'],
 }, npcNameToId).assetId).toBe('sprite.npc.array-smith');
 });

it('degrades cleanly when neither npc id nor name mapping is available', () => {
 const npcNameToId = new Map<string, string>();

expect(buildRelationshipDialogueBeat({
 id: 'unknown-event',
 npcName: '陌生修士',
 title: '擦肩而过',
 lines: ['他没有留下姓名。'],
 }, npcNameToId)).toMatchObject({
 id: 'unknown-event',
 lines: ['陌生修士·擦肩而过', '他没有留下姓名。'],
 assetId: undefined,
 });
 });

it('falls back to preview-only npc name mapping for relationship-style dialogue payloads', () => {
 const npcNameToId = new Map<string, string>();

expect(buildRelationshipDialogueBeat({
 id: 'tea-shed-elder-rumor',
 npcName: '茶棚老人',
 title: '冬夜茶讯',
 lines: ['他提醒你，今夜山口风紧，最好先稳住棚温。'],
 }, npcNameToId).assetId).toBe('sprite.npc.tea-shed-elder');
 });
});
