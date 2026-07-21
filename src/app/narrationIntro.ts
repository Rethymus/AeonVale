/**
 * 灵韵叙录 · 开发者自白对话框（docs/22 §2.2-§2.4）。
 *
 * 标题屏点击 `#flow-title-narration` 后浮现的 modal overlay（**不切 screen**，仍在 title），
 * 复用 {@link createNarrationVN} 演出 docs/22 §2.2 的六段自白（暖色信笺 / 手写信纸质感，
 * 署名「─ 来自开发者」，无立绘，颜文字）。双选项：
 *  - A「试一试呀 (ﾉ>ω<)ﾉ 点这里～」→ 标记已读 + dispatch start-narration（关 modal 切 screen）。
 *  - B「还是算了吧 (｡•́︿•̀｡)」→ 换为挽留文案（docs/22 §2.4），数秒后尊重退出回 title，入口保留可再点。
 *
 * localStorage 记 `narration.introRead`：第二次点入口走「已读跳过」（docs/22 §2.4），
 * 直接 dispatch start-narration。
 *
 * 红线：不读不写 `src/sim/`；不引第二随机源；运行时不调 AI 模型；timer 用 setTimeout 允许。
 */

import { t } from '@content/i18n';
import { initialState } from './firstPersonView';
import type { NarrationScene } from './narrationTypes';
import { createNarrationVN, type NarrationVNController } from './narrationVN';

const INTRO_STORAGE_KEY = 'narration.introRead';
/** B 选项挽留文案展示后自动收起的延时（docs/22 §2.4「显示数秒后尊重退出」）。 */
const FOLLOWUP_AUTOCLOSE_MS = 4500;

/** 存储适配器（默认 localStorage；可注入便于测试）。 */
export interface NarrationIntroStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NarrationIntroOptions {
  /** overlay 挂载宿主（main.ts 传入 title surface 元素，使 modal 落在活动 surface 内）。 */
  readonly host: HTMLElement;
  readonly reducedMotion: boolean;
  readonly storage?: NarrationIntroStorage;
  /** 玩家确认进入灵韵叙录（dispatch start-narration）。 */
  readonly onStartNarration: () => void;
}

export interface NarrationIntroController {
  /** 标题屏入口点击：已读跳过直接 dispatch start-narration，否则开 modal。 */
  open(): void;
  /** 关 modal（不 dispatch）。 */
  close(): void;
  /** 销毁：关 modal + 拆 DOM。 */
  destroy(): void;
  /** 当前是否已读（localStorage）。 */
  isRead(): boolean;
}

/**
 * ISSUE-003：modal 开启期间被 inert 的 host 兄弟元素记录。
 * 逐元素记录 inert / aria-hidden 原状态，close 时按原值精确回滚
 * （只移除本次添加的属性，保留元素既有的 inert/aria-hidden）。
 */
interface InertedSibling {
  readonly element: Element;
  readonly hadInert: boolean;
  readonly ariaHiddenPrior: string | null;
}

function defaultStorage(): NarrationIntroStorage {
  // 仿 narrationCodex safe 模式：隐私模式 / 配额 / Safari 跨域 iframe 抛 SecurityError 时
  // 静默降级（MEDIUM5：未读状态不持久化 → 玩家每次点入口都看自白，可接受降级）。
  return {
    getItem(key: string): string | null {
      if (typeof localStorage === 'undefined') return null;
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key: string, value: string): void {
      if (typeof localStorage === 'undefined') return;
      try {
        localStorage.setItem(key, value);
      } catch {
        /* 隐私模式/配额：静默降级（introRead 不持久化，下次再点仍演自白） */
      }
    }
  };
}

/** docs/22 §2.2 六段自白（逐字打字）。文案在 zh-CN.json narration.intro.line1..6。 */
function buildIntroScene(): NarrationScene {
  return {
    id: 'intro.letter',
    act: 'prologue',
    lines: [
      { text: t('narration.intro.line1'), speaker: 'narrator' },
      { text: t('narration.intro.line2'), speaker: 'narrator' },
      { text: t('narration.intro.line3'), speaker: 'narrator' },
      { text: t('narration.intro.line4'), speaker: 'narrator' },
      { text: t('narration.intro.line5'), speaker: 'narrator' },
      { text: t('narration.intro.line6'), speaker: 'narrator' }
    ],
    choices: [
      { id: 'try', label: t('narration.intro.optTry') },
      { id: 'decline', label: t('narration.intro.optDecline') }
    ],
    status: 'approved'
  };
}

/** docs/22 §2.4 挽留文案（B 选项后替换展示）。 */
function buildFollowupScene(): NarrationScene {
  return {
    id: 'intro.followup',
    act: 'prologue',
    lines: [{ text: t('narration.intro.optDeclineFollowup'), speaker: 'narrator' }],
    status: 'approved'
  };
}

export function createNarrationIntro(options: NarrationIntroOptions): NarrationIntroController {
  const host = options.host;
  const storage = options.storage ?? defaultStorage();
  let overlay: HTMLElement | null = null;
  let vn: NarrationVNController | null = null;
  let followupTimer: ReturnType<typeof setTimeout> | null = null;
  let destroyed = false;
  // 文档级监听绑定记录（HIGH4：destroy/close 时拆，避免泄漏）。
  const docListeners: Array<{ readonly type: string; readonly listener: EventListener }> = [];
  // ISSUE-003：modal 开启时被 inert 的 host 兄弟元素记录（close 时按原状态恢复）。
  let inertedSiblings: InertedSibling[] = [];

  function isRead(): boolean {
    return storage.getItem(INTRO_STORAGE_KEY) === '1';
  }

  function markRead(): void {
    storage.setItem(INTRO_STORAGE_KEY, '1');
  }

  function clearFollowupTimer(): void {
    if (followupTimer !== null) {
      clearTimeout(followupTimer);
      followupTimer = null;
    }
  }

  /** HIGH4：拆文档级监听（Escape / Tab 焦点陷阱），避免泄漏到下一次 open 或 destroy 后。 */
  function detachDocListeners(): void {
    for (const { type, listener } of docListeners) {
      document.removeEventListener(type, listener);
    }
    docListeners.length = 0;
  }

  /**
   * ISSUE-003：modal overlay 开启后，把 host 的其余 element 子节点标为 `inert` + `aria-hidden="true"`，
   * 使标题屏底层控件（新游戏 / 设置 / 灵韵叙录入口…）在 browse mode 与无障碍树中一同隐去，
   * 与 `role=dialog` `aria-modal=true` 的语义对齐。Tab 已被 {@link attachModalListeners} 陷阱，
   * 这里补全结构性遮蔽（inert 同时移除 tab 序与无障碍树）。逐元素记录原状态，便于 close 时精确回滚。
   *
   * 边界：跳过 overlay 自身；只处理直接 element 子节点（`host.children` 已排除文本节点）；
   * host 无其他子节点时数组为空；防御性重置以兼容重复 open。
   */
  function applyHostInert(): void {
    inertedSiblings = [];
    if (!host) return;
    const children = Array.from(host.children);
    for (const child of children) {
      if (!overlay || child === overlay) continue;
      const hadInert = child.hasAttribute('inert');
      const ariaHiddenPrior = child.getAttribute('aria-hidden');
      child.setAttribute('inert', '');
      child.setAttribute('aria-hidden', 'true');
      inertedSiblings.push({ element: child, hadInert, ariaHiddenPrior });
    }
  }

  /**
   * ISSUE-003：close 时恢复 host 兄弟的原 inert / aria-hidden 状态。
   * 仅移除本次添加的属性；若元素原本就 inert 或 `aria-hidden="true"` 则原状保留，
   * 若原本是 `'false'` 等显式值则恢复原值。空数组下为 no-op，重复 close 安全。
   */
  function restoreHostInert(): void {
    for (const { element, hadInert, ariaHiddenPrior } of inertedSiblings) {
      if (!hadInert) {
        element.removeAttribute('inert');
      }
      if (ariaHiddenPrior === null) {
        element.removeAttribute('aria-hidden');
      } else if (ariaHiddenPrior !== 'true') {
        element.setAttribute('aria-hidden', ariaHiddenPrior);
      }
    }
    inertedSiblings = [];
  }

  /**
   * HIGH4：模态焦点陷阱。overlay role=dialog aria-modal=true 时 Tab/Shift-Tab 应在 overlay
   * 内可聚焦元素首末循环，避免焦点跳出到标题屏按钮。监听 document keydown，捕获 phase：
   *  - Escape → close()（玩家可键盘退出，等同点「退出」）。
   *  - Tab / Shift+Tab → 在 overlay 内可聚焦元素首末循环（focusout 检测）。
   */
  function attachModalListeners(): void {
    detachDocListeners();
    const onKeydown: EventListener = event => {
      if (destroyed || !overlay) return;
      const kb = event as KeyboardEvent;
      if (kb.key === 'Escape') {
        kb.preventDefault();
        close();
        return;
      }
      if (kb.key !== 'Tab') return;
      const focusables = overlayFocusables();
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (kb.shiftKey) {
        if (active === first || !overlay.contains(active)) {
          kb.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        if (active === last) {
          kb.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    };
    document.addEventListener('keydown', onKeydown, true);
    docListeners.push({ type: 'keydown', listener: onKeydown });
  }

  /** 收集 overlay 内当前可见且可聚焦的控件（Quick Menu / 选项 / 退出 / 返回）。 */
  function overlayFocusables(): HTMLElement[] {
    if (!overlay) return [];
    const candidates = overlay.querySelectorAll<HTMLElement>(
      'button:not([disabled]):not([aria-disabled="true"]), [data-flow-focusable="true"], [tabindex]:not([tabindex="-1"])'
    );
    const visible: HTMLElement[] = [];
    candidates.forEach(el => {
      // 跳过隐藏元素（hidden 属性 / 隐藏祖先）。
      if (el.closest('[hidden]')) return;
      if (el.hasAttribute('hidden')) return;
      visible.push(el);
    });
    return visible;
  }

  function close(): void {
    clearFollowupTimer();
    detachDocListeners();
    vn?.destroy();
    vn = null;
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    // ISSUE-003：先恢复 host 兄弟的可聚焦/可访问状态，再把焦点还给标题屏入口
    // （若仍 inert，focus 不可见且 AT 无法到达）。
    restoreHostInert();
    // 关闭后把焦点还给标题屏入口（便于再次点开 / 继续标题屏操作）。
    document.querySelector<HTMLElement>('#flow-title-narration')?.focus({ preventScroll: true });
  }

  function buildOverlay(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'narration-intro-overlay';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-labelledby', 'narration-intro-heading');

    const paper = document.createElement('div');
    paper.className = 'narration-intro-paper';

    const heading = document.createElement('p');
    heading.id = 'narration-intro-heading';
    heading.className = 'narration-intro-heading';
    heading.textContent = '─ 来自开发者';

    const mount = document.createElement('div');
    mount.id = 'narration-intro-vn';
    mount.className = 'narration-intro-mount';
    mount.setAttribute('role', 'group');
    mount.setAttribute('aria-label', '开发者来信·打字机舞台');

    paper.append(heading, mount);
    wrap.appendChild(paper);
    return wrap;
  }

  function startIntroScene(): void {
    if (!vn) return;
    vn.showScene(buildIntroScene(), initialState(), {
      onChoose: choiceId => {
        if (choiceId === 'try') {
          markRead();
          close();
          options.onStartNarration();
          return;
        }
        if (choiceId === 'decline') {
          startFollowupScene();
        }
      },
      onSceneComplete: () => {
        // intro 主场景有 choices，理论上不走此分支；防御性收起。
        close();
      },
      onExit: () => close()
    });
  }

  function startFollowupScene(): void {
    if (!vn) return;
    vn.showScene(buildFollowupScene(), initialState(), {
      onChoose: () => close(),
      onSceneComplete: () => {
        // 挽留文案读完：标记已读 + 尊重退出回 title（入口保留可再点）。
        markRead();
        close();
      },
      onExit: () => close()
    });
    // docs/22 §2.4「显示数秒后尊重退出」：自动收起兜底（玩家也可手动推进 / 退出）。
    clearFollowupTimer();
    followupTimer = setTimeout(() => {
      markRead();
      close();
    }, FOLLOWUP_AUTOCLOSE_MS);
  }

  function open(): void {
    if (destroyed) return;
    // 已读跳过（docs/22 §2.4 第二次点入口）。
    if (isRead()) {
      options.onStartNarration();
      return;
    }
    close(); // 防御：避免重复 overlay。
    overlay = buildOverlay();
    host.appendChild(overlay);
    // ISSUE-003：overlay 落到 host 后立刻把其余子节点 inert + aria-hidden，
    // 使标题屏底层按钮在无障碍树与 browse mode 中隐去（modal 语义对齐）。
    applyHostInert();
    const mount = overlay.querySelector<HTMLElement>('#narration-intro-vn');
    if (!mount) {
      close();
      return;
    }
    vn = createNarrationVN({
      root: mount,
      reducedMotion: options.reducedMotion,
      audio: null, // 自白信笺无心声 blip（与主玩法心魔分轨区分）。
      stageId: 'narration-intro-stage',
      stageLabel: '开发者来信：按 Enter 或点击继续'
    });
    startIntroScene();
    // HIGH4：modal 焦点陷阱 + Escape 关闭。
    attachModalListeners();
    // MEDIUM6：焦点落舞台（而非 #narration-intro-vn 容器），便于 Enter 推进打字机。
    overlay.querySelector<HTMLElement>('#narration-intro-stage')?.focus({ preventScroll: true });
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    close();
  }

  return { open, close, destroy, isRead };
}
