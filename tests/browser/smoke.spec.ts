import { expect, test, type Page } from '@playwright/test';
import { canvasPaintStats, clearIntroDialogue, gameDebugSnapshot, openGame, type AeonDebugSnapshot } from './openGame';

type DebugPredicate = (debug: AeonDebugSnapshot) => boolean;

async function focusGame(page: Page): Promise<void> {
 await page.evaluate(() => {
 const canvas = document.querySelector('canvas');
 if (canvas instanceof HTMLElement) canvas.focus();
 });
}

async function waitForDebugState(
 page: Page,
 label: string,
 predicate: DebugPredicate,
 timeoutMs = 8_000,
): Promise<AeonDebugSnapshot> {
 const deadline = Date.now() + timeoutMs;
 let actual = await gameDebugSnapshot(page);
 while (Date.now() < deadline) {
 if (predicate(actual)) return actual;
 await page.waitForTimeout(50);
 actual = await gameDebugSnapshot(page);
 }
 if (predicate(actual)) return actual;
 throw new Error(`Timed out waiting for ${label}; actual debug state: ${JSON.stringify(actual)}`);
}

async function pressUntilDebugState(
 page: Page,
 key: string,
 label: string,
 predicate: DebugPredicate,
 options: { attempts?: number; timeoutMs?: number } = {},
): Promise<AeonDebugSnapshot> {
 const attempts = options.attempts ?? 3;
 const timeoutMs = options.timeoutMs ?? 2_500;
 let lastError: unknown;
 for (let attempt = 0; attempt < attempts; attempt += 1) {
 const beforePress = await gameDebugSnapshot(page);
 if (predicate(beforePress)) return beforePress;
 await clearIntroDialogue(page);
 await focusGame(page);
 await page.keyboard.press(key);
 try {
 return await waitForDebugState(page, label, predicate, timeoutMs);
 } catch (error) {
 lastError = error;
 }
 }
 const actual = await gameDebugSnapshot(page);
 throw new Error(`Failed after ${attempts} attempts pressing ${key} for ${label}; actual debug state: ${JSON.stringify(actual)}`, {
 cause: lastError,
 });
}

test('loads the playable canvas without page errors', async ({ page }) => {
 test.setTimeout(30_000);
 const errors: string[] = [];
 page.on('pageerror', (error) => errors.push(error.message));
 await openGame(page);
 await expect(page.locator('canvas')).toBeVisible();
 await expect(page).toHaveTitle(/Aeon Vale|永恒山谷/);
 await page.waitForTimeout(250);
 const finalStats = await canvasPaintStats(page);
 expect(finalStats.sampled).toBeGreaterThan(500);
 expect(finalStats.painted / finalStats.sampled).toBeGreaterThan(0.55);
 expect(finalStats.colors).toBeGreaterThan(16);
 expect(errors).toEqual([]);
});

test('first screen exposes the public demo farm loop signals', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', (error) => errors.push(error.message));
 await openGame(page);
 await clearIntroDialogue(page);

const debug = await gameDebugSnapshot(page);
 expect(debug.dialogueBeatId).toBeNull();
 expect(debug.paused).toBe(false);
 expect(debug.inventoryVisible).toBe(false);
 expect(debug.cultivationPanelVisible).toBe(false);
 expect(debug.postAscensionMode).toBe('none');
 expect(debug.interactionPanelKind).toBe('none');

expect(debug.day).toBeGreaterThanOrEqual(1);
 expect(debug.season).toMatch(/spring|summer|autumn|winter/);
 expect(debug.seasonDay).toBeGreaterThanOrEqual(1);
 expect(debug.playerHp).toBeGreaterThan(0);
 expect(debug.playerStamina).toBeGreaterThan(0);
 expect(debug.onboardingObjectiveId).toMatch(/^first-/);
 expect(debug.helpText).toEqual(expect.stringContaining('目标'));
 expect(debug.helpText).toEqual(expect.stringContaining('炼丹'));
 expect(debug.helpText).toEqual(expect.stringContaining('引劫'));
 expect(debug.helpText).toEqual(expect.stringContaining('回报'));
 expect(debug.todayBriefingTitle).toBe('今日简报');
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('目标：先翻出一块地。'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('首轮进度：1/10 灵草→灵石→补种→备劫'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('农庄'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('炼丹'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('引劫'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('回报：开出第一块灵田'));
 expect(debug.todayBriefingBody).toEqual(expect.stringContaining('按 空格 / E 翻地'));
 expect(debug.todayBriefingAssetId).toBe('logo.full');
 expect(debug.hotbarSlotKind).toBe('till');
 expect(debug.hotbarSeedId).toBeNull();
 expect(debug.selectedLocationId).toBe('farmstead');
 expect(debug.selectedLocationServiceCommand).toBe('show-farm-work');
 expect(debug.starterMosslingSeedCount).toBe(6);
 expect(debug.starterDewrootSeedCount).toBe(3);
 expect(debug.starterMosslingHerbCount).toBe(3);
 expect(debug.starterDewrootHerbCount).toBe(2);
 expect(debug.starterSpiritStoneCount).toBe(2);
 expect(debug.shippingBinItemCount).toBe(0);

await pressUntilDebugState(
 page,
 'M',
 'farm action panel after pressing M',
 (debug) => debug.interactionPanelKind === 'farm-action',
);
 const farmMenuDebug = await gameDebugSnapshot(page);
 expect(farmMenuDebug.interactionPanelKind).toBe('farm-action');
 expect(farmMenuDebug.farmActionKind).toBe('build');
 expect(farmMenuDebug.helpText).toEqual(expect.stringContaining('目标'));
 expect(errors).toEqual([]);
});

test('fresh player can complete the first farm economy loop from the first screen', async ({ page }) => {
 test.setTimeout(300_000);
 const errors: string[] = [];
 page.on('pageerror', (error) => errors.push(error.message));
 await openGame(page);
 await clearIntroDialogue(page);

const before = await gameDebugSnapshot(page);
 expect(before.dialogueBeatId).toBeNull();
 expect(before.paused).toBe(false);
 expect(before.hotbarSlotKind).toBe('till');
 expect(before.onboardingObjectiveId).toBe('first-till');
 expect(before.playerFacing).toBe('down');
 expect(before.frontTileX).toBe(before.playerX);
 expect(before.frontTileY).toBe((before.playerY ?? 0) + 1);
 expect(before.frontTileTilled).toBe(false);
 expect(before.frontTileCropId).toBeNull();

await pressUntilDebugState(
 page,
 'Space',
 'first tile tilled',
 (debug) => debug.frontTileTilled === true
 && debug.frontTileCropId == null
 && debug.onboardingObjectiveId === 'first-sow',
);

const after = await gameDebugSnapshot(page);
 expect(after.frontTileTilled).toBe(true);
 expect(after.frontTileCropId).toBeNull();
 expect(after.onboardingObjectiveId).toBe('first-sow');
 expect(after.helpText).toEqual(expect.stringContaining('播'));
 await clearIntroDialogue(page);

await pressUntilDebugState(
 page,
 '5',
 'mossling seed selected',
 (debug) => debug.hotbarSlotKind === 'seed' && debug.hotbarSeedId === 'seed.mossling',
);
 const seedSelected = await gameDebugSnapshot(page);
 expect(seedSelected.hotbarSlotKind).toBe('seed');
 expect(seedSelected.hotbarSeedId).toBe('seed.mossling');
 expect(seedSelected.starterMosslingSeedCount).toBe(6);

await pressUntilDebugState(
 page,
 'Space',
 'first seed sown',
 (debug) => debug.frontTileTilled === true
 && debug.frontTileCropId != null
 && debug.onboardingObjectiveId === 'first-water'
 && debug.starterMosslingSeedCount === 5,
);

const sown = await gameDebugSnapshot(page);
 expect(sown.frontTileTilled).toBe(true);
 expect(sown.frontTileCropId).not.toBeNull;
 expect(sown.frontTileCropStage).toMatch(/seed|sprout|growing|mature/);
 expect(sown.onboardingObjectiveId).toBe('first-water');
 expect(sown.starterMosslingSeedCount).toBe(5);
 expect(sown.frontTileWateredToday).toBe(false);
 expect(sown.frontTileMoisture).toBeGreaterThanOrEqual(0);
 expect(sown.helpText).toEqual(expect.stringContaining('浇'));
 await clearIntroDialogue(page);

await pressUntilDebugState(
 page,
 '2',
 'water tool selected',
 (debug) => debug.hotbarSlotKind === 'water' && debug.hotbarSeedId == null,
);
 const waterSelected = await gameDebugSnapshot(page);
 expect(waterSelected.hotbarSlotKind).toBe('water');
 expect(waterSelected.hotbarSeedId).toBeNull();

await pressUntilDebugState(
 page,
 'Space',
 'first crop watered',
 (debug) => debug.frontTileWateredToday === true
 && (debug.frontTileMoisture ?? 0) > 0
 && debug.onboardingObjectiveId === 'first-harvest',
);

const watered = await gameDebugSnapshot(page);
 expect(watered.frontTileCropId).toBe(sown.frontTileCropId);
 expect(watered.frontTileWateredToday).toBe(true);
 expect(watered.frontTileMoisture).toBeGreaterThan(sown.frontTileMoisture ?? 0);
 expect(watered.onboardingObjectiveId).toBe('first-harvest');
 expect(watered.helpText).toEqual(expect.stringContaining('收获'));
 await clearIntroDialogue(page);
 await page.evaluate(() => {
 const target = window as typeof window & { __AEON_TEST__?: { advanceOneDay?: () => void } };
 target.__AEON_TEST__?.advanceOneDay?.();
 });
 await waitForDebugState(
 page,
 'next day after watering by test hook',
 (debug) => (debug.day ?? 0) > (watered.day ?? 0)
 && debug.frontTileCropId != null
 && (debug.frontTileCropGrowth ?? 0) > 0
 && debug.frontTileWateredToday === false,
 );

const nextDay = await gameDebugSnapshot(page);
 expect(nextDay.day).toBeGreaterThan(watered.day ?? 0);
 expect(nextDay.frontTileCropId).toBe(sown.frontTileCropId);
 expect(nextDay.frontTileCropGrowth).toBeGreaterThan(watered.frontTileCropGrowth ?? 0);
 expect(nextDay.frontTileWateredToday).toBe(false);
 expect(nextDay.onboardingObjectiveId).toBe('first-water');
 const maturedByTestHook = await page.evaluate(() => {
 const target = window as typeof window & { __AEON_TEST__?: { matureFrontCrop?: () => boolean } };
 return target.__AEON_TEST__?.matureFrontCrop?.() ?? false;
 });
 expect(maturedByTestHook).toBe(true);
 await waitForDebugState(
 page,
 'front crop matured by test hook',
 (debug) => debug.frontTileCropStage === 'mature' && debug.onboardingObjectiveId === 'first-harvest',
 );
 await clearIntroDialogue(page);

const mature = await gameDebugSnapshot(page);
 expect(mature.frontTileCropStage).toBe('mature');
 expect(mature.onboardingObjectiveId).toBe('first-harvest');

await pressUntilDebugState(
 page,
 '3',
 'harvest tool selected',
 (debug) => debug.hotbarSlotKind === 'harvest',
);
 await pressUntilDebugState(
 page,
 'Space',
 'first crop harvested',
 (debug) => debug.frontTileCropId == null
 && debug.onboardingObjectiveId === 'first-ship'
 && (debug.starterMosslingHerbCount ?? 0) > 3,
);

const harvested = await gameDebugSnapshot(page);
 expect(harvested.frontTileCropId).toBeNull();
 expect(harvested.onboardingObjectiveId).toBe('first-ship');
 expect(harvested.starterMosslingHerbCount).toBeGreaterThan(before.starterMosslingHerbCount ?? 0);
 await clearIntroDialogue(page);

await pressUntilDebugState(
 page,
 'F9',
 'shipping action selected',
 (debug) => debug.interactionPanelKind === 'farm-action' && debug.farmActionKind === 'shipping-normal',
);
 await pressUntilDebugState(
 page,
 'Enter',
 'shipping panel opened',
 (debug) => debug.interactionPanelKind === 'shipping',
);
 for (let i = 0; i < 8; i += 1) {
 const debug = await gameDebugSnapshot(page);
 if (debug.shippingItemId === 'herb.mossling') break;
 await page.keyboard.press('Tab');
 await page.waitForTimeout(50);
 }
 expect((await gameDebugSnapshot(page)).shippingItemId).toBe('herb.mossling');
 await pressUntilDebugState(
 page,
 'Enter',
 'mossling herb added to shipping bin',
 (debug) => debug.interactionPanelKind === 'shipping'
 && debug.onboardingObjectiveId === 'first-sleep'
 && debug.shippingBinItemCount === 1
 && (debug.starterMosslingHerbCount ?? 0) > 0,
 { attempts: 3, timeoutMs: 3_000 },
 );

const shipped = await gameDebugSnapshot(page);
 expect(shipped.onboardingObjectiveId).toBe('first-sleep');
 expect(shipped.shippingBinItemCount).toBe(1);
 expect(shipped.starterMosslingHerbCount).toBe((harvested.starterMosslingHerbCount ?? 0) - 1);
 await clearIntroDialogue(page);
 await page.evaluate(() => {
 const target = window as typeof window & { __AEON_TEST__?: { closePanels?: () => void; advanceOneDay?: () => void } };
 target.__AEON_TEST__?.closePanels?.();
 target.__AEON_TEST__?.advanceOneDay?.();
 });
 await waitForDebugState(
 page,
 'shipping settlement after advancing one day',
 (debug) => (debug.day ?? 0) > (shipped.day ?? 0)
 && debug.onboardingObjectiveId === 'first-market-restock'
 && debug.shippingBinItemCount === 0
 && (debug.starterSpiritStoneCount ?? 0) > (shipped.starterSpiritStoneCount ?? 0),
 );

const settled = await gameDebugSnapshot(page);
 expect(settled.onboardingObjectiveId).toBe('first-market-restock');
 expect(settled.shippingBinItemCount).toBe(0);
 expect(settled.starterSpiritStoneCount).toBeGreaterThan(shipped.starterSpiritStoneCount ?? 0);

await pressUntilDebugState(
 page,
 ',',
 'market shop selected from location ring',
 (debug) => debug.locationSelectionActive === true
 && debug.selectedLocationId === 'valley-market'
 && debug.selectedLocationServiceCommand === 'browse-shop',
);
 await pressUntilDebugState(
 page,
 'Enter',
 'shop panel opened',
 (debug) => debug.interactionPanelKind === 'shop',
);
 const restockedDebug = await page.evaluate(() => {
 const target = window as typeof window & { __AEON_TEST__?: { buyMosslingSeed?: () => boolean }; __AEON_DEBUG__?: AeonDebugSnapshot };
 const ok = target.__AEON_TEST__?.buyMosslingSeed?.() ?? false;
 return { ok, debug: target.__AEON_DEBUG__ ?? {} };
 });
 expect(restockedDebug.ok).toBe(true);
 expect(restockedDebug.debug.interactionPanelKind).toBe('none');
 expect(restockedDebug.debug.onboardingObjectiveId).toBe('first-second-sow');
 expect(restockedDebug.debug.starterMosslingSeedCount).toBeGreaterThan(settled.starterMosslingSeedCount ?? 0);
 expect(restockedDebug.debug.hotbarSlotKind).toBe('seed');
 expect(restockedDebug.debug.hotbarSeedId).toBe('seed.mossling');

const restocked = await gameDebugSnapshot(page);
 expect(restocked.onboardingObjectiveId).toBe('first-second-sow');
 expect(restocked.starterMosslingSeedCount).toBeGreaterThan(settled.starterMosslingSeedCount ?? 0);
 expect(restocked.hotbarSlotKind).toBe('seed');
 expect(restocked.hotbarSeedId).toBe('seed.mossling');
 expect(restocked.helpText).toEqual(expect.stringContaining('播'));
 expect(errors).toEqual([]);
});

test('T1/T2/T4/T6 code paths run in-browser without errors', async ({ page }) => {
 test.setTimeout(120_000);
 const errors: string[] = [];
 page.on('pageerror', (error) => errors.push(error.message));
 await openGame(page);
 await expect(page.locator('canvas')).toBeVisible();
 await clearIntroDialogue(page);
 const keys = ['u', 'y', 'BracketRight', 'b', 'o', 'p', 'Space', 'z', 'r', 'u'];
 for (const k of keys) {
 await clearIntroDialogue(page);
 await focusGame(page);
 await page.keyboard.press(k);
 if (k === 'p') await page.keyboard.press('Escape');
 await page.waitForTimeout(40);
 }
 await clearIntroDialogue(page);
 expect(errors).toEqual([]);
});
