/**
 * 资产像素用的 16 色索引表。
 *
 * 颜色真源在 ColorPalette.ts；本文件只负责把语义色映射为稳定索引，
 * 保持程序化精灵的存档/回放与像素合法性契约不变。
 */
import { ColorPalette, type ColorPaletteKey } from './ColorPalette';

export interface PaletteEntry {
  idx: number;
  name: string;
  /** 渲染用 hex（透明色含 alpha）。 */
  hex: string;
  rgb: readonly [number, number, number];
}

function rgb(color: number): readonly [number, number, number] {
  const value = color >>> 0;
  return [(value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function hex(color: number, alpha = 0xff): string {
  return `#${((color >>> 0) & 0xffffff).toString(16).padStart(6, '0').toUpperCase()}${alpha === 0xff ? '' : alpha.toString(16).padStart(2, '0').toUpperCase()}`;
}

function entry(idx: number, name: string, key: ColorPaletteKey): PaletteEntry {
  const color = ColorPalette[key];
  return { idx, name, hex: hex(color, idx === 0 ? 0 : 0xff), rgb: rgb(color) };
}

export const PALETTE: readonly PaletteEntry[] = [entry(0, 'transparent', 'transparent'), entry(1, 'paper', 'paper'), entry(2, 'ink', 'inkDark'), entry(3, 'mountain', 'mountain'), entry(4, 'moss', 'moss'), entry(5, 'qi', 'qiFlow'), entry(6, 'cinnabar', 'danger'), entry(7, 'gilt', 'gilt'), entry(8, 'loess', 'loess'), entry(9, 'palepurple', 'palePurple'), entry(10, 'moonwhite', 'moonWhite'), entry(11, 'leafdark', 'leafDark'), entry(12, 'soil', 'soil'), entry(13, 'frost', 'frost'), entry(14, 'ember', 'emberWarm'), entry(15, 'shadow', 'inkDeep')];

/** 调色板索引是否合法。 */
export function isPaletteIndex(idx: number): boolean {
  return Number.isInteger(idx) && idx >= 0 && idx < PALETTE.length;
}

/** 取某索引的 RGBA（0=全透明；其余不透明）。非法索引回退透明。 */
export function paletteRgba(idx: number, alpha = 255): readonly [number, number, number, number] {
  const entry = PALETTE[idx];
  if (!entry || idx === 0) return [0, 0, 0, 0];
  const [r, g, b] = entry.rgb;
  return [r, g, b, alpha];
}
