import { expect, test } from '@playwright/test';
import { gameDebugSnapshot, gameEntryPath, waitForInitialSurface } from './openGame';

const OPENING_TITLES = ['没有系统，也没有人来救你', '测不出的灵根，先学看水往哪里走', '仙人斗法时，凡人的田先碎了', '以劫为薪，以骨为柴'] as const;

async function dismissOrientationIfPresent(page: import('@playwright/test').Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

test('boot-ready reveals a playable first surface before any input', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 120_000 : 45_000);
  await page.goto(gameEntryPath());

  const initial = await waitForInitialSurface(page);
  expect(initial.appSurface === 'title' || initial.appSurface === 'world').toBe(true);

  if (initial.appSurface === 'title') {
    await expect(page.locator('#flow-title-new-game')).toBeVisible();
    await expect(page.locator('[data-app-surface="loading"]')).toBeHidden();
    await expect(page.locator('canvas')).toBeHidden();
  } else {
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  }
});

test('loads the current journey and reaches its desktop workbench without page errors', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 120_000 : 45_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await dismissOrientationIfPresent(page);
  await page.locator('#flow-title-new-game').click();

  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
  await expect(page.locator('[data-app-surface="world"]')).toBeHidden();
  await expect(page).toHaveTitle(/Aeon Vale|永恒山谷/);

  const entryDebug = await gameDebugSnapshot(page);
  expect(entryDebug.debugSchemaVersion).toBe(2);
  expect(entryDebug.legacyShortcutsEnabled).toBe(false);
  const expectedBuildRevision = process.env.PLAYWRIGHT_EXPECTED_BUILD_REVISION?.trim() || (process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? null : 'playwright-test');
  if (expectedBuildRevision) expect(entryDebug.buildRevision).toBe(expectedBuildRevision);
  else {
    expect(entryDebug.buildRevision).toEqual(expect.any(String));
    expect(entryDebug.buildRevision).not.toBe('dev');
    expect(entryDebug.buildRevision?.trim()).not.toBe('');
  }

  expect(entryDebug.flowScreen).toBe('roguelite-proto');
  expect(entryDebug.appSurface).toBe('roguelite-proto');
  for (const title of OPENING_TITLES) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
  await page.getByRole('button', { name: '翻开今世日课' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排日课' }).click();

  await expect(page.locator('.rp-planning')).toBeVisible();
  await expect(page.getByRole('heading', { name: '一世日课' })).toBeVisible();
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
  await expect(page.locator('.rp-activity-btn')).toHaveCount(6);
  await expect(page.locator('.rp-causal-panel')).toContainText(/日课|资源|心压|村落|天劫/);
  expect(errors).toEqual([]);
});
