import { describe, expect, it, vi } from 'vitest';
import { applyColorPaletteCssVariables, ColorPalette, cssColor, cssRgb, titleLandscapeCssImage } from '@render/ColorPalette';

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
});
