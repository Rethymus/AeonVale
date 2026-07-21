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
  'narration.e7Triggered',
  'narration.readChoices',
  'narration.textSize'
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
  const entry = page.locator('#flow-title-narration');
  const continuePortrait = page.locator('#orientation-override');
  await expect.poll(async () => {
    if (await entry.isVisible().catch(() => false)) return true;
    if (await continuePortrait.isVisible().catch(() => false)) {
      await continuePortrait.click();
    }
    return entry.isVisible().catch(() => false);
  }, { timeout: 20000 }).toBe(true);
  // 标题屏就绪：入口按钮可见即可点。
  await expect(entry).toBeVisible();
}

async function enterMainNarration(page: Page): Promise<void> {
  await openTitleAndEntry(page);
  await page.locator('#flow-title-narration').click();
  await advanceUntil(page, async () =>
    page.locator('button.narration-choice[data-choice-id="try"]').isVisible()
  );
  await page.locator('button.narration-choice[data-choice-id="try"]').click();
  await expect(page.locator('[data-app-surface="narration"]')).toBeVisible({ timeout: 8000 });
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
    await page.addInitScript(() => {
      Object.defineProperty(HTMLImageElement.prototype, 'decode', {
        configurable: true,
        value: () => Promise.reject(new DOMException('forced decode rejection for regression coverage'))
      });
    });
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
    const endingCg = endingCard.locator('.narration-ending-cg');
    await expect(endingCg).toHaveAttribute('data-decoded', 'true');
    await expect(endingCg).toBeVisible();
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

  test('回访 hub 不重播开场：一次性选项消失且正文/心声不残留', async ({ page }) => {
    await prepareFreshNarration(page);
    await enterMainNarration(page);

    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="village"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="village"]').click();
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="system"]').isVisible()
    );

    await page.locator('button.narration-choice[data-choice-id="system"]').click();
    await advanceUntil(page, async () => {
      const askVisible = await page.locator('button.narration-choice[data-choice-id="ask"]').isVisible().catch(() => false);
      const systemCount = await page.locator('button.narration-choice[data-choice-id="system"]').count();
      return askVisible && systemCount === 0;
    });

    const stage = page.locator('#narration-stage');
    await expect(stage).toHaveAttribute('data-scene-id', 'prologue.village');
    await expect(page.locator('button.narration-choice[data-choice-id="system"]')).toHaveCount(0);
    await expect(stage.locator('.narration-text')).toHaveText('');
    await expect(stage.locator('.narration-cabinet')).toBeHidden();
  });

  test('内心声部只显示在主阅读面，不再与识海浮纹复制同一文段', async ({ page }) => {
    await prepareFreshNarration(page);
    await enterMainNarration(page);

    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="village"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="village"]').click();
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="ask"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="ask"]').click();

    const selfLine = '我没听懂修仙那半句，只把“先看清”记住了。那是他第一次主动教我一件事。';
    await advanceUntil(page, async () =>
      (await page.locator('#narration-stage .narration-text').textContent().catch(() => ''))?.includes('我没听懂修仙') === true
    );
    await expect(page.locator('#narration-stage')).toHaveAttribute('data-scene-id', 'prologue.depart');
    await expect(page.locator('#narration-stage .narration-text')).toContainText(selfLine);
    await expect(page.locator('#narration-stage .narration-cabinet')).toBeHidden();
    await expect(page.locator('#narration-stage .narration-cabinet')).not.toContainText('我没听懂修仙');
  });

  test('移动端大字号五选项：心声、对话框与快捷菜单保持顺序且不相交', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareFreshNarration(page);
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('narration.textSize', 'large');
      } catch {
        /* 隐私模式：静默降级 */
      }
    });
    await enterMainNarration(page);

    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="village"]').isVisible()
    );
    await page.locator('button.narration-choice[data-choice-id="village"]').click();
    await advanceUntil(page, async () =>
      page.locator('button.narration-choice[data-choice-id="system"]').isVisible()
    );

    const geometry = await page.locator('#narration-stage').evaluate(stage => {
      const box = (selector: string): DOMRect => {
        const element = stage.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`缺少 ${selector}`);
        return element.getBoundingClientRect();
      };
      const stageBox = stage.getBoundingClientRect();
      const dock = box('.narration-bottom-dock');
      const cabinet = box('.narration-cabinet');
      const dialog = box('.narration-dialog');
      const text = box('.narration-text');
      const choices = box('.narration-choices');
      const quick = box('.narration-quick-menu');
      const dialogEl = stage.querySelector<HTMLElement>('.narration-dialog')!;
      const textEl = stage.querySelector<HTMLElement>('.narration-text')!;
      return {
        stage: { top: stageBox.top, bottom: stageBox.bottom },
        dock: { top: dock.top, bottom: dock.bottom },
        cabinet: { top: cabinet.top, bottom: cabinet.bottom },
        dialog: { top: dialog.top, bottom: dialog.bottom, clientHeight: dialogEl.clientHeight, scrollHeight: dialogEl.scrollHeight },
        text: { top: text.top, bottom: text.bottom, clientHeight: textEl.clientHeight, scrollHeight: textEl.scrollHeight },
        choices: { top: choices.top, bottom: choices.bottom },
        quick: { top: quick.top, bottom: quick.bottom }
      };
    });
    expect(geometry.dock.top).toBeGreaterThanOrEqual(geometry.stage.top - 1);
    expect(geometry.dock.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1);
    expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1);
    expect(geometry.quick.bottom).toBeLessThanOrEqual(geometry.stage.bottom + 1);
    expect(geometry.cabinet.bottom).toBeLessThanOrEqual(geometry.dialog.top + 1);
    expect(geometry.text.clientHeight).toBeGreaterThanOrEqual(geometry.text.scrollHeight - 1);
    expect(geometry.text.bottom).toBeLessThanOrEqual(geometry.choices.top + 1);
    expect(geometry.dialog.bottom).toBeLessThanOrEqual(geometry.quick.top + 1);
    expect(geometry.dialog.clientHeight).toBeLessThanOrEqual(geometry.dialog.scrollHeight);
  });
});
