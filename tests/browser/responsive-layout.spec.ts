import { expect, test } from '@playwright/test';
import { gameEntryPath } from './openGame';

// 旧世界退役（docs/21 §8.16 阶段 2 第一步）：桌面铺满 / 同向 resize / 世界
// HUD 间距 / 丹炉布局四条用例全部经 continueToWorld 进旧世界，随测试门退役
// （判定表见 docs/21 §8.21）；新模式布局由 roguelite-compact-viewport 覆盖。
// 竖屏 orientation gate 是共享外壳语义且不进世界，原样保留。

async function openResponsiveGame(page: import('@playwright/test').Page): Promise<void> {
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('canvas')?.width === 960);
}

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
