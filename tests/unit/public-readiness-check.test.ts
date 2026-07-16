import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const script = resolve('tools/public-readiness-check.mjs');
const temps: string[] = [];

function write(root: string, file: string, text: string): void {
  const target = join(root, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function makeReadyRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'aeonvale-readiness-'));
  temps.push(dir);
  mkdirSync(join(dir, 'tools'), { recursive: true });
  cpSync(script, join(dir, 'tools/public-readiness-check.mjs'));

write(dir, 'README.md', 'https://Rethymus.github.io/AeonVale/\npnpm prepare:public-tree <目标目录>\npnpm verify:public-tree\npnpm audit:public-worktree\npnpm audit:public-content\npnpm portfolio:mvp-preflight\n打印非部署发布清单\n维护者发布清单回显\npnpm portfolio:status\npnpm portfolio:status -- --json\nevidenceArtifacts\npublic-demo-evidence-json\npublic-demo-screenshot-set\nlive-pages-smoke\npnpm portfolio:release-checklist\npnpm portfolio:release-checklist -- --json\nrequiredEvidence\nauthorizationRequired\npnpm portfolio:capture\npnpm test:browser:smoke\npnpm test:browser:pages\npnpm portfolio:pages-diagnose\n部署漂移、线上旧 bundle、GitHub Action 状态\npnpm portfolio:pages-watch\nCI、Pages Action、github-pages deployment、Pages Source 和线上 bundle\npnpm portfolio:pages-watch -- --wait --json\ntest-results/portfolio/\ntest-results/portfolio/portfolio-mvp-evidence.json\ntodayBriefingProof\n修行接力\n非空绘制比例、颜色数\n真实 Pages URL 必须在重新部署后通过 `pnpm test:browser:pages`\n该目录属于生成物，不进入公开树\n## 公开优先级\n### 当前进度快照\nP0-B GitHub Pages 公开展示\n后续若转为 Public、创建 Release 或修改远端设置，仍需要维护者当次明确授权\nP0 公开试玩版与 GitHub Pages 部署\n### 公开试玩验收清单\n玩家知道今天先做什么\nGitHub Pages 构建不泄露设计资料\n');
  write(dir, 'CONTRIBUTING.md', 'pnpm prepare:public-tree <目标目录>\n创作设定、玩法细案、路线规划、美术状态等设计资料不得进入公开仓库、Pages 或 Release 产物\n');
  write(dir, 'SECURITY.md', '# Security\n');
  write(dir, 'LICENSE', 'MIT\n');
  write(dir, 'CONTENT-LICENSE.md', '# Content License\n');
  write(dir, 'CHANGELOG.md', '# Changelog\n');
  write(dir, '.github/pull_request_template.md', '# PR\n');
  write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:status'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\n'test-results/portfolio/portfolio-mvp-evidence.json'\nevidence.runtimeSignals?.onboardingObjectiveId !== 'first-loop-complete'\nevidence.runtimeSignals?.firstLoopProgress !== '10/10'\ntodayBriefingProof\nremote-action authorization boundary\nscreenshotEvidence\npaintedRatio\nminPaintedRatio: 0.55\nreadUInt32BE(16)\nreadUInt32BE(20)\nwidth: 960, height: 540\n");
  write(dir, 'tests/browser/portfolio-capture.spec.ts', "setViewportSize({ width: 1440, height: 900 })\nsetViewportSize({ width: 390, height: 844 })\nexpectCanvasFitsViewport(page)\nportfolio-mvp-evidence.json\npriority: 'P0-A'\nscreenshotEvidence\npaintedRatio\nPORTFOLIO_PAINT_THRESHOLDS\ntodayBriefingProof\n翻地、播种、浇水、过夜、收获、出货、补种\n炼丹\n主动引劫\n");
  write(dir, 'tools/public-tree-rules.mjs', 'export const ok = true;\n');
  write(dir, 'tools/prepare-public-tree.mjs', 'console.log("prepare");\n');
  write(dir, 'tools/public-content-audit.mjs', 'console.log("content audit");\n');
  write(dir, 'tools/public-worktree-audit.mjs', 'console.log("audit");\n');
  write(dir, 'tools/portfolio-status.mjs', "process.argv.includes('--json')\nid: 'daily-loop'\nid: 'xianxia-differentiation'\nid: 'publishability'\nevidenceArtifacts\nid: 'public-demo-evidence-json'\nid: 'public-demo-screenshot-set'\nid: 'live-pages-smoke'\nscreenshotEvidence paintedRatio and colors meet thresholds\nPLAYWRIGHT_SKIP_WEBSERVER=true smoke test hits the deployed URL\npnpm portfolio:pages-diagnose\npages-redeploy-required\n不提交、不推送、不部署、不修改 GitHub 设置\nP0-A 本地可审版本\nP0-B GitHub Pages 公开展示\n每次重新部署后，真实 Pages URL 未通过 pnpm test:browser:pages 前，不宣称 GitHub Pages 闭环完成\n《星露谷物语》是长期生活感参照\n炼丹、阵法、淬体、主动引劫\nP2 Patch / DLC 内容厚度\n");
  write(dir, 'tools/portfolio-pages-diagnose.mjs', "process.argv.includes('--json')\n不提交、不推送、不部署、不修改远端设置\nlocal-head-differs-from-origin-main\nAbortController\nlive-pages-fetch-failed\ndeployed-bundle-uses-body-append\nlive-canvas-starts-outside-initial-viewport\nlatest-pages-action-not-green\n");
  write(dir, 'tools/portfolio-pages-watch.mjs', "process.argv.includes('--json')\nprocess.argv.includes('--wait')\n不提交、不推送、不部署、不修改远端设置\nAEON_PAGES_WATCH_TIMEOUT_MS\nlatestRun('CI')\nlatestRun('Deploy GitHub Pages')\nrepos/${fullRepo}/pages\ndeployments?environment=github-pages\ndeploymentStatuses\ndeployed-bundle-uses-body-append\nlocal-head-differs-from-origin-main\npages-run-behind-ci\ndeployment-behind-origin-main\ngh run watch\nremote-pages-chain-current\n");
  write(dir, 'tools/portfolio-release-checklist.mjs', "process.argv.includes('--json')\nrequiredEvidence\nauthorizationRequired\nrequires re-verification after every deployment and before Public/Release operations\n不提交、不推送、不部署、不修改 GitHub 设置\npnpm portfolio:mvp-preflight -- --keep-public-tree\npnpm portfolio:pages-diagnose\npnpm test:browser:pages\nREADME.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md\n不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md\nSettings -> Pages 的 Source 设为 GitHub Actions\nENABLE_PAGES=true 闸门保护\n确认仓库 Homepage 指向\n《星露谷物语》对照验收\n低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种\n差异化内核：炼丹、阵法、淬体、主动引劫\nGo / No-Go 证据\n4 张 test-results/portfolio/*.png 截图为本次生成\ntest-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成\nruntimeSignals.todayBriefingProof 包含农庄、炼丹、引劫、首轮进度：10/10、修行接力\nscreenshotEvidence：4 张截图尺寸均为 960x540\npaintedRatio 达到阈值，colors 达到阈值\n该文件仍是生成物，不进入公开树\n每次重新部署后，真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 GitHub Pages 闭环完成\n对标范围与优先级复核\nP0 只要求公开试玩版与 GitHub Pages 部署闭环成立\nP1 再推进独立游戏首版的可持续循环\nP2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事\n《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》\n");
  write(dir, 'tools/publication-check.mjs', 'console.log("public");\n');
  write(dir, 'tools/public-dist-check.mjs', 'console.log("dist");\n');
  write(dir, '.github/workflows/ci.yml', [
    'uses: gitleaks/gitleaks-action@v2',
    'pnpm governance:readiness',
    'pnpm prepare:public-tree .public-tree',
    'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
    'pnpm --dir .public-tree governance:readiness',
    'pnpm test:browser:public-tree',
    'PLAYWRIGHT_APP_DIR: .public-tree',
    'PLAYWRIGHT_GAME_BASE_PATH: /AeonVale/',
    'VITE_BASE_PATH: /AeonVale/',
    'aeonvale-pages-dist-${{ github.sha }}',
    'include-hidden-files: true',
  ].join('\n'));
  write(dir, '.github/workflows/pages.yml', [
    "vars.ENABLE_PAGES == 'true'",
    "github.event_name == 'workflow_dispatch' &&",
    "github.ref == 'refs/heads/main'",
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    'github.event.workflow_run.head_repository.full_name == github.repository',
    'actions: read',
    'ref: ${{ github.event.workflow_run.head_sha || github.sha }}',
    'VITE_BASE_PATH: /AeonVale/',
    'actions/download-artifact@v4',
    'aeonvale-pages-dist-${{ github.event.workflow_run.head_sha }}',
    'run-id: ${{ github.event.workflow_run.id }}',
    'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
    'pnpm --dir .public-tree governance:readiness',
    'pnpm test:browser:public-tree',
    'run: pnpm governance:dist',
    'path: dist',
    'Install Chromium for deployed Pages smoke',
    'pnpm test:browser:pages',
  ].join('\n'));
  write(dir, '.github/workflows/release.yml', [
    'workflow_dispatch:',
    "if: github.ref == 'refs/heads/main'",
    'pnpm governance:readiness',
    'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
    'pnpm --dir .public-tree governance:readiness',
    'pnpm --dir .public-tree governance:public',
    'pnpm --dir .public-tree test tests/unit/github-workflows.test.ts tests/unit/public-readiness-check.test.ts tests/unit/publication-check.test.ts tests/unit/prepare-public-tree.test.ts tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts',
    'cd .public-tree/dist && zip',
  ].join('\n'));
  write(dir, '.gitignore', ['.public-tree/', 'dist/', 'playwright-report/', 'test-results/', '.claude/', '.omc/', '.codex/', '.agents/'].join('\n'));
  write(dir, 'package.json', JSON.stringify({
    private: true,
    repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
    scripts: {
      'governance:check': 'node tools/governance-check.mjs',
      'governance:public': 'node tools/publication-check.mjs',
      'governance:dist': 'node tools/public-dist-check.mjs',
      'governance:readiness': 'node tools/public-readiness-check.mjs',
      'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
      'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
      'audit:public-content': 'node tools/public-content-audit.mjs',
      'portfolio:status': 'node tools/portfolio-status.mjs',
      'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
      'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
      'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
      'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
      'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
      'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
      'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
    },
  }));

return dir;
}

function runReadinessCheck(cwd: string): string {
  return execFileSync('node', ['tools/public-readiness-check.mjs'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

afterEach(() => {
  for (const dir of temps.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('公开发布 readiness 检查', () => {
  it('通过具备治理文档、workflow、公开树脚本和 ignore 规则的仓库', () => {
    const dir = makeReadyRepo();
    expect(runReadinessCheck(dir)).toContain('Public readiness check passed');
  });

it('拒绝缺少公开树发布路径说明的 README', () => {
    const dir = makeReadyRepo();
    write(dir, 'README.md', 'https://Rethymus.github.io/AeonVale/\n');

expect(() => runReadinessCheck(dir)).toThrow(/README\.md must document the public-tree publication path/);
  });

it('拒绝没有 Pages 子路径 smoke 覆盖的 CI', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/ci.yml', 'uses: gitleaks/gitleaks-action@v2\npnpm governance:readiness\npnpm prepare:public-tree .public-tree\npnpm --dir .public-tree install --frozen-lockfile --ignore-scripts\npnpm --dir .public-tree governance:readiness\nPLAYWRIGHT_APP_DIR: .public-tree\nVITE_BASE_PATH: /AeonVale/\n');

expect(() => runReadinessCheck(dir)).toThrow(/CI browser smoke must cover the GitHub Pages route/);
  });

it('拒绝 CI 公开树构建偏离 GitHub Pages 子路径', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/ci.yml', [
      'uses: gitleaks/gitleaks-action@v2',
      'pnpm governance:readiness',
      'pnpm prepare:public-tree .public-tree',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'PLAYWRIGHT_APP_DIR: .public-tree',
      'PLAYWRIGHT_GAME_BASE_PATH: /AeonVale/',
      'VITE_BASE_PATH: ./',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/CI public-tree build must use the GitHub Pages base path/);
  });

it('拒绝 CI 浏览器 smoke 未复用 public-tree 部署 smoke 脚本', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/ci.yml', [
      'uses: gitleaks/gitleaks-action@v2',
      'pnpm governance:readiness',
      'pnpm prepare:public-tree .public-tree',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'PLAYWRIGHT_APP_DIR: .public-tree',
      'PLAYWRIGHT_GAME_BASE_PATH: /AeonVale/',
      'VITE_BASE_PATH: /AeonVale/',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/CI browser smoke must reuse the public-tree deployment smoke script/);
  });

it('拒绝一键公开验收运行 public-tree 依赖脚本', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/verify:public-tree must install public-tree dependencies without lifecycle scripts/);
  });

it('拒绝没有 Pages 部署 smoke 覆盖的 workflow', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/pages.yml', [
      "vars.ENABLE_PAGES == 'true'",
      'ref: ${{ github.event.workflow_run.head_sha || github.sha }}',
      'VITE_BASE_PATH: /AeonVale/',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'pnpm --dir .public-tree governance:dist',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/Pages deployment must run public-tree browser smoke before upload/);
  });

it('拒绝 Pages 上传未经公开树检查的产物目录', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/pages.yml', [
      "vars.ENABLE_PAGES == 'true'",
      "github.event_name == 'workflow_dispatch' &&",
      "github.ref == 'refs/heads/main'",
      "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.event == 'push'",
      "github.event.workflow_run.head_branch == 'main'",
      'github.event.workflow_run.head_repository.full_name == github.repository',
      'actions: read',
      'ref: ${{ github.event.workflow_run.head_sha || github.sha }}',
      'VITE_BASE_PATH: /AeonVale/',
      'actions/download-artifact@v4',
      'aeonvale-pages-dist-${{ github.event.workflow_run.head_sha }}',
      'run-id: ${{ github.event.workflow_run.id }}',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'pnpm test:browser:public-tree',
      'run: pnpm governance:dist',
      'path: .public-tree/dist',
      'Install Chromium for deployed Pages smoke',
      'pnpm test:browser:pages',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/Pages deployment must upload only the checked public dist artifact/);
  });

it('拒绝 Pages 部署后没有验证真实 URL 的 workflow', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/pages.yml', [
      "vars.ENABLE_PAGES == 'true'",
      'ref: ${{ github.event.workflow_run.head_sha || github.sha }}',
      'VITE_BASE_PATH: /AeonVale/',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'pnpm --dir .public-tree governance:dist',
      'pnpm test:browser:public-tree',
      'path: .public-tree/dist',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/Pages deployment must smoke test the deployed GitHub Pages URL/);
  });

it('拒绝 Release 跳过公开树发布门禁单测', () => {
    const dir = makeReadyRepo();
    write(dir, '.github/workflows/release.yml', [
      'workflow_dispatch:',
      "if: github.ref == 'refs/heads/main'",
      'pnpm governance:readiness',
      'pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts',
      'pnpm --dir .public-tree governance:readiness',
      'pnpm --dir .public-tree governance:public',
      'cd .public-tree/dist && zip',
    ].join('\n'));

expect(() => runReadinessCheck(dir)).toThrow(/Release workflow must run public-tree publication guardrail unit tests/);
  });

it('拒绝未在一键公开验收中运行 dist 检查单测的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/verify:public-tree must run public dist check unit tests/);
  });

it('拒绝未在一键公开验收中运行 public-tree 浏览器 smoke 的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/verify:public-tree must run public-tree browser smoke/);
  });

it('拒绝 public-tree 浏览器 smoke 未覆盖 Pages 子路径的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree pnpm test:browser',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/test:browser:public-tree must cover the GitHub Pages route/);
  });

it('拒绝 public-tree 浏览器 smoke 泛跑全量浏览器测试的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/test:browser:public-tree must run only the deployment smoke spec/);
  });

it('拒绝缺少试玩截图验收脚本的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/missing required script: portfolio:capture/);
  });

it('拒绝审核截图验收脚本未运行专用规格的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'pnpm test:browser',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'test:browser:pages': 'PLAYWRIGHT_BASE_URL=https://Rethymus.github.io PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_SKIP_WEBSERVER=true pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/portfolio:capture must run the dedicated portfolio capture spec/);
  });

it('拒绝发布预检跳过公开树验证', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must verify the public tree/);
  });

it('拒绝发布预检跳过高风险内容审查', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must fail on high-risk public content findings/);
  });

it('拒绝发布预检跳过状态矩阵回显', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\nreadUInt32BE(16)\nreadUInt32BE(20)\nwidth: 960, height: 540\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must print the non-deploying portfolio status matrix/);
  });

it('拒绝发布预检不清理旧截图产物', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:status'\n'portfolio:release-checklist'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must clear stale review screenshots before capture/);
  });

it('拒绝发布预检不探测空闲浏览器预览端口', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:status'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\n'test-results/portfolio/01-farm-loop.png'\n'test-results/portfolio/04-mobile-farm-loop.png'\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must choose and pass a Playwright preview port/);
  });

it('拒绝发布预检不确认截图产物留存', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-mvp-preflight.mjs', "'--fail-on-secret-risk'\n'--fail-on-high-risk'\n'portfolio:capture'\n'verify:public-tree'\n'portfolio:status'\n'portfolio:release-checklist'\nrmSync('test-results/portfolio'\nPLAYWRIGHT_PREVIEW_PORT\ncreateServer\n");

expect(() => runReadinessCheck(dir)).toThrow(/Public demo preflight must verify generated farm-loop screenshot output/);
  });

it('拒绝缺少专用浏览器 smoke 脚本的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm exec playwright test tests/browser/smoke.spec.ts',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/missing required script: test:browser:smoke/);
  });

it('拒绝缺少真实 GitHub Pages 浏览器 smoke 脚本的配置', () => {
    const dir = makeReadyRepo();
    write(dir, 'package.json', JSON.stringify({
      private: true,
      repository: { url: 'https://github.com/Rethymus/AeonVale.git' },
      scripts: {
        'governance:check': 'node tools/governance-check.mjs',
        'governance:public': 'node tools/publication-check.mjs',
        'governance:dist': 'node tools/public-dist-check.mjs',
        'governance:readiness': 'node tools/public-readiness-check.mjs',
        'prepare:public-tree': 'node tools/prepare-public-tree.mjs',
        'audit:public-worktree': 'node tools/public-worktree-audit.mjs',
        'audit:public-content': 'node tools/public-content-audit.mjs',
        'portfolio:status': 'node tools/portfolio-status.mjs',
        'portfolio:release-checklist': 'node tools/portfolio-release-checklist.mjs',
        'portfolio:pages-diagnose': 'node tools/portfolio-pages-diagnose.mjs',
        'portfolio:pages-watch': 'node tools/portfolio-pages-watch.mjs',
        'portfolio:mvp-preflight': 'node tools/portfolio-mvp-preflight.mjs',
        'portfolio:capture': 'node node_modules/@playwright/test/cli.js test tests/browser/portfolio-capture.spec.ts --reporter=line',
        'test:browser:smoke': 'node node_modules/@playwright/test/cli.js test tests/browser/smoke.spec.ts',
        'test:browser:public-tree': 'PLAYWRIGHT_APP_DIR=.public-tree PLAYWRIGHT_GAME_BASE_PATH=/AeonVale/ PLAYWRIGHT_VITE_BASE_PATH=/AeonVale/ pnpm test:browser:smoke',
        'verify:public-tree': 'pnpm prepare:public-tree .public-tree && pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts && pnpm --dir .public-tree governance:readiness && pnpm --dir .public-tree test tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts && pnpm test:browser:public-tree && PUBLIC_BUILD=true VITE_BASE_PATH=/AeonVale/ pnpm --dir .public-tree build',
      },
    }));

expect(() => runReadinessCheck(dir)).toThrow(/missing required script: test:browser:pages/);
  });

it('拒绝 README 移除试玩截图验收说明', () => {
    const dir = makeReadyRepo();
    write(dir, 'README.md', 'https://Rethymus.github.io/AeonVale/\npnpm prepare:public-tree <目标目录>\npnpm verify:public-tree\npnpm audit:public-worktree\npnpm audit:public-content\npnpm portfolio:mvp-preflight\n打印非部署发布清单\n维护者发布清单回显\npnpm portfolio:status\npnpm portfolio:release-checklist\n## 公开优先级\nP0 公开试玩版与 GitHub Pages 部署\n### 公开试玩验收清单\n玩家知道今天先做什么\nGitHub Pages 构建不泄露设计资料\n');

expect(() => runReadinessCheck(dir)).toThrow(/README\.md must document the portfolio screenshot capture path/);
  });

it('拒绝 README 移除状态 JSON 证据产物说明', () => {
    const dir = makeReadyRepo();
    write(dir, 'README.md', 'https://Rethymus.github.io/AeonVale/\npnpm prepare:public-tree <目标目录>\npnpm verify:public-tree\npnpm audit:public-worktree\npnpm audit:public-content\npnpm portfolio:mvp-preflight\n打印非部署发布清单\n维护者发布清单回显\npnpm portfolio:status\npnpm portfolio:status -- --json\npnpm portfolio:release-checklist\npnpm portfolio:capture\npnpm test:browser:smoke\npnpm test:browser:pages\ntest-results/portfolio/\ntest-results/portfolio/portfolio-mvp-evidence.json\n非空绘制比例、颜色数\n真实 Pages URL 必须在重新部署后通过 `pnpm test:browser:pages`\n该目录属于生成物，不进入公开树\n## 公开优先级\n### 当前进度快照\nP0-B GitHub Pages 公开展示\n后续若转为 Public、创建 Release 或修改远端设置，仍需要维护者当次明确授权\nP0 公开试玩版与 GitHub Pages 部署\n### 公开试玩验收清单\n玩家知道今天先做什么\nGitHub Pages 构建不泄露设计资料\n');

expect(() => runReadinessCheck(dir)).toThrow(/README\.md must document the machine-readable portfolio evidence artifact list/);
  });

it('拒绝发布清单移除对标范围与 P0-P2 优先级复核', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-release-checklist.mjs', '不提交、不推送、不部署、不修改 GitHub 设置\npnpm portfolio:mvp-preflight -- --keep-public-tree\npnpm test:browser:pages\nREADME.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md\n不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md\nSettings -> Pages 的 Source 设为 GitHub Actions\nENABLE_PAGES=true 闸门保护\n确认仓库 Homepage 指向\n《星露谷物语》对照验收\n低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种\n差异化内核：炼丹、阵法、淬体、主动引劫\nGo / No-Go 证据\n4 张 test-results/portfolio/*.png 截图为本次生成\ntest-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成\nruntimeSignals.todayBriefingProof 包含农庄、炼丹、引劫、首轮进度：10/10、修行接力\nscreenshotEvidence：4 张截图尺寸均为 960x540\npaintedRatio 达到阈值，colors 达到阈值\n该文件仍是生成物，不进入公开树\n每次重新部署后，真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 GitHub Pages 闭环完成\n');

expect(() => runReadinessCheck(dir)).toThrow(/Portfolio release checklist must include the Stardew\/comparison priority review section/);
  });

it('拒绝发布清单移除今日简报证据复核', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-release-checklist.mjs', '不提交、不推送、不部署、不修改 GitHub 设置\npnpm portfolio:mvp-preflight -- --keep-public-tree\npnpm test:browser:pages\nREADME.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md\n不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md\nSettings -> Pages 的 Source 设为 GitHub Actions\nENABLE_PAGES=true 闸门保护\n确认仓库 Homepage 指向\n《星露谷物语》对照验收\n低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种\n差异化内核：炼丹、阵法、淬体、主动引劫\nGo / No-Go 证据\n4 张 test-results/portfolio/*.png 截图为本次生成\ntest-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成\nscreenshotEvidence：4 张截图尺寸均为 960x540\npaintedRatio 达到阈值，colors 达到阈值\n该文件仍是生成物，不进入公开树\n每次重新部署后，真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 GitHub Pages 闭环完成\n对标范围与优先级复核\nP0 只要求公开试玩版与 GitHub Pages 部署闭环成立\nP1 再推进独立游戏首版的可持续循环\nP2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事\n《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》\n');

expect(() => runReadinessCheck(dir)).toThrow(/Portfolio release checklist must require maintainers to inspect today briefing proof evidence/);
  });

it('拒绝发布清单移除截图证据绘制统计复核', () => {
    const dir = makeReadyRepo();
    write(dir, 'tools/portfolio-release-checklist.mjs', '不提交、不推送、不部署、不修改 GitHub 设置\npnpm portfolio:mvp-preflight -- --keep-public-tree\npnpm test:browser:pages\nREADME.md、CONTRIBUTING.md、SECURITY.md、LICENSE、CONTENT-LICENSE.md、CHANGELOG.md\n不得上传设计类文档、docs/、AGENTS.md、CLAUDE.md、assets/ART-ASSETS-STATUS.md\nSettings -> Pages 的 Source 设为 GitHub Actions\nENABLE_PAGES=true 闸门保护\n确认仓库 Homepage 指向\n《星露谷物语》对照验收\n低门槛日循环：至少能完成翻地、播种、浇水、过夜、收获、出货、补种\n差异化内核：炼丹、阵法、淬体、主动引劫\nGo / No-Go 证据\n4 张 test-results/portfolio/*.png 截图为本次生成\ntest-results/portfolio/portfolio-mvp-evidence.json 由本次 portfolio:capture 生成\nruntimeSignals.todayBriefingProof 包含农庄、炼丹、引劫、首轮进度：10/10、修行接力\n该文件仍是生成物，不进入公开树\n每次重新部署后，真实 Pages URL 尚未通过 pnpm test:browser:pages 前，不得宣称 GitHub Pages 闭环完成\n对标范围与优先级复核\nP0 只要求公开试玩版与 GitHub Pages 部署闭环成立\nP1 再推进独立游戏首版的可持续循环\nP2 才以 Patch / DLC 方式补人物、节日、地点、作物、收藏和长期叙事\n《鬼谷八荒》《觅长生》《了不起的修仙模拟器》《太吾绘卷》\n');

expect(() => runReadinessCheck(dir)).toThrow(/Portfolio release checklist must require maintainers to inspect screenshot evidence dimensions/);
  });
});
