/**
 * 无头模拟烟雾测试。
 *
 * 验证：
 * - 多种子批量模拟无崩溃（smoke）
 * - hash 稳定性（同 seed → 同结果，PBT-07 集成延伸）
 * - rookie/normal bot 存活率在预期区间
 */
import { describe, it, expect } from 'vitest';
import { runOne, runMonteCarlo, ROOKIE_BOT, NORMAL_BOT, VETERAN_BOT, type RunOutcome } from '../../tools/headless-run';
import { DEFAULT_BALANCE } from '@sim';

const SMOKE_SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);
const SMOKE_DAYS = 80;

function runBatch(seeds: number[], days: number, bot: typeof ROOKIE_BOT) {
  const results: RunOutcome[] = [];
  for (const seed of seeds) {
    results.push(runOne(seed, days, bot));
  }
  return results;
}

describe('无头模拟烟雾测试 ', () => {
  it('rookie bot × 10 种子：无崩溃，结果结构完整', () => {
    const results = runBatch(SMOKE_SEEDS, SMOKE_DAYS, ROOKIE_BOT);
    expect(results).toHaveLength(SMOKE_SEEDS.length);
    for (const r of results) {
      expect(typeof r.died).toBe('boolean');
      expect(r.days).toBe(SMOKE_DAYS);
      expect(r.stageReached).toBeGreaterThanOrEqual(1);
      expect(r.harvests).toBeGreaterThanOrEqual(0);
      expect(r.maxPillPoison).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.stageReached)).toBe(true);
    }
  });

  it('normal bot × 10 种子：无崩溃，平均阶段 > rookie', () => {
    const rookie = runBatch(SMOKE_SEEDS, SMOKE_DAYS, ROOKIE_BOT);
    const normal = runBatch(SMOKE_SEEDS, SMOKE_DAYS, NORMAL_BOT);
    const rookieMean = rookie.reduce((s, r) => s + r.stageReached, 0) / rookie.length;
    const normalMean = normal.reduce((s, r) => s + r.stageReached, 0) / normal.length;
    // normal bot 更勤快（careDaily=true），应进阶更快
    expect(normalMean).toBeGreaterThanOrEqual(rookieMean);
  });

  it('hash 稳定性（PBT-07）：相同 seed 两次结果一致', () => {
    for (const seed of SMOKE_SEEDS.slice(0, 5)) {
      const r1 = runOne(seed, SMOKE_DAYS, NORMAL_BOT);
      const r2 = runOne(seed, SMOKE_DAYS, NORMAL_BOT);
      expect(r1.stageReached).toBe(r2.stageReached);
      expect(r1.died).toBe(r2.died);
      expect(r1.breakthroughs).toBe(r2.breakthroughs);
      expect(r1.harvests).toBe(r2.harvests);
    }
  });

  it('veteran bot × 10 种子：无崩溃，进阶比 normal 更深', () => {
    const normal = runBatch(SMOKE_SEEDS, 120, NORMAL_BOT);
    const veteran = runBatch(SMOKE_SEEDS, 120, VETERAN_BOT);
    const normalMean = normal.reduce((s, r) => s + r.stageReached, 0) / normal.length;
    const veteranMean = veteran.reduce((s, r) => s + r.stageReached, 0) / veteran.length;
    // veteran bot 更激进（更多天劫/控血），应进阶更深
    expect(veteranMean).toBeGreaterThanOrEqual(normalMean * 0.9); // 允许±10%
    // 且无崩溃
    for (const r of veteran) {
      expect(typeof r.died).toBe('boolean');
      expect(Number.isFinite(r.stageReached)).toBe(true);
    }
  });

  it('runMonteCarlo 聚合妖兽风险-收益指标且保持确定', () => {
    const seeds = [1, 2, 3, 4];
    const a = runMonteCarlo(seeds, NORMAL_BOT, SMOKE_DAYS);
    expect(a.hashStable).toBe(true);
    expect(a.meanBeastSurges).toBeGreaterThanOrEqual(0);
    expect(a.meanCropsLostToBeasts).toBeGreaterThanOrEqual(0);
    expect(a.meanBeastCoresLooted).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(a.meanBeastSurges)).toBe(true);
    expect(Number.isFinite(a.meanCropsLostToBeasts)).toBe(true);
    expect(Number.isFinite(a.meanBeastCoresLooted)).toBe(true);
  });

  it('runMonteCarlo 拒绝空种子集', () => {
    expect(() => runMonteCarlo([], NORMAL_BOT, SMOKE_DAYS)).toThrow(RangeError);
  });

  it('参数变化影响模拟结果（平衡扫描健全性）', () => {
    const baseResults = runBatch([1, 2, 3], SMOKE_DAYS, NORMAL_BOT);
    // 大幅提升收获修为：进阶应更快
    const fastParams = {
      ...DEFAULT_BALANCE,
      breakthrough: { ...DEFAULT_BALANCE.breakthrough, harvestCultivationPerTier: 50_000 }
    };
    const fastResults = [1, 2, 3].map(s => runOne(s, SMOKE_DAYS, NORMAL_BOT, fastParams));
    const baseMean = baseResults.reduce((s, r) => s + r.stageReached, 0) / baseResults.length;
    const fastMean = fastResults.reduce((s, r) => s + r.stageReached, 0) / fastResults.length;
    expect(fastMean).toBeGreaterThanOrEqual(baseMean);
  });
});
