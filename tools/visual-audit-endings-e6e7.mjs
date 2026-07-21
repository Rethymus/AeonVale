#!/usr/bin/env node
/**
 * 灵韵叙录 · E6 / E7 / 飞升 专用视觉回归
 *
 * 路径（choice id，与 src/app/narrationScenes.ts 核对）：
 *   公共到 train:
 *     village → ask → on → hurry → on → leave → farm → hide → on → on
 *     → approach → try → open → on → on → reveal → practice
 *   体修六阶:
 *     temper → stage1 → on → stage2 → on → stage3 → on → more
 *     → stage4 → on → stage5 → on → stage6 → on  (回 train)
 *
 *   堆 defiance（E6/E7 需 ≥60）:
 *     stages ≈ +18 + hurry +5 = 23；再 side 违心 ×3（+15 各）:
 *       side → bully → watch
 *       herb → abandon
 *       bribe → accept
 *     （可选 lore-hub → peek +10）
 *
 *   E7: 堆 defiance，避免 bond 选项 → e7
 *   E6: 堆 defiance 后补 bond（village ditch/market/song 循环）→ e6
 *   ascension: 只做 stages，不堆 side 违心 → answer
 *
 * 用法:
 *   node tools/visual-audit-endings-e6e7.mjs
 * 预览默认 http://127.0.0.1:4173（PLAYWRIGHT_BASE_URL 可覆盖）
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = path.resolve('tmp/visual-audit-endings');
mkdirSync(OUT, { recursive: true });

const findings = [];
function note(severity, msg, extra = {}) {
  findings.push({ severity, msg, ...extra, at: new Date().toISOString() });
  console.log(`[${severity}] ${msg}${extra && Object.keys(extra).length ? ' ' + JSON.stringify(extra) : ''}`);
}

/** 公共序章 → act2.train（hurry 违心支） */
const TO_TRAIN = [
  'village',
  'ask',
  'on', // depart
  'hurry', // road → +5 defiance（跳过 help/token）
  'on', // spread
  'leave', // sect
  'farm', // return
  'hide', // battle
  'on', // sky
  'on', // cellar
  'approach', // stare
  'try', // ring
  'open', // attempts
  'on', // flash
  'on', // oldman
  'reveal', // scroll
  'practice' // reveal → train（cult+1）
];

/** 体修六阶（stage onEnter 合计 defiance +18，cult 1→7） */
const STAGES = [
  'temper',
  'stage1',
  'on',
  'stage2',
  'on',
  'stage3',
  'on',
  'more', // temper → late
  'stage4',
  'on',
  'stage5',
  'on',
  'stage6',
  'on' // → train
];

async function prepare(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'aeonvale-settings-v1',
        JSON.stringify({ masterVolume: 0, reducedMotion: true })
      );
      for (const k of [
        'narration.introRead',
        'narration.codex.seenThisRun',
        'narration.codex.seenScenesEver',
        'narration.codex.seenEndings',
        'narration.e7Triggered',
        'narration.textSize'
      ]) {
        localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  });
}

async function shot(page, name) {
  const p = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: p, fullPage: true });
  return p;
}

async function clickStage(page) {
  const loc = page.locator('#narration-intro-stage, #narration-stage').first();
  if (await loc.count()) await loc.evaluate((el) => el.click());
}

async function visibleChoiceIds(page) {
  return page
    .locator('button.narration-choice:visible')
    .evaluateAll((els) =>
      els.map((el) => ({
        id: el.getAttribute('data-choice-id'),
        available: el.getAttribute('data-available'),
        disabled: el.disabled,
        text: (el.textContent ?? '').trim().slice(0, 40)
      }))
    )
    .catch(() => []);
}

async function dumpStuck(page, label) {
  const ids = await visibleChoiceIds(page);
  console.log(`[stuck] ${label} visible=`, JSON.stringify(ids));
  note('critical', `路径卡住: ${label}`, { visible: ids });
  await shot(page, `stuck-${label.replace(/[^a-zA-Z0-9_-]+/g, '_')}-${Date.now()}`);
}

async function advanceUntil(page, pred, timeoutMs = 15000, label = 'cond') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return true;
    await clickStage(page).catch(() => undefined);
    await page.waitForTimeout(40);
  }
  note('major', `超时未满足: ${label}`, { timeoutMs });
  return false;
}

/** 等到指定 choice 可见且 enabled（data-available=true 且 !disabled） */
async function waitEnabledChoice(page, id, timeoutMs = 15000) {
  return advanceUntil(
    page,
    async () => {
      const btn = page.locator(`button.narration-choice[data-choice-id="${id}"]`);
      if (!(await btn.isVisible().catch(() => false))) return false;
      const disabled = await btn.isDisabled().catch(() => true);
      const available = await btn.getAttribute('data-available');
      return !disabled && available !== 'false';
    },
    timeoutMs,
    `enabled-choice ${id}`
  );
}

async function waitChoice(page, id, timeoutMs = 15000) {
  return advanceUntil(
    page,
    async () => page.locator(`button.narration-choice[data-choice-id="${id}"]`).isVisible(),
    timeoutMs,
    `choice ${id}`
  );
}

/** 选 enabled 选项；锁定/禁用拒绝点击 */
async function pick(page, id, timeoutMs = 15000) {
  const ok = await waitEnabledChoice(page, id, timeoutMs);
  if (!ok) {
    const ids = await visibleChoiceIds(page);
    note('critical', `找不到 enabled 选项 ${id}`, { visible: ids });
    await shot(page, `missing-choice-${id}-${Date.now()}`);
    return false;
  }
  const btn = page.locator(`button.narration-choice[data-choice-id="${id}"]`);
  const disabled = await btn.isDisabled().catch(() => false);
  const available = await btn.getAttribute('data-available');
  if (disabled || available === 'false') {
    note('major', `选项 ${id} 可见但锁定/禁用 — 拒绝点击`);
    await shot(page, `locked-choice-${id}-${Date.now()}`);
    return false;
  }
  await btn.click();
  await page.waitForTimeout(90);
  return true;
}

async function walk(page, ids, tag) {
  for (const id of ids) {
    const ok = await pick(page, id);
    if (!ok) {
      await dumpStuck(page, `${tag}-need-${id}`);
      return false;
    }
  }
  return true;
}

async function enterNarration(page) {
  await page.goto(BASE + '/');
  await page.locator('#flow-title-narration').waitFor({ state: 'visible', timeout: 25000 });
  await page.locator('#flow-title-narration').click();
  await page.locator('.narration-intro-overlay').waitFor({ state: 'visible', timeout: 8000 });
  if (!(await waitEnabledChoice(page, 'try', 10000))) {
    note('critical', 'intro 无 try 选项');
    return false;
  }
  await page.locator('button.narration-choice[data-choice-id="try"]').click();
  await page.locator('[data-app-surface="narration"]').waitFor({ state: 'visible', timeout: 10000 });
  return true;
}

async function untilEnding(page, endingId, timeoutMs = 25000) {
  const ok = await advanceUntil(
    page,
    async () => page.locator(`.narration-ending-card[data-ending-id="${endingId}"]`).isVisible(),
    timeoutMs,
    `ending ${endingId}`
  );
  if (!ok) return { ok: false, cg: null };
  const img = page.locator('.narration-ending-cg');
  let cg = null;
  if (await img.count()) {
    await page
      .waitForFunction(() => {
        const im = document.querySelector('.narration-ending-cg');
        return im instanceof HTMLImageElement && im.complete && im.naturalWidth > 0;
      }, null, { timeout: 8000 })
      .catch(() => note('major', `结局 ${endingId} CG 未在 8s 内 naturalWidth>0`));
    cg = await img
      .evaluate((im) =>
        im instanceof HTMLImageElement
          ? {
              src: im.currentSrc || im.src,
              w: im.naturalWidth,
              h: im.naturalHeight,
              cw: im.clientWidth,
              ch: im.clientHeight
            }
          : null
      )
      .catch(() => null);
    if (!cg || !cg.w) note('major', `结局 ${endingId} CG 尺寸异常`, { cg });
  } else {
    const fb = await page.locator('.narration-ending-cg-fallback').count();
    if (fb) note('major', `结局 ${endingId} 走了 fallback，无 CG`);
  }
  return { ok: true, cg };
}

async function pathToTrain(page) {
  return walk(page, TO_TRAIN, 'to-train');
}

async function doStages(page) {
  return walk(page, STAGES, 'stages');
}

/** 堆 defiance：bully/watch + herb/abandon + bribe/accept（各 +15，共 +45） */
async function stackDefiance(page) {
  // 应在 act2.train
  if (!(await waitEnabledChoice(page, 'side', 8000))) {
    await dumpStuck(page, 'no-side');
    return false;
  }
  if (!(await pick(page, 'side'))) return false;

  // bully → watch
  if (!(await pick(page, 'bully'))) return false;
  if (!(await pick(page, 'watch'))) return false;
  // back to side hub

  // herb → abandon
  if (!(await pick(page, 'herb'))) return false;
  if (!(await pick(page, 'abandon'))) return false;

  // bribe → accept
  if (!(await pick(page, 'bribe'))) return false;
  if (!(await pick(page, 'accept'))) return false;

  // optional peek +10 if still short (defiance already ~68 after stages)
  // 回 train
  if (!(await pick(page, 'back'))) {
    await dumpStuck(page, 'side-back');
    return false;
  }
  return true;
}

/** 静默探测 enabled choice（不写 finding） */
async function softWaitEnabled(page, id, timeoutMs = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const btn = page.locator(`button.narration-choice[data-choice-id="${id}"]`);
    if (await btn.isVisible().catch(() => false)) {
      const disabled = await btn.isDisabled().catch(() => true);
      const available = await btn.getAttribute('data-available');
      if (!disabled && available !== 'false') return true;
    }
    await clickStage(page).catch(() => undefined);
    await page.waitForTimeout(40);
  }
  return false;
}

/** 补 bond 到 ≥50：循环 village ditch/market/song（onEnter 无 once，可重复） */
async function stackBond(page, rounds = 10) {
  // train → side → more → village
  if (!(await waitEnabledChoice(page, 'side', 6000))) {
    await dumpStuck(page, 'bond-no-side');
    return false;
  }
  if (!(await pick(page, 'side'))) return false;
  if (!(await pick(page, 'more'))) return false;
  if (!(await pick(page, 'village'))) return false;

  for (let i = 0; i < rounds; i++) {
    // ditch +6
    if (await softWaitEnabled(page, 'ditch', 3000)) {
      await pick(page, 'ditch', 3000);
      if (await softWaitEnabled(page, 'back', 4000)) await pick(page, 'back', 3000);
    }
    // market +4
    if (await softWaitEnabled(page, 'market', 3000)) {
      await pick(page, 'market', 3000);
      if (await softWaitEnabled(page, 'back', 4000)) await pick(page, 'back', 3000);
    }
    // song +3
    if (await softWaitEnabled(page, 'song', 3000)) {
      await pick(page, 'song', 3000);
      if (await softWaitEnabled(page, 'back', 4000)) await pick(page, 'back', 3000);
    }
  }

  // village.hub → back → train（或 side hub → back）
  if (await softWaitEnabled(page, 'back', 4000)) await pick(page, 'back', 3000);
  for (let i = 0; i < 4; i++) {
    if (await page.locator('button.narration-choice[data-choice-id="assault"]').isVisible().catch(() => false)) {
      return true;
    }
    if (await softWaitEnabled(page, 'back', 2000)) await pick(page, 'back', 2000);
    else break;
  }
  return true;
}

async function goAssaultAndCave(page, tag) {
  if (!(await waitEnabledChoice(page, 'assault', 10000))) {
    await dumpStuck(page, `${tag}-no-assault`);
    return { ok: false, act3EntryOk: false, cabinetLeak: false };
  }
  if (!(await pick(page, 'assault'))) return { ok: false, act3EntryOk: false, cabinetLeak: false };

  // act3.entry — 需 advance 旁白后才出 on
  await advanceUntil(
    page,
    async () => {
      // 场景 CG 或 on 选项
      const hasOn = await page
        .locator('button.narration-choice[data-choice-id="on"]')
        .isVisible()
        .catch(() => false);
      const hasCg = await page.locator('.narration-cg-img, .narration-cg-bg').count();
      return hasOn || hasCg > 0;
    },
    10000,
    'act3-entry-ready'
  );

  // 断言 CG src 含 shennong-cave
  let act3EntryOk = false;
  const cgInfo = await page
    .locator('.narration-cg-img.narration-cg-bg, .narration-cg-bg, .narration-cg-img')
    .first()
    .evaluate((im) => {
      if (!(im instanceof HTMLImageElement)) return null;
      return { src: im.currentSrc || im.src, w: im.naturalWidth, hidden: im.hidden };
    })
    .catch(() => null);

  if (cgInfo?.src && /shennong-cave/i.test(cgInfo.src)) {
    act3EntryOk = true;
  } else {
    note('major', 'act3.entry CG src 不含 shennong-cave', { cgInfo });
  }
  await shot(page, 'act3-entry');

  // 心声条：应 hidden 或至少不含上一幕泄漏关键词
  let cabinetLeak = false;
  const cab = page.locator('.narration-cabinet');
  const cabHidden = await cab.evaluate((el) => el.hidden || el.getAttribute('hidden') !== null).catch(() => true);
  const cabText = (await cab.textContent().catch(() => '')) ?? '';
  const leakKeywords = ['灵田稳固', '丹炉常明', '冲击雷关', '偷天圆满', '再引一道'];
  if (!cabHidden && cabText.trim()) {
    for (const kw of leakKeywords) {
      if (cabText.includes(kw)) {
        cabinetLeak = true;
        note('major', `act3.entry 心声条泄漏上一幕关键词: ${kw}`, { cabText: cabText.slice(0, 120) });
        break;
      }
    }
  }
  // 若完全 hidden 视为 ok
  note('info', `act3.entry cabinet hidden=${cabHidden} leak=${cabinetLeak}`, {
    cabText: cabText.slice(0, 80)
  });

  // on → cave 链：entrance → lab → faceless → light → tribulation
  // entrance 可点 once 指认，但直接 on 即可；每段 lines 需 advance
  const atTribulation = async () =>
    page
      .locator(
        'button.narration-choice[data-choice-id="e6"], button.narration-choice[data-choice-id="e7"], button.narration-choice[data-choice-id="answer"]'
      )
      .first()
      .isVisible()
      .catch(() => false);

  for (let step = 0; step < 6; step++) {
    if (await atTribulation()) break;
    // 静默等待 on 或 tribulation（不污染 findings）
    const start = Date.now();
    let ready = false;
    while (Date.now() - start < 12000) {
      if (await atTribulation()) {
        ready = true;
        break;
      }
      const btn = page.locator('button.narration-choice[data-choice-id="on"]');
      if (await btn.isVisible().catch(() => false)) {
        const disabled = await btn.isDisabled().catch(() => true);
        const available = await btn.getAttribute('data-available');
        if (!disabled && available !== 'false') {
          ready = true;
          break;
        }
      }
      await clickStage(page).catch(() => undefined);
      await page.waitForTimeout(40);
    }
    if (await atTribulation()) break;
    if (!ready) {
      await dumpStuck(page, `${tag}-cave-step-${step}`);
      break;
    }
    // pick on（已确认 enabled）
    const btn = page.locator('button.narration-choice[data-choice-id="on"]');
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      await page.waitForTimeout(90);
    } else {
      break;
    }
  }

  await shot(page, `${tag}-tribulation`);
  return { ok: true, act3EntryOk, cabinetLeak };
}

async function restartFresh(page) {
  // 新 context 更干净；此处复用 page + prepare + enter
  await prepare(page);
  // 强制清 e7 等
  await page.goto(BASE + '/');
  await page.evaluate(() => {
    try {
      localStorage.setItem(
        'aeonvale-settings-v1',
        JSON.stringify({ masterVolume: 0, reducedMotion: true })
      );
      for (const k of [
        'narration.introRead',
        'narration.codex.seenThisRun',
        'narration.codex.seenScenesEver',
        'narration.codex.seenEndings',
        'narration.e7Triggered',
        'narration.textSize'
      ]) {
        localStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
  });
  return enterNarration(page);
}

async function runPath(page, mode) {
  console.log(`\n=== PATH: ${mode} ===`);
  if (!(await restartFresh(page))) {
    note('critical', `${mode}: 无法进入 narration`);
    return { reached: false };
  }
  if (!(await pathToTrain(page))) {
    note('critical', `${mode}: 到 train 失败`);
    return { reached: false };
  }
  if (!(await doStages(page))) {
    note('critical', `${mode}: 六阶失败`);
    return { reached: false };
  }

  if (mode === 'ascension') {
    // defiance 应 <60（仅 stages+hurry≈23）
    const cave = await goAssaultAndCave(page, 'ascension');
    if (!cave.ok) return { reached: false, ...cave };
    if (!(await waitEnabledChoice(page, 'answer', 10000))) {
      const ids = await visibleChoiceIds(page);
      note('major', 'ascension: 无 answer（defiance 可能过高）', { visible: ids });
      await dumpStuck(page, 'ascension-no-answer');
      // 尝试别的
      if (await page.locator('button.narration-choice[data-choice-id="e6"]').isVisible().catch(() => false)) {
        note('major', 'ascension 路径误入 e6');
      }
      if (await page.locator('button.narration-choice[data-choice-id="e7"]').isVisible().catch(() => false)) {
        note('major', 'ascension 路径误入 e7');
      }
      return { reached: false, ...cave };
    }
    await pick(page, 'answer');
    // act3.ascend 是 leaf ends，需 advance 旁白
    const end = await untilEnding(page, 'ascension');
    await shot(page, 'ending-ascension');
    if (end.ok && end.cg && end.cg.w <= 0) note('major', 'ascension CG naturalWidth<=0', { cg: end.cg });
    return { reached: !!end.ok, cg: end.cg, ...cave };
  }

  // E6 / E7 都先堆 defiance
  if (!(await stackDefiance(page))) {
    note('critical', `${mode}: 堆 defiance 失败`);
    return { reached: false };
  }

  if (mode === 'e6') {
    if (!(await stackBond(page, 8))) {
      note('major', 'e6: 补 bond 过程异常（继续尝试 assault）');
    }
    // 确保回到 train
    for (let i = 0; i < 6; i++) {
      if (await page.locator('button.narration-choice[data-choice-id="assault"]').isVisible().catch(() => false)) break;
      if (await softWaitEnabled(page, 'back', 2000)) await pick(page, 'back', 2000);
      else if (await softWaitEnabled(page, 'rest', 1500)) await pick(page, 'rest', 1500);
      else await clickStage(page);
    }
    const cave = await goAssaultAndCave(page, 'e6');
    if (!cave.ok) return { reached: false, ...cave };
    if (!(await waitEnabledChoice(page, 'e6', 10000))) {
      const ids = await visibleChoiceIds(page);
      note('major', 'e6: 终局无 e6 选项', { visible: ids });
      await dumpStuck(page, 'no-e6');
      // 若 e7 出现说明 bond 不够
      if (await page.locator('button.narration-choice[data-choice-id="e7"]').isVisible().catch(() => false)) {
        note('major', 'e6 路径落到 e7（bond 仍 <50）');
      }
      if (await page.locator('button.narration-choice[data-choice-id="answer"]').isVisible().catch(() => false)) {
        note('major', 'e6 路径落到 answer（defiance <60）');
      }
      return { reached: false, ...cave };
    }
    await pick(page, 'e6');
    const end = await untilEnding(page, 'e6-sacrifice');
    await shot(page, 'ending-e6-sacrifice');
    if (end.ok && end.cg && end.cg.w <= 0) note('major', 'e6 CG naturalWidth<=0', { cg: end.cg });
    return { reached: !!end.ok, cg: end.cg, ...cave };
  }

  // E7: 堆 defiance 后不补 bond（bond 应接近 0）
  if (mode === 'e7') {
    // 直接 assault（stackDefiance 末步已 back 到 train）
    for (let i = 0; i < 4; i++) {
      if (await page.locator('button.narration-choice[data-choice-id="assault"]').isVisible().catch(() => false)) break;
      if (await softWaitEnabled(page, 'back', 2000)) await pick(page, 'back', 2000);
      else break;
    }
    const cave = await goAssaultAndCave(page, 'e7');
    if (!cave.ok) return { reached: false, ...cave };
    if (!(await waitEnabledChoice(page, 'e7', 10000))) {
      const ids = await visibleChoiceIds(page);
      note('major', 'e7: 终局无 e7 选项', { visible: ids });
      await dumpStuck(page, 'no-e7');
      if (await page.locator('button.narration-choice[data-choice-id="e6"]').isVisible().catch(() => false)) {
        note('major', 'e7 路径落到 e6（bond 仍 ≥50）');
      }
      if (await page.locator('button.narration-choice[data-choice-id="answer"]').isVisible().catch(() => false)) {
        note('major', 'e7 路径落到 answer（defiance <60）');
      }
      return { reached: false, ...cave };
    }
    await pick(page, 'e7');
    const end = await untilEnding(page, 'e7-usurp');
    await shot(page, 'ending-e7-usurp');
    if (end.ok && end.cg && end.cg.w <= 0) note('major', 'e7 CG naturalWidth<=0', { cg: end.cg });

    let titleCursed = false;
    if (end.ok) {
      await page.locator('.narration-ending-dismiss').click().catch(() => undefined);
      await page.waitForTimeout(400);
      await shot(page, 'title-after-e7');
      const cursedCount = await page.locator('.e7-cursed, [data-app-surface="title"].e7-cursed').count();
      const entryText = await page.locator('#flow-title-narration').textContent().catch(() => '');
      titleCursed =
        cursedCount > 0 ||
        (entryText ?? '').includes('再来一次') ||
        (entryText ?? '').includes('你确定');
      if (!titleCursed) {
        note('major', 'E7 后标题屏未出现 e7-cursed / 文案改写', {
          cursedCount,
          entryText
        });
      } else {
        note('info', 'E7 后标题诅咒/改写确认', { cursedCount, entryText });
      }
    }
    return { reached: !!end.ok, cg: end.cg, titleCursed, ...cave };
  }

  return { reached: false };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (err) => note('critical', `pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') note('major', `console.error: ${msg.text().slice(0, 200)}`);
  });

  // 预检预览
  try {
    const res = await page.goto(BASE + '/', { timeout: 15000 });
    if (!res || !res.ok()) note('critical', `预览不可达 ${BASE}`, { status: res?.status() });
  } catch (e) {
    note('critical', `预览连接失败 ${BASE}: ${e.message}`);
    writeFileSync(
      path.join(OUT, 'report.json'),
      JSON.stringify(
        {
          e6: false,
          e7: false,
          ascension: false,
          act3EntryOk: false,
          cabinetLeak: false,
          findings
        },
        null,
        2
      )
    );
    await browser.close();
    process.exit(1);
  }

  const asc = await runPath(page, 'ascension');
  const e7 = await runPath(page, 'e7');
  const e6 = await runPath(page, 'e6');

  const act3EntryOk = !!(asc.act3EntryOk || e7.act3EntryOk || e6.act3EntryOk);
  const cabinetLeak = !!(asc.cabinetLeak || e7.cabinetLeak || e6.cabinetLeak);

  const report = {
    e6: !!e6.reached,
    e7: !!e7.reached,
    ascension: !!asc.reached,
    act3EntryOk,
    cabinetLeak,
    titleCursedAfterE7: !!e7.titleCursed,
    details: {
      ascension: { reached: !!asc.reached, act3EntryOk: !!asc.act3EntryOk, cg: asc.cg ?? null },
      e7: {
        reached: !!e7.reached,
        act3EntryOk: !!e7.act3EntryOk,
        titleCursed: !!e7.titleCursed,
        cg: e7.cg ?? null
      },
      e6: { reached: !!e6.reached, act3EntryOk: !!e6.act3EntryOk, cg: e6.cg ?? null }
    },
    findings,
    base: BASE,
    out: OUT
  };

  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== REPORT ===');
  console.log(
    JSON.stringify(
      {
        e6: report.e6,
        e7: report.e7,
        ascension: report.ascension,
        act3EntryOk: report.act3EntryOk,
        cabinetLeak: report.cabinetLeak,
        titleCursedAfterE7: report.titleCursedAfterE7,
        findings: findings.length,
        critical: findings.filter((f) => f.severity === 'critical').length,
        major: findings.filter((f) => f.severity === 'major').length
      },
      null,
      2
    )
  );

  await browser.close();

  const failed = !report.e6 || !report.e7 || !report.ascension || !report.act3EntryOk;
  if (failed) {
    console.error('visual-audit-endings-e6e7: FAILED');
    process.exit(1);
  }
  console.log('visual-audit-endings-e6e7: OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
