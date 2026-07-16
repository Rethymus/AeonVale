import { expect, test } from '@playwright/test';
import { gameEntryPath } from './openGame';

const SETTINGS_KEY = 'aeonvale-settings-v1';
const SAVE_KEY = 'aeonvale-save-v1';

test('runtime settings use native controls and survive reload through their independent key', async ({ page }) => {
  await page.goto(gameEntryPath());
  await page.locator('#flow-title-settings').click();

  const volume = page.locator('#flow-settings-master-volume');
  const output = page.locator('#flow-settings-volume-output');
  const reducedMotion = page.locator('#flow-settings-reduced-motion');
  await expect(volume).toHaveAccessibleName('主音量');
  await expect(volume).toHaveValue('35');
  await expect(output).toHaveText('35%');
  await expect(reducedMotion).toHaveAccessibleName('减少动态效果');
  await expect(reducedMotion).not.toBeChecked();
  await expect(page.locator('#flow-settings-runtime-persistence-status')).toContainText('保存在此浏览器');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');

  await volume.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '72';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await reducedMotion.check();

  await expect(output).toHaveText('72%');
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  expect(await page.evaluate(key => JSON.parse(window.localStorage.getItem(key) ?? 'null'), SETTINGS_KEY)).toEqual({ masterVolume: 72, reducedMotion: true });
  expect(await page.evaluate(key => window.localStorage.getItem(key), SAVE_KEY)).toBeNull();

  await page.reload();
  await expect(page.locator('#flow-title-settings')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await page.locator('#flow-title-settings').click();
  await expect(volume).toHaveValue('72');
  await expect(output).toHaveText('72%');
  await expect(reducedMotion).toBeChecked();
});

test('settings Storage failures remain session-only without degrading game-save health', async ({ page }) => {
  await page.addInitScript(settingsKey => {
    const originalGetItem = Storage.prototype.getItem;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key: string): string | null {
      if (key === settingsKey) throw new DOMException('settings read blocked', 'SecurityError');
      return originalGetItem.call(this, key);
    };
    Storage.prototype.setItem = function (key: string, value: string): void {
      if (key === settingsKey) throw new DOMException('settings write blocked', 'QuotaExceededError');
      originalSetItem.call(this, key, value);
    };
  }, SETTINGS_KEY);
  await page.goto(gameEntryPath());
  await page.locator('#flow-title-settings').click();

  const volume = page.locator('#flow-settings-master-volume');
  const reducedMotion = page.locator('#flow-settings-reduced-motion');
  await expect(page.locator('#flow-settings-runtime-persistence-status')).toContainText('仅在当前会话有效');
  await expect(page.locator('#flow-settings-save-status')).toContainText('尚无本地存档');
  await expect(page.locator('#flow-settings-save-status')).not.toContainText('无法访问本地存储');

  await volume.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '58';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await reducedMotion.check();
  await expect(volume).toHaveValue('58');
  await expect(reducedMotion).toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await expect(page.locator('#flow-settings-runtime-persistence-status')).toContainText('仅在当前会话有效');

  await page.reload();
  await page.locator('#flow-title-settings').click();
  await expect(volume).toHaveValue('35');
  await expect(reducedMotion).not.toBeChecked();
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');
});
