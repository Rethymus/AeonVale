/**
 * 标题徽记常驻「呼吸」：缓慢上浮 + 微缩放，让标题屏不再静止。
 *
 * 纯代码、零资产：变换由时间确定性派生（无 RNG）。CONTIBUTING 禁 CSS `animation:`，
 * 且 renderScheduler 在标题屏会停摆，故走自管 rAF（仅在标题屏激活、离开即停）。
 */

export interface TitleAmbientTransform {
  readonly ty: number;
  readonly scale: number;
}

/** 标题徽记呼吸变换（纯函数，可单测）。`tMs` 为渲染时钟毫秒。 */
export function titleAmbientTransform(tMs: number): TitleAmbientTransform {
  const ty = Math.sin(tMs * 0.0018) * 3; // ~3px 慢浮
  const scale = 1 + Math.sin(tMs * 0.0012) * 0.02; // ~2% 呼吸
  return { ty, scale };
}

export interface TitleAmbienceOptions {
  requestFrame: (callback: (timestamp: number) => void) => unknown;
  cancelFrame: (handle: unknown) => void;
  resolveTarget: () => HTMLElement | null;
  now?: () => number;
}

export interface TitleAmbienceController {
  setActive(active: boolean): void;
  dispose(): void;
}

/**
 * 创建一个自管 rAF 的标题呼吸控制器：`setActive(true)` 起播，`setActive(false)`/`dispose` 停并复位 transform。
 * 幂等：重复 setActive 同值不重启；离开标题复位 inline transform，避免残留。
 */
export function createTitleAmbience(opts: TitleAmbienceOptions): TitleAmbienceController {
  let handle: unknown = null;
  let active = false;
  const now = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  const writeTransform = (timestamp: number): void => {
    const target = opts.resolveTarget();
    if (target) {
      const { ty, scale } = titleAmbientTransform(timestamp);
      target.style.transform = `translateY(${ty.toFixed(2)}px) scale(${scale.toFixed(4)})`;
    }
  };

  const tick = (timestamp: number): void => {
    if (!active) return;
    writeTransform(timestamp);
    handle = opts.requestFrame(tick);
  };

  const resetTarget = (): void => {
    const target = opts.resolveTarget();
    if (target) target.style.transform = '';
  };

  const stop = (): void => {
    if (handle !== null) {
      opts.cancelFrame(handle);
      handle = null;
    }
    resetTarget();
  };

  return {
    setActive(next: boolean): void {
      if (next === active) return;
      active = next;
      if (next) {
        handle = opts.requestFrame(tick);
      } else {
        stop();
      }
    },
    dispose(): void {
      active = false;
      stop();
    }
  };
}
