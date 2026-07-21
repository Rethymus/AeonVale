import type { Page } from '@playwright/test';

export interface CanvasPaintStats {
  sampled: number;
  painted: number;
  colors: number;
}

export interface CanvasPngSnapshot {
  dataUrl: string;
  width: number;
  height: number;
}

export interface AeonDebugSnapshot {
  debugSchemaVersion?: number;
  buildRevision?: string;
  legacyShortcutsEnabled?: boolean;
  flowScreen?: string;
  flowOverlay?: string | null;
  uiMode?: string;
  appSurface?: string;
  renderFrameCount?: number;
  viewportProfile?: string;
  canvasBounds?: { x: number; y: number; width: number; height: number } | null;
  worldBounds?: { x: number; y: number; width: number; height: number } | null;
  objectiveRailBounds?: { x: number; y: number; width: number; height: number } | null;
  hotbarIdx?: number;
  hotbarSlotKind?: string;
  hotbarSeedId?: string | null;
  locationIdx?: number;
  locationServiceIdx?: number;
  locationSelectionActive?: boolean;
  interactionPanelKind?: string;
  farmActionKind?: string;
  dialogueBeatId?: string | null;
  selectedLocationId?: string | null;
  selectedLocationServiceCommand?: string | null;
  postAscensionMode?: string;
  paused?: boolean;
  inventoryVisible?: boolean;
  cultivationPanelVisible?: boolean;
  shopIdx?: number;
  tradeIdx?: number;
  day?: number;
  season?: string;
  seasonDay?: number;
  playerHp?: number;
  playerStamina?: number;
  playerX?: number;
  playerY?: number;
  playerFacing?: string;
  playerVisualX?: number;
  playerVisualY?: number;
  playerMovementActive?: boolean;
  playerMovementProgress?: number;
  playerMovementQueueLength?: number;
  playerMovementFromX?: number | null;
  playerMovementFromY?: number | null;
  playerMovementToX?: number | null;
  playerMovementToY?: number | null;
  pendingWorldCommand?: string | null;
  pendingWorldTargetX?: number | null;
  pendingWorldTargetY?: number | null;
  pendingWorldDestinationX?: number | null;
  pendingWorldDestinationY?: number | null;
  tutorialTribulationPhase?: string;
  tutorialBoltIndex?: number;
  tutorialBoltCount?: number;
  tutorialWarnedTileId?: number | null;
  tutorialWarnedX?: number | null;
  tutorialWarnedY?: number | null;
  tutorialHitsBlocked?: number;
  tutorialPerfectBlockAvailable?: boolean;
  tutorialPillCount?: number;
  tutorialWardMitigation?: number;
  tutorialOutcome?: string | null;
  tutorialRewardMilli?: number;
  frontTileX?: number;
  frontTileY?: number;
  frontTileTilled?: boolean;
  frontTileCropId?: string | number | null;
  frontTileCropStage?: string | null;
  frontTileCropGrowth?: number;
  frontTileWateredToday?: boolean;
  frontTileMoisture?: number;
  frontTileFarmPlot?: boolean;
  frontSceneZoneKind?: string;
  frontSceneObjectKind?: string | null;
  frontSceneObjectAction?: string | null;
  pointerTileX?: number | null;
  pointerTileY?: number | null;
  lastPointerTileX?: number | null;
  lastPointerTileY?: number | null;
  lastPointerAction?: string;
  onboardingObjectiveId?: string | null;
  farmOnboardingObjectiveId?: string | null;
  helpText?: string;
  renderedHelpText?: string;
  dialogueBackdropVisible?: boolean;
  todayBriefingVisible?: boolean;
  panelPreviewVisible?: boolean;
  locationPreviewVisible?: boolean;
  locationPreviewTextBottom?: number | null;
  locationPreviewPanelBottom?: number | null;
  locationPreviewMaxTextBottom?: number | null;
  todayBriefingTitle?: string;
  todayBriefingBody?: string;
  todayBriefingAssetId?: string | null;
  starterMosslingSeedCount?: number;
  starterDewrootSeedCount?: number;
  starterMosslingHerbCount?: number;
  starterDewrootHerbCount?: number;
  starterSpiritStoneCount?: number;
  inventoryItemCount?: number;
  shippingItemId?: string | null;
  shippingBinItemCount?: number;
}

export interface GameEntryOptions {
  readonly legacyShortcuts?: boolean;
}

export function gameEntryPath(options: GameEntryOptions = {}): string {
  const basePath = process.env.PLAYWRIGHT_GAME_BASE_PATH ?? '/';
  const normalized = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return options.legacyShortcuts ? `${normalized}?legacyShortcuts=1` : normalized;
}

export async function waitForInitialSurface(page: Page): Promise<AeonDebugSnapshot> {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'attached' });
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: unknown }).__AEON_DEBUG__ != null);
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    const surface = debug?.appSurface;
    if (!surface) return false;
    const active = document.querySelector<HTMLElement>(`[data-app-surface="${surface}"]`);
    if (!active) return false;
    const style = window.getComputedStyle(active);
    return !active.hidden && active.getAttribute('aria-hidden') === 'false' && style.display !== 'none' && style.visibility !== 'hidden' && active.offsetWidth > 0 && active.offsetHeight > 0;
  });
  return gameDebugSnapshot(page);
}

export async function continueToWorld(page: Page): Promise<void> {
  const canvas = page.locator('canvas');

  const continueButton = page.locator('#flow-title-continue');
  const newGameButton = page.locator('#flow-title-new-game');
  if (await newGameButton.isVisible()) {
    if (await continueButton.isEnabled()) {
      await continueButton.click();
    } else {
      await newGameButton.click();
      await page.locator('#flow-prologue-skip').click();
    }
  }

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.appSurface === 'world' || (debug != null && debug.appSurface == null);
  });
  await canvas.waitFor({ state: 'visible' });
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport || box.y < 0 || box.y >= viewport.height) {
    throw new Error(`Game canvas starts outside the initial viewport: box=${JSON.stringify(box)}, viewport=${JSON.stringify(viewport)}`);
  }
  await canvas.focus();
}

export async function openGame(page: Page, options: GameEntryOptions = {}): Promise<void> {
  await page.goto(gameEntryPath(options));
  await waitForInitialSurface(page);
  await continueToWorld(page);
}

export async function gameDebugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

export async function clearIntroDialogue(page: Page): Promise<void> {
  await page.waitForTimeout(80);
  for (let i = 0; i < 6; i += 1) {
    const debug = await gameDebugSnapshot(page);
    if (debug.dialogueBeatId == null) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
  }
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.dialogueBeatId == null;
  });
}

export async function canvasPaintStats(page: Page): Promise<CanvasPaintStats> {
  const snapshot = await canvasPngSnapshot(page);
  if (!snapshot) return { sampled: 0, painted: 0, colors: 0 };
  return paintStatsFromDataUrl(page, snapshot.dataUrl);
}

export async function canvasPngSnapshot(page: Page): Promise<CanvasPngSnapshot | null> {
  const direct = await page.evaluate((): CanvasPngSnapshot | null => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) return null;
    try {
      return {
        dataUrl: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height
      };
    } catch {
      return null;
    }
  });
  if (direct?.dataUrl.startsWith('data:image/png;base64,')) {
    const directStats = await paintStatsFromDataUrl(page, direct.dataUrl);
    if (directStats.colors > 16) return direct;
  }

  const box = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width <= 0 || canvas.height <= 0) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!box) return null;
  const screenshot = await page.locator('canvas').screenshot({ animations: 'disabled' });
  return {
    dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    width: Math.round(box.width),
    height: Math.round(box.height)
  };
}

export async function renderedCanvasPngSnapshot(page: Page): Promise<CanvasPngSnapshot | null> {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box || box.width <= 0 || box.height <= 0) return null;

  const screenshot = await page.screenshot({ animations: 'disabled', scale: 'css', clip: box });
  if (screenshot.length < 24 || screenshot.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || screenshot.subarray(12, 16).toString('ascii') !== 'IHDR') return null;

  return {
    dataUrl: `data:image/png;base64,${screenshot.toString('base64')}`,
    width: screenshot.readUInt32BE(16),
    height: screenshot.readUInt32BE(20)
  };
}

export async function paintStatsFromDataUrl(page: Page, dataUrl: string): Promise<CanvasPaintStats> {
  return page.evaluate(async (src): Promise<CanvasPaintStats> => {
    const image = new Image();
    image.src = src;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('canvas screenshot failed to load'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { sampled: 0, painted: 0, colors: 0 };

    ctx.drawImage(image, 0, 0);
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const colors = new Set<string>();
    let sampled = 0;
    let painted = 0;
    const step = Math.max(6, Math.floor(Math.min(width, height) / 64));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const index = (y * width + x) * 4;
        const alpha = data[index + 3] ?? 0;
        sampled += 1;
        if (alpha > 16) {
          painted += 1;
          colors.add(`${data[index]},${data[index + 1]},${data[index + 2]},${alpha}`);
        }
      }
    }

    return { sampled, painted, colors: colors.size };
  }, dataUrl);
}
