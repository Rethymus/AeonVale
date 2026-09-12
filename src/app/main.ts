/**
 * 应用入口：boot（资产/字体/存档健康/音频）→ 流程壳层（appFlowView）。
 * 主模式为修途（rogueliteProto surface，自有画布）与灵韵叙录（narrationSurface）；
 * 旧世界 world 屏渲染与 UI 编排已退役（docs/21 §8.27），Pixi 画布仅承载标题氛围底面。
 * 启动：pnpm dev。全程中文 UI（C8）。
 */
import { Application } from 'pixi.js';
import { type GameState } from '@sim';
import { deserializeState } from '@sim/serialize';
import { buildRegistry, isSchemaHashCompatible } from '@content/registry';
import { t } from '@content/i18n';
import manifestJson from '../../assets/manifest.json';
import { createTitleAmbience } from './titleAmbience';
import { computeViewportLayout } from '@render/viewportLayout';
import { AudioEngine, type SfxId } from '@io/audio';
import { AssetStore, assetUrlForId, validateManifest } from '@io/assets';
import { preloadUiFont } from './fontPreload';
import { type FarmActionFeedbackKind } from './actionFeedback';
import { createResponsiveShell, type ResponsiveShellController } from './responsiveShell';
import { type AppFlowEvent, type AppFlowState } from './appFlowMachine';
import { createAppFlowViewController, type AppFlowViewController } from './appFlowView';
import { createNarrationIntro, type NarrationIntroController } from './narrationIntro';
import { createNarrationSurface, NARRATION_E7_FLAG_KEY, type NarrationSurfaceController } from './narrationSurface';
import { createRogueliteProtoSurface, type RogueliteProtoSurface } from './rogueliteProto/surface';
import { hasCultivationJourney } from './rogueliteProto/runSave';
import { createNarrationCodex, type NarrationCodexController } from './narrationCodex';
import { type GridPoint } from './worldMovement';
import { deriveSemanticGameState } from './semanticGameState';
import { decodeStoredSave, deriveSaveHealthPresentation, saveHealthAfterLoad, type SaveHealth } from './saveHealth';
import { DEFAULT_RUNTIME_SETTINGS, RUNTIME_SETTINGS_STORAGE_KEY, decodeRuntimeSettings, runtimeSettingsPersistenceText, serializeRuntimeSettings, type RuntimeSettings } from './runtimeSettings';
import { applyColorPaletteCssVariables, ColorPalette, cssColor } from '@render/ColorPalette';
import { installMotionSkin } from './motionSkin';

applyColorPaletteCssVariables(document.documentElement);
installMotionSkin();
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

async function main(): Promise<void> {
  const reg = buildRegistry();
  const assetStore = new AssetStore(validateManifest(manifestJson));
  const SEED = 20260710;
  const SAVE_KEY = 'aeonvale-save-v1';
  const BUILD_REVISION = import.meta.env.VITE_BUILD_REVISION ?? 'dev';
  const BUILD_LABEL = BUILD_REVISION === 'dev' ? '版本 0.1.0 · 本地试玩' : '版本 0.1.0 · 试玩构建';
  const BUILD_TITLE = BUILD_REVISION === 'dev' ? '' : `构建 ${BUILD_REVISION}`;
  // 旧世界退役（docs/21 §8.27 阶段 2 第二步）：renderer/layers/renderScheduler
  // 及 world 屏全部 UI 编排已物理删除；标题 → 修途/灵韵叙录/设置链保留。
  const loadSave = (): SaveHealth => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
    } catch {
      return saveHealthAfterLoad('storage-unavailable');
    }

    const decoded = decodeStoredSave<GameState>(
      raw,
      schemaHash => isSchemaHashCompatible(reg, schemaHash),
      savedState => deserializeState(savedState) as GameState
    );
    return saveHealthAfterLoad(decoded.status);
  };
  // 旧世界退役（docs/21 §8.16 阶段 2 第一步）：clearSave 仅由 start-new-game
  // 应用层副作用调用，随该接线一并移除（旧档清除语义归 boot 读档/健康链）。
  const loadRuntimeSettings = (): { readonly settings: RuntimeSettings; readonly persistenceAvailable: boolean } => {
    try {
      return { settings: decodeRuntimeSettings(localStorage.getItem(RUNTIME_SETTINGS_STORAGE_KEY)), persistenceAvailable: true };
    } catch {
      return { settings: DEFAULT_RUNTIME_SETTINGS, persistenceAvailable: false };
    }
  };

  const saveHealth = loadSave();
  const loadedRuntimeSettings = loadRuntimeSettings();
  let runtimeSettings = loadedRuntimeSettings.settings;
  let runtimeSettingsPersistenceAvailable = loadedRuntimeSettings.persistenceAvailable;
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
  const audio = new AudioEngine();
  audio.setMasterVolume(runtimeSettings.masterVolume);
  // 第一刀音频接入：注入 narration 茎 AssetId → URL 解析器（io 层不反向依赖 asset store）。
  // playNarrationTrack(trackId) 据此取烘焙 ogg URL；缺失时静默 no-op。
  audio.setNarrationTrackResolver(id => assetUrlForId(assetStore, id));
  // 第二刀：文件型 SFX（dizi/erhu 等真实录音）解析器，与合成 playSfx 分流。
  audio.setSfxFileResolver(id => assetUrlForId(assetStore, id));

  let responsiveShell: ResponsiveShellController | null = null;
  let flowView: AppFlowViewController | null = null;
  let narrationIntro: NarrationIntroController | null = null;
  let narrationSurface: NarrationSurfaceController | null = null;
  let rogueliteProtoSurface: RogueliteProtoSurface | null = null;
  let narrationCodex: NarrationCodexController | null = null;
  const runtimeSettingsAbortController = new AbortController();
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

  // 旧世界退役（docs/21 §8.27 阶段 2 第二步）：enterEndingIfNeeded 起至
  // renderFrame 止的 world 屏 UI 编排（移动/农务/面板/快捷键/渲染循环）随
  // renderer.ts 物理删除；此处仅保留标题、灵韵叙录、修途、设置四条活链。

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
        setMusicContext: (zone, tension) => audio.setMusicContext({ season: 'spring', zone, tension, active: true })
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
    // 旧世界退役（docs/21 §8.16/§8.26/§8.27）：start-new-game、序章、
    // enter-loaded-world 与 continue-aftermath 的应用层副作用均已随
    // world 屏退役物理删除；此处只剩标题 ⇄ 灵韵叙录/修途 的 surface 生命周期。
    if (event.type === 'start-narration') {
      // 标题屏 → 灵韵叙录：挂载 narrationSurface（独立状态机，不读 sim）。
      startNarrationSurface();
    } else if (event.type === 'return-title-from-narration') {
      // 灵韵叙录 → 标题屏（玩家退出 / 结局返回）：拆 surface，BGM 交还标题语境。
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

    refreshAppPresentation();
    // E7 改写标题屏：每次流程变更后同步诅咒层（idempotent，docs/22 §2.5）。
    applyE7TitleCurse();
  }

  function syncAppPresentation(): void {
    // 旧世界退役（docs/21 §8.27）：world HUD DOM 编排已删；语义壳层仅喂
    // 表面无关的可达性摘要（标题/设置/叙录/修途各屏由 semanticGameState 自带文案）。
    const presentation = flowView?.getPresentation() ?? null;
    responsiveShell?.updateSemanticState(
      deriveSemanticGameState({
        presentation,
        worldStatus: '',
        announcement: '',
        saveHealth
      })
    );
  }

  function publishDebugSnapshot(): void {
    // 旧世界退役（docs/21 §8.27）：调试快照缩至流程壳层字段（测试消费面见
    // tests/browser/openGame.ts）；world 系字段随渲染循环一并退役，schema v3。
    const target = window as typeof window & {
      __AEON_DEBUG__?: {
        debugSchemaVersion: number;
        buildRevision: string;
        flowScreen: string;
        flowOverlay: string | null;
        uiMode: string;
        appSurface: string;
        viewportProfile: string;
        canvasBounds: { x: number; y: number; width: number; height: number } | null;
      };
    };
    const flow = flowView?.getState() ?? null;
    const presentation = flowView?.getPresentation() ?? null;
    const viewportLayout = computeViewportLayout({
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight),
      touchCapable: navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches
    });
    target.__AEON_DEBUG__ = {
      debugSchemaVersion: 3,
      buildRevision: BUILD_REVISION,
      flowScreen: flow?.screen ?? 'boot',
      flowOverlay: flow?.overlay ?? null,
      uiMode: presentation?.mode ?? 'loading',
      appSurface: presentation?.surface ?? 'loading',
      viewportProfile: viewportLayout.profile,
      canvasBounds: viewportLayout.canvas
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
    refreshAppPresentation();
  };
  const handleViewportResize = (): void => {
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

  // 旧世界退役（docs/21 §8.27）：语义壳层保留（可达性摘要 + data-game-command
  // 绑定），但其命令族（农务/行囊/地图/丹炉等 world 目标）已无处理器——以 no-op
  // 兜底，待修途触控方案定稿后重新指向。
  responsiveShell = createResponsiveShell({ dispatch: () => undefined });

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

  refreshAppPresentation();

  // 旧世界退役（§8.16 阶段 2 第一步）：滚轮循环热栏是旧快捷键专属交互，随启用路径一并移除。

  // 旧世界退役（docs/21 §8.27）：world 屏画布输入路由（指针指向/面板命中/快捷键）
  // 随渲染循环一并删除；全局仅保留音频解锁（首次手势 init/resume，幂等）。
  const unlockAudio = (): void => {
    audio.init();
    audio.resume();
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // 旧世界退役（docs/21 §8.27）：renderFrame/renderScheduler 随 renderer 整删；
  // 空舞台停 ticker（画布仅保留底色与尺寸信号），动效由各 surface 自管 RAF。
  app.ticker.stop();
  window.addEventListener(
    'pagehide',
    () => {
      portraitMedia.removeEventListener('change', handlePortraitChange);
      window.removeEventListener('resize', handleViewportResize);
      responsiveShell?.destroy();
      narrationIntro?.destroy();
      narrationSurface?.destroy();
      narrationCodex?.destroy();
      flowView?.destroy();
      runtimeSettingsAbortController.abort();
    },
    { once: true }
  );
  // 标题 BGM 语境保持：原先由 renderFrame 逐帧维护（farm/calm），现收敛为 boot
  // 一次性设置；灵韵叙录/修途 surface 活跃时各自接管（docs/22 §12 单点原则）。
  audio.setMusicContext({ season: 'spring', zone: 'farm', tension: 'calm', active: true });
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
