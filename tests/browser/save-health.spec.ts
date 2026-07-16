import { expect, test } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { saveGame } from '@sim/serialize';
import { gameEntryPath } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';
const registry = buildRegistry();

function corruptNestedInventoryPayload(): string {
  const state = createWorld({ seed: 7, width: 4, height: 4, content: registry, params: DEFAULT_BALANCE });
  const save = saveGame(state, registry.schemaHash);
  const serialized = save.state as { player: { inventory: Record<string, unknown> } };
  serialized.player.inventory['item.corrupt'] = null;
  return JSON.stringify(save);
}

const invalidSaves = [
  { name: 'malformed JSON', payload: '{broken' },
  { name: 'an unsupported save format', payload: JSON.stringify({ formatVersion: 2, schemaHash: registry.schemaHash, state: {} }) },
  { name: 'an incompatible schema', payload: JSON.stringify({ formatVersion: 1, schemaHash: 'not-current', state: {} }) },
  {
    name: 'a deserialize failure',
    payload: JSON.stringify({ formatVersion: 1, gameVersion: '0.1.0', schemaHash: registry.schemaHash, createdAt: 0, state: 42 })
  },
  {
    name: 'a structurally incomplete state',
    payload: JSON.stringify({
      formatVersion: 1,
      gameVersion: '0.1.0',
      schemaHash: registry.schemaHash,
      createdAt: 0,
      state: {
        crops: [],
        arrays: [],
        facilities: [],
        player: { flags: [], inventory: {} },
        flags: [],
        rngSnapshot: {}
      }
    })
  },
  {
    name: 'a malformed nested inventory slot',
    payload: corruptNestedInventoryPayload()
  }
] as const;

for (const scenario of invalidSaves) {
  test(`${scenario.name} falls back visibly without enabling Continue`, async ({ page }) => {
    await page.addInitScript(({ key, value }: { key: string; value: string }) => window.localStorage.setItem(key, value), { key: SAVE_KEY, value: scenario.payload });
    await page.goto(gameEntryPath());

    await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
    await expect(page.locator('#flow-title-continue')).toBeDisabled();
    await expect(page.locator('#flow-title-save-notice')).toBeVisible();
    await expect(page.locator('#flow-title-save-notice')).toContainText('本地存档无法读取');

    await page.locator('#flow-title-settings').click();
    await expect(page.locator('#flow-settings-save-status')).toContainText('已回退到新旅程');
    await expect(page.locator('#flow-settings-save-status')).toContainText('旧数据尚未覆盖');
  });
}

test('an unavailable Storage reader keeps the app usable and reports the limitation', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
  });
  await page.goto(gameEntryPath());

  await expect(page.locator('[data-app-surface="title"]')).toBeVisible();
  await expect(page.locator('#flow-title-continue')).toBeDisabled();
  await expect(page.locator('#flow-title-save-notice')).toContainText('无法访问本地存储');
  await page.locator('#flow-title-settings').click();
  await expect(page.locator('#flow-settings-save-status')).toContainText('无法访问本地存储');
  await expect(page.locator('#flow-settings-save-status')).toContainText('仅在当前页面有效');
});

test('a successful first write is required before a fresh journey becomes continuable', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(gameEntryPath());

  const continueButton = page.locator('#flow-title-continue');
  await expect(continueButton).toBeDisabled();
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();

  await expect.poll(async () => page.evaluate(key => window.localStorage.getItem(key) !== null, SAVE_KEY)).toBe(true);
  await expect(continueButton).toBeEnabled();
});

test('a failed first write never claims safety in Pause, Settings, or the portrait gate', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    Storage.prototype.setItem = () => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    };
  });
  await page.goto(gameEntryPath());
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();

  await expect(page.locator('#flow-title-continue')).toBeDisabled();
  await page.locator('#world-command-bar [data-game-command="pause"]').click();
  await expect(page.locator('#flow-pause-save-status')).toContainText('当前进度未保存');
  await expect(page.locator('#flow-pause-save-status')).not.toContainText('已保留');

  await page.locator('[data-app-surface="pause"] [data-game-command="settings"]').click();
  await expect(page.locator('#flow-settings-save-status')).toContainText('最近一次写入失败');
  await expect(page.locator('#flow-settings-save-status')).toContainText('尚无可继续的本地存档');
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#orientation-gate')).toBeVisible();
  await expect(page.locator('#orientation-save-status')).toContainText('当前进度未保存');
  await expect(page.locator('#orientation-save-status')).not.toContainText('安全保留');
});

test('a later write failure keeps the previous snapshot continuable but marks current progress unsaved', async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(gameEntryPath());
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();

  const continueButton = page.locator('#flow-title-continue');
  await expect(continueButton).toBeEnabled();
  await page.evaluate(key => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (candidate: string, value: string): void {
      if (candidate === key) throw new DOMException('quota exceeded', 'QuotaExceededError');
      original.call(this, candidate, value);
    };
  }, SAVE_KEY);

  await page.locator('#world-command-bar [data-game-command="pause"]').click();
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  await expect(continueButton).toBeEnabled();
  await expect(page.locator('#flow-pause-save-status')).toContainText('关闭或刷新后将回到上次成功存档');
});
