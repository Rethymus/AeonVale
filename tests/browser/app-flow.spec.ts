import { expect, test } from '@playwright/test';
import { gameEntryPath, waitForInitialSurface } from './openGame';

// 旧世界退役（docs/21 §8.16 阶段 2 第一步）：enterLegacyWorld 测试门与
// start-new-game→prologue→world 接线已拆除，本文件只保留玩家真实可达表面
// （标题 / roguelite / boot 恢复）的现行语义用例；旧世界命令栏、产品键位
// 兼容矩阵与读屏旅程段随测试门一并退役（判定表见 docs/21 §8.21）。

test('title leads to the roguelite opening', async ({ page }) => {
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
});

test('title settings close with Escape and restore their trigger focus', async ({ page }) => {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);

  const settingsTrigger = page.locator('#flow-title-settings');
  await settingsTrigger.click();
  await expect(page.locator('[data-app-surface="settings"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-settings-close');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-title-settings');
});

test('screen-reader semantics on the title screen do not leak world-only instructions', async ({ page }) => {
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

  await page.locator('#flow-title-settings').click();
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
