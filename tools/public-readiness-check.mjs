import { existsSync, readFileSync } from 'node:fs';

/**
 * 单分支发布就绪检查：仓库即发布源（原双分支 prepare:public-tree 流已退役）。
 * 校验治理文档、发布工作流与发布脚本齐备，Pages/Release 才能安全构建。
 */
const failures = [];

function requireFile(file) {
  if (!existsSync(file)) failures.push(`missing required release readiness file: ${file}`);
}

function requireIncludes(file, text, message) {
  requireFile(file);
  if (!existsSync(file)) return;
  const content = readFileSync(file, 'utf8');
  if (!content.includes(text)) failures.push(message ?? `${file} must include ${text}`);
}

for (const file of [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'LICENSE',
  'CONTENT-LICENSE.md',
  'CHANGELOG.md',
  'playwright.config.ts',
  '.github/workflows/ci.yml',
  '.github/workflows/pages.yml',
  '.github/workflows/release.yml',
  '.github/pull_request_template.md',
  'tools/portfolio-mvp-preflight.mjs',
  'tools/portfolio-status.mjs',
  'tools/portfolio-release-checklist.mjs',
  'tools/portfolio-pages-diagnose.mjs',
  'tools/portfolio-pages-watch.mjs',
  'tools/publication-check.mjs',
  'tools/public-dist-check.mjs'
]) {
  requireFile(file);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.private !== true) failures.push('package.json must remain private before public repository conversion');
if (packageJson.repository?.url !== 'https://github.com/Rethymus/AeonVale.git') {
  failures.push('package.json repository.url must point at the public GitHub target');
}
for (const script of ['governance:check', 'governance:public', 'governance:dist', 'governance:readiness']) {
  if (typeof packageJson.scripts?.[script] !== 'string') failures.push(`package.json missing required script: ${script}`);
}
if (typeof packageJson.scripts?.['portfolio:capture'] !== 'string') {
  failures.push('package.json missing required script: portfolio:capture');
} else if (!packageJson.scripts['portfolio:capture'].includes('tests/browser/portfolio-capture.spec.ts')) {
  failures.push('package.json portfolio:capture must run the portfolio capture spec');
}
if (typeof packageJson.scripts?.['test:browser:pages'] !== 'string') {
  failures.push('package.json missing required script: test:browser:pages');
}

requireIncludes('CONTRIBUTING.md', 'Pages 与 Release 产物只包含构建出的 dist', 'CONTRIBUTING.md must document dist-only deploy boundaries');

requireIncludes('.github/workflows/ci.yml', 'uses: gitleaks/gitleaks-action@v3', 'CI must include secret scanning');
requireIncludes('.github/workflows/ci.yml', 'pnpm governance:readiness', 'CI must run release readiness checks');
requireIncludes('.github/workflows/ci.yml', "VITE_BASE_PATH: /AeonVale/", 'CI must build the Pages dist with the site base path');
requireIncludes('.github/workflows/ci.yml', 'name: aeonvale-pages-dist-${{ github.sha }}', 'CI must upload the Pages dist artifact');
requireIncludes('.github/workflows/ci.yml', 'pnpm test:browser', 'CI must run browser smoke coverage');
requireIncludes('.github/workflows/pages.yml', 'workflow_run:', 'Pages deploy must chain off CI');
requireIncludes('.github/workflows/pages.yml', 'actions/download-artifact@v4', 'Pages deploy must download the CI-verified dist artifact');
requireIncludes('.github/workflows/release.yml', 'workflow_dispatch:', 'Releases stay manual');
requireIncludes('.github/workflows/release.yml', 'cd dist && zip', 'Release zip must be built from the repository root dist');

requireFile('assets/logo/logo-emblem.png');
requireFile('assets/screenshots/roguelite-prep.png');
requireFile('assets/screenshots/tribulation-sokoban.gif');

const gitignore = readFileSync('.gitignore', 'utf8');
for (const pattern of ['.env', 'node_modules/', 'dist/', '.public-tree/', 'coverage/']) {
  if (!gitignore.includes(pattern)) failures.push(`.gitignore must keep ignoring ${pattern}`);
}

if (failures.length > 0) {
  console.error(`Release readiness check failed (${failures.length}):`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}

console.log('Release readiness check passed (governance docs, workflows, and release scripts are present).');
