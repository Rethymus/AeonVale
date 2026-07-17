import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { beastHuntResultToastPresentation, beastHuntUnavailableToastPresentation, explorationFailureToastPresentation, explorationResultToastPresentation, ruinDelveFailureToastPresentation, ruinDelveToastPresentation, tribulationEndingToastPresentation, tribulationBlockedToastPresentation, tribulationResultToastPresentation } from '@app/explorationToast';

describe('exploration toast', () => {
  const reg = buildRegistry();

  it('keeps exploration failures anchored to the explored place', () => {
    expect(explorationFailureToastPresentation('valley')).toEqual({
      message: '体力不足，无法外出寻访',
      assetId: 'loc.valley-outskirts'
    });
    expect(explorationFailureToastPresentation('spirit-vein')).toEqual({
      message: '体力不足，无法探查残脉',
      assetId: 'loc.spirit-vein'
    });
    expect(beastHuntUnavailableToastPresentation()).toEqual({
      message: '附近无妖兽潮',
      assetId: 'loc.spirit-vein'
    });
  });

  it('keeps beast-hunt empty success on the spirit-vein thread and switches loot to reward-led art', () => {
    expect(beastHuntResultToastPresentation([], reg)).toEqual({
      message: '猎妖成功',
      assetId: 'loc.spirit-vein'
    });
    expect(beastHuntResultToastPresentation([{ type: 'beast-loot', tick: 0, day: 1, payload: { cores: 1, itemId: 'item.inner-core' } }], reg)).toEqual({
      message: '猎妖成功·得内丹',
      assetId: 'icon.item.beast-core'
    });
    expect(beastHuntResultToastPresentation([{ type: 'beast-seed', tick: 0, day: 1, payload: { itemId: 'seed.mossling' } }], reg)).toEqual({
      message: '猎妖成功·获凡间青苔种子',
      assetId: 'icon.seed.mossling'
    });
    expect(
      beastHuntResultToastPresentation(
        [
          { type: 'beast-loot', tick: 0, day: 1, payload: { cores: 1, itemId: 'item.inner-core' } },
          { type: 'beast-seed', tick: 0, day: 1, payload: { itemId: 'seed.dewroot' } }
        ],
        reg
      )
    ).toEqual({
      message: '猎妖成功·得内丹·获露根草种子',
      assetId: 'icon.item.beast-core'
    });
  });

  it('keeps empty exploration results place-led but switches successful loot to reward-led art', () => {
    expect(explorationResultToastPresentation('valley', [], reg)).toEqual({
      message: '山谷寻访无获',
      assetId: 'loc.valley-outskirts'
    });
    expect(explorationResultToastPresentation('ruin', [{ itemId: 'item.recipe-fragment', count: 1 }], reg)).toEqual({
      message: '寻访所得：残卷×1',
      assetId: 'icon.item.recipe-fragment'
    });
    expect(explorationResultToastPresentation('spirit-vein', [], reg)).toEqual({
      message: '残脉空竭',
      assetId: 'loc.spirit-vein'
    });
    expect(explorationResultToastPresentation('spirit-vein', [{ itemId: 'item.array-core', count: 1 }], reg)).toEqual({
      message: '残脉所得：阵核×1',
      assetId: 'icon.item.array-core'
    });
  });

  it('keeps ruin delve success and failure tied to ruin-gate as the active exploration thread', () => {
    expect(ruinDelveFailureToastPresentation()).toEqual({
      message: '无法深入遗迹：体力或气血不足',
      assetId: 'loc.ruin-gate'
    });

    expect(
      ruinDelveToastPresentation(
        {
          level: 3,
          damage: 8,
          grants: [{ itemId: 'item.array-core', count: 1 }],
          milestone: true,
          chapterTitle: '骨试残章',
          chapterProgress: '3/3',
          chapterReadyToClaim: true
        },
        reg
      )
    ).toEqual({
      message: '遗迹第3层·伤8·传承石室｜骨试残章 3/3 可领：阵核×1',
      assetId: 'loc.ruin-gate'
    });
  });

  it('keeps tribulation blocked failures on the relevant thread art', () => {
    expect(tribulationBlockedToastPresentation('purple-omen')).toEqual({
      message: '紫雷前兆未散，还需 7 日｜先补避雷丹、阵法与药田库存',
      assetId: 'loc.array-shed'
    });
    expect(tribulationBlockedToastPresentation('body-not-ready')).toEqual({
      message: '体魄根基未满｜先收灵草、炼丹或修行再引劫',
      assetId: 'loc.farmstead'
    });
  });

  it('adds concrete next steps to tribulation blocked feedback when runtime state is available', () => {
    expect(tribulationBlockedToastPresentation('purple-omen', { daysLeft: 3 })).toEqual({
      message: '紫雷前兆未散，还需 3 日｜先补避雷丹、阵法与药田库存',
      assetId: 'loc.array-shed'
    });

    expect(
      tribulationBlockedToastPresentation('body-not-ready', {
        currentFoundation: 2400,
        requiredFoundation: 5000
      })
    ).toEqual({
      message: '体魄根基未满，还差 3｜先收灵草、炼丹或修行再引劫',
      assetId: 'loc.farmstead'
    });
  });

  it('does not leak literal Infinity/NaN when the body-foundation cap is the out-of-range sentinel', () => {
    // stage 越界（默认凡骨 stage=0 或飞升后）时 stageQiCap 返回 Infinity；
    // 玩家可见文案绝不能吐出「还差 Infinity」。
    expect(
      tribulationBlockedToastPresentation('body-not-ready', {
        requiredFoundation: Number.POSITIVE_INFINITY,
        currentFoundation: 0
      }).message
    ).toBe('体魄根基未满｜先收灵草、炼丹或修行再引劫');

    const nanMessage = tribulationBlockedToastPresentation('body-not-ready', {
      requiredFoundation: Number.NaN
    }).message;
    expect(nanMessage).not.toContain('NaN');
    expect(nanMessage).toContain('体魄根基未满');
  });

  it('keeps tribulation non-ending results on the tribulation thread art', () => {
    expect(tribulationResultToastPresentation('death')).toEqual({
      message: '陨于天劫！',
      assetId: 'loc.array-shed'
    });

    expect(tribulationResultToastPresentation('breakthrough', { stage: 3 })).toEqual({
      message: '渡劫成功！突破至 3 阶',
      assetId: 'loc.array-shed'
    });

    expect(tribulationResultToastPresentation('survived', { temperingGain: 18 })).toEqual({
      message: '扛过天劫（体魄+18）',
      assetId: 'loc.array-shed'
    });
  });

  it('keeps tribulation ending outcomes on the tribulation thread art', () => {
    expect(tribulationEndingToastPresentation('ascension')).toEqual({
      message: '白日飞升！',
      assetId: 'loc.array-shed'
    });

    expect(tribulationEndingToastPresentation('death')).toEqual({
      message: '陨于天劫',
      assetId: 'loc.array-shed'
    });

    expect(tribulationEndingToastPresentation('stay-in-world')).toEqual({
      message: '你留在了此界。境界止步，山河未尽。',
      assetId: 'loc.farmstead'
    });

    expect(tribulationEndingToastPresentation('stay-in-world', 'facility.shipping-bin')).toEqual({
      message: '你留在了此界。境界止步，山河未尽。',
      assetId: 'loc.farmstead'
    });

    expect(tribulationEndingToastPresentation('stay-in-world', 'loc.herb-plot')).toEqual({
      message: '你留在了此界。境界止步，山河未尽。',
      assetId: 'loc.herb-plot'
    });

    expect(tribulationEndingToastPresentation('stay-in-world', 'loc.farmstead')).toEqual({
      message: '你留在了此界。境界止步，山河未尽。',
      assetId: 'loc.farmstead'
    });
  });
});
