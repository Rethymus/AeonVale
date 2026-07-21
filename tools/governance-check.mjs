import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';

const failures = [];
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = [/(^|\/)\.claude\//, /(^|\/)\.omc\//, /(^|\/)\.codex\//, /(^|\/)\.agents\//, /(^|\/)\.superpowers\//, /^dist\//, /^coverage\//, /^playwright-report\//, /^test-results\//, /^dogfood-output\//, /^tmp\//, /(^|\/)\.env($|\.)/, /\.map$/, /^\.tmp\.playwright-.*\.config\.ts$/];

function isForbidden(file) {
  return forbidden.some(pattern => pattern.test(file)) && file !== '.env.example';
}

for (const file of tracked) {
  if (isForbidden(file)) failures.push(`forbidden tracked file: ${file}`);
}

const statusEntries = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { encoding: 'utf8' }).split('\0').filter(Boolean);
for (let index = 0; index < statusEntries.length; index += 1) {
  const entry = statusEntries[index];
  const code = entry.slice(0, 2);
  const path = entry.slice(3);
  if (code.startsWith('R') || code.startsWith('C')) index += 1;
  // 跳过删除态（D）：被禁文件正在被移除（暂存删除 `D ` 或工作区删除 ` D`）是期望结果而非违规。
  if (isForbidden(path) && !code.includes('D')) failures.push(`forbidden working-tree file: ${path}`);
}
const agentEntryFiles = ['AGENTS.md', 'CLAUDE.md'];
const hasPrivateAgentEntryContract = agentEntryFiles.some(entry => tracked.includes(entry) || existsSync(entry));

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

const grepTargets = tracked.filter(file => existsSync(file) && /\.(?:[cm]?js|ts|tsx|md|yml|yaml|json)$/i.test(file));
const allowedTodoFiles = new Set(['docs/18-development-roadmap.md', 'docs/19-risk-register.md', 'docs/_QA-CHECKLIST.md', 'tools/governance-check.mjs']);
const fakeCompletionPatterns = [
  { label: 'test.skip', pattern: /\b(?:test|describe)\.skip\s*\(/g },
  { label: 'test.only', pattern: /\b(?:test|describe)\.only\s*\(/g },
  { label: 'bare TODO', pattern: /\bTODO\b/g },
  { label: 'stub throw', pattern: /throw\s+new\s+Error\s*\(\s*['"`]\s*(?:TODO|Not implemented|stub)\b/gi }
];

for (const file of grepTargets) {
  if (allowedTodoFiles.has(file)) continue;
  const content = readFileSync(file, 'utf8');
  for (const { label, pattern } of fakeCompletionPatterns) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (!match) continue;
    const line = content.slice(0, match.index).split('\n').length;
    failures.push(`${label} found in ${relative(process.cwd(), file)}:${line}`);
  }
}

// 灵韵叙录 CI 护栏（docs/23 §7）：结局可达性 / 打字机无空键 / 运行时无 AI·fetch / manifest 完整性。
// narration-governance.ts 经 tsx 调起（需 import 纯数据模块 narrationScenes），失败非零退出。
try {
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'tools/narration-governance.ts'], { stdio: 'inherit' });
} catch {
  failures.push('narration governance check failed — see narration-governance output above');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Repository governance check passed (${tracked.length} tracked files).`);
