import type { Page } from '@playwright/test';

// 旧世界退役（docs/21 §8.27）：调试快照 schema v3 只剩流程壳层字段；
// world 系字段与画布像素助手（renderedCanvasPngSnapshot/paintStatsFromDataUrl）
// 随旧世界渲染链一并退役。
export interface AeonDebugSnapshot {
  debugSchemaVersion?: number;
  buildRevision?: string;
  flowScreen?: string;
  flowOverlay?: string | null;
  uiMode?: string;
  appSurface?: string;
  viewportProfile?: string;
  canvasBounds?: { x: number; y: number; width: number; height: number } | null;
}

export function gameEntryPath(): string {
  const basePath = process.env.PLAYWRIGHT_GAME_BASE_PATH ?? '/';
  return basePath.endsWith('/') ? basePath : `${basePath}/`;
}

export async function waitForInitialSurface(page: Page): Promise<AeonDebugSnapshot> {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'attached' });
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: unknown }).__AEON_DEBUG__ != null);
  await page.waitForFunction(() => {
    const debug = (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__;
    const surface = debug?.appSurface;
    if (!surface) return false;
    const active = document.querySelector<HTMLElement>(`[data-app-surface="${surface}"]`);
    if (!active) return false;
    const style = window.getComputedStyle(active);
    return !active.hidden && active.getAttribute('aria-hidden') === 'false' && style.display !== 'none' && style.visibility !== 'hidden' && active.offsetWidth > 0 && active.offsetHeight > 0;
  });
  return gameDebugSnapshot(page);
}

export async function gameDebugSnapshot(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}
