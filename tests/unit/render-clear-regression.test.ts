import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const renderSources = ['../../src/render/renderer.ts', '../../src/render/furnacePanel.ts', '../../src/render/sprites.ts'] as const;

describe('render cleanup regression', () => {
  it.each(renderSources)('%s invokes clear methods instead of referencing them', relativePath => {
    const source = readFileSync(new URL(relativePath, import.meta.url), 'utf8');

    expect(source).not.toMatch(/\.clear\s*;/);
  });
});
