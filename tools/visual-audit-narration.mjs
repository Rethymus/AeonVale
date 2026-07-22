#!/usr/bin/env node
/**
 * 灵韵叙录视觉查收：按真实状态路径走完 8 个结局，截图并检查布局/破图/互斥终局。
 * 用法：PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173 node tools/visual-audit-narration.mjs
 */
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = path.resolve('tmp/visual-audit-narration');
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const TO_REVEAL_HELP = [
  'village', 'help', 'on', 'on', 'help', 'take', 'on', 'leave', 'farm',
  'hide', 'on', 'on', 'approach', 'try', 'open', 'on', 'on', 'reveal'
];
const TO_REVEAL_HURRY = [
  'village', 'ask', 'on', 'on', 'hurry', 'on', 'leave', 'farm',
  'hide', 'on', 'on', 'approach', 'try', 'open', 'on', 'on', 'reveal'
];
const CAVE_TO_PREPARATION = ['on', 'on', 'on', 'on', 'on'];
const FINAL_TRIBULATION = ['on', 'on', 'on', 'on'];

const ROUTES = {
  'e0-mushroom': ['deep'],
  'lifespan-death': [...TO_REVEAL_HELP, 'seclude'],
  'poison-death': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'overdose'
  ],
  madness: [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'wanderer', 'help', 'on', 'share', 'break'
  ],
  'tribulation-death': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'xiao', 'fight'
  ],
  ascension: [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'on', 'on', 'save', 'on', 'back',
    'ditch', 'back', 'on', 'herbgirl', 'stand', 'on', 'share', 'on',
    ...CAVE_TO_PREPARATION, 'on', ...FINAL_TRIBULATION, 'answer'
  ],
  'e6-sacrifice': [
    ...TO_REVEAL_HELP, 'practice', 'temper', 'force', 'force', 'save', 'force', 'seal',
    'ditch', 'back', 'force', 'herbgirl', 'deaf', 'force', 'share', 'force',
    ...CAVE_TO_PREPARATION, 'whistle', 'ditch', 'on', ...FINAL_TRIBULATION, 'e6'
  ],
  'e7-usurp': [
    ...TO_REVEAL_HURRY, 'practice', 'temper', 'force', 'force', 'abandon', 'force', 'seal',
    'market', 'back', 'force', 'herbgirl-cold', 'leave', 'force', 'keep', 'force',
    ...CAVE_TO_PREPARATION, 'on', ...FINAL_TRIBULATION, 'e7'
  ]
};

const findings = [];
function note(severity, msg, extra = {}) {
  findings.push({ severity, msg, ...extra, at: new Date().toISOString() });
  console.log(`[${severity}] ${msg}`);
}

async function prepare(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('aeonvale-settings-v1', JSON.stringify({ masterVolume: 0, reducedMotion: true }));
      for (const key of [
        'narration.introRead',
        'narration.codex.seenThisRun',
        'narration.codex.seenScenesEver',
        'narration.codex.seenEndings',
        'narration.e7Triggered',
        'narration.readChoices',
        'narration.textSize'
      ]) localStorage.removeItem(key);
    } catch {
      /* privacy mode */
    }
  });
}

async function shot(page, name) {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function clickStage(page) {
  const stage = page.locator('#narration-intro-stage, #narration-stage').first();
  if (await stage.count()) await stage.evaluate(element => element.click());
}

async function advanceUntil(page, predicate, timeoutMs = 15000, label = 'condition') {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return true;
    await clickStage(page).catch(() => undefined);
    await page.waitForTimeout(30);
  }
  note('major', `超时未满足: ${label}`, { timeoutMs });
  return false;
}

async function waitChoice(page, id, timeoutMs = 15000) {
  return advanceUntil(
    page,
    () => page.locator(`button.narration-choice[data-choice-id="${id}"]`).isVisible(),
    timeoutMs,
    `choice ${id}`
  );
}

async function pick(page, id) {
  if (!(await waitChoice(page, id))) {
    const visible = await page.locator('button.narration-choice:visible').allTextContents().catch(() => []);
    note('critical', `找不到选项 ${id}`, { visible });
    await shot(page, `missing-choice-${id}-${Date.now()}`);
    return false;
  }
  const button = page.locator(`button.narration-choice[data-choice-id="${id}"]`);
  if (await button.isDisabled().catch(() => false)) {
    note('critical', `选项 ${id} 可见但不可用`);
    return false;
  }
  await button.click();
  await page.waitForTimeout(50);
  return true;
}

async function openTitle(page) {
  await page.goto(BASE + '/');
  const entry = page.locator('#flow-title-narration');
  const portraitOverride = page.locator('#orientation-override');
  await expectVisible(entry, portraitOverride);
  return entry;
}

async function expectVisible(entry, portraitOverride) {
  const started = Date.now();
  while (Date.now() - started < 25000) {
    if (await entry.isVisible().catch(() => false)) return;
    if (await portraitOverride.isVisible().catch(() => false)) await portraitOverride.click();
    await entry.page().waitForTimeout(50);
  }
  throw new Error('标题屏灵韵叙录入口未出现');
}

async function enterNarration(page, captureIntro = false) {
  const entry = await openTitle(page);
  if (captureIntro) await shot(page, '00-title-entry');
  await entry.click();
  await page.locator('.narration-intro-overlay').waitFor({ state: 'visible', timeout: 8000 });
  if (captureIntro) await shot(page, '01-story-preface');
  if (!(await waitChoice(page, 'try'))) return false;
  await page.locator('button.narration-choice[data-choice-id="try"]').click();
  await page.locator('[data-app-surface="narration"]').waitFor({ state: 'visible', timeout: 10000 });
  if (captureIntro) await shot(page, '02-narration-start');
  return true;
}

async function auditLayout(page, tag) {
  const stage = page.locator('#narration-stage');
  if (!(await stage.count())) return;
  const data = await stage.evaluate(element => {
    const info = selector => {
      const target = element.querySelector(selector);
      if (!(target instanceof HTMLElement)) return null;
      const rect = target.getBoundingClientRect();
      return {
        text: (target.textContent ?? '').trim(),
        visible: !target.hidden && target.offsetParent !== null,
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        clientHeight: target.clientHeight,
        scrollHeight: target.scrollHeight
      };
    };
    const rect = element.getBoundingClientRect();
    return {
      sceneId: element.dataset.sceneId,
      stage: { top: rect.top, bottom: rect.bottom, height: rect.height },
      cg: info('.narration-cg'),
      chapter: info('.narration-chapter-mark'),
      cabinet: info('.narration-cabinet'),
      dialog: info('.narration-dialog'),
      text: info('.narration-text'),
      choices: info('.narration-choices'),
      quick: info('.narration-quick-menu')
    };
  });

  if (!data.chapter?.visible) note('major', `章节题签缺失 (${tag})`, { sceneId: data.sceneId });
  if (data.cg && Math.abs(data.cg.bottom - data.stage.bottom) > 2) {
    note('major', `CG 未铺满舞台 (${tag})`, { sceneId: data.sceneId, stage: data.stage, cg: data.cg });
  }
  if (data.cabinet?.visible && data.dialog && data.cabinet.bottom > data.dialog.top + 1) {
    note('major', `心声与正文重叠 (${tag})`, { sceneId: data.sceneId });
  }
  if (data.dialog && data.quick && data.dialog.bottom > data.quick.top + 1) {
    note('major', `正文与快捷菜单重叠 (${tag})`, { sceneId: data.sceneId });
  }
  if (data.text?.visible && data.choices?.visible && data.text.bottom > data.choices.top + 1) {
    note('major', `正文与选项重叠 (${tag})`, { sceneId: data.sceneId });
  }
  if (data.dialog && data.dialog.bottom > data.stage.bottom + 1) {
    note('major', `正文越出舞台 (${tag})`, { sceneId: data.sceneId });
  }
  if (data.text?.visible && data.text.clientHeight + 1 < data.text.scrollHeight) {
    note('major', `正文自身溢出 (${tag})`, { sceneId: data.sceneId });
  }
  if (data.cabinet?.visible && data.text?.text && data.cabinet.text === data.text.text) {
    note('major', `正文与心声精确重复 (${tag})`, { sceneId: data.sceneId });
  }

  const images = page.locator('#narration-stage img:visible');
  for (let index = 0; index < await images.count(); index += 1) {
    const ok = await images.nth(index).evaluate(image =>
      image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
    );
    if (!ok) note('major', `CG 破图 (${tag})`, { sceneId: data.sceneId, index });
  }
}

async function walk(page, ids, tag) {
  const captured = new Set();
  const milestones = new Set([
    'act2.train',
    'act2.side.herb',
    'act2.village.hub',
    'act2.encounter.hub',
    'act3.preparation',
    'act3.tribulation.question'
  ]);
  for (const id of ids) {
    await advanceUntil(page, () => page.locator('button.narration-choice:visible').count().then(count => count > 0), 15000, `${tag}-${id}`);
    const sceneId = await page.locator('#narration-stage').getAttribute('data-scene-id');
    await auditLayout(page, `${tag}-${sceneId ?? id}`);
    if (sceneId && milestones.has(sceneId) && !captured.has(sceneId)) {
      captured.add(sceneId);
      await shot(page, `${tag}-${sceneId.replaceAll('.', '-')}`);
    }
    if (!(await pick(page, id))) return false;
  }
  return true;
}

async function untilEnding(page, endingId, timeoutMs = 20000) {
  const ok = await advanceUntil(
    page,
    () => page.locator(`.narration-ending-card[data-ending-id="${endingId}"]`).isVisible(),
    timeoutMs,
    `ending ${endingId}`
  );
  if (!ok) return false;
  const card = page.locator(`.narration-ending-card[data-ending-id="${endingId}"]`);
  await card.locator('.narration-ending-cg').waitFor({ state: 'visible', timeout: 8000 }).catch(() => undefined);
  if (await page.locator('.narration-cabinet:not([hidden])').count()) {
    note('major', `结局 ${endingId} 时心声条仍可见`);
  }
  return true;
}

async function auditCodex(page) {
  await prepare(page);
  if (!(await enterNarration(page))) return;
  await page.locator('#flow-narration-codex-open').click();
  await page.locator('#codex-root').waitFor({ state: 'visible', timeout: 5000 });
  await shot(page, '07-codex');
  const cards = await page.locator('.codex-ending').count();
  if (cards !== 8) note('major', '结局图鉴卡数不是 8', { cards });
  note('info', `codex locked=${await page.locator('.codex-ending[data-state="locked"]').count()}/${cards}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', error => note('critical', `pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') note('major', `console.error: ${message.text()}`);
  });

  const results = {};
  let first = true;
  for (const [endingId, route] of Object.entries(ROUTES)) {
    await prepare(page);
    if (!(await enterNarration(page, first))) {
      results[endingId] = false;
      note('critical', `无法进入 ${endingId} 路径`);
      first = false;
      continue;
    }
    first = false;
    const walked = await walk(page, route, endingId);
    const reached = walked && await untilEnding(page, endingId);
    results[endingId] = reached;
    await shot(page, `ending-${endingId}`);

    if (endingId === 'e0-mushroom' && reached) {
      const name = await page.locator('.narration-ending-name').textContent();
      if (name !== '林中第四日') note('major', 'E0 结局名异常', { name });
    }
    if (endingId === 'e7-usurp' && reached) {
      await page.locator('.narration-ending-dismiss').click();
      await page.waitForTimeout(250);
      await shot(page, '06-title-after-e7');
      if (!(await page.locator('[data-app-surface="title"].e7-cursed').count())) {
        note('major', 'E7 后标题屏未出现 e7-cursed 改写');
      }
    }
  }

  await auditCodex(page);
  await browser.close();

  const summary = {
    endingsReached: Object.entries(results).filter(([, value]) => value).map(([key]) => key),
    endingsFailed: Object.entries(results).filter(([, value]) => !value).map(([key]) => key),
    critical: findings.filter(finding => finding.severity === 'critical').length,
    major: findings.filter(finding => finding.severity === 'major').length,
    minor: findings.filter(finding => finding.severity === 'minor').length
  };
  const report = { base: BASE, out: OUT, endings: results, findings, summary };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('findings', findings.length, 'screenshots →', OUT);
  if (summary.endingsFailed.length > 0 || summary.critical > 0 || summary.major > 0) {
    console.error('visual-audit-narration: FAILED');
    process.exitCode = 1;
  } else {
    console.log('visual-audit-narration: OK');
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
