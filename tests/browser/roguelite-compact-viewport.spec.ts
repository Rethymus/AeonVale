/**
 * D27 主路径 · 短横屏视口（compact-landscape）可用性回归。
 *
 * 背景：修途日程 DOM 界面的紧凑布局原先只按宽度断点（≤1120px 两栏 / ≤760px 堆叠）
 * 切换；约 820×430 这类"宽度走两栏、高度不够"的窗口会溢出裁切——状态面板统计被截半、
 * 活动选择区被压没，且反馈段会拦截活动按钮点击。现增加高度感知断点
 * （(max-width:1120px) and (max-height:620px) 复用堆叠布局），本文件锁定该行为：
 * 在短横屏下仍能完整排满日程、点击活动不被遮挡、进入天劫后棋盘与 HUD 可用。
 */
import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath } from './openGame';

const OPENING_TITLES = [
  '这个世界的雷，先落在凡人屋顶',
  '测灵石上，你的答案是零',
  '修行之前，先弄清一碗饭从哪里来',
  '仙人斗法时，凡人的田先碎了',
  '测得是零，不等于什么都没进来'
] as const;

async function dismissOrientationIfPresent(page: Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

async function finishFirstLifeOpening(page: Page): Promise<void> {
  for (const title of OPENING_TITLES) {
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
}

async function enterFirstAgenda(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: '沈砚' })).toBeVisible();
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await expect(page.getByRole('heading', { name: /破入练气 · 第 1 劫/ })).toBeVisible();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();
  await expect(page.getByRole('heading', { name: '劫前修途' })).toBeVisible();
}

async function fillAgenda(page: Page, activities: readonly string[]): Promise<void> {
  for (const activity of activities) {
    const button = page.getByRole('button', { name: new RegExp(`^${activity}，\\d+ 日`) });
    await expect(button).toBeVisible();
    await button.click();
  }
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
}

async function finishRoundStoryToTribulation(page: Page): Promise<void> {
  const resolution = page.locator('.cr-resolution');
  await expect(resolution).toBeVisible();
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();

  const event = page.locator('.cr-event');
  await expect(event).toBeVisible();
  const choice = event.locator('.cr-event__button[data-affordable="true"]').first();
  await expect(choice).toBeEnabled();
  await choice.click();

  const insight = page.locator('.cr-insight');
  await expect(insight).toBeVisible();
  await insight.locator('.cr-insight__continue').click();

  const timing = page.locator('.cr-tribulation-choice');
  await expect(timing).toBeVisible();
  await timing.getByRole('button', { name: /现在引劫/ }).click();
}

test.describe('D27 短横屏视口 · 修途与天劫可用', () => {
  test('820×430：排满日程无遮挡，状态面板不裁切，可进入天劫', async ({ page }) => {
    await page.setViewportSize({ width: 820, height: 430 });
    await page.goto(gameEntryPath());
    await expect(page.locator('.title-surface')).toBeVisible({ timeout: 20000 });
    await dismissOrientationIfPresent(page);
    await page.locator('#flow-title-new-game').click();
    await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible({ timeout: 8000 });

    await finishFirstLifeOpening(page);
    await enterFirstAgenda(page);

    // 状态面板统计（轮次/余寿/心压/凡心）必须完整落在面板内，不得被 overflow 裁切。
    const stats = page.locator('.rp-run-stats');
    await expect(stats).toBeVisible();
    const statsBox = await stats.boundingBox();
    const panelBox = await page.locator('.rp-status-panel').boundingBox();
    const viewport = page.viewportSize();
    expect(statsBox).not.toBeNull();
    expect(statsBox?.y).toBeGreaterThanOrEqual(0);
    expect((statsBox?.y ?? 0) + (statsBox?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);
    expect(panelBox).not.toBeNull();
    expect((statsBox?.y ?? 0) + (statsBox?.height ?? 0)).toBeLessThanOrEqual((panelBox?.y ?? 0) + (panelBox?.height ?? 0));

    // 活动按钮可点击（此前反馈段会拦截指针导致点击超时）。
    await fillAgenda(page, ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']);
    await expect(page.locator('.rp-plan-feedback')).toContainText('已写入');

    await page.getByRole('button', { name: '结清本轮修途' }).click();
    await finishRoundStoryToTribulation(page);

    const canvas = page.locator('.rp-canvas');
    await expect(canvas).toBeVisible();
    await expect(page.locator('#roguelite-proto-root .rp-hud')).toContainText(/余步 \d+ \/ \d+/);
    await expect(page.locator('#roguelite-proto-root .rp-hud')).toContainText(/护持 \d/);
  });

  test('1024×500：两栏死区同样回落堆叠布局，活动可点且统计完整', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 500 });
    await page.goto(gameEntryPath());
    await expect(page.locator('.title-surface')).toBeVisible({ timeout: 20000 });
    await dismissOrientationIfPresent(page);
    await page.locator('#flow-title-new-game').click();
    await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible({ timeout: 8000 });

    await finishFirstLifeOpening(page);
    await enterFirstAgenda(page);

    const stats = page.locator('.rp-run-stats');
    await expect(stats).toBeVisible();
    const statsBox = await stats.boundingBox();
    const viewport = page.viewportSize();
    expect((statsBox?.y ?? 0) + (statsBox?.height ?? 0)).toBeLessThanOrEqual(viewport?.height ?? 0);

    await fillAgenda(page, ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']);
    await expect(page.locator('.rp-plan-feedback')).toContainText('已写入');
  });
});
