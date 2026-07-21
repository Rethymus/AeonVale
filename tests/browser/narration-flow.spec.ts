/**
 * 灵韵叙录端到端浏览器测试（docs/22 §2/§6/§11，docs/23 §7 验收）。
 *
 * 覆盖 autopilot spec 验收三条：
 *  1. 标题屏「灵韵叙录」入口 → 开发者自白对话框（含「─ 来自开发者」+ 颜文字）→ 选 A
 *     → [data-app-surface="narration"] 显示。
 *  2. 推进到结局：序章「山谷深处」（prologue.deep）→ E0 红伞白杆早夭。
 *  3. 叙录界面：narration 内点「叙录」→ codex overlay → 章节进度 X/4 + 结局图鉴墙（locked 问号）。
 *  4. 无障碍：#narration-stage aria-label/role、aria-live 区。
 *
 * 确定性策略（禁 flaky）：
 *  - 预置 localStorage `aeonvale-settings-v1.reducedMotion:true` → 打字机即时（speed=0），
 *    避免按字符定时等待。
 *  - 清空 narration intro/codex localStorage 键，保证每周目从「自白未读 + 图鉴全锁」起。
 *  - 推进用「直接对舞台元素 el.click()」触发 onStageClick→advance（event.target=舞台本身，
 *    target.closest('button') 为空），绕开 Quick Menu 子按钮误触；选项按钮才用真实点击
 *    （舞台 click 处理器对 button 目标 early-return，交还原生点击）。
 */
import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath } from './openGame';

const SETTINGS_KEY = 'aeonvale-settings-v1';
const NARRATION_KEYS = [
  'narration.introRead',
  'narration.codex.seenThisRun',
  'narration.codex.seenScenesEver',
  'narration.codex.seenEndings',
  'narration.e7Triggered'
];

/** 预置 reduced motion + 清空 narration 周目状态，确保即时打字与全新图鉴。 */
async function prepareFreshNarration(page: Page): Promise<void> {
  await page.addInitScript(keys => {
    try {
      window.localStorage.setItem(
        'aeonvale-settings-v1',
        JSON.stringify({ masterVolume: 0, reducedMotion: true })
      );
      for (const key of keys) window.localStorage.removeItem(key);
    } catch {
      /* 隐私模式：静默降级 */
    }
  }, NARRATION_KEYS);
}

/** 对当前可见的 narration 舞台（intro 或主舞台）派发一次原生 click，触发 advance。 */
async function clickStage(page: Page): Promise<void> {
  await page
    .locator('#narration-intro-stage, #narration-stage')
    .first()
    .evaluate((el: HTMLElement) => el.click());
}

/** 反复推进舞台直到 predicate 为真（或超时抛错）。 */
async function advanceUntil(page: Page, predicate: () => Promise<boolean>, timeoutMs = 12000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await clickStage(page).catch(() => undefined);
    await page.waitForTimeout(40);
  }
  if (!(await predicate())) {
    throw new Error(`advanceUntil: 条件在 ${timeoutMs}ms 内未满足`);
  }
}

async function openTitleAndEntry(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  // 标题屏就绪：入口按钮可见即可点。
  await expect(page.locator('#flow-title-narration')).toBeVisible({ timeout: 20000 });
}

test.describe('灵韵叙录 · 端到端 narration flow', () => {
  test('标题入口开「开发者自白」对话框，选 A 进入 narration surface（含无障碍）', async ({ page }) => {
    await prepareFreshNarration(page);
    await openTitleAndEntry(page);

    const entry = page.locator('#flow-title-narration');
    await expect(entry).toBeVisible();
    // 副标题「以灵韵写就，再叙一遍」印证入口身份（spec 接入点）。
    await expect(entry.locator('#flow-title-narration-subtitle')).toContainText('以灵韵写就');

    // 点击入口 → 自白对话框 modal 浮现（仍在 title surface，不切 screen）。
    await entry.click();
    await expect(page.locator('.narration-intro-overlay')).toBeVisible();
    // 署名「─ 来自开发者」+ 颜文字选项印证 docs/22 §2.2 自白信笺皮。
    await expect(page.locator('#narration-intro-heading')).toHaveText('─ 来自开发者');
    await expect(page.locator('#narration-intro-vn')).toBeVisible();

    // reducedMotion 即时打字：推进直到 A 选项按钮出现，点 A「试一试」。
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="try"]').isVisible()
    );
    const tryLabel = page.locator('button.narration-choice[data-choice-id="try"]');
    await expect(tryLabel).toContainText('试一试');
    await tryLabel.click();

    // 切到灵韵叙录 surface。
    const narrationSurface = page.locator('[data-app-surface="narration"]');
    await expect(narrationSurface).toBeVisible({ timeout: 8000 });
    await expect.poll(
      async () =>
        (await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: { appSurface?: string } }).__AEON_DEBUG__))
          ?.appSurface
    ).toBe('narration');

    // 无障碍：舞台 role + aria-label + aria-live 播报区（docs/23 §5）。
    const stage = page.locator('#narration-stage');
    await expect(stage).toHaveAttribute('role', 'group');
    const stageLabel = await stage.getAttribute('aria-label');
    expect(stageLabel, 'narration-stage 须有非空 aria-label').not.toBeNull();
    expect(stageLabel!.trim().length).toBeGreaterThan(0);
    await expect(page.locator('#narration-stage [aria-live="polite"]')).toHaveCount(1);
  });

  test('序章「山谷深处」分支推进到 E0 红伞白杆早夭结局', async ({ page }) => {
    await prepareFreshNarration(page);
    await openTitleAndEntry(page);

    // 进 narration surface（自白 → 试一试）。
    await page.locator('#flow-title-narration').click();
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="try"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="try"]').click();
    await expect(page.locator('[data-app-surface="narration"]')).toBeVisible({ timeout: 8000 });

    // 序章开场（prologue.awaken）：推进到选项，选「山谷深处」(deep) → prologue.deep（叶节点 ends=e0-mushroom）。
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="deep"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="deep"]').click();

    // prologue.deep 叶节点：推进读完旁白 → 结局卡浮现。
    await advanceUntil(page, async () =>
      page.locator('.narration-ending-card[data-ending-id="e0-mushroom"]').isVisible()
    );

    const endingCard = page.locator('.narration-ending-card[data-ending-id="e0-mushroom"]');
    await expect(endingCard).toBeVisible();
    await expect(endingCard.locator('.narration-ending-name')).toHaveText('红伞白杆');
    // 返回标题按钮存在且可聚焦。
    await expect(endingCard.locator('.narration-ending-dismiss')).toBeVisible();
  });

  test('叙录覆盖层：章节进度 X/4 + 结局图鉴墙 8 卡（全新周目全 locked）', async ({ page }) => {
    await prepareFreshNarration(page);
    await openTitleAndEntry(page);

    // 进 narration surface。
    await page.locator('#flow-title-narration').click();
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="try"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="try"]').click();
    await expect(page.locator('[data-app-surface="narration"]')).toBeVisible({ timeout: 8000 });

    // 点「叙录」按钮 → codex overlay（docs/22 §11）。
    await expect(page.locator('#flow-narration-codex-open')).toBeVisible();
    await page.locator('#flow-narration-codex-open').click();

    const codex = page.locator('#codex-root');
    await expect(codex).toBeVisible({ timeout: 5000 });
    await expect.poll(
      async () =>
        (await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: { flowOverlay?: string | null } }).__AEON_DEBUG__))
          ?.flowOverlay
    ).toBe('codex');

    // 顶栏章节轨：进度文案含「/4 幕」。
    const track = codex.locator('[data-codex-region="track"]');
    await expect(track).toBeVisible();
    await expect(track).toContainText('/4');

    // 侧栏图鉴墙：8 张结局卡（docs/22 §7 八结局），全新周目全 locked、显示问号。
    const wall = codex.locator('[data-codex-region="wall"]');
    await expect(wall).toBeVisible();
    await expect(wall.locator('.codex-ending')).toHaveCount(8);
    await expect(wall.locator('.codex-ending[data-state="locked"]')).toHaveCount(8);
    // locked 卡渲染问号占位（非剧透），而非 CG/名。
    await expect(wall.locator('.codex-ending-q').first()).toBeVisible();

    // 图鉴墙标题计数「X/8」（全新周目 X=0）。
    await expect(wall.locator('.codex-wall-title')).toContainText('/8');
  });
});
