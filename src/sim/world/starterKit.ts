import type { BalanceParams } from '@sim/params';
import type { GameState } from './state';
import { mutateItem } from './player';

const MVP_STARTER_SEEDS: ReadonlyArray<readonly [itemId: string, count: number]> = [
  ['seed.mossling', 6],
  ['seed.dewroot', 3]
];

const MVP_STARTER_HERBS: ReadonlyArray<readonly [itemId: string, count: number]> = [
  ['herb.mossling', 3],
  ['herb.dewroot', 2]
];

const MVP_STARTER_RESOURCES: ReadonlyArray<readonly [itemId: string, count: number]> = [['item.spirit-stone', 2]];

type ToolStarterDef = {
  itemId: 'item.rust-hoe' | 'item.sickle' | 'item.water-pail';
  durability: number;
};

function grantTool(state: GameState, tool: ToolStarterDef): void {
  mutateItem(state.player, tool.itemId, 1);
  state.player.inventory[tool.itemId]!.durability = tool.durability;
}

export function applyMvpStarterKit(state: GameState, params: BalanceParams): void {
  for (const [itemId, count] of MVP_STARTER_SEEDS) mutateItem(state.player, itemId, count);
  for (const [itemId, count] of MVP_STARTER_HERBS) mutateItem(state.player, itemId, count);
  for (const [itemId, count] of MVP_STARTER_RESOURCES) mutateItem(state.player, itemId, count);

  grantTool(state, { itemId: 'item.rust-hoe', durability: params.tools.hoeDurability });
  grantTool(state, { itemId: 'item.sickle', durability: params.tools.sickleDurability });
  grantTool(state, { itemId: 'item.water-pail', durability: params.tools.pailDurability });
}
