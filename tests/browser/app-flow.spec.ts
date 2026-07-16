import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath, type AeonDebugSnapshot, waitForInitialSurface } from './openGame';

async function debugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

async function clearWorldDialogue(page: Page): Promise<void> {
  let stableEmptyChecks = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(80);
    if ((await debugSnapshot(page)).dialogueBeatId == null) {
      stableEmptyChecks += 1;
      if (stableEmptyChecks >= 2) return;
      continue;
    }
    stableEmptyChecks = 0;
    await page.keyboard.press('Enter');
  }
}

test('title and prologue are real focusable surfaces before the world becomes interactive', async ({ page }) => {
  await page.goto(gameEntryPath());
  const initial = await waitForInitialSurface(page);
  expect(initial.appSurface).toBe('title');

  const newGame = page.locator('#flow-title-new-game');
  await expect(newGame).toBeVisible();
  await expect(page.locator('#flow-title-version')).toContainText('版本 0.1.0');
  await expect(page.locator('canvas')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-title-new-game');

  await newGame.click();
  await expect(page.locator('[data-app-surface="prologue"]')).toBeVisible();
  await expect(page.locator('#flow-prologue-heading')).toContainText('从一块空地开始');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-prologue-continue');

  await page.locator('#flow-prologue-skip').click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('[data-app-surface="title"]')).toBeHidden();
  expect((await debugSnapshot(page)).appSurface).toBe('world');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
});

test('settings and pause close with Escape and restore their trigger focus', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);

  const settingsTrigger = page.locator('#flow-title-settings');
  await settingsTrigger.click();
  await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-settings-close');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-title-settings');

  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('pause');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-pause-resume');

  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect((await debugSnapshot(page)).appSurface).toBe('world');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
});

test('world command bar and keyboard accelerators use the same flow surfaces', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();

  const commandBar = page.locator('#world-command-bar');
  await expect(commandBar).toBeVisible();
  await commandBar.locator('[data-game-command="inventory"]').click();
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('inventory');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');

  await page.keyboard.press('u');
  await expect(page.locator('[data-app-surface="alchemy"]')).toBeVisible();
  await expect(page.locator('#flow-alchemy-result')).toContainText('先在灵田收获');
  await expect(page.locator('#flow-alchemy-primary')).toBeDisabled();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-alchemy-heat');
  await page.keyboard.press('Escape');

  await page.keyboard.press('p');
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
  await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('settings');
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');

  await clearWorldDialogue(page);
  await commandBar.locator('[data-game-command="farm"]').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.interactionPanelKind === 'farm-action');
  expect((await debugSnapshot(page)).uiMode).toBe('panel');
  expect((await debugSnapshot(page)).flowOverlay).toBeNull();
  await expect(commandBar).toBeHidden();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.interactionPanelKind === 'none');
  expect((await debugSnapshot(page)).uiMode).toBe('world');
  expect((await debugSnapshot(page)).flowOverlay).toBeNull();
  await expect(commandBar).toBeVisible();
});

test('screen-reader semantics follow the active page instead of leaking the world journey', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  const surface = page.locator('#game-surface');
  const objective = page.locator('#game-objective');
  const actions = page.locator('#game-actions');
  const panel = page.locator('#game-panel');

  await expect(page.locator('#flow-title-new-game')).toBeVisible();
  await expect(surface).toHaveText('当前页面：标题。');
  await expect(objective).toHaveText('当前目标：开始一段本地旅程。');
  await expect(actions).toContainText('新游戏');
  await expect(actions).not.toContainText('开始翻地');
  await expect(panel).toHaveText('当前没有打开面板。');

  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await expect(surface).toHaveText('当前页面：农庄世界。');
  await expect(objective).toContainText('面对空地翻出第一块灵田');
  await expect(actions).toContainText('开始翻地');
  await expect(actions).toContainText('方向移动');

  await page.locator('#world-command-bar [data-game-command="inventory"]').click();
  await expect(surface).toHaveText('当前页面：背包。');
  await expect(objective).toHaveText('当前目标：查看随身物品。');
  await expect(actions).toHaveText('当前可用动作：返回农庄。');
  await expect(panel).toHaveText('已打开面板：背包。');
  await expect(objective).not.toContainText('翻出第一块灵田');
  await page.keyboard.press('Escape');

  await page.keyboard.press('u');
  await expect(surface).toHaveText('当前页面：炼丹。');
  await expect(objective).toContainText('先在灵田收获第一批灵草');
  await expect(actions).toHaveText('当前可用动作：调整炉火；返回农庄。');
  await expect(panel).toHaveText('已打开面板：炼丹。');
  await expect(actions).not.toContainText('方向移动');
  await page.keyboard.press('Escape');

  await page.keyboard.press('p');
  await expect(surface).toHaveText('当前页面：暂停。');
  await expect(objective).toHaveText('当前目标：选择系统页面，或继续游戏。');
  await expect(actions).toContainText('继续游戏');
  await expect(panel).toHaveText('已打开面板：暂停菜单。');
  await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
  await expect(surface).toHaveText('当前页面：设置。');
  await expect(objective).toHaveText('当前目标：查看系统与可访问性设置。');
  await expect(actions).toHaveText('当前可用动作：调整主音量；切换减少动态效果；返回。');
  await expect(panel).toHaveText('已打开面板：设置。');
});

test('boot recovery reload works even when initialization fails before the flow controller exists', async ({ page }) => {
  await page.addInitScript(() => {
    (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
  });
  await page.goto(gameEntryPath());
  const errorSurface = page.locator('[data-app-surface="boot-error"]');
  await expect(errorSurface).toBeVisible();
  await expect(errorSurface).toContainText('WebGL');

  const reloaded = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
  await page.locator('#flow-boot-error-reload').click();
  await reloaded;
  await expect(errorSurface).toBeVisible();
});
