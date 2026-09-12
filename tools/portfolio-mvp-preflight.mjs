import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';

const includeLivePages = process.argv.includes('--include-live-pages');

const steps = [
  {
    label: 'Capture public demo review screenshots and viewport checks',
    command: 'pnpm',
    args: ['portfolio:capture']
  },
  {
    label: 'Verify release readiness of the repository root',
    command: 'pnpm',
    args: ['governance:readiness']
  },
  {
    label: 'Print non-deploying portfolio status matrix',
    command: 'pnpm',
    args: ['portfolio:status']
  },
  {
    label: 'Print non-deploying portfolio release checklist',
    command: 'pnpm',
    args: ['portfolio:release-checklist']
  }
];

if (includeLivePages) {
  steps.push(
    {
      label: 'Verify current GitHub Pages chain without deploying',
      command: 'pnpm',
      args: ['portfolio:pages-watch', '--', '--wait', '--json']
    },
    {
      label: 'Smoke current deployed GitHub Pages URL',
      command: 'pnpm',
      args: ['test:browser:pages']
    }
  );
}

const portfolioScreenshots = [
  { path: 'test-results/portfolio/01-prep-workbench.png', width: 1440, height: 810 },
  { path: 'test-results/portfolio/02-tribulation-board.png', width: 1440, height: 810 },
  { path: 'test-results/portfolio/03-life-event.png', width: 1440, height: 810 },
  { path: 'test-results/portfolio/04-compact-prep.png', width: 736, height: 414 }
];

const portfolioPaintThresholds = { minSampled: 500, minPaintedRatio: 0.5, minColors: 24 };

const portfolioEvidencePath = 'test-results/portfolio/portfolio-mvp-evidence.json';
const runtimeSignalProof = ['劫前修途', '认证', '引劫'];

function pngDimensions(file) {
  const data = readFileSync(file);
  const signature = '89504e470d0a1a0a';
  if (data.length < 24 || data.subarray(0, 8).toString('hex') !== signature || data.subarray(12, 16).toString('ascii') !== 'IHDR') {
    return null;
  }
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

async function canUsePort(port) {
  return new Promise(resolve => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

async function choosePreviewPort() {
  const requested = Number.parseInt(process.env.PLAYWRIGHT_PREVIEW_PORT ?? '', 10);
  if (Number.isInteger(requested) && requested > 0 && (await canUsePort(requested))) return String(requested);
  for (let port = 4174; port <= 4199; port += 1) {
    if (await canUsePort(port)) return String(port);
  }
  console.error('[portfolio:mvp-preflight] No available Playwright preview port in 4174-4199.');
  process.exit(1);
}

function cleanPortfolioScreenshots() {
  rmSync('test-results/portfolio', { recursive: true, force: true });
  console.log('\n[portfolio:mvp-preflight] Cleared previous public demo review screenshots.');
}

function requireEvidenceText(content, text) {
  if (!content.includes(text)) {
    console.error(`[portfolio:mvp-preflight] Public demo evidence is missing required text: ${text}`);
    process.exit(1);
  }
}

function verifyScreenshotEvidence(evidence) {
  if (!Array.isArray(evidence.screenshotEvidence)) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must include screenshotEvidence paint stats.');
    process.exit(1);
  }
  for (const screenshot of portfolioScreenshots) {
    const entry = evidence.screenshotEvidence.find(item => item?.path === screenshot.path);
    if (!entry) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence is missing screenshot stats for ${screenshot.path}.`);
      process.exit(1);
    }
    if (entry.width !== screenshot.width || entry.height !== screenshot.height) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence screenshot stats have unexpected dimensions for ${screenshot.path}: expected ${screenshot.width}x${screenshot.height}, got ${entry.width}x${entry.height}.`);
      process.exit(1);
    }
    if (entry.thresholds?.minSampled !== portfolioPaintThresholds.minSampled || entry.thresholds?.minPaintedRatio !== portfolioPaintThresholds.minPaintedRatio || entry.thresholds?.minColors !== portfolioPaintThresholds.minColors) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence screenshot stats must record the paint thresholds for ${screenshot.path}.`);
      process.exit(1);
    }
    if (entry.paintStats?.sampled <= portfolioPaintThresholds.minSampled) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence screenshot stats have too few sampled pixels for ${screenshot.path}.`);
      process.exit(1);
    }
    if (entry.paintStats?.paintedRatio <= portfolioPaintThresholds.minPaintedRatio) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence screenshot stats are too blank for ${screenshot.path}.`);
      process.exit(1);
    }
    if (entry.paintStats?.colors <= portfolioPaintThresholds.minColors) {
      console.error(`[portfolio:mvp-preflight] Public demo evidence screenshot stats have too few colors for ${screenshot.path}.`);
      process.exit(1);
    }
  }
}

function verifyPortfolioEvidence() {
  if (!existsSync(portfolioEvidencePath) || statSync(portfolioEvidencePath).size === 0) {
    console.error(`[portfolio:mvp-preflight] Missing generated public demo evidence: ${portfolioEvidencePath}`);
    process.exit(1);
  }
  const content = readFileSync(portfolioEvidencePath, 'utf8');
  let evidence;
  try {
    evidence = JSON.parse(content);
  } catch {
    console.error(`[portfolio:mvp-preflight] Public demo evidence is not valid JSON: ${portfolioEvidencePath}`);
    process.exit(1);
  }
  if (evidence.generatedBy !== 'portfolio:capture') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must be generated by portfolio:capture.');
    process.exit(1);
  }
  if (evidence.priority !== 'P0-A') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must remain scoped to P0-A local review.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.appSurface !== 'roguelite-proto') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must be captured on the roguelite main mode.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.agendaSlotCount !== 6) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove the six-slot agenda is visible.');
    process.exit(1);
  }
  if (!/认证 [0-9]+ 步 · 余量 [0-9]+/.test(evidence.runtimeSignals?.hudCertificate ?? '')) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must carry the certified-moves HUD certificate.');
    process.exit(1);
  }
  if (!(evidence.runtimeSignals?.hudIntel ?? '').match(/劫兆未明|存活上限|安全雷威|甜蜜雷威/)) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must carry a tribulation intel HUD line.');
    process.exit(1);
  }
  if (!Array.isArray(evidence.runtimeSignals?.runtimeProof) || !runtimeSignalProof.every(text => evidence.runtimeSignals.runtimeProof.includes(text))) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must carry the prep/certification/tribulation runtime cues.');
    process.exit(1);
  }
  verifyScreenshotEvidence(evidence);
  for (const text of ['生活模拟', '排程→事件→参悟→引劫', '排程备劫', '残卷参悟', '主动引劫', '劫灰传承', 'remote-action authorization boundary', 'pnpm test:browser:pages']) {
    requireEvidenceText(content, text);
  }
}

function runStep(step, env) {
  console.log(`\n[portfolio:mvp-preflight] ${step.label}`);
  const result = spawnSync(step.command, step.args, { env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) {
    console.error(`[portfolio:mvp-preflight] Failed to start ${step.command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const previewPort = await choosePreviewPort();
const childEnv = { ...process.env, PLAYWRIGHT_PREVIEW_PORT: previewPort };
console.log(`\n[portfolio:mvp-preflight] Using Playwright preview port ${previewPort}.`);

for (const step of steps) {
  if (step.args.includes('portfolio:capture')) cleanPortfolioScreenshots();
  runStep(step, childEnv);
}

for (const screenshot of portfolioScreenshots) {
  if (!existsSync(screenshot.path) || statSync(screenshot.path).size === 0) {
    console.error(`[portfolio:mvp-preflight] Missing generated portfolio screenshot: ${screenshot.path}`);
    process.exit(1);
  }
  const dimensions = pngDimensions(screenshot.path);
  if (!dimensions) {
    console.error(`[portfolio:mvp-preflight] Portfolio screenshot is not a readable PNG: ${screenshot.path}`);
    process.exit(1);
  }
  if (dimensions.width !== screenshot.width || dimensions.height !== screenshot.height) {
    console.error(`[portfolio:mvp-preflight] Portfolio screenshot has unexpected dimensions: ${screenshot.path} expected ${screenshot.width}x${screenshot.height}, got ${dimensions.width}x${dimensions.height}`);
    process.exit(1);
  }
}

console.log(`\n[portfolio:mvp-preflight] Verified ${portfolioScreenshots.length} generated public demo review screenshots.`);

verifyPortfolioEvidence();
console.log(`\n[portfolio:mvp-preflight] Verified generated public demo evidence: ${portfolioEvidencePath}.`);

if (includeLivePages) {
  console.log('\n[portfolio:mvp-preflight] Verified current GitHub Pages chain and deployed URL smoke.');
} else {
  console.log(
    '\n[portfolio:mvp-preflight] Skipped live Pages verification. Use --include-live-pages after a maintainer-authorized deployment to verify the remote chain.'
  );
}

console.log('\n[portfolio:mvp-preflight] Public demo preflight passed. No deployment, commit, or push was performed.');
