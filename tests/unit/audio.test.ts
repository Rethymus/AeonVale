import { describe, expect, it, vi, afterEach } from 'vitest';

import { AudioEngine, renderSfxrSamples, SFX_PRESETS, type SfxrParams } from '@io/audio';

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

describe('sfxr renderer (bfxr/jsfxr-style)', () => {
  const coinParams = SFX_PRESETS['coin']!;

  it('renders deterministic samples: identical params ⇒ identical buffer', () => {
    const a = renderSfxrSamples(44100, coinParams);
    const b = renderSfxrSamples(44100, coinParams);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  it('keeps samples within ±gain bounds and correct length', () => {
    const samples = renderSfxrSamples(44100, coinParams);
    expect(samples.length).toBe(Math.floor(coinParams.duration * 44100));
    const eps = 1e-6;
    for (const s of samples) {
      expect(s).toBeGreaterThanOrEqual(-coinParams.gain - eps);
      expect(s).toBeLessThanOrEqual(coinParams.gain + eps);
    }
  });

  it('different waveforms produce different renders', () => {
    const sine = renderSfxrSamples(44100, { ...coinParams, wave: 'sine' });
    const square = renderSfxrSamples(44100, { ...coinParams, wave: 'square' });
    let diff = 0;
    for (let i = 0; i < sine.length; i++) diff += Math.abs(sine[i]! - square[i]!);
    expect(diff).toBeGreaterThan(0);
  });

  it('playSfx routes preset-driven SFX through sfxrSynth and skips hand-tuned tone/noise', () => {
    const audio = new AudioEngine();
    const sfxrSynth = vi.spyOn(audio as never, 'sfxrSynth').mockImplementation(() => {});
    const tone = vi.spyOn(audio as never, 'tone');
    const noiseBurst = vi.spyOn(audio as never, 'noiseBurst');
    Object.assign(audio as object, { ctx: { currentTime: 2, sampleRate: 44100 }, master: {}, noise: {} });

    audio.playSfx('coin');
    expect(sfxrSynth).toHaveBeenCalledWith(SFX_PRESETS['coin'], 2);
    expect(tone).not.toHaveBeenCalled();
    expect(noiseBurst).not.toHaveBeenCalled();

    sfxrSynth.mockClear();
    audio.playSfx('cultivate');
    expect(sfxrSynth).toHaveBeenCalledWith(SFX_PRESETS['cultivate'], 2);
  });

  it('registers all four new preset-driven SFX ids', () => {
    expect(Object.keys(SFX_PRESETS).sort()).toStrictEqual(['array-place', 'coin', 'cultivate', 'spirit-stone']);
  });

  it('validates a preset satisfies the SfxrParams contract', () => {
    const checked: SfxrParams[] = Object.values(SFX_PRESETS) as SfxrParams[];
    expect(checked.length).toBe(4);
    for (const p of checked) {
      expect(p.duration).toBeGreaterThan(0);
      expect(p.gain).toBeGreaterThan(0);
      expect(p.gain).toBeLessThanOrEqual(1);
      expect(p.startFreq).toBeGreaterThan(0);
      expect(['square', 'sawtooth', 'sine', 'noise']).toContain(p.wave);
    }
  });
});
