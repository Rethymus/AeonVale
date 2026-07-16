/**
  * INT-06: 存档往返长版。
 *
  * 核心不变式（C3 确定性）：玩100日→serialize→deserialize→再玩1日
  * = 连续玩101日的最终 stateHash 逐字节相等。
  * 任何非确定性（浮点漂移、迭代顺序、隐式全局）会在此暴露。
 */
import { describe, it, expect } from 'vitest';
import {
 advanceDay,
 applyAction,
 createWorld,
 createSimContext,
 simulateDay,
 createSimContextFromState,
 DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { stateHash, serializeState, deserializeState } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import type { PlayerAction } from '@sim/world/input';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;

function makeActions(day: number): PlayerAction[] {
 const acts: PlayerAction[] = [];
 const x = day % 5;
 const y = Math.floor(day / 5) % 5;
 if (day % 4 === 0) {
 acts.push({ kind: 'till', at: { x, y } });
 acts.push({ kind: 'sow', at: { x, y }, seedId: 'seed.mossling' });
 }
 if (day % 2 === 0) {
 acts.push({ kind: 'water', at: { x, y } });
 acts.push({ kind: 'channel-qi', at: { x, y } });
 }
 // 每8日尝试收获
 if (day % 8 === 0) {
 acts.push({ kind: 'harvest', at: { x, y } });
 }
 return acts;
}

describe('INT-06: 存档往返确定性', () => {
 it('玩100日→serialize→deserialize→再玩1日 = 连续玩101日（单种子）', () => {
 const DAYS = 100;
 const SEED = 13;

// ── 路径 A：连续玩101日 ────────────────────────────────────
 const stateA = createWorld({ seed: SEED, width: 6, height: 6, content: reg, params: P });
 const ctxA = createSimContext(SEED, reg, P);
 stateA.player.stage = 1 as 1;
 mutateItem(stateA.player, 'seed.mossling', 50);
 for (let d = 0; d < DAYS + 1; d++) {
 simulateDay(stateA, { actions: makeActions(d) }, ctxA);
 }
 const hashA = stateHash(stateA);

// ── 路径 B：玩100日→存档→读档→再玩1日 ────────────────────
 const stateB = createWorld({ seed: SEED, width: 6, height: 6, content: reg, params: P });
 const ctxB = createSimContext(SEED, reg, P);
 stateB.player.stage = 1 as 1;
 mutateItem(stateB.player, 'seed.mossling', 50);
 for (let d = 0; d < DAYS; d++) {
 simulateDay(stateB, { actions: makeActions(d) }, ctxB);
 }
 // 序列化后恢复
 const saved = serializeState(stateB);
 const restored = deserializeState(saved);
 // 从恢复状态重建 ctx（RNG 从快照还原）
 const ctxRestored = createSimContextFromState(restored, reg, P);
 simulateDay(restored, { actions: makeActions(DAYS) }, ctxRestored);
 const hashB = stateHash(restored);

expect(hashB).toBe(hashA);
 });

it('多种子验证（3 种子×50日）', () => {
 for (const seed of [1, 7, 42]) {
 const DAYS = 50;

const stateA = createWorld({ seed, width: 5, height: 5, content: reg, params: P });
 const ctxA = createSimContext(seed, reg, P);
 mutateItem(stateA.player, 'seed.mossling', 30);
 for (let d = 0; d < DAYS + 1; d++) simulateDay(stateA, { actions: makeActions(d) }, ctxA);
 const hashA = stateHash(stateA);

const stateB = createWorld({ seed, width: 5, height: 5, content: reg, params: P });
 const ctxB = createSimContext(seed, reg, P);
 mutateItem(stateB.player, 'seed.mossling', 30);
 for (let d = 0; d < DAYS; d++) simulateDay(stateB, { actions: makeActions(d) }, ctxB);
 const restored = deserializeState(serializeState(stateB));
 const ctxR = createSimContextFromState(restored, reg, P);
 simulateDay(restored, { actions: makeActions(DAYS) }, ctxR);
 const hashB = stateHash(restored);

expect(hashB, `seed=${seed}`).toBe(hashA);
 }
 });

it('serialize 产出可 JSON.parse() 的结构（无循环引用）', () => {
 const state = createWorld({ seed: 1, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(1, reg, P);
 simulateDay(state, { actions: [] }, ctx);
 expect(() => JSON.stringify(serializeState(state))).not.toThrow;
 });

it('deserialize 后 day/season/year 与原始一致', () => {
 const state = createWorld({ seed: 2, width: 4, height: 4, content: reg, params: P });
 const ctx = createSimContext(2, reg, P);
 for (let d = 0; d < 30; d++) simulateDay(state, { actions: [] }, ctx);
 const restored = deserializeState(serializeState(state));
 expect(restored.day).toBe(state.day);
 expect(restored.season).toBe(state.season);
 expect(restored.year).toBe(state.year);
 });

it('留世暖棚养护后存档恢复，再过一日与连续推进结果一致', () => {
 const SEED = 29;

const prepareState = () => {
 const state = createWorld({ seed: SEED, width: 6, height: 6, content: reg, params: P });
 state.player.stage = 7;
 state.postAscension.mode = 'stayed-in-world';
 state.postAscension.ascensionDay = state.day;
 state.season = 'winter';
 state.player.stamina = P.player.staminaCap * 1000;
 state.tiles[0]!.tilled = true;
 state.tiles[0]!.fertility = 40_000;
 state.tiles[0]!.qiDensity = 25_000;
 state.flags.add('greenhouse-tended.1');
 return state;
 };

const stateA = prepareState();
 const ctxA = createSimContextFromState(stateA, reg, P);
 advanceDay(stateA, ctxA);
 const hashA = stateHash(stateA);

const stateB = prepareState();
 const restored = deserializeState(serializeState(stateB));
 const ctxB = createSimContextFromState(restored, reg, P);
 advanceDay(restored, ctxB);
 const hashB = stateHash(restored);

expect(hashB).toBe(hashA);
 expect(restored.stayingWorld.greenhouseCareStreak).toBe(stateA.stayingWorld.greenhouseCareStreak);
 expect(restored.stayingWorld.greenhouseClimate).toBe(stateA.stayingWorld.greenhouseClimate);
 expect(restored.stayingWorld.lastEvaluatedDay).toBe(stateA.stayingWorld.lastEvaluatedDay);
 });

it('主动引劫倒计时存档恢复后，继续推进与连续推进结果一致', () => {
 const SEED = 41;

const prepareState = () => {
 const state = createWorld({ seed: SEED, width: 6, height: 6, content: reg, params: P });
 const ctx = createSimContextFromState(state, reg, P);
 state.player.stage = 1;
 state.player.bodyFoundation = P.bodyCultivation.foundationCap[0]!;
 applyAction(state, { kind: 'invoke-tribulation' }, ctx);
 return state;
 };

const stateA = prepareState();
 const ctxA = createSimContextFromState(stateA, reg, P);
 advanceDay(stateA, ctxA);
 const hashA = stateHash(stateA);

const stateB = prepareState();
 const restored = deserializeState(serializeState(stateB));
 const ctxB = createSimContextFromState(restored, reg, P);
 advanceDay(restored, ctxB);
 const hashB = stateHash(restored);

expect(hashB).toBe(hashA);
 expect(restored.tribulation).toEqual(stateA.tribulation);
 expect(restored.player.heavenDebt).toBe(stateA.player.heavenDebt);
 expect(restored.player.daoAttention).toBe(stateA.player.daoAttention);
 });

it('天劫到期状态存档恢复后，会按原结果继续自动结算并与连续推进一致', () => {
 const SEED = 43;

const prepareDueState = () => {
 const state = createWorld({ seed: SEED, width: 6, height: 6, content: reg, params: P });
 state.player.stage = 1;
 state.player.bodyFoundation = P.bodyCultivation.foundationCap[0]!;
 state.tribulation = {
 status: 'due',
 source: 'active',
 daysRemaining: 0,
 stage: state.player.stage,
 readyDays: 0,
 startedDay: state.day - P.breakthrough.tTribBase,
 };
 expect(state.tribulation.status).toBe('due');
 return state;
 };

const stateA = prepareDueState();
 const ctxA = createSimContextFromState(stateA, reg, P);
 advanceDay(stateA, ctxA);
 const hashA = stateHash(stateA);

const stateB = prepareDueState();
 const restored = deserializeState(serializeState(stateB));
 const ctxB = createSimContextFromState(restored, reg, P);
 advanceDay(restored, ctxB);
 const hashB = stateHash(restored);

expect(hashB).toBe(hashA);
 expect(restored.tribulation).toEqual(stateA.tribulation);
 expect(restored.ending).toBe(stateA.ending);
 expect(restored.gameOver).toBe(stateA.gameOver);
 expect(restored.player.stage).toBe(stateA.player.stage);
 });
});
