import { expect, test } from '@playwright/test';
import { clearIntroDialogue, continueToWorld, gameDebugSnapshot, gameEntryPath, waitForInitialSurface } from './openGame';

test('boot-ready reveals a playable first surface before any input', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 120_000 : 45_000);
  await page.goto(gameEntryPath());

  const initial = await waitForInitialSurface(page);
  expect(initial.appSurface === 'title' || initial.appSurface === 'world').toBe(true);

  if (initial.appSurface === 'title') {
    await expect(page.locator('#flow-title-new-game')).toBeVisible();
    await expect(page.locator('[data-app-surface="loading"]')).toBeHidden();
    await expect(page.locator('canvas')).toBeHidden();
  } else {
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('canvas')).toBeVisible();
  }
});

test('loads the public demo first screen without page errors', async ({ page }) => {
  test.setTimeout(process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? 120_000 : 45_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToWorld(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expect(page).toHaveTitle(/Aeon Vale|永恒山谷/);
  await clearIntroDialogue(page);

  const debug = await gameDebugSnapshot(page);
  expect(debug.dialogueBeatId).toBeNull();
  expect(debug.dialogueBackdropVisible).toBe(false);
  expect(debug.todayBriefingVisible).toBe(false);
  expect(debug.panelPreviewVisible).toBe(false);
  expect(debug.locationPreviewVisible).toBe(false);
  expect(debug.paused).toBe(false);
  expect(debug.inventoryVisible).toBe(false);
  expect(debug.cultivationPanelVisible).toBe(false);
  expect(debug.postAscensionMode).toBe('none');
  expect(debug.interactionPanelKind).toBe('none');
  expect(debug.debugSchemaVersion).toBe(2);
  expect(debug.legacyShortcutsEnabled).toBe(false);
  const expectedBuildRevision = process.env.PLAYWRIGHT_EXPECTED_BUILD_REVISION?.trim() || (process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true' ? null : 'playwright-test');
  if (expectedBuildRevision) expect(debug.buildRevision).toBe(expectedBuildRevision);
  else {
    expect(debug.buildRevision).toEqual(expect.any(String));
    expect(debug.buildRevision).not.toBe('dev');
    expect(debug.buildRevision?.trim()).not.toBe('');
  }
  expect(debug.flowScreen).toBe('world');
  expect(debug.appSurface).toBe('world');
  expect(debug.renderFrameCount).toBeGreaterThan(0);
  await expect(page.locator('#objective-rail')).toBeVisible();
  await expect(page.locator('#objective-rail-progress')).toHaveText('1/4 · 获得灵草');
  await expect(page.locator('#objective-rail-primary')).toContainText('灵田');
  await expect(page.locator('#objective-rail #fate-rail-details')).toHaveCount(0);
  await expect(page.locator('#objective-rail')).not.toContainText(/劫势|天象/);
  await expect(page.locator('#fate-status-strip')).toBeVisible();
  await expect(page.locator('#fate-status-strip')).toContainText(/劫|备劫/);
  await expect(page.locator('#fate-summary-celestial')).toContainText('天象');
  expect(await page.locator('#fate-rail-details').evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  await expect(page.locator('#fate-rail-details .fate-detail-body')).toBeHidden();
  await page.locator('#fate-rail-summary').click();
  await expect(page.locator('#fate-rail-details .fate-detail-body')).toBeVisible();

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
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('点击目标移动/互动'));
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('行囊常驻'));
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('丹炉/山河图/修行在更多中'));
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('B 行囊'));
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('Esc 暂停/返回'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('M/C'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('U 丹炉'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('滚轮'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('Q切换'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('\n'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('function'));
  await expect(page.locator('#world-command-bar > button[data-game-command="inventory"]')).toBeVisible();
  await expect(page.locator('#world-command-bar > button[data-game-command="inventory"]')).toHaveText('行囊');
  await expect(page.locator('#world-command-bar > button[data-game-command="farm"]')).toHaveCount(0);
  await expect(page.locator('#world-command-bar > button[data-game-command="pause"]')).toHaveCount(0);
  await expect(page.locator('#world-command-more [data-game-command="farm"]')).toBeHidden();
  await page.locator('#world-command-more > summary').click();
  await expect(page.locator('#world-command-more [data-game-command="farm"]')).toBeVisible();
  await expect(page.locator('#world-command-more [data-game-command="pause"]')).toBeVisible();
  await page.locator('#world-command-more > summary').click();
  await page.locator('canvas').hover();
  await page.mouse.wheel(0, 120);
  await page.keyboard.press('Q');
  await page.keyboard.press('F9');
  await page.waitForTimeout(80);
  const afterLegacyInput = await gameDebugSnapshot(page);
  expect(afterLegacyInput.hotbarIdx).toBe(debug.hotbarIdx);
  expect(afterLegacyInput.interactionPanelKind).toBe('none');
  expect(debug.todayBriefingTitle).toBe('1/4 · 获得灵草');
  expect(debug.todayBriefingBody).toEqual(expect.stringContaining('面对空地翻出第一块灵田'));
  expect(debug.todayBriefingBody).toEqual(expect.stringContaining('炼丹'));
  expect(debug.todayBriefingBody).toEqual(expect.stringContaining('行动：开始翻地'));
  expect(debug.todayBriefingBody).not.toEqual(expect.stringContaining('1/10'));
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
  const idleFrameCount = debug.renderFrameCount ?? 0;
  await page.waitForTimeout(160);
  expect((await gameDebugSnapshot(page)).renderFrameCount ?? 0).toBeGreaterThan(idleFrameCount);
  expect(errors).toEqual([]);
});
