import { expect, test } from '@playwright/test';
import { clearIntroDialogue, gameDebugSnapshot, gameEntryPath, openGame } from './openGame';

test('loads the public demo first screen without page errors', async ({ page }) => {
  test.setTimeout(45_000);
  const isDeployedPagesSmoke = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';
  const errors: string[] = [];
  const failedRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`));

  if (isDeployedPagesSmoke) {
    await page.goto(gameEntryPath());
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(page).toHaveTitle(/Aeon Vale|永恒山谷/);
    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(100);
    expect(box?.height ?? 0).toBeGreaterThan(100);
    await canvas.click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(500);
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
    return;
  }

  await openGame(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page).toHaveTitle(/Aeon Vale|永恒山谷/);
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
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});
