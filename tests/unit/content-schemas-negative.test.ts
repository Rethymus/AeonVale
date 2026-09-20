/**
 * 内容表 Zod schema · 负向校验矩阵（TT-05，docs/12 内容管线契约）。
 *
 * schema 是内容管线的守门人：content-lint 与启动时 buildRegistry 都依赖它
 * **真的会拦**。此前只有正向注册完整性测试，schema 从未喂过脏数据。本文件钉：
 *  - 越界值/错型/坏枚举必拒，且报错含字段路径（docs/12 承诺）；
 *  - 当前宽容策略：未知字段剥离（非 strict）、propertyVector 允许负整数。
 */
import { describe, expect, it } from 'vitest';

import {
  itemSchema,
  propertyVectorSchema,
  seasonSchema,
  spiritHerbSchema,
  yieldDropSchema
} from '@content/schemas';
import { buildRegistry, isSchemaHashCompatible } from '@content/registry';

function herbWith(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'test-herb',
    displayName: '试验灵草',
    tier: 1,
    baseProperty: { cold: 0, hot: 0, warm: 1, neutral: 0 },
    baseGrowth: 1,
    growthThreshold: 10,
    qiNeed: 5,
    qiDrainPerDay: 1,
    metalAttract: 0.5,
    seedId: 'test-herb-seed',
    rawPoisonValue: 2,
    yield: [{ itemId: 'test-herb', count: 2 }],
    ...overrides
  };
}

describe('spiritHerbSchema · tier 越界必拒', () => {
  it.each([6, 0, -1, 1.5, '3', null])('tier=%p → 拒绝且路径含 tier', tier => {
    const result = spiritHerbSchema.safeParse(herbWith({ tier }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.includes('tier'))).toBe(true);
    }
  });

  it('tier 1-5 → 接受（闭区间现状）', () => {
    for (const tier of [1, 2, 3, 4, 5]) {
      expect(spiritHerbSchema.safeParse(herbWith({ tier })).success).toBe(true);
    }
  });
});

describe('spiritHerbSchema · 数值下界与必填', () => {
  it.each(['baseGrowth', 'growthThreshold', 'qiNeed', 'qiDrainPerDay', 'metalAttract', 'rawPoisonValue'])('%s 负值 → 拒绝', field => {
    expect(spiritHerbSchema.safeParse(herbWith({ [field]: -0.1 })).success).toBe(false);
  });

  it('零值接受（下界闭区间）', () => {
    const zeroed = ['baseGrowth', 'growthThreshold', 'qiNeed', 'qiDrainPerDay', 'metalAttract', 'rawPoisonValue']
      .reduce((acc, field) => ({ ...acc, [field]: 0 }), {} as Record<string, unknown>);
    expect(spiritHerbSchema.safeParse(herbWith(zeroed)).success).toBe(true);
  });

  it('必填字段缺失 → 拒绝且路径指到该字段', () => {
    const { seedId: _dropped, ...missing } = herbWith({});
    const result = spiritHerbSchema.safeParse(missing);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.includes('seedId'))).toBe(true);
    }
  });

  it('季节枚举：四季节接受、"rainy" 拒绝且路径含 preferredSeason', () => {
    expect(spiritHerbSchema.safeParse(herbWith({ preferredSeason: 'spring' })).success).toBe(true);
    const result = spiritHerbSchema.safeParse(herbWith({ preferredSeason: 'rainy' }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some(issue => issue.path.includes('preferredSeason'))).toBe(true);
    }
  });

  it('未知字段被剥离（非 strict 现状：不拒、不透传）', () => {
    const result = spiritHerbSchema.parse(herbWith({ evil: 'x' }));
    expect((result as Record<string, unknown>).evil).toBeUndefined();
  });
});

describe('propertyVector / yieldDrop / season / item · 边界', () => {
  it('四气必须为整数（小数拒、负整数现状允许）', () => {
    expect(propertyVectorSchema.safeParse({ cold: 0.5, hot: 0, warm: 0, neutral: 0 }).success).toBe(false);
    expect(propertyVectorSchema.safeParse({ cold: -3, hot: 0, warm: 0, neutral: 0 }).success).toBe(true);
    expect(propertyVectorSchema.safeParse({ cold: 1, hot: 1, warm: 1 }).success).toBe(false);
  });

  it('掉落：count 非负整数、chance ∈ [0,1] 且可省略', () => {
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: -1 }).success).toBe(false);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 1.5 }).success).toBe(false);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 0 }).success).toBe(true);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 1, chance: 1 }).success).toBe(true);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 1, chance: 1.01 }).success).toBe(false);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 1, chance: -0.01 }).success).toBe(false);
    expect(yieldDropSchema.safeParse({ itemId: 'x', count: 1, chance: Number.NaN }).success).toBe(false);
  });

  it('季节枚举：合法四值之外全拒', () => {
    expect(seasonSchema.safeParse('winter').success).toBe(true);
    expect(seasonSchema.safeParse('rainy').success).toBe(false);
    expect(seasonSchema.safeParse('').success).toBe(false);
  });

  it('物品：stack ≥1 整数、品类枚举白名单、报错含路径', () => {
    expect(itemSchema.safeParse({ id: 'a', displayName: '甲', category: 'tool', stack: 1 }).success).toBe(true);
    expect(itemSchema.safeParse({ id: 'a', displayName: '甲', category: 'tool', stack: 0 }).success).toBe(false);
    expect(itemSchema.safeParse({ id: 'a', displayName: '甲', category: 'tool', stack: 2.5 }).success).toBe(false);
    const badCategory = itemSchema.safeParse({ id: 'a', displayName: '甲', category: 'artifact', stack: 1 });
    expect(badCategory.success).toBe(false);
    if (!badCategory.success) {
      expect(badCategory.error.issues.some(issue => issue.path.includes('category'))).toBe(true);
    }
    expect(itemSchema.safeParse({ id: 'a', displayName: '甲', category: 'consumable', stack: 9, description: '说明' }).success).toBe(true);
  });
});

describe('schemaHash 兼容判定 · isSchemaHashCompatible', () => {
  it('当前指纹匹配自身；未定义/空串/未知指纹 → 不兼容', () => {
    const registry = buildRegistry();
    expect(isSchemaHashCompatible(registry, registry.schemaHash)).toBe(true);
    expect(isSchemaHashCompatible(registry, undefined)).toBe(false);
    expect(isSchemaHashCompatible(registry, '')).toBe(false);
    expect(isSchemaHashCompatible(registry, 'deadbeef')).toBe(false);
  });

  it('兼容表中的旧指纹 → 兼容（旧档可继续读取的现状面）', () => {
    const registry = buildRegistry();
    for (const old of registry.compatibleSchemaHashes) {
      expect(isSchemaHashCompatible(registry, old)).toBe(true);
    }
  });
});
