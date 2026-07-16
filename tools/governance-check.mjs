import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = [
  /(^|\/)\.claude\//, /(^|\/)\.omc\//, /(^|\/)\.codex\//, /(^|\/)\.agents\//,
  /^dist\//, /^coverage\//, /^playwright-report\//, /^test-results\//,
  /(^|\/)\.env($|\.)/, /\.map$/,
  /^\.tmp\.playwright-.*\.config\.ts$/,
];

function isForbidden(file) {
  return forbidden.some((pattern) => pattern.test(file)) && file !== '.env.example';
}

for (const file of tracked) {
  if (isForbidden(file)) failures.push(`forbidden tracked file: ${file}`);
}

const statusEntries = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
for (let index = 0; index < statusEntries.length; index += 1) {
  const entry = statusEntries[index];
  const code = entry.slice(0, 2);
  const path = entry.slice(3);
  if (code.startsWith('R') || code.startsWith('C')) index += 1;
  // 跳过删除态（D）：被禁文件正在被移除（暂存删除 `D ` 或工作区删除 ` D`）是期望结果而非违规。
  if (isForbidden(path) && !code.includes('D')) failures.push(`forbidden working-tree file: ${path}`);
}
const agentEntryFiles = ['AGENTS.md', 'CLAUDE.md'];
const hasPrivateAgentEntryContract = agentEntryFiles.some((entry) => tracked.includes(entry) || existsSync(entry));

if (existsSync('CONTRIBUTING.md') && hasPrivateAgentEntryContract) {
  for (const entry of agentEntryFiles) {
    if (!existsSync(entry)) {
      failures.push(`${entry} must exist in the private development tree`);
      continue;
    }
    const content = readFileSync(entry, 'utf8');
    if (!content.includes('CONTRIBUTING.md')) failures.push(`${entry} must reference CONTRIBUTING.md`);
  }
}
const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
if (packageJson.private !== true) failures.push('package.json must remain private to prevent accidental npm publication');
if (packageJson.author !== 'AeonVale') failures.push('package.json author must use the public GitHub username');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Repository governance check passed (${tracked.length} tracked files).`);
