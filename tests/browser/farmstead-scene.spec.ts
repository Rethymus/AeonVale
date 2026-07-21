import { expect, test, type Page } from '@playwright/test';
import { canvasPngSnapshot, clearIntroDialogue, gameDebugSnapshot, openGame, type AeonDebugSnapshot, type CanvasPngSnapshot } from './openGame';

const PLAYER_STEP_CANCEL_REGRESSION_MS = 280;

interface ClickFarmKeypoint {
  targetX: number;
  targetY: number;
  frontX: number;
  frontY: number;
}

interface JourneyReachableFarmTargetKeypoint {
  nearX: number;
  nearY: number;
  farX: number;
  farY: number;
}

interface TileSnapshot {
  tilled: boolean;
  cropId: number | null;
  blockType: string;
  playerX: number;
  playerY: number;
}

interface GroundItemKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
}

interface BuiltFacilityKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
}

interface BuildArrayKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
  arrayDefId: 'array.lightning-rod' | 'array.insulation';
}

interface ArraySnapshot {
  count: number;
  defIds: string[];
  activeCount: number;
}

interface NpcPreviewKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
  npcId: string;
  locationId: string;
}

interface LocationPreviewKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
  locationId: string;
}

interface LongLocationPreviewResult {
  textBottom: number;
  panelBottom: number;
  maxTextBottom: number;
  text: string;
}

interface GroundItemSnapshot {
  itemId: string;
  count: number;
}

type FarmsteadObjectKind = 'storage' | 'shipping' | 'furnace' | 'array-shed' | 'map-gate';

type TileCueRegion = 'border' | 'path-dot';

interface TileCueDiff {
  sampled: number;
  changedPixels: number;
  meanDelta: number;
  maxDelta: number;
}

interface PendingWorldCueFrame {
  debug: AeonDebugSnapshot;
  snapshot: CanvasPngSnapshot;
}

async function configureObjectKeypoint(page: Page, kind: string): Promise<boolean> {
  return page.evaluate(objectKind => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureFarmsteadObjectKeypoint?: (kind?: string) => boolean };
    };
    return target.__AEON_TEST__?.configureFarmsteadObjectKeypoint?.(objectKind) ?? false;
  }, kind);
}

async function configureNonPlotKeypoint(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureFarmsteadNonPlotKeypoint?: () => boolean };
    };
    return target.__AEON_TEST__?.configureFarmsteadNonPlotKeypoint?.() ?? false;
  });
}

async function configureClickFarmKeypoint(page: Page): Promise<ClickFarmKeypoint> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureFarmsteadClickFarmKeypoint?: () => ClickFarmKeypoint | null };
    };
    return target.__AEON_TEST__?.configureFarmsteadClickFarmKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureJourneyReachableFarmTargetKeypoint(page: Page): Promise<JourneyReachableFarmTargetKeypoint> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureJourneyReachableFarmTargetKeypoint?: () => JourneyReachableFarmTargetKeypoint | null };
    };
    return target.__AEON_TEST__?.configureJourneyReachableFarmTargetKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureGroundItemClickKeypoint(page: Page): Promise<GroundItemKeypoint> {
  await page.waitForFunction(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureGroundItemClickKeypoint?: () => GroundItemKeypoint | null };
    };
    return typeof target.__AEON_TEST__?.configureGroundItemClickKeypoint === 'function';
  });
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureGroundItemClickKeypoint?: () => GroundItemKeypoint | null };
    };
    return target.__AEON_TEST__?.configureGroundItemClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureBuiltFacilityClickKeypoint(page: Page): Promise<BuiltFacilityKeypoint> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureBuiltFacilityClickKeypoint?: () => BuiltFacilityKeypoint | null };
    };
    return target.__AEON_TEST__?.configureBuiltFacilityClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureBuildArrayKeypoint(page: Page, kind: 'lightning-rod' | 'insulation', preservePanel = false): Promise<BuildArrayKeypoint> {
  const configured = await page.evaluate(input => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureBuildArrayKeypoint?: (kind?: 'lightning-rod' | 'insulation', preservePanel?: boolean) => BuildArrayKeypoint | null };
    };
    return target.__AEON_TEST__?.configureBuildArrayKeypoint?.(input.kind, input.preservePanel) ?? null;
  }, { kind, preservePanel });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureNpcPreviewClickKeypoint(page: Page): Promise<NpcPreviewKeypoint> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureNpcPreviewClickKeypoint?: () => NpcPreviewKeypoint | null };
    };
    return target.__AEON_TEST__?.configureNpcPreviewClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function configureLocationPreviewClickKeypoint(page: Page): Promise<LocationPreviewKeypoint> {
  const configured = await page.evaluate(() => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureLocationPreviewClickKeypoint?: () => LocationPreviewKeypoint | null };
    };
    return target.__AEON_TEST__?.configureLocationPreviewClickKeypoint?.() ?? null;
  });
  expect(configured).not.toBeNull();
  return configured!;
}

async function showLongLocationPreviewForTest(page: Page, withTexture: boolean): Promise<LongLocationPreviewResult> {
  const result = await page.evaluate(input => {
    const target = window as typeof window & {
      __AEON_TEST__?: { showLongLocationPreviewForTest?: (withTexture?: boolean) => LongLocationPreviewResult | null };
    };
    return target.__AEON_TEST__?.showLongLocationPreviewForTest?.(input.withTexture) ?? null;
  }, { withTexture });
  expect(result).not.toBeNull();
  return result!;
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

async function farmsteadObjectTile(page: Page, kind: string): Promise<{ x: number; y: number }> {
  const point = await page.evaluate(objectKind => {
    const target = window as typeof window & {
      __AEON_TEST__?: { farmsteadObjectTile?: (kind?: string) => { x: number; y: number } | null };
    };
    return target.__AEON_TEST__?.farmsteadObjectTile?.(objectKind) ?? null;
  }, kind);
  expect(point).not.toBeNull();
  return point!;
}

async function tileSnapshot(page: Page, x: number, y: number): Promise<TileSnapshot> {
  const snapshot = await page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_TEST__?: { tileSnapshot?: (x: number, y: number) => TileSnapshot | null };
      };
      return target.__AEON_TEST__?.tileSnapshot?.(input.x, input.y) ?? null;
    },
    { x, y }
  );
  expect(snapshot).not.toBeNull();
  return snapshot!;
}

async function groundItemSnapshot(page: Page, x: number, y: number): Promise<GroundItemSnapshot | null> {
  return page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_TEST__?: { groundItemSnapshot?: (x: number, y: number) => GroundItemSnapshot | null };
      };
      return target.__AEON_TEST__?.groundItemSnapshot?.(input.x, input.y) ?? null;
    },
    { x, y }
  );
}

async function arraySnapshot(page: Page, x: number, y: number): Promise<ArraySnapshot | null> {
  return page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_TEST__?: { arraySnapshot?: (x: number, y: number) => ArraySnapshot | null };
      };
      return target.__AEON_TEST__?.arraySnapshot?.(input.x, input.y) ?? null;
    },
    { x, y }
  );
}

async function clickFarmsteadObject(page: Page, kind: FarmsteadObjectKind): Promise<{ x: number; y: number }> {
  expect(await configureObjectKeypoint(page, kind)).toBe(true);
  const objectTile = await farmsteadObjectTile(page, kind);
  const objectPoint = await canvasPointForTile(page, objectTile.x, objectTile.y);
  await page.locator('canvas').click({ position: objectPoint });
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.lastPointerAction === 'object' && debug.lastPointerTileX === input.x && debug.lastPointerTileY === input.y && debug.playerMovementActive === false;
    },
    { x: objectTile.x, y: objectTile.y }
  );
  return objectTile;
}

async function clickArrayShedAndWaitForBuildPanel(page: Page): Promise<{ x: number; y: number }> {
  expect(await configureObjectKeypoint(page, 'array-shed')).toBe(true);
  const objectTile = await farmsteadObjectTile(page, 'array-shed');
  const objectPoint = await canvasPointForTile(page, objectTile.x, objectTile.y);
  await page.locator('canvas').click({ position: objectPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.interactionPanelKind === 'build' && debug.playerMovementActive === false;
  });
  return objectTile;
}

async function waitForAnimatedPointerCommand(page: Page, description: string): Promise<AeonDebugSnapshot> {
  const handle = await page.waitForFunction(commandDescription => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    if (
      debug?.pendingWorldCommand === commandDescription &&
      debug.playerMovementActive === true &&
      debug.playerMovementFromX != null &&
      debug.playerMovementFromY != null &&
      debug.playerMovementToX != null &&
      debug.playerMovementToY != null
    ) {
      return debug;
    }
    return null;
  }, description);
  const snapshot = (await handle.jsonValue()) as AeonDebugSnapshot;
  await handle.dispose();
  return snapshot;
}

async function pressRealKeyDuringAnimatedPointerCommand(page: Page, description: string, key: string): Promise<AeonDebugSnapshot> {
  const handle = await page.waitForFunction(commandDescription => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    const progress = debug?.playerMovementProgress ?? 0;
    if (
      debug?.pendingWorldCommand === commandDescription &&
      debug.playerMovementActive === true &&
      debug.playerMovementFromX != null &&
      debug.playerMovementFromY != null &&
      debug.playerMovementToX != null &&
      debug.playerMovementToY != null &&
      progress > 0 &&
      progress < 0.85
    ) {
      return debug;
    }
    return null;
  }, description);
  const snapshot = (await handle.jsonValue()) as AeonDebugSnapshot;
  await handle.dispose();
  await page.keyboard.press(key);
  return snapshot;
}

async function armKeyPressOnAnimatedPointerCommand(page: Page, description: string, key: string): Promise<void> {
  await page.evaluate(
    input => {
      const target = window as typeof window & {
        __AEON_DEBUG__?: AeonDebugSnapshot;
        __AEON_TEST_KEYDOWN_SNAPSHOT__?: AeonDebugSnapshot | null;
      };
      target.__AEON_TEST_KEYDOWN_SNAPSHOT__ = null;
      const tick = (): void => {
        const debug = target.__AEON_DEBUG__;
        const progress = debug?.playerMovementProgress ?? 0;
        if (
          debug?.pendingWorldCommand === input.description &&
          debug.playerMovementActive === true &&
          debug.playerMovementFromX != null &&
          debug.playerMovementFromY != null &&
          debug.playerMovementToX != null &&
          debug.playerMovementToY != null &&
          progress > 0 &&
          progress < 1
        ) {
          target.__AEON_TEST_KEYDOWN_SNAPSHOT__ = { ...debug };
          window.dispatchEvent(new KeyboardEvent('keydown', { key: input.key, bubbles: true, cancelable: true }));
          return;
        }
        window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    },
    { description, key }
  );
}

async function armRightClickOnAnimatedPointerCommand(page: Page, description: string): Promise<void> {
  await page.evaluate(input => {
    const target = window as typeof window & {
      __AEON_DEBUG__?: AeonDebugSnapshot;
      __AEON_TEST_RIGHT_CLICK_SNAPSHOT__?: AeonDebugSnapshot | null;
    };
    target.__AEON_TEST_RIGHT_CLICK_SNAPSHOT__ = null;
    const tick = (): void => {
      const debug = target.__AEON_DEBUG__;
      const progress = debug?.playerMovementProgress ?? 0;
      if (
        debug?.pendingWorldCommand === input.description &&
        debug.playerMovementActive === true &&
        debug.playerMovementFromX != null &&
        debug.playerMovementFromY != null &&
        debug.playerMovementToX != null &&
        debug.playerMovementToY != null &&
        progress > 0 &&
        progress < 1
      ) {
        const canvas = document.querySelector('canvas');
        const rect = canvas?.getBoundingClientRect();
        if (!canvas || !rect) return;
        target.__AEON_TEST_RIGHT_CLICK_SNAPSHOT__ = { ...debug };
        canvas.dispatchEvent(
          new PointerEvent('pointerdown', {
            button: 2,
            buttons: 2,
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            pointerId: 91,
            pointerType: 'mouse'
          })
        );
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }, { description });
}

async function keyPressTriggerSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  const handle = await page.waitForFunction(() => {
    const target = window as typeof window & { __AEON_TEST_KEYDOWN_SNAPSHOT__?: AeonDebugSnapshot | null };
    return target.__AEON_TEST_KEYDOWN_SNAPSHOT__ ?? null;
  });
  const snapshot = (await handle.jsonValue()) as AeonDebugSnapshot;
  await handle.dispose();
  return snapshot;
}

async function rightClickTriggerSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  const handle = await page.waitForFunction(() => {
    const target = window as typeof window & { __AEON_TEST_RIGHT_CLICK_SNAPSHOT__?: AeonDebugSnapshot | null };
    return target.__AEON_TEST_RIGHT_CLICK_SNAPSHOT__ ?? null;
  });
  const snapshot = (await handle.jsonValue()) as AeonDebugSnapshot;
  await handle.dispose();
  return snapshot;
}

async function captureCanvasFrame(page: Page): Promise<CanvasPngSnapshot> {
  const snapshot = await canvasPngSnapshot(page);
  expect(snapshot).not.toBeNull();
  return snapshot!;
}

async function waitForPendingWorldCueFrame(page: Page, description: string): Promise<PendingWorldCueFrame> {
  const handle = await page.waitForFunction(commandDescription => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    const canvas = document.querySelector('canvas');
    if (
      debug?.pendingWorldCommand === commandDescription &&
      debug.pendingWorldDestinationX != null &&
      debug.pendingWorldDestinationY != null &&
      debug.playerMovementActive === true &&
      canvas instanceof HTMLCanvasElement &&
      canvas.width > 0 &&
      canvas.height > 0
    ) {
      return {
        debug: { ...debug },
        snapshot: {
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height
        }
      };
    }
    return null;
  }, description);
  const frame = (await handle.jsonValue()) as PendingWorldCueFrame;
  await handle.dispose();
  return frame;
}

async function tileCueDifference(page: Page, before: CanvasPngSnapshot, after: CanvasPngSnapshot, x: number, y: number, region: TileCueRegion): Promise<TileCueDiff> {
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
  return page.evaluate(
    async input => {
      const loadImage = async (src: string): Promise<HTMLImageElement> => {
        const image = new Image();
        image.src = src;
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('canvas frame failed to load'));
        });
        return image;
      };
      const canvas = document.querySelector('canvas');
      const localPoint = (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__?.canvasPointForTile?.(input.x, input.y);
      if (!(canvas instanceof HTMLCanvasElement) || !localPoint) return { sampled: 0, changedPixels: 0, meanDelta: 0, maxDelta: 0 };

      const beforeImage = await loadImage(input.beforeDataUrl);
      const afterImage = await loadImage(input.afterDataUrl);
      const width = beforeImage.naturalWidth;
      const height = beforeImage.naturalHeight;
      if (width <= 0 || height <= 0 || afterImage.naturalWidth !== width || afterImage.naturalHeight !== height) return { sampled: 0, changedPixels: 0, meanDelta: 0, maxDelta: 0 };

      const work = document.createElement('canvas');
      work.width = width;
      work.height = height;
      const ctx = work.getContext('2d');
      if (!ctx) return { sampled: 0, changedPixels: 0, meanDelta: 0, maxDelta: 0 };

      ctx.drawImage(beforeImage, 0, 0);
      const beforeData = ctx.getImageData(0, 0, width, height).data;
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(afterImage, 0, 0);
      const afterData = ctx.getImageData(0, 0, width, height).data;

      const rect = canvas.getBoundingClientRect();
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const nextPoint =
        (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__?.canvasPointForTile?.(input.x + 1, input.y) ??
        (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__?.canvasPointForTile?.(input.x - 1, input.y);
      const belowPoint =
        (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__?.canvasPointForTile?.(input.x, input.y + 1) ??
        (window as typeof window & { __AEON_TEST__?: { canvasPointForTile?: (x: number, y: number) => { x: number; y: number } | null } }).__AEON_TEST__?.canvasPointForTile?.(input.x, input.y - 1);
      const tileW = Math.max(8, Math.abs(((nextPoint?.x ?? localPoint.x + 42) - localPoint.x) * scaleX));
      const tileH = Math.max(8, Math.abs(((belowPoint?.y ?? localPoint.y + 42) - localPoint.y) * scaleY));
      const cx = Math.round(localPoint.x * scaleX);
      const cy = Math.round(localPoint.y * scaleY);
      const left = Math.max(0, Math.round(cx - tileW / 2));
      const right = Math.min(width - 1, Math.round(cx + tileW / 2));
      const top = Math.max(0, Math.round(cy - tileH / 2));
      const bottom = Math.min(height - 1, Math.round(cy + tileH / 2));
      const points: Array<[number, number]> = [];

      if (input.region === 'border') {
        const borderInset = Math.max(2, Math.round(Math.min(tileW, tileH) * 0.08));
        const step = Math.max(1, Math.round(Math.min(tileW, tileH) / 18));
        for (let px = left + borderInset; px <= right - borderInset; px += step) {
          points.push([px, top + borderInset], [px, bottom - borderInset]);
        }
        for (let py = top + borderInset; py <= bottom - borderInset; py += step) {
          points.push([left + borderInset, py], [right - borderInset, py]);
        }
      } else {
        const dotCx = cx;
        const dotCy = Math.round(cy + tileH / 2 - 8 * scaleY);
        const radius = Math.max(4, Math.round(Math.min(tileW, tileH) * 0.18));
        for (let py = dotCy - radius; py <= dotCy + radius; py += 1) {
          for (let px = dotCx - radius; px <= dotCx + radius; px += 1) {
            const dx = px - dotCx;
            const dy = py - dotCy;
            if (dx * dx + dy * dy <= radius * radius) points.push([px, py]);
          }
        }
      }

      let sampled = 0;
      let changedPixels = 0;
      let totalDelta = 0;
      let maxDelta = 0;
      for (const [px, py] of points) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const index = (py * width + px) * 4;
        const delta =
          Math.abs((afterData[index] ?? 0) - (beforeData[index] ?? 0)) +
          Math.abs((afterData[index + 1] ?? 0) - (beforeData[index + 1] ?? 0)) +
          Math.abs((afterData[index + 2] ?? 0) - (beforeData[index + 2] ?? 0)) +
          Math.abs((afterData[index + 3] ?? 0) - (beforeData[index + 3] ?? 0));
        sampled += 1;
        totalDelta += delta;
        maxDelta = Math.max(maxDelta, delta);
        if (delta > 20) changedPixels += 1;
      }

      return {
        sampled,
        changedPixels,
        meanDelta: sampled > 0 ? totalDelta / sampled : 0,
        maxDelta
      };
    },
    {
      beforeDataUrl: before.dataUrl,
      afterDataUrl: after.dataUrl,
      x,
      y,
      region
    }
  );
}

const farmsteadConfirmExpectations: Array<{
  kind: FarmsteadObjectKind;
  actionLabel: string;
  assertOpened: (page: Page) => Promise<void>;
}> = [
  {
    kind: 'storage',
    actionLabel: '整理仓储',
    assertOpened: async page => {
      expect((await gameDebugSnapshot(page)).interactionPanelKind).toBe('storage');
    }
  },
  {
    kind: 'shipping',
    actionLabel: '出货',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.interactionPanelKind).toBe('shipping');
      expect(debug.shippingItemId).toBe('herb.mossling');
    }
  },
  {
    kind: 'furnace',
    actionLabel: '炼丹',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.flowOverlay).toBe('inventory');
      expect(debug.appSurface).toBe('inventory');
      await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
      await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
      await expect(page.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-inventory-tab="player"]')).toHaveCount(0);
    }
  },
  {
    kind: 'array-shed',
    actionLabel: '建造/布阵',
    assertOpened: async page => {
      expect((await gameDebugSnapshot(page)).interactionPanelKind).toBe('build');
    }
  },
  {
    kind: 'map-gate',
    actionLabel: '外出',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.locationSelectionActive).toBe(true);
      expect(debug.locationPreviewVisible).toBe(true);
      expect(debug.interactionPanelKind).toBe('none');
    }
  }
];

for (const expectation of farmsteadConfirmExpectations) {
  test(`farmstead ${expectation.kind} is a real front-object interaction on confirm`, async ({ page }) => {
    await openGame(page);
    await clearIntroDialogue(page);

    expect(await configureObjectKeypoint(page, expectation.kind)).toBe(true);
    const before = await gameDebugSnapshot(page);
    expect(before.frontSceneObjectKind).toBe(expectation.kind);
    expect(before.frontSceneObjectAction).toBe(expectation.actionLabel);

    await page.keyboard.press('Enter');
    await page.waitForFunction(
      input => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
        if (input.kind === 'storage') return debug?.interactionPanelKind === 'storage';
        if (input.kind === 'shipping') return debug?.interactionPanelKind === 'shipping';
        if (input.kind === 'furnace') return debug?.flowOverlay === 'inventory' && debug.appSurface === 'inventory';
        if (input.kind === 'array-shed') return debug?.interactionPanelKind === 'build';
        return debug?.locationSelectionActive === true;
      },
      { kind: expectation.kind }
    );

    await expectation.assertOpened(page);
    expect((await gameDebugSnapshot(page)).frontSceneObjectKind).toBe(expectation.kind);
  });
}

test('confirming a non-plot courtyard tile does not till it through the hotbar fallback', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  expect(await configureNonPlotKeypoint(page)).toBe(true);
  const before = await gameDebugSnapshot(page);
  expect(before.frontTileFarmPlot).toBe(false);
  expect(before.frontSceneObjectKind).toBeNull();
  expect(before.frontTileTilled).toBe(false);
  expect(before.hotbarSlotKind).toBe('till');

  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);

  const after = await gameDebugSnapshot(page);
  expect(after.frontTileFarmPlot).toBe(false);
  expect(after.frontSceneObjectKind).toBeNull();
  expect(after.frontTileTilled).toBe(false);
  expect(after.frontTileX).toBe(before.frontTileX);
  expect(after.frontTileY).toBe(before.frontTileY);
});

test('clicking a farm tile walks beside it before acting on the clicked tile', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureClickFarmKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const beforeTarget = await tileSnapshot(page, keypoint.targetX, keypoint.targetY);
  const beforeFront = await tileSnapshot(page, keypoint.frontX, keypoint.frontY);
  expect(beforeTarget.tilled).toBe(false);
  expect(beforeFront.tilled).toBe(false);

  await page.locator('canvas').click({ position: targetPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.lastPointerAction === 'farm-till' || (debug?.pendingWorldCommand === '照料灵田' && debug.playerMovementActive === true);
  });
  const during = await gameDebugSnapshot(page);
  if (during.pendingWorldTargetX != null && during.pendingWorldDestinationX != null && during.pendingWorldDestinationY != null) {
    expect(during.pendingWorldTargetX).toBe(keypoint.targetX);
    expect(during.pendingWorldTargetY).toBe(keypoint.targetY);
    expect(Math.abs(during.pendingWorldDestinationX - keypoint.targetX) + Math.abs(during.pendingWorldDestinationY - keypoint.targetY)).toBe(1);
  }
  const duringMoveTarget = await tileSnapshot(page, keypoint.targetX, keypoint.targetY);
  if (during.pendingWorldCommand === '照料灵田' && during.playerMovementActive === true) expect(duringMoveTarget.tilled).toBe(false);
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.lastPointerAction === 'farm-till';
  });

  const afterTarget = await tileSnapshot(page, keypoint.targetX, keypoint.targetY);
  const afterFront = await tileSnapshot(page, keypoint.frontX, keypoint.frontY);
  expect(afterTarget.tilled).toBe(true);
  expect(afterFront.tilled).toBe(false);
  const debug = await gameDebugSnapshot(page);
  expect(debug.lastPointerTileX).toBe(keypoint.targetX);
  expect(debug.lastPointerTileY).toBe(keypoint.targetY);
  expect(Math.abs((debug.playerX ?? -99) - keypoint.targetX) + Math.abs((debug.playerY ?? -99) - keypoint.targetY)).toBe(1);
  const expectedFacing = debug.playerX! < keypoint.targetX ? 'right' : debug.playerX! > keypoint.targetX ? 'left' : debug.playerY! < keypoint.targetY ? 'down' : 'up';
  expect(debug.playerFacing).toBe(expectedFacing);
});

test('journey action chooses a reachable farm target over a closer blocked candidate', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureJourneyReachableFarmTargetKeypoint(page);
  const beforeNear = await tileSnapshot(page, keypoint.nearX, keypoint.nearY);
  const beforeFar = await tileSnapshot(page, keypoint.farX, keypoint.farY);
  expect(beforeNear.tilled).toBe(false);
  expect(beforeFar.tilled).toBe(false);

  await page.locator('#world-journey-action').click();
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return (
        (debug?.pendingWorldCommand === '照料灵田' && debug.pendingWorldTargetX === input.farX && debug.pendingWorldTargetY === input.farY) ||
        (debug?.lastPointerAction === 'farm-till' && debug.lastPointerTileX === input.farX && debug.lastPointerTileY === input.farY)
      );
    },
    { farX: keypoint.farX, farY: keypoint.farY }
  );

  const during = await gameDebugSnapshot(page);
  expect(during.lastPointerAction).not.toBe('blocked');
  if (during.pendingWorldCommand === '照料灵田') {
    expect(during.pendingWorldTargetX).toBe(keypoint.farX);
    expect(during.pendingWorldTargetY).toBe(keypoint.farY);
    expect(`${during.pendingWorldTargetX},${during.pendingWorldTargetY}`).not.toBe(`${keypoint.nearX},${keypoint.nearY}`);
  }

  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.lastPointerAction === 'farm-till' && debug.lastPointerTileX === input.farX && debug.lastPointerTileY === input.farY;
    },
    { farX: keypoint.farX, farY: keypoint.farY }
  );

  const afterNear = await tileSnapshot(page, keypoint.nearX, keypoint.nearY);
  const afterFar = await tileSnapshot(page, keypoint.farX, keypoint.farY);
  expect(afterNear.tilled).toBe(false);
  expect(afterFar.tilled).toBe(true);
});

test('pointer hover and queued walking render visible target and path cues', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureClickFarmKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const baseline = await captureCanvasFrame(page);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + targetPoint.x, box!.y + targetPoint.y);
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.pointerTileX === input.x && debug.pointerTileY === input.y;
    },
    { x: keypoint.targetX, y: keypoint.targetY }
  );
  const hoverFrame = await captureCanvasFrame(page);
  const hoverDiff = await tileCueDifference(page, baseline, hoverFrame, keypoint.targetX, keypoint.targetY, 'border');
  expect(hoverDiff.sampled).toBeGreaterThan(40);
  expect(hoverDiff.changedPixels).toBeGreaterThan(12);
  expect(hoverDiff.maxDelta).toBeGreaterThan(30);

  await canvas.click({ position: targetPoint });
  const { debug: during, snapshot: pendingFrame } = await waitForPendingWorldCueFrame(page, '照料灵田');
  const pendingDestinationX = during.pendingWorldDestinationX;
  const pendingDestinationY = during.pendingWorldDestinationY;
  if (pendingDestinationX == null || pendingDestinationY == null) throw new Error('Missing pending world destination');
  expect(during.pendingWorldTargetX).toBe(keypoint.targetX);
  expect(during.pendingWorldTargetY).toBe(keypoint.targetY);

  const targetDiff = await tileCueDifference(page, hoverFrame, pendingFrame, keypoint.targetX, keypoint.targetY, 'border');
  const pathDiff = await tileCueDifference(page, hoverFrame, pendingFrame, pendingDestinationX, pendingDestinationY, 'path-dot');
  expect(targetDiff.changedPixels).toBeGreaterThan(18);
  expect(targetDiff.maxDelta).toBeGreaterThan(30);
  expect(pathDiff.sampled).toBeGreaterThan(40);
  expect(pathDiff.changedPixels).toBeGreaterThan(10);
  expect(pathDiff.maxDelta).toBeGreaterThan(30);
});

test('pointer hover marks ground item pickup as actionable', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureGroundItemClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const baseline = await captureCanvasFrame(page);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + targetPoint.x, box!.y + targetPoint.y);
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.pointerTileX === input.x && debug.pointerTileY === input.y;
    },
    { x: keypoint.targetX, y: keypoint.targetY }
  );

  const hoverFrame = await captureCanvasFrame(page);
  const hoverDiff = await tileCueDifference(page, baseline, hoverFrame, keypoint.targetX, keypoint.targetY, 'border');
  expect(hoverDiff.sampled).toBeGreaterThan(40);
  expect(hoverDiff.changedPixels).toBeGreaterThan(12);
  expect(hoverDiff.maxDelta).toBeGreaterThan(30);
});

test('pointer hover marks built facilities as actionable', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureBuiltFacilityClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const baseline = await captureCanvasFrame(page);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + targetPoint.x, box!.y + targetPoint.y);
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.pointerTileX === input.x && debug.pointerTileY === input.y;
    },
    { x: keypoint.targetX, y: keypoint.targetY }
  );

  const hoverFrame = await captureCanvasFrame(page);
  const hoverDiff = await tileCueDifference(page, baseline, hoverFrame, keypoint.targetX, keypoint.targetY, 'border');
  expect(hoverDiff.sampled).toBeGreaterThan(40);
  expect(hoverDiff.changedPixels).toBeGreaterThan(12);
  expect(hoverDiff.maxDelta).toBeGreaterThan(30);
});

test('pointer hover marks npc previews as actionable', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureNpcPreviewClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const baseline = await captureCanvasFrame(page);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + targetPoint.x, box!.y + targetPoint.y);
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.pointerTileX === input.x && debug.pointerTileY === input.y;
    },
    { x: keypoint.targetX, y: keypoint.targetY }
  );

  const hoverFrame = await captureCanvasFrame(page);
  const hoverDiff = await tileCueDifference(page, baseline, hoverFrame, keypoint.targetX, keypoint.targetY, 'border');
  expect(hoverDiff.sampled).toBeGreaterThan(40);
  expect(hoverDiff.changedPixels).toBeGreaterThan(12);
  expect(hoverDiff.maxDelta).toBeGreaterThan(30);
});

test('clicking an npc preview opens that npc without falling through to tile actions', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureNpcPreviewClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);

  await page.locator('canvas').click({ position: targetPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.interactionPanelKind === 'npc' && debug.lastPointerAction === 'object' && debug.playerMovementActive === false;
  });

  const debug = await gameDebugSnapshot(page);
  expect(debug.interactionPanelKind).toBe('npc');
  expect(debug.locationSelectionActive).toBe(false);
  expect(debug.lastPointerTileX).toBe(keypoint.targetX);
  expect(debug.lastPointerTileY).toBe(keypoint.targetY);
  expect(debug.playerX).toBe(keypoint.playerX);
  expect(debug.playerY).toBe(keypoint.playerY);
});

test('clicking a location preview focuses the location instead of moving or farming', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureLocationPreviewClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);

  await page.locator('canvas').click({ position: targetPoint });
  await page.waitForFunction(
    input => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.locationSelectionActive === true && debug.selectedLocationId === input.locationId && debug.lastPointerAction === 'object' && debug.playerMovementActive === false;
    },
    { locationId: keypoint.locationId }
  );

  const debug = await gameDebugSnapshot(page);
  expect(debug.locationSelectionActive).toBe(true);
  expect(debug.selectedLocationId).toBe(keypoint.locationId);
  expect(debug.interactionPanelKind).toBe('none');
  expect(debug.lastPointerTileX).toBe(keypoint.targetX);
  expect(debug.lastPointerTileY).toBe(keypoint.targetY);
  expect(debug.playerX).toBe(keypoint.playerX);
  expect(debug.playerY).toBe(keypoint.playerY);
  await expect(page.locator('#world-command-bar')).toBeHidden();
  await expect(page.locator('#world-location-command-bar')).toBeVisible();
  await expect(page.locator('#objective-rail')).toBeVisible();

  await page.locator('#world-location-command-bar [data-game-command="cancel"]').click();
  await page.waitForFunction(() => {
    const current = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return current?.locationSelectionActive === false && current.locationPreviewVisible === false;
  });
  await expect(page.locator('#world-location-command-bar')).toBeHidden();
  await expect(page.locator('#world-command-bar')).toBeVisible();
});

test('long location preview copy stays inside the canvas panel in Chromium', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  for (const withTexture of [false, true]) {
    const result = await showLongLocationPreviewForTest(page, withTexture);
    expect(result.text).toContain('…');
    expect(result.textBottom).toBeLessThanOrEqual(result.maxTextBottom + 1);
    expect(result.panelBottom).toBeLessThanOrEqual(result.maxTextBottom + 17);

    const debug = await gameDebugSnapshot(page);
    expect(debug.locationPreviewVisible).toBe(true);
    expect(debug.locationPreviewTextBottom).not.toBeNull();
    expect(debug.locationPreviewPanelBottom).not.toBeNull();
    expect(debug.locationPreviewMaxTextBottom).not.toBeNull();
    expect(debug.locationPreviewTextBottom!).toBeLessThanOrEqual(debug.locationPreviewMaxTextBottom! + 1);
    expect(debug.locationPreviewPanelBottom!).toBeLessThanOrEqual(debug.locationPreviewMaxTextBottom! + 17);
    await expect(page.locator('canvas')).toBeVisible();
  }
});

test('clicking canvas chrome outside the map does not confirm the front action', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureClickFarmKeypoint(page);
  const beforeFront = await tileSnapshot(page, keypoint.frontX, keypoint.frontY);
  const before = await gameDebugSnapshot(page);
  expect(before.hotbarSlotKind).toBe('till');
  expect(beforeFront.tilled).toBe(false);

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await canvas.click({ position: { x: box!.width - 5, y: box!.height - 5 } });
  await page.waitForTimeout(120);

  const afterFront = await tileSnapshot(page, keypoint.frontX, keypoint.frontY);
  const after = await gameDebugSnapshot(page);
  expect(afterFront.tilled).toBe(false);
  expect(after.playerX).toBe(before.playerX);
  expect(after.playerY).toBe(before.playerY);
  expect(after.lastPointerAction).toBe('none');
  expect(after.lastPointerTileX).toBeNull();
  expect(after.lastPointerTileY).toBeNull();
});

test('opening inventory while walking cancels the pending pointer command', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureGroundItemClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

  await armKeyPressOnAnimatedPointerCommand(page, '拾取', 'b');
  await page.locator('canvas').click({ position: targetPoint });
  const during = await keyPressTriggerSnapshot(page);
  expect(during.playerX).toBe(during.playerMovementFromX);
  expect(during.playerY).toBe(during.playerMovementFromY);
  expect(during.playerMovementToX).not.toBeNull();
  expect(during.playerMovementToY).not.toBeNull();
  expect(Math.abs((during.playerVisualX ?? during.playerX ?? 0) - (during.playerX ?? 0)) + Math.abs((during.playerVisualY ?? during.playerY ?? 0) - (during.playerY ?? 0))).toBeGreaterThan(0);

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.flowOverlay === 'inventory' && debug.playerMovementActive === false && debug.pendingWorldCommand == null;
  });
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

  await page.keyboard.press('b');
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug != null && debug.flowOverlay == null && debug.appSurface === 'world';
  });
  await page.waitForTimeout(PLAYER_STEP_CANCEL_REGRESSION_MS);

  const after = await gameDebugSnapshot(page);
  expect(after.playerMovementActive).toBe(false);
  expect(after.pendingWorldCommand).toBeNull();
  expect(after.playerX).toBe(during.playerX);
  expect(after.playerY).toBe(during.playerY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });
});

for (const input of [
  { key: 'b', overlay: 'inventory', closeKey: 'b' },
  { key: 'Escape', overlay: 'pause', closeKey: 'Escape' }
] as const) {
  test(`pressing ${input.key} while walking cancels pending pointer command and restores canvas focus`, async ({ page }) => {
    await openGame(page);
    await clearIntroDialogue(page);

    const keypoint = await configureGroundItemClickKeypoint(page);
    const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
    const canvas = page.locator('canvas');
    await canvas.focus();
    expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

    await canvas.click({ position: targetPoint });
    const during = await pressRealKeyDuringAnimatedPointerCommand(page, '拾取', input.key);
    await page.waitForFunction(expectedOverlay => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug?.flowOverlay === expectedOverlay && debug.playerMovementActive === false && debug.pendingWorldCommand == null;
    }, input.overlay);

    const opened = await gameDebugSnapshot(page);
    expect(opened.pendingWorldCommand).toBeNull();
    expect(opened.pendingWorldTargetX).toBeNull();
    expect(opened.pendingWorldDestinationX).toBeNull();

    await page.keyboard.press(input.closeKey);
    await page.waitForFunction(() => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
      return debug != null && debug.flowOverlay == null && debug.appSurface === 'world';
    });
    expect(await page.evaluate(() => document.activeElement?.id)).toBe('game-canvas');
    await page.waitForTimeout(PLAYER_STEP_CANCEL_REGRESSION_MS);

    const after = await gameDebugSnapshot(page);
    expect(after.playerMovementActive).toBe(false);
    expect(after.pendingWorldCommand).toBeNull();
    const allowedPositions = [
      { x: during.playerX, y: during.playerY },
      { x: during.playerMovementToX, y: during.playerMovementToY }
    ];
    expect(allowedPositions).toContainEqual({ x: after.playerX, y: after.playerY });
    expect({ x: after.playerX, y: after.playerY }).not.toEqual({ x: keypoint.targetX, y: keypoint.targetY });
    expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });
  });
}

test('pressing Escape while walking opens pause without resuming the stale pointer command', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureGroundItemClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

  await armKeyPressOnAnimatedPointerCommand(page, '拾取', 'Escape');
  await page.locator('canvas').click({ position: targetPoint });
  const during = await keyPressTriggerSnapshot(page);
  expect(during.playerX).toBe(during.playerMovementFromX);
  expect(during.playerY).toBe(during.playerMovementFromY);

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.flowOverlay === 'pause' && debug.playerMovementActive === false && debug.pendingWorldCommand == null;
  });

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug != null && debug.flowOverlay == null && debug.appSurface === 'world';
  });
  await page.waitForTimeout(PLAYER_STEP_CANCEL_REGRESSION_MS);

  const after = await gameDebugSnapshot(page);
  expect(after.playerMovementActive).toBe(false);
  expect(after.pendingWorldCommand).toBeNull();
  expect(after.playerX).toBe(during.playerX);
  expect(after.playerY).toBe(during.playerY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });
});

test('right-clicking while walking opens pause without resuming the stale pointer command', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureGroundItemClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const canvas = page.locator('canvas');
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

  await armRightClickOnAnimatedPointerCommand(page, '拾取');
  await canvas.click({ position: targetPoint });
  const during = await rightClickTriggerSnapshot(page);
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.flowOverlay === 'pause' && debug.playerMovementActive === false && debug.pendingWorldCommand == null;
  });

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug != null && debug.flowOverlay == null && debug.appSurface === 'world';
  });
  await page.waitForTimeout(PLAYER_STEP_CANCEL_REGRESSION_MS);

  const after = await gameDebugSnapshot(page);
  expect(after.playerMovementActive).toBe(false);
  expect(after.pendingWorldCommand).toBeNull();
  expect(after.playerX).toBe(during.playerX);
  expect(after.playerY).toBe(during.playerY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });
});

test('clicking a distant ground item walks before pickup instead of teleporting', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureGroundItemClickKeypoint(page);
  const before = await gameDebugSnapshot(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toEqual({ itemId: 'item.spirit-stone', count: 1 });

  await page.locator('canvas').click({ position: targetPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.pendingWorldCommand === '拾取' && debug.playerMovementActive === true;
  });

  const during = await gameDebugSnapshot(page);
  expect(['move', 'pickup']).toContain(during.lastPointerAction);
  expect(during.starterSpiritStoneCount).toBeGreaterThanOrEqual(before.starterSpiritStoneCount ?? 0);

  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.lastPointerAction === 'pickup';
  });

  const after = await gameDebugSnapshot(page);
  expect(after.playerX).toBe(keypoint.targetX);
  expect(after.playerY).toBe(keypoint.targetY);
  expect(after.starterSpiritStoneCount).toBe((before.starterSpiritStoneCount ?? 0) + 1);
  expect(await groundItemSnapshot(page, keypoint.targetX, keypoint.targetY)).toBeNull();
});

const farmsteadObjectExpectations: Array<{
  kind: FarmsteadObjectKind;
  assertOpened: (page: Page, objectTile: { x: number; y: number }) => Promise<void>;
}> = [
  {
    kind: 'storage',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.interactionPanelKind).toBe('storage');
    }
  },
  {
    kind: 'shipping',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.interactionPanelKind).toBe('shipping');
      expect(debug.shippingItemId).toBe('herb.mossling');
    }
  },
  {
    kind: 'furnace',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.flowOverlay).toBe('inventory');
      expect(debug.appSurface).toBe('inventory');
      await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
      await expect(page.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
    }
  },
  {
    kind: 'array-shed',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.interactionPanelKind).toBe('build');
    }
  },
  {
    kind: 'map-gate',
    assertOpened: async page => {
      const debug = await gameDebugSnapshot(page);
      expect(debug.locationSelectionActive).toBe(true);
      expect(debug.locationPreviewVisible).toBe(true);
      expect(debug.interactionPanelKind).toBe('none');
    }
  }
];

for (const expectation of farmsteadObjectExpectations) {
  test(`clicking farmstead ${expectation.kind} opens its product flow`, async ({ page }) => {
    await openGame(page);
    await clearIntroDialogue(page);

    const objectTile = await clickFarmsteadObject(page, expectation.kind);
    await expectation.assertOpened(page, objectTile);
    const debug = await gameDebugSnapshot(page);
    expect(debug.lastPointerTileX).toBe(objectTile.x);
    expect(debug.lastPointerTileY).toBe(objectTile.y);
  });
}

test('clicking array-shed then a field tile places the selected array without legacy R/F hotkeys', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  await clickArrayShedAndWaitForBuildPanel(page);
  const keypoint = await configureBuildArrayKeypoint(page, 'lightning-rod', true);
  await clearIntroDialogue(page);
  const before = await arraySnapshot(page, keypoint.targetX, keypoint.targetY);
  expect(before?.count ?? 0).toBe(0);
  expect((await gameDebugSnapshot(page)).interactionPanelKind).toBe('build');

  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  await page.locator('canvas').click({ position: targetPoint });
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

test('clicking a built facility walks beside it and opens collection instead of tilling around it', async ({ page }) => {
  await openGame(page);
  await clearIntroDialogue(page);

  const keypoint = await configureBuiltFacilityClickKeypoint(page);
  const targetPoint = await canvasPointForTile(page, keypoint.targetX, keypoint.targetY);
  const beforeTarget = await tileSnapshot(page, keypoint.targetX, keypoint.targetY);
  expect(beforeTarget.blockType).toBe('building');
  expect(beforeTarget.tilled).toBe(false);

  await page.locator('canvas').click({ position: targetPoint });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.interactionPanelKind === 'facility-collect' && debug.lastPointerAction === 'object';
  });

  const after = await gameDebugSnapshot(page);
  expect(Math.abs((after.playerX ?? -99) - keypoint.targetX) + Math.abs((after.playerY ?? -99) - keypoint.targetY)).toBe(1);
  expect(after.lastPointerTileX).toBe(keypoint.targetX);
  expect(after.lastPointerTileY).toBe(keypoint.targetY);
  const afterTarget = await tileSnapshot(page, keypoint.targetX, keypoint.targetY);
  expect(afterTarget.blockType).toBe('building');
  expect(afterTarget.tilled).toBe(false);
});
