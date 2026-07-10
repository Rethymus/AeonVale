import { describe, expect, it } from 'vitest';
import { certifyM5Target, quantile, summarizeDuration, wilsonInterval } from '../../tools/simulation-metrics';
import type { RunOutcome } from '../../tools/headless-run';

function outcome(overrides: Partial<RunOutcome> = {}): RunOutcome {
  return {
    seed: 1, days: 10, simulatedDays: 10, maxDays: 20, stageReached: 1, breakthroughs: 0, tribulations: 0,
    died: false, deathCause: null, endReason: 'timeout', ascended: false, ascensionDay: null, harvests: 0,
    maxPillPoison: 0, lowHpTribulationRate: 0, tribulationFinalHpRatios: [], tribulationAttempts: [],
    purpleOmen: { encountered: false, triggeredDay: null, expiredDay: null, blockedBreakthroughDays: 0, deadlocked: false, deadlockReason: null },
    assistance: { preparationEvents: 0, ascensionPillsGranted: 0, progressionCapsGranted: 0, healedMilli: 0, itemsGranted: {}, arraysGranted: 0 },
    beastSurges: 0, cropsLostToBeasts: 0, beastCoresLooted: 0,
    ...overrides,
  };
}

describe('simulation metrics', () => {
  it('Wilson interval stays bounded at both extremes', () => {
    expect(wilsonInterval(0, 10).wilsonLow95).toBeGreaterThanOrEqual(0);
    expect(wilsonInterval(10, 10).wilsonHigh95).toBeLessThanOrEqual(1);
    expect(() => wilsonInterval(0, 0)).toThrow(RangeError);
  });

  it('computes deterministic interpolated quantiles', () => {
    expect(quantile([4, 1, 3, 2], 0.5)).toBe(2.5);
    expect(quantile([], 0.5)).toBeNull();
  });

  it('keeps only timeouts at the horizon in restricted mean', () => {
    const summary = summarizeDuration([
      outcome({ ascended: true, ascensionDay: 10, simulatedDays: 10, endReason: 'ascended' }),
      outcome({ seed: 2, endReason: 'timeout', ascensionDay: null, simulatedDays: 20 }),
      outcome({ seed: 3, endReason: 'tribulation-death', ascensionDay: null, simulatedDays: 4, died: true, deathCause: 'tribulation-death' }),
    ], 20);
    expect(summary.meanConditionalDays).toBe(10);
    expect(summary.restrictedMeanDays).toBeCloseTo(34 / 3, 4);
    expect(summary.timedOutRuns).toBe(1);
  });

  it('requires a sufficient sample for target certification', () => {
    const metrics = {
      bot: 'normal', runs: 1, ascension: wilsonInterval(1, 1), death: wilsonInterval(0, 1), timeout: wilsonInterval(0, 1),
      duration: summarizeDuration([outcome({ ascended: true, ascensionDay: 1, endReason: 'ascended' })], 20),
      purpleEncounterCount: 0, purpleDeadlockCount: 0, purpleDeadlockSeeds: [], syntheticAssistanceRunRate: 0,
      meanSyntheticInterventions: 0, deterministic: true,
    };
    expect(certifyM5Target(metrics, 0.3, 0.45).status).toBe('insufficient-sample');
  });
});
