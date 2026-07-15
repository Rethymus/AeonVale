import { describe, expect, it, vi, afterEach } from 'vitest';

import { AudioEngine } from '@io/audio';

describe('AudioEngine', () => {
 afterEach(() => {
 vi.restoreAllMocks();
 });

it('layers till sow and water farm SFX with the expected tone and noise building blocks', () => {
 const audio = new AudioEngine();
 const tone = vi.spyOn(audio as never, 'tone').mockImplementation(() => {});
 const noiseBurst = vi.spyOn(audio as never, 'noiseBurst').mockImplementation(() => {});

Object.assign(audio as object, {
 ctx: { currentTime: 1 },
 master: {},
 noise: {},
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
});
