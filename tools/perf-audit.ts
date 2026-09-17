#!/usr/bin/env node
/**
 * perf-audit.ts —— 线上/本地 Core Web Vitals + 天劫棋盘帧预算审计（docs/32 §24）。
 *
 * 方法论（Lighthouse 移动实验室档 + PerformanceObserver 直采）：
 *   - 桌面：1280×800，无节流；移动（--mobile）：360×800 @3x 触控 + Slow 4G 节流
 *     （1.6Mbps 下行 / 750Kbps 上行 / 150ms RTT，CDP emulateNetworkConditions）+ 4x CPU 降速。
 *   - CWV：buffered PerformanceObserver 直采 LCP；paint/longtask/layout-shift 条目
 *     采 FCP / TBT（longtask 超阈部分求和，INP 的实验室代理）/ CLS（会话窗口算法）。
 *   - 字体时间线：resource timing 中 woff2 的 start/end（启动链串行化诊断，§24.6）。
 *   - 帧预算（--flow）：走真实 UI 流程到天劫棋盘，rAF 间隔采样 + 24 步移动，
 *     报 p50/p95/max 与掉帧数（>32ms）。
 *
 * 用法：
 *   pnpm perf:audit --url=https://rethymus.github.io/AeonVale/            # 桌面 CWV
 *   pnpm perf:audit --mobile --loads=3                                     # 移动+Slow4G
 *   pnpm perf:audit --url=http://127.0.0.1:4199/ --flow                    # 含棋盘帧预算
 *
 * 阈值（web.dev）：LCP≤2500ms good／>4000 poor；CLS≤0.1；TBT≤200ms；
 * 帧预算 p95≤32ms（两次 vsync）视为不掉帧。
 */
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';

interface Options {
  readonly url: string;
  readonly mobile: boolean;
  readonly loads: number;
  readonly flow: boolean;
  /** 追加一行 JSON 记录（时间戳+逐次+中位）到该 jsonl 文件，供纵向采样数据链（docs/32 §24.6.1/§24.7）消费。 */
  readonly out?: string;
}

interface LoadMetrics {
  readonly attempt: number;
  readonly cold: 1 | 0;
  readonly ttfb: number;
  readonly fcp: number;
  readonly lcp: number;
  readonly cls: number;
  readonly tbt: number;
  readonly jsKB: number;
  readonly otherKB: number;
  readonly fontStart: number;
  readonly fontEnd: number;
}

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Mobile Safari/537.36';

function parseOptions(argv: readonly string[]): Options {
  let url = 'https://rethymus.github.io/AeonVale/';
  let mobile = false;
  let loads = 3;
  let flow = false;
  let out: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith('--url=')) url = arg.slice('--url='.length);
    else if (arg === '--mobile') mobile = true;
    else if (arg === '--flow') flow = true;
    else if (arg.startsWith('--loads=')) loads = Math.max(1, Number(arg.slice('--loads='.length)) || 3);
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
  }
  return { url, mobile, loads, flow, out };
}

async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp?: number };
    try {
      new PerformanceObserver(list => {
        const entries = list.getEntries() as unknown as { startTime: number }[];
        if (entries.length > 0) w.__lcp = entries[entries.length - 1]!.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true } as PerformanceObserverInit);
      new PerformanceObserver(() => {}).observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      new PerformanceObserver(() => {}).observe({ type: 'longtask', buffered: true } as PerformanceObserverInit);
    } catch {
      /* 采集器不可用时指标缺省为 -1/0 */
    }
  });
}

async function throttle(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Network.enable');
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 150
  });
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

async function collectLoad(page: Page, attempt: number): Promise<LoadMetrics> {
  return page.evaluate((attemptValue: number) => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType('paint');
    const fcp = paints.find(p => p.name === 'first-contentful-paint')?.startTime ?? -1;
    const shifts = performance.getEntriesByType('layout-shift') as unknown as Array<{ value: number; startTime: number; hadRecentInput: boolean }>;
    // CLS 会话窗口：间隔 >5s 或窗口跨度 >1s 即切新窗口，取最大窗口值。
    let cls = 0;
    let current = 0;
    let firstTime = 0;
    let prevTime = 0;
    for (const entry of shifts) {
      if (entry.hadRecentInput) continue;
      if (prevTime > 0 && (entry.startTime - prevTime > 5000 || entry.startTime - firstTime > 1000)) {
        cls = Math.max(cls, current);
        current = 0;
        firstTime = entry.startTime;
      }
      if (current === 0) firstTime = entry.startTime;
      current += entry.value;
      prevTime = entry.startTime;
    }
    cls = Math.max(cls, current);
    const longtasks = performance.getEntriesByType('longtask') as unknown as Array<{ duration: number; startTime: number }>;
    const tbt = longtasks
      .filter(t => t.startTime < (nav?.loadEventEnd ?? 60000))
      .reduce((sum, t) => sum + Math.max(0, t.duration - 50), 0);
    const resources = performance.getEntriesByType('resource') as unknown as Array<{ name: string; transferSize: number; encodedBodySize: number; startTime: number; responseEnd: number }>;
    let jsBytes = 0;
    let otherBytes = 0;
    let fontStart = -1;
    let fontEnd = -1;
    for (const r of resources) {
      const size = r.encodedBodySize || r.transferSize;
      if (/\.woff2?(\?|$)/.test(r.name)) {
        fontStart = Math.round(r.startTime);
        fontEnd = Math.round(r.responseEnd);
      } else if (/\.js(\?|$)/.test(r.name)) jsBytes += size;
      else otherBytes += size;
    }
    return {
      attempt: attemptValue,
      cold: 1 as const,
      ttfb: nav ? Math.round(nav.responseStart - nav.startTime) : -1,
      fcp: Math.round(fcp),
      lcp: Math.round((window as unknown as { __lcp?: number }).__lcp ?? -1),
      cls: Math.round(cls * 1000) / 1000,
      tbt: Math.round(tbt),
      jsKB: Math.round(jsBytes / 1024),
      otherKB: Math.round(otherBytes / 1024),
      fontStart,
      fontEnd
    };
  }, attempt);
}

async function newColdPage(browser: Browser, options: Options): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext(
    options.mobile
      ? {
          viewport: { width: 360, height: 800 },
          deviceScaleFactor: 3,
          isMobile: true,
          hasTouch: true,
          userAgent: MOBILE_UA
        }
      : { viewport: { width: 1280, height: 800 } }
  );
  const page = await context.newPage();
  await instrument(page);
  if (options.mobile) await throttle(page);
  return { context, page };
}

const OPENING_TITLES = [
  '这个世界的雷，先落在凡人屋顶',
  '测灵石上，你的答案是零',
  '修行之前，先弄清一碗饭从哪里来',
  '仙人斗法时，凡人的田先碎了',
  '测得是零，不等于什么都没进来'
] as const;

async function flowToTribulation(page: Page): Promise<void> {
  const override = page.locator('#orientation-override');
  if (await override.isVisible().catch(() => false)) await override.click();
  await page.locator('#flow-title-new-game').click();
  await page.locator('.cr-opening').waitFor();
  for (let beat = 0; beat < OPENING_TITLES.length; beat += 1) {
    await page.locator('.cr-opening__button[data-primary="true"]').click();
  }
  await page.getByRole('button', { name: '查看第一道劫兆' }).click();
  await page.getByRole('button', { name: '记下劫兆，安排修途' }).click();
  await page.locator('.rp-planning').waitFor();
  for (const activity of ['灵田', '苦练', '谋生', '歇息', '灵田', '苦练']) {
    const button = page.getByRole('button', { name: new RegExp(`^${activity}，[0-9]+ 日`) });
    await button.waitFor();
    await button.click();
  }
  await page.getByRole('button', { name: '结清本轮修途' }).click();
  const resolution = page.locator('.cr-resolution');
  await resolution.waitFor();
  await resolution.getByRole('button', { name: '收起竹简，处理本轮事件' }).click();
  const event = page.locator('.cr-event');
  await event.waitFor();
  await event.locator('.cr-event__button[data-affordable="true"]').first().click();
  const insight = page.locator('.cr-insight');
  await insight.waitFor();
  await insight.locator('.cr-insight__continue').click();
  const timing = page.locator('.cr-tribulation-choice');
  await timing.waitFor();
  await timing.getByRole('button', { name: /现在引劫/ }).click();
  await page.locator('.rp-canvas').waitFor();
}

function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length * p) / 100))] ?? 0;
}

async function frameBudget(page: Page): Promise<void> {
  // 以字符串求值：tsx/esbuild 会给具名函数注入 __name helper，浏览器作用域不存在。
  await page.evaluate(`
    (() => {
      const w = window;
      w.__frames = [];
      let last = performance.now();
      const loop = (t) => {
        w.__frames.push(t - last);
        last = t;
        if (w.__frames.length < 6000) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    })()
  `);
  const dpad = page.locator('.rp-dpad');
  await dpad.waitFor();
  for (let i = 0; i < 24; i++) {
    const names = ['向上', '向下', '向左', '向右'];
    await dpad.getByRole('button', { name: names[i % 4]! }).click().catch(() => undefined);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => (window as unknown as { __frames?: number[] }).__frames ?? []);
  const active = frames.filter(d => d < 250);
  const p95 = percentile(active, 95);
  console.log('[frame] 样本:', active.length, {
    p50: Math.round(percentile(active, 50) * 10) / 10,
    p95: Math.round(p95 * 10) / 10,
    max: Math.round(Math.max(...active, 0) * 10) / 10,
    dropped32: active.filter(d => d > 32).length,
    avgFps: active.length > 0 ? Math.round(1000 / (active.reduce((a, b) => a + b, 0) / active.length)) : 0
  });
  console.log('[frame] 判定:', p95 <= 32 ? '✓ 掉帧受控（p95 ≤ 2 次 vsync）' : '✗ p95 超过 32ms，需排查渲染路径');
}

function summarize(label: string, loads: readonly LoadMetrics[]): Record<string, number> {
  const median = (key: keyof LoadMetrics): number => [...loads.map(l => Number(l[key]))].sort((a, b) => a - b)[Math.floor(loads.length / 2)] ?? 0;
  const lcp = median('lcp');
  const cls = median('cls');
  const tbt = median('tbt');
  console.log(`[summary ${label}] 中位:`, JSON.stringify({
    ttfb: median('ttfb'), fcp: median('fcp'), lcp,
    cls, tbt, fontStart: median('fontStart'), fontEnd: median('fontEnd'),
    jsKB: median('jsKB'), otherKB: median('otherKB')
  }));
  const verdict = (ok: boolean, name: string, value: number, good: string): void =>
    console.log(`[summary ${label}] ${ok ? '✓' : '✗ 超阈值'} ${name}=${value}（good ${good}）`);
  verdict(lcp >= 0 && lcp <= 2500, 'LCP', lcp, '≤2500ms');
  verdict(cls <= 0.1, 'CLS', cls, '≤0.1');
  verdict(tbt <= 200, 'TBT(INP 代理)', tbt, '≤200ms');
  return {
    ttfb: median('ttfb'), fcp: median('fcp'), lcp, cls, tbt,
    fontStart: median('fontStart'), fontEnd: median('fontEnd'),
    jsKB: median('jsKB'), otherKB: median('otherKB')
  };
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const label = options.mobile ? '移动+Slow4G' : '桌面';
  console.log(`[perf-audit] ${label} × ${options.loads} 次冷载 → ${options.url}${options.flow ? '（含棋盘帧预算）' : ''}`);
  const browser = await chromium.launch();
  const loads: LoadMetrics[] = [];
  for (let attempt = 1; attempt <= options.loads; attempt++) {
    const { context, page } = await newColdPage(browser, options);
    await page.goto(options.url, { waitUntil: 'load', timeout: 120000 });
    await page.waitForTimeout(3000);
    const metrics = await collectLoad(page, attempt);
    loads.push(metrics);
    console.log(`[cwv] 冷载 ${attempt}:`, JSON.stringify(metrics));
    if (options.flow && attempt === 1) {
      await flowToTribulation(page);
      await frameBudget(page);
    }
    await context.close();
  }
  await browser.close();
  const medians = summarize(label, loads);
  if (options.out) {
    const record = {
      timestamp: new Date().toISOString(),
      profile: options.mobile ? 'mobile-slow4g' : 'desktop',
      url: options.url,
      loadsCount: options.loads,
      medians,
      loads
    };
    const { appendFileSync } = await import('node:fs');
    appendFileSync(options.out, `${JSON.stringify(record)}
`, 'utf8');
    console.log(`[perf-audit] 已追加记录 → ${options.out}`);
  }
}

void main();
