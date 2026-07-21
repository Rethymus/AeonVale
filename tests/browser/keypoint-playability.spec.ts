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

test('CDP keypoint gate: clicking the configured sow tile plants a seed', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const before = await configureSowKeypointViaCdp(page);
  expect(before.onboardingObjectiveId).toBe('first-sow');
  expect(before.frontTileTilled).toBe(true);
  expect(before.frontTileCropId).toBeNull();
  expect(before.hotbarSlotKind).toBe('till');
  expect(before.starterMosslingSeedCount).toBeGreaterThan(0);

  expect(before.frontTileX).toEqual(expect.any(Number));
  expect(before.frontTileY).toEqual(expect.any(Number));
  const targetTile = { x: before.frontTileX ?? -1, y: before.frontTileY ?? -1 };
  const target = await page.evaluate(({ x, y }: { x: number; y: number }) => {
    const api = (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__;
    return api?.canvasPointForTile?.(x, y) ?? null;
  }, targetTile);
  expect(target).not.toBeNull();
  await page.mouse.click(target!.x, target!.y);

  try {
    await page.waitForFunction(
      ({ x, y, seedCountBefore }) => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
        const testApi = (window as typeof window & {
          __AEON_TEST__?: { tileSnapshot?: (x: number, y: number) => { cropId: number | null } | null };
        }).__AEON_TEST__;
        const targetSnapshot = testApi?.tileSnapshot?.(x, y);
        return targetSnapshot?.cropId != null && debug?.lastPointerAction === 'farm-sow' && debug.onboardingObjectiveId === 'first-water' && debug.hotbarSlotKind === 'seed' && debug.hotbarSeedId === 'seed.mossling' && debug.starterMosslingSeedCount === Number(seedCountBefore) - 1;
      },
      { ...targetTile, seedCountBefore: before.starterMosslingSeedCount },
      { timeout: 5_000 }
    );
  } catch (error) {
    const actual = await gameDebugSnapshot(page);
    throw new Error(`Sow tile click did not plant; actual debug state: ${JSON.stringify(actual)}`, { cause: error });
  }

  const after = await gameDebugSnapshot(page);
  const plantedTile = await page.evaluate(({ x, y }: { x: number; y: number }) => {
    const api = (window as typeof window & { __AEON_TEST__?: { tileSnapshot?: (x: number, y: number) => { cropId: number | null } | null } }).__AEON_TEST__;
    return api?.tileSnapshot?.(x, y) ?? null;
  }, targetTile);
  expect(plantedTile?.cropId).not.toBeNull();
  expect(after.onboardingObjectiveId).toBe('first-water');
  expect(after.hotbarSlotKind).toBe('seed');
  expect(after.hotbarSeedId).toBe('seed.mossling');
});

test('CDP keypoint gate: product Enter confirms the contextual farm action before hotbar fallback', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const before = await configureSowKeypointViaCdp(page);
  expect(before.onboardingObjectiveId).toBe('first-sow');
  expect(before.frontTileTilled).toBe(true);
  expect(before.frontTileCropId).toBeNull();
  expect(before.hotbarSlotKind).toBe('till');
  expect(before.starterMosslingSeedCount).toBeGreaterThan(0);

  await page.keyboard.press('Enter');

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
    throw new Error(`Product Enter did not plant from contextual farm state; actual debug state: ${JSON.stringify(actual)}`, { cause: error });
  }

  const after = await gameDebugSnapshot(page);
  expect(after.onboardingObjectiveId).toBe('first-water');
  expect(after.frontTileCropId).not.toBeNull();
  expect(after.hotbarSlotKind).toBe('seed');
  expect(after.hotbarSeedId).toBe('seed.mossling');
});
