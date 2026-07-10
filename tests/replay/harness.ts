import { readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRegistry } from '@content/registry';
import {
  createSimContext,
  createSimContextFromState,
  createWorld,
  simulateDay,
  type BalanceParams,
  type GameEvent,
  type GameState,
  type PlayerAction,
} from '@sim';
import { mutateItem } from '@sim/world/player';
import { deserializeState, serializeState, stateHash } from '@sim/serialize';
import { replayFixtureSchema, type ReplayFixture } from './schema';

const replayDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
export const fixtureDirectory = resolve(replayDir, 'fixtures');

export interface ReplayStepActual {
  events: GameEvent[];
  stateHash: string;
}

export interface ReplayResult {
  steps: ReplayStepActual[];
  resumedSteps: ReplayStepActual[];
}

function createFixtureState(fixture: ReplayFixture): { state: GameState; params: BalanceParams } {
  const content = buildRegistry();
  const params = fixture.params as BalanceParams;
  const state = createWorld({
    seed: fixture.seed,
    width: fixture.world.width,
    height: fixture.world.height,
    content,
    params,
  });
  state.player.stage = fixture.setup.stage as GameState['player']['stage'];
  for (const [itemId, count] of Object.entries(fixture.setup.inventory)) {
    mutateItem(state.player, itemId, count);
  }
  return { state, params };
}

function captureStep(state: GameState, actions: readonly PlayerAction[], ctx: ReturnType<typeof createSimContext>): ReplayStepActual {
  const events = simulateDay(state, { actions: [...actions] }, ctx);
  return {
    events: structuredClone(events),
    stateHash: stateHash(state),
  };
}

export function loadReplayFixture(path: string): ReplayFixture {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return replayFixtureSchema.parse(raw);
}

export function listReplayFixturePaths(): string[] {
  return readdirSync(fixtureDirectory)
    .filter((name) => name.endsWith('.replay.json'))
    .sort()
    .map((name) => resolve(fixtureDirectory, name));
}

export function runReplayFixture(fixture: ReplayFixture): ReplayResult {
  const content = buildRegistry();
  const { state, params } = createFixtureState(fixture);
  const ctx = createSimContext(fixture.seed, content, params);
  const steps: ReplayStepActual[] = [];
  const resumedSteps: ReplayStepActual[] = [];
  let resumedState: GameState | null = null;
  let resumedCtx: ReturnType<typeof createSimContext> | null = null;

  for (let index = 0; index < fixture.steps.length; index++) {
    const fixtureStep = fixture.steps[index]!;
    steps.push(captureStep(state, fixtureStep.actions as PlayerAction[], ctx));

    if (resumedState && resumedCtx) {
      resumedSteps.push(captureStep(resumedState, fixtureStep.actions as PlayerAction[], resumedCtx));
    }

    if (index === fixture.saveResumeAfterStep) {
      const saved = JSON.parse(JSON.stringify(serializeState(state))) as unknown;
      resumedState = deserializeState(saved);
      resumedCtx = createSimContextFromState(resumedState, content, params);
    }
  }

  return { steps, resumedSteps };
}

export function fixtureName(path: string): string {
  return basename(path);
}
