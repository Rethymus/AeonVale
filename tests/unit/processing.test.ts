import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { applyAction, applyPoultice, brewHerbalWine, compostHerb, consumeHerbalWine, createSimContext, createWorld, DEFAULT_BALANCE, dryHerb, makePoultice, offerRefinedTea, refineArrayCore, sealHerb, shippingUnitPrice } from '@sim';
import { itemCount, mutateItem, mutateQualityItem, qualityItemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';

function setup() {
  const reg = buildRegistry();
  const state = createWorld({ seed: 71, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(71, reg, DEFAULT_BALANCE);
  return { reg, state, ctx };
}

describe('农庄加工设施', () => {
  it('将普通灵草晾晒为可出货材料', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 2);

    const result = dryHerb(state, 'herb.mossling', ctx);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(1);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(1);
    expect(shippingUnitPrice(ctx, 'item.dried-herb')).toBeGreaterThan(0);
    expect(state.events.some(e => e.type === 'process-dry-herb')).toBe(true);
  });

  it('品质越高，晾晒额外产出越多', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 1);

    const result = dryHerb(state, 'herb.dewroot', ctx, 'treasure');

    expect(result.ok).toBe(true);
    expect(qualityItemCount(state.player, 'herb.dewroot', 'treasure')).toBe(0);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(3);
  });

  it('晾晒产出超过目标堆叠剩余空间时失败且不消耗灵草', () => {
    const { state, ctx } = setup();
    state.player.inventory['item.dried-herb'] = { itemId: 'item.dried-herb', count: 29 };
    mutateQualityItem(state.player, 'herb.dewroot', 'treasure', 1);

    const result = dryHerb(state, 'herb.dewroot', ctx, 'treasure');

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('储物戒已满');
    expect(itemCount(state.player, 'item.dried-herb')).toBe(29);
    expect(qualityItemCount(state.player, 'herb.dewroot', 'treasure')).toBe(1);
    expect(state.events.some(e => e.type === 'process-dry-herb')).toBe(false);
  });

  it('非法材料失败且不改变状态', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-stone', 1);

    const result = dryHerb(state, 'item.spirit-stone', ctx);

    expect(result.ok).toBe(false);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
  });

  it('通过 applyAction 分发晾晒动作', () => {
    const { state, ctx } = setup();
    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 1);

    applyAction(state, { kind: 'dry-herb', itemId: 'herb.mossling', quality: 'spirit' }, ctx);

    expect(itemCount(state.player, 'item.dried-herb')).toBe(2);
    expect(qualityItemCount(state.player, 'herb.mossling', 'spirit')).toBe(0);
  });

  it('将晾晒灵草与灵壤肥封藏为更高价工匠品', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-compost', 1);

    const result = sealHerb(state);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(1);
    expect(shippingUnitPrice(ctx, 'item.sealed-herb')).toBe(7);
    expect(state.events.some(e => e.type === 'process-seal-herb')).toBe(true);
  });

  it('封藏材料不足时失败且不改变库存', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.dried-herb', 1);
    mutateItem(state.player, 'item.spirit-compost', 1);

    const result = sealHerb(state);

    expect(result.ok).toBe(false);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(1);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(0);
  });

  it('通过 applyAction 分发封藏动作', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-compost', 1);

    applyAction(state, { kind: 'seal-herb' }, ctx);

    expect(itemCount(state.player, 'item.sealed-herb')).toBe(1);
  });

  it('将三株灵草堆沤为灵壤肥，补上灵壤肥自产入口', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 3);

    const result = compostHerb(state, 'herb.mossling', ctx);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'herb.mossling')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
    expect(state.events.some(e => e.type === 'process-compost-herb')).toBe(true);
  });

  it('灵草不足或非灵草时堆沤失败且不改变库存', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 2);

    const tooFew = compostHerb(state, 'herb.mossling', ctx);
    expect(tooFew.ok).toBe(false);
    expect(tooFew.reason).toBe('灵草不足');
    expect(itemCount(state.player, 'herb.mossling')).toBe(2);

    const notHerb = compostHerb(state, 'item.dried-herb', ctx);
    expect(notHerb.ok).toBe(false);
    expect(notHerb.reason).toBe('不是灵草');
  });

  it('储物戒满时堆沤失败且不消耗灵草', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'herb.mossling', 3);
    state.player.inventoryCapacity = 1;

    const result = compostHerb(state, 'herb.mossling', ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('储物戒已满');
    expect(itemCount(state.player, 'herb.mossling')).toBe(3);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
  });
});

describe('灵草药酒酿造 ', () => {
  it('将晾晒灵草与灵石酿为灵草药酒，并可高价出货', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-stone', 1);

    const result = brewHerbalWine(state);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(1);
    expect(shippingUnitPrice(ctx, 'item.herbal-wine')).toBe(12);
    expect(state.events.some(e => e.type === 'process-brew-herbal-wine')).toBe(true);
  });

  it('晾晒灵草不足时失败且不改变库存', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.dried-herb', 1);
    mutateItem(state.player, 'item.spirit-stone', 1);

    const result = brewHerbalWine(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('晾晒灵草不足');
    expect(itemCount(state.player, 'item.dried-herb')).toBe(1);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
  });

  it('灵石不足时失败且不改变库存', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.dried-herb', 2);

    const result = brewHerbalWine(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('灵石不足');
    expect(itemCount(state.player, 'item.dried-herb')).toBe(2);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
  });

  it('储物戒满时酿造失败且不消耗材料', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.dried-herb', 2);
    mutateItem(state.player, 'item.spirit-stone', 1);
    state.player.inventoryCapacity = 2; // 灵草 + 灵石已占满，药酒为新槽位

    const result = brewHerbalWine(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('储物戒已满');
    expect(itemCount(state.player, 'item.dried-herb')).toBe(2);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
  });
});

describe('阵核熔炼 ', () => {
  it('将破损法宝熔炼为阵核，作为阵法自产阵材入口', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.broken-talisman', 2);
    mutateItem(state.player, 'item.spirit-stone', 1);

    const result = refineArrayCore(state);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.broken-talisman')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(0);
    expect(itemCount(state.player, 'item.array-core')).toBe(1);
    expect(shippingUnitPrice(ctx, 'item.array-core')).toBe(12);
    expect(state.events.some(e => e.type === 'process-refine-array-core')).toBe(true);
  });

  it('破损法宝不足时失败且不改变库存', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.broken-talisman', 1);
    mutateItem(state.player, 'item.spirit-stone', 1);

    const result = refineArrayCore(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('破损法宝不足');
    expect(itemCount(state.player, 'item.broken-talisman')).toBe(1);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
    expect(itemCount(state.player, 'item.array-core')).toBe(0);
  });

  it('储物戒满时熔炼失败且不消耗材料', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.broken-talisman', 2);
    mutateItem(state.player, 'item.spirit-stone', 1);
    state.player.inventoryCapacity = 2; // 破损法宝 + 灵石已占满，阵核为新槽位

    const result = refineArrayCore(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('储物戒已满');
    expect(itemCount(state.player, 'item.broken-talisman')).toBe(2);
    expect(itemCount(state.player, 'item.spirit-stone')).toBe(1);
    expect(itemCount(state.player, 'item.array-core')).toBe(0);
  });
});

describe('灵草药酒饮用 ', () => {
  it('饮用灵草药酒回血、解丹毒、凝意志，并消耗一壶', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.herbal-wine', 1);
    state.player.hp = 50 * MILLI;
    state.player.maxHp = 100 * MILLI;
    state.player.pillPoison = 5 * MILLI;
    state.player.willpower = 100;

    const result = consumeHerbalWine(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.hpGain).toBe(12 * MILLI);
    expect(result.poisonRelief).toBe(3 * MILLI); // restBonusMax 1 + 2
    expect(result.willpowerGain).toBe(30);
    expect(itemCount(state.player, 'item.herbal-wine')).toBe(0);
    expect(state.player.hp).toBe(62 * MILLI);
    expect(state.player.pillPoison).toBe(2 * MILLI); // 5 - 3
    expect(state.player.willpower).toBe(130);
    expect(state.events.some(e => e.type === 'consume-herbal-wine')).toBe(true);
  });

  it('药酒不足时饮用失败且不改变状态', () => {
    const { state, ctx } = setup();
    state.player.hp = 50 * MILLI;
    state.player.pillPoison = 5 * MILLI;
    state.player.willpower = 100;

    const result = consumeHerbalWine(state, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('灵草药酒不足');
    expect(state.player.hp).toBe(50 * MILLI);
    expect(state.player.pillPoison).toBe(5 * MILLI);
    expect(state.player.willpower).toBe(100);
  });

  it('丹毒低于药酒解毒上限时，仅清除实际丹毒量', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.herbal-wine', 1);
    state.player.hp = 50 * MILLI;
    state.player.maxHp = 100 * MILLI;
    state.player.pillPoison = 1 * MILLI;

    const result = consumeHerbalWine(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.poisonRelief).toBe(1 * MILLI); // min(1, 3)
    expect(state.player.pillPoison).toBe(0);
  });

  it('回血不超过最大生命值', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.herbal-wine', 1);
    state.player.hp = 95 * MILLI;
    state.player.maxHp = 100 * MILLI;
    state.player.pillPoison = 0;

    consumeHerbalWine(state, ctx);

    expect(state.player.hp).toBe(100 * MILLI); // 95 + 12 → cap 100
  });
});

describe('封藏灵草灵茶品鉴 ', () => {
  it('奉上封藏灵草作灵茶品鉴，回血解丹毒凝意志，并消耗一株', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.sealed-herb', 1);
    state.player.hp = 50 * MILLI;
    state.player.maxHp = 100 * MILLI;
    state.player.pillPoison = 5 * MILLI;
    state.player.willpower = 100;

    const result = offerRefinedTea(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.hpGain).toBe(15 * MILLI);
    expect(result.poisonRelief).toBe(4 * MILLI); // restBonusMax 1 + 3
    expect(result.willpowerGain).toBe(80);
    expect(itemCount(state.player, 'item.sealed-herb')).toBe(0);
    expect(state.player.hp).toBe(65 * MILLI);
    expect(state.player.pillPoison).toBe(1 * MILLI); // 5 - 4
    expect(state.player.willpower).toBe(180);
    expect(state.events.some(e => e.type === 'offer-refined-tea')).toBe(true);
  });

  it('封藏灵草不足时品鉴失败且不改变状态', () => {
    const { state, ctx } = setup();
    state.player.hp = 50 * MILLI;
    state.player.pillPoison = 5 * MILLI;
    state.player.willpower = 100;

    const result = offerRefinedTea(state, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('封藏灵草不足');
    expect(state.player.hp).toBe(50 * MILLI);
    expect(state.player.pillPoison).toBe(5 * MILLI);
    expect(state.player.willpower).toBe(100);
  });

  it('灵茶品鉴收益高于药酒饮用（高阶自用抉择，封藏灵草 > 药酒）', () => {
    const wine = setup();
    mutateItem(wine.state.player, 'item.herbal-wine', 1);
    wine.state.player.hp = 50 * MILLI;
    wine.state.player.maxHp = 100 * MILLI;
    wine.state.player.pillPoison = 5 * MILLI;
    const wineResult = consumeHerbalWine(wine.state, wine.ctx);

    const tea = setup();
    mutateItem(tea.state.player, 'item.sealed-herb', 1);
    tea.state.player.hp = 50 * MILLI;
    tea.state.player.maxHp = 100 * MILLI;
    tea.state.player.pillPoison = 5 * MILLI;
    const teaResult = offerRefinedTea(tea.state, tea.ctx);

    expect(teaResult.hpGain).toBeGreaterThan(wineResult.hpGain);
    expect(teaResult.poisonRelief).toBeGreaterThan(wineResult.poisonRelief);
    expect(teaResult.willpowerGain).toBeGreaterThan(wineResult.willpowerGain);
  });
});

describe('灵药膏熬制与外敷 ', () => {
  it('以晾晒灵草与双份灵壤肥熬成灵药膏，并可出货', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.dried-herb', 1);
    mutateItem(state.player, 'item.spirit-compost', 2);

    const result = makePoultice(state);

    expect(result.ok).toBe(true);
    expect(itemCount(state.player, 'item.dried-herb')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(0);
    expect(itemCount(state.player, 'item.spirit-poultice')).toBe(1);
    expect(shippingUnitPrice(ctx, 'item.spirit-poultice')).toBe(9);
    expect(state.events.some(e => e.type === 'process-make-poultice')).toBe(true);
  });

  it('灵壤肥不足时熬制失败且不改变库存', () => {
    const { state } = setup();
    mutateItem(state.player, 'item.dried-herb', 1);
    mutateItem(state.player, 'item.spirit-compost', 1);

    const result = makePoultice(state);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('灵壤肥不足');
    expect(itemCount(state.player, 'item.dried-herb')).toBe(1);
    expect(itemCount(state.player, 'item.spirit-compost')).toBe(1);
    expect(itemCount(state.player, 'item.spirit-poultice')).toBe(0);
  });

  it('外敷灵药膏重止血生肌、拔毒（hp 重，无意志）', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'item.spirit-poultice', 1);
    state.player.hp = 50 * MILLI;
    state.player.maxHp = 100 * MILLI;
    state.player.pillPoison = 5 * MILLI;
    state.player.willpower = 100;

    const result = applyPoultice(state, ctx);

    expect(result.ok).toBe(true);
    expect(result.hpGain).toBe(20 * MILLI);
    expect(result.poisonRelief).toBe(3 * MILLI); // restBonusMax 1 + 2
    expect(result.willpowerGain).toBe(0);
    expect(state.player.hp).toBe(70 * MILLI);
    expect(state.player.pillPoison).toBe(2 * MILLI);
    expect(state.player.willpower).toBe(100);
    expect(state.events.some(e => e.type === 'apply-poultice')).toBe(true);
  });

  it('药膏不足时外敷失败且不改变状态', () => {
    const { state, ctx } = setup();
    state.player.hp = 50 * MILLI;

    const result = applyPoultice(state, ctx);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('灵药膏不足');
    expect(state.player.hp).toBe(50 * MILLI);
  });

  it('三种自用消耗品收益谱各异：膏 hp > 茶 hp > 酒 hp；茶意志最高、膏无意志', () => {
    const wine = setup();
    mutateItem(wine.state.player, 'item.herbal-wine', 1);
    wine.state.player.hp = 50 * MILLI;
    wine.state.player.maxHp = 200 * MILLI;
    wine.state.player.pillPoison = 5 * MILLI;
    const w = consumeHerbalWine(wine.state, wine.ctx);

    const tea = setup();
    mutateItem(tea.state.player, 'item.sealed-herb', 1);
    tea.state.player.hp = 50 * MILLI;
    tea.state.player.maxHp = 200 * MILLI;
    tea.state.player.pillPoison = 5 * MILLI;
    const t = offerRefinedTea(tea.state, tea.ctx);

    const poultice = setup();
    mutateItem(poultice.state.player, 'item.spirit-poultice', 1);
    poultice.state.player.hp = 50 * MILLI;
    poultice.state.player.maxHp = 200 * MILLI;
    poultice.state.player.pillPoison = 5 * MILLI;
    const pr = applyPoultice(poultice.state, poultice.ctx);

    expect(pr.hpGain).toBeGreaterThan(t.hpGain); // 膏 20 > 茶 15
    expect(t.hpGain).toBeGreaterThan(w.hpGain); // 茶 15 > 酒 12
    expect(pr.hpGain).toBe(20 * MILLI);
    expect(t.willpowerGain).toBeGreaterThan(w.willpowerGain); // 茶 80 > 酒 30
    expect(pr.willpowerGain).toBe(0); // 膏无意志
  });
});
