/*
 * playtest-report.ts —— 5–10 人 AI 替身 playtest 体验报告（体验门，dev-only，不入公开产物）。
 *
 * 方法：以确定性 bot 人格（rookie/normal/veteran，tools/headless-run.ts）充当"5–10 名
 * AI 替身玩家"，跨多 seed 各跑一局，聚合 §10 体验代理指标：
 *   - 参与度（engagement）：到达境界、收获数、存活日、飞升率
 *   - 挫败感（frustration）：死亡率、死因分布、低血渡劫率、丹毒峰值、妖兽吞作物
 * 再给出一句话节奏/难度诊断。这是项目自身的方法论（wiki「纯代码无引擎…」+ llm-playtester
 * skill 的 deterministic-bot 路径），不联网、不依赖 API key。
 *
 * 升级路径（LLM-as-judge）：设 ANTHROPIC_API_KEY 后运行
 *   node node_modules/tsx/dist/cli.mjs .claude/skills/llm-playtester/llm-playtest-bot.ts --seed N --days 60
 * 可用 LLM 读状态卡产动作，作为"会思考的"第 N+1 号替身玩家，与本报告基线对照。
 *
 * 用法：pnpm exec tsx tools/playtest-report.ts [--days=120] [--seeds=11,22,33]
 */
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { runOne, ROOKIE_BOT, NORMAL_BOT, VETERAN_BOT, type BotPolicy, type RunOutcome } from './headless-run.js';

interface PersonaRoster {
  readonly persona: string;
  readonly bot: BotPolicy;
  readonly seeds: readonly number[];
}

interface PersonaAggregate {
  readonly persona: string;
  readonly sessions: number;
  readonly avgStageReached: number;
  readonly avgHarvests: number;
  readonly avgDays: number;
  readonly ascensionRate: number;
  readonly deathRate: number;
  readonly deathCauses: Record<string, number>;
  readonly avgLowHpTribulationRate: number;
  readonly avgMaxPillPoison: number;
  readonly avgBeastSurges: number;
  readonly avgCropsLostToBeasts: number;
}

interface PlaytestReport {
  readonly generatedNote: string;
  readonly llmJudgeUpgrade: string;
  readonly days: number;
  readonly totalSessions: number;
  readonly personas: readonly PersonaAggregate[];
  readonly sessions: readonly (RunOutcome & { persona: string })[];
  readonly verdict: string;
}

function avg(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function aggregate(persona: string, outcomes: readonly (RunOutcome & { persona: string })[]): PersonaAggregate {
  const deathCauses: Record<string, number> = {};
  for (const o of outcomes) {
    const cause = o.deathCause ?? (o.ascended ? 'ascended' : 'alive');
    deathCauses[cause] = (deathCauses[cause] ?? 0) + 1;
  }
  return {
    persona,
    sessions: outcomes.length,
    avgStageReached: avg(outcomes.map(o => o.stageReached)),
    avgHarvests: avg(outcomes.map(o => o.harvests)),
    avgDays: avg(outcomes.map(o => o.simulatedDays)),
    ascensionRate: outcomes.filter(o => o.ascended).length / Math.max(1, outcomes.length),
    deathRate: outcomes.filter(o => o.died).length / Math.max(1, outcomes.length),
    deathCauses,
    avgLowHpTribulationRate: avg(outcomes.map(o => o.lowHpTribulationRate)),
    avgMaxPillPoison: avg(outcomes.map(o => o.maxPillPoison)),
    avgBeastSurges: avg(outcomes.map(o => o.beastSurges)),
    avgCropsLostToBeasts: avg(outcomes.map(o => o.cropsLostToBeasts))
  };
}

function verdictOf(personas: readonly PersonaAggregate[]): string {
  if (!personas.length) return '无人格数据。';
  const normal = personas.find(p => p.persona === 'normal');
  const vet = personas.find(p => p.persona === 'veteran');
  const rookie = personas.find(p => p.persona === 'rookie');
  const parts: string[] = [];
  if (normal) parts.push(`normal 人格平均到 ${normal.avgStageReached.toFixed(1)} 境、${normal.avgDays.toFixed(0)} 日，飞升率 ${(normal.ascensionRate * 100).toFixed(0)}%、死亡率 ${(normal.deathRate * 100).toFixed(0)}%`);
  if (vet && normal) {
    if (vet.avgStageReached > normal.avgStageReached + 0.5) parts.push('veteran 明显领先，难度梯度成立');
    else parts.push('veteran 与 normal 拉开不足，难度梯度偏平');
  }
  if (normal && normal.avgLowHpTribulationRate > 0.4) parts.push('低血渡劫率偏高，紧张感/挫败风险需关注');
  if (rookie && rookie.deathRate > 0.5) parts.push('rookie 死亡率过高，新手期可能过挫败');
  return parts.join('；') + '。';
}

function parseArgs(): { days: number; seeds: number[] } {
  const argv = process.argv.slice(2);
  const daysArg = argv.find(a => a.startsWith('--days='));
  const seedsArg = argv.find(a => a.startsWith('--seeds='));
  const days = daysArg ? Number(daysArg.slice(7)) : 120;
  const seeds = seedsArg ? seedsArg.slice(8).split(',').map(s => Number(s.trim())).filter(Number.isFinite) : [11, 22, 33];
  return { days, seeds };
}

function main(): void {
  const { days, seeds } = parseArgs();
  const roster: readonly PersonaRoster[] = [
    { persona: 'rookie', bot: ROOKIE_BOT, seeds },
    { persona: 'normal', bot: NORMAL_BOT, seeds },
    { persona: 'veteran', bot: VETERAN_BOT, seeds }
  ];

  const allSessions: (RunOutcome & { persona: string })[] = [];
  const personaAgg: PersonaAggregate[] = [];
  for (const r of roster) {
    const outs: (RunOutcome & { persona: string })[] = [];
    for (const seed of r.seeds) {
      const outcome = runOne(seed, days, r.bot);
      outs.push({ ...outcome, persona: r.persona });
    }
    allSessions.push(...outs);
    personaAgg.push(aggregate(r.persona, outs));
  }

  const report: PlaytestReport = {
    generatedNote: 'dev-only experience-gate artifact (AI-surrogate playtest, not for public release)',
    llmJudgeUpgrade:
      '设 ANTHROPIC_API_KEY 后：node node_modules/tsx/dist/cli.mjs .claude/skills/llm-playtester/llm-playtest-bot.ts --seed N --days 60（LLM 读状态卡产动作，作为会思考的替身玩家）',
    days,
    totalSessions: allSessions.length,
    personas: personaAgg,
    sessions: allSessions,
    verdict: verdictOf(personaAgg)
  };

  console.log(`\nAI 替身 playtest 体验报告（${allSessions.length} 场 × ${days} 日预算）`);
  console.log('─'.repeat(70));
  console.log('人格     场次  均境界  均收获  均日数  飞升率  死亡率  低血渡劫率  丹毒峰值');
  for (const p of personaAgg) {
    console.log(
      `${p.persona.padEnd(8)} ${String(p.sessions).padStart(3)}  ` +
        `${p.avgStageReached.toFixed(1).padStart(5)}  ${p.avgHarvests.toFixed(0).padStart(5)}  ${p.avgDays.toFixed(0).padStart(5)}  ` +
        `${(p.ascensionRate * 100).toFixed(0).padStart(4)}%  ${(p.deathRate * 100).toFixed(0).padStart(4)}%  ` +
        `${(p.avgLowHpTribulationRate * 100).toFixed(0).padStart(7)}%  ${p.avgMaxPillPoison.toFixed(1).padStart(6)}`
    );
  }
  console.log('─'.repeat(70));
  console.log(`诊断：${report.verdict}`);

  const artifactsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.omc', 'artifacts');
  mkdirSync(artifactsDir, { recursive: true });
  writeFileSync(resolve(artifactsDir, 'playtest-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\n报告 → .omc/artifacts/playtest-report.json`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
