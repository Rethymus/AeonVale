import { describe, expect, test } from 'vitest';
import fc from 'fast-check';
import { DEFAULT_BALANCE } from '@sim/params';
import {
  applyCultivationTribulationOutcome,
  createCultivationRunState,
  type CultivationRunState
} from '@sim/cultivation-run';
import {
  TRIBULATION_SESSION_PILL_IDS,
  type TribulationSessionOutcome
} from '@sim/sokoban';

type OutcomeKind = 'breakthrough' | 'insufficient' | 'death-prevented' | 'death';

function outcome(
  kind: OutcomeKind,
  pillsConsumed: readonly string[],
  bodyDamage: number,
  temperingGain: number
): TribulationSessionOutcome {
  const result = kind === 'breakthrough'
    ? 'perfect'
    : kind === 'insufficient'
      ? 'insufficient'
      : kind === 'death-prevented'
        ? 'overload'
        : 'timeout';
  return {
    reachedBody: result !== 'timeout',
    beamPower: 95,
    result,
    movesUsed: 5,
    herbsScorched: 0,
    pillsConsumed,
    bodyDamage,
    temperingGain,
    breakdown: {
      sourcePower: 100,
      pathConductivityMilli: 950,
      arrayStoneModifierMilli: 1000,
      herbModifierMilli: 1000,
      eventModifierMilli: 1000,
      beamPower: 95
    },
    fatal: kind === 'death',
    deathPrevented: kind === 'death-prevented',
    wardConsumed: kind === 'death-prevented'
  };
}

const settlementInput = fc.record({
  seed: fc.integer({ min: 1, max: 999_999 }),
  stage: fc.integer({ min: 0, max: 6 }),
  injury: fc.integer({ min: 0, max: 100 }),
  herbs: fc.integer({ min: 0, max: 10 }),
  pills: fc.integer({ min: 0, max: 10 }),
  bodyFoundation: fc.integer({ min: 0, max: 100_000 }),
  lifespanRemainingDays: fc.integer({ min: 1, max: 10_000 }),
  kind: fc.constantFrom<OutcomeKind>('breakthrough', 'insufficient', 'death-prevented', 'death'),
  herbLossRaw: fc.integer({ min: 0, max: 100 }),
  pillLossRaw: fc.integer({ min: 0, max: 100 }),
  bodyDamage: fc.integer({ min: 0, max: 200 }),
  temperingGain: fc.integer({ min: 0, max: 10_000 })
});

describe('D27-d · 天劫结算性质', () => {
  test('PBT-D27-16 确定性、输入纯度与灵草/丹药/伤势守恒有界', () => {
    fc.assert(fc.property(settlementInput, input => {
      const state: CultivationRunState = createCultivationRunState({
        seed: input.seed,
        overrides: {
          stage: input.stage,
          injury: input.injury,
          herbs: input.herbs,
          pills: input.pills,
          bodyFoundation: input.bodyFoundation,
          lifespanRemainingDays: input.lifespanRemainingDays
        }
      });
      const herbLoss = input.herbLossRaw % (input.herbs + 1);
      const pillLoss = input.pillLossRaw % (input.pills + 1);
      const pillsConsumed = Array.from(
        { length: pillLoss },
        (_, index) => index % 2 === 0
          ? TRIBULATION_SESSION_PILL_IDS.undo
          : TRIBULATION_SESSION_PILL_IDS.ward
      );
      const resolvedOutcome = outcome(input.kind, pillsConsumed, input.bodyDamage, input.temperingGain);
      const stateBefore = structuredClone(state);
      const outcomeBefore = structuredClone(resolvedOutcome);
      const request = { state, outcome: resolvedOutcome, preparedHerbsScorched: herbLoss };

      const a = applyCultivationTribulationOutcome(request);
      const b = applyCultivationTribulationOutcome(request);

      expect(a).toEqual(b);
      expect(state).toEqual(stateBefore);
      expect(resolvedOutcome).toEqual(outcomeBefore);
      expect(a.ok).toBe(true);
      if (!a.ok) return;
      expect(a.state.herbs).toBe(input.herbs - herbLoss);
      expect(a.state.pills).toBe(input.pills - pillLoss);
      expect(a.state.herbs).toBeGreaterThanOrEqual(0);
      expect(a.state.pills).toBeGreaterThanOrEqual(0);
      expect(a.state.injury).toBeGreaterThanOrEqual(input.injury);
      expect(a.state.injury).toBeLessThanOrEqual(DEFAULT_BALANCE.cultivationRun.injuryCap);
      expect(a.state.bodyFoundation).toBe(input.bodyFoundation + input.temperingGain);
      expect(a.settlement.herbsLost).toBe(herbLoss);
      expect(a.settlement.pillsConsumed).toBe(pillLoss);
      expect(a.settlement.injuryGained).toBe(a.state.injury - input.injury);
      const terminalAscension = input.kind === 'breakthrough' && input.stage === 6;
      expect(a.settlement.kind).toBe(terminalAscension ? 'ascended' : input.kind);
      if (input.kind === 'breakthrough') {
        expect(a.state.stage).toBe(terminalAscension ? input.stage : input.stage + 1);
        expect(a.state.lifespanRemainingDays).toBe(terminalAscension
          ? input.lifespanRemainingDays
          : input.lifespanRemainingDays + DEFAULT_BALANCE.bodyCultivation.lifespanBreakthroughGain);
      } else {
        expect(a.state.stage).toBe(input.stage);
      }
      expect(a.state.status).toBe(input.kind === 'death' ? 'tribulation-ended' : terminalAscension ? 'ascended' : 'active');
    }));
  });
});
