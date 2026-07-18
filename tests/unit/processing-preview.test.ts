import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { brewResultToastPresentation, dryingProcessingPanelPreview, furnaceHeatToastPresentation, furnaceRecipeToastPresentation, furnaceVisibilityToastPresentation, processingPositionRequiredToastPresentation, processingRecipeUnavailableToastPresentation, processingToastPresentation, processingUnavailableToastPresentation, staticProcessingPanelPreview } from '@app/processingPreview';

describe('processing panel preview', () => {
  it('makes drying preview explain the immediate input, output, and follow-up chain', () => {
    const reg = buildRegistry();

    const preview = dryingProcessingPanelPreview({ itemId: 'herb.dewroot', count: 3 }, reg);

    expect(preview).toEqual({
      title: '露根草',
      details: '晾晒加工\n库存 3 株｜本次投入 1 株\n产出：晾晒灵草 × 1\n品质：普通批次\n用途：先稳货性，再接封藏、炼丹与阵法前置',
      iconId: 'icon.herb.dewroot',
      panelAssetId: 'facility.drying-rack'
    });
  });

  it('shows quality drying bonus before the player starts processing', () => {
    const reg = buildRegistry();

    const preview = dryingProcessingPanelPreview({ itemId: 'herb.dewroot', count: 1, quality: 'treasure' }, reg);

    expect(preview.details).toContain('产出：晾晒灵草 × 3');
    expect(preview.details).toContain('品质：珍品｜额外产出 +2');
    expect(preview.details).toContain('封藏、炼丹与阵法前置');
  });

  it('describes sealing output with required materials and icon', () => {
    const reg = buildRegistry();

    const preview = staticProcessingPanelPreview('sealing', reg);

    expect(preview).toEqual({
      title: '封藏灵草',
      details: '封藏灵草\n耗时 2 日\n材料：晾晒灵草 × 2、灵壤肥 × 1\n用途：炼丹、交付或备劫药材',
      iconId: 'icon.item.sealed-herb',
      panelAssetId: 'facility.sealing-cabinet'
    });
  });

  it('describes furnace output with required materials and icon', () => {
    const reg = buildRegistry();

    const preview = staticProcessingPanelPreview('furnace', reg);

    expect(preview).toEqual({
      title: '阵核',
      details: '熔炼阵核\n耗时 1 日\n材料：破损法宝 × 1、灵石 × 2\n用途：布阵与抗劫防线',
      iconId: 'icon.item.array-core',
      panelAssetId: 'facility.talisman-furnace'
    });
  });

  it('defaults processing toast presentation to facility art for each mode', () => {
    expect(processingToastPresentation('drying', '露根草 × 2', '（1/3）', '空格/E/回车开始·Esc返回')).toEqual({
      message: '加工-晾晒（1/3）：露根草 × 2｜Tab切换·空格/E/回车开始·Esc返回',
      assetId: 'facility.drying-rack'
    });

    expect(processingToastPresentation('sealing', '封藏灵草', null, '空格/E/回车开始·Esc返回')).toEqual({
      message: '加工-封藏：封藏灵草｜Tab切换·空格/E/回车开始·Esc返回',
      assetId: 'facility.sealing-cabinet'
    });

    expect(processingToastPresentation('furnace', '阵核', null, '空格/E/回车开始·Esc返回')).toEqual({
      message: '加工-熔炼：阵核｜Tab切换·空格/E/回车开始·Esc返回',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('still accepts an explicit asset override for processing toasts when needed', () => {
    expect(processingToastPresentation('furnace', '阵核', null, '空格/E/回车开始·Esc返回', 'icon.item.array-core')).toEqual({
      message: '加工-熔炼：阵核｜Tab切换·空格/E/回车开始·Esc返回',
      assetId: 'icon.item.array-core'
    });
  });

  it('keeps drying-unavailable failures anchored to the drying facility thread', () => {
    expect(processingUnavailableToastPresentation('drying')).toEqual({
      message: '无可晾晒灵草',
      assetId: 'facility.drying-rack'
    });
  });

  it('keeps processing position-required failures anchored to the relevant facility thread', () => {
    expect(processingPositionRequiredToastPresentation('drying')).toEqual({
      message: '需站在晾晒架旁加工',
      assetId: 'facility.drying-rack'
    });

    expect(processingPositionRequiredToastPresentation('sealing')).toEqual({
      message: '需站在封藏柜旁加工',
      assetId: 'facility.sealing-cabinet'
    });

    expect(processingPositionRequiredToastPresentation('furnace')).toEqual({
      message: '需站在炼符炉旁加工',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('anchors furnace recipe-unavailable failures to the furnace thread', () => {
    expect(processingRecipeUnavailableToastPresentation('furnace')).toEqual({
      message: '无此丹方',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('anchors brew results to the furnace thread', () => {
    expect(brewResultToastPresentation('pill', { name: '避雷丹', furnaceHeat: 50 })).toEqual({
      message: '炼成 避雷丹（炉温50）｜可服用备劫或稳住修行',
      assetId: 'facility.talisman-furnace'
    });

    expect(brewResultToastPresentation('exploded', { name: '避雷丹', furnaceHeat: 90 })).toEqual({
      message: '炉崩丹毁｜药性相冲、寒热失御——丹炉轰然炸裂，毒火反噬入体。（炉温90）｜撤去相冲之料，或调火候压住寒热再试。',
      assetId: 'facility.talisman-furnace'
    });

    expect(brewResultToastPresentation('flawed', { name: '避雷丹', furnaceHeat: 20 })).toEqual({
      message: '残丹尚可｜火候略偏，丹成而质劣——勉强能用，却不如重炼。（炉温20）｜炉温再贴近丹方理想区间，可得正丹、上丹。',
      assetId: 'facility.talisman-furnace'
    });

    expect(brewResultToastPresentation('waste', { name: '避雷丹', furnaceHeat: 0 })).toEqual({
      message: '废丹一枚｜火候不当、药性离散——出炉只得一枚无用的废丹。（炉温0）｜核对此料对应的丹方，并把炉温挪进理想区间。',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('anchors furnace recipe and heat state toasts to the furnace thread', () => {
    expect(furnaceRecipeToastPresentation('净毒丹')).toEqual({
      message: '丹方：净毒丹',
      assetId: 'facility.talisman-furnace'
    });

    expect(furnaceHeatToastPresentation(40)).toEqual({
      message: '炉温 40',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('anchors furnace open-close state toasts to the furnace thread', () => {
    expect(furnaceVisibilityToastPresentation(true)).toEqual({
      message: '打开丹炉（Y 切丹方·[/] 调火候·B 炼制）',
      assetId: 'facility.talisman-furnace'
    });

    expect(furnaceVisibilityToastPresentation(false)).toEqual({
      message: '关闭丹炉',
      assetId: 'facility.talisman-furnace'
    });
  });
});
