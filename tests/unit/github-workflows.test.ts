import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub workflow deployment guardrails', () => {
  it('keeps workflow YAML structurally nested for GitHub Actions', () => {
    const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8');
    const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

    expect(ciWorkflow).toContain('on:\n  push:\n    branches: [main]\n  pull_request:\n  workflow_dispatch:');
    expect(ciWorkflow).toContain('permissions:\n  contents: read\n  pull-requests: read');
    expect(ciWorkflow).toContain('jobs:\n  governance:\n    name: Governance and repository hygiene');
    expect(ciWorkflow).toContain('    steps:\n      - uses: actions/checkout@v5\n        with:\n          fetch-depth: 0');
    expect(ciWorkflow).toContain('      - run: pnpm governance:check\n      - run: pnpm governance:readiness\n      - run: pnpm governance:public');
    expect(ciWorkflow).toContain("      # 单分支模型：根树即发布源，直接按 Pages 参数构建并校验产物。\n      - run: pnpm build\n        env:\n          PUBLIC_BUILD: 'true'\n          VITE_BASE_PATH: /AeonVale/\n          VITE_BUILD_REVISION: ${{ github.sha }}");
    expect(ciWorkflow).toContain('      - run: pnpm governance:dist\n      - uses: actions/upload-artifact@v4');

    expect(pagesWorkflow).toContain('on:\n  workflow_run:\n    workflows: [CI]\n    types: [completed]\n    branches: [main]\n  workflow_dispatch:');
    expect(pagesWorkflow).toContain('permissions:\n  contents: read\n  actions: read\n  pages: write\n  id-token: write');
    expect(pagesWorkflow).toContain('jobs:\n  deploy:\n    if: >-');
    expect(ciWorkflow).toContain('name: aeonvale-pages-dist-${{ github.sha }}');
    expect(ciWorkflow).toContain('include-hidden-files: true');
    expect(pagesWorkflow).toContain('      - name: Download CI-verified dist artifact\n        if: github.event_name ==');
    expect(pagesWorkflow).toContain('          name: aeonvale-pages-dist-${{ github.event.workflow_run.head_sha }}');
    expect(pagesWorkflow).toContain("      # 手动触发路径（单分支模型）：根树即发布源，直接全检 + 构建。");
    expect(pagesWorkflow).toContain("      - name: Manual Pages build\n        if: github.event_name == 'workflow_dispatch'\n        run: pnpm build\n        env:\n          PUBLIC_BUILD: 'true'\n          VITE_BASE_PATH: /AeonVale/\n          VITE_BUILD_REVISION: ${{ github.sha }}");
    expect(pagesWorkflow).toContain('      - name: Verify deployment dist\n        run: pnpm governance:dist');
    expect(pagesWorkflow).toContain('      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: dist');

    expect(releaseWorkflow).toContain('on:\n  workflow_dispatch:\n    inputs:\n      version:\n        description: Semantic version without the v prefix');
    expect(releaseWorkflow).toContain('jobs:\n  release:\n    if: github.ref ==');
    expect(releaseWorkflow).toContain('      - name: Validate version\n        env:\n          INPUT_VERSION: ${{ inputs.version }}\n        run: |');
    expect(releaseWorkflow).toContain("      - run: pnpm build\n        env:\n          PUBLIC_BUILD: 'true'\n          VITE_BASE_PATH: ./\n          VITE_BUILD_REVISION: ${{ github.sha }}");
  });

  it('keeps CI responsible for repository checks and the Pages deployment artifact', () => {
    const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');

    expect(ciWorkflow).toContain('pnpm governance:check');
    expect(ciWorkflow).toContain('pnpm governance:readiness');
    expect(ciWorkflow).toContain('pnpm governance:public');
    expect(ciWorkflow).toContain('pnpm typecheck');
    expect(ciWorkflow).toContain('pnpm content:lint');
    expect(ciWorkflow).toContain('pnpm test');
    expect(ciWorkflow).toContain('pnpm test:replay');
    expect(ciWorkflow).toContain('pnpm cultivation:check');
    expect(ciWorkflow).toContain('      - run: pnpm build');
    expect(ciWorkflow).toContain('      - run: pnpm governance:dist');
    expect(ciWorkflow).toContain('aeonvale-pages-dist-${{ github.sha }}');
    expect(ciWorkflow).toContain('include-hidden-files: true');
    expect(ciWorkflow).toContain('          path: dist');
    expect(ciWorkflow).toContain('uses: gitleaks/gitleaks-action@v3');
    // 无障碍回归门必须真跑在 CI（docs/37）：仅本地全量不算门。
    expect(ciWorkflow).toContain('pnpm test:browser:a11y');
    expect(ciWorkflow).toContain('VITE_BASE_PATH: /AeonVale/');
    expect(ciWorkflow).toContain('VITE_BUILD_REVISION: ${{ github.sha }}');
  });

  it('only deploys Pages from trusted CI runs or an explicit manual dispatch', () => {
    const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8');

    expect(pagesWorkflow).toContain('workflow_run:');
    expect(pagesWorkflow).toContain('workflows: [CI]');
    expect(pagesWorkflow).toContain(`    if: >-
      vars.ENABLE_PAGES == 'true' &&
      (
        (
          github.event_name == 'workflow_dispatch' &&
          github.ref == 'refs/heads/main'
        ) ||
        (
          github.event_name == 'workflow_run' &&
          github.event.workflow_run.conclusion == 'success' &&
          github.event.workflow_run.event == 'push' &&
          github.event.workflow_run.head_branch == 'main' &&
          github.event.workflow_run.head_repository.full_name == github.repository
        )
      )`);
    expect(pagesWorkflow).toContain('ref: ${{ github.event.workflow_run.head_sha || github.sha }}');
    expect(pagesWorkflow).toContain('actions/download-artifact@v4');
    expect(pagesWorkflow).toContain('run-id: ${{ github.event.workflow_run.id }}');
    expect(pagesWorkflow).toContain('github-token: ${{ secrets.GITHUB_TOKEN }}');
    expect(pagesWorkflow).toContain('name: aeonvale-pages-dist-${{ github.event.workflow_run.head_sha }}');
    expect(pagesWorkflow).toContain('path: dist');
    expect(pagesWorkflow).toContain('if: github.event_name ==');
    expect(pagesWorkflow).toContain('        run: pnpm governance:readiness');
    expect(pagesWorkflow).toContain('        run: pnpm governance:public');
    expect(pagesWorkflow).toContain('        run: pnpm governance:check');
    expect(pagesWorkflow).toContain('        run: pnpm typecheck');
    expect(pagesWorkflow).toContain('pnpm test tests/unit/github-workflows.test.ts tests/unit/public-readiness-check.test.ts tests/unit/publication-check.test.ts tests/unit/public-dist-check.test.ts');
    expect(pagesWorkflow).toContain('pnpm exec playwright install --with-deps chromium');
    expect(pagesWorkflow).toContain('        run: pnpm test:browser:smoke');
    expect(pagesWorkflow).toContain('run: pnpm governance:dist');
    expect(pagesWorkflow).toContain('Install Chromium for deployed Pages smoke');
    expect(pagesWorkflow).toContain('pnpm test:browser:pages');
    expect(pagesWorkflow).toContain('Verify deployed Pages playability');
    expect(pagesWorkflow).toContain('pnpm test:browser:pages-playable');
    expect(pagesWorkflow).toContain('PLAYWRIGHT_EXPECTED_BUILD_REVISION: ${{ github.event.workflow_run.head_sha || github.sha }}');
    expect(pagesWorkflow).toContain('VITE_BUILD_REVISION: ${{ github.sha }}');
  });

  it('keeps the perf vertical monitor weekly, write-enabled, band-checked, and loop-free', () => {
    const perfWorkflow = readFileSync('.github/workflows/perf-vertical.yml', 'utf8');

    // 触发面：仅周度 cron + 手动 dispatch，无 push 触发（feed 回提交不得自触发循环）。
    expect(perfWorkflow).toContain("cron: '23 2 * * 1'");
    expect(perfWorkflow).toContain('workflow_dispatch:');
    expect(perfWorkflow).not.toContain('on:\n  push:');
    // 自动回提交需要写权限。
    expect(perfWorkflow).toContain('permissions:\n  contents: write');
    // 双剖面 CWV 采样：3 载荷中位 + 带判定 + 数据源入链。
    expect(perfWorkflow).toContain('pnpm perf:audit --loads=3 --out=docs/perf/vertical-samples.jsonl --bands=docs/perf/vertical-bands.json');
    expect(perfWorkflow).toContain('pnpm perf:audit --mobile --loads=3 --out=docs/perf/vertical-samples.jsonl --bands=docs/perf/vertical-bands.json');
    // 棋盘帧预算步（docs/32 §24.7.1）。
    // 帧预算步不带 --bands：loads=1 的 LCP 对噪声敏感，带判定由 3 载荷步承担（docs/32 §24.8.5）。
    expect(perfWorkflow).toContain('pnpm perf:audit --loads=1 --flow --out=docs/perf/vertical-samples.jsonl');
    expect(perfWorkflow).toContain('Desktop tribulation frame budget');
    // 自动回提交约定。
    expect(perfWorkflow).toContain("git config user.name 'github-actions[bot]'");
    expect(perfWorkflow).toContain("git commit -m 'chore(perf): 纵向采样入链'");
    expect(perfWorkflow).toContain('git diff --cached --quiet');
  });

  it('keeps releases manual, main-only, version-checked, and built from the repository root', () => {
    const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

    expect(releaseWorkflow).toContain('workflow_dispatch:');
    expect(releaseWorkflow).not.toContain('push:');
    expect(releaseWorkflow).toContain("if: github.ref == 'refs/heads/main'");
    expect(releaseWorkflow).toContain('p.version !== process.env.INPUT_VERSION');
    expect(releaseWorkflow).toContain('git tag -l "v${INPUT_VERSION}"');
    expect(releaseWorkflow).toContain('pnpm governance:readiness');
    expect(releaseWorkflow).toContain('pnpm governance:public');
    expect(releaseWorkflow).toContain('      - run: pnpm build');
    expect(releaseWorkflow).toContain('      - run: pnpm governance:dist');
    expect(releaseWorkflow).toContain('VITE_BUILD_REVISION: ${{ github.sha }}');
    expect(releaseWorkflow).toContain('cd dist && zip');
    expect(releaseWorkflow).toContain('gh release create "v${{ inputs.version }}"');
  });
});
