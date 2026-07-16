/**
  * 全局限定调色板。
 *
  * 索引 0 保留为「透明」（精灵像素 0 = 不绘制）；1–15 为可见色。
  * 程序化精灵（sprites.ts）与未来手绘资产都引用这些索引，保证全场色彩统一、色盲友好。
 */
export interface PaletteEntry {
 idx: number;
 name: string;
 /** 渲染用 hex（透明色含 alpha）。 */
 hex: string;
 rgb: readonly [number, number, number];
}

export const PALETTE: readonly PaletteEntry[] = [
 { idx: 0, name: 'transparent', hex: '#00000000', rgb: [0, 0, 0] }, // 透明（精灵留白）
 { idx: 1, name: 'paper', hex: '#F4ECD8', rgb: [244, 236, 216] }, // 宣纸底
 { idx: 2, name: 'ink', hex: '#1A1A1F', rgb: [26, 26, 31] }, // 墨黑（文字/描边/夜）
 { idx: 3, name: 'mountain', hex: '#5C6B73', rgb: [92, 107, 115] }, // 远山黛
 { idx: 4, name: 'moss', hex: '#7A8C5A', rgb: [122, 140, 90] }, // 苔青（草地/灵气/茎）
 { idx: 5, name: 'qi', hex: '#4A8C9C', rgb: [74, 140, 156] }, // 灵气青（阵法）
 { idx: 6, name: 'cinnabar', hex: '#B5482F', rgb: [181, 72, 47] }, // 朱砂（警示/丹炉火）
 { idx: 7, name: 'gilt', hex: '#C9A14A', rgb: [201, 161, 74] }, // 鎏金（修为/突破/稀有）
 { idx: 8, name: 'loess', hex: '#A88B5C', rgb: [168, 139, 92] }, // 玄黄（土壤）
 { idx: 9, name: 'palepurple', hex: '#7B6C8A', rgb: [123, 108, 138] }, // 雪青（紫雷/危险）
 { idx: 10, name: 'moonwhite', hex: '#E8E8E0', rgb: [232, 232, 224] }, // 月白（清冷/月光）
 { idx: 11, name: 'leafdark', hex: '#3A6A28', rgb: [58, 106, 40] }, // 深叶
 { idx: 12, name: 'soil', hex: '#6B4F2A', rgb: [107, 79, 42] }, // 深土/根
 { idx: 13, name: 'frost', hex: '#9FB6C4', rgb: [159, 182, 196] }, // 寒霜（寒性）
 { idx: 14, name: 'ember', hex: '#D98641', rgb: [217, 134, 65] }, // 余烬（热性）
 { idx: 15, name: 'shadow', hex: '#0E0E14', rgb: [14, 14, 20] }, // 极夜（最深阴影）
];

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
