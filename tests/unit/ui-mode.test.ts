import { describe, expect, it } from 'vitest';
import { deriveUiMode, visibleUiLayers } from '@app/uiMode';
import { appFocusTargetFor, type AppFlowState, type AppOverlay, type AppScreen } from '@app/appFlowMachine';

function flow(screen: AppScreen, overlay: AppOverlay | null = null): AppFlowState {
  return {
    screen,
    overlay,
    focus: { initial: appFocusTargetFor(screen, overlay), restore: null }
  };
}

const world = flow('world');

describe('UI mode derivation', () => {
  it('maps every top-level app screen to one authoritative mode', () => {
    expect(deriveUiMode({ flow: flow('boot') })).toBe('loading');
    expect(deriveUiMode({ flow: flow('boot-error') })).toBe('boot-error');
    expect(deriveUiMode({ flow: flow('title') })).toBe('title');
    expect(deriveUiMode({ flow: flow('prologue') })).toBe('prologue');
    expect(deriveUiMode({ flow: world })).toBe('world');
    expect(deriveUiMode({ flow: flow('tribulation') })).toBe('tribulation');
    expect(deriveUiMode({ flow: flow('aftermath') })).toBe('aftermath');
    expect(deriveUiMode({ flow: flow('ending') })).toBe('ending');
  });

  it('derives a single world attention layer with deterministic priority', () => {
    expect(deriveUiMode({ flow: world, locationActive: true })).toBe('location');
    expect(deriveUiMode({ flow: world, locationActive: true, panelActive: true })).toBe('panel');
    expect(deriveUiMode({ flow: world, locationActive: true, panelActive: true, dialogueActive: true })).toBe('dialogue');
  });

  it('lets the flow overlay remain authoritative over legacy attention signals', () => {
    expect(deriveUiMode({ flow: flow('world', 'inventory'), dialogueActive: true, locationActive: true })).toBe('panel');
    expect(deriveUiMode({ flow: flow('world', 'map'), panelActive: true })).toBe('location');
    expect(deriveUiMode({ flow: flow('world', 'pause'), dialogueActive: true, panelActive: true })).toBe('pause');
  });

  it('uses portrait-blocked as the absolute presentation priority', () => {
    expect(
      deriveUiMode({
        flow: flow('ending', 'pause'),
        portraitBlocked: true,
        dialogueActive: true,
        panelActive: true,
        locationActive: true
      })
    ).toBe('portrait-blocked');
  });

  it('keeps ending above pause and all world overlays when portrait is allowed', () => {
    expect(deriveUiMode({ flow: flow('ending', 'pause'), dialogueActive: true, panelActive: true, locationActive: true })).toBe('ending');
  });

  it('exposes at most one main attention layer for every mode', () => {
    const modes = ['loading', 'boot-error', 'title', 'prologue', 'world', 'dialogue', 'panel', 'location', 'pause', 'tribulation', 'aftermath', 'ending', 'portrait-blocked'] as const;

    for (const mode of modes) {
      const visible = visibleUiLayers(mode);
      const activeMainLayers = Object.values(visible).filter(Boolean);
      expect(activeMainLayers, mode).toHaveLength(1);
    }
  });
});
