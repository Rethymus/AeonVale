import { expect, test, type Locator, type Page } from '@playwright/test';
import { gameEntryPath, type AeonDebugSnapshot } from './openGame';

test.use({ viewport: { width: 736, height: 414 }, hasTouch: true, isMobile: true });

async function debugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

async function expectFullyInsideViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function clearIntroByTouch(page: Page): Promise<void> {
  const primary = page.locator('#touch-controls [data-game-command="primary"]');
  let stableEmptyChecks = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(80);
    if ((await debugSnapshot(page)).dialogueBeatId == null) {
      stableEmptyChecks += 1;
      if (stableEmptyChecks >= 2) return;
      continue;
    }
    stableEmptyChecks = 0;
    await primary.tap();
  }
  expect((await debugSnapshot(page)).dialogueBeatId).toBeNull();
}

test('fresh player can move and till using only visible landscape touch controls', async ({ page }) => {
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.locator('#flow-title-new-game').tap();
  await page.locator('#flow-prologue-skip').tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');

  await expect(page.locator('#touch-controls')).toBeVisible();
  const primary = page.locator('[data-game-command="primary"]');
  const moveDown = page.locator('[data-game-command="move-down"]');
  const menu = page.locator('[data-game-command="menu"]');
  for (const control of [primary, moveDown, menu]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }

  await clearIntroByTouch(page);
  const before = await debugSnapshot(page);
  expect(before.onboardingObjectiveId).toBe('first-till');
  expect(before.frontTileTilled).toBe(false);

  await moveDown.tap();
  await page.waitForFunction(
    ({ x, y }) => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.playerX !== x || debug?.playerY !== y;
    },
    { x: before.playerX, y: before.playerY }
  );
  await primary.tap();
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.onboardingObjectiveId === 'first-sow' && debug.frontTileTilled === true;
  });

  const after = await debugSnapshot(page);
  expect(after.onboardingObjectiveId).toBe('first-sow');
  expect(after.frontTileTilled).toBe(true);
  await expect(page.locator('#game-objective')).toContainText('阅读当前对话');
  await expect(page.locator('#game-actions')).toContainText('继续');
  await clearIntroByTouch(page);
  await expect(page.locator('#game-objective')).toContainText('1/4 · 获得灵草');
  await expect(page.locator('#game-objective')).toContainText('播进灵田');
  await expect(page.locator('#game-actions')).toContainText('选择种子');

  await menu.tap();
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('pause');
  await page.locator('[data-app-surface="pause"] [data-game-command="farm"]').tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.interactionPanelKind === 'farm-action');
  expect((await debugSnapshot(page)).uiMode).toBe('panel');
  await expect(page.locator('#world-command-bar')).toBeHidden();
  await menu.tap();
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  await page.locator('[data-app-surface="pause"] [data-game-command="inventory"]').tap();
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('inventory');
  await page.locator('#flow-inventory-close').tap();
  await expect(page.locator('canvas')).toBeVisible();
});

test('fresh landscape touch player completes the public demo without keyboard or test hooks', async ({ page }) => {
  test.setTimeout(100_000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.locator('#flow-title-new-game').tap();
  await page.locator('#flow-prologue-skip').tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');
  await clearIntroByTouch(page);

  const journey = page.locator('#world-journey-action');
  const rest = page.locator('#world-command-bar [data-game-command="end-day"]');
  await page.locator('#touch-controls [data-game-command="move-down"]').tap();
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-sow');
  await clearIntroByTouch(page);
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-water');
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-harvest');

  for (let day = 0; day < 20; day += 1) {
    const objective = (await debugSnapshot(page)).onboardingObjectiveId;
    if (objective === 'journey-alchemy') break;
    if (objective === 'first-water') {
      await journey.tap();
      await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-harvest');
    }
    await journey.tap();
    if ((await debugSnapshot(page)).onboardingObjectiveId === 'journey-alchemy') break;
    const previousDay = (await debugSnapshot(page)).day;
    await rest.tap();
    await page.waitForFunction(before => ((window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.day ?? 0) > Number(before), previousDay);
    await clearIntroByTouch(page);
  }

  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'journey-alchemy');
  await clearIntroByTouch(page);
  await journey.tap();
  await expect(page.locator('[data-app-surface="alchemy"]')).toBeVisible();
  await expectFullyInsideViewport(page, page.locator('#flow-alchemy-primary'));
  await page.locator('#flow-alchemy-primary').tap();
  await expect(page.locator('#flow-alchemy-primary')).toHaveText('携丹返回农庄');
  await page.locator('#flow-alchemy-primary').tap();
  await clearIntroByTouch(page);

  await expect(journey).toHaveText('开始教学天劫');
  await journey.tap();
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  await expectFullyInsideViewport(page, page.locator('#flow-tribulation-primary'));
  await expectFullyInsideViewport(page, page.locator('#flow-tribulation-pause'));
  await page.locator('#flow-tribulation-pill-action').tap();
  await page.locator('#flow-tribulation-primary').tap();
  for (let bolt = 1; bolt <= 3; bolt += 1) {
    await expect(page.locator('#flow-tribulation-warning')).toContainText(`第 ${bolt}/3 雷`);
    await page.locator('#flow-tribulation-primary').tap();
  }

  await expect(page.locator('[data-app-surface="aftermath"]')).toBeVisible();
  await expect(page.locator('#flow-aftermath-result-heading')).toHaveText('三雷已过');
  await expectFullyInsideViewport(page, page.locator('#flow-aftermath-continue'));
  await page.locator('#flow-aftermath-continue').tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'journey-complete');
  await expect(journey).toBeDisabled();
});
