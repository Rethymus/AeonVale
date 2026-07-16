import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE, FIRST_SECOND_WATER_FLAG } from '@sim';
import { collectFarmsteadActionSignals, formatLocationActionSignalLine } from '@app/locationActionSignals';

describe('location action signals', () => {
 it('summarizes actionable farmstead logistics from existing offline sim state', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 71, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.facilities.set(1, {
 id: 1,
 kind: 'drying-rack',
 tileId: state.tiles[0]!.id,
 job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 },
 });
 state.shippingBin['herb.mossling'] = 2;

expect(formatLocationActionSignalLine(state, 'farmstead')).toBe('要务：待收设施 1 座｜出货箱待结 1 项');
 });

it('returns undefined when a location has no extra actionable logistics summary', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 72, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });

expect(formatLocationActionSignalLine(state, 'valley-market')).toBeUndefined;
 });

it('summarizes market turn-in and claim-ready work from existing commission state', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 74, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.day = 2;
 state.player.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: 3 };

expect(formatLocationActionSignalLine(state, 'valley-market')).toBe('要务：委托可交：青苔止血膏');

delete state.player.inventory['herb.mossling'];
 state.player.stage = 1;
 state.specialOrders['special-order.beast-watch'] = {
 id: 'special-order.beast-watch',
 progress: 2,
 daysLeft: 4,
 acceptedDay: state.day,
 };

expect(formatLocationActionSignalLine(state, 'valley-market')).toBeUndefined;

state.specialOrders['special-order.beast-watch'] = {
 id: 'special-order.beast-watch',
 progress: 10,
 daysLeft: 4,
 acceptedDay: state.day,
 };

expect(formatLocationActionSignalLine(state, 'valley-market')).toBeUndefined;
 });

it('routes ready commissions and orders onto their real location signals instead of collapsing them to market', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 77, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);
 state.player.inventory['herb.dewroot'] = { itemId: 'herb.dewroot', count: 2 };

expect(formatLocationActionSignalLine(state, 'herb-plot')).toBe('要务：委托可交：露根草调息汤');
 expect(formatLocationActionSignalLine(state, 'valley-market')).toBeUndefined;

delete state.player.inventory['herb.dewroot'];
 state.season = 'summer';
 state.specialOrders['special-order.herb-stockpile'] = {
 id: 'special-order.herb-stockpile',
 progress: 10,
 daysLeft: 4,
 acceptedDay: state.day,
 };

expect(formatLocationActionSignalLine(state, 'creek-field')).toBe('要务：订单可领：淬体药草储备');
 expect(formatLocationActionSignalLine(state, 'valley-market')).toBeUndefined;
 });

it('surfaces ruin-gate and spirit-vein task signals when their own turn-ins are ready', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 78, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);
 state.day = 3;
 state.player.stage = 1;
 state.player.inventory['item.broken-talisman'] = { itemId: 'item.broken-talisman', count: 1 };

expect(formatLocationActionSignalLine(state, 'ruin-gate')).toBe('要务：委托可交：破损法宝拆解');

delete state.player.inventory['item.broken-talisman'];
 state.day = 4;
 state.player.inventory['item.beast-core'] = { itemId: 'item.beast-core', count: 1 };

expect(formatLocationActionSignalLine(state, 'spirit-vein')).toBe('要务：委托可交：妖兽内丹样本');
 });

it('summarizes ruin gate archive and ruin-thread rewards that are actionable today', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 75, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);
 state.player.inventory['item.recipe-fragment'] = { itemId: 'item.recipe-fragment', count: 1 };

expect(formatLocationActionSignalLine(state, 'ruin-gate')).toBe('要务：藏经可捐：残卷启蒙');

delete state.player.inventory['item.recipe-fragment'];
 state.flags.add('archive-donation:archive.recipe-fragment-primer');

expect(formatLocationActionSignalLine(state, 'ruin-gate')).toBe('要务：藏经里程可领：一架初成');
 });

it('prioritizes staying-world incident text on the actual active location landmark', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 76, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.postAscension.mode = 'stayed-in-world';
 state.player.flags.add(FIRST_SECOND_WATER_FLAG);

expect(formatLocationActionSignalLine(state, 'spirit-vein')).toBe('要务：镇守事件待处置｜妖兽侵田痕');

state.day = 2;
 expect(formatLocationActionSignalLine(state, 'ruin-gate')).toBe('要务：镇守事件待处置｜残脉阵脚松动');

state.day = 3;
 expect(formatLocationActionSignalLine(state, 'creek-field')).toBe('要务：镇守事件待处置｜村镇求援药包');
 });

it('exposes structured farmstead action counts for other P0 surfaces to reuse', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 73, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.shippingBin['herb.mossling'] = 1;
 state.storage.capacity = 0;

expect(collectFarmsteadActionSignals(state)).toEqual({
 readyFacilityCount: 0,
 queuedShippingCount: 1,
 storageFull: true,
 });
 });

it('routes ready processing and array work onto their child location threads', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 79, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
 state.facilities.set(1, {
 id: 1,
 kind: 'drying-rack',
 tileId: state.tiles[0]!.id,
 job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 },
 });
 state.facilities.set(2, {
 id: 2,
 kind: 'talisman-furnace',
 tileId: state.tiles[1]!.id,
 job: { inputItemId: 'herb.dewroot', outputItemId: 'item.ward-powder', outputCount: 1, daysRemaining: 0 },
 });
 state.facilities.set(3, {
 id: 3,
 kind: 'sealing-cabinet',
 tileId: state.tiles[2]!.id,
 job: { inputItemId: 'herb.dewroot', outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 0 },
 });

expect(formatLocationActionSignalLine(state, 'drying-yard')).toBe('要务：待收晾晒架 1 座');
 expect(formatLocationActionSignalLine(state, 'array-shed')).toBe('要务：待收阵器设施 2 座');
 });
});
