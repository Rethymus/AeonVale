import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { shouldSkipPublicTreeFile } from './public-tree-rules.mjs';

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

const worktreeFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
 .split('\0')
 .filter(Boolean);
const publicFiles = worktreeFiles.filter((file) => !shouldSkipPublicTreeFile(file));

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });

for (const file of publicFiles) {
 const source = join(root, file);
 if (!existsSync(source)) continue;
 const destinationFile = join(target, file);
 mkdirSync(dirname(destinationFile), { recursive: true });
 cpSync(source, destinationFile, { dereference: true, force: true, preserveTimestamps: true });
}

execFileSync('git', ['init'], { cwd: target, stdio: 'ignore' });
execFileSync('git', ['add', '-A'], { cwd: target, stdio: 'ignore' });

console.log(`Prepared public tree at ${target}`);
console.log(`Copied ${publicFiles.length} worktree files; excluded design docs and local state.`);
console.log(`Next: pnpm --dir ${target} install --frozen-lockfile --ignore-scripts && pnpm --dir ${target} governance:readiness && pnpm --dir ${target} governance:public && pnpm --dir ${target} governance:check && pnpm --dir ${target} typecheck && pnpm --dir ${target} test && pnpm --dir ${target} build && pnpm --dir ${target} governance:dist`);
