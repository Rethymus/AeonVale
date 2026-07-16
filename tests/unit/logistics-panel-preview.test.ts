import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { shippingPanelPreview, shippingToastPresentation, shippingUnavailableToastPresentation, storagePanelPreview, storageToastPresentation, storageUnavailableToastPresentation } from '@app/logisticsPanelPreview';

describe('logistics panel preview', () => {
  it('describes storage preview with quantity, quality, and warehouse occupancy', () => {
    const reg = buildRegistry();

    const preview = storagePanelPreview('deposit', { itemId: 'herb.mossling', count: 3, quality: 'spirit' }, 7, 48, reg);

    expect(preview).toEqual({
      title: '凡间青苔',
      details: '存入仓库\n数量 × 3\n灵品\n仓库占用 7/48\n高频材料入仓，给采收、补种、炼丹与阵材周转腾位',
      assetId: 'icon.herb.mossling',
      panelAssetId: 'loc.farmstead'
    });
  });

  it('describes shipping preview with unit price and expected payout', () => {
    const reg = buildRegistry();

    const preview = shippingPanelPreview('quality', { itemId: 'herb.dewroot', quality: 'treasure', count: 2, unitPrice: 6 }, reg);

    expect(preview).toEqual({
      title: '露根草',
      details: '品质出货\n珍品 × 2\n单价 灵石 × 6｜本次 × 12\n兑现高品质收成，换更稳的丹药、阵材与备劫余量',
      assetId: 'icon.herb.dewroot',
      panelAssetId: 'loc.farmstead'
    });
  });

  it('adds why-now guidance to storage and shipping previews without leaving the logistics thread', () => {
    const reg = buildRegistry();

    expect(storagePanelPreview('withdraw', { itemId: 'item.array-core', count: 1 }, 12, 48, reg).details).toContain('取回要加工、炼丹、布阵或出货的物资');

    expect(shippingPanelPreview('normal', { itemId: 'item.dried-herb', count: 2, unitPrice: 4 }, reg).details).toContain('回笼灵石，补种、炉料与备劫消耗不断档');
  });

  it('keeps logistics root previews on the farmstead thread while item icons remain the detail layer', () => {
    const reg = buildRegistry();

    expect(storagePanelPreview('withdraw', { itemId: 'herb.mossling', count: 1 }, 6, 48, reg).panelAssetId).toBe('loc.farmstead');

    expect(shippingPanelPreview('normal', { itemId: 'item.dried-herb', count: 1, unitPrice: 6 }, reg).panelAssetId).toBe('loc.farmstead');
  });

  it('builds storage toast presentation on the farmstead root thread', () => {
    const reg = buildRegistry();

    expect(storageToastPresentation('withdraw', { itemId: 'herb.mossling', count: 3, quality: 'spirit' }, '（2/4）', '空格/E/回车取出·Esc返回', reg)).toEqual({
      message: '仓储-取出（2/4）：凡间青苔·灵品×3｜Tab切换·空格/E/回车取出·Esc返回',
      assetId: 'loc.farmstead'
    });
  });

  it('builds shipping toast presentation on the farmstead root thread', () => {
    const reg = buildRegistry();

    expect(shippingToastPresentation('quality', { itemId: 'herb.dewroot', quality: 'treasure', count: 2, unitPrice: 6 }, '（1/3）', '空格/E/回车出货·Esc返回', reg)).toEqual({
      message: '品质出货（1/3）：露根草·珍品×2｜Tab切换·空格/E/回车出货·Esc返回',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors shipping-unavailable failures to the farmstead logistics root thread', () => {
    expect(shippingUnavailableToastPresentation('normal')).toEqual({
      message: '无普通物品可出货',
      assetId: 'loc.farmstead'
    });

    expect(shippingUnavailableToastPresentation('quality')).toEqual({
      message: '无品质灵草可出货',
      assetId: 'loc.farmstead'
    });
  });

  it('anchors storage-unavailable failures to the farmstead logistics root thread', () => {
    expect(storageUnavailableToastPresentation('deposit')).toEqual({
      message: '背包无可存物品',
      assetId: 'loc.farmstead'
    });

    expect(storageUnavailableToastPresentation('withdraw')).toEqual({
      message: '仓库为空',
      assetId: 'loc.farmstead'
    });
  });
});
