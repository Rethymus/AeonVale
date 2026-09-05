import { expect, test, type Page } from '@playwright/test';
import { continueToWorld, gameEntryPath, type AeonDebugSnapshot } from './openGame';

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
  await continueToWorld(page);
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
  const inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  await expect(inventorySurface.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
  await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  await expect(inventorySurface.locator('[data-inventory-tab="player"]')).toHaveCount(0);
  await expect(inventorySurface.locator('[data-craft-cell="0"]')).toContainText('雷击木');
  await expect(inventorySurface.locator('[data-craft-cell="1"]')).toContainText('寒潭莲');
  await expect(inventorySurface.locator('[data-furnace-preview="true"]')).toContainText('40-55%');
  await inventorySurface.locator('[data-craft-autofill="true"]').click();
  await expect(inventorySurface.locator('[data-craft-cell="0"] .inv-virtual')).toContainText('药包');
  await expect(inventorySurface.locator('[data-furnace-start="true"]')).toBeEnabled();
  await inventorySurface.locator('[data-furnace-start="true"]').click();
  await expect(inventorySurface.getByText('首枚承雷丹已经出炉。')).toBeVisible();
  expect((await debugSnapshot(page)).tutorialPillCount).toBe(1);
  await page.keyboard.press('Escape');
  await expect(inventorySurface).toBeHidden();
  await clearWorldDialogue(page);

  await waitForObjective(page, 'journey-tribulation');
  await expect(journey).toHaveText('开始教学天劫');
  await journey.click();
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  await page.locator('#flow-tribulation-pause').click();
  await expect(page.locator('[data-app-surface="pause"] [data-game-command="farm"]')).toBeDisabled();
  await expect(page.locator('[data-app-surface="pause"] [data-game-command="inventory"]')).toBeDisabled();
  await expect(page.locator('#flow-pause-context')).toContainText('只能调整设置');
  // 高负载下首击可能落在忙帧被吞：重试点击直至设置表面可见。
  await expect(async () => {
    await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
    await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  }).toPass({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-tribulation-pause');
  await page.locator('#flow-tribulation-pill-action').click();
  await expect(page.locator('#flow-tribulation-ward')).toContainText('40%');
  await page.locator('#flow-tribulation-primary').click();

  /** 天劫 surface 不放行全局方向键，须点面板 dpad 走位（纯 UI，无测试钩子）。 */
  async function stepTowardWarnedTile(): Promise<boolean> {
    for (let step = 0; step < 12; step += 1) {
      const snap = await debugSnapshot(page);
      if (snap.tutorialPerfectBlockAvailable) return true;
      const tx = snap.tutorialWarnedX;
      const ty = snap.tutorialWarnedY;
      const px = snap.playerX;
      const py = snap.playerY;
      if (tx == null || ty == null || px == null || py == null) return false;
      if (Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= 1) return true;
      if (px < tx) await page.locator('[data-demo-action="move-right"]').click();
      else if (px > tx) await page.locator('[data-demo-action="move-left"]').click();
      else if (py < ty) await page.locator('[data-demo-action="move-down"]').click();
      else if (py > ty) await page.locator('[data-demo-action="move-up"]').click();
      else return true;
      await page.waitForFunction(() => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
        return debug?.tutorialPerfectBlockAvailable === true || debug?.playerMovementActive === false;
      }, undefined, { timeout: 1_500 });
    }
    return (await debugSnapshot(page)).tutorialPerfectBlockAvailable === true;
  }

  let blockedBolts = 0;
  for (let bolt = 1; bolt <= 3; bolt += 1) {
    await expect(page.locator('#flow-tribulation-warning')).toContainText(`第 ${bolt}/3 雷`);
    const inZone = await stepTowardWarnedTile();
    if (inZone || (await debugSnapshot(page)).tutorialPerfectBlockAvailable) {
      await expect(page.locator('#flow-tribulation-primary')).toContainText('擦弹');
      await page.locator('#flow-tribulation-primary').click();
      blockedBolts += 1;
    } else {
      await page.locator('#flow-tribulation-primary').click();
    }
  }

  await expect(page.locator('[data-app-surface="aftermath"]')).toBeVisible();
  await expect(page.locator('#flow-aftermath-result-heading')).toHaveText('三雷已过');
  await expect(page.locator('#flow-aftermath-reward')).toContainText('淬体与修为各 +5');
  // 招牌擦弹：至少 1 雷 blocked（dpad 走入预警区后主按钮擦弹）
  expect(blockedBolts).toBeGreaterThanOrEqual(1);
  await expect(page.locator('#flow-aftermath-hits')).toContainText('擦弹');
  expect((await debugSnapshot(page)).tutorialBoltIndex).toBe(3);
  expect((await debugSnapshot(page)).tutorialHitsBlocked ?? 0).toBeGreaterThanOrEqual(1);
  await page.locator('#flow-aftermath-continue').click();
  await expect(page.locator('canvas')).toBeVisible();
  await waitForObjective(page, 'journey-complete');
  await expect(journey).toHaveText('自由经营');
  await expect(journey).toBeDisabled();
  expect((await debugSnapshot(page)).tutorialTribulationPhase).toBe('idle');
  expect(errors).toEqual([]);
});
