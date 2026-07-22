import { describe, expect, test } from 'vitest';
import { DEFAULT_BALANCE, type BalanceParams } from '@sim/params';
import type { TribulationPreparation } from '@sim/cultivation-run/preparation';
import { calculateBeamPower, evaluateTribulation } from '@sim/sokoban/power';
import type { SokobanState } from '@sim/sokoban/types';

function preparation(overrides: Partial<TribulationPreparation> = {}): TribulationPreparation {
  return {
    minTemperingPower: 80,
    maxSurvivablePower: 110,
    sweetSpotMinPower: 90,
    sweetSpotMaxPower: 100,
    moveBudgetBonus: 0,
    previewLevel: 0,
    undoCharges: 0,
    wardCharges: 0,
    protectedHerbCount: 0,
    unlockedBlockKinds: [],
    startingHerbs: [],
    sourcePowerBonus: 0,
    eventPowerModifierMilli: 1000,
    pressure: 20,
    mortalHeart: 50,
    ...overrides
  };
}

function straightState(overrides: Partial<SokobanState> = {}): SokobanState {
  return {
    stage: 0,
    board: {
      width: 4,
      height: 1,
      terrain: ['source', 'empty', 'empty', 'body'],
      blocks: ['none', 'none', 'none', 'none'],
      sourcePos: { x: 0, y: 0 },
      sourceDir: 'right'
    },
    player: { x: 1, y: 0 },
    beam: {
      cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
      reachedBody: true,
      herbsHit: []
    },
    scorched: [false, false, false, false],
    herbsTotal: 0,
    moveBudget: 10,
    movesUsed: 2,
    status: 'won',
    ...overrides
  };
}

function paramsWithTribulation(
  overrides: Partial<BalanceParams['cultivationRun']['tribulation']>
): BalanceParams {
  return {
    ...DEFAULT_BALANCE,
    cultivationRun: {
      ...DEFAULT_BALANCE.cultivationRun,
      tribulation: { ...DEFAULT_BALANCE.cultivationRun.tribulation, ...overrides }
    }
  };
}

describe('D27-d · Sokoban 雷威', () => {
  test('P105 对每个 beam cell 计一次传导损耗，包括身体格', () => {
    const state = straightState();
    const breakdown = calculateBeamPower(state, preparation());

    expect(state.beam.cells).toHaveLength(3);
    expect(breakdown.pathConductivityMilli).toBe(1000 - 3 * DEFAULT_BALANCE.cultivationRun.tribulation.pathCellLossMilli);
  });

  test('只有当前光路上尚未烧毁的灵草参与本次雷威倍率', () => {
    const state = straightState({
      board: {
        width: 4,
        height: 1,
        terrain: ['source', 'herb', 'herb', 'body'],
        blocks: ['none', 'none', 'none', 'none'],
        sourcePos: { x: 0, y: 0 },
        sourceDir: 'right'
      },
      beam: {
        cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }],
        reachedBody: true,
        herbsHit: [{ x: 1, y: 0 }, { x: 2, y: 0 }]
      },
      scorched: [false, false, true, false],
      herbsTotal: 2
    });
    const before = structuredClone(state);

    expect(calculateBeamPower(state, preparation()).herbModifierMilli).toBe(950);
    expect(calculateBeamPower({ ...state, scorched: [false, false, false, false] }, preparation()).herbModifierMilli).toBe(902);
    expect(calculateBeamPower({ ...state, scorched: [false, true, true, false] }, preparation()).herbModifierMilli).toBe(1000);
    expect(state).toEqual(before);
  });

  test('timeout 伤害与三档淬体收益全部来自平衡参数', () => {
    const params = paramsWithTribulation({
      timeoutBodyDamage: 17,
      perfectTemperingGainMultiplier: 7,
      survivedTemperingGainMultiplier: 5,
      insufficientTemperingGainMultiplier: 3
    });
    const state = straightState();
    const beamPower = calculateBeamPower(state, preparation(), params).beamPower;

    expect(evaluateTribulation(state, preparation(), params).temperingGain).toBe(beamPower * 7);
    expect(evaluateTribulation(state, preparation({ sweetSpotMinPower: 80, sweetSpotMaxPower: 90 }), params).temperingGain)
      .toBe(beamPower * 5);
    expect(evaluateTribulation(state, preparation({ minTemperingPower: 100 }), params).temperingGain)
      .toBe(beamPower * 3);
    expect(evaluateTribulation(straightState({ status: 'lost', beam: { cells: [], reachedBody: false, herbsHit: [] } }), preparation(), params).bodyDamage)
      .toBe(17);
  });

  test('非有限 preparation 雷威修正回退到中性值', () => {
    const breakdown = calculateBeamPower(
      straightState(),
      preparation({ sourcePowerBonus: Number.POSITIVE_INFINITY, eventPowerModifierMilli: Number.NaN })
    );

    expect(breakdown.sourcePower).toBe(DEFAULT_BALANCE.cultivationRun.tribulation.baseSourcePower);
    expect(breakdown.eventModifierMilli).toBe(1000);
    expect(Number.isFinite(breakdown.beamPower)).toBe(true);
  });
});
