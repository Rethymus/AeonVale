// 旧世界退役（docs/21 §8.16 阶段 2 第二步）：portfolio 证据链整体迁到主模式
// 「偷天换劫」——四张审查截图改为 备劫工作台 / 天劫棋盘 / 生活事件 / 紧凑横屏，
// 证据信号改为 HUD 认证·余量等主模式运行时文本。
// 旧 world 渲染链（showcaseSave + enterLoadedLegacyWorld + openGameWithLoadedSave）
// 随本迁移一并退役（判定与遗留见 docs/21 §8.21/§8.26）。
import { expect, test, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gameDebugSnapshot, gameEntryPath } from './openGame';

const PORTFOLIO_EVIDENCE_PATH = 'test-results/portfolio/portfolio-mvp-evidence.json';
const PORTFOLIO_PAINT_THRESHOLDS = { minSampled: 500, minPaintedRatio: 0.5, minColors: 24 } as const;
const RUNTIME_SIGNAL_PROOF = ['劫前修途', '认证', '引劫'] as const;
const DESKTOP_PORTFOLIO_SCREENSHOT = { width: 1440, height: 810 } as const;

interface PortfolioScreenshotEvidence {
  path: string;
  width: number;
  height: number;
  paintStats: { sampled: number; painted: number; paintedRatio: number; colors: number };
  thresholds: typeof PORTFOLIO_PAINT_THRESHOLDS;
}

interface PortfolioMvpEvidence {
  generatedBy: 'portfolio:capture';
  priority: 'P0-A';
  localStatus: string;
  stardewComparison: string[];
  xianxiaCore: string[];
  runtimeSignals: {
    appSurface: string;
    roundSeal: string;
    agendaSlotCount: number;
    hudCertificate: string;
    hudIntel: string;
    runtimeProof: string[];
  };
  evidence: string[];
  screenshotEvidence: PortfolioScreenshotEvidence[];
  next: string[];
  noGo: string[];
}

const OPENING_TITLES = [
  '这个世界的雷，先落在凡人屋顶',
  '测灵石上，你的答案是零',
  '修行之前，先弄清一碗饭从哪里来',
  '仙人斗法时，凡人的田先碎了',
  '测得是零，不等于什么都没进来'
] as const;

async function dismissOrientationIfPresent(page: Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

async function enterFirstPlanning(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  await dismissOrientationIfPresent(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('[data-app-surface="roguelite-proto"]').waitFor({ timeout: 8000 });
  for (const title of OPENING_TITLES) {
    await page.getByRole('heading', { name: title }).waitFor({ timeout: 8000 });
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
  await page.getByRole('heading', { name: '沈砚' }).waitFor({ timeout: 8000 });
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();
  await page.getByRole('heading', { name: '劫前修途' }).waitFor({ timeout: 8000 });
}

async function fillAgenda(page: Page, activities: readonly string[]): Promise<void> {
  for (const activity of activities) {
    await page.getByRole('button', { name: new RegExp(`^${activity}，[0-9]+ 日`) }).click();
  }
}

async function paintStatsFromPng(page: Page, png: Buffer): Promise<{ sampled: number; painted: number; colors: number }> {
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  return page.evaluate(async (src: string) => {
    const image = new Image();
    image.src = src;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('portfolio screenshot failed to load'));
    });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { sampled: 0, painted: 0, colors: 0 };
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colors = new Set<string>();
    let sampled = 0;
    let painted = 0;
    const step = Math.max(6, Math.floor(Math.min(canvas.width, canvas.height) / 64));
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const index = (y * canvas.width + x) * 4;
        sampled += 1;
        if ((data[index + 3] ?? 0) > 16) {
          painted += 1;
          colors.add(`${data[index]},${data[index + 1]!},${data[index + 2]!}`);
        }
      }
    }
    return { sampled, painted, colors: colors.size };
  }, dataUrl);
}

async function captureViewportScreenshot(page: Page, path: string, expectedSize: { width: number; height: number }): Promise<void> {
  await page.waitForTimeout(450);
  const png = await page.screenshot({ animations: 'disabled' });
  expect(png.length).toBeGreaterThan(24);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);
  const stats = await paintStatsFromPng(page, png);
  expect(stats.sampled).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minSampled);
  expect(stats.painted / stats.sampled).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minPaintedRatio);
  expect(stats.colors).toBeGreaterThan(PORTFOLIO_PAINT_THRESHOLDS.minColors);
  await appendPortfolioScreenshotEvidence(path, expectedSize.width, expectedSize.height, stats);
}

async function readPortfolioEvidence(): Promise<Partial<PortfolioMvpEvidence> | null> {
  try {
    const content = await readFile(PORTFOLIO_EVIDENCE_PATH, 'utf-8');
    return JSON.parse(content) as Partial<PortfolioMvpEvidence>;
  } catch {
    return null;
  }
}

async function writePortfolioEvidence(evidence: PortfolioMvpEvidence): Promise<void> {
  await mkdir(dirname(PORTFOLIO_EVIDENCE_PATH), { recursive: true });
  await writeFile(PORTFOLIO_EVIDENCE_PATH, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function appendPortfolioScreenshotEvidence(
  path: string,
  width: number,
  height: number,
  stats: { sampled: number; painted: number; colors: number }
): Promise<void> {
  const evidence = await readPortfolioEvidence();
  if (!evidence?.generatedBy) return;
  const screenshotEvidence = Array.isArray(evidence.screenshotEvidence)
    ? evidence.screenshotEvidence.filter(entry => entry.path !== path)
    : [];
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

async function collectRuntimeSignals(page: Page): Promise<PortfolioMvpEvidence['runtimeSignals']> {
  const debug = await gameDebugSnapshot(page);
  const roundSeal = (await page.locator('.rp-round-seal').textContent().catch(() => '')) ?? '';
  const agendaSlotCount = await page.locator('.rp-agenda-slot').count();
  const hudText = (await page.locator('.rp-hud').textContent().catch(() => '')) ?? '';
  const hudCertificate = /认证 [0-9]+ 步 · 余量 [0-9]+/.exec(hudText)?.[0] ?? '';
  const hudIntel = /劫兆未明|存活上限|安全雷威|甜蜜雷威/.exec(hudText)?.[0] ?? '';
  return {
    appSurface: debug.appSurface ?? '',
    roundSeal: roundSeal.trim(),
    agendaSlotCount,
    hudCertificate,
    hudIntel,
    runtimeProof: []
  };
}

function buildPortfolioMvpEvidence(signals: PortfolioMvpEvidence['runtimeSignals']): PortfolioMvpEvidence {
  return {
    generatedBy: 'portfolio:capture',
    priority: 'P0-A',
    localStatus: '本地可试玩 Demo 验收证据：主模式「偷天换劫」的备劫工作台、天劫棋盘、生活事件与紧凑横屏均由浏览器自动化生成。',
    stardewComparison: [
      '对标生活模拟的低门槛开局：数分钟内看懂"排程→事件→参悟→引劫"的第一轮修途闭环。',
      'P0 不追求成熟生活模拟体量，只证明主模式首屏无需说明书即可理解下一步。'
    ],
    xianxiaCore: ['排程备劫', '生活事件', '残卷参悟', '主动引劫', '劫灰传承'],
    runtimeSignals: { ...signals, runtimeProof: [...RUNTIME_SIGNAL_PROOF] },
    evidence: [
      'test-results/portfolio/01-prep-workbench.png',
      'test-results/portfolio/02-tribulation-board.png',
      'test-results/portfolio/03-life-event.png',
      'test-results/portfolio/04-compact-prep.png',
      'pnpm portfolio:mvp-preflight'
    ],
    screenshotEvidence: [],
    next: [
      '维护者人工试玩 3-5 分钟，确认首屏无需阅读设计文档也能理解下一步。',
      '远端授权操作（转 Public/Release/Pages 设置变更）仍需维护者当次授权。'
    ],
    noGo: [
      'Public、Release 或远端设置变更仍保持 remote-action authorization boundary。',
      '每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成。',
      'Agent 状态、生成物、.env*、sourcemap 和私有设计资料不得进入发布产物。'
    ]
  };
}

test('captures deterministic review screenshots for public demo validation', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 810 });
  await enterFirstPlanning(page);
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
  await fillAgenda(page, ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']);
  await page.getByRole('button', { name: '结清本轮修途' }).click();
  const resolution = page.locator('.cr-resolution');
  await resolution.waitFor({ timeout: 8000 });
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();
  const event = page.locator('.cr-event');
  await event.waitFor({ timeout: 8000 });
  await event.locator('.cr-event__button[data-affordable="true"]').first().click();
  const insight = page.locator('.cr-insight');
  await insight.waitFor({ timeout: 8000 });
  await insight.locator('.cr-insight__continue').click();
  const timing = page.locator('.cr-tribulation-choice');
  await timing.waitFor({ timeout: 8000 });
  await timing.getByRole('button', { name: /现在引劫/ }).click();
  await page.locator('.rp-canvas').waitFor({ timeout: 8000 });

  const signals = await collectRuntimeSignals(page);
  expect(signals.appSurface).toBe('roguelite-proto');
  expect(signals.hudCertificate).toMatch(/认证 [0-9]+ 步 · 余量 [0-9]+/);
  expect(signals.hudIntel.length).toBeGreaterThan(0);
  await writePortfolioEvidence(buildPortfolioMvpEvidence(signals));

  await captureViewportScreenshot(page, 'test-results/portfolio/02-tribulation-board.png', DESKTOP_PORTFOLIO_SCREENSHOT);
});

test('captures prep workbench and life event screenshots for demo review', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 810 });
  await enterFirstPlanning(page);
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
  await captureViewportScreenshot(page, 'test-results/portfolio/01-prep-workbench.png', DESKTOP_PORTFOLIO_SCREENSHOT);

  await fillAgenda(page, ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']);
  await page.getByRole('button', { name: '结清本轮修途' }).click();
  const resolution = page.locator('.cr-resolution');
  await resolution.waitFor({ timeout: 8000 });
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();
  const event = page.locator('.cr-event');
  await event.waitFor({ timeout: 8000 });
  await captureViewportScreenshot(page, 'test-results/portfolio/03-life-event.png', DESKTOP_PORTFOLIO_SCREENSHOT);
});

test('captures a small-viewport landscape keyboard-first screen for GitHub Pages demo review', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 736, height: 414 });
  await enterFirstPlanning(page);
  await expect(page.locator('.rp-agenda-slot')).toHaveCount(6);
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
  await captureViewportScreenshot(page, 'test-results/portfolio/04-compact-prep.png', { width: 736, height: 414 });
});
