import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { buildPanelPreview, buildResultToastPresentation, buildToastPresentation, facilityCollectPanelPreview, facilityCollectToastPresentation, facilityCollectUnavailableToastPresentation, upgradePanelPreview, upgradeResultToastPresentation, upgradeToastPresentation, upgradeUnavailableToastPresentation } from '@app/facilityPanelPreview';
import { UPGRADE_CATALOG } from '@sim';

describe('facility panel preview', () => {
  it('describes build panel with cost, unlock, and placement rule', () => {
    const reg = buildRegistry();

    const preview = buildPanelPreview('drying-rack', reg);

    expect(preview).toEqual({
      title: '晾晒架',
      details: '设施建造\n材料：灵石 × 3、凡间青苔 × 2\n初始可建\n需建在农庄核心区',
      assetId: 'loc.farmstead'
    });
  });

  it('describes upgrade panel with effect summary and conditions', () => {
    const reg = buildRegistry();
    const upgrade = UPGRADE_CATALOG.find(entry => entry.id === 'greenhouse-nursery-2');
    expect(upgrade).toBeTruthy;

    const preview = upgradePanelPreview(upgrade!, reg);

    expect(preview).toEqual({
      title: '暖棚温渠加固',
      details: '升级建设\n材料：灵石 × 26、阵核 × 2、残卷 × 2、雾蕨 × 4\n效果：提升暖棚苗床与养护能力\n条件：需留世后继续经营\n条件：需先完成前置扩建',
      assetId: 'loc.greenhouse'
    });
  });

  it('maps upgrade types to reusable preview asset ids', () => {
    const reg = buildRegistry();
    const expansion = UPGRADE_CATALOG.find(entry => entry.id === 'farmstead-expansion-1');
    const storage = UPGRADE_CATALOG.find(entry => entry.id === 'storage-ring-1');
    const hoe = UPGRADE_CATALOG.find(entry => entry.id === 'tool-hoe-1');
    const autoload = UPGRADE_CATALOG.find(entry => entry.id === 'farm-autoload-1');

    expect(upgradePanelPreview(expansion!, reg).assetId).toBe('loc.herb-plot');
    expect(upgradePanelPreview(storage!, reg).assetId).toBe('loc.farmstead');
    expect(upgradePanelPreview(hoe!, reg).assetId).toBe('icon.item.rust-hoe');
    expect(upgradePanelPreview(autoload!, reg).assetId).toBe('sprite.guard-beast-wolf');
  });

  it('describes ready facility collect state', () => {
    const preview = facilityCollectPanelPreview({
      kind: 'sealing-cabinet',
      ready: true,
      daysRemaining: 0
    });

    expect(preview).toEqual({
      title: '封藏柜',
      details: '设施收取\n产物已完成，可立即收取',
      assetId: 'facility.sealing-cabinet'
    });
  });

  it('describes in-progress facility collect state', () => {
    const preview = facilityCollectPanelPreview({
      kind: 'talisman-furnace',
      ready: false,
      daysRemaining: 2
    });

    expect(preview).toEqual({
      title: '炼符炉',
      details: '设施收取\n加工中，还需 2 日',
      assetId: 'facility.talisman-furnace'
    });
  });

  it('keeps facility collect toast presentation on the concrete facility thread', () => {
    const preview = facilityCollectToastPresentation(
      {
        kind: 'sealing-cabinet',
        ready: true,
        daysRemaining: 0
      },
      '（1/2）',
      '空格/E/回车收取·Esc返回'
    );

    expect(preview).toEqual({
      message: '设施收取（1/2）：封藏柜｜可收取｜Tab切换·空格/E/回车收取·Esc返回',
      assetId: 'facility.sealing-cabinet'
    });
  });

  it('reuses build preview asset in build toast presentation', () => {
    const reg = buildRegistry();

    expect(buildToastPresentation('talisman-furnace', '（3/3）', '空格/E/回车建造·Esc返回', reg)).toEqual({
      message: '建造（3/3）：炼符炉｜Tab切换·空格/E/回车建造·Esc返回',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps build previews on the farmstead thread while facility-collect previews move to the concrete facility thread', () => {
    const reg = buildRegistry();

    expect(buildPanelPreview('talisman-furnace', reg).assetId).toBe('loc.farmstead');
    expect(
      facilityCollectPanelPreview({
        kind: 'drying-rack',
        ready: false,
        daysRemaining: 1
      }).assetId
    ).toBe('facility.drying-rack');
  });

  it('keeps build result toasts on the concrete facility thread once a build target is explicit', () => {
    expect(buildResultToastPresentation('drying-rack', 'success')).toEqual({
      message: '建造完成：晾晒架',
      assetId: 'facility.drying-rack'
    });

    expect(buildResultToastPresentation('sealing-cabinet', 'failure', '封藏柜需农庄扩建1阶，当前为0阶')).toEqual({
      message: '建造失败：封藏柜需农庄扩建1阶，当前为0阶',
      assetId: 'facility.sealing-cabinet'
    });
  });

  it('reuses upgrade preview asset in upgrade toast presentation', () => {
    const reg = buildRegistry();
    const upgrade = UPGRADE_CATALOG.find(entry => entry.id === 'farmstead-expansion-1');
    expect(upgrade).toBeTruthy;

    expect(upgradeToastPresentation(upgrade!, '（1/2）', '空格/E/回车升级·Esc返回', reg)).toEqual({
      message: '升级（1/2）：农庄扩建一阶｜Tab切换·空格/E/回车升级·Esc返回',
      assetId: 'loc.herb-plot'
    });
  });

  it('reuses upgrade preview asset in upgrade result toasts', () => {
    const reg = buildRegistry();
    const greenhouse = UPGRADE_CATALOG.find(entry => entry.id === 'greenhouse-nursery-1');
    const storage = UPGRADE_CATALOG.find(entry => entry.id === 'storage-ring-1');
    expect(greenhouse).toBeTruthy;
    expect(storage).toBeTruthy;

    expect(upgradeResultToastPresentation(greenhouse!, 'success', reg, '棚温更稳，暖棚养护收益提高')).toEqual({
      message: '暖棚苗床扩建完成｜棚温更稳，暖棚养护收益提高',
      assetId: 'loc.greenhouse'
    });

    expect(upgradeResultToastPresentation(storage!, 'failure', reg, '材料不足')).toEqual({
      message: '升级失败：材料不足',
      assetId: 'loc.farmstead'
    });
  });

  it('keeps upgrade and facility-collect empty states on farmstead by default and allows context overrides', () => {
    expect(upgradeUnavailableToastPresentation()).toEqual({
      message: '暂无可升级建设',
      assetId: 'loc.farmstead'
    });

    expect(upgradeUnavailableToastPresentation('facility.array-eye')).toEqual({
      message: '暂无可升级建设',
      assetId: 'facility.array-eye'
    });

    expect(facilityCollectUnavailableToastPresentation()).toEqual({
      message: '身旁无可收取设施',
      assetId: 'loc.farmstead'
    });

    expect(facilityCollectUnavailableToastPresentation('loc.herb-plot')).toEqual({
      message: '身旁无可收取设施',
      assetId: 'loc.herb-plot'
    });
  });
});
