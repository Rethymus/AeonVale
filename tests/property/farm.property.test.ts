import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { qiFactor, soilFactor, seasonFactor, careFactor } from '@sim';
import { DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';

const reg = buildRegistry();
const P = DEFAULT_BALANCE;

describe('种田属性测试 (docs/17 §2.2 不变式)', () => {
  it('PBT-qiFactor: 有界 [0, cap]，关于 qiNeed 单调不减', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100_000 }), fc.integer({ min: 1, max: 100_000 }), (qi, need) => {
        const f = qiFactor(qi, need, P.growth.qiFactorCap);
        expect(f).toBeGreaterThanOrEqual(0);
        expect(f).toBeLessThanOrEqual(P.growth.qiFactorCap);
        // 单调：qi↑ ⇒ f↑（同 need）
        const f2 = qiFactor(qi + 1000, need, P.growth.qiFactorCap);
        expect(f2).toBeGreaterThanOrEqual(f);
      }),
    );
  });

  it('PBT-soilFactor: 有界 [min, 1]，关于肥力单调不减', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (fertilityNorm) => {
        const f = soilFactor(fertilityNorm, P.growth.soilFactorMin);
        expect(f).toBeGreaterThanOrEqual(P.growth.soilFactorMin - 1e-9);
        expect(f).toBeLessThanOrEqual(1 + 1e-9);
      }),
    );
  });

  it('PBT-careFactor: 双照料最大(1.0)，双漏最小(0.1)', () => {
    expect(careFactor(true, true)).toBe(1.0);
    expect(careFactor(false, false)).toBe(0.1);
    expect(careFactor(true, false)).toBeGreaterThan(careFactor(false, false));
  });

  it('PBT-seasonFactor: 当季≥弱季', () => {
    const dewroot = reg.herbs.get('herb.dewroot')!; // preferred spring
    expect(seasonFactor(dewroot, 'spring', P.growth.seasonOptimalBonus, P.growth.seasonWeakPenalty)).toBeGreaterThan(
      seasonFactor(dewroot, 'summer', P.growth.seasonOptimalBonus, P.growth.seasonWeakPenalty),
    );
  });

  it('PBT-药性向量四分量非负（内容表约束）', () => {
    fc.assert(
      fc.property(fc.constantFrom(...reg.herbs.values()), (herb) => {
        const { cold, hot, warm, neutral } = herb.baseProperty;
        for (const v of [cold, hot, warm, neutral]) expect(v).toBeGreaterThanOrEqual(0);
      }),
    );
  });
});
