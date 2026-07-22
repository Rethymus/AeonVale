import { expect, test } from '@playwright/test';
import { gameDebugSnapshot, gameEntryPath, waitForInitialSurface } from './openGame';

test('public build supports real journey input and exact continue restore', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 150_000 : 90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await page.locator('#flow-title-new-game').click();
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
  for (let beat = 0; beat < 5; beat += 1) await page.locator('.cr-opening__button[data-primary="true"]').click();
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();

  const firstSlot = page.locator('.rp-agenda-slot').first();
  await firstSlot.click();
  await page.getByRole('button', { name: /^灵田，/ }).click();
  await expect(firstSlot).toContainText('灵田');
  await expect(page.locator('.rp-agenda-meta')).toContainText('已排 1/6');

  const expectedBuildRevision = process.env.PLAYWRIGHT_EXPECTED_BUILD_REVISION?.trim();
  if (expectedBuildRevision) expect((await gameDebugSnapshot(page)).buildRevision).toBe(expectedBuildRevision);

  await page.reload();
  await page.locator('#flow-title-continue').click();
  await expect(page.locator('.rp-planning')).toBeVisible();
  await expect(page.locator('.rp-agenda-slot').first()).toContainText('灵田');
  await expect(page.locator('.rp-agenda-meta')).toContainText('已排 1/6');
  await expect(page.locator('[data-app-surface="world"]')).toBeHidden();
  expect(errors).toEqual([]);
});
