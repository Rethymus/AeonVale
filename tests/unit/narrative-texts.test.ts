import { describe, expect, it } from 'vitest';
import { NARRATIVE_GLOSSARY, TONE_PRINCIPLES, glossaryEntryFor, shouldXianxia, type GlossaryStance } from '@app/narrativeTexts';

const VALID_STANCES: ReadonlySet<GlossaryStance> = new Set(['keep', 'xianxia', 'contextual']);

describe('narrative texts glossary (P2-1 first cut)', () => {
  it('every entry is well-formed with non-empty modern/xianxia/rationale and a valid stance', () => {
    expect(NARRATIVE_GLOSSARY.length).toBeGreaterThan(8);
    for (const entry of NARRATIVE_GLOSSARY) {
      expect(entry.modern.length).toBeGreaterThan(0);
      expect(entry.xianxia.length).toBeGreaterThan(0);
      expect(entry.rationale.length).toBeGreaterThan(0);
      expect(VALID_STANCES.has(entry.stance)).toBe(true);
    }
  });

  it('has no duplicate modern terms (lookups must be unambiguous)', () => {
    const moderns = NARRATIVE_GLOSSARY.map(e => e.modern);
    expect(new Set(moderns).size).toBe(moderns.length);
  });

  it('keeps functional/system-joke terms modern on purpose (tone: 凡人吐槽)', () => {
    expect(glossaryEntryFor('系统')?.stance).toBe('keep');
    expect(glossaryEntryFor('设置')?.stance).toBe('keep');
  });

  it('flags clearly game-y terms for xianxia rewrite', () => {
    expect(shouldXianxia('升级')).toBe(true);
    expect(shouldXianxia('经验值')).toBe(true);
    expect(shouldXianxia('商店')).toBe(true);
    expect(shouldXianxia('任务')).toBe(true);
  });

  it('treats operation short-labels as contextual (kept as labels, 古风 in prose)', () => {
    expect(glossaryEntryFor('种植')?.stance).toBe('contextual');
    expect(glossaryEntryFor('收获')?.stance).toBe('contextual');
    expect(shouldXianxia('种植')).toBe(false); // contextual ≠ forced xianxia
  });

  it('returns null for unknown terms instead of inventing a translation', () => {
    expect(glossaryEntryFor('不存在的现代词')).toBeNull();
    expect(shouldXianxia('不存在的现代词')).toBe(false);
  });

  it('exposes documented tone principles for human review', () => {
    expect(TONE_PRINCIPLES.length).toBeGreaterThan(0);
    expect(TONE_PRINCIPLES.some(p => p.includes('凡人'))).toBe(true);
  });
});
