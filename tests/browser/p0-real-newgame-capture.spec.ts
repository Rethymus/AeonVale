import { test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { clearIntroDialogue, openGame } from './openGame';

// 无断言的实拍夹具：驱动真实「新游戏」首屏（非高 qi 关键帧），用于人眼复核
// 真实新游戏 qi≈0，灵气流按设计低于阈值不显示；此图只证地块语义在真实布局下可读。
const ARTIFACTS = resolve(process.cwd(), '.omc', 'artifacts');

test('capture real new-game first-sow farm for human review', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 960, height: 542 });
  await openGame(page);
  await clearIntroDialogue(page);
  await page.waitForTimeout(400);
  mkdirSync(ARTIFACTS, { recursive: true });
  const png = await page.locator('canvas').screenshot({ animations: 'disabled', scale: 'css' });
  writeFileSync(resolve(ARTIFACTS, 'p0-real-newgame-farm.png'), png);
});
