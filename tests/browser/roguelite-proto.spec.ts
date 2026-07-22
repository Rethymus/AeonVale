/**
 * D27 主路径 · 浏览器 smoke。
 *
 * 棋盘程序化生成（布局随种子变），故只 smoke：开始游戏 → 两轮六格日程 →
 * 逐格结算 → 事件 → 参悟 → 天劫画板 + HUD + D-pad + 键盘输入。
 * 可解性由单测（isSolvable 跨 stage/seed）覆盖，此处不锁定具体解法。
 */
import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath } from './openGame';

async function dismissOrientationIfPresent(page: Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

async function fillAgenda(page: Page, activities: readonly string[]): Promise<void> {
  for (const activity of activities) {
    const button = page.getByRole('button', { name: new RegExp(`^${activity}，\\d+ 日`) });
    await expect(button).toBeVisible();
    await button.click();
  }
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
  for (const activity of activities) {
    await expect(page.locator('.rp-agenda-slot', { hasText: activity })).not.toHaveCount(0);
  }
}

const OPENING_TITLES = [
  '没有系统，也没有人来救你',
  '测不出的灵根，先学看水往哪里走',
  '仙人斗法时，凡人的田先碎了',
  '以劫为薪，以骨为柴'
] as const;

async function finishFirstLifeOpening(page: Page, startAt = 0): Promise<void> {
  for (let beat = startAt; beat < OPENING_TITLES.length; beat += 1) {
    await expect(page.getByRole('heading', { name: OPENING_TITLES[beat] })).toBeVisible();
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
}

async function enterFirstAgenda(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: '沈砚' })).toBeVisible();
  await page.getByRole('button', { name: '翻开今世日课' }).click();
  await expect(page.getByRole('heading', { name: /第 1 劫 · 察漏/ })).toBeVisible();
  await page.getByRole('button', { name: '记下劫兆，安排日课' }).click();
}

async function finishRoundStory(page: Page, destination: 'planning' | 'tribulation'): Promise<void> {
  const resolution = page.locator('.cr-resolution');
  await expect(resolution).toBeVisible();
  await expect(resolution.locator('.cr-resolution__slots')).toBeVisible();
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();

  const event = page.locator('.cr-event');
  await expect(event).toBeVisible();
  const choice = event.locator('.cr-event__button[data-affordable="true"]').first();
  await expect(choice).toBeVisible();
  await expect(choice).toBeEnabled();
  await choice.click();

  const insight = page.locator('.cr-insight');
  await expect(insight).toBeVisible();
  await expect(insight.locator('.cr-insight__node-button')).toHaveCount(7);
  const continueButton = insight.locator('.cr-insight__continue');
  await expect(continueButton).toHaveText(/，查看劫兆$/);
  await continueButton.click();

  const timing = page.locator('.cr-tribulation-choice');
  await expect(timing).toBeVisible();
  await timing.getByRole('button', { name: destination === 'planning' ? /再备一轮/ : /现在引劫/ }).click();
}

test.describe('D27 日程→事件→参悟→天劫主路径 · smoke', () => {
  test('开始游戏→完成两轮完整日课链→进入天劫→HUD/D-pad/键盘可用', async ({ page }) => {
    await page.goto(gameEntryPath());
    await expect
      .poll(
        async () =>
          page
            .locator('.title-surface')
            .isVisible()
            .catch(() => false),
        { timeout: 20000 }
      )
      .toBe(true);
    await dismissOrientationIfPresent(page);

    const entryBtn = page.locator('#flow-title-new-game');
    await expect(entryBtn).toBeVisible({ timeout: 10000 });
    await entryBtn.click();

    await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible({ timeout: 8000 });
    await finishFirstLifeOpening(page);
    await enterFirstAgenda(page);
    await expect(page.getByRole('heading', { name: '一世日课' })).toBeVisible();
    await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
    await expect(page.locator('.rp-activity-btn')).toHaveCount(6);

    await fillAgenda(page, ['灵田', '炼丹', '谋生', '参悟', '苦练', '歇息']);
    await page.getByRole('button', { name: '结清本轮日课' }).click();
    await finishRoundStory(page, 'planning');
    await expect(page.locator('.rp-round-seal')).toContainText('第 2 轮');

    await fillAgenda(page, ['灵田', '灵田', '炼丹', '苦练', '歇息', '参悟']);
    await page.getByRole('button', { name: '结清本轮并引劫' }).click();
    await finishRoundStory(page, 'tribulation');

    const canvas = page.locator('.rp-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#roguelite-proto-root .rp-help')).toContainText('金阵石');
    await expect(page.locator('#roguelite-proto-root .rp-hud')).toContainText(/预见 \d/);
    await expect(page.locator('#roguelite-proto-root .rp-hud')).toContainText(/护持 [1-9]/);
    const dpad = page.locator('.rp-dpad');
    await expect(dpad).toBeVisible();
    await expect(dpad.getByRole('button')).toHaveCount(4);
    await dpad.getByRole('button', { name: '向上' }).click();

    await canvas.click();
    for (const k of ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft']) await page.keyboard.press(k);

    await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
    await expect(page.locator('#roguelite-proto-root .rp-hud')).toContainText(/步数 \d+\/\d+/);
  });

  test('继续旅程恢复同一入世录与日程草稿，不回到旧世界模式', async ({ page }) => {
    await page.goto(gameEntryPath());
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await dismissOrientationIfPresent(page);
    await page.locator('#flow-title-new-game').click();

    await expect(page.getByRole('heading', { name: OPENING_TITLES[0] })).toBeVisible();
    await page.locator('.cr-opening__button[data-primary="true"]').click();
    await expect(page.getByRole('heading', { name: OPENING_TITLES[1] })).toBeVisible();

    await page.reload();
    await dismissOrientationIfPresent(page);
    const continueButton = page.locator('#flow-title-continue');
    await expect(continueButton).toBeVisible();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
    await expect(page.getByRole('heading', { name: OPENING_TITLES[1] })).toBeVisible();
    await expect(page.locator('[data-app-surface="world"]')).toBeHidden();

    await finishFirstLifeOpening(page, 1);
    await enterFirstAgenda(page);
    await page.getByRole('button', { name: /^灵田，/ }).click();
    await expect(page.locator('.rp-agenda-slot').first()).toContainText('灵田');

    await page.reload();
    await dismissOrientationIfPresent(page);
    await page.locator('#flow-title-continue').click();
    await expect(page.locator('.rp-planning')).toBeVisible();
    await expect(page.locator('.rp-agenda-slot').first()).toContainText('灵田');
    await expect(page.locator('.rp-agenda-meta')).toContainText('已排 1/6');
    await expect(page.locator('[data-app-surface="world"]')).toBeHidden();
  });
});
