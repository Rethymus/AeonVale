import { describe, expect, it, vi, afterEach } from 'vitest';

import { AudioEngine } from '@io/audio';

describe('AudioEngine', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('layers till sow and water farm SFX with the expected tone and noise building blocks', () => {
    const audio = new AudioEngine();
    const tone = vi.spyOn(audio as never, 'tone').mockImplementation(() => {});
    const noiseBurst = vi.spyOn(audio as never, 'noiseBurst').mockImplementation(() => {});

    Object.assign(audio as object, {
      ctx: { currentTime: 1 },
      master: {},
      noise: {}
    });

    audio.playSfx('till');
    expect(tone).toHaveBeenNthCalledWith(1, 110, 0.1, 0.24, 1, 'sine');
    expect(tone).toHaveBeenNthCalledWith(2, 175, 0.08, 0.12, 1.02, 'triangle');
    expect(noiseBurst).toHaveBeenNthCalledWith(1, 0.08, 0.08, 900, 1.01);

    tone.mockClear();
    noiseBurst.mockClear();

    audio.playSfx('sow');
    expect(tone).toHaveBeenNthCalledWith(1, 520, 0.06, 0.14, 1, 'triangle');
    expect(tone).toHaveBeenNthCalledWith(2, 780, 0.08, 0.1, 1.025, 'sine');
    expect(noiseBurst).toHaveBeenNthCalledWith(1, 0.05, 0.035, 1100, 1.01);

    tone.mockClear();
    noiseBurst.mockClear();

    audio.playSfx('water');
    expect(noiseBurst).toHaveBeenNthCalledWith(1, 0.18, 0.18, 1600, 1);
    expect(tone).toHaveBeenNthCalledWith(1, 980, 0.05, 0.07, 1.015, 'sine');
    expect(tone).toHaveBeenNthCalledWith(2, 760, 0.08, 0.06, 1.06, 'sine');
  });

  it('keeps playSfx as a no-op when audio has not been initialized', () => {
    const audio = new AudioEngine();
    const tone = vi.spyOn(audio as never, 'tone');
    const noiseBurst = vi.spyOn(audio as never, 'noiseBurst');

    expect(() => audio.playSfx('till')).not.toThrow;
    expect(tone).not.toHaveBeenCalled();
    expect(noiseBurst).not.toHaveBeenCalled();
  });

  it('clamps, stores, and applies master volume before or after initialization', () => {
    const master = { gain: { value: 0 }, connect: vi.fn() };
    vi.stubGlobal(
      'AudioContext',
      class {
        readonly sampleRate = 1;
        readonly destination = {};
        createGain(): typeof master {
          return master;
        }
        createBuffer(): { getChannelData: () => Float32Array } {
          return { getChannelData: () => new Float32Array(1) };
        }
        resume(): Promise<void> {
          return Promise.resolve();
        }
      }
    );
    const audio = new AudioEngine();
    expect(audio.getMasterVolume()).toBe(35);

    audio.setMasterVolume(-20);
    expect(audio.getMasterVolume()).toBe(0);
    audio.setMasterVolume(140);
    expect(audio.getMasterVolume()).toBe(100);

    audio.setMasterVolume(62);
    audio.init();
    expect(master.gain.value).toBe(0.62);

    audio.setMasterVolume(48);
    expect(audio.getMasterVolume()).toBe(48);
    expect(master.gain.value).toBe(0.48);
    audio.setMasterVolume(61.6);
    expect(audio.getMasterVolume()).toBe(62);
    expect(master.gain.value).toBe(0.62);
  });
});
