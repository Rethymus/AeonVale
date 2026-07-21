import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeViewportLayout } from '@render/viewportLayout';
import { clearIntroDialogue, openGame } from './openGame';

interface QiFlowKeypoint {
  lowX: number;
  lowY: number;
  highX: number;
  highY: number;
}

interface CapturedFrame {
  dataUrl: string;
  width: number;
  height: number;
}

interface QiPixelProfile {
  sampledPixels: number;
  qiPixelCount: number;
  qiPixelRatio: number;
  qiSignal: number;
  meanQiSignal: number;
  columnCoverageRatio: number;
}

interface TemporalPixelProfile {
  sampledPixels: number;
  changedPixels: number;
  changedPixelRatio: number;
  columnCoverageRatio: number;
  totalDelta: number;
  meanChannelDelta: number;
}

interface FrameAnalysis {
  phaseA: { low: QiPixelProfile; high: QiPixelProfile };
  phaseB: { low: QiPixelProfile; high: QiPixelProfile };
  lowTemporal: TemporalPixelProfile;
  highTemporal: TemporalPixelProfile;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS_DIR = resolve(HERE, '..', '..', '.omc', 'artifacts');
const PHASE_A_ARTIFACT = 'p0-3-qi-flow-phase-a.png';
const PHASE_B_ARTIFACT = 'p0-3-qi-flow-phase-b.png';
const RUNTIME_SETTINGS_KEY = 'aeonvale-settings-v1';
const LOGICAL_CANVAS = { width: 960, height: 540 } as const;
const TILE_SIZE = 42;
const TILE_SAMPLE_INSET = 8;
const DEFAULT_WORLD_COLUMNS = 14;
const LOGICAL_LAYOUT = computeViewportLayout({ ...LOGICAL_CANVAS, touchCapable: false });
if (!LOGICAL_LAYOUT.regions) throw new Error('P0 qi-flow screenshots require the 960×540 landscape layout.');
const TILE_ORIGIN = {
  x: Math.round(LOGICAL_LAYOUT.regions.content.x + (LOGICAL_LAYOUT.regions.content.width - DEFAULT_WORLD_COLUMNS * TILE_SIZE) / 2),
  y: Math.round(LOGICAL_LAYOUT.regions.world.y)
};

async function configureQiFlowKeypoint(page: Page): Promise<QiFlowKeypoint> {
  const configured = await page.evaluate((): QiFlowKeypoint | null => {
    const target = window as typeof window & {
      __AEON_TEST__?: { configureQiFlowKeypoint?: () => QiFlowKeypoint | null };
    };
    return target.__AEON_TEST__?.configureQiFlowKeypoint?.() ?? null;
  });

  expect(configured, 'Playwright build must expose configureQiFlowKeypoint()').not.toBeNull();
  const keypoint = configured!;
  for (const coordinate of [keypoint.lowX, keypoint.lowY, keypoint.highX, keypoint.highY]) {
    expect(Number.isInteger(coordinate), `qi-flow tile coordinate must be an integer, got ${coordinate}`).toBe(true);
    expect(coordinate).toBeGreaterThanOrEqual(0);
  }
  expect([keypoint.highX, keypoint.highY], 'low/high qi samples must use different tiles').not.toEqual([keypoint.lowX, keypoint.lowY]);
  return keypoint;
}

async function captureCanvasFrame(page: Page, artifactName?: string): Promise<CapturedFrame> {
  const png = await page.locator('#game-canvas').screenshot({ animations: 'allow', scale: 'css' });
  expect(png.length).toBeGreaterThan(24);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');

  if (artifactName) {
    mkdirSync(ARTIFACTS_DIR, { recursive: true });
    writeFileSync(resolve(ARTIFACTS_DIR, artifactName), png);
  }
  return {
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}

async function analyzeFrames(page: Page, phaseA: CapturedFrame, phaseB: CapturedFrame, keypoint: QiFlowKeypoint): Promise<FrameAnalysis> {
  return page.evaluate(
    async input => {
      const loadFrame = async (src: string): Promise<{ image: HTMLImageElement; data: Uint8ClampedArray }> => {
        const image = new Image();
        image.src = src;
        await new Promise<void>((resolveImage, rejectImage) => {
          image.onload = () => resolveImage();
          image.onerror = () => rejectImage(new Error('qi-flow screenshot failed to load'));
        });
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('2D canvas context is unavailable for qi-flow sampling');
        context.drawImage(image, 0, 0);
        return { image, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
      };

      const [first, second] = await Promise.all([loadFrame(input.phaseA), loadFrame(input.phaseB)]);
      if (first.image.naturalWidth !== second.image.naturalWidth || first.image.naturalHeight !== second.image.naturalHeight) {
        throw new Error('qi-flow phase screenshots must have identical dimensions');
      }

      const width = first.image.naturalWidth;
      const height = first.image.naturalHeight;
      const scaleX = width / input.logicalWidth;
      const scaleY = height / input.logicalHeight;

      const sampleBounds = (tileX: number, tileY: number): { left: number; top: number; right: number; bottom: number } => {
        const left = Math.round((input.originX + tileX * input.tileSize + input.sampleInset) * scaleX);
        const top = Math.round((input.originY + tileY * input.tileSize + input.sampleInset) * scaleY);
        const right = Math.round((input.originX + (tileX + 1) * input.tileSize - input.sampleInset) * scaleX);
        const bottom = Math.round((input.originY + (tileY + 1) * input.tileSize - input.sampleInset) * scaleY);
        if (left < 0 || top < 0 || right > width || bottom > height || right <= left || bottom <= top) {
          throw new Error(`qi-flow tile (${tileX}, ${tileY}) maps outside the ${width}×${height} screenshot`);
        }
        return { left, top, right, bottom };
      };

      const pixelOffset = (x: number, y: number): number => (y * width + x) * 4;

      const qiProfile = (data: Uint8ClampedArray, tileX: number, tileY: number): QiPixelProfile => {
        const bounds = sampleBounds(tileX, tileY);
        const coolness: number[] = [];
        for (let y = bounds.top; y < bounds.bottom; y++) {
          for (let x = bounds.left; x < bounds.right; x++) {
            const offset = pixelOffset(x, y);
            const red = data[offset] ?? 0;
            const green = data[offset + 1] ?? 0;
            const blue = data[offset + 2] ?? 0;
            coolness.push(green + blue - red * 2);
          }
        }

        const sorted = [...coolness].sort((a, b) => a - b);
        const medianCoolness = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const coveredColumns = new Set<number>();
        let qiPixelCount = 0;
        let qiSignal = 0;
        let sampleIndex = 0;

        for (let y = bounds.top; y < bounds.bottom; y++) {
          for (let x = bounds.left; x < bounds.right; x++) {
            const relativeSignal = Math.max(0, (coolness[sampleIndex] ?? medianCoolness) - medianCoolness - 6);
            if (relativeSignal >= 3) {
              qiPixelCount += 1;
              qiSignal += relativeSignal;
              coveredColumns.add(x);
            }
            sampleIndex += 1;
          }
        }

        const sampledPixels = coolness.length;
        const sampleWidth = bounds.right - bounds.left;
        return {
          sampledPixels,
          qiPixelCount,
          qiPixelRatio: sampledPixels === 0 ? 0 : qiPixelCount / sampledPixels,
          qiSignal,
          meanQiSignal: sampledPixels === 0 ? 0 : qiSignal / sampledPixels,
          columnCoverageRatio: sampleWidth === 0 ? 0 : coveredColumns.size / sampleWidth
        };
      };

      const temporalProfile = (tileX: number, tileY: number): TemporalPixelProfile => {
        const bounds = sampleBounds(tileX, tileY);
        const coveredColumns = new Set<number>();
        let sampledPixels = 0;
        let changedPixels = 0;
        let totalDelta = 0;

        for (let y = bounds.top; y < bounds.bottom; y++) {
          for (let x = bounds.left; x < bounds.right; x++) {
            const offset = pixelOffset(x, y);
            const delta = Math.abs((first.data[offset] ?? 0) - (second.data[offset] ?? 0)) + Math.abs((first.data[offset + 1] ?? 0) - (second.data[offset + 1] ?? 0)) + Math.abs((first.data[offset + 2] ?? 0) - (second.data[offset + 2] ?? 0));
            sampledPixels += 1;
            totalDelta += delta;
            if (delta >= 9) {
              changedPixels += 1;
              coveredColumns.add(x);
            }
          }
        }

        const sampleWidth = bounds.right - bounds.left;
        return {
          sampledPixels,
          changedPixels,
          changedPixelRatio: sampledPixels === 0 ? 0 : changedPixels / sampledPixels,
          columnCoverageRatio: sampleWidth === 0 ? 0 : coveredColumns.size / sampleWidth,
          totalDelta,
          meanChannelDelta: sampledPixels === 0 ? 0 : totalDelta / (sampledPixels * 3)
        };
      };

      const low = { x: input.keypoint.lowX, y: input.keypoint.lowY };
      const high = { x: input.keypoint.highX, y: input.keypoint.highY };
      return {
        phaseA: {
          low: qiProfile(first.data, low.x, low.y),
          high: qiProfile(first.data, high.x, high.y)
        },
        phaseB: {
          low: qiProfile(second.data, low.x, low.y),
          high: qiProfile(second.data, high.x, high.y)
        },
        lowTemporal: temporalProfile(low.x, low.y),
        highTemporal: temporalProfile(high.x, high.y)
      };
    },
    {
      phaseA: phaseA.dataUrl,
      phaseB: phaseB.dataUrl,
      keypoint,
      logicalWidth: LOGICAL_CANVAS.width,
      logicalHeight: LOGICAL_CANVAS.height,
      originX: TILE_ORIGIN.x,
      originY: TILE_ORIGIN.y,
      tileSize: TILE_SIZE,
      sampleInset: TILE_SAMPLE_INSET
    }
  );
}

function expectHighQiToReadStronger(phase: { low: QiPixelProfile; high: QiPixelProfile }, label: string): void {
  expect(phase.low.qiPixelCount, `${label}: the low-qi tile must still contain a visible flow line`).toBeGreaterThan(4);
  expect(phase.low.meanQiSignal, `${label}: the low-qi line must carry clearly-visible cyan signal, not merely measurable (calibrated against the 2026-07-18 sub-perceptual regression)`).toBeGreaterThan(7);
  expect(phase.high.qiPixelCount, `${label}: high-qi tile must contain more qi-line pixels than low-qi tile`).toBeGreaterThan(phase.low.qiPixelCount);
  expect(phase.high.meanQiSignal, `${label}: high-qi tile must carry stronger cyan qi signal than low-qi tile`).toBeGreaterThan(phase.low.meanQiSignal);
}

function expectAnimatedFlowStrength(low: TemporalPixelProfile, high: TemporalPixelProfile): void {
  expect(low.changedPixelRatio, 'the low-qi line motion must touch a measurable footprint (static visibility is gated by meanQiSignal/meanChannelDelta above; floor lowered from 0.07 to de-flake wall-clock sampling noise — a single slow line oscillates 0.045–0.08 run-to-run)').toBeGreaterThan(0.03);
  expect(low.columnCoverageRatio, 'the low-qi animation must span the tile horizontally like a flow line').toBeGreaterThan(0.6);
  expect(low.meanChannelDelta, 'the low-qi animation must show non-trivial motion (secondary check only — this temporal metric is wall-clock noisy at low-qi; the authoritative visibility bar is meanQiSignal above, which is static and discriminates the 2026-07-18 invisible regression 4.59 → 9.8+)').toBeGreaterThan(1.5);
  expect(high.changedPixels, 'high qi must animate more line pixels than low qi').toBeGreaterThan(low.changedPixels);
  expect(high.totalDelta, 'high qi must produce stronger animated pixel intensity than low qi').toBeGreaterThan(low.totalDelta);
  expect(high.columnCoverageRatio, 'high-qi animation must span the tile horizontally').toBeGreaterThan(0.8);
}

test('P0-3 qi flow is denser, stronger and visibly moving on high-qi farmland', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 960, height: 542 });
  await openGame(page);
  await clearIntroDialogue(page);
  const keypoint = await configureQiFlowKeypoint(page);
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'false');

  await page.waitForTimeout(240);
  const phaseA = await captureCanvasFrame(page, PHASE_A_ARTIFACT);
  await page.waitForTimeout(850);
  const phaseB = await captureCanvasFrame(page, PHASE_B_ARTIFACT);
  expect({ width: phaseA.width, height: phaseA.height }).toEqual({ width: phaseB.width, height: phaseB.height });

  const analysis = await analyzeFrames(page, phaseA, phaseB, keypoint);
  expectHighQiToReadStronger(analysis.phaseA, 'phase A');
  expectHighQiToReadStronger(analysis.phaseB, 'phase B');
  expectAnimatedFlowStrength(analysis.lowTemporal, analysis.highTemporal);
  expect(analysis.highTemporal.changedPixels, 'high-qi line geometry must change between the two sampled times').toBeGreaterThan(12);
  expect(analysis.highTemporal.changedPixelRatio, 'high-qi tile must show a material animated footprint').toBeGreaterThan(0.02);
  expect(analysis.highTemporal.meanChannelDelta, 'high-qi animation must clear a human-perceptible intensity floor (calibrated against the 2026-07-18 invisible regression)').toBeGreaterThan(15);

  const summary = [`keypoint=${JSON.stringify(keypoint)}`, `phaseA=${JSON.stringify(analysis.phaseA)}`, `phaseB=${JSON.stringify(analysis.phaseB)}`, `lowTemporal=${JSON.stringify(analysis.lowTemporal)}`, `highTemporal=${JSON.stringify(analysis.highTemporal)}`, `artifacts=${resolve(ARTIFACTS_DIR, PHASE_A_ARTIFACT)}, ${resolve(ARTIFACTS_DIR, PHASE_B_ARTIFACT)}`].join('\n');
  test.info().annotations.push({ type: 'p0-3-qi-flow', description: summary });
  // eslint-disable-next-line no-console
  console.log(`[p0-3-qi-flow] ${summary.replaceAll('\n', ' | ')}`);
  await test.info().attach('p0-3-qi-flow-metrics.txt', { body: `${summary}\n` });
});

test('P0-3 reduced motion preserves qi density semantics while freezing both flow geometries', async ({ page }) => {
  test.setTimeout(60_000);
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
  await page.setViewportSize({ width: 960, height: 542 });
  await openGame(page);
  await clearIntroDialogue(page);
  const keypoint = await configureQiFlowKeypoint(page);
  await expect(page.locator('html')).toHaveAttribute('data-reduced-motion', 'true');

  await page.waitForTimeout(240);
  const phaseA = await captureCanvasFrame(page);
  await page.waitForTimeout(850);
  const phaseB = await captureCanvasFrame(page);
  const analysis = await analyzeFrames(page, phaseA, phaseB, keypoint);

  expectHighQiToReadStronger(analysis.phaseA, 'reduced-motion phase A');
  expectHighQiToReadStronger(analysis.phaseB, 'reduced-motion phase B');
  expect(analysis.lowTemporal.changedPixels, 'reduced motion must freeze the low-qi line geometry').toBe(0);
  expect(analysis.highTemporal.changedPixels, 'reduced motion must freeze the high-qi line geometry').toBe(0);
  expect(analysis.lowTemporal.totalDelta, 'reduced motion must keep low-qi pixels byte-stable').toBe(0);
  expect(analysis.highTemporal.totalDelta, 'reduced motion must keep high-qi pixels byte-stable').toBe(0);
});
