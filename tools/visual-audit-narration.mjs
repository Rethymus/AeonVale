#!/usr/bin/env node
/**
 * 灵韵叙录视觉查收：以用户视角从入口走完全部 8 结局，截图 + 问题日志。
 * 用法：pnpm exec playwright test 不依赖；直接 node --import tsx 或:
 *   node tools/visual-audit-narration.mjs
 * 预览服默认 http://127.0.0.1:4173
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const OUT = path.resolve('tmp/visual-audit-narration');
mkdirSync(OUT, { recursive: true });

const ENDINGS = {
  'e0-mushroom': [
    ['deep'], // awaken
  ],
  // 主线到 reveal 的公共前缀
};

/** 公共序章→习诀路径（选择 id 序列） */
const TO_TRAIN = [
  'village', // awaken
  'ask', // village → depart (need ask path - village has system/elder/soul/ask/help?)
];

const findings = [];
function note(severity, msg, extra = {}) {
  findings.push({ severity, msg, ...extra, at: new Date().toISOString() });
  console.log(`[${severity}] ${msg}`);
}

async function prepare(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('aeonvale-settings-v1', JSON.stringify({ masterVolume: 0, reducedMotion: true }));
      for (const k of [
        'narration.introRead',
        'narration.codex.seenThisRun',
        'narration.codex.seenScenesEver',
        'narration.codex.seenEndings',
        'narration.e7Triggered',
        'narration.readChoices',
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

async function advanceUntil(page, pred, timeoutMs = 15000, label = 'cond') {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pred()) return true;
    await clickStage(page).catch(() => undefined);
    await page.waitForTimeout(30);
  }
  note('major', `超时未满足: ${label}`, { timeoutMs });
  return false;
}

async function waitChoice(page, id, timeoutMs = 15000) {
  return advanceUntil(
    page,
    async () => page.locator(`button.narration-choice[data-choice-id="${id}"]`).isVisible(),
    timeoutMs,
    `choice ${id}`
  );
}

async function pick(page, id) {
  const ok = await waitChoice(page, id);
  if (!ok) {
    const labels = await page.locator('button.narration-choice:visible').allTextContents().catch(() => []);
    note('critical', `找不到选项 ${id}`, { visible: labels });
    await shot(page, `missing-choice-${id}-${Date.now()}`);
    return false;
  }
  const btn = page.locator(`button.narration-choice[data-choice-id="${id}"]`);
  const disabled = await btn.isDisabled().catch(() => false);
  const available = await btn.getAttribute('data-available');
  if (disabled || available === 'false') {
    const labels = await page.locator('button.narration-choice:visible').allTextContents().catch(() => []);
    note('major', `选项 ${id} 可见但锁定/禁用`, { labels });
    await shot(page, `locked-choice-${id}-${Date.now()}`);
    return false;
  }
  await btn.click();
  await page.waitForTimeout(80);
  return true;
}

async function enterNarration(page) {
  await page.goto(BASE + '/');
  await page.locator('#flow-title-narration').waitFor({ state: 'visible', timeout: 25000 });
  await shot(page, '00-title-entry');
  // visual checks title
  const entry = page.locator('#flow-title-narration');
  const box = await entry.boundingBox();
  if (!box) note('critical', '入口按钮无 boundingBox');
  else if (box.height < 24) note('major', '入口按钮高度过小', { box });
  await entry.click();
  await page.locator('.narration-intro-overlay').waitFor({ state: 'visible', timeout: 8000 });
  await shot(page, '01-intro-dialog');
  // advance intro
  const tryOk = await waitChoice(page, 'try');
  if (!tryOk) return false;
  // check for empty text
  const introText = await page.locator('#narration-intro-vn .narration-text, #narration-intro-stage .narration-text').first().textContent().catch(() => '');
  if (!introText || !introText.trim()) note('major', '自白对话框正文为空');
  await page.locator('button.narration-choice[data-choice-id="try"]').click();
  await page.locator('[data-app-surface="narration"]').waitFor({ state: 'visible', timeout: 10000 });
  await shot(page, '02-narration-start');
  // a11y
  const stage = page.locator('#narration-stage');
  const role = await stage.getAttribute('role');
  const aria = await stage.getAttribute('aria-label');
  if (role !== 'group') note('major', 'narration-stage role 不是 group', { role });
  if (!aria?.trim()) note('major', 'narration-stage 缺 aria-label');
  return true;
}

async function untilEnding(page, endingId, timeoutMs = 20000) {
  const ok = await advanceUntil(
    page,
    async () => page.locator(`.narration-ending-card[data-ending-id="${endingId}"]`).isVisible(),
    timeoutMs,
    `ending ${endingId}`
  );
  if (!ok) return false;
  // wait for ending CG naturalWidth if present
  const img = page.locator('.narration-ending-cg');
  if (await img.count()) {
    await page
      .waitForFunction(() => {
        const im = document.querySelector('.narration-ending-cg');
        return (
          im instanceof HTMLImageElement &&
          im.complete &&
          im.naturalWidth > 0 &&
          im.dataset.decoded === 'true' &&
          Number(getComputedStyle(im).opacity) > 0.95
        );
      }, null, { timeout: 8000 })
      .catch(() => note('major', `结局 ${endingId} CG 未在 8s 内完成加载并显影`));
    const info = await img
      .evaluate((im) =>
        im instanceof HTMLImageElement
          ? {
              src: im.currentSrc || im.src,
              w: im.naturalWidth,
              h: im.naturalHeight,
              cw: im.clientWidth,
              ch: im.clientHeight,
              decoded: im.dataset.decoded,
              opacity: getComputedStyle(im).opacity
            }
          : null
      )
      .catch(() => null);
    if (!info || !info.w) note('major', `结局 ${endingId} CG 尺寸异常`, { info });
    else if (info.ch < 80) note('major', `结局 ${endingId} CG 显示高度过小`, { info });
    else if (info.decoded !== 'true' || Number(info.opacity) === 0) {
      note('major', `结局 ${endingId} CG 已加载但仍不可见`, { info });
    }
  } else {
    const fb = await page.locator('.narration-ending-cg-fallback').count();
    if (fb) note('major', `结局 ${endingId} 走了 fallback，无 CG`);
  }
  // cabinet must be empty/hidden on ending
  const cabVisible = await page.locator('.narration-cabinet:not([hidden])').count();
  if (cabVisible) note('major', `结局 ${endingId} 时心声条仍可见`);
  return true;
}

async function auditCg(page, tag) {
  const imgs = page.locator('.narration-cg-img, .narration-cg-bg, .narration-cg img');
  const n = await imgs.count();
  let broken = 0;
  for (let i = 0; i < n; i++) {
    const img = imgs.nth(i);
    const visible = await img.isVisible().catch(() => false);
    if (!visible) continue;
    const ok = await img.evaluate((el) => {
      const im = el;
      if (!(im instanceof HTMLImageElement)) return true;
      if (!im.src) return false;
      return im.complete && im.naturalWidth > 0;
    });
    if (!ok) broken++;
  }
  if (broken) note('major', `CG 破图/空 src (${tag})`, { broken, total: n });
  // check dialog text non-empty when present
  const text = await page.locator('#narration-stage .narration-text').first().textContent().catch(() => '');
  if (text !== null && text !== undefined && String(text).trim() === '') {
    // might be between lines
  }
  // overlapping quick menu vs choices?
  const choices = page.locator('button.narration-choice:visible');
  const c = await choices.count();
  if (c > 5) note('major', `可见选项 >5 (${tag})`, { count: c });
  // locked choices without glyph consistency — soft
  const labels = await choices.allTextContents();
  if (labels.some((l) => !l || !l.trim())) note('major', `存在空文案选项 (${tag})`, { labels });
  const frame = await page.locator('#narration-stage').evaluate((stage) => {
    const info = (selector) => {
      const el = stage.querySelector(selector);
      if (!(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      return {
        text: (el.textContent ?? '').trim(),
        visible: !el.hidden && el.offsetParent !== null,
        top: rect.top,
        bottom: rect.bottom,
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight
      };
    };
    const stageRect = stage.getBoundingClientRect();
    return {
      sceneId: stage.getAttribute('data-scene-id'),
      stage: { top: stageRect.top, bottom: stageRect.bottom },
      text: info('.narration-text'),
      cabinet: info('.narration-cabinet'),
      dialog: info('.narration-dialog'),
      choices: info('.narration-choices'),
      quick: info('.narration-quick-menu')
    };
  });
  if (frame.text?.text && frame.cabinet?.visible && frame.cabinet.text === frame.text.text) {
    note('major', `正文与心声条精确重复 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.cabinet?.visible && frame.dialog && frame.cabinet.bottom > frame.dialog.top + 1) {
    note('major', `心声条与对话框重叠 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.dialog && frame.quick && frame.dialog.bottom > frame.quick.top + 1) {
    note('major', `对话框与快捷菜单重叠 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.dialog && frame.dialog.bottom > frame.stage.bottom + 1) {
    note('major', `对话框越出舞台 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.quick && frame.quick.bottom > frame.stage.bottom + 1) {
    note('major', `快捷菜单越出舞台 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.text?.visible && frame.text.clientHeight + 1 < frame.text.scrollHeight) {
    note('major', `正文溢出自身盒子 (${tag})`, { sceneId: frame.sceneId });
  }
  if (frame.text?.visible && frame.choices?.visible && frame.text.bottom > frame.choices.top + 1) {
    note('major', `正文与选项重叠 (${tag})`, { sceneId: frame.sceneId });
  }
  return { labels, cgCount: n, broken };
}

/** 走完一组 choice id，中途 audit */
async function walk(page, choiceIds, tag) {
  for (const id of choiceIds) {
    await auditCg(page, `${tag}-before-${id}`);
    const ok = await pick(page, id);
    if (!ok) return false;
    // if response line, advance past it
    await page.waitForTimeout(50);
  }
  return true;
}

async function pathToTrain(page) {
  // awaken → village → help (optional once) → ask → depart.on → road.help → token? need check graph
  // From BFS: village, ask, on, hurry, on, leave, farm, hide, on, on, approach, try, open, on, on, reveal, practice
  // village choices: need actual ids
  return walk(page, [
    'village',
    'ask',
    'on', // depart
    'help', // road help if exists else hurry - try help first
  ], 'to-train-part1');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('pageerror', (err) => note('critical', `pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') note('major', `console.error: ${msg.text()}`);
  });

  const results = {};

  // —— E0 ——
  await prepare(page);
  if (!(await enterNarration(page))) {
    note('critical', '无法进入 narration');
  } else {
    await walk(page, ['deep'], 'e0');
    // deep may need advances to ending
    const e0 = await untilEnding(page, 'e0-mushroom');
    await shot(page, 'ending-e0-mushroom');
    results['e0-mushroom'] = e0;
    if (e0) {
      const name = await page.locator('.narration-ending-name').textContent();
      if (!name?.includes('红伞')) note('major', 'E0 结局名异常', { name });
      await auditCg(page, 'e0-card');
    }
  }

  // helper restart
  async function restartToTrain() {
    await prepare(page);
    if (!(await enterNarration(page))) return false;
    // full BFS path to practice
    const pathIds = [
      'village',
      'ask',
      'on', // depart
      'hurry', // road - use hurry to avoid token branch complexity; if help exists both ok
      'on', // spread (if hurry goes spread)
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
      'practice' // reveal
    ];
    // Some paths: after help goes token then spread - detect dynamically
    for (const id of pathIds) {
      // if choice not visible, try alternate
      const visible = await page.locator(`button.narration-choice[data-choice-id="${id}"]`).isVisible().catch(() => false);
      if (!visible) {
        // try common alts
        const alts = {
          hurry: ['help'],
          help: ['hurry'],
          on: ['spread', 'leave', 'back'],
          ask: ['help', 'system']
        };
        let picked = false;
        // wait a bit for any choice
        await advanceUntil(page, async () => (await page.locator('button.narration-choice:visible').count()) > 0, 8000, `any-choice-for-${id}`);
        if (await page.locator(`button.narration-choice[data-choice-id="${id}"]`).isVisible().catch(() => false)) {
          await pick(page, id);
          picked = true;
        } else if (alts[id]) {
          for (const a of alts[id]) {
            if (await page.locator(`button.narration-choice[data-choice-id="${a}"]`).isVisible().catch(() => false)) {
              await pick(page, a);
              picked = true;
              break;
            }
          }
        }
        if (!picked) {
          // pick first available to not stick - bad for path but log
          const first = page.locator('button.narration-choice:visible').first();
          if (await first.count()) {
            const fid = await first.getAttribute('data-choice-id');
            note('minor', `路径分叉：期望 ${id}，改选 ${fid}`);
            await first.click();
            await page.waitForTimeout(80);
            // if we took help, need to continue token chain
            if (fid === 'help') {
              // token scene has on?
              await advanceUntil(page, async () => (await page.locator('button.narration-choice:visible').count()) > 0, 8000, 'after-help');
              if (await page.locator('button.narration-choice[data-choice-id="on"]').isVisible()) await pick(page, 'on');
              if (await page.locator('button.narration-choice[data-choice-id="spread"]').isVisible()) await pick(page, 'spread');
            }
          } else {
            note('critical', `卡死：无选项且需要 ${id}`);
            await shot(page, `stuck-${id}`);
            return false;
          }
        }
      } else {
        await pick(page, id);
      }
      // after choice may need advance through response
      await page.waitForTimeout(40);
    }
    // should be on act2.train
    await auditCg(page, 'at-train');
    await shot(page, '03-act2-train');
    return true;
  }

  // —— lifespan via seclude ——
  await prepare(page);
  if (await enterNarration(page)) {
    // to reveal then seclude
    const ok = await (async () => {
      // reuse dynamic walker until reveal choices
      const prefix = [
        'village','ask','on','hurry','on','leave','farm','hide','on','on','approach','try','open','on','on','reveal'
      ];
      for (const id of prefix) {
        await advanceUntil(page, async () => (await page.locator('button.narration-choice:visible').count()) > 0, 10000, id);
        if (!(await pick(page, id))) {
          // try first
          const first = page.locator('button.narration-choice:visible').first();
          if (await first.count()) await first.click();
          else return false;
        }
      }
      return pick(page, 'seclude');
    })();
    if (ok) {
      const e = await untilEnding(page, 'lifespan-death');
      await shot(page, 'ending-lifespan-death');
      results['lifespan-death'] = e;
    }
  }

  // —— poison ——
  if (await restartToTrain()) {
    if (await pick(page, 'alchemy')) {
      if (await pick(page, 'overdose')) {
        // may end immediately
        const e = await untilEnding(page, 'poison-death');
        await shot(page, 'ending-poison-death');
        results['poison-death'] = e;
      }
    }
  }

  // —— madness ——
  if (await restartToTrain()) {
    const openedLateStages = await walk(
      page,
      ['temper', 'stage1', 'on', 'stage2', 'on', 'stage3', 'on', 'more', 'break'],
      'madness-six-order'
    );
    if (openedLateStages) {
      const e = await untilEnding(page, 'madness');
      await shot(page, 'ending-madness');
      results['madness'] = e;
    }
  }

  // —— tribulation-death via xiao fight (need cult>=3) ——
  if (await restartToTrain()) {
    // do stage1,2,3
    if (await pick(page, 'temper')) {
      // stage1 available
      if (await waitChoice(page, 'stage1', 5000)) {
        await pick(page, 'stage1');
        await pick(page, 'on'); // back temper
      }
      if (await waitChoice(page, 'stage2', 5000)) {
        await pick(page, 'stage2');
        await pick(page, 'on');
      }
      if (await waitChoice(page, 'stage3', 5000)) {
        await pick(page, 'stage3');
        await pick(page, 'on');
      }
      await pick(page, 'rest'); // train
      if (await pick(page, 'side')) {
        if (await pick(page, 'more')) {
          if (await waitChoice(page, 'xiao', 5000)) {
            await pick(page, 'xiao');
            if (await pick(page, 'fight')) {
              const e = await untilEnding(page, 'tribulation-death');
              await shot(page, 'ending-tribulation-death');
              results['tribulation-death'] = e;
            }
          } else note('major', 'cult>=3 后仍无 xiao 选项');
        }
      }
    }
  }

  // —— 六劫与完整终局链 ——
  async function doStages(page) {
    return walk(
      page,
      ['temper', 'stage1', 'on', 'stage2', 'on', 'stage3', 'on', 'more', 'stage4', 'on', 'stage5', 'on', 'stage6', 'on'],
      'six-stages'
    );
  }

  async function stackDefiance(page) {
    return walk(
      page,
      ['side', 'bully', 'watch', 'herb', 'abandon', 'bribe', 'accept', 'more', 'whistle', 'silent', 'back', 'back'],
      'defiance-storylets'
    );
  }

  async function stackBond(page) {
    return walk(
      page,
      [
        'side', 'more', 'famine', 'share', 'village',
        'ditch', 'back', 'market', 'back', 'song', 'back',
        'go-out', 'wanderer', 'help', 'herbgirl-cold', 'atone',
        'artificer', 'refuse', 'back', 'back'
      ],
      'bond-storylets'
    );
  }

  async function walkFinaleToQuestion(page, tag) {
    if (!(await pick(page, 'assault'))) return false;
    await shot(page, `${tag}-act3-entry`);
    const atQuestion = async () =>
      page
        .locator(
          'button.narration-choice[data-choice-id="e6"], button.narration-choice[data-choice-id="e7"], button.narration-choice[data-choice-id="answer"]'
        )
        .first()
        .isVisible()
        .catch(() => false);

    for (let step = 0; step < 14; step++) {
      const ready = await advanceUntil(
        page,
        async () => (await atQuestion()) || (await page.locator('button.narration-choice:visible').count()) > 0,
        12000,
        `${tag}-finale-${step}`
      );
      if (!ready) return false;
      if (await atQuestion()) break;

      const sceneId = await page.locator('#narration-stage').getAttribute('data-scene-id');
      await auditCg(page, `${tag}-${sceneId ?? step}`);
      if (sceneId === 'act3.preparation') {
        await shot(page, `${tag}-preparation`);
        for (const prepId of ['whistle', 'herbs', 'ditch', 'array', 'array-dark']) {
          const prep = page.locator(`button.narration-choice[data-choice-id="${prepId}"]`);
          if (await prep.isVisible().catch(() => false)) {
            if (!(await pick(page, prepId))) return false;
            await advanceUntil(
              page,
              async () => (await page.locator('button.narration-choice:visible').count()) > 0,
              5000,
              `${tag}-prep-${prepId}`
            );
          }
        }
      }
      if (sceneId?.startsWith('act3.tribulation')) {
        await shot(page, `${tag}-${sceneId.replaceAll('.', '-')}`);
      }
      if (!(await pick(page, 'on'))) return false;
    }

    if (!(await atQuestion())) {
      note('critical', `${tag}: 未抵达天道诘问`);
      await shot(page, `${tag}-stuck-before-question`);
      return false;
    }
    await auditCg(page, `${tag}-question`);
    await shot(page, `${tag}-tribulation-question`);
    const visibleTerminal = await page
      .locator(
        'button.narration-choice[data-choice-id="e6"]:visible, button.narration-choice[data-choice-id="e7"]:visible, button.narration-choice[data-choice-id="answer"]:visible'
      )
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute('data-choice-id')));
    if (visibleTerminal.length !== 1) {
      note('major', `${tag}: 天道诘问泄露互斥结局矩阵`, { visibleTerminal });
    }
    return true;
  }

  // —— ascension: 六劫稳妥完成，不堆反抗 ——
  if (await restartToTrain() && await doStages(page) && await walkFinaleToQuestion(page, 'ascension')) {
    if (await pick(page, 'answer')) {
      const e = await untilEnding(page, 'ascension');
      await shot(page, 'ending-ascension');
      results['ascension'] = e;
    }
  }

  // —— E7: 高反抗、低羁绊 ——
  if (await restartToTrain() && await doStages(page) && await stackDefiance(page) && await walkFinaleToQuestion(page, 'e7')) {
    if (await pick(page, 'e7')) {
      const e = await untilEnding(page, 'e7-usurp');
      await shot(page, 'ending-e7-usurp');
      results['e7-usurp'] = e;
      if (e) {
        await page.locator('.narration-ending-dismiss').click().catch(() => undefined);
        await page.waitForTimeout(300);
        await shot(page, '06-title-after-e7');
        const cursed = await page.locator('[data-app-surface="title"].e7-cursed, .e7-cursed').count();
        if (!cursed) note('major', 'E7 后标题屏未出现 e7-cursed 改写');
      }
    }
  }

  // —— E6: 高反抗、高羁绊；劫前准备完成最后回收 ——
  if (
    await restartToTrain() &&
    await doStages(page) &&
    await stackDefiance(page) &&
    await stackBond(page) &&
    await walkFinaleToQuestion(page, 'e6')
  ) {
    if (await pick(page, 'e6')) {
      const e = await untilEnding(page, 'e6-sacrifice');
      await shot(page, 'ending-e6-sacrifice');
      results['e6-sacrifice'] = e;
    }
  }

  // codex visual
  await prepare(page);
  if (await enterNarration(page)) {
    await page.locator('#flow-narration-codex-open').click();
    await page.locator('#codex-root').waitFor({ state: 'visible', timeout: 5000 });
    await shot(page, '07-codex');
    const locked = await page.locator('.codex-ending[data-state="locked"]').count();
    const cards = await page.locator('.codex-ending').count();
    if (cards !== 8) note('major', `结局图鉴卡数不是 8`, { cards });
    // clue length check for locked
    const clues = await page.locator('.codex-ending-clue, .codex-ending [data-clue]').allTextContents().catch(() => []);
    for (const c of clues) {
      if (c && c.length > 14) note('minor', 'locked 线索可能超 14 字', { c, len: c.length });
    }
    note('info', `codex locked=${locked}/${cards}`);
  }

  await browser.close();

  const report = {
    base: BASE,
    out: OUT,
    endings: results,
    findings,
    summary: {
      endingsReached: Object.entries(results).filter(([, v]) => v).map(([k]) => k),
      endingsFailed: Object.entries(results).filter(([, v]) => !v).map(([k]) => k),
      critical: findings.filter((f) => f.severity === 'critical').length,
      major: findings.filter((f) => f.severity === 'major').length,
      minor: findings.filter((f) => f.severity === 'minor').length
    }
  };
  writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('findings', findings.length, 'screenshots →', OUT);
  const failed =
    report.summary.endingsFailed.length > 0 ||
    report.summary.critical > 0 ||
    report.summary.major > 0;
  if (failed) {
    console.error('visual-audit-narration: FAILED');
    process.exitCode = 1;
  } else {
    console.log('visual-audit-narration: OK');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
