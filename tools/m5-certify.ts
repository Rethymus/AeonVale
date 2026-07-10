import { DEFAULT_BALANCE } from '@sim';
import { M5_NORMAL_PROXY_BOT, M5_VETERAN_PROXY_BOT, runSimulation, type BotPolicy, type RunOutcome } from './headless-run';
import { certifyM5Target, summarizeM5Cohort, type M5CohortMetrics } from './simulation-metrics';

type Profile = 'pr' | 'nightly' | 'local';
type FailOn = 'structural' | 'targets' | 'never';

interface Options {
  profile: Profile;
  seeds: number;
  seedStart: number;
  maxDays: number;
  format: 'text' | 'json';
  failOn: FailOn;
  repeatDeterminism: number;
}

interface Report {
  title: 'M5 assisted campaign proxy';
  durationUnit: 'game-days';
  humanHoursCertified: false;
  profile: Profile;
  seedStart: number;
  seeds: number;
  maxDays: number;
  cohorts: M5CohortMetrics[];
  structuralFailures: string[];
  targetResults: Record<string, ReturnType<typeof certifyM5Target>>;
}

function argValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
}

function positive(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseOptions(args: string[]): Options {
  const profile = (argValue(args, '--profile') ?? 'local') as Profile;
  if (!['pr', 'nightly', 'local'].includes(profile)) throw new Error('--profile must be pr, nightly, or local');
  const defaults = profile === 'pr'
    ? { seeds: 64, seedStart: 1, maxDays: 2_000, failOn: 'structural' as const, repeatDeterminism: 8 }
    : profile === 'nightly'
      ? { seeds: 1_000, seedStart: 20_001, maxDays: 2_000, failOn: 'targets' as const, repeatDeterminism: 16 }
      : { seeds: 32, seedStart: 10_001, maxDays: 2_000, failOn: 'never' as const, repeatDeterminism: 4 };
  const format = (argValue(args, '--format') ?? 'text') as Options['format'];
  const failOn = (argValue(args, '--fail-on') ?? defaults.failOn) as FailOn;
  if (!['text', 'json'].includes(format)) throw new Error('--format must be text or json');
  if (!['structural', 'targets', 'never'].includes(failOn)) throw new Error('--fail-on must be structural, targets, or never');
  return {
    profile,
    seeds: positive(argValue(args, '--seeds'), defaults.seeds, '--seeds'),
    seedStart: positive(argValue(args, '--seed-start'), defaults.seedStart, '--seed-start'),
    maxDays: positive(argValue(args, '--max-days'), defaults.maxDays, '--max-days'),
    format,
    failOn,
    repeatDeterminism: positive(argValue(args, '--repeat-determinism'), defaults.repeatDeterminism, '--repeat-determinism'),
  };
}

function runCohort(bot: BotPolicy, options: Options): { outcomes: RunOutcome[]; deterministic: boolean } {
  const outcomes: RunOutcome[] = [];
  let deterministic = true;
  for (let index = 0; index < options.seeds; index++) {
    const seed = options.seedStart + index;
    const outcome = runSimulation(seed, bot, DEFAULT_BALANCE, { maxDays: options.maxDays });
    outcomes.push(outcome);
    if (index < options.repeatDeterminism) {
      const replay = runSimulation(seed, bot, DEFAULT_BALANCE, { maxDays: options.maxDays });
      if (JSON.stringify(outcome) !== JSON.stringify(replay)) deterministic = false;
    }
  }
  return { outcomes, deterministic };
}

function structuralFailures(cohorts: readonly M5CohortMetrics[]): string[] {
  const failures: string[] = [];
  const normal = cohorts.find((cohort) => cohort.bot === 'normal');
  const veteran = cohorts.find((cohort) => cohort.bot === 'veteran');
  for (const cohort of cohorts) {
    if (!cohort.ascension.successes) failures.push(`${cohort.bot}: no proxy ascensions`);
    if (cohort.purpleDeadlockCount) failures.push(`${cohort.bot}: purple mechanical deadlock`);
    if (!cohort.deterministic) failures.push(`${cohort.bot}: non-deterministic replay`);
    if (cohort.syntheticAssistanceRunRate > 0 && !Number.isFinite(cohort.meanSyntheticInterventions)) failures.push(`${cohort.bot}: synthetic assistance was not measurable`);
  }
  if (normal && veteran && veteran.ascension.rate < normal.ascension.rate) failures.push('veteran proxy ascension rate is below normal');
  return failures;
}

function toText(report: Report): string {
  const lines = [
    'M5 assisted campaign proxy',
    'Not a human campaign-duration certification.',
    `Duration unit: ${report.durationUnit}; humanHoursCertified: ${report.humanHoursCertified}`,
    `Profile ${report.profile}: ${report.seeds} seeds from ${report.seedStart}, horizon ${report.maxDays} game-days`,
    '',
  ];
  for (const cohort of report.cohorts) {
    lines.push(`${cohort.bot}: ascension=${cohort.ascension.rate} [${cohort.ascension.wilsonLow95}, ${cohort.ascension.wilsonHigh95}], death=${cohort.death.rate}, timeout=${cohort.timeout.rate}`);
    lines.push(`  duration: conditionalMean=${cohort.duration.meanConditionalDays ?? 'n/a'}, median=${cohort.duration.medianConditionalDays ?? 'n/a'}, restrictedMean=${cohort.duration.restrictedMeanDays}`);
    lines.push(`  purple: encounters=${cohort.purpleEncounterCount}, mechanicalDeadlocks=${cohort.purpleDeadlockCount}; synthetic assistance=${cohort.syntheticAssistanceRunRate} (${cohort.meanSyntheticInterventions}/run)`);
  }
  if (report.structuralFailures.length) lines.push('', 'Structural failures:', ...report.structuralFailures.map((failure) => `- ${failure}`));
  return lines.join('\n');
}

function main(): void {
  const options = parseOptions(process.argv.slice(2));
  const cohorts = [M5_NORMAL_PROXY_BOT, M5_VETERAN_PROXY_BOT].map((bot) => {
    const result = runCohort(bot, options);
    return summarizeM5Cohort(bot.name, result.outcomes, result.deterministic);
  });
  const targetResults = Object.fromEntries(cohorts.map((cohort) => [cohort.bot, certifyM5Target(cohort, cohort.bot === 'veteran' ? 0.75 : 0.3, cohort.bot === 'veteran' ? 0.85 : 0.45)]));
  const report: Report = {
    title: 'M5 assisted campaign proxy', durationUnit: 'game-days', humanHoursCertified: false,
    profile: options.profile, seedStart: options.seedStart, seeds: options.seeds, maxDays: options.maxDays,
    cohorts, structuralFailures: structuralFailures(cohorts), targetResults,
  };
  console.log(options.format === 'json' ? JSON.stringify(report, null, 2) : toText(report));
  const targetFailed = Object.values(targetResults).some((result) => result.status !== 'certified');
  if ((options.failOn === 'structural' && report.structuralFailures.length) || (options.failOn === 'targets' && (report.structuralFailures.length || targetFailed))) process.exitCode = 1;
}

main();
