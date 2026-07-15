import { expect, test } from '@playwright/test';
import { canvasPaintStats, clearIntroDialogue, gameDebugSnapshot, openGame } from './openGame';

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

test('first screen exposes the portfolio MVP farm loop signals', async ({ page }) => {
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

await page.keyboard.press('M');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & { __AEON_DEBUG__?: { interactionPanelKind?: string } }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'farm-action';
 });
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

await page.keyboard.press('Space');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 frontTileTilled?: boolean;
 frontTileCropId?: string | number | null;
 onboardingObjectiveId?: string | null;
 };
 }).__AEON_DEBUG__;
 return debug?.frontTileTilled === true
 && debug.frontTileCropId == null
 && debug.onboardingObjectiveId === 'first-sow';
 });

const after = await gameDebugSnapshot(page);
 expect(after.frontTileTilled).toBe(true);
 expect(after.frontTileCropId).toBeNull();
 expect(after.onboardingObjectiveId).toBe('first-sow');
 expect(after.helpText).toEqual(expect.stringContaining('播'));
 await clearIntroDialogue(page);

await page.keyboard.press('5');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 hotbarSlotKind?: string;
 hotbarSeedId?: string | null;
 };
 }).__AEON_DEBUG__;
 return debug?.hotbarSlotKind === 'seed' && debug.hotbarSeedId === 'seed.mossling';
 });
 const seedSelected = await gameDebugSnapshot(page);
 expect(seedSelected.hotbarSlotKind).toBe('seed');
 expect(seedSelected.hotbarSeedId).toBe('seed.mossling');
 expect(seedSelected.starterMosslingSeedCount).toBe(6);

await page.keyboard.press('Space');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 frontTileTilled?: boolean;
 frontTileCropId?: string | number | null;
 onboardingObjectiveId?: string | null;
 starterMosslingSeedCount?: number;
 };
 }).__AEON_DEBUG__;
 return debug?.frontTileTilled === true
 && debug.frontTileCropId != null
 && debug.onboardingObjectiveId === 'first-water'
 && debug.starterMosslingSeedCount === 5;
 });

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

await page.keyboard.press('2');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 hotbarSlotKind?: string;
 hotbarSeedId?: string | null;
 };
 }).__AEON_DEBUG__;
 return debug?.hotbarSlotKind === 'water' && debug.hotbarSeedId == null;
 });
 const waterSelected = await gameDebugSnapshot(page);
 expect(waterSelected.hotbarSlotKind).toBe('water');
 expect(waterSelected.hotbarSeedId).toBeNull();

await page.keyboard.press('Space');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 frontTileWateredToday?: boolean;
 frontTileMoisture?: number;
 onboardingObjectiveId?: string | null;
 };
 }).__AEON_DEBUG__;
 return debug?.frontTileWateredToday === true
 && (debug.frontTileMoisture ?? 0) > 0
 && debug.onboardingObjectiveId === 'first-harvest';
 });

const watered = await gameDebugSnapshot(page);
 expect(watered.frontTileCropId).toBe(sown.frontTileCropId);
 expect(watered.frontTileWateredToday).toBe(true);
 expect(watered.frontTileMoisture).toBeGreaterThan(sown.frontTileMoisture ?? 0);
 expect(watered.onboardingObjectiveId).toBe('first-harvest');
 expect(watered.helpText).toEqual(expect.stringContaining('收获'));
 await clearIntroDialogue(page);
 await page.keyboard.press('Enter');
 await page.waitForFunction((previousDay) => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 day?: number;
 frontTileCropId?: string | number | null;
 frontTileCropGrowth?: number;
 frontTileWateredToday?: boolean;
 };
 }).__AEON_DEBUG__;
 return debug != null
 && (debug.day ?? 0) > previousDay
 && debug.frontTileCropId != null
 && (debug.frontTileCropGrowth ?? 0) > 0
 && debug.frontTileWateredToday === false;
 }, watered.day ?? 0);

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
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: { frontTileCropStage?: string | null; onboardingObjectiveId?: string | null };
 }).__AEON_DEBUG__;
 return debug?.frontTileCropStage === 'mature' && debug.onboardingObjectiveId === 'first-harvest';
 });
 await clearIntroDialogue(page);

const mature = await gameDebugSnapshot(page);
 expect(mature.frontTileCropStage).toBe('mature');
 expect(mature.onboardingObjectiveId).toBe('first-harvest');

await page.keyboard.press('3');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & { __AEON_DEBUG__?: { hotbarSlotKind?: string } }).__AEON_DEBUG__;
 return debug?.hotbarSlotKind === 'harvest';
 });
 await page.keyboard.press('Space');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 frontTileCropId?: string | number | null;
 onboardingObjectiveId?: string | null;
 starterMosslingHerbCount?: number;
 };
 }).__AEON_DEBUG__;
 return debug != null
 && debug.frontTileCropId == null
 && debug.onboardingObjectiveId === 'first-ship'
 && (debug.starterMosslingHerbCount ?? 0) > 3;
 });

const harvested = await gameDebugSnapshot(page);
 expect(harvested.frontTileCropId).toBeNull();
 expect(harvested.onboardingObjectiveId).toBe('first-ship');
 expect(harvested.starterMosslingHerbCount).toBeGreaterThan(before.starterMosslingHerbCount ?? 0);
 await clearIntroDialogue(page);

await page.keyboard.press('F9');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: { interactionPanelKind?: string; farmActionKind?: string };
 }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'farm-action' && debug.farmActionKind === 'shipping-normal';
 });
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: { interactionPanelKind?: string };
 }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'shipping';
 });
 for (let i = 0; i < 8; i += 1) {
 const debug = await gameDebugSnapshot(page);
 if (debug.shippingItemId === 'herb.mossling') break;
 await page.keyboard.press('Tab');
 await page.waitForTimeout(50);
 }
 expect((await gameDebugSnapshot(page)).shippingItemId).toBe('herb.mossling');
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 interactionPanelKind?: string;
 onboardingObjectiveId?: string | null;
 shippingBinItemCount?: number;
 starterMosslingHerbCount?: number;
 };
 }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'shipping'
 && debug.onboardingObjectiveId === 'first-sleep'
 && debug.shippingBinItemCount === 1
 && (debug.starterMosslingHerbCount ?? 0) > 0;
 });

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
 await page.waitForFunction(({ previousDay, previousSpiritStoneCount }) => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 day?: number;
 onboardingObjectiveId?: string | null;
 shippingBinItemCount?: number;
 starterSpiritStoneCount?: number;
 };
 }).__AEON_DEBUG__;
 return debug != null
 && (debug.day ?? 0) > previousDay
 && debug.onboardingObjectiveId === 'first-market-restock'
 && debug.shippingBinItemCount === 0
 && (debug.starterSpiritStoneCount ?? 0) > previousSpiritStoneCount;
 }, { previousDay: shipped.day ?? 0, previousSpiritStoneCount: shipped.starterSpiritStoneCount ?? 0 });

const settled = await gameDebugSnapshot(page);
 expect(settled.onboardingObjectiveId).toBe('first-market-restock');
 expect(settled.shippingBinItemCount).toBe(0);
 expect(settled.starterSpiritStoneCount).toBeGreaterThan(shipped.starterSpiritStoneCount ?? 0);

await page.keyboard.press(',');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: { locationSelectionActive?: boolean; selectedLocationId?: string | null; selectedLocationServiceCommand?: string | null };
 }).__AEON_DEBUG__;
 return debug?.locationSelectionActive === true
 && debug.selectedLocationId === 'valley-market'
 && debug.selectedLocationServiceCommand === 'browse-shop';
 });
 await page.keyboard.press('Enter');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & { __AEON_DEBUG__?: { interactionPanelKind?: string } }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'shop';
 });
 await page.keyboard.press('Enter');
 await page.waitForFunction((previousSeedCount) => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 interactionPanelKind?: string;
 onboardingObjectiveId?: string | null;
 starterMosslingSeedCount?: number;
 hotbarSlotKind?: string;
 hotbarSeedId?: string | null;
 };
 }).__AEON_DEBUG__;
 return debug?.interactionPanelKind === 'none'
 && debug.onboardingObjectiveId === 'first-second-sow'
 && (debug.starterMosslingSeedCount ?? 0) > previousSeedCount
 && debug.hotbarSlotKind === 'seed'
 && debug.hotbarSeedId === 'seed.mossling';
 }, settled.starterMosslingSeedCount ?? 0);

const restocked = await gameDebugSnapshot(page);
 expect(restocked.onboardingObjectiveId).toBe('first-second-sow');
 expect(restocked.starterMosslingSeedCount).toBeGreaterThan(settled.starterMosslingSeedCount ?? 0);

await page.keyboard.press('ArrowRight');
 await page.waitForFunction((previousX) => {
 const debug = (window as typeof window & { __AEON_DEBUG__?: { playerX?: number; frontTileCropId?: string | number | null } }).__AEON_DEBUG__;
 return debug != null && debug.playerX === previousX + 1 && debug.frontTileCropId == null;
 }, restocked.playerX ?? 0);
 await page.keyboard.press('Space');
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: {
 frontTileTilled?: boolean;
 frontTileCropId?: string | number | null;
 onboardingObjectiveId?: string | null;
 hotbarSlotKind?: string;
 };
 }).__AEON_DEBUG__;
 return debug?.frontTileTilled === true
 && debug.frontTileCropId != null
 && debug.onboardingObjectiveId === 'first-second-water'
 && debug.hotbarSlotKind === 'water';
 });

const resown = await gameDebugSnapshot(page);
 expect(resown.frontTileCropId).not.toBeNull();
 expect(resown.onboardingObjectiveId).toBe('first-second-water');
 expect(resown.starterMosslingSeedCount).toBe((restocked.starterMosslingSeedCount ?? 0) - 1);
 await clearIntroDialogue(page);

 const wateredByTestHook = await page.evaluate(() => {
 const target = window as typeof window & { __AEON_TEST__?: { waterFrontCrop?: () => boolean } };
 return target.__AEON_TEST__?.waterFrontCrop?.() ?? false;
 });
 expect(wateredByTestHook).toBe(true);
 await page.waitForFunction(() => {
 const debug = (window as typeof window & {
 __AEON_DEBUG__?: { frontTileWateredToday?: boolean; onboardingObjectiveId?: string | null };
 }).__AEON_DEBUG__;
 return debug?.frontTileWateredToday === true && debug.onboardingObjectiveId === 'first-loop-complete';
 });

const replenished = await gameDebugSnapshot(page);
 expect(replenished.frontTileWateredToday).toBe(true);
 expect(replenished.onboardingObjectiveId).toBe('first-loop-complete');
 expect(errors).toEqual([]);
});

test('T1/T2/T4/T6 code paths run in-browser without errors', async ({ page }) => {
 test.setTimeout(90_000);
 const errors: string[] = [];
 page.on('pageerror', (error) => errors.push(error.message));
 await openGame(page);
 await expect(page.locator('canvas')).toBeVisible();
 await clearIntroDialogue(page);
 const keys = ['u', 'y', 'BracketRight', 'b', 'o', 'p', 'Space', 'z', 'r', 'u'];
 for (const k of keys) {
 await clearIntroDialogue(page);
 await page.keyboard.press(k);
 if (k === 'p') await page.keyboard.press('Escape');
 await page.waitForTimeout(40);
 }
 await clearIntroDialogue(page);
 expect(errors).toEqual([]);
});
