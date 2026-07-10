/**
 * sim/world/types.ts + sim/farm/crop.ts 工具函数单测。
 * 覆盖 fpToMilli / milliToFp / clampMilli / nextSeason / seasonIndex / isMature。
 */
import { describe, it, expect } from 'vitest';
import { fpToMilli, milliToFp, clampMilli, nextSeason, seasonIndex } from '@sim/world/types';
import { isMature } from '@sim/farm/crop';
import type { CropInstance } from '@sim/farm/crop';

describe('types.ts 工具函数', () => {
  it('fpToMilli: float point → 毫点（×1000 取整）', () => {
    expect(fpToMilli(1)).toBe(1000);
    expect(fpToMilli(0.5)).toBe(500);
    expect(fpToMilli(0)).toBe(0);
    expect(fpToMilli(100)).toBe(100_000);
    expect(fpToMilli(1.2345)).toBe(1235); // Math.round
  });

  it('milliToFp: 毫点 → float point（÷1000）', () => {
    expect(milliToFp(1000)).toBe(1);
    expect(milliToFp(500)).toBe(0.5);
    expect(milliToFp(0)).toBe(0);
    expect(milliToFp(100_000)).toBe(100);
  });

  it('fpToMilli / milliToFp 往返', () => {
    for (const v of [0, 1, 10, 50.5, 99, 100]) {
      expect(milliToFp(fpToMilli(v))).toBeCloseTo(v);
    }
  });

  it('clampMilli: 钳制到 [0, 100000] 默认区间', () => {
    expect(clampMilli(50_000)).toBe(50_000);
    expect(clampMilli(-1)).toBe(0);
    expect(clampMilli(100_001)).toBe(100_000);
    expect(clampMilli(0)).toBe(0);
    expect(clampMilli(100_000)).toBe(100_000);
  });

  it('clampMilli: 自定义区间', () => {
    expect(clampMilli(5, 10, 20)).toBe(10);
    expect(clampMilli(25, 10, 20)).toBe(20);
    expect(clampMilli(15, 10, 20)).toBe(15);
  });

  it('nextSeason: 春→夏→秋→冬→春 循环', () => {
    expect(nextSeason('spring')).toBe('summer');
    expect(nextSeason('summer')).toBe('autumn');
    expect(nextSeason('autumn')).toBe('winter');
    expect(nextSeason('winter')).toBe('spring');
  });

  it('seasonIndex: 正确返回索引 0-3', () => {
    expect(seasonIndex('spring')).toBe(0);
    expect(seasonIndex('summer')).toBe(1);
    expect(seasonIndex('autumn')).toBe(2);
    expect(seasonIndex('winter')).toBe(3);
  });
});

describe('crop.ts 工具函数', () => {
  const makeCrop = (growth: number): CropInstance => ({
    id: 1, defId: 'herb.mossling', tileId: 0, growth, health: 100_000,
    stage: growth >= 40_000 ? 'mature' : 'growing',
    plantedDay: 1,
    property: { cold: 0, hot: 0, warm: 0, neutral: 3000 },
    tempered: false,
  });

  it('isMature: growth >= threshold → true', () => {
    expect(isMature(makeCrop(40_000), 40_000)).toBe(true);
    expect(isMature(makeCrop(50_000), 40_000)).toBe(true);
  });

  it('isMature: growth < threshold → false', () => {
    expect(isMature(makeCrop(0), 40_000)).toBe(false);
    expect(isMature(makeCrop(39_999), 40_000)).toBe(false);
  });
});
