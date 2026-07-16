import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import {
 advanceFacilityJobs,
 applyAction,
 collectFacility,
 createSimContext,
 createWorld,
 DEFAULT_BALANCE,
 FACILITY_RECIPES,
 farmExpansionTier,
 facilityAt,
 hasAdjacentFacility,
 markRelationshipEventSeen,
 placeArray,
 placeFacility,
 startDryingJob,
 startFacilityRecipeJob,
 startFurnaceJob,
 startSealingJob,
 tileAt,
 upgradeFlag,
} from '@sim';
import { roundTripEqual } from '@sim/serialize';
import { itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';

function setup() {
 const reg = buildRegistry();
 const state = createWorld({ seed: 83, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(83, reg, DEFAULT_BALANCE);
 return { state, ctx };
}

function placeFree(state: ReturnType<typeof setup>['state'], kind: 'drying-rack' | 'sealing-cabinet' | 'talisman-furnace', x: number, y: number) {
 return placeFacility(state, kind, x, y, { free: true });
}

function unlockExpansionTier(state: ReturnType<typeof setup>['state'], tier: 1 | 2 | 3): void {
 for (let i = 1; i <= tier; i += 1) state.flags.add(upgradeFlag(`farmstead-expansion-${i}`));
 const centerX = Math.floor(state.width / 2);
 const centerY = Math.floor(state.height / 2);
 const radius = tier + 1;
 for (let y = centerY - radius; y <= centerY + radius; y += 1) {
 for (let x = centerX - radius; x <= centerX + radius; x += 1) {
 const tile = tileAt(state, x, y);
 if (!tile) continue;
 if (tile.blockType === 'building' || tile.arrayId != null || tile.cropId != null) continue;
 tile.blockType = 'none';
 tile.soilType = 'loam';
 tile.fertility = Math.max(tile.fertility, 40_000);
 }
 }
}

describe('农庄设施空间化', () => {
 it('静态设施配方登记封藏与熔炼链条', () => {
 expect(FACILITY_RECIPES['recipe.facility.sealed-herb']).toMatchObject({
 facilityKind: 'sealing-cabinet',
 outputItemId: 'item.sealed-herb',
 outputCount: 1,
 days: 2,
 });
 expect(FACILITY_RECIPES['recipe.facility.array-core']).toMatchObject({
 facilityKind: 'talisman-furnace',
 outputItemId: 'item.array-core',
 outputCount: 1,
 days: 1,
 });
 });

it('可在空地放置晾晒架并占用地块', () => {
 const { state } = setup();
 const result = placeFree(state, 'drying-rack', 1, 1);
 const tile = tileAt(state, 1, 1)!;

expect(result.ok).toBe(true);
 expect(tile.blockType).toBe('building');
 expect(facilityAt(state, tile.id)?.kind).toBe('drying-rack');
 expect(state.events.some((e) => e.type === 'facility-place')).toBe(true);
 });

it('扩建层级会限制高阶设施解锁，并发出明确失败原因', () => {
 const { state } = setup();

const cabinetLocked = placeFree(state, 'sealing-cabinet', 1, 1);
 expect(cabinetLocked.ok).toBe(false);
 expect(cabinetLocked.reason).toBe('封藏柜需农庄扩建1阶');

const furnaceLocked = placeFree(state, 'talisman-furnace', 2, 1);
 expect(furnaceLocked.ok).toBe(false);
 expect(furnaceLocked.reason).toBe('炼符炉需农庄扩建2阶');

const failed = state.events.filter((e) => e.type === 'facility-place-failed');
 expect(failed).toHaveLength(2);
 expect(failed[0]?.payload).toMatchObject({ kind: 'sealing-cabinet', requiredExpansionTier: 1, currentExpansionTier: 0 });
 expect(failed[1]?.payload).toMatchObject({ kind: 'talisman-furnace', requiredExpansionTier: 2, currentExpansionTier: 0 });
 });

it('农庄扩建后会逐步解锁封藏柜与炼符炉建造', () => {
 const { state } = setup();

unlockExpansionTier(state, 1);
 expect(farmExpansionTier(state)).toBe(1);
 expect(placeFree(state, 'sealing-cabinet', 1, 1).ok).toBe(true);
 expect(placeFree(state, 'talisman-furnace', 0, 2).ok).toBe(false);

unlockExpansionTier(state, 2);
 expect(farmExpansionTier(state)).toBe(2);
 expect(placeFree(state, 'talisman-furnace', 0, 2).ok).toBe(true);
 });

it('设施会按核心区、中院、外院分层限制摆放', () => {
 const { state } = setup();

expect(placeFree(state, 'drying-rack', 0, 0)).toMatchObject({ ok: false, reason: '晾晒架需建在农庄核心区' });

unlockExpansionTier(state, 1);
 expect(placeFree(state, 'sealing-cabinet', 2, 2)).toMatchObject({ ok: false, reason: '封藏柜需建在中院加工区' });
 expect(placeFree(state, 'sealing-cabinet', 1, 1).ok).toBe(true);

unlockExpansionTier(state, 2);
 expect(placeFree(state, 'talisman-furnace', 1, 1)).toMatchObject({ ok: false, reason: '炼符炉需建在外院工坊区' });
 expect(placeFree(state, 'talisman-furnace', 0, 2).ok).toBe(true);
 });

it('拒绝在已耕作或已占用地块重复建造', () => {
 const { state } = setup();
 const tile = tileAt(state, 1, 1)!;
 tile.tilled = true;

expect(placeFree(state, 'drying-rack', 1, 1).ok).toBe(false);
 tile.tilled = false;
 expect(placeFree(state, 'drying-rack', 1, 1).ok).toBe(true);
 expect(placeFree(state, 'sealing-cabinet', 1, 1).ok).toBe(false);
 });

it('玩家建造设施需要材料，成功后扣除并发出成本事件', () => {
 const { state, ctx } = setup();
 state.player.position = { x: 2, y: 2 };

applyAction(state, { kind: 'place-facility', at: { x: 2, y: 1 }, facilityKind: 'drying-rack' }, ctx);
 expect(state.facilities.size).toBe(0);

mutateItem(state.player, 'item.spirit-stone', 3);
 mutateItem(state.player, 'herb.mossling', 2);
 applyAction(state, { kind: 'place-facility', at: { x: 2, y: 1 }, facilityKind: 'drying-rack' }, ctx);

expect(state.facilities.size).toBe(1);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'herb.mossling')).toBe(0);
 const placed = state.events.find((e) => e.type === 'facility-place')!;
 expect(placed.payload).toMatchObject({ kind: 'drying-rack' });
 expect((placed.payload as { costs?: unknown[] }).costs?.length).toBe(2);
 });

it('设施阻挡移动并可被邻接检测识别', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 1);
 state.player.position = { x: 2, y: 2 };
 applyAction(state, { kind: 'place-facility', at: { x: 2, y: 1 }, facilityKind: 'sealing-cabinet', free: true }, ctx);

expect(hasAdjacentFacility(state, 2, 2, 'sealing-cabinet')).toBe(true);
 applyAction(state, { kind: 'move', to: { x: 2, y: 1 } }, ctx);
 expect(state.player.position).toEqual({ x: 2, y: 2 });
 });

it('设施随存档往返保留', () => {
 const { state } = setup();
 placeFree(state, 'drying-rack', 1, 1);
 unlockExpansionTier(state, 2);
 placeFree(state, 'sealing-cabinet', 3, 1);
 placeFree(state, 'talisman-furnace', 0, 2);

expect(roundTripEqual(state)).toBe(true);
 });

it('玩家建造炼符炉需要遗迹材料和晾晒灵草', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 2);
 state.player.position = { x: 2, y: 1 };

applyAction(state, { kind: 'place-facility', at: { x: 2, y: 0 }, facilityKind: 'talisman-furnace' }, ctx);
 expect(state.facilities.size).toBe(0);

mutateItem(state.player, 'item.spirit-stone', 10);
 mutateItem(state.player, 'item.broken-talisman', 2);
 mutateItem(state.player, 'item.dried-herb', 1);
 applyAction(state, { kind: 'place-facility', at: { x: 2, y: 0 }, facilityKind: 'talisman-furnace' }, ctx);

expect(state.facilities.size).toBe(1);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
 expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
 expect([...state.facilities.values()][0]?.kind).toBe('talisman-furnace');
 });

it('晾晒架启动队列时消耗灵草，过夜后才可收取产物', () => {
 const { state, ctx } = setup();
 const placed = placeFree(state, 'drying-rack', 1, 1).facility!;
 mutateQualityItem(state.player, 'herb.dewroot', 'spirit', 1);

const started = startDryingJob(state, placed.id, 'herb.dewroot', ctx, 'spirit');

expect(started.ok).toBe(true);
 expect(qualityItemCount(state.player, 'herb.dewroot', 'spirit')).toBe(0);
 expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
 expect(placed.job).toEqual({ inputItemId: 'herb.dewroot', outputItemId: 'item.dried-herb', outputCount: 2, daysRemaining: 1 });
 expect(collectFacility(state, placed.id).ok).toBe(false);

advanceFacilityJobs(state);
 expect(placed.job?.daysRemaining).toBe(0);
 expect(collectFacility(state, placed.id).ok).toBe(true);
 expect(placed.job).toBeNull;
 expect(itemCount(state.player, 'item.dried-herb')).toBe(2);
 });

it('忙碌设施拒绝新加工队列', () => {
 const { state, ctx } = setup();
 const placed = placeFree(state, 'drying-rack', 1, 1).facility!;
 mutateItem(state.player, 'herb.mossling', 2);

expect(startDryingJob(state, placed.id, 'herb.mossling', ctx).ok).toBe(true);
 const rejected = startDryingJob(state, placed.id, 'herb.mossling', ctx);

expect(rejected.ok).toBe(false);
 expect(rejected.reason).toBe('设施忙碌');
 expect(itemCount(state.player, 'herb.mossling')).toBe(1);
 });

it('封藏柜消耗晾晒灵草与灵壤肥，二日后产出封藏灵草', () => {
 const { state } = setup();
 unlockExpansionTier(state, 1);
 const placed = placeFree(state, 'sealing-cabinet', 1, 1).facility!;
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);

const started = startSealingJob(state, placed.id);

expect(started.ok).toBe(true);
 expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
 expect(placed.job).toEqual({ inputItemId: 'item.dried-herb', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 2 });
 advanceFacilityJobs(state);
 expect(collectFacility(state, placed.id).ok).toBe(false);
 advanceFacilityJobs(state);
 expect(collectFacility(state, placed.id).ok).toBe(true);
 expect(itemCount(state.player, 'item.sealed-herb')).toBe(1);
 });

it('农庄扩建一阶后，封藏柜贴近晾晒架会额外缩短一日加工时间', () => {
 const { state } = setup();
 unlockExpansionTier(state, 1);
 placeFree(state, 'drying-rack', 1, 2);
 const cabinet = placeFree(state, 'sealing-cabinet', 1, 1).facility!;
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);

expect(startSealingJob(state, cabinet.id).ok).toBe(true);

advanceFacilityJobs(state);

expect(cabinet.job?.daysRemaining).toBe(0);
 expect(state.events.some((e) => e.type === 'facility-layout-support')).toBe(true);
 expect(collectFacility(state, cabinet.id).ok).toBe(true);
 expect(itemCount(state.player, 'item.sealed-herb')).toBe(1);
 });

it('通用设施配方入口可启动封藏队列', () => {
 const { state } = setup();
 unlockExpansionTier(state, 1);
 const placed = placeFree(state, 'sealing-cabinet', 1, 1).facility!;
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);

const started = startFacilityRecipeJob(state, placed.id, 'recipe.facility.sealed-herb');

expect(started.ok).toBe(true);
 expect(placed.job).toEqual({ inputItemId: 'item.dried-herb', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 2 });
 const event = state.events.find((e) => e.type === 'facility-job-start')!;
 expect(event.payload).toMatchObject({ recipeId: 'recipe.facility.sealed-herb', catalystItemId: 'item.spirit-compost' });
 });

it('炼符炉消耗破损法宝与灵石，一日后产出阵核', () => {
 const { state } = setup();
 unlockExpansionTier(state, 2);
 const placed = placeFree(state, 'talisman-furnace', 0, 2).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

const started = startFurnaceJob(state, placed.id);

expect(started.ok).toBe(true);
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(placed.job).toEqual({ inputItemId: 'item.broken-talisman', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 1 });
 expect(collectFacility(state, placed.id).ok).toBe(false);
 advanceFacilityJobs(state);
 expect(collectFacility(state, placed.id).ok).toBe(true);
 expect(itemCount(state.player, 'item.array-core')).toBe(1);
 });

it('阵匠老陆关系事件让熔炼阵核少消耗一枚灵石', () => {
 const { state } = setup();
 unlockExpansionTier(state, 2);
 const lockedFurnace = placeFree(state, 'talisman-furnace', 0, 2).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 1);

const locked = startFurnaceJob(state, lockedFurnace.id);

expect(locked.ok).toBe(false);
 expect(locked.reason).toBe('灵石不足');
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(1);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);

markRelationshipEventSeen(state, 'array-smith-160');
 const discounted = startFurnaceJob(state, lockedFurnace.id);

expect(discounted.ok).toBe(true);
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 expect(lockedFurnace.job).toEqual({ inputItemId: 'item.broken-talisman', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 1 });
 });

it('通用设施配方拒绝错误设施类型且不消耗材料', () => {
 const { state } = setup();
 const rack = placeFree(state, 'drying-rack', 1, 1).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

const rejected = startFacilityRecipeJob(state, rack.id, 'recipe.facility.array-core');

expect(rejected.ok).toBe(false);
 expect(rejected.reason).toBe('不是炼符炉');
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(1);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(2);
 });

it('通过 applyAction 分发设施队列与收取动作', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 2);
 const rack = placeFree(state, 'drying-rack', 1, 1).facility!;
 const cabinet = placeFree(state, 'sealing-cabinet', 3, 1).facility!;
 const furnace = placeFree(state, 'talisman-furnace', 0, 2).facility!;
 mutateItem(state.player, 'herb.mossling', 1);
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

applyAction(state, { kind: 'start-drying-job', facilityId: rack.id, itemId: 'herb.mossling' }, ctx);
 applyAction(state, { kind: 'start-sealing-job', facilityId: cabinet.id }, ctx);
 applyAction(state, { kind: 'start-furnace-job', facilityId: furnace.id }, ctx);
 expect(rack.job?.daysRemaining).toBe(1);
 expect(cabinet.job?.daysRemaining).toBe(2);
 expect(furnace.job?.daysRemaining).toBe(1);

advanceFacilityJobs(state);
 applyAction(state, { kind: 'collect-facility', facilityId: rack.id }, ctx);
 applyAction(state, { kind: 'collect-facility', facilityId: furnace.id }, ctx);
 expect(itemCount(state.player, 'item.dried-herb')).toBe(1);
 expect(itemCount(state.player, 'item.array-core')).toBe(1);
 advanceFacilityJobs(state);
 applyAction(state, { kind: 'collect-facility', facilityId: cabinet.id }, ctx);
 expect(itemCount(state.player, 'item.sealed-herb')).toBe(1);
 });

it('通过 applyAction 通用设施配方分发熔炼队列', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 2);
 const furnace = placeFree(state, 'talisman-furnace', 0, 2).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

applyAction(state, { kind: 'start-facility-recipe-job', facilityId: furnace.id, recipeId: 'recipe.facility.array-core' }, ctx);

expect(furnace.job).toEqual({ inputItemId: 'item.broken-talisman', outputItemId: 'item.array-core', outputCount: 1, daysRemaining: 1 });
 expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
 expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
 });

it('炼符炉靠近引雷阵时可在日终额外推进一日', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 2);
 const furnace = placeFree(state, 'talisman-furnace', 0, 2).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

const coreTile = tileAt(state, 0, 4)!;
 const herb = ctx.content.herbs.get('herb.metalpine')!;
 state.crops.set(coreTile.id, {
 id: coreTile.id,
 defId: 'herb.metalpine',
 tileId: coreTile.id,
 growth: herb.growthThreshold,
 health: 100_000,
 stage: 'sprout',
 plantedDay: state.day,
 property: herb.baseProperty,
 tempered: false,
 });
 coreTile.cropId = coreTile.id;
 const crop = state.crops.get(coreTile.id)!;
 crop.stage = 'mature';
 crop.growth = herb.growthThreshold;
 placeArray(state, 'array.lightning-rod', 0, 4, ctx, { free: true });

expect(startFurnaceJob(state, furnace.id).ok).toBe(true);
 advanceFacilityJobs(state, ctx);

expect(furnace.job?.daysRemaining).toBe(0);
 expect(state.events.some((e) => e.type === 'facility-job-support')).toBe(true);
 });

it('农庄扩建二阶后，炼符炉贴近封藏柜会额外缩短一日熔炼时间', () => {
 const { state } = setup();
 unlockExpansionTier(state, 2);
 placeFree(state, 'sealing-cabinet', 1, 1);
 const furnace = placeFree(state, 'talisman-furnace', 1, 0).facility!;
 mutateItem(state.player, 'item.broken-talisman', 1);
 mutateItem(state.player, 'item.spirit-stone', 2);

expect(startFurnaceJob(state, furnace.id).ok).toBe(true);

advanceFacilityJobs(state);

expect(furnace.job?.daysRemaining).toBe(0);
 expect(state.events.some((e) => e.type === 'facility-layout-support')).toBe(true);
 expect(collectFacility(state, furnace.id).ok).toBe(true);
 expect(itemCount(state.player, 'item.array-core')).toBe(1);
 });

it('晾晒与封藏需要绝缘阵加持且高羁绊巡守兽协助才会额外推进', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 1);
 const rack = placeFree(state, 'drying-rack', 1, 1).facility!;
 const cabinet = placeFree(state, 'sealing-cabinet', 1, 3).facility!;
 state.guardBeasts.push({ id: 41, vigor: 3, maxVigor: 3, bond: ctx.params.celestial.beast.guardBondCostReductionThreshold, specialty: null });
 mutateItem(state.player, 'herb.mossling', 1);
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);

placeArray(state, 'array.insulation', 1, 2, ctx, { free: true });
 placeArray(state, 'array.insulation', 1, 4, ctx, { free: true });

expect(startDryingJob(state, rack.id, 'herb.mossling', ctx).ok).toBe(true);
 expect(startSealingJob(state, cabinet.id).ok).toBe(true);

advanceFacilityJobs(state, ctx);

expect(rack.job?.daysRemaining).toBe(0);
 expect(cabinet.job?.daysRemaining).toBe(0);
 expect(state.guardBeasts[0]?.vigor).toBe(1);
 expect(state.events.filter((e) => e.type === 'facility-job-support')).toHaveLength(2);
 });

it('缺少高羁绊巡守兽时，绝缘阵不会单独加速晾晒与封藏', () => {
 const { state, ctx } = setup();
 unlockExpansionTier(state, 1);
 const rack = placeFree(state, 'drying-rack', 1, 1).facility!;
 const cabinet = placeFree(state, 'sealing-cabinet', 1, 3).facility!;
 state.guardBeasts.push({ id: 7, vigor: 3, maxVigor: 3, bond: 0, specialty: null });
 mutateItem(state.player, 'herb.mossling', 1);
 mutateItem(state.player, 'item.dried-herb', 2);
 mutateItem(state.player, 'item.spirit-compost', 1);
 placeArray(state, 'array.insulation', 1, 2, ctx, { free: true });
 placeArray(state, 'array.insulation', 1, 4, ctx, { free: true });

expect(startDryingJob(state, rack.id, 'herb.mossling', ctx).ok).toBe(true);
 expect(startSealingJob(state, cabinet.id).ok).toBe(true);

advanceFacilityJobs(state, ctx);

expect(rack.job?.daysRemaining).toBe(0);
 expect(cabinet.job?.daysRemaining).toBe(1);
 expect(state.guardBeasts[0]?.vigor).toBe(3);
 expect(state.events.some((e) => e.type === 'facility-job-support')).toBe(false);
 });
});
