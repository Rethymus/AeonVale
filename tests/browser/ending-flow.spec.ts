import { expect, test } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { saveGame } from '@sim/serialize';
import { continueToLoadedWorld, gameEntryPath, waitForInitialSurface, type AeonDebugSnapshot } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';

function terminalSavePayload(): string {
  const registry = buildRegistry();
  const state = createWorld({ seed: 20260716, width: 14, height: 9, content: registry, params: DEFAULT_BALANCE });
  state.player.flags.add('narr-awaken');
  state.player.flags.add('narr-spirit-test');
  state.player.flags.add('narr-intro');
  state.gameOver = true;
  state.ending = 'poison-death';
  return JSON.stringify(saveGame(state, registry.schemaHash));
}

test('terminal saves enter the real Ending surface and remain explicit until a new journey starts', async ({ page }) => {
  const payload = terminalSavePayload();
  await page.addInitScript(({ key, value }: { key: string; value: string }) => window.localStorage.setItem(key, value), { key: SAVE_KEY, value: payload });

  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  // 终局存档经测试门入世界：入世界副作用 saveState 会触发 enterEndingIfNeeded。
  const entered = await page.evaluate(() => {
    const target = (window as typeof window & { __AEON_TEST__?: { enterLoadedLegacyWorld: () => boolean } }).__AEON_TEST__;
    return target ? target.enterLoadedLegacyWorld() : false;
  });
  expect(entered).toBe(true);

  await expect(page.locator('[data-app-surface="ending"]')).toBeVisible();
  await expect(page.locator('canvas')).toBeHidden();
  await expect(page.locator('[data-app-slot="ending"]')).toContainText('存档');
  await expect(page.locator('[data-app-slot="ending"] img[data-asset-id="cg.ending-poison-death"]')).toBeVisible();
  const endingColumnGap = await page.evaluate(() => {
    const media = document.querySelector('.ending-cg-frame')?.getBoundingClientRect();
    const copy = document.querySelector('.ending-copy')?.getBoundingClientRect();
    return media && copy ? Math.round(copy.left - media.right) : 0;
  });
  expect(endingColumnGap).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-ending-return');
  await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__))?.appSurface).toBe('ending');

  await page.locator('#flow-ending-return').click();
  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  expect(await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY)).toBe(payload);

  // 已读终局可反复进入（不清档）。
  await page.evaluate(() => {
    const target = (window as typeof window & { __AEON_TEST__?: { enterLoadedLegacyWorld: () => boolean } }).__AEON_TEST__;
    target?.enterLoadedLegacyWorld();
  });
  await expect(page.locator('[data-app-surface="ending"]')).toBeVisible();
  await page.locator('#flow-ending-return').click();

  // 新一段旅程（偷天换劫）不清除旧世界存档：终局留痕保留供回滚。
  await page.locator('#flow-title-new-game').click();
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible();
  expect(await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY)).toBe(payload);
});
