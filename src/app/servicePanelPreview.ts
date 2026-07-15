import type { ContentRegistry } from '@content/defs';
import type { LocationId } from '@sim';
import {
 getFestivalStallItems,
 getGreenhouseRumor,
 getGreenhouseSeedGrant,
 getTeaShedRumor,
 greenhouseCareStreak,
 greenhouseClimate,
 greenhouseNurseryCapacity,
 greenhouseNurserySlotsRemaining,
 greenhouseNurseryTier,
 greenhouseProtectedCropCount,
 greenhouseVisitFlag,
 teaShedVisitFlag,
 type GameState,
} from '@sim';
import { itemIconAssetId } from './itemIcons';
import { locationServiceActorAssetId } from './locationPreview';
import { normalizeFarmsteadRootAssetId } from './farmsteadFocus';

export interface ServicePanelPreview {
 title: string;
 details: string;
 assetId?: string;
}

export interface ServiceToastPresentation {
 message: string;
 assetId?: string;
}

interface FestivalRewardLike {
 itemId: string;
 count: number;
}

export function quickServiceUnavailableToastPresentation(
 kind: 'staying-commission' | 'tea-shed' | 'greenhouse',
 stayingWorldOnly = false,
 state?: GameState,
): ServiceToastPresentation {
 switch (kind) {
 case 'staying-commission':
 if (state?.activeEvent) {
 return {
 message: stayingWorldOnly
 ? '镇守告示今日随节停摆｜先去会场看当期事务'
 : '公告板今日随节停市｜先去会场看当期事务',
 assetId: stayingWorldOnly ? 'loc.ruin-gate' : 'loc.valley-market',
 };
 }
 return {
 message: stayingWorldOnly ? '镇守告示暂不可直达｜留世线索与事务从这里接续' : '公告板暂不可直达｜日常委托通常从集市接续',
 assetId: stayingWorldOnly ? 'loc.ruin-gate' : 'loc.valley-market',
 };
 case 'tea-shed':
 if (state?.postAscension.mode !== 'stayed-in-world') {
 return {
 message: '旧茶棚尚未开放快捷歇脚｜留世后可直达',
 assetId: 'loc.tea-shed',
 };
 }
 if (state.flags.has(teaShedVisitFlag(state.day))) {
 return {
 message: '旧茶棚今日已歇脚｜明日再来',
 assetId: 'loc.tea-shed',
 };
 }
 return {
 message: '旧茶棚暂不可直达',
 assetId: 'loc.tea-shed',
 };
 case 'greenhouse':
 if (state?.postAscension.mode !== 'stayed-in-world') {
 return {
 message: '暖棚尚未开放快捷养护｜留世后可直达',
 assetId: 'loc.greenhouse',
 };
 }
 if (state.flags.has(greenhouseVisitFlag(state.day))) {
 return {
 message: '暖棚今日已养护｜明日再来',
 assetId: 'loc.greenhouse',
 };
 }
 return {
 message: '暖棚暂不可直达',
 assetId: 'loc.greenhouse',
 };
 }
}

export function festivalUnavailableToastPresentation(kind: 'no-active-event' | 'already-participated-or-full'): ServiceToastPresentation {
 return {
 message: kind === 'already-participated-or-full' ? '本次节日已参与或背包已满' : '当前没有可参与节日',
 assetId: 'loc.festival-ground',
 };
}

export function festivalResultToastPresentation(
 rewards: FestivalRewardLike[],
 content: ContentRegistry,
): ServiceToastPresentation {
 const names = rewards
 .map((reward) => `${content.items.get(reward.itemId)?.displayName ?? reward.itemId}×${reward.count}`)
 .join('、');
 const rewardAssetId = rewards[0]?.itemId ? itemIconAssetId(rewards[0].itemId, content) : undefined;
 return {
 message: names ? `参与节日：${names}` : '参与节日',
 assetId: rewardAssetId ?? 'loc.festival-ground',
 };
}

function farmServiceEntryAssetId(locationId: LocationId, childLocationId: 'drying-yard' | 'array-shed'): string {
 if (locationId === 'farmstead') return 'loc.farmstead';
 return `loc.${childLocationId}`;
}

interface TeaShedVisitResultLike {
 rumor: { title: string };
 hpGain: number;
 poisonRelief: number;
 willpowerGain: number;
}

interface GreenhouseVisitResultLike {
 rumor: { title: string };
 grantedSeedId: string;
 grantedSeedCount: number;
 revivedTiles: number;
 nurseryTier: number;
 nurseryCapacity: number;
 nurserySlotsRemaining: number;
 greenhouseClimate: number;
 greenhouseCareStreak: number;
}

function teaShedActionLine(state: GameState): string {
 if (state.postAscension.mode !== 'stayed-in-world') return '留世后解锁歇脚';
 if (state.flags.has(teaShedVisitFlag(state.day))) return '今日已歇脚｜明日可再来';
 return '今日可歇脚｜回气解毒并凝神';
}

function greenhouseClimateLine(climate: number): string {
 if (climate >= 65) return '棚势已稳｜离季育苗更顺手';
 if (climate < 35) return '棚势偏弱｜今日宜先回暖';
 return '棚势回升中｜继续连护更稳';
}

function greenhouseActionLine(state: GameState, seedName: string, seedCount: number, revivedTiles: number): string {
 if (state.postAscension.mode !== 'stayed-in-world') return '留世后解锁养护';
 if (state.flags.has(greenhouseVisitFlag(state.day))) return '今日已养护｜明日可再来';
 return `今日可领 ${seedName} × ${seedCount}｜可回养空田 ${revivedTiles} 格`;
}

function greenhouseNurseryLine(tier: number, used: number, capacity: number, remaining: number, protectedCrops: number): string {
 if (capacity <= 0) return `苗床 ${tier} 阶｜槽位 ${used}/${capacity}｜待扩建后可护苗`;
 if (remaining <= 0) return `苗床 ${tier} 阶｜槽位 ${used}/${capacity}｜护苗 ${protectedCrops}｜已满`;
 return `苗床 ${tier} 阶｜槽位 ${used}/${capacity}｜护苗 ${protectedCrops}｜余 ${remaining}`;
}

function greenhouseRevivedTileCount(state: GameState): number {
 let count = 0;
 for (const tile of state.tiles) {
 if (!tile.tilled || tile.blockType !== 'none' || tile.cropId != null) continue;
 count += 1;
 }
 return count;
}

export function festivalPanelPreview(state: GameState): ServicePanelPreview {
 const eventName = state.activeEvent?.displayName ?? '节日会场';
 const stallGoods = getFestivalStallItems(state);
 const stallLine = stallGoods.length > 0 ? `摊位 ${stallGoods.length} 项` : '摊位暂未开张';
 const actionLine = stallGoods.length > 0
 ? '可先逛摊补节货，再顺手参与会场试礼'
 : '先去会场探风声，别把今日补货指望压在这里';

return {
 title: eventName,
 details: `节庆会场\n${stallLine}\n${actionLine}`,
 assetId: 'loc.festival-ground',
 };
}

export function festivalToastPresentation(state: GameState, confirmHint: string): ServiceToastPresentation {
 const preview = festivalPanelPreview(state);
 return {
 message: `${preview.title}：${preview.details.split('\n').join('｜')}｜${confirmHint}`,
 assetId: preview.assetId,
 };
}

export function teaShedPanelPreview(state: GameState): ServicePanelPreview {
 const rumor = getTeaShedRumor(state);
 const action = teaShedActionLine(state);

return {
 title: `旧茶棚·${rumor.title}`,
 details: `茶棚歇脚\n${rumor.lines[0] ?? '棚里茶火未灭。'}\n${action}`,
 assetId: 'loc.tea-shed',
 };
}

export function teaShedToastPresentation(state: GameState, confirmHint?: string): ServiceToastPresentation {
 const preview = teaShedPanelPreview(state);
 const access = state.postAscension.mode === 'stayed-in-world'
 ? confirmHint ?? '空格/E/回车歇脚听闻·Esc返回'
 : '留世后可来此歇脚听闻';
 return {
 message: `${preview.title}：${preview.details.split('\n').slice(1).join('｜')}｜${access}`,
 assetId: locationServiceActorAssetId('show-tea-shed') ?? 'sprite.npc.tea-shed-elder',
 };
}

export function teaShedResultToastPresentation(
 outcome: 'success' | 'failure',
 resultOrReason: TeaShedVisitResultLike | string,
): ServiceToastPresentation {
 if (outcome === 'failure') {
 return {
 message: `旧茶棚：${resultOrReason || '今日不便歇脚'}`,
 assetId: 'loc.tea-shed',
 };
 }
 const result = resultOrReason as TeaShedVisitResultLike;
 const benefit = [
 '养神歇脚',
 `气血+${Math.floor(result.hpGain / 1000)}`,
 result.poisonRelief > 0 ? `丹毒-${Math.floor(result.poisonRelief / 1000)}` : '',
 result.willpowerGain > 0 ? `意志+${Math.floor(result.willpowerGain / 1000)}` : '',
 ].filter(Boolean).join('，');
 return {
 message: `旧茶棚：${result.rumor.title}｜${benefit}`,
 assetId: 'sprite.npc.tea-shed-elder',
 };
}

export function greenhousePanelPreview(state: GameState, content: ContentRegistry): ServicePanelPreview {
 const rumor = getGreenhouseRumor(state);
 const seedGrant = getGreenhouseSeedGrant(state);
 const seedName = content.items.get(seedGrant.itemId)?.displayName ?? seedGrant.itemId;
 const climate = Math.floor(greenhouseClimate(state) / 1000);
 const streak = greenhouseCareStreak(state);
 const tier = greenhouseNurseryTier(state);
 const capacity = greenhouseNurseryCapacity(state);
 const remaining = greenhouseNurserySlotsRemaining(state);
 const used = Math.max(0, capacity - remaining);
 const protectedCrops = greenhouseProtectedCropCount(state);
 const revivedTiles = greenhouseRevivedTileCount(state);
 const climateLine = greenhouseClimateLine(climate);
 const actionLine = greenhouseActionLine(state, seedName, seedGrant.count, revivedTiles);
 const nurseryLine = greenhouseNurseryLine(tier, used, capacity, remaining, protectedCrops);

return {
 title: `暖棚·${rumor.title}`,
 details: `四时育苗\n${actionLine}\n棚温 ${climate}%｜连护 ${streak} 日｜${climateLine}\n${nurseryLine}`,
 assetId: 'loc.greenhouse',
 };
}

export function greenhouseToastPresentation(
 state: GameState,
 content: ContentRegistry,
 confirmHint?: string,
): ServiceToastPresentation {
 const preview = greenhousePanelPreview(state, content);
 const access = state.postAscension.mode === 'stayed-in-world'
 ? confirmHint ?? '空格/E/回车养护暖棚·Esc返回'
 : '留世后可来此养护育苗';
 return {
 message: `${preview.title}：${preview.details.split('\n').join('｜')}｜${access}`,
 assetId: locationServiceActorAssetId('show-greenhouse') ?? 'sprite.npc.herb-gatherer',
 };
}

export function greenhouseResultToastPresentation(
 outcome: 'success' | 'failure',
 resultOrReason: GreenhouseVisitResultLike | string,
 content: ContentRegistry,
): ServiceToastPresentation {
 if (outcome === 'failure') {
 return {
 message: `暖棚：${resultOrReason || '今日不便养护'}`,
 assetId: 'loc.greenhouse',
 };
 }
 const result = resultOrReason as GreenhouseVisitResultLike;
 const seedName = content.items.get(result.grantedSeedId)?.displayName ?? result.grantedSeedId;
 const nurseryText = result.nurseryTier > 0
 ? `，苗床${result.nurseryTier}阶·槽位${result.nurseryCapacity - result.nurserySlotsRemaining}/${result.nurseryCapacity}`
 : '';
 const climateText = `，棚温${Math.floor(result.greenhouseClimate / 1000)}%`;
 const streakText = result.greenhouseCareStreak > 0 ? `，连护${result.greenhouseCareStreak}日` : '，连护0日';
 return {
 message: `暖棚：${result.rumor.title}｜得${seedName}×${result.grantedSeedCount}，回养田地${result.revivedTiles}格${nurseryText}${climateText}${streakText}`,
 assetId: itemIconAssetId(result.grantedSeedId, content) ?? 'loc.greenhouse',
 };
}

export function processingServiceToastPresentation(
 confirmHint: string,
 locationId: LocationId = 'farmstead',
): ServiceToastPresentation {
 return {
 message: `加工：余货先晾晒，封藏稳药性，熔炼出阵核接炼丹与阵法｜Tab切换到农庄加工项·${confirmHint}`,
 assetId: farmServiceEntryAssetId(locationId, 'drying-yard'),
 };
}

export function arraysServiceToastPresentation(
 confirmHint: string,
 locationId: LocationId = 'farmstead',
): ServiceToastPresentation {
 return {
 message: `阵法：布设引雷阵与绝缘阵，把农庄产出转成备劫防线｜${confirmHint}`,
 assetId: farmServiceEntryAssetId(locationId, 'array-shed'),
 };
}

export function farmWorkServiceToastPresentation(
 confirmHint: string,
 assetIdOverride?: string,
): ServiceToastPresentation {
 return {
 message: `农事：翻地、补种、浇水、收获与出货从这里收口，先稳住修行资源循环｜数字键/滚轮切热栏·${confirmHint}`,
 assetId: assetIdOverride ? normalizeFarmsteadRootAssetId(assetIdOverride) : 'loc.farmstead',
 };
}
