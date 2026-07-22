/**
 * R4-a 雷劫炼体 roguelite —— 渡劫战斗切片单测。
 *
 * 守红线：纯函数、确定性、零 src/sim 之外的状态依赖。AAA 结构 + setup(seed) 模式（引 farm.test.ts）。
 */
import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE } from '@sim/params';
import { deriveStreams } from '@sim/world/rng';
import type { SoilType } from '@sim/world/types';
import {
  COMBAT_FIELD_HEIGHT,
  COMBAT_FIELD_WIDTH,
  IRONBONE_MITIGATION,
  TEMPER_BOOST_MULT,
  applyCombatAction,
  createCombatRun,
  stageBoltCount,
  tileWeight,
  type CombatState
} from '@sim/roguelite';

const VIOLET_UNLOCK = DEFAULT_BALANCE.lightning.bolt.violetUnlockStage;

function makeRun(stage: number, seed: number | string, pills?: { ward?: number; ironbone?: number; temper?: number }): CombatState {
  return createCombatRun({ stage, params: DEFAULT_BALANCE, streams: deriveStreams(seed), pills });
}

function singleBoltSchedule(stage: number, target: { x: number; y: number }, isViolet = false): CombatState['schedule'] {
  return { stage, bolts: [{ index: 0, target, isViolet, landAfterSec: 1 }] };
}

describe('roguelite combat · 确定性', () => {
  test('同种子产生同一 field 与同一劈雷时刻表', () => {
    const a = makeRun(2, 42);
    const b = makeRun(2, 42);
    expect(a.schedule.bolts.map(d => ({ x: d.target.x, y: d.target.y, v: d.isViolet }))).toEqual(
      b.schedule.bolts.map(d => ({ x: d.target.x, y: d.target.y, v: d.isViolet }))
    );
    expect(a.field.tiles.map(t => `${t.soilType}:${t.rodPower}:${t.insulated}`)).toEqual(
      b.field.tiles.map(t => `${t.soilType}:${t.rodPower}:${t.insulated}`)
    );
  });

  test('不同种子（大概率）产生不同时刻表', () => {
    const a = makeRun(3, 1);
    const b = makeRun(3, 99999);
    const sa = JSON.stringify(a.schedule.bolts.map(d => ({ x: d.target.x, y: d.target.y })));
    const sb = JSON.stringify(b.schedule.bolts.map(d => ({ x: d.target.x, y: d.target.y })));
    expect(sa).not.toBe(sb);
  });
});

describe('roguelite combat · 时刻表', () => {
  test('雷数 = stageBoltCount(stage)，落点在界内，紫雷仅 stage≥解锁阶', () => {
    for (const stage of [0, 1, 2, 3, 4, 5, 6] as const) {
      const run = makeRun(stage, 7);
      expect(run.schedule.bolts.length).toBe(stageBoltCount(stage));
      for (const bolt of run.schedule.bolts) {
        expect(bolt.target.x).toBeGreaterThanOrEqual(0);
        expect(bolt.target.x).toBeLessThan(COMBAT_FIELD_WIDTH);
        expect(bolt.target.y).toBeGreaterThanOrEqual(0);
        expect(bolt.target.y).toBeLessThan(COMBAT_FIELD_HEIGHT);
        expect(bolt.landAfterSec).toBeGreaterThan(0);
        if (bolt.isViolet) expect(stage).toBeGreaterThanOrEqual(VIOLET_UNLOCK);
      }
    }
  });
});

describe('roguelite combat · 逐雷结算数学', () => {
  test('直击扣血；擦弹减伤至 0.3× 且淬体为直击的 0.45×（0.3×伤害 ×1.5 品质）', () => {
    const center = { x: 3, y: 2 };

    const direct = makeRun(1, 1);
    direct.bodyPos = center;
    direct.schedule = singleBoltSchedule(1, center);
    applyCombatAction(direct, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    const hpBefore = direct.hpMilli;
    applyCombatAction(direct, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE);
    const directDamage = hpBefore - direct.hpMilli;
    const directRaw = direct.rawTemperingMilli;
    expect(directDamage).toBeGreaterThan(0);
    expect(direct.hits.direct).toBe(1);

    const blocked = makeRun(1, 1);
    blocked.bodyPos = center;
    blocked.schedule = singleBoltSchedule(1, center);
    applyCombatAction(blocked, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    const hpBefore2 = blocked.hpMilli;
    applyCombatAction(blocked, { kind: 'resolve-bolt', perfectBlock: true }, DEFAULT_BALANCE);
    const blockDamage = hpBefore2 - blocked.hpMilli;
    const blockRaw = blocked.rawTemperingMilli;
    expect(blockDamage).toBeCloseTo(directDamage * 0.3, 5);
    expect(blockRaw).toBeCloseTo(directRaw * 0.45, 5);
    expect(blocked.hits.blocked).toBe(1);
  });

  test('近死淬体加成：存活于低血量时 finalize 的 tempering 高于满血存活', () => {
    const farCorner = { x: 0, y: 0 };
    const hit = { x: 0, y: 0 };

    const lowHp = makeRun(2, 1);
    lowHp.hpMilli = Math.round(lowHp.maxHpMilli * 0.08); // 8% → nearDeath 峰值带
    lowHp.bodyPos = farCorner;
    lowHp.schedule = singleBoltSchedule(2, hit);
    applyCombatAction(lowHp, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    applyCombatAction(lowHp, { kind: 'resolve-bolt', perfectBlock: true }, DEFAULT_BALANCE); // 擦弹免死

    const fullHp = makeRun(2, 1);
    fullHp.bodyPos = farCorner;
    fullHp.schedule = { stage: 2, bolts: [{ index: 0, target: { x: 6, y: 4 }, isViolet: false, landAfterSec: 1 }] };
    applyCombatAction(fullHp, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    applyCombatAction(fullHp, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE);

    expect(lowHp.result?.survived).toBe(true);
    expect(fullHp.result?.survived).toBe(true);
    expect(lowHp.result!.temperingGainMilli).toBeGreaterThan(fullHp.result!.temperingGainMilli);
  });
});

describe('roguelite combat · 存活/死亡', () => {
  test('全 miss 存活且零淬体', () => {
    const run = makeRun(1, 9);
    run.bodyPos = { x: 0, y: 0 };
    run.schedule = {
      stage: 1,
      bolts: [
        { index: 0, target: { x: 6, y: 4 }, isViolet: false, landAfterSec: 1 },
        { index: 1, target: { x: 5, y: 4 }, isViolet: false, landAfterSec: 2 },
        { index: 2, target: { x: 6, y: 3 }, isViolet: false, landAfterSec: 3 }
      ]
    };
    applyCombatAction(run, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    for (let i = 0; i < 3; i++) applyCombatAction(run, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE);
    expect(run.status).toBe('survived');
    expect(run.result?.survived).toBe(true);
    expect(run.result?.temperingGainMilli).toBe(0);
    expect(run.hits.miss).toBe(3);
  });

  test('扛不住即 dead，状态翻转并结算 result', () => {
    const run = makeRun(5, 1);
    run.bodyPos = { x: 3, y: 2 };
    run.schedule = {
      stage: 5,
      bolts: Array.from({ length: 8 }, (_, i) => ({ index: i, target: { x: 3, y: 2 }, isViolet: true, landAfterSec: i + 1 }))
    };
    applyCombatAction(run, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    let guard = 0;
    while (run.status === 'resolving' && guard < 20) {
      applyCombatAction(run, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE);
      guard += 1;
    }
    expect(run.status).toBe('dead');
    expect(run.result?.survived).toBe(false);
    expect(run.result?.boltsResolved).toBeLessThanOrEqual(8);
  });
});

describe('roguelite combat · 丹药', () => {
  test('承雷/铁骨/淬体丹各设其效；耗尽拒服', () => {
    const run = makeRun(1, 1, { ward: 1, ironbone: 1, temper: 1 });
    applyCombatAction(run, { kind: 'consume-pill', pill: 'ward' }, DEFAULT_BALANCE);
    expect(run.wardMitigation).toBeCloseTo(DEFAULT_BALANCE.lightning.damage.pillMitigationWard, 5);
    applyCombatAction(run, { kind: 'consume-pill', pill: 'ironbone' }, DEFAULT_BALANCE);
    expect(run.ironBoneMitigation).toBeCloseTo(IRONBONE_MITIGATION, 5);
    applyCombatAction(run, { kind: 'consume-pill', pill: 'temper' }, DEFAULT_BALANCE);
    expect(run.temperBoostMult).toBeCloseTo(TEMPER_BOOST_MULT, 5);
    expect(applyCombatAction(run, { kind: 'consume-pill', pill: 'ward' }, DEFAULT_BALANCE).ok).toBe(false);
  });
});

describe('roguelite combat · 动作门控', () => {
  test('布阵仅 prep、渡劫切换 prep→resolving、resolving 中拒布阵', () => {
    const run = makeRun(1, 1);
    expect(applyCombatAction(run, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE).ok).toBe(false);
    expect(applyCombatAction(run, { kind: 'place-rod', x: 3, y: 2 }, DEFAULT_BALANCE).ok).toBe(true);
    applyCombatAction(run, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    expect(run.status).toBe('resolving');
    expect(applyCombatAction(run, { kind: 'place-rod', x: 3, y: 2 }, DEFAULT_BALANCE).ok).toBe(false);
  });

  test('结束后（survived/dead）拒动', () => {
    const run = makeRun(1, 1);
    run.bodyPos = { x: 0, y: 0 };
    run.schedule = singleBoltSchedule(1, { x: 6, y: 4 });
    applyCombatAction(run, { kind: 'begin-tribulation' }, DEFAULT_BALANCE);
    applyCombatAction(run, { kind: 'resolve-bolt', perfectBlock: false }, DEFAULT_BALANCE);
    expect(run.status).toBe('survived');
    expect(applyCombatAction(run, { kind: 'consume-pill', pill: 'ward' }, DEFAULT_BALANCE).ok).toBe(false);
    expect(applyCombatAction(run, { kind: 'move', x: 1, y: 1 }, DEFAULT_BALANCE).ok).toBe(false);
  });
});

describe('roguelite combat · 布阵权重（种田即布阵）', () => {
  test('tileWeight：引雷草吸雷(权重↑)、绝缘垫排雷(权重↓)', () => {
    const tiles = Array.from({ length: COMBAT_FIELD_WIDTH * COMBAT_FIELD_HEIGHT }, (_, i) => {
      const x = i % COMBAT_FIELD_WIDTH;
      const y = Math.floor(i / COMBAT_FIELD_WIDTH);
      return { x, y, soilType: 'loam' as SoilType, rodPower: 0, insulated: false };
    });
    const field = { width: COMBAT_FIELD_WIDTH, height: COMBAT_FIELD_HEIGHT, tiles };
    const player = { x: 3, y: 2 };
    const centerIdx = 2 * COMBAT_FIELD_WIDTH + 3;
    const tile = tiles[centerIdx]!;
    const base = tileWeight(field, tile, player, DEFAULT_BALANCE, 0.5);
    tile.rodPower = 30;
    expect(tileWeight(field, tile, player, DEFAULT_BALANCE, 0.5)).toBeGreaterThan(base);
    tile.rodPower = 0;
    tile.insulated = true;
    expect(tileWeight(field, tile, player, DEFAULT_BALANCE, 0.5)).toBeLessThan(base);
  });
});
