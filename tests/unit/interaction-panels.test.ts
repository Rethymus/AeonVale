import { describe, expect, it } from 'vitest';
import { FARM_ACTION_ORDER, cycleSelection, farmActionIndexFromDigitKey, farmActionLabel, interactionPanelActive, normalizeSelection, npcActionIndexFromDigitKey, selectionLabel, type InteractionPanelState } from '@app/interactionPanels';

describe('交互面板状态工具', () => {
  it('可识别面板是否激活', () => {
    const none: InteractionPanelState = { kind: 'none' };
    const farmAction: InteractionPanelState = { kind: 'farm-action' };
    const npcAction: InteractionPanelState = { kind: 'npc-action' };
    const build: InteractionPanelState = { kind: 'build' };
    const upgrade: InteractionPanelState = { kind: 'upgrade' };
    const npc: InteractionPanelState = { kind: 'npc', mode: 'gift' };
    const festival: InteractionPanelState = { kind: 'festival' };
    const trade: InteractionPanelState = { kind: 'trade' };
    const storage: InteractionPanelState = { kind: 'storage', mode: 'deposit' };
    const processing: InteractionPanelState = { kind: 'processing', mode: 'drying' };
    expect(interactionPanelActive(none)).toBe(false);
    expect(interactionPanelActive(farmAction)).toBe(true);
    expect(interactionPanelActive(npcAction)).toBe(true);
    expect(interactionPanelActive(build)).toBe(true);
    expect(interactionPanelActive(upgrade)).toBe(true);
    expect(interactionPanelActive(npc)).toBe(true);
    expect(interactionPanelActive(festival)).toBe(true);
    expect(interactionPanelActive(trade)).toBe(true);
    expect(interactionPanelActive(storage)).toBe(true);
    expect(interactionPanelActive(processing)).toBe(true);
  });

  it('可稳定归一化与循环选择索引', () => {
    expect(normalizeSelection(0, 3)).toBe(0);
    expect(normalizeSelection(4, 3)).toBe(1);
    expect(normalizeSelection(-1, 3)).toBe(2);
    expect(cycleSelection(0, 3)).toBe(1);
    expect(cycleSelection(0, 3, true)).toBe(2);
    expect(cycleSelection(0, 0)).toBe(0);
  });

  it('可生成人类可读的序号标签', () => {
    expect(selectionLabel(0, 3)).toBe('[1/3]');
    expect(selectionLabel(4, 3)).toBe('[2/3]');
    expect(selectionLabel(0, 0)).toBe('[0/0]');
  });

  it('农庄操作顺序稳定且具有人类可读标签', () => {
    expect(FARM_ACTION_ORDER).toEqual(['build', 'facility-collect', 'storage-deposit', 'storage-withdraw', 'processing-drying', 'processing-sealing', 'processing-furnace', 'shipping-normal', 'shipping-quality', 'upgrade']);
    expect(farmActionLabel('build')).toBe('建造');
    expect(farmActionLabel('facility-collect')).toBe('设施收取');
    expect(farmActionLabel('upgrade')).toBe('扩建');
  });

  it('农庄操作面板支持数字键直选稳定映射', () => {
    expect(farmActionIndexFromDigitKey('1')).toBe(0);
    expect(farmActionIndexFromDigitKey('3')).toBe(2);
    expect(farmActionIndexFromDigitKey('9')).toBe(8);
    expect(farmActionIndexFromDigitKey('0')).toBe(9);
    expect(farmActionIndexFromDigitKey('x')).toBeNull;
  });

  it('人物操作入口支持数字键直选稳定映射', () => {
    expect(npcActionIndexFromDigitKey('1')).toBe(0);
    expect(npcActionIndexFromDigitKey('2')).toBe(1);
    expect(npcActionIndexFromDigitKey('3')).toBe(2);
    expect(npcActionIndexFromDigitKey('0')).toBeNull;
    expect(npcActionIndexFromDigitKey('4')).toBeNull;
  });
});
