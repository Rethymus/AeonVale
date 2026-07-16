import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath, type AeonDebugSnapshot } from './openGame';

async function debugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

async function clearWorldDialogue(page: Page): Promise<void> {
  let stableEmptyChecks = 0;
  for (let attempt = 0; attempt < 16; attempt += 1) {
    await page.waitForTimeout(80);
    if ((await debugSnapshot(page)).dialogueBeatId == null) {
      stableEmptyChecks += 1;
      if (stableEmptyChecks >= 2) return;
      continue;
    }
    stableEmptyChecks = 0;
    await page.keyboard.press('Enter');
  }
  expect((await debugSnapshot(page)).dialogueBeatId).toBeNull();
}

async function waitForObjective(page: Page, objective: string): Promise<void> {
  await page.waitForFunction(expected => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === expected, objective);
}

test('fresh desktop player completes the four-stage public demo without test hooks', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await waitForObjective(page, 'first-till');
  await clearWorldDialogue(page);

  const journey = page.locator('#world-journey-action');
  const rest = page.locator('#world-command-bar [data-game-command="end-day"]');
  await page.keyboard.press('ArrowDown');

  await journey.click();
  await waitForObjective(page, 'first-sow');
  await clearWorldDialogue(page);
  await journey.click();
  await waitForObjective(page, 'first-water');
  await journey.click();
  await waitForObjective(page, 'first-harvest');

  for (let day = 0; day < 20; day += 1) {
    const objective = (await debugSnapshot(page)).onboardingObjectiveId;
    if (objective === 'journey-alchemy') break;
    if (objective === 'first-water') {
      await journey.click();
      await waitForObjective(page, 'first-harvest');
    }
    await journey.click();
    if ((await debugSnapshot(page)).onboardingObjectiveId === 'journey-alchemy') break;
    const previousDay = (await debugSnapshot(page)).day;
    await rest.click();
    await page.waitForFunction(before => ((window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.day ?? 0) > Number(before), previousDay);
    await clearWorldDialogue(page);
  }

  await waitForObjective(page, 'journey-alchemy');
  await clearWorldDialogue(page);
  await expect(journey).toHaveText('开始炼丹');
  await journey.click();
  await expect(page.locator('[data-app-surface="alchemy"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-alchemy-primary');
  await expect(page.locator('#flow-alchemy-materials')).toContainText('雷击木');
  await expect(page.locator('#flow-alchemy-materials')).toContainText('寒潭莲');
  await expect(page.locator('#flow-alchemy-ideal')).toContainText('40–55%');
  await page.locator('#flow-alchemy-primary').click();
  await expect(page.locator('#flow-alchemy-result')).toContainText('首枚避雷丹已经出炉');
  await expect(page.locator('#flow-alchemy-primary')).toHaveText('携丹返回农庄');
  expect((await debugSnapshot(page)).tutorialPillCount).toBe(1);
  await page.locator('#flow-alchemy-primary').click();
  await expect(page.locator('canvas')).toBeVisible();
  await clearWorldDialogue(page);

  await waitForObjective(page, 'journey-tribulation');
  await expect(journey).toHaveText('开始教学天劫');
  await journey.click();
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  await page.locator('#flow-tribulation-pause').click();
  await expect(page.locator('[data-app-surface="pause"] [data-game-command="farm"]')).toBeDisabled();
  await expect(page.locator('[data-app-surface="pause"] [data-game-command="inventory"]')).toBeDisabled();
  await expect(page.locator('#flow-pause-context')).toContainText('只能调整设置');
  await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
  await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-tribulation-pause');
  await page.locator('#flow-tribulation-pill-action').click();
  await expect(page.locator('#flow-tribulation-ward')).toContainText('40%');
  await page.locator('#flow-tribulation-primary').click();

  for (let bolt = 1; bolt <= 3; bolt += 1) {
    await expect(page.locator('#flow-tribulation-warning')).toContainText(`第 ${bolt}/3 雷`);
    await page.locator('#flow-tribulation-primary').click();
  }

  await expect(page.locator('[data-app-surface="aftermath"]')).toBeVisible();
  await expect(page.locator('#flow-aftermath-result-heading')).toHaveText('三雷已过');
  await expect(page.locator('#flow-aftermath-reward')).toContainText('淬体与修为各 +5');
  expect((await debugSnapshot(page)).tutorialBoltIndex).toBe(3);
  await page.locator('#flow-aftermath-continue').click();
  await expect(page.locator('canvas')).toBeVisible();
  await waitForObjective(page, 'journey-complete');
  await expect(journey).toHaveText('返回农庄');
  await expect(journey).toBeDisabled();
  expect((await debugSnapshot(page)).tutorialTribulationPhase).toBe('idle');
  expect(errors).toEqual([]);
});
