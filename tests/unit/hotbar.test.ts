import { describe, expect, it } from 'vitest';
import { HOTBAR_SLOTS, cycleHotbarIndex, findNextOwnedSeedHotbarIndex, hotbarIndexFromDigitKey, hotbarSlotAssetId, hotbarStatusText, hotbarToastPresentation, hotbarWheelDelta, ownedSeedHotbarIndex } from '@app/hotbar';

describe('热栏输入骨架', () => {
  it('数字键映射到稳定热栏索引', () => {
    expect(hotbarIndexFromDigitKey('1')).toBe(0);
    expect(hotbarIndexFromDigitKey('5')).toBe(4);
    expect(hotbarIndexFromDigitKey('9')).toBe(8);
    expect(hotbarIndexFromDigitKey('0')).toBe(9);
    expect(hotbarIndexFromDigitKey('x')).toBeNull;
  });

  it('热栏前四格为高频田间动作，后六格为种子', () => {
    expect(HOTBAR_SLOTS.slice(0, 4).map(slot => slot.kind)).toEqual(['till', 'water', 'harvest', 'channel-qi']);
    expect(HOTBAR_SLOTS.slice(4).every(slot => slot.kind === 'seed')).toBe(true);
  });

  it('热栏提示文案包含当前位与主交互说明', () => {
    const text = hotbarStatusText(
      4,
      () => '青苔',
      () => '翻地'
    );
    expect(text).toContain('热栏[5]');
    expect(text).toContain('青苔');
    expect(text).toContain('空格/E主交互');
  });

  it('热栏切换提示可带出当前槽位的图像主语', () => {
    expect(
      hotbarToastPresentation(
        0,
        () => '青苔',
        () => '翻地'
      )
    ).toEqual({
      message: '热栏[1] 翻地｜空格/E主交互',
      assetId: 'icon.item.rust-hoe'
    });
    expect(
      hotbarToastPresentation(
        4,
        () => '青苔',
        () => '翻地'
      )
    ).toEqual({
      message: '热栏[5] 青苔｜空格/E主交互',
      assetId: 'icon.seed.mossling'
    });
  });

  it('可循环切换热栏索引，并支持滚轮方向映射', () => {
    expect(cycleHotbarIndex(0, -1)).toBe(9);
    expect(cycleHotbarIndex(9, 1)).toBe(0);
    expect(cycleHotbarIndex(0, 1)).toBe(1);
    expect(cycleHotbarIndex(0, 2)).toBe(2);
    expect(hotbarWheelDelta(12)).toBe(1);
    expect(hotbarWheelDelta(-12)).toBe(-1);
    expect(hotbarWheelDelta(0)).toBe(0);
  });

  it('可跳过空种子槽位，找到仍有库存的下一包种子', () => {
    const counts: Record<string, number> = {
      'seed.mossling': 0,
      'seed.dewroot': 0,
      'seed.suncap': 3,
      'seed.stonegrain': 0,
      'seed.mistfern': 0,
      'seed.sunmoss': 1
    };
    expect(findNextOwnedSeedHotbarIndex(4, 1, seedId => counts[seedId] ?? 0)).toBe(6);
    expect(findNextOwnedSeedHotbarIndex(8, 1, seedId => counts[seedId] ?? 0)).toBe(9);
    expect(findNextOwnedSeedHotbarIndex(9, 1, () => 0)).toBeNull;
  });

  it('可优先锁定指定种子的稳定热栏槽位', () => {
    const counts: Record<string, number> = {
      'seed.mossling': 1,
      'seed.dewroot': 0,
      'seed.suncap': 2
    };
    expect(ownedSeedHotbarIndex('seed.mossling', seedId => counts[seedId] ?? 0)).toBe(4);
    expect(ownedSeedHotbarIndex('seed.suncap', seedId => counts[seedId] ?? 0)).toBe(6);
    expect(ownedSeedHotbarIndex('seed.dewroot', seedId => counts[seedId] ?? 0)).toBeNull;
    expect(ownedSeedHotbarIndex('seed.unknown', seedId => counts[seedId] ?? 0)).toBeNull;
  });

  it('可为当前热栏槽位解析对应展示图标资产', () => {
    expect(hotbarSlotAssetId(HOTBAR_SLOTS[0]!)).toBe('icon.item.rust-hoe');
    expect(hotbarSlotAssetId(HOTBAR_SLOTS[1]!)).toBe('icon.item.water-pail');
    expect(hotbarSlotAssetId(HOTBAR_SLOTS[2]!)).toBe('icon.item.sickle');
    expect(hotbarSlotAssetId(HOTBAR_SLOTS[3]!)).toBe('icon.item.array-core');
    expect(hotbarSlotAssetId(HOTBAR_SLOTS[4]!)).toBe('icon.seed.mossling');
  });

  it('所有热栏槽位都能稳定映射到唯一资源 id', () => {
    const assetIds = HOTBAR_SLOTS.map(slot => hotbarSlotAssetId(slot));
    expect(assetIds.every(id => typeof id === 'string' && id.startsWith('icon.'))).toBe(true);
    expect(new Set(assetIds).size).toBe(HOTBAR_SLOTS.length);
  });
});
