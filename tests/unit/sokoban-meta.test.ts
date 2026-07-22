/**
 * R4′ meta 硬传承 · 纯 transition 逻辑测试（不测 localStorage）。
 * 覆盖：初始解锁、突破/死亡的残卷解锁与计数、idempotent、硬传承（死亡保 maxStageSolved）。
 */
import { describe, expect, test } from 'vitest';
import {
  SCROLL_PAGES,
  emptyMeta,
  isStageUnlocked,
  recordBreakthrough,
  recordDeath
} from '../../src/app/rogueliteProto/meta';

describe('sokoban meta · 初始与解锁门', () => {
  test('初始仅 stage 0 可游玩，无残卷', () => {
    const m = emptyMeta();
    expect(isStageUnlocked(m, 0)).toBe(true);
    expect(isStageUnlocked(m, 1)).toBe(false);
    expect(m.unlockedScrolls).toEqual([]);
    expect(m.maxStageSolved).toBe(-1);
  });
});

describe('sokoban meta · 突破', () => {
  test('通关 stage 0：maxStageSolved=0、解锁残卷 0、突破+1、stage 1 解锁', () => {
    const r = recordBreakthrough(emptyMeta(), 0);
    expect(r.meta.maxStageSolved).toBe(0);
    expect(r.meta.breakthroughs).toBe(1);
    expect(r.meta.unlockedScrolls).toEqual([0]);
    expect(r.unlockedScroll?.title).toBe(SCROLL_PAGES[0]?.title);
    expect(isStageUnlocked(r.meta, 1)).toBe(true);
  });

  test('idempotent：同阶二次通关不重复解锁残卷', () => {
    const a = recordBreakthrough(emptyMeta(), 1).meta;
    const b = recordBreakthrough(a, 1);
    expect(b.meta.unlockedScrolls).toEqual([1]);
    expect(b.unlockedScroll).toBeNull();
    expect(b.meta.breakthroughs).toBe(2);
  });

  test('通关更高阶推进 maxStageSolved', () => {
    let m = recordBreakthrough(emptyMeta(), 0).meta;
    m = recordBreakthrough(m, 1).meta;
    m = recordBreakthrough(m, 2).meta;
    expect(m.maxStageSolved).toBe(2);
    expect(isStageUnlocked(m, 3)).toBe(true);
    expect(isStageUnlocked(m, 4)).toBe(false);
  });
});

describe('sokoban meta · 死亡(硬传承)', () => {
  test('死亡：死亡计数+1、解锁当阶残卷(灰烬传承)、maxStageSolved 保留', () => {
    const climbed = recordBreakthrough(emptyMeta(), 0).meta; // 已通关 stage 0
    const r = recordDeath(climbed, 1); // 在 stage 1 渡劫失败
    expect(r.meta.deathCount).toBe(1);
    expect(r.meta.breakthroughs).toBe(1);
    expect(r.meta.maxStageSolved).toBe(0); // 保留：硬传承不锁进度
    expect(r.meta.unlockedScrolls).toContain(0);
    expect(r.meta.unlockedScrolls).toContain(1);
    expect(r.unlockedScroll?.title).toBe(SCROLL_PAGES[1]?.title);
  });

  test('从零死亡也解锁残卷 0', () => {
    const r = recordDeath(emptyMeta(), 0);
    expect(r.meta.deathCount).toBe(1);
    expect(r.meta.unlockedScrolls).toEqual([0]);
    expect(r.meta.maxStageSolved).toBe(-1); // 仍未通关任何阶
  });

  test('死后重爬：已解锁阶段仍可游玩', () => {
    let m = recordBreakthrough(emptyMeta(), 0).meta;
    m = recordBreakthrough(m, 1).meta;
    m = recordDeath(m, 2).meta; // 在 stage 2 死
    // 掉境界重爬：stage 0/1/2 仍可游玩（maxStageSolved=1 → 解锁到 2）
    expect(isStageUnlocked(m, 0)).toBe(true);
    expect(isStageUnlocked(m, 1)).toBe(true);
    expect(isStageUnlocked(m, 2)).toBe(true);
    expect(isStageUnlocked(m, 3)).toBe(false);
  });
});
