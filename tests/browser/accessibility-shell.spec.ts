import { expect, test } from '@playwright/test';
import { gameEntryPath } from './openGame';

// 旧世界退役（docs/21 §8.16 阶段 2 第一步）：canvas 可访问名与炼丹引导链
// 两条用例经 enterLegacyWorld 才可达，随测试门退役（判定表见 docs/21 §8.21）；
// 标题键盘纪律用例不进旧世界，原样保留。

test('title semantics do not expose world-only keyboard instructions', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());

  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  await expect(page.locator('#game-instructions')).toHaveText('使用 Tab 浏览当前页面控件，Enter 或 Space 激活。');
  await expect(page.locator('#semantic-game-state')).not.toContainText('方向键或 WASD');
  await expect(page.locator('#semantic-game-state')).not.toContainText('空格或 E 执行当前操作');
});
