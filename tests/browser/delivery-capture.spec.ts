import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { clearIntroDialogue, continueToLoadedWorld, continueToWorld, gameEntryPath, openGameWithLoadedSave, waitForInitialSurface } from './openGame';
import { installShowcaseSave } from './showcaseSave';

// 全界面截图交付：驱动本地预览构建（与线上同代码、同 build revision）遍历每个主要界面，
// 存到 .omc/artifacts/delivery/。page.screenshot 捕获视口 = canvas + DOM HUD（压力卡/罗盘/目标轨）。
const DELIVERY = resolve(process.cwd(), '.omc', 'artifacts', 'delivery');

async function shoot(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(DELIVERY, name), fullPage: false });
}

async function returnToWorld(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

const PANELS: ReadonlyArray<readonly [string, string]> = [
  ['inventory', 'inventory'],
  ['map', 'locations'],
  ['cultivation', 'cultivation'],
  ['furnace', 'furnace']
];

async function openWorldCommand(page: import('@playwright/test').Page, command: string): Promise<void> {
  let target = page.locator(`#world-command-bar [data-game-command="${command}"]`);
  if (!(await target.isVisible().catch(() => false))) {
    await page.locator('#world-command-more > summary').click();
    target = page.locator(`#world-command-bar [data-game-command="${command}"]`);
  }
  await target.click();

  if (command === 'furnace') {
    await expect(page.locator('[data-app-surface="inventory"]')).toBeVisible();
    await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'furnace-focus');
  } else {
    await expect(page.locator(`[data-app-surface="${command}"]`)).toBeVisible();
    if (command === 'inventory') {
      await expect(page.locator('[data-app-slot="inventory"]')).toHaveAttribute('data-inventory-view-mode', 'full');
    }
  }
}

test('capture new-game flow surfaces for delivery', async ({ page }) => {
  test.setTimeout(180_000);
  mkdirSync(DELIVERY, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });

  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await shoot(page, '01-title.png');

  await page.locator('#flow-title-new-game').click();
  await page.waitForTimeout(600);
  await shoot(page, '02-roguelite-opening.png');

  // 旧世界仍可达（测试门），后续面板/暂停截图沿用农庄世界 UI。
  await page.goto(gameEntryPath());
  await waitForInitialSurface(page);
  await continueToWorld(page);
  await page.waitForFunction(
    () => {
      const d = (window as typeof window & { __AEON_DEBUG__?: { appSurface?: string; flowScreen?: string } }).__AEON_DEBUG__ ?? {};
      return d.appSurface === 'world' || d.flowScreen === 'world';
    },
    undefined,
    { timeout: 10_000 }
  ).catch(() => undefined);
  await clearIntroDialogue(page);
  await shoot(page, '03-world-newgame.png');

  for (const [command, name] of PANELS) {
    await openWorldCommand(page, command);
    await shoot(page, `04-${name}.png`);
    await returnToWorld(page);
  }
  // Esc 打开真正的暂停表面（'p' 只软暂停不开菜单，拍到的是世界画面）。
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => (window as typeof window & { __AEON_DEBUG__?: { flowOverlay?: string | null } }).__AEON_DEBUG__?.flowOverlay === 'pause',
    undefined,
    { timeout: 10_000 }
  ).catch(() => undefined);
  await shoot(page, '05-pause.png');
  await returnToWorld(page);
});

test('capture showcase (developed) surfaces for delivery', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await installShowcaseSave(page);
  await openGameWithLoadedSave(page);
  await clearIntroDialogue(page);
  await shoot(page, '06-showcase-farm.png');

  for (const [command, name] of PANELS) {
    await openWorldCommand(page, command);
    await shoot(page, `07-showcase-${name}.png`);
    await returnToWorld(page);
  }
});
