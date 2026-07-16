import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE, type GameState } from '@sim';
import { mutateItem, mutateQualityItem } from '@sim/world/player';
import { bodyTrainingToast, bodyTrainingToastPresentation, brewMaterialFailureToast, brewMaterialFailureToastPresentation, facilityCollectFailureToast, facilityCollectFailureToastPresentation, facilityCollectResultToast, facilityCollectResultToastPresentation, facilityFailureToast, facilityFailureToastPresentation, facilityJobStartToast, facilityJobStartToastPresentation, facilityStatusToast, facilityStatusToastPresentation, firstHarvestMilestoneToast, firstHarvestMilestoneToastPresentation, firstShipmentMilestoneToast, firstShipmentMilestoneToastPresentation, guardBeastFeedFailureToastPresentation, guardBeastFeedResultToast, guardBeastFeedResultToastPresentation, pillUseToast, pillUseToastPresentation, shippingFailureToast, shippingFailureToastPresentation, shippingResultToast, shippingResultToastPresentation, storageFailureToast, storageFailureToastPresentation, storageResultToast, storageResultToastPresentation } from '@app/actionResultToast';

function setup(seed = 21): { state: GameState; reg: ReturnType<typeof buildRegistry> } {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  return { state, reg };
}

describe('action result toast', () => {
  it('summarizes storage result with updated storage and inventory occupancy', () => {
    const { state, reg } = setup();
    mutateItem(state.player, 'seed.mossling', 2);
    state.storage.inventory['item.dried-herb'] = { itemId: 'item.dried-herb', count: 1 };
    state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };

    delete state.player.inventory['seed.mossling'];
    state.storage.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: 1 };

    expect(storageResultToast('deposit', { itemId: 'seed.mossling', count: 1 }, state, reg)).toBe('存入仓库：凡间青苔种子×1｜仓占 2/48｜背包 0/16');
  });

  it('summarizes normal and quality shipping using actual post-action pressure', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(21, reg, DEFAULT_BALANCE);

    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 2 };
    state.player.inventory['item.dried-herb'] = { itemId: 'item.dried-herb', count: 1 };
    state.shippingBin['seed.mossling'] = 1;

    expect(shippingResultToast('normal', { itemId: 'item.dried-herb', count: 1 }, state, ctx, reg)).toBe('投入出货箱：晾晒灵草×1｜本次 灵石×2｜可出 1 项｜已入箱 1 项');

    mutateQualityItem(state.player, 'herb.mossling', 'spirit', 1);
    state.qualityShippingBin.spirit = { 'herb.dewroot': 1 };

    expect(shippingResultToast('quality', { itemId: 'herb.mossling', quality: 'spirit', count: 1 }, state, ctx, reg)).toBe('投入出货箱：凡间青苔·灵品×1｜本次 灵石×4｜品质库存 1 项｜已入箱 1 项');
  });

  it('keeps logistics failure copy specific while returning to the farmstead logistics root thread', () => {
    const { reg } = setup();

    expect(storageFailureToast('deposit', { itemId: 'seed.mossling', count: 1 }, reg)).toBe('存入失败：凡间青苔种子×1');
    expect(storageFailureToastPresentation('withdraw', { itemId: 'item.spirit-stone', count: 1 }, reg)).toEqual({
      message: '取出失败：灵石×1',
      assetId: 'loc.farmstead'
    });

    expect(shippingFailureToast({ itemId: 'herb.mossling', quality: 'spirit', count: 1 }, reg)).toBe('出货失败：凡间青苔·灵品×1');
    expect(shippingFailureToastPresentation({ itemId: 'item.dried-herb', count: 1 }, reg)).toEqual({
      message: '出货失败：晾晒灵草×1',
      assetId: 'loc.farmstead'
    });
  });

  it('summarizes facility jobs and collection with output and occupancy', () => {
    const { state, reg } = setup();
    state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: 2 };

    expect(
      facilityJobStartToast(
        'drying',
        { itemId: 'herb.dewroot', count: 1, quality: 'treasure' },
        {
          outputItemId: 'item.dried-herb',
          outputCount: 3,
          daysRemaining: 1
        },
        reg
      )
    ).toBe('开始晾晒：露根草·珍品×1｜1日后得晾晒灵草×3｜可出货回灵石，也能接封藏、炼丹与阵法前置');

    expect(
      facilityJobStartToast(
        'sealing',
        null,
        {
          outputItemId: 'item.sealed-herb',
          outputCount: 1,
          daysRemaining: 2
        },
        reg
      )
    ).toBe('开始封藏：2日后得封藏灵草×1｜可炼丹、交付或留作备劫药材');

    expect(
      facilityJobStartToast(
        'furnace',
        { itemId: 'item.spare-part', count: 1 },
        {
          outputItemId: 'item.unknown-output',
          outputCount: 1,
          daysRemaining: 1
        },
        reg
      )
    ).toBe('开始熔炼：item.spare-part×1｜1日后得item.unknown-output×1｜接上农庄加工循环');

    expect(facilityCollectResultToast({ outputItemId: 'item.array-core', outputCount: 1 }, state, reg)).toBe('收取设施：阵核×1｜可布阵，把农庄产出转成备劫防线｜背包 1/16');
  });

  it('keeps facility collect failures facility-led while no item has actually been received', () => {
    expect(facilityCollectFailureToast('drying', { reason: '尚未完成或背包已满' })).toBe('晾晒架收取未成：尚未完成或背包已满');
    expect(facilityCollectFailureToastPresentation('furnace', { reason: '尚未完成或背包已满' })).toEqual({
      message: '炼符炉收取未成：尚未完成或背包已满',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('keeps facility busy and ready states facility-led before collection begins', () => {
    expect(facilityStatusToast('drying', { daysRemaining: 1 })).toBe('晾晒架忙碌，剩余1日');
    expect(facilityStatusToast('sealing', { daysRemaining: 0 })).toBe('封藏完成，Shift+M 后按 2 收取（F1 兼容）');
    expect(facilityStatusToastPresentation('furnace', { daysRemaining: 2 })).toEqual({
      message: '炼符炉忙碌，剩余2日',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('keeps facility start failures facility-led as thread failures rather than item results', () => {
    const { reg } = setup();

    expect(brewMaterialFailureToast({ herbId: 'herb.dewroot' }, reg)).toBe('熔炼失败：材料不足：露根草');
    expect(brewMaterialFailureToastPresentation({ herbId: 'herb.mossling' }, reg)).toEqual({
      message: '熔炼失败：材料不足：凡间青苔',
      assetId: 'facility.talisman-furnace'
    });

    expect(facilityFailureToast('drying', { reason: '凡间青苔×1' })).toBe('晾晒失败：凡间青苔×1');
    expect(facilityFailureToastPresentation('sealing', { reason: '需晾晒灵草×2与灵壤肥×1' })).toEqual({
      message: '封藏失败：需晾晒灵草×2与灵壤肥×1',
      assetId: 'facility.sealing-cabinet'
    });
    expect(facilityFailureToastPresentation('furnace', { reason: '需破损法宝×1与灵石×2' })).toEqual({
      message: '熔炼失败：需破损法宝×1与灵石×2',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('builds first harvest and first shipment milestone toasts for the onboarding loop', () => {
    const { reg } = setup();

    expect(firstHarvestMilestoneToast([{ type: 'harvest', tick: 0, day: 1, payload: { defId: 'herb.mossling' } }], reg, '下一步：把第一株灵草投进出货箱。')).toBe('首轮收获：凡间青苔 已入手｜可炼丹、可出货，也是布阵备劫的第一份材料｜下一步：把第一株灵草投进出货箱。');

    expect(firstShipmentMilestoneToast('投入出货箱：凡间青苔×1｜本次 灵石×1｜可出 1 项｜已入箱 1 项', '下一步：按 Enter 过夜，等次日出货结算。')).toBe('首轮投箱：投入出货箱：凡间青苔×1｜本次 灵石×1｜可出 1 项｜已入箱 1 项｜下一步：按 Enter 过夜，等次日出货结算。');

    expect(firstHarvestMilestoneToast([{ type: 'harvest', tick: 0, day: 1, payload: { defId: 'herb.mossling' } }], reg, ['当前目标：把第一株灵草投进出货箱。', '操作：靠近出货箱后按 Enter 投货。', '动线：收下成熟灵草后，顺手投进出货箱。'].join('\n'))).toBe('首轮收获：凡间青苔 已入手｜可炼丹、可出货，也是布阵备劫的第一份材料｜下一步：把第一株灵草投进出货箱。');

    expect(firstShipmentMilestoneToast('投入出货箱：凡间青苔×1｜本次 灵石×1｜可出 1 项｜已入箱 1 项', ['当前目标：按 Enter 过夜，等次日结算换回灵石。', '操作：确认今日农务已收尾，直接按 Enter 过夜。'].join('\n'))).toBe('首轮投箱：投入出货箱：凡间青苔×1｜本次 灵石×1｜可出 1 项｜已入箱 1 项｜下一步：按 Enter 过夜，等次日结算换回灵石。');
  });

  it('summarizes guard beast feeding with beast-specific preview art', () => {
    const { reg } = setup();

    expect(guardBeastFeedResultToast({ itemId: 'herb.mossling', count: 1 }, { beastId: 1, vigor: 7, bond: 12 }, reg)).toBe('投喂巡守兽：凡间青苔×1，精力7，羁绊12');

    expect(guardBeastFeedResultToastPresentation({ itemId: 'herb.mossling', count: 1 }, { beastId: 1, vigor: 7, bond: 12 }, reg).assetId).toBe('sprite.guard-beast-boar');

    expect(guardBeastFeedResultToastPresentation({ itemId: 'herb.mossling', count: 1 }, { vigor: 7, bond: 12 }, reg).assetId).toBe('sprite.guard-beast');

    expect(guardBeastFeedFailureToastPresentation('no-guard-beast')).toEqual({
      message: '尚无巡守兽',
      assetId: 'sprite.guard-beast'
    });
    expect(guardBeastFeedFailureToastPresentation('no-herb')).toEqual({
      message: '无可投喂灵草',
      assetId: 'sprite.guard-beast'
    });
    expect(guardBeastFeedFailureToastPresentation('failed')).toEqual({
      message: '投喂失败',
      assetId: 'sprite.guard-beast'
    });
  });

  it('keeps pill use results item-led because the player is explicitly consuming a named pill', () => {
    const { reg } = setup();

    expect(pillUseToast('pill.ward-basic', { applied: true, effects: ['避雷护体25%'] }, reg)).toBe('服 避雷丹：避雷护体25%｜备劫防线已补强');

    expect(pillUseToast('pill.bone-basic', { applied: true, effects: ['回血30'] }, reg)).toBe('服 生骨丹：回血30｜续航和抗伤余量提高');

    expect(pillUseToast('pill.detox', { applied: true, effects: ['清毒25'] }, reg)).toBe('服 净毒丹：清毒25｜丹毒压力下降，可继续炼丹或外出');

    expect(pillUseToast('pill.temper', { applied: true, effects: ['淬体×1.3'] }, reg)).toBe('服 淬体丹：淬体×1.3｜下次天劫淬体收益提高');

    expect(pillUseToastPresentation('pill.detox', { applied: false, effects: [] }, reg)).toEqual({
      message: '无 净毒丹｜先备丹再引劫或深入',
      assetId: 'icon.pill.detox'
    });
  });

  it('anchors body training toasts to the farmstead root thread because they advance the daily cultivation loop', () => {
    expect(bodyTrainingToast('push-up')).toBe('百次俯卧撑：体魄淬炼');
    expect(bodyTrainingToast('sit-up')).toBe('百次仰卧起坐：意志磨砺');
    expect(bodyTrainingToast('squat')).toBe('百次深蹲：筋骨发热');
    expect(bodyTrainingToastPresentation('long-run')).toEqual({
      message: '十公里长跑：凡骨不息',
      assetId: 'loc.farmstead'
    });
  });

  it('returns matching asset ids for high-value toast presentations', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(21, reg, DEFAULT_BALANCE);

    expect(storageResultToastPresentation('deposit', { itemId: 'seed.mossling', count: 1 }, state, reg).assetId).toBe('loc.farmstead');
    expect(shippingResultToastPresentation('normal', { itemId: 'item.dried-herb', count: 1 }, state, ctx, reg).assetId).toBe('loc.farmstead');
    expect(firstHarvestMilestoneToastPresentation([{ type: 'harvest', tick: 0, day: 1, payload: { defId: 'herb.mossling' } }], reg, '下一步：把第一株灵草投进出货箱。')?.assetId).toBe('icon.herb.mossling');
    expect(firstShipmentMilestoneToastPresentation('投入出货箱：凡间青苔×1', '下一步：过夜。').assetId).toBe('loc.farmstead');
    expect(bodyTrainingToastPresentation('push-up').assetId).toBe('loc.farmstead');
    expect(guardBeastFeedResultToastPresentation({ itemId: 'herb.mossling', count: 1 }, { beastId: 2, vigor: 9, bond: 5 }, reg).assetId).toBe('sprite.guard-beast-wolf');
    expect(pillUseToastPresentation('pill.ward-basic', { applied: true, effects: ['避雷护体25%'] }, reg).assetId).toBe('icon.pill.ward-basic');
    expect(facilityJobStartToastPresentation('sealing', null, { outputItemId: 'item.sealed-herb', outputCount: 1, daysRemaining: 2 }, reg).assetId).toBe('facility.sealing-cabinet');
    expect(facilityStatusToastPresentation('drying', { daysRemaining: 0 }).assetId).toBe('facility.drying-rack');
    expect(facilityCollectResultToastPresentation({ outputItemId: 'item.array-core', outputCount: 1 }, state, reg).assetId).toBe('icon.item.array-core');
  });

  it('keeps logistics result toasts on the farmstead root thread while processing start stays facility-specific and collection turns item-led', () => {
    const { state, reg } = setup();
    const ctx = createSimContext(21, reg, DEFAULT_BALANCE);

    expect(storageResultToastPresentation('withdraw', { itemId: 'item.spirit-stone', count: 1 }, state, reg)).toMatchObject({
      assetId: 'loc.farmstead'
    });
    expect(shippingResultToastPresentation('quality', { itemId: 'herb.mossling', quality: 'spirit', count: 1 }, state, ctx, reg)).toMatchObject({
      assetId: 'loc.farmstead'
    });
    expect(
      facilityJobStartToastPresentation(
        'drying',
        { itemId: 'herb.dewroot', count: 1 },
        {
          outputItemId: 'item.dried-herb',
          outputCount: 1,
          daysRemaining: 1
        },
        reg
      )
    ).toMatchObject({
      assetId: 'facility.drying-rack'
    });
    expect(facilityCollectResultToastPresentation({ outputItemId: 'item.dried-herb', outputCount: 1 }, state, reg)).toMatchObject({
      assetId: 'icon.item.dried-herb'
    });
  });
});
