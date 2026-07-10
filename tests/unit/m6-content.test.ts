/**
 * M6 内容广度扩充（docs/18 §9.1）—— 注册完整性 + 配方合法性。
 * brew 路径由 alchemy.test / content-lint 覆盖；本文件只断言新内容正确接入注册表。
 */
import { describe, it, expect } from 'vitest';
import { buildRegistry } from '@content/registry';

const NEW_HERBS = [
  'herb.stonegrain', 'herb.mistfern', 'herb.sunmoss',
  'herb.plumeweed', 'herb.tidegrass', 'herb.embermoss',
  'herb.jadewing', 'herb.fulgurseed',
];
const NEW_RECIPES = ['recipe.ward-fulgur', 'recipe.bone-herbal', 'recipe.detox-plume'];

describe('M6 内容广度扩充（docs/18 §9.1）', () => {
  const reg = buildRegistry();

  it('8 种新灵草全部注册、可播种（seedToHerb）、药性非零', () => {
    for (const id of NEW_HERBS) {
      const h = reg.herbs.get(id);
      expect(h, `${id} 未注册`).toBeDefined();
      expect(reg.seedToHerb.has(h!.seedId), `${id} seedId 未映射`).toBe(true);
      const { cold, hot, warm, neutral } = h!.baseProperty;
      expect(cold + hot + warm + neutral, `${id} 药性全零`).toBeGreaterThan(0);
      expect(h!.tier, `${id} tier`).toBeGreaterThanOrEqual(1);
    }
    expect(reg.herbs.size, '灵草总数应 ≥24').toBeGreaterThanOrEqual(24);
  });

  it('温性药草缺口已补：plumeweed 温性为主导维度', () => {
    const p = reg.herbs.get('herb.plumeweed')!;
    expect(p.baseProperty.warm).toBeGreaterThan(p.baseProperty.cold + p.baseProperty.hot);
  });

  it('fulgurseed 为第三种金属性避雷草（metalAttract>0）', () => {
    const metalHerbs = [...reg.herbs.values()].filter((h) => h.metalAttract > 1);
    expect(metalHerbs.map((h) => h.id)).toContain('herb.fulgurseed');
    expect(metalHerbs.length).toBeGreaterThanOrEqual(3); // metalpine / thunderreed / ironwill-thorn / fulgurseed
  });

  it('3 个新材料路径配方注册、input 引用合法灵草、output 为已存在丹药', () => {
    for (const id of NEW_RECIPES) {
      const r = reg.recipes.get(id);
      expect(r, `${id} 未注册`).toBeDefined();
      expect(r!.difficulty, `${id} difficulty 应 ∈[1,5]`).toBeGreaterThanOrEqual(1);
      expect(r!.difficulty).toBeLessThanOrEqual(5);
      for (const inp of r!.inputs) {
        expect(reg.herbs.has(inp.herbId), `${id} 引用未知灵草 ${inp.herbId}`).toBe(true);
      }
      expect(reg.pills.has(r!.outputPillId), `${id} 输出未知丹药 ${r!.outputPillId}`).toBe(true);
    }
    expect(reg.recipes.size, '配方总数应 ≥14').toBeGreaterThanOrEqual(14);
  });

  it('schemaHash 已登记新内容兼容（旧档可读，docs/11 §3.2）', () => {
    // compatibleSchemaHashes 存【旧】指纹供向后兼容；当前 schemaHash 由 isSchemaHashCompatible 单独 === 判定。
    expect(reg.compatibleSchemaHashes.length, '兼容哈希表应含 M6 广度扩充前指纹').toBeGreaterThanOrEqual(6);
    expect(reg.compatibleSchemaHashes).toContain('467bd1a7'); // M5 终态（广度扩充前）指纹
  });
});
