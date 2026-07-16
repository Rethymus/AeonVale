/**
  * 外出寻访：离开田地，在山谷/残迹/灵脉边缘寻找资源。
 *
  * 这是星露谷式“农场外采集/矿洞/觅食”的修仙版本：消耗体力，走项目 PRNG，
  * 产出早期种子、灵石、残卷或破损法宝，补足非种田日的资源入口。
 */
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { itemCount, mutateItem } from '@sim/world/player';
import { MILLI } from '@sim/world/types';

export type ExplorationSite = 'valley' | 'ruin' | 'spirit-vein';

export interface ExplorationResult {
 ok: boolean;
 site: ExplorationSite;
 staminaCost: number;
 grants: Array<{ itemId: string; count: number }>;
 reason?: string;
}

export interface RuinDelveResult {
 ok: boolean;
 level: number;
 deepestLevel: number;
 staminaCost: number;
 damage: number;
 grants: Array<{ itemId: string; count: number }>;
 milestone: boolean;
 reason?: string;
}

const SITE_STAMINA: Record<ExplorationSite, number> = {
 valley: 18,
 ruin: 28,
 'spirit-vein': 34,
};

const RUIN_DELVES_MAX_LEVEL = 20;

function grant(state: GameState, itemId: string, count: number, grants: Array<{ itemId: string; count: number }>): boolean {
 const before = itemCount(state.player, itemId);
 const ok = mutateItem(state.player, itemId, count);
 if (!ok) return false;
 const gained = itemCount(state.player, itemId) - before;
 if (gained > 0) grants.push({ itemId, count: gained });
 return true;
}

function tierLimitedSeeds(ctx: SimContext, stage: number): string[] {
 const tierMax = Math.min(3, Math.max(1, stage + 1));
 return [...ctx.content.herbs.values()]
 .filter((herb) => herb.tier <= tierMax)
 .map((herb) => herb.seedId)
 .sort();
}

export function exploreSite(state: GameState, site: ExplorationSite, ctx: SimContext): ExplorationResult {
 const staminaCost = SITE_STAMINA[site];
 if (state.player.stamina < staminaCost * MILLI) {
 return { ok: false, site, staminaCost, grants: [], reason: '体力不足' };
 }
 state.player.stamina -= staminaCost * MILLI;

const grants: Array<{ itemId: string; count: number }> = [];
 if (site === 'valley') {
 const seeds = tierLimitedSeeds(ctx, state.player.stage).filter((id) => id.includes('moss') || id.includes('fern') || id.includes('grain') || id.includes('dewroot') || id.includes('suncap'));
 grant(state, ctx.rng.drop.pick(seeds.length > 0 ? seeds : tierLimitedSeeds(ctx, state.player.stage)), 1, grants);
 if (ctx.rng.drop.chance(0.35)) grant(state, 'item.spirit-stone', 1, grants);
 } else if (site === 'ruin') {
 if (ctx.rng.drop.chance(0.55)) grant(state, 'item.recipe-fragment', 1, grants);
 else grant(state, 'item.broken-talisman', 1, grants);
 if (state.player.stage >= 1 && ctx.rng.drop.chance(0.4)) grant(state, ctx.rng.drop.pick(tierLimitedSeeds(ctx, state.player.stage)), 1, grants);
 } else {
 grant(state, 'item.spirit-stone', 1 + ctx.rng.drop.nextInt(2), grants);
 if (state.player.stage >= 2 && ctx.rng.drop.chance(0.35)) grant(state, 'seed.metalpine', 1, grants);
 }

if (grants.length === 0) {
 emit(state, 'explore-empty', { site, staminaCost });
 return { ok: true, site, staminaCost, grants };
 }
 emit(state, 'explore', { site, staminaCost, grants });
 return { ok: true, site, staminaCost, grants };
}

function ruinStaminaCost(level: number): number {
 return 18 + Math.ceil(level / 2) * 3;
}

function ruinTrialDamage(level: number): number {
 return 4 + Math.floor(level / 3) * 2;
}

/**
  * 分层遗迹探索：每次深入一层，持久记录最深层数。
  * 对齐 Stardew-like 矿洞进度，同时改写为体修遗迹试炼：越深越痛，收益越偏传承/阵材。
 */
export function delveRuin(state: GameState, ctx: SimContext): RuinDelveResult {
 state.exploration ??= { deepestRuinLevel: 0 };
 if (state.exploration.deepestRuinLevel >= RUIN_DELVES_MAX_LEVEL) {
 return { ok: false, level: state.exploration.deepestRuinLevel, deepestLevel: state.exploration.deepestRuinLevel, staminaCost: 0, damage: 0, grants: [], milestone: false, reason: '遗迹已探尽' };
 }

const level = state.exploration.deepestRuinLevel + 1;
 const staminaCost = ruinStaminaCost(level);
 const damage = ruinTrialDamage(level);
 if (state.player.stamina < staminaCost * MILLI) {
 return { ok: false, level, deepestLevel: state.exploration.deepestRuinLevel, staminaCost, damage, grants: [], milestone: false, reason: '体力不足' };
 }
 if (state.player.hp <= damage * MILLI) {
 return { ok: false, level, deepestLevel: state.exploration.deepestRuinLevel, staminaCost, damage, grants: [], milestone: false, reason: '气血不足' };
 }

state.player.stamina -= staminaCost * MILLI;
 state.player.hp -= damage * MILLI;
 state.player.willpower += Math.max(100, level * 35);

const grants: Array<{ itemId: string; count: number }> = [];
 const milestone = level % 5 === 0;
 grant(state, level % 2 === 0 ? 'item.broken-talisman' : 'item.recipe-fragment', 1, grants);
 if (level >= 4 && ctx.rng.drop.chance(Math.min(0.2 + level * 0.02, 0.55))) grant(state, 'item.spirit-stone', 1 + Math.floor(level / 8), grants);
 if (level >= 8 && ctx.rng.drop.chance(0.35)) grant(state, 'item.array-core', 1, grants);
 if (milestone) {
 const seedTierMax = Math.min(4, Math.max(2, Math.ceil(level / 5) + state.player.stage));
 const candidates = [...ctx.content.herbs.values()].filter((herb) => herb.tier <= seedTierMax).map((herb) => herb.seedId).sort();
 if (candidates.length > 0) grant(state, ctx.rng.drop.pick(candidates), 1, grants);
 }

state.exploration.deepestRuinLevel = level;
 emit(state, 'ruin-delve', { level, deepestLevel: level, staminaCost, damage, grants, milestone });
 if (milestone) emit(state, 'ruin-milestone', { level });
 return { ok: true, level, deepestLevel: level, staminaCost, damage, grants, milestone };
}
