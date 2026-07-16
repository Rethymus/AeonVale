import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { classifyPublicWorktreePath } from './public-tree-rules.mjs';

const failOnPublicCandidates = process.argv.includes('--fail-on-public-candidates');
const failOnSecretRisk = process.argv.includes('--fail-on-secret-risk');
const jsonOutput = process.argv.includes('--json');

const classes = ['public-candidate', 'private-design', 'local-state', 'generated', 'secret-risk', 'private-excluded'];
const publicCandidateGroups = ['public-governance', 'portfolio-runtime', 'gameplay-sim', 'tests-browser', 'tests-unit-integration', 'tools-pipeline', 'unknown-public'];

export function classifyPublicCandidateGroup(path) {
  if (path === 'README.md' || path === 'CHANGELOG.md' || path === 'CONTENT-LICENSE.md' || path === 'CONTRIBUTING.md' || path === 'LICENSE' || path === 'SECURITY.md' || path === 'package.json' || path === 'pnpm-lock.yaml' || path === 'commitlint.config.cjs' || path === '.gitignore' || path.startsWith('.github/') || path === 'tools/public-tree-rules.mjs' || path === 'tools/prepare-public-tree.mjs' || path === 'tools/public-content-audit.mjs' || path === 'tools/public-content-audit.d.mts' || path === 'tools/public-readiness-check.mjs' || path === 'tools/publication-check.mjs' || path === 'tools/public-dist-check.mjs' || path === 'tools/public-worktree-audit.mjs' || path === 'tools/public-worktree-audit.d.mts' || path === 'tools/portfolio-mvp-preflight.mjs') {
    return 'public-governance';
  }

  if (path === 'index.html' || path === 'vite.config.ts' || path === 'tsconfig.json' || path === 'vitest.config.ts' || path === 'playwright.config.ts' || path === 'src/vite-env.d.ts' || path === 'assets/manifest.json' || path.startsWith('assets/logo/') || path.startsWith('assets/icons/') || path.startsWith('src/app/') || path.startsWith('src/io/') || path.startsWith('src/render/')) {
    return 'portfolio-runtime';
  }

  if (path.startsWith('src/sim/') || path.startsWith('src/content/')) return 'gameplay-sim';
  if (path.startsWith('tests/browser/')) return 'tests-browser';
  if (path.startsWith('tests/unit/') || path.startsWith('tests/integration/') || path.startsWith('tests/property/') || path.startsWith('tests/replay/') || path.startsWith('tests/headless/')) {
    return 'tests-unit-integration';
  }
  if (path.startsWith('tools/')) return 'tools-pipeline';

  return 'unknown-public';
}

function parsePorcelainStatus(output) {
  const parts = output.split('\0').filter(Boolean);
  const entries = [];

  for (let index = 0; index < parts.length; index += 1) {
    const record = parts[index];
    const status = record.slice(0, 2);
    const path = record.slice(3);
    if (!path) continue;
    const paths = [path];

    if (status[0] === 'R' || status[1] === 'R' || status[0] === 'C' || status[1] === 'C') {
      const originalPath = parts[index + 1];
      if (originalPath) {
        paths.push(originalPath);
        index += 1;
      }
    }

    entries.push({ status, paths });
  }

  return entries;
}

export function auditPublicWorktree(statusOutput) {
  const counts = Object.fromEntries(classes.map(name => [name, 0]));
  const byClass = Object.fromEntries(classes.map(name => [name, []]));
  const publicCandidateGroupCounts = Object.fromEntries(publicCandidateGroups.map(name => [name, 0]));
  const publicCandidatesByGroup = Object.fromEntries(publicCandidateGroups.map(name => [name, []]));

  for (const entry of parsePorcelainStatus(statusOutput)) {
    for (const path of entry.paths) {
      const kind = classifyPublicWorktreePath(path);
      counts[kind] += 1;
      byClass[kind].push(`${entry.status} ${path}`);

      if (kind === 'public-candidate') {
        const group = classifyPublicCandidateGroup(path);
        publicCandidateGroupCounts[group] += 1;
        publicCandidatesByGroup[group].push(`${entry.status} ${path}`);
      }
    }
  }

  return { counts, byClass, publicCandidateGroupCounts, publicCandidatesByGroup };
}

export function shouldFailPublicWorktreeAudit(report, options = {}) {
  return Boolean((options.failOnPublicCandidates && report.counts['public-candidate'] > 0) || (options.failOnSecretRisk && report.counts['secret-risk'] > 0));
}

function formatList(items) {
  if (!items.length) return ' - none';
  return items
    .slice(0, 40)
    .map(item => ` - ${item}`)
    .join('\n');
}

function formatCandidateGroups(report) {
  const lines = [];
  for (const group of publicCandidateGroups) {
    const count = report.publicCandidateGroupCounts[group];
    lines.push(` ${group}: ${count}`);
    if (count > 0) {
      lines.push(...report.publicCandidatesByGroup[group].slice(0, 8).map(item => ` - ${item}`));
      if (count > 8) lines.push(` - ... ${count - 8} more`);
    }
  }
  return lines.join('\n');
}

function formatReport(report) {
  const lines = ['Public worktree audit', '', 'Changed path classes:', ...classes.map(name => ` ${name}: ${report.counts[name]}`), '', 'Dirty public candidates included by public-tree rules:', formatList(report.byClass['public-candidate']), '', 'Dirty public candidates by release bucket:', formatCandidateGroups(report), '', 'Private design docs, local Agent state, generated output, env files, and sourcemaps are excluded by public-tree rules.'];

  if (report.byClass['secret-risk'].length) {
    lines.push('', 'Secret-risk paths present in the working tree:', formatList(report.byClass['secret-risk']));
  }

  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const statusOutput = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' });
  const report = auditPublicWorktree(statusOutput);
  console.log(jsonOutput ? JSON.stringify(report, null, 2) : formatReport(report));

  if (shouldFailPublicWorktreeAudit(report, { failOnPublicCandidates, failOnSecretRisk })) {
    if (failOnPublicCandidates && report.counts['public-candidate'] > 0) {
      console.error('Refusing to continue because dirty public candidates are present. Review or commit them before publication.');
    }
    if (failOnSecretRisk && report.counts['secret-risk'] > 0) {
      console.error('Refusing to continue because secret-risk paths are present. Remove env files or secrets before publication.');
    }
    process.exit(1);
  }
}
