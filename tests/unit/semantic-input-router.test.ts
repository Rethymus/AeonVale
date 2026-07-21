import { describe, expect, it } from 'vitest';
import { gameCommandFromKeyboard, gameCommandFromTouch, type GameCommand, type TouchInput } from '@app/semanticInputRouter';

describe('semantic input router', () => {
  it('maps arrows and WASD to the same movement commands', () => {
    expect(gameCommandFromKeyboard({ key: 'ArrowUp' })).toEqual({ kind: 'move', direction: 'up' });
    expect(gameCommandFromKeyboard({ key: 'w' })).toEqual({ kind: 'move', direction: 'up' });
    expect(gameCommandFromKeyboard({ key: 'A' })).toEqual({ kind: 'move', direction: 'left' });
    expect(gameCommandFromKeyboard({ key: 'ArrowDown' })).toEqual({ kind: 'move', direction: 'down' });
    expect(gameCommandFromKeyboard({ key: 'd' })).toEqual({ kind: 'move', direction: 'right' });
  });

  it('maps primary interaction and cancellation without reading DOM events', () => {
    expect(gameCommandFromKeyboard({ key: ' ' })).toEqual({ kind: 'confirm' });
    expect(gameCommandFromKeyboard({ key: 'Spacebar' })).toEqual({ kind: 'confirm' });
    expect(gameCommandFromKeyboard({ key: 'e' })).toEqual({ kind: 'confirm' });
    expect(gameCommandFromKeyboard({ key: 'Escape' })).toEqual({ kind: 'cancel' });
  });

  it('keeps Enter context explicit so panels confirm while the world can end the day', () => {
    expect(gameCommandFromKeyboard({ key: 'Enter' }, { enterBehavior: 'confirm' })).toEqual({ kind: 'confirm' });
    expect(gameCommandFromKeyboard({ key: 'Enter' }, { enterBehavior: 'end-day' })).toEqual({ kind: 'end-day' });
  });

  it('maps forward and backward cycling plus stable zero-based hotbar slots', () => {
    expect(gameCommandFromKeyboard({ key: 'Tab' })).toEqual({ kind: 'cycle', direction: 'next' });
    expect(gameCommandFromKeyboard({ key: 'Tab', shiftKey: true })).toEqual({ kind: 'cycle', direction: 'previous' });
    expect(gameCommandFromKeyboard({ key: '1', code: 'Digit1' })).toEqual({ kind: 'hotbar', index: 0 });
    expect(gameCommandFromKeyboard({ key: '0', code: 'Digit0' })).toEqual({ kind: 'hotbar', index: 9 });
    expect(gameCommandFromKeyboard({ key: '!', code: 'Digit1', shiftKey: true })).toBeNull();
  });

  it('maps visible menu accelerators to semantic open targets', () => {
    expect(gameCommandFromKeyboard({ key: 'b' })).toEqual({ kind: 'open', target: 'inventory' });
    expect(gameCommandFromKeyboard({ key: 'c' })).toEqual({ kind: 'open', target: 'cultivation' });
    expect(gameCommandFromKeyboard({ key: 'j' })).toEqual({ kind: 'open', target: 'journey' });
    expect(gameCommandFromKeyboard({ key: 'm' })).toEqual({ kind: 'open', target: 'map' });
    expect(gameCommandFromKeyboard({ key: 'p' })).toEqual({ kind: 'open', target: 'pause' });
  });

  it('keeps the default product profile click-first by dropping tab, hotbar, and space/e shortcuts', () => {
    const context = { shortcutProfile: 'product' as const, enterBehavior: 'confirm' as const };
    expect(gameCommandFromKeyboard({ key: 'b' }, context)).toEqual({ kind: 'open', target: 'inventory' });
    expect(gameCommandFromKeyboard({ key: 'Escape' }, context)).toEqual({ kind: 'cancel' });
    expect(gameCommandFromKeyboard({ key: 'Enter' }, context)).toEqual({ kind: 'confirm' });
    expect(gameCommandFromKeyboard({ key: 'ArrowRight' }, context)).toEqual({ kind: 'move', direction: 'right' });
    expect(gameCommandFromKeyboard({ key: 'c' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'j' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'm' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'n' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'p' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'u' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'y' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: '[' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: ']' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'Tab' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: '1', code: 'Digit1' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: ' ' }, context)).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'e' }, context)).toBeNull();
  });

  it('normalizes touch controls into the same GameCommand union', () => {
    const cases: Array<{ touch: TouchInput; expected: GameCommand }> = [
      { touch: { control: 'move', direction: 'left' }, expected: { kind: 'move', direction: 'left' } },
      { touch: { control: 'confirm' }, expected: { kind: 'confirm' } },
      { touch: { control: 'cancel' }, expected: { kind: 'cancel' } },
      { touch: { control: 'cycle', direction: 'previous' }, expected: { kind: 'cycle', direction: 'previous' } },
      { touch: { control: 'hotbar', index: 4 }, expected: { kind: 'hotbar', index: 4 } },
      { touch: { control: 'open', target: 'furnace' }, expected: { kind: 'open', target: 'furnace' } },
      { touch: { control: 'end-day' }, expected: { kind: 'end-day' } }
    ];

    for (const entry of cases) expect(gameCommandFromTouch(entry.touch)).toEqual(entry.expected);
  });

  it('rejects unsupported shortcuts, modified commands, and invalid touch hotbar indices', () => {
    expect(gameCommandFromKeyboard({ key: 'x' })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'i' })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'l' })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'u' })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'e', ctrlKey: true })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'p', metaKey: true })).toBeNull();
    expect(gameCommandFromKeyboard({ key: 'ArrowUp', altKey: true })).toBeNull();
    expect(gameCommandFromTouch({ control: 'hotbar', index: -1 })).toBeNull();
    expect(gameCommandFromTouch({ control: 'hotbar', index: 10 })).toBeNull();
    expect(gameCommandFromTouch({ control: 'hotbar', index: 1.5 })).toBeNull();
  });

  it('does not mutate structured touch input', () => {
    const input = Object.freeze({ control: 'open' as const, target: 'settings' as const });
    expect(gameCommandFromTouch(input)).toEqual({ kind: 'open', target: 'settings' });
    expect(input).toEqual({ control: 'open', target: 'settings' });
  });
});
