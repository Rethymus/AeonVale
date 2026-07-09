/**
 * Zod 校验 schema（docs/11 §4.3 / docs/10 §1.3 D6）。
 * ContentRegistry.load() 启动时一次性 parse 全部内容表；脏数据即拒启动 + 报错位置。
 * 与 src/content/defs.ts 接口一一对应。
 */
import { z } from 'zod';

export const propertyVectorSchema = z.object({
  cold: z.number().int(),
  hot: z.number().int(),
  warm: z.number().int(),
  neutral: z.number().int(),
});

export const yieldDropSchema = z.object({
  itemId: z.string(),
  count: z.number().int().min(0),
  chance: z.number().min(0).max(1).optional(),
});

export const seasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);

export const spiritHerbSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  baseProperty: propertyVectorSchema,
  baseGrowth: z.number().min(0), // 毫点/日
  growthThreshold: z.number().min(0),
  qiNeed: z.number().min(0),
  qiDrainPerDay: z.number().min(0),
  metalAttract: z.number().min(0),
  preferredSeason: seasonSchema.optional(),
  weakSeason: seasonSchema.optional(),
  seedId: z.string(),
  rawPoisonValue: z.number().min(0),
  yield: z.array(yieldDropSchema),
});

export const itemCategorySchema = z.enum([
  'tool',
  'material',
  'seed',
  'pill',
  'equipment',
  'knowledge',
  'consumable',
  'currency',
  'array-part',
]);

export const itemSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  category: itemCategorySchema,
  stack: z.number().int().min(1),
  description: z.string().optional(),
});
