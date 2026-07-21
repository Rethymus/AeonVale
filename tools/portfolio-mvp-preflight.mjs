import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:net';

const keepPublicTree = process.argv.includes('--keep-public-tree');
const includeLivePages = process.argv.includes('--include-live-pages');

const steps = [
  {
    label: 'Audit working tree for secret-risk paths',
    command: 'pnpm',
    args: ['audit:public-worktree', '--', '--fail-on-secret-risk']
  },
  {
    label: 'Audit public candidate content for high-risk leaks',
    command: 'pnpm',
    args: ['audit:public-content', '--', '--fail-on-high-risk']
  },
  {
    label: 'Capture public demo review screenshots and viewport checks',
    command: 'pnpm',
    args: ['portfolio:capture']
  },
  {
    label: 'Verify checked public tree for GitHub Pages',
    command: 'pnpm',
    args: ['verify:public-tree']
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
  { path: 'test-results/portfolio/01-farm-loop.png', width: 1440, height: 810 },
  { path: 'test-results/portfolio/02-location-routing.png', width: 1440, height: 825 },
  { path: 'test-results/portfolio/03-farm-actions.png', width: 1440, height: 810 },
  { path: 'test-results/portfolio/04-mobile-farm-loop.png', width: 736, height: 414 }
];

const portfolioPaintThresholds = { minSampled: 500, minPaintedRatio: 0.55, minColors: 32 };

const portfolioEvidencePath = 'test-results/portfolio/portfolio-mvp-evidence.json';
const todayBriefingProof = ['农庄', '炼丹', '引劫', '首轮进度：10/10'];

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
  if (evidence.runtimeSignals?.onboardingObjectiveId !== 'first-loop-complete') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove the first-loop onboarding objective is complete.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.firstLoopProgress !== '10/10') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove first-loop progress is 10/10.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.selectedLocationId !== 'farmstead') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove the review starts at the farmstead.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.selectedLocationServiceCommand !== 'show-farm-work') {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove the farm-work service is selected.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.shippingBinItemCount !== 2) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove the shipping bin has review output.');
    process.exit(1);
  }
  if (evidence.runtimeSignals?.todayBriefingTitle !== '今日简报' || evidence.runtimeSignals?.todayBriefingHasAsset !== true) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove today briefing is visible with an asset.');
    process.exit(1);
  }
  if (!Array.isArray(evidence.runtimeSignals?.todayBriefingProof) || !todayBriefingProof.every(text => evidence.runtimeSignals.todayBriefingProof.includes(text))) {
    console.error('[portfolio:mvp-preflight] Public demo evidence must prove today briefing body carries the P0 farm, alchemy, tribulation, and 10/10 progress cues.');
    process.exit(1);
  }
  verifyScreenshotEvidence(evidence);
  for (const text of ['《星露谷物语》', '翻地、播种、浇水、过夜、收获、出货、补种', '炼丹', '阵法', '淬体', '主动引劫', '种田即备战', 'remote-action authorization boundary', 'pnpm test:browser:pages']) {
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

if (!keepPublicTree) {
  rmSync('.public-tree', { recursive: true, force: true });
  console.log('\n[portfolio:mvp-preflight] Removed generated .public-tree. Use --keep-public-tree to inspect it after a successful run.');
}

if (includeLivePages) {
  console.log('\n[portfolio:mvp-preflight] Verified current GitHub Pages chain and deployed URL smoke.');
} else {
  console.log(
    '\n[portfolio:mvp-preflight] Skipped live Pages verification. Use --include-live-pages after a maintainer-authorized deployment to verify the remote chain.'
  );
}

console.log('\n[portfolio:mvp-preflight] Public demo preflight passed. No deployment, commit, or push was performed.');
