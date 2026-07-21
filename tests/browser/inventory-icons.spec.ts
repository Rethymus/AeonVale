import { expect, test } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { saveGame } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import { clearIntroDialogue, continueToWorld, gameEntryPath, waitForInitialSurface } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';

function buildInventoryIconSave(): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260720, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till']) {
    state.player.flags.add(`narr-${beat}`);
  }

  state.player.inventoryCapacity = 120;
  mutateItem(state.player, 'item.herbal-wine', 1);
  mutateItem(state.player, 'item.spirit-poultice', 1);
  mutateItem(state.player, 'item.sealed-herb', 1);
  mutateItem(state.player, 'seed.mossling', 2);
  mutateItem(state.player, 'pill.ward-basic', 1);

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

test('inventory overlay loads manifest-backed card icons for current items', async ({ page }) => {
  const payload = buildInventoryIconSave();
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: payload }
  );

  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToWorld(page);
  await clearIntroDialogue(page);
  await page.keyboard.press('b');

  const inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();

  const requiredIconFiles = [
    'inventory-icon.item.herbal-wine-v1.png',
    'inventory-icon.item.spirit-poultice-v1.png',
    'inventory-icon.item.sealed-herb-v1.png',
    'inventory-icon.seed.mossling-v1.png',
    'inventory-icon.pill.ward-basic-v1.png'
  ];

  for (const file of requiredIconFiles) {
    await expect.poll(
      async () =>
        page.evaluate(requiredFile => {
          const icons = [...document.querySelectorAll<HTMLImageElement>('[data-app-surface="inventory"] img.inv-icon')];
          const icon = icons.find(img => img.currentSrc.includes(requiredFile) || img.src.includes(requiredFile));
          return Boolean(icon && icon.complete && icon.naturalWidth > 0 && icon.naturalHeight > 0);
        }, file),
      { message: `${file} should load in the inventory overlay` }
    ).toBe(true);
  }
});
