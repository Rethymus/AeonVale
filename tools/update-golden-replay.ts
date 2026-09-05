#!/usr/bin/env tsx
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fixtureDirectory, loadReplayFixture, runReplayFixture } from '../tests/replay/harness';

function usage(): never {
  console.error('Usage: pnpm replay:update -- --fixture <path> | --all');
  process.exit(1);
}

function fixturePaths(args: readonly string[]): string[] {
  const all = args.includes('--all');
  const fixtureIndex = args.indexOf('--fixture');
  const fixture = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;
  if ((all ? 1 : 0) + (fixture ? 1 : 0) !== 1) usage();
  if (all) {
    return readdirSync(fixtureDirectory)
      .filter(name => name.endsWith('.replay.json'))
      .sort()
      .map(name => resolve(fixtureDirectory, name));
  }
  return [resolve(process.cwd(), fixture!)];
}

function main(): void {
  if (process.env.CI) {
    console.error('Refusing to update Golden Replay fixtures in CI.');
    process.exit(1);
  }

  for (const path of fixturePaths(process.argv.slice(2))) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const fixture = loadReplayFixture(path);
    const actual = runReplayFixture(fixture);
    const steps = raw.steps as Array<Record<string, unknown>>;
    for (let index = 0; index < steps.length; index++) {
      steps[index]!.expected = actual.steps[index]!;
    }
    writeFileSync(path, `${JSON.stringify(raw, null, 2)}\n`);
    console.log(`Updated ${path}`);
  }
}

main();
