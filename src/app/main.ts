/**
 * 应用入口：PixiJS v8 启动 + 输入 → sim 即时动作 + 过夜推进。
 * sim/render 解耦：本文件桥接 io(输入) → sim → render。
 * 启动：pnpm dev（当前以浏览器作为开发/测试/作品展示入口；游戏核心仍按离线单机、多端适配方向推进）。全程中文 UI（C8）。
 */
import { Application, Assets, Texture } from 'pixi.js';
import { createWorld, createSimContext, createSimContextFromState, DEFAULT_BALANCE, ARRAY_BUILD_COSTS, FACILITY_BUILD_COSTS, FACILITY_LABEL, FACILITY_EXPANSION_REQUIREMENT, LOCATION_CATALOG, applyAction, applyMvpStarterKit, startPurpleOmenIfDue, advanceDay, applyPill, brewPills, brewTutorialWardPill, placeArray, checkGameEnd, canShipItem, shippingUnitPrice, getTradeOffers, executeTrade, getShopItems, buyShopItem, getAvailableUpgrades, performUpgrade, getNpcList, bestGiftItemForNpc, getActiveSpecialOrders, getCurrentMainlineQuest, getCurrentNpcQuest, getCurrentRuinChapter, getCurrentStayingWorldIncident, getDailyCommission, getDailySpecialOrder, getOnboardingObjectiveId, getPublicDemoObjectiveId, greenhouseClimate, greenhouseCareStreak, hasResolvedStayingWorldIncidentForDay, nextArchiveDonation, nextArchiveMilestone, recordTribulationInvocation, readyToInvokeTribulation, adjacentFacility, facilityAt, calendarEntriesForDay, upcomingCalendarEntries, getNpcDailySchedules, getFestivalStallItems, getActiveLocationDirectory, getGreenhouseRumor, greenhouseNurseryCapacity, greenhouseNurserySlotsRemaining, greenhouseNurseryTier, greenhouseProtectedCropCount, getLocationEncounters, getLocationServiceOptions, getPreferredLocationSelection, getQuickLocationServiceOption, getTeaShedRumor, locationIndexFromDigitCode, locationServiceIndexFromDigitKey, claimRelationshipEvent, resolveAscensionChoice, tendGreenhouse, visitTeaShed, facilityPlacementRuleText, farmExpansionTier, storageUsed, tileAt, groundItemAtIndex, placeGroundItem, FIRST_SECOND_WATER_FLAG, FIRST_SHIPMENT_FLAG, TUTORIAL_ALCHEMY_BREWED_FLAG, TUTORIAL_ALCHEMY_KIT_FLAG, TUTORIAL_TRIBULATION_BOLT_COUNT, type ArchiveDonationReward, type CalendarEntry, type FacilityKind, type GameState, type LocationId, type LocationServiceCommand, type SimContext, type UpgradeDef } from '@sim';
import { saveGame, deserializeState } from '@sim/serialize';
import { buildRegistry, isSchemaHashCompatible } from '@content/registry';
import { t, tList } from '@content/i18n';
import manifestJson from '../../assets/manifest.json';
import { itemCount } from '@sim/world/player';
import { dropInventoryItem, transferInventoryItem } from '@sim/inventory/transfers';
import { createLayers, drawWorld, setToast, setHotbar, setTextIfChanged, triggerTribFlash, triggerTribBolt, triggerShake, drawDialogue, hideDialogue, drawPauseOverlay, renderCultivationOverview, screenPointForTile, tileCoordinatesFromScreenPoint, spawnBurst, spawnFloatText, updateParticles, updateFloatTexts, drawLocationPreview, hideLocationPreview, drawHotbarIcon, drawPanelItemPreview, hidePanelItemPreview, hideTodayBriefing, PANEL_PREVIEW_BOX, LOCATION_PREVIEW_BOX, itemPreviewBoxHeight, locationPreviewBoxHeight, locationPreviewMaxTextHeight, type PendingWorldVisual, type RenderLayers, type RuntimeRenderAssets } from '@render/renderer';
import { GUARD_BEAST_ASSET_IDS } from '@render/guardBeastPreview';
import { nextPendingBeat, markSeen, type NarrativeBeat } from '@content/narrative';
import { createTitleAmbience } from './titleAmbience';
import { createRenderScheduler, type RenderScheduler } from '@render/renderScheduler';
import { computeViewportLayout } from '@render/viewportLayout';
import { runTribulation } from '@sim/tribulation/tribulationSystem';
import { readyForBreakthrough, breakthrough, stageQiCap } from '@sim/progression/progression';
import type { Direction } from '@sim/world/types';
import type { Season } from '@sim/world/types';
import { AudioEngine, type SfxId } from '@io/audio';
import type { CropQuality } from '@sim/farm/quality';
import { HOTBAR_SLOTS, cycleHotbarIndex, findNextOwnedSeedHotbarIndex, hotbarIndexFromDigitKey, hotbarSlotAssetId, hotbarStatusText, hotbarToastPresentation, hotbarWheelDelta, ownedSeedHotbarIndex, type HotbarSlotKind } from './hotbar';
import { FARM_ACTION_ORDER, cycleSelection, farmActionIndexFromDigitKey, farmActionLabel, interactionPanelActive, isLocationActionPanelCommand, normalizeSelection, npcActionIndexFromDigitKey, selectionLabel, type FarmActionKind, type InteractionPanelState, type LocationActionPanelCommand } from './interactionPanels';
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
import { createInventoryUI, type InventoryAction, type InventoryActionFeedback, type InventoryUIController } from './inventoryUI';
import { arrayPlacementToastPresentation, cultivationPanelToastPresentation, deriveFarmActionOutcome, farmActionBlockedReason, farmActionBlockedToastPresentation, farmActionSuccessToastPresentation, fertilizeSuccessToastPresentation, overlayToastPresentation, restSuccessToastPresentation, snapshotFarmTiles, sowSuccessToastPresentation, sowUnavailableToastPresentation, type FarmActionFeedbackKind } from './actionFeedback';
import { bodyTrainingToastPresentation, brewMaterialFailureToastPresentation, facilityCollectFailureToastPresentation, facilityCollectResultToast, facilityCollectResultToastPresentation, facilityFailureToastPresentation, facilityJobStartToast, facilityJobStartToastPresentation, facilityStatusToastPresentation, firstHarvestMilestoneToast, firstHarvestMilestoneToastPresentation, firstShipmentMilestoneToast, firstShipmentMilestoneToastPresentation, guardBeastFeedFailureToastPresentation, guardBeastFeedResultToastPresentation, pillUseToastPresentation, shippingFailureToastPresentation, shippingResultToast, shippingResultToastPresentation, storageFailureToastPresentation, storageResultToast, storageResultToastPresentation } from './actionResultToast';
import { toolFeedbackToastPresentation } from './toolFeedback';
import { buildTodayBriefing } from './todayBriefing';
import { harvestFeedbackPresentation } from './harvestFeedback';
import { celestialCompassPresentation } from './celestialCompassPresentation';
import { tribulationPressurePresentation } from './tribulationPressurePresentation';
import { tribulationPrepStatusLine } from './tribulationPrepText';
import { ambientPanelPreview } from './ambientPanelPreview';
import { locationPreviewFocusReason } from './locationFocusReason';
import { farmsteadRootContextAssetId, getFarmsteadFocus } from './farmsteadFocus';
import { applyFarmsteadSceneLayout, farmsteadSceneObjectAt, farmsteadSceneObjectByKind, farmsteadSceneTileKind, firstFarmsteadFarmPlotTile, firstNonFarmsteadFarmPlotTile, frontFarmsteadSceneObject, isFarmsteadFarmPlotTile, type FarmsteadSceneObject, type FarmsteadSceneObjectKind, type FarmsteadSceneZoneKind } from './farmsteadScene';
import { inventoryPreviewSelection } from './inventoryPreview';
import { brewResultToastPresentation, dryingProcessingPanelPreview, processingPositionRequiredToastPresentation, processingRecipeUnavailableToastPresentation, processingToastPresentation, processingUnavailableToastPresentation, staticProcessingPanelPreview } from './processingPreview';
import { beastHuntResultToastPresentation, beastHuntUnavailableToastPresentation, explorationFailureToastPresentation, explorationResultToastPresentation, ruinDelveFailureToastPresentation, ruinDelveToastPresentation, tribulationBlockedToastPresentation, tribulationEndingToastPresentation, tribulationResultToastPresentation } from './explorationToast';
import { buildPanelPreview, buildResultToastPresentation, facilityCollectPanelPreview, facilityCollectToastPresentation, facilityCollectUnavailableToastPresentation, upgradePanelPreview, upgradeResultToastPresentation, upgradeToastPresentation, upgradeUnavailableToastPresentation } from './facilityPanelPreview';
import { shippingPanelPreview, shippingToastPresentation, shippingUnavailableToastPresentation, storagePanelPreview, storageToastPresentation, storageUnavailableToastPresentation } from './logisticsPanelPreview';
import { arraysServiceToastPresentation, farmWorkServiceToastPresentation, festivalPanelPreview, festivalResultToastPresentation, festivalToastPresentation, festivalUnavailableToastPresentation, greenhousePanelPreview, greenhouseResultToastPresentation, greenhouseToastPresentation, locationActionConfirmHint, locationActionPanelPreview, locationActionToastPresentation, processingServiceToastPresentation, quickServiceUnavailableToastPresentation, teaShedPanelPreview, teaShedResultToastPresentation, teaShedToastPresentation } from './servicePanelPreview';
import { shopPanelPreview, shopResultToastPresentation, shopToastPresentation, shopUnavailableToastPresentation, tradePanelPreview, tradeResultToastPresentation, tradeToastPresentation, tradeUnavailableToastPresentation } from './commercePanelPreview';
import { farmActionMenuPreview, farmActionMenuToastPresentation, npcActionMenuPreview, npcActionMenuToastPresentation, npcBrowsePanelPreview, npcBrowseToastPresentation, npcGiftPanelPreview, npcGiftResultToastPresentation, npcGiftToastPresentation, npcQuestPanelPreview, npcQuestResultToastPresentation, npcQuestToastPresentation, npcUnavailableToastPresentation } from './actionPanelPreview';
import { activeSpecialOrderPanelPreview, archiveDonationFailureToastPresentation, archiveDonationToastPresentation, archiveEmptyToastPresentation, archiveMilestoneFailureToastPresentation, archiveMilestoneToastPresentation, commissionBoardEmptyToastPresentation, commissionCompleteToastPresentation, commissionIncompleteToastPresentation, commissionToastPresentation, dailyCommissionPanelPreview, dailySpecialOrderPanelPreview, mainlineQuestClaimFailureToastPresentation, mainlineQuestClaimToastPresentation, mainlineQuestPanelPreview, mainlineQuestUnavailableToastPresentation, ruinChapterClaimFailureToastPresentation, ruinChapterClaimToastPresentation, ruinChapterPanelPreview, ruinChapterUnavailableToastPresentation, specialOrderAcceptFailureToastPresentation, specialOrderAcceptToastPresentation, specialOrderClaimFailureToastPresentation, specialOrderClaimToastPresentation, specialOrderPendingToastPresentation, specialOrderProgressToastPresentation, specialOrderSubmitFailureToastPresentation, stayingWorldIncidentPanelPreview, stayingWorldIncidentResolveFailureToastPresentation, stayingWorldIncidentResolveToastPresentation } from './commissionPreview';
import { resolvePreviewTexture } from './previewTexture';
import { buildEncounterDialogueBeat, buildRelationshipDialogueBeat, type DialogueBeatWithAsset } from './dialoguePreview';
import { buildJourneyGuide, formatJourneyGuideBody, isJourneyTeachingActive, isJourneyTeachingDialogueBeat, journeyGuideContextFromState } from './journeyGuide';
import { createResponsiveShell, type ResponsiveShellController } from './responsiveShell';
import { APP_FLOW_FOCUS_TARGETS, type AppFlowEvent, type AppFlowState, type AppFocusSelector, type AppOverlay } from './appFlowMachine';
import { createAppFlowViewController, type AppFlowViewController } from './appFlowView';
import { createPrologueVN, type PrologueVNController } from './prologueVN';
import { createNarrationIntro, type NarrationIntroController } from './narrationIntro';
import { createNarrationSurface, NARRATION_E7_FLAG_KEY, type NarrationSurfaceController } from './narrationSurface';
import { createRogueliteProtoSurface, type RogueliteProtoSurface } from './rogueliteProto/surface';
import { hasCultivationJourney } from './rogueliteProto/runSave';
import { createNarrationCodex, type NarrationCodexController } from './narrationCodex';
import { renderEndingSurface } from './endingSurface';
import { gameCommandFromKeyboard, type GameCommand } from './semanticInputRouter';
import { directionBetween, findGridPath, interactionAdjacentGoals, isAdjacentCardinal, playerMovementVisualPosition, sameGridPoint, type GridPoint, type PlayerMovementAnimation, type PlayerMovementVisual } from './worldMovement';
import { createPublicDemoPanelsController, type PublicDemoPanelAction, type PublicDemoPanelsController } from './publicDemoPanelsView';
import { buildPublicDemoAftermathView, buildPublicDemoTribulationView } from './publicDemoPanels';
import { deriveSemanticGameState, interactionPanelSemanticLabel, type SemanticWorldAttention } from './semanticGameState';
import { decodeStoredSave, deriveSaveHealthPresentation, saveHealthAfterClear, saveHealthAfterLoad, saveHealthAfterWrite, type SaveHealth } from './saveHealth';
import { DEFAULT_RUNTIME_SETTINGS, RUNTIME_SETTINGS_STORAGE_KEY, decodeRuntimeSettings, runtimeSettingsPersistenceText, serializeRuntimeSettings, type RuntimeSettings } from './runtimeSettings';
import { renderCultivationSurface, renderMapSurface } from './surfacePanels';
import { applyColorPaletteCssVariables, ColorPalette, cssColor } from '@render/ColorPalette';
import { locationWorldPreviewPlacementAt, locationWorldPreviewPlacements, npcWorldPreviewPlacementAt, npcWorldPreviewPlacements, type LocationWorldPreviewPlacement, type NpcWorldPreviewPlacement } from '@render/npcWorldPreview';

applyColorPaletteCssVariables(document.documentElement);
document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', cssColor('shellPine'));

type DirectFarmActionKind = Exclude<FarmActionFeedbackKind, 'sow' | 'fertilize'>;

type PointerWorldActionKind = 'none' | 'object' | 'build-place' | 'array-place' | 'farm-till' | 'farm-sow' | 'farm-water' | 'farm-harvest' | 'farm-channel-qi' | 'farm-stable' | 'pickup' | 'move' | 'blocked';

interface PendingWorldCommand {
  readonly target: GridPoint;
  readonly destination: GridPoint;
  readonly description: string;
  readonly run: () => boolean;
}

interface TerrainSemanticsKeypoint {
  tillableX: number;
  tillableY: number;
  plantableX: number;
  plantableY: number;
  blockedX: number;
  blockedY: number;
  selectedX: number;
  selectedY: number;
}

interface BuildArrayKeypoint {
  targetX: number;
  targetY: number;
  playerX: number;
  playerY: number;
  arrayDefId: 'array.lightning-rod' | 'array.insulation';
}

interface ArraySnapshot {
  count: number;
  defIds: string[];
  activeCount: number;
}

interface QiFlowKeypoint {
  lowX: number;
  lowY: number;
  highX: number;
  highY: number;
}

const RENDER_ASSET_LOAD_TIMEOUT_MS = 8_000;
const PLAYER_STEP_DURATION_MS = 420;

function useNearestScaleMode(assetId: string): boolean {
  return assetId.startsWith('sprite.') || assetId.startsWith('map-sprite.') || assetId.startsWith('icon.') || assetId.startsWith('inventory-icon.') || assetId.startsWith('facility.') || assetId.startsWith('loc.') || assetId.startsWith('tile.');
}

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
  const portraitIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('portrait.'));
  const mapSpriteIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('map-sprite.'));
  const mapIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('map.'));
  const inventoryIconIds = store
    .list('sprites')
    .map(entry => entry.id)
    .filter(id => id.startsWith('inventory-icon.'));
  const allNpcAssetIds = runtimeNpcAssetIds(store);
  const hotbarIconIds = [...new Set(HOTBAR_SLOTS.map(slot => hotbarSlotAssetId(slot)).filter((id): id is string => Boolean(id)))];

  const ids = [...new Set(['sprite.player', ...GUARD_BEAST_ASSET_IDS, ...allNpcAssetIds, ...portraitIds, ...mapSpriteIds, ...mapIds, ...inventoryIconIds, ...facilityIds, ...hotbarIconIds, ...locationIds, ...tileIds, ...logoIds, ...iconIds])] as const;

  const loaded = await Promise.all(
    ids.map(async id => {
      const url = assetUrlForId(store, id);
      if (!url) return [id, undefined] as const;
      const texture = await loadTextureWithTimeout(url);
      if (texture?.source && useNearestScaleMode(id)) texture.source.scaleMode = 'nearest';
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
    npcs: Object.fromEntries([...allNpcAssetIds, ...portraitIds].map(id => [id, textureById.get(id)])),
    portraits: Object.fromEntries(portraitIds.map(id => [id, textureById.get(id)])),
    mapSprites: Object.fromEntries(mapSpriteIds.map(id => [id, textureById.get(id)])),
    maps: Object.fromEntries(mapIds.map(id => [id, textureById.get(id)])),
    inventoryIcons: Object.fromEntries(inventoryIconIds.map(id => [id, textureById.get(id)])),
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
  const LEGACY_SHORTCUTS_ENABLED = import.meta.env.VITE_ENABLE_LEGACY_SHORTCUTS === 'true' || new URLSearchParams(window.location.search).get('legacyShortcuts') === '1';
  document.documentElement.dataset.legacyShortcuts = String(LEGACY_SHORTCUTS_ENABLED);
  let requestRender: (() => void) | null = null;
  let renderScheduler: RenderScheduler | null = null;
  let publicDemoPanels: PublicDemoPanelsController | null = null;
  let playwrightAmbientTimeMs: number | null = null;

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
    applyFarmsteadSceneLayout(fresh, { resetHerbPlot: true });
    return fresh;
  };
  const loaded = loadSave();
  const loadedRuntimeSettings = loadRuntimeSettings();
  let saveHealth = loaded.health;
  let runtimeSettings = loadedRuntimeSettings.settings;
  let runtimeSettingsPersistenceAvailable = loadedRuntimeSettings.persistenceAvailable;
  let state: GameState = loaded.state ?? createFreshState();
  const farmsteadLayoutMigrated = loaded.state != null && state.gameOver !== true && applyFarmsteadSceneLayout(state);
  if (farmsteadLayoutMigrated) {
    let succeeded = false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saveGame(state, reg.schemaHash)));
      succeeded = true;
    } catch {
      /* 存储满/禁用 */
    }
    saveHealth = saveHealthAfterWrite(saveHealth, succeeded);
  }
  let ctx: SimContext = createSimContextFromState(state, reg, DEFAULT_BALANCE);
  document.documentElement.dataset.reducedMotion = String(runtimeSettings.reducedMotion);

  await preloadUiFont(assetStore);

  const app = new Application();
  await app.init({
    width: 960,
    height: 540,
    background: ColorPalette.canvas,
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
  const audio = new AudioEngine();
  audio.setMasterVolume(runtimeSettings.masterVolume);
  // 第一刀音频接入：注入 narration 茎 AssetId → URL 解析器（io 层不反向依赖 asset store）。
  // playNarrationTrack(trackId) 据此取烘焙 ogg URL；缺失时静默 no-op。
  audio.setNarrationTrackResolver(id => assetUrlForId(assetStore, id));
  // 第二刀：文件型 SFX（dizi/erhu 等真实录音）解析器，与合成 playSfx 分流。
  audio.setSfxFileResolver(id => assetUrlForId(assetStore, id));

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
  type ArrayBuildChoice = {
    kind: 'array';
    defId: 'array.lightning-rod' | 'array.insulation';
    placementKind: 'lightning-rod' | 'insulation';
    title: string;
    assetId: 'facility.array-eye' | 'facility.array-flag';
  };
  type BuildChoice = { kind: 'facility'; facilityKind: FacilityKind } | ArrayBuildChoice;
  const buildChoices: readonly BuildChoice[] = [
    { kind: 'facility', facilityKind: 'drying-rack' },
    { kind: 'facility', facilityKind: 'sealing-cabinet' },
    { kind: 'facility', facilityKind: 'talisman-furnace' },
    { kind: 'array', defId: 'array.lightning-rod', placementKind: 'lightning-rod', title: '引雷阵', assetId: 'facility.array-eye' },
    { kind: 'array', defId: 'array.insulation', placementKind: 'insulation', title: '绝缘阵', assetId: 'facility.array-flag' }
  ];
  let facilityBuildIdx = 0;
  const brewRecipes = ['recipe.ward-pill', 'recipe.bone-pill', 'recipe.detox-pill', 'recipe.cold-mud', 'recipe.ward-fulgur', 'recipe.bone-herbal', 'recipe.detox-plume'];
  let dialogueBeat: DialogueBeatWithAsset | null = null;
  let paused = false;
  let responsiveShell: ResponsiveShellController | null = null;
  let flowView: AppFlowViewController | null = null;
  let prologueVN: PrologueVNController | null = null;
  let narrationIntro: NarrationIntroController | null = null;
  let narrationSurface: NarrationSurfaceController | null = null;
  let rogueliteProtoSurface: RogueliteProtoSurface | null = null;
  let narrationCodex: NarrationCodexController | null = null;
  let pointerTile: { x: number; y: number } | null = null;
  let lastPointerTile: { x: number; y: number } | null = null;
  let lastPointerAction: PointerWorldActionKind = 'none';
  let playerMovementAnimation: PlayerMovementAnimation | null = null;
  let queuedMovementPath: GridPoint[] = [];
  let pendingWorldCommand: PendingWorldCommand | null = null;
  let deferredPointerTile: GridPoint | null = null;
  const runtimeSettingsAbortController = new AbortController();
  let npcNameToId = new Map(getNpcList(state).map(npc => [npc.displayName, npc.id] as const));
  const prologueBeatIds = ['awaken', 'spirit-test', 'intro'] as const;

  function setElementText(id: string, text: string): void {
    const element = document.querySelector<HTMLElement>(`#${id}`);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function updateSaveHealthUi(): void {
    const presentation = deriveSaveHealthPresentation(saveHealth);
    flowView?.setContinueAvailable(hasCultivationJourney());
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
    layers.reducedMotion = runtimeSettings.reducedMotion;

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

  function setFlowSlotHtml(slot: string, html: string): void {
    const target = document.querySelector<HTMLElement>(`[data-app-slot="${slot}"]`);
    if (!target) return;
    if (target.innerHTML !== html) target.innerHTML = html;
    target.scrollTop = 0;
  }

  let inventoryUI: InventoryUIController | null = null;
  let inventoryFlowMode: 'inventory' | 'furnace' = 'inventory';
  function ensureInventoryUI(): InventoryUIController | null {
    if (inventoryUI) return inventoryUI;
    const invRoot = document.querySelector<HTMLElement>('[data-app-slot="inventory"]');
    if (!invRoot) return null;
    inventoryUI = createInventoryUI({
      root: invRoot,
      getState: () => state,
      getRegistry: () => reg,
      craftRecipeIds: brewRecipes,
      tutorialRecipeId: 'recipe.ward-pill',
      viewMode: () => (inventoryFlowMode === 'furnace' ? 'furnace-focus' : 'full'),
      hasTutorialAlchemyKit: () => state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG),
      hasBrewedTutorialAlchemy: () => state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG),
      onAction: handleInventoryAction
    });
    return inventoryUI;
  }
  const inventoryContainerLabel = {
    player: '行囊',
    storage: '仓库',
    shipping: '出货箱'
  } as const;
  const inventoryQualityLabel: Partial<Record<CropQuality, string>> = {
    mortal: '凡品',
    spirit: '灵品',
    treasure: '珍品'
  };

  function inventoryItemLabel(itemId: string, quality?: CropQuality): string {
    const name = reg.items.get(itemId)?.displayName ?? itemId;
    return `${name}${quality ? `·${inventoryQualityLabel[quality] ?? quality}` : ''}`;
  }

  function normalizedFurnaceHeat(heatPercent: number): number {
    return Math.min(100, Math.max(0, Math.round(heatPercent)));
  }

  function rejectedInventoryBrew(message: string, assetId?: string): InventoryActionFeedback {
    toast(message, assetId);
    return { ok: false, message, clearCraftSlots: false };
  }

  function acceptedInventoryBrew(message: string, clearCraftSlots = true): InventoryActionFeedback {
    return { ok: true, message, clearCraftSlots };
  }

  function brewInventoryRecipe(recipeId: string, heatPercentRaw: number): InventoryActionFeedback {
    const recipe = ctx.content.recipes.get(recipeId);
    if (!recipe) {
      const presentation = processingRecipeUnavailableToastPresentation('furnace');
      return rejectedInventoryBrew(presentation.message, presentation.assetId);
    }

    const heatPercent = normalizedFurnaceHeat(heatPercentRaw);
    const avgHeatMilli = heatPercent * 1000;
    const name = recipe.displayName;
    const tutorialKitReady = recipeId === 'recipe.ward-pill' && state.player.flags.has(TUTORIAL_ALCHEMY_KIT_FLAG) && !state.player.flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG);
    if (tutorialKitReady) {
      const result = brewTutorialWardPill(state, avgHeatMilli, ctx);
      if (!result.attempted) {
        const reason = result.reason === 'inventory-full' ? '行囊已满，先腾出一格再开炉。' : result.reason === 'harvest-required' ? '先在灵田收获第一批灵草。' : result.reason === 'already-completed' ? '首枚承雷丹已经出炉。' : '教学药包尚未备好。';
        return rejectedInventoryBrew(reason, 'pill.ward-basic');
      }
      const outcome = result.brew?.outcome ?? 'waste';
      audio.playSfx(outcome === 'exploded' ? 'explosion' : 'brew');
      if (outcome === 'exploded') spawnBurst(layers, 480, 240, 36, ColorPalette.dangerOrange);
      else if (outcome === 'pill' || outcome === 'flawed') spawnBurst(layers, 480, 240, 18, ColorPalette.mossBright);
      const presentation = brewResultToastPresentation(outcome, { name, furnaceHeat: heatPercent });
      const message = result.completed ? '首枚承雷丹已经出炉。' : presentation.message;
      toast(message, presentation.assetId);
      saveState(state);
      return acceptedInventoryBrew(message, result.completed);
    }

    for (const input of recipe.inputs) {
      if (itemCount(state.player, input.herbId) < input.qty) {
        const presentation = brewMaterialFailureToastPresentation({ herbId: input.herbId }, ctx.content);
        return rejectedInventoryBrew(presentation.message, presentation.assetId);
      }
    }

    const result = brewPills(state, { materials: recipe.inputs.map(input => ({ herbId: input.herbId, qty: input.qty })), avgHeatMilli }, ctx);
    audio.playSfx(result.outcome === 'exploded' ? 'explosion' : 'brew');
    if (result.outcome === 'exploded') spawnBurst(layers, 480, 240, 36, ColorPalette.dangerOrange);
    else if (result.outcome === 'pill' || result.outcome === 'flawed') spawnBurst(layers, 480, 240, 18, ColorPalette.mossBright);
    const presentation = brewResultToastPresentation(result.outcome, { name, furnaceHeat: heatPercent });
    toast(presentation.message, presentation.assetId);
    saveState(state);
    return acceptedInventoryBrew(presentation.message);
  }

  function handleInventoryAction(action: InventoryAction): InventoryActionFeedback | void {
    let actionFeedback: InventoryActionFeedback | undefined;
    switch (action.type) {
      case 'use':
        applyAction(state, { kind: 'eat-pill', pillId: action.itemId }, ctx);
        saveState(state);
        break;
      case 'drop':
        {
          const result = dropInventoryItem(state, action);
          if (result.ok) {
            toast(`已丢弃 ${inventoryItemLabel(action.itemId, action.quality)} ×${action.count}`, itemIconAssetId(action.itemId, reg));
            saveState(state);
          } else {
            toast(result.reason ?? '丢弃失败', itemIconAssetId(action.itemId, reg));
          }
        }
        break;
      case 'move':
        {
          const result = transferInventoryItem(state, ctx, action);
          if (result.ok) {
            const message = `已移动 ${inventoryItemLabel(action.itemId, action.quality)} ×${result.count}：${inventoryContainerLabel[action.from]} → ${inventoryContainerLabel[action.to]}`;
            toast(message, itemIconAssetId(action.itemId, reg));
            saveState(state);
            actionFeedback = { ok: true, message };
          } else {
            const message = result.reason ?? '移动失败';
            toast(message, itemIconAssetId(action.itemId, reg));
            actionFeedback = { ok: false, message };
          }
        }
        break;
      case 'reorder':
        state.inventoryLayout.orders[action.container] = [...action.order];
        saveState(state);
        break;
      case 'view-prefs':
        state.inventoryLayout.view = {
          activeTab: action.view.activeTab,
          pageByContainer: { ...action.view.pageByContainer },
          searchTerm: action.view.searchTerm,
          sortKey: action.view.sortKey
        };
        saveState(state);
        return;
      case 'brew':
        {
          const feedback = brewInventoryRecipe(action.recipeId, action.heatPercent);
          refreshAppPresentation();
          requestRender?.();
          return feedback;
        }
      case 'select-seed': {
        const idx = ownedSeedHotbarIndex(action.itemId, id => itemCount(state.player, id));
        if (idx != null) {
          hotbarIdx = idx;
          flowView?.dispatch({ type: 'close-overlay' });
          toast(`已选 ${reg.items.get(action.itemId)?.displayName ?? action.itemId}，点击灵田播种。`);
        } else {
          toast('该种子未在热栏快捷槽。');
        }
        return;
      }
      case 'select-tool':
        toast('工具经农务入口与热栏使用。');
        return;
    }
    inventoryUI?.render();
    refreshAppPresentation();
    requestRender?.();
    return actionFeedback;
  }

  function updateFlowSurfaceContent(flow: AppFlowState): void {
    if (flow.overlay === 'inventory') {
      ensureInventoryUI()?.render();
      return;
    }
    if (flow.overlay === 'map') {
      setFlowSlotHtml(
        'map',
        renderMapSurface(state, ctx, {
          locationNetwork: assetUrlForId(assetStore, 'map.location-network-v1'),
          valleyOverview: assetUrlForId(assetStore, 'map.valley-overview-v1')
        })
      );
      return;
    }
    if (flow.overlay === 'cultivation') {
      setFlowSlotHtml(
        'cultivation',
        renderCultivationSurface(state, ctx, {
          playerAvatar: assetUrlForId(assetStore, 'portrait.avatar.player-v1')
        })
      );
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
      setFlowSlotHtml(
        'ending',
        renderEndingSurface({
          state,
          endingStatus: deriveSaveHealthPresentation(saveHealth).endingStatus,
          assetUrlForId: id => assetUrlForId(assetStore, id)
        })
      );
    }
  }

  function startPrologueVN(): void {
    destroyPrologueVN();
    const root = document.querySelector<HTMLElement>('#prologue-vn');
    if (!root) return;
    // 序章视觉小说自管控件：完成 → finish-prologue，跳过 → skip-prologue。
    // 既有 finish/skip 处理（标记节拍已见 + 存档）保持不变，这里只负责派发事件。
    prologueVN = createPrologueVN({
      root,
      reducedMotion: runtimeSettings.reducedMotion,
      onFinish: () => {
        flowView?.dispatch({ type: 'finish-prologue' });
      },
      onSkip: () => {
        flowView?.dispatch({ type: 'skip-prologue' });
      },
      assetUrlForId: id => assetUrlForId(assetStore, id)
    });
    // VN 挂载后其首控件才存在，补一次焦点让 appFlowView 的焦点兜底命中舞台。
    flowView?.refocusCurrentSurface();
  }

  function destroyPrologueVN(): void {
    prologueVN?.destroy();
    prologueVN = null;
  }

  function startNarrationSurface(): void {
    destroyNarrationSurface();
    const root = document.querySelector<HTMLElement>('#narration-vn');
    if (!root) return;
    // narration 层独立状态机：不读 sim，用 firstPersonView.initialState()（docs/22 §5）。
    narrationSurface = createNarrationSurface({
      root,
      reducedMotion: runtimeSettings.reducedMotion,
      audio: {
        playBlip: speaker => audio.playBlip(speaker),
        playSfx: id => audio.playSfx(id),
        playNarrationTrack: (trackId, opts) => audio.playNarrationTrack(trackId, opts),
        stopNarrationTrack: opts => audio.stopNarrationTrack(opts),
        setMusicContext: ctx => audio.setMusicContext(ctx)
      },
      assetUrlForId: id => assetUrlForId(assetStore, id),
      onReturnToTitle: () => flowView?.dispatch({ type: 'return-title-from-narration' })
    });
    narrationSurface.start();
    // 挂载后 #narration-stage 才存在，补一次焦点让 appFlowView 焦点兜底命中舞台。
    flowView?.refocusCurrentSurface();
  }

  function destroyNarrationSurface(): void {
    narrationSurface?.destroy();
    narrationSurface = null;
  }

  function startRogueliteProtoSurface(startMode: 'new' | 'continue'): void {
    destroyRogueliteProtoSurface();
    const root = document.querySelector<HTMLElement>('#roguelite-proto-root');
    if (!root) return;
    // 主模式 Sokoban surface（docs/26）：自有 canvas，驱动 @sim/sokoban 切片；audio 接 io 层（playSfx + BGM context）。
    rogueliteProtoSurface = createRogueliteProtoSurface({
      root,
      startMode,
      reducedMotion: runtimeSettings.reducedMotion,
      assetUrlForId: id => assetUrlForId(assetStore, id),
      audio: {
        playSfx: id => audio.playSfx(id as SfxId),
        setMusicContext: (zone, tension) => audio.setMusicContext({ season: state.season, zone, tension, active: true })
      },
      onReturnToTitle: () => flowView?.dispatch({ type: 'return-title-from-roguelite-proto' }),
      onSaveAvailabilityChange: available => flowView?.setContinueAvailable(available)
    });
    rogueliteProtoSurface.start();
    flowView?.refocusCurrentSurface();
  }

  function destroyRogueliteProtoSurface(): void {
    rogueliteProtoSurface?.destroy();
    rogueliteProtoSurface = null;
  }

  function startNarrationCodex(): void {
    destroyNarrationCodex();
    const root = document.querySelector<HTMLElement>('#codex-root');
    if (!root) return;
    narrationCodex = createNarrationCodex({
      root,
      reducedMotion: runtimeSettings.reducedMotion,
      assetUrlForId: id => assetUrlForId(assetStore, id)
    });
    narrationCodex.open();
    flowView?.refocusCurrentSurface();
  }

  function destroyNarrationCodex(): void {
    narrationCodex?.destroy();
    narrationCodex = null;
  }

  /**
   * E7 改写标题屏（docs/22 §2.5）：触发 E7 后回标题，入口变暗 + 立绘隔屏凝视 + 文案改写。
   * 在 title surface 渲染后调用——有 flag 则加诅咒层，无则确保移除（防上轮残留）。
   */
  function applyE7TitleCurse(): void {
    const titleSurface = document.querySelector<HTMLElement>('[data-app-surface="title"]');
    if (!titleSurface) return;
    let cursed = false;
    try {
      cursed = typeof localStorage !== 'undefined' && localStorage.getItem(NARRATION_E7_FLAG_KEY) === '1';
    } catch {
      cursed = false;
    }
    titleSurface.classList.toggle('e7-cursed', cursed);
    const narrationBtn = document.querySelector<HTMLElement>('#flow-title-narration');
    if (narrationBtn) {
      const label = narrationBtn.querySelector<HTMLElement>('.flow-button-label');
      if (label) label.textContent = cursed ? '你确定还要再来一次吗？' : '灵韵叙录';
      // 立绘隔屏凝视占位（仅 cursed 时注入；cg.first-person.ending.e7-usurp-v2）。
      let portrait = titleSurface.querySelector<HTMLImageElement>('#flow-title-e7-portrait');
      if (cursed) {
        // MEDIUM7：assetUrlForId 返回空串（资源缺失/manifest 未登记）则不注入 img，
        // 避免浏览器加载空 src 触发破图占位。同时绑 error 兜底：URL 解析失败/网络错时
        // 也 remove img，让诅咒层仅靠入口文案生效。
        const portraitUrl = assetUrlForId(assetStore, 'cg.first-person.ending.e7-usurp-v2');
        if (!portraitUrl) {
          portrait?.remove();
        } else if (!portrait || portrait.dataset.url !== portraitUrl) {
          portrait?.remove();
          const img = document.createElement('img');
          img.id = 'flow-title-e7-portrait';
          img.className = 'flow-title-e7-portrait';
          img.alt = '';
          img.setAttribute('aria-hidden', 'true');
          img.decoding = 'async';
          img.dataset.url = portraitUrl;
          img.src = portraitUrl;
          img.addEventListener('error', () => img.remove(), { once: true });
          titleSurface.appendChild(img);
          portrait = img;
        }
      } else {
        portrait?.remove();
      }
    }
  }

  function handleFlowStateChange(next: AppFlowState, previous: AppFlowState, event: AppFlowEvent): void {
    if (previous.screen === 'world' && (next.screen !== 'world' || next.overlay != null)) {
      cancelWorldMovementForSurfaceTransition();
    }
    if (event.type === 'start-new-game') {
      clearSave();
      resetRuntimeState(createFreshState());
    } else if (event.type === 'finish-prologue' || event.type === 'skip-prologue') {
      for (const beatId of prologueBeatIds) markSeen(state, beatId);
      dialogueBeat = null;
      saveState(state);
    } else if (event.type === 'enter-loaded-world') {
      // 测试门：以 boot 已加载的存档状态入世界（等价 skip-prologue 的副作用，不清档）。
      for (const beatId of prologueBeatIds) markSeen(state, beatId);
      dialogueBeat = null;
      saveState(state);
    } else if (event.type === 'continue-aftermath') {
      applyAction(state, { kind: 'acknowledge-tutorial-aftermath' }, ctx);
      // V1-L01：战后回世界清教学对白队列，避免残留翻地提示
      dialogueBeat = null;
      saveState(state);
    } else if (event.type === 'start-narration') {
      // 标题屏 → 灵韵叙录：挂载 narrationSurface（独立状态机，不读 sim）。
      startNarrationSurface();
    } else if (event.type === 'return-title-from-narration') {
      // 灵韵叙录 → 标题屏（玩家退出 / 结局返回）：拆 surface，BGM 交还帧循环。
      destroyNarrationSurface();
    } else if (event.type === 'start-roguelite-proto') {
      // 标题屏 → 新的一世：清空当前修行旅程，从入世录开始。
      startRogueliteProtoSurface('new');
    } else if (event.type === 'continue-game') {
      // 标题屏 → 当前修行旅程：恢复日课、事件、天劫或传承所在的精确阶段。
      startRogueliteProtoSurface('continue');
    } else if (event.type === 'return-title-from-roguelite-proto') {
      destroyRogueliteProtoSurface();
    }

    // 叙录覆盖层生命周期（docs/22 §11）：进入 codex overlay 渲染三区，离开时拆。
    if (next.overlay === 'codex' && previous.overlay !== 'codex') {
      startNarrationCodex();
    } else if (next.overlay !== 'codex' && previous.overlay === 'codex') {
      destroyNarrationCodex();
    }

    clearLegacyAttentionSurfaces();
    updateFlowSurfaceContent(next);
    publicDemoPanels?.render(state, ctx);
    requestRender?.();
    refreshAppPresentation();
    // E7 改写标题屏：每次流程变更后同步诅咒层（idempotent，docs/22 §2.5）。
    applyE7TitleCurse();

    // 序章视觉小说：进入序章即挂载（每次新进都全新开演），离开即拆除监听。
    if (next.screen === 'prologue' && previous.screen !== 'prologue') {
      startPrologueVN();
    } else if (next.screen !== 'prologue' && previous.screen === 'prologue') {
      destroyPrologueVN();
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
    const profile = computeViewportLayout({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      touchCapable: navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    }).profile;
    setToast(layers, msg, resolvePreviewTexture(renderAssets, assetId), profile === 'portrait-blocked' ? 'compact-landscape' : profile);
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
    const style = kind === 'till' ? { color: ColorPalette.soilHighlight, count: 8, speed: 2.1, label: '翻地', labelColor: ColorPalette.soilHighlight } : kind === 'water' ? { color: ColorPalette.waterBlue, count: 8, speed: 2.4, label: '浇水', labelColor: ColorPalette.waterText } : kind === 'harvest' ? { color: ColorPalette.giltBright, count: 12, speed: 2.8, label: '收获', labelColor: ColorPalette.giltBright } : { color: ColorPalette.qiBright, count: 10, speed: 2.6, label: '供灵', labelColor: ColorPalette.qiText };
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
    if (blockedReason === 'outside-farm-plot') {
      const presentation = farmActionBlockedToastPresentation(kind, blockedReason);
      toast(presentation.message, presentation.assetId);
      return false;
    }
    const before = snapshotFarmTiles(state);
    const eventStart = state.events.length;
    const objectiveBefore = getPublicDemoObjectiveId(state);
    const harvestTile = kind === 'harvest' ? tileAt(state, at.x, at.y) : null;
    const harvestDefId = harvestTile?.cropId != null ? (state.crops.get(harvestTile.cropId)?.defId ?? state.crops.get(harvestTile.id)?.defId) : undefined;
    const harvestYieldItem = harvestDefId ? reg.herbs.get(harvestDefId)?.yield[0]?.itemId : undefined;
    const harvestCountBefore = harvestYieldItem ? itemCount(state.player, harvestYieldItem) : 0;
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
      if (harvestDefId && harvestYieldItem) {
        const harvested = Math.max(0, itemCount(state.player, harvestYieldItem) - harvestCountBefore);
        if (harvested > 0) {
          const feedback = harvestFeedbackPresentation(harvestDefId, harvested, reg);
          const feedbackPoint = screenPointForTile(at.x, at.y);
          spawnFloatText(layers, feedbackPoint.x, feedbackPoint.y - 26, feedback.message, ColorPalette.giltBright);
        }
      }
      const objectiveAfter = getPublicDemoObjectiveId(state);
      if (objectiveBefore === 'first-harvest' && objectiveAfter === 'journey-alchemy') {
        const milestoneToast = firstHarvestMilestoneToastPresentation(actionEvents, reg, '下一步：打开丹炉，把教学药包炼成首枚承雷丹。');
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
    return '点选服务执行·Esc返回';
  }

  function confirmHint(verb = '执行'): string {
    return `点击${verb}·Esc返回`;
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
      case 'location-action':
        return '点击确认执行地点行动 · Esc返回';
      default: {
        const base = '点击目标移动/互动 · 行囊常驻，丹炉/山河图/修行在更多中 · B 行囊 · Esc 暂停/返回';
        // 场景拾取提示：脚下有地面物品时附加一行
        const ground = groundItemAtIndex(state, state.player.position);
        if (!ground) return base;
        const groundName = reg.items.get(ground.itemId)?.displayName ?? ground.itemId;
        return `${base} · 脚下有 ${groundName} ×${ground.count}，点击脚下拾取`;
      }
    }
  }

  function currentOnboardingHelpText(): string {
    const objectiveId = getPublicDemoObjectiveId(state);
    if (!isJourneyTeachingActive(objectiveId)) {
      const journeyCtx = journeyGuideContextFromState(state);
      const guide = buildJourneyGuide(objectiveId, journeyCtx);
      return `当前目标：${guide.currentAction}。\n意义：${guide.motivation}。\n回报：教学纵切片已完成，可按自由节奏经营农庄。\n操作：${guide.cta}。`;
    }
    if (objectiveId != null && objectiveId.startsWith('journey-')) {
      const guide = buildJourneyGuide(objectiveId, journeyGuideContextFromState(state));
      return `当前目标：${guide.currentAction}。\n意义：${guide.motivation}。\n回报：完成当前阶段会推进灵草、炼丹、引劫与战后成长的四段闭环。\n操作：${guide.cta}。`;
    }
    return onboardingHelpText(getOnboardingObjectiveId(state));
  }

  function currentSemanticWorldAttention(): SemanticWorldAttention {
    if (dialogueBeat) return { panel: '对话', objective: '阅读当前对话', actions: currentHelpText() };
    if (locationSelectionActive) return { panel: '地点目录', objective: '选择地点与服务', actions: currentHelpText() };
    if (layers.showInv) return { panel: '物品管理', objective: '整理随身物品', actions: currentHelpText() };
    if (cultivationPanelVisible) return { panel: '修行', objective: '查看体魄与备劫状态', actions: currentHelpText() };
    const panel = interactionPanelSemanticLabel(interactionPanel) ?? '交互面板';
    return { panel, objective: `使用${panel}`, actions: currentHelpText() };
  }

  function currentJourneyBriefing(): { title: string; body: string; compactBody: string; assetId?: string } {
    const guide = buildJourneyGuide(getPublicDemoObjectiveId(state), journeyGuideContextFromState(state));
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

  function setSelectorText(selector: string, text: string): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && element.textContent !== text) element.textContent = text;
  }

  function setVitalMeter(selector: string, pct: number): void {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) return;
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    const next = String(clamped);
    if (element.style.getPropertyValue('--vital-pct') !== next) element.style.setProperty('--vital-pct', next);
  }

  function syncAppPresentation(): void {
    flowView?.setWorldAttention({
      dialogueActive: dialogueBeat !== null,
      panelActive: paused || interactionPanelActive(interactionPanel) || layers.showInv || cultivationPanelVisible,
      locationActive: locationSelectionActive
    });
    const flow = flowView?.getState() ?? null;
    const presentation = flowView?.getPresentation() ?? null;
    const worldHudVisible = presentation?.mode === 'world';
    const locationHudVisible = presentation?.surface === 'world' && presentation.mode === 'location';
    const commandBar = document.querySelector<HTMLElement>('#world-command-bar');
    if (commandBar) commandBar.hidden = !worldHudVisible;
    const locationCommandBar = document.querySelector<HTMLElement>('#world-location-command-bar');
    if (locationCommandBar) locationCommandBar.hidden = !locationHudVisible;
    const objectiveRail = document.querySelector<HTMLElement>('#objective-rail');
    if (objectiveRail) objectiveRail.hidden = !(worldHudVisible || locationHudVisible);
    const fateStatusStrip = document.querySelector<HTMLElement>('#fate-status-strip');
    if (fateStatusStrip) fateStatusStrip.hidden = !(worldHudVisible || locationHudVisible);
    const vitalStrip = document.querySelector<HTMLElement>('#world-vital-strip');
    if (vitalStrip) vitalStrip.hidden = !(worldHudVisible || locationHudVisible);
    if (worldHudVisible || locationHudVisible) {
      const stageNames = tList('ui.hud.stages');
      const hpPct = Math.max(0, Math.min(100, Math.round((state.player.hp / state.player.maxHp) * 100)));
      const staminaCap = DEFAULT_BALANCE.player.staminaCap * 1_000;
      const staminaPct = Math.max(0, Math.min(100, Math.round((state.player.stamina / staminaCap) * 100)));
      setSelectorText('#world-vital-day', `第 ${state.day} 日`);
      setSelectorText('#world-vital-season', `${seasonShort[state.season]} ${state.seasonDay}`);
      setSelectorText('#world-vital-stage', stageNames[state.player.stage] ?? `${state.player.stage}`);
      setSelectorText('#world-vital-lifespan', `寿元 ${state.player.lifespanRemainingDays ?? '--'}`);
      setSelectorText('#world-vital-hp-label', `气血 ${hpPct}%`);
      setSelectorText('#world-vital-stamina-label', `体力 ${staminaPct}%`);
      setVitalMeter('#world-vital-strip [data-vital="hp"]', hpPct);
      setVitalMeter('#world-vital-strip [data-vital="stamina"]', staminaPct);
      const pressureCard = document.querySelector<HTMLElement>('#pressure-card');
      const pressureTrib = document.querySelector<HTMLElement>('#pressure-tribulation');
      const pressureLife = document.querySelector<HTMLElement>('#pressure-lifespan');
      const pressurePrep = document.querySelector<HTMLElement>('#pressure-prep');
      const pressureSummary = document.querySelector<HTMLElement>('#fate-summary-pressure');
      if (pressureCard && pressureTrib && pressureLife && pressurePrep) {
        const pressure = tribulationPressurePresentation({
          status: state.tribulation.status,
          daysRemaining: state.tribulation.daysRemaining,
          lifespanRemainingDays: state.player.lifespanRemainingDays,
          readyToInvoke: readyToInvokeTribulation(state, ctx.params),
          frozen: state.postAscension.mode === 'stayed-in-world',
          prepLine: tribulationPrepStatusLine(state)
        });
        if (pressureTrib.textContent !== pressure.tribulationRow) pressureTrib.textContent = pressure.tribulationRow;
        if (pressureLife.textContent !== pressure.lifespanRow) pressureLife.textContent = pressure.lifespanRow;
        if (pressurePrep.textContent !== pressure.prepRow) pressurePrep.textContent = pressure.prepRow;
        if (pressureCard.dataset.pressureDanger !== pressure.danger) pressureCard.dataset.pressureDanger = pressure.danger;
        if (pressureSummary) {
          const prepMatch = pressure.prepRow.match(/准备度(\d+)%/);
          const summary = prepMatch ? `${pressure.tribulationRow}｜备劫${prepMatch[1]}%` : pressure.tribulationRow;
          if (pressureSummary.textContent !== summary) pressureSummary.textContent = summary;
        }
      }
      const compassCard = document.querySelector<HTMLElement>('#celestial-compass');
      const compassTitle = document.querySelector<HTMLElement>('#celestial-compass-title');
      const compassPrimary = document.querySelector<HTMLElement>('#celestial-compass-primary');
      const compassCausal = document.querySelector<HTMLElement>('#celestial-compass-causal');
      const compassUpcoming = document.querySelector<HTMLElement>('#celestial-compass-upcoming');
      const compassSummary = document.querySelector<HTMLElement>('#fate-summary-celestial');
      if (compassCard && compassTitle && compassPrimary && compassCausal && compassUpcoming) {
        const eventDef = state.activeEvent ? ctx.content.events.get(state.activeEvent.defId) : undefined;
        const upcoming = upcomingCalendarEntries(state, ctx, 7).find(entry => (entry.daysFromNow ?? 0) >= 0) ?? null;
        const compass = celestialCompassPresentation({
          activeEvent: state.activeEvent
            ? {
                id: state.activeEvent.defId,
                displayName: state.activeEvent.displayName,
                type: eventDef?.type,
                daysLeft: state.activeEvent.daysLeft,
                growthMod: state.activeEvent.growthMod,
                qiMod: state.activeEvent.qiMod,
                desc: eventDef?.desc
              }
            : null,
          beastSurge: state.beastSurge,
          upcoming: upcoming
            ? {
                id: upcoming.id,
                title: upcoming.title,
                kind: upcoming.kind,
                daysFromNow: upcoming.daysFromNow,
                description: upcoming.description
              }
            : null
        });
        if (compassTitle.textContent !== compass.title) compassTitle.textContent = compass.title;
        if (compassPrimary.textContent !== compass.primary) compassPrimary.textContent = compass.primary;
        if (compassCausal.textContent !== compass.causal) compassCausal.textContent = compass.causal;
        if (compassUpcoming.textContent !== compass.upcoming) compassUpcoming.textContent = compass.upcoming;
        if (compassCard.dataset.compassTone !== compass.tone) compassCard.dataset.compassTone = compass.tone;
        if (compassSummary && compassSummary.textContent !== compass.primary) compassSummary.textContent = compass.primary;
      }
    }

    const semanticWorldActive = presentation?.surface === 'world';
    const semanticJourney = semanticWorldActive && presentation.mode === 'world' ? buildJourneyGuide(getPublicDemoObjectiveId(state), journeyGuideContextFromState(state)) : undefined;
    responsiveShell?.updateSemanticState(
      deriveSemanticGameState({
        presentation,
        worldStatus: `第 ${state.day} 日，${seasonShort[state.season]}季第 ${state.seasonDay} 日。气血 ${Math.round(state.player.hp / 1000)}，体力 ${Math.round(state.player.stamina / 1000)}。`,
        announcement: String(layers.toast.text),
        journey: semanticJourney,
        worldAttention: semanticWorldActive && presentation.mode !== 'world' ? currentSemanticWorldAttention() : undefined,
        pauseWorldNavigationAvailable: flow?.screen === 'world',
        inventory: presentation?.surface === 'inventory' ? { viewMode: inventoryFlowMode === 'furnace' ? 'furnace-focus' : 'full' } : undefined,
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
        legacyShortcutsEnabled: boolean;
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
        playerVisualX: number;
        playerVisualY: number;
        playerMovementActive: boolean;
        playerMovementProgress: number;
        playerMovementQueueLength: number;
        playerMovementFromX: number | null;
        playerMovementFromY: number | null;
        playerMovementToX: number | null;
        playerMovementToY: number | null;
        pendingWorldCommand: string | null;
        pendingWorldTargetX: number | null;
        pendingWorldTargetY: number | null;
        pendingWorldDestinationX: number | null;
        pendingWorldDestinationY: number | null;
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
        frontTileFarmPlot: boolean;
        frontSceneZoneKind: FarmsteadSceneZoneKind;
        frontSceneObjectKind: FarmsteadSceneObjectKind | null;
        frontSceneObjectAction: string | null;
        pointerTileX: number | null;
        pointerTileY: number | null;
        lastPointerTileX: number | null;
        lastPointerTileY: number | null;
        lastPointerAction: PointerWorldActionKind;
        onboardingObjectiveId: string | null;
        farmOnboardingObjectiveId: string | null;
        helpText: string;
        renderedHelpText: string;
        dialogueBackdropVisible: boolean;
        todayBriefingVisible: boolean;
        panelPreviewVisible: boolean;
        locationPreviewVisible: boolean;
        locationPreviewTextBottom: number | null;
        locationPreviewPanelBottom: number | null;
        locationPreviewMaxTextBottom: number | null;
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
        enterLegacyWorld: () => boolean;
        enterLoadedLegacyWorld: () => boolean;
        configureSowKeypoint: () => boolean;
        configureTerrainSemanticsKeypoint: () => TerrainSemanticsKeypoint | null;
        configureQiFlowKeypoint: () => QiFlowKeypoint | null;
        configureFarmsteadObjectKeypoint: (kind?: FarmsteadSceneObjectKind) => boolean;
        configureFarmsteadNonPlotKeypoint: () => boolean;
        configureFarmsteadClickFarmKeypoint: () => { targetX: number; targetY: number; frontX: number; frontY: number } | null;
        configureJourneyReachableFarmTargetKeypoint: () => { nearX: number; nearY: number; farX: number; farY: number } | null;
        configureBuildArrayKeypoint: (kind?: 'lightning-rod' | 'insulation', preservePanel?: boolean) => BuildArrayKeypoint | null;
        configureBuiltFacilityClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number } | null;
        configureGroundItemClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number } | null;
        configureNpcPreviewClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number; npcId: string; locationId: string } | null;
        configureLocationPreviewClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number; locationId: string } | null;
        showLongLocationPreviewForTest: (withTexture?: boolean) => { textBottom: number; panelBottom: number; maxTextBottom: number; text: string } | null;
        canvasPointForTile: (x: number, y: number) => { x: number; y: number } | null;
        farmsteadObjectTile: (kind?: FarmsteadSceneObjectKind) => { x: number; y: number } | null;
        tileSnapshot: (x: number, y: number) => { tilled: boolean; cropId: number | null; blockType: string; playerX: number; playerY: number } | null;
        arraySnapshot: (x: number, y: number) => ArraySnapshot | null;
        groundItemSnapshot: (x: number, y: number) => { itemId: string; count: number } | null;
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
    const frontSceneObject = farmsteadSceneObjectAt(state, ft.x, ft.y);
    const shippingChoices = interactionPanel.kind === 'shipping' ? (interactionPanel.mode === 'normal' ? normalShipChoices() : qualityShipChoices()) : [];
    const selectedShippingChoice = interactionPanel.kind === 'shipping' ? (interactionPanel.mode === 'normal' ? (shippingChoices[normalizeSelection(shipIdx, shippingChoices.length)] ?? null) : (shippingChoices[normalizeSelection(qualityShipIdx, shippingChoices.length)] ?? null)) : null;
    const movementVisual = currentPlayerMovementVisual(performance.now());
    const flow = flowView?.getState() ?? null;
    const presentation = flowView?.getPresentation() ?? null;
    const locationPreviewTextHeight = layers.locationPreviewText.visible ? layers.locationPreviewText.height : 0;
    const locationPreviewPanelHeight = layers.locationPreviewText.visible ? locationPreviewBoxHeight(locationPreviewTextHeight) : 0;
    const viewportLayout = computeViewportLayout({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      touchCapable: navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    });
    target.__AEON_DEBUG__ = {
      debugSchemaVersion: 2,
      buildRevision: BUILD_REVISION,
      legacyShortcutsEnabled: LEGACY_SHORTCUTS_ENABLED,
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
      playerVisualX: movementVisual.x,
      playerVisualY: movementVisual.y,
      playerMovementActive: worldMovementActive(),
      playerMovementProgress: movementVisual.progress,
      playerMovementQueueLength: queuedMovementPath.length,
      playerMovementFromX: playerMovementAnimation?.from.x ?? null,
      playerMovementFromY: playerMovementAnimation?.from.y ?? null,
      playerMovementToX: playerMovementAnimation?.to.x ?? null,
      playerMovementToY: playerMovementAnimation?.to.y ?? null,
      pendingWorldCommand: pendingWorldCommand?.description ?? null,
      pendingWorldTargetX: pendingWorldCommand?.target.x ?? null,
      pendingWorldTargetY: pendingWorldCommand?.target.y ?? null,
      pendingWorldDestinationX: pendingWorldCommand?.destination.x ?? null,
      pendingWorldDestinationY: pendingWorldCommand?.destination.y ?? null,
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
      frontTileFarmPlot: isFarmsteadFarmPlotTile(state, ft.x, ft.y),
      frontSceneZoneKind: front ? farmsteadSceneTileKind(state, ft.x, ft.y) : 'wild',
      frontSceneObjectKind: frontSceneObject?.kind ?? null,
      frontSceneObjectAction: frontSceneObject?.actionLabel ?? null,
      pointerTileX: pointerTile?.x ?? null,
      pointerTileY: pointerTile?.y ?? null,
      lastPointerTileX: lastPointerTile?.x ?? null,
      lastPointerTileY: lastPointerTile?.y ?? null,
      lastPointerAction,
      onboardingObjectiveId: getPublicDemoObjectiveId(state),
      farmOnboardingObjectiveId: getOnboardingObjectiveId(state),
      helpText,
      renderedHelpText: String(layers.help.text),
      dialogueBackdropVisible: layers.dialogueBg.visible,
      todayBriefingVisible: layers.briefing.visible,
      panelPreviewVisible: layers.panelPreviewText.visible,
      locationPreviewVisible: layers.locationPreviewText.visible,
      locationPreviewTextBottom: layers.locationPreviewText.visible ? layers.locationPreviewText.y + locationPreviewTextHeight : null,
      locationPreviewPanelBottom: layers.locationPreviewText.visible ? LOCATION_PREVIEW_BOX.y + locationPreviewPanelHeight : null,
      locationPreviewMaxTextBottom: layers.locationPreviewText.visible ? layers.locationPreviewText.y + locationPreviewMaxTextHeight() : null,
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

  const titleAmbience = createTitleAmbience({
    requestFrame: callback => window.requestAnimationFrame(callback),
    cancelFrame: handle => window.cancelAnimationFrame(handle as number),
    resolveTarget: () => document.querySelector<HTMLElement>('.flow-title-mark img')
  });

  function refreshAppPresentation(): void {
    syncAppPresentation();
    titleAmbience.setActive((flowView?.getPresentation().surface ?? null) === 'title');
    publishDebugSnapshot();
  }

  function installPlaywrightTestHooks(): void {
    if (import.meta.env.VITE_PRESERVE_DRAWING_BUFFER !== 'true') return;
    const target = window as typeof window & {
      __AEON_TEST__?: {
        enterLegacyWorld: () => boolean;
        configureSowKeypoint: () => boolean;
        enterLoadedLegacyWorld: () => boolean;
        configureTerrainSemanticsKeypoint: () => TerrainSemanticsKeypoint | null;
        configureQiFlowKeypoint: () => QiFlowKeypoint | null;
        configureFarmsteadObjectKeypoint: (kind?: FarmsteadSceneObjectKind) => boolean;
        configureFarmsteadNonPlotKeypoint: () => boolean;
        configureFarmsteadClickFarmKeypoint: () => { targetX: number; targetY: number; frontX: number; frontY: number } | null;
        configureJourneyReachableFarmTargetKeypoint: () => { nearX: number; nearY: number; farX: number; farY: number } | null;
        configureBuildArrayKeypoint: (kind?: 'lightning-rod' | 'insulation', preservePanel?: boolean) => BuildArrayKeypoint | null;
        configureBuiltFacilityClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number } | null;
        configureGroundItemClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number } | null;
        configureNpcPreviewClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number; npcId: string; locationId: string } | null;
        configureLocationPreviewClickKeypoint: () => { targetX: number; targetY: number; playerX: number; playerY: number; locationId: string } | null;
        showLongLocationPreviewForTest: (withTexture?: boolean) => { textBottom: number; panelBottom: number; maxTextBottom: number; text: string } | null;
        canvasPointForTile: (x: number, y: number) => { x: number; y: number } | null;
        farmsteadObjectTile: (kind?: FarmsteadSceneObjectKind) => { x: number; y: number } | null;
        tileSnapshot: (x: number, y: number) => { tilled: boolean; cropId: number | null; blockType: string; playerX: number; playerY: number } | null;
        arraySnapshot: (x: number, y: number) => ArraySnapshot | null;
        groundItemSnapshot: (x: number, y: number) => { itemId: string; count: number } | null;
        matureFrontCrop: () => boolean;
        waterFrontCrop: () => boolean;
        buyMosslingSeed: () => boolean;
        closePanels: () => void;
        advanceOneDay: () => void;
      };
    };
    const clearPanelsForTest = (): void => {
      interactionPanel = { kind: 'none' };
      locationSelectionActive = false;
      cultivationPanelVisible = false;
      layers.cultivation.visible = false;
      layers.showInv = false;
      paused = false;
      dialogueBeat = null;
      hideDialogue(layers);
    };
    const faceTileForTest = (targetTile: { x: number; y: number }): boolean => {
      const candidates: Array<{ x: number; y: number; facing: Direction }> = [
        { x: targetTile.x, y: targetTile.y - 1, facing: 'down' },
        { x: targetTile.x, y: targetTile.y + 1, facing: 'up' },
        { x: targetTile.x - 1, y: targetTile.y, facing: 'right' },
        { x: targetTile.x + 1, y: targetTile.y, facing: 'left' }
      ];
      for (const candidate of candidates) {
        const standTile = tileAt(state, candidate.x, candidate.y);
        if (!standTile || standTile.blockType !== 'none') continue;
        state.player.position = { x: candidate.x, y: candidate.y };
        state.player.facing = candidate.facing;
        return true;
      }
      return false;
    };
    const showLongLocationPreviewForTest = (withTexture = false): { textBottom: number; panelBottom: number; maxTextBottom: number; text: string } | null => {
      clearPanelsForTest();
      locationSelectionActive = true;
      drawLocationPreview(
        layers,
        '山谷墟市',
        '今日人声很杂，散修摊位、药材行情、委托传闻、归谷路线和劫后残痕全挤在这一处。'.repeat(36),
        withTexture ? Texture.WHITE : undefined
      );
      publishDebugSnapshot();
      if (!layers.locationPreviewText.visible) return null;
      const textHeight = layers.locationPreviewText.height;
      return {
        textBottom: layers.locationPreviewText.y + textHeight,
        panelBottom: LOCATION_PREVIEW_BOX.y + locationPreviewBoxHeight(textHeight),
        maxTextBottom: layers.locationPreviewText.y + locationPreviewMaxTextHeight(),
        text: String(layers.locationPreviewText.text)
      };
    };
    target.__AEON_TEST__ = {
      enterLegacyWorld: () => {
        if (flowView?.getState().screen !== 'title') return false;
        flowView.dispatch({ type: 'start-new-game' });
        flowView.dispatch({ type: 'skip-prologue' });
        return flowView.getState().screen === 'world';
      },
      enterLoadedLegacyWorld: () => {
        if (flowView?.getState().screen !== 'title') return false;
        if (loaded.state == null) return false;
        flowView.dispatch({ type: 'enter-loaded-world' });
        // 终局存档会在入世界副作用里被 enterEndingIfNeeded 转到 ending 表面。
        const screen = flowView.getState().screen;
        return screen === 'world' || screen === 'ending';
      },
      configureSowKeypoint: () => {
        const targetPoint = firstFarmsteadFarmPlotTile(state);
        if (!targetPoint) return false;
        const targetTile = tileAt(state, targetPoint.x, targetPoint.y);
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
        if (!faceTileForTest(targetTile)) return false;
        state.player.inventory['seed.mossling'] = { itemId: 'seed.mossling', count: Math.max(itemCount(state.player, 'seed.mossling'), 1) };
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return getPublicDemoObjectiveId(state) === 'first-sow' && tileAt(state, targetTile.x, targetTile.y)?.cropId == null;
      },
      configureTerrainSemanticsKeypoint: () => {
        if (!target.__AEON_TEST__?.configureSowKeypoint()) return null;
        const tillable = tileAt(state, 4, 6);
        const plantable = tileAt(state, 5, 6);
        const blocked = tileAt(state, 6, 6);
        const selected = tileAt(state, 7, 6);
        if (!tillable || !plantable || !blocked || !selected) return null;

        for (const tile of state.tiles) {
          if (tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore') tile.qiDensity = 10_000;
        }
        for (const tile of [tillable, plantable, blocked, selected]) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.soilType = 'loam';
          tile.blockType = 'none';
          tile.tilled = false;
          tile.cropId = null;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.moisture = 0;
          tile.qiDensity = 10_000;
          tile.arrayId = null;
        }
        plantable.tilled = true;
        blocked.soilType = 'rock';
        state.player.position = { x: selected.x, y: selected.y - 1 };
        state.player.facing = 'down';
        playwrightAmbientTimeMs = 900;
        saveState(state);
        refreshAppPresentation();
        return {
          tillableX: tillable.x,
          tillableY: tillable.y,
          plantableX: plantable.x,
          plantableY: plantable.y,
          blockedX: blocked.x,
          blockedY: blocked.y,
          selectedX: selected.x,
          selectedY: selected.y
        };
      },
      configureQiFlowKeypoint: () => {
        if (!target.__AEON_TEST__?.configureSowKeypoint()) return null;
        const low = tileAt(state, 5, 6);
        const high = tileAt(state, 6, 6);
        if (!low || !high) return null;

        for (const tile of state.tiles) {
          if (tile.blockType === 'none' && tile.soilType !== 'water' && tile.soilType !== 'rock' && tile.soilType !== 'metal-ore') tile.qiDensity = 10_000;
        }
        for (const tile of [low, high]) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.soilType = 'loam';
          tile.blockType = 'none';
          tile.tilled = true;
          tile.cropId = null;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.arrayId = null;
        }
        low.qiDensity = 30_000;
        high.qiDensity = 100_000;
        state.player.position = { x: 0, y: 0 };
        state.player.facing = 'up';
        playwrightAmbientTimeMs = null;
        saveState(state);
        refreshAppPresentation();
        return { lowX: low.x, lowY: low.y, highX: high.x, highY: high.y };
      },
      configureFarmsteadObjectKeypoint: (kind = 'storage') => {
        applyFarmsteadSceneLayout(state);
        const object = farmsteadSceneObjectByKind(state, kind);
        if (!object) return false;
        if (!faceTileForTest({ x: object.x, y: object.y })) return false;
        state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: Math.max(itemCount(state.player, 'item.spirit-stone'), 1) };
        if (kind === 'shipping') {
          state.player.inventory['herb.mossling'] = { itemId: 'herb.mossling', count: Math.max(itemCount(state.player, 'herb.mossling'), 1) };
          const mosslingShipIdx = normalShipChoices().findIndex(choice => choice.itemId === 'herb.mossling');
          if (mosslingShipIdx >= 0) shipIdx = mosslingShipIdx;
        }
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return farmsteadSceneObjectAt(state, frontTile().x, frontTile().y)?.kind === kind;
      },
      configureFarmsteadNonPlotKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        const targetPoint = firstNonFarmsteadFarmPlotTile(state);
        if (!targetPoint) return false;
        const targetTile = tileAt(state, targetPoint.x, targetPoint.y);
        if (!targetTile) return false;
        if (targetTile.cropId != null) state.crops.delete(targetTile.cropId);
        state.crops.delete(targetTile.id);
        targetTile.cropId = null;
        targetTile.tilled = false;
        targetTile.blockType = 'none';
        if (targetTile.soilType === 'water' || targetTile.soilType === 'rock' || targetTile.soilType === 'metal-ore') targetTile.soilType = 'loam';
        if (!faceTileForTest(targetTile)) return false;
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return !isFarmsteadFarmPlotTile(state, targetTile.x, targetTile.y) && farmsteadSceneObjectAt(state, targetTile.x, targetTile.y) == null;
      },
      configureFarmsteadClickFarmKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        const targetTile = tileAt(state, 4, 4) ?? null;
        const frontTileTarget = tileAt(state, 7, 5) ?? null;
        if (!targetTile || !frontTileTarget) return null;
        for (const tile of [targetTile, frontTileTarget]) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.tilled = false;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.blockType = 'none';
          tile.soilType = 'loam';
        }
        state.player.position = { x: 7, y: 4 };
        state.player.facing = 'down';
        hotbarIdx = 0;
        playwrightAmbientTimeMs = 900;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return { targetX: targetTile.x, targetY: targetTile.y, frontX: frontTileTarget.x, frontY: frontTileTarget.y };
      },
      configureJourneyReachableFarmTargetKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        const nearTile = tileAt(state, 4, 4) ?? null;
        const farTile = tileAt(state, 3, 7) ?? null;
        const playerTile = tileAt(state, 2, 4) ?? null;
        if (!nearTile || !farTile || !playerTile) return null;
        if (!isFarmsteadFarmPlotTile(state, nearTile.x, nearTile.y) || !isFarmsteadFarmPlotTile(state, farTile.x, farTile.y)) return null;

        for (const tile of state.tiles) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.arrayId = null;
          if (isFarmsteadFarmPlotTile(state, tile.x, tile.y)) {
            tile.blockType = 'rock';
            tile.soilType = 'rock';
            tile.tilled = false;
          }
        }

        for (const tile of [nearTile, farTile]) {
          tile.blockType = 'none';
          tile.soilType = 'loam';
          tile.tilled = false;
          tile.cropId = null;
        }

        for (const blocker of [
          tileAt(state, nearTile.x, nearTile.y - 1),
          tileAt(state, nearTile.x + 1, nearTile.y),
          tileAt(state, nearTile.x, nearTile.y + 1),
          tileAt(state, nearTile.x - 1, nearTile.y)
        ]) {
          if (!blocker) continue;
          blocker.blockType = 'rock';
          blocker.soilType = 'rock';
          blocker.tilled = false;
          if (blocker.cropId != null) state.crops.delete(blocker.cropId);
          state.crops.delete(blocker.id);
          blocker.cropId = null;
        }

        for (const clear of [playerTile, tileAt(state, farTile.x - 1, farTile.y)]) {
          if (!clear) continue;
          clear.blockType = 'none';
          if (clear.soilType === 'rock' || clear.soilType === 'water' || clear.soilType === 'metal-ore') clear.soilType = 'loam';
        }

        state.player.position = { x: playerTile.x, y: playerTile.y };
        state.player.facing = 'down';
        if (reachableInteractionPathToTarget({ x: nearTile.x, y: nearTile.y }) != null) return null;
        if (reachableInteractionPathToTarget({ x: farTile.x, y: farTile.y }) == null) return null;
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return { nearX: nearTile.x, nearY: nearTile.y, farX: farTile.x, farY: farTile.y };
      },
      configureBuildArrayKeypoint: (kind = 'lightning-rod', preservePanel = false) => {
        applyFarmsteadSceneLayout(state);
        const targetPoint = tileAt(state, 4, 4) ? { x: 4, y: 4 } : firstFarmsteadFarmPlotTile(state);
        const targetTile = targetPoint ? tileAt(state, targetPoint.x, targetPoint.y) : null;
        if (!targetTile) return null;
        for (const tile of state.tiles) {
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.arrayId = null;
        }
        for (const [facilityId, facility] of state.facilities) {
          if (facility.tileId === targetTile.id) state.facilities.delete(facilityId);
        }
        state.arrays.clear();
        targetTile.blockType = 'none';
        targetTile.soilType = 'loam';
        targetTile.tilled = kind === 'lightning-rod';
        targetTile.wateredToday = false;
        targetTile.channeledToday = false;
        if (kind === 'lightning-rod') {
          state.crops.set(targetTile.id, {
            id: targetTile.id,
            defId: 'herb.metalpine',
            tileId: targetTile.id,
            growth: 0,
            health: 100_000,
            stage: 'seed',
            plantedDay: state.day,
            property: { cold: 0, hot: 0, warm: 0, neutral: 0 },
            tempered: false
          });
          targetTile.cropId = targetTile.id;
        }
        state.player.inventory['item.array-core'] = { itemId: 'item.array-core', count: Math.max(itemCount(state.player, 'item.array-core'), 2) };
        state.player.inventory['item.spirit-stone'] = { itemId: 'item.spirit-stone', count: Math.max(itemCount(state.player, 'item.spirit-stone'), 8) };
        preselectArrayBuildChoice(kind);
        hotbarIdx = 0;
        if (preservePanel) {
          locationSelectionActive = false;
          cultivationPanelVisible = false;
          layers.cultivation.visible = false;
          layers.showInv = false;
          paused = false;
          dialogueBeat = null;
          hideDialogue(layers);
          interactionPanel = { kind: 'build' };
        } else {
          clearPanelsForTest();
        }
        saveState(state);
        refreshAppPresentation();
        return {
          targetX: targetTile.x,
          targetY: targetTile.y,
          playerX: state.player.position.x,
          playerY: state.player.position.y,
          arrayDefId: kind === 'lightning-rod' ? 'array.lightning-rod' : 'array.insulation'
        };
      },
      configureBuiltFacilityClickKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        const targetTile = tileAt(state, 7, 4) ?? null;
        if (!targetTile) return null;
        for (const tile of state.tiles) {
          if (tile.y !== targetTile.y || tile.x < 4 || tile.x > targetTile.x) continue;
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.tilled = false;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.blockType = 'none';
          tile.soilType = 'loam';
        }
        state.facilities.delete(9101);
        targetTile.blockType = 'building';
        state.facilities.set(9101, {
          id: 9101,
          kind: 'drying-rack',
          tileId: targetTile.id,
          job: { inputItemId: 'herb.mossling', outputItemId: 'item.dried-herb', outputCount: 1, daysRemaining: 0 }
        });
        state.player.position = { x: 4, y: 4 };
        state.player.facing = 'right';
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return { targetX: targetTile.x, targetY: targetTile.y, playerX: state.player.position.x, playerY: state.player.position.y };
      },
      configureGroundItemClickKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        const targetTile = tileAt(state, 4, 4) ?? null;
        if (!targetTile) return null;
        for (const tile of state.tiles) {
          if (tile.y !== targetTile.y || tile.x < targetTile.x || tile.x > 7) continue;
          if (tile.cropId != null) state.crops.delete(tile.cropId);
          state.crops.delete(tile.id);
          tile.cropId = null;
          tile.tilled = false;
          tile.wateredToday = false;
          tile.channeledToday = false;
          tile.blockType = 'none';
          tile.soilType = 'loam';
        }
        state.groundItems = state.groundItems.filter(item => item.pos.x !== targetTile.x || item.pos.y !== targetTile.y);
        placeGroundItem(state, { itemId: 'item.spirit-stone', count: 1, pos: { x: targetTile.x, y: targetTile.y } });
        state.player.position = { x: 7, y: 4 };
        state.player.facing = 'left';
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return { targetX: targetTile.x, targetY: targetTile.y, playerX: state.player.position.x, playerY: state.player.position.y };
      },
      configureNpcPreviewClickKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        state.player.flags.add(FIRST_SECOND_WATER_FLAG);
        const placement =
          npcWorldPreviewPlacements(state).find(entry => entry.npcId.startsWith('npc.') && farmsteadSceneObjectAt(state, entry.x, entry.y) == null) ??
          npcWorldPreviewPlacements(state).find(entry => farmsteadSceneObjectAt(state, entry.x, entry.y) == null) ??
          null;
        if (!placement) return null;
        if (!faceTileForTest({ x: placement.x, y: placement.y })) return null;
        hotbarIdx = 0;
        clearPanelsForTest();
        saveState(state);
        refreshAppPresentation();
        return {
          targetX: placement.x,
          targetY: placement.y,
          playerX: state.player.position.x,
          playerY: state.player.position.y,
          npcId: placement.npcId,
          locationId: placement.locationId
        };
      },
      configureLocationPreviewClickKeypoint: () => {
        applyFarmsteadSceneLayout(state);
        state.player.flags.add(FIRST_SECOND_WATER_FLAG);
        const activeLocationIds = new Set(getActiveLocationDirectory(state).map(location => location.id));
        for (const placement of locationWorldPreviewPlacements(state)) {
          if (!activeLocationIds.has(placement.locationId)) continue;
          if (npcWorldPreviewPlacementAt(state, placement.x, placement.y)) continue;
          if (farmsteadSceneObjectAt(state, placement.x, placement.y)) continue;
          const tile = tileAt(state, placement.x, placement.y);
          if (!tile || facilityAt(state, tile.id)) continue;
          if (!faceTileForTest({ x: placement.x, y: placement.y })) continue;
          hotbarIdx = 0;
          clearPanelsForTest();
          saveState(state);
          refreshAppPresentation();
          return {
            targetX: placement.x,
            targetY: placement.y,
            playerX: state.player.position.x,
            playerY: state.player.position.y,
            locationId: placement.locationId
          };
        }
        return null;
      },
      showLongLocationPreviewForTest,
      canvasPointForTile: (x: number, y: number) => canvasLocalPointForTileForTest(x, y),
      farmsteadObjectTile: (kind = 'storage') => {
        const object = farmsteadSceneObjectByKind(state, kind);
        return object ? { x: object.x, y: object.y } : null;
      },
      tileSnapshot: (x: number, y: number) => {
        const tile = tileAt(state, x, y);
        return tile
          ? {
              tilled: tile.tilled,
              cropId: tile.cropId,
              blockType: tile.blockType,
              playerX: state.player.position.x,
              playerY: state.player.position.y
            }
          : null;
      },
      arraySnapshot: (x: number, y: number) => {
        const tile = tileAt(state, x, y);
        if (!tile) return null;
        const arrays = [...state.arrays.values()].filter(array => array.coreTileId === tile.id);
        return {
          count: arrays.length,
          defIds: arrays.map(array => array.defId),
          activeCount: arrays.filter(array => array.active).length
        };
      },
      groundItemSnapshot: (x: number, y: number) => {
        const item = groundItemAtIndex(state, { x, y });
        return item ? { itemId: item.itemId, count: item.count } : null;
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
        const result = buyShopItem(state, 'seed.mossling', 1, ctx);
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
    cancelWorldMovementForSurfaceTransition();
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
      case 'location-action':
        return locationPreviewAssetId(panel.locationId);
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

  function toggleInventoryFlowOverlay(): boolean {
    if (!flowView) return false;
    const flow = flowView.getState();
    if (flow.overlay === 'inventory') {
      flowView.dispatch({ type: 'close-overlay' });
      return true;
    }
    return openInventoryFlowOverlay('inventory');
  }

  function openFlowOverlay(overlay: AppOverlay, returnFocus: AppFocusSelector = APP_FLOW_FOCUS_TARGETS.world): boolean {
    if (!flowView) return false;
    const flow = flowView.getState();
    if (flow.overlay !== null) return false;
    // 教学天劫（tribulation）屏允许暂停/设置——与 canOpenOverlay 的 GAMEPLAY_OVERLAYS 一致；
    // 否则天劫暂停里「只能调整设置」的设置按钮会静默失效。
    const screenAllowed =
      flow.screen === 'world' ||
      (flow.screen === 'tribulation' && (overlay === 'pause' || overlay === 'settings'));
    if (!screenAllowed) return false;
    cancelWorldMovementForSurfaceTransition();
    flowView.dispatch({ type: 'open-overlay', overlay, returnFocus });
    return true;
  }

  function openInventoryFlowOverlay(tab: 'inventory' | 'furnace', returnFocus: AppFocusSelector = APP_FLOW_FOCUS_TARGETS.world, recipeId?: string): boolean {
    if (!flowView) return false;
    const flow = flowView.getState();
    inventoryFlowMode = tab;
    const inventory = ensureInventoryUI();
    if (tab === 'furnace') inventory?.showFurnace(recipeId);
    else inventory?.showInventory();
    if (flow.overlay === 'inventory') return true;
    if (flow.screen !== 'world' || flow.overlay !== null || paused) return false;
    layers.showInv = false;
    return openFlowOverlay('inventory', returnFocus);
  }

  function openFurnaceInventory(returnFocus: AppFocusSelector = APP_FLOW_FOCUS_TARGETS.world, recipeId?: string): boolean {
    const tutorialAlchemyActive = getPublicDemoObjectiveId(state) === 'journey-alchemy';
    if (tutorialAlchemyActive) {
      applyAction(state, { kind: 'prepare-tutorial-alchemy-kit' }, ctx);
      saveState(state);
    }
    const preferredRecipeId = recipeId ?? (tutorialAlchemyActive ? 'recipe.ward-pill' : undefined);
    const opened = openInventoryFlowOverlay('furnace', returnFocus, preferredRecipeId);
    if (opened) {
      const presentation = overlayToastPresentation('open-inventory', 'facility.talisman-furnace');
      toast(presentation.message, presentation.assetId);
    }
    return opened;
  }

  function toggleInventoryVisibility(): void {
    if (toggleInventoryFlowOverlay()) {
      const presentation = overlayToastPresentation(flowView?.getState().overlay === 'inventory' ? 'open-inventory' : 'close-inventory', inventoryOverlayAssetId());
      toast(presentation.message, presentation.assetId);
      return;
    }
    cultivationPanelVisible = false;
    layers.cultivation.visible = false;
    if (!layers.showInv) cancelWorldMovementForSurfaceTransition();
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
    if (!cultivationPanelVisible) cancelWorldMovementForSurfaceTransition();
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
    if (!isFarmsteadFarmPlotTile(state, tile.x, tile.y)) return false;
    if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') return false;
    applyAction(state, { kind: 'till', at: frontTile() }, ctx);
    audio.playSfx('till');
    return true;
  }

  function performSowAction(seedId: string, switched: boolean, at = frontTile()): boolean {
    const blockedReason = farmActionBlockedReason(state, ctx, 'sow', at, { seedId });
    if (blockedReason === 'outside-farm-plot') {
      const presentation = farmActionBlockedToastPresentation('sow', blockedReason, { seedId });
      toast(presentation.message, presentation.assetId);
      return false;
    }
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
      spawnBurst(layers, point.x, point.y, 8, ColorPalette.sowBurst, 2.0);
      spawnFloatText(layers, point.x, point.y - 8, '播种', ColorPalette.sowText);
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
    if (blockedReason === 'outside-farm-plot') {
      const presentation = farmActionBlockedToastPresentation('fertilize', blockedReason, { itemId });
      toast(presentation.message, presentation.assetId);
      return false;
    }
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
    cancelWorldMovementForSurfaceTransition();
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
    cancelWorldMovementForSurfaceTransition();
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
        return '人物委托';
    }
  }

  function openNpcActionPanel(): void {
    cancelWorldMovementForSurfaceTransition();
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
    cancelWorldMovementForSurfaceTransition();
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

  function buildFacilityAt(kind: FacilityKind, at: GridPoint): boolean {
    const eventStart = state.events.length;
    applyAction(state, { kind: 'place-facility', at, facilityKind: kind }, ctx);
    const events = state.events.slice(eventStart);
    const placed = events.some(e => e.type === 'facility-place');
    if (placed) {
      const presentation = buildResultToastPresentation(kind, 'success');
      toast(presentation.message, presentation.assetId);
      return true;
    }
    const failed = events.find(e => e.type === 'facility-place-failed');
    const payload = failed?.payload as { reason?: string; requiredExpansionTier?: number | null; currentExpansionTier?: number } | undefined;
    if (payload?.requiredExpansionTier != null && payload.currentExpansionTier != null && payload.currentExpansionTier < payload.requiredExpansionTier) {
      const presentation = buildResultToastPresentation(kind, 'failure', `${FACILITY_LABEL[kind]}需农庄扩建${payload.requiredExpansionTier}阶，当前为${payload.currentExpansionTier}阶`);
      toast(presentation.message, presentation.assetId);
      return false;
    }
    const presentation = buildResultToastPresentation(kind, 'failure', payload?.reason ?? `需${describeFacilityBuildCost(kind)}，且前方为空地`);
    toast(presentation.message, presentation.assetId);
    return false;
  }

  function buildFacility(kind: FacilityKind): boolean {
    return buildFacilityAt(kind, frontTile());
  }

  function buildChoicePanelPreview(choice: BuildChoice): { title: string; details: string; assetId?: string } {
    if (choice.kind === 'facility') return buildPanelPreview(choice.facilityKind, reg);
    const ruleLine = choice.defId === 'array.lightning-rod' ? '规则：需在金属性灵草上设阵眼，引导雷势落向阵心' : '规则：可设在普通空地，分流雷势、稳住核心区';
    return {
      title: choice.title,
      details: `阵法布设\n材料：${describeArrayBuildCost(choice.defId)}\n目标：点击地图目标格，或面对目标格确认\n${ruleLine}`,
      assetId: choice.assetId
    };
  }

  function buildChoiceToastPresentation(choice: BuildChoice): { message: string; assetId?: string } {
    const choiceIndex = normalizeSelection(facilityBuildIdx, buildChoices.length);
    const preview = buildChoicePanelPreview(choice);
    const action = choice.kind === 'facility' ? '建造' : '布阵';
    return {
      message: `${action}${selectionLabel(choiceIndex, buildChoices.length)}：${preview.title}｜点选候选·${confirmHint(action)}`,
      assetId: preview.assetId
    };
  }

  function selectedBuildChoice(): BuildChoice {
    return buildChoices[normalizeSelection(facilityBuildIdx, buildChoices.length)] ?? buildChoices[0]!;
  }

  function arrayBuildChoiceIndex(kind: ArrayBuildChoice['placementKind']): number {
    return buildChoices.findIndex(choice => choice.kind === 'array' && choice.placementKind === kind);
  }

  function preselectArrayBuildChoice(kind: ArrayBuildChoice['placementKind'] = 'lightning-rod'): void {
    const index = arrayBuildChoiceIndex(kind);
    if (index >= 0) facilityBuildIdx = index;
  }

  function frontBuildTargetNeedsPointerSelection(at: GridPoint): boolean {
    const tile = tileAt(state, at.x, at.y);
    return !tile || farmsteadSceneObjectAt(state, at.x, at.y) != null || (tile != null && facilityAt(state, tile.id) != null);
  }

  function placeArrayFromBuildChoice(choice: ArrayBuildChoice, at?: GridPoint): boolean {
    const target = at ?? frontTile();
    if (!at && frontBuildTargetNeedsPointerSelection(target)) {
      toast(`已选择${choice.title}｜点击药田或空地目标格布阵`, choice.assetId);
      return false;
    }
    const result = placeArray(state, choice.defId, target.x, target.y, ctx);
    const presentation = arrayPlacementToastPresentation(choice.placementKind, {
      placed: result.placed,
      reason: result.reason,
      costText: describeArrayBuildCost(choice.defId)
    });
    toast(presentation.message, presentation.assetId);
    return result.placed;
  }

  function performBuildChoice(choice: BuildChoice, at?: GridPoint): boolean {
    if (choice.kind === 'facility') {
      return at ? buildFacilityAt(choice.facilityKind, at) : buildFacility(choice.facilityKind);
    }
    return placeArrayFromBuildChoice(choice, at);
  }

  function openBuildPanel(): void {
    interactionPanel = { kind: 'build' };
    facilityBuildIdx = normalizeSelection(facilityBuildIdx, buildChoices.length);
    const choice = selectedBuildChoice();
    const presentation = buildChoiceToastPresentation(choice);
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
    const presentation = upgradeToastPresentation(upgrade, selectionLabel(facilityBuildIdx, upgrades.length), confirmHint('扩建'), reg);
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

  function openFacilityCollectPanel(preferredFacilityId?: number): void {
    const choices = facilityCollectChoices();
    if (choices.length === 0) {
      const presentation = facilityCollectUnavailableToastPresentation(farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      return;
    }
    interactionPanel = { kind: 'facility-collect' };
    const preferredIndex = preferredFacilityId == null ? -1 : choices.findIndex(choice => choice.facilityId === preferredFacilityId);
    facilityCollectIdx = preferredIndex >= 0 ? preferredIndex : normalizeSelection(facilityCollectIdx, choices.length);
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
      case 'location-action': {
        const preview = locationActionPanelPreview(interactionPanel.command, interactionPanel.locationId, state, reg);
        return {
          title: preview.title,
          details: preview.details,
          texture: resolvePreviewTexture(renderAssets, preview.assetId)
        };
      }
      case 'build': {
        if (buildChoices.length === 0) return null;
        const choice = selectedBuildChoice();
        const preview = buildChoicePanelPreview(choice);
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
        facilityBuildIdx = cycleSelection(facilityBuildIdx, buildChoices.length, reverse);
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
      case 'location-action':
        openLocationActionPanel(interactionPanel.command, interactionPanel.locationId);
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
        performBuildChoice(selectedBuildChoice());
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
        const r = executeTrade(state, o.id, ctx);
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
      case 'location-action': {
        const { command } = interactionPanel;
        interactionPanel = { kind: 'none' };
        performConfirmedLocationAction(command);
        return true;
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
              const milestone = firstShipmentMilestoneToastPresentation(presentation.message, '下一步：点击居所或“歇息”过夜，等次日出货结算。');
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
            const milestone = firstShipmentMilestoneToastPresentation(presentation.message, '下一步：点击居所或“歇息”过夜，等次日出货结算。');
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

  function focusLocationSelection(locationId: LocationId, prefix: '地点' | '服务' = '地点'): boolean {
    const locations = getActiveLocationDirectory(state);
    const nextLocationIdx = locations.findIndex(location => location.id === locationId);
    if (nextLocationIdx < 0) return false;
    const services = getLocationServiceOptions(state, locationId);
    cancelWorldMovementForSurfaceTransition();
    interactionPanel = { kind: 'none' };
    locationIdx = nextLocationIdx;
    locationServiceIdx = 0;
    locationSelectionActive = true;
    const location = locations[nextLocationIdx]!;
    const selectedService = services.length > 0 ? (services[0] ?? null) : null;
    const presentation = locationSelectionToastPresentation(prefix, location, selectedService, locationSelectionHint(), locationPreviewFocusReason(state, getOnboardingObjectiveId(state), location.id, selectedService?.command ?? null, getLocationEncounters(state, location.id).length), formatLocationActionSignalLine(state, location.id), location.id === 'farmstead' && selectedService?.command === 'show-farm-work' ? farmsteadRootContextAssetId(state) : undefined);
    toast(presentation.message, presentation.assetId);
    return true;
  }

  function focusLocationService(locationId: LocationId, command: LocationServiceCommand, prefix: '地点' | '服务' = '服务'): boolean {
    const locations = getActiveLocationDirectory(state);
    const nextLocationIdx = locations.findIndex(location => location.id === locationId);
    if (nextLocationIdx < 0) return false;
    const services = getLocationServiceOptions(state, locationId);
    const nextServiceIdx = services.findIndex(service => service.command === command);
    if (nextServiceIdx < 0) return false;
    cancelWorldMovementForSurfaceTransition();
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

  function openLocationActionPanel(command: LocationActionPanelCommand, locationId: LocationId): void {
    interactionPanel = { kind: 'location-action', command, locationId };
    const presentation = locationActionToastPresentation(command, locationId, state, reg, confirmHint(locationActionConfirmHint(command)));
    toast(presentation.message, presentation.assetId);
  }

  function performConfirmedLocationAction(command: LocationActionPanelCommand): void {
    cancelWorldMovementForSurfaceTransition();
    switch (command) {
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
    }
  }

  function executeLocationCommand(command: LocationServiceCommand, locationId: LocationId): void {
    cancelWorldMovementForSurfaceTransition();
    if (isLocationActionPanelCommand(command)) {
      openLocationActionPanel(command, locationId);
      return;
    }

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
      case 'show-processing':
        {
          const presentation = processingServiceToastPresentation(confirmHint('进入').replace('·Esc返回', ''), locationId);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'show-arrays':
        {
          const presentation = arraysServiceToastPresentation('点阵器棚或农务入口布阵', locationId);
          toast(presentation.message, presentation.assetId);
        }
        return;
      case 'show-farm-work':
        {
          const presentation = farmWorkServiceToastPresentation('点地块/设施或点农务入口打开面板', locationId === 'farmstead' ? farmsteadRootContextAssetId(state) : undefined);
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

  function isMovementPassable(point: GridPoint): boolean {
    const tile = tileAt(state, point.x, point.y);
    return Boolean(tile && tile.blockType === 'none');
  }

  function cancelWorldMovement(): void {
    playerMovementAnimation = null;
    queuedMovementPath = [];
    pendingWorldCommand = null;
    deferredPointerTile = null;
  }

  function cancelWorldMovementForSurfaceTransition(): void {
    if (!worldMovementActive()) return;
    cancelWorldMovement();
    requestRender?.();
  }

  function applyAnimatedMoveStep(next: GridPoint, startedAtMs = performance.now()): boolean {
    const from = { ...state.player.position };
    const direction = directionBetween(from, next);
    if (!direction || !isAdjacentCardinal(from, next) || !isMovementPassable(next)) return false;
    state.player.facing = direction as Direction;
    if (layers.reducedMotion) {
      applyAction(state, { kind: 'move', to: next }, ctx);
      return sameGridPoint(state.player.position, next);
    }
    playerMovementAnimation = {
      from,
      to: { ...next },
      startedAtMs,
      durationMs: PLAYER_STEP_DURATION_MS
    };
    return true;
  }

  function commitCompletedMoveAnimation(animation: PlayerMovementAnimation): boolean {
    if (!sameGridPoint(state.player.position, animation.from)) return false;
    if (!isMovementPassable(animation.to)) return false;
    applyAction(state, { kind: 'move', to: animation.to }, ctx);
    return sameGridPoint(state.player.position, animation.to);
  }

  function finishPendingWorldCommand(): boolean {
    const command = pendingWorldCommand;
    if (!command) return false;
    pendingWorldCommand = null;
    faceTowardTile(command.target);
    const handled = command.run();
    saveState(state);
    return handled;
  }

  function abortPendingWorldCommand(message = '前路被挡住了，换个落脚点再试'): void {
    const target = pendingWorldCommand?.target ?? pointerTile;
    cancelWorldMovement();
    setLastPointerAction('blocked', target);
    toast(message, 'loc.farmstead');
  }

  function beginNextQueuedMoveStep(nowMs: number): boolean {
    const next = queuedMovementPath.shift();
    if (!next) return false;
    const moved = applyAnimatedMoveStep(next, nowMs);
    if (!moved) {
      abortPendingWorldCommand();
      return false;
    }
    if (layers.reducedMotion) saveState(state);
    return true;
  }

  function advanceWorldMovement(nowMs: number): void {
    let completedStep = false;
    if (playerMovementAnimation && nowMs - playerMovementAnimation.startedAtMs >= playerMovementAnimation.durationMs) {
      const completedAnimation = playerMovementAnimation;
      playerMovementAnimation = null;
      if (!commitCompletedMoveAnimation(completedAnimation)) {
        abortPendingWorldCommand();
        return;
      }
      saveState(state);
      completedStep = true;
    }

    if (completedStep && deferredPointerTile) {
      const nextTarget = { ...deferredPointerTile };
      cancelWorldMovement();
      performPointerWorldActionAt(nextTarget);
      return;
    }

    while (!playerMovementAnimation && queuedMovementPath.length > 0) {
      if (!beginNextQueuedMoveStep(nowMs)) return;
      if (!layers.reducedMotion) return;
    }

    if (!playerMovementAnimation && queuedMovementPath.length === 0) finishPendingWorldCommand();
  }

  function currentPlayerMovementVisual(nowMs: number): PlayerMovementVisual {
    return playerMovementVisualPosition(state.player.position, playerMovementAnimation, nowMs, layers.reducedMotion);
  }

  function currentPendingWorldVisual(): PendingWorldVisual | null {
    if (!pendingWorldCommand) return null;
    const path: GridPoint[] = [];
    if (playerMovementAnimation?.to) path.push({ ...playerMovementAnimation.to });
    for (const point of queuedMovementPath) path.push({ ...point });
    return {
      target: { ...pendingWorldCommand.target },
      destination: { ...pendingWorldCommand.destination },
      path,
      description: pendingWorldCommand.description
    };
  }

  function worldMovementActive(): boolean {
    return playerMovementAnimation != null || queuedMovementPath.length > 0 || pendingWorldCommand != null;
  }

  function move(dir: Direction): void {
    if (playerMovementAnimation && !layers.reducedMotion) return;
    cancelWorldMovement();
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const target = { x: state.player.position.x + dx, y: state.player.position.y + dy };
    state.player.facing = dir;
    applyAnimatedMoveStep(target);
  }

  function moveImmediate(dir: Direction): void {
    cancelWorldMovement();
    const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0;
    const target = { x: state.player.position.x + dx, y: state.player.position.y + dy };
    state.player.facing = dir;
    if (isMovementPassable(target)) applyAction(state, { kind: 'move', to: target }, ctx);
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
    // R3-C1-a：走 D-27 主动引劫链（invoke→countdown→due），不再 runTribulation+breakthrough 立即短路。
    // 玩家按引劫→进入 T_trib 日级准备窗（布阵/炼丹/备丹）；countdown 归零由 resolveDueTribulation 结算。
    // 完整玩家逐雷操作大考（C1-b）与秒级雷场 UI（D-07）是大工程，推迟。
    applyAction(state, { kind: 'invoke-tribulation' }, ctx);
    const prepareDays = state.tribulation.daysRemaining;
    toast(`引劫已启动：${prepareDays} 日准备窗——布阵、炼丹、备承雷丹，归零即渡劫。`, 'loc.array-shed');
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

  function faceTowardTile(target: { x: number; y: number }): void {
    const dx = target.x - state.player.position.x;
    const dy = target.y - state.player.position.y;
    if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
      state.player.facing = dx > 0 ? 'right' : 'left';
      return;
    }
    if (dy !== 0) state.player.facing = dy > 0 ? 'down' : 'up';
  }

  function setLastPointerAction(action: PointerWorldActionKind, tile: { x: number; y: number } | null): void {
    lastPointerAction = action;
    lastPointerTile = tile ? { ...tile } : null;
  }

  function firstOwnedContextSeed(): { seedId: string; switched: boolean } | null {
    const current = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    if (current.kind === 'seed' && current.seedId && itemCount(state.player, current.seedId) > 0) {
      return { seedId: current.seedId, switched: false };
    }

    const nextSeedIdx = findNextOwnedSeedHotbarIndex(hotbarIdx, 1, id => itemCount(state.player, id));
    if (nextSeedIdx == null) return null;
    const next = HOTBAR_SLOTS[nextSeedIdx] ?? HOTBAR_SLOTS[4]!;
    if (next.kind !== 'seed' || !next.seedId) return null;
    setHotbarIndex(nextSeedIdx, true);
    return { seedId: next.seedId, switched: true };
  }

  function performContextFarmActionAt(at: { x: number; y: number }): boolean {
    const tile = tileAt(state, at.x, at.y);
    if (!tile) {
      setLastPointerAction('blocked', at);
      return false;
    }
    faceTowardTile(at);

    const crop = tile.cropId != null ? (state.crops.get(tile.cropId) ?? state.crops.get(tile.id) ?? null) : null;
    if (tile.blockType !== 'none' && !crop) {
      toast('这里已有设施或障碍，点设施本体进行处理', 'loc.farmstead');
      setLastPointerAction('blocked', at);
      return false;
    }
    if (!isFarmsteadFarmPlotTile(state, at.x, at.y) && !crop) {
      const presentation = farmActionBlockedToastPresentation('till', 'outside-farm-plot');
      toast(presentation.message, presentation.assetId);
      setLastPointerAction('blocked', at);
      return false;
    }

    if (crop) {
      const herb = reg.herbs.get(crop.defId);
      if (herb && crop.growth >= herb.growthThreshold) {
        const done = performFarmAction('harvest', at);
        setLastPointerAction(done ? 'farm-harvest' : 'blocked', at);
        return done;
      }
      if (!tile.wateredToday || tile.moisture < 55_000) {
        const done = performFarmAction('water', at);
        setLastPointerAction(done ? 'farm-water' : 'blocked', at);
        return done;
      }
      if (!tile.channeledToday || tile.qiDensity < 55_000) {
        const done = performFarmAction('channel-qi', at);
        setLastPointerAction(done ? 'farm-channel-qi' : 'blocked', at);
        return done;
      }
      toast('这株灵草状态稳定，明日再照料', itemIconAssetId(crop.defId, reg));
      setLastPointerAction('farm-stable', at);
      return true;
    }

    if (!tile.tilled && getOnboardingObjectiveId(state) === 'first-second-sow') {
      const seed = firstOwnedContextSeed();
      if (!seed) {
        const presentation = sowUnavailableToastPresentation();
        toast(presentation.message, presentation.assetId);
        setLastPointerAction('blocked', at);
        return false;
      }
      const tilled = performFarmAction('till', at);
      if (!tilled) {
        setLastPointerAction('blocked', at);
        return false;
      }
      const sown = performSowAction(seed.seedId, seed.switched, at);
      setLastPointerAction(sown ? 'farm-sow' : 'farm-till', at);
      return sown || tilled;
    }

    if (!tile.tilled) {
      const done = performFarmAction('till', at);
      setLastPointerAction(done ? 'farm-till' : 'blocked', at);
      return done;
    }

    const seed = firstOwnedContextSeed();
    if (!seed) {
      const presentation = sowUnavailableToastPresentation();
      toast(presentation.message, presentation.assetId);
      setLastPointerAction('blocked', at);
      return false;
    }
    const done = performSowAction(seed.seedId, seed.switched, at);
    setLastPointerAction(done ? 'farm-sow' : 'blocked', at);
    return done;
  }

  function performSecondaryToolInteraction(): boolean {
    if (worldMovementActive()) return false;
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

  function tryPickupGroundItem(): boolean {
    // 场景拾取：脚下有地面物品时优先拾取，再交给普通前格动作。
    const gi = groundItemAtIndex(state, state.player.position);
    if (!gi) return false;
    const name = reg.items.get(gi.itemId)?.displayName ?? gi.itemId;
    const eventStart = state.events.length;
    applyAction(state, { kind: 'pickup-ground-item' }, ctx);
    const recentEvents = state.events.slice(eventStart);
    let pickupEvent = recentEvents.find(e => e.type === 'pickup');
    for (let i = recentEvents.length - 1; i >= 0; i -= 1) {
      const event = recentEvents[i];
      if (event?.type === 'pickup') {
        pickupEvent = event;
        break;
      }
    }
    const blocked = recentEvents.some(e => e.type === 'pickup-blocked');
    saveState(state);
    const pickupPayload = (pickupEvent?.payload ?? {}) as { count?: number; remaining?: number };
    if (pickupEvent) {
      const picked = Math.max(1, pickupPayload.count ?? 1);
      const remaining = Math.max(0, pickupPayload.remaining ?? 0);
      toast(remaining > 0 ? `拾得 ${name} ×${picked}，余下 ${remaining} 件放不下` : `拾得 ${name} ×${picked}`);
    } else if (blocked) {
      toast(`背包已满或堆叠已满，无法拾取 ${name}`);
    }
    return true;
  }

  function performFarmsteadObjectInteraction(objectOverride?: ReturnType<typeof frontFarmsteadSceneObject>): boolean {
    const object = objectOverride ?? frontFarmsteadSceneObject(state);
    if (!object) return false;
    faceTowardTile({ x: object.x, y: object.y });

    switch (object.kind) {
      case 'house':
        applyAction(state, { kind: 'rest' }, ctx);
        audio.playSfx('eat-pill');
        {
          const presentation = restSuccessToastPresentation(object.assetId);
          toast(presentation.message, presentation.assetId);
        }
        return true;
      case 'storage':
        openStoragePanel('deposit');
        return true;
      case 'shipping':
        openFarmActionKind('shipping-normal');
        return true;
      case 'furnace':
        openFurnaceInventory();
        return true;
      case 'array-shed':
        preselectArrayBuildChoice('lightning-rod');
        openFarmActionKind('build');
        return true;
      case 'map-gate':
        activateLocationSelection('地点');
        return true;
    }
  }

  function processingActionForFacility(kind: FacilityKind): FarmActionKind {
    switch (kind) {
      case 'drying-rack':
        return 'processing-drying';
      case 'sealing-cabinet':
        return 'processing-sealing';
      case 'talisman-furnace':
        return 'processing-furnace';
    }
  }

  function performBuiltFacilityInteraction(facility: NonNullable<ReturnType<typeof facilityAt>>, at: GridPoint): boolean {
    faceTowardTile(at);
    if (facility.job) {
      openFacilityCollectPanel(facility.id);
      return interactionPanel.kind === 'facility-collect';
    }
    openFarmActionKind(processingActionForFacility(facility.kind));
    return interactionPanel.kind === 'processing';
  }

  function performNpcWorldPreviewInteraction(placement: NpcWorldPreviewPlacement, at: GridPoint): boolean {
    faceTowardTile(at);
    const npcIndex = getNpcList(state).findIndex(npc => npc.id === placement.npcId);
    if (npcIndex >= 0) {
      cancelWorldMovementForSurfaceTransition();
      locationSelectionActive = false;
      npcIdx = npcIndex;
      openNpcPanel('browse');
      const handled = interactionPanel.kind === 'npc';
      setLastPointerAction(handled ? 'object' : 'blocked', at);
      return handled;
    }

    const handled = focusLocationSelection(placement.locationId, '地点');
    setLastPointerAction(handled ? 'object' : 'blocked', at);
    return handled;
  }

  function performLocationWorldPreviewInteraction(placement: LocationWorldPreviewPlacement, at: GridPoint): boolean {
    faceTowardTile(at);
    const handled = focusLocationSelection(placement.locationId, '地点');
    setLastPointerAction(handled ? 'object' : 'blocked', at);
    return handled;
  }

  function performDefaultConfirm(): boolean {
    if (worldMovementActive()) return true;
    if (locationSelectionActive) {
      executeSelectedLocationService();
      return true;
    }
    if (confirmInteractionPanel()) return true;
    if (tryPickupGroundItem()) return true;
    if (performFarmsteadObjectInteraction()) return true;
    performPrimaryInteraction();
    return true;
  }

  function frontTileHasFarmContext(at: GridPoint): boolean {
    const tile = tileAt(state, at.x, at.y);
    if (!tile) return false;
    const crop = tile.cropId != null ? (state.crops.get(tile.cropId) ?? state.crops.get(tile.id) ?? null) : null;
    return crop != null || isFarmsteadFarmPlotTile(state, at.x, at.y);
  }

  function performProductConfirm(): boolean {
    if (worldMovementActive()) return true;
    if (locationSelectionActive) {
      executeSelectedLocationService();
      return true;
    }
    if (confirmInteractionPanel()) return true;
    if (tryPickupGroundItem()) return true;
    if (performFarmsteadObjectInteraction()) return true;
    const at = frontTile();
    if (frontTileHasFarmContext(at)) {
      performContextFarmActionAt(at);
      return true;
    }
    performPrimaryInteraction();
    return true;
  }

  function canvasLogicalPointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    if (clientX < rect.left || clientY < rect.top || clientX > rect.right || clientY > rect.bottom) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * app.screen.width,
      y: ((clientY - rect.top) / rect.height) * app.screen.height
    };
  }

  function canvasLocalPointForTileForTest(x: number, y: number): { x: number; y: number } | null {
    const tilePoint = screenPointForTile(x, y);
    const rect = app.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: (tilePoint.x / app.screen.width) * rect.width,
      y: (tilePoint.y / app.screen.height) * rect.height
    };
  }

  function tileCoordinatesFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const point = canvasLogicalPointFromClient(clientX, clientY);
    return point ? tileCoordinatesFromScreenPoint(state, point) : null;
  }

  function logicalPointInRect(point: { x: number; y: number }, rect: { x: number; y: number; width: number; height: number }): boolean {
    return point.x >= rect.x && point.y >= rect.y && point.x <= rect.x + rect.width && point.y <= rect.y + rect.height;
  }

  function activeCanvasPanelHit(point: { x: number; y: number }): 'interaction' | 'location' | null {
    if (interactionPanelActive(interactionPanel)) {
      const height = itemPreviewBoxHeight(layers.panelPreviewText.visible ? layers.panelPreviewText.height : 0);
      if (logicalPointInRect(point, { x: PANEL_PREVIEW_BOX.x, y: PANEL_PREVIEW_BOX.y, width: PANEL_PREVIEW_BOX.width, height })) return 'interaction';
    }
    if (locationSelectionActive) {
      const height = locationPreviewBoxHeight(layers.locationPreviewText.visible ? layers.locationPreviewText.height : 0);
      if (logicalPointInRect(point, { x: LOCATION_PREVIEW_BOX.x, y: LOCATION_PREVIEW_BOX.y, width: LOCATION_PREVIEW_BOX.width, height })) return 'location';
    }
    return null;
  }

  function performCanvasPanelConfirmAt(clientX: number, clientY: number): boolean {
    const point = canvasLogicalPointFromClient(clientX, clientY);
    if (!point) return false;
    const hit = activeCanvasPanelHit(point);
    if (hit === 'location') return performDefaultConfirm();
    if (hit === 'interaction') return confirmInteractionPanel();
    return false;
  }

  function performBuildPanelWorldTargetAt(clientX: number, clientY: number): boolean {
    if (interactionPanel.kind !== 'build') return false;
    const at = tileCoordinatesFromClient(clientX, clientY);
    if (!at) return false;
    pointerTile = { ...at };
    const choice = selectedBuildChoice();
    const placed = performBuildChoice(choice, at);
    setLastPointerAction(placed ? (choice.kind === 'array' ? 'array-place' : 'build-place') : 'blocked', at);
    requestRender?.();
    refreshAppPresentation();
    return true;
  }

  function clearCanvasPanelPointerNoop(): void {
    pointerTile = null;
    setLastPointerAction('none', null);
    requestRender?.();
    refreshAppPresentation();
  }

  function uniqueGridPoints(points: readonly GridPoint[]): GridPoint[] {
    const seen = new Set<string>();
    const result: GridPoint[] = [];
    for (const point of points) {
      const key = `${point.x},${point.y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(point);
    }
    return result;
  }

  function farmsteadObjectInteractionGoals(object: FarmsteadSceneObject): GridPoint[] {
    const footprint = object.footprint ?? { x: object.x, y: object.y, width: 1, height: 1 };
    const candidates: GridPoint[] = [];
    for (let x = footprint.x; x < footprint.x + footprint.width; x += 1) {
      candidates.push({ x, y: footprint.y - 1 });
      candidates.push({ x, y: footprint.y + footprint.height });
    }
    for (let y = footprint.y; y < footprint.y + footprint.height; y += 1) {
      candidates.push({ x: footprint.x - 1, y });
      candidates.push({ x: footprint.x + footprint.width, y });
    }
    return uniqueGridPoints(candidates);
  }

  function queueWorldCommand(goals: readonly GridPoint[], command: PendingWorldCommand, blockedMessage: string): boolean {
    cancelWorldMovement();
    const path = findGridPath({
      width: state.width,
      height: state.height,
      start: state.player.position,
      goals,
      isPassable: isMovementPassable
    });

    if (path == null) {
      faceTowardTile(command.target);
      setLastPointerAction('blocked', command.target);
      toast(blockedMessage, 'loc.farmstead');
      return false;
    }

    queuedMovementPath = path.map(point => ({ ...point }));
    pendingWorldCommand = {
      ...command,
      destination: queuedMovementPath[queuedMovementPath.length - 1] ?? { ...state.player.position }
    };
    if (queuedMovementPath.length === 0) return finishPendingWorldCommand();

    setLastPointerAction('move', command.target);
    const started = beginNextQueuedMoveStep(performance.now());
    if (started && layers.reducedMotion) advanceWorldMovement(performance.now());
    requestRender?.();
    return started;
  }

  function performPointerWorldActionAt(at: { x: number; y: number }): boolean {
    pointerTile = { ...at };
    if (playerMovementAnimation && !layers.reducedMotion) {
      deferredPointerTile = { ...at };
      setLastPointerAction('move', at);
      requestRender?.();
      refreshAppPresentation();
      return true;
    }

    const tile = tileAt(state, at.x, at.y);
    if (!tile) {
      setLastPointerAction('blocked', at);
      return false;
    }

    const object = farmsteadSceneObjectAt(state, at.x, at.y);
    if (object) {
      return queueWorldCommand(
        farmsteadObjectInteractionGoals(object),
        {
          target: { ...at },
          destination: { ...at },
          description: object.title,
          run: () => {
            const handled = performFarmsteadObjectInteraction(object);
            setLastPointerAction(handled ? 'object' : 'blocked', at);
            return handled;
          }
        },
        '到不了这个设施旁边，先绕开障碍'
      );
    }

    const builtFacility = facilityAt(state, tile.id);
    if (builtFacility) {
      return queueWorldCommand(
        interactionAdjacentGoals({
          target: at,
          width: state.width,
          height: state.height,
          isPassable: isMovementPassable
        }),
        {
          target: { ...at },
          destination: { ...at },
          description: FACILITY_LABEL[builtFacility.kind],
          run: () => {
            const handled = performBuiltFacilityInteraction(builtFacility, at);
            setLastPointerAction(handled ? 'object' : 'blocked', at);
            return handled;
          }
        },
        '到不了这个设施旁边，先绕开障碍'
      );
    }

    const ground = groundItemAtIndex(state, at);
    if (ground && tile.blockType === 'none') {
      return queueWorldCommand(
        [at],
        {
          target: { ...at },
          destination: { ...at },
          description: '拾取',
          run: () => {
            const eventStart = state.events.length;
            if (tryPickupGroundItem()) {
              const picked = state.events.slice(eventStart).some(e => e.type === 'pickup');
              setLastPointerAction(picked ? 'pickup' : 'blocked', at);
              return true;
            }
            setLastPointerAction('blocked', at);
            return false;
          }
        },
        '到不了这件掉落物旁边，先清出道路'
      );
    }

    const npcPreview = npcWorldPreviewPlacementAt(state, at.x, at.y);
    if (npcPreview) {
      return queueWorldCommand(
        interactionAdjacentGoals({
          target: at,
          width: state.width,
          height: state.height,
          isPassable: isMovementPassable
        }),
        {
          target: { ...at },
          destination: { ...at },
          description: npcPreview.npcName,
          run: () => performNpcWorldPreviewInteraction(npcPreview, at)
        },
        '到不了这位人物身边，先绕开障碍'
      );
    }

    const locationPreview = locationWorldPreviewPlacementAt(state, at.x, at.y);
    if (locationPreview) {
      const locationName = LOCATION_CATALOG.find(location => location.id === locationPreview.locationId)?.displayName ?? '地点';
      return queueWorldCommand(
        interactionAdjacentGoals({
          target: at,
          width: state.width,
          height: state.height,
          isPassable: isMovementPassable
        }),
        {
          target: { ...at },
          destination: { ...at },
          description: locationName,
          run: () => performLocationWorldPreviewInteraction(locationPreview, at)
        },
        '到不了这个地点标记旁边，先绕开障碍'
      );
    }

    if (isFarmsteadFarmPlotTile(state, at.x, at.y) || tile.cropId != null) {
      return queueWorldCommand(
        interactionAdjacentGoals({
          target: at,
          width: state.width,
          height: state.height,
          isPassable: isMovementPassable
        }),
        {
          target: { ...at },
          destination: { ...at },
          description: '照料灵田',
          run: () => performContextFarmActionAt(at)
        },
        '到不了这块灵田，先换一个可达位置'
      );
    }

    if (tile.blockType === 'none') {
      return queueWorldCommand(
        [at],
        {
          target: { ...at },
          destination: { ...at },
          description: '前往',
          run: () => {
            setLastPointerAction('move', at);
            return true;
          }
        },
        '到不了这里，先换一个落脚点'
      );
    }

    faceTowardTile(at);
    toast('这里不能处理，点药田、设施或可通行的空地', 'loc.farmstead');
    setLastPointerAction('blocked', at);
    return false;
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
    if (worldMovementActive()) {
      cancelWorldMovement();
      toast('已停下', 'sprite.player');
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

  function distanceFromPlayer(point: { x: number; y: number }): number {
    return Math.abs(point.x - state.player.position.x) + Math.abs(point.y - state.player.position.y);
  }

  function reachableInteractionPathToTarget(target: GridPoint): GridPoint[] | null {
    return findGridPath({
      width: state.width,
      height: state.height,
      start: state.player.position,
      goals: interactionAdjacentGoals({
        target,
        width: state.width,
        height: state.height,
        isPassable: isMovementPassable
      }),
      isPassable: isMovementPassable
    });
  }

  function journeyFarmTarget(objective: ReturnType<typeof getPublicDemoObjectiveId>): GridPoint | null {
    const matchesObjective = (tile: (typeof state.tiles)[number]): boolean => {
      if (!isFarmsteadFarmPlotTile(state, tile.x, tile.y) && tile.cropId == null) return false;
      if (tile.blockType !== 'none') return false;
      if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') return false;
      const crop = tile.cropId != null ? (state.crops.get(tile.cropId) ?? state.crops.get(tile.id) ?? null) : null;
      switch (objective) {
        case 'first-till':
          return isFarmsteadFarmPlotTile(state, tile.x, tile.y) && !tile.tilled && crop == null;
        case 'first-sow':
          return isFarmsteadFarmPlotTile(state, tile.x, tile.y) && tile.tilled && crop == null;
        case 'first-second-sow':
          return isFarmsteadFarmPlotTile(state, tile.x, tile.y) && crop == null;
        case 'first-water':
        case 'first-second-water':
          return crop != null && (!tile.wateredToday || tile.moisture < 55_000);
        case 'first-harvest': {
          if (!crop) return false;
          const herb = reg.herbs.get(crop.defId);
          return herb != null && crop.growth >= herb.growthThreshold;
        }
        default:
          return false;
      }
    };

    const front = frontTile();
    const frontTarget = tileAt(state, front.x, front.y);
    if (frontTarget && matchesObjective(frontTarget)) return front;

    const candidates = state.tiles
      .filter(matchesObjective)
      .map(tile => {
        const path = reachableInteractionPathToTarget({ x: tile.x, y: tile.y });
        return path == null ? null : { tile, pathLength: path.length };
      })
      .filter((entry): entry is { tile: (typeof state.tiles)[number]; pathLength: number } => entry != null)
      .sort((a, b) => a.pathLength - b.pathLength || distanceFromPlayer(a.tile) - distanceFromPlayer(b.tile) || a.tile.y - b.tile.y || a.tile.x - b.tile.x);

    const target = candidates[0]?.tile;
    if (target) return { x: target.x, y: target.y };
    if (objective === 'first-sow') {
      const fallback = firstFarmsteadFarmPlotTile(state);
      return fallback && reachableInteractionPathToTarget(fallback) != null ? fallback : null;
    }
    return null;
  }

  function performJourneyFarmTarget(objective: ReturnType<typeof getPublicDemoObjectiveId>): boolean {
    const target = journeyFarmTarget(objective);
    return target ? performPointerWorldActionAt(target) : false;
  }

  function performJourneyPrimaryAction(): void {
    const objective = getPublicDemoObjectiveId(state);
    switch (objective) {
      case 'first-till':
        if (performJourneyFarmTarget(objective)) return;
        performFarmAction('till');
        return;
      case 'first-sow':
      case 'first-second-sow':
        if (performJourneyFarmTarget(objective)) return;
        sowFromHotbarSelection(false);
        return;
      case 'first-water':
      case 'first-second-water':
        if (performJourneyFarmTarget(objective)) return;
        performFarmAction('water');
        return;
      case 'first-harvest':
        if (journeyGuideContextFromState(state).hasMatureCrop === false) {
          toast('灵草尚未成熟。点“歇息”推进到明日，再回来收获。', 'herb.mossling');
          return;
        }
        if (performJourneyFarmTarget(objective)) return;
        performFarmAction('harvest');
        return;
      case 'journey-alchemy':
        openFurnaceInventory();
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
    const worldOnlyTarget = target === 'menu' || target === 'inventory' || target === 'cultivation' || target === 'map' || target === 'furnace' || target === 'journey';
    if (worldOnlyTarget && sourceScreen !== 'world') return false;
    flowView.dispatch({ type: 'close-overlay' });
    const returnFocus = flowView.getState().focus.initial;
    switch (target) {
      case 'inventory':
        openInventoryFlowOverlay('inventory', returnFocus);
        return true;
      case 'cultivation':
      case 'map':
      case 'pause':
      case 'settings':
        return openFlowOverlay(target, returnFocus);
      case 'furnace':
        openFurnaceInventory(returnFocus);
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
          spawnBurst(layers, impact.x, impact.y, action.perfectBlock ? 28 : 16, action.perfectBlock ? ColorPalette.purpleAction : ColorPalette.giltBright);
          spawnFloatText(layers, impact.x, impact.y - 12, action.perfectBlock ? '完美擦弹' : '劫雷', action.perfectBlock ? ColorPalette.purpleText : ColorPalette.giltBright);
        }
        if (state.tutorialTribulation.phase === 'aftermath') flowView?.dispatch({ type: 'finish-tribulation' });
        break;
      case 'move':
        if (state.tutorialTribulation.phase === 'active') moveImmediate(action.direction);
        break;
    }

    saveState(state);
    refreshAppPresentation();
  }

  function closeWorldCommandMore(): void {
    const more = document.querySelector<HTMLDetailsElement>('#world-command-more');
    if (more?.open) more.open = false;
  }

  function dispatchGameCommand(command: GameCommand): void {
    audio.init();
    audio.resume();
    closeWorldCommandMore();
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
        else if (!paused) performProductConfirm();
        break;
      case 'cancel':
        if (worldMovementActive() && !dialogueBeat && !paused && flowView?.getState().screen === 'world' && flowView.getState().overlay == null) {
          openFlowOverlay('pause');
        } else {
          cancelCurrentSurface();
        }
        break;
      case 'cycle':
        if (interactionPanelActive(interactionPanel)) cycleActiveInteractionPanel(command.direction === 'previous');
        else if (locationSelectionActive) cycleLocation(command.direction === 'previous');
        else if (LEGACY_SHORTCUTS_ENABLED && !hotbarWheelBlocked()) cycleHotbar(command.direction === 'previous' ? -1 : 1, true);
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
            if (!paused && flowView) openInventoryFlowOverlay('inventory');
            else if (!paused) toggleInventoryVisibility();
            break;
          case 'cultivation':
            if (!paused && flowView) openFlowOverlay('cultivation');
            else if (!paused) toggleCultivationPanel();
            break;
          case 'map':
            if (!paused && flowView) openFlowOverlay('map');
            else if (!paused) activateLocationSelection('地点');
            break;
          case 'furnace':
            if (!paused) openFurnaceInventory();
            break;
          case 'journey':
            if (!paused) performJourneyPrimaryAction();
            break;
          case 'pause':
          case 'settings':
            if (flowView) openFlowOverlay(command.target);
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

  function returnFromOverlay(): void {
    if (flowView?.getState().overlay != null) flowView.dispatch({ type: 'close-overlay' });
  }

  function executeMapService(locationId: LocationId, command: LocationServiceCommand): void {
    const location = getActiveLocationDirectory(state).find(entry => entry.id === locationId);
    const option = location ? getLocationServiceOptions(state, locationId).find(entry => entry.command === command) : null;
    if (!location || !option) {
      const presentation = location ? locationServiceUnavailableToastPresentation(location, state) : locationDirectoryEmptyToastPresentation(farmsteadRootContextAssetId(state));
      toast(presentation.message, presentation.assetId);
      refreshAppPresentation();
      return;
    }

    returnFromOverlay();
    clearInteractionPanel(false);
    clearLocationSelection(false);
    switch (option.command) {
      case 'show-farm-work':
        openFarmActionPanel();
        break;
      case 'show-processing':
        openFarmActionKind('processing-drying');
        break;
      case 'show-arrays':
        preselectArrayBuildChoice('lightning-rod');
        openFarmActionKind('build');
        break;
      default:
        executeLocationCommand(option.command, option.locationId);
        break;
    }
    saveState(state);
    refreshAppPresentation();
  }

  type CultivationSurfaceCommand = 'farm' | 'furnace' | 'arrays' | 'map' | 'tribulation';

  function isCultivationSurfaceCommand(value: string | undefined): value is CultivationSurfaceCommand {
    return value === 'farm' || value === 'furnace' || value === 'arrays' || value === 'map' || value === 'tribulation';
  }

  function executeCultivationSurfaceCommand(command: CultivationSurfaceCommand): void {
    returnFromOverlay();
    clearInteractionPanel(false);
    clearLocationSelection(false);
    switch (command) {
      case 'farm':
        openFarmActionPanel();
        break;
      case 'furnace':
        openFurnaceInventory();
        break;
      case 'arrays':
        preselectArrayBuildChoice('lightning-rod');
        openFarmActionKind('build');
        break;
      case 'map':
        openFlowOverlay('map');
        break;
      case 'tribulation':
        tryTribulation();
        break;
    }
    saveState(state);
    refreshAppPresentation();
  }

  function handleMapSurfaceClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-map-service-command]');
    if (!button || button.disabled) return;
    const locationId = button.dataset.mapLocation as LocationId | undefined;
    const command = button.dataset.mapServiceCommand as LocationServiceCommand | undefined;
    if (!locationId || !command) return;
    event.preventDefault();
    event.stopPropagation();
    executeMapService(locationId, command);
  }

  function handleCultivationSurfaceClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-cultivation-command]');
    const command = button?.dataset.cultivationCommand;
    if (!button || !isCultivationSurfaceCommand(command)) return;
    event.preventDefault();
    event.stopPropagation();
    executeCultivationSurfaceCommand(command);
  }

  function handleProductKeydown(ev: KeyboardEvent): boolean {
    const command = gameCommandFromKeyboard(
      {
        key: ev.key,
        code: ev.code,
        shiftKey: ev.shiftKey,
        ctrlKey: ev.ctrlKey,
        altKey: ev.altKey,
        metaKey: ev.metaKey
      },
      { enterBehavior: 'confirm', shortcutProfile: 'product' }
    );
    if (!command) return false;
    dispatchGameCommand(command);
    return true;
  }

  const portraitMedia = window.matchMedia('(orientation: portrait) and (max-width: 900px)');
  // ISSUE-004: 竖屏用户可手动放行横屏提示。override 仅存内存（本次会话），
  // 不写 localStorage —— 下次加载时横屏建议照常出现。
  let portraitOverride = false;
  if (BUILD_TITLE) document.title = `永恒山谷：大道之歌 · ${BUILD_TITLE}`;
  flowView = createAppFlowViewController({
    continueAvailable: hasCultivationJourney(),
    buildLabel: BUILD_LABEL,
    onReloadRequest: () => window.location.reload(),
    onStateChange: handleFlowStateChange
  });
  const handlePortraitChange = (event: MediaQueryListEvent): void => {
    // 用户已本次会话内手动关闭横屏提示：不再因方向变化重新弹出遮罩，
    // 保持当前界面（如灵韵叙录）继续可用。
    if (portraitOverride) {
      flowView?.setPortraitBlocked(false);
      return;
    }
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

  // 竖屏遮罩文案与手动放行（ISSUE-004）。文案经 i18n(t) 取自 zh-CN.json；
  // #orientation-gate 内的按钮无 data-flow-action，由本处自管点击（appFlowView 不接管）。
  const orientationGateEl = document.querySelector<HTMLElement>('#orientation-gate');
  const orientationOverrideBtn = document.querySelector<HTMLButtonElement>('#orientation-override');
  const orientationOverrideNote = document.querySelector<HTMLElement>('#orientation-override-note');
  const orientationKickerEl = document.querySelector<HTMLElement>('.orientation-kicker');
  const orientationHeadingEl = document.querySelector<HTMLElement>('#orientation-heading');
  const orientationSaveStatusEl = document.querySelector<HTMLElement>('#orientation-save-status');
  if (orientationKickerEl) orientationKickerEl.textContent = t('ui.orientation.kicker');
  if (orientationHeadingEl) orientationHeadingEl.textContent = t('ui.orientation.heading');
  if (orientationSaveStatusEl) orientationSaveStatusEl.textContent = t('ui.orientation.saveStatus');
  if (orientationOverrideNote) orientationOverrideNote.textContent = t('ui.orientation.overrideNote');
  if (orientationOverrideBtn) {
    orientationOverrideBtn.textContent = t('ui.orientation.overrideButton');
    orientationOverrideBtn.setAttribute('aria-label', t('ui.orientation.overrideLabel'));
  }

  const dismissOrientationGate = (): void => {
    if (portraitOverride) return;
    portraitOverride = true;
    flowView?.setPortraitBlocked(false);
    requestRender?.();
    refreshAppPresentation();
    // 放行后焦点交回当前主界面（标题屏的「灵韵叙录」入口即可 Tab/点击到达）。
    flowView?.refocusCurrentSurface();
  };

  orientationOverrideBtn?.addEventListener('click', event => {
    event.preventDefault();
    dismissOrientationGate();
  });

  // 键盘可达性：flowView 在 portraitBlocked 时会在 document capture 阶段吞掉所有按键。
  // 此处在 window capture（早于 document）放行指向遮罩内控件的 Tab/Enter/Space，
  // stopPropagation 阻断 document 监听器，让按钮的默认激活（Enter/Space → click）正常触发。
  if (orientationGateEl && orientationOverrideBtn) {
    const onOrientationGateKeydown = (event: KeyboardEvent): void => {
      if (!portraitMedia.matches || portraitOverride) return;
      const target = event.target;
      if (!(target instanceof Element) || !orientationGateEl.contains(target)) return;
      if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') {
        event.stopPropagation();
      }
    };
    window.addEventListener('keydown', onOrientationGateKeydown, { capture: true });
  }

  responsiveShell = createResponsiveShell({ dispatch: dispatchGameCommand });
  document.querySelector<HTMLElement>('[data-app-surface="map"]')?.addEventListener('click', handleMapSurfaceClick);
  document.querySelector<HTMLElement>('[data-app-surface="cultivation"]')?.addEventListener('click', handleCultivationSurfaceClick);
  publicDemoPanels = createPublicDemoPanelsController({ onAction: handlePublicDemoPanelAction });
  publicDemoPanels.render(state, ctx);

  // 灵韵叙录入口（#flow-title-narration）：点击开「开发者自白」modal；已读则 modal 内部直接 dispatch start-narration。
  // 该按钮无 data-flow-action，由本处自管点击（appFlowView 不接管），modal 仍留在 title surface 之上。
  const narrationHost = document.querySelector<HTMLElement>('[data-app-surface="title"]');
  if (narrationHost) {
    narrationIntro = createNarrationIntro({
      host: narrationHost,
      reducedMotion: runtimeSettings.reducedMotion,
      onStartNarration: () => flowView?.dispatch({ type: 'start-narration' })
    });
    const narrationEntryBtn = document.querySelector<HTMLElement>('#flow-title-narration');
    narrationEntryBtn?.addEventListener('click', event => {
      event.preventDefault();
      narrationIntro?.open();
    });
  }

  // Sokoban 主模式已升为标题「开始游戏」主入口（data-flow-action="start-roguelite-proto"，
  // 见 index.html + appFlowView 的 AppFlowAction/isFlowAction/eventForAction）。
  // 原 ?proto=roguelite dev 入口已移除——主路径即此，无需次要入口。

  // 叙录入口（#flow-narration-codex-open）：灵韵叙录内开「叙录」覆盖层（docs/22 §11）。
  // 该按钮无 data-flow-action（非 appFlowView 既定 action），由本处自管点击派发 open-overlay。
  const codexOpenBtn = document.querySelector<HTMLElement>('#flow-narration-codex-open');
  codexOpenBtn?.addEventListener('click', event => {
    event.preventDefault();
    flowView?.dispatch({ type: 'open-overlay', overlay: 'codex' });
  });

  refreshHotbarHint();
  refreshHelpHint();
  refreshAppPresentation();

  window.addEventListener(
    'wheel',
    ev => {
      if (!LEGACY_SHORTCUTS_ENABLED) return;
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

  app.canvas.addEventListener('pointermove', ev => {
    if (!flowAllowsWorldInput() || state.gameOver || dialogueBeat || paused || blockingOverlayActive() || interactionPanelActive(interactionPanel) || locationSelectionActive) {
      if (pointerTile != null) {
        pointerTile = null;
        requestRender?.();
        refreshAppPresentation();
      }
      return;
    }
    const next = tileCoordinatesFromClient(ev.clientX, ev.clientY);
    if ((next?.x ?? null) === (pointerTile?.x ?? null) && (next?.y ?? null) === (pointerTile?.y ?? null)) return;
    pointerTile = next;
    requestRender?.();
    refreshAppPresentation();
  });

  app.canvas.addEventListener('pointerleave', () => {
    if (pointerTile == null) return;
    pointerTile = null;
    requestRender?.();
    refreshAppPresentation();
  });

  app.canvas.addEventListener('pointerdown', ev => {
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
      if (interactionPanelActive(interactionPanel) || locationSelectionActive) {
        if (performCanvasPanelConfirmAt(ev.clientX, ev.clientY)) {
          saveState(state);
          refreshAppPresentation();
        } else if (performBuildPanelWorldTargetAt(ev.clientX, ev.clientY)) {
          saveState(state);
          refreshAppPresentation();
        } else {
          clearCanvasPanelPointerNoop();
        }
        ev.preventDefault();
        return;
      } else {
        const clickedTile = tileCoordinatesFromClient(ev.clientX, ev.clientY);
        if (clickedTile) {
          performPointerWorldActionAt(clickedTile);
        } else {
          pointerTile = null;
          setLastPointerAction('none', null);
          requestRender?.();
          refreshAppPresentation();
        }
      }
      saveState(state);
      ev.preventDefault();
      return;
    }
    if (ev.button === 2 && worldMovementActive() && flowView?.getState().screen === 'world' && flowView.getState().overlay == null) {
      openFlowOverlay('pause');
      saveState(state);
      refreshAppPresentation();
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
    if ((ev.key === 'b' || ev.key === 'B') && flowView?.getState().overlay === 'inventory' && !ev.altKey && !ev.ctrlKey && !ev.metaKey) {
      ev.preventDefault();
      ev.stopPropagation();
      toggleInventoryVisibility();
      saveState(state);
      refreshAppPresentation();
      return;
    }
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
    if (!LEGACY_SHORTCUTS_ENABLED) {
      if (handleProductKeydown(ev)) ev.preventDefault();
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
        farmMenuShortcut,
        quickLocationShortcut
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
        commandShortcut,
        quickLocationShortcut
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
      case 'b':
      case 'B': {
        if (worldActionShortcut === 'toggle-inventory') toggleInventoryVisibility();
        break;
      }
      case 'n':
        if (worldActionShortcut === 'brew-bone-pill') openFurnaceInventory(APP_FLOW_FOCUS_TARGETS.world, 'recipe.bone-pill');
        break;
      case 'm':
        if (worldActionShortcut === 'brew-detox-pill') openFurnaceInventory(APP_FLOW_FOCUS_TARGETS.world, 'recipe.detox-pill');
        break;
      case 'h':
        if (worldActionShortcut === 'eat-ward-pill') eatById('pill.ward-basic', '承雷丹');
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
            {
              const furnaceBuildIdx = buildChoices.findIndex(choice => choice.kind === 'facility' && choice.facilityKind === 'talisman-furnace');
              facilityBuildIdx = furnaceBuildIdx >= 0 ? furnaceBuildIdx : 0;
            }
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
        if (worldActionShortcut === 'toggle-furnace') openFurnaceInventory();
        break;
      case 'y': {
        if (worldActionShortcut === 'cycle-recipe') openFurnaceInventory();
        break;
      }
      case 'q':
      case 'Q':
        if (qShortcut) performQShortcut(qShortcut);
        break;
      case '[':
        if (worldActionShortcut === 'decrease-furnace-heat') openFurnaceInventory();
        break;
      case ']':
        if (worldActionShortcut === 'increase-furnace-heat') openFurnaceInventory();
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
    layers.ambientTimeMs = worldSurfaceActive ? (playwrightAmbientTimeMs ?? timestamp) : 0;
    if (worldSurfaceActive && !paused && !dialogueBeat && !blockingOverlayActive()) advanceWorldMovement(timestamp);
    drawWorld(layers, state, reg, ctx, renderAssets, {
      pointerTile,
      playerMovement: currentPlayerMovementVisual(timestamp),
      pendingWorld: currentPendingWorldVisual()
    });
    const hotbarSlot = HOTBAR_SLOTS[hotbarIdx] ?? HOTBAR_SLOTS[0]!;
    drawHotbarIcon(layers, renderAssets.hotbarIcons[hotbarSlotAssetId(hotbarSlot) ?? '']);
    refreshHelpHint();
    const canvasBottomHudVisible = LEGACY_SHORTCUTS_ENABLED;
    layers.hud.visible = canvasBottomHudVisible;
    layers.bars.visible = canvasBottomHudVisible;
    for (const label of layers.barLabels) label.visible = canvasBottomHudVisible;
    layers.hotbar.visible = canvasBottomHudVisible;
    layers.help.visible = canvasBottomHudVisible;
    layers.hotbarIconBg.visible = canvasBottomHudVisible;
    if (!canvasBottomHudVisible) {
      layers.hotbarIconBg.clear();
      layers.hotbarIcon.visible = false;
    }
    hideTodayBriefing(layers);
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
    // 叙事节拍（T4）：无对白时寻找下一待浮现节拍；游戏结束清空
    // 纵切片完成后抑制 day-1 教学对白（first-till / first-mature），避免残影重现。
    if (worldSurfaceActive && !state.gameOver) {
      if (!dialogueBeat && !worldMovementActive()) {
        const teachingActive = isJourneyTeachingActive(getPublicDemoObjectiveId(state));
        const nextBeat = nextPendingBeat(state);
        if (nextBeat && (teachingActive || !isJourneyTeachingDialogueBeat(nextBeat.id))) {
          openDialogueBeat(nextBeat);
        } else if (nextBeat && !teachingActive && isJourneyTeachingDialogueBeat(nextBeat.id)) {
          markSeen(state, nextBeat.id);
        }
      } else if (dialogueBeat && !isJourneyTeachingActive(getPublicDemoObjectiveId(state)) && isJourneyTeachingDialogueBeat(dialogueBeat.id)) {
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
    // 灵韵叙录 surface 活跃时由 narrationSurface 自管 narration 语境（docs/22 §12 单点原则），此处跳过避免覆盖。
    if (flowView?.getPresentation().surface !== 'narration' && flowView?.getPresentation().surface !== 'roguelite-proto') {
      const tense = readyForBreakthrough(state, DEFAULT_BALANCE);
      audio.setMusicContext({
        season: state.season,
        zone: tense ? 'tribulation' : 'farm',
        tension: tense ? 'tense' : 'calm',
        active: !state.gameOver
      });
    }
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
      narrationIntro?.destroy();
      narrationSurface?.destroy();
      narrationCodex?.destroy();
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
