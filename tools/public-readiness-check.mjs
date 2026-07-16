import { existsSync, readFileSync } from 'node:fs';

const failures = [];

function requireFile(file) {
  if (!existsSync(file)) failures.push(`missing required public readiness file: ${file}`);
}

function requireIncludes(file, text, message) {
  requireFile(file);
  if (!existsSync(file)) return;
  const content = readFileSync(file, 'utf8');
  if (!content.includes(text)) failures.push(message ?? `${file} must include ${text}`);
}

for (const file of ['README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'LICENSE', 'CONTENT-LICENSE.md', 'CHANGELOG.md', '.github/workflows/ci.yml', '.github/workflows/pages.yml', '.github/workflows/release.yml', '.github/pull_request_template.md', 'tools/portfolio-mvp-preflight.mjs', 'tools/public-tree-rules.mjs', 'tools/prepare-public-tree.mjs', 'tools/public-content-audit.mjs', 'tools/public-worktree-audit.mjs', 'tools/portfolio-status.mjs', 'tools/portfolio-release-checklist.mjs', 'tools/portfolio-pages-diagnose.mjs', 'tools/portfolio-pages-watch.mjs', 'tools/publication-check.mjs', 'tools/public-dist-check.mjs']) {
  requireFile(file);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.private !== true) failures.push('package.json must remain private before public repository conversion');
if (packageJson.repository?.url !== 'https://github.com/Rethymus/AeonVale.git') {
  failures.push('package.json repository.url must point at the public GitHub target');
}
for (const script of ['governance:check', 'governance:public', 'governance:dist', 'governance:readiness', 'prepare:public-tree', 'verify:public-tree']) {
  if (typeof packageJson.scripts?.[script] !== 'string') failures.push(`package.json missing required script: ${script}`);
}
if (typeof packageJson.scripts?.['audit:public-worktree'] !== 'string') {
  failures.push('package.json missing required script: audit:public-worktree');
} else if (!packageJson.scripts['audit:public-worktree'].includes('tools/public-worktree-audit.mjs')) {
  failures.push('package.json audit:public-worktree must run the public worktree audit script');
}
if (typeof packageJson.scripts?.['audit:public-content'] !== 'string') {
  failures.push('package.json missing required script: audit:public-content');
} else if (!packageJson.scripts['audit:public-content'].includes('tools/public-content-audit.mjs')) {
  failures.push('package.json audit:public-content must run the public content audit script');
}
if (typeof packageJson.scripts?.['portfolio:capture'] !== 'string') {
  failures.push('package.json missing required script: portfolio:capture');
} else if (!packageJson.scripts['portfolio:capture'].includes('tests/browser/portfolio-capture.spec.ts')) {
  failures.push('package.json portfolio:capture must run the dedicated portfolio capture spec');
}
if (typeof packageJson.scripts?.['portfolio:mvp-preflight'] !== 'string') {
  failures.push('package.json missing required script: portfolio:mvp-preflight');
} else if (!packageJson.scripts['portfolio:mvp-preflight'].includes('tools/portfolio-mvp-preflight.mjs')) {
  failures.push('package.json portfolio:mvp-preflight must run the dedicated preflight script');
}
if (typeof packageJson.scripts?.['portfolio:status'] !== 'string') {
  failures.push('package.json missing required script: portfolio:status');
} else if (!packageJson.scripts['portfolio:status'].includes('tools/portfolio-status.mjs')) {
  failures.push('package.json portfolio:status must run the non-deploying portfolio status script');
}
if (typeof packageJson.scripts?.['portfolio:release-checklist'] !== 'string') {
  failures.push('package.json missing required script: portfolio:release-checklist');
} else if (!packageJson.scripts['portfolio:release-checklist'].includes('tools/portfolio-release-checklist.mjs')) {
  failures.push('package.json portfolio:release-checklist must run the non-deploying release checklist script');
}
if (typeof packageJson.scripts?.['portfolio:pages-diagnose'] !== 'string') {
  failures.push('package.json missing required script: portfolio:pages-diagnose');
} else if (!packageJson.scripts['portfolio:pages-diagnose'].includes('tools/portfolio-pages-diagnose.mjs')) {
  failures.push('package.json portfolio:pages-diagnose must run the non-deploying Pages diagnosis script');
}
if (typeof packageJson.scripts?.['portfolio:pages-watch'] !== 'string') {
  failures.push('package.json missing required script: portfolio:pages-watch');
} else if (!packageJson.scripts['portfolio:pages-watch'].includes('tools/portfolio-pages-watch.mjs')) {
  failures.push('package.json portfolio:pages-watch must run the non-deploying Pages watch script');
}
requireIncludes('tools/portfolio-status.mjs', '不提交、不推送、不部署、不修改 GitHub 设置', 'Portfolio status must be explicitly non-deploying');
requireIncludes('tools/portfolio-status.mjs', 'P0-A 本地可审版本', 'Portfolio status must distinguish local public-demo readiness');
requireIncludes('tools/portfolio-status.mjs', 'P0-B GitHub Pages 公开展示', 'Portfolio status must distinguish deployed GitHub Pages status');
requireIncludes('tools/portfolio-status.mjs', '每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成', 'Portfolio status must keep live Pages verification as the GitHub Pages completion gate');
requireIncludes('tools/portfolio-status.mjs', '《星露谷物语》是长期生活感参照', 'Portfolio status must keep the Stardew comparison scope');
requireIncludes('tools/portfolio-status.mjs', '炼丹、阵法、淬体、主动引劫', 'Portfolio status must preserve the xianxia differentiation scope');
requireIncludes('tools/portfolio-status.mjs', 'P2 Patch / DLC 内容厚度', 'Portfolio status must reserve deeper content expansion for P2');
requireIncludes('tools/portfolio-status.mjs', "process.argv.includes('--json')", 'Portfolio status must expose a machine-readable JSON mode');
requireIncludes('tools/portfolio-status.mjs', "id: 'daily-loop'", 'Portfolio status must include a structured daily-loop comparison dimension');
requireIncludes('tools/portfolio-status.mjs', "id: 'xianxia-differentiation'", 'Portfolio status must include a structured xianxia differentiation dimension');
requireIncludes('tools/portfolio-status.mjs', "id: 'publishability'", 'Portfolio status must include a structured publishability dimension');
requireIncludes('tools/portfolio-status.mjs', 'evidenceArtifacts', 'Portfolio status must expose structured evidence artifacts');
requireIncludes('tools/portfolio-status.mjs', "id: 'public-demo-evidence-json'", 'Portfolio status must include the generated public demo evidence JSON artifact');
requireIncludes('tools/portfolio-status.mjs', "id: 'public-demo-screenshot-set'", 'Portfolio status must include the generated screenshot evidence artifact set');
requireIncludes('tools/portfolio-status.mjs', "id: 'live-pages-smoke'", 'Portfolio status must include the post-deployment live Pages smoke artifact');
requireIncludes('tools/portfolio-status.mjs', 'screenshotEvidence paintedRatio and colors meet thresholds', 'Portfolio status must carry screenshot paint-stat evidence requirements');
requireIncludes('tools/portfolio-status.mjs', 'PLAYWRIGHT_SKIP_WEBSERVER=true smoke test hits the deployed URL', 'Portfolio status must carry deployed Pages smoke evidence requirements');
requireIncludes('tools/portfolio-status.mjs', 'pnpm portfolio:pages-diagnose', 'Portfolio status must route live Pages failures through the non-deploying diagnosis command');
requireIncludes('tools/portfolio-status.mjs', 'pages-redeploy-required', 'Portfolio status must record that live Pages requires deployment and re-verification');
requireIncludes('tools/portfolio-pages-diagnose.mjs', '不提交、不推送、不部署、不修改远端设置', 'Pages diagnosis must be explicitly non-deploying');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'local-head-differs-from-origin-main', 'Pages diagnosis must detect local branch drift from origin/main');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'AbortController', 'Pages diagnosis must bound live Pages fetches with a timeout');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'live-pages-fetch-failed', 'Pages diagnosis must classify network or live Pages fetch failures');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'deployed-bundle-uses-body-append', 'Pages diagnosis must detect deployed stale canvas body append bundles');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'live-canvas-starts-outside-initial-viewport', 'Pages diagnosis must detect live canvas viewport failures');
requireIncludes('tools/portfolio-pages-diagnose.mjs', 'latest-pages-action-not-green', 'Pages diagnosis must include latest GitHub Pages Action status');
requireIncludes('tools/portfolio-pages-diagnose.mjs', "process.argv.includes('--json')", 'Pages diagnosis must expose a machine-readable JSON mode');
requireIncludes('tools/portfolio-pages-watch.mjs', '不提交、不推送、不部署、不修改远端设置', 'Pages watch must be explicitly non-deploying');
requireIncludes('tools/portfolio-pages-watch.mjs', "process.argv.includes('--json')", 'Pages watch must expose a machine-readable JSON mode');
requireIncludes('tools/portfolio-pages-watch.mjs', "process.argv.includes('--wait')", 'Pages watch must expose an explicit bounded wait mode');
requireIncludes('tools/portfolio-pages-watch.mjs', 'AEON_PAGES_WATCH_TIMEOUT_MS', 'Pages watch must bound waiting with a timeout');
requireIncludes('tools/portfolio-pages-watch.mjs', "latestRun('CI')", 'Pages watch must include latest main CI status');
requireIncludes('tools/portfolio-pages-watch.mjs', "latestRun('Deploy GitHub Pages')", 'Pages watch must include latest Pages Action status');
requireIncludes('tools/portfolio-pages-watch.mjs', 'repos/${fullRepo}/pages', 'Pages watch must include GitHub Pages source configuration');
requireIncludes('tools/portfolio-pages-watch.mjs', 'deployments?environment=github-pages', 'Pages watch must include latest github-pages deployment');
requireIncludes('tools/portfolio-pages-watch.mjs', 'deploymentStatuses', 'Pages watch must include deployment status history');
requireIncludes('tools/portfolio-pages-watch.mjs', 'deployed-bundle-uses-body-append', 'Pages watch must detect stale deployed body append bundles');
requireIncludes('tools/portfolio-pages-watch.mjs', 'local-head-differs-from-origin-main', 'Pages watch must detect local branch drift from origin/main');
requireIncludes('tools/portfolio-pages-watch.mjs', 'pages-run-behind-ci', 'Pages watch must detect Pages Action lag behind CI');
requireIncludes('tools/portfolio-pages-watch.mjs', 'deployment-behind-origin-main', 'Pages watch must detect deployments behind origin/main');
requireIncludes('tools/portfolio-pages-watch.mjs', 'gh run watch', 'Pages watch must point short waits to gh run watch without triggering workflows');
requireIncludes('tools/portfolio-pages-watch.mjs', 'remote-pages-chain-current', 'Pages watch must report a settled happy path');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'", 'Public demo preflight must fail on secret-risk worktree paths');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'--fail-on-high-risk'", 'Public demo preflight must fail on high-risk public content findings');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'portfolio:capture'", 'Public demo preflight must run screenshot capture');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'verify:public-tree'", 'Public demo preflight must verify the public tree');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'portfolio:status'", 'Public demo preflight must print the non-deploying portfolio status matrix');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "'portfolio:release-checklist'", 'Public demo preflight must print the non-deploying maintainer release checklist');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "rmSync('test-results/portfolio'", 'Public demo preflight must clear stale review screenshots before capture');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'PLAYWRIGHT_PREVIEW_PORT', 'Public demo preflight must choose and pass a Playwright preview port');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'createServer', 'Public demo preflight must probe for an available preview port');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'test-results/portfolio/01-farm-loop.png', 'Public demo preflight must verify generated farm-loop screenshot output');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'test-results/portfolio/04-mobile-farm-loop.png', 'Public demo preflight must preserve the compatible small-viewport screenshot path');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'test-results/portfolio/portfolio-mvp-evidence.json', 'Public demo preflight must verify generated public demo evidence JSON');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "evidence.runtimeSignals?.onboardingObjectiveId !== 'first-loop-complete'", 'Public demo preflight must verify first-loop completion evidence');
requireIncludes('tools/portfolio-mvp-preflight.mjs', "evidence.runtimeSignals?.firstLoopProgress !== '10/10'", 'Public demo preflight must verify first-loop progress evidence');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'todayBriefingProof', 'Public demo preflight must verify today briefing body proof evidence');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'remote-action authorization boundary', 'Public demo preflight must keep the remote-action authorization boundary in generated evidence');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'screenshotEvidence', 'Public demo preflight must verify screenshot evidence paint stats');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'paintedRatio', 'Public demo preflight must verify screenshot painted ratio evidence');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'minPaintedRatio: 0.55', 'Public demo preflight must preserve the nonblank screenshot paint threshold');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'readUInt32BE(16)', 'Public demo preflight must parse PNG screenshot width');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'readUInt32BE(20)', 'Public demo preflight must parse PNG screenshot height');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'width: 960, height: 542', 'Public demo preflight must verify generated desktop CSS-rendered canvas screenshot dimensions');
requireIncludes('tools/portfolio-mvp-preflight.mjs', 'width: 736, height: 414', 'Public demo preflight must verify generated small-viewport landscape canvas screenshot dimensions');
requireIncludes('tests/browser/openGame.ts', "scale: 'css'", 'Portfolio screenshot helper must capture the CSS-rendered canvas instead of its internal bitmap');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'renderedCanvasPngSnapshot', 'Portfolio screenshot capture must use the CSS-rendered canvas helper');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'setViewportSize({ width: 1440, height: 900 })', 'Portfolio screenshot capture must cover the desktop portfolio viewport');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'setViewportSize({ width: 736, height: 414 })', 'Portfolio screenshot capture must cover the small-viewport landscape keyboard-first viewport');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'expectCanvasFitsViewport(page)', 'Portfolio screenshot capture must prove the canvas fits the small landscape viewport');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'small-viewport landscape keyboard-first', 'Portfolio screenshot capture must not overstate mobile or touch support');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'portfolio-mvp-evidence.json', 'Portfolio screenshot capture must emit the public demo evidence JSON');
requireIncludes('tests/browser/portfolio-capture.spec.ts', "priority: 'P0-A'", 'Public demo evidence must stay scoped to local P0-A review');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'screenshotEvidence', 'Public demo evidence must include screenshot evidence paint stats');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'paintedRatio', 'Public demo evidence must include screenshot painted ratio evidence');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'PORTFOLIO_PAINT_THRESHOLDS', 'Portfolio screenshot capture must preserve explicit paint thresholds');
requireIncludes('tests/browser/portfolio-capture.spec.ts', 'todayBriefingProof', 'Public demo evidence must persist today briefing body proof snippets');
requireIncludes('tests/browser/portfolio-capture.spec.ts', '翻地、播种、浇水、过夜、收获、出货、补种', 'Public demo evidence must preserve the Stardew first-loop comparison');
requireIncludes('tests/browser/portfolio-capture.spec.ts', '炼丹', 'Public demo evidence must include xianxia alchemy differentiation');
requireIncludes('tests/browser/portfolio-capture.spec.ts', '主动引劫', 'Public demo evidence must include active tribulation differentiation');
requireIncludes('tools/portfolio-release-checklist.mjs', '不提交、不推送、不部署、不修改 GitHub 设置', 'Portfolio release checklist must be explicitly non-deploying');
requireIncludes('tools/portfolio-release-checklist.mjs', "process.argv.includes('--json')", 'Portfolio release checklist must expose a machine-readable JSON mode');
requireIncludes('tools/portfolio-release-checklist.mjs', 'requiredEvidence', 'Portfolio release checklist must expose structured required evidence');
requireIncludes('tools/portfolio-release-checklist.mjs', 'authorizationRequired', 'Portfolio release checklist must expose structured maintainer authorization gates');
requireIncludes('tools/portfolio-release-checklist.mjs', 'pnpm portfolio:mvp-preflight -- --keep-public-tree', 'Portfolio release checklist must include local public demo preflight');
requireIncludes('tools/portfolio-release-checklist.mjs', 'pnpm test:browser:pages', 'Portfolio release checklist must include real GitHub Pages smoke');
requireIncludes('tools/portfolio-release-checklist.mjs', 'pnpm portfolio:pages-diagnose', 'Portfolio release checklist must include non-deploying Pages diagnosis before live smoke');
requireIncludes('tools/portfolio-release-checklist.mjs', 'requires re-verification after every deployment and before Public/Release operations', 'Portfolio release checklist must require live Pages re-verification after every deployment');
requireIncludes('tools/portfolio-release-checklist.mjs', 'README.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md', 'Portfolio release checklist must name public governance docs');
requireIncludes('tools/portfolio-release-checklist.mjs', '不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md', 'Portfolio release checklist must preserve private design-document boundaries');
requireIncludes('tools/portfolio-release-checklist.mjs', 'Settings -> Pages 的 Source 设为 GitHub Actions', 'Portfolio release checklist must require maintainer verification of the GitHub Actions Pages source');
requireIncludes('tools/portfolio-release-checklist.mjs', 'ENABLE_PAGES=true 闸门保护', 'Portfolio release checklist must preserve the explicit Pages deployment gate');
requireIncludes('tools/portfolio-release-checklist.mjs', '确认仓库 Homepage 指向', 'Portfolio release checklist must include repository Homepage verification after Pages deployment');
requireIncludes('tools/portfolio-release-checklist.mjs', '《星露谷物语》对照验收', 'Portfolio release checklist must include the Stardew comparison acceptance gate');
requireIncludes('tools/portfolio-release-checklist.mjs', '低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种', 'Portfolio release checklist must verify the low-friction farm loop against Stardew scope');
requireIncludes('tools/portfolio-release-checklist.mjs', '差异化内核：炼丹、阵法、淬体、主动引劫', 'Portfolio release checklist must preserve the xianxia differentiation gate');
requireIncludes('tools/portfolio-release-checklist.mjs', 'Go / No-Go 证据', 'Portfolio release checklist must include go/no-go evidence before maintainer deployment');
requireIncludes('tools/portfolio-release-checklist.mjs', '4 张 test-results/portfolio/*.png 截图为本次生成', 'Portfolio release checklist must require fresh portfolio screenshot evidence');
requireIncludes('tools/portfolio-release-checklist.mjs', 'test-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成', 'Portfolio release checklist must require fresh public demo evidence JSON');
requireIncludes('tools/portfolio-release-checklist.mjs', 'runtimeSignals.todayBriefingProof 包含农庄、炼丹、引劫、首轮进度：10/10', 'Portfolio release checklist must require maintainers to inspect today briefing proof evidence');
requireIncludes('tools/portfolio-release-checklist.mjs', '3 张桌面 CSS 渲染截图为 960x542，1 张横屏小视口 keyboard-first 截图为 736x414', 'Portfolio release checklist must require maintainers to inspect honest CSS-rendered screenshot dimensions');
requireIncludes('tools/portfolio-release-checklist.mjs', 'paintedRatio 达到阈值，colors 达到阈值', 'Portfolio release checklist must require maintainers to inspect screenshot paint stats');
requireIncludes('tools/portfolio-release-checklist.mjs', '该文件仍是生成物，不进入公开树', 'Portfolio release checklist must keep public demo evidence JSON out of the public tree');
requireIncludes('tools/portfolio-release-checklist.mjs', '每次重新部署后，真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 GitHub Pages 闭环完成', 'Portfolio release checklist must keep live Pages verification as the GitHub Pages completion gate');
requireIncludes('tools/portfolio-release-checklist.mjs', '对标范围与优先级复核', 'Portfolio release checklist must include the Stardew/comparison priority review section');
requireIncludes('tools/portfolio-release-checklist.mjs', 'P0 只要求公开试玩版与 GitHub Pages 部署闭环成立', 'Portfolio release checklist must keep P0 scoped to public demo and GitHub Pages deployment');
requireIncludes('tools/portfolio-release-checklist.mjs', 'P1 再推进独立游戏首版的可持续循环', 'Portfolio release checklist must separate P1 indie-game loop work from P0 release readiness');
requireIncludes('tools/portfolio-release-checklist.mjs', 'P2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事', 'Portfolio release checklist must reserve deeper content expansion for P2 patch/DLC work');
requireIncludes('tools/portfolio-release-checklist.mjs', '《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》', 'Portfolio release checklist must preserve xianxia competitor comparison boundaries');
if (typeof packageJson.scripts?.['verify:public-tree'] === 'string') {
  if (!packageJson.scripts['verify:public-tree'].includes('pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts')) {
    failures.push('package.json verify:public-tree must install public-tree dependencies without lifecycle scripts');
  }
  if (!packageJson.scripts['verify:public-tree'].includes('tests/unit/public-dist-check.test.ts')) {
    failures.push('package.json verify:public-tree must run public dist check unit tests');
  }
  if (!packageJson.scripts['verify:public-tree'].includes('tests/unit/public-content-audit.test.ts')) {
    failures.push('package.json verify:public-tree must run public content audit unit tests');
  }
}
if (typeof packageJson.scripts?.['test:browser:smoke'] !== 'string') {
  failures.push('package.json missing required script: test:browser:smoke');
} else if (!packageJson.scripts['test:browser:smoke'].includes('tests/browser/smoke.spec.ts')) {
  failures.push('test:browser:smoke must run only the browser smoke spec');
}
if (typeof packageJson.scripts?.['test:browser:public-tree'] !== 'string') {
  failures.push('package.json missing required script: test:browser:public-tree');
} else {
  const publicBrowserScript = packageJson.scripts['test:browser:public-tree'];
  if (!publicBrowserScript.includes('PLAYWRIGHT_APP_DIR=.public-tree')) failures.push('test:browser:public-tree must run against the public tree');
  if (!publicBrowserScript.includes('PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/')) failures.push('test:browser:public-tree must cover the GitHub Pages route');
  if (!publicBrowserScript.includes('PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/')) failures.push('test:browser:public-tree must build with the GitHub Pages base path');
  if (!publicBrowserScript.includes('pnpm test:browser:smoke') && !publicBrowserScript.includes('tests/browser/smoke.spec.ts')) failures.push('test:browser:public-tree must run only the deployment smoke spec');
}
if (typeof packageJson.scripts?.['test:browser:pages'] !== 'string') {
  failures.push('package.json missing required script: test:browser:pages');
} else {
  const pagesBrowserScript = packageJson.scripts['test:browser:pages'];
  if (!pagesBrowserScript.includes('PLAYWRIGHT_BASE_URL=https://Rethymus.github.io')) failures.push('test:browser:pages must target the GitHub Pages host');
  if (!pagesBrowserScript.includes('PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/')) failures.push('test:browser:pages must cover the GitHub Pages route');
  if (!pagesBrowserScript.includes('PLAYWRIGHT_SKIP_WEBSERVER=true')) failures.push('test:browser:pages must verify the deployed URL without starting local preview');
  if (!pagesBrowserScript.includes('pnpm test:browser:smoke')) failures.push('test:browser:pages must reuse the dedicated browser smoke path');
}
if (typeof packageJson.scripts?.['verify:public-tree'] === 'string' && !packageJson.scripts['verify:public-tree'].includes('pnpm test:browser:public-tree')) {
  failures.push('package.json verify:public-tree must run public-tree browser smoke');
}
if (typeof packageJson.scripts?.['verify:public-tree'] === 'string' && !packageJson.scripts['verify:public-tree'].includes('VITE_BASE_PATH=/AeonVale/')) {
  failures.push('package.json verify:public-tree must build public dist with the GitHub Pages base path');
}

requireIncludes('README.md', 'https://Rethymus.github.io/AeonVale/', 'README.md must name the GitHub Pages target');
requireIncludes('README.md', 'pnpm prepare:public-tree <目标目录>', 'README.md must document the public-tree publication path');
requireIncludes('README.md', 'pnpm verify:public-tree', 'README.md must document the one-command public-tree verification path');
requireIncludes('README.md', 'pnpm audit:public-worktree', 'README.md must document the public worktree audit path');
requireIncludes('README.md', 'pnpm audit:public-content', 'README.md must document the public content audit path');
requireIncludes('README.md', 'pnpm portfolio:mvp-preflight', 'README.md must document the public demo preflight path');
requireIncludes('README.md', '打印非部署发布清单', 'README.md must document that public demo preflight prints the non-deploying release checklist');
requireIncludes('README.md', '维护者发布清单回显', 'README.md must include release-checklist echo in the local MVP preflight evidence');
requireIncludes('README.md', 'pnpm portfolio:status', 'README.md must document the non-deploying portfolio status path');
requireIncludes('README.md', 'pnpm portfolio:status -- --json', 'README.md must document the machine-readable portfolio status path');
requireIncludes('README.md', 'evidenceArtifacts', 'README.md must document the machine-readable portfolio evidence artifact list');
requireIncludes('README.md', 'public-demo-evidence-json', 'README.md must document the public demo evidence JSON artifact id');
requireIncludes('README.md', 'public-demo-screenshot-set', 'README.md must document the public demo screenshot artifact id');
requireIncludes('README.md', 'live-pages-smoke', 'README.md must document the live Pages smoke artifact id');
requireIncludes('README.md', 'pnpm portfolio:release-checklist', 'README.md must document the non-deploying portfolio release checklist path');
requireIncludes('README.md', 'pnpm portfolio:release-checklist -- --json', 'README.md must document the machine-readable portfolio release checklist path');
requireIncludes('README.md', 'requiredEvidence', 'README.md must document the machine-readable release checklist evidence list');
requireIncludes('README.md', 'authorizationRequired', 'README.md must document the machine-readable release checklist authorization gates');
requireIncludes('README.md', 'pnpm portfolio:capture', 'README.md must document the portfolio screenshot capture path');
requireIncludes('README.md', 'pnpm test:browser:smoke', 'README.md must document the dedicated browser smoke path');
requireIncludes('README.md', 'pnpm test:browser:pages', 'README.md must document the deployed GitHub Pages browser smoke path');
requireIncludes('README.md', 'pnpm portfolio:pages-diagnose', 'README.md must document the non-deploying GitHub Pages diagnosis path');
requireIncludes('README.md', '部署漂移、线上旧 bundle、GitHub Action 状态', 'README.md must explain the Pages diagnosis scope');
requireIncludes('README.md', 'pnpm portfolio:pages-watch', 'README.md must document the non-deploying GitHub Pages watch path');
requireIncludes('README.md', 'CI、Pages Action、github-pages deployment、Pages Source 和线上 bundle', 'README.md must explain the Pages watch scope');
requireIncludes('README.md', 'pnpm portfolio:pages-watch -- --wait --json', 'README.md must document the bounded machine-readable Pages watch mode');
requireIncludes('README.md', 'test-results/portfolio/', 'README.md must document the generated portfolio screenshot directory');
requireIncludes('README.md', 'test-results/portfolio/portfolio-mvp-evidence.json', 'README.md must document the generated public demo evidence JSON');
requireIncludes('README.md', 'todayBriefingProof', 'README.md must document the today briefing proof field in generated portfolio evidence');
requireIncludes('README.md', '非空绘制比例、颜色数', 'README.md must document screenshot paint-stat evidence for public demo review');
requireIncludes('README.md', '真实 Pages URL 必须在重新部署后通过 `pnpm test:browser:pages`', 'README.md must document that live Pages needs post-deployment URL smoke');
requireIncludes('README.md', '该目录属于生成物，不进入公开树', 'README.md must keep generated review screenshots out of the public tree');
requireIncludes('README.md', '## 公开优先级', 'README.md must document the public portfolio-MVP priority framing');
requireIncludes('README.md', '### 当前进度快照', 'README.md must document an honest current portfolio-MVP progress snapshot');
requireIncludes('README.md', 'P0-B GitHub Pages 公开展示', 'README.md must distinguish local MVP readiness from deployed GitHub Pages status');
requireIncludes('README.md', '后续若转为 Public、创建 Release 或修改远端设置，仍需要维护者当次明确授权', 'README.md must state that future Public, Release, or remote setting changes require current maintainer authorization');
requireIncludes('README.md', 'P0 公开试玩版与 GitHub Pages 部署', 'README.md must name the public demo and GitHub Pages deployment as the P0 priority');
requireIncludes('README.md', '### 公开试玩验收清单', 'README.md must include the public demo acceptance checklist');
requireIncludes('README.md', '玩家知道今天先做什么', 'README.md must document the player-facing daily-priority acceptance item');
requireIncludes('README.md', 'GitHub Pages 构建不泄露设计资料', 'README.md must document the public deployment leak-prevention acceptance item');
requireIncludes('CONTRIBUTING.md', 'pnpm prepare:public-tree <目标目录>', 'CONTRIBUTING.md must require public-tree based publication');
requireIncludes('CONTRIBUTING.md', '创作设定、玩法细案、路线规划、美术状态等设计资料不得进入公开仓库、Pages 或 Release 产物', 'CONTRIBUTING.md must document private design-document boundaries');

requireIncludes('.github/workflows/ci.yml', 'uses: gitleaks/gitleaks-action@v2', 'CI must include secret scanning');
requireIncludes('.github/workflows/ci.yml', 'pnpm governance:readiness', 'CI must run private-tree readiness checks');
requireIncludes('.github/workflows/ci.yml', 'pnpm prepare:public-tree .public-tree', 'CI must prepare the public tree');
requireIncludes('.github/workflows/ci.yml', 'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts', 'CI must install public-tree dependencies without lifecycle scripts');
requireIncludes('.github/workflows/ci.yml', 'pnpm --dir .public-tree governance:readiness', 'CI must run public-tree readiness checks');
requireIncludes('.github/workflows/ci.yml', 'PLAYWRIGHT_APP_DIR: .public-tree', 'CI browser smoke must run against the public tree');
requireIncludes('.github/workflows/ci.yml', 'PLAYWRIGHT_GAME_BASE_PATH: /AeonVale/', 'CI browser smoke must cover the GitHub Pages route');
requireIncludes('.github/workflows/ci.yml', 'VITE_BASE_PATH: /AeonVale/', 'CI public-tree build must use the GitHub Pages base path');
requireIncludes('.github/workflows/ci.yml', 'pnpm test:browser:public-tree', 'CI browser smoke must reuse the public-tree deployment smoke script');
requireIncludes('.github/workflows/ci.yml', 'aeonvale-pages-dist-${{ github.sha }}', 'CI must upload the CI-verified Pages dist artifact for deployment reuse');
requireIncludes('.github/workflows/ci.yml', 'include-hidden-files: true', 'CI Pages dist artifact must preserve .nojekyll and other hidden deployment files');

requireIncludes('.github/workflows/pages.yml', "vars.ENABLE_PAGES == 'true'", 'Pages deployment must stay behind an explicit repository variable');
requireIncludes('.github/workflows/pages.yml', 'actions: read', 'Pages deployment must be allowed to download the triggering CI artifact');
requireIncludes('.github/workflows/pages.yml', "github.event_name == 'workflow_dispatch' &&", 'Manual Pages deployment must be scoped to main');
requireIncludes('.github/workflows/pages.yml', "github.ref == 'refs/heads/main'", 'Manual Pages deployment must be scoped to main');
requireIncludes('.github/workflows/pages.yml', 'ref: ${{ github.event.workflow_run.head_sha || github.sha }}', 'Pages deployment must checkout the CI-verified commit');
requireIncludes('.github/workflows/pages.yml', 'VITE_BASE_PATH: /AeonVale/', 'Pages build must use the repository subpath base');
requireIncludes('.github/workflows/pages.yml', 'actions/download-artifact@v4', 'Pages deployment must reuse the CI-verified dist artifact on workflow_run');
requireIncludes('.github/workflows/pages.yml', 'aeonvale-pages-dist-${{ github.event.workflow_run.head_sha }}', 'Pages deployment must download the dist artifact matching the CI head SHA');
requireIncludes('.github/workflows/pages.yml', 'run-id: ${{ github.event.workflow_run.id }}', 'Pages deployment must download the artifact from the triggering CI run');
requireIncludes('.github/workflows/pages.yml', 'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts', 'Pages deployment must install public-tree dependencies without lifecycle scripts');
requireIncludes('.github/workflows/pages.yml', 'pnpm --dir .public-tree governance:readiness', 'Pages deployment must run public readiness checks');
requireIncludes('.github/workflows/pages.yml', 'pnpm test:browser:public-tree', 'Pages deployment must run public-tree browser smoke before upload');
requireIncludes('.github/workflows/pages.yml', 'run: pnpm governance:dist', 'Pages deployment must re-check the exact dist directory before upload');
requireIncludes('.github/workflows/pages.yml', 'path: dist', 'Pages deployment must upload only the checked public dist artifact');
requireIncludes('.github/workflows/pages.yml', 'Install Chromium for deployed Pages smoke', 'Pages deployment must install Chromium before deployed URL smoke');
requireIncludes('.github/workflows/pages.yml', 'pnpm test:browser:pages', 'Pages deployment must smoke test the deployed GitHub Pages URL');

requireIncludes('.github/workflows/release.yml', 'workflow_dispatch:', 'Release workflow must remain manually triggered');
requireIncludes('.github/workflows/release.yml', "if: github.ref == 'refs/heads/main'", 'Release workflow must remain main-only');
requireIncludes('.github/workflows/release.yml', 'pnpm governance:readiness', 'Release workflow must run private-tree readiness checks');
requireIncludes('.github/workflows/release.yml', 'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts', 'Release workflow must install public-tree dependencies without lifecycle scripts');
requireIncludes('.github/workflows/release.yml', 'pnpm --dir .public-tree governance:readiness', 'Release workflow must run public-tree readiness checks');
requireIncludes('.github/workflows/release.yml', 'pnpm --dir .public-tree governance:public', 'Release workflow must check the public tree');
requireIncludes('.github/workflows/release.yml', 'pnpm --dir .public-tree test tests/unit/github-workflows.test.ts tests/unit/public-readiness-check.test.ts tests/unit/publication-check.test.ts tests/unit/prepare-public-tree.test.ts tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts', 'Release workflow must run public-tree publication guardrail unit tests');
requireIncludes('.github/workflows/release.yml', 'cd .public-tree/dist && zip', 'Release zip must be built only from public dist');

for (const ignorePattern of ['.public-tree/', 'dist/', 'playwright-report/', 'test-results/', '.claude/', '.omc/', '.codex/', '.agents/']) {
  requireIncludes('.gitignore', ignorePattern, `.gitignore must ignore ${ignorePattern}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Public readiness check passed (governance docs, workflows, public-tree scripts, and ignore rules are present).');
