/**
 * 通用视觉小说控制器（DOM 演示版）。
 *
 * 把传入的场景列表以打字机逐字浮现 + 伪选项漏斗的方式演出，演完后回调 onFinish
 * （由调用方派发后续流程事件，如 finish-prologue / finish-act1）。控件由本控制器自管，
 * 不挂 data-flow-action，避免与 appFlowView 的全局按钮绑定冲突。
 *
 * 最初为序章而建，现泛化为共享引擎：序章（PROLOGUE_SCENES）与第一幕（ACT1_SCENES）
 * 共用同一套打字机/选项/CG/跳过/无障碍逻辑，仅舞台 id、跳过按钮 id 与文案由调用方覆写。
 * 序章调用若不覆写这些字段，沿用既有默认值（prologue-vn-stage / flow-prologue-skip / 跳过序章），
 * 行为与浏览器测试期望完全一致。
 *
 * 无 canvas、无像素美术；CG 缺失或加载失败（以及 cg 为 undefined）时退化为水墨氛围
 * （CSS 纯色层叠）。撤离时必须调用 destroy() 拆除监听与计时器，避免泄漏。
 */

/** 共享场景结构：序章与第一幕的场景数据均按此结构类型参与结构化校验。 */
export interface StoryScene {
  readonly id: string;
  /** 可选 CG 资源路径；缺失或加载失败时退化为 CSS 水墨氛围。 */
  readonly cg?: string;
  /** 按顺序浮现的旁白/对白行。 */
  readonly lines: readonly string[];
  /** 末尾可出现的选项；可选。 */
  readonly choices?: readonly { readonly label: string; readonly response: string; readonly cg?: string }[];
  /** 任一选项后浮现的收敛行；可选。 */
  readonly converge?: string;
}

export interface StoryVNOptions {
  readonly root: HTMLElement;
  readonly scenes: readonly StoryScene[];
  readonly onFinish: () => void;
  readonly onSkip: () => void;
  /** 减少动态效果时为 true：文字瞬时浮现，不做逐字演出。 */
  readonly reducedMotion: boolean;
  /** 舞台元素 id（聚焦目标）。默认沿用序章 id，保证既有行为与浏览器测试稳定。 */
  readonly stageId?: string;
  /** 舞台无障碍标签。 */
  readonly stageLabel?: string;
  /** 跳过按钮 id。默认沿用序章 id。 */
  readonly skipControlId?: string;
  /** 跳过按钮文案。 */
  readonly skipLabel?: string;
}

export interface StoryVNController {
  destroy(): void;
}

/** 逐字浮现间隔（毫秒）。减少动态效果时绕过。 */
const TYPE_INTERVAL_MS = 38;

type VNMode = 'line' | 'choices' | 'response' | 'converge';

interface Binding {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
}

export function createStoryVN(options: StoryVNOptions): StoryVNController {
  const { root, scenes, onFinish, onSkip, reducedMotion } = options;
  const stageId = options.stageId ?? 'prologue-vn-stage';
  const stageLabel = options.stageLabel ?? '序章叙事舞台：按 Enter 或点击继续';
  const skipControlId = options.skipControlId ?? 'flow-prologue-skip';
  const skipLabel = options.skipLabel ?? '跳过序章';
  let destroyed = false;
  const bindings: Binding[] = [];

  function bind(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    bindings.push({ target, type, listener });
  }

  // —— DOM 搭建 ——
  root.textContent = '';

  const stage = document.createElement('div');
  stage.className = 'vn-stage';
  stage.id = stageId;
  stage.tabIndex = 0;
  stage.setAttribute('role', 'group');
  stage.setAttribute('aria-label', stageLabel);
  stage.dataset.flowFocusable = 'true';

  const cgWrap = document.createElement('div');
  cgWrap.className = 'vn-cg';
  cgWrap.hidden = true;
  const cgImg = document.createElement('img');
  cgImg.className = 'vn-cg-img';
  cgImg.alt = '';
  cgImg.setAttribute('aria-hidden', 'true');
  cgImg.decoding = 'async';
  cgWrap.appendChild(cgImg);

  const text = document.createElement('p');
  text.className = 'vn-text';
  // 视觉打字机本身对屏阅器隐藏，改由下方 announce 区一次性播报整行，避免逐字噪音。
  text.setAttribute('aria-hidden', 'true');

  const announce = document.createElement('p');
  announce.className = 'sr-only';
  announce.setAttribute('aria-live', 'polite');
  announce.setAttribute('aria-atomic', 'true');

  const choicesEl = document.createElement('div');
  choicesEl.className = 'vn-choices';
  choicesEl.setAttribute('role', 'group');
  choicesEl.setAttribute('aria-label', '心底念头');
  choicesEl.hidden = true;

  const hint = document.createElement('p');
  hint.className = 'vn-hint';
  hint.textContent = 'Enter / 点击继续';

  const actions = document.createElement('div');
  actions.className = 'vn-actions';
  const skipBtn = document.createElement('button');
  skipBtn.id = skipControlId;
  skipBtn.type = 'button';
  skipBtn.className = 'flow-button flow-button-quiet';
  skipBtn.dataset.flowFocusable = 'true';
  skipBtn.textContent = skipLabel;
  actions.appendChild(skipBtn);

  stage.appendChild(cgWrap);
  stage.appendChild(text);
  stage.appendChild(announce);
  stage.appendChild(choicesEl);
  stage.appendChild(hint);
  root.appendChild(stage);
  root.appendChild(actions);

  // —— 演出状态 ——
  let sceneIdx = 0;
  let lineIdx = 0;
  let mode: VNMode = 'line';
  let currentLine = '';
  let revealed = 0;
  let typingTimer: ReturnType<typeof setTimeout> | null = null;
  let finished = false;

  function clearTyping(): void {
    if (typingTimer !== null) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function setCg(src: string | undefined): void {
    if (!src) {
      cgWrap.hidden = true;
      return;
    }
    cgWrap.hidden = false;
    cgImg.src = src;
  }

  function renderText(): void {
    text.textContent = currentLine.slice(0, revealed);
    if (revealed >= currentLine.length) text.classList.remove('vn-typing');
    else text.classList.add('vn-typing');
  }

  function focusStage(): void {
    if (document.activeElement !== stage) stage.focus({ preventScroll: true });
  }

  function beginLine(line: string): void {
    currentLine = line;
    revealed = 0;
    text.textContent = '';
    announce.textContent = line;
    hint.hidden = false;
    hideChoices();
    if (reducedMotion) {
      revealed = line.length;
      renderText();
      focusStage();
      return;
    }
    text.classList.add('vn-typing');
    focusStage();
    scheduleTick();
  }

  function scheduleTick(): void {
    clearTyping();
    typingTimer = setTimeout(tick, TYPE_INTERVAL_MS);
  }

  function tick(): void {
    if (destroyed) return;
    typingTimer = null;
    if (revealed >= currentLine.length) return;
    revealed = Math.min(currentLine.length, revealed + 1);
    renderText();
    if (revealed < currentLine.length) scheduleTick();
  }

  function isLineFullyRevealed(): boolean {
    return revealed >= currentLine.length;
  }

  function completeLineInstantly(): void {
    clearTyping();
    revealed = currentLine.length;
    renderText();
  }

  function renderChoices(): void {
    const scene = scenes[sceneIdx];
    const choices = scene?.choices ?? [];
    choicesEl.textContent = '';
    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'flow-button vn-choice';
      btn.dataset.flowFocusable = 'true';
      btn.textContent = choice.label;
      const onChoiceClick: EventListener = () => {
        if (destroyed) return;
        setCg(choice.cg ?? scene?.cg);
        mode = 'response';
        beginLine(choice.response);
      };
      bind(btn, 'click', onChoiceClick);
      choicesEl.appendChild(btn);
    }
    choicesEl.hidden = false;
    hint.hidden = true;
    const first = choicesEl.querySelector<HTMLButtonElement>('button.vn-choice');
    first?.focus({ preventScroll: true });
  }

  function hideChoices(): void {
    if (!choicesEl.hidden) choicesEl.hidden = true;
    if (choicesEl.textContent !== '') choicesEl.textContent = '';
  }

  function nextScene(): void {
    sceneIdx += 1;
    const scene = scenes[sceneIdx];
    if (!scene) {
      finish();
      return;
    }
    lineIdx = 0;
    mode = 'line';
    setCg(scene.cg);
    beginLine(scene.lines[0] ?? '');
  }

  function finish(): void {
    if (finished || destroyed) return;
    finished = true;
    hint.hidden = true;
    hideChoices();
    clearTyping();
    onFinish();
  }

  function advance(): void {
    if (destroyed || finished) return;
    if (mode === 'choices') return; // 等待玩家在选项中抉择
    if (!isLineFullyRevealed()) {
      completeLineInstantly();
      return;
    }
    const scene = scenes[sceneIdx];
    if (!scene) return;
    if (mode === 'line') {
      const lines = scene.lines;
      if (lineIdx < lines.length - 1) {
        lineIdx += 1;
        beginLine(lines[lineIdx] ?? '');
      } else if (scene.choices && scene.choices.length > 0) {
        mode = 'choices';
        renderChoices();
      } else {
        nextScene();
      }
    } else if (mode === 'response') {
      if (scene.converge) {
        mode = 'converge';
        beginLine(scene.converge);
      } else {
        nextScene();
      }
    } else if (mode === 'converge') {
      nextScene();
    }
  }

  // —— 事件接线 ——
  const onStageKeydown: EventListener = event => {
    if (destroyed) return;
    const key = (event as KeyboardEvent).key;
    if (key !== 'Enter' && key !== ' ') return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest('button')) return; // 选项/跳过交给原生点击
    event.preventDefault();
    advance();
  };
  const onStageClick: EventListener = event => {
    if (destroyed) return;
    const target = event.target as HTMLElement | null;
    if (target && target.closest('button')) return;
    advance();
  };
  const onSkipClick: EventListener = () => {
    if (!destroyed) onSkip();
  };
  const onCgError: EventListener = () => {
    cgWrap.hidden = true;
  };

  bind(stage, 'keydown', onStageKeydown);
  bind(stage, 'click', onStageClick);
  bind(skipBtn, 'click', onSkipClick);
  bind(cgImg, 'error', onCgError);

  // —— 开演 ——
  const firstScene = scenes[0];
  if (firstScene) {
    setCg(firstScene.cg);
    beginLine(firstScene.lines[0] ?? '');
  } else {
    finish();
  }

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearTyping();
      for (const binding of bindings) binding.target.removeEventListener(binding.type, binding.listener);
      bindings.length = 0;
      root.textContent = '';
    }
  };
}
