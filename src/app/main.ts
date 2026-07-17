/**
 * 应用入口：PixiJS v8 启动 + 输入 → sim 即时动作 + 过夜推进。
 * sim/render 解耦：本文件桥接 io(输入) → sim → render。
 * 启动：pnpm dev（当前以浏览器作为开发/测试/作品展示入口；游戏核心仍按离线单机、多端适配方向推进）。全程中文 UI（C8）。
 */
import { Application, Assets, Texture } from 'pixi.js';
import { createWorld, createSimContext, createSimContextFromState, DEFAULT_BALANCE, ARRAY_BUILD_COSTS, FACILITY_BUILD_COSTS, FACILITY_LABEL, FACILITY_EXPANSION_REQUIREMENT, LOCATION_CATALOG, applyAction, applyMvpStarterKit, startPurpleOmenIfDue, advanceDay, applyPill, brewPills, placeArray, checkGameEnd, canShipItem, shippingUnitPrice, getTradeOffers, executeTrade, getShopItems, buyShopItem, getAvailableUpgrades, performUpgrade, getNpcList, bestGiftItemForNpc, getActiveSpecialOrders, getCurrentMainlineQuest, getCurrentNpcQuest, getCurrentRuinChapter, getCurrentStayingWorldIncident, getDailyCommission, getDailySpecialOrder, getOnboardingObjectiveId, getPublicDemoObjectiveId, greenhouseClimate, greenhouseCareStreak, hasResolvedStayingWorldIncidentForDay, nextArchiveDonation, nextArchiveMilestone, resolveBrew, recordTribulationInvocation, adjacentFacility, calendarEntriesForDay, upcomingCalendarEntries, getNpcDailySchedules, getFestivalStallItems, getActiveLocationDirectory, getGreenhouseRumor, greenhouseNurseryCapacity, greenhouseNurserySlotsRemaining, greenhouseNurseryTier, greenhouseProtectedCropCount, getLocationEncounters, getLocationServiceOptions, getPreferredLocationSelection, getQuickLocationServiceOption, getTeaShedRumor, locationIndexFromDigitCode, locationServiceIndexFromDigitKey, locationSummary, claimRelationshipEvent, resolveAscensionChoice, tendGreenhouse, visitTeaShed, facilityPlacementRuleText, farmExpansionTier, storageUsed, tileAt, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, type ArchiveDonationReward, type CalendarEntry, type FacilityKind, type GameState, type LocationId, type LocationServiceCommand, type SimContext, type UpgradeDef } from '@sim';
import { saveGame, deserializeState } from '@sim/serialize';
import { buildRegistry, isSchemaHashCompatible } from '@content/registry';
import { t } from '@content/i18n';
import manifestJson from '../../assets/manifest.json';
import { itemCount } from '@sim/world/player';
import { createLayers, drawWorld, setToast, setHotbar, setTextIfChanged, triggerTribFlash, triggerTribBolt, triggerShake, drawDialogue, hideDialogue, drawPauseOverlay, renderCultivationOverview, screenPointForTile, spawnBurst, spawnFloatText, updateParticles, updateFloatTexts, drawLocationPreview, hideLocationPreview, drawHotbarIcon, drawPanelItemPreview, hidePanelItemPreview, drawTodayBriefing, hideTodayBriefing, type RenderLayers, type RuntimeRenderAssets } from '@render/renderer';
import { GUARD_BEAST_ASSET_IDS } from '@render/guardBeastPreview';
import { nextPendingBeat, markSeen, type NarrativeBeat } from '@content/narrative';
import { createFurnaceLayer, drawFurnace } from '@render/furnacePanel';
import { createRenderScheduler, type RenderScheduler } from '@render/renderScheduler';
import { computeViewportLayout } from '@render/viewportLayout';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { readyForBreakthrough, breakthrough, stageQiCap } from '@sim/progression/progression';
import type { Direction } from '@sim/world/types';
import type { Season } from '@sim/world/types';
import { AudioEngine } from '@io/audio';
import type { CropQuality } from '@sim/farm/quality';
import { HOTBAR_SLOTS, cycleHotbarIndex, findNextOwnedSeedHotbarIndex, hotbarIndexFromDigitKey, hotbarSlotAssetId, hotbarStatusText, hotbarToastPresentation, hotbarWheelDelta, ownedSeedHotbarIndex, type HotbarSlotKind } from './hotbar';
import { FARM_ACTION_ORDER, cycleSelection, farmActionIndexFromDigitKey, farmActionLabel, interactionPanelActive, normalizeSelection, npcActionIndexFromDigitKey, selectionLabel, type FarmActionKind, type InteractionPanelState } from './interactionPanels';
import { resolveCommandShortcut, resolveDigitShortcut, resolveEnterShortcut, resolveEscapeShortcut, resolveExplorationLocationShortcut, resolveFarmActionShortcut, resolveFarmMenuShortcut, resolveLegacyBuildShortcut, resolveLegacyConfirmShortcut, resolveLocationServiceShortcut, resolvePageDownShortcut, resolvePageUpShortcut, resolvePrimaryInteractionShortcut, resolveQShortcut, resolveQuickLocationShortcut, resolveTabShortcut, resolveWorldActionShortcut, shouldPreserveInteractionPanelForKey, shouldPreserveLocationSelectionForKey } from './keybindings';
import { composeEndDayToastMessage, daySummaryMessage, daySummaryPresentation } from './daySummary';
import { endDaySfxQueue } from './endDaySfx';
import { actionSfxQueue } from './actionSfx';
import { itemIconAssetId } from './itemIcons';
import { buildLocationPreviewSummary, calendarSummaryToastPresentation, describeLocationSelectionSummary, legacyConfirmUnavailableToastPresentation, locationDirectoryEmptyToastPresentation, locationEncounterUnavailableToastPresentation, locationPreviewAssetId, locationPreviewNpcIds, locationPreviewPortraitAssetIds, locationPreviewPortraits, locationPreviewSummaryContext, locationPreviewThreadLocationId, locationSelectionToastPresentation, locationServiceActorAssetId, locationServiceUnavailableToastPresentation, locationShortcutFailureToastPresentation, LOCATION_PREVIEW_LOCATION_IDS, previewNpcPortraitAssetId, type LocationPreviewNpcSignals } from './locationPreview';
import { formatLocationActionSignalLine } from './locationActionSignals';
import { collectLocationNpcSignals } from './locationNpcSignals';
import { runtimeNpcAssetIds } from './renderAssetCatalog';
import { onboardingEndDayWarningToastPresentation, onboardingHelpText, onboardingObjectiveAdvanceToast, onboardingObjectiveAdvanceToastPresentation, onboardingRestockReturnToastPresentation, onboardingSecondWaterCompletionToastPresentation, onboardingWelcomeToastPresentation } from './onboardingObjective';
import { AssetStore, assetUrlForId, validateManifest } from '@io/assets';
import { preloadUiFont } from './fontPreload';
import { buildProceduralCropTextures } from './cropSprites';
import { arrayPlacementToastPresentation, cultivationPanelToastPresentation, deriveFarmActionOutcome, farmActionBlockedReason, farmActionBlockedToastPresentation, farmActionSuccessToastPresentation, fertilizeSuccessToastPresentation, overlayToastPresentation, restSuccessToastPresentation, snapshotFarmTiles, sowSuccessToastPresentation, sowUnavailableToastPresentation, type FarmActionFeedbackKind } from './actionFeedback';
import { bodyTrainingToastPresentation, brewMaterialFailureToastPresentation, facilityCollectFailureToastPresentation, facilityCollectResultToast, facilityCollectResultToastPresentation, facilityFailureToastPresentation, facilityJobStartToast, facilityJobStartToastPresentation, facilityStatusToastPresentation, firstHarvestMilestoneToast, firstHarvestMilestoneToastPresentation, firstShipmentMilestoneToast, firstShipmentMilestoneToastPresentation, guardBeastFeedFailureToastPresentation, guardBeastFeedResultToastPresentation, pillUseToastPresentation, shippingFailureToastPresentation, shippingResultToast, shippingResultToastPresentation, storageFailureToastPresentation, storageResultToast, storageResultToastPresentation } from './actionResultToast';
import { toolFeedbackToastPresentation } from './toolFeedback';
import { buildTodayBriefing } from './todayBriefing';
import { ambientPanelPreview } from './ambientPanelPreview';
import { locationPreviewFocusReason } from './locationFocusReason';
import { farmsteadRootContextAssetId, getFarmsteadFocus } from './farmsteadFocus';
import { inventoryPreviewSelection } from './inventoryPreview';
import { brewResultToastPresentation, dryingProcessingPanelPreview, furnaceHeatToastPresentation, furnaceRecipeToastPresentation, furnaceVisibilityToastPresentation, processingPositionRequiredToastPresentation, processingRecipeUnavailableToastPresentation, processingToastPresentation, processingUnavailableToastPresentation, staticProcessingPanelPreview } from './processingPreview';
import { beastHuntResultToastPresentation, beastHuntUnavailableToastPresentation, explorationFailureToastPresentation, explorationResultToastPresentation, ruinDelveFailureToastPresentation, ruinDelveToastPresentation, tribulationBlockedToastPresentation, tribulationEndingToastPresentation, tribulationResultToastPresentation } from './explorationToast';
import { buildPanelPreview, buildResultToastPresentation, buildToastPresentation, facilityCollectPanelPreview, facilityCollectToastPresentation, facilityCollectUnavailableToastPresentation, upgradePanelPreview, upgradeResultToastPresentation, upgradeToastPresentation, upgradeUnavailableToastPresentation } from './facilityPanelPreview';
import { shippingPanelPreview, shippingToastPresentation, shippingUnavailableToastPresentation, storagePanelPreview, storageToastPresentation, storageUnavailableToastPresentation } from './logisticsPanelPreview';
import { arraysServiceToastPresentation, farmWorkServiceToastPresentation, festivalPanelPreview, festivalResultToastPresentation, festivalToastPresentation, festivalUnavailableToastPresentation, greenhousePanelPreview, greenhouseResultToastPresentation, greenhouseToastPresentation, processingServiceToastPresentation, quickServiceUnavailableToastPresentation, teaShedPanelPreview, teaShedResultToastPresentation, teaShedToastPresentation } from './servicePanelPreview';
import { shopPanelPreview, shopResultToastPresentation, shopToastPresentation, shopUnavailableToastPresentation, tradePanelPreview, tradeResultToastPresentation, tradeToastPresentation, tradeUnavailableToastPresentation } from './commercePanelPreview';
import { farmActionMenuPreview, farmActionMenuToastPresentation, npcActionMenuPreview, npcActionMenuToastPresentation, npcBrowsePanelPreview, npcBrowseToastPresentation, npcGiftPanelPreview, npcGiftResultToastPresentation, npcGiftToastPresentation, npcQuestPanelPreview, npcQuestResultToastPresentation, npcQuestToastPresentation, npcUnavailableToastPresentation } from './actionPanelPreview';
import { activeSpecialOrderPanelPreview, archiveDonationFailureToastPresentation, archiveDonationToastPresentation, archiveEmptyToastPresentation, archiveMilestoneFailureToastPresentation, archiveMilestoneToastPresentation, commissionBoardEmptyToastPresentation, commissionCompleteToastPresentation, commissionIncompleteToastPresentation, commissionToastPresentation, dailyCommissionPanelPreview, dailySpecialOrderPanelPreview, mainlineQuestClaimFailureToastPresentation, mainlineQuestClaimToastPresentation, mainlineQuestPanelPreview, mainlineQuestUnavailableToastPresentation, ruinChapterClaimFailureToastPresentation, ruinChapterClaimToastPresentation, ruinChapterPanelPreview, ruinChapterUnavailableToastPresentation, specialOrderAcceptFailureToastPresentation, specialOrderAcceptToastPresentation, specialOrderClaimFailureToastPresentation, specialOrderClaimToastPresentation, specialOrderPendingToastPresentation, specialOrderProgressToastPresentation, specialOrderSubmitFailureToastPresentation, stayingWorldIncidentPanelPreview, stayingWorldIncidentResolveFailureToastPresentation, stayingWorldIncidentResolveToastPresentation } from './commissionPreview';
import { resolvePreviewTexture } from './previewTexture';
import { buildEncounterDialogueBeat, buildRelationshipDialogueBeat, type DialogueBeatWithAsset } from './dialoguePreview';
import { buildJourneyGuide, formatJourneyGuideBody, isJourneyTeachingActive, isJourneyTeachingDialogueBeat } from './journeyGuide';
import { createResponsiveShell, type ResponsiveShellController } from './responsiveShell';
import { APP_FLOW_FOCUS_TARGETS, type AppFlowEvent, type AppFlowState } from './appFlowMachine';
import { createAppFlowViewController, type AppFlowViewController } from './appFlowView';
import { gameCommandFromKeyboard, type GameCommand } from './semanticInputRouter';
import { createPublicDemoPanelsController, type PublicDemoPanelAction, type PublicDemoPanelsController } from './publicDemoPanelsView';
import { buildPublicDemoAftermathView, buildPublicDemoAlchemyView, buildPublicDemoTribulationView } from './publicDemoPanels';
import { deriveSemanticGameState, interactionPanelSemanticLabel, type SemanticWorldAttention } from './semanticGameState';
import { decodeStoredSave, deriveSaveHealthPresentation, saveHealthAfterClear, saveHealthAfterLoad, saveHealthAfterWrite, type SaveHealth } from './saveHealth';
import { DEFAULT_RUNTIME_SETTINGS, RUNTIME_SETTINGS_STORAGE_KEY, decodeRuntimeSettings, runtimeSettingsPersistenceText, serializeRuntimeSettings, type RuntimeSettings } from './runtimeSettings';

type DirectFarmActionKind = Exclude<FarmActionFeedbackKind, 'sow' | 'fertilize'>;

const RENDER_ASSET_LOAD_TIMEOUT_MS = 8_000;

async function loadTextureWithTimeout(url: string): Promise<Texture | undefined> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Assets.load<Texture>(url),
      new Promise<undefined>(resolve => {
        timeout = setTimeout(() => resolve(undefined), RENDER_ASSET_LOAD_TIMEOUT_MS);
      })
    ]);
  } catch {
    return undefined;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function loadRenderAssets(store: AssetStore): Promise<RuntimeRenderAssets> {
  const iconIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('icon.'));
  const facilityIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('facility.'));
  const locationIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('loc.'));
  const tileIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('tile.'));
  const logoIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('logo.'));
  const allNpcAssetIds = runtimeNpcAssetIds(store);
  const hotbarIconIds = [...new Set(HOTBAR_SLOTS.map(slot => hotbarSlotAssetId(slot)).filter((id): id is string => Boolean(id)))];

  const ids = ['sprite.player', ...GUARD_BEAST_ASSET_IDS, ...allNpcAssetIds, ...facilityIds, ...hotbarIconIds, ...locationIds, ...tileIds, ...logoIds, ...iconIds] as const;

  const loaded = await Promise.all(
    ids.map(async id => {
      const url = assetUrlForId(store, id);
      if (!url) return [id, undefined] as const;
      const texture = await loadTextureWithTimeout(url);
      if (texture?.source) texture.source.scaleMode = 'nearest';
      return [id, texture] as const;
    })
  );

  const textureById = new Map<string, Texture | undefined>(loaded);
  const locationTextures = Object.fromEntries(LOCATION_PREVIEW_LOCATION_IDS.map(locationId => [locationId, textureById.get(locationPreviewAssetId(locationId))]));

  return {
    player: textureById.get('sprite.player'),
    guardBeast: textureById.get('sprite.guard-beast'),
    guardBeastVariants: Object.fromEntries(GUARD_BEAST_ASSET_IDS.map(id => [id, textureById.get(id)])),
    cropHerbs: {},
    cropSeeds: {},
    facilities: Object.fromEntries(facilityIds.map(id => [id.slice('facility.'.length), textureById.get(id)])),
    locations: locationTextures,
    logos: Object.fromEntries(logoIds.map(id => [id, textureById.get(id)])),
    hotbarIcons: Object.fromEntries(hotbarIconIds.map(id => [id, textureById.get(id)])),
    itemIcons: Object.fromEntries(iconIds.map(id => [id, textureById.get(id)])),
    npcs: Object.fromEntries(allNpcAssetIds.map(id => [id, textureById.get(id)])),
    tiles: Object.fromEntries(tileIds.map(id => [id, textureById.get(id)]))
  };
}

async function main(): Promise<void> {
  const reg = buildRegistry();
  const assetStore = new AssetStore(validateManifest(manifestJson));
  const SEED = 20260710;
  const SAVE_KEY = 'aeonvale-save-v1';
  const BUILD_REVISION = import.meta.env.VITE_BUILD_REVISION ?? 'dev';
  const BUILD_LABEL = BUILD_REVISION === 'dev' ? '版本 0.1.0 · 本地试玩' : '版本 0.1.0 · 试玩构建';
  const BUILD_TITLE = BUILD_REVISION === 'dev' ? '' : `构建 ${BUILD_REVISION}`;
  let requestRender: (() => void) | null = null;
  let renderScheduler: RenderScheduler | null = null;
  let publicDemoPanels: PublicDemoPanelsController | null = null;

  const loadSave = (): { readonly state: GameState | null; readonly health: SaveHealth } => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return { state: null, health: saveHealthAfterLoad('storage-unavailable') };
    }

    const decoded = decodeStoredSave<GameState>(
      raw,
      schemaHash => isSchemaHashCompatible(reg, schemaHash),
      savedState => deserializeState(savedState) as GameState
    );
    return { state: decoded.state, health: saveHealthAfterLoad(decoded.status) };
  };
  const saveState = (s: GameState): boolean => {
    let succeeded = false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveGame(s, reg.schemaHash)));
      succeeded = true;
    } catch {
      /* 存储满/禁用 */
    }
    saveHealth = saveHealthAfterWrite(saveHealth, succeeded);
    updateSaveHealthUi();
    enterEndingIfNeeded();
    publicDemoPanels?.render(s, ctx);
    requestRender?.();
    return succeeded;
  };
  const clearSave = (): boolean => {
    let succeeded = false;
    try {
      localStorage.removeItem(SAVE_KEY);
      succeeded = true;
    } catch {
      /* ignore */
    }
    saveHealth = saveHealthAfterClear(succeeded);
    updateSaveHealthUi();
    return succeeded;
  };

  const loadRuntimeSettings = (): { readonly settings: RuntimeSettings; readonly persistenceAvailable: boolean } => {
    try {
      return { settings: decodeRuntimeSettings(localStorage.getItem(RUNTIME_SETTINGS_STORAGE_KEY)), persistenceAvailable: true };
    } catch {
      return { settings: DEFAULT_RUNTIME_SETTINGS, persistenceAvailable: false };
    }
  };

  const createFreshState = (): GameState => {
    const fresh = createWorld({ seed: SEED, width: 14, height: 9, content: reg, params: DEFAULT_BALANCE });
    applyMvpStarterKit(fresh, DEFAULT_BALANCE);
    return fresh;
  };
  const loaded = loadSave();
  const loadedRuntimeSettings = loadRuntimeSettings();
  let saveHealth = loaded.health;
  let runtimeSettings = loadedRuntimeSettings.settings;
  let runtimeSettingsPersistenceAvailable = loadedRuntimeSettings.persistenceAvailable;
  let state: GameState = loaded.state ?? createFreshState();
  let ctx: SimContext = createSimContextFromState(state, reg, DEFAULT_BALANCE);
  document.documentElement.dataset.reducedMotion = String(runtimeSettings.reducedMotion);

  await preloadUiFont(assetStore);

  const app = new Application();
  await app.init({
    width: 960,
    height: 540,
    background: 0x10101a,
    antialias: false,
    roundPixels: true,
    preserveDrawingBuffer: import.meta.env.VITE_PRESERVE_DRAWING_BUFFER === 'true'
  });
  const mount = document.querySelector('#app');
  (mount ?? document.body).appendChild(app.canvas);
  app.canvas.id = 'game-canvas';
  app.canvas.style.imageRendering = 'pixelated';
  app.canvas.tabIndex = 0;
  app.canvas.setAttribute('aria-label', '永恒山谷游戏画面');
  app.canvas.setAttribute('aria-describedby', 'game-instructions game-surface game-objective game-actions');
  const renderAssets = await loadRenderAssets(assetStore);
  const proceduralCropTextures = buildProceduralCropTextures(reg);
  renderAssets.cropHerbs = proceduralCropTextures.herbs;
  renderAssets.cropSeeds = proceduralCropTextures.seeds;

  const layers: RenderLayers = createLayers(app);
  const furnace = createFurnaceLayer(app);
  const audio = new AudioEngine();
  audio.setMasterVolume(runtimeSettings.masterVolume);
  let furnaceHeat = 50; // 玩家炉温 0..100

  const seasonShort: Record<Season, string> = { spring: '春', summer: '夏', autumn: '秋', winter: '冬' };
  const describeCalendarEntry = (entry: CalendarEntry): string => `${seasonShort[entry.season]}${entry.day} ${entry.title}`;
  let hotbarIdx = 0;
  let tradeIdx = 0;
  let shopIdx = 0;
  let npcIdx = 0;
  let shipIdx = 0;
  let qualityShipIdx = 0;
  let storageDepositIdx = 0;
  let storageWithdrawIdx = 0;
  let processingIdx = 0;
  let facilityCollectIdx = 0;
  let farmActionIdx = 0;
  let locationIdx = 0;
  let locationServiceIdx = 0;
  let locationEncounterIdx = 0;
  let locationSelectionActive = false;
  let interactionPanel: InteractionPanelState = { kind: 'none' };
  const NPC_ACTION_ORDER = ['browse', 'gift', 'quest'] as const;
  type NpcPanelMode = (typeof NPC_ACTION_ORDER)[number];
  let npcActionIdx = 0;
  let cultivationPanelVisible = false;
  const facilityBuildChoices: FacilityKind[] = ['drying-rack', 'sealing-cabinet', 'talisman-furnace'];
  let facilityBuildIdx = 0;
  const brewRecipes = ['recipe.ward-pill', 'recipe.bone-pill', 'recipe.detox-pill', 'recipe.cold-mud', 'recipe.ward-fulgur', 'recipe.bone-herbal', 'recipe.detox-plume'];
  let recipeIdx = 0;
  let dialogueBeat: DialogueBeatWithAsset | null = null;
  let paused = false;
  let responsiveShell: ResponsiveShellController | null = null;
  let flowView: AppFlowViewController | null = null;
  const runtimeSettingsAbortController = new AbortController();
  let npcNameToId = new Map(getNpcList(state).map(npc => [npc.displayName, npc.id] as const));
  const prologueBeatIds = ['awaken', 'spirit-test', 'intro'] as const;

  function setElementText(id: string, text: string): void {
    const element = document.querySelector<HTMLElement>(`#${id}`);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function updateSaveHealthUi(): void {
    const presentation = deriveSaveHealthPresentation(saveHealth);
    flowView?.setContinueAvailable(presentation.continueAvailable);
    setElementText('flow-settings-save-status', presentation.settingsStatus);
    setElementText('flow-pause-save-status', presentation.pauseStatus);
    setElementText('orientation-save-status', `农田、丹炉与天劫需要更宽的视野。${presentation.portraitStatus}`);

    const titleNotice = document.querySelector<HTMLElement>('#flow-title-save-notice');
    if (titleNotice) {
      const notice = presentation.titleNotice;
      titleNotice.hidden = notice === null;
      if (titleNotice.textContent !== (notice ?? '')) titleNotice.textContent = notice ?? '';
    }
  }

  function updateRuntimeSettingsUi(): void {
    audio.setMasterVolume(runtimeSettings.masterVolume);
    document.documentElement.dataset.reducedMotion = String(runtimeSettings.reducedMotion);

    const volume = document.querySelector<HTMLInputElement>('#flow-settings-master-volume');
    const output = document.querySelector<HTMLOutputElement>('#flow-settings-volume-output');
    const reducedMotion = document.querySelector<HTMLInputElement>('#flow-settings-reduced-motion');
    const volumeLabel = `${audio.getMasterVolume()}%`;
    if (volume) {
      volume.value = String(audio.getMasterVolume());
      volume.setAttribute('aria-valuetext', volumeLabel);
    }
    if (output && output.textContent !== volumeLabel) output.textContent = volumeLabel;
    if (reducedMotion) reducedMotion.checked = runtimeSettings.reducedMotion;
    setElementText('flow-settings-runtime-persistence-status', runtimeSettingsPersistenceText(runtimeSettingsPersistenceAvailable));
  }

  function persistRuntimeSettings(): void {
    try {
      localStorage.setItem(RUNTIME_SETTINGS_STORAGE_KEY, serializeRuntimeSettings(runtimeSettings));
      runtimeSettingsPersistenceAvailable = true;
    } catch {
      runtimeSettingsPersistenceAvailable = false;
    }
    setElementText('flow-settings-runtime-persistence-status', runtimeSettingsPersistenceText(runtimeSettingsPersistenceAvailable));
  }

  function bindRuntimeSettingsControls(): void {
    const volume = document.querySelector<HTMLInputElement>('#flow-settings-master-volume');
    const reducedMotion = document.querySelector<HTMLInputElement>('#flow-settings-reduced-motion');
    const signal = runtimeSettingsAbortController.signal;

    volume?.addEventListener(
      'input',
      () => {
        audio.setMasterVolume(Number(volume.value));
        runtimeSettings = { ...runtimeSettings, masterVolume: audio.getMasterVolume() };
        updateRuntimeSettingsUi();
        persistRuntimeSettings();
      },
      { signal }
    );
    reducedMotion?.addEventListener(
      'change',
      () => {
        runtimeSettings = { ...runtimeSettings, reducedMotion: reducedMotion.checked };
        updateRuntimeSettingsUi();
        persistRuntimeSettings();
      },
      { signal }
    );
    updateRuntimeSettingsUi();
  }

  bindRuntimeSettingsControls();

  function enterEndingIfNeeded(): boolean {
    if (!state.gameOver || !flowView) return false;
    if (flowView.getState().screen === 'ending') return true;
    if (flowView.getState().overlay !== null) flowView.dispatch({ type: 'close-overlay' });
    flowView.dispatch({ type: 'show-ending' });
    return flowView.getState().screen === 'ending';
  }

  function clearLegacyAttentionSurfaces(): void {
    locationSelectionActive = false;
    interactionPanel = { kind: 'none' };
    layers.showInv = false;
    cultivationPanelVisible = false;
    paused = false;
    furnace.visible = false;
    layers.cultivation.visible = false;
    hideDialogue(layers);
    hidePanelItemPreview(layers);
    hideLocationPreview(layers);
    hideTodayBriefing(layers);
  }

  function resetRuntimeState(nextState: GameState): void {
    state = nextState;
    ctx = createSimContextFromState(state, reg, DEFAULT_BALANCE);
    npcNameToId = new Map(getNpcList(state).map(npc => [npc.displayName, npc.id] as const));
    furnaceHeat = 50;
    layers.furnaceHeat = furnaceHeat;
    hotbarIdx = 0;
    tradeIdx = 0;
    shopIdx = 0;
    npcIdx = 0;
    shipIdx = 0;
    qualityShipIdx = 0;
    storageDepositIdx = 0;
    storageWithdrawIdx = 0;
    processingIdx = 0;
    facilityCollectIdx = 0;
    farmActionIdx = 0;
    locationIdx = 0;
    locationServiceIdx = 0;
    locationEncounterIdx = 0;
    npcActionIdx = 0;
    facilityBuildIdx = 0;
    recipeIdx = 0;
    dialogueBeat = null;
    clearLegacyAttentionSurfaces();
    refreshHotbarHint();
    refreshHelpHint();
    publicDemoPanels?.render(state, ctx);
  }

  function flowAllowsWorldInput(): boolean {
    return flowView == null || flowView.getPresentation().surface === 'world';
  }

  function setFlowSlotText(slot: string, text: string): void {
    const target = document.querySelector(`[data-app-slot="${slot}"]`);
    if (target && target.textContent !== text) target.textContent = text;
  }

  function updateFlowSurfaceContent(flow: AppFlowState): void {
    if (flow.overlay === 'inventory') {
      const entries = Object.values(state.player.inventory)
        .filter(entry => entry.count > 0)
        .map(entry => `${reg.items.get(entry.itemId)?.displayName ?? entry.itemId} ×${entry.count}`);
      setFlowSlotText('inventory', entries.length > 0 ? entries.join('\n') : '背包还是空的。先从灵田收获第一批材料。');
      return;
    }
    if (flow.overlay === 'map') {
      const locations = locationSummary(state);
      setFlowSlotText('map', locations.length > 0 ? locations.join('\n') : '山谷尚未显露新的去处。');
      return;
    }
    if (flow.overlay === 'cultivation') {
      setFlowSlotText('cultivation', renderCultivationOverview(state, ctx));
      return;
    }
    if (flow.overlay === 'pause') {
      const worldNavigationAvailable = flow.screen === 'world';
      setFlowSlotText('pause', worldNavigationAvailable ? '选择下方页面，或继续返回农庄。关闭菜单后会恢复当前焦点。' : '教学天劫仍在等待本轮决定。此时只能调整设置，或继续返回天劫页面。');
      for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-app-surface="pause"] [data-world-only-command]'))) {
        button.disabled = !worldNavigationAvailable;
        button.setAttribute('aria-disabled', String(!worldNavigationAvailable));
      }
      return;
    }
    if (flow.screen === 'ending') {
      setFlowSlotText('ending', `${t('ending.' + (state.ending ?? ''))}\n第 ${state.day} 日 · ${state.year} 年\n${deriveSaveHealthPresentation(saveHealth).endingStatus}`);
    }
  }

  function handleFlowStateChange(next: AppFlowState, _previous: AppFlowState, event: AppFlowEvent): void {
    if (event.type === 'continue-game' && enterEndingIfNeeded()) return;
    if (event.type === 'start-new-game') {
      clearSave();
      resetRuntimeState(createFreshState());
    } else if (event.type === 'finish-prologue' || event.type === 'skip-prologue') {
      for (const beatId of prologueBeatIds) markSeen(state, beatId);
      dialogueBeat = null;
      saveState(state);
    } else if (event.type === 'open-alchemy') {
      applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
      saveState(state);
    } else if (event.type === 'continue-aftermath') {
      applyAction(state, { kind: 'acknowledge-tutorial-aftermath' }, ctx);
      // V1-L01：战后回世界清教学对白队列，避免残留翻地提示
      dialogueBeat = null;
      saveState(state);
    }

    clearLegacyAttentionSurfaces();
    updateFlowSurfaceContent(next);
    publicDemoPanels?.render(state, ctx);
    if (event.type === 'open-alchemy') flowView?.refocusCurrentSurface();
    requestRender?.();
    refreshAppPresentation();

    if (event.type === 'continue-game') {
      if (state.tutorialTribulation.phase === 'active') {
        flowView?.dispatch({ type: 'start-tribulation' });
      } else if (state.tutorialTribulation.phase === 'aftermath') {
        flowView?.dispatch({ type: 'start-tribulation' });
        flowView?.dispatch({ type: 'finish-tribulation' });
      }
    }
  }

  function openDialogueBeat(beat: NarrativeBeat, assetId?: string): void {
    dialogueBeat = assetId ? { ...beat, assetId } : { ...beat };
  }

  function openRelationshipDialogue(event: { id: string; npcName: string; title: string; lines: readonly string[]; npcId?: string | null }): void {
    dialogueBeat = buildRelationshipDialogueBeat(event, npcNameToId);
  }

  /** 玩家面前的格子 */
  function frontTile(): { x: number; y: number } {
    const p = state.player;
    const dx = p.facing === 'left' ? -1 : p.facing === 'right' ? 1 : 0;
    const dy = p.facing === 'up' ? -1 : p.facing === 'down' ? 1 : 0;
    return { x: p.position.x + dx, y: p.position.y + dy };
  }

  function toast(msg: string, assetId?: string): void {
    setToast(layers, msg, resolvePreviewTexture(renderAssets, assetId));
    requestRender?.();
  }

  function actionLabel(kind: DirectFarmActionKind): string {
    switch (kind) {
      case 'till':
        return '翻地';
      case 'water':
        return '浇水';
      case 'harvest':
        return '收获';
      case 'channel-qi':
        return '供灵';
    }
  }

  function seedLabel(seedId: string): string {
    return reg.items.get(seedId)?.displayName ?? seedId;
  }

  function spawnFarmActionBurst(kind: FarmActionFeedbackKind, affectedTiles: ReadonlyArray<{ x: number; y: number }>): void {
    const style = kind === 'till' ? { color: 0xd8b070, count: 8, speed: 2.1, label: '翻地', labelColor: 0xd8b070 } : kind === 'water' ? { color: 0x7ec8ff, count: 8, speed: 2.4, label: '浇水', labelColor: 0x9ed8ff } : kind === 'harvest' ? { color: 0xffe066, count: 12, speed: 2.8, label: '收获', labelColor: 0xffe066 } : { color: 0x66ddff, count: 10, speed: 2.6, label: '供灵', labelColor: 0x88eeff };
    for (const tile of affectedTiles) {
      const point = screenPointForTile(tile.x, tile.y);
      spawnBurst(layers, point.x, point.y, style.count, style.color, style.speed);
      spawnFloatText(layers, point.x, point.y - 8, style.label, style.labelColor);
    }
    // 轻量世界屏震：收获稍重，浇/翻更克制（纯渲染 juice）
    const shake = kind === 'harvest' ? { frames: 10, mag: 2.2 } : kind === 'till' ? { frames: 7, mag: 1.6 } : { frames: 6, mag: 1.2 };
    triggerShake(layers, shake.frames, shake.mag);
  }

  function performFarmAction(kind: DirectFarmActionKind, at = frontTile()): boolean {
    const blockedReason = farmActionBlockedReason(state, ctx, kind, at);
    const before = snapshotFarmTiles(state);
    const eventStart = state.events.length;
    const objectiveBefore = getPublicDemoObjectiveId(state);
    applyAction(state, { kind, at }, ctx);
    const outcome = deriveFarmActionOutcome(kind, before, snapshotFarmTiles(state));
    const actionEvents = state.events.slice(eventStart);

    if (!outcome.succeeded) {
      const presentation = farmActionBlockedToastPresentation(kind, blockedReason);
      toast(presentation.message, presentation.assetId);
      return false;
    }

    spawnFarmActionBurst(kind, outcome.affectedTiles);
    if (kind === 'till')
      audio.playSfx('till'); // G4: 翻地音效
    else if (kind === 'water') audio.playSfx('water'); // G4: 浇水音效
    if (kind === 'harvest') {
      audio.playSfx('harvest');
      const objectiveAfter = getPublicDemoObjectiveId(state);
      if (objectiveBefore === 'first-harvest' && objectiveAfter === 'journey-alchemy') {
        const milestoneToast = firstHarvestMilestoneToastPresentation(actionEvents, reg, '下一步：打开丹炉，把教学药包炼成首枚避雷丹。');
        if (milestoneToast) {
          toast(milestoneToast.message, milestoneToast.assetId);
          return true;
        }
      }
    }
    if (kind === 'water') {
      const toolToast = toolFeedbackToastPresentation(actionEvents, farmsteadRootContextAssetId(state));
      if (toolToast) toast(toolToast.message, toolToast.assetId);
      else if (!tryToastOnboardingSecondWaterCompletion()) {
        const presentation = farmActionSuccessToastPresentation('water');
        toast(presentation.message, presentation.assetId);
      }
      return true;
    }
    const toolToast = toolFeedbackToastPresentation(actionEvents, farmsteadRootContextAssetId(state));
    if (toolToast) toast(toolToast.message, toolToast.assetId);
    else {
      const presentation = farmActionSuccessToastPresentation(kind);
      toast(presentation.message, presentation.assetId);
    }
    return true;
  }

  function locationSelectionHint(): string {
    return '空格/E/回车执行·Esc返回';
  }

  function confirmHint(verb = '执行'): string {
    return `空格/E/回车${verb}·Esc返回`;
  }

  function refreshHotbarHint(): void {
    setHotbar(layers, hotbarStatusText(hotbarIdx, seedLabel, actionLabel));
  }

  function currentHelpText(): string {
    if (state.postAscension.mode === 'choice-pending') return t('ui.help.ascensionChoice');
    if (paused) return t('ui.help.pause');
    if (dialogueBeat) return t('ui.help.dialogue');
    if (locationSelectionActive) return t('ui.help.location');
    if (layers.showInv) return t('ui.help.inventory');
    if (cultivationPanelVisible) return t('ui.help.cultivation');

    switch (interactionPanel.kind) {
      case 'farm-action':
        return t('ui.help.farmAction');
      case 'npc-action':
        return t('ui.help.npcAction');
      case 'build':
        return t('ui.help.build');
      case 'upgrade':
        return t('ui.help.upgrade');
      case 'storage':
        return t('ui.help.storage');
      case 'shipping':
        return t('ui.help.shipping');
      case 'processing':
        return t('ui.help.processing');
      case 'facility-collect':
        return t('ui.help.facilityCollect');
      case 'shop':
        return t('ui.help.shop');
      case 'trade':
        return t('ui.help.trade');
      case 'festival':
        return t('ui.help.festival');
      case 'commission':
        return t('ui.help.commission');
      case 'tea-shed':
        return t('ui.help.teaShed');
      case 'greenhouse':
        return t('ui.help.greenhouse');
      default:
        return '方向移动 · 空格/E 行动 · Z 播种 · X 浇水 · Space/Q 切换热栏 · 1-0 直选 · M 农庄 · I 背包 · L 地点 · U 丹炉 · P 暂停';
    }
  }

  function currentOnboardingHelpText(): string {
    const objectiveId = getPublicDemoObjectiveId(state);
    if (!isJourneyTeachingActive(objectiveId)) {
      const guide = buildJourneyGuide(objectiveId);
      return `当前目标：${guide.currentAction}。\n意义：${guide.motivation}。\n回报：教学纵切片已完成，可按自由节奏经营农庄。\n操作：${guide.cta}。`;
    }
    if (objectiveId != null && objectiveId.startsWith('journey-')) {
      const guide = buildJourneyGuide(objectiveId);
      return `当前目标：${guide.currentAction}。\n意义：${guide.motivation}。\n回报：完成当前阶段会推进灵草、炼丹、引劫与战后成长的四段闭环。\n操作：${guide.cta}。`;
    }
    return onboardingHelpText(getOnboardingObjectiveId(state));
  }

  function currentSemanticWorldAttention(): SemanticWorldAttention {
    if (dialogueBeat) return { panel: '对话', objective: '阅读当前对话', actions: currentHelpText() };
    if (locationSelectionActive) return { panel: '地点目录', objective: '选择地点与服务', actions: currentHelpText() };
    if (layers.showInv) return { panel: '背包', objective: '查看随身物品', actions: currentHelpText() };
    if (cultivationPanelVisible) return { panel: '修行', objective: '查看体魄与备劫状态', actions: currentHelpText() };
    const panel = interactionPanelSemanticLabel(interactionPanel) ?? '交互面板';
    return { panel, objective: `使用${panel}`, actions: currentHelpText() };
  }

  function currentJourneyBriefing(): { title: string; body: string; compactBody: string; assetId?: string } {
    const guide = buildJourneyGuide(getPublicDemoObjectiveId(state));
    const legacy = buildTodayBriefing(state, ctx, currentOnboardingHelpText());
    return {
      title: guide.progressLabel,
      // Full body for a11y/debug — info is never deleted (ISSUE-002 progressive disclosure).
      body: formatJourneyGuideBody(guide, 'full'),
      compactBody: formatJourneyGuideBody(guide, 'compact'),
      assetId: legacy.assetId
    };
  }

  function refreshHelpHint(): void {
    setTextIfChanged(layers.help, currentHelpText());
  }

  function syncAppPresentation(): void {
    flowView?.setWorldAttention({
      dialogueActive: dialogueBeat !== null,
      panelActive: interactionPanelActive(interactionPanel) || layers.showInv || cultivationPanelVisible,
      locationActive: locationSelectionActive
    });
    const flow = flowView?.getState() ?? null;
    const presentation = flowView?.getPresentation() ?? null;
    const worldHudVisible = presentation?.mode === 'world';
    const commandBar = document.querySelector<HTMLElement>('#world-command-bar');
    if (commandBar) commandBar.hidden = !worldHudVisible;
    const objectiveRail = document.querySelector<HTMLElement>('#objective-rail');
    if (objectiveRail) objectiveRail.hidden = !worldHudVisible;

    const semanticWorldActive = presentation?.surface === 'world';
    const semanticJourney = semanticWorldActive && presentation.mode === 'world' ? buildJourneyGuide(getPublicDemoObjectiveId(state)) : undefined;
    const alchemyHeat = presentation?.surface === 'alchemy' ? Number(document.querySelector<HTMLInputElement>('#flow-alchemy-heat')?.value ?? 47) : 47;
    responsiveShell?.updateSemanticState(
      deriveSemanticGameState({
        presentation,
        worldStatus: `第 ${state.day} 日，${seasonShort[state.season]}季第 ${state.seasonDay} 日。气血 ${Math.round(state.player.hp / 1000)}，体力 ${Math.round(state.player.stamina / 1000)}。`,
        announcement: String(layers.toast.text),
        journey: semanticJourney,
        worldAttention: semanticWorldActive && presentation.mode !== 'world' ? currentSemanticWorldAttention() : undefined,
        pauseWorldNavigationAvailable: flow?.screen === 'world',
        alchemy: presentation?.surface === 'alchemy' ? buildPublicDemoAlchemyView(state, ctx, alchemyHeat) : undefined,
        tribulation: presentation?.surface === 'tribulation' ? buildPublicDemoTribulationView(state) : undefined,
        aftermath: presentation?.surface === 'aftermath' ? buildPublicDemoAftermathView(state) : undefined,
        saveHealth
      })
    );
  }

  function publishDebugSnapshot(): void {
    const target = window as typeof window & {
      __AEON_DEBUG__?: {
        debugSchemaVersion: number;
        buildRevision: string;
        flowScreen: string;
        flowOverlay: string | null;
        uiMode: string;
        appSurface: string;
        renderFrameCount: number;
        viewportProfile: string;
        canvasBounds: { x: number; y: number; width: number; height: number } | null;
        worldBounds: { x: number; y: number; width: number; height: number } | null;
        objectiveRailBounds: { x: number; y: number; width: number; height: number } | null;
        hotbarIdx: number;
        hotbarSlotKind: HotbarSlotKind;
        hotbarSeedId: string | null;
        locationIdx: number;
        locationServiceIdx: number;
        locationSelectionActive: boolean;
        interactionPanelKind: string;
        farmActionKind: FarmActionKind;
        dialogueBeatId: string | null;
        selectedLocationId: string | null;
        selectedLocationServiceCommand: string | null;
        postAscensionMode: string;
        paused: boolean;
        inventoryVisible: boolean;
        cultivationPanelVisible: boolean;
        shopIdx: number;
        tradeIdx: number;
        day: number;
        season: string;
        seasonDay: number;
        playerHp: number;
        playerStamina: number;
        playerX: number;
        playerY: number;
        playerFacing: Direction;
        tutorialTribulationPhase: string;
        tutorialBoltIndex: number;
        tutorialBoltCount: number;
        tutorialWarnedTileId: number | null;
        tutorialWarnedX: number | null;
        tutorialWarnedY: number | null;
        tutorialHitsBlocked: number;
        tutorialPerfectBlockAvailable: boolean;
        tutorialPillCount: number;
        tutorialWardMitigation: number;
        tutorialOutcome: string | null;
        tutorialRewardMilli: number;
        frontTileX: number;
        frontTileY: number;
        frontTileTilled: boolean;
        frontTileCropId: string | number | null;
        frontTileCropStage: string | null;
        frontTileCropGrowth: number;
        frontTileWateredToday: boolean;
        frontTileMoisture: number;
        onboardingObjectiveId: string | null;
        helpText: string;
        renderedHelpText: string;
        dialogueBackdropVisible: boolean;
        todayBriefingVisible: boolean;
        panelPreviewVisible: boolean;
        locationPreviewVisible: boolean;
        todayBriefingTitle: string;
        todayBriefingBody: string;
        todayBriefingAssetId: string | null;
        starterMosslingSeedCount: number;
        starterDewrootSeedCount: number;
        starterMosslingHerbCount: number;
        starterDewrootHerbCount: number;
        starterSpiritStoneCount: number;
        inventoryItemCount: number;
        shippingItemId: string | null;
        shippingBinItemCount: number;
      };
      __AEON_TEST__?: {
        configureSowKeypoint: () => boolean;
        matureFrontCrop: () => boolean;
        waterFrontCrop: () => boolean;
        buyMosslingSeed: () => boolean;
        closePanels: () => void;
        advanceOneDay: () => void;
      };
    };
    const locations = getActiveLocationDirectory(state);
    const hotbarSlot = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    const selectedLocation = locations.length > 0 ? (locations[locationIdx % locations.length] ?? null) : null;
    const services = selectedLocation ? getLocationServiceOptions(state, selectedLocation.id) : [];
    const selectedService = services.length > 0 ? (services[locationServiceIdx % services.length] ?? null) : null;
    const helpText = currentOnboardingHelpText();
    const briefing = state.gameOver ? null : currentJourneyBriefing();
    const ft = frontTile();
    const front = tileAt(state, ft.x, ft.y);
    const frontCrop = front?.cropId != null ? (state.crops.get(front.cropId) ?? state.crops.get(front.id) ?? null) : null;
    const shippingChoices = interactionPanel.kind === 'shipping' ? (interactionPanel.mode === 'normal' ? normalShipChoices() : qualityShipChoices()) : [];
    const selectedShippingChoice = interactionPanel.kind === 'shipping' ? (interactionPanel.mode === 'normal' ? (shippingChoices[normalizeSelection(shipIdx, shippingChoices.length)] ?? null) : (shippingChoices[normalizeSelection(qualityShipIdx, shippingChoices.length)] ?? null)) : null;
    const flow = flowView?.getState() ?? null;
    const presentation = flowView?.getPresentation() ?? null;
    const viewportLayout = computeViewportLayout({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      touchCapable: navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    });
    target.__AEON_DEBUG__ = {
      debugSchemaVersion: 2,
      buildRevision: BUILD_REVISION,
      flowScreen: flow?.screen ?? 'boot',
      flowOverlay: flow?.overlay ?? null,
      uiMode: presentation?.mode ?? 'loading',
      appSurface: presentation?.surface ?? 'loading',
      renderFrameCount: renderScheduler?.snapshot().frameCount ?? 0,
      viewportProfile: viewportLayout.profile,
      canvasBounds: viewportLayout.canvas,
      worldBounds: viewportLayout.regions?.world ?? null,
      objectiveRailBounds: viewportLayout.regions?.objectiveRail ?? null,
      hotbarIdx,
      hotbarSlotKind: hotbarSlot.kind,
      hotbarSeedId: hotbarSlot.kind === 'seed' ? (hotbarSlot.seedId ?? null) : null,
      locationIdx,
      locationServiceIdx,
      locationSelectionActive,
      interactionPanelKind: interactionPanel.kind,
      farmActionKind: FARM_ACTION_ORDER[normalizeSelection(farmActionIdx, FARM_ACTION_ORDER.length)] ?? FARM_ACTION_ORDER[0]!,
      dialogueBeatId: dialogueBeat?.id ?? null,
      selectedLocationId: selectedLocation?.id ?? null,
      selectedLocationServiceCommand: selectedService?.command ?? null,
      postAscensionMode: state.postAscension.mode,
      paused: paused || flow?.overlay === 'pause',
      inventoryVisible: layers.showInv || flow?.overlay === 'inventory',
      cultivationPanelVisible: cultivationPanelVisible || flow?.overlay === 'cultivation',
      shopIdx,
      tradeIdx,
      day: state.day,
      season: state.season,
      seasonDay: state.seasonDay,
      playerHp: state.player.hp,
      playerStamina: state.player.stamina,
      playerX: state.player.position.x,
      playerY: state.player.position.y,
      playerFacing: state.player.facing,
      tutorialTribulationPhase: state.tutorialTribulation.phase,
      tutorialBoltIndex: state.tutorialTribulation.boltIndex,
      tutorialBoltCount: TUTORIAL_TRIBULATION_BOLT_COUNT,
      tutorialWarnedTileId: state.tutorialTribulation.warnedTileId,
      tutorialWarnedX: (() => {
        const warnedId = state.tutorialTribulation.warnedTileId;
        if (warnedId == null) return null;
        return state.tiles.find(entry => entry.id === warnedId)?.x ?? null;
      })(),
      tutorialWarnedY: (() => {
        const warnedId = state.tutorialTribulation.warnedTileId;
        if (warnedId == null) return null;
        return state.tiles.find(entry => entry.id === warnedId)?.y ?? null;
      })(),
      tutorialHitsBlocked: state.tutorialTribulation.hits.blocked,
      tutorialPerfectBlockAvailable: (() => {
        const warnedId = state.tutorialTribulation.warnedTileId;
        if (state.tutorialTribulation.phase !== 'active' || warnedId == null) return false;
        const tile = state.tiles.find(entry => entry.id === warnedId);
        if (!tile) return false;
        return Math.max(Math.abs(state.player.position.x - tile.x), Math.abs(state.player.position.y - tile.y)) <= 1;
      })(),
      tutorialPillCount: itemCount(state.player, 'pill.ward-basic'),
      tutorialWardMitigation: state.player.wardMitigation,
      tutorialOutcome: state.tutorialTribulation.outcome,
      tutorialRewardMilli: state.tutorialTribulation.rewardMilli,
      frontTileX: ft.x,
      frontTileY: ft.y,
      frontTileTilled: front?.tilled ?? false,
      frontTileCropId: front?.cropId ?? null,
      frontTileCropStage: frontCrop?.stage ?? null,
      frontTileCropGrowth: frontCrop?.growth ?? 0,
      frontTileWateredToday: front?.wateredToday ?? false,
      frontTileMoisture: front?.moisture ?? 0,
      onboardingObjectiveId: getPublicDemoObjectiveId(state),
      helpText,
      renderedHelpText: String(layers.help.text),
      dialogueBackdropVisible: layers.dialogueBg.visible,
      todayBriefingVisible: layers.briefing.visible,
      panelPreviewVisible: layers.panelPreviewText.visible,
      locationPreviewVisible: layers.locationPreviewText.visible,
      todayBriefingTitle: briefing?.title ?? '',
      todayBriefingBody: briefing?.body ?? '',
      todayBriefingAssetId: briefing?.assetId ?? null,
      starterMosslingSeedCount: itemCount(state.player, 'seed.mossling'),
      starterDewrootSeedCount: itemCount(state.player, 'seed.dewroot'),
      starterMosslingHerbCount: itemCount(state.player, 'herb.mossling'),
      starterDewrootHerbCount: itemCount(state.player, 'herb.dewroot'),
      starterSpiritStoneCount: itemCount(state.player, 'item.spirit-stone'),
      inventoryItemCount: Object.values(state.player.inventory).reduce((total, slot) => total + slot.count, 0),
      shippingItemId: selectedShippingChoice?.itemId ?? null,
      shippingBinItemCount: Object.values(state.shippingBin).reduce((total, count) => total + count, 0)
    };
  }

  function refreshAppPresentation(): void {
    syncAppPresentation();
    publishDebugSnapshot();
  }

  function installPlaywrightTestHooks(): void {
    if (import.meta.env.VITE_PRESERVE_DRAWING_BUFFER !== 'true') return;
    const target = window as typeof window & {
      __AEON_TEST__?: {
        configureSowKeypoint: () => boolean;
        matureFrontCrop: () => boolean;
        waterFrontCrop: () => boolean;
        buyMosslingSeed: () => boolean;
        closePanels: () => void;
        advanceOneDay: () => void;
      };
    };
    target.__AEON_TEST__ = {
      configureSowKeypoint: () => {
        const targetTile = state.tiles.find(tile => tile.y > 0 && tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore') ?? null;
        if (!targetTile) return false;

        for (const tile of state.tiles) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.tilled = false;
          tile.wateredToday = false;
          tile.channeledToday = false;
        }

        targetTile.tilled = true;
        for (const beatId of [...prologueBeatIds, 'first-till']) markSeen(state, beatId);
        state.player.position = { x: targetTile.x, y: targetTile.y - 1 };
        state.player.facing = 'down';
        state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: Math.max(itemCount(state.player, 'seed.mossling'), 1) };
        hotbarIdx = 0;
        interactionPanel = { kind: 'none' };
        locationSelectionActive = false;
        cultivationPanelVisible = false;
        layers.cultivation.visible = false;
        layers.showInv = false;
        paused = false;
        dialogueBeat = null;
        hideDialogue(layers);
        saveState(state);
        refreshAppPresentation();
        return getPublicDemoObjectiveId(state) === 'first-sow' && tileAt(state, targetTile.x, targetTile.y)?.cropId == null;
      },
      matureFrontCrop: () => {
        const ft = frontTile();
        let tile = tileAt(state, ft.x, ft.y);
        if (!tile?.cropId) return false;
        for (let i = 0; i < 16; i += 1) {
          const crop = state.crops.get(tile.cropId) ?? state.crops.get(tile.id);
          if (crop?.stage === 'mature') {
            saveState(state);
            refreshAppPresentation();
            return true;
          }
          if (!tile.wateredToday) applyAction(state, { kind: 'water', at: ft }, ctx);
          advanceDay(state, ctx);
          tile = tileAt(state, ft.x, ft.y);
          if (!tile?.cropId) break;
        }
        saveState(state);
        refreshAppPresentation();
        return false;
      },
      waterFrontCrop: () => {
        const front = frontTile();
        const frontCandidate = tileAt(state, front.x, front.y);
        const fallbackCandidate = Array.from(state.tiles.values()).find(tile => tile.cropId != null && !tile.wateredToday) ?? null;
        const ft = frontCandidate?.cropId != null ? front : fallbackCandidate ? { x: fallbackCandidate.x, y: fallbackCandidate.y } : front;
        const before = tileAt(state, ft.x, ft.y);
        const wasWatered = before?.wateredToday ?? false;
        const previousMoisture = before?.moisture ?? 0;
        applyAction(state, { kind: 'water', at: ft }, ctx);
        const after = tileAt(state, ft.x, ft.y);
        const watered = after?.cropId != null && ((after.wateredToday && !wasWatered) || after.moisture > previousMoisture);
        saveState(state);
        refreshAppPresentation();
        return watered;
      },
      buyMosslingSeed: () => {
        const result = buyShopItem(state, 'seed.mossling', 1);
        if (!result.ok) {
          refreshAppPresentation();
          return false;
        }
        interactionPanel = { kind: 'none' };
        focusOwnedSeedHotbar('seed.mossling');
        saveState(state);
        refreshAppPresentation();
        return true;
      },
      closePanels: () => {
        interactionPanel = { kind: 'none' };
        locationSelectionActive = false;
        cultivationPanelVisible = false;
        layers.cultivation.visible = false;
        layers.showInv = false;
        saveState(state);
        refreshAppPresentation();
      },
      advanceOneDay: () => {
        state.events.length = 0;
        advanceDay(state, ctx);
        saveState(state);
        refreshAppPresentation();
      }
    };
  }

  installPlaywrightTestHooks();

  function activateLocationSelection(prefix: '地点' | '服务'): void {
    applyPreferredLocationSelection();
    interactionPanel = { kind: 'none' };
    locationSelectionActive = true;
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) {
      const presentation = locationDirectoryEmptyToastPresentation(farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const location = locations[locationIdx % locations.length]!;
    const services = getLocationServiceOptions(state, location.id);
    const selectedService = services.length > 0 ? (services[locationServiceIdx % services.length] ?? null) : null;
    const presentation = locationSelectionToastPresentation(prefix, location, selectedService, locationSelectionHint(), locationPreviewFocusReason(state, getOnboardingObjectiveId(state), location.id, selectedService?.command ?? null, getLocationEncounters(state, location.id).length), formatLocationActionSignalLine(state, location.id), location.id === 'farmstead' && selectedService?.command === 'show-farm-work' ? farmsteadRootContextAssetId(state) : undefined);
    toast(presentation.message, presentation.assetId);
  }

  function clearLocationSelection(showToast: boolean): void {
    if (!locationSelectionActive) return;
    const assetIdOverride = locationSelectionContextAssetId();
    locationSelectionActive = false;
    if (showToast) {
      const presentation = overlayToastPresentation('exit-location-selection', assetIdOverride);
      toast(presentation.message, presentation.assetId);
    }
  }

  function clearInteractionPanel(showToast: boolean): void {
    if (!interactionPanelActive(interactionPanel)) return;
    const assetIdOverride = interactionPanelCloseAssetId(interactionPanel);
    interactionPanel = { kind: 'none' };
    if (showToast) {
      const presentation = overlayToastPresentation('exit-interaction-panel', assetIdOverride);
      toast(presentation.message, presentation.assetId);
    }
  }

  function interactionPanelCloseAssetId(panel: InteractionPanelState): string | undefined {
    switch (panel.kind) {
      case 'storage':
        return farmsteadRootContextAssetId(state);
      case 'shipping':
        return farmsteadRootContextAssetId(state);
      case 'processing':
        switch (panel.mode) {
          case 'drying':
            return 'facility.drying-rack';
          case 'sealing':
            return 'facility.sealing-cabinet';
          case 'furnace':
            return 'facility.talisman-furnace';
        }
      case 'facility-collect':
      case 'build':
      case 'upgrade':
      case 'farm-action':
        return farmsteadRootContextAssetId(state);
      case 'commission':
        return state.postAscension.mode === 'stayed-in-world' ? 'loc.ruin-gate' : 'loc.valley-market';
      case 'tea-shed':
        return 'loc.tea-shed';
      case 'greenhouse':
        return 'loc.greenhouse';
      case 'festival':
        return 'loc.festival-ground';
      case 'shop':
      case 'trade':
        return 'loc.valley-market';
      case 'npc-action':
      case 'npc':
      case 'none':
      default:
        return undefined;
    }
  }

  function locationSelectionContextAssetId(): string | undefined {
    const locations = getActiveLocationDirectory(state);
    const location = locations.length > 0 ? (locations[locationIdx % locations.length] ?? null) : null;
    if (!location) return undefined;
    const services = getLocationServiceOptions(state, location.id);
    const selectedService = services.length > 0 ? (services[locationServiceIdx % services.length] ?? null) : null;
    if (!selectedService) return locationPreviewAssetId(location.id);
    if (location.id === 'farmstead' && selectedService.command === 'show-farm-work') {
      return farmsteadRootContextAssetId(state);
    }
    if (selectedService.command === 'show-processing' && location.id !== 'farmstead') {
      return 'loc.drying-yard';
    }
    if (selectedService.command === 'show-arrays' && location.id !== 'farmstead') {
      return 'loc.array-shed';
    }
    if (location.id === 'farmstead' && (selectedService.command === 'show-processing' || selectedService.command === 'show-arrays')) {
      return 'loc.farmstead';
    }
    return locationServiceActorAssetId(selectedService.command) ?? locationPreviewAssetId(location.id);
  }

  function pauseOverlayAssetId(): string | undefined {
    if (interactionPanelActive(interactionPanel)) {
      return interactionPanelCloseAssetId(interactionPanel);
    }
    if (locationSelectionActive) {
      return locationSelectionContextAssetId();
    }
    if (layers.showInv) {
      return inventoryOverlayAssetId();
    }
    if (cultivationPanelVisible) {
      return farmsteadRootContextAssetId(state);
    }
    return undefined;
  }

  function inventoryOverlayAssetId(): string | undefined {
    const preview = inventoryPreviewSelection(state, reg);
    if (preview?.panelAssetId) return preview.panelAssetId;
    return farmsteadRootContextAssetId(state);
  }

  function togglePause(showToast: boolean): void {
    paused = !paused;
    if (showToast) {
      const presentation = overlayToastPresentation(paused ? 'pause' : 'resume', pauseOverlayAssetId());
      toast(presentation.message, presentation.assetId);
    }
  }

  function toggleInventoryVisibility(): void {
    cultivationPanelVisible = false;
    layers.cultivation.visible = false;
    layers.showInv = !layers.showInv;
    {
      const presentation = overlayToastPresentation(layers.showInv ? 'open-inventory' : 'close-inventory', inventoryOverlayAssetId());
      toast(presentation.message, presentation.assetId);
    }
  }

  function refreshCultivationPanel(): void {
    setTextIfChanged(layers.cultivation, renderCultivationOverview(state, ctx));
  }

  function toggleCultivationPanel(): void {
    layers.showInv = false;
    cultivationPanelVisible = !cultivationPanelVisible;
    if (cultivationPanelVisible) {
      refreshCultivationPanel();
      layers.cultivation.visible = true;
      {
        const presentation = cultivationPanelToastPresentation(true, farmsteadRootContextAssetId(state));
        toast(presentation.message, presentation.assetId);
      }
      return;
    }
    layers.cultivation.visible = false;
    {
      const presentation = cultivationPanelToastPresentation(false, farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
    }
  }

  function setHotbarIndex(nextIdx: number, showToast: boolean): void {
    hotbarIdx = cycleHotbarIndex(nextIdx, 0);
    refreshHotbarHint();
    if (showToast) {
      const presentation = hotbarToastPresentation(hotbarIdx, seedLabel, actionLabel);
      toast(presentation.message, presentation.assetId);
    }
  }

  function cycleHotbar(delta: number, showToast: boolean): void {
    setHotbarIndex(cycleHotbarIndex(hotbarIdx, delta), showToast);
  }

  function isModifierOnlyKey(key: string): boolean {
    return key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta';
  }

  function pickSeedHotbarForSow(): number | null {
    const current = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    if (current.kind === 'seed' && current.seedId && itemCount(state.player, current.seedId) > 0) return hotbarIdx;
    return findNextOwnedSeedHotbarIndex(hotbarIdx, 1, seedId => itemCount(state.player, seedId));
  }

  function focusOwnedSeedHotbar(seedId: string): boolean {
    const preferredIdx = ownedSeedHotbarIndex(seedId, id => itemCount(state.player, id));
    if (preferredIdx != null) {
      setHotbarIndex(preferredIdx, false);
      return true;
    }
    const fallbackIdx = findNextOwnedSeedHotbarIndex(hotbarIdx, 1, id => itemCount(state.player, id));
    if (fallbackIdx == null) return false;
    setHotbarIndex(fallbackIdx, false);
    return true;
  }

  function focusWaterHotbar(): void {
    setHotbarIndex(1, false);
  }

  function tryToastOnboardingSecondWaterCompletion(): boolean {
    if (!state.player.flags.has(FIRST_SECOND_WATER_FLAG)) return false;
    state.player.flags.delete(FIRST_SECOND_WATER_FLAG);
    const presentation = onboardingSecondWaterCompletionToastPresentation();
    toast(presentation.message, presentation.assetId);
    return true;
  }

  function toastOnboardingAdvance(objectiveBefore: ReturnType<typeof getOnboardingObjectiveId>): void {
    if (!isJourneyTeachingActive(getPublicDemoObjectiveId(state))) return;
    const objectiveAfter = getOnboardingObjectiveId(state);
    if (!objectiveAfter || objectiveAfter === objectiveBefore) return;
    const presentation = onboardingObjectiveAdvanceToastPresentation(objectiveAfter);
    if (presentation) toast(presentation.message, presentation.assetId);
  }

  function tryAutoTillForOnboardingSecondSow(): boolean {
    if (getOnboardingObjectiveId(state) !== 'first-second-sow') return false;
    const tile = tileAt(state, frontTile().x, frontTile().y);
    if (!tile || tile.tilled || tile.cropId != null || tile.blockType !== 'none') return false;
    if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') return false;
    applyAction(state, { kind: 'till', at: frontTile() }, ctx);
    audio.playSfx('till');
    return true;
  }

  function performSowAction(seedId: string, switched: boolean, at = frontTile()): boolean {
    const blockedReason = farmActionBlockedReason(state, ctx, 'sow', at, { seedId });
    const before = snapshotFarmTiles(state);
    const objectiveBefore = getOnboardingObjectiveId(state);
    applyAction(state, { kind: 'sow', at, seedId }, ctx);
    const outcome = deriveFarmActionOutcome('sow', before, snapshotFarmTiles(state));

    if (!outcome.succeeded) {
      const presentation = farmActionBlockedToastPresentation('sow', blockedReason, { seedId });
      toast(presentation.message, presentation.assetId);
      return false;
    }
    audio.playSfx('sow'); // G4: 播种音效
    for (const tile of outcome.affectedTiles) {
      const point = screenPointForTile(tile.x, tile.y);
      spawnBurst(layers, point.x, point.y, 8, 0xa8d070, 2.0);
      spawnFloatText(layers, point.x, point.y - 8, '播种', 0xc8e890);
    }
    triggerShake(layers, 6, 1.3);

    const teachingActive = isJourneyTeachingActive(getPublicDemoObjectiveId(state));
    const objectiveAfter = getOnboardingObjectiveId(state);
    if (teachingActive && objectiveBefore === 'first-second-sow' && objectiveAfter === 'first-second-water') {
      focusWaterHotbar();
      const presentation = sowSuccessToastPresentation({
        seedId,
        seedName: seedLabel(seedId),
        switchedHotbar: switched,
        nextStep: '下一步：顺手浇上这轮新苗。'
      });
      toast(presentation.message, presentation.assetId);
      return true;
    }
    if (teachingActive && objectiveAfter !== objectiveBefore) {
      const nextStep = onboardingObjectiveAdvanceToast(objectiveAfter);
      if (nextStep) {
        const presentation = sowSuccessToastPresentation({
          seedId,
          seedName: seedLabel(seedId),
          switchedHotbar: switched,
          nextStep
        });
        toast(presentation.message, presentation.assetId);
        return true;
      }
    }
    {
      const presentation = sowSuccessToastPresentation({
        seedId,
        seedName: seedLabel(seedId),
        switchedHotbar: switched
      });
      toast(presentation.message, presentation.assetId);
    }
    return true;
  }

  function sowFromHotbarSelection(showSelectionToast: boolean): boolean {
    const sowIdx = pickSeedHotbarForSow();
    if (sowIdx == null) {
      const current = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[4]!;
      const presentation = sowUnavailableToastPresentation({
        seedId: current.kind === 'seed' ? current.seedId : undefined
      });
      toast(presentation.message, presentation.assetId);
      return false;
    }
    const switched = sowIdx !== hotbarIdx;
    if (switched) setHotbarIndex(sowIdx, showSelectionToast);
    const slot = HOTBAR_SLOTS[sowIdx] ?? HOTBAR_SLOTS[4]!;
    const seedId = slot.seedId ?? 'seed.mossling';
    tryAutoTillForOnboardingSecondSow();
    return performSowAction(seedId, switched);
  }

  function performFertilizeAction(at = frontTile(), itemId = 'item.spirit-compost'): boolean {
    const blockedReason = farmActionBlockedReason(state, ctx, 'fertilize', at, { itemId });
    const before = snapshotFarmTiles(state);
    applyAction(state, { kind: 'fertilize', at, itemId }, ctx);
    const outcome = deriveFarmActionOutcome('fertilize', before, snapshotFarmTiles(state));

    if (!outcome.succeeded) {
      const presentation = farmActionBlockedToastPresentation('fertilize', blockedReason, { itemId });
      toast(presentation.message, presentation.assetId);
      return false;
    }

    const presentation = fertilizeSuccessToastPresentation();
    toast(presentation.message, presentation.assetId);
    return true;
  }

  type QualityShipChoice = { itemId: string; quality: CropQuality; count: number };
  const qualityLabel: Record<CropQuality, string> = { mortal: '凡品', spirit: '灵品', treasure: '珍品' };
  const qualityOrder: readonly CropQuality[] = ['mortal', 'spirit', 'treasure'];

  function qualityShipChoices(): QualityShipChoice[] {
    return qualityOrder.flatMap(quality => {
      const batch = state.player.qualityInventory?.[quality] ?? {};
      return Object.entries(batch)
        .filter(([, count]) => count > 0)
        .map(([itemId, count]) => ({ itemId, quality, count }));
    });
  }

  function describeQualityChoice(choice: QualityShipChoice): string {
    const name = reg.items.get(choice.itemId)?.displayName ?? choice.itemId;
    return `${name}·${qualityLabel[choice.quality]}×${choice.count}`;
  }

  type StorageChoice = { itemId: string; count: number; quality?: CropQuality };

  function storageDepositChoices(): StorageChoice[] {
    const normal = Object.entries(state.player.inventory)
      .filter(([, slot]) => (slot?.count ?? 0) > 0)
      .map(([itemId, slot]) => ({ itemId, count: slot.count }));
    const quality = qualityOrder.flatMap(q => {
      const batch = state.player.qualityInventory?.[q] ?? {};
      return Object.entries(batch)
        .filter(([, count]) => count > 0)
        .map(([itemId, count]) => ({ itemId, count, quality: q }));
    });
    return [...normal, ...quality];
  }

  function storageWithdrawChoices(): StorageChoice[] {
    const normal = Object.entries(state.storage.inventory)
      .filter(([, slot]) => (slot?.count ?? 0) > 0)
      .map(([itemId, slot]) => ({ itemId, count: slot.count }));
    const quality = qualityOrder.flatMap(q => {
      const batch = state.storage.qualityInventory?.[q] ?? {};
      return Object.entries(batch)
        .filter(([, count]) => count > 0)
        .map(([itemId, count]) => ({ itemId, count, quality: q }));
    });
    return [...normal, ...quality];
  }

  function describeStorageChoice(choice: StorageChoice): string {
    const name = reg.items.get(choice.itemId)?.displayName ?? choice.itemId;
    const q = choice.quality ? `·${qualityLabel[choice.quality]}` : '';
    return `${name}${q}×${choice.count}`;
  }

  function openStoragePanel(mode: 'deposit' | 'withdraw'): void {
    const choices = mode === 'deposit' ? storageDepositChoices() : storageWithdrawChoices();
    if (choices.length === 0) {
      const presentation = storageUnavailableToastPresentation(mode);
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'storage', mode };
    if (mode === 'deposit') {
      storageDepositIdx = normalizeSelection(storageDepositIdx, choices.length);
      const choice = choices[storageDepositIdx]!;
      const presentation = storageToastPresentation('deposit', choice, selectionLabel(storageDepositIdx, choices.length), confirmHint('存入'), reg);
      toast(presentation.message, presentation.assetId);
      return;
    }
    storageWithdrawIdx = normalizeSelection(storageWithdrawIdx, choices.length);
    const choice = choices[storageWithdrawIdx]!;
    const presentation = storageToastPresentation('withdraw', choice, selectionLabel(storageWithdrawIdx, choices.length), confirmHint('取出'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function openFarmActionPanel(): void {
    interactionPanel = { kind: 'farm-action' };
    farmActionIdx = normalizeSelection(farmActionIdx, FARM_ACTION_ORDER.length);
    const kind = FARM_ACTION_ORDER[farmActionIdx] ?? FARM_ACTION_ORDER[0]!;
    const presentation = farmActionMenuToastPresentation(kind, selectionLabel(farmActionIdx, FARM_ACTION_ORDER.length), confirmHint('进入'), state, ctx);
    toast(presentation.message, presentation.assetId);
  }

  function preselectFarmActionKind(kind: FarmActionKind): void {
    farmActionIdx = Math.max(0, FARM_ACTION_ORDER.indexOf(kind));
    openFarmActionPanel();
  }

  function npcActionLabel(mode: NpcPanelMode): string {
    switch (mode) {
      case 'browse':
        return '人物浏览';
      case 'gift':
        return '赠礼';
      case 'quest':
        return '人物任务';
    }
  }

  function openNpcActionPanel(): void {
    interactionPanel = { kind: 'npc-action' };
    npcActionIdx = normalizeSelection(npcActionIdx, NPC_ACTION_ORDER.length);
    const mode = NPC_ACTION_ORDER[npcActionIdx] ?? NPC_ACTION_ORDER[0];
    const presentation = npcActionMenuToastPresentation(mode, selectionLabel(npcActionIdx, NPC_ACTION_ORDER.length), confirmHint('进入'));
    toast(presentation.message, presentation.assetId);
  }

  function preselectNpcAction(mode: NpcPanelMode): void {
    npcActionIdx = Math.max(0, NPC_ACTION_ORDER.indexOf(mode));
    openNpcActionPanel();
  }

  function openFarmActionKind(kind: FarmActionKind): void {
    farmActionIdx = Math.max(0, FARM_ACTION_ORDER.indexOf(kind));
    switch (kind) {
      case 'build':
        openBuildPanel();
        return;
      case 'facility-collect':
        openFacilityCollectPanel();
        return;
      case 'storage-deposit':
        openStoragePanel('deposit');
        return;
      case 'storage-withdraw':
        openStoragePanel('withdraw');
        return;
      case 'processing-drying':
        openProcessingPanel('drying');
        return;
      case 'processing-sealing':
        openProcessingPanel('sealing');
        return;
      case 'processing-furnace':
        openProcessingPanel('furnace');
        return;
      case 'shipping-normal':
        openShippingPanel('normal');
        return;
      case 'shipping-quality':
        openShippingPanel('quality');
        return;
      case 'upgrade':
        openUpgradePanel();
        return;
    }
  }

  function openShippingPanel(mode: 'normal' | 'quality'): void {
    const choices = mode === 'normal' ? normalShipChoices() : qualityShipChoices();
    if (choices.length === 0) {
      const presentation = shippingUnavailableToastPresentation(mode);
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'shipping', mode };
    if (mode === 'normal') {
      shipIdx = normalizeSelection(shipIdx, choices.length);
      const choice = choices[shipIdx] as StorageChoice;
      const presentation = shippingToastPresentation(
        'normal',
        {
          ...choice,
          unitPrice: shippingUnitPrice(ctx, choice.itemId, undefined, state)
        },
        selectionLabel(shipIdx, choices.length),
        confirmHint('出货'),
        reg
      );
      toast(presentation.message, presentation.assetId);
      return;
    }
    qualityShipIdx = normalizeSelection(qualityShipIdx, choices.length);
    const choice = choices[qualityShipIdx] as QualityShipChoice;
    const presentation = shippingToastPresentation(
      'quality',
      {
        ...choice,
        unitPrice: shippingUnitPrice(ctx, choice.itemId, choice.quality, state)
      },
      selectionLabel(qualityShipIdx, choices.length),
      confirmHint('出货'),
      reg
    );
    toast(presentation.message, presentation.assetId);
  }

  function describeFacilityBuildCost(kind: FacilityKind): string {
    return FACILITY_BUILD_COSTS[kind].map(cost => `${reg.items.get(cost.itemId)?.displayName ?? cost.itemId}×${cost.count}`).join('、');
  }

  function describeFacilityExpansionRequirement(kind: FacilityKind): string {
    const requiredTier = FACILITY_EXPANSION_REQUIREMENT[kind];
    return requiredTier <= 0 ? '初始可建' : `农庄扩建${requiredTier}阶解锁`;
  }

  function describeFacilityPlacementRule(kind: FacilityKind): string {
    return facilityPlacementRuleText(kind).replace(/^需建在/, '建于');
  }

  function describeUpgradeCost(upgrade: UpgradeDef): string {
    return upgrade.costs.map(cost => `${reg.items.get(cost.itemId)?.displayName ?? cost.itemId}×${cost.count}`).join('、');
  }

  function buildFacility(kind: FacilityKind): void {
    const ft = frontTile();
    const eventStart = state.events.length;
    applyAction(state, { kind: 'place-facility', at: ft, facilityKind: kind }, ctx);
    const events = state.events.slice(eventStart);
    const placed = events.some(e => e.type === 'facility-place');
    if (placed) {
      const presentation = buildResultToastPresentation(kind, 'success');
      toast(presentation.message, presentation.assetId);
      return;
    }
    const failed = events.find(e => e.type === 'facility-place-failed');
    const payload = failed?.payload as { reason?: string; requiredExpansionTier?: number | null; currentExpansionTier?: number } | undefined;
    if (payload?.requiredExpansionTier != null && payload.currentExpansionTier != null && payload.currentExpansionTier < payload.requiredExpansionTier) {
      const presentation = buildResultToastPresentation(kind, 'failure', `${FACILITY_LABEL[kind]}需农庄扩建${payload.requiredExpansionTier}阶，当前为${payload.currentExpansionTier}阶`);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const presentation = buildResultToastPresentation(kind, 'failure', payload?.reason ?? `需${describeFacilityBuildCost(kind)}，且前方为空地`);
    toast(presentation.message, presentation.assetId);
  }

  function openBuildPanel(): void {
    interactionPanel = { kind: 'build' };
    facilityBuildIdx = normalizeSelection(facilityBuildIdx, facilityBuildChoices.length);
    const kind = facilityBuildChoices[facilityBuildIdx]!;
    const presentation = buildToastPresentation(kind, selectionLabel(facilityBuildIdx, facilityBuildChoices.length), confirmHint('建造'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function openUpgradePanel(): void {
    const upgrades = getAvailableUpgrades(state);
    if (upgrades.length === 0) {
      const presentation = upgradeUnavailableToastPresentation(farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'upgrade' };
    facilityBuildIdx = normalizeSelection(facilityBuildIdx, upgrades.length);
    const upgrade = upgrades[facilityBuildIdx]!;
    const presentation = upgradeToastPresentation(upgrade, selectionLabel(facilityBuildIdx, upgrades.length), confirmHint('升级'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function describeArrayBuildCost(defId: string): string {
    return (ARRAY_BUILD_COSTS[defId] ?? []).map(cost => `${reg.items.get(cost.itemId)?.displayName ?? cost.itemId}×${cost.count}`).join('、') || '无';
  }

  function processingChoices(): StorageChoice[] {
    return storageDepositChoices().filter(choice => reg.herbs.has(choice.itemId));
  }

  type FacilityCollectChoice = { facilityId: number; kind: FacilityKind; label: string; ready: boolean };

  function facilityCollectChoices(): FacilityCollectChoice[] {
    const playerX = state.player.position.x;
    const playerY = state.player.position.y;
    const choices: FacilityCollectChoice[] = [];
    for (const kind of facilityBuildChoices) {
      const facility = adjacentFacility(state, playerX, playerY, kind);
      if (!facility) continue;
      choices.push({ facilityId: facility.id, kind, label: FACILITY_LABEL[kind], ready: facility.job?.daysRemaining === 0 });
    }
    return choices.sort((a, b) => Number(b.ready) - Number(a.ready));
  }

  function openProcessingPanel(mode: 'drying' | 'sealing' | 'furnace'): void {
    interactionPanel = { kind: 'processing', mode };
    if (mode === 'drying') {
      const choices = processingChoices();
      if (choices.length === 0) {
        const presentation = processingUnavailableToastPresentation('drying');
        toast(presentation.message, presentation.assetId);
        return;
      }
      processingIdx = normalizeSelection(processingIdx, choices.length);
      const choice = choices[processingIdx]!;
      const presentation = processingToastPresentation('drying', describeStorageChoice(choice), selectionLabel(processingIdx, choices.length), confirmHint('开始'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    if (mode === 'sealing') {
      const preview = staticProcessingPanelPreview('sealing', reg);
      const presentation = processingToastPresentation('sealing', preview.title, null, confirmHint('开始'), preview.panelAssetId);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const preview = staticProcessingPanelPreview('furnace', reg);
    const presentation = processingToastPresentation('furnace', preview.title, null, confirmHint('开始'), preview.panelAssetId);
    toast(presentation.message, presentation.assetId);
  }

  function openFacilityCollectPanel(): void {
    const choices = facilityCollectChoices();
    if (choices.length === 0) {
      const presentation = facilityCollectUnavailableToastPresentation(farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'facility-collect' };
    facilityCollectIdx = normalizeSelection(facilityCollectIdx, choices.length);
    const choice = choices[facilityCollectIdx]!;
    const presentation = facilityCollectToastPresentation(
      {
        kind: choice.kind,
        ready: choice.ready,
        daysRemaining: state.facilities.get(choice.facilityId)?.job?.daysRemaining ?? null
      },
      selectionLabel(facilityCollectIdx, choices.length),
      confirmHint('收取')
    );
    toast(presentation.message, presentation.assetId);
  }

  function normalShipChoices(): StorageChoice[] {
    return Object.entries(state.player.inventory)
      .filter(([itemId, slot]) => (slot?.count ?? 0) > 0 && canShipItem(ctx, itemId))
      .map(([itemId, slot]) => ({ itemId, count: slot.count }));
  }

  function guardFeedChoices(): StorageChoice[] {
    return Object.entries(state.player.inventory)
      .filter(([itemId, slot]) => (slot?.count ?? 0) > 0 && reg.herbs.has(itemId))
      .map(([itemId, slot]) => ({ itemId, count: slot.count }));
  }

  function openNpcPanel(mode: NpcPanelMode): void {
    const npcs = getNpcList(state);
    if (npcs.length === 0) {
      const presentation = npcUnavailableToastPresentation();
      toast(presentation.message, presentation.assetId);
      return;
    }
    npcIdx = normalizeSelection(npcIdx, npcs.length);
    const npc = npcs[npcIdx]!;
    const schedules = getNpcDailySchedules(state);
    const schedule = schedules.find(entry => entry.npc.id === npc.id);
    const npcQuest = getCurrentNpcQuest(state, npc.id);
    if (mode === 'browse') {
      interactionPanel = { kind: 'npc', mode };
      const itemId = bestGiftItemForNpc(state, npc.id);
      const name = itemId ? (reg.items.get(itemId)?.displayName ?? itemId) : null;
      const presentation = npcBrowseToastPresentation(npc, schedule ?? null, npcQuest, selectionLabel(npcIdx, npcs.length), name);
      toast(presentation.message, presentation.assetId);
      return;
    }
    if (mode === 'gift') {
      interactionPanel = { kind: 'npc', mode };
      const itemId = bestGiftItemForNpc(state, npc.id);
      const name = itemId ? (reg.items.get(itemId)?.displayName ?? itemId) : null;
      const presentation = npcGiftToastPresentation(npc, name, Boolean(schedule?.birthday), selectionLabel(npcIdx, npcs.length), confirmHint(itemId ? '赠礼' : '尝试赠礼'), itemId, reg);
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'npc', mode };
    const presentation = npcQuestToastPresentation(npc, npcQuest, selectionLabel(npcIdx, npcs.length), confirmHint(npcQuest ? '推进' : '尝试领取'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function openFestivalPanel(): void {
    interactionPanel = { kind: 'festival' };
    const presentation = festivalToastPresentation(state, confirmHint('参与'));
    toast(presentation.message, presentation.assetId);
  }

  function participateFestivalWithToast(): void {
    const eventStart = state.events.length;
    applyAction(state, { kind: 'participate-festival' }, ctx);
    const festivalEv = state.events.slice(eventStart).find(e => e.type === 'festival-participate');
    if (festivalEv) {
      const payload = festivalEv.payload as { rewards?: Array<{ itemId: string; count: number }> };
      const presentation = festivalResultToastPresentation(payload.rewards ?? [], reg);
      audio.playSfx('ui');
      toast(presentation.message, presentation.assetId);
      return;
    }
    const presentation = festivalUnavailableToastPresentation(state.activeEvent?.defId?.endsWith('-festival') ? 'already-participated-or-full' : 'no-active-event');
    toast(presentation.message, presentation.assetId);
  }

  function browseTrade(): void {
    const offers = getTradeOffers(state);
    if (offers.length === 0) {
      const presentation = tradeUnavailableToastPresentation('stage-gated');
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'trade' };
    tradeIdx = normalizeSelection(tradeIdx, offers.length);
    const o = offers[tradeIdx]!;
    const presentation = tradeToastPresentation(o, selectionLabel(tradeIdx, offers.length), confirmHint('成交'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function browseShopOrFestivalStall(preferFestival: boolean): void {
    const stallGoods = preferFestival ? getFestivalStallItems(state) : [];
    if (stallGoods.length > 0) {
      interactionPanel = { kind: 'shop', festival: true };
      shopIdx = normalizeSelection(shopIdx, stallGoods.length);
      const item = stallGoods[shopIdx]!;
      const presentation = shopToastPresentation('festival-stall', item, selectionLabel(shopIdx, stallGoods.length), confirmHint('购买'), reg);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const goods = getShopItems(state);
    if (goods.length === 0) {
      const presentation = shopUnavailableToastPresentation('shop');
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'shop', festival: false };
    shopIdx = normalizeSelection(shopIdx, goods.length);
    const item = goods[shopIdx]!;
    const presentation = shopToastPresentation('shop', item, selectionLabel(shopIdx, goods.length), confirmHint('购买'), reg);
    toast(presentation.message, presentation.assetId);
  }

  function selectedPanelItemPreview(): { title: string; details: string; texture?: Texture } | null {
    switch (interactionPanel.kind) {
      case 'shop': {
        const goods = interactionPanel.festival ? getFestivalStallItems(state) : getShopItems(state);
        if (goods.length === 0) return null;
        const item = goods[normalizeSelection(shopIdx, goods.length)]!;
        const preview = shopPanelPreview(interactionPanel.festival ? 'festival-stall' : 'shop', item, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.assetId)
        };
      }
      case 'trade': {
        const offers = getTradeOffers(state);
        if (offers.length === 0) return null;
        const offer = offers[normalizeSelection(tradeIdx, offers.length)]!;
        const preview = tradePanelPreview(offer, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.assetId)
        };
      }
      case 'storage': {
        const choices = interactionPanel.mode === 'deposit' ? storageDepositChoices() : storageWithdrawChoices();
        if (choices.length === 0) return null;
        const idx = interactionPanel.mode === 'deposit' ? normalizeSelection(storageDepositIdx, choices.length) : normalizeSelection(storageWithdrawIdx, choices.length);
        const choice = choices[idx]!;
        const preview = storagePanelPreview(interactionPanel.mode, choice, storageUsed(state.storage), state.storage.capacity, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.assetId)
        };
      }
      case 'shipping': {
        if (interactionPanel.mode === 'normal') {
          const choices = normalShipChoices();
          if (choices.length === 0) return null;
          const choice = choices[normalizeSelection(shipIdx, choices.length)]!;
          const preview = shippingPanelPreview(
            'normal',
            {
              ...choice,
              unitPrice: shippingUnitPrice(ctx, choice.itemId, undefined, state)
            },
            reg
          );
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.assetId)
          };
        }
        const choices = qualityShipChoices();
        if (choices.length === 0) return null;
        const choice = choices[normalizeSelection(qualityShipIdx, choices.length)]!;
        const preview = shippingPanelPreview(
          'quality',
          {
            ...choice,
            unitPrice: shippingUnitPrice(ctx, choice.itemId, choice.quality, state)
          },
          reg
        );
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.assetId)
        };
      }
      case 'processing': {
        if (interactionPanel.mode === 'drying') {
          const choices = processingChoices();
          if (choices.length === 0) return null;
          const choice = choices[normalizeSelection(processingIdx, choices.length)]!;
          const preview = dryingProcessingPanelPreview(choice, reg);
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.iconId, preview.iconId ? renderAssets.itemIcons[preview.iconId] : undefined)
          };
        }
        const preview = staticProcessingPanelPreview(interactionPanel.mode, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.panelAssetId ?? preview.iconId)
        };
      }
      case 'festival': {
        const preview = festivalPanelPreview(state);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId, renderAssets.locations['festival-ground'])
        };
      }
      case 'tea-shed': {
        const preview = teaShedPanelPreview(state);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId, renderAssets.locations['tea-shed'])
        };
      }
      case 'greenhouse': {
        const preview = greenhousePanelPreview(state, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId, renderAssets.locations.greenhouse)
        };
      }
      case 'build': {
        if (facilityBuildChoices.length === 0) return null;
        const kind = facilityBuildChoices[normalizeSelection(facilityBuildIdx, facilityBuildChoices.length)]!;
        const preview = buildPanelPreview(kind, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'upgrade': {
        const upgrades = getAvailableUpgrades(state);
        if (upgrades.length === 0) return null;
        const upgrade = upgrades[normalizeSelection(facilityBuildIdx, upgrades.length)]!;
        const preview = upgradePanelPreview(upgrade, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'facility-collect': {
        const choices = facilityCollectChoices();
        if (choices.length === 0) return null;
        const choice = choices[normalizeSelection(facilityCollectIdx, choices.length)]!;
        const facility = state.facilities.get(choice.facilityId) ?? null;
        const preview = facilityCollectPanelPreview({
          kind: choice.kind,
          ready: choice.ready,
          daysRemaining: facility?.job ? facility.job.daysRemaining : null
        });
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'farm-action': {
        const kind = FARM_ACTION_ORDER[normalizeSelection(farmActionIdx, FARM_ACTION_ORDER.length)]!;
        const preview = farmActionMenuPreview(kind, state, ctx);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'npc-action': {
        const mode = NPC_ACTION_ORDER[normalizeSelection(npcActionIdx, NPC_ACTION_ORDER.length)]!;
        const npcs = getNpcList(state);
        const currentNpc = npcs.length > 0 ? npcs[normalizeSelection(npcIdx, npcs.length)] : null;
        const preview = npcActionMenuPreview(mode, currentNpc?.id);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'npc': {
        const npcs = getNpcList(state);
        if (npcs.length === 0) return null;
        const npc = npcs[normalizeSelection(npcIdx, npcs.length)]!;
        const portraitAssetId = previewNpcPortraitAssetId(npc.id);
        const portraitTexture = portraitAssetId ? renderAssets.npcs[portraitAssetId] : undefined;
        const schedule = getNpcDailySchedules(state).find(entry => entry.npc.id === npc.id) ?? null;
        const npcQuest = getCurrentNpcQuest(state, npc.id);
        if (interactionPanel.mode === 'browse') {
          const itemId = bestGiftItemForNpc(state, npc.id);
          const name = itemId ? (reg.items.get(itemId)?.displayName ?? itemId) : null;
          const preview = npcBrowsePanelPreview(npc, schedule, npcQuest, name);
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId, portraitTexture)
          };
        }
        if (interactionPanel.mode === 'gift') {
          const itemId = bestGiftItemForNpc(state, npc.id);
          const name = itemId ? (reg.items.get(itemId)?.displayName ?? itemId) : null;
          const preview = npcGiftPanelPreview(npc, name, Boolean(schedule?.birthday), itemId, reg);
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId, portraitTexture)
          };
        }
        const preview = npcQuestPanelPreview(npc, npcQuest, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId, portraitTexture)
        };
      }
      case 'commission': {
        if (state.postAscension.mode === 'stayed-in-world') {
          const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
          if (activeOrder) {
            const preview = activeSpecialOrderPanelPreview(activeOrder, reg, '镇守事务', itemCount(state.player, activeOrder.request.itemId));
            return {
              title: preview.title,
              details: preview.details,
              texture: resolvePreviewTexture(renderAssets, preview.assetId)
            };
          }

          const incident = getCurrentStayingWorldIncident(state);
          if (incident && !hasResolvedStayingWorldIncidentForDay(state, state.day)) {
            const preview = stayingWorldIncidentPanelPreview(incident, reg);
            return {
              title: preview.title,
              details: preview.details,
              texture: preview.assetId ? renderAssets.itemIcons[preview.assetId] : undefined
            };
          }

          const commission = getDailyCommission(state);
          if (!commission) return null;
          const preview = dailyCommissionPanelPreview(commission, reg, '镇守差事', itemCount(state.player, commission.request.itemId));
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId)
          };
        }

        const mainline = getCurrentMainlineQuest(state);
        if (mainline) {
          const preview = mainlineQuestPanelPreview(mainline, reg);
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId)
          };
        }

        const ruinChapter = getCurrentRuinChapter(state);
        if (ruinChapter) {
          const preview = ruinChapterPanelPreview(ruinChapter, state.exploration.deepestRuinLevel, reg);
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId)
          };
        }

        const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
        if (activeOrder) {
          const preview = activeSpecialOrderPanelPreview(activeOrder, reg, '特别订单', itemCount(state.player, activeOrder.request.itemId));
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId)
          };
        }

        const specialOrder = getDailySpecialOrder(state);
        if (specialOrder) {
          const preview = dailySpecialOrderPanelPreview(specialOrder, reg, '待接特别订单', itemCount(state.player, specialOrder.request.itemId));
          return {
            title: preview.title,
            details: preview.details,
            texture: resolvePreviewTexture(renderAssets, preview.assetId)
          };
        }

        const commission = getDailyCommission(state);
        if (!commission) return null;
        const preview = dailyCommissionPanelPreview(commission, reg, '公告委托', itemCount(state.player, commission.request.itemId));
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      default:
        break;
    }

    const preview = ambientPanelPreview(state, reg, layers.showInv);
    if (!preview) return null;
    return {
      title: preview.title,
      details: preview.details,
      texture: resolvePreviewTexture(renderAssets, preview.assetId)
    };
  }

  function showCommission(): void {
    interactionPanel = { kind: 'commission' };
    if (state.postAscension.mode === 'stayed-in-world') {
      const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
      if (activeOrder) {
        const presentation = commissionToastPresentation(activeSpecialOrderPanelPreview(activeOrder, reg, '镇守事务'), '镇守告示', confirmHint('提交或领奖'));
        toast(presentation.message, presentation.assetId);
        return;
      }
      const incident = getCurrentStayingWorldIncident(state);
      if (incident && !hasResolvedStayingWorldIncidentForDay(state, state.day)) {
        const presentation = commissionToastPresentation(stayingWorldIncidentPanelPreview(incident, reg), '镇守告示', confirmHint('处置'));
        toast(presentation.message, presentation.assetId);
        return;
      }
      const commission = getDailyCommission(state);
      if (!commission) {
        const presentation = commissionBoardEmptyToastPresentation(true);
        toast(presentation.message, presentation.assetId);
        return;
      }
      const presentation = commissionToastPresentation(dailyCommissionPanelPreview(commission, reg, '镇守差事', itemCount(state.player, commission.request.itemId)), '镇守告示', confirmHint('交付'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const mainline = getCurrentMainlineQuest(state);
    if (mainline) {
      const presentation = commissionToastPresentation(mainlineQuestPanelPreview(mainline, reg), '告示板', confirmHint('推进'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const ruinChapter = getCurrentRuinChapter(state);
    if (ruinChapter) {
      const presentation = commissionToastPresentation(ruinChapterPanelPreview(ruinChapter, state.exploration.deepestRuinLevel, reg), '告示板', confirmHint('推进'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
    if (activeOrder) {
      const presentation = commissionToastPresentation(activeSpecialOrderPanelPreview(activeOrder, reg, '特别订单', itemCount(state.player, activeOrder.request.itemId)), '告示板', confirmHint('提交或领奖'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const specialOrder = getDailySpecialOrder(state);
    if (specialOrder) {
      const presentation = commissionToastPresentation(dailySpecialOrderPanelPreview(specialOrder, reg, '待接特别订单', itemCount(state.player, specialOrder.request.itemId)), '告示板', confirmHint('接取'));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const commission = getDailyCommission(state);
    if (!commission) {
      const presentation = commissionBoardEmptyToastPresentation(false);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const presentation = commissionToastPresentation(dailyCommissionPanelPreview(commission, reg, '公告委托', itemCount(state.player, commission.request.itemId)), '告示板', confirmHint('交付'));
    toast(presentation.message, presentation.assetId);
  }

  function cycleActiveInteractionPanel(reverse: boolean): boolean {
    switch (interactionPanel.kind) {
      case 'farm-action':
        farmActionIdx = cycleSelection(farmActionIdx, FARM_ACTION_ORDER.length, reverse);
        openFarmActionPanel();
        return true;
      case 'npc-action':
        npcActionIdx = cycleSelection(npcActionIdx, NPC_ACTION_ORDER.length, reverse);
        openNpcActionPanel();
        return true;
      case 'none':
        return false;
      case 'build':
        facilityBuildIdx = cycleSelection(facilityBuildIdx, facilityBuildChoices.length, reverse);
        openBuildPanel();
        return true;
      case 'upgrade': {
        const upgrades = getAvailableUpgrades(state);
        if (upgrades.length === 0) {
          const presentation = upgradeUnavailableToastPresentation(farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
          return true;
        }
        facilityBuildIdx = cycleSelection(facilityBuildIdx, upgrades.length, reverse);
        openUpgradePanel();
        return true;
      }
      case 'npc': {
        const npcs = getNpcList(state);
        if (npcs.length === 0) {
          const presentation = npcUnavailableToastPresentation();
          toast(presentation.message, presentation.assetId);
          return true;
        }
        npcIdx = cycleSelection(npcIdx, npcs.length, reverse);
        openNpcPanel(interactionPanel.mode);
        return true;
      }
      case 'festival':
        openFestivalPanel();
        return true;
      case 'trade': {
        const offers = getTradeOffers(state);
        if (offers.length === 0) {
          const presentation = tradeUnavailableToastPresentation('stage-gated');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        tradeIdx = cycleSelection(tradeIdx, offers.length, reverse);
        browseTrade();
        return true;
      }
      case 'shop': {
        const goods = interactionPanel.festival ? getFestivalStallItems(state) : getShopItems(state);
        if (goods.length === 0) {
          const presentation = shopUnavailableToastPresentation(interactionPanel.festival ? 'festival-stall' : 'shop');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        shopIdx = cycleSelection(shopIdx, goods.length, reverse);
        browseShopOrFestivalStall(interactionPanel.festival);
        return true;
      }
      case 'tea-shed':
        openTeaShedPanel();
        return true;
      case 'greenhouse':
        openGreenhousePanel();
        return true;
      case 'commission':
        showCommission();
        return true;
      case 'storage': {
        const choices = interactionPanel.mode === 'deposit' ? storageDepositChoices() : storageWithdrawChoices();
        if (choices.length === 0) {
          const presentation = storageUnavailableToastPresentation(interactionPanel.mode);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        if (interactionPanel.mode === 'deposit') {
          storageDepositIdx = cycleSelection(storageDepositIdx, choices.length, reverse);
        } else {
          storageWithdrawIdx = cycleSelection(storageWithdrawIdx, choices.length, reverse);
        }
        openStoragePanel(interactionPanel.mode);
        return true;
      }
      case 'shipping': {
        const choices = interactionPanel.mode === 'normal' ? normalShipChoices() : qualityShipChoices();
        if (choices.length === 0) {
          const presentation = shippingUnavailableToastPresentation(interactionPanel.mode);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        if (interactionPanel.mode === 'normal') {
          shipIdx = cycleSelection(shipIdx, choices.length, reverse);
        } else {
          qualityShipIdx = cycleSelection(qualityShipIdx, choices.length, reverse);
        }
        openShippingPanel(interactionPanel.mode);
        return true;
      }
      case 'processing': {
        if (interactionPanel.mode !== 'drying') {
          openProcessingPanel(interactionPanel.mode);
          return true;
        }
        const choices = processingChoices();
        if (choices.length === 0) {
          const presentation = processingUnavailableToastPresentation('drying');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        processingIdx = cycleSelection(processingIdx, choices.length, reverse);
        openProcessingPanel('drying');
        return true;
      }
      case 'facility-collect': {
        const choices = facilityCollectChoices();
        if (choices.length === 0) {
          const presentation = facilityCollectUnavailableToastPresentation(farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
          return true;
        }
        facilityCollectIdx = cycleSelection(facilityCollectIdx, choices.length, reverse);
        openFacilityCollectPanel();
        return true;
      }
    }
  }

  function confirmInteractionPanel(): boolean {
    switch (interactionPanel.kind) {
      case 'none':
        return false;
      case 'farm-action': {
        const kind = FARM_ACTION_ORDER[farmActionIdx % FARM_ACTION_ORDER.length] ?? FARM_ACTION_ORDER[0]!;
        openFarmActionKind(kind);
        return true;
      }
      case 'npc-action': {
        const mode = NPC_ACTION_ORDER[npcActionIdx % NPC_ACTION_ORDER.length] ?? NPC_ACTION_ORDER[0];
        openNpcPanel(mode);
        return true;
      }
      case 'build': {
        buildFacility(facilityBuildChoices[facilityBuildIdx % facilityBuildChoices.length]!);
        return true;
      }
      case 'upgrade': {
        const upgrades = getAvailableUpgrades(state);
        if (upgrades.length === 0) {
          const presentation = upgradeUnavailableToastPresentation(farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const upgrade = upgrades[facilityBuildIdx % upgrades.length]!;
        const result = performUpgrade(state, upgrade.id);
        if (result.ok) {
          audio.playSfx('ui');
          const detail = upgrade.inventoryCapacityBonus ? `储物戒容量 ${state.player.inventoryCapacity}` : upgrade.id.startsWith('greenhouse-nursery-') ? '棚温更稳，暖棚养护收益提高' : upgrade.toolStaminaMult ? '农具更省力' : undefined;
          const presentation = upgradeResultToastPresentation(upgrade, 'success', reg, detail);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = upgradeResultToastPresentation(upgrade, 'failure', reg, result.reason ?? upgrade.displayName);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'npc': {
        const npcs = getNpcList(state);
        if (npcs.length === 0) {
          const presentation = npcUnavailableToastPresentation();
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const npc = npcs[npcIdx % npcs.length]!;
        if (interactionPanel.mode === 'browse') {
          openNpcPanel('browse');
          return true;
        }
        if (interactionPanel.mode === 'gift') {
          const itemId = bestGiftItemForNpc(state, npc.id);
          if (!itemId) {
            const presentation = npcGiftResultToastPresentation(npc, 'failure', null, false);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const eventStart = state.events.length;
          applyAction(state, { kind: 'give-gift', npcId: npc.id, itemId }, ctx);
          const giftEv = state.events.slice(eventStart).find(e => e.type === 'gift');
          const name = reg.items.get(itemId)?.displayName ?? itemId;
          if (!giftEv) {
            const presentation = npcGiftResultToastPresentation(npc, 'failure', name, false, undefined, itemId, reg);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const payload = giftEv.payload as { affectionGain?: number; birthday?: boolean };
          const gain = payload.affectionGain ?? 0;
          audio.playSfx('ui');
          const presentation = npcGiftResultToastPresentation(npc, 'success', name, Boolean(payload.birthday), gain, itemId, reg);
          toast(presentation.message, presentation.assetId);
          const relationshipEvent = claimRelationshipEvent(state, npc.id);
          if (relationshipEvent) {
            openRelationshipDialogue(relationshipEvent);
          }
          return true;
        }
        const npcQuest = getCurrentNpcQuest(state, npc.id);
        if (!npcQuest) {
          const presentation = npcQuestResultToastPresentation(npc, null, 'missing', reg);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const eventStart = state.events.length;
        applyAction(state, { kind: 'claim-npc-quest', questId: npcQuest.id }, ctx);
        const questEv = state.events.slice(eventStart).find(e => e.type === 'npc-quest-claim');
        if (questEv) {
          const payload = questEv.payload as { nextQuestTitle?: string | null };
          audio.playSfx('ui');
          const presentation = npcQuestResultToastPresentation(npc, npcQuest, payload.nextQuestTitle ? 'advance' : 'complete', reg, payload.nextQuestTitle);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = npcQuestResultToastPresentation(npc, npcQuest, 'failure', reg);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'festival': {
        participateFestivalWithToast();
        return true;
      }
      case 'trade': {
        const offers = getTradeOffers(state);
        if (offers.length === 0) {
          const presentation = tradeUnavailableToastPresentation('empty');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const o = offers[tradeIdx % offers.length]!;
        const r = executeTrade(state, o.id);
        if (r.ok) {
          audio.playSfx('ui');
          const presentation = tradeResultToastPresentation(o, 'success', reg);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = tradeResultToastPresentation(o, 'failure', reg, r.reason);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'shop': {
        if (interactionPanel.festival) {
          const stallGoods = getFestivalStallItems(state);
          if (stallGoods.length === 0) {
            const presentation = shopUnavailableToastPresentation('festival-stall');
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const item = stallGoods[shopIdx % stallGoods.length]!;
          const eventStart = state.events.length;
          applyAction(state, { kind: 'buy-festival-stall-item', itemId: item.itemId }, ctx);
          const bought = state.events.slice(eventStart).find(e => e.type === 'festival-stall-buy' && (e.payload as { itemId?: string })?.itemId === item.itemId);
          if (bought) {
            audio.playSfx('ui');
            const presentation = shopResultToastPresentation('festival-stall', item, 'success', reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = shopResultToastPresentation('festival-stall', item, 'failure', reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        const goods = getShopItems(state);
        if (goods.length === 0) {
          const presentation = shopUnavailableToastPresentation('shop');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const item = goods[shopIdx % goods.length]!;
        const eventStart = state.events.length;
        applyAction(state, { kind: 'buy-shop-item', itemId: item.itemId, count: 1 }, ctx);
        const bought = state.events.slice(eventStart).find(e => e.type === 'shop-buy' && (e.payload as { itemId?: string })?.itemId === item.itemId);
        if (bought) {
          audio.playSfx('ui');
          if (!closeShopAfterFirstRestock(item.itemId)) {
            const presentation = shopResultToastPresentation('shop', item, 'success', reg);
            toast(presentation.message, presentation.assetId);
          }
        } else {
          const presentation = shopResultToastPresentation('shop', item, 'failure', reg);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'tea-shed': {
        const result = visitTeaShed(state, ctx);
        if (!result.ok) {
          const presentation = teaShedResultToastPresentation('failure', result.reason ?? '今日不便歇脚');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        audio.playSfx('ui');
        const presentation = teaShedResultToastPresentation('success', result);
        toast(presentation.message, presentation.assetId);
        return true;
      }
      case 'greenhouse': {
        const result = tendGreenhouse(state, ctx);
        if (!result.ok) {
          const presentation = greenhouseResultToastPresentation('failure', result.reason ?? '今日不便养护', reg);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        audio.playSfx('ui');
        const presentation = greenhouseResultToastPresentation('success', result, reg);
        toast(presentation.message, presentation.assetId);
        return true;
      }
      case 'commission': {
        if (state.postAscension.mode === 'stayed-in-world') {
          const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
          if (activeOrder) {
            if (activeOrder.remaining <= 0) {
              const eventStart = state.events.length;
              applyAction(state, { kind: 'claim-special-order', orderId: activeOrder.id }, ctx);
              const doneEv = state.events.slice(eventStart).find(e => e.type === 'special-order-complete');
              if (doneEv) {
                audio.playSfx('ui');
                const presentation = specialOrderClaimToastPresentation(activeOrder, reg, true);
                toast(presentation.message, presentation.assetId);
                const relationshipEvent = (doneEv.payload as { relationshipEvent?: { id: string; npcId?: string; npcName: string; title: string; lines: readonly string[] } | null }).relationshipEvent;
                if (relationshipEvent) {
                  openRelationshipDialogue(relationshipEvent);
                }
              } else {
                const presentation = specialOrderClaimFailureToastPresentation(activeOrder, reg, true);
                toast(presentation.message, presentation.assetId);
              }
              return true;
            }
            const owned = itemCount(state.player, activeOrder.request.itemId);
            if (owned <= 0) {
              const presentation = specialOrderPendingToastPresentation(activeOrder, reg, true);
              toast(presentation.message, presentation.assetId);
              return true;
            }
            const submitCount = Math.min(owned, activeOrder.remaining);
            const eventStart = state.events.length;
            applyAction(state, { kind: 'submit-special-order', orderId: activeOrder.id, count: submitCount }, ctx);
            const progressEv = state.events.slice(eventStart).find(e => e.type === 'special-order-progress');
            if (progressEv) {
              const payload = progressEv.payload as { progress?: number; required?: number };
              const presentation = specialOrderProgressToastPresentation(activeOrder, payload.progress ?? 0, payload.required ?? activeOrder.request.count, reg, true);
              toast(presentation.message, presentation.assetId);
            } else {
              const presentation = specialOrderSubmitFailureToastPresentation(activeOrder, reg, true);
              toast(presentation.message, presentation.assetId);
            }
            return true;
          }

          const incident = getCurrentStayingWorldIncident(state);
          if (incident && !hasResolvedStayingWorldIncidentForDay(state, state.day)) {
            const eventStart = state.events.length;
            applyAction(state, { kind: 'resolve-staying-world-incident' }, ctx);
            const resolvedEv = state.events.slice(eventStart).find(e => e.type === 'staying-world-incident-resolved');
            if (resolvedEv) {
              audio.playSfx('ui');
              const payload = resolvedEv.payload as { beastId?: number };
              const presentation = stayingWorldIncidentResolveToastPresentation(incident, reg, { beastId: payload.beastId });
              toast(presentation.message, presentation.assetId);
            } else {
              const presentation = stayingWorldIncidentResolveFailureToastPresentation(incident, reg);
              toast(presentation.message, presentation.assetId);
            }
            return true;
          }

          const commission = getDailyCommission(state);
          if (!commission) {
            const presentation = commissionBoardEmptyToastPresentation(true);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          return completeDailyCommissionWithToast(true);
        }

        const mainline = getCurrentMainlineQuest(state);
        if (mainline) {
          const eventStart = state.events.length;
          applyAction(state, { kind: 'claim-mainline-quest', questId: mainline.id }, ctx);
          const questEv = state.events.slice(eventStart).find(e => e.type === 'mainline-quest-claim');
          if (questEv) {
            const payload = questEv.payload as { nextQuestTitle?: string | null };
            audio.playSfx('ui');
            const presentation = mainlineQuestClaimToastPresentation(mainline, reg, payload.nextQuestTitle);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = mainlineQuestClaimFailureToastPresentation(mainline, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        const ruinChapter = getCurrentRuinChapter(state);
        if (ruinChapter) {
          const eventStart = state.events.length;
          applyAction(state, { kind: 'claim-ruin-chapter', chapterId: ruinChapter.id }, ctx);
          const chapterEv = state.events.slice(eventStart).find(e => e.type === 'ruin-chapter-claim');
          if (chapterEv) {
            const payload = chapterEv.payload as { nextChapterTitle?: string | null; nextFloorStart?: number | null; nextFloorEnd?: number | null };
            audio.playSfx('ui');
            const presentation = ruinChapterClaimToastPresentation(ruinChapter, state.exploration.deepestRuinLevel, reg, {
              title: payload.nextChapterTitle,
              floorStart: payload.nextFloorStart,
              floorEnd: payload.nextFloorEnd
            });
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = ruinChapterClaimFailureToastPresentation(ruinChapter, state.exploration.deepestRuinLevel, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        const activeOrder = getActiveSpecialOrders(state)[0] ?? null;
        if (activeOrder) {
          if (activeOrder.remaining <= 0) {
            const eventStart = state.events.length;
            applyAction(state, { kind: 'claim-special-order', orderId: activeOrder.id }, ctx);
            const doneEv = state.events.slice(eventStart).find(e => e.type === 'special-order-complete');
            if (doneEv) {
              audio.playSfx('ui');
              const presentation = specialOrderClaimToastPresentation(activeOrder, reg);
              toast(presentation.message, presentation.assetId);
              const relationshipEvent = (doneEv.payload as { relationshipEvent?: { id: string; npcId?: string; npcName: string; title: string; lines: readonly string[] } | null }).relationshipEvent;
              if (relationshipEvent) {
                openRelationshipDialogue(relationshipEvent);
              }
            } else {
              const presentation = specialOrderClaimFailureToastPresentation(activeOrder, reg);
              toast(presentation.message, presentation.assetId);
            }
            return true;
          }
          const owned = itemCount(state.player, activeOrder.request.itemId);
          if (owned <= 0) {
            const presentation = specialOrderPendingToastPresentation(activeOrder, reg);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const submitCount = Math.min(owned, activeOrder.remaining);
          const eventStart = state.events.length;
          applyAction(state, { kind: 'submit-special-order', orderId: activeOrder.id, count: submitCount }, ctx);
          const progressEv = state.events.slice(eventStart).find(e => e.type === 'special-order-progress');
          if (progressEv) {
            const payload = progressEv.payload as { progress?: number; required?: number };
            const presentation = specialOrderProgressToastPresentation(activeOrder, payload.progress ?? 0, payload.required ?? activeOrder.request.count, reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = specialOrderSubmitFailureToastPresentation(activeOrder, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }

        const specialOrder = getDailySpecialOrder(state);
        if (specialOrder) {
          const eventStart = state.events.length;
          applyAction(state, { kind: 'accept-special-order', orderId: specialOrder.id }, ctx);
          const acceptEv = state.events.slice(eventStart).find(e => e.type === 'special-order-accept');
          if (acceptEv) {
            audio.playSfx('ui');
            const presentation = specialOrderAcceptToastPresentation(specialOrder, reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = specialOrderAcceptFailureToastPresentation(specialOrder, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }

        const commission = getDailyCommission(state);
        if (!commission) {
          const presentation = commissionBoardEmptyToastPresentation(false);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        return completeDailyCommissionWithToast(false);
      }
      case 'storage': {
        const choices = interactionPanel.mode === 'deposit' ? storageDepositChoices() : storageWithdrawChoices();
        if (choices.length === 0) {
          const presentation = storageUnavailableToastPresentation(interactionPanel.mode);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const choice = interactionPanel.mode === 'deposit' ? choices[storageDepositIdx % choices.length]! : choices[storageWithdrawIdx % choices.length]!;
        const eventStart = state.events.length;
        if (interactionPanel.mode === 'deposit') {
          if (choice.quality) applyAction(state, { kind: 'deposit-quality-item', itemId: choice.itemId, quality: choice.quality, count: 1 }, ctx);
          else applyAction(state, { kind: 'deposit-item', itemId: choice.itemId, count: 1 }, ctx);
          const stored = state.events.slice(eventStart).some(e => e.type === 'storage-deposit' || e.type === 'storage-deposit-quality');
          if (stored) {
            audio.playSfx('ui');
            const presentation = storageResultToastPresentation('deposit', { ...choice, count: 1 }, state, reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = storageFailureToastPresentation('deposit', { ...choice, count: 1 }, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        if (choice.quality) applyAction(state, { kind: 'withdraw-quality-item', itemId: choice.itemId, quality: choice.quality, count: 1 }, ctx);
        else applyAction(state, { kind: 'withdraw-item', itemId: choice.itemId, count: 1 }, ctx);
        const withdrew = state.events.slice(eventStart).some(e => e.type === 'storage-withdraw' || e.type === 'storage-withdraw-quality');
        if (withdrew) {
          audio.playSfx('ui');
          const presentation = storageResultToastPresentation('withdraw', { ...choice, count: 1 }, state, reg);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = storageFailureToastPresentation('withdraw', { ...choice, count: 1 }, reg);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'shipping': {
        const eventStart = state.events.length;
        if (interactionPanel.mode === 'normal') {
          const choices = normalShipChoices();
          if (choices.length === 0) {
            const presentation = shippingUnavailableToastPresentation('normal');
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const choice = choices[shipIdx % choices.length]!;
          const firstShipment = !state.player.flags.has(FIRST_SHIPMENT_FLAG);
          applyAction(state, { kind: 'ship-item', itemId: choice.itemId, count: 1 }, ctx);
          const shipped = state.events.slice(eventStart).find(e => e.type === 'ship-item');
          if (shipped) {
            audio.playSfx('ui');
            const presentation = shippingResultToastPresentation('normal', { ...choice, count: 1 }, state, ctx, reg);
            if (firstShipment) {
              const milestone = firstShipmentMilestoneToastPresentation(presentation.message, '下一步：按 Enter 过夜，等次日出货结算。');
              toast(milestone.message, milestone.assetId);
            } else {
              toast(presentation.message, presentation.assetId);
            }
          } else {
            const presentation = shippingFailureToastPresentation({ ...choice, count: 1 }, reg);
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        const choices = qualityShipChoices();
        if (choices.length === 0) {
          const presentation = shippingUnavailableToastPresentation('quality');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const choice = choices[qualityShipIdx % choices.length]!;
        const firstShipment = !state.player.flags.has(FIRST_SHIPMENT_FLAG);
        applyAction(state, { kind: 'ship-quality-item', itemId: choice.itemId, quality: choice.quality, count: 1 }, ctx);
        const shipped = state.events.slice(eventStart).find(e => e.type === 'ship-quality-item');
        if (shipped) {
          audio.playSfx('ui');
          const presentation = shippingResultToastPresentation('quality', { ...choice, count: 1 }, state, ctx, reg);
          if (firstShipment) {
            const milestone = firstShipmentMilestoneToastPresentation(presentation.message, '下一步：按 Enter 过夜，等次日出货结算。');
            toast(milestone.message, milestone.assetId);
          } else {
            toast(presentation.message, presentation.assetId);
          }
        } else {
          const presentation = shippingFailureToastPresentation({ ...choice, count: 1 }, reg);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'processing': {
        if (interactionPanel.mode === 'drying') {
          const facility = adjacentFacility(state, state.player.position.x, state.player.position.y, 'drying-rack');
          if (!facility) {
            const presentation = processingPositionRequiredToastPresentation('drying');
            toast(presentation.message, presentation.assetId);
            return true;
          }
          if (facility.job) {
            const presentation = facilityStatusToastPresentation('drying', facility.job);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const choices = processingChoices();
          if (choices.length === 0) {
            const presentation = processingUnavailableToastPresentation('drying');
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const choice = choices[processingIdx % choices.length]!;
          const eventStart = state.events.length;
          applyAction(state, { kind: 'start-drying-job', facilityId: facility.id, itemId: choice.itemId, quality: choice.quality }, ctx);
          const started = state.events.slice(eventStart).find(e => e.type === 'facility-job-start');
          if (started) {
            const payload = started.payload as { outputItemId?: string; outputCount?: number; daysRemaining?: number };
            audio.playSfx('ui');
            const presentation = facilityJobStartToastPresentation('drying', { ...choice, count: 1 }, payload, reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = facilityFailureToastPresentation('drying', { reason: describeStorageChoice(choice) });
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        if (interactionPanel.mode === 'sealing') {
          const facility = adjacentFacility(state, state.player.position.x, state.player.position.y, 'sealing-cabinet');
          if (!facility) {
            const presentation = processingPositionRequiredToastPresentation('sealing');
            toast(presentation.message, presentation.assetId);
            return true;
          }
          if (facility.job) {
            const presentation = facilityStatusToastPresentation('sealing', facility.job);
            toast(presentation.message, presentation.assetId);
            return true;
          }
          const eventStart = state.events.length;
          applyAction(state, { kind: 'start-sealing-job', facilityId: facility.id }, ctx);
          const started = state.events.slice(eventStart).find(e => e.type === 'facility-job-start');
          if (started) {
            const payload = started.payload as { outputItemId?: string; outputCount?: number; daysRemaining?: number };
            audio.playSfx('ui');
            const presentation = facilityJobStartToastPresentation('sealing', null, payload, reg);
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = facilityFailureToastPresentation('sealing', { reason: '需晾晒灵草×2与灵壤肥×1' });
            toast(presentation.message, presentation.assetId);
          }
          return true;
        }
        const facility = adjacentFacility(state, state.player.position.x, state.player.position.y, 'talisman-furnace');
        if (!facility) {
          const presentation = processingPositionRequiredToastPresentation('furnace');
          toast(presentation.message, presentation.assetId);
          return true;
        }
        if (facility.job) {
          const presentation = facilityStatusToastPresentation('furnace', facility.job);
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const eventStart = state.events.length;
        applyAction(state, { kind: 'start-furnace-job', facilityId: facility.id }, ctx);
        const started = state.events.slice(eventStart).find(e => e.type === 'facility-job-start');
        if (started) {
          const payload = started.payload as { outputItemId?: string; outputCount?: number; daysRemaining?: number };
          audio.playSfx('ui');
          const presentation = facilityJobStartToastPresentation('furnace', null, payload, reg);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = facilityFailureToastPresentation('furnace', { reason: '需破损法宝×1与灵石×2' });
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
      case 'facility-collect': {
        const choices = facilityCollectChoices();
        if (choices.length === 0) {
          const presentation = facilityCollectUnavailableToastPresentation(farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
          return true;
        }
        const choice = choices[facilityCollectIdx % choices.length]!;
        const eventStart = state.events.length;
        applyAction(state, { kind: 'collect-facility', facilityId: choice.facilityId }, ctx);
        const collected = state.events.slice(eventStart).find(e => e.type === 'facility-collect');
        if (collected) {
          const payload = collected.payload as { outputItemId?: string; outputCount?: number };
          audio.playSfx('ui');
          const presentation = facilityCollectResultToastPresentation(payload, state, reg);
          toast(presentation.message, presentation.assetId);
        } else {
          const presentation = facilityCollectFailureToastPresentation(choice.kind === 'drying-rack' ? 'drying' : choice.kind === 'sealing-cabinet' ? 'sealing' : 'furnace', { reason: '尚未完成或背包已满' });
          toast(presentation.message, presentation.assetId);
        }
        return true;
      }
    }
  }

  function exploreWithToast(site: 'valley' | 'ruin' | 'spirit-vein'): void {
    const eventStart = state.events.length;
    applyAction(state, { kind: 'explore', site }, ctx);
    const exploreEv = state.events.slice(eventStart).find(e => e.type === 'explore' || e.type === 'explore-empty');
    if (!exploreEv) {
      const presentation = explorationFailureToastPresentation(site);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const grants = (exploreEv.payload as { grants?: Array<{ itemId: string; count: number }> })?.grants ?? [];
    const presentation = explorationResultToastPresentation(site, grants, reg);
    toast(presentation.message, presentation.assetId);
  }

  function delveRuinWithToast(): void {
    const eventStart = state.events.length;
    applyAction(state, { kind: 'delve-ruin' }, ctx);
    const actionEvents = state.events.slice(eventStart);
    const delveEv = actionEvents.find(e => e.type === 'ruin-delve');
    if (!delveEv) {
      const presentation = ruinDelveFailureToastPresentation();
      toast(presentation.message, presentation.assetId);
      return;
    }
    const payload = delveEv.payload as { level?: number; damage?: number; grants?: Array<{ itemId: string; count: number }>; milestone?: boolean };
    const chapter = getCurrentRuinChapter(state);
    audio.playSfx('ui');
    for (const sfxId of actionSfxQueue(actionEvents)) audio.playSfx(sfxId);
    const presentation = ruinDelveToastPresentation(
      {
        ...payload,
        chapterTitle: chapter?.title,
        chapterProgress: chapter ? `${Math.min(state.exploration.deepestRuinLevel, chapter.floorEnd)}/${chapter.floorEnd}` : undefined,
        chapterReadyToClaim: chapter?.completed
      },
      reg
    );
    toast(presentation.message, presentation.assetId);
  }

  function donateArchiveWithToast(): void {
    const milestone = nextArchiveMilestone(state);
    if (milestone) {
      const eventStart = state.events.length;
      applyAction(state, { kind: 'claim-archive-milestone', milestoneId: milestone.id }, ctx);
      const doneEv = state.events.slice(eventStart).find(e => e.type === 'archive-milestone');
      if (!doneEv) {
        const presentation = archiveMilestoneFailureToastPresentation();
        toast(presentation.message, presentation.assetId);
        return;
      }
      audio.playSfx('ui');
      const presentation = archiveMilestoneToastPresentation(milestone.title, milestone.reward, reg);
      toast(presentation.message, presentation.assetId);
      return;
    }

    const donation = nextArchiveDonation(state);
    if (!donation) {
      const presentation = archiveEmptyToastPresentation();
      toast(presentation.message, presentation.assetId);
      return;
    }
    const eventStart = state.events.length;
    applyAction(state, { kind: 'donate-archive', donationId: donation.id }, ctx);
    const doneEv = state.events.slice(eventStart).find(e => e.type === 'archive-donate');
    if (!doneEv) {
      const presentation = archiveDonationFailureToastPresentation(donation.request, reg);
      toast(presentation.message, presentation.assetId);
      return;
    }
    audio.playSfx('ui');
    const presentation = archiveDonationToastPresentation(donation.title, donation.reward, reg);
    toast(presentation.message, presentation.assetId);
  }

  function describeLocationSelection(): string {
    const locations = getActiveLocationDirectory(state);
    const location = locations.length > 0 ? (locations[locationIdx % locations.length] ?? null) : null;
    const services = location ? getLocationServiceOptions(state, location.id) : [];
    const service = location && services.length > 0 ? (services[locationServiceIdx % services.length] ?? null) : null;
    return describeLocationSelectionSummary(location, services, service);
  }

  function locationPreviewDetails(): { title: string; details: string; texture?: Texture; npcPrimary?: Texture; npcSecondary?: Texture } | null {
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) return null;
    const location = locations[locationIdx % locations.length]!;
    const services = getLocationServiceOptions(state, location.id);
    const service = services.length > 0 ? (services[locationServiceIdx % services.length] ?? null) : null;
    const previewThreadLocationId = locationPreviewThreadLocationId(state, location.id, service?.command ?? null);
    const encounters = getLocationEncounters(state, previewThreadLocationId);
    const npcSignals: LocationPreviewNpcSignals = collectLocationNpcSignals(state, encounters);
    const previewThreadLocation =
      location.id === previewThreadLocationId
        ? location
        : {
            ...LOCATION_CATALOG.find(entry => entry.id === previewThreadLocationId)!,
            active: true,
            npcs: encounters.map(entry => entry.npcName),
            serviceLabels: [],
            closedServiceLabels: []
          };
    const previewSummary = locationPreviewSummaryContext(state, location, services, service, encounters);
    const npcIds = locationPreviewNpcIds(previewThreadLocation, npcNameToId);
    const portraitAssetIds = locationPreviewPortraitAssetIds(previewThreadLocation, npcIds);
    const portraits = locationPreviewPortraits(portraitAssetIds, renderAssets.npcs);
    const details = buildLocationPreviewSummary({
      location: previewSummary.location,
      services: previewSummary.services,
      selectedService: previewSummary.selectedService,
      encounters,
      npcSignals,
      actionSignalLine: formatLocationActionSignalLine(state, previewSummary.location.id),
      focusReason: locationPreviewFocusReason(state, getOnboardingObjectiveId(state), previewSummary.location.id, previewSummary.command, encounters.length)
    });
    return {
      title: previewSummary.location.displayName,
      details,
      texture: renderAssets.locations[previewThreadLocationId],
      npcPrimary: portraits.primary,
      npcSecondary: portraits.secondary
    };
  }

  function applyPreferredLocationSelection(): void {
    const preferred = getPreferredLocationSelection(state);
    if (!preferred) return;
    const locations = getActiveLocationDirectory(state);
    const nextLocationIdx = locations.findIndex(location => location.id === preferred.locationId);
    if (nextLocationIdx < 0) return;
    const services = getLocationServiceOptions(state, preferred.locationId);
    const nextServiceIdx = services.findIndex(service => service.command === preferred.command);
    if (nextServiceIdx < 0) return;
    locationIdx = nextLocationIdx;
    locationServiceIdx = nextServiceIdx;
  }

  function cycleLocation(reverse: boolean): void {
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) {
      const presentation = locationDirectoryEmptyToastPresentation(locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    locationIdx = (locationIdx + (reverse ? locations.length - 1 : 1)) % locations.length;
    locationServiceIdx = 0;
    activateLocationSelection('地点');
  }

  function cycleLocationService(): void {
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) {
      const presentation = locationDirectoryEmptyToastPresentation(locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const location = locations[locationIdx % locations.length]!;
    const services = getLocationServiceOptions(state, location.id);
    if (services.length === 0) {
      const presentation = locationServiceUnavailableToastPresentation(location, state);
      toast(presentation.message, presentation.assetId);
      return;
    }
    locationServiceIdx = (locationServiceIdx + 1) % services.length;
    activateLocationSelection('服务');
  }

  function selectLocationByDigit(index: number): void {
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) {
      const presentation = locationDirectoryEmptyToastPresentation(locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    locationIdx = normalizeSelection(index, locations.length);
    locationServiceIdx = 0;
    activateLocationSelection('地点');
  }

  function focusLocationService(locationId: LocationId, command: LocationServiceCommand, prefix: '地点' | '服务' = '服务'): boolean {
    const locations = getActiveLocationDirectory(state);
    const nextLocationIdx = locations.findIndex(location => location.id === locationId);
    if (nextLocationIdx < 0) return false;
    const services = getLocationServiceOptions(state, locationId);
    const nextServiceIdx = services.findIndex(service => service.command === command);
    if (nextServiceIdx < 0) return false;
    interactionPanel = { kind: 'none' };
    locationIdx = nextLocationIdx;
    locationServiceIdx = nextServiceIdx;
    locationSelectionActive = true;
    const location = locations[nextLocationIdx]!;
    const selectedService = services[nextServiceIdx] ?? null;
    const presentation = locationSelectionToastPresentation(prefix, location, selectedService, locationSelectionHint(), locationPreviewFocusReason(state, getOnboardingObjectiveId(state), location.id, selectedService?.command ?? null, getLocationEncounters(state, location.id).length), formatLocationActionSignalLine(state, location.id), location.id === 'farmstead' && selectedService?.command === 'show-farm-work' ? farmsteadRootContextAssetId(state) : undefined);
    toast(presentation.message, presentation.assetId);
    return true;
  }

  function showLocationEncounter(locationId: LocationId): void {
    const encounters = getLocationEncounters(state, locationId);
    if (encounters.length === 0) {
      const location = getActiveLocationDirectory(state).find(entry => entry.id === locationId);
      const presentation = location ? locationEncounterUnavailableToastPresentation(location) : locationDirectoryEmptyToastPresentation(locationPreviewAssetId(locationId));
      toast(presentation.message, presentation.assetId);
      return;
    }
    locationEncounterIdx = locationEncounterIdx % encounters.length;
    const encounter = encounters[locationEncounterIdx]!;
    locationEncounterIdx = (locationEncounterIdx + 1) % encounters.length;
    dialogueBeat = buildEncounterDialogueBeat(locationId, encounter, locationEncounterIdx);
  }

  function openTeaShedPanel(): void {
    interactionPanel = { kind: 'tea-shed' };
    const presentation = teaShedToastPresentation(state, state.postAscension.mode === 'stayed-in-world' ? confirmHint('歇脚听闻') : undefined);
    toast(presentation.message, presentation.assetId);
  }

  function openGreenhousePanel(): void {
    interactionPanel = { kind: 'greenhouse' };
    const presentation = greenhouseToastPresentation(state, reg, state.postAscension.mode === 'stayed-in-world' ? confirmHint('养护暖棚') : undefined);
    toast(presentation.message, presentation.assetId);
  }

  function executeLocationCommand(command: LocationServiceCommand, locationId: LocationId): void {
    switch (command) {
      case 'show-location-encounter':
        showLocationEncounter(locationId);
        return;
      case 'browse-shop':
        browseShopOrFestivalStall(false);
        return;
      case 'show-festival':
        openFestivalPanel();
        return;
      case 'browse-festival-stall':
        browseShopOrFestivalStall(true);
        return;
      case 'browse-trade':
        browseTrade();
        return;
      case 'show-tea-shed':
        openTeaShedPanel();
        return;
      case 'show-greenhouse':
        openGreenhousePanel();
        return;
      case 'show-commission':
        showCommission();
        return;
      case 'explore-valley':
        exploreWithToast('valley');
        return;
      case 'explore-ruin':
        exploreWithToast('ruin');
        return;
      case 'delve-ruin':
        delveRuinWithToast();
        return;
      case 'show-archive':
        donateArchiveWithToast();
        return;
      case 'explore-spirit-vein':
        exploreWithToast('spirit-vein');
        return;
      case 'show-processing':
        {
          const presentation = processingServiceToastPresentation(confirmHint('进入').replace('·Esc返回', ''), locationId);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'show-arrays':
        {
          const presentation = arraysServiceToastPresentation('R布引雷阵·F布绝缘阵', locationId);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'show-farm-work':
        {
          const presentation = farmWorkServiceToastPresentation('空格/E主交互·M开农庄操作', locationId === 'farmstead' ? farmsteadRootContextAssetId(state) : undefined);
          toast(presentation.message, presentation.assetId);
        }
        return;
    }
  }

  function executeSelectedLocationService(): void {
    const locations = getActiveLocationDirectory(state);
    if (locations.length === 0) {
      const presentation = locationDirectoryEmptyToastPresentation(locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    const location = locations[locationIdx % locations.length]!;
    const services = getLocationServiceOptions(state, location.id);
    if (services.length === 0) {
      const presentation = locationServiceUnavailableToastPresentation(location, state);
      toast(presentation.message, presentation.assetId);
      return;
    }
    locationSelectionActive = false;
    executeLocationCommand(services[locationServiceIdx % services.length]!.command, location.id);
  }

  function closeShopAfterFirstRestock(seedId: string): boolean {
    if (getOnboardingObjectiveId(state) !== 'first-second-sow') return false;
    focusOwnedSeedHotbar(seedId);
    interactionPanel = { kind: 'none' };
    const presentation = onboardingRestockReturnToastPresentation();
    toast(presentation.message, presentation.assetId);
    return true;
  }

  function openQuickLocationService(quickId: 'staying-commission' | 'tea-shed' | 'greenhouse'): boolean {
    const option = getQuickLocationServiceOption(state, quickId);
    if (!option) return false;
    clearInteractionPanel(false);
    clearLocationSelection(false);
    executeLocationCommand(option.command, option.locationId);
    return true;
  }

  function move(dir: Direction): void {
    state.player.facing = dir;
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    applyAction(state, { kind: 'move', to: { x: state.player.position.x + dx, y: state.player.position.y + dy } }, ctx);
  }

  function endDay(): void {
    const teachingActive = isJourneyTeachingActive(getPublicDemoObjectiveId(state));
    const objectiveBefore = getOnboardingObjectiveId(state);
    if (teachingActive) {
      const endDayWarning = onboardingEndDayWarningToastPresentation(objectiveBefore);
      if (endDayWarning) {
        toast(endDayWarning.message, endDayWarning.assetId);
        return;
      }
    }
    state.events.length = 0;
    advanceDay(state, ctx);
    for (const sfxId of endDaySfxQueue(state.events)) audio.playSfx(sfxId);
    const summary = daySummaryPresentation(state.day, state.events, ctx.content, readyForBreakthrough(state, DEFAULT_BALANCE), currentOnboardingHelpText());
    const objectiveAfter = getOnboardingObjectiveId(state);
    const nextStep = teachingActive && objectiveAfter !== objectiveBefore ? onboardingObjectiveAdvanceToast(objectiveAfter) : null;
    toast(composeEndDayToastMessage(summary.message, nextStep), summary.assetId);
  }

  function tryTribulation(): void {
    if (startPurpleOmenIfDue(state, ctx) || state.activeEvent?.defId === 'event.purple-omen') {
      const presentation = tribulationBlockedToastPresentation('purple-omen', {
        daysLeft: state.activeEvent?.daysLeft
      });
      toast(presentation.message, presentation.assetId);
      return;
    }
    if (!readyForBreakthrough(state, DEFAULT_BALANCE)) {
      const presentation = tribulationBlockedToastPresentation('body-not-ready', {
        currentFoundation: state.player.bodyFoundation,
        requiredFoundation: stageQiCap(state.player.stage, DEFAULT_BALANCE)
      });
      toast(presentation.message, presentation.assetId);
      return;
    }
    recordTribulationInvocation(state, ctx);
    const res = runTribulation(state, { stage: state.player.stage, boltCount: 3 + state.player.stage, policy: { blockChance: 0 } }, ctx);
    // 正式劫暂无逐雷落点 UI：屏幕中心一道招牌电光 + 粒子（与教学同语言）
    triggerTribBolt(layers, { x: app.screen.width / 2, y: app.screen.height * 0.42 }, 34);
    spawnBurst(layers, app.screen.width / 2, app.screen.height / 2, 45, 0xffe066); // 天劫金芒迸发（T9）
    audio.playSfx('tribulation');
    const br = breakthrough(state, ctx, res.survived);
    checkGameEnd(state, ctx);
    if (state.gameOver) {
      audio.playSfx(state.ending === 'ascension' ? 'ending' : 'explosion');
      audio.setBgmMode('off');
      // 飞升：奏签名主题曲「大道之歌」（固定种子，同路生成、零委约、避 Suno/Udio）。
      if (state.ending === 'ascension') audio.playSignatureTheme(true);
      const presentation = tribulationEndingToastPresentation(state.ending === 'ascension' ? 'ascension' : 'death');
      toast(presentation.message, presentation.assetId);
      return;
    }
    if (!res.survived) {
      const presentation = tribulationResultToastPresentation('death');
      toast(presentation.message, presentation.assetId);
    } else if (br.success) {
      audio.playSfx('breakthrough');
      const presentation = tribulationResultToastPresentation('breakthrough', { stage: state.player.stage });
      toast(presentation.message, presentation.assetId);
    } else {
      const presentation = tribulationResultToastPresentation('survived', {
        temperingGain: Math.floor(res.temperingGainMilli / 1000)
      });
      toast(presentation.message, presentation.assetId);
    }
  }

  /** 按丹方炼丹（理想火候；完整火候解谜 UI 待 M4） */
  function brewById(recipeId: string, name: string): void {
    const r = ctx.content.recipes.get(recipeId);
    if (!r) {
      const presentation = processingRecipeUnavailableToastPresentation('furnace');
      toast(presentation.message, presentation.assetId);
      return;
    }
    for (const inp of r.inputs) {
      if (itemCount(state.player, inp.herbId) < inp.qty) {
        const presentation = brewMaterialFailureToastPresentation({ herbId: inp.herbId }, ctx.content);
        toast(presentation.message, presentation.assetId);
        return;
      }
    }
    const heat = furnaceHeat * 1000; // 玩家自控炉温（火候解谜）
    const res = brewPills(state, { materials: r.inputs.map(i => ({ herbId: i.herbId, qty: i.qty })), avgHeatMilli: heat }, ctx);
    audio.playSfx(res.outcome === 'exploded' ? 'explosion' : 'brew');
    if (res.outcome === 'exploded') spawnBurst(layers, 480, 240, 36, 0xff5a3a);
    else if (res.outcome === 'pill') spawnBurst(layers, 480, 240, 18, 0x7ac050); // 成丹绿芒（T9）
    const presentation = brewResultToastPresentation(res.outcome, { name, furnaceHeat });
    toast(presentation.message, presentation.assetId);
  }

  function eatById(pillId: string, _name: string): void {
    const r = applyPill(state, pillId, ctx);
    if (r.applied) audio.playSfx('eat-pill');
    const presentation = pillUseToastPresentation(pillId, r, ctx.content);
    toast(presentation.message, presentation.assetId);
  }

  function performPrimaryInteraction(): void {
    const slot = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    switch (slot.kind) {
      case 'till':
        performFarmAction('till');
        return;
      case 'water':
        performFarmAction('water');
        return;
      case 'harvest':
        performFarmAction('harvest');
        return;
      case 'channel-qi':
        performFarmAction('channel-qi');
        return;
      case 'seed': {
        const seedId = slot.seedId ?? 'seed.mossling';
        if (itemCount(state.player, seedId) <= 0) {
          const nextSeedIdx = findNextOwnedSeedHotbarIndex(hotbarIdx, 1, id => itemCount(state.player, id));
          if (nextSeedIdx == null) {
            const presentation = sowUnavailableToastPresentation({
              seedId
            });
            toast(presentation.message, presentation.assetId);
            return;
          }
          setHotbarIndex(nextSeedIdx, true);
          performPrimaryInteraction();
          return;
        }
        tryAutoTillForOnboardingSecondSow();
        performSowAction(seedId, false);
        return;
      }
    }
  }

  function performSecondaryToolInteraction(): boolean {
    const slot = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    switch (slot.kind) {
      case 'water':
        performFarmAction('water');
        return true;
      case 'channel-qi':
        performFarmAction('channel-qi');
        return true;
      default:
        return false;
    }
  }

  function completeDailyCommissionWithToast(stayingWorldOnly = false): boolean {
    const commission = getDailyCommission(state);
    if (!commission) {
      const presentation = commissionBoardEmptyToastPresentation(stayingWorldOnly);
      toast(presentation.message, presentation.assetId);
      return true;
    }
    const eventStart = state.events.length;
    applyAction(state, { kind: 'complete-commission', commissionId: commission.id }, ctx);
    const doneEv = state.events.slice(eventStart).find(e => e.type === 'commission-complete');
    if (doneEv) {
      audio.playSfx('ui');
      const presentation = commissionCompleteToastPresentation(commission, reg, stayingWorldOnly);
      toast(presentation.message, presentation.assetId);
      const relationshipEvent = (doneEv.payload as { relationshipEvent?: { id: string; npcId?: string; npcName: string; title: string; lines: readonly string[] } | null }).relationshipEvent;
      if (relationshipEvent) {
        openRelationshipDialogue(relationshipEvent);
      }
      return true;
    }
    const presentation = commissionIncompleteToastPresentation(commission, reg, stayingWorldOnly);
    toast(presentation.message, presentation.assetId);
    return true;
  }

  function shouldAutoConfirmLocationPanel(): boolean {
    return interactionPanel.kind === 'commission' || interactionPanel.kind === 'tea-shed' || interactionPanel.kind === 'greenhouse';
  }

  function performDefaultConfirm(): boolean {
    if (locationSelectionActive) {
      executeSelectedLocationService();
      if (interactionPanelActive(interactionPanel) && shouldAutoConfirmLocationPanel()) confirmInteractionPanel();
      return true;
    }
    if (confirmInteractionPanel()) return true;
    performPrimaryInteraction();
    return true;
  }

  function performFurnaceShortcut(action: 'toggle-furnace' | 'cycle-recipe' | 'decrease-furnace-heat' | 'increase-furnace-heat'): void {
    switch (action) {
      case 'toggle-furnace':
        furnace.visible = !furnace.visible;
        {
          const presentation = furnaceVisibilityToastPresentation(furnace.visible);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'cycle-recipe': {
        recipeIdx = (recipeIdx + 1) % brewRecipes.length;
        const rr = reg.recipes.get(brewRecipes[recipeIdx]!);
        const presentation = furnaceRecipeToastPresentation(rr?.displayName ?? '?');
        toast(presentation.message, presentation.assetId);
        return;
      }
      case 'decrease-furnace-heat':
        furnaceHeat = Math.max(0, furnaceHeat - 10);
        layers.furnaceHeat = furnaceHeat;
        {
          const presentation = furnaceHeatToastPresentation(furnaceHeat);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'increase-furnace-heat':
        furnaceHeat = Math.min(100, furnaceHeat + 10);
        layers.furnaceHeat = furnaceHeat;
        {
          const presentation = furnaceHeatToastPresentation(furnaceHeat);
          toast(presentation.message, presentation.assetId);
        }
        return;
    }
  }

  function performCommandShortcut(action: 'toggle-pause' | 'explore-valley' | 'explore-ruin' | 'delve-ruin' | 'explore-spirit-vein' | 'open-upgrade-panel' | 'open-npc-browse' | 'open-npc-gift' | 'open-npc-quest' | 'open-festival-panel' | 'show-calendar-summary'): void {
    switch (action) {
      case 'toggle-pause':
        togglePause(true);
        return;
      case 'explore-valley':
        exploreWithToast('valley');
        return;
      case 'explore-ruin':
        exploreWithToast('ruin');
        return;
      case 'delve-ruin':
        delveRuinWithToast();
        return;
      case 'explore-spirit-vein':
        exploreWithToast('spirit-vein');
        return;
      case 'open-upgrade-panel':
        preselectFarmActionKind('upgrade');
        return;
      case 'open-npc-browse':
        preselectNpcAction('browse');
        return;
      case 'open-npc-gift':
        preselectNpcAction('gift');
        return;
      case 'open-npc-quest':
        preselectNpcAction('quest');
        return;
      case 'open-festival-panel':
        openFestivalPanel();
        return;
      case 'show-calendar-summary': {
        const todayEntries = calendarEntriesForDay(state, ctx);
        const upcomingEntries = upcomingCalendarEntries(state, ctx, 7)
          .filter(entry => (entry.daysFromNow ?? 0) > 0)
          .slice(0, 4);
        const today = todayEntries.map(entry => entry.title).join('、') || '无定期事项';
        const upcoming = upcomingEntries.map(describeCalendarEntry).join('；') || '七日内无预定事项';
        const presentation = calendarSummaryToastPresentation(today, upcoming, todayEntries, upcomingEntries);
        toast(presentation.message, presentation.assetId);
        return;
      }
    }
  }

  function performLegacyConfirmShortcut(): void {
    if (confirmInteractionPanel()) return;
    if (locationSelectionActive) {
      performDefaultConfirm();
      return;
    }
    const presentation = legacyConfirmUnavailableToastPresentation(interactionPanelCloseAssetId(interactionPanel) ?? locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
    toast(presentation.message, presentation.assetId);
  }

  function performQShortcut(action: 'quick-staying-commission' | 'rest' | 'cycle-hotbar-forward' | 'cycle-hotbar-backward'): void {
    switch (action) {
      case 'quick-staying-commission':
        if (!openQuickLocationService('staying-commission')) {
          const presentation = quickServiceUnavailableToastPresentation('staying-commission', state.postAscension.mode === 'stayed-in-world', state);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'rest':
        applyAction(state, { kind: 'rest' }, ctx);
        audio.playSfx('eat-pill');
        {
          const presentation = restSuccessToastPresentation(locationSelectionActive ? locationSelectionContextAssetId() : undefined);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'cycle-hotbar-backward':
        cycleHotbar(-1, true);
        return;
      case 'cycle-hotbar-forward':
        cycleHotbar(1, true);
        return;
    }
  }

  function claimCurrentRuinChapter(): void {
    const chapter = getCurrentRuinChapter(state);
    if (!chapter) {
      const presentation = ruinChapterUnavailableToastPresentation();
      toast(presentation.message, presentation.assetId);
      return;
    }
    const eventStart = state.events.length;
    applyAction(state, { kind: 'claim-ruin-chapter', chapterId: chapter.id }, ctx);
    const chapterEv = state.events.slice(eventStart).find(e => e.type === 'ruin-chapter-claim');
    if (chapterEv) {
      const payload = chapterEv.payload as { nextChapterTitle?: string | null; nextFloorStart?: number | null; nextFloorEnd?: number | null };
      audio.playSfx('ui');
      const presentation = ruinChapterClaimToastPresentation(chapter, state.exploration.deepestRuinLevel, reg, {
        title: payload.nextChapterTitle,
        floorStart: payload.nextFloorStart,
        floorEnd: payload.nextFloorEnd
      });
      toast(presentation.message, presentation.assetId);
      return;
    }
    const presentation = ruinChapterClaimFailureToastPresentation(chapter, state.exploration.deepestRuinLevel, reg);
    toast(presentation.message, presentation.assetId);
  }

  function claimCurrentMainlineQuest(): void {
    const mainline = getCurrentMainlineQuest(state);
    if (!mainline) {
      const presentation = mainlineQuestUnavailableToastPresentation();
      toast(presentation.message, presentation.assetId);
      return;
    }
    const eventStart = state.events.length;
    applyAction(state, { kind: 'claim-mainline-quest', questId: mainline.id }, ctx);
    const questEv = state.events.slice(eventStart).find(e => e.type === 'mainline-quest-claim');
    if (questEv) {
      const payload = questEv.payload as { nextQuestTitle?: string | null };
      audio.playSfx('ui');
      const presentation = mainlineQuestClaimToastPresentation(mainline, reg, payload.nextQuestTitle);
      toast(presentation.message, presentation.assetId);
      return;
    }
    const presentation = mainlineQuestClaimFailureToastPresentation(mainline, reg);
    toast(presentation.message, presentation.assetId);
  }

  function performPageUpShortcut(action: 'claim-ruin-chapter' | 'open-commission'): void {
    switch (action) {
      case 'claim-ruin-chapter':
        claimCurrentRuinChapter();
        return;
      case 'open-commission':
        showCommission();
        return;
    }
  }

  function performPageDownShortcut(action: 'claim-mainline-quest' | 'confirm-commission-panel' | 'open-commission' | 'noop'): void {
    switch (action) {
      case 'claim-mainline-quest':
        claimCurrentMainlineQuest();
        return;
      case 'confirm-commission-panel':
        if (state.postAscension.mode === 'stayed-in-world') completeDailyCommissionWithToast(true);
        else confirmInteractionPanel();
        return;
      case 'open-commission':
        showCommission();
        return;
      case 'noop':
        return;
    }
  }

  function performDialogueConfirm(): boolean {
    if (!dialogueBeat) return false;
    markSeen(state, dialogueBeat.id);
    dialogueBeat = null;
    hideDialogue(layers);
    return true;
  }

  function performEscapeShortcutAction(action: 'clear-interaction-panel' | 'toggle-inventory' | 'close-cultivation-panel' | 'clear-location-selection' | 'toggle-pause'): void {
    switch (action) {
      case 'clear-interaction-panel':
        clearInteractionPanel(true);
        return;
      case 'toggle-inventory':
        toggleInventoryVisibility();
        return;
      case 'close-cultivation-panel':
        cultivationPanelVisible = false;
        layers.cultivation.visible = false;
        {
          const presentation = cultivationPanelToastPresentation(false, farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'clear-location-selection':
        clearLocationSelection(true);
        return;
      case 'toggle-pause':
        togglePause(true);
        return;
    }
  }

  function hotbarWheelBlocked(): boolean {
    return paused || layers.showInv || cultivationPanelVisible || locationSelectionActive || interactionPanelActive(interactionPanel);
  }

  function blockingOverlayActive(): boolean {
    return layers.showInv || cultivationPanelVisible;
  }

  function cancelCurrentSurface(): void {
    if (dialogueBeat) {
      performDialogueConfirm();
      return;
    }
    if (paused) {
      togglePause(true);
      return;
    }
    const escapeShortcut = resolveEscapeShortcut({
      interactionPanelActive: interactionPanelActive(interactionPanel),
      inventoryVisible: layers.showInv,
      cultivationPanelVisible,
      locationSelectionActive
    });
    if (escapeShortcut != null) performEscapeShortcutAction(escapeShortcut);
  }

  function showTutorialAftermathSurface(): void {
    if (!flowView || flowView.getState().screen !== 'world') return;
    flowView.dispatch({ type: 'start-tribulation' });
    flowView.dispatch({ type: 'finish-tribulation' });
  }

  function performJourneyPrimaryAction(): void {
    const objective = getPublicDemoObjectiveId(state);
    switch (objective) {
      case 'first-till':
        performFarmAction('till');
        return;
      case 'first-sow':
        sowFromHotbarSelection(false);
        return;
      case 'first-water':
        performFarmAction('water');
        return;
      case 'first-harvest':
        performFarmAction('harvest');
        return;
      case 'journey-alchemy':
        flowView?.dispatch({ type: 'open-alchemy' });
        return;
      case 'journey-tribulation':
        flowView?.dispatch({ type: 'start-tribulation' });
        return;
      case 'journey-aftermath':
        showTutorialAftermathSurface();
        return;
      case 'journey-complete':
        toast('四段试玩旅程已经完成。可自由经营农庄：播种、炼丹、备劫与外出。', 'logo.full');
        return;
      default:
        performDefaultConfirm();
    }
  }

  function navigateFromSystemMenu(target: Extract<GameCommand, { kind: 'open' }>['target']): boolean {
    if (!flowView || flowView.getState().overlay !== 'pause') return false;
    const sourceScreen = flowView.getState().screen;
    const worldOnlyTarget = target === 'menu' || target === 'inventory' || target === 'cultivation' || target === 'map' || target === 'alchemy' || target === 'journey';
    if (worldOnlyTarget && sourceScreen !== 'world') return false;
    flowView.dispatch({ type: 'close-overlay' });
    const returnFocus = flowView.getState().focus.initial;
    switch (target) {
      case 'inventory':
      case 'cultivation':
      case 'map':
      case 'pause':
      case 'settings':
        flowView.dispatch({ type: 'open-overlay', overlay: target, returnFocus });
        return true;
      case 'alchemy':
        flowView.dispatch({ type: 'open-alchemy' });
        return true;
      case 'journey':
        performJourneyPrimaryAction();
        return true;
      case 'menu':
        openFarmActionPanel();
        return true;
    }
  }

  function handlePublicDemoPanelAction(action: PublicDemoPanelAction): void {
    switch (action.kind) {
      case 'alchemy-primary':
        if (state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)) {
          flowView?.dispatch({ type: 'close-alchemy' });
          return;
        }
        applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
        applyAction(state, { kind: 'brew-tutorial-pill', avgHeatMilli: action.heatPercent * 1_000 }, ctx);
        audio.playSfx('ui');
        break;
      case 'take-pill':
        applyAction(state, { kind: 'eat-pill', pillId: 'pill.ward-basic' }, ctx);
        audio.playSfx('ui');
        break;
      case 'tribulation-primary':
        if (state.tutorialTribulation.phase === 'idle') {
          applyAction(state, { kind: 'start-tutorial-tribulation' }, ctx);
          // 开场：用当前预警格做第一道招牌电光预告
          {
            const warnedId = state.tutorialTribulation.warnedTileId;
            const tile = warnedId == null ? null : state.tiles.find(entry => entry.id === warnedId);
            if (tile) triggerTribBolt(layers, screenPointForTile(tile.x, tile.y), 22);
            else triggerTribFlash(layers, 18);
          }
        } else if (state.tutorialTribulation.phase === 'active') {
          const warnedId = state.tutorialTribulation.warnedTileId;
          const tile = warnedId == null ? null : state.tiles.find(entry => entry.id === warnedId);
          applyAction(state, { kind: 'resolve-tutorial-bolt', perfectBlock: action.perfectBlock === true }, ctx);
          if (tile) triggerTribBolt(layers, screenPointForTile(tile.x, tile.y), action.perfectBlock ? 32 : 26);
          else triggerTribFlash(layers);
          const impact = tile ? screenPointForTile(tile.x, tile.y) : { x: app.screen.width / 2, y: app.screen.height / 2 };
          spawnBurst(layers, impact.x, impact.y, action.perfectBlock ? 28 : 16, action.perfectBlock ? 0xc8b0ff : 0xffe066);
          spawnFloatText(layers, impact.x, impact.y - 12, action.perfectBlock ? '完美擦弹' : '劫雷', action.perfectBlock ? 0xe0d0ff : 0xffe066);
        }
        if (state.tutorialTribulation.phase === 'aftermath') flowView?.dispatch({ type: 'finish-tribulation' });
        break;
      case 'move':
        if (state.tutorialTribulation.phase === 'active') move(action.direction);
        break;
    }

    saveState(state);
    refreshAppPresentation();
  }

  function dispatchGameCommand(command: GameCommand): void {
    audio.init();
    audio.resume();
    if (!flowAllowsWorldInput()) {
      if (command.kind === 'open' && navigateFromSystemMenu(command.target)) {
        saveState(state);
        refreshAppPresentation();
      }
      return;
    }
    if (state.gameOver || state.postAscension.mode === 'choice-pending') return;

    if (dialogueBeat && command.kind !== 'confirm' && command.kind !== 'cancel') return;
    if (paused && command.kind !== 'cancel' && !(command.kind === 'open' && (command.target === 'pause' || command.target === 'settings'))) return;

    switch (command.kind) {
      case 'move':
        if (!hotbarWheelBlocked() && !dialogueBeat) move(command.direction);
        break;
      case 'confirm':
        if (dialogueBeat) performDialogueConfirm();
        else if (!paused) performDefaultConfirm();
        break;
      case 'cancel':
        cancelCurrentSurface();
        break;
      case 'cycle':
        if (interactionPanelActive(interactionPanel)) cycleActiveInteractionPanel(command.direction === 'previous');
        else if (locationSelectionActive) cycleLocation(command.direction === 'previous');
        else if (!hotbarWheelBlocked()) cycleHotbar(command.direction === 'previous' ? -1 : 1, true);
        break;
      case 'hotbar':
        if (!hotbarWheelBlocked()) setHotbarIndex(command.index, true);
        break;
      case 'open':
        switch (command.target) {
          case 'menu':
            if (!paused) openFarmActionPanel();
            break;
          case 'inventory':
            if (!paused && flowView) flowView.dispatch({ type: 'open-overlay', overlay: 'inventory', returnFocus: APP_FLOW_FOCUS_TARGETS.world });
            else if (!paused) toggleInventoryVisibility();
            break;
          case 'cultivation':
            if (!paused && flowView) flowView.dispatch({ type: 'open-overlay', overlay: 'cultivation', returnFocus: APP_FLOW_FOCUS_TARGETS.world });
            else if (!paused) toggleCultivationPanel();
            break;
          case 'map':
            if (!paused && flowView) flowView.dispatch({ type: 'open-overlay', overlay: 'map', returnFocus: APP_FLOW_FOCUS_TARGETS.world });
            else if (!paused) activateLocationSelection('地点');
            break;
          case 'alchemy':
            if (!paused && flowView) flowView.dispatch({ type: 'open-alchemy' });
            else if (!paused && !furnace.visible) performFurnaceShortcut('toggle-furnace');
            break;
          case 'journey':
            if (!paused) performJourneyPrimaryAction();
            break;
          case 'pause':
          case 'settings':
            if (flowView) flowView.dispatch({ type: 'open-overlay', overlay: command.target, returnFocus: APP_FLOW_FOCUS_TARGETS.world });
            else togglePause(true);
            break;
        }
        break;
      case 'end-day':
        if (!hotbarWheelBlocked() && !dialogueBeat) endDay();
        break;
    }

    saveState(state);
    refreshAppPresentation();
  }

  const portraitMedia = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
  flowView = createAppFlowViewController({
    continueAvailable: deriveSaveHealthPresentation(saveHealth).continueAvailable,
    buildLabel: BUILD_LABEL,
    buildTitle: BUILD_TITLE,
    onReloadRequest: () => window.location.reload(),
    onStateChange: handleFlowStateChange
  });
  const handlePortraitChange = (event: MediaQueryListEvent): void => {
    flowView?.setPortraitBlocked(event.matches);
    requestRender?.();
    refreshAppPresentation();
  };
  const handleViewportResize = (): void => {
    requestRender?.();
    refreshAppPresentation();
  };
  portraitMedia.addEventListener('change', handlePortraitChange);
  window.addEventListener('resize', handleViewportResize);

  responsiveShell = createResponsiveShell({ dispatch: dispatchGameCommand });
  publicDemoPanels = createPublicDemoPanelsController({ onAction: handlePublicDemoPanelAction });
  publicDemoPanels.render(state, ctx);

  refreshHotbarHint();
  refreshHelpHint();
  refreshAppPresentation();

  window.addEventListener(
    'wheel',
    ev => {
      if (!flowAllowsWorldInput()) return;
      if (state.gameOver || dialogueBeat || state.postAscension.mode === 'choice-pending' || hotbarWheelBlocked()) return;
      const delta = hotbarWheelDelta(ev.deltaY);
      if (delta === 0) return;
      cycleHotbar(delta, true);
      ev.preventDefault();
    },
    { passive: false }
  );

  app.canvas.addEventListener('contextmenu', ev => {
    ev.preventDefault();
  });

  app.canvas.addEventListener('mousedown', ev => {
    if (ev.button !== 0 && ev.button !== 2) return;
    audio.init();
    audio.resume();
    if (!flowAllowsWorldInput()) {
      ev.preventDefault();
      return;
    }
    if (state.gameOver || state.postAscension.mode === 'choice-pending') {
      ev.preventDefault();
      return;
    }
    if (dialogueBeat) {
      if (ev.button === 0 && performDialogueConfirm()) saveState(state);
      ev.preventDefault();
      return;
    }
    if (paused) {
      if (ev.button === 2) {
        togglePause(true);
        saveState(state);
      }
      ev.preventDefault();
      return;
    }
    if (blockingOverlayActive()) {
      if (ev.button === 2) {
        const escapeShortcut = resolveEscapeShortcut({
          interactionPanelActive: interactionPanelActive(interactionPanel),
          inventoryVisible: layers.showInv,
          cultivationPanelVisible,
          locationSelectionActive
        });
        if (escapeShortcut != null) {
          performEscapeShortcutAction(escapeShortcut);
          saveState(state);
        }
      }
      ev.preventDefault();
      return;
    }
    if (ev.button === 2 && (interactionPanelActive(interactionPanel) || locationSelectionActive)) {
      const escapeShortcut = resolveEscapeShortcut({
        interactionPanelActive: interactionPanelActive(interactionPanel),
        inventoryVisible: layers.showInv,
        cultivationPanelVisible,
        locationSelectionActive
      });
      if (escapeShortcut != null) performEscapeShortcutAction(escapeShortcut);
      saveState(state);
      refreshAppPresentation();
      ev.preventDefault();
      return;
    }
    if (ev.button === 0) {
      performDefaultConfirm();
      saveState(state);
      ev.preventDefault();
      return;
    }
    if (performSecondaryToolInteraction()) {
      saveState(state);
      ev.preventDefault();
      return;
    }
    const escapeShortcut = resolveEscapeShortcut({
      interactionPanelActive: interactionPanelActive(interactionPanel),
      inventoryVisible: layers.showInv,
      cultivationPanelVisible,
      locationSelectionActive
    });
    if (escapeShortcut != null) performEscapeShortcutAction(escapeShortcut);
    saveState(state);
    ev.preventDefault();
  });

  window.addEventListener('keydown', ev => {
    audio.init();
    audio.resume();
    if (!flowAllowsWorldInput()) return;
    if (state.gameOver) return;
    if (state.postAscension.mode === 'choice-pending') {
      if (ev.key === '1') {
        resolveAscensionChoice(state, 'ascend-away');
        audio.playSfx('ending');
        audio.setBgmMode('off');
        {
          const presentation = tribulationEndingToastPresentation('ascension');
          toast(presentation.message, presentation.assetId);
        }
      } else if (ev.key === '2') {
        resolveAscensionChoice(state, 'stay-in-world');
        audio.playSfx('ui');
        {
          const presentation = tribulationEndingToastPresentation('stay-in-world', farmsteadRootContextAssetId(state));
          toast(presentation.message, presentation.assetId);
        }
      }
      ev.preventDefault();
      saveState(state);
      return;
    }
    // 叙事对白为模态：打开时吞键，并沿用空格/E/回车主确认语义推进并标记已见（T4）
    if (dialogueBeat) {
      if (ev.key === ' ' || ev.key === 'e' || ev.key === 'E' || ev.key === 'Enter') {
        if (performDialogueConfirm()) saveState(state);
      }
      ev.preventDefault();
      return;
    }
    if (paused) {
      if (ev.key === 'p' || ev.key === 'P' || ev.key === 'Escape') {
        togglePause(true);
        ev.preventDefault();
        saveState(state);
      }
      return;
    }
    const semanticCommand = gameCommandFromKeyboard(
      {
        key: ev.key,
        code: ev.code,
        shiftKey: ev.shiftKey,
        ctrlKey: ev.ctrlKey,
        altKey: ev.altKey,
        metaKey: ev.metaKey
      },
      { enterBehavior: interactionPanelActive(interactionPanel) || locationSelectionActive ? 'confirm' : 'end-day' }
    );
    const semanticCommandAllowed = semanticCommand?.kind !== 'hotbar' || (!interactionPanelActive(interactionPanel) && !locationSelectionActive);
    if (semanticCommand && semanticCommandAllowed) {
      dispatchGameCommand(semanticCommand);
      ev.preventDefault();
      return;
    }
    const f = frontTile();
    const farmActionShortcut = resolveFarmActionShortcut(ev.key, Boolean(ev.shiftKey));
    const locationShortcut = resolveLocationServiceShortcut(ev.key, Boolean(state.activeEvent));
    const legacyConfirmShortcut = resolveLegacyConfirmShortcut(ev.key, Boolean(ev.ctrlKey));
    const quickLocationShortcut = resolveQuickLocationShortcut(ev.key, Boolean(ev.altKey));
    const primaryInteractionShortcut = resolvePrimaryInteractionShortcut({
      key: ev.key,
      shiftKey: Boolean(ev.shiftKey),
      quickLocationShortcut
    });
    const enterShortcut =
      ev.key === 'Enter'
        ? resolveEnterShortcut({
            ctrlKey: Boolean(ev.ctrlKey),
            interactionPanelActive: interactionPanelActive(interactionPanel),
            locationSelectionActive
          })
        : null;
    const digitShortcut = resolveDigitShortcut({
      key: ev.key,
      code: ev.code,
      shiftKey: Boolean(ev.shiftKey),
      farmActionPanelActive: interactionPanel.kind === 'farm-action',
      locationSelectionActive
    });
    const farmMenuShortcut = resolveFarmMenuShortcut(ev.key, Boolean(ev.shiftKey));
    const pageUpShortcut = resolvePageUpShortcut(ev.key, Boolean(ev.shiftKey));
    const pageDownShortcut = resolvePageDownShortcut({
      key: ev.key,
      shiftKey: Boolean(ev.shiftKey),
      interactionPanelKind: interactionPanel.kind,
      interactionPanelActive: interactionPanelActive(interactionPanel)
    });
    const commandShortcut = resolveCommandShortcut(ev.key, Boolean(ev.shiftKey));
    const explorationKey = ev.code === 'Semicolon' ? 'Semicolon' : ev.key;
    const explorationLocationShortcut = resolveExplorationLocationShortcut(explorationKey, Boolean(ev.shiftKey));
    const worldActionShortcut = resolveWorldActionShortcut(ev.key, Boolean(ev.shiftKey));
    const legacyBuildShortcut = resolveLegacyBuildShortcut(ev.key, Boolean(ev.shiftKey));
    const tabShortcut =
      ev.key === 'Tab'
        ? resolveTabShortcut({
            interactionPanelActive: interactionPanelActive(interactionPanel),
            locationSelectionActive,
            shiftKey: Boolean(ev.shiftKey)
          })
        : null;
    const escapeShortcut =
      ev.key === 'Escape'
        ? resolveEscapeShortcut({
            interactionPanelActive: interactionPanelActive(interactionPanel),
            inventoryVisible: layers.showInv,
            cultivationPanelVisible,
            locationSelectionActive
          })
        : null;
    const qShortcut =
      ev.key === 'q' || ev.key === 'Q'
        ? resolveQShortcut({
            ctrlKey: Boolean(ev.ctrlKey),
            shiftKey: Boolean(ev.shiftKey),
            quickLocationShortcut
          })
        : null;
    if (blockingOverlayActive()) {
      switch (ev.key) {
        case 'Tab':
          if (tabShortcut === 'toggle-inventory') toggleInventoryVisibility();
          break;
        case 'Escape':
          if (escapeShortcut != null) performEscapeShortcutAction(escapeShortcut);
          break;
        case 'c':
        case 'C':
          if (worldActionShortcut === 'toggle-cultivation-panel') toggleCultivationPanel();
          break;
        case 'i':
          if (worldActionShortcut === 'toggle-inventory') toggleInventoryVisibility();
          break;
        case 'p':
        case 'P':
          if (commandShortcut === 'toggle-pause') performCommandShortcut(commandShortcut);
          break;
        default:
          ev.preventDefault();
          refreshAppPresentation();
          return;
      }
      ev.preventDefault();
      saveState(state);
      refreshAppPresentation();
      return;
    }
    const farmActionDigit = interactionPanel.kind === 'farm-action' ? farmActionIndexFromDigitKey(ev.key) : null;
    const npcActionDigit = interactionPanel.kind === 'npc-action' ? npcActionIndexFromDigitKey(ev.key) : null;
    const locationDigit = locationSelectionActive ? locationIndexFromDigitCode(ev.code) : null;
    const locationServiceDigit = locationSelectionActive ? locationServiceIndexFromDigitKey(ev.key) : null;
    const shouldDismissInteractionPanel =
      interactionPanelActive(interactionPanel) &&
      !shouldPreserveInteractionPanelForKey({
        key: ev.key,
        isModifierOnly: isModifierOnlyKey(ev.key),
        farmActionDigitActive: farmActionDigit != null,
        npcActionDigitActive: npcActionDigit != null,
        primaryInteractionShortcut,
        enterShortcut,
        escapeShortcut,
        tabShortcut,
        pageDownShortcut,
        commandShortcut,
        farmMenuShortcut
      });
    if (shouldDismissInteractionPanel) {
      clearInteractionPanel(false);
      ev.preventDefault();
      refreshAppPresentation();
      saveState(state);
      return;
    }
    const shouldDismissLocationSelection =
      locationSelectionActive &&
      !shouldPreserveLocationSelectionForKey({
        key: ev.key,
        isModifierOnly: isModifierOnlyKey(ev.key),
        locationDigitActive: locationDigit != null,
        locationServiceDigitActive: locationServiceDigit != null,
        primaryInteractionShortcut,
        enterShortcut,
        escapeShortcut,
        tabShortcut,
        commandShortcut
      });
    if (shouldDismissLocationSelection) {
      clearLocationSelection(false);
      ev.preventDefault();
      refreshAppPresentation();
      saveState(state);
      return;
    }
    if (ev.code === 'Semicolon' && explorationLocationShortcut) {
      if (!focusLocationService(explorationLocationShortcut.locationId, explorationLocationShortcut.command)) {
        const presentation = locationShortcutFailureToastPresentation(explorationLocationShortcut.locationId, state, explorationLocationShortcut.command);
        toast(presentation.message, presentation.assetId);
      }
      ev.preventDefault();
      saveState(state);
      refreshAppPresentation();
      return;
    }
    switch (ev.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        if ((ev.key === 'w' || ev.key === 'W') && quickLocationShortcut === 'tea-shed') {
          if (!openQuickLocationService(quickLocationShortcut)) {
            const presentation = quickServiceUnavailableToastPresentation('tea-shed', false, state);
            toast(presentation.message, presentation.assetId);
          }
          break;
        }
        move('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        move('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        move('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        move('right');
        break;
      case ' ':
      case 'e':
      case 'E':
        switch (primaryInteractionShortcut) {
          case 'quick-greenhouse':
            if (!openQuickLocationService('greenhouse')) {
              const presentation = quickServiceUnavailableToastPresentation('greenhouse', false, state);
              toast(presentation.message, presentation.assetId);
            }
            break;
          case 'ascend-pill':
            eatById('pill.ascend', '飞升丹'); // 飞升前夜（stage7）服用通关；未达则拒服不消耗
            break;
          case 'default-confirm':
            performDefaultConfirm();
            break;
        }
        break;
      case 'z':
      case 'Z': {
        // 播种
        if (worldActionShortcut === 'seed-from-hotbar') sowFromHotbarSelection(false);
        break;
      }
      case 'x':
      case 'X': // 浇水
        if (worldActionShortcut === 'water-front-tile') {
          performFarmAction('water', f);
        }
        break;
      case 'Home': {
        // 施肥
        if (worldActionShortcut === 'fertilize-front-tile') {
          performFertilizeAction(f, 'item.spirit-compost');
        }
        break;
      }
      case 'c':
      case 'C':
        if (worldActionShortcut === 'toggle-cultivation-panel') toggleCultivationPanel();
        break;
      case 'v':
      case 'V': // 收获
        if (worldActionShortcut === 'harvest-front-tile') {
          performFarmAction('harvest', f);
        }
        break;
      case '0':
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        if (interactionPanel.kind === 'npc-action') {
          const actionIdx = npcActionIndexFromDigitKey(ev.key);
          if (actionIdx == null) break;
          npcActionIdx = normalizeSelection(actionIdx, NPC_ACTION_ORDER.length);
          const mode = NPC_ACTION_ORDER[npcActionIdx] ?? NPC_ACTION_ORDER[0];
          openNpcPanel(mode);
          break;
        }
        switch (digitShortcut) {
          case 'farm-action-select': {
            const actionIdx = farmActionIndexFromDigitKey(ev.key);
            if (actionIdx == null) break;
            farmActionIdx = normalizeSelection(actionIdx, FARM_ACTION_ORDER.length);
            openFarmActionPanel();
            break;
          }
          case 'location-select': {
            if (locationDigit == null) break;
            selectLocationByDigit(locationDigit);
            break;
          }
          case 'location-service-select': {
            const serviceIdx = locationServiceIndexFromDigitKey(ev.key);
            if (serviceIdx == null) break;
            const locations = getActiveLocationDirectory(state);
            if (locations.length === 0) {
              const presentation = locationDirectoryEmptyToastPresentation(locationSelectionContextAssetId() ?? farmsteadRootContextAssetId(state));
              toast(presentation.message, presentation.assetId);
              break;
            }
            const location = locations[locationIdx % locations.length]!;
            const services = getLocationServiceOptions(state, location.id);
            if (services.length === 0) {
              const presentation = locationServiceUnavailableToastPresentation(location, state);
              toast(presentation.message, presentation.assetId);
              break;
            }
            locationServiceIdx = normalizeSelection(serviceIdx, services.length);
            activateLocationSelection('服务');
            break;
          }
          case 'hotbar-select': {
            const idx = hotbarIndexFromDigitKey(ev.key);
            if (idx == null) break;
            setHotbarIndex(idx, true);
            break;
          }
        }
        break;
      }
      case '$':
      case '%':
      case '^':
      case '&':
      case '*':
      case '(': {
        if (digitShortcut === 'location-select' && locationDigit != null) selectLocationByDigit(locationDigit);
        break;
      }
      case 'Enter':
        switch (enterShortcut) {
          case 'confirm-location-service':
            performDefaultConfirm();
            break;
          case 'confirm-interaction-panel':
            confirmInteractionPanel();
            break;
          case 'end-day':
            endDay();
            break;
        }
        break;
      case 't':
        if (worldActionShortcut === 'tribulation') tryTribulation();
        break;
      case 'g': {
        if (worldActionShortcut === 'feed-guard-beast') {
          const choices = guardFeedChoices();
          if (state.guardBeasts.length === 0) {
            const presentation = guardBeastFeedFailureToastPresentation('no-guard-beast');
            toast(presentation.message, presentation.assetId);
            break;
          }
          if (choices.length === 0) {
            const presentation = guardBeastFeedFailureToastPresentation('no-herb');
            toast(presentation.message, presentation.assetId);
            break;
          }
          const choice = choices[0]!;
          const eventStart = state.events.length;
          applyAction(state, { kind: 'feed-guard-beast', herbItemId: choice.itemId }, ctx);
          const fed = state.events.slice(eventStart).find(e => e.type === 'guard-beast-fed');
          if (fed) {
            const payload = fed.payload as { id?: number; vigor?: number; bond?: number };
            const presentation = guardBeastFeedResultToastPresentation({ ...choice, count: 1 }, { beastId: payload.id, vigor: payload.vigor, bond: payload.bond }, reg);
            audio.playSfx('ui');
            toast(presentation.message, presentation.assetId);
          } else {
            const presentation = guardBeastFeedFailureToastPresentation('failed');
            toast(presentation.message, presentation.assetId);
          }
          break;
        }
        if (worldActionShortcut === 'hunt-beast') {
          const beastsBefore = state.beastSurge?.beastsRemaining ?? 0;
          const eventStart = state.events.length;
          applyAction(state, { kind: 'hunt-beast' }, ctx);
          if (beastsBefore === 0) {
            const presentation = beastHuntUnavailableToastPresentation();
            toast(presentation.message, presentation.assetId);
            break;
          }
          const actionEvents = state.events.slice(eventStart);
          for (const sfxId of actionSfxQueue(actionEvents)) audio.playSfx(sfxId);
          const presentation = beastHuntResultToastPresentation(actionEvents, reg);
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case '!':
        if (digitShortcut === 'location-select' && locationDigit != null) {
          selectLocationByDigit(locationDigit);
          break;
        }
        if (worldActionShortcut === 'train-push-up') {
          applyAction(state, { kind: 'train', method: 'push-up' }, ctx);
          const presentation = bodyTrainingToastPresentation('push-up');
          toast(presentation.message, presentation.assetId);
        }
        break;
      case '@':
        if (digitShortcut === 'location-select' && locationDigit != null) {
          selectLocationByDigit(locationDigit);
          break;
        }
        if (worldActionShortcut === 'train-sit-up') {
          applyAction(state, { kind: 'train', method: 'sit-up' }, ctx);
          const presentation = bodyTrainingToastPresentation('sit-up');
          toast(presentation.message, presentation.assetId);
        }
        break;
      case '#':
        if (digitShortcut === 'location-select' && locationDigit != null) {
          selectLocationByDigit(locationDigit);
          break;
        }
        if (worldActionShortcut === 'train-squat') {
          applyAction(state, { kind: 'train', method: 'squat' }, ctx);
          const presentation = bodyTrainingToastPresentation('squat');
          toast(presentation.message, presentation.assetId);
        }
        break;
      case ')':
        if (digitShortcut === 'location-select' && locationDigit != null) {
          selectLocationByDigit(locationDigit);
          break;
        }
        if (worldActionShortcut === 'train-long-run') {
          applyAction(state, { kind: 'train', method: 'long-run' }, ctx);
          const presentation = bodyTrainingToastPresentation('long-run');
          toast(presentation.message, presentation.assetId);
        }
        break;
      case 'b': {
        if (worldActionShortcut === 'brew-selected-recipe') {
          const rr = reg.recipes.get(brewRecipes[recipeIdx % brewRecipes.length]!);
          brewById(rr?.id ?? 'recipe.ward-pill', rr?.displayName ?? '避雷丹');
        }
        break;
      }
      case 'n':
        if (worldActionShortcut === 'brew-bone-pill') brewById('recipe.bone-pill', '生骨丹');
        break;
      case 'm':
        if (worldActionShortcut === 'brew-detox-pill') brewById('recipe.detox-pill', '净毒丹');
        break;
      case 'h':
        if (worldActionShortcut === 'eat-ward-pill') eatById('pill.ward-basic', '避雷丹');
        break;
      case 'j':
        if (worldActionShortcut === 'eat-bone-pill') eatById('pill.bone-basic', '生骨丹');
        break;
      case 'k':
        if (worldActionShortcut === 'eat-detox-pill') eatById('pill.detox', '净毒丹');
        break;
      case 'r': {
        if (worldActionShortcut === 'place-lightning-rod-array') {
          const ft = frontTile();
          const r = placeArray(state, 'array.lightning-rod', ft.x, ft.y, ctx);
          const presentation = arrayPlacementToastPresentation('lightning-rod', {
            placed: r.placed,
            reason: r.reason,
            costText: describeArrayBuildCost('array.lightning-rod')
          });
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case 'f': {
        if (worldActionShortcut === 'place-insulation-array') {
          const ft = frontTile();
          const r = placeArray(state, 'array.insulation', ft.x, ft.y, ctx);
          const presentation = arrayPlacementToastPresentation('insulation', {
            placed: r.placed,
            reason: r.reason,
            costText: describeArrayBuildCost('array.insulation')
          });
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case 'i':
        if (worldActionShortcut === 'toggle-inventory') toggleInventoryVisibility();
        break;
      case 'M': {
        if (farmMenuShortcut === 'open-farm-menu') openFarmActionPanel();
        break;
      }
      case 'F5': {
        switch (legacyBuildShortcut) {
          case 'open-furnace-build-menu':
            farmActionIdx = FARM_ACTION_ORDER.indexOf('build');
            facilityBuildIdx = facilityBuildChoices.indexOf('talisman-furnace');
            openFarmActionPanel();
            break;
          case 'preselect-build':
            preselectFarmActionKind('build');
            break;
        }
        break;
      }
      case 'F1':
      case 'F2':
      case 'F3':
      case 'F4':
      case 'F6':
      case 'F7':
      case 'F8':
      case 'F9':
      case 'F10':
      case 'F11':
      case 'F12':
      case 'Insert':
      case 'Delete': {
        if (!farmActionShortcut) break;
        preselectFarmActionKind(farmActionShortcut.kind);
        break;
      }
      case 'o':
      case 'O':
      case ',': {
        if (!locationShortcut) break;
        if (!focusLocationService(locationShortcut.locationId, locationShortcut.command)) {
          const presentation = locationShortcutFailureToastPresentation(locationShortcut.locationId, state, locationShortcut.command);
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case 'p': {
        if (commandShortcut === 'toggle-pause') performCommandShortcut(commandShortcut);
        break;
      }
      case 'P':
      case '.': {
        if (commandShortcut === 'toggle-pause') {
          performCommandShortcut(commandShortcut);
          break;
        }
        if (commandShortcut === 'legacy-confirm' && legacyConfirmShortcut === 'period') performLegacyConfirmShortcut();
        break;
      }
      case ';':
      case 'Semicolon':
      case 'l': {
        if (!explorationLocationShortcut) break;
        if (!focusLocationService(explorationLocationShortcut.locationId, explorationLocationShortcut.command)) {
          const presentation = locationShortcutFailureToastPresentation(explorationLocationShortcut.locationId, state, explorationLocationShortcut.command);
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case '/': {
        if (!explorationLocationShortcut) break;
        if (!focusLocationService(explorationLocationShortcut.locationId, explorationLocationShortcut.command)) {
          const presentation = locationShortcutFailureToastPresentation(explorationLocationShortcut.locationId, state, explorationLocationShortcut.command);
          toast(presentation.message, presentation.assetId);
        }
        break;
      }
      case '=': {
        if (commandShortcut === 'open-upgrade-panel') performCommandShortcut(commandShortcut);
        break;
      }
      case '-': {
        if (commandShortcut === 'open-npc-browse') performCommandShortcut(commandShortcut);
        break;
      }
      case '\\': {
        if (commandShortcut === 'open-npc-gift') performCommandShortcut(commandShortcut);
        break;
      }
      case '|': {
        if (commandShortcut === 'open-npc-quest') performCommandShortcut(commandShortcut);
        break;
      }
      case 'PageUp': {
        if (pageUpShortcut) performPageUpShortcut(pageUpShortcut);
        break;
      }
      case 'PageDown': {
        if (pageDownShortcut) performPageDownShortcut(pageDownShortcut);
        break;
      }
      case 'End': {
        if (commandShortcut === 'open-festival-panel') performCommandShortcut(commandShortcut);
        break;
      }
      case '?': {
        if (commandShortcut === 'show-calendar-summary') performCommandShortcut(commandShortcut);
        break;
      }
      case 'Tab': {
        switch (tabShortcut) {
          case 'cycle-interaction-panel':
            cycleActiveInteractionPanel(Boolean(ev.shiftKey));
            break;
          case 'cycle-location':
            cycleLocation(false);
            break;
          case 'cycle-location-service':
            cycleLocationService();
            break;
          case 'toggle-inventory':
            toggleInventoryVisibility();
            break;
        }
        break;
      }
      case 'Escape': {
        if (escapeShortcut != null) performEscapeShortcutAction(escapeShortcut);
        break;
      }
      case 'u':
        if (worldActionShortcut === 'toggle-furnace') performFurnaceShortcut(worldActionShortcut);
        break;
      case 'y': {
        if (worldActionShortcut === 'cycle-recipe') performFurnaceShortcut(worldActionShortcut);
        break;
      }
      case 'q':
      case 'Q':
        if (qShortcut) performQShortcut(qShortcut);
        break;
      case '[':
        if (worldActionShortcut === 'decrease-furnace-heat') performFurnaceShortcut(worldActionShortcut);
        break;
      case ']':
        if (worldActionShortcut === 'increase-furnace-heat') performFurnaceShortcut(worldActionShortcut);
        break;
      default:
        return;
    }
    ev.preventDefault();
    saveState(state);
    refreshAppPresentation();
  });

  function renderFrame(timestamp: number): void {
    const worldSurfaceActive = flowAllowsWorldInput();
    layers.ambientTimeMs = worldSurfaceActive ? timestamp : 0;
    drawWorld(layers, state, reg, ctx, renderAssets);
    const hotbarSlot = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    drawHotbarIcon(layers, renderAssets.hotbarIcons[hotbarSlotAssetId(hotbarSlot) ?? '']);
    refreshHelpHint();
    const focusedOverlayActive = !worldSurfaceActive || locationSelectionActive || interactionPanelActive(interactionPanel) || layers.showInv || cultivationPanelVisible || paused || dialogueBeat !== null || state.postAscension.mode === 'choice-pending';
    if (!state.gameOver && !focusedOverlayActive) {
      const briefing = currentJourneyBriefing();
      // Canvas shows the compact primary line only; full detail lives in #objective-rail details.
      drawTodayBriefing(layers, briefing.title, briefing.compactBody, resolvePreviewTexture(renderAssets, briefing.assetId), briefing.assetId);
    } else {
      hideTodayBriefing(layers);
    }
    if (worldSurfaceActive && locationSelectionActive) {
      const preview = locationPreviewDetails();
      if (preview) drawLocationPreview(layers, preview.title, preview.details, preview.texture, preview.npcPrimary, preview.npcSecondary);
      else hideLocationPreview(layers);
    } else {
      hideLocationPreview(layers);
    }
    const panelPreview = worldSurfaceActive && !paused && dialogueBeat === null && !cultivationPanelVisible && (interactionPanelActive(interactionPanel) || layers.showInv) ? selectedPanelItemPreview() : null;
    if (panelPreview) drawPanelItemPreview(layers, panelPreview.title, panelPreview.details, panelPreview.texture);
    else hidePanelItemPreview(layers);
    if (worldSurfaceActive && cultivationPanelVisible) {
      refreshCultivationPanel();
      layers.cultivation.visible = true;
    }
    updateParticles(layers); // 程序化粒子推进（T9）
    updateFloatTexts(layers); // 农务/天劫飘字
    // 丹炉面板（可见时 resolveBrew 实时预览当前火候+丹方的产出）
    const fr = worldSurfaceActive && furnace.visible ? reg.recipes.get(brewRecipes[recipeIdx % brewRecipes.length]!) : null;
    if (fr) {
      const preview = resolveBrew(state, { materials: fr.inputs.map(i => ({ herbId: i.herbId, qty: i.qty })), avgHeatMilli: furnaceHeat * 1000 }, ctx);
      const pillName = reg.items.get(fr.outputPillId)?.displayName ?? fr.outputPillId;
      const haveInputs = fr.inputs.map(inp => ({ name: reg.items.get(inp.herbId)?.displayName ?? inp.herbId, have: itemCount(state.player, inp.herbId), need: inp.qty }));
      drawFurnace(furnace, state, reg, { recipe: fr, heat: furnaceHeat, preview, pillName, haveInputs }, renderAssets.itemIcons);
    } else {
      drawFurnace(furnace, state, reg, null);
    }
    // 叙事节拍（T4）：无对白时寻找下一待浮现节拍；游戏结束清空
    // 纵切片完成后抑制 day-1 教学对白（first-till / first-mature），避免残影重现。
    if (worldSurfaceActive && !state.gameOver) {
      if (!dialogueBeat) {
        const teachingActive = isJourneyTeachingActive(getPublicDemoObjectiveId(state));
        const nextBeat = nextPendingBeat(state);
        if (nextBeat && (teachingActive || !isJourneyTeachingDialogueBeat(nextBeat.id))) {
          openDialogueBeat(nextBeat);
        } else if (nextBeat && !teachingActive && isJourneyTeachingDialogueBeat(nextBeat.id)) {
          markSeen(state, nextBeat.id);
        }
      } else if (!isJourneyTeachingActive(getPublicDemoObjectiveId(state)) && isJourneyTeachingDialogueBeat(dialogueBeat.id)) {
        markSeen(state, dialogueBeat.id);
        dialogueBeat = null;
      }
    } else if (state.gameOver) {
      dialogueBeat = null;
    }
    if (worldSurfaceActive && paused) drawPauseOverlay(layers);
    else if (worldSurfaceActive && dialogueBeat) drawDialogue(layers, dialogueBeat.lines, resolvePreviewTexture(renderAssets, dialogueBeat.assetId));
    else hideDialogue(layers);
    refreshAppPresentation();
    // BGM 自适应（Tone.js 四季调色板）：季节=state.season，分区=引劫在即→tribulation 否则 farm，张力随突破临近 calm→tense。
    const tense = readyForBreakthrough(state, DEFAULT_BALANCE);
    audio.setMusicContext({
      season: state.season,
      zone: tense ? 'tribulation' : 'farm',
      tension: tense ? 'tense' : 'calm',
      active: !state.gameOver
    });
    app.renderer.render(app.stage);
  }

  app.ticker.stop();
  renderScheduler = createRenderScheduler({
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: handle => window.cancelAnimationFrame(handle as number),
    onFrame: frame => {
      renderFrame(frame.timestamp);
      const worldSurfaceActive = flowAllowsWorldInput();
      return {
        particlesActive: worldSurfaceActive || layers.particleList.length > 0 || layers.floatTexts.length > 0,
        flashActive: layers.tribFlashTtl > 0 || layers.tribBoltTtl > 0 || layers.shakeTtl > 0
      };
    }
  });
  requestRender = () => renderScheduler?.invalidate('world', 'hud', 'focus', 'toast', 'effects');
  window.addEventListener(
    'pagehide',
    () => {
      portraitMedia.removeEventListener('change', handlePortraitChange);
      window.removeEventListener('resize', handleViewportResize);
      responsiveShell?.destroy();
      publicDemoPanels?.destroy();
      flowView?.destroy();
      runtimeSettingsAbortController.abort();
      renderScheduler?.dispose();
    },
    { once: true }
  );
  requestRender();

  {
    const presentation = onboardingWelcomeToastPresentation(currentOnboardingHelpText());
    toast(presentation.message, presentation.assetId);
  }
  flowView.dispatch({ type: 'boot-ready' });
  updateSaveHealthUi();
  flowView.setPortraitBlocked(portraitMedia.matches);
}

void main().catch(error => {
  const loading = document.querySelector<HTMLElement>('[data-app-surface="loading"]');
  const errorSurface = document.querySelector<HTMLElement>('[data-app-surface="boot-error"]');
  if (loading) {
    loading.hidden = true;
    loading.inert = true;
    loading.setAttribute('aria-hidden', 'true');
  }
  if (errorSurface) {
    errorSurface.hidden = false;
    errorSurface.inert = false;
    errorSurface.setAttribute('aria-hidden', 'false');
    errorSurface.querySelector<HTMLElement>('[data-flow-focusable]')?.focus({ preventScroll: true });
  }
  document.querySelector<HTMLButtonElement>('[data-flow-action="reload-page"]')?.addEventListener('click', () => window.location.reload(), { once: true });
  console.error('Aeon Vale initialization failed.', error);
});
