import { describe, expect, it } from 'vitest';
import { toolFeedbackToast, toolFeedbackToastPresentation } from '@app/toolFeedback';
import type { GameEvent } from '@sim';

function event(type: string, payload?: unknown): GameEvent {
  return { type, tick: 1, day: 1, payload };
}

describe('tool feedback toast helper', () => {
  it('returns null when no tool events were emitted', () => {
    expect(toolFeedbackToast([event('harvest')])).toBeNull;
    expect(toolFeedbackToastPresentation([event('harvest')])).toBeNull;
  });

  it('only warns when durability enters the low threshold', () => {
    expect(toolFeedbackToast([event('tool-worn', { itemId: 'item.rust-hoe', durability: 4 })])).toBeNull;
    expect(toolFeedbackToast([event('tool-worn', { itemId: 'item.rust-hoe', durability: 3 })])).toBe('铁锈锄耐久仅剩 3，尽快修补以免断了药田节奏');
    expect(toolFeedbackToast([event('tool-worn', { itemId: 'item.water-pail', durability: 1 })])).toBe('灵水桶耐久仅剩 1，尽快修补以免断了药田节奏');
    expect(toolFeedbackToastPresentation([event('tool-worn', { itemId: 'item.rust-hoe', durability: 3 })])).toEqual({
      message: '铁锈锄耐久仅剩 3，尽快修补以免断了药田节奏',
      assetId: 'icon.item.rust-hoe'
    });
    expect(toolFeedbackToastPresentation([event('tool-worn', { itemId: 'item.water-pail', durability: 1 })])).toEqual({
      message: '灵水桶耐久仅剩 1，尽快修补以免断了药田节奏',
      assetId: 'icon.item.water-pail'
    });
  });

  it('prioritizes tool breakage over worn warnings', () => {
    expect(toolFeedbackToast([event('tool-worn', { itemId: 'item.sickle', durability: 0 }), event('tool-broke', { itemId: 'item.sickle' })])).toBe('镰刀已损坏，先修补再续农务');
    expect(toolFeedbackToastPresentation([event('tool-worn', { itemId: 'item.sickle', durability: 0 }), event('tool-broke', { itemId: 'item.sickle' })])).toEqual({
      message: '镰刀已损坏，先修补再续农务',
      assetId: 'icon.item.sickle'
    });
  });

  it('falls back to the player thread when the tool is unknown', () => {
    expect(toolFeedbackToastPresentation([event('tool-broke', { itemId: 'item.unknown-tool' })])).toEqual({
      message: 'item.unknown-tool已损坏，先修补再续农务',
      assetId: 'sprite.player'
    });
    expect(toolFeedbackToastPresentation([event('tool-worn', { itemId: 'item.unknown-tool', durability: 2 })], 'loc.herb-plot')).toEqual({
      message: 'item.unknown-tool耐久仅剩 2，尽快修补以免断了药田节奏',
      assetId: 'loc.herb-plot'
    });
    expect(toolFeedbackToastPresentation([event('tool-broke', { itemId: 'item.unknown-tool' })], 'facility.shipping-bin')).toEqual({
      message: 'item.unknown-tool已损坏，先修补再续农务',
      assetId: 'facility.shipping-bin'
    });
  });
});
