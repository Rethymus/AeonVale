import { expect, test, type Locator, type Page } from '@playwright/test';
import { continueToWorld, gameEntryPath, type AeonDebugSnapshot } from './openGame';

test.use({ viewport: { width: 736, height: 414 }, hasTouch: true, isMobile: true });

type FarmsteadObjectKind = 'storage' | 'shipping' | 'furnace' | 'array-shed' | 'map-gate';

async function debugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

async function expectFullyInsideViewport(page: Page, locator: Locator): Promise<void> {
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
}

async function expectHudSeparated(page: Page): Promise<void> {
  const layout = await page.evaluate(() => {
    const objectiveRail = document.querySelector<HTMLElement>('#objective-rail');
    const commandBar = document.querySelector<HTMLElement>('#world-command-bar');
    const fateStatus = document.querySelector<HTMLElement>('#fate-status-strip');
    const fateDrawer = document.querySelector<HTMLDetailsElement>('#fate-rail-details');
    if (!objectiveRail || !commandBar || !fateStatus || !fateDrawer) throw new Error('HUD nodes are missing');
    const objective = objectiveRail.getBoundingClientRect();
    const command = commandBar.getBoundingClientRect();
    const fate = fateStatus.getBoundingClientRect();
    const horizontallyOverlaps = objective.left < command.right - 1 && objective.right > command.left + 1;
    const objectiveFateOverlap = objective.left < fate.right - 1 && objective.right > fate.left + 1 && objective.top < fate.bottom - 1 && objective.bottom > fate.top + 1;
    const fateCommandOverlap = fate.left < command.right - 1 && fate.right > command.left + 1 && fate.top < command.bottom - 1 && fate.bottom > command.top + 1;
    return {
      verticalGap: horizontallyOverlaps ? command.top - objective.bottom : Number.POSITIVE_INFINITY,
      commandOverflow: commandBar.scrollHeight - commandBar.clientHeight,
      fateOpen: fateDrawer.open,
      railText: objectiveRail.innerText,
      fateText: fateStatus.innerText,
      hudOverlap: (objectiveFateOverlap ? 1 : 0) + (fateCommandOverlap ? 1 : 0)
    };
  });
  expect(layout.fateOpen).toBe(false);
  expect(layout.railText).toContain('1/4 · 获得灵草');
  expect(layout.railText).not.toMatch(/劫势|天象/);
  expect(layout.fateText).toMatch(/劫|备劫/);
  expect(layout.fateText).toContain('天象平稳');
  expect(layout.hudOverlap).toBe(0);
  expect(layout.verticalGap).toBeGreaterThanOrEqual(8);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);
}

async function configureClickFarmKeypoint(page: Page): Promise<{ targetX: number; targetY: number; frontX: number; frontY: number }> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureFarmsteadClickFarmKeypoint?: () => { targetX: number; targetY: number; frontX: number; frontY: number } | null };
    };
    return target.__AEON_TEST__?.configureFarmsteadClickFarmKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureObjectKeypoint(page: Page, kind: FarmsteadObjectKind): Promise<boolean> {
  return page.evaluate(objectKind => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureFarmsteadObjectKeypoint?: (kind?: string) => boolean };
    };
    return target.__AEON_TEST__?.configureFarmsteadObjectKeypoint?.(objectKind) ?? false;
  }, kind);
}

async function configureNpcPreviewClickKeypoint(page: Page): Promise<{ targetX: number; targetY: number; playerX: number; playerY: number; npcId: string; locationId: string }> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureNpcPreviewClickKeypoint?: () => { targetX: number; targetY: number; playerX: number; playerY: number; npcId: string; locationId: string } | null };
    };
    return target.__AEON_TEST__?.configureNpcPreviewClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureLocationPreviewClickKeypoint(page: Page): Promise<{ targetX: number; targetY: number; playerX: number; playerY: number; locationId: string }> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureLocationPreviewClickKeypoint?: () => { targetX: number; targetY: number; playerX: number; playerY: number; locationId: string } | null };
    };
    return target.__AEON_TEST__?.configureLocationPreviewClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function closePanelsForTest(page: Page): Promise<void> {
  await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { closePanels?: () => void };
    };
    target.__AEON_TEST__?.closePanels?.();
  });
}

async function canvasPointForTile(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null };
      };
      return target.__AEON_TEST__?.canvasPointForTile?.(input.x, input.y) ?? null;
    },
    { x, y }
  );
  expect(point).not.toBeNull();
  return point!;
}

async function configureBuildArrayKeypoint(page: Page, kind: 'lightning-rod' | 'insulation', preservePanel = false): Promise<{ targetX: number; targetY: number; arrayDefId: string }> {
  const configured = await page.evaluate(input => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureBuildArrayKeypoint?: (kind?: 'lightning-rod' | 'insulation', preservePanel?: boolean) => { targetX: number; targetY: number; arrayDefId: string } | null };
    };
    return target.__AEON_TEST__?.configureBuildArrayKeypoint?.(input.kind, input.preservePanel) ?? null;
  }, { kind, preservePanel });
  expect(configured).not.toBeNull();
  return configured!;
}

async function arraySnapshot(page: Page, x: number, y: number): Promise<{ count: number; defIds: string[]; activeCount: number } | null> {
  return page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_TEST__?: { arraySnapshot?: (x: number, y: number) => { count: number; defIds: string[]; activeCount: number } | null };
      };
      return target.__AEON_TEST__?.arraySnapshot?.(input.x, input.y) ?? null;
    },
    { x, y }
  );
}

async function farmsteadObjectTile(page: Page, kind: FarmsteadObjectKind): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(objectKind => {
    const target = window as typeof window & {
      __AEON_TEST__?: { farmsteadObjectTile?: (kind?: string) => { x: number; y: number } | null };
    };
    return target.__AEON_TEST__?.farmsteadObjectTile?.(objectKind) ?? null;
  }, kind);
  expect(point).not.toBeNull();
  return point!;
}

async function tapFarmsteadObject(page: Page, kind: FarmsteadObjectKind): Promise<{ x: number; y: number }> {
  expect(await configureObjectKeypoint(page, kind)).toBe(true);
  const objectTile = await farmsteadObjectTile(page, kind);
  const objectPoint = await canvasPointForTile(page, objectTile.x, objectTile.y);
  await page.locator('canvas').tap({ position: objectPoint });
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.lastPointerAction === 'object' && debug.lastPointerTileX === input.x && debug.lastPointerTileY === input.y && debug.playerMovementActive === false;
    },
    { x: objectTile.x, y: objectTile.y }
  );
  return objectTile;
}

async function tapArrayShedAndWaitForBuildPanel(page: Page): Promise<{ x: number; y: number }> {
  expect(await configureObjectKeypoint(page, 'array-shed')).toBe(true);
  const objectTile = await farmsteadObjectTile(page, 'array-shed');
  const objectPoint = await canvasPointForTile(page, objectTile.x, objectTile.y);
  await page.locator('canvas').tap({ position: objectPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.interactionPanelKind === 'build' && debug.playerMovementActive === false;
  });
  return objectTile;
}

async function clearIntroByTouch(page: Page): Promise<void> {
  const canvas = page.locator('canvas');
  let stableEmptyChecks = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await page.waitForTimeout(80);
    if ((await debugSnapshot(page)).dialogueBeatId == null) {
      stableEmptyChecks += 1;
      if (stableEmptyChecks >= 2) return;
      continue;
    }
    stableEmptyChecks = 0;
    await canvas.tap({ position: { x: 360, y: 210 } });
  }
  expect((await debugSnapshot(page)).dialogueBeatId).toBeNull();
}

test('landscape touch HUD keeps the journey rail clear of the command bar', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');
  await clearIntroByTouch(page);

  await expect(page.locator('#objective-rail')).toBeVisible();
  await expect(page.locator('#world-command-bar')).toBeVisible();
  await expectHudSeparated(page);
});

test('landscape touch more commands open as a side flyout without resizing the main bar', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');
  await clearIntroByTouch(page);

  const commandBar = page.locator('#world-command-bar');
  const moreSummary = page.locator('#world-command-more > summary');
  const morePanel = page.locator('#world-command-more .world-command-more-panel');
  const before = await commandBar.boundingBox();
  expect(before).not.toBeNull();

  await moreSummary.tap();
  await expect(morePanel).toBeVisible();

  const layout = await page.evaluate(() => {
    const command = document.querySelector<HTMLElement>('#world-command-bar');
    const panel = document.querySelector<HTMLElement>('#world-command-more .world-command-more-panel');
    const objective = document.querySelector<HTMLElement>('#objective-rail');
    const fate = document.querySelector<HTMLElement>('#fate-status-strip');
    if (!command || !panel || !objective || !fate) throw new Error('HUD nodes are missing');
    const rectOf = (el: HTMLElement): DOMRect => el.getBoundingClientRect();
    const intersects = (a: DOMRect, b: DOMRect): boolean => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const commandRect = rectOf(command);
    const panelRect = rectOf(panel);
    const objectiveRect = rectOf(objective);
    const fateRect = rectOf(fate);
    const buttonRects = Array.from(panel.querySelectorAll<HTMLElement>('[data-game-command]')).map(button => button.getBoundingClientRect());
    return {
      commandHeight: commandRect.height,
      commandOverflow: command.scrollHeight - command.clientHeight,
      panelInsideViewport:
        panelRect.left >= 0 &&
        panelRect.top >= 0 &&
        panelRect.right <= window.innerWidth &&
        panelRect.bottom <= window.innerHeight,
      panelGap: commandRect.left - panelRect.right,
      panelObjectiveOverlap: intersects(panelRect, objectiveRect),
      panelFateOverlap: intersects(panelRect, fateRect),
      panelCommandOverlap: intersects(panelRect, commandRect),
      buttonViewportViolations: buttonRects.filter(rect => rect.left < 0 || rect.top < 0 || rect.right > window.innerWidth || rect.bottom > window.innerHeight).length,
      buttonCount: buttonRects.length
    };
  });

  expect(Math.abs(layout.commandHeight - before!.height)).toBeLessThanOrEqual(1);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);
  expect(layout.panelInsideViewport).toBe(true);
  expect(layout.panelGap).toBeGreaterThanOrEqual(4);
  expect(layout.panelObjectiveOverlap).toBe(false);
  expect(layout.panelFateOverlap).toBe(false);
  expect(layout.panelCommandOverlap).toBe(false);
  expect(layout.buttonViewportViolations).toBe(0);
  expect(layout.buttonCount).toBeGreaterThanOrEqual(5);
});

test('landscape touch more command opens and closes the map overlay without losing the world HUD', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');
  await clearIntroByTouch(page);

  const commandBar = page.locator('#world-command-bar');
  const more = page.locator('#world-command-more');
  const mapSurface = page.locator('[data-app-surface="map"]');
  const worldSurface = page.locator('[data-app-surface="world"]');

  async function openMapFromMore(): Promise<void> {
    await expect(commandBar).toBeVisible();
    await more.locator('> summary').tap();
    expect(await more.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
    await expect(more.locator('.world-command-more-panel')).toBeVisible();
    await expect(more.locator('[data-game-command="map"]')).toHaveText('地点');
    await more.locator('[data-game-command="map"]').tap();

    await expect(mapSurface).toBeVisible();
    await expect(mapSurface).toHaveAttribute('aria-hidden', 'false');
    expect(await mapSurface.evaluate(el => (el as HTMLElement).inert)).toBe(false);
    await expect(mapSurface.locator('img[data-asset-id="map.location-network-v1"]')).toBeVisible();
    await expect(mapSurface.locator('[data-map-service-command="show-farm-work"]').first()).toBeVisible();
    await expect(mapSurface.getByRole('button', { name: '关闭山河图' })).toBeVisible();
    await expect(mapSurface.getByRole('button', { name: '返回农庄' })).toBeVisible();
    await expectFullyInsideViewport(page, page.locator('#flow-map-close'));
    await expectFullyInsideViewport(page, page.locator('#flow-map-return'));
    await expect(worldSurface).toHaveAttribute('data-flow-backdrop', 'true');
    await expect(commandBar).toBeHidden();
    await expect(page.locator('#world-location-command-bar')).toBeHidden();
    const debug = await debugSnapshot(page);
    expect(debug.flowOverlay).toBe('map');
    expect(debug.appSurface).toBe('map');
    expect(await more.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  }

  async function expectReturnedToWorldHud(): Promise<void> {
    await expect(mapSurface).toBeHidden();
    await expect(mapSurface).toHaveAttribute('aria-hidden', 'true');
    expect(await mapSurface.evaluate(el => (el as HTMLElement).inert)).toBe(true);
    await expect(worldSurface).toBeVisible();
    await expect(worldSurface).toHaveAttribute('aria-hidden', 'false');
    expect(await worldSurface.evaluate(el => (el as HTMLElement).inert)).toBe(false);
    await expect(worldSurface).not.toHaveAttribute('data-flow-backdrop', 'true');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(commandBar).toBeVisible();
    await expect(page.locator('#world-location-command-bar')).toBeHidden();
    await expect(page.locator('#objective-rail')).toBeVisible();
    await expect(page.locator('#fate-status-strip')).toBeVisible();
    await expect(page.locator('#world-vital-strip')).toBeVisible();
    const debug = await debugSnapshot(page);
    expect(debug.flowOverlay).toBeNull();
    expect(debug.appSurface).toBe('world');
    expect(debug.uiMode).toBe('world');
    expect(await more.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');
  }

  await openMapFromMore();
  await mapSurface.getByRole('button', { name: '关闭山河图' }).tap();
  await expectReturnedToWorldHud();

  await openMapFromMore();
  await mapSurface.getByRole('button', { name: '返回农庄' }).tap();
  await expectReturnedToWorldHud();
});

test('fresh touch player can till from the journey button without virtual movement controls', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');

  await expect(page.locator('#touch-controls')).toBeHidden();
  const journey = page.locator('#world-journey-action');
  const inventory = page.locator('#world-command-bar > [data-game-command="inventory"]');
  const more = page.locator('#world-command-more > summary');
  const rest = page.locator('#world-command-bar [data-game-command="end-day"]');
  const system = page.locator('#world-command-more [data-game-command="pause"]');
  for (const control of [journey, inventory, rest, more]) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect(system).toBeHidden();
  await more.tap();
  await expect(system).toBeVisible();
  await more.tap();

  await clearIntroByTouch(page);
  const before = await debugSnapshot(page);
  expect(before.onboardingObjectiveId).toBe('first-till');
  expect(before.frontTileTilled).toBe(false);

  await journey.tap();
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.onboardingObjectiveId === 'first-sow' && debug.frontTileTilled === true && debug.lastPointerAction === 'farm-till';
  });

  const after = await debugSnapshot(page);
  expect(after.onboardingObjectiveId).toBe('first-sow');
  expect(after.frontTileTilled).toBe(true);
  await expect(page.locator('#game-objective')).toContainText('阅读当前对话');
  await expect(page.locator('#game-actions')).toContainText('继续');
  await clearIntroByTouch(page);
  await expect(page.locator('#game-objective')).toContainText('1/4 · 获得灵草');
  await expect(page.locator('#game-objective')).toContainText('播进灵田');
  await expect(page.locator('#game-actions')).toContainText('选择种子');

  await inventory.tap();
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('inventory');
  await page.locator('#flow-inventory-close').tap();
  await expect(page.locator('canvas')).toBeVisible();

  await more.tap();
  await system.tap();
  await expect(page.locator('[data-app-surface="pause"]')).toBeVisible();
  expect((await debugSnapshot(page)).flowOverlay).toBe('pause');
});

test('landscape touch canvas tap walks beside a farm tile and performs the contextual action', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world');
  await clearIntroByTouch(page);

  await expect(page.locator('#touch-controls')).toBeHidden();
  const keypoint = await configureClickFarmKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  await page.locator('canvas').tap({ position: targetPoint });

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.lastPointerAction === 'farm-till';
  });

  const debug = await debugSnapshot(page);
  expect(debug.lastPointerTileX).toBe(keypoint.targetX);
  expect(debug.lastPointerTileY).toBe(keypoint.targetY);
  expect(Math.abs((debug.playerX ?? -99) - keypoint.targetX) + Math.abs((debug.playerY ?? -99) - keypoint.targetY)).toBe(1);
});

test('landscape touch canvas tap opens npc and location previews without keyboard', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world');
  await clearIntroByTouch(page);

  const canvas = page.locator('canvas');
  const npcKeypoint = await configureNpcPreviewClickKeypoint(page);
  const npcPoint = await canvasPointForTile(page, npcKeypoint.targetX, npcKeypoint.targetY);
  await canvas.tap({ position: npcPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.interactionPanelKind === 'npc' && debug.lastPointerAction === 'object' && debug.playerMovementActive === false;
  });
  let debug = await debugSnapshot(page);
  expect(debug.interactionPanelKind).toBe('npc');
  expect(debug.lastPointerTileX).toBe(npcKeypoint.targetX);
  expect(debug.lastPointerTileY).toBe(npcKeypoint.targetY);

  await closePanelsForTest(page);
  const locationKeypoint = await configureLocationPreviewClickKeypoint(page);
  const locationPoint = await canvasPointForTile(page, locationKeypoint.targetX, locationKeypoint.targetY);
  await canvas.tap({ position: locationPoint });
  await page.waitForFunction(
    input => {
      const current = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return current?.locationSelectionActive === true && current.selectedLocationId === input.locationId && current.lastPointerAction === 'object' && current.playerMovementActive === false;
    },
    { locationId: locationKeypoint.locationId }
  );
  debug = await debugSnapshot(page);
  expect(debug.locationSelectionActive).toBe(true);
  expect(debug.selectedLocationId).toBe(locationKeypoint.locationId);
  expect(debug.lastPointerTileX).toBe(locationKeypoint.targetX);
  expect(debug.lastPointerTileY).toBe(locationKeypoint.targetY);
  await expect(page.locator('#world-command-bar')).toBeHidden();
  const locationCommandBar = page.locator('#world-location-command-bar');
  await expect(locationCommandBar).toBeVisible();
  const locationLayout = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>('#world-location-command-bar');
    const objective = document.querySelector<HTMLElement>('#objective-rail');
    const fate = document.querySelector<HTMLElement>('#fate-status-strip');
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    if (!bar || !objective || !fate || !canvas) throw new Error('location HUD nodes are missing');
    const barRect = bar.getBoundingClientRect();
    const objectiveRect = objective.getBoundingClientRect();
    const fateRect = fate.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const scaleX = canvasRect.width / 960;
    const scaleY = canvasRect.height / 540;
    const previewBottom = debug?.locationPreviewPanelBottom ?? 440;
    const previewRect = {
      left: canvasRect.left + 648 * scaleX,
      top: canvasRect.top + 70 * scaleY,
      right: canvasRect.left + (648 + 288) * scaleX,
      bottom: canvasRect.top + previewBottom * scaleY
    } as DOMRect;
    const intersects = (a: DOMRect, b: DOMRect): boolean => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const buttonRects = Array.from(bar.querySelectorAll<HTMLElement>('[data-game-command]')).map(button => button.getBoundingClientRect());
    return {
      insideViewport: barRect.left >= 0 && barRect.top >= 0 && barRect.right <= window.innerWidth && barRect.bottom <= window.innerHeight,
      objectiveOverlap: intersects(barRect, objectiveRect),
      fateOverlap: intersects(barRect, fateRect),
      previewOverlap: intersects(barRect, previewRect),
      smallButtons: buttonRects.filter(rect => rect.width < 44 || rect.height < 44).length
    };
  });
  expect(locationLayout.insideViewport).toBe(true);
  expect(locationLayout.objectiveOverlap).toBe(false);
  expect(locationLayout.fateOverlap).toBe(false);
  expect(locationLayout.previewOverlap).toBe(false);
  expect(locationLayout.smallButtons).toBe(0);
  await locationCommandBar.locator('[data-game-command="cancel"]').tap();
  await page.waitForFunction(() => {
    const current = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return current?.locationSelectionActive === false && current.locationPreviewVisible === false;
  });
  await expect(locationCommandBar).toBeHidden();
  await expect(page.locator('#world-command-bar')).toBeVisible();
});

const touchFarmsteadObjectExpectations: Array<{
  kind: FarmsteadObjectKind;
  assertOpened: (page: Page) => Promise<void>;
}> = [
  {
    kind: 'storage',
    assertOpened: async page => {
      expect((await debugSnapshot(page)).interactionPanelKind).toBe('storage');
    }
  },
  {
    kind: 'shipping',
    assertOpened: async page => {
      const debug = await debugSnapshot(page);
      expect(debug.interactionPanelKind).toBe('shipping');
      expect(debug.shippingItemId).toBe('herb.mossling');
    }
  },
  {
    kind: 'furnace',
    assertOpened: async page => {
      const debug = await debugSnapshot(page);
      expect(debug.flowOverlay).toBe('inventory');
      expect(debug.appSurface).toBe('inventory');
      const inventorySurface = page.locator('[data-app-surface="inventory"]');
      await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
      await expect(inventorySurface.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
    }
  },
  {
    kind: 'array-shed',
    assertOpened: async page => {
      expect((await debugSnapshot(page)).interactionPanelKind).toBe('build');
    }
  },
  {
    kind: 'map-gate',
    assertOpened: async page => {
      const debug = await debugSnapshot(page);
      expect(debug.locationSelectionActive).toBe(true);
      expect(debug.locationPreviewVisible).toBe(true);
      expect(debug.interactionPanelKind).toBe('none');
    }
  }
];

for (const expectation of touchFarmsteadObjectExpectations) {
  test(`landscape touch tap opens farmstead ${expectation.kind} product flow`, async ({ page }) => {
    await page.addInitScript(() => localStorage.clear());
    await page.goto(gameEntryPath());
    await page.waitForSelector('canvas', { state: 'attached' });
    await continueToWorld(page);
    await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world');
    await clearIntroByTouch(page);

    const objectTile = await tapFarmsteadObject(page, expectation.kind);
    await expectation.assertOpened(page);
    const debug = await debugSnapshot(page);
    expect(debug.lastPointerTileX).toBe(objectTile.x);
    expect(debug.lastPointerTileY).toBe(objectTile.y);
  });
}

test('landscape touch can tap array-shed then tap a field tile to place an array', async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world');
  await clearIntroByTouch(page);

  await tapArrayShedAndWaitForBuildPanel(page);
  const keypoint = await configureBuildArrayKeypoint(page, 'lightning-rod', true);
  await clearIntroByTouch(page);
  expect((await arraySnapshot(page, keypoint.targetX, keypoint.targetY))?.count ?? 0).toBe(0);
  expect((await debugSnapshot(page)).interactionPanelKind).toBe('build');

  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  await page.locator('canvas').tap({ position: targetPoint });
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.lastPointerAction === 'array-place' && debug.lastPointerTileX === input.x && debug.lastPointerTileY === input.y;
    },
    { x: keypoint.targetX, y: keypoint.targetY }
  );

  const after = await arraySnapshot(page, keypoint.targetX, keypoint.targetY);
  expect(after?.defIds).toContain(keypoint.arrayDefId);
  expect(after?.activeCount).toBe(1);
});

test('fresh landscape touch player completes the public demo without keyboard or test hooks', async ({ page }) => {
  test.setTimeout(100_000);
  await page.addInitScript(() => localStorage.clear());
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-till');
  await clearIntroByTouch(page);

  const journey = page.locator('#world-journey-action');
  const rest = page.locator('#world-command-bar [data-game-command="end-day"]');
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-sow');
  await clearIntroByTouch(page);
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-water');
  await journey.tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-harvest');

  for (let day = 0; day < 20; day += 1) {
    const objective = (await debugSnapshot(page)).onboardingObjectiveId;
    if (objective === 'journey-alchemy') break;
    if (objective === 'first-water') {
      await journey.tap();
      await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'first-harvest');
    }
    await journey.tap();
    if ((await debugSnapshot(page)).onboardingObjectiveId === 'journey-alchemy') break;
    const previousDay = (await debugSnapshot(page)).day;
    await rest.tap();
    await page.waitForFunction(before => ((window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.day ?? 0) > Number(before), previousDay);
    await clearIntroByTouch(page);
  }

  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'journey-alchemy');
  await clearIntroByTouch(page);
  await journey.tap();
  const inventorySurface = page.locator('[data-app-surface="inventory"]');
  await expect(inventorySurface).toBeVisible();
  await expect(inventorySurface.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
  await expect(inventorySurface.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  await expect(inventorySurface.locator('[data-inventory-tab="player"]')).toHaveCount(0);
  await expectFullyInsideViewport(page, inventorySurface.locator('[data-furnace-start="true"]'));
  await inventorySurface.locator('[data-craft-autofill="true"]').tap();
  await inventorySurface.locator('[data-furnace-start="true"]').tap();
  await expect(inventorySurface.getByText('首枚承雷丹已经出炉。')).toBeVisible();
  await page.locator('#flow-inventory-close').tap();
  await clearIntroByTouch(page);

  await expect(journey).toHaveText('开始教学天劫');
  await journey.tap();
  await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible();
  await expectFullyInsideViewport(page, page.locator('#flow-tribulation-primary'));
  await expectFullyInsideViewport(page, page.locator('#flow-tribulation-pause'));
  await page.locator('#flow-tribulation-pill-action').tap();
  await page.locator('#flow-tribulation-primary').tap();
  for (let bolt = 1; bolt <= 3; bolt += 1) {
    await expect(page.locator('#flow-tribulation-warning')).toContainText(`第 ${bolt}/3 雷`);
    await page.locator('#flow-tribulation-primary').tap();
  }

  await expect(page.locator('[data-app-surface="aftermath"]')).toBeVisible();
  await expect(page.locator('#flow-aftermath-result-heading')).toHaveText('三雷已过');
  await expectFullyInsideViewport(page, page.locator('#flow-aftermath-continue'));
  await page.locator('#flow-aftermath-continue').tap();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === 'journey-complete');
  await expect(journey).toBeDisabled();
});
