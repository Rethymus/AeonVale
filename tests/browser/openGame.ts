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

// 旧世界退役（docs/21 §8.16 阶段 2 第二步）：全部旧世界入口助手随
// enterLoadedLegacyWorld 测试门与 portfolio 主模式迁移一并退役
// （判定表见 docs/21 §8.21/§8.26）。

export function gameEntryPath(): string {
  const basePath = process.env.PLAYWRIGHT_GAME_BASE_PATH ?? '/';
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
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

export async function gameDebugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
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
