import { expect, test, type Page } from '@playwright/test';
import { clearIntroDialogue, continueToWorld, gameEntryPath, type AeonDebugSnapshot } from './openGame';

async function openResponsiveGame(page: Page): Promise<void> {
  await page.goto(gameEntryPath());
  await page.waitForSelector('canvas', { state: 'attached' });
  await page.waitForFunction(() => document.querySelector('canvas')?.width === 960);
}

async function openWorldHud(page: Page): Promise<void> {
  await openResponsiveGame(page);
  await continueToWorld(page);
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world');
  await clearIntroDialogue(page);
  await expect(page.locator('#objective-rail')).toBeVisible();
  await expect(page.locator('#world-command-bar')).toBeVisible();
}

interface HudSeparationReport {
  verticalGap: number;
  commandOverflow: number;
  fateOpen: boolean;
  railText: string;
  fateText: string;
  intersections: string[];
  viewportViolations: string[];
}

async function hudSeparation(page: Page): Promise<HudSeparationReport> {
  return page.evaluate(() => {
    const objectiveRail = document.querySelector<HTMLElement>('#objective-rail');
    const commandBar = document.querySelector<HTMLElement>('#world-command-bar');
    const fateStatus = document.querySelector<HTMLElement>('#fate-status-strip');
    const fateDrawer = document.querySelector<HTMLDetailsElement>('#fate-rail-details');
    const vitalStrip = document.querySelector<HTMLElement>('#world-vital-strip');
    if (!objectiveRail || !commandBar || !fateStatus || !fateDrawer || !vitalStrip) throw new Error('HUD nodes are missing');

    type RectEntry = { name: string; x: number; y: number; width: number; height: number };
    const visibleRect = (name: string, selector: string): RectEntry | null => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return null;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      if (element.hidden || style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0 || rect.width <= 1 || rect.height <= 1) return null;
      return { name, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    };
    const right = (rect: RectEntry): number => rect.x + rect.width;
    const bottom = (rect: RectEntry): number => rect.y + rect.height;
    const intersects = (a: RectEntry, b: RectEntry): boolean => a.x < right(b) - 1 && right(a) > b.x + 1 && a.y < bottom(b) - 1 && bottom(a) > b.y + 1;

    const objective = objectiveRail.getBoundingClientRect();
    const command = commandBar.getBoundingClientRect();
    const horizontallyOverlaps = objective.left < command.right - 1 && objective.right > command.left + 1;
    const rects = [
      visibleRect('角色状态条', '#world-vital-strip'),
      visibleRect('旅程目标栏', '#objective-rail'),
      visibleRect('命劫摘要', '#fate-status-strip'),
      visibleRect('命劫详情', '#fate-rail-details .fate-detail-body'),
      visibleRect('主命令栏', '#world-command-bar')
    ].filter((entry): entry is RectEntry => entry != null);
    const intersections: string[] = [];
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        const a = rects[i]!;
        const b = rects[j]!;
        if (intersects(a, b)) intersections.push(`${a.name}/${b.name}`);
      }
    }
    const viewportViolations = rects
      .filter(rect => rect.x < -1 || rect.y < -1 || right(rect) > window.innerWidth + 1 || bottom(rect) > window.innerHeight + 1)
      .map(rect => rect.name);
    return {
      verticalGap: horizontallyOverlaps ? command.top - objective.bottom : Number.POSITIVE_INFINITY,
      commandOverflow: commandBar.scrollHeight - commandBar.clientHeight,
      fateOpen: fateDrawer.open,
      railText: objectiveRail.innerText,
      fateText: fateStatus.innerText,
      intersections,
      viewportViolations
    };
  });
}

test('desktop canvas fills the available 16:9 viewport instead of stopping at 960 CSS pixels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await continueToWorld(page);
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
  await continueToWorld(page);
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

test('landscape world HUD keeps journey, fate summary, and command bar separated', async ({ page }) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.addInitScript(() => localStorage.clear());
  await openWorldHud(page);

  let layout = await hudSeparation(page);
  expect(layout.fateOpen).toBe(false);
  expect(layout.railText).toContain('1/4 · 获得灵草');
  expect(layout.railText).toContain('灵田');
  expect(layout.railText).not.toMatch(/劫势|天象/);
  expect(layout.fateText).toMatch(/劫|备劫/);
  expect(layout.fateText).toContain('天象平稳');
  expect(layout.intersections).toEqual([]);
  expect(layout.viewportViolations).toEqual([]);
  expect(layout.verticalGap).toBeGreaterThanOrEqual(8);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);

  await page.locator('#fate-rail-summary').click();
  await expect(page.locator('#fate-rail-details .fate-detail-body')).toBeVisible();
  layout = await hudSeparation(page);
  expect(layout.fateOpen).toBe(true);
  expect(layout.intersections).toEqual([]);
  expect(layout.viewportViolations).toEqual([]);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);
  await page.locator('#fate-rail-summary').click();

  await page.setViewportSize({ width: 736, height: 414 });
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    return debug?.canvasBounds?.width === 736 && debug.canvasBounds.height === 414;
  });
  layout = await hudSeparation(page);
  expect(layout.fateOpen).toBe(false);
  expect(layout.intersections).toEqual([]);
  expect(layout.viewportViolations).toEqual([]);
  expect(layout.verticalGap).toBeGreaterThanOrEqual(8);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);

  await page.locator('#fate-rail-summary').click();
  await expect(page.locator('#fate-rail-details .fate-detail-body')).toBeVisible();
  layout = await hudSeparation(page);
  expect(layout.fateOpen).toBe(true);
  expect(layout.intersections).toEqual([]);
  expect(layout.viewportViolations).toEqual([]);
  expect(layout.commandOverflow).toBeLessThanOrEqual(1);
});

/**
 * REQ-A3-02 硬门：桌面档打开高频 surface 时文档无水平溢出，
 * 且可见 flow-frame 不互相穿插（取前若干可见框两两不相交）。
 */
test('desktop world and inventory furnace surfaces do not overflow or cross-intersect panels', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openResponsiveGame(page);
  await continueToWorld(page);
  await page.waitForFunction(
    () => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world'
  );

  async function layoutHardGate(): Promise<{ overflowX: number; overflowY: number; intersections: number }> {
    return page.evaluate(() => {
      const root = document.documentElement;
      const overflowX = root.scrollWidth - root.clientWidth;
      const overflowY = root.scrollHeight - root.clientHeight;
      const frames = Array.from(document.querySelectorAll<HTMLElement>('.flow-frame, .demo-stage-section, #world-journey-action, #objective-rail, #fate-status-strip, #world-vital-strip'))
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

  await clearIntroDialogue(page);
  await expect(page.locator('#world-command-bar')).toBeVisible();
  await page.locator('#world-command-more summary').click();
  await page.locator('#world-command-bar [data-game-command="furnace"]').click();
  await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
  await expect(page.locator('[data-inventory-tab="furnace"]')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  await expect(page.locator('[data-inventory-tab="player"]')).toHaveCount(0);
  await expect(page.locator('.inv-furnace')).toBeVisible();
  const furnaceGate = await layoutHardGate();
  expect(furnaceGate.overflowX).toBeLessThanOrEqual(2);
  expect(furnaceGate.intersections).toBe(0);
});
