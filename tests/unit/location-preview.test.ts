import { describe, expect, it } from 'vitest';
import { Texture } from 'pixi.js';
import { buildLocationPreviewSummary, calendarSummaryToastPresentation, describeLocationSelectionSummary, EXTRA_NPC_PREVIEW_ASSET_IDS, legacyConfirmUnavailableToastPresentation, locationDirectoryEmptyToastPresentation, locationEncounterUnavailableToastPresentation, locationPreviewAssetId, locationPreviewNpcIds, locationPreviewPortraitAssetIds, locationPreviewPortraits, locationPreviewSummaryContext, locationPreviewThreadLocationId, locationSelectionToastPresentation, locationServiceActorAssetId, locationServiceUnavailableToastPresentation, locationShortcutFailureToastPresentation, npcPortraitAssetId, previewNpcPortraitAssetId, previewNpcPortraitAssetIdFromName, LOCATION_PREVIEW_LOCATION_IDS, NPC_PREVIEW_IDS } from '@app/locationPreview';
import { LOCATION_CATALOG, NPC_CATALOG, type CalendarEntry } from '@sim';
import type { LocationEncounter, LocationServiceOption, LocationStatus } from '@sim/world/locations';
import { locationPreviewFocusReason } from '@app/locationFocusReason';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { stageQiCap } from '@sim/progression/progression';

function location(overrides: Partial<LocationStatus> = {}): LocationStatus {
 return {
 id: 'valley-market',
 displayName: '山谷集市',
 description: '散修、商贩与委托汇聚之处。',
 services: ['shop', 'trade', 'commission-board'],
 active: true,
 npcs: [],
 serviceLabels: ['商店'],
 closedServiceLabels: [],
 ...overrides,
 };
}

function service(overrides: Partial<LocationServiceOption> = {}): LocationServiceOption {
 return {
 locationId: 'valley-market',
 service: 'shop',
 label: '商店',
 command: 'browse-shop',
 commandLabel: '浏览商店',
 ...overrides,
 };
}

function encounter(overrides: Partial<LocationEncounter> = {}): LocationEncounter {
 return {
 locationId: 'valley-market',
 npcId: 'npc.wandering-cultivator',
 npcName: '游方散修',
 title: '游方散修：集市看货',
 lines: ['游方散修掂着灵石，扫过你背后的药篓。', '山谷集市认货不认根骨；有草、有丹、有妖兽内丹，就能换路。'],
 birthday: false,
 ...overrides,
 };
}

describe('location preview helper', () => {
 it('maps supported location ids to loc asset ids', () => {
 expect(locationPreviewAssetId('farmstead')).toBe('loc.farmstead');
 expect(locationPreviewAssetId('valley-market')).toBe('loc.valley-market');
 expect(locationPreviewAssetId('ore-slope')).toBe('loc.ore-slope');
 });

it('anchors location shortcut failures to the target location asset', () => {
 expect(locationShortcutFailureToastPresentation('valley-market', '山谷集市今日无交易可看')).toEqual({
 message: '山谷集市今日无交易可看',
 assetId: 'loc.valley-market',
 });
 expect(locationShortcutFailureToastPresentation('ruin-gate', '遗迹今日不可深入')).toEqual({
 message: '遗迹今日不可深入',
 assetId: 'loc.ruin-gate',
 });
 expect(locationShortcutFailureToastPresentation('spirit-vein', '残脉入口今日不可探查')).toEqual({
 message: '残脉入口今日不可探查',
 assetId: 'loc.spirit-vein',
 });
 });

it('derives shortcut failure guidance from current state for market and exploration routes', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 7, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });

state.activeEvent = {
 defId: 'event.spring-festival',
 displayName: '春集节',
 daysLeft: 1,
 growthMod: 1,
 qiMod: 1,
 };

expect(locationShortcutFailureToastPresentation('valley-market', state, 'browse-shop')).toEqual({
 message: '集市今日随节停市｜先去会场看当期货与事务',
 assetId: 'loc.valley-market',
 });

state.activeEvent = null;
 state.seasonDay = 7;

expect(locationShortcutFailureToastPresentation('valley-market', state, 'browse-trade')).toEqual({
 message: '集市今日盘账歇市｜先把待卖货整好，明日再来',
 assetId: 'loc.valley-market',
 });

expect(locationShortcutFailureToastPresentation('ruin-gate', state, 'delve-ruin')).toEqual({
 message: '遗迹今日不可深入｜先补足体力、丹药与阵材，再压深层',
 assetId: 'loc.ruin-gate',
 });

expect(locationShortcutFailureToastPresentation('spirit-vein', state, 'explore-spirit-vein')).toEqual({
 message: '残脉入口今日不可探查｜先把补给、药材和脚下农务稳住',
 assetId: 'loc.spirit-vein',
 });
 });

it('keeps exploration shortcut failures tied to cultivation prep resources', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 81, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });

expect(locationShortcutFailureToastPresentation('ruin-gate', state, 'explore-ruin').message).toContain('补种补材');
 expect(locationShortcutFailureToastPresentation('ruin-gate', state, 'delve-ruin').message).toContain('丹药与阵材');
 expect(locationShortcutFailureToastPresentation('spirit-vein', state, 'explore-spirit-vein').message).toContain('补给、药材');
 });

it('keeps shortcut failure guidance aligned with onboarding route locks', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 8, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });

state.player.flags.add('onboarding-first-shipping-settlement');
 expect(locationShortcutFailureToastPresentation('valley-outskirts', state, 'explore-valley')).toEqual({
 message: '当前先去集市补种｜外出探索放到补种和资源循环之后',
 assetId: 'loc.valley-outskirts',
 });

state.player.flags.add('onboarding-first-market-restock');
 expect(locationShortcutFailureToastPresentation('ruin-gate', state, 'explore-ruin')).toEqual({
 message: '当前先回农庄补播｜先把第二轮药材种回田里再外出',
 assetId: 'loc.ruin-gate',
 });
 });

it('derives preview location ids from the shared location catalog', () => {
 expect(LOCATION_PREVIEW_LOCATION_IDS).toEqual(LOCATION_CATALOG.map((location) => location.id));
 });

it('maps supported npc ids to sprite asset ids', () => {
 expect(npcPortraitAssetId('npc.wandering-cultivator')).toBe('sprite.npc.wandering-cultivator');
 expect(npcPortraitAssetId('npc.herb-gatherer')).toBe('sprite.npc.herb-gatherer');
 expect(npcPortraitAssetId('npc.array-smith')).toBe('sprite.npc.array-smith');
 expect(npcPortraitAssetId('npc.unknown')).toBeUndefined;
 });

it('resolves preview-only npc ids and names into portrait assets', () => {
 expect(previewNpcPortraitAssetId('npc.market-merchant')).toBe('sprite.npc.market-merchant');
 expect(previewNpcPortraitAssetId('sprite.npc.patrol-guard')).toBe('sprite.npc.patrol-guard');
 expect(previewNpcPortraitAssetIdFromName('茶棚老人')).toBe('sprite.npc.tea-shed-elder');
 expect(previewNpcPortraitAssetIdFromName('陌生修士')).toBeUndefined;
 });

it('derives preview npc ids from the shared npc catalog', () => {
 expect(NPC_PREVIEW_IDS).toEqual(NPC_CATALOG.map((npc) => npc.id));
 expect(NPC_PREVIEW_IDS.map((npcId) => npcPortraitAssetId(npcId))).toEqual([
 'sprite.npc.wandering-cultivator',
 'sprite.npc.herb-gatherer',
 'sprite.npc.array-smith',
 ]);
 });

it('locks the extra preview-only npc asset ids used by high-frequency surfaces', () => {
 expect(EXTRA_NPC_PREVIEW_ASSET_IDS).toEqual([
 'sprite.npc.market-merchant',
 'sprite.npc.tea-shed-elder',
 'sprite.npc.processing-artisan',
 'sprite.npc.patrol-guard',
 ]);
 });

it('maps person-led location services to shared actor portraits', () => {
 expect(locationServiceActorAssetId('browse-shop')).toBe('sprite.npc.market-merchant');
 expect(locationServiceActorAssetId('browse-trade')).toBe('sprite.npc.market-merchant');
 expect(locationServiceActorAssetId('browse-festival-stall')).toBe('sprite.npc.market-merchant');
 expect(locationServiceActorAssetId('show-tea-shed')).toBe('sprite.npc.tea-shed-elder');
 expect(locationServiceActorAssetId('show-greenhouse')).toBe('sprite.npc.herb-gatherer');
 expect(locationServiceActorAssetId('show-farm-work')).toBeUndefined;
 });

it('resolves visible npc names into preview npc ids in order', () => {
 const npcNameToId = new Map([
 ['游方散修', 'npc.wandering-cultivator'],
 ['采药女', 'npc.herb-gatherer'],
 ]);

expect(locationPreviewNpcIds(location({ npcs: ['游方散修', '采药女', '不存在'] }), npcNameToId)).toEqual([
 'npc.wandering-cultivator',
 'npc.herb-gatherer',
 ]);
 });

it('prefers real npc portraits and appends conservative location fallbacks', () => {
 const assetIds = locationPreviewPortraitAssetIds(
 location({ id: 'valley-market', npcs: ['游方散修'] }),
 ['npc.wandering-cultivator'],
 );

expect(assetIds).toEqual([
 'sprite.npc.wandering-cultivator',
 'sprite.npc.market-merchant',
 'sprite.npc.patrol-guard',
 ]);
 });

it('uses location-specific fallback portraits when no sim-backed npc portrait is available', () => {
 expect(locationPreviewPortraitAssetIds(location({ id: 'tea-shed' }), [])).toEqual(['sprite.npc.tea-shed-elder']);
 expect(locationPreviewPortraitAssetIds(location({ id: 'drying-yard' }), [])).toEqual(['sprite.npc.processing-artisan']);
 expect(locationPreviewPortraitAssetIds(location({ id: 'herb-plot' }), [])).toEqual(['sprite.npc.herb-gatherer']);
 expect(locationPreviewPortraitAssetIds(location({ id: 'greenhouse' }), [])).toEqual(['sprite.npc.herb-gatherer']);
 expect(locationPreviewPortraitAssetIds(location({ id: 'array-shed' }), [])).toEqual(['sprite.npc.array-smith']);
 });

it('picks primary and secondary portrait textures with graceful fallback', () => {
 const primary = Texture.EMPTY;
 const secondary = new Texture({ source: Texture.EMPTY.source });
 const portraits = locationPreviewPortraits(
 ['sprite.npc.wandering-cultivator', 'sprite.npc.herb-gatherer', 'sprite.npc.array-smith'],
 {
 'sprite.npc.wandering-cultivator': primary,
 'sprite.npc.herb-gatherer': secondary,
 },
 );

expect(portraits).toEqual({ primary, secondary });
 });

it('builds actionable preview summary with service and encounter highlights', () => {
 const summary = buildLocationPreviewSummary({
 location: location(),
 services: [service(), service({ service: 'trade', label: '交易', command: 'browse-trade', commandLabel: '查看交易' })],
 selectedService: service(),
 encounters: [encounter()],
 npcSignals: {
 birthdayNames: [],
 questNames: [],
 questReadyNames: [],
 },
 actionSignalLine: '要务：出货箱待结 2 项',
 focusReason: '先补几颗种子，把第二轮药材和炼丹材料接上。',
 });

expect(summary).toBe([
 '散修、商贩与委托汇聚之处。',
 '当前：商店 -> 浏览商店',
 '现在来：先补几颗种子，把第二轮药材和炼丹材料接上。',
 '动向：今日以常规来往为主',
 '要务：出货箱待结 2 项',
 '可选：1. 商店 / 2. 交易',
 '人物：游方散修｜游方散修掂着灵石，扫过你背后的药篓。',
 '偶遇：游方散修：集市看货｜山谷集市认货不认根骨；有草、有丹、有妖兽内丹，就能换路。',
 'Shift+数字选地点｜数字选服务｜空格/E/回车确认',
 ].join('\n'));
 });

it('includes farmstead action signals when the location has immediate logistics work', () => {
 const summary = buildLocationPreviewSummary({
 location: location({ id: 'farmstead', displayName: '农庄', description: '主角以凡骨苦练、种灵草与炼体的据点。' }),
 services: [service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' })],
 selectedService: service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 encounters: [],
 npcSignals: {
 birthdayNames: [],
 questNames: [],
 questReadyNames: [],
 },
 actionSignalLine: '要务：待收设施 1 座｜出货箱待结 2 项',
 });

expect(summary).toContain('要务：待收设施 1 座｜出货箱待结 2 项');
 });

it('makes the farmstead focus reason follow the same actionable logistics pressure as other P0 surfaces', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 88, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

state.shippingBin['herb.mossling'] = 1;
 expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '昨夜回款还挂在箱里，先回农庄把出货结清。',
 );

state.shippingBin['herb.mossling'] = 0;
 state.storage.capacity = 1;
 state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 1 };
 expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '仓储已经顶满，先回去清仓再安排采收与外出。',
 );
 });

it('makes the farmstead focus reason follow field-level urgency before generic farm entry copy', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 89, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const tile = state.tiles[0]!;

tile.tilled = true;
 tile.cropId = tile.id;
 state.crops.set(tile.id, {
 id: tile.id,
 defId: 'herb.mossling',
 tileId: tile.id,
 growth: 30_000,
 health: 100_000,
 stage: 'growing',
 plantedDay: state.day,
 property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
 tempered: false,
 });
 tile.wateredToday = false;
 tile.moisture = 10_000;

expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '有 1 块灵田正缺水，先回农庄把当日水路补稳。',
 );

tile.wateredToday = true;
 tile.moisture = 60_000;
 tile.channeledToday = false;
 tile.qiDensity = 10_000;

expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '有 1 块灵田灵气偏弱，回去补灵后生长才稳。',
 );

state.crops.clear();
 tile.cropId = null;
 tile.tilled = false;
 tile.blockType = 'none';
 tile.soilType = 'scorched';

expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '昨夜还留着 1 块焦土地，先回去把田面翻新。',
 );
 });

it('maps farmstead root preview threads to the shared focus location while keeping non-root services anchored', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 90, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const tile = state.tiles[0]!;

tile.tilled = true;
 tile.cropId = tile.id;
 state.crops.set(tile.id, {
 id: tile.id,
 defId: 'herb.mossling',
 tileId: tile.id,
 growth: 100_000,
 health: 100_000,
 stage: 'mature',
 plantedDay: state.day,
 property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
 tempered: false,
 });

expect(locationPreviewThreadLocationId(state, 'farmstead', 'show-farm-work')).toBe('herb-plot');
 expect(locationPreviewThreadLocationId(state, 'farmstead', null)).toBe('herb-plot');
 expect(locationPreviewThreadLocationId(state, 'farmstead', 'show-processing')).toBe('farmstead');
 expect(locationPreviewThreadLocationId(state, 'farmstead', 'show-arrays')).toBe('farmstead');
 expect(locationPreviewThreadLocationId(state, 'valley-market', 'browse-shop')).toBe('valley-market');
 });

it('routes the farmstead root preview thread to the array-shed when breakthrough is ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 91, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1;
 state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
 state.player.cultivation = state.player.bodyFoundation;

expect(locationPreviewThreadLocationId(state, 'farmstead', 'show-farm-work')).toBe('array-shed');
 expect(locationPreviewThreadLocationId(state, 'farmstead', null)).toBe('array-shed');
 expect(locationPreviewThreadLocationId(state, 'farmstead', 'show-processing')).toBe('farmstead');
 });

it('switches the farmstead root focus reason to tribulation-prep guidance when breakthrough is ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 92, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1;
 state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
 state.player.cultivation = state.player.bodyFoundation;

expect(locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0)).toBe(
 '体魄已至极限，缺避雷丹｜阵法未成(0/2)｜准备度0%｜先补避雷丹与两座阵法。',
 );
 });

it('switches farmstead root preview summaries onto the array-shed thread when breakthrough is ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 95, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1;
 state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
 state.player.cultivation = state.player.bodyFoundation;

const ctx = locationPreviewSummaryContext(
 state,
 location({ id: 'farmstead', displayName: '农庄', description: '主角以凡骨苦练、种灵草与炼体的据点。' }),
 [service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' })],
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 [],
 );

expect(ctx.location.id).toBe('array-shed');
 expect(ctx.location.displayName).toBe('阵器棚');
 expect(ctx.selectedService).toMatchObject({ command: 'show-arrays', label: '阵法布设', commandLabel: '查看阵法' });
 expect(ctx.command).toBe('show-arrays');
 expect(ctx.services.map((entry) => entry.command)).toEqual(['show-arrays']);
 });

it('falls back cleanly when no service or encounter is available', () => {
 const summary = buildLocationPreviewSummary({
 location: location({ npcs: [] }),
 services: [],
 selectedService: null,
 encounters: [],
 });

expect(summary).toBe([
 '散修、商贩与委托汇聚之处。',
 '当前：先回农庄收口',
 '动向：今日以常规来往为主',
 '可选：今日先回农庄收口农务与修行资源',
 '人物：今日先按当前地点动线推进',
 '偶遇：今日先按农务与地点动线推进',
 'Shift+数字选地点｜数字选服务｜空格/E/回车确认',
 ].join('\n'));
 });

it('keeps encounter-only preview summaries route-aware instead of falling back to empty service text', () => {
 const summary = buildLocationPreviewSummary({
 location: location({ id: 'herb-plot', displayName: '露根药圃', description: '春日辨草与低阶灵苗的常见去处。' }),
 services: [],
 selectedService: null,
 encounters: [encounter({
 locationId: 'herb-plot',
 npcId: 'npc.herb-gatherer',
 npcName: '采药女',
 title: '采药女：辨认春苗',
 lines: ['采药女蹲在垄边辨叶，顺手把几株幼苗扶正。', '先记住她今日停在哪，再决定要不要顺路过去。'],
 })],
 });

expect(summary).toBe([
 '春日辨草与低阶灵苗的常见去处。',
 '当前：先看行踪',
 '动向：今日以常规来往为主',
 '可选：今日先看行踪，再决定要不要跟进',
 '人物：采药女｜采药女蹲在垄边辨叶，顺手把几株幼苗扶正。',
 '偶遇：采药女：辨认春苗｜先记住她今日停在哪，再决定要不要顺路过去。',
 'Shift+数字选地点｜数字选服务｜空格/E/回车确认',
 ].join('\n'));
 });

it('prioritizes quest-ready and birthday signals in location preview summary', () => {
 const summary = buildLocationPreviewSummary({
 location: location({ id: 'creek-field', displayName: '溪边药田', description: '盛夏药露与采补动线都在这里接续。' }),
 services: [service({ locationId: 'creek-field', label: '偶遇', service: 'encounter', command: 'show-location-encounter', commandLabel: '查看偶遇' })],
 selectedService: service({ locationId: 'creek-field', label: '偶遇', service: 'encounter', command: 'show-location-encounter', commandLabel: '查看偶遇' }),
 encounters: [encounter({
 locationId: 'creek-field',
 npcId: 'npc.herb-gatherer',
 npcName: '采药女',
 title: '采药女：采集盛夏药露',
 lines: ['溪边药田水汽很重，采药女把药露收入小瓶。', '若有合适礼物，今日赠出，情分会记得更深。'],
 birthday: true,
 })],
 npcSignals: {
 birthdayNames: ['采药女'],
 questNames: ['采药女'],
 questReadyNames: ['采药女'],
 },
 });

expect(summary).toContain('动向：采药女 的人物差事可领取');
 });

it('builds selection toast presentation with service-specific hero asset when available', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'tea-shed', displayName: '旧茶棚', npcs: ['守茶翁'] }),
 service({
 locationId: 'tea-shed',
 service: 'tea-rest',
 label: '歇脚听闻',
 command: 'show-tea-shed',
 commandLabel: '歇脚听闻',
 }),
 '空格/E/回车执行·Esc返回',
 )).toEqual({
 message: '服务：旧茶棚（歇脚听闻：歇脚听闻；守茶翁）｜空格/E/回车执行·Esc返回',
 assetId: 'sprite.npc.tea-shed-elder',
 });
 });

it('uses npc-backed hero assets for person-led service entries while keeping place-thread routing intact', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'valley-market', displayName: '山谷集市' }),
 service({ locationId: 'valley-market', service: 'shop', label: '商店', command: 'browse-shop', commandLabel: '浏览商店' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('sprite.npc.market-merchant');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'greenhouse', displayName: '暖棚' }),
 service({ locationId: 'greenhouse', service: 'greenhouse-tending', label: '暖棚养护', command: 'show-greenhouse', commandLabel: '查看暖棚' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('sprite.npc.herb-gatherer');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'festival-ground', displayName: '节庆会场' }),
 service({ locationId: 'festival-ground', service: 'festival-stall', label: '摊位', command: 'browse-festival-stall', commandLabel: '浏览摊位' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('sprite.npc.market-merchant');
 });

it('includes a concise why-now reason in selection toasts when a focus reason is available', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'valley-market', displayName: '山谷集市' }),
 service({ locationId: 'valley-market', service: 'shop', label: '商店', command: 'browse-shop', commandLabel: '浏览商店' }),
 '空格/E/回车执行·Esc返回',
 '先补几颗种子，把第二轮药材和炼丹材料接上。',
 )).toEqual({
 message: '服务：山谷集市（商店：浏览商店）｜现在来：先补几颗种子，把第二轮药材和炼丹材料接上。｜空格/E/回车执行·Esc返回',
 assetId: 'sprite.npc.market-merchant',
 });
 });

it('uses stateful why-now guidance for tea shed entries instead of generic flavor text', () => {
 const { state } = (() => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 96, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 return { state };
 })();

expect(locationPreviewFocusReason(state, null, 'tea-shed', 'show-tea-shed', 0)).toBe(
 '留世后可来这里歇脚听闻，先记住这处日常落点。',
 );

state.postAscension.mode = 'stayed-in-world';
 expect(locationPreviewFocusReason(state, null, 'tea-shed', 'show-tea-shed', 0)).toBe(
 '先来歇脚回气，把今日传闻和人情一起收下。',
 );

state.flags.add(`tea-shed-visit.${state.day}`);
 expect(locationPreviewFocusReason(state, null, 'tea-shed', 'show-tea-shed', 0)).toBe(
 '今日茶棚已歇过脚，先把传闻记下，再转去别处推进。',
 );
 });

it('uses stateful why-now guidance for greenhouse entries based on unlock and climate pressure', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 97, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

expect(locationPreviewFocusReason(state, null, 'greenhouse', 'show-greenhouse', 0)).toBe(
 '留世后可来这里养护育苗，先把这条后续经营线记住。',
 );

state.postAscension.mode = 'stayed-in-world';
 state.stayingWorld.greenhouseClimate = 32_000;
 expect(locationPreviewFocusReason(state, null, 'greenhouse', 'show-greenhouse', 0)).toBe(
 '棚势偏弱，今天先来回暖，免得离季苗势继续塌。',
 );

state.stayingWorld.greenhouseClimate = 68_000;
 expect(locationPreviewFocusReason(state, null, 'greenhouse', 'show-greenhouse', 0)).toBe(
 '先巡暖棚，把育苗与回养节奏稳在今天这轮。',
 );

state.flags.add(`greenhouse-tended.${state.day}`);
 expect(locationPreviewFocusReason(state, null, 'greenhouse', 'show-greenhouse', 0)).toBe(
 '今日暖棚已养护过，先把棚里成果接走，再回主线农务。',
 );
 });

it('carries high-priority action signals into selection toasts for the same location thread', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄', description: '主角以凡骨苦练、种灵草与炼体的据点。' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 '翻地、补种、浇水、收获与出货都从这里收口。',
 '要务：待收设施 1 座｜出货箱待结 2 项',
 'facility.shipping-bin',
 )).toEqual({
 message: '服务：农庄（耕作：查看农事）｜现在来：翻地、补种、浇水、收获与出货都从这里收口。｜要务：待收设施 1 座｜出货箱待结 2 项｜空格/E/回车执行·Esc返回',
 assetId: 'loc.farmstead',
 });
 });

it('allows farmstead root service toasts to reuse the current farmstead focus asset thread', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 '昨夜回款还挂在箱里，先回农庄把出货结清。',
 '要务：出货箱待结 1 项',
 'facility.shipping-bin',
 ).assetId).toBe('loc.farmstead');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 '仓储已经顶满，先回去清仓再安排采收与外出。',
 '要务：仓储已满',
 'facility.storage-chest',
 ).assetId).toBe('loc.farmstead');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 '有 1 块灵田正缺水，先回农庄把当日水路补稳。',
 '要务：补水 1 块灵田',
 'loc.herb-plot',
 ).assetId).toBe('loc.herb-plot');
 });

it('switches farmstead root selection toasts onto the array-shed thread when breakthrough is ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 94, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 state.player.stage = 1;
 state.player.bodyFoundation = stageQiCap(state.player.stage, DEFAULT_BALANCE);
 state.player.cultivation = state.player.bodyFoundation;

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 locationPreviewFocusReason(state, null, 'farmstead', 'show-farm-work', 0),
 undefined,
 'loc.array-shed',
 )).toEqual({
 message: '服务：阵器棚（阵法布设：查看阵法）｜现在来：体魄已至极限，缺避雷丹｜阵法未成(0/2)｜准备度0%｜先补避雷丹与两座阵法。｜空格/E/回车执行·Esc返回',
 assetId: 'loc.array-shed',
 });
 });

it('keeps farmstead root service toasts on the farmstead thread when only a sealing cabinet is ready', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'farm-work', label: '耕作', command: 'show-farm-work', commandLabel: '查看农事' }),
 '空格/E/回车执行·Esc返回',
 '农庄里已有设施完工，先回去把这一轮产出收住。',
 '要务：待收设施 1 座',
 'loc.farmstead',
 ).assetId).toBe('loc.farmstead');
 });

it('keeps farmstead-root processing and array selection toasts on the farmstead thread until the player enters the child place', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'processing', label: '农庄加工', command: 'show-processing', commandLabel: '查看加工' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.farmstead');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'farmstead', displayName: '农庄' }),
 service({ locationId: 'farmstead', service: 'arrays', label: '阵法布设', command: 'show-arrays', commandLabel: '查看阵法' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.farmstead');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'drying-yard', displayName: '晾晒架旁' }),
 service({ locationId: 'drying-yard', service: 'processing', label: '农庄加工', command: 'show-processing', commandLabel: '查看加工' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.drying-yard');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'array-shed', displayName: '阵器棚' }),
 service({ locationId: 'array-shed', service: 'arrays', label: '阵法布设', command: 'show-arrays', commandLabel: '查看阵法' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.array-shed');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'creek-field', displayName: '溪边药田' }),
 service({ locationId: 'creek-field', service: 'encounter', label: '偶遇', command: 'show-location-encounter', commandLabel: '查看偶遇' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.creek-field');
 });

it('keeps commission-thread selection toasts anchored to the current place thread instead of forcing market art', () => {
 expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'valley-market', displayName: '山谷集市' }),
 service({ locationId: 'valley-market', service: 'commission-board', label: '委托', command: 'show-commission', commandLabel: '查看委托' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.valley-market');

expect(locationSelectionToastPresentation(
 '服务',
 location({ id: 'ruin-gate', displayName: '遗迹门口' }),
 service({ locationId: 'ruin-gate', service: 'commission-board', label: '委托', command: 'show-commission', commandLabel: '查看委托' }),
 '空格/E/回车执行·Esc返回',
 ).assetId).toBe('loc.ruin-gate');
 });

it('falls back to location asset when the selected location has no service', () => {
 expect(locationSelectionToastPresentation(
 '地点',
 location({ id: 'herb-plot', displayName: '露根药圃', npcs: [] }),
 null,
 '空格/E/回车执行·Esc返回',
 )).toEqual({
 message: '地点：露根药圃（先回主线）｜空格/E/回车执行·Esc返回',
 assetId: 'loc.herb-plot',
 });
 });

it('keeps empty location-directory failure anchored to the farmstead root thread', () => {
 expect(locationDirectoryEmptyToastPresentation()).toEqual({
 message: '今日暂无可切换地点｜先回农庄收口农务与修行资源',
 assetId: 'loc.farmstead',
 });
 });

it('allows empty location-directory failure to stay on the current thread asset when provided', () => {
 expect(locationDirectoryEmptyToastPresentation('loc.greenhouse')).toEqual({
 message: '今日暂无可切换地点｜先回农庄收口农务与修行资源',
 assetId: 'loc.greenhouse',
 });
 expect(locationDirectoryEmptyToastPresentation('facility.shipping-bin')).toEqual({
 message: '今日暂无可切换地点｜先回农庄收口农务与修行资源',
 assetId: 'loc.farmstead',
 });
 });

it('uses one shared rule for the compact location-selection summary states', () => {
 expect(describeLocationSelectionSummary(null, [], null)).toBe('今日无可用地点');
 expect(describeLocationSelectionSummary(
 location({ id: 'herb-plot', displayName: '露根药圃', npcs: ['采药女'] }),
 [],
 null,
 )).toBe('露根药圃（先看行踪；采药女）');
 expect(describeLocationSelectionSummary(
 location({ id: 'valley-market', displayName: '山谷集市', npcs: ['游方散修'] }),
 [service()],
 service(),
 )).toBe('山谷集市（商店：浏览商店；游方散修）');
 });

it('keeps service-unavailable failures anchored to the current location', () => {
 expect(locationServiceUnavailableToastPresentation(
 location({ id: 'tea-shed', displayName: '旧茶棚' }),
 )).toEqual({
 message: '旧茶棚眼下暂无可执行服务｜先回农庄收口农务、出货与备劫准备',
 assetId: 'loc.tea-shed',
 });
 });

it('keeps encounter-only service failures anchored to the current location with route guidance', () => {
 expect(locationServiceUnavailableToastPresentation(
 location({
 id: 'herb-plot',
 displayName: '露根药圃',
 services: ['encounter'],
 serviceLabels: ['偶遇'],
 npcs: ['采药女'],
 }),
 )).toEqual({
 message: '露根药圃此刻只有行踪可看｜先记住人在哪，再决定要不要跟进',
 assetId: 'loc.herb-plot',
 });
 });

it('derives service-unavailable guidance from onboarding route locks', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 98, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

state.player.flags.add('onboarding-first-shipping-settlement');
 expect(locationServiceUnavailableToastPresentation(
 location({ id: 'valley-outskirts', displayName: '山谷' }),
 state,
 )).toEqual({
 message: '山谷当前先放一放｜先去集市补种，把第二轮炼丹材料接上',
 assetId: 'loc.valley-outskirts',
 });

state.player.flags.add('onboarding-first-market-restock');
 expect(locationServiceUnavailableToastPresentation(
 location({ id: 'ruin-gate', displayName: '遗迹门口' }),
 state,
 )).toEqual({
 message: '遗迹门口当前先放一放｜先回农庄补播，让第二轮药材不断档',
 assetId: 'loc.ruin-gate',
 });
 });

it('keeps no-encounter failures anchored to the current location instead of a generic string', () => {
 expect(locationEncounterUnavailableToastPresentation(
 location({ id: 'creek-field', displayName: '溪边药田' }),
 )).toEqual({
 message: '溪边药田眼下暂无停留人物｜先按当前地点动线推进',
 assetId: 'loc.creek-field',
 });
 });

it('keeps calendar summary feedback anchored to the farmstead daily-loop root thread', () => {
 expect(calendarSummaryToastPresentation('集市补种', '2 日后：采药女生辰；4 日后：节庆会场开集')).toEqual({
 message: '今日日程：集市补种｜近七日：2 日后：采药女生辰；4 日后：节庆会场开集',
 assetId: 'loc.farmstead',
 });
 });

it('uses festival-ground art when the calendar summary is currently about a festival day', () => {
 const todayEntries: CalendarEntry[] = [{
 kind: 'festival',
 id: 'event.spring-festival',
 title: '灵芽节',
 description: '春分后的会场开集。',
 season: 'spring',
 day: 14,
 daysFromNow: 0,
 }];

expect(calendarSummaryToastPresentation('灵芽节', '4 日后：游方散修生辰', todayEntries, [])).toEqual({
 message: '今日日程：灵芽节｜近七日：4 日后：游方散修生辰',
 assetId: 'loc.festival-ground',
 });
 });

it('uses the upcoming birthday place art when the next calendar focus is a birthday', () => {
 const upcomingEntries: CalendarEntry[] = [{
 kind: 'birthday',
 id: 'npc.herb-gatherer',
 title: '采药女生辰',
 description: '今日送礼更容易打动她。',
 season: 'summer',
 day: 8,
 daysFromNow: 2,
 }];

expect(calendarSummaryToastPresentation('无定期事项', '2 日后：采药女生辰', [], upcomingEntries)).toEqual({
 message: '今日日程：无定期事项｜近七日：2 日后：采药女生辰',
 assetId: 'loc.creek-field',
 });
 });

it('keeps legacy confirm empty-state feedback anchored to the farmstead root thread', () => {
 expect(legacyConfirmUnavailableToastPresentation()).toEqual({
 message: '旧确认键当前无对象｜先用地点或服务确认推进',
 assetId: 'loc.farmstead',
 });
 });

it('allows legacy confirm empty-state feedback to stay on the current thread asset when provided', () => {
 expect(legacyConfirmUnavailableToastPresentation('loc.herb-plot')).toEqual({
 message: '旧确认键当前无对象｜先用地点或服务确认推进',
 assetId: 'loc.herb-plot',
 });
 expect(legacyConfirmUnavailableToastPresentation('facility.shipping-bin')).toEqual({
 message: '旧确认键当前无对象｜先用地点或服务确认推进',
 assetId: 'loc.farmstead',
 });
 });
});
