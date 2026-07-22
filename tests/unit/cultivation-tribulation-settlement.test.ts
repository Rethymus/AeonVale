import { describe, expect, test } from 'vitest';
import {
  applyCultivationTribulationOutcome,
  createCultivationRunState,
  type CultivationRunState
} from '@sim/cultivation-run';
import type { TribulationSessionOutcome } from '@sim/sokoban';

function outcome(
  overrides: Partial<TribulationSessionOutcome> = {}
): TribulationSessionOutcome {
  return {
    reachedBody: true,
    beamPower: 95,
    result: 'perfect',
    movesUsed: 5,
    herbsScorched: 1,
    pillsConsumed: [],
    bodyDamage: 0,
    temperingGain: 950,
    breakdown: {
      sourcePower: 100,
      pathConductivityMilli: 950,
      arrayStoneModifierMilli: 1000,
      herbModifierMilli: 1000,
      eventModifierMilli: 1000,
      beamPower: 95
    },
    fatal: false,
    deathPrevented: false,
    wardConsumed: false,
    ...overrides
  };
}

function fundedState(overrides: Partial<CultivationRunState> = {}): CultivationRunState {
  return createCultivationRunState({
    overrides: { herbs: 4, pills: 4, bodyFoundation: 100, lifespanRemainingDays: 100, ...overrides }
  });
}

describe('D27-d · 天劫结果回写当世', () => {
  test('完美或勉强承受会突破、获得淬体与延寿，并只扣准备灵草/实际用药', () => {
    const state = fundedState();
    const before = structuredClone(state);
    const result = applyCultivationTribulationOutcome({
      state,
      preparedHerbsScorched: 1,
      outcome: outcome({ pillsConsumed: ['tribulation-undo-pill', 'tribulation-undo-pill'] })
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stage).toBe(1);
    expect(result.state.bodyFoundation).toBe(1050);
    expect(result.state.herbs).toBe(3);
    expect(result.state.pills).toBe(2);
    expect(result.state.lifespanRemainingDays).toBeGreaterThan(100);
    expect(result.settlement).toMatchObject({ kind: 'breakthrough', herbsLost: 1, pillsConsumed: 2 });
    expect(state).toEqual(before);
  });

  test('归一境成功承劫会原子收束为飞升，不再越界进入旧 stage 7', () => {
    const result = applyCultivationTribulationOutcome({
      state: fundedState({ stage: 6 }),
      preparedHerbsScorched: 0,
      outcome: outcome()
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state).toMatchObject({ stage: 6, status: 'ascended' });
    expect(result.settlement).toMatchObject({
      kind: 'ascended',
      stageBefore: 6,
      stageAfter: 6,
      lifespanGained: 0
    });
  });

  test('护持拦下过载后保持本阶、结算重伤与丹药消耗', () => {
    const result = applyCultivationTribulationOutcome({
      state: fundedState({ injury: 10 }),
      preparedHerbsScorched: 2,
      outcome: outcome({
        result: 'overload',
        fatal: false,
        deathPrevented: true,
        wardConsumed: true,
        pillsConsumed: ['tribulation-ward-pill'],
        bodyDamage: 35,
        temperingGain: 0
      })
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.stage).toBe(0);
    expect(result.state.status).toBe('active');
    expect(result.state.injury).toBe(45);
    expect(result.settlement.kind).toBe('death-prevented');
  });

  test('致命过载关闭当世，但仍完整记录库存、伤势和淬体结算', () => {
    const result = applyCultivationTribulationOutcome({
      state: fundedState(),
      preparedHerbsScorched: 3,
      outcome: outcome({ result: 'overload', fatal: true, bodyDamage: 200, temperingGain: 0 })
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('tribulation-ended');
    expect(result.state.injury).toBe(100);
    expect(result.state.herbs).toBe(1);
    expect(result.settlement.kind).toBe('death');
  });

  test('未决结果、已结束一世和超库存用药均原子拒绝', () => {
    const state = fundedState();
    const unresolved = applyCultivationTribulationOutcome({
      state,
      preparedHerbsScorched: 0,
      outcome: outcome({ result: 'unreached' })
    });
    const ended = applyCultivationTribulationOutcome({
      state: fundedState({ status: 'tribulation-ended' }),
      preparedHerbsScorched: 0,
      outcome: outcome()
    });
    const overConsumed = applyCultivationTribulationOutcome({
      state: fundedState({ pills: 0 }),
      preparedHerbsScorched: 0,
      outcome: outcome({ pillsConsumed: ['tribulation-ward-pill'] })
    });

    expect(unresolved).toEqual({ ok: false, state, error: 'unresolved-outcome' });
    expect(unresolved.state).toBe(state);
    expect(ended).toMatchObject({ ok: false, error: 'run-ended' });
    expect(overConsumed).toMatchObject({ ok: false, error: 'invalid-consumption' });
  });

  test('拒绝不一致的 fatal/deathPrevented、未知丹药、非有限伤势与超库存灵草', () => {
    const state = fundedState({ herbs: 1 });
    const requests = [
      outcome({ result: 'overload', fatal: false, deathPrevented: false }),
      outcome({ result: 'perfect', fatal: true }),
      outcome({ result: 'timeout', fatal: false, deathPrevented: true, wardConsumed: false }),
      outcome({ bodyDamage: Number.NaN })
    ];

    for (const invalidOutcome of requests) {
      const result = applyCultivationTribulationOutcome({ state, preparedHerbsScorched: 0, outcome: invalidOutcome });
      expect(result).toEqual({ ok: false, state, error: 'invalid-outcome' });
      expect(result.state).toBe(state);
    }

    const unknownPill = applyCultivationTribulationOutcome({
      state,
      preparedHerbsScorched: 0,
      outcome: outcome({ pillsConsumed: ['unknown-pill'] })
    });
    const tooManyHerbs = applyCultivationTribulationOutcome({
      state,
      preparedHerbsScorched: 2,
      outcome: outcome()
    });
    expect(unknownPill).toEqual({ ok: false, state, error: 'invalid-consumption' });
    expect(tooManyHerbs).toEqual({ ok: false, state, error: 'invalid-consumption' });
  });
});
