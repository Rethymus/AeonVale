/**
 * 无障碍回归门（docs/37）：axe-core 扫描修途主链七个关键面。
 * WCAG 2.0/2.1 A+AA 全规则；零违规断言——新违规=回归，修因不改门。
 * 采纳依据：docs/36→docs/37 调研（@axe-core/playwright，MPL-2.0）。
 */
import { expect, test, type Page } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import { gameEntryPath } from './openGame';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page, name: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map(v => `${v.id}(${v.impact}, ${v.nodes.length})`);
  expect(summary, `${name} 存在无障碍违规`).toEqual([]);
}

test('axe WCAG A/AA 扫描主链七面零违规', async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(gameEntryPath());
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
  await page.locator('.title-surface').waitFor();
  await scan(page, '标题屏');

  await page.locator('#flow-title-new-game').click();
  await page.locator('.cr-opening').waitFor();
  for (let i = 0; i < 5; i++) await page.locator('.cr-opening__button[data-primary="true"]').click();
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();
  await page.locator('.rp-planning').waitFor();
  await scan(page, '日程面');

  for (const activity of ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']) {
    const button = page.getByRole('button', { name: new RegExp(`^${activity}，[0-9]+ 日`) });
    await button.waitFor();
    await button.click();
  }
  await page.getByRole('button', { name: '结清本轮修途' }).click();
  const resolution = page.locator('.cr-resolution');
  await resolution.waitFor();
  await scan(page, '结算面');
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();
  const event = page.locator('.cr-event');
  await event.waitFor();
  await scan(page, '事件面');
  await event.locator('.cr-event__button[data-affordable="true"]').first().click();
  const insight = page.locator('.cr-insight');
  await insight.waitFor();
  await scan(page, '参悟面');
  await insight.locator('.cr-insight__continue').click();
  const timing = page.locator('.cr-tribulation-choice');
  await timing.waitFor();
  await scan(page, '引劫时机面');
  await timing.getByRole('button', { name: /现在引劫/ }).click();
  await page.locator('.rp-canvas').waitFor();
  await page.waitForTimeout(1000);
  await scan(page, '天劫棋盘面');
});
