import { expect, test, type Page } from '@playwright/test';
import { continueToWorld, gameEntryPath, type AeonDebugSnapshot, waitForInitialSurface } from './openGame';

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

async function openFurnaceFromPause(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  await page.locator('[data-app-surface="pause"] [data-game-command="furnace"]').click();
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  await expect(page.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  await expect(page.locator('[data-inventory-tab="player"]')).toHaveCount(0);
}

test('title leads to the roguelite opening while the legacy world stays reachable through the test gate', async ({ page }) => {
  await page.goto(gameEntryPath());
  const initial = await waitForInitialSurface(page);
  expect(initial.appSurface).toBe('title');

  const newGame = page.locator('#flow-title-new-game');
  await expect(newGame).toBeVisible();
  await expect(page.locator('#flow-title-version')).toContainText('版本 0.1.0');
  await expect(page.locator('canvas')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-title-new-game');

  // D27 起主路径：开始游戏进入「偷天换劫」开场（不再经过旧世界序章）。
  await newGame.click();
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
  await expect(page.locator('[data-app-surface="title"]')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('cr-opening-heading');

  // 旧世界（序章 → 农庄）仍必须可达：测试门走 start-new-game → skip-prologue。
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  const entered = await page.evaluate(() => {
    const target = (window as typeof window & { __AEON_TEST__?: { enterLegacyWorld: () => boolean } }).__AEON_TEST__;
    return target ? target.enterLegacyWorld() : false;
  });
  expect(entered).toBe(true);
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

  await continueToWorld(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('pause');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-pause-resume');

  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect((await debugSnapshot(page)).appSurface).toBe('world');
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('CANVAS');
});

test('world command bar and product keyboard shortcuts use the same flow surfaces without legacy leakage', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToWorld(page);

  const commandBar = page.locator('#world-command-bar');
  await expect(commandBar).toBeVisible();
  expect((await debugSnapshot(page)).legacyShortcutsEnabled).toBe(false);
  await page.keyboard.press('b');
  const inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  await expect(inventorySurface.locator('[data-inventory-tab="player"]')).toHaveAttribute('aria-selected', 'true');
  expect((await debugSnapshot(page)).flowOverlay).toBe('inventory');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
  await page.keyboard.press('b');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');

  await openFurnaceFromPause(page);
  await expect(inventorySurface.locator('.inv-furnace')).toBeVisible();
  await expect(inventorySurface.locator('[data-furnace-start="true"]')).toBeDisabled();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
  await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('settings');
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');

  await clearWorldDialogue(page);
  const beforeMapKey = await debugSnapshot(page);
  await page.keyboard.press('m');
  await page.waitForTimeout(80);
  expect((await debugSnapshot(page)).flowOverlay).toBe(beforeMapKey.flowOverlay ?? null);
  await commandBar.locator('#world-command-more > summary').click();
  expect(await commandBar.locator('#world-command-more').evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  await commandBar.locator('[data-game-command="map"]').click();
  expect(await commandBar.locator('#world-command-more').evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  const mapSurface = page.locator('[data-app-surface="map"]');
  await expect(mapSurface).toBeVisible();
  await expect(commandBar).toBeHidden();
  await expect(page.locator('#world-location-command-bar')).toBeHidden();
  await expect(mapSurface.locator('img[data-asset-id="map.location-network-v1"]')).toBeVisible();
  await expect(mapSurface.locator('[data-map-service-command="show-farm-work"]').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBeNull();
  expect(await commandBar.locator('#world-command-more').evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  await expect(commandBar).toBeVisible();
  await expect(page.locator('#world-location-command-bar')).toBeHidden();

  await commandBar.locator('#world-command-more > summary').click();
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

test('default product input ignores legacy action keys and keeps B/Escape as the inventory loop', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToWorld(page);
  await clearWorldDialogue(page);

  const before = await debugSnapshot(page);
  expect(before.legacyShortcutsEnabled).toBe(false);
  expect(before.flowOverlay).toBeNull();

  for (const key of ['1', 'Space', 'e', 'Tab', 'c', 'j', 'm', 'n', 'p', 'u', 'y', '[', ']']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(30);
  }

  const afterLegacyKeys = await debugSnapshot(page);
  expect(afterLegacyKeys.flowOverlay).toBeNull();
  expect(afterLegacyKeys.interactionPanelKind).toBe('none');
  expect(afterLegacyKeys.hotbarIdx).toBe(before.hotbarIdx);
  expect(afterLegacyKeys.frontTileTilled).toBe(before.frontTileTilled);

  await page.keyboard.press('b');
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('inventory');
  await page.keyboard.press('Escape');
  await expect(page.locator('canvas')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBeNull();
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
  await expect(actions).toContainText('开始游戏');
  await expect(actions).not.toContainText('开始翻地');
  await expect(panel).toHaveText('当前没有打开面板。');

  await continueToWorld(page);
  await expect(surface).toHaveText('当前页面：农庄世界。');
  await expect(objective).toContainText('面对空地翻出第一块灵田');
  await expect(actions).toContainText('开始翻地');
  await expect(actions).toContainText('点击目标移动或互动');

  await page.keyboard.press('b');
  await expect(surface).toHaveText('当前页面：物品管理。');
  await expect(objective).toHaveText('当前目标：整理随身行囊、农庄仓库与出货箱。');
  await expect(actions).toHaveText('当前可用动作：切换行囊/仓库/出货箱/丹炉；拖拽换位或转移；拆分/使用/丢弃；返回农庄。');
  await expect(panel).toHaveText('已打开面板：物品管理。');
  await expect(objective).not.toContainText('翻出第一块灵田');
  await page.keyboard.press('b');

  await openFurnaceFromPause(page);
  await expect(surface).toHaveText('当前页面：丹炉。');
  await expect(objective).toHaveText('当前目标：按丹方投影填入九宫药盘并开炉炼制。');
  await expect(actions).toContainText('自动入药');
  await expect(actions).toContainText('开炉炼制');
  await expect(panel).toHaveText('已打开面板：丹炉。');
  await expect(actions).not.toContainText('方向移动');
  await page.keyboard.press('Escape');

  await page.keyboard.press('Escape');
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
