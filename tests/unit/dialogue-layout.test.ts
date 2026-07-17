import { describe, expect, it } from 'vitest';
import { NARRATIVE_BEATS } from '@content/narrative';
import { DIALOGUE_CONTINUE_PROMPT, DIALOGUE_LAYOUT_LIMITS, dialogueBoxLayout, dialogueTextLayoutStyle } from '@render/renderer';

const DIALOGUE_FONT_SIZE = 15;

function conservativeTextHeight(lines: readonly string[], hasPortrait: boolean): number {
  const style = dialogueTextLayoutStyle(hasPortrait);
  // CJK glyphs are approximately one font-size wide. Reserving five extra glyphs per
  // row makes this estimate stricter than the runtime LXGW WenKai measurement.
  const graphemesPerLine = Math.max(1, Math.floor(style.wordWrapWidth / DIALOGUE_FONT_SIZE) - 5);
  const wrappedLineCount = (line: string): number => Math.max(1, Math.ceil(Array.from(line).length / graphemesPerLine));
  const contentLines = lines.reduce((total, line) => total + wrappedLineCount(line), 0);
  const promptLines = wrappedLineCount(DIALOGUE_CONTINUE_PROMPT);
  return (contentLines + 1 + promptLines) * style.lineHeight;
}

function expectLayoutContainsText(textHeight: number, hasPortrait: boolean): void {
  const layout = dialogueBoxLayout(textHeight, hasPortrait);
  const style = dialogueTextLayoutStyle(hasPortrait);

  expect(layout.y).toBeGreaterThanOrEqual(DIALOGUE_LAYOUT_LIMITS.safeTop);
  expect(layout.y + layout.height).toBe(DIALOGUE_LAYOUT_LIMITS.bottom);
  expect(layout.y + layout.height).toBeLessThan(DIALOGUE_LAYOUT_LIMITS.bottomUiTop);
  expect(layout.textY + textHeight).toBeLessThanOrEqual(layout.y + layout.height - DIALOGUE_LAYOUT_LIMITS.paddingY);
  expect(layout.textX + style.wordWrapWidth).toBeLessThanOrEqual(layout.x + layout.width - DIALOGUE_LAYOUT_LIMITS.paddingX);

  if (hasPortrait) {
    expect(layout.portraitY + layout.portraitSize).toBeLessThanOrEqual(layout.y + layout.height - DIALOGUE_LAYOUT_LIMITS.paddingY);
  }
}

describe('dialogue layout', () => {
  it('keeps the compact dialogue footprint while growing upward for longer copy', () => {
    const compact = dialogueBoxLayout(80, false);
    // minHeight 110 + paddingY 14 → compact box leaves more of the farm visible (player audit P1)
    expect(compact).toMatchObject({ x: 40, y: 324, width: 600, height: 110 });

    const expanded = dialogueBoxLayout(176, false);
    expect(expanded.y).toBeLessThan(compact.y);
    expect(expanded.height).toBe(204);
    expect(expanded.y + expanded.height).toBe(DIALOGUE_LAYOUT_LIMITS.bottom);
  });

  it('uses grapheme-breaking word wrap for CJK and unbroken English tokens', () => {
    const plain = dialogueTextLayoutStyle(false);
    const portrait = dialogueTextLayoutStyle(true);

    expect(plain).toMatchObject({ wordWrap: true, breakWords: true, lineHeight: 22, wordWrapWidth: 564 });
    expect(portrait).toMatchObject({ wordWrap: true, breakWords: true, lineHeight: 22, wordWrapWidth: 452 });

    const mixedLines = ['采药女·SeasonalCultivationRouteWithoutWhitespaceOrManualBreaks', '把灵草、spiritStoneReserveAndArrayCoreInventory、丹药与引劫准备接成同一条日常动线。', 'NextStep:ReturnToTheFarmsteadAndKeepTheSecondHarvestMoving。'];
    const textHeight = conservativeTextHeight(mixedLines, true);
    expect(textHeight).toBeGreaterThan(DIALOGUE_LAYOUT_LIMITS.minHeight);
    expectLayoutContainsText(textHeight, true);
  });

  it.each(NARRATIVE_BEATS)('keeps narrative beat $id inside the safe dialogue region', beat => {
    const textHeight = conservativeTextHeight(beat.lines, false);
    expectLayoutContainsText(textHeight, false);
  });

  it('fails explicitly when full copy cannot fit between the HUD and bottom commands', () => {
    const maximumTextHeight = DIALOGUE_LAYOUT_LIMITS.bottom - DIALOGUE_LAYOUT_LIMITS.safeTop - DIALOGUE_LAYOUT_LIMITS.paddingY * 2;

    expect(dialogueBoxLayout(maximumTextHeight, false).y).toBe(DIALOGUE_LAYOUT_LIMITS.safeTop);
    // bottom 434 - safeTop 70 = 364px available for the full plate including padding
    expect(() => dialogueBoxLayout(maximumTextHeight + 1, false)).toThrow(/only 364px is available/);
    expect(() => dialogueBoxLayout(Number.NaN, false)).toThrow(/finite non-negative/);
  });
});
