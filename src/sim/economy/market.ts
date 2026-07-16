import type { GameState } from '@sim/world/state';
import { getDailyCommission, getDailySpecialOrder } from '@sim/social/commissions';

export interface MarketDemand {
  itemId: string;
  priceBonus: number;
  source: 'commission' | 'special-order';
  title: string;
}

function pushDemand(out: MarketDemand[], next: MarketDemand): void {
  const current = out.find(entry => entry.itemId === next.itemId);
  if (!current) {
    out.push(next);
    return;
  }
  if (next.priceBonus > current.priceBonus) {
    current.priceBonus = next.priceBonus;
    current.source = next.source;
    current.title = next.title;
  }
}

export function getMarketDemands(state: GameState): MarketDemand[] {
  const demands: MarketDemand[] = [];

  const daily = getDailyCommission(state);
  if (daily) {
    pushDemand(demands, {
      itemId: daily.request.itemId,
      priceBonus: Math.max(1, Math.ceil(daily.rewardSpiritStones / Math.max(1, daily.request.count))),
      source: 'commission',
      title: daily.title
    });
  }

  const special = getDailySpecialOrder(state);
  if (special) {
    pushDemand(demands, {
      itemId: special.request.itemId,
      priceBonus: Math.max(2, Math.ceil(special.rewardSpiritStones / Math.max(2, special.request.count * 2))),
      source: 'special-order',
      title: special.title
    });
  }

  return demands.sort((a, b) => a.itemId.localeCompare(b.itemId));
}

export function marketDemandForItem(state: GameState, itemId: string): MarketDemand | null {
  return getMarketDemands(state).find(entry => entry.itemId === itemId) ?? null;
}
