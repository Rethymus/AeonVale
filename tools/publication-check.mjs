import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];

const allowedMarkdown = new Set([
  'README.md',
  'CHANGELOG.md',
  'CONTENT-LICENSE.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
]);
const allowedTextDocuments = new Set(['LICENSE', 'LICENSE.md', 'LICENSE.txt']);

function isAllowedGithubTemplate(file) {
  return file === '.github/pull_request_template.md' || file.startsWith('.github/ISSUE_TEMPLATE/');
}

for (const file of tracked) {
  if (file === 'README.md') continue;
  if (file.startsWith('docs/')) failures.push(`forbidden design document in public tree: ${file}`);
  if (file === 'assets/ART-ASSETS-STATUS.md') failures.push(`forbidden design/status document in public tree: ${file}`);
  if (file.endsWith('.md') && !allowedMarkdown.has(file) && !isAllowedGithubTemplate(file)) {
    failures.push(`forbidden markdown document in public tree: ${file}`);
  }
  if (/^LICENSE(\.md|\.txt)?$/.test(file) && !allowedTextDocuments.has(file)) {
    failures.push(`forbidden text document in public tree: ${file}`);
  }
}

if (tracked.includes('README.md')) {
  const readme = readFileSync('README.md', 'utf8');
  const forbiddenReadmePatterns = [
    /\bdocs\//,
    /\bAGENTS\.md\b/,
    /\bCLAUDE\.md\b/,
  ];
  for (const pattern of forbiddenReadmePatterns) {
    if (pattern.test(readme)) failures.push(`README.md references private or unpublished document pattern: ${pattern}`);
  }
} else {
  failures.push('README.md must be present in the public tree');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Public publication check passed (${tracked.length} tracked files, design documents are excluded).`);
