import { describe, expect, it } from 'vitest';

import {
  generatePhrase,
  generateSignatureTheme,
  SIGNATURE_MOTIVE_OFFSETS,
  SIGNATURE_THEME_SEED,
  phraseDurationSeconds,
  type MusicPhrase
} from '@io/generativeMusic';

function assertInBounds(phrase: MusicPhrase): void {
  for (const n of phrase.notes) {
    expect(n.midi, 'midi 0..127').toBeGreaterThanOrEqual(0);
    expect(n.midi, 'midi 0..127').toBeLessThanOrEqual(127);
    expect(n.velocity, 'velocity 0..1').toBeGreaterThanOrEqual(0);
    expect(n.velocity, 'velocity 0..1').toBeLessThanOrEqual(1);
    expect(n.durationBeats, 'duration > 0').toBeGreaterThan(0);
    expect(n.startBeat, 'start >= 0').toBeGreaterThanOrEqual(0);
  }
}

describe('generativeMusic', () => {
  it('is deterministic: identical options produce identical phrases', () => {
    const a = generatePhrase({ seed: 'karma-42', season: 'spring', zone: 'farm', tension: 'calm' });
    const b = generatePhrase({ seed: 'karma-42', season: 'spring', zone: 'farm', tension: 'calm' });
    expect(b).toStrictEqual(a);
  });

  it('changes notes when the seed changes', () => {
    const a = generatePhrase({ seed: 'alpha', season: 'autumn', zone: 'forest', tension: 'calm' });
    const b = generatePhrase({ seed: 'beta', season: 'autumn', zone: 'forest', tension: 'calm' });
    expect(b.notes).not.toStrictEqual(a.notes);
  });

  it('season changes the palette: spring brighter/faster than winter', () => {
    const spring = generatePhrase({ seed: 's', season: 'spring', zone: 'farm', tension: 'calm' });
    const winter = generatePhrase({ seed: 's', season: 'winter', zone: 'farm', tension: 'calm' });
    expect(spring.bpm, 'spring faster than winter').toBeGreaterThan(winter.bpm);
    expect(spring.rootMidi).not.toBe(winter.rootMidi);
    expect(spring.scale).not.toStrictEqual(winter.scale);
  });

  it('tense raises tempo relative to calm', () => {
    const calm = generatePhrase({ seed: 't', season: 'summer', zone: 'market', tension: 'calm' });
    const tense = generatePhrase({ seed: 't', season: 'summer', zone: 'market', tension: 'tense' });
    expect(tense.bpm).toBeGreaterThan(calm.bpm);
    // 紧张默认更短（2 小节）。
    expect(tense.bars).toBeLessThanOrEqual(calm.bars);
  });

  it('zone changes density (market busier than forest)', () => {
    const market = generatePhrase({ seed: 'z', season: 'autumn', zone: 'market', tension: 'calm' });
    const forest = generatePhrase({ seed: 'z', season: 'autumn', zone: 'forest', tension: 'calm' });
    const leadCount = (p: MusicPhrase) => p.notes.filter(n => n.voice === 'lead').length;
    expect(leadCount(market)).toBeGreaterThan(leadCount(forest));
  });

  it('keeps all notes within midi/velocity/duration bounds and sorted by start', () => {
    const phrase = generatePhrase({ seed: 'bounds', season: 'winter', zone: 'tribulation', tension: 'tense' });
    assertInBounds(phrase);
    for (let i = 1; i < phrase.notes.length; i++) {
      expect(phrase.notes[i]!.startBeat).toBeGreaterThanOrEqual(phrase.notes[i - 1]!.startBeat);
    }
    // 四声部至少出现 lead/pad/bass。
    const voices = new Set(phrase.notes.map(n => n.voice));
    expect(voices.has('lead')).toBe(true);
    expect(voices.has('pad')).toBe(true);
    expect(voices.has('bass')).toBe(true);
  });

  it('embeds the signature motive in bar 0 of the signature theme', () => {
    const theme = generateSignatureTheme();
    expect(theme.seed).toBe(generateSignatureTheme().seed);
    const leadBar0 = theme.notes
      .filter(n => n.voice === 'lead' && n.startBeat < theme.beatsPerBar)
      .sort((a, b) => a.startBeat - b.startBeat);
    const motiveMidis = SIGNATURE_MOTIVE_OFFSETS.map(off => theme.rootMidi + 12 + off);
    const heard = leadBar0.map(n => n.midi);
    expect(heard.slice(0, motiveMidis.length), 'bar 0 opens with the signature motive').toStrictEqual(motiveMidis);
  });

  it('signature theme is reproducible across calls (same route, zero commission)', () => {
    const a = generateSignatureTheme();
    const b = generatePhrase({ seed: SIGNATURE_THEME_SEED, season: 'spring', zone: 'farm', tension: 'calm', bars: 8 });
    expect(b).toStrictEqual(a);
  });

  it('reports a positive, stable duration in seconds', () => {
    const phrase = generatePhrase({ seed: 'dur', season: 'summer', zone: 'farm', tension: 'calm' });
    const d = phraseDurationSeconds(phrase);
    expect(d).toBeGreaterThan(0);
    expect(phraseDurationSeconds(phrase)).toBe(d);
  });
});
