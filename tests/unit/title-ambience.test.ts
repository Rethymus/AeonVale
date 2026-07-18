import { describe, expect, it, vi } from 'vitest';
import { createTitleAmbience, titleAmbientTransform } from '../../src/app/titleAmbience';

describe('titleAmbientTransform', () => {
  it('keeps the float within a subtle range and is deterministic', () => {
    for (const t of [0, 250, 1000, 12345]) {
      const { ty, scale } = titleAmbientTransform(t);
      expect(ty).toBeGreaterThanOrEqual(-3);
      expect(ty).toBeLessThanOrEqual(3);
      expect(scale).toBeGreaterThanOrEqual(0.98);
      expect(scale).toBeLessThanOrEqual(1.02);
      // 同输入同输出（无 RNG）
      expect(titleAmbientTransform(t)).toEqual({ ty, scale });
    }
  });

  it('actually oscillates (not a constant)', () => {
    const a = titleAmbientTransform(0);
    const b = titleAmbientTransform(1000);
    expect(Math.abs(a.ty - b.ty) + Math.abs(a.scale - b.scale)).toBeGreaterThan(0);
  });
});

describe('createTitleAmbience controller', () => {
  const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

  function setup() {
    const target = { style: { transform: '' } } as unknown as HTMLElement;
    let frames = 0;
    let fired = false; // 只让首个 requestFrame 真正触发一帧，避免 tick 自驱动无限链
    const requestFrame = vi.fn((cb: (t: number) => void) => {
      const handle = ++frames;
      if (!fired) {
        fired = true;
        queueMicrotask(() => cb(handle * 16));
      }
      return handle;
    });
    const cancelFrame = vi.fn(() => undefined);
    const resolveTarget = vi.fn(() => target);
    const controller = createTitleAmbience({ requestFrame, cancelFrame, resolveTarget });
    return { target, requestFrame, cancelFrame, resolveTarget, controller };
  }

  it('setActive(true) starts the loop and writes a transform; setActive(false) cancels and resets', async () => {
    const { target, requestFrame, cancelFrame, controller } = setup();
    controller.setActive(true);
    expect(requestFrame).toHaveBeenCalled();
    await flush();
    expect(target.style.transform).not.toBe('');

    controller.setActive(false);
    expect(cancelFrame).toHaveBeenCalled();
    expect(target.style.transform).toBe('');
  });

  it('is idempotent: repeated setActive(same) does not restart the loop', () => {
    const { requestFrame, controller } = setup();
    controller.setActive(true);
    const n = requestFrame.mock.calls.length;
    controller.setActive(true);
    controller.setActive(true);
    expect(requestFrame.mock.calls.length).toBe(n);
  });

  it('dispose stops the loop and resets the transform even if left active', async () => {
    const { target, cancelFrame, controller } = setup();
    controller.setActive(true);
    await flush();
    controller.dispose();
    expect(cancelFrame).toHaveBeenCalled();
    expect(target.style.transform).toBe('');
  });
});
