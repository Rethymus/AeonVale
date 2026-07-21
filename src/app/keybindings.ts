import type { FarmActionKind } from './interactionPanels';
import type { LocationId, LocationServiceCommand } from '@sim/world/locations';

export interface FarmActionShortcutMatch {
  kind: FarmActionKind;
  legacyLabel: string;
}

export interface LocationServiceShortcutMatch {
  locationId: LocationId;
  command: LocationServiceCommand;
  legacyLabel: string;
}

export interface ExplorationLocationShortcutMatch {
  locationId: LocationId;
  command: LocationServiceCommand;
  legacyLabel: string;
}

export type LegacyConfirmShortcut = 'period' | 'ctrl-enter';

export type QuickLocationShortcut = 'staying-commission' | 'tea-shed' | 'greenhouse';

export type TabShortcutAction = 'cycle-interaction-panel' | 'cycle-location' | 'cycle-location-service' | 'toggle-inventory';

export type EscapeShortcutAction = 'clear-interaction-panel' | 'toggle-inventory' | 'close-cultivation-panel' | 'clear-location-selection' | 'toggle-pause';

export type QShortcutAction = 'quick-staying-commission' | 'rest' | 'cycle-hotbar-forward' | 'cycle-hotbar-backward';

export type PrimaryInteractionShortcutAction = 'default-confirm' | 'quick-greenhouse' | 'ascend-pill';

export type EnterShortcutAction = 'confirm-location-service' | 'confirm-interaction-panel' | 'end-day';

export type DigitShortcutAction = 'farm-action-select' | 'location-select' | 'location-service-select' | 'hotbar-select';

export type FarmMenuShortcutAction = 'open-farm-menu';

export type PageUpShortcutAction = 'claim-ruin-chapter' | 'open-commission';

export type PageDownShortcutAction = 'claim-mainline-quest' | 'confirm-commission-panel' | 'open-commission' | 'noop';

export type CommandShortcutAction = 'toggle-pause' | 'legacy-confirm' | 'open-upgrade-panel' | 'open-npc-browse' | 'open-npc-gift' | 'open-npc-quest' | 'open-festival-panel' | 'show-calendar-summary';

export type WorldActionShortcutAction = 'seed-from-hotbar' | 'water-front-tile' | 'fertilize-front-tile' | 'toggle-cultivation-panel' | 'harvest-front-tile' | 'tribulation' | 'hunt-beast' | 'feed-guard-beast' | 'train-push-up' | 'train-sit-up' | 'train-squat' | 'train-long-run' | 'brew-bone-pill' | 'brew-detox-pill' | 'eat-ward-pill' | 'eat-bone-pill' | 'eat-detox-pill' | 'place-lightning-rod-array' | 'place-insulation-array' | 'toggle-inventory' | 'toggle-furnace' | 'cycle-recipe' | 'decrease-furnace-heat' | 'increase-furnace-heat';

export type LegacyBuildShortcutAction = 'open-furnace-build-menu' | 'preselect-build';

export function shouldPreserveInteractionPanelForKey(options: { key: string; isModifierOnly: boolean; farmActionDigitActive: boolean; npcActionDigitActive: boolean; primaryInteractionShortcut: PrimaryInteractionShortcutAction | null; enterShortcut: EnterShortcutAction | null; escapeShortcut: EscapeShortcutAction | null; tabShortcut: TabShortcutAction | null; pageDownShortcut: PageDownShortcutAction | null; commandShortcut: CommandShortcutAction | null; farmMenuShortcut?: FarmMenuShortcutAction | null; quickLocationShortcut?: QuickLocationShortcut | null }): boolean {
  if (options.isModifierOnly) return true;
  if (options.tabShortcut != null) return true;
  if (options.quickLocationShortcut != null) return true;
  if (options.enterShortcut === 'confirm-interaction-panel') return true;
  if (options.escapeShortcut === 'clear-interaction-panel') return true;
  if (options.primaryInteractionShortcut === 'default-confirm') return true;
  if (options.farmActionDigitActive || options.npcActionDigitActive) return true;
  if (options.pageDownShortcut != null) return true;
  if (options.commandShortcut === 'legacy-confirm') return true;
  if (options.farmMenuShortcut === 'open-farm-menu') return true;
  return false;
}

export function shouldPreserveLocationSelectionForKey(options: { key: string; isModifierOnly: boolean; locationDigitActive: boolean; locationServiceDigitActive: boolean; primaryInteractionShortcut: PrimaryInteractionShortcutAction | null; enterShortcut: EnterShortcutAction | null; escapeShortcut: EscapeShortcutAction | null; tabShortcut: TabShortcutAction | null; commandShortcut: CommandShortcutAction | null; quickLocationShortcut?: QuickLocationShortcut | null }): boolean {
  if (options.isModifierOnly) return true;
  if (options.tabShortcut != null) return true;
  if (options.quickLocationShortcut != null) return true;
  if (options.enterShortcut === 'confirm-location-service') return true;
  if (options.escapeShortcut === 'clear-location-selection') return true;
  if (options.primaryInteractionShortcut === 'default-confirm') return true;
  if (options.locationDigitActive || options.locationServiceDigitActive) return true;
  if (options.commandShortcut === 'legacy-confirm') return true;
  return false;
}

interface FarmActionShortcutDef extends FarmActionShortcutMatch {
  key: string;
  shiftKey?: boolean;
}

interface LocationServiceShortcutDef extends LocationServiceShortcutMatch {
  key: string;
}

interface ExplorationLocationShortcutDef extends ExplorationLocationShortcutMatch {
  key: string;
  shiftKey?: boolean;
}

interface QuickLocationShortcutDef {
  key: string;
  altKey: true;
  quickId: QuickLocationShortcut;
  legacyLabel: string;
}

const FARM_ACTION_SHORTCUTS: readonly FarmActionShortcutDef[] = [
  { key: 'F1', kind: 'facility-collect', legacyLabel: 'F1' },
  { key: 'F2', kind: 'storage-deposit', legacyLabel: 'F2' },
  { key: 'F3', kind: 'storage-deposit', legacyLabel: 'F3' },
  { key: 'F4', kind: 'storage-withdraw', legacyLabel: 'F4' },
  { key: 'F5', kind: 'build', legacyLabel: 'F5' },
  { key: 'F5', shiftKey: true, kind: 'build', legacyLabel: 'Shift+F5' },
  { key: 'F6', kind: 'storage-withdraw', legacyLabel: 'F6' },
  { key: 'F7', kind: 'processing-drying', legacyLabel: 'F7' },
  { key: 'F8', kind: 'processing-drying', legacyLabel: 'F8' },
  { key: 'F9', kind: 'shipping-normal', legacyLabel: 'F9' },
  { key: 'F10', kind: 'shipping-normal', legacyLabel: 'F10' },
  { key: 'F11', kind: 'processing-sealing', legacyLabel: 'F11' },
  { key: 'F11', shiftKey: true, kind: 'processing-furnace', legacyLabel: 'Shift+F11' },
  { key: 'F12', kind: 'build', legacyLabel: 'F12' },
  { key: 'Insert', kind: 'shipping-quality', legacyLabel: 'Insert' },
  { key: 'Delete', kind: 'shipping-quality', legacyLabel: 'Delete' }
] as const;

const LOCATION_SERVICE_SHORTCUTS: readonly LocationServiceShortcutDef[] = [
  { key: 'o', locationId: 'valley-market', command: 'browse-trade', legacyLabel: 'O' },
  { key: 'O', locationId: 'valley-market', command: 'browse-trade', legacyLabel: 'O' },
  { key: ',', locationId: 'valley-market', command: 'browse-shop', legacyLabel: ',' }
] as const;

const EXPLORATION_LOCATION_SHORTCUTS: readonly ExplorationLocationShortcutDef[] = [
  { key: ';', locationId: 'valley-outskirts', command: 'explore-valley', legacyLabel: ';' },
  { key: 'Semicolon', locationId: 'valley-outskirts', command: 'explore-valley', legacyLabel: ';' },
  { key: 'l', locationId: 'ruin-gate', command: 'explore-ruin', legacyLabel: 'L' },
  { key: 'L', shiftKey: true, locationId: 'ruin-gate', command: 'delve-ruin', legacyLabel: 'Shift+L' },
  { key: '/', locationId: 'spirit-vein', command: 'explore-spirit-vein', legacyLabel: '/' }
] as const;

const QUICK_LOCATION_SHORTCUTS: readonly QuickLocationShortcutDef[] = [
  { key: 'Q', altKey: true, quickId: 'staying-commission', legacyLabel: 'Alt+Q' },
  { key: 'q', altKey: true, quickId: 'staying-commission', legacyLabel: 'Alt+Q' },
  { key: 'W', altKey: true, quickId: 'tea-shed', legacyLabel: 'Alt+W' },
  { key: 'w', altKey: true, quickId: 'tea-shed', legacyLabel: 'Alt+W' },
  { key: 'E', altKey: true, quickId: 'greenhouse', legacyLabel: 'Alt+E' },
  { key: 'e', altKey: true, quickId: 'greenhouse', legacyLabel: 'Alt+E' }
] as const;

export function resolveFarmActionShortcut(key: string, shiftKey: boolean): FarmActionShortcutMatch | null {
  const match = FARM_ACTION_SHORTCUTS.find(shortcut => shortcut.key === key && Boolean(shortcut.shiftKey) === shiftKey);
  if (!match) return null;
  return { kind: match.kind, legacyLabel: match.legacyLabel };
}

export function resolveLocationServiceShortcut(key: string, activeEvent: boolean): LocationServiceShortcutMatch | null {
  if (key === ',') {
    return activeEvent ? { locationId: 'festival-ground', command: 'browse-festival-stall', legacyLabel: ',' } : { locationId: 'valley-market', command: 'browse-shop', legacyLabel: ',' };
  }
  const match = LOCATION_SERVICE_SHORTCUTS.find(shortcut => shortcut.key === key);
  if (!match) return null;
  return {
    locationId: match.locationId,
    command: match.command,
    legacyLabel: match.legacyLabel
  };
}

export function resolveExplorationLocationShortcut(key: string, shiftKey: boolean): ExplorationLocationShortcutMatch | null {
  const match = EXPLORATION_LOCATION_SHORTCUTS.find(shortcut => shortcut.key === key && Boolean(shortcut.shiftKey) === shiftKey);
  if (!match) return null;
  return {
    locationId: match.locationId,
    command: match.command,
    legacyLabel: match.legacyLabel
  };
}

export function resolveLegacyConfirmShortcut(key: string, ctrlKey: boolean): LegacyConfirmShortcut | null {
  if (key === '.') return 'period';
  if (key === 'Enter' && ctrlKey) return 'ctrl-enter';
  return null;
}

export function resolveQuickLocationShortcut(key: string, altKey: boolean): QuickLocationShortcut | null {
  if (!altKey) return null;
  const match = QUICK_LOCATION_SHORTCUTS.find(shortcut => shortcut.key === key);
  return match?.quickId ?? null;
}

export function resolveTabShortcut(options: { interactionPanelActive: boolean; locationSelectionActive: boolean; shiftKey: boolean }): TabShortcutAction {
  if (options.interactionPanelActive) return 'cycle-interaction-panel';
  if (options.locationSelectionActive) return options.shiftKey ? 'cycle-location-service' : 'cycle-location';
  if (options.shiftKey) return 'cycle-location';
  return 'toggle-inventory';
}

export function resolveEscapeShortcut(options: { interactionPanelActive: boolean; inventoryVisible: boolean; cultivationPanelVisible: boolean; locationSelectionActive: boolean }): EscapeShortcutAction {
  if (options.interactionPanelActive) return 'clear-interaction-panel';
  if (options.inventoryVisible) return 'toggle-inventory';
  if (options.cultivationPanelVisible) return 'close-cultivation-panel';
  if (options.locationSelectionActive) return 'clear-location-selection';
  return 'toggle-pause';
}

export function resolveQShortcut(options: { ctrlKey: boolean; shiftKey: boolean; quickLocationShortcut: QuickLocationShortcut | null }): QShortcutAction {
  if (options.quickLocationShortcut === 'staying-commission') return 'quick-staying-commission';
  if (options.ctrlKey) return 'rest';
  return options.shiftKey ? 'cycle-hotbar-backward' : 'cycle-hotbar-forward';
}

export function resolvePrimaryInteractionShortcut(options: { key: string; shiftKey: boolean; quickLocationShortcut: QuickLocationShortcut | null }): PrimaryInteractionShortcutAction | null {
  if (options.key === ' ') return 'default-confirm';
  if (options.key === 'e' || options.key === 'E') {
    if (options.quickLocationShortcut === 'greenhouse') return 'quick-greenhouse';
    if (options.key === 'E' && options.shiftKey) return 'ascend-pill';
    return 'default-confirm';
  }
  return null;
}

export function resolveEnterShortcut(options: { ctrlKey: boolean; interactionPanelActive: boolean; locationSelectionActive: boolean }): EnterShortcutAction {
  if (options.ctrlKey && options.locationSelectionActive) return 'confirm-location-service';
  if (options.interactionPanelActive) return 'confirm-interaction-panel';
  if (options.locationSelectionActive) return 'confirm-location-service';
  return 'end-day';
}

export function resolveDigitShortcut(options: { key: string; code: string; shiftKey: boolean; farmActionPanelActive: boolean; locationSelectionActive: boolean }): DigitShortcutAction | null {
  const digitKey = /^\d$/.test(options.key);
  const shiftedDigitCode = /^Digit\d$/.test(options.code);
  if (!digitKey && !shiftedDigitCode) return null;
  if (options.farmActionPanelActive) return 'farm-action-select';
  if (options.locationSelectionActive) return options.shiftKey ? 'location-select' : 'location-service-select';
  if (!digitKey) return null;
  return 'hotbar-select';
}

export function resolveFarmMenuShortcut(key: string, shiftKey: boolean): FarmMenuShortcutAction | null {
  if (key !== 'M') return null;
  return 'open-farm-menu';
}

export function resolvePageUpShortcut(key: string, shiftKey: boolean): PageUpShortcutAction | null {
  if (key !== 'PageUp') return null;
  return shiftKey ? 'claim-ruin-chapter' : 'open-commission';
}

export function resolvePageDownShortcut(options: { key: string; shiftKey: boolean; interactionPanelKind: string; interactionPanelActive: boolean }): PageDownShortcutAction | null {
  if (options.key !== 'PageDown') return null;
  if (options.shiftKey) return 'claim-mainline-quest';
  if (options.interactionPanelKind === 'commission') return 'confirm-commission-panel';
  if (options.interactionPanelActive) return 'noop';
  return 'open-commission';
}

export function resolveCommandShortcut(key: string, shiftKey: boolean): CommandShortcutAction | null {
  if (key === 'p' || key === 'P') return 'toggle-pause';
  if (key === '.') return 'legacy-confirm';
  if (key === '=') return 'open-upgrade-panel';
  if (key === '-') return 'open-npc-browse';
  if (key === '\\') return 'open-npc-gift';
  if (key === '|') return 'open-npc-quest';
  if (key === 'End') return 'open-festival-panel';
  if (key === '?') return 'show-calendar-summary';
  return null;
}

export function resolveWorldActionShortcut(key: string, shiftKey: boolean): WorldActionShortcutAction | null {
  if (key === 'z' || key === 'Z') return 'seed-from-hotbar';
  if (key === 'x' || key === 'X') return 'water-front-tile';
  if (key === 'Home') return 'fertilize-front-tile';
  if (key === 'c' || key === 'C') return 'toggle-cultivation-panel';
  if (key === 'v' || key === 'V') return 'harvest-front-tile';
  if (key === 't') return 'tribulation';
  if (key === 'g') return shiftKey ? 'feed-guard-beast' : 'hunt-beast';
  if (key === '!') return 'train-push-up';
  if (key === '@') return 'train-sit-up';
  if (key === '#') return 'train-squat';
  if (key === ')') return 'train-long-run';
  if (key === 'b' || key === 'B') return 'toggle-inventory';
  if (key === 'n') return 'brew-bone-pill';
  if (key === 'm') return 'brew-detox-pill';
  if (key === 'h') return 'eat-ward-pill';
  if (key === 'j') return 'eat-bone-pill';
  if (key === 'k') return 'eat-detox-pill';
  if (key === 'r') return 'place-lightning-rod-array';
  if (key === 'f') return 'place-insulation-array';
  if (key === 'i') return 'toggle-inventory';
  if (key === 'u') return 'toggle-furnace';
  if (key === 'y') return 'cycle-recipe';
  if (key === '[') return 'decrease-furnace-heat';
  if (key === ']') return 'increase-furnace-heat';
  return null;
}

export function resolveLegacyBuildShortcut(key: string, shiftKey: boolean): LegacyBuildShortcutAction | null {
  if (key !== 'F5') return null;
  return shiftKey ? 'open-furnace-build-menu' : 'preselect-build';
}
