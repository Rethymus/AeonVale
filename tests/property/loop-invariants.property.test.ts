import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createWorld, simulateDay, createSimContext, DEFAULT_BALANCE, type PlayerAction } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';
import { roundTripEqual } from '@sim/serialize';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;
const W = 6;
const H = 6;

type SimpleAction = { kind: 'move' | 'till' | 'sow' | 'water' | 'channel-qi' | 'harvest' | 'rest'; x: number; y: number };

function mkAction(a: SimpleAction): PlayerAction {
 const at = { x: a.x, y: a.y };
 switch (a.kind) {
 case 'move':
 return { kind: 'move', to: at };
 case 'till':
 return { kind: 'till', at };
 case 'sow':
 return { kind: 'sow', at, seedId: 'seed.mossling' };
 case 'water':
 return { kind: 'water', at };
 case 'channel-qi':
 return { kind: 'channel-qi', at };
 case 'harvest':
 return { kind: 'harvest', at };
 case 'rest':
 return { kind: 'rest' };
 }
}

const simpleArb = fc.record({
 kind: fc.constantFrom('move', 'till', 'sow', 'water', 'channel-qi', 'harvest', 'rest') as fc.Arbitrary<SimpleAction['kind']>,
 x: fc.integer({ min: 0, max: W - 1 }),
 y: fc.integer({ min: 0, max: H - 1 }),
});

describe('全循环不变式 ', () => {
 it('随机动作序列下：HP/丹毒/修为有界、状态可序列化', () => {
 fc.assert(
 fc.property(fc.array(simpleArb, { maxLength: 16 }), fc.integer({ min: 5, max: 40 }), (simple, days) => {
 const state = createWorld({ seed: 1, width: W, height: H, content: reg, params: P });
 const ctx = createSimContext(1, reg, P);
 mutateItem(state.player, 'seed.mossling', 99);
 const actions = simple.map(mkAction);
 for (let d = 0; d < days; d++) {
 simulateDay(state, { actions }, ctx);
 // 不变式
 expect(state.player.hp).toBeGreaterThanOrEqual(0);
 expect(state.player.hp).toBeLessThanOrEqual(state.player.maxHp);
 expect(state.player.pillPoison).toBeGreaterThanOrEqual(0);
 expect(state.player.pillPoison).toBeLessThanOrEqual(P.pillPoison.cap * 1000);
 expect(state.player.cultivation).toBeGreaterThanOrEqual(0);
 expect(Number.isFinite(state.player.cultivation)).toBe(true);
 expect(state.player.stage).toBeGreaterThanOrEqual(0);
 expect(state.player.stage).toBeLessThanOrEqual(7);
 if (state.gameOver) break;
 }
 // 存档往返等价（PBT-06）
 expect(roundTripEqual(state)).toBe(true);
 }),
 );
 });

it('同种子+同动作序列 → 同 stateHash（PBT-07 种子确定性）', () => {
 const run = (actions: SimpleAction[]) => {
 const state = createWorld({ seed: 123, width: W, height: H, content: reg, params: P });
 const ctx = createSimContext(123, reg, P);
 mutateItem(state.player, 'seed.mossling', 99);
 for (let d = 0; d < 20; d++) simulateDay(state, { actions: actions.map(mkAction) }, ctx);
 return JSON.stringify({
 hp: state.player.hp,
 pp: state.player.pillPoison,
 cult: state.player.cultivation,
 stage: state.player.stage,
 day: state.day,
 crops: state.crops.size,
 });
 };
 fc.assert(
 fc.property(fc.array(simpleArb, { maxLength: 12 }), (simple) => {
 expect(run(simple)).toBe(run(simple));
 }),
 );
 });
});
