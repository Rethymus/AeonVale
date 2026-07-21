import { describe, expect, it } from 'vitest';
import { composeEndDayToastMessage, daySummaryMessage, daySummaryPresentation } from '@app/daySummary';
import { buildRegistry } from '@content/registry';
import type { GameEvent } from '@sim';

const reg = buildRegistry();

describe('日终摘要反馈', () => {
  it('在出货结算后展示灵石总额与前两条主要出货明细', () => {
    const events: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 2,
        payload: {
          total: 19,
          lines: [
            { itemId: 'herb.mossling', count: 2, total: 8, demand: { source: 'special-order', priceBonus: 2 } },
            { itemId: 'item.dried-herb', count: 1, total: 6 },
            { itemId: 'item.spirit-stone', count: 5, total: 5 }
          ]
        }
      }
    ];

    expect(daySummaryMessage(2, events, reg, false, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。')).toBe('首轮出货结清｜出货结算：得灵石 ×19｜凡间青苔×2（8）〔订单热需+2〕、晾晒灵草×1（6） 等｜用途：灵石先补种子、炉料与备劫消耗。｜下一步：去山谷集市补几颗种子，把第二轮药材接上。');
  });

  it('在可引劫时追加显式提醒，不覆盖主要结算语义', () => {
    const events: GameEvent[] = [{ type: 'crop-mature', tick: 0, day: 5, payload: { tileId: 1 } }];

    expect(daySummaryMessage(5, events, reg, true)).toBe('1 株灵草成熟　⚠ 体魄已至极限，按 T 主动引劫');
  });

  it('在非出货结算的普通过夜里也保留下一步引导，避免首轮反馈散回泛化文案', () => {
    expect(daySummaryMessage(3, [], reg, false, '当前目标：第二轮药材动线已成立，继续照料新苗、卖余货，或再扩一小片田。')).toBe('首轮农务闭环已成｜第 3 日｜下一步：第二轮药材动线已成立，继续照料新苗、卖余货，或再扩一小片田。');
  });

  it('日终首轮里程碑跟随受控 onboarding 目标，而不依赖相似措辞猜测', () => {
    const shippingEvents: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 3,
        payload: { total: 8, lines: [{ itemId: 'herb.mossling', count: 2, total: 8 }] }
      }
    ];

    expect(daySummaryMessage(3, shippingEvents, reg, false, '当前目标：今天先去集市看看，再决定补不补货。')).toBe('出货结算：得灵石 ×8｜凡间青苔×2（8）｜下一步：今天先去集市看看，再决定补不补货。');

    expect(daySummaryMessage(3, [], reg, false, '当前目标：今天继续稳住节奏，有余力再做别的。')).toBe('第 3 日｜下一步：今天继续稳住节奏，有余力再做别的。');
  });

  it('在运行时传入多行 onboarding help text 时，只消费目标首行并把操作行转成接力提示', () => {
    expect(daySummaryMessage(4, [], reg, false, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。\n意义：补种把一次收获变成稳定经营，后续才有炼丹库存。\n操作：按 M 打开地点，选集市服务后确认补种。\n动线：先去山谷集市补种，再回农庄接上第二轮。')).toBe('第 4 日｜下一步：去山谷集市补几颗种子，把第二轮药材接上。｜接力：按 M 打开地点，选集市服务后确认补种。');
  });

  it('首轮出货结清时把灵石用途接回补种、炉料与备劫循环', () => {
    const events: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 2,
        payload: {
          total: 8,
          lines: [{ itemId: 'herb.mossling', count: 2, total: 8 }]
        }
      }
    ];

    expect(daySummaryMessage(2, events, reg, false, ['当前目标：去山谷集市补几颗种子，把第二轮药材接上。', '意义：补种把一次收获变成稳定经营，后续才有炼丹库存。', '操作：按 M 打开地点，选集市服务后确认补种。'].join('\n'))).toBe('首轮出货结清｜出货结算：得灵石 ×8｜凡间青苔×2（8）｜用途：灵石先补种子、炉料与备劫消耗。｜下一步：去山谷集市补几颗种子，把第二轮药材接上。｜接力：按 M 打开地点，选集市服务后确认补种。');
  });

  it('在日终摘要已包含下一步时，不再重复拼接额外的 onboarding 推进 toast', () => {
    expect(composeEndDayToastMessage('第 4 日｜下一步：去山谷集市补几颗种子，把第二轮药材接上。｜接力：按 M 打开地点，选集市服务后确认补种。', '下一步：回到农庄，把新买到的种子立刻播回田里。｜点击已翻灵田补种。')).toBe('第 4 日｜下一步：去山谷集市补几颗种子，把第二轮药材接上。｜接力：按 M 打开地点，选集市服务后确认补种。');
  });

  it('在日终摘要没有下一步时，仍会补上目标推进 toast', () => {
    expect(composeEndDayToastMessage('第 4 日', '下一步：回到农庄，把新买到的种子立刻播回田里。｜点击已翻灵田补种。')).toBe('第 4 日\n下一步：回到农庄，把新买到的种子立刻播回田里。｜点击已翻灵田补种。');
  });

  it('在没有显式目标提示时，仍会按结算结果补出可执行的次日关注', () => {
    const events: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 4,
        payload: {
          total: 12,
          lines: [{ itemId: 'herb.mossling', count: 3, total: 12 }]
        }
      }
    ];

    expect(daySummaryMessage(4, events, reg, false)).toBe('出货结算：得灵石 ×12｜凡间青苔×3（12）｜明日关注：回农庄看看哪块地该补种、浇水或顺手再收一轮。');
  });

  it('在成熟提示且无主线引导时，会提醒先收成熟灵草', () => {
    const events: GameEvent[] = [{ type: 'crop-mature', tick: 0, day: 6, payload: { tileId: 2 } }];

    expect(daySummaryMessage(6, events, reg, false)).toBe('1 株灵草成熟｜明日关注：先把成熟灵草收掉，再决定出货、加工还是留作后用。');
  });

  it('在纯收获回顾且无显式目标时，会补出贴着农庄经营链的次日关注', () => {
    const events: GameEvent[] = [
      {
        type: 'harvest',
        tick: 0,
        day: 6,
        payload: { defId: 'herb.mossling' }
      }
    ];

    expect(daySummaryMessage(6, events, reg, false)).toBe('今日已有灵草入袋｜明日关注：先巡一遍农庄，看看要不要立刻出货、补种，或把新收药材转去加工。');
  });

  it('为结算、成熟和兽潮结果挑选对应展示资产', () => {
    const shippingEvents: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 4,
        payload: {
          total: 12,
          lines: [{ itemId: 'herb.mossling', count: 3, total: 12 }]
        }
      }
    ];
    const matureEvents: GameEvent[] = [{ type: 'crop-mature', tick: 0, day: 6, payload: { tileId: 2 } }];
    const beastEvents: GameEvent[] = [{ type: 'beast-loot', tick: 0, day: 7, payload: { cores: 1 } }];

    expect(daySummaryPresentation(4, shippingEvents, reg, false).assetId).toBe('loc.farmstead');
    expect(daySummaryPresentation(6, matureEvents, reg, false).assetId).toBe('loc.herb-plot');
    expect(daySummaryPresentation(7, beastEvents, reg, false).assetId).toBe('loc.spirit-vein');
  });

  it('在日终总览只是纯收获回顾时，入口图优先回到田间线程而非单株灵草图标', () => {
    const harvestEvents: GameEvent[] = [
      {
        type: 'harvest',
        tick: 0,
        day: 6,
        payload: { defId: 'herb.mossling' }
      }
    ];

    expect(daySummaryPresentation(6, harvestEvents, reg, false).assetId).toBe('loc.herb-plot');
  });

  it('在纯收获或成熟回顾已明确给出下一步地点时，入口图优先承接对应地点', () => {
    const harvestEvents: GameEvent[] = [
      {
        type: 'harvest',
        tick: 0,
        day: 6,
        payload: { defId: 'herb.mossling' }
      }
    ];
    const matureEvents: GameEvent[] = [
      {
        type: 'crop-mature',
        tick: 0,
        day: 6,
        payload: { tileId: 2 }
      }
    ];

    expect(daySummaryPresentation(6, harvestEvents, reg, false, '当前目标：先去旧茶棚歇脚，把今日闲居节奏落下来。').assetId).toBe('loc.tea-shed');

    expect(daySummaryPresentation(6, matureEvents, reg, false, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。').assetId).toBe('loc.valley-market');
  });

  it('在日终总览中的猎妖得丹分支，入口图优先回到残脉地点而非内丹物品图标', () => {
    const beastEvents: GameEvent[] = [{ type: 'beast-loot', tick: 0, day: 7, payload: { cores: 1 } }];

    expect(daySummaryPresentation(7, beastEvents, reg, false).assetId).toBe('loc.spirit-vein');
  });

  it('在出货结算仅作为日终总览时，入口图优先回到农庄线程而非首个出货物或箱体图', () => {
    const shippingEvents: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 4,
        payload: {
          total: 18,
          lines: [
            { itemId: 'item.dried-herb', count: 2, total: 12 },
            { itemId: 'herb.mossling', count: 2, total: 6 }
          ]
        }
      }
    ];

    expect(daySummaryPresentation(4, shippingEvents, reg, false).assetId).toBe('loc.farmstead');
  });

  it('在只有 fallback 关注而没有事件主语时，会按 fallback 地点补出总览入口图', () => {
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：今天先回农庄稳住节奏，再决定要不要外出。').assetId).toBe('loc.farmstead');

    expect(daySummaryPresentation(8, [], reg, false, '当前目标：先去药圃看看今天还能不能再补一轮草药。').assetId).toBe('loc.herb-plot');
  });

  it('在首轮播种或浇水阶段，日终总览入口与 onboarding 对象主语保持一致', () => {
    expect(daySummaryPresentation(2, [], reg, false, '当前目标：播下第一颗青苔种或露根草种。').assetId).toBe('icon.seed.mossling');

    expect(daySummaryPresentation(2, [], reg, false, '当前目标：给刚种下的幼苗浇一次水。').assetId).toBe('icon.item.water-pail');
  });

  it('在普通过夜既无事件也无明确地点提示时，日终入口回到农庄根层线程', () => {
    expect(daySummaryPresentation(8, [], reg, false).assetId).toBe('loc.farmstead');
  });

  it('在天象启动或引劫临近时，日终入口优先回到阵坊地点图', () => {
    const celestialEvents: GameEvent[] = [
      {
        type: 'celestial-start',
        tick: 0,
        day: 7,
        payload: { displayName: '紫霄异兆' }
      }
    ];

    expect(daySummaryPresentation(7, celestialEvents, reg, false).assetId).toBe('loc.array-shed');
    expect(daySummaryPresentation(7, [], reg, true).assetId).toBe('loc.array-shed');
  });

  it('在已有收获或成熟事件但下一步未明确转向其他地点时，引劫提醒优先把日终入口收回阵坊线程', () => {
    const harvestEvents: GameEvent[] = [
      {
        type: 'harvest',
        tick: 0,
        day: 7,
        payload: { defId: 'herb.mossling' }
      }
    ];
    const matureEvents: GameEvent[] = [
      {
        type: 'crop-mature',
        tick: 0,
        day: 7,
        payload: { tileId: 3 }
      }
    ];

    expect(daySummaryPresentation(7, harvestEvents, reg, true).assetId).toBe('loc.array-shed');
    expect(daySummaryPresentation(7, matureEvents, reg, true).assetId).toBe('loc.array-shed');
  });

  it('在可主动引劫但下一步已明确指向其他地点时，仍优先承接对应地点图', () => {
    const harvestEvents: GameEvent[] = [
      {
        type: 'harvest',
        tick: 0,
        day: 7,
        payload: { defId: 'herb.mossling' }
      }
    ];

    expect(daySummaryPresentation(7, harvestEvents, reg, true, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。').assetId).toBe('loc.valley-market');
  });

  it('在出货结算后的下一步已明确指向地点时，优先用对应地点图承接后续动线', () => {
    const shippingEvents: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 4,
        payload: {
          total: 12,
          lines: [{ itemId: 'herb.mossling', count: 3, total: 12 }]
        }
      }
    ];

    expect(daySummaryPresentation(4, shippingEvents, reg, false, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。').assetId).toBe('loc.valley-market');
  });

  it('在运行时传入多行 onboarding help text 时，地点图判断只看目标首行', () => {
    expect(daySummaryPresentation(4, [], reg, false, '当前目标：先去旧茶棚歇脚，把今日闲居节奏落下来。\n操作：到茶棚后按 Enter 静养。\n动线：先稳住农庄，再去旧茶棚歇脚。').assetId).toBe('loc.tea-shed');
  });

  it('在日终下一步已明确指向节庆会场时，优先承接到节庆地点图', () => {
    expect(daySummaryPresentation(14, [], reg, false, '当前目标：先去节日会场看看今日摊位，再决定要不要参与会场试礼。').assetId).toBe('loc.festival-ground');

    expect(daySummaryPresentation(14, [], reg, false, '当前目标：灵芽节已开，先去会场转一圈再安排今日农务。').assetId).toBe('loc.festival-ground');
  });

  it('在日终总览只剩出货状态而无明确后续地点时，统一回到农庄根线程', () => {
    const blockedEvents: GameEvent[] = [
      {
        type: 'shipping-blocked',
        tick: 0,
        day: 5,
        payload: { reason: '储物戒已满' }
      }
    ];
    const settlementWithoutLines: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 5,
        payload: { total: 6, lines: [] }
      }
    ];

    expect(daySummaryPresentation(5, blockedEvents, reg, false).assetId).toBe('loc.farmstead');
    expect(daySummaryPresentation(5, settlementWithoutLines, reg, false).assetId).toBe('loc.farmstead');
  });

  it('在日终下一步已明确指向特定地点时，优先挑选对应地点图', () => {
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：先去旧茶棚歇脚，把今日闲居节奏落下来。').assetId).toBe('loc.tea-shed');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：优先补暖棚苗床，让离季育苗真正稳定。').assetId).toBe('loc.greenhouse');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：先看晾晒架旁还有没有空位，把秋收药材及时转成稳定货。').assetId).toBe('loc.drying-yard');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：去阵坊核对阵核和符炉，再决定补哪一块控场能力。').assetId).toBe('loc.array-shed');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：去阵器棚核对阵核和符炉，再决定补哪一块控场能力。').assetId).toBe('loc.array-shed');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：若想推进旧阵线，先去遗迹寻访或捐藏经。').assetId).toBe('loc.ruin-gate');
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：若想补炼体材料，先探残脉，再回来和他换路。').assetId).toBe('loc.spirit-vein');
  });

  it('在日终地点推断中优先吃受控目标句，并保留别名回退', () => {
    expect(daySummaryPresentation(8, [], reg, false, '当前目标：去山谷集市补几颗种子，把第二轮药材接上。').assetId).toBe('loc.valley-market');

    expect(daySummaryPresentation(8, [], reg, false, '当前目标：先去会场转一圈，再决定今天还要不要赶集。').assetId).toBe('loc.festival-ground');

    expect(daySummaryPresentation(8, [], reg, false, '当前目标：先去药圃看看今天还能不能再补一轮草药。').assetId).toBe('loc.herb-plot');
  });

  it('在出货结算后的下一步转向加工或阵坊时，日终入口仍优先承接地点图而非设施图', () => {
    const shippingEvents: GameEvent[] = [
      {
        type: 'shipping-settlement',
        tick: 0,
        day: 9,
        payload: {
          total: 15,
          lines: [{ itemId: 'item.dried-herb', count: 2, total: 15 }]
        }
      }
    ];

    expect(daySummaryPresentation(9, shippingEvents, reg, false, '当前目标：先看晾晒架旁还有没有空位，把秋收药材及时转成稳定货。').assetId).toBe('loc.drying-yard');

    expect(daySummaryPresentation(9, shippingEvents, reg, false, '当前目标：去阵坊核对阵核和符炉，再决定补哪一块控场能力。').assetId).toBe('loc.array-shed');

    expect(daySummaryPresentation(9, shippingEvents, reg, false, '当前目标：去阵器棚核对阵核和符炉，再决定补哪一块控场能力。').assetId).toBe('loc.array-shed');
  });
});
