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
