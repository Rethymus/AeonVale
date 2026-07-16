import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildRegistry } from '@content/registry';
import { applyAction, createSimContext, createWorld, DEFAULT_BALANCE, placeArray } from '@sim';
import { placeFacility } from '@sim/buildings/facilities';
import { saveGame } from '@sim/serialize';
import { mutateItem } from '@sim/world/player';
import { tileAt } from '@sim/world/state';
import { paintStatsFromDataUrl, gameDebugSnapshot, openGame, renderedCanvasPngSnapshot, type AeonDebugSnapshot, type CanvasPaintStats } from './openGame';

const SAVE_KEY = 'aeonvale-save-v1';
const PORTFOLIO_EVIDENCE_PATH = 'test-results/portfolio/portfolio-mvp-evidence.json';
const PORTFOLIO_PAINT_THRESHOLDS = { minSampled: 500, minPaintedRatio: 0.55, minColors: 32 } as const;
const TODAY_BRIEFING_PROOF = ['农庄', '炼丹', '引劫', '首轮进度：10/10'] as const;

interface PortfolioScreenshotEvidence {
  path: string;
  width: number;
  height: number;
  paintStats: CanvasPaintStats & { paintedRatio: number };
  thresholds: typeof PORTFOLIO_PAINT_THRESHOLDS;
}

interface PortfolioMvpEvidence {
  generatedBy: 'portfolio:capture';
  priority: 'P0-A';
  localStatus: string;
  stardewComparison: string[];
  xianxiaCore: string[];
  runtimeSignals: {
    onboardingObjectiveId: string | null;
    firstLoopProgress: '10/10';
    selectedLocationId: string | null;
    selectedLocationServiceCommand: string | null;
    shippingBinItemCount: number;
    todayBriefingTitle: string;
    todayBriefingHasAsset: boolean;
    todayBriefingProof: string[];
  };
  evidence: string[];
  screenshotEvidence: PortfolioScreenshotEvidence[];
  next: string[];
  noGo: string[];
}

function buildShowcaseSave(): string {
  const reg = buildRegistry();
  const state = createWorld({ seed: 20260714, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(state.masterSeed, reg, DEFAULT_BALANCE);

  for (const beat of ['awaken', 'spirit-test', 'intro', 'first-till']) state.player.flags.add(`narr-${beat}`);
  state.player.flags.add('onboarding-first-second-water');
  state.day = 9;
  state.seasonDay = 9;
  state.season = 'spring';
  state.player.position = { x: 7, y: 3 };
  state.player.facing = 'down';
  state.player.stage = 3;
  state.player.hp = 84_000;
  state.player.stamina = 78_000;
  state.player.bodyFoundation = 26_000;
  state.player.cultivation = state.player.bodyFoundation;
  state.player.temperingStack = 8_000;
  state.player.pillPoison = 7_000;

  mutateItem(state.player, 'item.spirit-stone', 9);
  mutateItem(state.player, 'item.rust-hoe', 1);
  mutateItem(state.player, 'item.water-pail', 1);
  mutateItem(state.player, 'item.sickle', 1);
  mutateItem(state.player, 'seed.mossling', 4);
  mutateItem(state.player, 'seed.dewroot', 3);
  mutateItem(state.player, 'herb.mossling', 2);
  mutateItem(state.player, 'pill.ward-basic', 1);

  const crops: Array<{ x: number; y: number; seedId: string; growth: number; stage: 'sprout' | 'growing' | 'mature'; watered?: boolean; qi?: boolean }> = [
    { x: 5, y: 4, seedId: 'seed.mossling', growth: 100_000, stage: 'mature', watered: true, qi: true },
    { x: 6, y: 4, seedId: 'seed.dewroot', growth: 62_000, stage: 'growing', watered: true },
    { x: 7, y: 4, seedId: 'seed.mossling', growth: 34_000, stage: 'sprout' },
    { x: 8, y: 4, seedId: 'seed.dewroot', growth: 86_000, stage: 'growing', watered: true, qi: true },
    { x: 9, y: 4, seedId: 'seed.mossling', growth: 100_000, stage: 'mature', watered: true },
    { x: 6, y: 5, seedId: 'seed.mossling', growth: 48_000, stage: 'growing', watered: true },
    { x: 7, y: 5, seedId: 'seed.dewroot', growth: 18_000, stage: 'sprout' }
  ];

  for (const entry of crops) {
    const tile = tileAt(state, entry.x, entry.y);
    if (!tile) throw new Error(`missing showcase tile ${entry.x},${entry.y}`);
    tile.blockType = 'none';
    tile.soilType = entry.qi ? 'spirit-loam' : 'loam';
    tile.tilled = true;
    tile.wateredToday = entry.watered ?? false;
    tile.channeledToday = entry.qi ?? false;
    tile.moisture = entry.watered ? 80_000 : 28_000;
    tile.qiDensity = entry.qi ? 70_000 : 22_000;
    applyAction(state, { kind: 'sow', at: { x: entry.x, y: entry.y }, seedId: entry.seedId }, ctx);
    const crop = state.crops.get(tile.id);
    if (!crop) throw new Error(`missing showcase crop ${entry.x},${entry.y}`);
    crop.growth = entry.growth;
    crop.stage = entry.stage;
    crop.health = 96_000;
  }

  expect(placeArray(state, 'array.insulation', 7, 5, ctx, { free: true }).placed).toBe(true);
  const dryingTile = tileAt(state, 8, 5);
  if (!dryingTile) throw new Error('missing showcase drying rack tile');
  dryingTile.blockType = 'none';
  dryingTile.tilled = false;
  dryingTile.cropId = null;
  expect(placeFacility(state, 'drying-rack', 8, 5, { free: true }).ok).toBe(true);
  state.shippingBin['herb.mossling'] = 2;

  const patrolTile = tileAt(state, 6, 5);
  if (!patrolTile) throw new Error('missing showcase guard beast patrol tile');
  state.guardBeasts.push({ id: 9001, vigor: 6, maxVigor: 6, bond: 68, specialty: 'field-ward' });
  state.guardBeastPatrols.push({ beastId: 9001, tileId: patrolTile.id, assignedDay: state.day });

  return JSON.stringify(saveGame(state, reg.schemaHash));
}

async function installShowcaseSave(page: Page): Promise<void> {
  const payload = buildShowcaseSave();
  await page.addInitScript(
    ({ key, value }: { key: string; value: string }) => {
      window.localStorage.setItem(key, value);
    },
    { key: SAVE_KEY, value: payload }
  );
}

async function dismissIntroIfPresent(page: Page): Promise<void> {
  for (let i = 0; i < 4; i += 1) {
    const beatId = await page.evaluate(() => {
      const debug = (window as typeof window & { __AEON_DEBUG__?: { dialogueBeatId?: string | null } }).__AEON_DEBUG__;
      return debug?.dialogueBeatId ?? null;
    });
    if (!beatId) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
}

async function pressShiftTab(page: Page): Promise<void> {
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');
}

async function waitForDebugState(page: Page, expected: Record<string, unknown>): Promise<void> {
  try {
    await page.waitForFunction(
      target => {
        const debug = (window as typeof window & { __AEON_DEBUG__?: Record<string, unknown> }).__AEON_DEBUG__ ?? {};
        return Object.entries(target).every(([key, value]) => debug[key] === value);
      },
      expected,
      { timeout: 10_000 }
    );
  } catch (error) {
    const actual = await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: Record<string, unknown> }).__AEON_DEBUG__ ?? {});
    throw new Error(`Timed out waiting for debug state ${JSON.stringify(expected)}; actual ${JSON.stringify(actual)}`, { cause: error });
  }
}

async function openFarmActionPanelForCapture(page: Page): Promise<void> {
  await page.keyboard.press('Shift+M');
  await waitForDebugState(page, { interactionPanelKind: 'farm-action' });
}

async function capturePortfolioScreenshot(page: Page, path: string, expectedSize: { width: number; height: number }): Promise<void> {
  const snapshot = await renderedCanvasPngSnapshot(page);
  expect(snapshot).not.toBeNull();
  expect({ width: snapshot!.width, height: snapshot!.height }).toEqual(expectedSize);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(snapshot!.dataUrl.split(',')[1] ?? '', 'base64'));
  const stats = await paintStatsFromDataUrl(page, snapshot!.dataUrl);
  expect(stats.sampled).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minSampled);
  expect(stats.painted / stats.sampled).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minPaintedRatio);
  expect(stats.colors).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minColors);
  await appendPortfolioScreenshotEvidence(path, snapshot!.width, snapshot!.height, stats);
}

async function readPortfolioEvidence(): Promise<Partial<PortfolioMvpEvidence> | null> {
  try {
    const content = await readFile(PORTFOLIO_EVIDENCE_PATH, 'utf8');
    return JSON.parse(content) as Partial<PortfolioMvpEvidence>;
  } catch {
    return null;
  }
}

async function writePortfolioEvidence(evidence: PortfolioMvpEvidence): Promise<void> {
  await mkdir(dirname(PORTFOLIO_EVIDENCE_PATH), { recursive: true });
  await writeFile(PORTFOLIO_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function appendPortfolioScreenshotEvidence(path: string, width: number, height: number, stats: CanvasPaintStats): Promise<void> {
  const evidence = await readPortfolioEvidence();
  if (!evidence?.generatedBy) return;
  const screenshotEvidence = Array.isArray(evidence.screenshotEvidence) ? evidence.screenshotEvidence.filter(entry => entry.path !== path) : [];
  screenshotEvidence.push({
    path,
    width,
    height,
    paintStats: {
      sampled: stats.sampled,
      painted: stats.painted,
      paintedRatio: Number((stats.painted / stats.sampled).toFixed(4)),
      colors: stats.colors
    },
    thresholds: PORTFOLIO_PAINT_THRESHOLDS
  });
  await writePortfolioEvidence({ ...evidence, screenshotEvidence } as PortfolioMvpEvidence);
}

function buildPortfolioMvpEvidence(debug: AeonDebugSnapshot, screenshotEvidence: PortfolioScreenshotEvidence[]): PortfolioMvpEvidence {
  return {
    generatedBy: 'portfolio:capture',
    priority: 'P0-A',
    localStatus: '本地可试玩 Demo 验收证据：首轮灵草日循环、出货补种、今日简报和截图均由浏览器自动化生成。',
    stardewComparison: ['P0 对标《星露谷物语》的低门槛日循环：翻地、播种、浇水、过夜、收获、出货、补种。', 'P0 不追求成熟生活模拟体量，只证明数分钟内能看懂并重复第一轮农务经济闭环。'],
    xianxiaCore: ['炼丹', '阵法', '淬体', '主动引劫', '种田即备战'],
    runtimeSignals: {
      onboardingObjectiveId: debug.onboardingObjectiveId ?? null,
      firstLoopProgress: '10/10',
      selectedLocationId: debug.selectedLocationId ?? null,
      selectedLocationServiceCommand: debug.selectedLocationServiceCommand ?? null,
      shippingBinItemCount: debug.shippingBinItemCount ?? 0,
      todayBriefingTitle: debug.todayBriefingTitle ?? '',
      todayBriefingHasAsset: debug.todayBriefingAssetId != null,
      todayBriefingProof: TODAY_BRIEFING_PROOF.filter(text => debug.todayBriefingBody?.includes(text))
    },
    evidence: ['test-results/portfolio/01-farm-loop.png', 'test-results/portfolio/02-location-routing.png', 'test-results/portfolio/03-farm-actions.png', 'test-results/portfolio/04-mobile-farm-loop.png', 'pnpm portfolio:mvp-preflight -- --keep-public-tree'],
    screenshotEvidence,
    next: ['维护者人工试玩 3-5 分钟，确认首屏无需阅读设计文档也能理解下一步。', '后续转 Public、重新推送公开树、修改 Pages 设置、创建 tag 或 Release 前，重新取得维护者当次明确授权。'],
    noGo: ['Public、Release 或远端设置变更仍保持 remote-action authorization boundary。', '每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成。', 'docs/、Agent 状态、生成物、.env*、sourcemap 和私有设计资料不得进入公开树、Pages 或 Release 产物。']
  };
}

async function writePortfolioMvpEvidence(debug: AeonDebugSnapshot): Promise<void> {
  const previous = await readPortfolioEvidence();
  const screenshotEvidence = Array.isArray(previous?.screenshotEvidence) ? previous.screenshotEvidence : [];
  const evidence = buildPortfolioMvpEvidence(debug, screenshotEvidence);
  await writePortfolioEvidence(evidence);
}

async function expectPortfolioFarmLoopState(page: Page): Promise<void> {
  const debug = await gameDebugSnapshot(page);
  expect(debug.dialogueBeatId).toBeNull();
  expect(debug.dialogueBackdropVisible).toBe(false);
  expect(debug.todayBriefingVisible).toBe(true);
  expect(debug.panelPreviewVisible).toBe(false);
  expect(debug.locationPreviewVisible).toBe(false);
  expect(debug.paused).toBe(false);
  expect(debug.postAscensionMode).toBe('none');
  expect(debug.onboardingObjectiveId).toBe('first-loop-complete');
  expect(debug.helpText).toEqual(expect.stringContaining('目标'));
  expect(debug.helpText).toEqual(expect.stringContaining('炼丹'));
  expect(debug.helpText).toEqual(expect.stringContaining('引劫'));
  expect(debug.renderedHelpText).toEqual(expect.stringContaining('方向键移动'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('\n'));
  expect(debug.renderedHelpText).not.toEqual(expect.stringContaining('function'));
  expect(debug.todayBriefingTitle).toBe('今日简报');
  for (const text of TODAY_BRIEFING_PROOF) {
    expect(debug.todayBriefingBody).toEqual(expect.stringContaining(text));
  }
  expect(debug.todayBriefingAssetId).not.toBeNull();
  expect(debug.selectedLocationId).toBe('farmstead');
  expect(debug.selectedLocationServiceCommand).toBe('show-farm-work');
  expect(debug.shippingBinItemCount).toBe(2);
  await writePortfolioMvpEvidence(debug);
}

async function expectCanvasFitsViewport(page: Page): Promise<void> {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!(canvas instanceof HTMLCanvasElement)) return null;
    const rect = canvas.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.height).toBeLessThanOrEqual(viewport!.height);
}

test('captures deterministic review screenshots for public demo validation', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await installShowcaseSave(page);
  await openGame(page);
  await dismissIntroIfPresent(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expectPortfolioFarmLoopState(page);
  await capturePortfolioScreenshot(page, 'test-results/portfolio/01-farm-loop.png', { width: 960, height: 542 });

  await pressShiftTab(page);
  await waitForDebugState(page, {
    locationSelectionActive: true,
    todayBriefingVisible: false,
    panelPreviewVisible: false,
    locationPreviewVisible: true
  });
  await capturePortfolioScreenshot(page, 'test-results/portfolio/02-location-routing.png', { width: 960, height: 542 });

  await page.keyboard.press('Escape');
  await waitForDebugState(page, { locationSelectionActive: false });
  await openFarmActionPanelForCapture(page);
  await waitForDebugState(page, {
    todayBriefingVisible: false,
    panelPreviewVisible: true,
    locationPreviewVisible: false
  });
  await capturePortfolioScreenshot(page, 'test-results/portfolio/03-farm-actions.png', { width: 960, height: 542 });
});

test('captures a small-viewport landscape keyboard-first screen for GitHub Pages demo review', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 736, height: 414 });
  await installShowcaseSave(page);
  await openGame(page);
  await dismissIntroIfPresent(page);
  await expect(page.locator('canvas')).toBeVisible();
  await expectCanvasFitsViewport(page);
  await expectPortfolioFarmLoopState(page);
  await capturePortfolioScreenshot(page, 'test-results/portfolio/04-mobile-farm-loop.png', { width: 736, height: 414 });
});
