import type { GameState } from '@sim/world/state';

export const FIRST_HARVEST_FLAG = 'onboarding-first-harvest';
export const FIRST_SHIPMENT_FLAG = 'onboarding-first-shipment';
export const FIRST_SHIPPING_SETTLEMENT_FLAG = 'onboarding-first-shipping-settlement';
export const FIRST_MARKET_RESTOCK_FLAG = 'onboarding-first-market-restock';
export const FIRST_SECOND_SOW_FLAG = 'onboarding-first-second-sow';
export const FIRST_SECOND_WATER_FLAG = 'onboarding-first-second-water';
export const TUTORIAL_ALCHEMY_KIT_FLAG = 'onboarding-tutorial-alchemy-kit';
export const TUTORIAL_ALCHEMY_BREWED_FLAG = 'onboarding-tutorial-alchemy-brewed';
export const TUTORIAL_TRIBULATION_COMPLETED_FLAG = 'onboarding-tutorial-tribulation-completed';
export const TUTORIAL_TRIBULATION_REWARDED_FLAG = 'onboarding-tutorial-tribulation-rewarded';
export const TUTORIAL_AFTERMATH_VIEWED_FLAG = 'onboarding-tutorial-aftermath-viewed';

export type OnboardingObjectiveId = 'first-till' | 'first-sow' | 'first-water' | 'first-harvest' | 'first-ship' | 'first-sleep' | 'first-market-restock' | 'first-second-sow' | 'first-second-water' | 'first-loop-complete';
export type PublicDemoObjectiveId = OnboardingObjectiveId | 'journey-alchemy' | 'journey-tribulation' | 'journey-aftermath' | 'journey-complete';

function hasAnyTilledTile(state: GameState): boolean {
  return state.tiles.some(tile => tile.tilled);
}

function cropTileIds(state: GameState): number[] {
  return state.tiles.filter(tile => tile.cropId != null).map(tile => tile.id);
}

function hasWateredCropToday(state: GameState): boolean {
  return cropTileIds(state).some(tileId => state.tiles[tileId]?.wateredToday);
}

function hasMatureCrop(state: GameState): boolean {
  return cropTileIds(state).some(tileId => {
    const crop = state.crops.get(tileId);
    return crop?.stage === 'mature';
  });
}

export function getOnboardingObjectiveId(state: GameState): OnboardingObjectiveId | null {
  if (state.player.flags.has(FIRST_SECOND_WATER_FLAG)) return 'first-loop-complete';
  if (state.player.flags.has(FIRST_SECOND_SOW_FLAG)) return 'first-second-water';
  if (state.player.flags.has(FIRST_MARKET_RESTOCK_FLAG)) return 'first-second-sow';
  if (state.player.flags.has(FIRST_SHIPPING_SETTLEMENT_FLAG)) return 'first-market-restock';
  if (state.player.flags.has(FIRST_HARVEST_FLAG) && !state.player.flags.has(FIRST_SHIPMENT_FLAG)) return 'first-ship';
  if (state.player.flags.has(FIRST_SHIPMENT_FLAG)) return 'first-sleep';
  if (!hasAnyTilledTile(state)) return 'first-till';
  if (cropTileIds(state).length === 0) return 'first-sow';
  if (hasMatureCrop(state)) return 'first-harvest';
  if (!hasWateredCropToday(state)) return 'first-water';
  return 'first-harvest';
}

/** 四段公开试玩目标；保留旧十步农务函数供日常引导继续使用。 */
export function getPublicDemoObjectiveId(state: GameState): PublicDemoObjectiveId | null {
  const flags = state.player.flags;
  if (flags.has(TUTORIAL_AFTERMATH_VIEWED_FLAG)) return 'journey-complete';
  if (state.tutorialTribulation?.phase === 'aftermath' || flags.has(TUTORIAL_TRIBULATION_COMPLETED_FLAG)) return 'journey-aftermath';
  if (flags.has(TUTORIAL_ALCHEMY_BREWED_FLAG)) return 'journey-tribulation';
  if (flags.has(FIRST_HARVEST_FLAG)) return 'journey-alchemy';
  return getOnboardingObjectiveId(state);
}
