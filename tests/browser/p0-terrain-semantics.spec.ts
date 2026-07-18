import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeViewportLayout } from '@render/viewportLayout';
import { canvasPngSnapshot, clearIntroDialogue, gameDebugSnapshot, openGame } from './openGame';

interface TerrainSemanticsKeypoint {
  tillableX: number;
  tillableY: number;
  plantableX: number;
  plantableY: number;
  blockedX: number;
  blockedY: number;
  selectedX: number;
  selectedY: number;
}

interface TilePixelProfile {
  meanRed: number;
  meanGreen: number;
  meanBlue: number;
  meanLuma: number;
  lumaStdDev: number;
  textureEnergy: number;
  furrowSignal: number;
  legacyGreenPixels: number;
  coolEdgePixels: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = resolve(HERE, '..', '..', '.omc', 'artifacts');
const RUNTIME_SETTINGS_KEY = 'aeonvale-settings-v1';
const LOGICAL_CANVAS = { width: 960, height: 540 } as const;
const TILE = 42;
const LOGICAL_LAYOUT = computeViewportLayout({ ...LOGICAL_CANVAS, touchCapable: false });
if (!LOGICAL_LAYOUT.regions) throw new Error('P0 terrain screenshots require the 960×540 landscape layout.');
const TILE_ORIGIN = {
  x: Math.round(LOGICAL_LAYOUT.regions.world.x + (LOGICAL_LAYOUT.regions.world.width - 14 * TILE) / 2),
  y: Math.round(LOGICAL_LAYOUT.regions.world.y)
};

async function configureTerrainSemanticsKeypoint(page: Page): Promise<TerrainSemanticsKeypoint> {
  const configured = await page.evaluate((): TerrainSemanticsKeypoint | null => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureTerrainSemanticsKeypoint?: () => TerrainSemanticsKeypoint | null };
    };
    return target.__AEON_TEST__?.configureTerrainSemanticsKeypoint?.() ?? null;
  });
  expect(configured, 'Playwright build must expose configureTerrainSemanticsKeypoint()').not.toBeNull();
  const keypoint = configured!;
  const coordinates = [
    [keypoint.tillableX, keypoint.tillableY],
    [keypoint.plantableX, keypoint.plantableY],
    [keypoint.blockedX, keypoint.blockedY],
    [keypoint.selectedX, keypoint.selectedY]
  ];
  expect(new Set(coordinates.map(([x, y]) => `${x},${y}`)).size, 'each terrain semantic must occupy its own tile').toBe(4);
  for (const [x, y] of coordinates) {
    expect(Number.isInteger(x) && Number.isInteger(y), `terrain coordinate must be integral, got (${x}, ${y})`).toBe(true);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(y).toBeGreaterThanOrEqual(0);
  }
  return keypoint;
}

async function terrainPixelProfiles(page: Page, snapshotDataUrl: string, keypoint: TerrainSemanticsKeypoint): Promise<Record<'tillable' | 'plantable' | 'blocked' | 'selected', TilePixelProfile>> {
  return page.evaluate(
    async input => {
      const image = new Image();
      image.src = input.src;
      await new Promise<void>((resolveImage, rejectImage) => {
        image.onload = () => resolveImage();
        image.onerror = () => rejectImage(new Error('terrain semantics screenshot failed to load'));
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('2D canvas context is unavailable for terrain semantics sampling');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const scaleX = canvas.width / input.logicalWidth;
      const scaleY = canvas.height / input.logicalHeight;
      const lumaAt = (x: number, y: number): number => {
        const offset = (y * canvas.width + x) * 4;
        return (pixels[offset] ?? 0) * 0.2126 + (pixels[offset + 1] ?? 0) * 0.7152 + (pixels[offset + 2] ?? 0) * 0.0722;
      };

      const profile = (tileX: number, tileY: number): TilePixelProfile => {
        const left = Math.round((input.originX + tileX * input.tileSize) * scaleX);
        const top = Math.round((input.originY + tileY * input.tileSize) * scaleY);
        const right = Math.round((input.originX + (tileX + 1) * input.tileSize) * scaleX);
        const bottom = Math.round((input.originY + (tileY + 1) * input.tileSize) * scaleY);
        if (left < 0 || top < 0 || right > canvas.width || bottom > canvas.height || right <= left || bottom <= top) {
          throw new Error(`terrain tile (${tileX}, ${tileY}) maps outside the ${canvas.width}×${canvas.height} screenshot`);
        }

        const innerInsetX = Math.max(1, Math.round(5 * scaleX));
        const innerInsetY = Math.max(1, Math.round(5 * scaleY));
        const edgeBandX = Math.max(1, Math.round(7 * scaleX));
        const edgeBandY = Math.max(1, Math.round(7 * scaleY));
        const lumas: number[] = [];
        let redTotal = 0;
        let greenTotal = 0;
        let blueTotal = 0;
        let textureDelta = 0;
        let texturePairs = 0;
        let legacyGreenPixels = 0;
        let coolEdgePixels = 0;

        for (let y = top; y < bottom; y++) {
          for (let x = left; x < right; x++) {
            const offset = (y * canvas.width + x) * 4;
            const red = pixels[offset] ?? 0;
            const green = pixels[offset + 1] ?? 0;
            const blue = pixels[offset + 2] ?? 0;
            const localX = x - left;
            const localY = y - top;
            const nearEdge = localX < edgeBandX || localY < edgeBandY || localX >= right - left - edgeBandX || localY >= bottom - top - edgeBandY;
            if (nearEdge) {
              if (green > 165 && green > red + 35 && green > blue + 35) legacyGreenPixels += 1;
              if (green > red + 12 && blue > red + 18 && Math.abs(blue - green) < 45) coolEdgePixels += 1;
            }
            if (x < left + innerInsetX || y < top + innerInsetY || x >= right - innerInsetX || y >= bottom - innerInsetY) continue;
            const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
            lumas.push(luma);
            redTotal += red;
            greenTotal += green;
            blueTotal += blue;
            if (x + 1 < right - innerInsetX) {
              textureDelta += Math.abs(luma - lumaAt(x + 1, y));
              texturePairs += 1;
            }
            if (y + 1 < bottom - innerInsetY) {
              textureDelta += Math.abs(luma - lumaAt(x, y + 1));
              texturePairs += 1;
            }
          }
        }

        const meanLuma = lumas.reduce((total, value) => total + value, 0) / Math.max(1, lumas.length);
        const variance = lumas.reduce((total, value) => total + (value - meanLuma) ** 2, 0) / Math.max(1, lumas.length);
        let furrowDelta = 0;
        let furrowSamples = 0;
        for (const logicalRow of [12, 21, 30]) {
          const row = Math.round((input.originY + tileY * input.tileSize + logicalRow) * scaleY);
          const rowOffset = Math.max(1, Math.round(2 * scaleY));
          const sampleLeft = Math.round((input.originX + tileX * input.tileSize + 8) * scaleX);
          const sampleRight = Math.round((input.originX + tileX * input.tileSize + input.tileSize - 8) * scaleX);
          for (let x = sampleLeft; x < sampleRight; x++) {
            const neighborMean = (lumaAt(x, row - rowOffset) + lumaAt(x, row + rowOffset)) / 2;
            furrowDelta += Math.abs(lumaAt(x, row) - neighborMean);
            furrowSamples += 1;
          }
        }

        const count = Math.max(1, lumas.length);
        return {
          meanRed: redTotal / count,
          meanGreen: greenTotal / count,
          meanBlue: blueTotal / count,
          meanLuma,
          lumaStdDev: Math.sqrt(variance),
          textureEnergy: textureDelta / Math.max(1, texturePairs),
          furrowSignal: furrowDelta / Math.max(1, furrowSamples),
          legacyGreenPixels,
          coolEdgePixels
        };
      };

      return {
        tillable: profile(input.keypoint.tillableX, input.keypoint.tillableY),
        plantable: profile(input.keypoint.plantableX, input.keypoint.plantableY),
        blocked: profile(input.keypoint.blockedX, input.keypoint.blockedY),
        selected: profile(input.keypoint.selectedX, input.keypoint.selectedY)
      };
    },
    {
      src: snapshotDataUrl,
      keypoint,
      logicalWidth: LOGICAL_CANVAS.width,
      logicalHeight: LOGICAL_CANVAS.height,
      originX: TILE_ORIGIN.x,
      originY: TILE_ORIGIN.y,
      tileSize: TILE
    }
  );
}

function colorDistance(first: TilePixelProfile, second: TilePixelProfile): number {
  return Math.hypot(first.meanRed - second.meanRed, first.meanGreen - second.meanGreen, first.meanBlue - second.meanBlue);
}

async function captureTerrainSemantics(page: Page, viewport: { width: number; height: number }, artifactName: string): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // about:blank has an opaque origin; the same init script runs again on the app origin.
      }
    },
    { key: RUNTIME_SETTINGS_KEY, value: JSON.stringify({ masterVolume: 35, reducedMotion: true }) }
  );
  await page.setViewportSize(viewport);
  await openGame(page);
  await clearIntroDialogue(page);
  const keypoint = await configureTerrainSemanticsKeypoint(page);
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');
  await page.waitForTimeout(180);

  const debug = await gameDebugSnapshot(page);
  expect([debug.frontTileX, debug.frontTileY]).toEqual([keypoint.selectedX, keypoint.selectedY]);
  expect(debug.frontTileTilled).toBe(false);
  expect(debug.frontTileCropId).toBeNull();
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);

  const firstSnapshot = await canvasPngSnapshot(page);
  expect(firstSnapshot).not.toBeNull();
  await page.waitForTimeout(180);
  const secondSnapshot = await canvasPngSnapshot(page);
  expect(secondSnapshot).not.toBeNull();
  expect(secondSnapshot!.dataUrl, 'fixed ambient time must keep the full terrain keyframe byte-stable').toBe(firstSnapshot!.dataUrl);

  const profiles = await terrainPixelProfiles(page, firstSnapshot!.dataUrl, keypoint);
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const png = await canvas.screenshot({ animations: 'disabled', scale: 'css' });
  writeFileSync(resolve(ARTIFACTS_DIR, artifactName), png);
  const summary = `keypoint=${JSON.stringify(keypoint)} profiles=${JSON.stringify(profiles)} artifact=${resolve(ARTIFACTS_DIR, artifactName)}`;
  test.info().annotations.push({ type: 'p0-2-terrain-semantics', description: summary });
  // eslint-disable-next-line no-console
  console.log(`[p0-2-terrain-semantics] ${summary}`);

  expect(profiles.selected.legacyGreenPixels).toBe(0);
  expect(profiles.selected.coolEdgePixels).toBeGreaterThan(8);
  expect(profiles.selected.meanLuma, 'moon-white selection mask must brighten the selected tillable tile').toBeGreaterThan(profiles.tillable.meanLuma + 2);
  expect(profiles.plantable.meanLuma, 'prepared soil must be visibly darker than raw tillable soil').toBeLessThan(profiles.tillable.meanLuma - 2);
  expect(profiles.plantable.furrowSignal, 'prepared soil must expose stronger horizontal furrows than raw soil').toBeGreaterThan(profiles.tillable.furrowSignal);
  expect(colorDistance(profiles.blocked, profiles.tillable), 'blocked ground must have a distinct desaturated mountain/rock tone').toBeGreaterThan(8);
  expect(Math.abs(profiles.blocked.textureEnergy - profiles.tillable.textureEnergy), 'coarse blocked texture must differ from fine tillable grain').toBeGreaterThan(0.5);
}

test('P0-2 terrain semantics remain readable at desktop size', async ({ page }) => {
  test.setTimeout(60_000);
  await captureTerrainSemantics(page, { width: 960, height: 542 }, 'p0-2-terrain-semantics-desktop.png');
});

test('P0-2 terrain semantics fit the approved mobile landscape size', async ({ page }) => {
  test.setTimeout(60_000);
  await captureTerrainSemantics(page, { width: 736, height: 414 }, 'p0-2-terrain-semantics-mobile.png');
});
