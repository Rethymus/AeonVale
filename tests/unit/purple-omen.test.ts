/**
  * 紫雷前兆 event.purple-omen 强制触发。
  * stage4 体魄根基恰满 → 跳过随机门强制触发，7 日倒计时，flag 防重；forced 事件不入随机抽样池。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, startPurpleOmenIfDue, tickCelestial, selectCelestialEvent, Rng } from '@sim';
import { readyForBreakthrough } from '@sim/progression/progression';
import { deserializeState, serializeState } from '@sim/serialize';
import { buildRegistry } from '@content/registry';

const STAGE4_CAP = DEFAULT_BALANCE.breakthrough.xCap[3] ?? 700_000; // stage4 体魄根基上限（毫点）

function setup(seed = 1) {
 const reg = buildRegistry();
 const params = {
 ...DEFAULT_BALANCE,
 celestial: { ...DEFAULT_BALANCE.celestial },
 };
 const state = createWorld({ seed, width: 6, height: 6, content: reg, params });
 const ctx = createSimContext(seed, reg, params);
 return { state, ctx, reg };
}

describe('紫雷前兆 event.purple-omen 强制触发', () => {
 it('stage4 体魄根基恰满 → 强制触发（跳过随机门），置 flag', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP; // 精确上限
 tickCelestial(state, ctx);
 expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(state.activeEvent?.daysLeft).toBe(7);
 expect(state.flags.has('purple-omen-fired')).toBe(true);
 });

it('有激活事件时 forced 路径被跳过（不重复触发，仅倒计时）', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;
 tickCelestial(state, ctx); // 强制触发
 expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(state.flags.has('purple-omen-fired')).toBe(true);
 tickCelestial(state, ctx); // activeEvent 仍在 → forced 路径被 !activeEvent 守卫跳过
 expect(state.activeEvent?.defId).toBe('event.purple-omen'); // 未被覆盖
 expect(state.activeEvent?.daysLeft).toBe(6); // 仅倒计时递减
 });

it('stage5 不触发（即便体魄根基达到 stage4 cap）', () => {
 const { state, ctx } = setup();
 state.player.stage = 5 as 5;
 state.player.bodyFoundation = STAGE4_CAP;
 tickCelestial(state, ctx);
 expect(state.flags.has('purple-omen-fired')).toBe(false);
 expect(state.activeEvent?.defId).not.toBe('event.purple-omen');
 });

it('stage<4 不触发（即便体魄根基远超）', () => {
 const { state, ctx } = setup();
 state.player.stage = 3 as 3;
 state.player.bodyFoundation = 999_000_000;
 tickCelestial(state, ctx);
 expect(state.flags.has('purple-omen-fired')).toBe(false);
 expect(state.activeEvent?.defId).not.toBe('event.purple-omen');
 });

it('stage4 体魄根基超过 cap 仍触发（阈值为 ≥ cap）', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP + 1;
 tickCelestial(state, ctx);
 expect(state.flags.has('purple-omen-fired')).toBe(true);
 expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(state.activeEvent?.daysLeft).toBe(7);
 });

it('stage4 但体魄根基未满 cap 不触发', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP - 1; // 差一点
 tickCelestial(state, ctx);
 expect(state.flags.has('purple-omen-fired')).toBe(false);
 expect(state.activeEvent?.defId).not.toBe('event.purple-omen');
 });

it('forced 事件被排除出随机抽样池（永不随机选中）', () => {
 const reg = buildRegistry();
 const defs = [...reg.events.values()];
 expect(defs.find((d) => d.id === 'event.purple-omen')?.forced).toBe(true);
 const rng = new Rng(42);
 const picked = new Set<string>();
 for (let i = 0; i < 500; i++) {
 const id = selectCelestialEvent(defs, [], rng)?.id;
 if (id) picked.add(id);
 }
 expect(picked.has('event.purple-omen')).toBe(false); // 强制事件不入随机池
 });

it('满阶时抢占普通天象，且发出原事件结束与前兆开始', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;
 state.activeEvent = {
 defId: 'event.qi-tide', displayName: '灵气潮汐', daysLeft: 3, growthMod: 1.5, qiMod: 1.5,
 };

tickCelestial(state, ctx);

expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(state.events.map((event) => event.type)).toEqual(['celestial-end', 'celestial-start']);
 });

it('持续恰好七次后结束，不会立即重启或被随机事件替代', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;
 tickCelestial(state, ctx);
 expect(state.activeEvent?.daysLeft).toBe(7);

ctx.params.celestial.eventGateProbability = 1;
 for (let day = 0; day < 6; day++) tickCelestial(state, ctx);
 expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(state.activeEvent?.daysLeft).toBe(1);

tickCelestial(state, ctx);
 expect(state.activeEvent).toBeNull;
 expect(state.flags.has('purple-omen-fired')).toBe(true);
 });

it('已触发标记存档往返后仍阻止重复前兆', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;
 tickCelestial(state, ctx);
 const restored = deserializeState(serializeState(state));
	const restoredCtx = createSimContext(state.masterSeed, ctx.content, ctx.params);

expect(restored.flags.has('purple-omen-fired')).toBe(true);
 for (let day = 0; day < 7; day++) tickCelestial(restored, restoredCtx);
 expect(restored.activeEvent).toBeNull;
 });

it('共享 helper 会先启动前兆，供 T 键入口阻止直接引劫', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;

expect(startPurpleOmenIfDue(state, ctx)).toBe(true);
 expect(state.activeEvent?.defId).toBe('event.purple-omen');
 expect(startPurpleOmenIfDue(state, ctx)).toBe(false);
 });

it('stage4 在前兆启动前与倒计时中不可突破，到期后解锁', () => {
 const { state, ctx } = setup();
 state.player.stage = 4 as 4;
 state.player.bodyFoundation = STAGE4_CAP;

expect(readyForBreakthrough(state, DEFAULT_BALANCE)).toBe(false);
 expect(startPurpleOmenIfDue(state, ctx)).toBe(true);
 expect(readyForBreakthrough(state, DEFAULT_BALANCE)).toBe(false);

for (let day = 0; day < 7; day++) tickCelestial(state, ctx);
 expect(state.activeEvent).toBeNull;
 expect(readyForBreakthrough(state, DEFAULT_BALANCE)).toBe(true);
 });

it('仅有 forced 事件时随机抽样返回空', () => {
 const purpleOmen = buildRegistry().events.get('event.purple-omen')!;
 expect(selectCelestialEvent([purpleOmen], [], new Rng(42))).toBeNull;
 });
});
