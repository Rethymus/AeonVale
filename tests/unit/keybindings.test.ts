import { describe, expect, it } from 'vitest';
import { resolveCommandShortcut, resolveDigitShortcut, resolveEnterShortcut, resolveEscapeShortcut, resolveExplorationLocationShortcut, resolveFarmActionShortcut, resolveFarmMenuShortcut, resolveLegacyBuildShortcut, resolveLegacyConfirmShortcut, resolveLocationServiceShortcut, resolvePageDownShortcut, resolvePageUpShortcut, resolvePrimaryInteractionShortcut, resolveQShortcut, resolveQuickLocationShortcut, resolveTabShortcut, shouldPreserveInteractionPanelForKey, shouldPreserveLocationSelectionForKey, resolveWorldActionShortcut } from '@app/keybindings';
import { hotbarStatusText } from '@app/hotbar';

describe('农庄兼容功能键映射', () => {
  it('将旧功能键解析为统一的农庄操作预选项', () => {
    expect(resolveFarmActionShortcut('F1', false)?.kind).toBe('facility-collect');
    expect(resolveFarmActionShortcut('F2', false)?.kind).toBe('storage-deposit');
    expect(resolveFarmActionShortcut('F4', false)?.kind).toBe('storage-withdraw');
    expect(resolveFarmActionShortcut('F9', false)?.kind).toBe('shipping-normal');
    expect(resolveFarmActionShortcut('Insert', false)?.kind).toBe('shipping-quality');
  });

  it('区分 Shift 修饰键对应的旧兼容入口', () => {
    expect(resolveFarmActionShortcut('F5', false)?.legacyLabel).toBe('F5');
    expect(resolveFarmActionShortcut('F5', true)?.legacyLabel).toBe('Shift+F5');
    expect(resolveFarmActionShortcut('F11', false)?.kind).toBe('processing-sealing');
    expect(resolveFarmActionShortcut('F11', true)?.kind).toBe('processing-furnace');
  });

  it('忽略未纳入农庄兼容组的按键', () => {
    expect(resolveFarmActionShortcut('F11', false)?.legacyLabel).toBe('F11');
    expect(resolveFarmActionShortcut('M', true)).toBeNull;
    expect(resolveFarmActionShortcut('PageDown', false)).toBeNull;
    expect(resolveFarmActionShortcut('F2', true)).toBeNull;
  });
});

describe('地点服务与旧确认兼容键映射', () => {
  it('将旧地点键解析为地点服务预选入口', () => {
    expect(resolveLocationServiceShortcut('o', false)).toEqual({ locationId: 'valley-market', command: 'browse-trade', legacyLabel: 'O' });
    expect(resolveLocationServiceShortcut('O', false)).toEqual({ locationId: 'valley-market', command: 'browse-trade', legacyLabel: 'O' });
    expect(resolveLocationServiceShortcut(',', false)).toEqual({ locationId: 'valley-market', command: 'browse-shop', legacyLabel: ',' });
    expect(resolveLocationServiceShortcut(',', true)).toEqual({ locationId: 'festival-ground', command: 'browse-festival-stall', legacyLabel: ',' });
  });

  it('将旧探索键解析为地点目录中的探索服务预选入口', () => {
    expect(resolveExplorationLocationShortcut(';', false)).toEqual({ locationId: 'valley-outskirts', command: 'explore-valley', legacyLabel: ';' });
    expect(resolveExplorationLocationShortcut('Semicolon', false)).toEqual({ locationId: 'valley-outskirts', command: 'explore-valley', legacyLabel: ';' });
    expect(resolveExplorationLocationShortcut('l', false)).toEqual({ locationId: 'ruin-gate', command: 'explore-ruin', legacyLabel: 'L' });
    expect(resolveExplorationLocationShortcut('L', true)).toEqual({ locationId: 'ruin-gate', command: 'delve-ruin', legacyLabel: 'Shift+L' });
    expect(resolveExplorationLocationShortcut('/', false)).toEqual({ locationId: 'spirit-vein', command: 'explore-spirit-vein', legacyLabel: '/' });
    expect(resolveExplorationLocationShortcut('L', false)).toBeNull;
  });

  it('识别旧确认键与旧兼容执行键', () => {
    expect(resolveLegacyConfirmShortcut('.', false)).toBe('period');
    expect(resolveLegacyConfirmShortcut('Enter', true)).toBe('ctrl-enter');
    expect(resolveLegacyConfirmShortcut('Enter', false)).toBeNull;
  });

  it('识别留世高频地点直达键', () => {
    expect(resolveQuickLocationShortcut('q', true)).toBe('staying-commission');
    expect(resolveQuickLocationShortcut('W', true)).toBe('tea-shed');
    expect(resolveQuickLocationShortcut('e', true)).toBe('greenhouse');
    expect(resolveQuickLocationShortcut('e', false)).toBeNull;
  });
});

describe('主循环高频键上下文路由', () => {
  it('按 Stardew-like 优先级解析 Tab 在面板、地点与背包间的职责', () => {
    expect(resolveTabShortcut({ interactionPanelActive: true, locationSelectionActive: true, shiftKey: false })).toBe('cycle-interaction-panel');
    expect(resolveTabShortcut({ interactionPanelActive: false, locationSelectionActive: true, shiftKey: false })).toBe('cycle-location');
    expect(resolveTabShortcut({ interactionPanelActive: false, locationSelectionActive: true, shiftKey: true })).toBe('cycle-location-service');
    expect(resolveTabShortcut({ interactionPanelActive: false, locationSelectionActive: false, shiftKey: true })).toBe('cycle-location');
    expect(resolveTabShortcut({ interactionPanelActive: false, locationSelectionActive: false, shiftKey: false })).toBe('toggle-inventory');
  });

  it('按当前 UI 栈顺序解析 Escape 的关闭与暂停行为', () => {
    expect(resolveEscapeShortcut({ interactionPanelActive: true, inventoryVisible: true, cultivationPanelVisible: true, locationSelectionActive: true })).toBe('clear-interaction-panel');
    expect(resolveEscapeShortcut({ interactionPanelActive: false, inventoryVisible: true, cultivationPanelVisible: true, locationSelectionActive: true })).toBe('toggle-inventory');
    expect(resolveEscapeShortcut({ interactionPanelActive: false, inventoryVisible: false, cultivationPanelVisible: true, locationSelectionActive: true })).toBe('close-cultivation-panel');
    expect(resolveEscapeShortcut({ interactionPanelActive: false, inventoryVisible: false, cultivationPanelVisible: false, locationSelectionActive: true })).toBe('clear-location-selection');
    expect(resolveEscapeShortcut({ interactionPanelActive: false, inventoryVisible: false, cultivationPanelVisible: false, locationSelectionActive: false })).toBe('toggle-pause');
  });

  it('解析 Q 的快捷直达、静修与热栏轮转优先级', () => {
    expect(resolveQShortcut({ ctrlKey: true, shiftKey: true, quickLocationShortcut: 'staying-commission' })).toBe('quick-staying-commission');
    expect(resolveQShortcut({ ctrlKey: true, shiftKey: false, quickLocationShortcut: null })).toBe('rest');
    expect(resolveQShortcut({ ctrlKey: false, shiftKey: true, quickLocationShortcut: null })).toBe('cycle-hotbar-backward');
    expect(resolveQShortcut({ ctrlKey: false, shiftKey: false, quickLocationShortcut: null })).toBe('cycle-hotbar-forward');
  });

  it('解析空格/E 的默认确认、暖棚直达与飞升丹窄入口优先级', () => {
    expect(resolvePrimaryInteractionShortcut({ key: ' ', shiftKey: false, quickLocationShortcut: null })).toBe('default-confirm');
    expect(resolvePrimaryInteractionShortcut({ key: 'e', shiftKey: false, quickLocationShortcut: 'greenhouse' })).toBe('quick-greenhouse');
    expect(resolvePrimaryInteractionShortcut({ key: 'E', shiftKey: true, quickLocationShortcut: null })).toBe('ascend-pill');
    expect(resolvePrimaryInteractionShortcut({ key: 'E', shiftKey: false, quickLocationShortcut: null })).toBe('default-confirm');
  });

  it('热栏与主确认提示文案同步显式包含 E', () => {
    expect(
      hotbarStatusText(
        0,
        () => '青苔',
        () => '翻地'
      )
    ).toContain('空格/E主交互');
  });

  it('解析 Enter 的确认上下文优先级', () => {
    expect(resolveEnterShortcut({ ctrlKey: true, interactionPanelActive: true, locationSelectionActive: true })).toBe('confirm-location-service');
    expect(resolveEnterShortcut({ ctrlKey: false, interactionPanelActive: true, locationSelectionActive: true })).toBe('confirm-interaction-panel');
    expect(resolveEnterShortcut({ ctrlKey: false, interactionPanelActive: false, locationSelectionActive: true })).toBe('confirm-location-service');
    expect(resolveEnterShortcut({ ctrlKey: false, interactionPanelActive: false, locationSelectionActive: false })).toBe('end-day');
  });

  it('解析数字键在农庄面板、地点目录预选与热栏之间的路由', () => {
    expect(resolveDigitShortcut({ key: '1', code: 'Digit1', shiftKey: false, farmActionPanelActive: true, locationSelectionActive: true })).toBe('farm-action-select');
    expect(resolveDigitShortcut({ key: '2', code: 'Digit2', shiftKey: true, farmActionPanelActive: false, locationSelectionActive: true })).toBe('location-select');
    expect(resolveDigitShortcut({ key: '@', code: 'Digit2', shiftKey: true, farmActionPanelActive: false, locationSelectionActive: true })).toBe('location-select');
    expect(resolveDigitShortcut({ key: '2', code: 'Digit2', shiftKey: false, farmActionPanelActive: false, locationSelectionActive: true })).toBe('location-service-select');
    expect(resolveDigitShortcut({ key: '3', code: 'Digit3', shiftKey: false, farmActionPanelActive: false, locationSelectionActive: false })).toBe('hotbar-select');
    expect(resolveDigitShortcut({ key: '!', code: 'Digit1', shiftKey: true, farmActionPanelActive: false, locationSelectionActive: false })).toBeNull;
    expect(resolveDigitShortcut({ key: 'M', code: 'KeyM', shiftKey: false, farmActionPanelActive: false, locationSelectionActive: false })).toBeNull;
  });

  it('解析 M 与 Shift+M 的农庄菜单入口语义', () => {
    expect(resolveFarmMenuShortcut('M', true)).toBe('open-farm-menu');
    expect(resolveFarmMenuShortcut('M', false)).toBe('open-farm-menu');
    expect(resolveFarmMenuShortcut('m', true)).toBeNull;
  });

  it('解析 F5 与 Shift+F5 的旧建造兼容入口', () => {
    expect(resolveLegacyBuildShortcut('F5', true)).toBe('open-furnace-build-menu');
    expect(resolveLegacyBuildShortcut('F5', false)).toBe('preselect-build');
    expect(resolveLegacyBuildShortcut('F6', false)).toBeNull;
  });

  it('解析 PageUp 的委托面板与遗迹章节推进入口', () => {
    expect(resolvePageUpShortcut('PageUp', true)).toBe('claim-ruin-chapter');
    expect(resolvePageUpShortcut('PageUp', false)).toBe('open-commission');
    expect(resolvePageUpShortcut('PageDown', false)).toBeNull;
  });

  it('解析 PageDown 的主线推进、委托确认与无操作回退', () => {
    expect(resolvePageDownShortcut({ key: 'PageDown', shiftKey: true, interactionPanelKind: 'commission', interactionPanelActive: true })).toBe('claim-mainline-quest');
    expect(resolvePageDownShortcut({ key: 'PageDown', shiftKey: false, interactionPanelKind: 'commission', interactionPanelActive: true })).toBe('confirm-commission-panel');
    expect(resolvePageDownShortcut({ key: 'PageDown', shiftKey: false, interactionPanelKind: 'inventory', interactionPanelActive: true })).toBe('noop');
    expect(resolvePageDownShortcut({ key: 'PageDown', shiftKey: false, interactionPanelKind: 'none', interactionPanelActive: false })).toBe('open-commission');
    expect(resolvePageDownShortcut({ key: 'PageUp', shiftKey: false, interactionPanelKind: 'none', interactionPanelActive: false })).toBeNull;
  });

  it('解析全局命令键的暂停、探索、社交与日程入口', () => {
    expect(resolveCommandShortcut('p', false)).toBe('toggle-pause');
    expect(resolveCommandShortcut('P', false)).toBe('toggle-pause');
    expect(resolveCommandShortcut('.', false)).toBe('legacy-confirm');
    expect(resolveCommandShortcut(';', false)).toBeNull;
    expect(resolveCommandShortcut('l', false)).toBeNull;
    expect(resolveCommandShortcut('l', true)).toBeNull;
    expect(resolveCommandShortcut('/', false)).toBeNull;
    expect(resolveCommandShortcut('=', false)).toBe('open-upgrade-panel');
    expect(resolveCommandShortcut('-', false)).toBe('open-npc-browse');
    expect(resolveCommandShortcut('\\', false)).toBe('open-npc-gift');
    expect(resolveCommandShortcut('|', false)).toBe('open-npc-quest');
    expect(resolveCommandShortcut('End', false)).toBe('open-festival-panel');
    expect(resolveCommandShortcut('?', false)).toBe('show-calendar-summary');
    expect(resolveCommandShortcut('M', false)).toBeNull;
  });

  it('解析领域动作键的农务、修炼、炼丹、阵法与丹炉入口', () => {
    expect(resolveWorldActionShortcut('z', false)).toBe('seed-from-hotbar');
    expect(resolveWorldActionShortcut('Z', false)).toBe('seed-from-hotbar');
    expect(resolveWorldActionShortcut('x', false)).toBe('water-front-tile');
    expect(resolveWorldActionShortcut('X', false)).toBe('water-front-tile');
    expect(resolveWorldActionShortcut('Home', false)).toBe('fertilize-front-tile');
    expect(resolveWorldActionShortcut('c', false)).toBe('toggle-cultivation-panel');
    expect(resolveWorldActionShortcut('C', false)).toBe('toggle-cultivation-panel');
    expect(resolveWorldActionShortcut('v', false)).toBe('harvest-front-tile');
    expect(resolveWorldActionShortcut('V', false)).toBe('harvest-front-tile');
    expect(resolveWorldActionShortcut('t', false)).toBe('tribulation');
    expect(resolveWorldActionShortcut('g', false)).toBe('hunt-beast');
    expect(resolveWorldActionShortcut('g', true)).toBe('feed-guard-beast');
    expect(resolveWorldActionShortcut('!', false)).toBe('train-push-up');
    expect(resolveWorldActionShortcut('@', false)).toBe('train-sit-up');
    expect(resolveWorldActionShortcut('#', false)).toBe('train-squat');
    expect(resolveWorldActionShortcut(')', false)).toBe('train-long-run');
    expect(resolveWorldActionShortcut('b', false)).toBe('brew-selected-recipe');
    expect(resolveWorldActionShortcut('n', false)).toBe('brew-bone-pill');
    expect(resolveWorldActionShortcut('m', false)).toBe('brew-detox-pill');
    expect(resolveWorldActionShortcut('h', false)).toBe('eat-ward-pill');
    expect(resolveWorldActionShortcut('j', false)).toBe('eat-bone-pill');
    expect(resolveWorldActionShortcut('k', false)).toBe('eat-detox-pill');
    expect(resolveWorldActionShortcut('r', false)).toBe('place-lightning-rod-array');
    expect(resolveWorldActionShortcut('f', false)).toBe('place-insulation-array');
    expect(resolveWorldActionShortcut('i', false)).toBe('toggle-inventory');
    expect(resolveWorldActionShortcut('u', false)).toBe('toggle-furnace');
    expect(resolveWorldActionShortcut('y', false)).toBe('cycle-recipe');
    expect(resolveWorldActionShortcut('[', false)).toBe('decrease-furnace-heat');
    expect(resolveWorldActionShortcut(']', false)).toBe('increase-furnace-heat');
    expect(resolveWorldActionShortcut('M', false)).toBeNull;
  });

  it('为 E、旧确认键、委托 PageDown 与农庄菜单保留当前交互面板上下文', () => {
    expect(
      shouldPreserveInteractionPanelForKey({
        key: 'e',
        isModifierOnly: false,
        farmActionDigitActive: false,
        npcActionDigitActive: false,
        primaryInteractionShortcut: 'default-confirm',
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        pageDownShortcut: null,
        commandShortcut: null
      })
    ).toBe(true);
    expect(
      shouldPreserveInteractionPanelForKey({
        key: '.',
        isModifierOnly: false,
        farmActionDigitActive: false,
        npcActionDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        pageDownShortcut: null,
        commandShortcut: 'legacy-confirm'
      })
    ).toBe(true);
    expect(
      shouldPreserveInteractionPanelForKey({
        key: 'PageDown',
        isModifierOnly: false,
        farmActionDigitActive: false,
        npcActionDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        pageDownShortcut: 'confirm-commission-panel',
        commandShortcut: null
      })
    ).toBe(true);
    expect(
      shouldPreserveInteractionPanelForKey({
        key: 'M',
        isModifierOnly: false,
        farmActionDigitActive: false,
        npcActionDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        pageDownShortcut: null,
        commandShortcut: null,
        farmMenuShortcut: 'open-farm-menu'
      })
    ).toBe(true);
    expect(
      shouldPreserveInteractionPanelForKey({
        key: 'x',
        isModifierOnly: false,
        farmActionDigitActive: false,
        npcActionDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        pageDownShortcut: null,
        commandShortcut: null
      })
    ).toBe(false);
  });

  it('为地点目录中的 E 与旧确认键保留当前地点选择上下文', () => {
    expect(
      shouldPreserveLocationSelectionForKey({
        key: 'E',
        isModifierOnly: false,
        locationDigitActive: false,
        locationServiceDigitActive: false,
        primaryInteractionShortcut: 'default-confirm',
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        commandShortcut: null
      })
    ).toBe(true);
    expect(
      shouldPreserveLocationSelectionForKey({
        key: '.',
        isModifierOnly: false,
        locationDigitActive: false,
        locationServiceDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        commandShortcut: 'legacy-confirm'
      })
    ).toBe(true);
    expect(
      shouldPreserveLocationSelectionForKey({
        key: '4',
        isModifierOnly: false,
        locationDigitActive: false,
        locationServiceDigitActive: true,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        commandShortcut: null
      })
    ).toBe(true);
    expect(
      shouldPreserveLocationSelectionForKey({
        key: 'x',
        isModifierOnly: false,
        locationDigitActive: false,
        locationServiceDigitActive: false,
        primaryInteractionShortcut: null,
        enterShortcut: null,
        escapeShortcut: null,
        tabShortcut: null,
        commandShortcut: null
      })
    ).toBe(false);
  });
});
