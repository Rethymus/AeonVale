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

async function startFreshWorld(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('#game-canvas', { state: 'attached' });
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await waitForObjective(page, 'first-till');
  await clearWorldDialogue(page);
}

test('title semantics do not expose world-only keyboard instructions', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());

  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  await expect(page.locator('#game-instructions')).toHaveText('使用 Tab 浏览当前页面控件，Enter 或 Space 激活。');
  await expect(page.locator('#semantic-game-state')).not.toContainText('方向键或 WASD');
  await expect(page.locator('#semantic-game-state')).not.toContainText('空格或 E 执行当前操作');
});

test('runtime canvas owns its accessible name and live game description', async ({ page }) => {
  await startFreshWorld(page);
  const canvas = page.locator('#game-canvas');

  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute('aria-label', '永恒山谷游戏画面');
  await expect(canvas).toHaveAttribute('aria-describedby', 'game-instructions game-surface game-objective game-actions');
  await expect(canvas).toHaveAccessibleName('永恒山谷游戏画面');
  await expect(canvas).toHaveAccessibleDescription(/点击目标移动或互动.*当前页面：农庄世界.*当前目标：.*当前可用动作：/);
});

test('real journey entry focuses the enabled furnace primary action', async ({ page }) => {
  test.setTimeout(90_000);
  await startFreshWorld(page);
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
  await expect(inventorySurface.locator('[data-craft-autofill="true"]')).toBeEnabled();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
});
