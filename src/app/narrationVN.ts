/**
 * 灵韵叙录打字机引擎（docs/23 §5 主玩法 UI/UX）。
 *
 * 参考 {@link storyVN} 的逐字 timer / reducedMotion / aria-live / destroy 防泄漏机制，
 * 扩 docs/23 §5 全部能力：
 *  - 4 档打字（38 标准 / 60 慢 / 18 快 / 0 即时；reducedMotion 自动即时）
 *    + 标点 `，。！？；：—…` 停顿 ×2.5 + `……` 每个 `…` 单独延时。
 *  - blip 每 3 字一次按 speaker 分轨（master 钟磬泛音 / heart-demon 低频锯齿 / narrator 哑音 …）。
 *  - 心声条（内心内阁）：对话框上方独立窄条，最多叠 2 条 FIFO，六色 token 严格映射
 *    （墨 narrator / 金 master 斜体 / 朱砂 heart-demon 粗 / 靛 intuition / 气青 self / 纸 system 反白）
 *    + 字形冗余（italic / weight / 字距）色盲安全。
 *  - Backlog：环形 200 行，`H` 唤出半透明覆盖层；Skip / Auto（行末停 800-2500ms）/ Rollback（滚轮上回退一步）。
 *  - 选项四态：默认 / 悬停或聚焦 / 已选 / 禁用锁（原因文案+aria-disabled）；
 *    视觉上保持纸面分行，仍支持 `1`–`5` 数字键直选；触屏 target≥44px。
 *
 * 红线（硬守）：
 *  - 本引擎只负责 DOM 演出与无障碍，不引第二随机源（无 Math.random / Date.now / performance.now），
 *    不读不写 `src/sim/`，不调 AI 模型。timer 用 setTimeout 允许。
 *  - 选项可用性 / requires 判定委托 `firstPersonView`（同层纯函数模块，不引 sim）。
 *  - 副作用只交回调用方（narrationSurface / narrationIntro）的 handlers——onChoose / onSceneComplete / onExit。
 *
 * 控制器 API（Wave 3 契约）：{@link createNarrationVN} 返回 {@link NarrationVNController}。
 */

import type { NarrationBlipSpeaker } from '@io/audio';
import { checkRequires, isChoiceAvailable, onceFlag } from './firstPersonView';
import type { EndingId, NarrationChoice, NarrationLine, NarrationScene, NarrationState, Speaker } from './narrationTypes';

/** 打字机四档速度（docs/23 §5：38 标准 / 60 慢 / 18 快 / 0 即时）。 */
export type NarrationVNSpeed = 0 | 18 | 38 | 60;

export const NARRATION_SPEEDS: readonly NarrationVNSpeed[] = [38, 60, 18, 0];

/** 字号 3 档（docs/23 §5：16 小 / 19 标准 / 24 大）。 */
export type NarrationTextSize = 'small' | 'medium' | 'large';

export const NARRATION_TEXT_SIZES: readonly NarrationTextSize[] = ['small', 'medium', 'large'];

const NARRATION_TEXT_SIZE_STORAGE_KEY = 'narration.textSize';
/** 跨周目保留的已读选项标记（sceneId::choiceId）。不随 beginNewRun 清空。 */
const NARRATION_READ_CHOICES_STORAGE_KEY = 'narration.readChoices';
/** 互斥剧情分支守卫未满足时不渲染，避免锁项剧透另一条人生。 */
const HIDE_WHEN_UNAVAILABLE_TAG = 'hide-when-unavailable';

/** 心声条（内心内阁）最多叠 2 条 FIFO（docs/23 §5）。 */
const CABINET_MAX = 2;
/** Backlog 环形缓冲容量（docs/23 §5：200 行）。 */
const BACKLOG_MAX = 200;
/** Auto 模式行末停顿上下界（docs/23 §5：800-2500ms）。 */
const AUTO_PAUSE_MIN_MS = 800;
const AUTO_PAUSE_MAX_MS = 2500;
/** blip 每 N 字一次（docs/23 §5）。 */
const BLIP_EVERY = 3;
/** 标点停顿倍率（docs/23 §5：×2.5）。 */
const PUNCT_MULTIPLIER = 2.5;

/**
 * 把选项 requires 表达式翻成简短中文锁定原因（≤14 字优先）。
 * 仅覆盖 content 中实际出现的常见表达式；未知一律「条件未满」。
 * 本地纯函数：不读 state、不判真假，只服务 UI 提示。
 */
function describeRequires(requires?: string): string {
  if (!requires) return '条件未满';
  switch (requires.trim()) {
    case 'cultProgress>=6':
      return '还差最后一重';
    case 'cultProgress>=7':
      return '需六劫圆满';
    case 'cultProgress>=3':
      return '需再历几道劫';
    case 'cultProgress>=1 && cultProgress<2':
      return '需初历第一道劫';
    case 'cultProgress>=2 && cultProgress<3':
      return '需历第二道劫';
    case 'cultProgress>=3 && cultProgress<4':
      return '需历第三道劫';
    case 'cultProgress>=4 && cultProgress<5':
      return '需历第四道劫';
    case 'cultProgress>=5 && cultProgress<6':
      return '需历第五道劫';
    case 'cultProgress>=6 && cultProgress<7':
      return '需历第六道劫';
    case 'defiance>=60 && bond>=50':
      return '需逆志与红尘皆深';
    case 'defiance>=60 && bond<50':
      return '需逆志深而少羁绊';
    case 'defiance<60':
      return '需心未极逆（或仍顺天）';
    case 'flag:got-wooden-whistle':
      return '需持有木哨';
    default:
      return '条件未满';
  }
}

/** 心声条 / 主框来源标记（speaker 或 response/converge 归档）。 */
export type BacklogOrigin = Speaker | 'response' | 'converge';

export interface NarrationBacklogEntry {
  readonly origin: BacklogOrigin;
  readonly text: string;
  readonly sceneId: string;
}

/**
 * 音频适配器：narrationSurface 注入 AudioEngine（解耦引擎与 io 层）。
 * - playBlip：打字机每 N 字分轨 blip。
 * - playSfx：可选 UI 短音（ui-confirm / codex-page 等）；未注入时静默。
 */
export interface NarrationVNAudio {
  playBlip(speaker: NarrationBlipSpeaker): void;
  playSfx?(id: string): void;
}

export interface NarrationSceneHandlers {
  /** 玩家选中某选项（已演完 response/converge 后）。 */
  onChoose(choiceId: string): void;
  /** 叶节点场景（无 choices）全部行读完且玩家推进：调用方路由（结局展示 / 退出 / 下一场景）。 */
  onSceneComplete(scene: NarrationScene): void;
  /** 玩家按退出（Quick Menu「退出」）。调用方决定（dispatch return-title-from-narration）。 */
  onExit(): void;
}

export interface NarrationEndingCard {
  readonly endingId: EndingId;
  /** 结局 CG 运行时 URL（缺失退化为水墨氛围占位）。 */
  readonly cgUrl?: string;
  readonly name: string;
  readonly clue: string;
  /** 玩家点「返回」时回调（调用方 dispatch return-title-from-narration）。 */
  onDismiss(): void;
}

export interface NarrationVNOptions {
  readonly root: HTMLElement;
  readonly reducedMotion: boolean;
  readonly audio?: NarrationVNAudio | null;
  /** 舞台元素 id（默认 narration-stage，对齐 appFlowMachine 焦点目标）。 */
  readonly stageId?: string;
  readonly stageLabel?: string;
  readonly speed?: NarrationVNSpeed;
}

export interface NarrationVNController {
  /** 渲染一个场景：逐字打字 lines → 列 choices（或叶节点完成信号）。 */
  showScene(
    scene: NarrationScene,
    state: NarrationState,
    handlers: NarrationSceneHandlers,
    options?: NarrationVNShowOptions
  ): void;
  /** 渲染结局卡（占位 CG + 名称 + 线索 + 返回）。 */
  showEnding(card: NarrationEndingCard): void;
  /**
   * 设置多层 CG URL（缺失隐藏对应图层，退化为水墨氛围）。由 narrationSurface 按
   * layerKeys + deriveLayerKeys + 道心氛围映射驱动（V1 gap 填补，docs/23 §5 z 序）。
   *  - bg：背景层（cg.first-person.*-v2 正图）。
   *  - ambience：道心氛围叠层（ambience.defiance/bond/void-root-v2，opacity≤0.35 + overlay）。
   */
  setCg(layers: { readonly bg?: string; readonly ambience?: string } | undefined): void;
  /** 当前 Backlog 快照（只读）。 */
  backlog(): readonly NarrationBacklogEntry[];
  /** 设置打字速度（reducedMotion 强制 0）。 */
  setSpeed(speed: NarrationVNSpeed): void;
  /** 设置字号档（small/medium/large，docs/23 §5）。 */
  setTextSize(size: NarrationTextSize): void;
  /** 开关切阅（Auto）模式。 */
  setAuto(active: boolean): void;
  /** 开关略过（Skip）模式。 */
  setSkip(active: boolean): void;
  /** 切换 Backlog 覆盖层显隐，返回切换后是否可见。 */
  toggleBacklog(): boolean;
  /** Backlog 覆盖层当前是否可见。 */
  isBacklogVisible(): boolean;
  /** 销毁：拆监听 + 清 timer + 清 DOM（不删 root 本身）。 */
  destroy(): void;
}

export interface NarrationVNShowOptions {
  /** 回访 hub 时跳过已经读过的 lines，直接恢复尚未处理的选项。 */
  readonly startAtChoices?: boolean;
}

type Phase = 'idle' | 'typing' | 'await-advance' | 'choices' | 'complete' | 'ending';

interface Binding {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
  readonly options?: boolean | AddEventListenerOptions;
}

/** Rollback 期间的实时态快照（回看后可无缝恢复）。 */
interface LiveSnapshot {
  readonly text: string;
  readonly speaker: Speaker;
  readonly origin: BacklogOrigin;
  readonly revealed: number;
  readonly phase: Phase;
}

/** 心声条 / 主框 speaker → CSS 颜色 token（docs/23 §5 六色严格映射，复用 app.css 既有 token）。 */
const SPEAKER_COLOR: Readonly<Record<Speaker, string>> = {
  narrator: 'var(--color-inkUi)',
  master: 'var(--color-giltUi)',
  'heart-demon': 'var(--color-dangerUi)',
  intuition: 'var(--color-water)',
  self: 'var(--color-qiFlow)',
  system: 'var(--color-paperUi)'
};

/** 标点停顿字符集（docs/23 §5：`，。！？；：—` + `…` 每个 `…` 单独延时）。 */
const PUNCT_CHARS = new Set<string>(['，', '。', '！', '？', '；', '：', '—', '…', ',', '.', '!', '?', ';', ':']);

/** 数字键 → 选项序号（docs/23 §5：1–5 数字键直选）。 */
const NUMBER_KEY_TO_INDEX: Readonly<Record<string, number>> = {
  '1': 0,
  '2': 1,
  '3': 2,
  '4': 3,
  '5': 4
};

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/** Auto 模式行末停顿：按行长度在 800..2500ms 区间取值（docs/23 §5）。 */
function autoPauseMs(lineLength: number): number {
  return clamp(AUTO_PAUSE_MIN_MS + lineLength * 40, AUTO_PAUSE_MIN_MS, AUTO_PAUSE_MAX_MS);
}

function isSpeaker(value: string): value is Speaker {
  return value === 'narrator' || value === 'master' || value === 'heart-demon' || value === 'intuition' || value === 'self' || value === 'system';
}

export function createNarrationVN(options: NarrationVNOptions): NarrationVNController {
  const root = options.root;
  const reducedMotion = options.reducedMotion;
  const stageId = options.stageId ?? 'narration-stage';
  const stageLabel = options.stageLabel ?? '灵韵叙录叙事舞台：按 Enter 或点击继续';
  const audio = options.audio ?? null;
  let destroyed = false;
  const bindings: Binding[] = [];

  let phase: Phase = 'idle';
  let speed: NarrationVNSpeed = reducedMotion ? 0 : (options.speed ?? 38);
  let textSize: NarrationTextSize = readInitialTextSize();
  let autoActive = false;
  let skipActive = false;
  let backlogVisible = false;
  let uiHidden = false;
  /** 每次换段/换场递增；旧 timer 即使已进入任务队列，也不得写回新场景。 */
  let renderEpoch = 0;

  // —— 当前场景演出状态 ——
  let currentScene: NarrationScene | null = null;
  let currentState: NarrationState | null = null;
  let currentHandlers: NarrationSceneHandlers | null = null;
  let segmentQueue: readonly NarrationLine[] = [];
  let responseQueue: readonly NarrationLine[] = [];
  let renderedSceneLines: readonly NarrationLine[] = [];
  let pendingConvergeAfterResponse = false;
  let selectedChoiceId: string | null = null;
  let lastChoiceId: string | null = null;

  // —— 当前打字段 ——
  let activeText = '';
  let activeSpeaker: Speaker = 'narrator';
  let activeOrigin: BacklogOrigin = 'narrator';
  let revealed = 0;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;
  let charsSinceBlip = 0;
  let liveSnapshot: LiveSnapshot | null = null;
  let rollbackPos: number | null = null;

  // —— Backlog 环形 + 心声条 FIFO ——
  const backlogRing: NarrationBacklogEntry[] = [];
  const cabinet: { speaker: Speaker; text: string }[] = [];
  /** RESPONSE/CONVERGE 段隐藏心声条：长回应会撑高对话框，与 cabinet 叠层（dogfood「内容重叠交叉」）。 */
  let cabinetSuppressed = false;

  // —— DOM 搭建 ——
  root.textContent = '';
  root.setAttribute('data-narration-host', 'true');

  const stage = document.createElement('div');
  stage.className = 'narration-stage';
  stage.id = stageId;
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', stageLabel);
  stage.dataset.flowFocusable = 'true';
  // 字号档（docs/23 §5）：CSS [data-text-size] 选择器消费 --nar-text-size 变量。
  stage.dataset.textSize = textSize;

  const cgWrap = document.createElement('div');
  cgWrap.className = 'narration-cg';
  cgWrap.hidden = true;
  const cgImg = document.createElement('img');
  cgImg.className = 'narration-cg-img narration-cg-bg';
  cgImg.alt = '';
  cgImg.setAttribute('aria-hidden', 'true');
  cgImg.decoding = 'async';
  // 道心氛围叠层（V1 gap 填补，docs/23 §5 z 序：bg → ambience → 对话框）。
  // 单独 <img>：CSS 控制 opacity≤0.35 + mix-blend-mode: overlay；reduced-motion 瞬切静态。
  // 光敏安全 WCAG 2.3.1：每 8s≥2s 静止——本层为静态 PNG，无动画，天然满足；CSS transition
  // 280ms 仅在换层瞬间触发（2s 静止阈值远超），prefers-reduced-motion 进一步瞬切。
  const cgAmbienceImg = document.createElement('img');
  cgAmbienceImg.className = 'narration-cg-img narration-cg-ambience';
  cgAmbienceImg.alt = '';
  cgAmbienceImg.setAttribute('aria-hidden', 'true');
  cgAmbienceImg.decoding = 'async';
  cgAmbienceImg.hidden = true;
  cgWrap.append(cgImg, cgAmbienceImg);

  const chapterMark = document.createElement('p');
  chapterMark.className = 'narration-chapter-mark';
  chapterMark.setAttribute('aria-hidden', 'true');

  // 心声条（内心内阁）：对话框上方独立窄条，最多 2 条 FIFO。
  const cabinetEl = document.createElement('div');
  cabinetEl.className = 'narration-cabinet';
  cabinetEl.setAttribute('role', 'group');
  cabinetEl.setAttribute('aria-label', '识海浮纹·心声条');
  cabinetEl.hidden = true;

  const dialog = document.createElement('div');
  dialog.className = 'narration-dialog';

  // 底部阅读坞：心声提示 → 主对话/选项 → Quick Menu 走正常 grid 流，避免绝对定位互相压叠。
  const bottomDock = document.createElement('div');
  bottomDock.className = 'narration-bottom-dock';

  const speakerTag = document.createElement('span');
  speakerTag.className = 'narration-speaker-tag';
  speakerTag.setAttribute('aria-hidden', 'true');
  speakerTag.hidden = true;

  const dialogText = document.createElement('p');
  dialogText.className = 'narration-text';
  dialogText.setAttribute('aria-hidden', 'true'); // 视觉打字对屏阅器隐藏，由 announce 整行播报。

  const announce = document.createElement('p');
  announce.className = 'sr-only';
  announce.setAttribute('aria-live', 'polite');
  announce.setAttribute('aria-atomic', 'true');

  const choicesEl = document.createElement('div');
  choicesEl.className = 'narration-choices';
  choicesEl.setAttribute('role', 'group');
  choicesEl.setAttribute('aria-label', '心底念头·抉择');
  choicesEl.hidden = true;

  const hint = document.createElement('p');
  hint.className = 'narration-hint';
  hint.textContent = 'Enter / 点击继续';

  dialog.append(speakerTag, dialogText, announce, choicesEl, hint);

  // Quick Menu（成熟 ADV：短词 + title 全名，贴对话框底缘，docs/23 §5）。自管控件，不挂 data-flow-action。
  const quickMenu = document.createElement('div');
  quickMenu.className = 'narration-quick-menu';
  quickMenu.setAttribute('role', 'toolbar');
  quickMenu.setAttribute('aria-label', '玉简·快捷');
  const speedBtn = mkButton('narration-qm-btn narration-qm-speed', '字速', () => cycleSpeed(), speedTitle());
  const textSizeBtn = mkButton('narration-qm-btn narration-qm-text-size', '字号', () => cycleTextSize(), textSizeTitle());
  const autoBtn = mkButton('narration-qm-btn narration-qm-auto', '自动', () => toggleAuto(), autoTitle());
  const skipBtn = mkButton('narration-qm-btn narration-qm-skip', '快进', () => toggleSkip(), skipTitle());
  const historyBtn = mkButton('narration-qm-btn narration-qm-history', '回想', () => toggleBacklog(), '前文·回看');
  const hideBtn = mkButton('narration-qm-btn narration-qm-hide', '隐窗', () => toggleUiHidden(), '隐窗欣赏（V）');
  const exitBtn = mkButton('narration-qm-btn narration-qm-exit', '退出', () => currentHandlers?.onExit(), '退出灵韵叙录');
  quickMenu.append(speedBtn, textSizeBtn, autoBtn, skipBtn, historyBtn, hideBtn, exitBtn);
  autoBtn.setAttribute('aria-pressed', 'false');
  skipBtn.setAttribute('aria-pressed', 'false');
  hideBtn.setAttribute('aria-pressed', 'false');

  // Backlog 覆盖层（半透明）。
  const backlogOverlay = document.createElement('div');
  backlogOverlay.className = 'narration-backlog';
  backlogOverlay.setAttribute('role', 'dialog');
  backlogOverlay.setAttribute('aria-modal', 'false');
  backlogOverlay.setAttribute('aria-label', '前文·回看');
  backlogOverlay.hidden = true;
  const backlogList = document.createElement('div');
  backlogList.className = 'narration-backlog-list';
  const backlogClose = mkButton('narration-qm-btn', '合上', () => setBacklogVisible(false));
  backlogOverlay.append(backlogList, backlogClose);

  // 结局卡容器（默认隐藏，showEnding 时填充并显示）。
  const endingCard = document.createElement('div');
  endingCard.className = 'narration-ending-card';
  endingCard.hidden = true;

  bottomDock.append(cabinetEl, dialog, quickMenu);
  stage.append(cgWrap, chapterMark, bottomDock, backlogOverlay, endingCard);
  root.appendChild(stage);

  function mkButton(className: string, label: string, onClick: EventListener, title?: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.dataset.flowFocusable = 'true';
    btn.textContent = label;
    if (title) {
      btn.title = title;
      btn.setAttribute('aria-label', title);
    }
    bind(btn, 'click', onClick);
    return btn;
  }

  function setButtonHint(btn: HTMLButtonElement, title: string): void {
    btn.title = title;
    btn.setAttribute('aria-label', title);
  }

  function actLabel(act: NarrationScene['act']): string {
    switch (act) {
      case 'prologue':
        return '序章 · 幻灭';
      case 1:
        return '第一幕 · 转折';
      case 2:
        return '第二幕 · 淬劫';
      case 3:
        return '终局 · 破立';
    }
  }

  function bind(target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): void {
    target.addEventListener(type, listener, options);
    bindings.push({ target, type, listener, options });
  }

  function clearTyping(): void {
    if (typingTimer !== null) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function clearAuto(): void {
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function setCg(layers: { readonly bg?: string; readonly ambience?: string } | undefined): void {
    const bg = layers?.bg;
    const ambience = layers?.ambience;
    if (!bg && !ambience) {
      cgWrap.hidden = true;
      return;
    }
    cgWrap.hidden = false;
    if (bg) {
      cgImg.src = bg;
    } else {
      // bg 缺失：清空 src 避免残留旧图（ambience 单层展示是退化兜底）。
      cgImg.removeAttribute('src');
    }
    if (ambience) {
      cgAmbienceImg.hidden = false;
      cgAmbienceImg.src = ambience;
    } else {
      cgAmbienceImg.hidden = true;
      cgAmbienceImg.removeAttribute('src');
    }
  }

  // —— 心声条 FIFO 渲染 ——
  function renderCabinet(): void {
    cabinetEl.replaceChildren();
    if (cabinet.length === 0) {
      cabinetEl.hidden = true;
      return;
    }
    cabinetEl.hidden = cabinetSuppressed;
    for (const entry of cabinet) {
      const slot = document.createElement('p');
      slot.className = 'narration-cabinet-slot';
      slot.dataset.speaker = entry.speaker;
      slot.style.color = SPEAKER_COLOR[entry.speaker];
      slot.textContent = entry.text;
      applySpeakerGlyph(slot, entry.speaker);
      cabinetEl.appendChild(slot);
    }
  }

  /** 字形冗余（italic / weight / 字距）色盲安全（docs/23 §5 三重冗余：色+形+音）。 */
  function applySpeakerGlyph(el: HTMLElement, speaker: Speaker): void {
    // 每段先清空上一 speaker 留下的行内字形，防 system 反白/heart-demon 字距串到后文。
    el.style.fontStyle = '';
    el.style.fontFamily = '';
    el.style.fontWeight = '';
    el.style.letterSpacing = '';
    el.style.background = '';
    switch (speaker) {
      case 'master':
        el.style.fontStyle = 'italic';
        el.style.fontFamily = "'Noto Serif CJK SC', 'Songti SC', serif";
        el.style.fontWeight = '600';
        break;
      case 'heart-demon':
        el.style.fontWeight = '700';
        el.style.letterSpacing = '0.02em';
        break;
      case 'system':
        // 纸系统：反白（深底浅字）。
        el.style.background = SPEAKER_COLOR.system;
        el.style.color = 'var(--color-shell)';
        el.style.fontWeight = '500';
        break;
      case 'intuition':
        el.style.fontStyle = 'italic';
        break;
      case 'self':
        el.style.fontWeight = '500';
        break;
      case 'narrator':
      default:
        break;
    }
  }

  function pushCabinet(speaker: Speaker, text: string): void {
    cabinet.push({ speaker, text });
    while (cabinet.length > CABINET_MAX) cabinet.shift();
    renderCabinet();
  }

  function pushBacklog(origin: BacklogOrigin, text: string, sceneId: string): void {
    backlogRing.push({ origin, text, sceneId });
    while (backlogRing.length > BACKLOG_MAX) backlogRing.shift();
    if (backlogVisible) renderBacklog();
  }

  function renderBacklog(): void {
    backlogList.replaceChildren();
    if (backlogRing.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'narration-backlog-empty';
      empty.textContent = '（前文暂无）';
      backlogList.appendChild(empty);
      return;
    }
    for (const entry of backlogRing) {
      const line = document.createElement('p');
      line.className = 'narration-backlog-line';
      const speaker: Speaker = typeof entry.origin === 'string' && isSpeaker(entry.origin) ? entry.origin : 'narrator';
      line.dataset.speaker = speaker;
      // 说话人色只作左侧竖线标识：部分说话人色（如 inkUi）为亮纸底设计，
      // 直接作正文色压在深色回看底上不可读。正文沿用容器的纸色。
      line.style.borderLeftColor = SPEAKER_COLOR[speaker];
      line.textContent = entry.text;
      backlogList.appendChild(line);
    }
    backlogList.scrollTop = backlogList.scrollHeight;
  }

  function setBacklogVisible(visible: boolean): void {
    backlogVisible = visible;
    backlogOverlay.hidden = !visible;
    if (visible) renderBacklog();
  }

  // —— 打字核心 ——
  function renderActiveText(): void {
    dialogText.textContent = activeText.slice(0, revealed);
    if (revealed >= activeText.length) {
      dialogText.classList.remove('narration-typing');
    } else {
      dialogText.classList.add('narration-typing');
    }
  }

  function startSegment(text: string, speaker: Speaker, origin: BacklogOrigin): void {
    clearTyping();
    clearAuto();
    renderEpoch += 1;
    activeText = text;
    activeSpeaker = speaker;
    activeOrigin = origin;
    cabinetSuppressed = origin === 'response' || origin === 'converge';
    if (cabinetSuppressed) cabinetEl.hidden = true;
    else if (cabinet.length > 0) cabinetEl.hidden = false;
    revealed = 0;
    charsSinceBlip = 0;
    rollbackPos = null;
    liveSnapshot = null;
    phase = 'typing';
    hint.hidden = true;
    hideChoices();
    dialogText.style.color = SPEAKER_COLOR[speaker];
    dialogText.dataset.speaker = speaker;
    applySpeakerGlyph(dialogText, speaker);
    setSpeakerTag(speaker, origin);
    announce.textContent = text;
    if (speed === 0 || reducedMotion || skipActive) {
      revealed = text.length;
      renderActiveText();
      onLineTyped();
      return;
    }
    dialogText.classList.add('narration-typing');
    scheduleTick(renderEpoch);
    focusStage();
  }

  function speakerLabel(speaker: Speaker, origin: BacklogOrigin): string {
    if (origin === 'converge') return '';
    switch (speaker) {
      case 'master':
        return '识海·师';
      case 'heart-demon':
        return '心魔';
      case 'intuition':
        return '直觉';
      case 'self':
        return '自语';
      case 'system':
        return '系统';
      case 'narrator':
      default:
        // 旁白不需姓名板（hidden）。
        return '';
    }
  }

  function setSpeakerTag(speaker: Speaker, origin: BacklogOrigin): void {
    const label = speakerLabel(speaker, origin);
    speakerTag.textContent = label;
    speakerTag.style.color = SPEAKER_COLOR[speaker];
    speakerTag.hidden = label.length === 0;
  }

  function scheduleTick(epoch = renderEpoch): void {
    clearTyping();
    let delay = speed;
    if (revealed > 0) {
      const prevChar = activeText[revealed - 1];
      if (prevChar !== undefined && PUNCT_CHARS.has(prevChar)) {
        // 标点停顿 ×2.5；`……` 每个 `…` 各自停顿（逐字自然成立）。
        delay = speed * PUNCT_MULTIPLIER;
      }
    }
    if (delay <= 0) {
      // 用 setTimeout(0) 让出主线程，避免即时档同步递归爆栈。
      typingTimer = setTimeout(() => tick(epoch), 0);
      return;
    }
    typingTimer = setTimeout(() => tick(epoch), delay);
  }

  function tick(epoch: number): void {
    if (destroyed) return;
    if (epoch !== renderEpoch) return;
    typingTimer = null;
    if (phase !== 'typing') return;
    if (revealed >= activeText.length) {
      onLineTyped();
      return;
    }
    revealed = Math.min(activeText.length, revealed + 1);
    charsSinceBlip += 1;
    renderActiveText();
    if (audio && charsSinceBlip >= BLIP_EVERY) {
      charsSinceBlip = 0;
      audio.playBlip(activeSpeaker);
    }
    if (revealed < activeText.length) {
      if (skipActive) {
        revealed = activeText.length;
        renderActiveText();
      }
      scheduleTick(epoch);
    } else {
      onLineTyped();
    }
  }

  function onLineTyped(): void {
    clearTyping();
    dialogText.classList.remove('narration-typing');
    if (activeText.length > 0) {
      pushBacklog(activeOrigin, activeText, currentScene?.id ?? '');
    }
    phase = 'await-advance';
    hint.textContent = 'Enter / 点击继续';
    hint.hidden = false;
    focusStage();
    if (autoActive) {
      clearAuto();
      const epoch = renderEpoch;
      autoTimer = setTimeout(() => {
        if (epoch === renderEpoch) advance();
      }, autoPauseMs(activeText.length));
    } else if (skipActive) {
      // Skip 模式：让出主线程后立即推进，避免同步递归。
      const epoch = renderEpoch;
      autoTimer = setTimeout(() => {
        if (epoch === renderEpoch) advance();
      }, 0);
    }
  }

  function goToNext(): void {
    // response → converge → onChoose 路由。
    if (activeOrigin === 'response') {
      if (responseQueue.length > 0) {
        const next = responseQueue[0]!;
        responseQueue = responseQueue.slice(1);
        startSegment(next.text, next.speaker ?? 'narrator', 'response');
        return;
      }
      if (pendingConvergeAfterResponse && currentScene?.converge) {
        pendingConvergeAfterResponse = false;
        startSegment(currentScene.converge, 'narrator', 'converge');
        return;
      }
      flushChoiceRouting();
      return;
    }
    if (activeOrigin === 'converge') {
      flushChoiceRouting();
      return;
    }
    // 普通场景行：队列推进 or 选项 or 完成。
    if (segmentQueue.length > 0) {
      const next = segmentQueue[0]!;
      segmentQueue = segmentQueue.slice(1);
      startSegment(next.text, next.speaker ?? 'narrator', next.speaker ?? 'narrator');
      return;
    }
    afterSceneLines();
  }

  function afterSceneLines(): void {
    const scene = currentScene;
    if (!scene) return;
    const choices = scene.choices ?? [];
    const renderedChoices = choices.filter(choice => currentState !== null && shouldRenderChoice(currentState, scene.id, choice));
    const visibleChoices = renderedChoices.filter(choice => currentState !== null && isChoiceAvailable(currentState, scene.id, choice));
    if (renderedChoices.length > 0) {
      phase = 'choices';
      renderChoices(scene);
      if (visibleChoices.length === 0) {
        // 全部选项被 requires 锁住：视为该场景无可选，叶节点完成兜底（防死锁）。
        phase = 'complete';
        hint.textContent = 'Enter / 点击·继续';
        hint.hidden = false;
      }
      return;
    }
    phase = 'complete';
    hint.textContent = 'Enter / 点击·继续';
    hint.hidden = false;
    if (autoActive) {
      clearAuto();
      const epoch = renderEpoch;
      autoTimer = setTimeout(() => {
        if (epoch === renderEpoch) advance();
      }, autoPauseMs(activeText.length));
    }
  }

  function flushChoiceRouting(): void {
    const choiceId = lastChoiceId;
    lastChoiceId = null;
    selectedChoiceId = null;
    const handlers = currentHandlers;
    if (choiceId && handlers) {
      // 交还控制权给调用方（narrationSurface 走 nextState 路由）。
      handlers.onChoose(choiceId);
    }
  }

  // —— 选项四态渲染 ——
  function shouldRenderChoice(state: NarrationState, sceneId: string, choice: NarrationChoice): boolean {
    // once 契约是“选中后隐藏”，不是变成一块永远锁着的墓碑。
    if (choice.once && state.flags.has(onceFlag(sceneId, choice.id))) return false;
    const available = isChoiceAvailable(state, sceneId, choice);
    if (!available && choice.tags?.includes(HIDE_WHEN_UNAVAILABLE_TAG)) return false;
    return true;
  }

  function renderChoices(scene: NarrationScene): void {
    // 抉择必须可见：隐窗中进入选项时强制恢复 UI。
    if (uiHidden) setUiHidden(false);
    choicesEl.replaceChildren();
    const state = currentState;
    const choices = scene.choices ?? [];
    const readSet = loadReadChoices();
    // docs/23 §5：① ② ③ ④ ⑤ 数字键直选只数 isChoiceAvailable 的项——视觉 glyph 与
    // NUMBER_KEY_TO_INDEX 必须一致（onNarrationKeydown 按 available 顺序命中）。锁项不占编号位、
    // 不显 glyph，显锁图标 + label + 锁定原因（玩家可看但 disabled）。
    let renderIndex = 0;
    for (const choice of choices) {
      if (state === null || !shouldRenderChoice(state, scene.id, choice)) continue;
      const available = state !== null && isChoiceAvailable(state, scene.id, choice);
      let shortcut = '';
      if (available) {
        shortcut = renderIndex < 5 ? String(renderIndex + 1) : '';
        renderIndex += 1;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'narration-choice';
      btn.dataset.flowFocusable = 'true';
      btn.dataset.choiceId = choice.id;
      btn.dataset.available = String(available);
      if (shortcut) {
        btn.dataset.shortcut = shortcut;
        btn.setAttribute('aria-keyshortcuts', shortcut);
      }
      btn.style.minHeight = '44px'; // 触屏 target≥44px（docs/23 §5）。
      const isRead = available && readSet.has(readChoiceKey(scene.id, choice.id));
      if (isRead) btn.classList.add('narration-choice-read');
      if (!available) {
        const reason = describeRequires(choice.requires);
        btn.disabled = true;
        btn.classList.add('narration-choice-locked');
        btn.setAttribute('aria-disabled', 'true');
        btn.title = reason;
        btn.setAttribute('aria-label', `${choice.label}，${reason}`);
        // 安全拼装 DOM（label 可能含特殊字符，禁止 innerHTML 注入）。
        const main = document.createElement('span');
        main.className = 'narration-choice-main';
        main.textContent = `未解 · ${choice.label}`;
        const reasonEl = document.createElement('span');
        reasonEl.className = 'narration-choice-reason';
        reasonEl.textContent = reason;
        btn.append(main, reasonEl);
      } else if (selectedChoiceId === choice.id) {
        btn.classList.add('narration-choice-selected');
        btn.setAttribute('aria-pressed', 'true');
        btn.textContent = choice.label;
      } else {
        btn.textContent = choice.label;
        if (shortcut) btn.title = `快捷键 ${shortcut}`;
      }
      const onSelect: EventListener = () => {
        if (destroyed) return;
        if (phase !== 'choices') return;
        if (!available) return;
        selectChoice(choice);
      };
      bind(btn, 'click', onSelect);
      choicesEl.appendChild(btn);
    }
    choicesEl.hidden = false;
    hint.hidden = true;
    const first = choicesEl.querySelector<HTMLButtonElement>('button.narration-choice:not(.narration-choice-locked)');
    first?.focus({ preventScroll: true });
  }

  function hideChoices(): void {
    if (!choicesEl.hidden) choicesEl.hidden = true;
    choicesEl.replaceChildren();
  }

  function selectChoice(choice: NarrationChoice): void {
    if (!currentScene || !currentState || !currentHandlers) return;
    selectedChoiceId = choice.id;
    lastChoiceId = choice.id;
    markChoiceRead(currentScene.id, choice.id);
    playUiSfx('ui-confirm');
    if (currentScene.choices) {
      renderChoices(currentScene); // 重渲染展示 ✓ 已选态。
    }
    const responses = choice.responseLines?.filter(line => checkRequires(currentState!, line.requires))
      ?? (choice.response ? [{ text: choice.response, speaker: choice.speaker }] : []);
    if (responses.length > 0) {
      pendingConvergeAfterResponse = true;
      const first = responses[0]!;
      responseQueue = responses.slice(1);
      startSegment(first.text, first.speaker ?? choice.speaker ?? 'narrator', 'response');
      return;
    }
    if (currentScene.converge) {
      startSegment(currentScene.converge, 'narrator', 'converge');
      return;
    }
    flushChoiceRouting();
  }

  // —— 玩家推进 ——
  function advance(): void {
    if (destroyed) return;
    if (phase === 'ending') return;
    if (backlogVisible) {
      setBacklogVisible(false);
      return;
    }
    if (rollbackPos !== null) {
      exitRollback();
      return;
    }
    if (phase === 'typing') {
      completeLineInstantly();
      return;
    }
    if (phase === 'complete') {
      const scene = currentScene;
      const handlers = currentHandlers;
      if (scene && handlers) {
        phase = 'idle';
        hint.hidden = true;
        handlers.onSceneComplete(scene);
      }
      return;
    }
    if (phase === 'await-advance') {
      goToNext();
    }
  }

  function completeLineInstantly(): void {
    clearTyping();
    // 使已经进入任务队列、但尚未执行的旧 tick 失效。
    renderEpoch += 1;
    revealed = activeText.length;
    renderActiveText();
    onLineTyped();
  }

  // —— Backlog / Rollback ——
  function rollbackStep(): void {
    if (phase === 'ending' || phase === 'idle' || phase === 'choices') return;
    if (backlogRing.length === 0) return;
    if (rollbackPos === null) {
      // 首次进入回看：快照当前实时态，便于恢复。
      liveSnapshot = { text: activeText, speaker: activeSpeaker, origin: activeOrigin, revealed, phase };
      rollbackPos = 0;
    } else {
      rollbackPos = Math.min(backlogRing.length - 1, rollbackPos + 1);
    }
    showRollbackEntry();
  }

  function rollbackForward(): void {
    if (rollbackPos === null) return;
    rollbackPos -= 1;
    if (rollbackPos < 0) {
      exitRollback();
    } else {
      showRollbackEntry();
    }
  }

  function showRollbackEntry(): void {
    if (rollbackPos === null) return;
    const idx = backlogRing.length - 1 - rollbackPos;
    const entry = backlogRing[idx];
    if (!entry) return;
    clearTyping();
    clearAuto();
    renderEpoch += 1;
    phase = 'await-advance';
    const speaker: Speaker = typeof entry.origin === 'string' && isSpeaker(entry.origin) ? entry.origin : 'narrator';
    // 仅静态展示，不改 active 字段（保留 liveSnapshot 以便恢复）。
    dialogText.textContent = entry.text;
    dialogText.classList.remove('narration-typing');
    dialogText.style.color = SPEAKER_COLOR[speaker];
    applySpeakerGlyph(dialogText, speaker);
    setSpeakerTag(speaker, entry.origin);
    hint.textContent = '滚轮上继续回溯·Enter / 滚轮下恢复';
    hint.hidden = false;
  }

  function exitRollback(): void {
    rollbackPos = null;
    const snapshot = liveSnapshot;
    liveSnapshot = null;
    if (!snapshot) return;
    renderEpoch += 1;
    activeText = snapshot.text;
    activeSpeaker = snapshot.speaker;
    activeOrigin = snapshot.origin;
    revealed = snapshot.revealed;
    phase = snapshot.phase;
    dialogText.style.color = SPEAKER_COLOR[activeSpeaker];
    applySpeakerGlyph(dialogText, activeSpeaker);
    setSpeakerTag(activeSpeaker, activeOrigin);
    if (phase === 'typing') {
      renderActiveText();
      scheduleTick(renderEpoch);
    } else {
      renderActiveText();
      hint.textContent = 'Enter / 点击继续';
      hint.hidden = false;
    }
  }

  // —— 速度 / Auto / Skip / 隐窗（短词可见文案 + title 全名） ——
  function speedTitle(): string {
    switch (speed) {
      case 0:
        return '字速·即时';
      case 18:
        return '字速·快';
      case 60:
        return '字速·慢';
      case 38:
      default:
        return '字速·标准';
    }
  }

  function autoTitle(): string {
    return autoActive ? '自动·开' : '自动·关';
  }

  function skipTitle(): string {
    return skipActive ? '快进·开' : '快进·关';
  }

  function textSizeTitle(): string {
    switch (textSize) {
      case 'small':
        return '字号·小';
      case 'large':
        return '字号·大';
      case 'medium':
      default:
        return '字号·中';
    }
  }

  function cycleSpeed(): void {
    const idx = NARRATION_SPEEDS.indexOf(speed);
    const next = NARRATION_SPEEDS[(idx + 1) % NARRATION_SPEEDS.length]!;
    setSpeedInternal(next);
    playUiSfx('ui-confirm');
  }

  function cycleTextSize(): void {
    const idx = NARRATION_TEXT_SIZES.indexOf(textSize);
    const next = NARRATION_TEXT_SIZES[(idx + 1) % NARRATION_TEXT_SIZES.length]!;
    setTextSizeInternal(next);
    playUiSfx('ui-fontsize');
  }

  function isNarrationTextSize(value: string): value is NarrationTextSize {
    return value === 'small' || value === 'medium' || value === 'large';
  }

  /** 读 localStorage 初始档（隐私模式/配额/未知值 → 默认 medium，docs/23 §5）。 */
  function readInitialTextSize(): NarrationTextSize {
    if (typeof localStorage === 'undefined') return 'medium';
    try {
      const raw = localStorage.getItem(NARRATION_TEXT_SIZE_STORAGE_KEY);
      if (raw && isNarrationTextSize(raw)) return raw;
    } catch {
      /* 隐私模式/配额：静默降级 */
    }
    return 'medium';
  }

  function setTextSizeInternal(next: NarrationTextSize): void {
    textSize = next;
    stage.dataset.textSize = next;
    setButtonHint(textSizeBtn, textSizeTitle());
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(NARRATION_TEXT_SIZE_STORAGE_KEY, next);
    } catch {
      /* 隐私模式/配额：静默降级（仅本会话生效） */
    }
  }

  /** UI 短音：可选 playSfx；未注入或异常时静默（不叠 blip）。 */
  function playUiSfx(id: string): void {
    try {
      audio?.playSfx?.(id);
    } catch {
      /* 音频未就绪 / 隐私：静默 */
    }
  }

  function readChoiceKey(sceneId: string, choiceId: string): string {
    return `${sceneId}::${choiceId}`;
  }

  /** 跨周目已读选项集合（隐私模式/配额 → 空集）。 */
  function loadReadChoices(): Set<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(NARRATION_READ_CHOICES_STORAGE_KEY);
      if (!raw) return new Set();
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return new Set();
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    } catch {
      return new Set();
    }
  }

  /** 写入已读选项；跨周目保留，不随 beginNewRun 清空。 */
  function markChoiceRead(sceneId: string, choiceId: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const set = loadReadChoices();
      const key = readChoiceKey(sceneId, choiceId);
      if (set.has(key)) return;
      set.add(key);
      localStorage.setItem(NARRATION_READ_CHOICES_STORAGE_KEY, JSON.stringify([...set]));
    } catch {
      /* 隐私模式/配额：静默降级 */
    }
  }

  function toggleAuto(): void {
    setAutoInternal(!autoActive);
  }

  function toggleSkip(): void {
    setSkipInternal(!skipActive);
  }

  function setSpeedInternal(next: NarrationVNSpeed): void {
    speed = reducedMotion ? 0 : next;
    setButtonHint(speedBtn, speedTitle());
  }

  function setAutoInternal(active: boolean): void {
    autoActive = active;
    setButtonHint(autoBtn, autoTitle());
    autoBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    autoBtn.classList.toggle('is-active', active);
    if (!active) clearAuto();
  }

  function setSkipInternal(active: boolean): void {
    skipActive = active;
    setButtonHint(skipBtn, skipTitle());
    skipBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    skipBtn.classList.toggle('is-active', active);
    if (active && phase === 'typing') {
      completeLineInstantly();
    }
  }

  function setUiHidden(hidden: boolean): void {
    uiHidden = hidden;
    // class + data 双标：CSS 选择器与调试一致性（docs/23 ADV 隐窗）。
    stage.classList.toggle('narration-ui-hidden', hidden);
    if (hidden) stage.dataset.uiHidden = 'true';
    else delete stage.dataset.uiHidden;
    hideBtn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
    hideBtn.classList.toggle('is-active', hidden);
    setButtonHint(hideBtn, hidden ? '显示对话框（V）' : '隐窗欣赏（V）');
  }

  function toggleUiHidden(): void {
    setUiHidden(!uiHidden);
    playUiSfx('ui-confirm');
  }

  function toggleBacklog(): boolean {
    const next = !backlogVisible;
    setBacklogVisible(next);
    if (next) playUiSfx('codex-page');
    return backlogVisible;
  }

  function focusStage(): void {
    if (document.activeElement !== stage) stage.focus({ preventScroll: true });
  }

  // —— 结局卡（落版插画 + 标题 + 短评；仅包装结构，不改判定/文案键） ——
  function renderEndingCard(card: NarrationEndingCard): void {
    hideChoices();
    setUiHidden(false);
    hint.hidden = true;
    cabinetEl.hidden = true;
    dialogText.textContent = '';
    announce.textContent = '';
    endingCard.replaceChildren();
    endingCard.dataset.endingId = card.endingId;

    const plate = document.createElement('div');
    plate.className = 'narration-ending-plate';

    const kicker = document.createElement('p');
    kicker.className = 'narration-ending-kicker';
    kicker.textContent = '终局';
    plate.appendChild(kicker);

    if (card.cgUrl) {
      const img = document.createElement('img');
      img.className = 'narration-ending-cg';
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      img.decoding = 'async';
      img.loading = 'eager';
      // ISSUE-001 修复：1024×1536 ~3MB 正图配 decoding="async" 时，浏览器会在解码完成前
      // 先绘制结局卡——逐行渐进绘制会露出顶部一条（心魔/飞升），尚未开始解码则只剩黑底
      // （丹毒）。先把 <img> 标记 data-decoded="false"（CSS opacity:0 占位，aspect-ratio
      // 锁稳定肖像框），待 img.decode() 解析（首帧即可无闪烁整图绘制）后再显影。
      img.dataset.decoded = 'false';
      const revealDecoded = (): void => {
        img.dataset.decoded = 'true';
      };
      // decode() 的 Promise 可能因浏览器调度/资源复用而拒绝，即便随后 load 成功且
      // naturalWidth 有效。load 是完整资源可用的可靠兜底，不能让图片永久停在 opacity:0。
      img.addEventListener('load', revealDecoded, { once: true });
      // 大图可能竞态失败：先绑 error，再设 src，失败时替换为 fallback。
      const onCgLoadError = (): void => {
        img.removeEventListener('error', onCgLoadError);
        const fallback = document.createElement('div');
        fallback.className = 'narration-ending-cg-fallback';
        fallback.setAttribute('role', 'img');
        fallback.setAttribute('aria-label', '终局留影加载失败');
        fallback.textContent = '终局留影加载失败';
        img.replaceWith(fallback);
      };
      img.addEventListener('error', onCgLoadError);
      img.src = card.cgUrl;
      // decode() 在首帧绘制前完成完整解码，消除「顶部一条 / 黑底」竞态；老环境无 decode
      // 能力时立即显影（退回旧行为，不阻断渲染）。
      if (typeof img.decode === 'function') {
        img.decode().then(revealDecoded, () => {
          // 真正损坏的资源由 error 事件替换；若只是 decode() 拒绝，load 事件仍会显影。
          if (img.complete && img.naturalWidth > 0) revealDecoded();
        });
      } else {
        revealDecoded();
      }
      plate.appendChild(img);
    } else {
      const fallback = document.createElement('div');
      fallback.className = 'narration-ending-cg-fallback';
      fallback.setAttribute('role', 'img');
      fallback.setAttribute('aria-label', '终局留影待补');
      fallback.textContent = '终局留影待补';
      plate.appendChild(fallback);
    }
    const name = document.createElement('h2');
    name.className = 'narration-ending-name';
    name.textContent = card.name;
    const clue = document.createElement('p');
    clue.className = 'narration-ending-clue';
    clue.textContent = card.clue;
    const dismiss = mkButton('narration-ending-dismiss', '返回标题', () => card.onDismiss());
    plate.append(name, clue, dismiss);
    endingCard.appendChild(plate);
    endingCard.hidden = false;
    dismiss.focus({ preventScroll: true });
  }

  // —— 事件接线 ——
  // ISSUE-007：键盘推进绑到 document 捕获 phase（对齐 narrationIntro.attachModalListeners 的
  // document capture 模式），不再依赖 stage 是否持焦。根因：原 bind(stage,'keydown',...) 只在
  // stage 获焦时触发，但入场时屏幕切换/其他 focus 管理会抢走焦点，导致 Enter/Space 失效，
  // 玩家必须先点一下舞台才管用。document capture 在任何焦点状态下都先收到 → 按 docs/23 §5
  // 「Space/Enter/click 推进」契约无焦点依赖地推进。
  // 单一 keydown 监听（stage 不再绑 keydown）→ 不存在双触发。window 级全局键监听在 narration
  // surface 下被 flowAllowsWorldInput() 早退（surface!=='world'），appFlowView 只管 b/Escape/Tab，
  // 故本监听是 narration 推进的唯一入口。destroy() 经 bindings[] 自动 removeEventListener。
  const onNarrationKeydown: EventListener = event => {
    if (destroyed) return;
    const keyboard = event as KeyboardEvent;
    const key = keyboard.key;
    // 隐窗切换：V（ADV 惯例）+ Delete/Backspace（无 V 键盘备选）。
    // 输入控件内不拦截，避免破坏文本编辑。
    if (key === 'v' || key === 'V' || key === 'Delete' || key === 'Backspace') {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      toggleUiHidden();
      return;
    }
    if (uiHidden) {
      // 隐窗态：Enter/Space 仍推进台词；Escape/H 仅恢复 UI（不推进）。
      if (key === 'Enter' || key === ' ') {
        const target = event.target as HTMLElement | null;
        if (target && target.closest('button')) return;
        event.preventDefault();
        focusStage(); // ISSUE-007：键盘用户落焦 stage，触发 app.css :focus-visible 焦点环。
        advance();
        return;
      }
      if (key === 'Escape' || key === 'h' || key === 'H') {
        event.preventDefault();
        setUiHidden(false);
      }
      return;
    }
    if (key === 'h' || key === 'H') {
      // Backlog 唤出：H（Ctrl 由全局 appFlowView 拦截，此处只处理 H）。
      event.preventDefault();
      toggleBacklog();
      return;
    }
    if (key === 'Escape') {
      if (backlogVisible) {
        event.preventDefault();
        setBacklogVisible(false);
        return;
      }
      if (rollbackPos !== null) {
        event.preventDefault();
        exitRollback();
      }
      return;
    }
    if (key in NUMBER_KEY_TO_INDEX && phase === 'choices' && currentScene && currentState) {
      const idx = NUMBER_KEY_TO_INDEX[key]!;
      const choices = currentScene.choices ?? [];
      let count = 0;
      let picked: NarrationChoice | null = null;
      for (const choice of choices) {
        if (isChoiceAvailable(currentState, currentScene.id, choice)) {
          if (count === idx) {
            picked = choice;
            break;
          }
          count += 1;
        }
      }
      if (picked) {
        event.preventDefault();
        selectChoice(picked);
        return;
      }
    }
    if (key === 'Enter' || key === ' ') {
      const target = event.target as HTMLElement | null;
      if (target && target.closest('button')) return; // 选项/Quick Menu 交给原生点击。
      event.preventDefault();
      focusStage(); // ISSUE-007：键盘用户落焦 stage，触发 app.css :focus-visible 焦点环。
      advance();
    }
  };
  const onStageClick: EventListener = event => {
    if (destroyed) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest('button')) return;
    // 隐窗态点击仍推进台词（成熟 ADV：欣赏态可读下去）；V / 隐窗钮恢复 UI。
    advance();
  };
  const onStageWheel: EventListener = event => {
    if (destroyed) return;
    const wheel = event as WheelEvent;
    if (wheel.deltaY < 0) {
      event.preventDefault();
      rollbackStep();
    } else if (wheel.deltaY > 0 && rollbackPos !== null) {
      event.preventDefault();
      rollbackForward();
    }
  };
  const onCgError: EventListener = () => {
    cgWrap.hidden = true;
  };
  // ambience 层 404（asset 缺失）：只隐藏氛围层，bg 层保留（避免整 wrap 黑屏）。
  const onCgAmbienceError: EventListener = () => {
    cgAmbienceImg.hidden = true;
  };

  // ISSUE-007：keydown 绑 document 捕获 phase（见 onNarrationKeydown 注释）。click/wheel
  // 仍是 stage 局部指针事件——只在舞台内推进/回退，避免点 surface 外壳也推进。
  bind(document, 'keydown', onNarrationKeydown, true);
  bind(stage, 'click', onStageClick);
  bind(stage, 'wheel', onStageWheel, { passive: false });
  bind(cgImg, 'error', onCgError);
  bind(cgAmbienceImg, 'error', onCgAmbienceError);

  // —— 对外方法 ——
  function showScene(
    scene: NarrationScene,
    state: NarrationState,
    handlers: NarrationSceneHandlers,
    showOptions: NarrationVNShowOptions = {}
  ): void {
    if (destroyed) return;
    renderEpoch += 1;
    clearTyping();
    clearAuto();
    // 跨场景清空心声条：避免上一场景 heart-demon/self 文案泄漏到下一场景上方。
    cabinet.length = 0;
    renderCabinet();
    endingCard.hidden = true;
    endingCard.replaceChildren();
    setBacklogVisible(false);
    rollbackPos = null;
    liveSnapshot = null;
    selectedChoiceId = null;
    lastChoiceId = null;
    pendingConvergeAfterResponse = false;
    responseQueue = [];
    cabinetSuppressed = false;
    currentScene = scene;
    currentState = state;
    currentHandlers = handlers;
    stage.dataset.sceneId = scene.id;
    stage.dataset.act = String(scene.act);
    chapterMark.textContent = actLabel(scene.act);
    renderedSceneLines = scene.lines.filter(line => checkRequires(state, line.requires));
    segmentQueue = renderedSceneLines.length > 0 ? renderedSceneLines.slice(1) : [];
    hint.textContent = 'Enter / 点击继续';
    if (showOptions.startAtChoices) {
      activeText = '';
      activeSpeaker = 'narrator';
      activeOrigin = 'narrator';
      revealed = 0;
      dialogText.textContent = '';
      dialogText.classList.remove('narration-typing');
      dialogText.removeAttribute('data-speaker');
      announce.textContent = '';
      speakerTag.textContent = '';
      speakerTag.hidden = true;
      segmentQueue = [];
      afterSceneLines();
      return;
    }
    if (renderedSceneLines.length === 0) {
      afterSceneLines();
      return;
    }
    const firstLine = renderedSceneLines[0]!;
    startSegment(firstLine.text, firstLine.speaker ?? 'narrator', firstLine.speaker ?? 'narrator');
  }

  function showEnding(card: NarrationEndingCard): void {
    if (destroyed) return;
    renderEpoch += 1;
    clearTyping();
    clearAuto();
    phase = 'ending';
    // 结局时清心声条数组（不只 hidden），防止返回后残留。
    cabinet.length = 0;
    renderCabinet();
    setCg(undefined);
    renderEndingCard(card);
  }

  return {
    showScene,
    showEnding,
    setCg,
    backlog(): readonly NarrationBacklogEntry[] {
      return backlogRing.slice();
    },
    setSpeed(next: NarrationVNSpeed): void {
      setSpeedInternal(next);
    },
    setTextSize(next: NarrationTextSize): void {
      setTextSizeInternal(next);
    },
    setAuto(active: boolean): void {
      setAutoInternal(active);
    },
    setSkip(active: boolean): void {
      setSkipInternal(active);
    },
    toggleBacklog,
    isBacklogVisible(): boolean {
      return backlogVisible;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      renderEpoch += 1;
      clearTyping();
      clearAuto();
      for (const binding of bindings) binding.target.removeEventListener(binding.type, binding.listener, binding.options);
      bindings.length = 0;
      root.textContent = '';
    }
  };
}
