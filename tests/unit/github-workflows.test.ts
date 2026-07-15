import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub workflow deployment guardrails', () => {
 it('keeps workflow YAML structurally nested for GitHub Actions', () => {
 const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');
 const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8');
 const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

 expect(ciWorkflow).toContain('on:\n  push:\n    branches: [main]\n  pull_request:');
 expect(ciWorkflow).toContain('permissions:\n  contents: read');
 expect(ciWorkflow).toContain('jobs:\n  governance:\n    name: Governance and repository hygiene');
 expect(ciWorkflow).toContain('    steps:\n      - uses: actions/checkout@v4\n        with:\n          fetch-depth: 0');
 expect(ciWorkflow).toContain("      - run: pnpm --dir .public-tree build\n        env:\n          PUBLIC_BUILD: 'true'\n          VITE_BASE_PATH: /AeonVale/");
 expect(ciWorkflow).toContain('      - run: pnpm test:browser:public-tree\n        env:\n          PLAYWRIGHT_APP_DIR: .public-tree');

 expect(pagesWorkflow).toContain('on:\n  workflow_run:\n    workflows: [CI]\n    types: [completed]\n    branches: [main]\n  workflow_dispatch:');
 expect(pagesWorkflow).toContain('permissions:\n  contents: read\n  pages: write\n  id-token: write');
 expect(pagesWorkflow).toContain('jobs:\n  deploy:\n    if: vars.ENABLE_PAGES');
 expect(pagesWorkflow).toContain('      - uses: actions/upload-pages-artifact@v3\n        with:\n          path: .public-tree/dist');

 expect(releaseWorkflow).toContain('on:\n  workflow_dispatch:\n    inputs:\n      version:\n        description: Semantic version without the v prefix');
 expect(releaseWorkflow).toContain('jobs:\n  release:\n    if: github.ref ==');
 expect(releaseWorkflow).toContain('      - name: Validate version\n        env:\n          INPUT_VERSION: ${{ inputs.version }}\n        run: |');
 });

 it('keeps CI responsible for private checks, public-tree checks, and GitHub Pages smoke coverage', () => {
 const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8');

expect(ciWorkflow).toContain('pnpm governance:check');
 expect(ciWorkflow).toContain('pnpm governance:readiness');
 expect(ciWorkflow).toContain('pnpm typecheck');
 expect(ciWorkflow).toContain('pnpm content:lint');
 expect(ciWorkflow).toContain('pnpm test');
 expect(ciWorkflow).toContain('pnpm test:replay');
 expect(ciWorkflow).toContain('pnpm m5:check');
 expect(ciWorkflow).toContain('pnpm prepare:public-tree .public-tree');
 expect(ciWorkflow).toContain('pnpm --dir .public-tree governance:readiness');
 expect(ciWorkflow).toContain('pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts');
 expect(ciWorkflow).toContain('pnpm --dir .public-tree governance:public');
 expect(ciWorkflow).toContain('pnpm --dir .public-tree build');
 expect(ciWorkflow).toContain('pnpm --dir .public-tree governance:dist');
 expect(ciWorkflow).toContain('uses: gitleaks/gitleaks-action@v2');
 expect(ciWorkflow).toContain('PLAYWRIGHT_APP_DIR: .public-tree');
 expect(ciWorkflow).toContain('PLAYWRIGHT_GAME_BASE_PATH: /AeonVale/');
 expect(ciWorkflow).toContain('PLAYWRIGHT_VITE_BASE_PATH: /AeonVale/');
 expect(ciWorkflow).toContain('VITE_BASE_PATH: /AeonVale/');
 });

it('deploys Pages from the exact CI-verified commit when triggered by workflow_run', () => {
 const pagesWorkflow = readFileSync('.github/workflows/pages.yml', 'utf8');

expect(pagesWorkflow).toContain('workflow_run:');
 expect(pagesWorkflow).toContain('workflows: [CI]');
 expect(pagesWorkflow).toContain('ref: ${{ github.event.workflow_run.head_sha || github.sha }}');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree governance:readiness');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree governance:public');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree governance:check');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree typecheck');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree test tests/unit/github-workflows.test.ts tests/unit/public-readiness-check.test.ts tests/unit/publication-check.test.ts tests/unit/prepare-public-tree.test.ts tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts');
 expect(pagesWorkflow).toContain('pnpm exec playwright install --with-deps chromium');
 expect(pagesWorkflow).toContain('pnpm test:browser:public-tree');
 expect(pagesWorkflow).toContain('pnpm --dir .public-tree governance:dist');
 expect(pagesWorkflow).toContain('path: .public-tree/dist');
 expect(pagesWorkflow).toContain('pnpm test:browser:pages');
 });

it('keeps releases manual, main-only, version-checked, and built from the public tree', () => {
 const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8');

expect(releaseWorkflow).toContain('workflow_dispatch:');
 expect(releaseWorkflow).not.toContain('push:');
 expect(releaseWorkflow).toContain("if: github.ref == 'refs/heads/main'");
 expect(releaseWorkflow).toContain('p.version !== process.env.INPUT_VERSION');
 expect(releaseWorkflow).toContain('git tag -l "v${INPUT_VERSION}"');
 expect(releaseWorkflow).toContain('pnpm governance:readiness');
 expect(releaseWorkflow).toContain('pnpm prepare:public-tree .public-tree');
 expect(releaseWorkflow).toContain('pnpm --dir .public-tree install --frozen-lockfile --ignore-scripts');
 expect(releaseWorkflow).toContain('pnpm --dir .public-tree governance:readiness');
 expect(releaseWorkflow).toContain('pnpm --dir .public-tree governance:public');
 expect(releaseWorkflow).toContain('pnpm --dir .public-tree test tests/unit/github-workflows.test.ts tests/unit/public-readiness-check.test.ts tests/unit/publication-check.test.ts tests/unit/prepare-public-tree.test.ts tests/unit/public-dist-check.test.ts tests/unit/public-content-audit.test.ts');
 expect(releaseWorkflow).toContain('pnpm --dir .public-tree governance:dist');
 expect(releaseWorkflow).toContain('cd .public-tree/dist && zip');
 expect(releaseWorkflow).toContain('gh release create "v${{ inputs.version }}"');
 });
});
