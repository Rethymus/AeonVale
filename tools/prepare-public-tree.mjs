import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { shouldSkipPublicTreeFile } from './public-tree-rules.mjs';

function sanitizeManifestEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry;
  const sanitized = { ...entry };
  delete sanitized.src;
  delete sanitized.human_edits;
  return sanitized;
}

export function sanitizeManifestForPublicTree(raw) {
  const manifest = JSON.parse(JSON.stringify(raw));
  for (const kind of ['sprites', 'audio', 'fonts', 'shaders']) {
    if (!Array.isArray(manifest[kind])) continue;
    manifest[kind] = manifest[kind]
      .filter(entry => !(typeof entry?.path === 'string' && entry.path.startsWith('references/')))
      .map(sanitizeManifestEntry);
  }
  return manifest;
}

const destination = process.argv[2];

if (!destination) {
  console.error('Usage: node tools/prepare-public-tree.mjs <destination-dir>');
  process.exit(1);
}

const root = resolve('.');
const target = resolve(destination);

if (target === root || root.startsWith(`${target}/`)) {
  console.error('Destination must not be the current repository or one of its ancestors.');
  process.exit(1);
}

const worktreeFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const publicFiles = worktreeFiles.filter(file => !shouldSkipPublicTreeFile(file));

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const file of publicFiles) {
  const source = join(root, file);
  if (!existsSync(source)) continue;
  const destinationFile = join(target, file);
  mkdirSync(dirname(destinationFile), { recursive: true });
  if (file === 'assets/manifest.json') {
    const manifest = JSON.parse(readFileSync(source, 'utf8'));
    writeFileSync(destinationFile, `${JSON.stringify(sanitizeManifestForPublicTree(manifest), null, 1)}\n`);
    continue;
  }
  cpSync(source, destinationFile, { dereference: true, force: true, preserveTimestamps: true });
}

execFileSync('git', ['init'], { cwd: target, stdio: 'ignore' });
execFileSync('git', ['add', '-A'], { cwd: target, stdio: 'ignore' });

console.log(`Prepared public tree at ${target}`);
console.log(`Copied ${publicFiles.length} worktree files; excluded design docs and local state.`);
console.log(`Next: pnpm --dir ${target} install --frozen-lockfile --ignore-scripts && pnpm --dir ${target} governance:readiness && pnpm --dir ${target} governance:public && pnpm --dir ${target} governance:check && pnpm --dir ${target} typecheck && pnpm --dir ${target} test && pnpm --dir ${target} build && pnpm --dir ${target} governance:dist`);
