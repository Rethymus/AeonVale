import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath, type AeonDebugSnapshot } from './openGame';

async function openResponsiveGame(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('canvas')?.width === 960);
}

test('desktop canvas fills the available 16:9 viewport instead of stopping at 960 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: { appSurface?: string } }).__AEON_DEBUG__?.appSurface === 'world');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(1400);
  expect(box!.height).toBeGreaterThanOrEqual(780);
  expect(await page.locator('#orientation-gate').isVisible()).toBe(false);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([1440, 900]);
});

test('portrait viewport shows the orientation gate instead of a compressed playable canvas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResponsiveGame(page);

  await expect(page.locator('#orientation-gate')).toBeVisible();
  await expect(page.locator('#orientation-gate')).toContainText('请横置设备');
  await expect(page.locator('#orientation-save-status')).toContainText('尚无可恢复的本地存档');
  await expect(page.locator('#orientation-save-status')).not.toContainText('安全保留');
  await expect(page.locator('canvas')).toBeHidden();
  await expect(page.locator('#touch-controls')).toBeHidden();
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([390, 844]);
});

test('same-orientation resize refreshes canvas and debug layout bounds immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.canvasBounds?.width === 1440);

  await page.setViewportSize({ width: 960, height: 540 });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.canvasBounds?.width === 960 && debug.canvasBounds.height === 540 && debug.viewportProfile === 'desktop';
  });

  const debug = await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
  expect(debug.worldBounds?.width).toBeGreaterThan(600);
  expect(debug.objectiveRailBounds?.width).toBeGreaterThan(200);
  const box = await page.locator('canvas').boundingBox();
  expect(box).toMatchObject({ width: 960, height: 540 });
});
