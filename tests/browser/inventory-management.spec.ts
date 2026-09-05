import { expect, test, type Locator, type Page } from '@playwright/test';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE, placeGroundItem } from '@sim';
import { saveGame } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import { clearIntroDialogue, continueToLoadedWorld, gameDebugSnapshot, gameEntryPath, waitForInitialSurface } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';

interface PersistedInventoryState {
  player?: { inventory?: Record<string, { count?: number }> };
  storage?: { inventory?: Record<string, { count?: number }> };
  shippingBin?: Record<string, number>;
  groundItems?: Array<{ itemId?: string; count?: number; pos?: { x?: number; y?: number } }>;
  inventoryLayout?: {
    orders?: { player?: string[]; storage?: string[]; shipping?: string[] };
    view?: {
      activeTab?: string;
      pageByContainer?: { player?: number; storage?: number; shipping?: number };
      searchTerm?: string;
      sortKey?: string;
    };
  };
}

function buildInventoryManagementSave(): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260721, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till']) {
    state.player.flags.add(`narr-${beat}`);
  }

  state.player.inventoryCapacity = 120;
  const playerItems = [
    'seed.mossling',
    'seed.dewroot',
    'seed.suncap',
    'seed.frostmarrow',
    'seed.emberheart',
    'seed.metalpine',
    'seed.balmleaf',
    'herb.metalpine',
    'herb.frostmarrow',
    'item.rust-hoe',
    'item.water-pail',
    'item.sickle',
    'item.beast-core',
    'item.dried-herb',
    'item.sealed-herb',
    'item.herbal-wine'
  ];
  for (const itemId of playerItems) mutateItem(state.player, itemId, itemId === 'seed.mossling' ? 5 : 1);
  state.storage.inventory['item.spirit-compost'] = { itemId: 'item.spirit-compost', count: 2 };
  state.shippingBin['herb.mossling'] = 1;
  state.inventoryLayout.orders.player = playerItems;

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

function buildGroundPickupCapacitySave(options: { carriedItemId: string; carriedCount: number; groundItemId: string; groundCount: number; capacity: number }): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260722, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till']) {
    state.player.flags.add(`narr-${beat}`);
  }

  state.player.inventory = {};
  mutateItem(state.player, options.carriedItemId, options.carriedCount);
  state.player.inventoryCapacity = options.capacity;
  placeGroundItem(state, {
    itemId: options.groundItemId,
    count: options.groundCount,
    pos: { ...state.player.position }
  });

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

function buildStackTransferSave(options: { playerCount: number; storageCount: number; capacity: number }): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260723, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });

  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till']) {
    state.player.flags.add(`narr-${beat}`);
  }

  state.player.inventory = {};
  state.player.inventoryCapacity = options.capacity;
  mutateItem(state.player, 'item.spirit-stone', options.playerCount);
  state.storage.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: options.storageCount };
  state.inventoryLayout.orders.player = ['item.spirit-stone'];
  state.inventoryLayout.orders.storage = ['item.spirit-stone'];

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

async function installSave(page: Page, payload: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      const installedKey = '__aeonvale_inventory_management_save_installed__';
      if (window.sessionStorage.getItem(installedKey) === '1') return;
      window.localStorage.clear();
      window.localStorage.setItem(key, value);
      window.sessionStorage.setItem(installedKey, '1');
    },
    { key: SAVE_KEY, value: payload }
  );
}

async function html5Drag(page: Page, source: Locator, target: Locator): Promise<void> {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await dataTransfer.dispose();
}

async function persistedState(page: Page): Promise<PersistedInventoryState> {
  return page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw).state as PersistedInventoryState) : {};
  }, SAVE_KEY);
}

async function expectWorldSurfaceRestored(page: Page): Promise<void> {
  const worldSurface = page.locator('[data-app-surface="world"]');
  await expect(worldSurface).toBeVisible();
  await expect(worldSurface).toHaveAttribute('aria-hidden', 'false');
  await expect(worldSurface).not.toHaveAttribute('data-flow-backdrop', 'true');
  await expect.poll(async () => worldSurface.evaluate(element => (element as HTMLElement & { inert?: boolean }).inert === true)).toBe(false);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');
}

async function openInventoryOverlay(page: Page): Promise<Locator> {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await page.keyboard.press('b');
  const inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  return inventorySurface;
}

async function openWorldCommand(page: Page, command: string): Promise<void> {
  let target = page.locator(`#world-command-bar [data-game-command="${command}"]`);
  if (!(await target.isVisible().catch(() => false))) {
    await page.locator('#world-command-more > summary').click();
    target = page.locator(`#world-command-bar [data-game-command="${command}"]`);
  }
  await target.click();
}

test('short landscape full inventory keeps slots, item actions, and close control reachable', async ({ page }) => {
  await page.setViewportSize({ width: 736, height: 414 });
  await installSave(page, buildInventoryManagementSave());
  const inventorySurface = await openInventoryOverlay(page);
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();

  const content = inventorySurface.locator('[data-app-slot="inventory"]');
  const frame = inventorySurface.locator('.flow-frame-inventory');
  const close = inventorySurface.locator('#flow-inventory-close');
  await expect(content).toHaveAttribute('data-inventory-view-mode', 'full');
  await expect(close).toBeVisible();

  const frameBox = await frame.boundingBox();
  const closeBox = await close.boundingBox();
  expect(frameBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(frameBox!.height).toBeLessThanOrEqual(viewport!.height);
  expect(frameBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(closeBox!.y).toBeGreaterThanOrEqual(0);
  expect(closeBox!.y + closeBox!.height).toBeLessThanOrEqual(viewport!.height);

  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  const mosslingSlot = playerSection.locator('[data-inventory-slot-key="seed.mossling"]');
  await expect(mosslingSlot).toBeVisible();
  await mosslingSlot.click();
  await expect(inventorySurface.locator('.inv-name')).toBeVisible();

  const metrics = await content.evaluate(element => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await content.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  const split = inventorySurface.locator('button.inv-act', { hasText: '拆分数量' });
  await expect(split).toBeVisible();
  const splitBox = await split.boundingBox();
  expect(splitBox).not.toBeNull();
  expect(splitBox!.y).toBeGreaterThanOrEqual(0);
  expect(splitBox!.y + splitBox!.height).toBeLessThanOrEqual(viewport!.height);
  await expect(close).toBeVisible();
});

test('inventory overlay supports paging, drag transfer, split stack, and persisted slot changes', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  const inventorySurface = await openInventoryOverlay(page);

  await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'full');
  const worldSurface = page.locator('[data-app-surface="world"]');
  await expect(worldSurface).toBeVisible();
  await expect(worldSurface).toHaveAttribute('data-flow-backdrop', 'true');
  await expect
    .poll(async () =>
      inventorySurface.evaluate(element => {
        const style = getComputedStyle(element) as CSSStyleDeclaration & { readonly webkitBackdropFilter?: string };
        return style.backdropFilter || style.webkitBackdropFilter || '';
      })
    )
    .toContain('blur');
  await expect.poll(async () => worldSurface.evaluate(element => getComputedStyle(element).filter)).toContain('blur');
  await expect(inventorySurface.locator('#flow-inventory-close')).toBeVisible();
  const closeBox = await inventorySurface.locator('#flow-inventory-close').boundingBox();
  const frameBox = await inventorySurface.locator('.flow-frame-inventory').boundingBox();
  const viewport = page.viewportSize();
  expect(closeBox).not.toBeNull();
  expect(frameBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(closeBox!.y).toBeGreaterThanOrEqual(frameBox!.y);
  expect(closeBox!.y).toBeLessThan(frameBox!.y + 32);
  expect(closeBox!.x).toBeGreaterThan(frameBox!.x + frameBox!.width - 72);
  expect(frameBox!.height).toBeLessThanOrEqual(viewport!.height);
  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  const playerTab = inventorySurface.locator('[data-inventory-tab="player"]');
  const storageTab = inventorySurface.locator('[data-inventory-tab="storage"]');
  const furnaceTab = inventorySurface.locator('[data-inventory-tab="furnace"]');
  const storageGrid = inventorySurface.locator('[data-inventory-container="storage"]');

  await expect(playerTab).toHaveAttribute('aria-selected', 'true');
  await expect(inventorySurface.locator('[data-inventory-section="storage"]')).toHaveCount(0);
  await expect(inventorySurface.locator('[data-inventory-section="shipping"]')).toHaveCount(0);
  await expect(inventorySurface.locator('.inv-craft')).toHaveCount(0);
  await expect(playerSection.locator('.inv-page-text')).toHaveText('1/2');
  await expect(playerSection.locator('[data-inventory-slot-key="seed.mossling"]')).toBeVisible();
  await expect(playerSection.locator('.inv-grid [role="gridcell"]')).toHaveCount(12);
  await expect(playerSection.locator('[data-inventory-empty-slot]')).toHaveCount(0);
  await playerSection.locator('[data-inventory-page-next="player"]').click();
  await expect(playerSection.locator('.inv-page-text')).toHaveText('2/2');
  await expect(playerSection.locator('[data-inventory-slot-key]')).toHaveCount(4);
  await expect(playerSection.locator('[data-inventory-empty-slot]')).toHaveCount(8);
  await expect(playerSection.locator('.inv-grid [role="gridcell"]')).toHaveCount(12);
  await playerSection.locator('[data-inventory-page-prev="player"]').click();

  await furnaceTab.click();
  await expect(furnaceTab).toHaveAttribute('aria-selected', 'true');
  await expect(inventorySurface.locator('[data-inventory-section="player"]')).toHaveCount(0);
  const craftPanel = inventorySurface.locator('.inv-furnace');
  await expect(craftPanel.locator('[data-inventory-recipe-id="recipe.ward-pill"]')).toBeVisible();
  expect(await craftPanel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await craftPanel.locator('[data-inventory-recipe-id="recipe.ward-pill"]').click();
  await expect(craftPanel.locator('[data-craft-cell="0"]')).toContainText('雷击木');
  await expect(craftPanel.locator('[data-craft-cell="1"]')).toContainText('寒潭莲');
  await craftPanel.locator('[data-craft-autofill="true"]').click();
  await expect(craftPanel.locator('[data-craft-cell="0"] img.inv-icon')).toBeVisible();
  await expect(craftPanel.locator('[data-craft-cell="1"] img.inv-icon')).toBeVisible();
  await expect(craftPanel.locator('[data-craft-output="true"]')).toContainText('承雷丹');
  await expect(craftPanel.locator('[data-furnace-start="true"]')).toBeEnabled();
  await expect(craftPanel.locator('[data-furnace-preview="true"]')).toContainText('炉火 47%');
  await expect(craftPanel.locator('[data-furnace-output-meta="true"]')).toContainText('炉火 47%');
  const heatInput = craftPanel.locator('[data-furnace-heat="true"]');
  await heatInput.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '90';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(craftPanel.locator('[data-furnace-preview="true"]')).toContainText('炉火 90%');
  await expect(craftPanel.locator('[data-furnace-output-meta="true"]')).toContainText('炉火 90%');
  await expect(craftPanel.locator('[data-craft-output="true"]')).not.toContainText('炉火 47%');
  await heatInput.evaluate(element => {
    const input = element as HTMLInputElement;
    input.value = '47';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(craftPanel.locator('[data-furnace-output-meta="true"]')).toContainText('炉火 47%');
  await craftPanel.locator('[data-craft-cell="0"]').click();
  await expect(craftPanel.locator('[data-furnace-start="true"]')).toBeDisabled();
  await playerTab.click();
  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="herb.metalpine"]'), furnaceTab);
  await expect(craftPanel.locator('[data-furnace-start="true"]')).toBeEnabled();
  await craftPanel.locator('[data-furnace-start="true"]').click();
  await expect(inventorySurface).toBeVisible();
  let saved = await persistedState(page);
  expect(saved.player?.inventory?.['pill.ward-basic']?.count).toBe(1);
  expect(saved.player?.inventory?.['herb.metalpine']).toBeUndefined();
  expect(saved.player?.inventory?.['herb.frostmarrow']).toBeUndefined();
  await playerTab.click();

  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="seed.dewroot"]'), playerSection.locator('[data-inventory-slot-key="seed.mossling"]'));
  saved = await persistedState(page);
  expect(saved.inventoryLayout?.orders?.player?.slice(0, 2)).toEqual(['seed.dewroot', 'seed.mossling']);

  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="seed.mossling"]'), storageTab);
  await expect(storageTab).toHaveAttribute('aria-selected', 'true');
  await expect(storageGrid.locator('[data-inventory-slot-key="seed.mossling"]')).toBeVisible();

  saved = await persistedState(page);
  expect(saved.player?.inventory?.['seed.mossling']).toBeUndefined();
  expect(saved.storage?.inventory?.['seed.mossling']?.count).toBe(5);

  await storageGrid.locator('[data-inventory-slot-key="seed.mossling"]').click();
  await inventorySurface.locator('button.inv-act', { hasText: '拆分数量' }).click();
  await expect(inventorySurface.locator('.inv-qty-input')).toHaveValue('2');
  await inventorySurface.locator('.inv-dropdialog button', { hasText: '移至行囊' }).click();

  saved = await persistedState(page);
  expect(saved.player?.inventory?.['seed.mossling']?.count).toBe(2);
  expect(saved.storage?.inventory?.['seed.mossling']?.count).toBe(3);

  await inventorySurface.locator('#flow-inventory-close').click();
  await expect(inventorySurface).toBeHidden();
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('b');
  await expect(inventorySurface).toBeVisible();
  await page.keyboard.press('b');
  await expect(inventorySurface).toBeHidden();
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('b');
  await expect(inventorySurface).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inventorySurface).toBeHidden();
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);
});

test('inventory overlay drag matrix moves one item across player, storage, shipping, and back', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  const inventorySurface = await openInventoryOverlay(page);

  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  const playerTab = inventorySurface.locator('[data-inventory-tab="player"]');
  const storageTab = inventorySurface.locator('[data-inventory-tab="storage"]');
  const shippingTab = inventorySurface.locator('[data-inventory-tab="shipping"]');
  const storageGrid = inventorySurface.locator('[data-inventory-container="storage"]');
  const shippingGrid = inventorySurface.locator('[data-inventory-container="shipping"]');

  await playerSection.locator('[data-inventory-page-next="player"]').click();
  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="item.dried-herb"]'), storageTab);
  let saved = await persistedState(page);
  expect(saved.player?.inventory?.['item.dried-herb']).toBeUndefined();
  expect(saved.storage?.inventory?.['item.dried-herb']?.count).toBe(1);

  await html5Drag(page, storageGrid.locator('[data-inventory-slot-key="item.dried-herb"]'), shippingTab);
  saved = await persistedState(page);
  expect(saved.storage?.inventory?.['item.dried-herb']).toBeUndefined();
  expect(saved.shippingBin?.['item.dried-herb']).toBe(1);

  await html5Drag(page, shippingGrid.locator('[data-inventory-slot-key="item.dried-herb"]'), storageTab);
  saved = await persistedState(page);
  expect(saved.shippingBin?.['item.dried-herb']).toBeUndefined();
  expect(saved.storage?.inventory?.['item.dried-herb']?.count).toBe(1);

  await html5Drag(page, storageGrid.locator('[data-inventory-slot-key="item.dried-herb"]'), playerTab);
  saved = await persistedState(page);
  expect(saved.shippingBin?.['item.dried-herb']).toBeUndefined();
  expect(saved.player?.inventory?.['item.dried-herb']?.count).toBe(1);

  await inventorySurface.locator('.inv-search').fill('锈锄');
  await expect(playerSection.locator('[data-inventory-slot-key="item.rust-hoe"]')).toBeVisible();
  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="item.rust-hoe"]'), shippingTab);
  saved = await persistedState(page);
  expect(saved.player?.inventory?.['item.rust-hoe']?.count).toBe(1);
  expect(saved.shippingBin?.['item.rust-hoe']).toBeUndefined();
});

test('dropping from inventory creates a persisted scene pickup that returns to the bag', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  const inventorySurface = await openInventoryOverlay(page);
  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  const before = await gameDebugSnapshot(page);
  const playerX = before.playerX;
  const playerY = before.playerY;
  if (playerX == null || playerY == null) throw new Error('Missing player position in debug snapshot');

  const itemId = 'item.sealed-herb';
  let saved = await persistedState(page);
  expect(saved.player?.inventory?.[itemId]?.count).toBe(1);

  await playerSection.locator('[data-inventory-page-next="player"]').click();
  await playerSection.locator(`[data-inventory-slot-key="${itemId}"]`).click();
  await expect(inventorySurface.locator('.inv-name')).toHaveText('封藏灵草');
  await inventorySurface.locator('button.inv-act-drop', { hasText: '丢弃全部' }).click();

  saved = await persistedState(page);
  expect(saved.player?.inventory?.[itemId]).toBeUndefined();
  expect(saved.groundItems?.find(item => item.itemId === itemId)).toMatchObject({
    itemId,
    count: 1,
    pos: { x: playerX, y: playerY }
  });

  await inventorySurface.locator('#flow-inventory-close').click();
  await expect(inventorySurface).toBeHidden();
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('Enter');
  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        bagCount: current.player?.inventory?.[itemId]?.count ?? 0,
        groundCount: current.groundItems?.filter(item => item.itemId === itemId).length ?? 0
      };
    })
    .toEqual({ bagCount: 1, groundCount: 0 });
});

test('ground pickup keeps loot in scene when a full bag cannot open a new slot', async ({ page }) => {
  const itemId = 'item.beast-core';
  await installSave(
    page,
    buildGroundPickupCapacitySave({
      carriedItemId: 'item.spirit-stone',
      carriedCount: 1,
      groundItemId: itemId,
      groundCount: 2,
      capacity: 1
    })
  );
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('Enter');

  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        bagCount: current.player?.inventory?.[itemId]?.count ?? 0,
        groundCount: current.groundItems?.find(item => item.itemId === itemId)?.count ?? 0
      };
    })
    .toEqual({ bagCount: 0, groundCount: 2 });
});

test('ground pickup only fills available stack room when the bag is full', async ({ page }) => {
  const itemId = 'item.spirit-stone';
  await installSave(
    page,
    buildGroundPickupCapacitySave({
      carriedItemId: itemId,
      carriedCount: 49,
      groundItemId: itemId,
      groundCount: 3,
      capacity: 1
    })
  );
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('Enter');

  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        bagCount: current.player?.inventory?.[itemId]?.count ?? 0,
        groundCount: current.groundItems?.find(item => item.itemId === itemId)?.count ?? 0
      };
    })
    .toEqual({ bagCount: 50, groundCount: 2 });
});

test('ground pickup keeps same-item loot in scene when the existing stack is full', async ({ page }) => {
  const itemId = 'item.spirit-stone';
  await installSave(
    page,
    buildGroundPickupCapacitySave({
      carriedItemId: itemId,
      carriedCount: 50,
      groundItemId: itemId,
      groundCount: 3,
      capacity: 1
    })
  );
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await expectWorldSurfaceRestored(page);

  await page.keyboard.press('Enter');

  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        bagCount: current.player?.inventory?.[itemId]?.count ?? 0,
        groundCount: current.groundItems?.find(item => item.itemId === itemId)?.count ?? 0
      };
    })
    .toEqual({ bagCount: 50, groundCount: 3 });
});

test('inventory drag only fills available stack room in a full bag', async ({ page }) => {
  await installSave(page, buildStackTransferSave({ playerCount: 49, storageCount: 3, capacity: 1 }));
  const inventorySurface = await openInventoryOverlay(page);
  const playerTab = inventorySurface.locator('[data-inventory-tab="player"]');
  const storageTab = inventorySurface.locator('[data-inventory-tab="storage"]');

  await storageTab.click();
  await html5Drag(page, inventorySurface.locator('[data-inventory-container="storage"] [data-inventory-slot-key="item.spirit-stone"]'), playerTab);

  await expect(playerTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        playerCount: current.player?.inventory?.['item.spirit-stone']?.count ?? 0,
        storageCount: current.storage?.inventory?.['item.spirit-stone']?.count ?? 0
      };
    })
    .toEqual({ playerCount: 50, storageCount: 2 });
});

test('inventory drag keeps source unchanged when the target stack is full', async ({ page }) => {
  await installSave(page, buildStackTransferSave({ playerCount: 50, storageCount: 3, capacity: 1 }));
  const inventorySurface = await openInventoryOverlay(page);
  const playerTab = inventorySurface.locator('[data-inventory-tab="player"]');
  const storageTab = inventorySurface.locator('[data-inventory-tab="storage"]');

  await storageTab.click();
  await html5Drag(page, inventorySurface.locator('[data-inventory-container="storage"] [data-inventory-slot-key="item.spirit-stone"]'), playerTab);

  await expect(storageTab).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(async () => {
      const current = await persistedState(page);
      return {
        playerCount: current.player?.inventory?.['item.spirit-stone']?.count ?? 0,
        storageCount: current.storage?.inventory?.['item.spirit-stone']?.count ?? 0
      };
    })
    .toEqual({ playerCount: 50, storageCount: 3 });
});

test('inventory slot order survives reload and restores the visible grid order', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  let inventorySurface = await openInventoryOverlay(page);
  let playerSection = inventorySurface.locator('[data-inventory-section="player"]');

  const firstSlot = playerSection.locator('[data-inventory-slot-key="seed.mossling"]');
  await html5Drag(page, firstSlot, firstSlot);
  let saved = await persistedState(page);
  expect(saved.inventoryLayout?.orders?.player?.slice(0, 2)).toEqual(['seed.mossling', 'seed.dewroot']);

  await html5Drag(page, playerSection.locator('[data-inventory-slot-key="seed.dewroot"]'), playerSection.locator('[data-inventory-slot-key="seed.mossling"]'));
  saved = await persistedState(page);
  expect(saved.inventoryLayout?.orders?.player?.slice(0, 2)).toEqual(['seed.dewroot', 'seed.mossling']);

  await page.reload();
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await page.keyboard.press('b');
  inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  playerSection = inventorySurface.locator('[data-inventory-section="player"]');

  const visibleKeys = await playerSection.locator('.inv-slot').evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.inventorySlotKey));
  expect(visibleKeys.slice(0, 2)).toEqual(['seed.dewroot', 'seed.mossling']);
  saved = await persistedState(page);
  expect(saved.inventoryLayout?.orders?.player?.slice(0, 2)).toEqual(['seed.dewroot', 'seed.mossling']);
});

test('inventory page, search, and sort preferences survive reload', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  let inventorySurface = await openInventoryOverlay(page);
  let playerSection = inventorySurface.locator('[data-inventory-section="player"]');

  await playerSection.locator('[data-inventory-page-next="player"]').click();
  await expect(playerSection.locator('.inv-page-text')).toHaveText('2/2');
  await inventorySurface.locator('.inv-sort').selectOption('count');
  await expect(inventorySurface.locator('.inv-sort')).toHaveValue('count');
  await expect
    .poll(async () => {
      const view = (await persistedState(page)).inventoryLayout?.view;
      return {
        activeTab: view?.activeTab ?? null,
        playerPage: view?.pageByContainer?.player ?? null,
        searchTerm: view?.searchTerm ?? null,
        sortKey: view?.sortKey ?? null
      };
    })
    .toEqual({ activeTab: 'player', playerPage: 1, searchTerm: '', sortKey: 'count' });

  await page.reload();
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await page.keyboard.press('b');
  inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  await expect(inventorySurface.locator('[data-inventory-tab="player"]')).toHaveAttribute('aria-selected', 'true');
  await expect(playerSection.locator('.inv-page-text')).toHaveText('2/2');
  await expect(inventorySurface.locator('.inv-sort')).toHaveValue('count');

  await inventorySurface.locator('.inv-search').fill('灵草药酒');
  await expect(playerSection.locator('.inv-page-text')).toHaveText('1/1');
  await expect(playerSection.locator('[data-inventory-slot-key="item.herbal-wine"]')).toBeVisible();
  await expect
    .poll(async () => {
      const view = (await persistedState(page)).inventoryLayout?.view;
      return {
        activeTab: view?.activeTab ?? null,
        playerPage: view?.pageByContainer?.player ?? null,
        searchTerm: view?.searchTerm ?? null,
        sortKey: view?.sortKey ?? null
      };
    })
    .toEqual({ activeTab: 'player', playerPage: null, searchTerm: '灵草药酒', sortKey: 'count' });

  await page.reload();
  await waitForInitialSurface(page);
  await continueToLoadedWorld(page);
  await clearIntroDialogue(page);
  await page.keyboard.press('b');
  inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  playerSection = inventorySurface.locator('[data-inventory-section="player"]');
  await expect(inventorySurface.locator('.inv-search')).toHaveValue('灵草药酒');
  await expect(inventorySurface.locator('.inv-sort')).toHaveValue('count');
  await expect(playerSection.locator('.inv-page-text')).toHaveText('1/1');
  await expect(playerSection.locator('[data-inventory-slot-key="item.herbal-wine"]')).toBeVisible();
});

test('furnace focus does not overwrite full inventory preferences', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  let inventorySurface = await openInventoryOverlay(page);
  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');

  await inventorySurface.locator('.inv-sort').selectOption('count');
  await inventorySurface.locator('.inv-search').fill('灵草药酒');
  await expect(playerSection.locator('[data-inventory-slot-key="item.herbal-wine"]')).toBeVisible();
  await expect
    .poll(async () => {
      const view = (await persistedState(page)).inventoryLayout?.view;
      return { activeTab: view?.activeTab ?? null, searchTerm: view?.searchTerm ?? null, sortKey: view?.sortKey ?? null };
    })
    .toEqual({ activeTab: 'player', searchTerm: '灵草药酒', sortKey: 'count' });

  await page.keyboard.press('b');
  await expectWorldSurfaceRestored(page);
  await openWorldCommand(page, 'furnace');
  inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  await expect(inventorySurface.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(async () => {
      const view = (await persistedState(page)).inventoryLayout?.view;
      return { activeTab: view?.activeTab ?? null, searchTerm: view?.searchTerm ?? null, sortKey: view?.sortKey ?? null };
    })
    .toEqual({ activeTab: 'player', searchTerm: '灵草药酒', sortKey: 'count' });

  await page.keyboard.press('Escape');
  await expectWorldSurfaceRestored(page);
  await page.keyboard.press('b');
  inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'full');
  await expect(inventorySurface.locator('[data-inventory-tab="player"]')).toHaveAttribute('aria-selected', 'true');
  await expect(inventorySurface.locator('.inv-search')).toHaveValue('灵草药酒');
  await expect(inventorySurface.locator('.inv-sort')).toHaveValue('count');
  await expect(inventorySurface.locator('[data-inventory-slot-key="item.herbal-wine"]')).toBeVisible();
});

test('inventory overlay keyboard focus reaches generated inventory controls', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  await openInventoryOverlay(page);

  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
  await page.keyboard.press('Shift+Tab');

  const dynamicFocus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      className: typeof element?.className === 'string' ? element.className : '',
      id: element?.id ?? '',
      inInventory: Boolean(element?.closest('[data-app-surface="inventory"]')),
      tagName: element?.tagName ?? ''
    };
  });
  expect(dynamicFocus.inInventory).toBe(true);
  expect(dynamicFocus.id).not.toBe('flow-inventory-close');
  expect(dynamicFocus.tagName).toBe('BUTTON');
  expect(dynamicFocus.className).toContain('inv-slot');

  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('flow-inventory-close');
});

test('inventory search filters item slots and resets pagination to the first matching page', async ({ page }) => {
  await installSave(page, buildInventoryManagementSave());
  const inventorySurface = await openInventoryOverlay(page);
  const playerSection = inventorySurface.locator('[data-inventory-section="player"]');

  await expect(playerSection.locator('.inv-page-text')).toHaveText('1/2');
  await playerSection.locator('[data-inventory-page-next="player"]').click();
  await expect(playerSection.locator('.inv-page-text')).toHaveText('2/2');

  await inventorySurface.locator('.inv-search').fill('灵草药酒');
  await expect(playerSection.locator('.inv-page-text')).toHaveText('1/1');
  await expect(playerSection.locator('[data-inventory-slot-key="item.herbal-wine"]')).toBeVisible();
  await expect(playerSection.locator('[data-inventory-slot-key="seed.mossling"]')).toHaveCount(0);

  await inventorySurface.locator('.inv-search').fill('不存在物品');
  await expect(playerSection.locator('.inv-container-empty')).toHaveText('没有匹配物品');
});
