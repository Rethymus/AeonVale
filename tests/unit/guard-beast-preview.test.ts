import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { GUARD_BEAST_ASSET_IDS, guardBeastPreviewAssetId, guardBeastPreviewPlacements } from '@render/guardBeastPreview';

describe('guard beast preview placements', () => {
  it('maps patrol assignments to deterministic tile placements', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 21, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.guardBeasts.push({ id: 8, vigor: 12, maxVigor: 20, bond: 0, specialty: 'courier' });
    state.guardBeasts.push({ id: 3, vigor: 20, maxVigor: 20, bond: 0, specialty: 'field-ward' });
    state.guardBeastPatrols.push({ beastId: 8, tileId: state.tiles[5]!.id, assignedDay: state.day });
    state.guardBeastPatrols.push({ beastId: 3, tileId: state.tiles[2]!.id, assignedDay: state.day });

    expect(guardBeastPreviewPlacements(state)).toEqual([
      { beastId: 3, tileId: 2, x: state.tiles[2]!.x, y: state.tiles[2]!.y, vigorRatio: 1, specialty: 'field-ward' },
      { beastId: 8, tileId: 5, x: state.tiles[5]!.x, y: state.tiles[5]!.y, vigorRatio: 0.6, specialty: 'courier' }
    ]);
  });

  it('skips missing beasts or tiles gracefully', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 22, width: 3, height: 3, content: reg, params: DEFAULT_BALANCE });
    state.guardBeasts.push({ id: 4, vigor: 6, maxVigor: 12, bond: 0, specialty: null });
    state.guardBeastPatrols.push({ beastId: 4, tileId: 999, assignedDay: state.day });
    state.guardBeastPatrols.push({ beastId: 404, tileId: state.tiles[0]!.id, assignedDay: state.day });

    expect(guardBeastPreviewPlacements(state)).toEqual([]);
  });

  it('selects guard beast art variants deterministically from manifest-backed ids', () => {
    expect(GUARD_BEAST_ASSET_IDS).toEqual(['sprite.guard-beast', 'sprite.guard-beast-boar', 'sprite.guard-beast-wolf']);
    expect(guardBeastPreviewAssetId(0)).toBe('sprite.guard-beast');
    expect(guardBeastPreviewAssetId(1)).toBe('sprite.guard-beast-boar');
    expect(guardBeastPreviewAssetId(2)).toBe('sprite.guard-beast-wolf');
    expect(guardBeastPreviewAssetId(3)).toBe('sprite.guard-beast');
  });

  it('preserves specialty markers for all supported long-term roles', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 23, width: 4, height: 4, content: reg, params: DEFAULT_BALANCE });
    state.guardBeasts.push({ id: 6, vigor: 9, maxVigor: 18, bond: 0, specialty: 'array-warden' });
    state.guardBeastPatrols.push({ beastId: 6, tileId: state.tiles[7]!.id, assignedDay: state.day });

    expect(guardBeastPreviewPlacements(state)).toEqual([
      {
        beastId: 6,
        tileId: 7,
        x: state.tiles[7]!.x,
        y: state.tiles[7]!.y,
        vigorRatio: 0.5,
        specialty: 'array-warden'
      }
    ]);
  });
});
