import { mutateItem } from '@sim/world/player';
import type { SimContext } from '@sim/world/context';
import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import { MILLI } from '@sim/world/types';
import { hasUpgrade } from '@sim/buildings/upgrades';
import type { SpiritHerbDef } from '@content/defs';

export interface GreenhouseRumor {
 id: string;
 title: string;
 lines: readonly string[];
}

export interface TendGreenhouseResult {
 ok: boolean;
 reason?: string;
 rumor: GreenhouseRumor;
 grantedSeedId: string;
 grantedSeedCount: number;
 revivedTiles: number;
 fertilityGainPerTile: number;
 qiGainPerTile: number;
 staminaCost: number;
 nurseryTier: number;
 nurseryCapacity: number;
 nurserySlotsRemaining: number;
 greenhouseClimate: number;
 greenhouseCareStreak: number;
}

const GREENHOUSE_RUMORS: readonly GreenhouseRumor[] = [
 {
 id: 'winter-bed',
 title: '棚土回温',
 lines: ['暖棚角落里覆着细麻布。', '采药女说，灵苗熬过一夜寒气，来春就能少折一半。'],
 },
 {
 id: 'seed-tray',
 title: '育苗木盘',
 lines: ['木盘里分着几格细土。', '留世之后不赶境界，便能把每一株灵苗都养得更稳。'],
 },
 {
 id: 'quiet-rain',
 title: '薄雾护芽',
 lines: ['棚顶凝着一层温热水汽。', '阵法压住了寒流，草木便肯把灵机慢慢吐出来。'],
 },
 {
 id: 'mortal-season',
 title: '四时留种',
 lines: ['采药女将上季留种重新翻检。', '修炼可以停在此处，日子却还会一季一季往前走。'],
 },
 {
 id: 'off-season-stock',
 title: '反季储苗',
 lines: ['棚角摞着几只反季灵苗的护根匣。', '采药女说，留世的人最该会的事，就是把别人的"过季"养回"正当时"。'],
 },
 {
 id: 'climate-tuning',
 title: '棚温微调',
 lines: ['你拨了拨棚顶的排气窗。', '阵法控的是大寒大热，这一窗一缝，控的才是灵苗肯不肯扎根的细脾气。'],
 },
 {
 id: 'old-vine-frame',
 title: '老藤旧架',
 lines: ['棚里一架老藤还缠着前人搭的木架。', '那架子歪了许多年却没塌——稳，本就是体修第一课。'],
 },
];

const GREENHOUSE_SEED_ROTATION: Record<GameState['season'], readonly string[]> = {
 spring: ['seed.dewroot', 'seed.mossling', 'seed.balmleaf'],
 summer: ['seed.suncap', 'seed.sunmoss', 'seed.mistfern'],
 autumn: ['seed.stonegrain', 'seed.mistfern', 'seed.balmleaf'],
 winter: ['seed.dewroot', 'seed.stonegrain', 'seed.frostmarrow'],
};

const GREENHOUSE_OFF_SEASON_ROTATION: Record<GameState['season'], readonly string[]> = {
 spring: ['seed.frostmarrow', 'seed.stonegrain', 'seed.mistfern'],
 summer: ['seed.dewroot', 'seed.stonegrain', 'seed.balmleaf'],
 autumn: ['seed.sunmoss', 'seed.suncap', 'seed.frostmarrow'],
 winter: ['seed.balmleaf', 'seed.mistfern', 'seed.sunmoss'],
};

export function isOffSeasonSeed(state: GameState, herb: SpiritHerbDef): boolean {
 return herb.preferredSeason != null && herb.preferredSeason !== state.season;
}

export function greenhouseNurseryCapacity(state: GameState): number {
 const tier = greenhouseNurseryTier(state);
 if (tier <= 0) return 0;
 return 2 + tier;
}

export function greenhouseProtectedCropCount(state: GameState): number {
 let count = 0;
 for (const crop of state.crops.values()) {
 if (crop.greenhouseProtected === true) count += 1;
 }
 return count;
}

export function greenhouseCultivationBalance(state: GameState): {
	diversityBonus: number;
	monoculturePenalty: number;
} {
 const protectedDefIds = new Set<string>();
 let repeatedBeds = 0;
 for (const crop of state.crops.values()) {
 if (crop.greenhouseProtected !== true) continue;
 protectedDefIds.add(crop.defId);
 const tile = state.tiles[crop.tileId];
 if ((tile?.consecutiveSameCropSeasons ?? 0) >= 2) repeatedBeds += 1;
 }

let diversityBonus = 0;
 if (protectedDefIds.size >= 3) diversityBonus = 2 * MILLI;
 else if (protectedDefIds.size >= 2) diversityBonus = MILLI;

let monoculturePenalty = 0;
 if (repeatedBeds >= 3) monoculturePenalty = 3 * MILLI;
 else if (repeatedBeds >= 2) monoculturePenalty = 2 * MILLI;
 else if (repeatedBeds >= 1) monoculturePenalty = MILLI;

return { diversityBonus, monoculturePenalty };
}

export function greenhouseNurserySlotsRemaining(state: GameState): number {
 return Math.max(0, greenhouseNurseryCapacity(state) - greenhouseProtectedCropCount(state));
}

export function canPlantOffSeasonInGreenhouse(state: GameState, herb: SpiritHerbDef): boolean {
 if (state.postAscension.mode !== 'stayed-in-world') return false;
 if (greenhouseNurseryTier(state) <= 0) return false;
 if (!isOffSeasonSeed(state, herb)) return false;
 if (greenhouseNurserySlotsRemaining(state) <= 0) return false;
 return state.flags.has(greenhouseVisitFlag(state.day));
}

export function greenhouseVisitFlag(day: number): string {
 return `greenhouse-tended.${day}`;
}

export function greenhouseClimate(state: GameState): number {
 return Math.max(0, Math.min(100 * MILLI, state.stayingWorld?.greenhouseClimate ?? 42 * MILLI));
}

export function greenhouseCareStreak(state: GameState): number {
 return Math.max(0, Math.floor(state.stayingWorld?.greenhouseCareStreak ?? 0));
}

export function greenhouseCareBonus(state: GameState): {
	seedBonus: number;
	fertilityBonus: number;
	qiBonus: number;
} {
 const climate = greenhouseClimate(state);
 const tier = greenhouseNurseryTier(state);
 let seedBonus = 0;
 let fertilityBonus = 0;
 let qiBonus = 0;
 if (climate >= 55 * MILLI) {
 fertilityBonus += 2 * MILLI;
 qiBonus += MILLI;
 }
 if (climate >= 70 * MILLI) {
 seedBonus += 1;
 fertilityBonus += 2 * MILLI;
 qiBonus += 2 * MILLI;
 if (tier >= 2) {
 fertilityBonus += MILLI;
 qiBonus += MILLI;
 }
 }
 if (climate >= 85 * MILLI) {
 seedBonus += 1;
 if (tier >= 3) seedBonus += 1;
 }
 return { seedBonus, fertilityBonus, qiBonus };
}

export function greenhouseClimateCareGainBonus(state: GameState): number {
 const tier = greenhouseNurseryTier(state);
 if (tier >= 3) return 3 * MILLI;
 if (tier >= 2) return 2 * MILLI;
 if (tier >= 1) return MILLI;
 return 0;
}

export function greenhouseClimateNeglectBuffer(state: GameState): number {
 const tier = greenhouseNurseryTier(state);
 if (tier >= 3) return 4 * MILLI;
 if (tier >= 2) return 2 * MILLI;
 if (tier >= 1) return MILLI;
 return 0;
}

export function greenhouseProtectedGrowthMultiplier(state: GameState): number {
 const climate = greenhouseClimate(state);
 const tier = greenhouseNurseryTier(state);
 if (climate >= 85 * MILLI) return 1.2 + (tier >= 3 ? 0.05 : 0);
 if (climate >= 70 * MILLI) return 1.1 + (tier >= 2 ? 0.05 : 0);
 if (climate >= 50 * MILLI) return 1;
 if (climate >= 35 * MILLI) return 0.85;
 if (climate >= 20 * MILLI) return 0.65;
 return 0.45;
}

export function greenhouseProtectedHealthDelta(state: GameState): number {
 const climate = greenhouseClimate(state);
 if (climate >= 70 * MILLI) return 2 * MILLI;
 if (climate >= 50 * MILLI) return 0;
 if (climate >= 35 * MILLI) return -3 * MILLI;
 if (climate >= 20 * MILLI) return -8 * MILLI;
 return -16 * MILLI;
}

export function greenhouseProtectedHarvestBonus(state: GameState): {
	qualityScoreBonus: number;
	yieldBonus: number;
} {
 const climate = greenhouseClimate(state);
 const tier = greenhouseNurseryTier(state);
 if (climate >= 85 * MILLI) {
 return {
 qualityScoreBonus: tier >= 3 ? 0.22 : 0.18,
 yieldBonus: tier >= 3 ? 2 : 1,
 };
 }
 if (climate >= 70 * MILLI) {
 return {
 qualityScoreBonus: tier >= 2 ? 0.12 : 0.1,
 yieldBonus: tier >= 2 ? 1 : 0,
 };
 }
 if (climate >= 55 * MILLI) {
 return { qualityScoreBonus: 0.05, yieldBonus: 0 };
 }
 return { qualityScoreBonus: 0, yieldBonus: 0 };
}

export function greenhouseNurseryTier(state: GameState): number {
 if (hasUpgrade(state, 'greenhouse-nursery-3')) return 3;
 if (hasUpgrade(state, 'greenhouse-nursery-2')) return 2;
 if (hasUpgrade(state, 'greenhouse-nursery-1')) return 1;
 return 0;
}

export function getGreenhouseRumor(state: GameState): GreenhouseRumor {
 const index = (state.year + state.day + state.player.stage) % GREENHOUSE_RUMORS.length;
 return GREENHOUSE_RUMORS[index]!;
}

export function getGreenhouseSeedGrant(state: GameState): { itemId: string; count: number } {
 const tier = greenhouseNurseryTier(state);
 const rotation = tier > 0 ? GREENHOUSE_OFF_SEASON_ROTATION[state.season] : GREENHOUSE_SEED_ROTATION[state.season];
 const index = (state.day + state.seasonDay + state.player.stage) % rotation.length;
 const itemId = rotation[index]!;
 const { seedBonus } = greenhouseCareBonus(state);
 const count = (itemId === 'seed.frostmarrow' ? 1 + tier : 2 + tier) + seedBonus;
 return { itemId, count };
}

export function tendGreenhouse(state: GameState, _ctx: SimContext): TendGreenhouseResult {
 const rumor = getGreenhouseRumor(state);
 const seedGrant = getGreenhouseSeedGrant(state);
 const nurseryTier = greenhouseNurseryTier(state);
 const nurseryCapacity = greenhouseNurseryCapacity(state);
 const staminaCost = 20 * MILLI;
 const careBonus = greenhouseCareBonus(state);
 const careStreak = greenhouseCareStreak(state);
 const climate = greenhouseClimate(state);
 const fertilityGainPerTile = (8 + nurseryTier * 4) * MILLI + careBonus.fertilityBonus;
 const qiGainPerTile = (6 + nurseryTier * 3) * MILLI + careBonus.qiBonus;

if (state.postAscension.mode !== 'stayed-in-world') {
 return {
 ok: false,
 reason: '唯有留世后方能把暖棚当作四时育苗之所',
 rumor,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: 0,
 revivedTiles: 0,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 };
 }

const visitFlag = greenhouseVisitFlag(state.day);
 if (state.flags.has(visitFlag)) {
 return {
 ok: false,
 reason: '今日已养护过暖棚',
 rumor,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: 0,
 revivedTiles: 0,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 };
 }

if (state.player.stamina < staminaCost) {
 return {
 ok: false,
 reason: '体力不足',
 rumor,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: 0,
 revivedTiles: 0,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 };
 }

const granted = mutateItem(state.player, seedGrant.itemId, seedGrant.count);
 if (!granted) {
 return {
 ok: false,
 reason: '背包已满',
 rumor,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: 0,
 revivedTiles: 0,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 };
 }

state.player.stamina -= staminaCost;
 let revivedTiles = 0;
 for (const tile of state.tiles) {
 if (!tile.tilled || tile.blockType !== 'none' || tile.cropId != null) continue;
 tile.fertility = Math.min(100 * MILLI, tile.fertility + fertilityGainPerTile);
 tile.qiDensity = Math.min(100 * MILLI, tile.qiDensity + qiGainPerTile);
 revivedTiles += 1;
 }
 state.flags.add(visitFlag);
 emit(state, 'greenhouse-tend', {
 rumorId: rumor.id,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: seedGrant.count,
 revivedTiles,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 });

return {
 ok: true,
 rumor,
 grantedSeedId: seedGrant.itemId,
 grantedSeedCount: seedGrant.count,
 revivedTiles,
 fertilityGainPerTile,
 qiGainPerTile,
 staminaCost,
 nurseryTier,
 nurseryCapacity,
 nurserySlotsRemaining: greenhouseNurserySlotsRemaining(state),
 greenhouseClimate: climate,
 greenhouseCareStreak: careStreak,
 };
}
