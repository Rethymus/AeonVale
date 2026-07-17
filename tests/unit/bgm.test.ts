import { describe, expect, it } from 'vitest';

import { GenerativeBgm } from '@io/bgm';

describe('GenerativeBgm (Node/no-audio safety)', () => {
  it('is inactive by default and does not throw on stop', () => {
    const bgm = new GenerativeBgm();
    expect(bgm.isActive()).toBe(false);
    expect(() => bgm.dispose()).not.toThrow();
  });

  it('setContext(active:false) is a safe no-op in Node', async () => {
    const bgm = new GenerativeBgm();
    await expect(bgm.setContext({ season: 'spring', zone: 'farm', tension: 'calm', active: false })).resolves.toBeUndefined();
    expect(bgm.isActive()).toBe(false);
  });

  it('setContext(active:true) does not throw when no browser audio is available', async () => {
    const bgm = new GenerativeBgm();
    await expect(bgm.setContext({ season: 'winter', zone: 'tribulation', tension: 'tense', active: true })).resolves.toBeUndefined();
    // Node 无 window/AudioContext，驱动不应真正激活。
    expect(bgm.isActive()).toBe(false);
  });

  it('playSignature toggles without throwing in Node', async () => {
    const bgm = new GenerativeBgm();
    await expect(bgm.playSignature(true)).resolves.toBeUndefined();
    await expect(bgm.playSignature(false)).resolves.toBeUndefined();
  });

  it('stores master volume without throwing', () => {
    const bgm = new GenerativeBgm();
    expect(() => bgm.setMasterVolume(50)).not.toThrow();
    bgm.dispose();
  });
});
