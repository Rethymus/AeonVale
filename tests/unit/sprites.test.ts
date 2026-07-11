/**
 * 程序化精灵 + 调色板单测（docs/13 §1.1/§3.2）。
 * 锁定：调色板完整、生成确定性、像素合法、品阶缩放、元素配色、RGBA 转换。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  PALETTE,
  isPaletteIndex,
  paletteRgba,
} from '../../src/render/palette';
import {
  generateHerbSprite,
  registerSprite,
  getSprite,
  clearSprites,
  toRgba,
  SPRITE_SIZE,
} from '../../src/render/sprites';

function nonZero(pixels: { data: Uint8Array }): number {
  let n = 0;
  for (const v of pixels.data) if (v !== 0) n++;
  return n;
}

describe('调色板（docs/13 §3.2）', () => {
  it('16 个条目，idx 0 为透明', () => {
    expect(PALETTE).toHaveLength(16);
    expect(PALETTE[0]?.name).toBe('transparent');
  });

  it('idx 与数组位置一致，rgb 与 hex 自洽', () => {
    for (const e of PALETTE) {
      expect(e.idx).toBe(PALETTE.indexOf(e));
      expect(isPaletteIndex(e.idx)).toBe(true);
    }
    expect(isPaletteIndex(-1)).toBe(false);
    expect(isPaletteIndex(16)).toBe(false);
  });

  it('paletteRgba：0 全透明，其余不透明', () => {
    expect(paletteRgba(0)).toEqual([0, 0, 0, 0]);
    const [, , , a] = paletteRgba(6);
    expect(a).toBe(255);
  });
});

describe('程序化灵草精灵生成', () => {
  it('确定性：同 id 同 tier 同元素 → 逐字节相等', () => {
    const a = generateHerbSprite({ id: 'herb.frostmarrow', tier: 3, element: 'cold' });
    const b = generateHerbSprite({ id: 'herb.frostmarrow', tier: 3, element: 'cold' });
    expect(a.data).toEqual(b.data);
    expect(a.width).toBe(SPRITE_SIZE);
    expect(a.height).toBe(SPRITE_SIZE);
    expect(a.data.length).toBe(SPRITE_SIZE * SPRITE_SIZE);
  });

  it('所有像素都是合法调色板索引（0–15，§3.4）', () => {
    const s = generateHerbSprite({ id: 'herb.dewroot', tier: 5, element: 'warm' });
    for (const v of s.data) expect(isPaletteIndex(v)).toBe(true);
  });

  it('非空：至少有茎/叶/花的可见像素', () => {
    const s = generateHerbSprite({ id: 'herb.mossling', tier: 1 });
    expect(nonZero(s)).toBeGreaterThan(30);
  });

  it('品阶缩放：tier9 像素数 ≥ tier1', () => {
    const low = nonZero(generateHerbSprite({ id: 'herb.x', tier: 1 }));
    const high = nonZero(generateHerbSprite({ id: 'herb.x', tier: 9 }));
    expect(high).toBeGreaterThanOrEqual(low);
  });

  it('不同 id 产生不同像素', () => {
    const a = generateHerbSprite({ id: 'herb.alpha', tier: 3 });
    const b = generateHerbSprite({ id: 'herb.beta', tier: 3 });
    expect(a.data).not.toEqual(b.data);
  });

  it('元素影响花/果配色：cold→寒霜(13)，hot→朱砂(6)', () => {
    const cold = generateHerbSprite({ id: 'herb.same', tier: 4, element: 'cold' });
    const hot = generateHerbSprite({ id: 'herb.same', tier: 4, element: 'hot' });
    expect(cold.data.includes(13)).toBe(true);
    expect(hot.data.includes(6)).toBe(true);
  });

  it('高品阶带鎏金(7)点缀', () => {
    const s = generateHerbSprite({ id: 'herb.rare', tier: 7 });
    expect(s.data.includes(7)).toBe(true);
  });
});

describe('AssetId 精灵索引 + RGBA 转换', () => {
  beforeEach(() => clearSprites());

  it('register/get/clear', () => {
    const s = generateHerbSprite({ id: 'herb.tmp', tier: 2 });
    registerSprite('sprite.herb.tmp', s);
    expect(getSprite('sprite.herb.tmp')?.data).toEqual(s.data);
    expect(getSprite('sprite.missing')).toBeUndefined();
    clearSprites();
    expect(getSprite('sprite.herb.tmp')).toBeUndefined();
  });

  it('toRgba：长度=wh*4，透明像素 alpha=0，非透明 alpha=255 且颜色匹配调色板', () => {
    const s = generateHerbSprite({ id: 'herb.c', tier: 3, element: 'qi' });
    const rgba = toRgba(s);
    expect(rgba.length).toBe(SPRITE_SIZE * SPRITE_SIZE * 4);
    let hasTransparent = false;
    let hasOpaque = false;
    for (let i = 0; i < s.data.length; i++) {
      const idx = s.data[i] ?? 0;
      const a = rgba[i * 4 + 3];
      if (idx === 0) {
        expect(a).toBe(0);
        hasTransparent = true;
      } else {
        expect(a).toBe(255);
        const [pr, pg, pb] = PALETTE[idx]!.rgb;
        expect(rgba[i * 4]).toBe(pr);
        expect(rgba[i * 4 + 1]).toBe(pg);
        expect(rgba[i * 4 + 2]).toBe(pb);
        hasOpaque = true;
      }
    }
    expect(hasTransparent).toBe(true); // 32x32 必有留白
    expect(hasOpaque).toBe(true);
  });
});
