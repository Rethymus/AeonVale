import { afterEach, describe, expect, it } from 'vitest';
import { gameEntryPath } from '../browser/openGame';

const originalBasePath = process.env.PLAYWRIGHT_GAME_BASE_PATH;

afterEach(() => {
  if (originalBasePath === undefined) delete process.env.PLAYWRIGHT_GAME_BASE_PATH;
  else process.env.PLAYWRIGHT_GAME_BASE_PATH = originalBasePath;
});

describe('browser game entry path', () => {
  it('uses the root entry by default for local preview', () => {
    delete process.env.PLAYWRIGHT_GAME_BASE_PATH;
    expect(gameEntryPath()).toBe('/');
  });

  it('normalizes the GitHub Pages subpath with a trailing slash', () => {
    process.env.PLAYWRIGHT_GAME_BASE_PATH = '/AeonVale';
    expect(gameEntryPath()).toBe('/AeonVale/');
  });
});
