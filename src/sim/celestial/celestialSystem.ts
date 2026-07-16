/**
  * 天象奇遇引擎。
 *
  * 底层权重算法周期触发"天象大事件"——凡人无法改大势，但大环境波动直接打击小农庄。
  * 每日：到期事件结束 → 无激活时按 eventGateProbability 抽样触发新事件 → 其 growthMod/qiMod 调制当日农场。
  * 确定性：所有抽样走 ctx.rng.celestial 流。
 */
import type { GameState, ActiveCelestialEvent } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import type { CelestialEventDef } from '@content/defs';
import type { Rng } from '@sim/world/rng';
import { stageQiCap } from '@sim/progression/progression';
import { itemCount, mutateItem } from '@sim/world/player';
import { normalizeBodyCultivation } from '@sim/progression/bodyCultivation';
import { MILLI } from '@sim/world/types';

const REPEAT_PENALTY = 0.4;

const FESTIVAL_REWARDS = {
 'event.spring-festival': {
 itemGrants: [
 { itemId: 'seed.dewroot', count: 2 },
 { itemId: 'item.spirit-compost', count: 1 },
 ],
 },
 'event.summer-festival': {
 itemGrants: [{ itemId: 'item.spirit-stone', count: 3 }],
 staminaGain: 15,
 bodyFoundationGain: 500,
 willpowerGain: 250,
 },
 'event.autumn-festival': {
 itemGrants: [
 { itemId: 'seed.balmleaf', count: 1 },
 { itemId: 'item.spirit-stone', count: 2 },
 ],
 },
 'event.winter-festival': {
 itemGrants: [{ itemId: 'item.array-core', count: 1 }],
 hpGain: 10,
 poisonReduction: 5,
 lifespanGain: 3,
 },
} as const;

export type FestivalEventId = keyof typeof FESTIVAL_REWARDS;

export interface FestivalStallItem {
 eventId: FestivalEventId;
 itemId: string;
 displayName: string;
 price: number;
}

export interface BuyFestivalStallResult {
 ok: boolean;
 item: FestivalStallItem | null;
 totalPrice: number;
 reason?: string;
}

const FESTIVAL_STALL_CATALOG: readonly FestivalStallItem[] = [
 { eventId: 'event.spring-festival', itemId: 'seed.balmleaf', displayName: '和合叶种', price: 3 },
 { eventId: 'event.spring-festival', itemId: 'item.spirit-compost', displayName: '灵壤肥', price: 2 },
 { eventId: 'event.summer-festival', itemId: 'item.beast-core', displayName: '妖兽内丹', price: 4 },
 { eventId: 'event.summer-festival', itemId: 'seed.thunderreed', displayName: '引雷芦种', price: 6 },
 { eventId: 'event.autumn-festival', itemId: 'seed.metalpine', displayName: '雷击木种', price: 6 },
 { eventId: 'event.autumn-festival', itemId: 'item.recipe-fragment', displayName: '残卷', price: 5 },
 { eventId: 'event.winter-festival', itemId: 'item.array-core', displayName: '阵核', price: 5 },
 { eventId: 'event.winter-festival', itemId: 'item.broken-talisman', displayName: '破损法宝', price: 3 },
];

export interface FestivalParticipationResult {
 ok: boolean;
 reason?: string;
 eventId?: FestivalEventId;
}

export function festivalParticipationFlag(state: GameState, eventId: FestivalEventId): string {
 return `festival-participated:${eventId}:${state.year}:${state.season}:${state.seasonDay}`;
}

function isFestivalEventId(id: string): id is FestivalEventId {
 return id in FESTIVAL_REWARDS;
}

export function currentFestivalEventId(state: GameState): FestivalEventId | null {
 const eventId = state.activeEvent?.defId;
 return eventId && isFestivalEventId(eventId) ? eventId : null;
}

export function hasParticipatedCurrentFestival(state: GameState): boolean {
 const eventId = currentFestivalEventId(state);
 return eventId != null && state.flags.has(festivalParticipationFlag(state, eventId));
}

function festivalStallFlag(state: GameState, eventId: FestivalEventId, itemId: string): string {
 return `festival-stall:${eventId}:${state.year}:${state.season}:${state.seasonDay}:${itemId}`;
}

export function getFestivalStallItems(state: GameState): FestivalStallItem[] {
 const eventId = currentFestivalEventId(state);
 if (!eventId) return [];
 return FESTIVAL_STALL_CATALOG.filter((item) => item.eventId === eventId && !state.flags.has(festivalStallFlag(state, eventId, item.itemId)));
}

export function buyFestivalStallItem(state: GameState, itemId: string, ctx: SimContext): BuyFestivalStallResult {
 const eventId = currentFestivalEventId(state);
 if (!eventId) return { ok: false, item: null, totalPrice: 0, reason: '当前没有节日摊位' };
 const item = FESTIVAL_STALL_CATALOG.find((entry) => entry.eventId === eventId && entry.itemId === itemId) ?? null;
 if (!item) return { ok: false, item: null, totalPrice: 0, reason: '无此节日商品' };
 if (!ctx.content.items.has(item.itemId)) return { ok: false, item, totalPrice: item.price, reason: '商品未登记' };
 const flag = festivalStallFlag(state, eventId, item.itemId);
 if (state.flags.has(flag)) return { ok: false, item, totalPrice: item.price, reason: '本次节日已购' };
 if (itemCount(state.player, 'item.spirit-stone') < item.price) return { ok: false, item, totalPrice: item.price, reason: '灵石不足' };

mutateItem(state.player, 'item.spirit-stone', -item.price);
 if (!mutateItem(state.player, item.itemId, 1)) {
 mutateItem(state.player, 'item.spirit-stone', item.price);
 return { ok: false, item, totalPrice: item.price, reason: '储物戒已满' };
 }

state.flags.add(flag);
 emit(state, 'festival-stall-buy', { eventId, itemId: item.itemId, totalPrice: item.price });
 return { ok: true, item, totalPrice: item.price };
}

/**
  * 按天象基础权重抽样；近 3 次已触发的同类事件权重 ×0.4。
  * 零权重事件永不入池；同 RNG 状态 + 同定义/历史 ⇒ 同结果。
 */
export function selectCelestialEvent(
 defs: readonly CelestialEventDef[],
 recentEventIds: readonly string[],
 rng: Rng,
): CelestialEventDef | null {
 const recentStart = Math.max(0, recentEventIds.length - 3);
 for (const def of defs) {
 if (!Number.isFinite(def.weight) || def.weight < 0) {
 throw new Error(`selectCelestialEvent: invalid weight for ${def.id}`);
 }
 }
 const pool = defs.filter((d) => !d.forced); // 强制(forced)事件不走随机抽样
 const weighted = pool
 .map((def) => {
 let isRecent = false;
 for (let i = recentStart; i < recentEventIds.length; i++) {
 if (recentEventIds[i] === def.id) { isRecent = true; break; }
 }
 return { item: def, weight: def.weight * (isRecent ? REPEAT_PENALTY : 1) };
 })
 .filter(({ weight }) => weight > 0);
 return weighted.length > 0 ? rng.weighted(weighted) : null;
}

export interface CelestialMods {
 growthMod: number;
 qiMod: number;
 active: ActiveCelestialEvent | null;
}

/** 由 def 构造运行态事件，拷贝可选机制倍率（仅在 def 定义时携带 → 无 mod 事件哈希不变，T8）。 */
function activeEventFromDef(def: CelestialEventDef): ActiveCelestialEvent {
 const ev: ActiveCelestialEvent = {
 defId: def.id,
 displayName: def.displayName,
 daysLeft: def.durationDays,
 growthMod: def.growthMod,
 qiMod: def.qiMod,
 };
 if (def.damageMod !== undefined) ev.damageMod = def.damageMod;
 if (def.madnessMod !== undefined) ev.madnessMod = def.madnessMod;
 if (def.alchemyTolMod !== undefined) ev.alchemyTolMod = def.alchemyTolMod;
 return ev;
}

/**
  * 在四阶修为达到上限时启动一次紫雷前兆；可中断普通天象，但不会重启已存在的前兆。
  * 返回本次是否启动，供即时引劫入口阻止绕过七日预警。
 */
export function startPurpleOmenIfDue(state: GameState, ctx: SimContext): boolean {
	normalizeBodyCultivation(state, ctx.params);
	if (state.flags.has('purple-omen-fired') || state.player.stage !== 4 || state.player.bodyFoundation < stageQiCap(4, ctx.params)) {
 return false;
 }

const def = ctx.content.events.get('event.purple-omen');
 if (!def || state.activeEvent?.defId === def.id) return false;

if (state.activeEvent) emit(state, 'celestial-end', { defId: state.activeEvent.defId });
 state.activeEvent = {
 defId: def.id,
 displayName: def.displayName,
 daysLeft: def.durationDays,
 growthMod: def.growthMod,
 qiMod: def.qiMod,
 };
 state.flags.add('purple-omen-fired');
 emit(state, 'celestial-start', { defId: def.id, displayName: def.displayName, type: def.type });
 return true;
}

/**
  * 季节节日（日历强制）：每年固定 season/day 触发一次。
  * 与进行中天象互斥（activeEvent 守卫）；params.celestial.festivals.enabled 缺字段时防御为关（不影响旧 fixture）。
 */
export function startSeasonalFestivalIfDue(state: GameState, ctx: SimContext): boolean {
 if (!ctx.params.celestial.festivals?.enabled) return false;
 if (state.activeEvent) return false;
 const due = [...ctx.content.events.values()].find(
 (e) => e.seasonal && e.seasonal.season === state.season && e.seasonal.day === state.seasonDay,
 );
 if (!due) return false;
 state.activeEvent = {
 defId: due.id,
 displayName: due.displayName,
 daysLeft: due.durationDays,
 growthMod: due.growthMod,
 qiMod: due.qiMod,
 };
 emit(state, 'celestial-start', { defId: due.id, displayName: due.displayName, type: due.type });
 return true;
}

/**
  * 玩家参与季节节日：为 Stardew-like 日历节奏补上一次性参与/奖励闭环。
  * 奖励固定且走 state.flags 防重复，保持 sim 确定、无 UI 依赖。
 */
export function participateFestival(state: GameState, ctx: SimContext): FestivalParticipationResult {
 const eventId = state.activeEvent?.defId;
 if (!eventId || !isFestivalEventId(eventId)) return { ok: false, reason: '当前没有可参与节日' };
 const flag = festivalParticipationFlag(state, eventId);
 if (state.flags.has(flag)) return { ok: false, reason: '本次节日已参与', eventId };

const reward = FESTIVAL_REWARDS[eventId];
 const granted: Array<{ itemId: string; count: number }> = [];
 for (const grant of reward.itemGrants) {
 if (!ctx.content.items.has(grant.itemId)) continue;
 if (mutateItem(state.player, grant.itemId, grant.count)) granted.push(grant);
 }
 if (granted.length !== reward.itemGrants.length) {
 for (const grant of granted) mutateItem(state.player, grant.itemId, -grant.count);
 return { ok: false, reason: '背包已满', eventId };
 }

if ('staminaGain' in reward) state.player.stamina = Math.min(ctx.params.player.staminaCap * MILLI, state.player.stamina + reward.staminaGain * MILLI);
 if ('bodyFoundationGain' in reward) {
 state.player.bodyFoundation += reward.bodyFoundationGain;
 state.player.cultivation += reward.bodyFoundationGain;
 }
 if ('willpowerGain' in reward) state.player.willpower += reward.willpowerGain;
 if ('hpGain' in reward) state.player.hp = Math.min(state.player.maxHp, state.player.hp + reward.hpGain * MILLI);
 if ('poisonReduction' in reward) state.player.pillPoison = Math.max(0, state.player.pillPoison - reward.poisonReduction * MILLI);
 if ('lifespanGain' in reward) state.player.lifespanRemainingDays += reward.lifespanGain;

state.flags.add(flag);
 emit(state, 'festival-participate', { eventId, rewards: granted });
 return { ok: true, eventId };
}

/**
  * 结算事件授予物。
  * seed-by-stage：按玩家阶段选 tier ≤ min(tierMax, stage) 的灵草种子（高阶灵草获取）。
  * 走 ctx.rng.celestial 流（仅随机事件触发时消费；forced/fixture 不触发→确定性不变）。
 */
export function resolveEventGrants(state: GameState, def: CelestialEventDef, ctx: SimContext): void {
 if (!def.grants || def.grants.length === 0) return;
 for (const g of def.grants) {
 if (!ctx.rng.celestial.chance(g.chance)) continue;
 if (g.kind === 'item') {
 mutateItem(state.player, g.itemId, g.count);
 emit(state, 'event-grant', { itemId: g.itemId, count: g.count });
 } else {
 const tierMax = Math.min(g.tierMax ?? Number.POSITIVE_INFINITY, Math.max(1, state.player.stage));
 const candidates = [...ctx.content.herbs.values()].filter((h) => h.tier >= 1 && h.tier <= tierMax);
 if (candidates.length > 0) {
 const herb = ctx.rng.celestial.pick(candidates);
 mutateItem(state.player, herb.seedId, g.count);
 emit(state, 'event-grant', { itemId: herb.seedId, count: g.count });
 }
 }
 }
}

/** 推进天象状态（到期/触发），返回当日调制倍率。 */
export function tickCelestial(state: GameState, ctx: SimContext): CelestialMods {
 // 1. 到期。紫雷前兆结束当天不立刻抽取普通天象。
 let purpleOmenExpired = false;
 if (state.activeEvent) {
 state.activeEvent.daysLeft -= 1;
 if (state.activeEvent.daysLeft <= 0) {
 purpleOmenExpired = state.activeEvent.defId === 'event.purple-omen';
 emit(state, 'celestial-end', { defId: state.activeEvent.defId });
 state.activeEvent = null;
 }
 }
 // 1b. 强制天象：stage4 修为满 → 紫雷前兆（仅触发一次，解锁终局线）
 startPurpleOmenIfDue(state, ctx);
 // 1c. 季节节日（日历强制）；与紫雷前兆/进行中天象互斥
 startSeasonalFestivalIfDue(state, ctx);
 // 2. 无激活时按门概率抽样触发
 if (!purpleOmenExpired && !state.activeEvent && ctx.rng.celestial.chance(ctx.params.celestial.eventGateProbability)) {
 const defs = [...ctx.content.events.values()];
 const pick = selectCelestialEvent(defs, state.recentCelestialEventIds, ctx.rng.celestial);
 if (pick) {
 state.activeEvent = activeEventFromDef(pick);
 state.recentCelestialEventIds.push(pick.id);
 if (state.recentCelestialEventIds.length > 3) state.recentCelestialEventIds.shift();
 emit(state, 'celestial-start', { defId: pick.id, displayName: pick.displayName, type: pick.type });
 resolveEventGrants(state, pick, ctx);
 }
 }
 return {
 growthMod: state.activeEvent?.growthMod ?? 1,
 qiMod: state.activeEvent?.qiMod ?? 1,
 active: state.activeEvent,
 };
}
