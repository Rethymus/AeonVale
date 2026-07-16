#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const pagesUrl = process.env.AEON_PAGES_URL ?? 'https://Rethymus.github.io/AeonVale/';
const viewport = { width: 1280, height: 720 };
const fetchTimeoutMs = Number(process.env.AEON_PAGES_FETCH_TIMEOUT_MS ?? 15_000);
const printJson = process.argv.includes('--json');
const skipBrowser = process.argv.includes('--skip-browser');
const failOnLiveError = process.argv.includes('--fail-on-live-error');

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

function maybeText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readSource(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function mountSignature(source) {
  return {
    hasBodyAppend: /document\.body\.appendChild\(app\.canvas\)/.test(source),
    hasAppMount: /querySelector\(['"]#app['"]\)/.test(source) && /appendChild\(app\.canvas\)/.test(source),
  };
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`timed out after ${fetchTimeoutMs}ms`)), fetchTimeoutMs);
  try {
    const response = await fetch(url, { redirect: 'follow', signal: controller.signal });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      lastModified: response.headers.get('last-modified'),
      etag: response.headers.get('etag'),
      cacheControl: response.headers.get('cache-control'),
      text,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function firstScriptSrc(html, baseUrl) {
  const match = html.match(/<script\b[^>]*\bsrc=["']([^"']+\.js)["']/i);
  if (!match?.[1]) return null;
  return new URL(match[1], baseUrl).toString();
}

async function inspectLiveHtml(url) {
  let html;
  try {
    html = await fetchText(url);
  } catch (error) {
    return {
      ok: false,
      status: null,
      finalUrl: url,
      error: errorMessage(error),
      script: null,
    };
  }
  const scriptUrl = firstScriptSrc(html.text, html.url);
  let script = null;
  if (scriptUrl) {
    try {
      const js = await fetchText(scriptUrl);
      script = {
        url: scriptUrl,
        ok: js.ok,
        status: js.status,
        bytes: js.text.length,
        hasBodyAppend: js.text.includes('document.body.appendChild('),
        hasAppMountQuery: js.text.includes('querySelector("#app")') || js.text.includes("querySelector('#app')"),
      };
    } catch (error) {
      script = {
        url: scriptUrl,
        ok: false,
        status: null,
        bytes: 0,
        error: errorMessage(error),
        hasBodyAppend: false,
        hasAppMountQuery: false,
      };
    }
  }
  return {
    ok: html.ok,
    status: html.status,
    finalUrl: html.url,
    lastModified: html.lastModified,
    etag: html.etag,
    cacheControl: html.cacheControl,
    script,
  };
}

async function inspectBrowser(url) {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { state: 'visible', timeout: 30_000 });
    await page.waitForFunction(() => globalThis.__AEON_DEBUG__ != null, null, { timeout: 30_000 });
    return await page.evaluate(() => {
      const rect = (element) => {
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return { x: box.x, y: box.y, width: box.width, height: box.height };
      };
      const canvas = document.querySelector('canvas');
      const app = document.querySelector('#app');
      const canvasRect = rect(canvas);
      const appRect = rect(app);
      return {
        title: document.title,
        href: location.href,
        scrollY,
        viewport: { width: innerWidth, height: innerHeight },
        bodyScrollHeight: document.body.scrollHeight,
        htmlScrollHeight: document.documentElement.scrollHeight,
        appRect,
        canvasRect,
        canvasInInitialViewport: Boolean(canvasRect && canvasRect.y >= 0 && canvasRect.y < innerHeight),
        firstBodyChildren: Array.from(document.body.children).slice(0, 5).map((element) => ({
          tag: element.tagName,
          id: element.id,
          className: String(element.className ?? ''),
          rect: rect(element),
        })),
        scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
        debug: globalThis.__AEON_DEBUG__ ?? null,
      };
    });
  } finally {
    await browser.close();
  }
}

function latestPagesRun() {
  const raw = run('gh', [
    'run', 'list',
    '--workflow', 'Deploy GitHub Pages',
    '--branch', 'main',
    '--limit', '1',
    '--json', 'databaseId,status,conclusion,headSha,createdAt,updatedAt,event,displayTitle',
  ]);
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw)[0] ?? null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error), raw };
  }
}

function buildDiagnosis(report) {
  const findings = [];
  const actions = [];
  const liveCanvasOffscreen = report.browser?.canvasRect && report.browser.canvasRect.y >= report.browser.viewport.height;

  if (report.git.head && report.git.originMain && report.git.head !== report.git.originMain) {
    findings.push('local-head-differs-from-origin-main');
    actions.push('先确认当前工作树是否要合入 main；真实 Pages 只会反映已部署到 main 的公开树。');
  }

  if (report.live?.error || report.live?.script?.error) {
    findings.push('live-pages-fetch-failed');
    actions.push('真实 Pages HTML 或 JS 读取失败；先检查网络、DNS、GitHub Pages 状态和 URL，再决定是否需要重新触发部署。');
  }

  if (report.localSource.hasAppMount && !report.originMainSource.hasAppMount) {
    findings.push('local-has-canvas-app-mount-fix-not-on-origin-main');
    actions.push('当前本地代码已把 canvas 挂到 #app，但 origin/main 仍是 body 挂载；需要维护者授权后通过正常 PR/部署链路更新 main。');
  }

  if (report.live.script?.hasBodyAppend) {
    findings.push('deployed-bundle-uses-body-append');
    actions.push('线上 bundle 仍包含旧 body append 挂载；这是旧部署/分支漂移证据，不要继续把它当作当前本地布局回归来修。');
  }

  if (liveCanvasOffscreen) {
    findings.push('live-canvas-starts-outside-initial-viewport');
    actions.push('不要继续盲改当前运行时代码；先让线上部署包含 #app 挂载修复，再复跑 pnpm test:browser:pages。');
  }

  if (report.pagesRun?.conclusion && report.pagesRun.conclusion !== 'success') {
    findings.push('latest-pages-action-not-green');
    actions.push(`先查看 Pages Action #${report.pagesRun.databaseId} 的失败步骤，再决定是否修 workflow 或重新部署。`);
  }

  if (!findings.length) {
    findings.push('no-obvious-pages-drift');
    actions.push('若 pnpm test:browser:pages 仍失败，优先查看 Playwright error-context 和线上截图。');
  }

  return { findings, actions };
}

async function main() {
  const head = run('git', ['rev-parse', 'HEAD']);
  const branch = run('git', ['branch', '--show-current']);
  const originMain = run('git', ['rev-parse', 'origin/main']);
  const localMain = readSource('src/app/main.ts');
  const originMainSourceRaw = run('git', ['show', 'origin/main:src/app/main.ts']);
  const originMainSource = typeof originMainSourceRaw === 'string' ? originMainSourceRaw : '';

  const report = {
    title: 'Aeon Vale Pages 只读诊断',
    safety: '此命令只读取 Git、GitHub Actions 和真实 Pages URL，不提交、不推送、不部署、不修改远端设置。',
    pagesUrl,
    git: {
      branch: maybeText(branch),
      head: maybeText(head),
      originMain: maybeText(originMain),
      headMatchesOriginMain: typeof head === 'string' && typeof originMain === 'string' ? head === originMain : null,
    },
    pagesRun: latestPagesRun(),
    localSource: mountSignature(localMain),
    originMainSource: mountSignature(originMainSource),
    live: await inspectLiveHtml(pagesUrl),
    browser: null,
    browserError: null,
    diagnosis: null,
  };

  if (!skipBrowser) {
    try {
      report.browser = await inspectBrowser(pagesUrl);
    } catch (error) {
      report.browserError = error instanceof Error ? error.message : String(error);
    }
  }

  report.diagnosis = buildDiagnosis(report);

  if (printJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(report.title);
    console.log(report.safety);
    console.log('');
    console.log(`Pages: ${report.pagesUrl}`);
    console.log(`Git: ${report.git.branch ?? 'unknown'} ${report.git.head ?? 'unknown'}`);
    console.log(`origin/main: ${report.git.originMain ?? 'unknown'}`);
    console.log(`HEAD matches origin/main: ${String(report.git.headMatchesOriginMain)}`);
    if (report.pagesRun && !report.pagesRun.error) {
      console.log(`Latest Pages Action: #${report.pagesRun.databaseId} ${report.pagesRun.conclusion}/${report.pagesRun.status} ${report.pagesRun.headSha ?? ''}`);
    }
    console.log(`Live HTML: ${report.live.status} last-modified=${report.live.lastModified ?? 'unknown'}`);
    console.log(`Live JS: ${report.live.script?.url ?? 'missing'}`);
    console.log(`Live JS body append: ${String(report.live.script?.hasBodyAppend ?? null)}`);
    console.log(`Local mount fix: ${String(report.localSource.hasAppMount)}; origin/main mount fix: ${String(report.originMainSource.hasAppMount)}`);
    if (report.browser) {
      console.log(`Canvas rect: ${JSON.stringify(report.browser.canvasRect)}`);
      console.log(`Canvas in initial viewport: ${String(report.browser.canvasInInitialViewport)}`);
      console.log(`First body children: ${report.browser.firstBodyChildren.map((child) => `${child.tag}${child.id ? `#${child.id}` : ''}`).join(', ')}`);
    } else if (report.browserError) {
      console.log(`Browser probe error: ${report.browserError}`);
    }
    console.log('');
    console.log('Findings');
    for (const item of report.diagnosis.findings) console.log(`- ${item}`);
    console.log('');
    console.log('Next Actions');
    for (const item of report.diagnosis.actions) console.log(`- ${item}`);
  }

  const hasLiveError = report.diagnosis.findings.some((item) => item.includes('live-') || item.includes('deployed-bundle'));
  if (failOnLiveError && hasLiveError) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
