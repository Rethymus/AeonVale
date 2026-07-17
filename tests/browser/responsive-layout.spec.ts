import { expect, test, type Page } from '@playwright/test';
import { gameEntryPath, type AeonDebugSnapshot } from './openGame';

async function openResponsiveGame(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('canvas')?.width === 960);
}

test('desktop canvas fills the available 16:9 viewport instead of stopping at 960 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: { appSurface?: string } }).__AEON_DEBUG__?.appSurface === 'world');

  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(1400);
  expect(box!.height).toBeGreaterThanOrEqual(780);
  expect(await page.locator('#orientation-gate').isVisible()).toBe(false);
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([1440, 900]);
});

test('portrait viewport shows the orientation gate instead of a compressed playable canvas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openResponsiveGame(page);

  await expect(page.locator('#orientation-gate')).toBeVisible();
  await expect(page.locator('#orientation-gate')).toContainText('请横置设备');
  await expect(page.locator('#orientation-save-status')).toContainText('尚无可恢复的本地存档');
  await expect(page.locator('#orientation-save-status')).not.toContainText('安全保留');
  await expect(page.locator('canvas')).toBeHidden();
  await expect(page.locator('#touch-controls')).toBeHidden();
  expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([390, 844]);
});

test('same-orientation resize refreshes canvas and debug layout bounds immediately', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.canvasBounds?.width === 1440);

  await page.setViewportSize({ width: 960, height: 540 });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.canvasBounds?.width === 960 && debug.canvasBounds.height === 540 && debug.viewportProfile === 'desktop';
  });

  const debug = await page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
  expect(debug.worldBounds?.width).toBeGreaterThan(600);
  expect(debug.objectiveRailBounds?.width).toBeGreaterThan(200);
  const box = await page.locator('canvas').boundingBox();
  expect(box).toMatchObject({ width: 960, height: 540 });
});

/**
 * REQ-A3-02 硬门：桌面档打开高频 surface 时文档无水平溢出，
 * 且可见 flow-frame 不互相穿插（取前若干可见框两两不相交）。
 */
test('desktop world and alchemy surfaces do not overflow or cross-intersect panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await page.locator('#flow-title-new-game').click();
  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(
    () => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world'
  );

  async function layoutHardGate(): Promise<{ overflowX: number; overflowY: number; intersections: number }> {
    return page.evaluate(() => {
      const root = document.documentElement;
      const overflowX = root.scrollWidth - root.clientWidth;
      const overflowY = root.scrollHeight - root.clientHeight;
      const frames = Array.from(document.querySelectorAll<HTMLElement>('.flow-frame, .demo-stage-section, #world-journey-action, #objective-rail'))
        .filter(el => {
          const style = getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
          const r = el.getBoundingClientRect();
          return r.width > 8 && r.height > 8;
        })
        .slice(0, 12)
        .map(el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, w: r.width, h: r.height };
        });
      let intersections = 0;
      for (let i = 0; i < frames.length; i += 1) {
        for (let j = i + 1; j < frames.length; j += 1) {
          const a = frames[i]!;
          const b = frames[j]!;
          const ax2 = a.x + a.w;
          const ay2 = a.y + a.h;
          const bx2 = b.x + b.w;
          const by2 = b.y + b.h;
          const overlap = a.x < bx2 - 1 && ax2 > b.x + 1 && a.y < by2 - 1 && ay2 > b.y + 1;
          // 允许父子包含：若一方完全在另一方内，不记穿插
          const aInB = a.x >= b.x - 1 && ay2 <= by2 + 1 && ax2 <= bx2 + 1 && a.y >= b.y - 1;
          const bInA = b.x >= a.x - 1 && by2 <= ay2 + 1 && bx2 <= ax2 + 1 && b.y >= a.y - 1;
          if (overlap && !aInB && !bInA) intersections += 1;
        }
      }
      return { overflowX, overflowY, intersections };
    });
  }

  const worldGate = await layoutHardGate();
  expect(worldGate.overflowX).toBeLessThanOrEqual(2);
  expect(worldGate.intersections).toBe(0);

  // DOM 结构硬门：直接打开炼丹 surface（不跑完整 onboarding；纵切片另有路径覆盖）
  await page.evaluate(() => {
    const hide = (surface: string) => {
      const el = document.querySelector<HTMLElement>(`[data-app-surface="${surface}"]`);
      if (!el) return;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('inert', '');
    };
    const show = (surface: string) => {
      const el = document.querySelector<HTMLElement>(`[data-app-surface="${surface}"]`);
      if (!el) return;
      el.hidden = false;
      el.removeAttribute('inert');
      el.setAttribute('aria-hidden', 'false');
    };
    hide('world');
    show('alchemy');
  });
  await expect(page.locator('[data-app-surface="alchemy"]')).toBeVisible();
  await expect(page.locator('#flow-alchemy-pairing')).toBeVisible();
  const alchemyGate = await layoutHardGate();
  expect(alchemyGate.overflowX).toBeLessThanOrEqual(2);
  expect(alchemyGate.intersections).toBe(0);
});
