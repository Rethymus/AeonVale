import type { RunOutcome } from './headless-run';

export interface RateEstimate {
  successes: number;
  trials: number;
  rate: number;
  wilsonLow95: number;
  wilsonHigh95: number;
}

export interface DurationSummary {
  unit: 'game-days';
  ascendedRuns: number;
  timedOutRuns: number;
  meanConditionalDays: number | null;
  medianConditionalDays: number | null;
  p90ConditionalDays: number | null;
  restrictedMeanDays: number;
  horizonDays: number;
}

export interface M5CohortMetrics {
  bot: string;
  runs: number;
  ascension: RateEstimate;
  death: RateEstimate;
  timeout: RateEstimate;
  duration: DurationSummary;
  purpleEncounterCount: number;
  purpleDeadlockCount: number;
  purpleDeadlockSeeds: number[];
  syntheticAssistanceRunRate: number;
  meanSyntheticInterventions: number;
  deterministic: boolean;
}

export type CertificationStatus = 'certified' | 'provisional' | 'regressed' | 'insufficient-sample';

export interface CertificationResult {
  status: CertificationStatus;
  pointEstimateQualified: boolean;
  strictWilsonCertified: boolean;
  failures: string[];
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export function wilsonInterval(successes: number, trials: number): RateEstimate {
  if (!Number.isInteger(successes) || !Number.isInteger(trials) || successes < 0 || trials <= 0 || successes > trials) {
    throw new RangeError('wilsonInterval requires 0 <= successes <= positive integer trials');
  }
  const z = 1.959963984540054;
  const rate = successes / trials;
  const denom = 1 + (z * z) / trials;
  const centre = (rate + (z * z) / (2 * trials)) / denom;
  const margin = (z * Math.sqrt((rate * (1 - rate) + (z * z) / (4 * trials)) / trials)) / denom;
  return { successes, trials, rate: round(rate), wilsonLow95: round(Math.max(0, centre - margin)), wilsonHigh95: round(Math.min(1, centre + margin)) };
}

export function quantile(values: readonly number[], q: number): number | null {
  if (!values.length) return null;
  if (q < 0 || q > 1) throw new RangeError('quantile q must be within [0, 1]');
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower]!;
  const high = sorted[upper]!;
  return low + (high - low) * (position - lower);
}

function mean(values: readonly number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function summarizeDuration(outcomes: readonly RunOutcome[], horizonDays: number): DurationSummary {
  if (horizonDays <= 0) throw new RangeError('horizonDays must be positive');
  const ascensionDays = outcomes.flatMap(outcome => (outcome.ascensionDay === null ? [] : [outcome.ascensionDay]));
  const restricted = outcomes.map(outcome => {
    if (outcome.ascensionDay !== null) return Math.min(outcome.ascensionDay, horizonDays);
    return outcome.endReason === 'timeout' ? horizonDays : Math.min(outcome.simulatedDays, horizonDays);
  });
  const conditional = mean(ascensionDays);
  return {
    unit: 'game-days',
    ascendedRuns: ascensionDays.length,
    timedOutRuns: outcomes.filter(outcome => outcome.endReason === 'timeout').length,
    meanConditionalDays: conditional === null ? null : round(conditional),
    medianConditionalDays: quantile(ascensionDays, 0.5),
    p90ConditionalDays: quantile(ascensionDays, 0.9),
    restrictedMeanDays: round(mean(restricted) ?? 0),
    horizonDays
  };
}

export function summarizeM5Cohort(bot: string, outcomes: readonly RunOutcome[], deterministic: boolean): M5CohortMetrics {
  if (!outcomes.length) throw new RangeError('summarizeM5Cohort requires outcomes');
  const horizon = outcomes[0]!.maxDays;
  if (outcomes.some(outcome => outcome.maxDays !== horizon)) throw new RangeError('cohort outcomes must share maxDays');
  const assistanceRuns = outcomes.filter(outcome => outcome.assistance.preparationEvents > 0 || outcome.assistance.ascensionPillsGranted > 0 || outcome.assistance.progressionCapsGranted > 0);
  const interventions = outcomes.map(outcome => outcome.assistance.preparationEvents + outcome.assistance.ascensionPillsGranted + outcome.assistance.progressionCapsGranted + outcome.assistance.arraysGranted);
  const deadlocks = outcomes.filter(outcome => outcome.purpleOmen.deadlocked);
  return {
    bot,
    runs: outcomes.length,
    ascension: wilsonInterval(outcomes.filter(outcome => outcome.ascended).length, outcomes.length),
    death: wilsonInterval(outcomes.filter(outcome => outcome.died).length, outcomes.length),
    timeout: wilsonInterval(outcomes.filter(outcome => outcome.endReason === 'timeout').length, outcomes.length),
    duration: summarizeDuration(outcomes, horizon),
    purpleEncounterCount: outcomes.filter(outcome => outcome.purpleOmen.encountered).length,
    purpleDeadlockCount: deadlocks.length,
    purpleDeadlockSeeds: deadlocks.map(outcome => outcome.seed).sort((a, b) => a - b),
    syntheticAssistanceRunRate: round(assistanceRuns.length / outcomes.length),
    meanSyntheticInterventions: round(mean(interventions) ?? 0),
    deterministic
  };
}

export function certifyM5Target(metrics: M5CohortMetrics, minRate: number, maxRate: number, minimumSample = 500): CertificationResult {
  if (metrics.runs < minimumSample) return { status: 'insufficient-sample', pointEstimateQualified: false, strictWilsonCertified: false, failures: [`${metrics.bot}: ${metrics.runs}/${minimumSample} samples`] };
  const failures: string[] = [];
  if (metrics.purpleDeadlockCount) failures.push(`${metrics.bot}: purple deadlocks at seeds ${metrics.purpleDeadlockSeeds.join(', ')}`);
  if (!metrics.deterministic) failures.push(`${metrics.bot}: non-deterministic outcomes`);
  if (metrics.ascension.rate < minRate || metrics.ascension.rate > maxRate) failures.push(`${metrics.bot}: proxy ascension rate ${metrics.ascension.rate} outside [${minRate}, ${maxRate}]`);
  if (failures.length) return { status: 'regressed', pointEstimateQualified: false, strictWilsonCertified: false, failures };
  const intervalInside = metrics.ascension.wilsonLow95 >= minRate && metrics.ascension.wilsonHigh95 <= maxRate;
  return {
    status: intervalInside ? 'certified' : 'provisional',
    pointEstimateQualified: true,
    strictWilsonCertified: intervalInside,
    failures: []
  };
}
