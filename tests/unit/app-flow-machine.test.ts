import { describe, expect, it } from 'vitest';
import { APP_FLOW_FOCUS_TARGETS, createAppFlowState, transitionAppFlow, type AppFlowEvent, type AppFlowState } from '@app/appFlowMachine';

function runFlow(events: readonly AppFlowEvent[]): AppFlowState {
  return events.reduce(transitionAppFlow, createAppFlowState());
}

describe('AppFlowMachine', () => {
  it('drives the approved title-to-aftermath vertical slice', () => {
    let state = createAppFlowState();
    expect(state).toEqual({
      screen: 'boot',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.loading, restore: null }
    });

    state = transitionAppFlow(state, { type: 'boot-ready' });
    expect(state.screen).toBe('title');
    state = transitionAppFlow(state, { type: 'start-new-game' });
    expect(state.screen).toBe('prologue');
    state = transitionAppFlow(state, { type: 'finish-prologue' });
    expect(state.screen).toBe('world');
    state = transitionAppFlow(state, { type: 'open-alchemy' });
    expect(state.screen).toBe('alchemy');
    state = transitionAppFlow(state, { type: 'close-alchemy' });
    expect(state.screen).toBe('world');
    state = transitionAppFlow(state, { type: 'start-tribulation' });
    expect(state.screen).toBe('tribulation');
    state = transitionAppFlow(state, { type: 'finish-tribulation' });
    expect(state.screen).toBe('aftermath');
    state = transitionAppFlow(state, { type: 'continue-aftermath' });
    expect(state).toEqual({
      screen: 'world',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.world, restore: null }
    });
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
    expect(transitionAppFlow(failed, { type: 'start-new-game' })).toBe(failed);
  });

  it('skips the prologue without changing the resulting world contract', () => {
    const skipped = runFlow([{ type: 'boot-ready' }, { type: 'start-new-game' }, { type: 'skip-prologue' }]);
    const completed = runFlow([{ type: 'boot-ready' }, { type: 'start-new-game' }, { type: 'finish-prologue' }]);

    expect(skipped).toEqual(completed);
    expect(skipped.screen).toBe('world');
  });

  it('continues an existing save from title directly into world', () => {
    expect(runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }])).toEqual({
      screen: 'world',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.world, restore: null }
    });
  });

  it('keeps one overlay and restores its concrete trigger when it closes', () => {
    const world = runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }]);
    const inventory = transitionAppFlow(world, {
      type: 'open-overlay',
      overlay: 'inventory',
      returnFocus: '#world-inventory-trigger'
    });

    expect(inventory).toEqual({
      screen: 'world',
      overlay: 'inventory',
      focus: {
        initial: APP_FLOW_FOCUS_TARGETS.inventory,
        restore: '#world-inventory-trigger'
      }
    });
    expect(transitionAppFlow(inventory, { type: 'open-overlay', overlay: 'pause' })).toBe(inventory);
    expect(transitionAppFlow(inventory, { type: 'close-overlay' })).toEqual({
      screen: 'world',
      overlay: null,
      focus: { initial: '#world-inventory-trigger', restore: null }
    });

    const title = transitionAppFlow(createAppFlowState(), { type: 'boot-ready' });
    const settings = transitionAppFlow(title, {
      type: 'open-overlay',
      overlay: 'settings',
      returnFocus: APP_FLOW_FOCUS_TARGETS.titleSettings
    });
    expect(settings).toEqual({
      screen: 'title',
      overlay: 'settings',
      focus: {
        initial: APP_FLOW_FOCUS_TARGETS.settings,
        restore: APP_FLOW_FOCUS_TARGETS.titleSettings
      }
    });
    expect(transitionAppFlow(settings, { type: 'close-overlay' })).toEqual({
      screen: 'title',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.titleSettings, restore: null }
    });
  });

  it('rejects overlays on screens where they would break the page contract', () => {
    const prologue = runFlow([{ type: 'boot-ready' }, { type: 'start-new-game' }]);
    const tribulation = runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'start-tribulation' }]);

    expect(transitionAppFlow(prologue, { type: 'open-overlay', overlay: 'inventory' })).toBe(prologue);
    expect(transitionAppFlow(tribulation, { type: 'open-overlay', overlay: 'inventory' })).toBe(tribulation);
    expect(transitionAppFlow(tribulation, { type: 'open-overlay', overlay: 'pause' })).toEqual({
      screen: 'tribulation',
      overlay: 'pause',
      focus: {
        initial: APP_FLOW_FOCUS_TARGETS.pause,
        restore: APP_FLOW_FOCUS_TARGETS.tribulation
      }
    });
  });

  it('ignores invalid page transitions instead of manufacturing unreachable state', () => {
    const boot = createAppFlowState();
    const title = transitionAppFlow(boot, { type: 'boot-ready' });

    expect(transitionAppFlow(boot, { type: 'open-alchemy' })).toBe(boot);
    expect(transitionAppFlow(title, { type: 'finish-tribulation' })).toBe(title);
  });

  it('returns from ending to a clean title screen', () => {
    const ending = runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'show-ending' }]);
    expect(ending.screen).toBe('ending');
    expect(transitionAppFlow(ending, { type: 'return-title' })).toEqual({
      screen: 'title',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.titleNewGame, restore: null }
    });
  });

  it.each(['world', 'alchemy', 'tribulation', 'aftermath'] as const)('lets terminal state preempt the %s screen', screen => {
    const states = {
      world: runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }]),
      alchemy: runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'open-alchemy' }]),
      tribulation: runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'start-tribulation' }]),
      aftermath: runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }, { type: 'start-tribulation' }, { type: 'finish-tribulation' }])
    };

    expect(transitionAppFlow(states[screen], { type: 'show-ending' })).toEqual({
      screen: 'ending',
      overlay: null,
      focus: { initial: APP_FLOW_FOCUS_TARGETS.ending, restore: null }
    });
  });

  it.each(['', '#[', '#inventory,body', '#inventory button', '#inventory>button', '#app canvas'])('rejects unsafe return-focus selector %j without manufacturing a new state', returnFocus => {
    const world = runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }]);
    const malformed = transitionAppFlow(world, {
      type: 'open-overlay',
      overlay: 'inventory',
      returnFocus: returnFocus as `#${string}`
    });

    expect(malformed).toBe(world);
  });

  it('accepts one safe ID selector as a focus return target', () => {
    const world = runFlow([{ type: 'boot-ready' }, { type: 'continue-game' }]);
    const inventory = transitionAppFlow(world, {
      type: 'open-overlay',
      overlay: 'inventory',
      returnFocus: '#inventory-trigger_2'
    });

    expect(inventory.focus.restore).toBe('#inventory-trigger_2');

    const canvasReturn = transitionAppFlow(world, {
      type: 'open-overlay',
      overlay: 'map',
      returnFocus: APP_FLOW_FOCUS_TARGETS.world
    });
    expect(canvasReturn.focus.restore).toBe('#game-canvas');
  });
});
