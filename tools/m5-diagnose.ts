/**
 * M5 死因诊断：聚合 runSimulation 结果，定位"死亡墙"所在 stage。
 * 复用现有 RunOutcome.tribulationAttempts（含致命那场）+ deathCause + breakthroughs。
 * 用法：tsx tools/m5-diagnose.ts --seeds 256 --seed-start 1
 *
 * 非提交产物——调参决策辅助。可在 P2 收尾时删除。
 */
import { DEFAULT_BALANCE } from '@sim';
import { M5_NORMAL_PROXY_BOT, M5_VETERAN_PROXY_BOT, runSimulation, type BotPolicy, type RunOutcome } from './headless-run';

function argValue(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}

function histogram(values: (string | number)[]): [string, number][] {
  const map = new Map<string, number>();
  for (const v of values) map.set(String(v), (map.get(String(v)) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function diagnose(bot: BotPolicy, seeds: number, seedStart: number): void {
  const outcomes: RunOutcome[] = [];
  for (let i = 0; i < seeds; i++) outcomes.push(runSimulation(seedStart + i, bot, DEFAULT_BALANCE, { maxDays: 2000 }));

  const deaths = outcomes.filter(o => o.died);
  const fatalAttempts = deaths.map(o => o.tribulationAttempts.find(a => !a.survived)).filter((a): a is NonNullable<typeof a> => Boolean(a));

  console.log(`\n=== ${bot.name} (${seeds} seeds) ===`);
  console.log(`ascended=${outcomes.filter(o => o.ascended).length} died=${deaths.length} timeout=${outcomes.filter(o => o.endReason === 'timeout').length}`);
  console.log(
    `breakthroughs 分布（最高推进深度）:`,
    histogram(outcomes.map(o => o.breakthroughs))
      .map(([k, v]) => `brk${k}=${v}`)
      .join(' ')
  );
  console.log(
    `stageReached 分布:`,
    histogram(outcomes.map(o => o.stageReached))
      .map(([k, v]) => `s${k}=${v}`)
      .join(' ')
  );
  console.log(
    `deathCause 分布:`,
    histogram(outcomes.map(o => o.deathCause ?? 'null').map(d => d.replace('-death', '')))
      .map(([k, v]) => `${k}=${v}`)
      .join(' ')
  );
  console.log(
    `致命天劫 stage 分布:`,
    histogram(fatalAttempts.map(a => a.stage))
      .map(([k, v]) => `s${k}=${v}`)
      .join(' ')
  );
  if (fatalAttempts.length) {
    const meanViolet = fatalAttempts.reduce((s, a) => s + a.violetBolts, 0) / fatalAttempts.length;
    const meanBolts = fatalAttempts.reduce((s, a) => s + a.bolts, 0) / fatalAttempts.length;
    const meanHp = fatalAttempts.reduce((s, a) => s + a.finalHpRatio, 0) / fatalAttempts.length;
    console.log(`致命场 均 bolts=${meanBolts.toFixed(2)} 均 violet=${meanViolet.toFixed(2)} 均终HP比=${(meanHp * 100).toFixed(1)}%`);
  }
}

const seeds = Number(argValue(process.argv.slice(2), '--seeds') ?? '256');
const seedStart = Number(argValue(process.argv.slice(2), '--seed-start') ?? '1');
for (const bot of [M5_NORMAL_PROXY_BOT, M5_VETERAN_PROXY_BOT]) diagnose(bot, seeds, seedStart);
