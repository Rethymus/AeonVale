import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const COLOR_SOURCE = 'src/render/ColorPalette.ts';
const CSS_NAMED_COLOR = /(?:^|[^\w-])(transparent|black|white|gray|grey|red|green|blue|yellow|orange|purple|pink|brown|cyan|magenta|lime|maroon|navy|olive|teal|aqua|silver|fuchsia)(?![\w-])/gi;
const ALLOWED_NUMERIC_LITERALS = new Map<string, ReadonlySet<string>>([
  ['src/render/palette.ts', new Set(['0xffffff'])],
  ['src/render/sprites.ts', new Set(['0x6d2b79f5'])],
  ['src/render/worldDecor.ts', new Set(['0x7feb352d', '0x846ca68b', '0x9e3779b9'])],
  ['src/sim/world/rng.ts', new Set(['0x6d2b79f5'])]
]);

function productionFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...productionFiles(path));
    else if (/\.(?:css|html|ts)$/.test(entry)) files.push(path);
  }
  return files;
}

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

function namedColorFindings(source: string, repoPath: string): string[] {
  const findings: string[] = [];
  for (const declaration of source.matchAll(/(?:^|[;{])\s*([\w-]+)\s*:\s*([^;{}]+)/gim)) {
    const property = declaration[1] ?? '';
    const rawValue = declaration[2] ?? '';
    const valueWithoutPaletteVariables = rawValue.replace(/var\([^)]*\)/gi, '');
    for (const color of valueWithoutPaletteVariables.matchAll(CSS_NAMED_COLOR)) {
      findings.push(`${repoPath}:${lineNumber(source, (declaration.index ?? 0) + (color.index ?? 0))} ${property}: ${color[1]}`);
    }
  }
  return findings;
}

describe('production color discipline', () => {
  it('keeps six/eight-digit color literals in ColorPalette only', () => {
    const findings: string[] = [];
    for (const path of [...productionFiles('src'), 'index.html']) {
      // Windows 下 relative()/join() 产生反斜杠，统一为正斜杠再与白名单比较
      const repoPath = relative('.', path).replaceAll('\\', '/');
      if (repoPath === COLOR_SOURCE) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(/(?:#[\da-f]{3,8}|%23[\da-f]{3,8}|\b0x[\da-f]{6,8}\b)/gi)) {
        const literal = match[0].toLowerCase();
        if (ALLOWED_NUMERIC_LITERALS.get(repoPath)?.has(literal)) continue;
        findings.push(`${repoPath}:${lineNumber(source, match.index ?? 0)} ${match[0]}`);
      }
    }

    expect(findings).toEqual([]);
  });

  it('forbids CSS RGB/HSL literals while allowing palette channel variables', () => {
    const source = readFileSync('src/app/app.css', 'utf8');
    const findings = [...source.matchAll(/\b(?:rgb|rgba|hsl|hsla)\(([^)]*(?:\)[^)]*)?)\)/gi)].filter(match => !/^var\(--rgb-[\w-]+\)\s*\/\s*(?:\d*\.)?\d+$/i.test(match[1]?.trim() ?? '')).map(match => `src/app/app.css:${lineNumber(source, match.index ?? 0)} ${match[0]}`);

    expect(findings).toEqual([]);
  });

  it('forbids named colors in CSS declarations', () => {
    const source = readFileSync('src/app/app.css', 'utf8');
    const findings = namedColorFindings(source, 'src/app/app.css');

    expect(findings).toEqual([]);
  });

  it('detects named colors embedded in borders, shadows and gradients', () => {
    const sample = '.sample { border: 1px solid green; box-shadow: 0 0 4px black; background: linear-gradient(white, var(--color-paper)); }';

    expect(namedColorFindings(sample, 'sample.css')).toEqual(['sample.css:1 border: green', 'sample.css:1 box-shadow: black', 'sample.css:1 background: white']);
  });
});
