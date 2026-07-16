import { expect, test, type Page } from '@playwright/test';
import {
  canvasPaintStats,
  clearIntroDialogue,
  gameDebugSnapshot,
  openGame,
  type AeonDebugSnapshot,
} from './openGame';

type DebugPredicate = (debug: AeonDebugSnapshot) => boolean;

async function waitForDebugState(
  page: Page,
  label: string,
  predicate: DebugPredicate,
  timeoutMs = 8_000,
): Promise<AeonDebugSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let actual = await gameDebugSnapshot(page);
  while (Date.now() < deadline) {
    if (predicate(actual)) return actual;
    await page.waitForTimeout(50);
    actual = await gameDebugSnapshot(page);
  }
  if (predicate(actual)) return actual;
  throw new Error(`Timed out waiting for ${label}; actual debug state: ${JSON.stringify(actual)}`);
}

async function pressUntilDebugState(
  page: Page,
  key: string,
  label: string,
  predicate: DebugPredicate,
  options: { attempts?: number; timeoutMs?: number } = {},
): Promise<AeonDebugSnapshot> {
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 2_500;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const beforePress = await gameDebugSnapshot(page);
    if (predicate(beforePress)) return beforePress;
    if (beforePress.dialogueBeatId != null) await clearIntroDialogue(page);
    await page.keyboard.press(key);
    try {
      return await waitForDebugState(page, label, predicate, timeoutMs);
    } catch (error) {
      lastError = error;
    }
  }
  const actual = await gameDebugSnapshot(page);
  throw new Error(`Failed after ${attempts} attempts pressing ${key} for ${label}; actual debug state: ${JSON.stringify(actual)}`, {
    cause: lastError,
  });
}

test('public build is playable with real first-screen farm inputs', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 150_000 : 120_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await openGame(page);
  await clearIntroDialogue(page);

  const initialPaint = await canvasPaintStats(page);
  expect(initialPaint.sampled).toBeGreaterThan(0);
  expect(initialPaint.painted).toBeGreaterThan(initialPaint.sampled * 0.5);
  expect(initialPaint.colors).toBeGreaterThan(16);

  const before = await gameDebugSnapshot(page);
  expect(before.dialogueBeatId).toBeNull();
  expect(before.paused).toBe(false);
  expect(before.hotbarSlotKind).toBe('till');
  expect(before.onboardingObjectiveId).toBe('first-till');
  expect(before.frontTileTilled).toBe(false);
  expect(before.frontTileCropId).toBeNull();

  await pressUntilDebugState(
    page,
    'Space',
    'first tile tilled',
    (debug) => debug.frontTileTilled === true
      && debug.frontTileCropId == null
      && debug.onboardingObjectiveId === 'first-sow',
  );

  await pressUntilDebugState(
    page,
    '5',
    'mossling seed selected',
    (debug) => debug.hotbarSlotKind === 'seed' && debug.hotbarSeedId === 'seed.mossling',
  );

  const beforeSow = await gameDebugSnapshot(page);
  await pressUntilDebugState(
    page,
    'Space',
    'first seed sown',
    (debug) => debug.frontTileTilled === true
      && debug.frontTileCropId != null
      && debug.onboardingObjectiveId === 'first-water'
      && debug.starterMosslingSeedCount === (beforeSow.starterMosslingSeedCount ?? 0) - 1,
  );

  await pressUntilDebugState(
    page,
    '2',
    'water tool selected',
    (debug) => debug.hotbarSlotKind === 'water' && debug.hotbarSeedId == null,
  );

  const sown = await gameDebugSnapshot(page);
  await pressUntilDebugState(
    page,
    'Space',
    'first crop watered',
    (debug) => debug.frontTileWateredToday === true
      && (debug.frontTileMoisture ?? 0) > (sown.frontTileMoisture ?? 0)
      && debug.onboardingObjectiveId === 'first-harvest',
  );

  const watered = await gameDebugSnapshot(page);
  await clearIntroDialogue(page);
  await pressUntilDebugState(
    page,
    'Enter',
    'next day after real end-day shortcut',
    (debug) => (debug.day ?? 0) > (watered.day ?? 0)
      && debug.frontTileCropId === watered.frontTileCropId
      && (debug.frontTileCropGrowth ?? 0) > (watered.frontTileCropGrowth ?? 0)
      && debug.frontTileWateredToday === false,
    { attempts: 2, timeoutMs: 5_000 },
  );

  const nextDay = await gameDebugSnapshot(page);
  expect(nextDay.onboardingObjectiveId).toBe('first-water');
  expect(errors).toEqual([]);
});
