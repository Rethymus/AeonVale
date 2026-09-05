#!/usr/bin/env tsx
/**
 * 修途主模式 Golden Replay fixture 再生成工具。
 *
 *   pnpm replay:cultivation:update -- --init            # 从 harness 内置作者计划全新生成 fixture（覆盖）
 *   pnpm replay:cultivation:update -- --fixture <path>   # 只刷新既有 fixture 的 facts 与逐步哈希（默认路径可省略）
 *
 * 纪律与 tools/update-golden-replay.ts 一致（见 .claude/skills/golden-replay-update/SKILL.md）：
 * 仅在"已被接受的行为/参数变更"后运行；CI 环境拒绝执行；plan（输入脚本）不被本工具改写。
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  authorCultivationReplayFixture,
  cultivationReplayFixturePath,
  cultivationReplayFixtureSchema,
  runCultivationReplayFixture,
  writeCultivationReplayFixture
} from '../tests/replay/cultivation-harness';

function usage(): never {
  console.error('Usage: pnpm replay:cultivation:update -- [--init] [--fixture <path>]');
  process.exit(1);
}

function fixturePathOf(args: readonly string[]): string {
  const index = args.indexOf('--fixture');
  const explicit = index >= 0 ? args[index + 1] : undefined;
  if (index >= 0 && !explicit) usage();
  return explicit ? resolve(process.cwd(), explicit!) : cultivationReplayFixturePath;
}

function main(): void {
  if (process.env.CI) {
    console.error('Refusing to update cultivation Golden Replay fixtures in CI.');
    process.exit(1);
  }

  const args = process.argv.slice(2).filter(arg => arg !== '--');
  if (args.some(arg => arg !== '--init' && arg !== '--fixture')) usage();
  const path = fixturePathOf(args);

  if (args.includes('--init')) {
    writeCultivationReplayFixture(authorCultivationReplayFixture(), path);
    console.log(`Authored ${path}`);
    return;
  }

  if (!existsSync(path)) {
    console.error(`Fixture not found: ${path} (run with --init to author it first)`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  const fixture = cultivationReplayFixtureSchema.parse(raw);
  const actual = runCultivationReplayFixture(fixture);
  raw.facts = actual.facts;
  const steps = raw.steps as Array<Record<string, unknown>>;
  for (let index = 0; index < steps.length; index++) {
    steps[index]!.expected = actual.steps[index]!.hash;
  }
  writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
  console.log(`Updated ${path}`);
}

main();
