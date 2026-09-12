import { describe, expect, it } from 'vitest';
import { UI_MODES, deriveUiMode } from '@app/uiMode';

describe('UI mode derivation', () => {
  it('maps every top-level app screen to one authoritative mode', () => {
    expect(deriveUiMode('boot')).toBe('loading');
    expect(deriveUiMode('boot-error')).toBe('boot-error');
    expect(deriveUiMode('title')).toBe('title');
    expect(deriveUiMode('narration')).toBe('narration');
    expect(deriveUiMode('roguelite-proto')).toBe('roguelite-proto');
  });

  it('exposes exactly the retired-shell surface modes', () => {
    // 旧世界退役（docs/21 §8.28）：mode 集收缩为流程壳层的六个屏幕级取值。
    expect([...UI_MODES]).toEqual(['loading', 'boot-error', 'title', 'narration', 'roguelite-proto', 'portrait-blocked']);
  });
});
