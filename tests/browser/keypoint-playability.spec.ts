import { expect, test, type Page } from '@playwright/test';
import { clearIntroDialogue, gameDebugSnapshot, openGame, type AeonDebugSnapshot } from './openGame';

async function configureSowKeypointViaCdp(page: Page): Promise<AeonDebugSnapshot> {
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `(() => {
        const target = window;
        return Boolean(target.__AEON_TEST__?.configureSowKeypoint?.());
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    expect(result.exceptionDetails, JSON.stringify(result.exceptionDetails ?? null)).toBeUndefined();
    expect(result.result.value).toBe(true);
  } finally {
    await client.detach();
  }

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.onboardingObjectiveId === 'first-sow' && debug.frontTileTilled === true && debug.frontTileCropId == null && debug.hotbarSlotKind === 'till';
  });
  return gameDebugSnapshot(page);
}

test('CDP keypoint gate: pressing Z from the configured sow phase plants a seed', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const before = await configureSowKeypointViaCdp(page);
  expect(before.onboardingObjectiveId).toBe('first-sow');
  expect(before.frontTileTilled).toBe(true);
  expect(before.frontTileCropId).toBeNull();
  expect(before.hotbarSlotKind).toBe('till');
  expect(before.starterMosslingSeedCount).toBeGreaterThan(0);

  await page.keyboard.press('Z');

  try {
    await page.waitForFunction(
      seedCountBefore => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
        return debug?.frontTileCropId != null && debug.onboardingObjectiveId === 'first-water' && debug.hotbarSlotKind === 'seed' && debug.hotbarSeedId === 'seed.mossling' && debug.starterMosslingSeedCount === Number(seedCountBefore) - 1;
      },
      before.starterMosslingSeedCount,
      { timeout: 5_000 }
    );
  } catch (error) {
    const actual = await gameDebugSnapshot(page);
    throw new Error(`Z keypoint did not plant; actual debug state: ${JSON.stringify(actual)}`, { cause: error });
  }

  const after = await gameDebugSnapshot(page);
  expect(after.frontTileCropId).not.toBeNull();
  expect(after.onboardingObjectiveId).toBe('first-water');
  expect(after.hotbarSlotKind).toBe('seed');
  expect(after.hotbarSeedId).toBe('seed.mossling');
});
