import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { clearIntroDialogue, openGame, canvasPaintStats, gameDebugSnapshot } from './openGame';
import { evaluateVisualDrift, sampleToBaseline, type VisualBaseline } from './visualDrift';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = resolve(HERE, '__visual-baselines__');
const BASELINE_FILE = resolve(BASELINE_DIR, 'visual-soft-gate-baseline.json');
const ARTIFACTS_DIR = resolve(HERE, '..', '..', '.omc', 'artifacts');

async function configureSowKeypoint(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  try {
    const result = await client.send('Runtime.evaluate', {
      expression: `Boolean(window.__AEON_TEST__?.configureSowKeypoint?.())`,
      awaitPromise: true,
      returnByValue: true
    });
    expect(result.exceptionDetails, JSON.stringify(result.exceptionDetails ?? null)).toBeUndefined();
    expect(result.result.value).toBe(true);
  } finally {
    await client.detach();
  }
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: { onboardingObjectiveId?: string; frontTileTilled?: boolean } }).__AEON_DEBUG__;
    return debug?.onboardingObjectiveId === 'first-sow' && debug.frontTileTilled === true;
  });
}

function loadBaseline(): VisualBaseline | null {
  if (!existsSync(BASELINE_FILE)) return null;
  try {
    const raw = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as { paintedRatio?: number; colors?: number };
    if (typeof raw.paintedRatio === 'number' && typeof raw.colors === 'number') return { paintedRatio: raw.paintedRatio, colors: raw.colors };
  } catch {
    /* 基线损坏 → 视作无基线，重写 */
  }
  return null;
}

/**
 * 视觉 snapshot 软门：在确定性 sow 关键帧采集画布"绘制率/色彩丰富度"粗指标，
 * 与基线比较；漂移超容差仅告警（test.attach + console.warn），永不失败。
 * 首次运行写入基线。这是体验门的视觉回归"软"层——人眼复核信号，非硬卡点。
 */
test('visual snapshot soft gate: stable keyframe paint metrics stay near baseline', async ({ page }) => {
  test.setTimeout(60_000);
  await openGame(page);
  await clearIntroDialogue(page);
  await configureSowKeypoint(page);
  await page.waitForTimeout(150); // 让关键帧渲染稳定

  const debug = await gameDebugSnapshot(page);
  const sampled = await canvasPaintStats(page);
  expect(sampled.sampled, 'canvas 应有可采样像素').toBeGreaterThan(0);

  // 保存当前快照 PNG 供人眼复核（dev-only，不入公开产物）。
  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const png = await page.locator('canvas').screenshot({ animations: 'disabled' });
  writeFileSync(resolve(ARTIFACTS_DIR, 'visual-snapshot-soft-gate.png'), png);

  const baseline = loadBaseline();
  const verdict = evaluateVisualDrift(sampled, baseline);

  if (baseline === null) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    writeFileSync(BASELINE_FILE, `${JSON.stringify(sampleToBaseline(sampled), null, 2)}\n`);
  }

  const summary =
    `视觉软门 @ first-sow 关键帧：绘制率=${verdict.paintedRatio.toFixed(3)}（Δ=${verdict.paintedRatioDelta.toFixed(3)}）` +
    `，色彩相对Δ=${(verdict.colorsDeltaRel * 100).toFixed(0)}% → ${verdict.reason}`;
  // 软门：仅告警，不抛错。
  test.info().annotations.push({ type: 'visual-soft-gate', description: summary });
  // eslint-disable-next-line no-console
  console.log(`[visual-soft-gate] ${summary}`);

  // 附加元数据便于追溯（基线/采样/关键帧 debug 摘要）。
  await test.info().attach('visual-soft-gate-summary.txt', {
    body: `${summary}\n\nbaseline=${JSON.stringify(baseline)}\nsample=${JSON.stringify(sampled)}\nkeyframe=${JSON.stringify({ objective: debug.onboardingObjectiveId, day: debug.day, season: debug.season })}\n`
  });

  // 软门：即使 warn 也通过；真实断言只保留"画布在渲染"。
  expect(sampled.painted, '画布必须有绘制内容').toBeGreaterThan(0);
});
