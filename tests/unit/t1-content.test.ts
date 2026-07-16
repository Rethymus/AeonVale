/**
 * T1 内容补齐注册完整性。
 * 断言新增物品/丹药/丹方/事件正确接入注册表，引用合法。
 */
import { describe, it, expect } from 'vitest';
import { buildRegistry } from '@content/registry';

describe('T1 内容补齐', () => {
  const reg = buildRegistry();

  it('新增独立物品注册：货币/知识/战利品/工具', () => {
    const ids = ['item.spirit-stone', 'item.spirit-compost', 'item.dried-herb', 'item.sealed-herb', 'item.recipe-fragment', 'item.broken-talisman', 'item.array-core', 'item.rust-hoe', 'item.sickle', 'item.water-pail'];
    for (const id of ids) expect(reg.items.has(id), `${id} 未注册`).toBe(true);
    expect(reg.items.get('item.rust-hoe')!.category).toBe('tool');
    expect(reg.items.get('item.spirit-stone')!.category).toBe('currency');
    expect(reg.items.get('item.recipe-fragment')!.category).toBe('knowledge');
    expect(reg.items.get('item.spirit-compost')!.category).toBe('material');
    expect(reg.items.get('item.dried-herb')!.category).toBe('material');
    expect(reg.items.get('item.sealed-herb')!.category).toBe('material');
    expect(reg.items.get('item.array-core')!.category).toBe('material');
  });

  it('太一珠丹药 + 丹方注册，效果 maxHpUp、丹方引用合法灵草', () => {
    const p = reg.pills.get('pill.neutral-pearl')!;
    expect(p).toBeDefined;
    expect(p.effects.some(e => e.kind === 'maxHpUp')).toBe(true);
    const r = reg.recipes.get('recipe.neutral-pearl')!;
    expect(r).toBeDefined;
    expect(r.outputPillId).toBe('pill.neutral-pearl');
    for (const inp of r.inputs) expect(reg.herbs.has(inp.herbId), `${inp.herbId} 未注册`).toBe(true);
  });

  it('新增天象事件注册且 grants 引用合法物品/种子', () => {
    for (const id of ['event.forgotten-tomb', 'event.demon-seed-rain']) {
      const e = reg.events.get(id);
      expect(e, `${id} 未注册`).toBeDefined;
      for (const g of e!.grants ?? []) {
        if (g.kind === 'item') {
          expect(reg.items.has(g.itemId) || reg.seedToHerb.has(g.itemId), `${id} grant 引用未知 ${g.itemId}`).toBe(true);
        }
      }
    }
  });

  it('schemaHash 兼容表登记 T1 前指纹（旧档可读）', () => {
    expect(reg.compatibleSchemaHashes).toContain('c61ab843');
    expect(reg.compatibleSchemaHashes).toContain('c1e2cc08');
  });
});
