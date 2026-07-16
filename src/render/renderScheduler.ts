export type RenderSection = 'layout' | 'world' | 'hud' | 'focus' | 'toast' | 'effects';

export interface RenderFrame {
  timestamp: number;
  frameNumber: number;
  dirty: readonly RenderSection[];
}

export interface RenderFrameActivity {
  particlesActive: boolean;
  flashActive: boolean;
}

export type RenderFrameCallback = (frame: RenderFrame) => RenderFrameActivity;

export interface RenderSchedulerOptions {
  requestFrame: (callback: (timestamp: number) => void) => unknown;
  cancelFrame?: (handle: unknown) => void;
  onFrame: RenderFrameCallback;
}

export interface RenderSchedulerSnapshot {
  disposed: boolean;
  scheduled: boolean;
  frameCount: number;
  pending: readonly RenderSection[];
}

export interface RenderScheduler {
  invalidate(...sections: RenderSection[]): void;
  snapshot(): RenderSchedulerSnapshot;
  dispose(): void;
}

/**
 * Coalesces render invalidations behind an injected animation-frame driver.
 * No browser globals are read here, which keeps scheduling deterministic in tests.
 */
export function createRenderScheduler(options: RenderSchedulerOptions): RenderScheduler {
  const pending = new Set<RenderSection>();
  let scheduled = false;
  let scheduledHandle: unknown;
  let disposed = false;
  let frameCount = 0;

  function schedule(): void {
    if (disposed || scheduled) return;
    scheduled = true;
    try {
      scheduledHandle = options.requestFrame(runFrame);
    } catch (error) {
      scheduled = false;
      scheduledHandle = undefined;
      throw error;
    }
  }

  function runFrame(timestamp: number): void {
    if (disposed) return;
    scheduled = false;
    scheduledHandle = undefined;
    const dirty = [...pending];
    pending.clear();
    frameCount += 1;
    const activity = options.onFrame({ timestamp, frameNumber: frameCount, dirty });
    if (activity.particlesActive || activity.flashActive || pending.size > 0) schedule();
  }

  return {
    invalidate(...sections: RenderSection[]): void {
      if (disposed) return;
      for (const section of sections) pending.add(section);
      if (pending.size > 0) schedule();
    },
    snapshot(): RenderSchedulerSnapshot {
      return {
        disposed,
        scheduled,
        frameCount,
        pending: [...pending]
      };
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      pending.clear();
      if (scheduled && options.cancelFrame) options.cancelFrame(scheduledHandle);
      scheduled = false;
      scheduledHandle = undefined;
    }
  };
}
