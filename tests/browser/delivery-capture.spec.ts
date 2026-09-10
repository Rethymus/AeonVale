import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { gameEntryPath, waitForInitialSurface } from './openGame';

// 全界面截图交付：驱动本地预览构建（与线上同代码、同 build revision）遍历每个主要界面，
// 存到 .omc/artifacts/delivery/。
// 旧世界退役（docs/21 §8.16 阶段 2 第一步）：03-world-newgame / 04-* 面板 /
// 05-pause 与 showcase（06-07）捕获段经测试门进旧世界，随 enterLegacyWorld
// 退役（判定表见 docs/21 §8.21）；交付媒体只拍玩家真实可达表面——标题与
// 「偷天换劫」roguelite 开场（与 readme-capture 同口径）。
const DELIVERY = resolve(process.cwd(), '.omc', 'artifacts', 'delivery');

async function shoot(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.waitForTimeout(450);
  await page.screenshot({ path: resolve(DELIVERY, name), fullPage: false });
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
});
