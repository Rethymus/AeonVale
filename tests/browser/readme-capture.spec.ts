// README 预告素材捕获：仅捕获玩家真实可达的两个表面——
//   ① 主模式「偷天换劫」roguelite（标题「开始游戏」→ start-roguelite-proto）
//   ② 「灵韵叙录」第一人称 VN（标题「✦ 灵韵叙录」→ start-narration）
// 绝不捕获遗留 world/农庄（仅 __AEON_TEST__.enterLegacyWorld 可达，玩家不可达）。
//
// 重要：不要复用 openGame()/continueToWorld()——它们会调用 enterLegacyWorld() 把流程旁路到
//   遗留 world。这里只用 gameEntryPath() + waitForInitialSurface()（不旁路）。
//
// 默认不注册素材捕获用例，需 README_CAPTURE=1 才跑（pnpm readme:capture）。帧序列落
//   assets/screenshots/_frames/<moment>/frame-0001.png，由 tools/readme-gif.mjs 编码为 GIF。
import { expect, test, type Page } from '@playwright/test';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gameEntryPath, waitForInitialSurface } from './openGame';

const ENABLED = process.env.README_CAPTURE === '1';
const OUT_DIR = 'assets/screenshots';
const FRAMES_DIR = join(OUT_DIR, '_frames');

// 横屏桌面视口（同时让方向门禁不出现）。
const VIEWPORT = { width: 1280, height: 720 } as const;

interface CultivationSnapshot {
  phase?: string;
  machinePhase?: string;
  outcome?: string | null;
  stage?: number;
  generation?: number;
  runStatus?: string;
  solutionMoves?: readonly ('up' | 'down' | 'left' | 'right')[];
}

interface AeonTestHooks {
  // 两个 keypoint 均无必填参数；默认配置即可落到对应阶段。
  configureCultivationPlanningKeypoint?: () => CultivationSnapshot | null;
  configureCultivationArrayKeypoint?: () => CultivationSnapshot | null;
}

async function gotoTitle(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await expect(page.locator('[data-app-surface="title"]')).toBeVisible({ timeout: 20_000 });
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
}

async function enterRoguelite(page: Page): Promise<void> {
  await page.locator('#flow-title-new-game').click();
  await expect(page.locator('[data-app-surface="roguelite-proto"]')).toBeVisible({ timeout: 12_000 });
  await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: { appSurface?: string } }).__AEON_DEBUG__?.appSurface)) === 'roguelite-proto').toBe(true);
}

async function rogueliteKeypoint(page: Page, hook: keyof AeonTestHooks): Promise<CultivationSnapshot | null> {
  return page.evaluate((name) => {
    const hooks = (window as typeof window & { __AEON_TEST__?: AeonTestHooks }).__AEON_TEST__;
    return hooks?.[name]?.() ?? null;
  }, hook);
}

async function clearDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  for (const entry of await readdir(dir).catch(() => [])) {
    if (/^frame-\d{4}\.png$/.test(entry)) await unlink(join(dir, entry)).catch(() => {});
  }
}

async function writeStill(path: string, buffer: Buffer): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(path, buffer);
}

async function writeFrame(selector: string, dir: string, index: number, page: Page): Promise<void> {
  const buffer = await page.locator(selector).screenshot();
  await writeFile(join(dir, `frame-${String(index + 1).padStart(4, '0')}.png`), buffer);
}

if (ENABLED) test.describe('README media capture (roguelite + 灵韵叙录)', () => {
  test('roguelite sokoban tribulation GIF', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    await gotoTitle(page);
    await enterRoguelite(page);

    const snapshot = await rogueliteKeypoint(page, 'configureCultivationArrayKeypoint');
    expect(snapshot?.phase, 'array keypoint should land on tribulation phase').toBe('tribulation');
    expect(snapshot?.solutionMoves?.length, 'array keypoint should expose a certified solution').toBeGreaterThan(0);
    await expect(page.locator('.rp-canvas')).toBeVisible();
    await page.locator('.rp-canvas').click(); // 聚焦以接收键盘

    // GIF：按生成器签发的最短解逐步输入，展示绝缘石移闸、水石续脉、金石折雷与最终淬体。
    const dir = join(FRAMES_DIR, 'tribulation-sokoban');
    await clearDir(dir);
    const keys = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' } as const;
    let frameIndex = 0;
    await writeFrame('.rp-tribulation', dir, frameIndex++, page);
    for (const move of snapshot?.solutionMoves ?? []) {
      await page.keyboard.press(keys[move]);
      await page.waitForTimeout(70);
      await writeFrame('.rp-tribulation', dir, frameIndex++, page);
    }
    await expect(page.locator('.rp-outcome')).toContainText('完美淬体');
    for (let tail = 0; tail < 5; tail += 1) {
      await page.waitForTimeout(80);
      await writeFrame('.rp-tribulation', dir, frameIndex++, page);
    }
  });

  test('roguelite prep agenda still', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    await gotoTitle(page);
    await enterRoguelite(page);

    const planning = await rogueliteKeypoint(page, 'configureCultivationPlanningKeypoint');
    expect(planning, 'planning keypoint should configure').not.toBeNull();
    await page.waitForTimeout(140);
    await writeStill(join(OUT_DIR, 'roguelite-prep.png'), await page.locator('#roguelite-proto-root').screenshot());
  });

  test('灵韵叙录 narration typewriter GIF + codex still', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(VIEWPORT);
    // 打字机逐字揭示依赖 reducedMotion=false（true 会瞬显整行，拍不出逐字）。
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('aeonvale-settings-v1', JSON.stringify({ masterVolume: 0, reducedMotion: false }));
        window.localStorage.setItem('narration.introRead', '1'); // 跳过开发者来信，直达叙录场景
      } catch {
        /* ignore */
      }
    });
    await gotoTitle(page);
    await page.locator('#flow-title-narration').click();
    await expect(page.locator('[data-app-surface="narration"]')).toBeVisible({ timeout: 12_000 });
    await expect(page.locator('#narration-stage')).toBeVisible();
    await page.waitForTimeout(300); // 等首行开始打字

    // GIF：按"文本是否仍在生长"自适应捕获——文本稳定（打完）且无选项时才点舞台进入下一句，
    // 保证整段 GIF 都在"逐字揭示"，避免在选项界面卡死成静帧。
    const dir = join(FRAMES_DIR, 'narration-typewriter');
    await clearDir(dir);
    const stage = page.locator('#narration-stage');
    let lastText = '';
    let stableTicks = 0;
    for (let index = 0; index < 26; index += 1) {
      const text = await stage.innerText().catch(() => '');
      if (text && text === lastText) stableTicks += 1;
      else stableTicks = 0;
      lastText = text;
      const choiceVisible = await page.locator('button.narration-choice').first().isVisible().catch(() => false);
      if (index > 0 && stableTicks >= 3 && !choiceVisible) {
        await page.evaluate(() => document.querySelector<HTMLElement>('#narration-stage')?.click());
        stableTicks = 0;
        await page.waitForTimeout(90);
      }
      await writeFrame('[data-app-surface="narration"]', dir, index, page);
      await page.waitForTimeout(75);
    }

    // 叙录图鉴：章节轨 + 结局墙（8 张）。
    await page.locator('#flow-narration-codex-open').click();
    await expect(page.locator('#codex-root')).toBeVisible({ timeout: 8_000 });
    await expect.poll(async () => (await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: { flowOverlay?: string } }).__AEON_DEBUG__?.flowOverlay)) === 'codex').toBe(true);
    await writeStill(join(OUT_DIR, 'narration-codex.png'), await page.locator('#codex-root').screenshot({ animations: 'disabled' }));
  });
});
