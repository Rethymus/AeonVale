import { describe, expect, it } from 'vitest';
import { APP_FLOW_FOCUS_TARGETS, createAppFlowState, transitionAppFlow, type AppFlowEvent, type AppFlowState } from '@app/appFlowMachine';

function runFlow(events: readonly AppFlowEvent[]): AppFlowState {
  return events.reduce(transitionAppFlow, createAppFlowState());
}

describe('AppFlowMachine', () => {
  it('drives the boot-to-title contract', () => {
    const state = createAppFlowState();
    expect(state).toEqual({
      screen: 'boot',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.loading, restore: null }
    });

    const title = transitionAppFlow(state, { type: 'boot-ready' });
    expect(title.screen).toBe('title');
    expect(transitionAppFlow(title, { type: 'boot-ready' })).toBe(title);
  });

  it('moves boot failures into a terminal, focusable error screen', () => {
    const boot = createAppFlowState();
    const failed = transitionAppFlow(boot, { type: 'boot-error' });

    expect(failed).toEqual({
      screen: 'boot-error',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.bootError, restore: null }
    });
    expect(transitionAppFlow(failed, { type: 'boot-ready' })).toBe(failed);
    expect(transitionAppFlow(failed, { type: 'continue-game' })).toBe(failed);
  });

  it('continues an existing save from title directly into the current journey', () => {
    expect(runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }])).toEqual({
      screen: 'roguelite-proto',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.rogueliteProto, restore: null }
    });
  });

  it('starts and leaves the current journey from title', () => {
    const journey = runFlow([{ type: 'boot-ready' }, { type: 'start-roguelite-proto' }]);

    expect(journey).toEqual({
      screen: 'roguelite-proto',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.rogueliteProto, restore: null }
    });
    expect(transitionAppFlow(journey, { type: 'return-title-from-roguelite-proto' })).toEqual({
      screen: 'title',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.titleNewGame, restore: null }
    });
  });

  it('starts and leaves the narration surface from title', () => {
    const narration = runFlow([{ type: 'boot-ready' }, { type: 'start-narration' }]);

    expect(narration).toEqual({
      screen: 'narration',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.narration, restore: null }
    });
    expect(transitionAppFlow(narration, { type: 'return-title-from-narration' })).toEqual({
      screen: 'title',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.titleNewGame, restore: null }
    });
  });

  it('keeps one overlay and restores its concrete trigger when it closes', () => {
    const title = transitionAppFlow(createAppFlowState(), { type: 'boot-ready' });
    const settings = transitionAppFlow(title, {
      type: 'open-overlay',
      overlay: 'settings',
      returnFocus: APP_FLOW_FOCUS_TARGETS.titleNewGame
    });
    expect(settings).toEqual({
      screen: 'title',
      overlay: 'settings',
      focus: {
        initial: APP_FLOW_FOCUS_TARGETS.settings,
        restore: APP_FLOW_FOCUS_TARGETS.titleNewGame
      }
    });
    expect(transitionAppFlow(settings, { type: 'open-overlay', overlay: 'codex' })).toBe(settings);
    expect(transitionAppFlow(settings, { type: 'close-overlay' })).toEqual({
      screen: 'title',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.titleNewGame, restore: null }
    });

    // 灵韵叙录内可开「叙录」覆盖层（docs/22 §11）。
    const narration = transitionAppFlow(title, { type: 'start-narration' });
    const codex = transitionAppFlow(narration, { type: 'open-overlay', overlay: 'codex' });
    expect(codex).toEqual({
      screen: 'narration',
      overlay: 'codex',
      focus: {
        initial: APP_FLOW_FOCUS_TARGETS.codex,
        restore: APP_FLOW_FOCUS_TARGETS.narration
      }
    });
    expect(transitionAppFlow(codex, { type: 'close-overlay' })).toEqual({
      screen: 'narration',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.narration, restore: null }
    });
  });

  it('rejects overlays on screens where they would break the page contract', () => {
    const boot = createAppFlowState();
    const title = transitionAppFlow(boot, { type: 'boot-ready' });
    const journey = transitionAppFlow(title, { type: 'start-roguelite-proto' });

    expect(transitionAppFlow(journey, { type: 'open-overlay', overlay: 'settings' })).toBe(journey);
    expect(transitionAppFlow(boot, { type: 'open-overlay', overlay: 'settings' })).toBe(boot);
  });

  it('ignores invalid page transitions instead of manufacturing unreachable state', () => {
    const boot = createAppFlowState();
    const title = transitionAppFlow(boot, { type: 'boot-ready' });

    expect(transitionAppFlow(boot, { type: 'open-overlay', overlay: 'settings' })).toBe(boot);
    expect(transitionAppFlow(title, { type: 'return-title-from-narration' })).toBe(title);
  });

  it.each(['', '#[', '#codex,body', '#codex button', '#codex>button', '#app canvas'])('rejects unsafe return-focus selector %j without manufacturing a new state', returnFocus => {
    const title = transitionAppFlow(createAppFlowState(), { type: 'boot-ready' });
    const malformed = transitionAppFlow(title, {
      type: 'open-overlay',
      overlay: 'settings',
      returnFocus: returnFocus as `#${string}`
    });

    expect(malformed).toBe(title);
  });

  it('accepts one safe ID selector as a focus return target', () => {
    const title = transitionAppFlow(createAppFlowState(), { type: 'boot-ready' });
    const settings = transitionAppFlow(title, {
      type: 'open-overlay',
      overlay: 'settings',
      returnFocus: '#settings-trigger_2'
    });
    expect(settings.focus.restore).toBe('#settings-trigger_2');
  });
});
