import type { GameState } from '@sim/world/state';

export interface GuardBeastPreviewPlacement {
  beastId: number;
  tileId: number;
  x: number;
  y: number;
  vigorRatio: number;
  specialty: 'field-ward' | 'array-warden' | 'courier' | null;
}

export const GUARD_BEAST_ASSET_IDS = ['sprite.guard-beast', 'sprite.guard-beast-boar', 'sprite.guard-beast-wolf'] as const;

export function guardBeastPreviewAssetId(beastId: number): (typeof GUARD_BEAST_ASSET_IDS)[number] {
  return GUARD_BEAST_ASSET_IDS[Math.abs(beastId) % GUARD_BEAST_ASSET_IDS.length] ?? 'sprite.guard-beast';
}

export function guardBeastPreviewPlacements(state: GameState): GuardBeastPreviewPlacement[] {
  return state.guardBeastPatrols
    .map(assignment => {
      const beast = state.guardBeasts.find(entry => entry.id === assignment.beastId);
      const tile = state.tiles[assignment.tileId];
      if (!beast || !tile) return null;
      const vigorRatio = beast.maxVigor > 0 ? Math.max(0, Math.min(1, beast.vigor / beast.maxVigor)) : 0;
      return {
        beastId: beast.id,
        tileId: assignment.tileId,
        x: tile.x,
        y: tile.y,
        vigorRatio,
        specialty: beast.specialty
      };
    })
    .filter((placement): placement is GuardBeastPreviewPlacement => Boolean(placement))
    .sort((a, b) => a.tileId - b.tileId || a.beastId - b.beastId);
}
