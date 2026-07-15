/**
  * sim 层公共入口：simulateDay（日级推进）/ advanceDay（仅日终）/ applyAction（即时动作）+ 再导出。
 *
  * 渲染层/app 用 applyAction 即时响应玩家按键、用 advanceDay 在"结束当日"时推进；
  * 无头/bot 用 simulateDay 一次推进一整日。纯函数（除对 state 的确定性变更 + 注入 rng）。
 */
import type { GameState } from './world/state';
import { clearEvents, emit } from './world/state';
import type { DayInput, PlayerAction } from './world/input';
import type { SimContext } from './world/context';
import { applyAction as applyActionImpl } from './farm/actions';
import { applyFarmDayEnd, growthPerDay, qiFactor, soilFactor, seasonFactor, herbQiDemand } from './farm/farmSystem';
import { tickCelestial } from './celestial/celestialSystem';
import { tickBeasts } from './celestial/beastSystem';
import { deriveStreams, type RngStreams } from './world/rng';
import { DEFAULT_BALANCE, withDefaultBalanceParams, type BalanceParams } from './params';
import { MILLI } from './world/types';
import type { ContentRegistry } from '@content/defs';
import { advanceLifespanDay, advanceTribulationDay, normalizeBodyCultivation } from './progression/bodyCultivation';
import { resolveDueTribulation } from './progression/tribulationFlow';
import { settleShipping } from './economy/shipping';
import { advanceFacilityJobs } from './buildings/facilities';
import { advanceSpecialOrdersDay } from './social/commissions';
import { advanceStayingWorldDay } from './progression/stayingWorld';

/** 构造模拟上下文（注入 RNG/参数/内容）。同 seed ⇒ 同 RNG 流 ⇒ 确定性。 */
export function createSimContext(
 seed: number | string,
 content: ContentRegistry,
 params: BalanceParams = DEFAULT_BALANCE,
): SimContext {
 return { rng: deriveStreams(seed), params: withDefaultBalanceParams(params), content };
}

/** 从已有 state 的 masterSeed 重建 ctx（读档后继续，RNG 从快照恢复）。 */
export function createSimContextFromState(
 state: GameState,
 content: ContentRegistry,
 params: BalanceParams = DEFAULT_BALANCE,
): SimContext {
 const rng = deriveStreams(state.masterSeed);
 const rs = state.rngSnapshot;
 rng.world.restore(rs.world ?? 0);
 rng.growth.restore(rs.growth ?? 0);
 rng.lightning.restore(rs.lightning ?? 0);
 rng.alchemy.restore(rs.alchemy ?? 0);
 rng.celestial.restore(rs.celestial ?? 0);
 rng.beast.restore(rs.beast ?? 0);
 rng.drop.restore(rs.drop ?? 0);
 return { rng, params: withDefaultBalanceParams(params), content };
}

/** 把 RNG 流快照存回 state（便于中途存档/回放）。 */
function snapshotRng(state: GameState, ctx: SimContext): void {
	for (const k of Object.keys(ctx.rng) as (keyof RngStreams)[]) {
 if (k === 'master') continue;
 const stream = ctx.rng[k];
 if (stream && typeof stream === 'object' && 'snapshot' in stream) {
	state.rngSnapshot[k] = (stream as unknown as { snapshot: () => number }).snapshot();
 }
 }
}

/** 日终结算：天象推进 + 农场结算（生长/灵气/土壤）+ 妖兽潮因果链。天象调制当日 growth/qi。 */
function resolveDayEnd(state: GameState, ctx: SimContext): void {
 const mods = tickCelestial(state, ctx);
 applyFarmDayEnd(state, ctx, mods.growthMod, mods.qiMod);
 advanceStayingWorldDay(state);
 tickBeasts(state, ctx); // 灵气潮汐→灵草成熟→引来妖兽啃食
 advanceFacilityJobs(state, ctx);
 settleShipping(state, ctx);
 advanceSpecialOrdersDay(state);
}

/** 即时应用一个玩家动作（渲染层按键响应用）。不清事件、不推进日。 */
export function applyAction(state: GameState, action: PlayerAction, ctx: SimContext): void {
	normalizeBodyCultivation(state, ctx.params);
 applyActionImpl(state, action, ctx);
 checkGameEnd(state, ctx);
}

/** 死亡检查：HP≤0 → 陨于天劫；丹毒满 → 暴毙。达成则置 gameOver。 */
export function checkGameEnd(state: GameState, ctx: SimContext): void {
 if (state.gameOver) return;
 const cap = ctx.params.pillPoison.cap * 1000;
 if (state.player.hp <= 0) {
 state.ending = 'tribulation-death';
 state.gameOver = true;
 emit(state, 'ending', { ending: 'tribulation-death' });
 } else if (state.player.pillPoison >= cap) {
 state.ending = 'poison-death';
 state.gameOver = true;
 emit(state, 'ending', { ending: 'poison-death' });
 }
}

/**
  * 结束当日（app 的"过夜"）：日终结算 + 次日清晨体力恢复 + RNG 快照。
  * 渲染层在白昼用 applyAction 即时操作，按"过夜"键调用本函数推进。
 */
export function advanceDay(state: GameState, ctx: SimContext): void {
	normalizeBodyCultivation(state, ctx.params);
 resolveDayEnd(state, ctx);
 advanceTribulationDay(state, ctx);
 resolveDueTribulation(state, ctx);
 advanceLifespanDay(state, ctx);
 state.player.stamina = ctx.params.player.staminaCap * MILLI; // 次日清晨
 checkGameEnd(state, ctx);
 snapshotRng(state, ctx);
}

/** 无头/bot：一次推进一整日（清晨恢复 → 动作 → 日终结算），返回当日事件。 */
export function simulateDay(state: GameState, input: DayInput, ctx: SimContext): GameState['events'] {
 clearEvents(state);
	normalizeBodyCultivation(state, ctx.params);
 state.player.stamina = ctx.params.player.staminaCap * MILLI; // 当日清晨
 for (const a of input.actions) applyActionImpl(state, a, ctx);
 resolveDayEnd(state, ctx);
 advanceTribulationDay(state, ctx);
 resolveDueTribulation(state, ctx);
 advanceLifespanDay(state, ctx);
 checkGameEnd(state, ctx);
 snapshotRng(state, ctx);
 return state.events;
}

// —— 公共再导出 ——
export * from './world/state';
export { Rng, deriveStreams, hashStr } from './world/rng';
export type { RngStreams, RngState } from './world/rng';
export * from './world/types';
export type { PlayerAction, DayInput } from './world/input';
export type { SimContext } from './world/context';
export { applyFarmDayEnd, growthPerDay, qiFactor, soilFactor, seasonFactor, herbQiDemand, careFactor } from './farm/farmSystem';
export { applyPill } from './alchemy/pillSystem';
export { brewPills, resolveBrew } from './alchemy/alchemySystem';
export { ARRAY_BUILD_COSTS, activeArraysCoveringTile, hasActiveArrayCoverage, placeArray, arrayModifierFor } from './tribulation/arrays';
export type { ArrayCost, PlaceArrayOptions } from './tribulation/arrays';
export { arrayWardenResonanceForTile, assignGuardBeastPatrol, feedGuardBeast, guardBeastMasteryReady, preferredGuardBeastForPatrol, tickBeasts, qiTideActive, tameGuardBeast } from './celestial/beastSystem';
export type { ArrayWardenResonance } from './celestial/beastSystem';
export type { AssignGuardBeastPatrolResult, FeedGuardBeastResult, TameGuardBeastResult } from './celestial/beastSystem';
export {
 buyFestivalStallItem,
 currentFestivalEventId,
 festivalParticipationFlag,
 getFestivalStallItems,
 hasParticipatedCurrentFestival,
 participateFestival,
 selectCelestialEvent,
 startPurpleOmenIfDue,
 tickCelestial,
} from './celestial/celestialSystem';
export type { BuyFestivalStallResult, FestivalEventId, FestivalParticipationResult, FestivalStallItem } from './celestial/celestialSystem';
export { TRADE_CATALOG, getTradeOffers, executeTrade } from './economy/trade';
export type { TradeOffer, TradeResult } from './economy/trade';
export { getMarketDemands, marketDemandForItem } from './economy/market';
export type { MarketDemand } from './economy/market';
export { shippingUnitPrice, canShipItem, shipItem, shipQualityItem, shippingLines, settleShipping } from './economy/shipping';
export type { ShipResult, ShippingLine, ShippingSettlement } from './economy/shipping';
export { SHOP_CATALOG, getShopItems, buyShopItem } from './economy/shop';
export type { ShopItem, BuyShopResult } from './economy/shop';
export { FERTILIZER_CATALOG, cropQualityScore, getFertilizer, qualityBonusYield, qualityFromScore } from './farm/quality';
export type { CropQuality, FertilizerDef } from './farm/quality';
export { delveRuin, exploreSite } from './exploration/explore';
export type { ExplorationSite, ExplorationResult, RuinDelveResult } from './exploration/explore';
export { RUIN_CHAPTER_CATALOG, claimRuinChapter, getCurrentRuinChapter, getRuinChapters, isRuinChapterClaimed, ruinChapterFlag } from './exploration/ruinChapters';
export type { RuinChapterDef, RuinChapterResult, RuinChapterReward, RuinChapterStatus } from './exploration/ruinChapters';
export { UPGRADE_CATALOG, farmExpansionTier, getAvailableUpgrades, performUpgrade, hasUpgrade, toolAreaSize, toolStaminaMultiplier, upgradeFlag } from './buildings/upgrades';
export type { ToolActionKind, UpgradeCost, UpgradeDef, UpgradeResult } from './buildings/upgrades';
export { FACILITY_BUILD_COSTS, FACILITY_EXPANSION_REQUIREMENT, FACILITY_LABEL, FACILITY_PLACEMENT_BANDS, FACILITY_RECIPES, adjacentFacility, advanceFacilityJobs, collectFacility, facilityAt, facilityExpansionRequirement, facilityPlacementBand, facilityPlacementRuleText, hasAdjacentFacility, placeFacility, startDryingJob, startFacilityRecipeJob, startFurnaceJob, startSealingJob } from './buildings/facilities';
export type { FacilityCost, FacilityJobResult, FacilityRecipeDef, FacilityRecipeInput, PlaceFacilityOptions, PlaceFacilityResult } from './buildings/facilities';
export { NPC_CATALOG, bestGiftItemForNpc, ensureSocialState, getNpcDailySchedules, getNpcList, getRelationship, giveGift, isNpcBirthday, npcScheduleForDay } from './social/relationships';
export type { GiftResult, NpcDailySchedule, NpcDef, NpcScheduleRule, RelationshipState } from './social/relationships';
export { RELATIONSHIP_EVENT_CATALOG, availableRelationshipEvents, claimRelationshipEvent, hasRelationshipPerk, isRelationshipEventSeen, markRelationshipEventSeen, nextRelationshipEvent, relationshipEventFlag } from './social/relationshipEvents';
export type { RelationshipEvent, RelationshipEventDef } from './social/relationshipEvents';
export { NPC_QUEST_CATALOG, claimNpcQuest, getCurrentNpcQuest, getNpcQuestLine, isNpcQuestClaimed, npcQuestFlag } from './social/npcQuests';
export type { NpcQuestDef, NpcQuestResult, NpcQuestReward, NpcQuestStatus } from './social/npcQuests';
export { calendarEntriesForDay, calendarEntriesForSeason, upcomingCalendarEntries } from './social/calendar';
export type { CalendarEntry, CalendarEntryKind } from './social/calendar';
export { COMMISSION_CATALOG, SPECIAL_ORDER_CATALOG, acceptSpecialOrder, advanceSpecialOrdersDay, commissionFlag, completeCommission, getActiveSpecialOrders, getAvailableCommissions, getAvailableSpecialOrders, getDailyCommission, getDailySpecialOrder, getSpecialOrders, claimSpecialOrder, specialOrderCompleteFlag, submitSpecialOrderItems } from './social/commissions';
export type { CommissionDef, CommissionResult, SpecialOrderDef, SpecialOrderResult, SpecialOrderStatus } from './social/commissions';
export { LOCATION_CATALOG, getActiveLocationDirectory, getLocationDirectory, getLocationEncounters, getLocationServiceAvailability, getLocationServiceOptions, getPreferredLocationSelection, getQuickLocationServiceOption, locationIdForDisplayName, locationIndexFromDigitCode, locationServiceIndexFromDigitKey, locationSummary } from './world/locations';
export type { LocationDef, LocationEncounter, LocationId, LocationService, LocationServiceAvailability, LocationServiceCommand, LocationServiceOption, LocationStatus, PreferredLocationSelection, QuickLocationServiceBinding } from './world/locations';
export { applyMvpStarterKit } from './world/starterKit';
export { depositItem, depositQualityItem, storageItemCount, storageQualityItemCount, storageUsed, withdrawItem, withdrawQualityItem } from './storage/storage';
export type { StorageResult } from './storage/storage';
export { applyPoultice, brewHerbalWine, compostHerb, consumeHerbalWine, dryHerb, makePoultice, offerRefinedTea, refineArrayCore, sealHerb } from './processing/processing';
export type { ConsumeHerbalWineResult, ProcessingResult } from './processing/processing';
export { ARCHIVE_DONATION_CATALOG, ARCHIVE_MILESTONE_CATALOG, archiveDonationCount, archiveDonationFlag, archiveMilestoneFlag, claimArchiveMilestone, donateToArchive, getArchiveDonations, getArchiveMilestones, isArchiveDonationComplete, isArchiveMilestoneClaimed, nextArchiveDonation, nextArchiveMilestone } from './collection/archive';
export type { ArchiveDonationDef, ArchiveDonationResult, ArchiveDonationReward, ArchiveDonationStatus, ArchiveMilestoneDef, ArchiveMilestoneResult, ArchiveMilestoneStatus } from './collection/archive';
export { MAINLINE_QUEST_CATALOG, claimMainlineQuest, getCurrentMainlineQuest, getMainlineQuests, isMainlineQuestClaimed, mainlineQuestFlag } from './story/mainline';
export type { MainlineQuestDef, MainlineQuestResult, MainlineQuestReward, MainlineQuestStatus } from './story/mainline';
export { FIRST_HARVEST_FLAG, FIRST_MARKET_RESTOCK_FLAG, FIRST_SECOND_SOW_FLAG, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG, FIRST_SHIPPING_SETTLEMENT_FLAG, getOnboardingObjectiveId } from './story/onboarding';
export type { OnboardingObjectiveId } from './story/onboarding';
export {
 normalizeBodyCultivation,
 bodyFoundationCap,
 readyToInvokeTribulation,
 recordTribulationInvocation,
 invokeTribulation,
 startTribulationCountdown,
 shouldStartForcedTribulationCountdown,
 advanceTribulationDay,
 clearTribulationCountdown,
 advanceLifespanDay,
} from './progression/bodyCultivation';
export { resolveDueTribulation, standardTribulationBoltCount } from './progression/tribulationFlow';
export type { DueTribulationResolution } from './progression/tribulationFlow';
export { triggerAscensionChoice, resolveAscensionChoice } from './progression/postAscension';
export type { AscensionChoice } from './progression/postAscension';
export { advanceStayingWorldDay, ensureStayingWorldState, startStayingWorld } from './progression/stayingWorld';
export { getPrimaryStayingWorldGoal, getStayingWorldGoals, renderStayingWorldGoals } from './progression/stayingWorldGoals';
export type { StayingWorldGoalStatus, StayingWorldGoalTrack } from './progression/stayingWorldGoals';
export { getCurrentStayingWorldIncident, hasResolvedStayingWorldIncidentForDay, refreshStayingWorldIncident, resolveStayingWorldIncident, STAYING_WORLD_INCIDENT_CATALOG } from './progression/stayingWorldIncidents';
export type { ResolveStayingWorldIncidentResult, StayingWorldIncidentDef } from './progression/stayingWorldIncidents';
export { TEA_REGULAR_ACHIEVEMENT_FLAG, getTeaShedRumor, getTeaShedTale, hasTeaShedRegularAchievement, isTeaShedTaleDay, teaShedVisitFlag, teaShedVisitStreak, visitTeaShed } from './social/teaShed';
export type { TeaShedRumor, TeaShedTale, VisitTeaShedResult } from './social/teaShed';
export {
 canPlantOffSeasonInGreenhouse,
 getGreenhouseRumor,
 getGreenhouseSeedGrant,
 greenhouseCareBonus,
 greenhouseCareStreak,
 greenhouseClimateCareGainBonus,
 greenhouseClimate,
 greenhouseCultivationBalance,
 greenhouseClimateNeglectBuffer,
 greenhouseProtectedGrowthMultiplier,
 greenhouseProtectedHarvestBonus,
 greenhouseProtectedHealthDelta,
 greenhouseNurseryCapacity,
 greenhouseNurserySlotsRemaining,
 greenhouseNurseryTier,
 greenhouseProtectedCropCount,
 greenhouseVisitFlag,
 isOffSeasonSeed,
 tendGreenhouse,
} from './social/greenhouse';
export type { GreenhouseRumor, TendGreenhouseResult } from './social/greenhouse';
export { DEFAULT_BALANCE, withDefaultBalanceParams } from './params';
export type { BalanceParams } from './params';
export type { GameState } from './world/state';
