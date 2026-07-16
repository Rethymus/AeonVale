import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createWorld, DEFAULT_BALANCE } from '@sim';
import { arrayCoreFacilityKind, arrayWorldPreviewPlacements } from '@render/arrayPreview';

describe('array preview helper', () => {
 it('maps rod and insulation arrays to manifest-backed world art ids', () => {
 expect(arrayCoreFacilityKind('array.lightning-rod')).toBe('array-eye');
 expect(arrayCoreFacilityKind('array.insulation')).toBe('array-flag');
 });

it('projects placed arrays into stable world preview placements, including idle remnants', () => {
 const reg = buildRegistry();
 const state = createWorld({ seed: 51, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });

state.arrays.set(2, {
 id: 2,
 defId: 'array.insulation',
 modifier: 0.3,
 coreTileId: 11,
 coverageTileIds: [10, 11, 12],
 power: 0,
 active: false,
 });
 state.arrays.set(1, {
 id: 1,
 defId: 'array.lightning-rod',
 modifier: 4,
 coreTileId: 5,
 coverageTileIds: [5, 6],
 power: 100,
 active: true,
 });

expect(arrayWorldPreviewPlacements(state)).toEqual([
 {
 tileId: 5,
 assetId: 'facility.array-eye',
 status: 'active',
 coverageTileIds: [5, 6],
 },
 {
 tileId: 11,
 assetId: 'facility.array-flag',
 status: 'idle',
 coverageTileIds: [10, 11, 12],
 },
 ]);
 });
});
