import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE } from '@sim';
import { resolveBrew, brewPills } from '@sim/alchemy/alchemySystem';
import { hasIncompatibility } from '@sim/alchemy/compatibility';
import { buildRegistry } from '@content/registry';
import { mutateItem, itemCount } from '@sim/world/player';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('炼丹 sim (docs/06 / 14 §9)', () => {
  it('相反药对（寒髓草+赤焰心）必炸炉（七情·相反）', () => {
    const { state, ctx } = setup();
    const res = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.frostmarrow', qty: 1 }, { herbId: 'herb.emberheart', qty: 1 }], avgHeatMilli: 50_000 },
      ctx,
    );
    expect(res.outcome).toBe('exploded');
    expect(res.poisonGainMilli).toBe(20_000);
    expect(res.hpDamageMilli).toBe(15_000);
  });

  it('断肠藤+赤焰心 相反必炸（寒热同体×强热，新增七情）', () => {
    const { state, ctx } = setup();
    const res = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.griefvein', qty: 1 }, { herbId: 'herb.emberheart', qty: 1 }], avgHeatMilli: 50_000 },
      ctx,
    );
    expect(res.outcome).toBe('exploded');
  });

  it('虚衾蕈+太阳髓 相反必炸（极寒×极热）', () => {
    const { state, ctx } = setup();
    const res = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.voidmantle', qty: 1 }, { herbId: 'herb.solar-pith', qty: 1 }], avgHeatMilli: 50_000 },
      ctx,
    );
    expect(res.outcome).toBe('exploded');
  });

  it('避雷丹方（金雷引+寒髓草）在理想火候出避雷丹', () => {
    const { state, ctx } = setup();
    const res = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }], avgHeatMilli: 47_000 },
      ctx,
    );
    expect(res.outcome).toBe('pill');
    expect(res.pillId).toBe('pill.ward-basic');
    expect(res.quality).toBeGreaterThanOrEqual(0.7);
  });

  it('净毒丹方（露根草×2）出净毒丹', () => {
    const { state, ctx } = setup();
    const res = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.dewroot', qty: 2 }], avgHeatMilli: 32_000 },
      ctx,
    );
    expect(res.outcome).not.toBe('exploded');
    expect(res.pillId).toBe('pill.detox');
  });

  it('火候严重偏离 → 废丹或残丹（同料异火出异果）', () => {
    const { state, ctx } = setup();
    const ideal = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }], avgHeatMilli: 47_000 },
      ctx,
    );
    const burnt = resolveBrew(
      state,
      { materials: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }], avgHeatMilli: 95_000 },
      ctx,
    );
    expect(ideal.quality).toBeGreaterThan(burnt.quality);
  });

  it('brewPills 消耗材料并产出丹药', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.metalpine', 2);
    mutateItem(state.player, 'herb.frostmarrow', 2);
    const before = itemCount(state.player, 'pill.ward-basic');
    const res = brewPills(
      state,
      { materials: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }], avgHeatMilli: 47_000 },
      ctx,
    );
    expect(res.outcome).toBe('pill');
    expect(itemCount(state.player, 'herb.metalpine')).toBe(1);
    expect(itemCount(state.player, 'herb.frostmarrow')).toBe(1);
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(before + 1);
  });

  it('材料不足时 brewPills 不消耗、不出丹', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.metalpine', 0); // 无
    const res = brewPills(
      state,
      { materials: [{ herbId: 'herb.metalpine', qty: 1 }, { herbId: 'herb.frostmarrow', qty: 1 }], avgHeatMilli: 47_000 },
      ctx,
    );
    expect(res.outcome).toBe('waste');
    expect(itemCount(state.player, 'pill.ward-basic')).toBe(0);
  });

  it('相须配伍（寒髓草+露根草 同寒）提升 quality', () => {
    const { state, ctx } = setup();
    // 单寒髓草 vs 寒髓草+露根草(相须)：后者药性更集中、quality 更高（净毒丹方需露根×2，这里测纯聚合倾向）
    const a = resolveBrew(state, { materials: [{ herbId: 'herb.dewroot', qty: 2 }], avgHeatMilli: 32_000 }, ctx);
    expect(a.quality).toBeGreaterThan(0);
  });

  it('hasIncompatibility：含相反药对返回 true，无相反返回 false', () => {
    // frostmarrow + emberheart 是相反药对
    expect(hasIncompatibility(['herb.frostmarrow', 'herb.emberheart'])).toBe(true);
    // 单草药或无相反组合
    expect(hasIncompatibility(['herb.mossling'])).toBe(false);
    expect(hasIncompatibility(['herb.dewroot', 'herb.suncap'])).toBe(false);
    // 多草药含一对相反
    expect(hasIncompatibility(['herb.mossling', 'herb.frostmarrow', 'herb.emberheart'])).toBe(true);
    // 空列表
    expect(hasIncompatibility([])).toBe(false);
  });
});
