import type { ContentRegistry, ItemCategory, RecipeDef } from '@content/defs';
import type { CropQuality } from '@sim/farm/quality';
import { itemCount } from '@sim/world/player';
import {
  createDefaultInventoryViewState,
  inventorySlotsForContainer,
  resolveInventoryOrder,
  type GameState,
  type InventoryContainerId,
  type InventoryPanelId,
  type InventorySlotSnapshot,
  type InventorySortKey,
  type InventoryViewState
} from '@sim/world/state';
import { itemIconAssetId } from './itemIcons';

const CONTAINERS: readonly InventoryContainerId[] = ['player', 'storage', 'shipping'];
type InventoryPanelTab = InventoryPanelId;
const INVENTORY_TABS: readonly InventoryPanelTab[] = ['player', 'storage', 'shipping', 'furnace'];
export type InventoryViewMode = 'full' | 'furnace-focus';
const PAGE_SIZE = 12;
const DRAG_MIME = 'application/x-aeonvale-inventory-slot';
const CRAFT_FURNACE_INDEX = 4;
const CRAFT_INPUT_SLOT_INDEXES = [0, 1, 2, 3, 5, 6, 7, 8] as const;
const CRAFT_SLOT_ROLES: Readonly<Record<number, string>> = {
  0: '君',
  1: '臣',
  2: '佐',
  3: '引',
  4: '炉心',
  5: '辅',
  6: '使',
  7: '余',
  8: '封'
};

const CONTAINER_LABEL: Record<InventoryContainerId, string> = {
  player: '随身行囊',
  storage: '农庄仓库',
  shipping: '出货箱'
};

const CONTAINER_SHORT_LABEL: Record<InventoryContainerId, string> = {
  player: '行囊',
  storage: '仓库',
  shipping: '出货'
};

const INVENTORY_TAB_LABEL: Record<InventoryPanelTab, string> = {
  player: CONTAINER_SHORT_LABEL.player,
  storage: CONTAINER_SHORT_LABEL.storage,
  shipping: CONTAINER_SHORT_LABEL.shipping,
  furnace: '丹炉'
};

const QUALITY_LABEL: Record<CropQuality, string> = {
  mortal: '凡品',
  spirit: '灵品',
  treasure: '珍品'
};

const CATEGORY_LABEL: Record<ItemCategory, string> = {
  tool: '工具',
  material: '材料',
  seed: '种子',
  pill: '丹药',
  equipment: '装备',
  knowledge: '知识',
  consumable: '消耗品',
  currency: '货币',
  'array-part': '阵件'
};

type SortKey = InventorySortKey;

interface SlotRef {
  container: InventoryContainerId;
  key: string;
}

interface QuantityDialogState {
  ref: SlotRef;
  count: number;
}

interface CraftWorkbenchSlot {
  itemId: string;
  key: string;
  quality?: CropQuality;
  virtual?: boolean;
}

interface RenderedSlot {
  container: InventoryContainerId;
  key: string;
  slot: InventorySlotSnapshot;
}

interface InventoryUIState {
  activeTab: InventoryPanelTab;
  craftNotice: string | null;
  craftSlots: Partial<Record<number, CraftWorkbenchSlot>>;
  furnaceHeatPercent: number;
  pageByContainer: Partial<Record<InventoryContainerId, number>>;
  quantityDialog: QuantityDialogState | null;
  searchTerm: string;
  selected: SlotRef | null;
  selectedRecipeId: string | null;
  sortKey: SortKey;
}

export type InventoryAction =
  | { type: 'use'; itemId: string }
  | { type: 'drop'; itemId: string; count: number; quality?: CropQuality }
  | { type: 'move'; from: InventoryContainerId; to: InventoryContainerId; itemId: string; count: number; quality?: CropQuality }
  | { type: 'reorder'; container: InventoryContainerId; order: string[] }
  | { type: 'view-prefs'; view: InventoryViewState }
  | { type: 'brew'; recipeId: string; heatPercent: number }
  | { type: 'select-seed'; itemId: string }
  | { type: 'select-tool'; itemId: string };

export interface InventoryActionFeedback {
  ok: boolean;
  message: string;
  clearCraftSlots?: boolean;
}

export interface InventoryUIOptions {
  root: HTMLElement;
  getState: () => GameState;
  getRegistry: () => ContentRegistry;
  craftRecipeIds?: readonly string[];
  tutorialRecipeId?: string;
  preferredRecipeId?: () => string | null | undefined;
  viewMode?: () => InventoryViewMode;
  hasTutorialAlchemyKit?: () => boolean;
  hasBrewedTutorialAlchemy?: () => boolean;
  onAction: (action: InventoryAction) => InventoryActionFeedback | void;
}

export interface InventoryUIController {
  render: () => void;
  showFurnace: (recipeId?: string) => void;
  showInventory: () => void;
  destroy: () => void;
}

export interface RecipeWorkbenchProjectionCell {
  index: number;
  role: string;
  requiredItemId: string | null;
  furnace: boolean;
}

export function inventoryIconAssetId(itemId: string, content?: ContentRegistry): string | undefined {
  const iconId = itemIconAssetId(itemId, content);
  return iconId?.startsWith('icon.') ? `inventory-${iconId}-v1` : undefined;
}

export function inventoryIconUrl(itemId: string, content?: ContentRegistry): string {
  const assetId = inventoryIconAssetId(itemId, content);
  return `./inventory-icons/${assetId ?? `inventory-icon.${itemId}-v1`}.png`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function sameRef(a: SlotRef | null | undefined, b: SlotRef | null | undefined): boolean {
  return Boolean(a && b && a.container === b.container && a.key === b.key);
}

function button(className: string, label: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.textContent = label;
  return node;
}

function itemName(content: ContentRegistry, itemId: string): string {
  return content.items.get(itemId)?.displayName ?? itemId;
}

function itemCategory(content: ContentRegistry, itemId: string): ItemCategory | undefined {
  return content.items.get(itemId)?.category;
}

function categoryLabel(content: ContentRegistry, itemId: string): string {
  const category = itemCategory(content, itemId);
  return category ? CATEGORY_LABEL[category] : '物品';
}

function slotAccessibleName(content: ContentRegistry, rendered: RenderedSlot): string {
  const quality = rendered.slot.quality ? `${QUALITY_LABEL[rendered.slot.quality]} ` : '';
  return `${CONTAINER_LABEL[rendered.container]}：${quality}${itemName(content, rendered.slot.itemId)} ×${rendered.slot.count}`;
}

function slotSearchText(content: ContentRegistry, slot: InventorySlotSnapshot): string {
  return [slot.itemId, itemName(content, slot.itemId), categoryLabel(content, slot.itemId), slot.quality ? QUALITY_LABEL[slot.quality] : ''].join(' ').toLowerCase();
}

function slotMatchesSearch(content: ContentRegistry, slot: InventorySlotSnapshot, searchTerm: string): boolean {
  const query = searchTerm.trim().toLowerCase();
  if (!query) return true;
  return slotSearchText(content, slot).includes(query);
}

function compareSlots(content: ContentRegistry, sortKey: SortKey): (a: InventorySlotSnapshot, b: InventorySlotSnapshot) => number {
  return (a, b) => {
    if (sortKey === 'count') {
      const byCount = b.count - a.count;
      if (byCount !== 0) return byCount;
    }
    if (sortKey === 'category') {
      const byCategory = categoryLabel(content, a.itemId).localeCompare(categoryLabel(content, b.itemId), 'zh-CN');
      if (byCategory !== 0) return byCategory;
    }
    if (sortKey === 'name' || sortKey === 'category' || sortKey === 'count') {
      const byName = itemName(content, a.itemId).localeCompare(itemName(content, b.itemId), 'zh-CN');
      if (byName !== 0) return byName;
    }
    return a.key.localeCompare(b.key, 'zh-CN');
  };
}

function containerCapacityLabel(state: GameState, container: InventoryContainerId, used: number): string {
  if (container === 'player') return `${used}/${state.player.inventoryCapacity} 格`;
  if (container === 'storage') return `${used}/${state.storage.capacity} 格`;
  return `${used} 格`;
}

function containerCapacityRatio(state: GameState, container: InventoryContainerId, used: number): number | null {
  if (container === 'player') return state.player.inventoryCapacity <= 0 ? 1 : used / state.player.inventoryCapacity;
  if (container === 'storage') return state.storage.capacity <= 0 ? 1 : used / state.storage.capacity;
  return null;
}

function parseDragRef(dataTransfer: DataTransfer | null): SlotRef | null {
  if (!dataTransfer) return null;
  const raw = dataTransfer.getData(DRAG_MIME) || dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SlotRef>;
    if (CONTAINERS.includes(parsed.container as InventoryContainerId) && typeof parsed.key === 'string') {
      return { container: parsed.container as InventoryContainerId, key: parsed.key };
    }
  } catch {
    const [container, key] = raw.split('|');
    if (CONTAINERS.includes(container as InventoryContainerId) && key) return { container: container as InventoryContainerId, key };
  }
  return null;
}

function writeDragRef(dataTransfer: DataTransfer | null, ref: SlotRef): void {
  if (!dataTransfer) return;
  const raw = JSON.stringify(ref);
  dataTransfer.setData(DRAG_MIME, raw);
  dataTransfer.setData('text/plain', `${ref.container}|${ref.key}`);
  dataTransfer.effectAllowed = 'move';
}

function moveKeyBefore(order: readonly string[], sourceKey: string, targetKey: string | null): string[] {
  const next = order.filter(key => key !== sourceKey);
  if (!targetKey) return [...next, sourceKey];
  const targetIndex = next.indexOf(targetKey);
  if (targetIndex < 0) return [...next, sourceKey];
  next.splice(targetIndex, 0, sourceKey);
  return next;
}

function orderedSlotsForContainer(state: GameState, container: InventoryContainerId, content: ContentRegistry, sortKey: SortKey): InventorySlotSnapshot[] {
  const slots = inventorySlotsForContainer(state, container);
  const byKey = new Map(slots.map(slot => [slot.key, slot] as const));
  if (sortKey !== 'layout') return [...slots].sort(compareSlots(content, sortKey));

  const order = resolveInventoryOrder(state.inventoryLayout.orders[container], slots.map(slot => slot.key));
  return order.map(key => byKey.get(key)).filter((slot): slot is InventorySlotSnapshot => Boolean(slot));
}

function normalizedLayoutKeys(state: GameState, container: InventoryContainerId): string[] {
  const slots = inventorySlotsForContainer(state, container);
  return resolveInventoryOrder(state.inventoryLayout.orders[container], slots.map(slot => slot.key));
}

function findSlot(state: GameState, ref: SlotRef): InventorySlotSnapshot | null {
  return inventorySlotsForContainer(state, ref.container).find(slot => slot.key === ref.key) ?? null;
}

function renderIcon(content: ContentRegistry, itemId: string, className = 'inv-icon'): HTMLElement {
  const img = document.createElement('img');
  img.className = className;
  img.alt = '';
  img.draggable = false;
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = inventoryIconUrl(itemId, content);
  img.addEventListener(
    'error',
    () => {
      img.hidden = true;
      const parent = img.parentElement;
      if (parent) parent.classList.add('no-icon');
    },
    { once: true }
  );
  return img;
}

function renderFallbackGlyph(label: string): HTMLElement {
  const node = document.createElement('span');
  node.className = 'inv-glyph';
  node.textContent = label.slice(0, 1) || '?';
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function renderSlotBadges(slotButton: HTMLButtonElement, slot: InventorySlotSnapshot): void {
  if (slot.quality) {
    const quality = document.createElement('span');
    quality.className = 'inv-quality';
    quality.textContent = QUALITY_LABEL[slot.quality];
    slotButton.append(quality);
  }
  if (slot.count > 1) {
    const count = document.createElement('span');
    count.className = 'inv-count';
    count.textContent = String(slot.count);
    slotButton.append(count);
  }
}

function normalizedInventoryView(raw: InventoryViewState | undefined): InventoryViewState {
  const defaults = createDefaultInventoryViewState();
  const activeTab = raw?.activeTab && INVENTORY_TABS.includes(raw.activeTab) ? raw.activeTab : defaults.activeTab;
  const sortKey = raw?.sortKey && (['layout', 'category', 'name', 'count'] as const).includes(raw.sortKey) ? raw.sortKey : defaults.sortKey;
  const pageByContainer: InventoryViewState['pageByContainer'] = {};
  for (const container of CONTAINERS) {
    const page = raw?.pageByContainer?.[container];
    if (typeof page === 'number' && Number.isFinite(page) && page > 0) pageByContainer[container] = Math.floor(page);
  }
  return {
    activeTab,
    pageByContainer,
    searchTerm: typeof raw?.searchTerm === 'string' ? raw.searchTerm.slice(0, 80) : defaults.searchTerm,
    sortKey
  };
}

function sameInventoryView(a: InventoryViewState, b: InventoryViewState): boolean {
  return (
    a.activeTab === b.activeTab &&
    a.searchTerm === b.searchTerm &&
    a.sortKey === b.sortKey &&
    CONTAINERS.every(container => (a.pageByContainer[container] ?? 0) === (b.pageByContainer[container] ?? 0))
  );
}

function expandedRecipeInputIds(recipe: Pick<RecipeDef, 'inputs'>): string[] {
  return recipe.inputs.flatMap(input => Array.from({ length: Math.max(0, input.qty) }, () => input.herbId));
}

export function recipeWorkbenchProjection(recipe: Pick<RecipeDef, 'inputs'>): RecipeWorkbenchProjectionCell[] {
  const inputIds = expandedRecipeInputIds(recipe);
  const requiredByIndex = new Map<number, string>();
  for (const [offset, itemId] of inputIds.entries()) {
    const index = CRAFT_INPUT_SLOT_INDEXES[offset];
    if (index == null) break;
    requiredByIndex.set(index, itemId);
  }

  return Array.from({ length: 9 }, (_, index) => ({
    index,
    role: CRAFT_SLOT_ROLES[index] ?? '',
    requiredItemId: requiredByIndex.get(index) ?? null,
    furnace: index === CRAFT_FURNACE_INDEX
  }));
}

export function createInventoryUI(options: InventoryUIOptions): InventoryUIController {
  const initialView = normalizedInventoryView(options.getState().inventoryLayout.view);
  const ui: InventoryUIState = {
    activeTab: initialView.activeTab,
    craftNotice: null,
    craftSlots: {},
    furnaceHeatPercent: 47,
    pageByContainer: { ...initialView.pageByContainer },
    quantityDialog: null,
    searchTerm: initialView.searchTerm,
    selected: null,
    selectedRecipeId: null,
    sortKey: initialView.sortKey
  };

  function state(): GameState {
    return options.getState();
  }

  function content(): ContentRegistry {
    return options.getRegistry();
  }

  function selectedSlot(): InventorySlotSnapshot | null {
    if (!ui.selected) return null;
    const slot = findSlot(state(), ui.selected);
    if (!slot) ui.selected = null;
    return slot;
  }

  function currentViewPrefs(): InventoryViewState {
    return normalizedInventoryView({
      activeTab: ui.activeTab,
      pageByContainer: { ...ui.pageByContainer },
      searchTerm: ui.searchTerm,
      sortKey: ui.sortKey
    });
  }

  function persistViewPrefs(): void {
    const next = currentViewPrefs();
    if (sameInventoryView(next, normalizedInventoryView(state().inventoryLayout.view))) return;
    options.onAction({ type: 'view-prefs', view: next });
  }

  function selectRef(ref: SlotRef | null): void {
    ui.selected = ref;
    if (ref) ui.activeTab = ref.container;
    ui.quantityDialog = null;
    render();
  }

  function dispatchAndRender(action: InventoryAction): InventoryActionFeedback | void {
    const feedback = options.onAction(action);
    if (action.type === 'brew' && feedback?.message) {
      ui.craftNotice = feedback.message;
      if (feedback.clearCraftSlots ?? feedback.ok) ui.craftSlots = {};
    }
    render();
    return feedback;
  }

  function allCraftRecipes(): RecipeDef[] {
    const reg = content();
    return (options.craftRecipeIds ?? []).map(id => reg.recipes.get(id)).filter((recipe): recipe is RecipeDef => Boolean(recipe));
  }

  function recipesMatchingSearch(recipes: readonly RecipeDef[]): RecipeDef[] {
    const reg = content();
    const query = ui.searchTerm.trim().toLowerCase();
    if (!query) return [...recipes];
    return recipes.filter(recipe => [recipe.id, recipe.displayName, itemName(reg, recipe.outputPillId), ...recipe.inputs.map(input => itemName(reg, input.herbId))].join(' ').toLowerCase().includes(query));
  }

  function selectedRecipe(): RecipeDef | null {
    const recipes = allCraftRecipes();
    if (recipes.length === 0) return null;
    const preferredRecipeId = options.preferredRecipeId?.() ?? null;
    const preferred = preferredRecipeId ? (recipes.find(recipe => recipe.id === preferredRecipeId) ?? null) : null;
    if (preferred && ui.selectedRecipeId !== preferred.id) {
      ui.selectedRecipeId = preferred.id;
      ui.craftSlots = {};
      ui.craftNotice = null;
      return preferred;
    }
    const selected = recipes.find(recipe => recipe.id === ui.selectedRecipeId) ?? recipes[0]!;
    if (ui.selectedRecipeId !== selected.id) {
      ui.selectedRecipeId = selected.id;
      ui.craftSlots = {};
    }
    return selected;
  }

  function requiredItemForCraftIndex(recipe: RecipeDef, index: number): string | null {
    return recipeWorkbenchProjection(recipe).find(cell => cell.index === index)?.requiredItemId ?? null;
  }

  function placedCraftCount(itemId: string, excludeIndex?: number): number {
    return Object.entries(ui.craftSlots).filter(([index, slot]) => Number(index) !== excludeIndex && slot?.itemId === itemId).length;
  }

  function firstEmptyCraftIndexFor(recipe: RecipeDef, itemId: string): number | null {
    for (const cell of recipeWorkbenchProjection(recipe)) {
      if (cell.furnace || cell.requiredItemId !== itemId || ui.craftSlots[cell.index]) continue;
      return cell.index;
    }
    return null;
  }

  function recipeNeedsItem(recipe: RecipeDef, itemId: string): boolean {
    return recipe.inputs.some(input => input.herbId === itemId);
  }

  function tutorialKitAvailableFor(recipe: RecipeDef): boolean {
    return recipe.id === options.tutorialRecipeId && options.hasTutorialAlchemyKit?.() === true && options.hasBrewedTutorialAlchemy?.() !== true;
  }

  function availableCraftItemCount(recipe: RecipeDef, itemId: string): number {
    const base = itemCount(state().player, itemId);
    if (!tutorialKitAvailableFor(recipe)) return base;
    const kitCount = recipe.inputs.find(input => input.herbId === itemId)?.qty ?? 0;
    return base + kitCount;
  }

  function canPlaceCraftItem(recipe: RecipeDef, index: number, itemId: string): boolean {
    return placedCraftCount(itemId, index) < availableCraftItemCount(recipe, itemId);
  }

  function heatBandForRecipe(recipe: RecipeDef): 'low' | 'ideal' | 'high' {
    const [lo, hi] = recipe.idealHeatRange.map(value => Math.round(value / 1000)) as [number, number];
    if (ui.furnaceHeatPercent < lo) return 'low';
    if (ui.furnaceHeatPercent > hi) return 'high';
    return 'ideal';
  }

  function furnaceHeatPreview(recipe: RecipeDef): string {
    const [lo, hi] = recipe.idealHeatRange.map(value => Math.round(value / 1000)) as [number, number];
    const band = heatBandForRecipe(recipe);
    if (band === 'ideal') return `炉火 ${ui.furnaceHeatPercent}%｜契合丹方 ${lo}-${hi}%`;
    if (band === 'low') return `炉火 ${ui.furnaceHeatPercent}%｜偏缓，药性易散`;
    return `炉火 ${ui.furnaceHeatPercent}%｜偏急，炉崩风险上升`;
  }

  function craftMaterialLine(recipe: RecipeDef): string {
    return recipe.inputs
      .map(input => `${itemName(content(), input.herbId)} ${availableCraftItemCount(recipe, input.herbId)}/${input.qty}`)
      .join(' · ');
  }

  function recipeAvailableForFurnace(recipe: RecipeDef): boolean {
    return recipe.inputs.every(input => availableCraftItemCount(recipe, input.herbId) >= input.qty);
  }

  function clearInvalidCraftSlots(recipe: RecipeDef): void {
    for (const [indexRaw, slot] of Object.entries(ui.craftSlots)) {
      const index = Number(indexRaw);
      if (!slot || requiredItemForCraftIndex(recipe, index) !== slot.itemId || !canPlaceCraftItem(recipe, index, slot.itemId)) {
        delete ui.craftSlots[index];
      }
    }
  }

  function placeSlotInCraft(ref: SlotRef, slot: InventorySlotSnapshot, targetIndex?: number): void {
    ui.activeTab = 'furnace';
    if (ref.container !== 'player') {
      ui.craftNotice = '炼制材料需先放入随身行囊。';
      render();
      return;
    }

    const recipes = allCraftRecipes();
    let recipe = selectedRecipe();
    if (!recipe || !recipeNeedsItem(recipe, slot.itemId) || (targetIndex == null && firstEmptyCraftIndexFor(recipe, slot.itemId) == null)) {
      recipe = recipes.find(candidate => recipeNeedsItem(candidate, slot.itemId) && firstEmptyCraftIndexFor(candidate, slot.itemId) != null) ?? null;
      if (recipe) {
        ui.selectedRecipeId = recipe.id;
        ui.craftSlots = {};
      }
    }
    if (!recipe) {
      ui.craftNotice = `${itemName(content(), slot.itemId)}暂未对应当前丹方。`;
      render();
      return;
    }

    const index = targetIndex ?? firstEmptyCraftIndexFor(recipe, slot.itemId);
    if (index == null || requiredItemForCraftIndex(recipe, index) !== slot.itemId) {
      ui.craftNotice = `${itemName(content(), slot.itemId)}不合此格药性。`;
      render();
      return;
    }
    if (!canPlaceCraftItem(recipe, index, slot.itemId)) {
      ui.craftNotice = `${itemName(content(), slot.itemId)}数量不足。`;
      render();
      return;
    }

    ui.craftSlots[index] = { itemId: slot.itemId, key: slot.key, quality: slot.quality };
    ui.craftNotice = `${itemName(content(), slot.itemId)}已入${CRAFT_SLOT_ROLES[index] ?? '药位'}。`;
    render();
  }

  function autoFillCraft(recipe: RecipeDef): void {
    ui.activeTab = 'furnace';
    ui.craftSlots = {};
    const sourceSlots = inventorySlotsForContainer(state(), 'player');
    const used = new Map<string, number>();
    for (const cell of recipeWorkbenchProjection(recipe)) {
      if (!cell.requiredItemId || cell.furnace) continue;
      const owned = availableCraftItemCount(recipe, cell.requiredItemId);
      const nextUsed = used.get(cell.requiredItemId) ?? 0;
      if (nextUsed >= owned) continue;
      const source = sourceSlots.find(candidate => candidate.itemId === cell.requiredItemId);
      if (source && nextUsed < itemCount(state().player, cell.requiredItemId)) {
        ui.craftSlots[cell.index] = { itemId: source.itemId, key: source.key, quality: source.quality };
      } else if (tutorialKitAvailableFor(recipe)) {
        ui.craftSlots[cell.index] = { itemId: cell.requiredItemId, key: `tutorial-kit:${cell.index}:${cell.requiredItemId}`, virtual: true };
      } else {
        continue;
      }
      used.set(cell.requiredItemId, nextUsed + 1);
    }
    ui.craftNotice = craftComplete(recipe) ? '材料齐备，可开炉。' : '材料不足，药盘仍有空缺。';
    render();
  }

  function craftProgress(recipe: RecipeDef): { filled: number; required: number } {
    const cells = recipeWorkbenchProjection(recipe).filter(cell => !cell.furnace && cell.requiredItemId);
    return {
      filled: cells.filter(cell => ui.craftSlots[cell.index]?.itemId === cell.requiredItemId).length,
      required: cells.length
    };
  }

  function craftComplete(recipe: RecipeDef): boolean {
    const progress = craftProgress(recipe);
    return progress.required > 0 && progress.filled >= progress.required;
  }

  function recipeAvailabilityLabel(recipe: RecipeDef): string {
    const missing = recipe.inputs
      .map(input => ({ ...input, owned: availableCraftItemCount(recipe, input.herbId) }))
      .filter(input => input.owned < input.qty);
    if (missing.length === 0) return '可补齐';
    const first = missing[0]!;
    return `缺${itemName(content(), first.herbId)} ×${first.qty - first.owned}`;
  }

  function handleCraftDrop(index: number, source: SlotRef): void {
    const sourceSlot = findSlot(state(), source);
    if (!sourceSlot) return;
    placeSlotInCraft(source, sourceSlot, index);
  }

  function attachCraftDropTarget(element: HTMLElement, index: number): void {
    element.addEventListener('dragover', event => {
      const recipe = selectedRecipe();
      const source = parseDragRef(event.dataTransfer);
      const sourceSlot = source ? findSlot(state(), source) : null;
      const requiredItem = recipe ? requiredItemForCraftIndex(recipe, index) : null;
      if (!recipe || !source || !sourceSlot || source.container !== 'player' || !requiredItem || sourceSlot.itemId !== requiredItem || !canPlaceCraftItem(recipe, index, sourceSlot.itemId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave', () => {
      element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop', event => {
      const source = parseDragRef(event.dataTransfer);
      element.classList.remove('is-drop-target');
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      handleCraftDrop(index, source);
    });
  }

  function handleDrop(source: SlotRef, target: SlotRef | { container: InventoryContainerId; key: null }): void {
    const currentState = state();
    const sourceSlot = findSlot(currentState, source);
    if (!sourceSlot) return;

    if (source.container === target.container) {
      if (ui.sortKey !== 'layout') return;
      if (source.key === target.key) return;
      const order = normalizedLayoutKeys(currentState, source.container);
      const next = moveKeyBefore(order, source.key, target.key);
      ui.selected = { container: source.container, key: source.key };
      options.onAction({ type: 'reorder', container: source.container, order: next });
      render();
      return;
    }

    const feedback = options.onAction({
      type: 'move',
      from: source.container,
      to: target.container,
      itemId: sourceSlot.itemId,
      quality: sourceSlot.quality,
      count: sourceSlot.count
    });
    if (feedback?.ok === false) {
      ui.selected = { container: source.container, key: source.key };
      ui.activeTab = source.container;
      render();
      return;
    }

    ui.selected = { container: target.container, key: source.key };
    ui.activeTab = target.container;
    render();
  }

  function attachDropTarget(element: HTMLElement, target: SlotRef | { container: InventoryContainerId; key: null }): void {
    element.addEventListener('dragover', event => {
      const source = parseDragRef(event.dataTransfer);
      if (!source) return;
      if (source.container === target.container && ui.sortKey !== 'layout') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave', () => {
      element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop', event => {
      const source = parseDragRef(event.dataTransfer);
      element.classList.remove('is-drop-target');
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      handleDrop(source, target);
    });
  }

  function attachContainerTabDropTarget(element: HTMLElement, container: InventoryContainerId): void {
    element.addEventListener('dragover', event => {
      const source = parseDragRef(event.dataTransfer);
      if (!source || source.container === container) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave', () => {
      element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop', event => {
      const source = parseDragRef(event.dataTransfer);
      element.classList.remove('is-drop-target');
      if (!source || source.container === container) return;
      event.preventDefault();
      event.stopPropagation();
      handleDrop(source, { container, key: null });
    });
  }

  function attachCraftTabDropTarget(element: HTMLElement): void {
    element.addEventListener('dragover', event => {
      const source = parseDragRef(event.dataTransfer);
      const sourceSlot = source ? findSlot(state(), source) : null;
      if (!source || !sourceSlot || source.container !== 'player') return;
      const recipe = selectedRecipe();
      if (!recipe || !recipeNeedsItem(recipe, sourceSlot.itemId)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      element.classList.add('is-drop-target');
    });
    element.addEventListener('dragleave', () => {
      element.classList.remove('is-drop-target');
    });
    element.addEventListener('drop', event => {
      const source = parseDragRef(event.dataTransfer);
      const sourceSlot = source ? findSlot(state(), source) : null;
      element.classList.remove('is-drop-target');
      if (!source || !sourceSlot) return;
      event.preventDefault();
      event.stopPropagation();
      placeSlotInCraft(source, sourceSlot);
    });
  }

  function renderToolbar(): HTMLElement {
    const currentState = state();
    const viewMode = options.viewMode?.() ?? 'full';
    const bar = document.createElement('div');
    bar.className = 'inv-toolbar';
    bar.dataset.inventoryMode = viewMode;

    const tabs = document.createElement('div');
    tabs.className = 'inv-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', '物品管理选项');
    const visibleTabs: readonly InventoryPanelTab[] = viewMode === 'furnace-focus' ? ['furnace'] : INVENTORY_TABS;
    for (const panel of visibleTabs) {
      const used = panel === 'furnace' ? allCraftRecipes().length : inventorySlotsForContainer(currentState, panel).length;
      const tab = button(`inv-tab${ui.activeTab === panel ? ' is-active' : ''}`, INVENTORY_TAB_LABEL[panel]);
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(ui.activeTab === panel));
      tab.dataset.inventoryTab = panel;
      const count = document.createElement('span');
      count.className = 'inv-tab-count';
      count.textContent = String(used);
      tab.append(count);
      tab.addEventListener('click', () => {
        ui.activeTab = panel;
        if (panel === 'furnace') {
          ui.quantityDialog = null;
        } else if (ui.selected?.container !== panel) {
          ui.selected = null;
          ui.quantityDialog = null;
        } else {
          ui.quantityDialog = null;
        }
        render();
      });
      if (panel === 'furnace') attachCraftTabDropTarget(tab);
      else attachContainerTabDropTarget(tab, panel);
      tabs.append(tab);
    }
    bar.append(tabs);

    if (viewMode === 'furnace-focus') return bar;

    const sort = document.createElement('select');
    sort.className = 'inv-sort';
    sort.setAttribute('aria-label', '行囊排序');
    const sortLabels: Record<SortKey, string> = {
      layout: '格子顺序',
      category: '按类别',
      name: '按名称',
      count: '按数量'
    };
    for (const key of Object.keys(sortLabels) as SortKey[]) {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = sortLabels[key];
      option.selected = ui.sortKey === key;
      sort.append(option);
    }
    sort.addEventListener('change', () => {
      ui.sortKey = sort.value as SortKey;
      render();
    });
    bar.append(sort);

    const search = document.createElement('input');
    search.className = 'inv-search';
    search.type = 'search';
    search.placeholder = '搜索物品或丹方';
    search.value = ui.searchTerm;
    search.setAttribute('aria-label', '搜索物品或丹方');
    search.addEventListener('input', () => {
      ui.searchTerm = search.value;
      for (const container of CONTAINERS) ui.pageByContainer[container] = 0;
      render();
    });
    bar.append(search);

    return bar;
  }

  function renderSlot(rendered: RenderedSlot): HTMLButtonElement {
    const reg = content();
    const slot = rendered.slot;
    const node = button(`inv-slot${sameRef(ui.selected, rendered) ? ' is-selected' : ''}${slot.quality ? ` q-${slot.quality}` : ''}`, '');
    node.draggable = true;
    node.dataset.inventorySlotKey = rendered.key;
    node.dataset.inventorySlotContainer = rendered.container;
    node.setAttribute('role', 'gridcell');
    node.setAttribute('aria-label', slotAccessibleName(reg, rendered));
    node.title = slotAccessibleName(reg, rendered);
    node.append(renderIcon(reg, slot.itemId), renderFallbackGlyph(itemName(reg, slot.itemId)));
    renderSlotBadges(node, slot);
    node.addEventListener('click', () => selectRef({ container: rendered.container, key: rendered.key }));
    node.addEventListener('dragstart', event => {
      writeDragRef(event.dataTransfer, { container: rendered.container, key: rendered.key });
      node.classList.add('is-dragging');
    });
    node.addEventListener('dragend', () => {
      node.classList.remove('is-dragging');
    });
    attachDropTarget(node, { container: rendered.container, key: rendered.key });
    return node;
  }

  function renderEmptySlot(container: InventoryContainerId, index: number): HTMLButtonElement {
    const node = button('inv-slot inv-slot-empty', '');
    node.dataset.inventoryEmptySlot = String(index);
    node.dataset.inventorySlotContainer = container;
    node.setAttribute('role', 'gridcell');
    node.setAttribute('aria-label', `${CONTAINER_LABEL[container]}空格`);
    node.title = `${CONTAINER_LABEL[container]}空格`;
    node.addEventListener('click', () => selectRef(null));
    attachDropTarget(node, { container, key: null });
    return node;
  }

  function renderContainer(container: InventoryContainerId): HTMLElement {
    const currentState = state();
    const reg = content();
    const allSlots = orderedSlotsForContainer(currentState, container, reg, ui.sortKey);
    const visibleSlots = allSlots.filter(slot => slotMatchesSearch(reg, slot, ui.searchTerm));
    const pageCount = Math.max(1, Math.ceil(visibleSlots.length / PAGE_SIZE));
    const page = clampInt(ui.pageByContainer[container] ?? 0, 0, pageCount - 1);
    ui.pageByContainer[container] = page;
    const pageSlots = visibleSlots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    const section = document.createElement('section');
    section.className = `inv-section inv-section-${container}${ui.activeTab === container ? ' is-active' : ''}`;
    section.dataset.inventorySection = container;

    const header = document.createElement('header');
    header.className = 'inv-section-header';

    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'inv-section-title';
    title.textContent = CONTAINER_LABEL[container];
    const meta = document.createElement('p');
    meta.className = 'inv-section-meta';
    meta.textContent = containerCapacityLabel(currentState, container, allSlots.length);
    titleWrap.append(title, meta);
    header.append(titleWrap);

    const pageNav = document.createElement('div');
    pageNav.className = 'inv-page';
    const prev = button('inv-page-btn', '‹');
    prev.dataset.inventoryPagePrev = container;
    prev.disabled = page <= 0;
    prev.setAttribute('aria-label', `${CONTAINER_LABEL[container]}上一页`);
    prev.addEventListener('click', () => {
      ui.pageByContainer[container] = Math.max(0, page - 1);
      render();
    });
    const pageText = document.createElement('span');
    pageText.className = 'inv-page-text';
    pageText.textContent = `${page + 1}/${pageCount}`;
    const next = button('inv-page-btn', '›');
    next.dataset.inventoryPageNext = container;
    next.disabled = page >= pageCount - 1;
    next.setAttribute('aria-label', `${CONTAINER_LABEL[container]}下一页`);
    next.addEventListener('click', () => {
      ui.pageByContainer[container] = Math.min(pageCount - 1, page + 1);
      render();
    });
    pageNav.append(prev, pageText, next);
    header.append(pageNav);
    section.append(header);

    const grid = document.createElement('div');
    grid.className = 'inv-grid';
    grid.setAttribute('role', 'grid');
    grid.dataset.inventoryContainer = container;
    grid.setAttribute('aria-label', CONTAINER_LABEL[container]);
    attachDropTarget(grid, { container, key: null });
    if (pageSlots.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'inv-container-empty';
      empty.textContent = ui.searchTerm.trim() ? '没有匹配物品' : '暂无物品';
      grid.append(empty);
    } else {
      for (const slot of pageSlots) grid.append(renderSlot({ container, key: slot.key, slot }));
    }
    if (!ui.searchTerm.trim()) {
      const emptyCount = Math.max(0, PAGE_SIZE - pageSlots.length);
      for (let i = 0; i < emptyCount; i += 1) grid.append(renderEmptySlot(container, page * PAGE_SIZE + pageSlots.length + i));
    }
    section.append(grid);

    const ratio = containerCapacityRatio(currentState, container, allSlots.length);
    if (ratio != null) {
      const foot = document.createElement('footer');
      foot.className = 'inv-foot';
      const cap = document.createElement('div');
      cap.className = 'inv-cap';
      cap.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span');
      fill.className = `inv-cap-fill${ratio >= 1 ? ' is-full' : ''}`;
      fill.style.width = `${Math.round(clampInt(ratio * 100, 0, 100))}%`;
      cap.append(fill);
      const text = document.createElement('span');
      text.className = 'inv-cap-text';
      text.textContent = ratio >= 1 ? '已满' : '容量';
      foot.append(cap, text);
      section.append(foot);
    }

    return section;
  }

  function renderActionButton(label: string, action: InventoryAction, extraClass = ''): HTMLButtonElement {
    const node = button(`inv-act${extraClass ? ` ${extraClass}` : ''}`, label);
    node.addEventListener('click', () => dispatchAndRender(action));
    return node;
  }

  function renderQuantityDialog(slot: InventorySlotSnapshot, ref: SlotRef): HTMLElement {
    const dialog = document.createElement('div');
    dialog.className = 'inv-dropdialog';

    const title = document.createElement('p');
    title.className = 'inv-drop-title';
    title.textContent = `${itemName(content(), slot.itemId)} ×${slot.count}`;
    dialog.append(title);

    const row = document.createElement('div');
    row.className = 'inv-drop-row';
    const minus = button('inv-step', '-');
    const plus = button('inv-step', '+');
    const input = document.createElement('input');
    input.className = 'inv-qty-input';
    input.type = 'number';
    input.min = '1';
    input.max = String(slot.count);
    input.step = '1';
    const currentCount = clampInt(ui.quantityDialog?.count ?? Math.ceil(slot.count / 2), 1, slot.count);
    ui.quantityDialog = { ref, count: currentCount };
    input.value = String(currentCount);
    input.setAttribute('aria-label', '拆分数量');

    function setCount(next: number): void {
      ui.quantityDialog = { ref, count: clampInt(next, 1, slot.count) };
      render();
    }

    minus.addEventListener('click', () => setCount(currentCount - 1));
    plus.addEventListener('click', () => setCount(currentCount + 1));
    input.addEventListener('change', () => setCount(Number(input.value)));
    row.append(minus, input, plus);
    dialog.append(row);

    const actions = document.createElement('div');
    actions.className = 'inv-drop-btns';
    const all = button('inv-act', '全部');
    all.addEventListener('click', () => setCount(slot.count));
    actions.append(all);

    for (const target of CONTAINERS) {
      if (target === ref.container) continue;
      const move = button('inv-act', `移至${CONTAINER_SHORT_LABEL[target]}`);
      move.addEventListener('click', () => {
        const count = clampInt(ui.quantityDialog?.count ?? currentCount, 1, slot.count);
        ui.quantityDialog = null;
        dispatchAndRender({ type: 'move', from: ref.container, to: target, itemId: slot.itemId, quality: slot.quality, count });
      });
      actions.append(move);
    }

    if (ref.container === 'player') {
      const drop = button('inv-act inv-act-drop', '丢弃');
      drop.addEventListener('click', () => {
        const count = clampInt(ui.quantityDialog?.count ?? currentCount, 1, slot.count);
        ui.quantityDialog = null;
        dispatchAndRender({ type: 'drop', itemId: slot.itemId, quality: slot.quality, count });
      });
      actions.append(drop);
    }
    dialog.append(actions);
    return dialog;
  }

  function renderDetail(): HTMLElement {
    const detail = document.createElement('aside');
    detail.className = 'inv-detail';
    const ref = ui.selected;
    const slot = selectedSlot();
    if (!ref || !slot) {
      const empty = document.createElement('p');
      empty.className = 'inv-detail-empty';
      empty.textContent = '选择一格物品';
      detail.append(empty);
      return detail;
    }

    const reg = content();
    const itemDef = reg.items.get(slot.itemId);
    const header = document.createElement('div');
    header.className = 'inv-detail-head';
    const iconBox = document.createElement('div');
    iconBox.className = 'inv-detail-icon';
    iconBox.append(renderIcon(reg, slot.itemId), renderFallbackGlyph(itemName(reg, slot.itemId)));
    const titleBox = document.createElement('div');
    const name = document.createElement('h2');
    name.className = 'inv-name';
    name.textContent = itemName(reg, slot.itemId);
    const meta = document.createElement('div');
    meta.className = 'inv-meta';
    if (slot.quality) {
      const quality = document.createElement('span');
      quality.className = `inv-qtag q-${slot.quality}`;
      quality.textContent = QUALITY_LABEL[slot.quality];
      meta.append(quality);
    }
    const source = document.createElement('span');
    source.className = 'inv-cat';
    source.textContent = CONTAINER_LABEL[ref.container];
    const category = document.createElement('span');
    category.className = 'inv-cat';
    category.textContent = categoryLabel(reg, slot.itemId);
    const amount = document.createElement('span');
    amount.className = 'inv-amt';
    amount.textContent = `×${slot.count}`;
    meta.append(source, category, amount);
    titleBox.append(name, meta);
    header.append(iconBox, titleBox);
    detail.append(header);

    const desc = document.createElement('p');
    desc.className = 'inv-desc';
    desc.textContent = itemDef?.description ?? '没有更多记录。';
    detail.append(desc);

    const actions = document.createElement('div');
    actions.className = 'inv-actions';
    if (ref.container === 'player') {
      if (itemDef?.category === 'pill') actions.append(renderActionButton('服用', { type: 'use', itemId: slot.itemId }, 'inv-act-primary'));
      if (itemDef?.category === 'seed') actions.append(renderActionButton('设为播种', { type: 'select-seed', itemId: slot.itemId }, 'inv-act-primary'));
      if (itemDef?.category === 'tool' || itemDef?.category === 'equipment') actions.append(renderActionButton('设为工具', { type: 'select-tool', itemId: slot.itemId }, 'inv-act-primary'));
      if (itemDef?.category === 'material' || slot.itemId.startsWith('herb.')) {
        const craft = button('inv-act', '投入丹炉');
        craft.addEventListener('click', () => placeSlotInCraft(ref, slot));
        actions.append(craft);
      }
    }
    for (const target of CONTAINERS) {
      if (target === ref.container) continue;
      actions.append(
        renderActionButton(`全部移至${CONTAINER_SHORT_LABEL[target]}`, {
          type: 'move',
          from: ref.container,
          to: target,
          itemId: slot.itemId,
          quality: slot.quality,
          count: slot.count
        })
      );
    }
    if (slot.count > 1) {
      const split = button('inv-act', '拆分数量');
      split.addEventListener('click', () => {
        ui.quantityDialog = { ref, count: Math.max(1, Math.floor(slot.count / 2)) };
        render();
      });
      actions.append(split);
    }
    if (ref.container === 'player') actions.append(renderActionButton('丢弃全部', { type: 'drop', itemId: slot.itemId, quality: slot.quality, count: slot.count }, 'inv-act-drop'));
    detail.append(actions);

    if (ui.quantityDialog && sameRef(ui.quantityDialog.ref, ref)) detail.append(renderQuantityDialog(slot, ref));
    return detail;
  }

  function renderCraftGrid(): HTMLElement {
    const reg = content();
    const section = document.createElement('section');
    section.className = 'inv-craft inv-furnace';
    const heading = document.createElement('h2');
    heading.className = 'inv-side-title';
    heading.textContent = '丹炉';
    section.append(heading);

    const recipes = recipesMatchingSearch(allCraftRecipes());
    const recipe = selectedRecipe();
    if (recipe) clearInvalidCraftSlots(recipe);

    const shell = document.createElement('div');
    shell.className = 'inv-craft-workbench';

    const plate = document.createElement('div');
    plate.className = 'inv-craft-plate';
    const plateHeader = document.createElement('div');
    plateHeader.className = 'inv-craft-head';
    const plateName = document.createElement('h3');
    plateName.className = 'inv-craft-title';
    plateName.textContent = recipe ? recipe.displayName : '暂无丹方';
    const progress = recipe ? craftProgress(recipe) : { filled: 0, required: 0 };
    const plateMeta = document.createElement('span');
    plateMeta.className = 'inv-craft-progress';
    plateMeta.textContent = recipe ? `材料 ${progress.filled}/${progress.required}` : '材料 0/0';
    plateHeader.append(plateName, plateMeta);
    plate.append(plateHeader);
    const pairing = document.createElement('p');
    pairing.className = 'inv-craft-notice inv-furnace-pairing';
    pairing.textContent = recipe ? `七情配伍：${recipe.inputs.map(input => itemName(reg, input.herbId)).join('、')}按君臣佐使入盘，药性随炉火定成败。` : '七情配伍：暂无丹方可推演药性。';
    plate.append(pairing);

    const result = document.createElement('div');
    result.className = 'inv-craft-result';
    result.dataset.craftOutput = 'true';
    let furnaceOutputMeta: HTMLSpanElement | null = null;
    if (recipe) {
      const output = document.createElement('div');
      output.className = 'inv-craft-output';
      output.append(renderIcon(reg, recipe.outputPillId), renderFallbackGlyph(itemName(reg, recipe.outputPillId)));
      const outputText = document.createElement('div');
      outputText.className = 'inv-craft-output-text';
      const outputName = document.createElement('strong');
      outputName.textContent = itemName(reg, recipe.outputPillId);
      const outputMeta = document.createElement('span');
      outputMeta.dataset.furnaceOutputMeta = 'true';
      outputMeta.textContent = craftComplete(recipe) ? furnaceHeatPreview(recipe) : recipeAvailabilityLabel(recipe);
      furnaceOutputMeta = outputMeta;
      outputText.append(outputName, outputMeta);
      const start = button('inv-act inv-act-primary', '开炉炼制');
      start.dataset.craftStart = 'true';
      start.dataset.furnaceStart = 'true';
      start.disabled = !craftComplete(recipe);
      start.addEventListener('click', () => dispatchAndRender({ type: 'brew', recipeId: recipe.id, heatPercent: ui.furnaceHeatPercent }));
      result.append(output, outputText, start);
    } else {
      const empty = document.createElement('p');
      empty.className = 'inv-detail-empty';
      empty.textContent = '暂无丹方';
      result.append(empty);
    }
    plate.append(result);

    const craftActions = document.createElement('div');
    craftActions.className = 'inv-craft-actions';
    const auto = button('inv-act inv-act-primary', '自动入药');
    auto.dataset.craftAutofill = 'true';
    auto.disabled = !recipe;
    auto.addEventListener('click', () => {
      if (recipe) autoFillCraft(recipe);
    });
    const clear = button('inv-act', '清空药盘');
    clear.disabled = Object.keys(ui.craftSlots).length === 0;
    clear.addEventListener('click', () => {
      ui.craftSlots = {};
      ui.craftNotice = '药盘已清空。';
      render();
    });
    craftActions.append(auto, clear);
    plate.append(craftActions);

    const projection = document.createElement('div');
    projection.className = 'inv-craft-projection';
    projection.setAttribute('role', 'grid');
    projection.setAttribute('aria-label', '丹炉九宫药盘');
    if (recipe) {
      for (const cell of recipeWorkbenchProjection(recipe)) {
        const cellButton = button(`inv-craft-cell${cell.furnace ? ' is-furnace' : ''}${cell.requiredItemId ? ' is-required' : ''}${ui.craftSlots[cell.index] ? ' is-filled' : ''}`, '');
        cellButton.dataset.craftCell = String(cell.index);
        cellButton.setAttribute('role', 'gridcell');
        const role = document.createElement('span');
        role.className = 'inv-craft-role';
        role.textContent = cell.role;
        cellButton.append(role);
        if (cell.furnace) {
          const furnace = document.createElement('span');
          furnace.className = 'inv-craft-furnace-label';
          furnace.textContent = '炉心';
          cellButton.append(furnace);
          cellButton.disabled = true;
        } else {
          const placed = ui.craftSlots[cell.index] ?? null;
          if (placed) {
            cellButton.append(renderIcon(reg, placed.itemId), renderFallbackGlyph(itemName(reg, placed.itemId)));
            renderSlotBadges(cellButton, { key: placed.key, itemId: placed.itemId, quality: placed.quality, count: 1 });
            if (placed.virtual) {
              const kit = document.createElement('span');
              kit.className = 'inv-virtual';
              kit.textContent = '药包';
              cellButton.append(kit);
            }
            cellButton.setAttribute('aria-label', `${cell.role}位：${itemName(reg, placed.itemId)}，点击取下`);
            cellButton.addEventListener('click', () => {
              delete ui.craftSlots[cell.index];
              ui.craftNotice = `${cell.role}位已空出。`;
              render();
            });
          } else if (cell.requiredItemId) {
            const ghost = document.createElement('span');
            ghost.className = 'inv-craft-ghost';
            ghost.textContent = itemName(reg, cell.requiredItemId);
            cellButton.append(ghost);
            cellButton.setAttribute('aria-label', `${cell.role}位缺${itemName(reg, cell.requiredItemId)}`);
            cellButton.addEventListener('click', () => {
              const source = inventorySlotsForContainer(state(), 'player').find(candidate => candidate.itemId === cell.requiredItemId);
              if (source) placeSlotInCraft({ container: 'player', key: source.key }, source, cell.index);
              else if (tutorialKitAvailableFor(recipe)) {
                ui.craftSlots[cell.index] = { itemId: cell.requiredItemId!, key: `tutorial-kit:${cell.index}:${cell.requiredItemId}`, virtual: true };
                ui.craftNotice = `${cell.role}位已引入教学药包。`;
                render();
              }
              else {
                ui.craftNotice = `缺少${itemName(reg, cell.requiredItemId!)}`;
                render();
              }
            });
          } else {
            cellButton.setAttribute('aria-label', `${cell.role}位空置`);
          }
          attachCraftDropTarget(cellButton, cell.index);
        }
        projection.append(cellButton);
      }
    }
    plate.append(projection);

    const heat = document.createElement('div');
    heat.className = 'inv-furnace-heat';
    const heatHead = document.createElement('div');
    heatHead.className = 'inv-furnace-heat-head';
    const heatLabel = document.createElement('label');
    heatLabel.className = 'inv-craft-title';
    heatLabel.htmlFor = 'inv-furnace-heat';
    heatLabel.textContent = '炉火';
    const heatOutput = document.createElement('output');
    heatOutput.className = 'inv-craft-progress';
    heatOutput.setAttribute('for', 'inv-furnace-heat');
    heatOutput.value = String(ui.furnaceHeatPercent);
    heatOutput.textContent = `${ui.furnaceHeatPercent}%`;
    heatHead.append(heatLabel, heatOutput);
    heat.append(heatHead);
    const heatInput = document.createElement('input');
    heatInput.id = 'inv-furnace-heat';
    heatInput.className = 'inv-furnace-range';
    heatInput.type = 'range';
    heatInput.min = '0';
    heatInput.max = '100';
    heatInput.step = '1';
    heatInput.value = String(ui.furnaceHeatPercent);
    heatInput.dataset.furnaceHeat = 'true';
    heatInput.setAttribute('aria-label', '调整丹炉炉火');
    const heatPreview = document.createElement('p');
    heatPreview.className = 'inv-craft-notice';
    heatPreview.dataset.furnacePreview = 'true';
    heatPreview.textContent = recipe ? furnaceHeatPreview(recipe) : '暂无丹方可预判炉火。';
    heat.dataset.heatBand = recipe ? heatBandForRecipe(recipe) : 'ideal';
    const syncFurnaceHeatPreview = (): void => {
      if (!recipe) return;
      const preview = furnaceHeatPreview(recipe);
      heat.dataset.heatBand = heatBandForRecipe(recipe);
      heatPreview.textContent = preview;
      if (furnaceOutputMeta && craftComplete(recipe)) furnaceOutputMeta.textContent = preview;
    };
    heatInput.addEventListener('input', () => {
      ui.furnaceHeatPercent = clampInt(Number(heatInput.value), 0, 100);
      heatOutput.value = String(ui.furnaceHeatPercent);
      heatOutput.textContent = `${ui.furnaceHeatPercent}%`;
      syncFurnaceHeatPreview();
    });
    heat.append(heatInput, heatPreview);
    plate.append(heat);

    if (ui.craftNotice) {
      const notice = document.createElement('p');
      notice.className = 'inv-craft-notice';
      notice.textContent = ui.craftNotice;
      plate.append(notice);
    }

    const list = document.createElement('div');
    list.className = 'inv-craft-list';
    const listTitle = document.createElement('h3');
    listTitle.className = 'inv-craft-list-title';
    listTitle.textContent = '丹方玉简';
    list.append(listTitle);
    if (recipes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'inv-detail-empty';
      empty.textContent = ui.searchTerm.trim() ? '没有匹配丹方' : '暂无丹方';
      list.append(empty);
    } else {
      for (const recipe of recipes) {
        const ready = recipeAvailableForFurnace(recipe);
        const active = ui.selectedRecipeId === recipe.id;
        const card = button(`inv-recipe${ready ? ' is-ready' : ''}${active ? ' is-active' : ''}`, '');
        card.dataset.inventoryRecipeId = recipe.id;
        card.setAttribute('aria-label', `${recipe.displayName}，${ready ? '可补齐' : recipeAvailabilityLabel(recipe)}`);
        const output = document.createElement('div');
        output.className = 'inv-recipe-output';
        const icon = document.createElement('span');
        icon.className = 'inv-recipe-icon';
        icon.append(renderIcon(reg, recipe.outputPillId), renderFallbackGlyph(itemName(reg, recipe.outputPillId)));
        const text = document.createElement('span');
        text.className = 'inv-recipe-name';
        text.textContent = recipe.displayName;
        output.append(icon, text);
        const materials = document.createElement('span');
        materials.className = 'inv-recipe-materials';
        materials.textContent = `${recipeAvailabilityLabel(recipe)}｜${craftMaterialLine(recipe)}`;
        card.append(output, materials);
        card.addEventListener('click', () => {
          ui.activeTab = 'furnace';
          ui.selectedRecipeId = recipe.id;
          ui.craftSlots = {};
          ui.craftNotice = null;
          render();
        });
        list.append(card);
      }
    }
    shell.append(plate, list);
    section.append(shell);
    return section;
  }

  function render(): void {
    const root = options.root;
    const activeElement = document.activeElement;
    const restoreSearchFocus = activeElement instanceof HTMLInputElement && activeElement.classList.contains('inv-search');
    const selectionStart = restoreSearchFocus ? activeElement.selectionStart : null;
    const selectionEnd = restoreSearchFocus ? activeElement.selectionEnd : null;

    selectedSlot();
    root.classList.remove('flow-empty-state');
    root.replaceChildren();
    const viewMode = options.viewMode?.() ?? 'full';
    root.dataset.inventoryViewMode = viewMode;
    const shell = document.createElement('div');
    shell.className = 'inv';
    shell.dataset.inventoryMode = viewMode;
    shell.append(renderToolbar());

    const body = document.createElement('div');
    body.className = `inv-body inv-body-${ui.activeTab}`;
    if (ui.activeTab === 'furnace') {
      const craftSurface = document.createElement('div');
      craftSurface.className = 'inv-craft-surface';
      craftSurface.append(renderCraftGrid());
      body.append(craftSurface);
    } else {
      const stack = document.createElement('div');
      stack.className = 'inv-stack inv-stack-single';
      stack.append(renderContainer(ui.activeTab));
      const side = document.createElement('div');
      side.className = 'inv-side inv-side-detail';
      side.append(renderDetail());
      body.append(stack, side);
    }
    shell.append(body);
    root.append(shell);
    if (viewMode === 'full') persistViewPrefs();

    if (restoreSearchFocus) {
      const search = root.querySelector<HTMLInputElement>('.inv-search');
      search?.focus();
      if (search && selectionStart != null && selectionEnd != null) search.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  function destroy(): void {
    options.root.replaceChildren();
    delete options.root.dataset.inventoryViewMode;
  }

  function showFurnace(recipeId?: string): void {
    ui.activeTab = 'furnace';
    ui.searchTerm = '';
    if (recipeId && ui.selectedRecipeId !== recipeId) {
      ui.selectedRecipeId = recipeId;
      ui.craftSlots = {};
      ui.craftNotice = null;
    }
    ui.quantityDialog = null;
    render();
  }

  function showInventory(): void {
    const persistedView = normalizedInventoryView(state().inventoryLayout.view);
    if (ui.activeTab === 'furnace' && persistedView.activeTab !== 'furnace') {
      ui.activeTab = persistedView.activeTab;
      ui.pageByContainer = { ...persistedView.pageByContainer };
      ui.searchTerm = persistedView.searchTerm;
      ui.sortKey = persistedView.sortKey;
    }
    if (ui.activeTab !== 'furnace' && ui.selected?.container !== ui.activeTab) ui.selected = null;
    if (ui.activeTab === 'furnace') ui.selected = null;
    ui.quantityDialog = null;
    render();
  }

  return { render, showFurnace, showInventory, destroy };
}
