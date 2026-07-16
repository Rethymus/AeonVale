import { describe, expect, it } from 'vitest';
import { createRenderScheduler, type RenderFrameCallback, type RenderSection } from '@render/renderScheduler';

function createFrameHarness() {
  let nextHandle = 1;
  const callbacks = new Map<number, (timestamp: number) => void>();
  return {
    request(callback: (timestamp: number) => void): number {
      const handle = nextHandle;
      nextHandle += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancel(handle: unknown): void {
      callbacks.delete(handle as number);
    },
    runNext(timestamp = 0): void {
      const entry = callbacks.entries().next().value as [number, (timestamp: number) => void] | undefined;
      if (!entry) return;
      callbacks.delete(entry[0]);
      entry[1](timestamp);
    },
    get pendingCount(): number {
      return callbacks.size;
    }
  };
}

describe('render scheduler', () => {
  it('coalesces invalidations into one requested animation frame', () => {
    const harness = createFrameHarness();
    const frames: RenderSection[][] = [];
    const onFrame: RenderFrameCallback = frame => {
      frames.push([...frame.dirty]);
      return { particlesActive: false, flashActive: false };
    };
    const scheduler = createRenderScheduler({ requestFrame: harness.request, cancelFrame: harness.cancel, onFrame });

    scheduler.invalidate('world');
    scheduler.invalidate('hud', 'focus');
    scheduler.invalidate('world');

    expect(harness.pendingCount).toBe(1);
    expect(scheduler.snapshot().frameCount).toBe(0);

    harness.runNext(16);

    expect(frames).toEqual([['world', 'hud', 'focus']]);
    expect(harness.pendingCount).toBe(0);
    expect(scheduler.snapshot()).toMatchObject({ frameCount: 1, scheduled: false, pending: [] });
  });

  it.each(['particlesActive', 'flashActive'] as const)('continues only while %s remains active', activeKey => {
    const harness = createFrameHarness();
    let frameCount = 0;
    const scheduler = createRenderScheduler({
      requestFrame: harness.request,
      cancelFrame: harness.cancel,
      onFrame: () => {
        frameCount += 1;
        return {
          particlesActive: activeKey === 'particlesActive' && frameCount < 3,
          flashActive: activeKey === 'flashActive' && frameCount < 3
        };
      }
    });

    scheduler.invalidate('effects');
    harness.runNext(16);
    expect(harness.pendingCount).toBe(1);
    harness.runNext(32);
    expect(harness.pendingCount).toBe(1);
    harness.runNext(48);

    expect(frameCount).toBe(3);
    expect(harness.pendingCount).toBe(0);
    harness.runNext(64);
    expect(frameCount).toBe(3);
  });

  it('merges invalidation raised while an effect frame is already scheduled', () => {
    const harness = createFrameHarness();
    const frames: RenderSection[][] = [];
    let active = true;
    const scheduler = createRenderScheduler({
      requestFrame: harness.request,
      cancelFrame: harness.cancel,
      onFrame: frame => {
        frames.push([...frame.dirty]);
        const result = { particlesActive: active, flashActive: false };
        active = false;
        return result;
      }
    });

    scheduler.invalidate('effects');
    harness.runNext(16);
    scheduler.invalidate('hud');
    scheduler.invalidate('toast');
    expect(harness.pendingCount).toBe(1);

    harness.runNext(32);

    expect(frames).toEqual([['effects'], ['hud', 'toast']]);
    expect(harness.pendingCount).toBe(0);
  });

  it('cancels queued work and ignores future invalidation after disposal', () => {
    const harness = createFrameHarness();
    const scheduler = createRenderScheduler({
      requestFrame: harness.request,
      cancelFrame: harness.cancel,
      onFrame: () => ({ particlesActive: false, flashActive: false })
    });

    scheduler.invalidate('world');
    scheduler.dispose();
    scheduler.invalidate('hud');

    expect(harness.pendingCount).toBe(0);
    expect(scheduler.snapshot()).toMatchObject({ disposed: true, scheduled: false, pending: [] });
  });
});
