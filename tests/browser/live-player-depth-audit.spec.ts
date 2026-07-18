/**
 * 深度玩家视角核查：对真实 GitHub Pages 做纵切片 + 招牌手感采样。
 * 运行：PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm exec playwright test tests/browser/live-player-depth-audit.spec.ts
 * 产物：/tmp/aeon-player-audit/
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameEntryPath, waitForInitialSurface, type AeonDebugSnapshot } from './openGame';

const OUT = '/tmp/aeon-player-audit';
mkdirSync(OUT, { recursive: true });

type Finding = { sev: 'high' | 'med' | 'low' | 'info'; area: string; msg: string };
const findings: Finding[] = [];

function note(sev: Finding['sev'], area: string, msg: string): void {
  findings.push({ sev, area, msg });
  // eslint-disable-next-line no-console
  console.log(`[${sev}] ${area}: ${msg}`);
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function debug(page: Page): Promise<AeonDebugSnapshot> {
  return page.evaluate(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__ ?? {});
}

async function clearDialogue(page: Page): Promise<void> {
  for (let i = 0; i < 16; i += 1) {
    const d = await debug(page);
    if (d.dialogueBeatId == null) return;
    await page.keyboard.press('Enter');
    await page.waitForTimeout(80);
  }
}

async function waitObj(page: Page, id: string, ms = 20000): Promise<void> {
  await page.waitForFunction(expected => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.onboardingObjectiveId === expected, id, {
    timeout: ms
  });
}

test('live pages deep player audit vs stardew+xianxia north star', async ({ page }) => {
  // 仅在线上/自定义 baseURL 下运行；CI 走 test:browser:public-tree/:pages*（不含本文件），
  // 但 `pnpm test:browser`(全量) 会抓到，故此处显式跳过，避免误触本地 dev server。
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, 'live-player-depth-audit 需 PLAYWRIGHT_BASE_URL');
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.addInitScript(() => localStorage.clear());
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(gameEntryPath());
  const boot = await waitForInitialSurface(page);
  await page.waitForTimeout(300);
  await shot(page, '01-title');

  const titleVisible = await page.locator('[data-app-surface="title"]').isVisible();
  note('info', 'title', `标题屏 visible=${titleVisible} bootSurface=${boot.appSurface} rev=${boot.buildRevision ?? '?'}`);
  expect(titleVisible).toBe(true);
  const titleCopy = await page.locator('[data-app-surface="title"]').innerText();
  if (!/新游戏|继续|设置/.test(titleCopy)) note('med', 'title', '标题入口文案不易识别');
  // 气质：标题是否偏工具感（只能文字启发式）
  if (/调试|DEBUG|TODO|lorem/i.test(titleCopy)) note('high', 'title', '标题屏含调试/占位文案');

  await page.locator('#flow-title-new-game').click();
  await page.waitForTimeout(300);
  await shot(page, '02-prologue');
  const prologueVisible = await page.locator('[data-app-surface="prologue"]').isVisible();
  note(prologueVisible ? 'info' : 'high', 'prologue', `序章 visible=${prologueVisible}`);
  if (prologueVisible) {
    const prologueCopy = await page.locator('[data-app-surface="prologue"]').innerText();
    if (prologueCopy.length < 20) note('med', 'prologue', '序章文本过短，世界观钩子弱');
    if (!/谷|劫|丹|田|修|灵/.test(prologueCopy)) note('med', 'prologue', '序章未见修仙/农庄关键词');
  }

  await page.locator('#flow-prologue-skip').click();
  await page.waitForFunction(() => (window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.appSurface === 'world', null, {
    timeout: 20000
  });
  await page.waitForTimeout(400);
  await clearDialogue(page);
  await shot(page, '03-world');

  let d = await debug(page);
  note('info', 'world', `objective=${d.onboardingObjectiveId} day=${d.day} build=${d.buildRevision ?? '?'}`);
  if (d.onboardingObjectiveId !== 'first-till') note('med', 'onboarding', `进世界目标非 first-till：${d.onboardingObjectiveId}`);
  if (!d.todayBriefingVisible) note('med', 'hud', '今日简报不可见');
  else note('info', 'hud', `简报=${String(d.todayBriefingTitle ?? '')} / ${String(d.todayBriefingBody ?? '').slice(0, 100)}`);

  // 首屏信息过载启发式：help 过长
  const help = String(d.helpText ?? d.renderedHelpText ?? '');
  if (help.length > 220) note('med', 'hud', `帮助文案偏长（${help.length} 字），扫读负担高`);

  const journey = page.locator('#world-journey-action');
  note('info', 'journey', `CTA=${(await journey.innerText()).trim()}`);

  async function pressJourney(): Promise<void> {
    if (await journey.isEnabled()) await journey.click();
    await page.waitForTimeout(180);
    await clearDialogue(page);
  }

  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(80);

  // 农务：翻→播→浇
  await pressJourney();
  try {
    await waitObj(page, 'first-sow');
    note('info', 'farm', '翻地→播种 OK');
  } catch {
    note('high', 'farm', `翻地后未到 first-sow，当前=${(await debug(page)).onboardingObjectiveId}`);
  }
  await shot(page, '04-till');

  await pressJourney();
  try {
    await waitObj(page, 'first-water');
    note('info', 'farm', '播种→浇水 OK');
  } catch {
    note('high', 'farm', `播种后未到 first-water，当前=${(await debug(page)).onboardingObjectiveId}`);
  }
  await shot(page, '05-sow');

  await pressJourney();
  try {
    await waitObj(page, 'first-harvest');
    note('info', 'farm', '浇水→收获 OK');
  } catch {
    note('high', 'farm', `浇水后未到 first-harvest，当前=${(await debug(page)).onboardingObjectiveId}`);
  }
  await shot(page, '06-water');

  // juice 可观测性：无法直接截粒子，检查 renderFrameCount 在空闲增长（ambient）
  const f0 = (await debug(page)).renderFrameCount ?? 0;
  await page.waitForTimeout(700);
  const f1 = (await debug(page)).renderFrameCount ?? 0;
  if (f1 > f0) note('info', 'juice', `空闲帧增长 ${f0}→${f1}（ambient/呼吸可能生效）`);
  else note('med', 'juice', `空闲帧未增长 ${f0}→${f1}（世界可能仍偏静态）`);

  // 生长过夜
  const rest = page.locator('#world-command-bar [data-game-command="end-day"]');
  for (let day = 0; day < 22; day += 1) {
    d = await debug(page);
    if (d.onboardingObjectiveId === 'journey-alchemy') break;
    if (d.onboardingObjectiveId === 'first-water') {
      await pressJourney();
      await waitObj(page, 'first-harvest', 8000).catch(() => undefined);
    }
    if (d.onboardingObjectiveId === 'first-harvest') {
      await pressJourney();
      if ((await debug(page)).onboardingObjectiveId === 'journey-alchemy') break;
    }
    const before = d.day ?? 0;
    if (await rest.isEnabled()) {
      await rest.click();
      await page
        .waitForFunction(b => ((window as typeof window & { __AEON_DEBUG__?: AeonDebugSnapshot }).__AEON_DEBUG__?.day ?? 0) > Number(b), before, {
          timeout: 8000
        })
        .catch(() => undefined);
      await clearDialogue(page);
    }
    if ((await debug(page)).onboardingObjectiveId === 'first-harvest') await pressJourney();
    if ((await debug(page)).onboardingObjectiveId === 'journey-alchemy') break;
  }
  await shot(page, '07-post-grow');
  d = await debug(page);
  note('info', 'farm', `生长后 objective=${d.onboardingObjectiveId} day=${d.day}`);
  if (d.onboardingObjectiveId !== 'journey-alchemy') {
    note('high', 'farm', '未能在预算日内进入炼丹旅程（首轮闭环节奏/成长可能过慢或卡住）');
  }

  // 炼丹
  if ((await debug(page)).onboardingObjectiveId === 'journey-alchemy') {
    await clearDialogue(page);
    await journey.click();
    await expect(page.locator('[data-app-surface="alchemy"]')).toBeVisible({ timeout: 10000 });
    await shot(page, '08-alchemy');
    const alchemyText = await page.locator('[data-app-surface="alchemy"]').innerText();
    note('info', 'alchemy', `面板摘录=${alchemyText.replace(/\s+/g, ' ').slice(0, 160)}`);
    if (!/七情|相须|相反|炸炉|配伍|药性/.test(alchemyText)) {
      note('high', 'xianxia', '炼丹教学未见七情/配伍差异化——修仙招牌“一小口”不足');
    } else {
      note('info', 'xianxia', '炼丹面板含七情/配伍信号');
    }
    if (!/火候|理想/.test(alchemyText)) note('med', 'alchemy', '火候/理想区间表达不清');
    await page.locator('#flow-alchemy-primary').click();
    await page.waitForTimeout(350);
    await shot(page, '09-alchemy-done');
    const result = await page.locator('#flow-alchemy-result').innerText();
    note('info', 'alchemy', `结果=${result.slice(0, 100)}`);
    if (!/丹|出炉|避雷/.test(result)) note('med', 'alchemy', '成丹反馈文案弱');
    await page.locator('#flow-alchemy-primary').click();
    await page.waitForTimeout(300);
  }

  // 天劫
  d = await debug(page);
  if (d.onboardingObjectiveId === 'journey-tribulation') {
    await clearDialogue(page);
    await journey.click();
    await expect(page.locator('[data-app-surface="tribulation"]')).toBeVisible({ timeout: 10000 });
    await shot(page, '10-trib');
    const tribText = await page.locator('[data-app-surface="tribulation"]').innerText();
    note('info', 'tribulation', `面板=${tribText.replace(/\s+/g, ' ').slice(0, 180)}`);
    if (!/落雷|走位|擦弹|预警/.test(tribText)) note('med', 'tribulation', '天劫面板缺少走位/擦弹/预警关键词');

    const pill = page.locator('#flow-tribulation-pill-action');
    if (await pill.isEnabled()) await pill.click();
    await page.locator('#flow-tribulation-primary').click();
    await page.waitForTimeout(250);
    await shot(page, '11-trib-active');

    let blocked = 0;
    for (let bolt = 1; bolt <= 3; bolt += 1) {
      await expect(page.locator('#flow-tribulation-warning')).toContainText(`第 ${bolt}/3 雷`);
      for (let step = 0; step < 12; step += 1) {
        d = await debug(page);
        if (d.tutorialPerfectBlockAvailable) break;
        const tx = d.tutorialWarnedX;
        const ty = d.tutorialWarnedY;
        const px = d.playerX;
        const py = d.playerY;
        if (tx == null || ty == null || px == null || py == null) break;
        if (Math.max(Math.abs(px - tx), Math.abs(py - ty)) <= 1) break;
        if (px < tx) await page.locator('[data-demo-action="move-right"]').click();
        else if (px > tx) await page.locator('[data-demo-action="move-left"]').click();
        else if (py < ty) await page.locator('[data-demo-action="move-down"]').click();
        else if (py > ty) await page.locator('[data-demo-action="move-up"]').click();
        else break;
        await page.waitForTimeout(40);
      }
      d = await debug(page);
      const label = await page.locator('#flow-tribulation-primary').innerText();
      if (d.tutorialPerfectBlockAvailable || label.includes('擦弹')) {
        note('info', 'tribulation', `第${bolt}雷可擦弹 CTA=${label}`);
        await page.locator('#flow-tribulation-primary').click();
        blocked += 1;
      } else {
        note('med', 'tribulation', `第${bolt}雷未进擦弹区 CTA=${label}`);
        await page.locator('#flow-tribulation-primary').click();
      }
      await page.waitForTimeout(200);
    }
    await shot(page, '12-aftermath');
    await expect(page.locator('[data-app-surface="aftermath"]')).toBeVisible({ timeout: 8000 });
    const hits = await page.locator('#flow-aftermath-hits').innerText();
    const reward = await page.locator('#flow-aftermath-reward').innerText();
    note('info', 'tribulation', `战后 hits=${hits} reward=${reward}`);
    if (blocked < 1) note('high', 'xianxia', '教学天劫 0 次擦弹——招牌手感未在本局兑现');
    else note('info', 'xianxia', `本局擦弹 ${blocked} 次`);
    if (!hits.includes('擦弹')) note('med', 'tribulation', '战后统计未写「擦弹」');
    // 种田即布防信号
    if (!/阵|田|导电|引雷/.test(tribText + hits + reward)) {
      note('high', 'xianxia', '教学天劫路径几乎看不到「种田即布防」关联（阵/田/导电）');
    }
    await page.locator('#flow-aftermath-continue').click();
    await page.waitForTimeout(300);
  } else {
    note('high', 'tribulation', `未进入教学天劫 objective=${d.onboardingObjectiveId}`);
  }

  await shot(page, '13-end');
  d = await debug(page);
  note('info', 'end', `final objective=${d.onboardingObjectiveId} surface=${d.appSurface}`);

  // 竖屏门
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(gameEntryPath());
  await page.waitForTimeout(600);
  const gate = await page.locator('#orientation-gate').isVisible();
  note(gate ? 'info' : 'med', 'mobile', `竖屏 orientation-gate=${gate}`);
  await shot(page, '14-portrait');

  // 紧凑横屏溢出
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto(gameEntryPath());
  await page.waitForTimeout(600);
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth
  }));
  if (overflow.sw > overflow.cw + 2) note('med', 'layout', `水平溢出 ${overflow.sw}>${overflow.cw}`);
  else note('info', 'layout', '紧凑横屏文档无水平溢出');
  await shot(page, '15-compact');

  note(pageErrors.length ? 'high' : 'info', 'runtime', `pageerror count=${pageErrors.length}`);
  note(consoleErrors.length ? 'med' : 'info', 'runtime', `console error count=${consoleErrors.length}`);
  if (pageErrors[0]) note('high', 'runtime', pageErrors[0]!);

  // 星露谷对照粗评（可执行证据 + 缺口）
  note('info', 'north-star', '对照：日循环引导存在；内容厚度/NPC 生活感/正式天劫玩家化/cozy 视觉人格仍是长期缺口');

  const summary = {
    high: findings.filter(f => f.sev === 'high').length,
    med: findings.filter(f => f.sev === 'med').length,
    low: findings.filter(f => f.sev === 'low').length,
    info: findings.filter(f => f.sev === 'info').length
  };
  writeFileSync(
    `${OUT}/report.json`,
    `${JSON.stringify(
      {
        url: gameEntryPath(),
        baseURL: process.env.PLAYWRIGHT_BASE_URL,
        when: new Date().toISOString(),
        summary,
        findings,
        pageErrors,
        consoleErrors,
        finalDebug: d
      },
      null,
      2
    )}\n`
  );
  // eslint-disable-next-line no-console
  console.log('SUMMARY', summary);

  // 审计本身不因 med 失败；high 中与可玩性断裂相关的应失败
  const blockers = findings.filter(f => f.sev === 'high' && (f.area === 'farm' || f.area === 'runtime' || f.area === 'prologue'));
  expect(blockers, JSON.stringify(blockers, null, 2)).toEqual([]);
});
