import { describe, expect, it, vi } from 'vitest';
import { applyColorPaletteCssVariables, ColorPalette, ROGUELITE_PROTO_PALETTE, cssColor, cssRgb, titleLandscapeCssImage } from '@render/ColorPalette';

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [red, green, blue] = channels.map(channel => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrastRatio(foreground: string, background: string): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe('ColorPalette', () => {
  it('provides the required P0 semantic colors', () => {
    expect(ColorPalette).toMatchObject({
      paper: 0xf4ecd8,
      inkDark: 0x1a1a1f,
      soilFertile: 0xa88b5c,
      qiFlow: 0x4a8c9c,
      danger: 0xb5482f
    });
  });

  it('keeps the production palette within the approved canonical color budget', () => {
    const uniqueColors = new Set(Object.values(ColorPalette));

    expect(uniqueColors.size).toBeGreaterThanOrEqual(16);
    expect(uniqueColors.size).toBeLessThanOrEqual(32);
  });

  it('derives CSS hex and RGB channels from the same Pixi value', () => {
    expect(cssColor('qiFlow')).toBe('#4a8c9c');
    expect(cssRgb('qiFlow')).toBe('74 140 156');
    expect(cssColor('transparent')).toBe('transparent');
    expect(cssRgb('transparent')).toBe('0 0 0');
  });

  it('injects complete color and channel variables into the document root', () => {
    const setProperty = vi.fn();

    applyColorPaletteCssVariables({ style: { setProperty } });

    expect(setProperty).toHaveBeenCalledWith('--color-paper', '#f4ecd8');
    expect(setProperty).toHaveBeenCalledWith('--rgb-paper', '244 236 216');
    expect(setProperty).toHaveBeenCalledWith('--color-transparent', 'transparent');
    expect(setProperty).toHaveBeenCalledWith('--image-title-landscape', titleLandscapeCssImage());
    expect(setProperty).toHaveBeenCalledTimes(Object.keys(ColorPalette).length * 2 + 1);
  });

  it('builds the title landscape image from palette-derived colors', () => {
    const image = titleLandscapeCssImage();
    expect(image).toContain('data:image/svg+xml');
    expect(decodeURIComponent(image)).toContain(cssColor('mountainFar'));
    expect(decodeURIComponent(image)).toContain(cssColor('mistPaper'));
  });

  it('keeps D27 small helper text above WCAG AA contrast on every card background', () => {
    const palette = ROGUELITE_PROTO_PALETTE;
    for (const background of [palette.boardBg, palette.btnBg, palette.floor, palette.soilFill.loam]) {
      expect(contrastRatio(palette.helpText, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
