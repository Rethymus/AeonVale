import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * 单分支发布检查（main 即公开仓库本体）。
 * 双分支时代强制"docs/ 不入公开树"的规则随模型退役；本检查守护仍然成立的红线：
 * 本地 Agent 状态/临时目录不入库、无 .env/密钥文件、无生产 sourcemap、README 存在。
 */
const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const failures = [];

const forbiddenPathPrefixes = ['.claude/', '.omc/', '.codex/', '.agents/', '.mimosa/', 'dogfood-output/', 'test-results/', 'tmp/', '.tmp/'];
const forbiddenExact = new Set(['.gitleaks.toml.report', '.env', '.env.local', '.env.production']);

for (const file of tracked) {
  if (forbiddenExact.has(file) || file.startsWith('.env.')) failures.push(`forbidden environment file tracked: ${file}`);
  for (const prefix of forbiddenPathPrefixes) {
    if (file.startsWith(prefix)) failures.push(`forbidden local-state or generated directory tracked: ${file}`);
  }
  if (file.endsWith('.map') && file.startsWith('dist/')) failures.push(`production sourcemap tracked: ${file}`);
}

if (!tracked.includes('README.md')) failures.push('README.md must be present in the repository');
else {
  const readme = readFileSync('README.md', 'utf8');
  if (!readme.includes('Aeon Vale')) failures.push('README.md must name the product');
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Publication check passed (${tracked.length} tracked files, no local state or secrets tracked).`);
