import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';

const dist = 'dist';
const githubPagesBasePath = '/AeonVale/';
const failures = [];

const forbiddenPatterns = [
 { pattern: /(^|\/)docs(\/|$)/, reason: 'private design docs' },
 { pattern: /(^|\/)\.omc(\/|$)/, reason: 'local Agent state' },
 { pattern: /(^|\/)\.claude(\/|$)/, reason: 'local Agent state' },
 { pattern: /(^|\/)\.codex(\/|$)/, reason: 'local Agent state' },
 { pattern: /(^|\/)\.agents(\/|$)/, reason: 'local Agent state' },
 { pattern: /(^|\/)\.env($|\.)/, reason: 'environment file' },
 { pattern: /\.map$/, reason: 'production sourcemap' },
 { pattern: /(^|\/)ART-ASSETS-STATUS\.md$/, reason: 'private art/design status document' },
];

function walk(directory) {
 for (const entry of readdirSync(directory)) {
 const absolute = join(directory, entry);
 const path = relative('.', absolute).replaceAll('\\', '/');
 const stat = statSync(absolute);
 if (stat.isDirectory()) {
 walk(absolute);
 continue;
 }
 for (const { pattern, reason } of forbiddenPatterns) {
 if (pattern.test(path)) failures.push(`forbidden ${reason} in public build: ${path}`);
 }
 }
}

function isLocalReference(value) {
 return !/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value);
}

function stripUrlSuffix(value) {
 return value.split(/[?#]/, 1)[0];
}

function resolveDistReference(indexDirectory, reference) {
 if (reference.startsWith(githubPagesBasePath)) {
 return resolve(dist, reference.slice(githubPagesBasePath.length));
 }
 return resolve(indexDirectory, reference);
}

function findMissingIndexReferences(indexHtml, index) {
 const indexDirectory = dirname(indexHtml);
 const distRoot = resolve(dist);
 const attributes = index.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi);

for (const [, rawReference] of attributes) {
 if (!isLocalReference(rawReference)) continue;

const reference = stripUrlSuffix(rawReference);
 if (!reference) continue;

const absoluteReference = resolveDistReference(indexDirectory, reference);
 const relativeToDist = relative(distRoot, absoluteReference).replaceAll('\\', '/');
 const escapesDist = relativeToDist.startsWith('../') || relativeToDist === '..' || resolve(absoluteReference) === distRoot;

if (escapesDist) {
 failures.push(`dist/index.html references local asset outside dist/: ${rawReference}`);
 continue;
 }

if (!existsSync(normalize(absoluteReference))) {
 failures.push(`dist/index.html references missing local asset: ${rawReference}`);
 }
 }
}

if (!existsSync(dist)) {
 failures.push('dist/ must exist before running public dist check');
} else {
 if (!existsSync(join(dist, '.nojekyll'))) failures.push('dist/.nojekyll must exist for GitHub Pages deployment');
 const indexHtml = join(dist, 'index.html');
 if (!existsSync(indexHtml)) {
 failures.push('dist/index.html must exist for GitHub Pages deployment');
 } else {
 const index = readFileSync(indexHtml, 'utf8');
 if (!/<script\b[^>]*\btype=["']module["'][^>]*\bsrc=["'][^"']+\.js["']/i.test(index)) {
 failures.push('dist/index.html must load a module JavaScript entry');
 }
 findMissingIndexReferences(indexHtml, index);
 }
 walk(dist);
}

if (failures.length) {
 console.error(failures.join('\n'));
 process.exit(1);
}

console.log('Public dist check passed (no design docs, local state, env files, or sourcemaps in dist/).');
