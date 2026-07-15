import { describe, expect, it } from 'vitest';
import { advanceDay, createSimContext, createWorld, DEFAULT_BALANCE, getCurrentStayingWorldIncident, resolveStayingWorldIncident, startStayingWorld, performUpgrade, placeArray } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';

function setup(seed = 31) {
 const reg = buildRegistry();
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
 const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
 state.player.stage = 7;
 state.postAscension.mode = 'stayed-in-world';
 state.postAscension.ascensionDay = state.day;
 startStayingWorld(state);
 return { state, ctx };
}

function findLatestEvaluatedEvent(state: ReturnType<typeof setup>['state']) {
 for (let index = state.events.length - 1; index >= 0; index -= 1) {
 const event = state.events[index];
 if (event?.type === 'staying-world-day-evaluated') return event;
 }
 return undefined;
}

describe('留世跨日状态', () => {
 it('留世后若连续疏于镇守与闲居，压力会上升且和谐下降', () => {
 const { state, ctx } = setup();
 const beforePressure = state.stayingWorld.wardingPressure;
 const beforeHarmony = state.stayingWorld.quietHarmony;

advanceDay(state, ctx);

expect(state.day).toBe(2);
 expect(state.stayingWorld.wardingPressure).toBeGreaterThan(beforePressure);
 expect(state.stayingWorld.quietHarmony).toBeLessThan(beforeHarmony);
 expect(state.stayingWorld.neglectedWardingDays).toBe(1);
 expect(state.stayingWorld.neglectedQuietDays).toBe(1);
 expect(state.events.some((event) => event.type === 'staying-world-day-evaluated')).toBe(true);
 });

it('完成当日镇守与闲居动作后，次日日终会缓解压力并回升和谐', () => {
 const { state, ctx } = setup(32);
 state.flags.add('commission.1.commission.human-ward-patrol');
 state.flags.add('tea-shed-visit.1');
 state.flags.add('greenhouse-tended.1');

advanceDay(state, ctx);

expect(state.stayingWorld.wardingPressure).toBeLessThan(18_000);
 expect(state.stayingWorld.quietHarmony).toBeGreaterThan(62_000);
 expect(state.stayingWorld.neglectedWardingDays).toBe(0);
 expect(state.stayingWorld.neglectedQuietDays).toBe(0);
 expect(state.stayingWorld.stableDays).toBe(1);
 });

it('连续打理暖棚会累积棚温与照料连击', () => {
 const { state, ctx } = setup(35);

for (let day = 1; day <= 3; day++) {
 state.flags.add(`greenhouse-tended.${day}`);
 advanceDay(state, ctx);
 }

expect(state.stayingWorld.greenhouseCareStreak).toBe(3);
 expect(state.stayingWorld.greenhouseClimate).toBe(66_000);
 expect(state.events.some((event) => event.type === 'greenhouse-climate-stabilized')).toBe(true);
 });

it('中断暖棚养护会重置连击并拉低棚温', () => {
 const { state, ctx } = setup(36);
 state.stayingWorld.greenhouseClimate = 68_000;
 state.stayingWorld.greenhouseCareStreak = 3;
 state.stayingWorld.neglectedQuietDays = 1;

advanceDay(state, ctx);

expect(state.stayingWorld.greenhouseCareStreak).toBe(0);
 expect(state.stayingWorld.greenhouseClimate).toBe(61_000);
 });

it('暖棚扩建会让跨日棚温更易维稳', () => {
 const { state, ctx } = setup(37);
 mutateItem(state.player, 'item.spirit-stone', 44);
 mutateItem(state.player, 'item.array-core', 3);
 mutateItem(state.player, 'item.recipe-fragment', 3);
 mutateItem(state.player, 'herb.dewroot', 3);
 mutateItem(state.player, 'herb.mistfern', 4);
 expect(performUpgrade(state, 'greenhouse-nursery-1').ok).toBe(true);
 expect(performUpgrade(state, 'greenhouse-nursery-2').ok).toBe(true);

state.flags.add('greenhouse-tended.1');
 advanceDay(state, ctx);
 expect(state.stayingWorld.greenhouseClimate).toBe(51_000);
 expect(state.stayingWorld.greenhouseCareStreak).toBe(1);

advanceDay(state, ctx);
 expect(state.stayingWorld.greenhouseClimate).toBe(47_000);
 expect(state.stayingWorld.greenhouseCareStreak).toBe(0);
 });

it('绝缘阵会提高暖棚养护后的棚温回升，并在事件负载中记录控温加成', () => {
 const { state, ctx } = setup(38);
 placeArray(state, 'array.insulation', 1, 1, ctx, { free: true });
 placeArray(state, 'array.insulation', 4, 4, ctx, { free: true });
 state.flags.add('greenhouse-tended.1');

advanceDay(state, ctx);

expect(state.stayingWorld.greenhouseClimate).toBe(51_000);
 expect(state.stayingWorld.greenhouseCareStreak).toBe(1);
 const evaluated = findLatestEvaluatedEvent(state);
 expect(evaluated?.payload).toMatchObject({
 greenhouseClimate: 51_000,
 insulationClimateCareGainBonus: 2_000,
 insulationClimateNeglectBuffer: 2_000,
 });
 });

it('绝缘阵会减缓暖棚失养时的棚温流失', () => {
 const { state, ctx } = setup(39);
 state.stayingWorld.greenhouseClimate = 68_000;
 state.stayingWorld.greenhouseCareStreak = 3;
 state.stayingWorld.neglectedQuietDays = 1;
 placeArray(state, 'array.insulation', 1, 1, ctx, { free: true });
 placeArray(state, 'array.insulation', 4, 4, ctx, { free: true });

advanceDay(state, ctx);

expect(state.stayingWorld.greenhouseClimate).toBe(63_000);
 expect(state.stayingWorld.greenhouseCareStreak).toBe(0);
 });

it('连续多日稳住留世节奏后，会累计 stableDays 并发出稳定事件', () => {
 const { state, ctx } = setup(33);

for (let day = 1; day <= 3; day++) {
 state.flags.add(`commission.${day}.commission.human-ward-patrol`);
 state.flags.add(`tea-shed-visit.${day}`);
 state.flags.add(`greenhouse-tended.${day}`);
 advanceDay(state, ctx);
 }

expect(state.stayingWorld.stableDays).toBe(3);
 expect(state.events.some((event) => event.type === 'staying-world-stability-built')).toBe(true);
 });

it('留世期间会轮转今日镇守事件，处置后可作为当日镇守完成来源', () => {
 const { state, ctx } = setup(34);
 const incident = getCurrentStayingWorldIncident(state);
 expect(incident).not.toBeNull;
 mutateItem(state.player, incident!.itemId, incident!.count);

expect(resolveStayingWorldIncident(state).ok).toBe(true);

advanceDay(state, ctx);

expect(state.stayingWorld.neglectedWardingDays).toBe(0);
 expect(state.stayingWorld.wardingPressure).toBeLessThan(18_000);
 expect(state.events.some((event) => event.type === 'staying-world-incident-resolved')).toBe(true);
 expect(state.stayingWorld.currentIncidentDay).toBe(state.day);
 });
});

describe('阵守巡守控温共振 ', () => {
 function climateAfter(opts: { bond: number; specialty: 'array-warden' | null; patrol: boolean }): number {
 const { state, ctx } = setup(35);
 state.flags.add('greenhouse-tended.1');
 const tile = state.tiles.find((entry) => entry.blockType === 'none')!;
 expect(placeArray(state, 'array.insulation', tile.x, tile.y, ctx, { free: true }).placed).toBe(true);
 if (opts.patrol) {
 state.guardBeasts.push({ id: 1, vigor: 2, maxVigor: 3, bond: opts.bond, specialty: opts.specialty });
 state.guardBeastPatrols.push({ beastId: 1, tileId: tile.id, assignedDay: state.day });
 }
 advanceDay(state, ctx);
 return state.stayingWorld.greenhouseClimate;
 }

it('阵守巡守兽在绝缘阵覆盖内巡逻时，暖棚日终棚温回升更多', () => {
 const without = climateAfter({ bond: 40, specialty: 'array-warden', patrol: false });
 const base = climateAfter({ bond: 40, specialty: 'array-warden', patrol: true });
 expect(base).toBeGreaterThan(without);
 expect(base - without).toBe(1_000); // 基础阵守控温 +1
 });

it('精通阵守巡守兽提供更大控温共振', () => {
 const base = climateAfter({ bond: 40, specialty: 'array-warden', patrol: true });
 const master = climateAfter({ bond: 85, specialty: 'array-warden', patrol: true });
 expect(master - base).toBe(1_000); // 精通层 +2，比基础 +1 多一档
 });

it('非阵守专长或不巡逻时不产生控温共振', () => {
 const noPatrol = climateAfter({ bond: 40, specialty: 'array-warden', patrol: false });
 const wrongSpecialty = climateAfter({ bond: 40, specialty: null, patrol: true });
 // 无巡逻 / 无专长 → 与无巡守兽的基准棚温一致
 const bare = climateAfter({ bond: 40, specialty: 'array-warden', patrol: false });
 expect(wrongSpecialty).toBe(bare);
 expect(noPatrol).toBe(bare);
 });
});

describe('留世安居红利里程碑 ', () => {
 it('连续稳住 7 日会触发安居红利，额外回升和谐并回落压力', () => {
 const { state, ctx } = setup(36);
 for (let day = 1; day <= 7; day += 1) {
 state.flags.add(`commission.${day}.commission.human-ward-patrol`);
 state.flags.add(`tea-shed-visit.${day}`);
 state.flags.add(`greenhouse-tended.${day}`);
 advanceDay(state, ctx);
 }

expect(state.stayingWorld.stableDays).toBe(7);
 const milestone = state.events.find((event) => event.type === 'staying-world-stability-milestone');
 expect(milestone).toBeDefined;
 expect((milestone!.payload as { stableDays: number; harmonyBonus: number; pressureRelief: number })).toMatchObject({
 stableDays: 7,
 harmonyBonus: 5_000,
 pressureRelief: 5_000,
 });
 });

it('稳住未满 7 日不触发安居红利里程碑', () => {
 const { state, ctx } = setup(37);
 for (let day = 1; day <= 3; day += 1) {
 state.flags.add(`commission.${day}.commission.human-ward-patrol`);
 state.flags.add(`tea-shed-visit.${day}`);
 state.flags.add(`greenhouse-tended.${day}`);
 advanceDay(state, ctx);
 }

expect(state.stayingWorld.stableDays).toBe(3);
 expect(state.events.some((event) => event.type === 'staying-world-stability-milestone')).toBe(false);
 });
});
