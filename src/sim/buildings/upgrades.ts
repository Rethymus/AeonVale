/**
 * 永久升级：用探索/出货得到的资源换长期能力，补上 Stardew 式建设成长出口。
 * 当前包含储物戒、农具与农庄扩建；后续空间建筑继续沿用同一套目录与解锁标记。
 */
import type { GameState } from '@sim/world/state';
import { emit, tileAt } from '@sim/world/state';
import { itemCount, mutateItem } from '@sim/world/player';
import { MILLI } from '@sim/world/types';

export interface UpgradeCost {
  itemId: string;
  count: number;
}

export interface UpgradeDef {
  id: string;
  displayName: string;
  stageMin: number;
  requiresStayedInWorld?: boolean;
  requiresUpgradeId?: string;
  costs: readonly UpgradeCost[];
  farmExpansionTier?: number;
  inventoryCapacityBonus?: number;
  toolStaminaMult?: Partial<Record<ToolActionKind, number>>;
  toolAreaBonus?: Partial<Record<ToolActionKind, number>>;
}

export interface UpgradeResult {
  ok: boolean;
  upgrade: UpgradeDef | null;
  reason?: string;
}

const FLAG_PREFIX = 'upgrade.';

export type ToolActionKind = 'till' | 'water' | 'harvest';

export const UPGRADE_CATALOG: readonly UpgradeDef[] = [
  {
    id: 'farmstead-expansion-1',
    displayName: '农庄扩建一阶',
    stageMin: 0,
    costs: [
      { itemId: 'item.spirit-stone', count: 10 },
      { itemId: 'herb.mossling', count: 3 }
    ],
    farmExpansionTier: 1
  },
  {
    id: 'farmstead-expansion-2',
    displayName: '农庄扩建二阶',
    stageMin: 2,
    costs: [
      { itemId: 'item.spirit-stone', count: 18 },
      { itemId: 'item.array-core', count: 1 },
      { itemId: 'herb.stonegrain', count: 4 }
    ],
    farmExpansionTier: 2
  },
  {
    id: 'farmstead-expansion-3',
    displayName: '农庄扩建三阶',
    stageMin: 7,
    requiresStayedInWorld: true,
    costs: [
      { itemId: 'item.spirit-stone', count: 30 },
      { itemId: 'item.array-core', count: 2 },
      { itemId: 'item.beast-core', count: 2 },
      { itemId: 'herb.mistfern', count: 4 }
    ],
    farmExpansionTier: 3
  },
  {
    id: 'farmstead-expansion-4',
    displayName: '留世辟土',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'farmstead-expansion-3',
    costs: [
      { itemId: 'item.spirit-stone', count: 50 },
      { itemId: 'item.array-core', count: 4 },
      { itemId: 'item.beast-core', count: 4 },
      { itemId: 'herb.frostmarrow', count: 4 }
    ],
    farmExpansionTier: 4
  },
  {
    id: 'farmstead-expansion-5',
    displayName: '留世广辟',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'farmstead-expansion-4',
    costs: [
      { itemId: 'item.spirit-stone', count: 80 },
      { itemId: 'item.array-core', count: 6 },
      { itemId: 'item.beast-core', count: 6 },
      { itemId: 'herb.thunderreed', count: 4 }
    ],
    farmExpansionTier: 5
  },
  {
    id: 'storage-ring-1',
    displayName: '储物戒一阶扩容',
    stageMin: 0,
    costs: [{ itemId: 'item.spirit-stone', count: 8 }],
    inventoryCapacityBonus: 8
  },
  {
    id: 'storage-ring-2',
    displayName: '储物戒二阶扩容',
    stageMin: 1,
    costs: [
      { itemId: 'item.spirit-stone', count: 16 },
      { itemId: 'item.broken-talisman', count: 1 }
    ],
    inventoryCapacityBonus: 8
  },
  {
    id: 'storage-ring-3',
    displayName: '储物戒三阶扩容',
    stageMin: 2,
    costs: [
      { itemId: 'item.spirit-stone', count: 28 },
      { itemId: 'item.recipe-fragment', count: 2 }
    ],
    inventoryCapacityBonus: 12
  },
  {
    id: 'storage-ring-4',
    displayName: '储物戒四阶扩容',
    stageMin: 4,
    requiresUpgradeId: 'storage-ring-3',
    costs: [
      { itemId: 'item.spirit-stone', count: 45 },
      { itemId: 'item.recipe-fragment', count: 3 },
      { itemId: 'item.array-core', count: 1 }
    ],
    inventoryCapacityBonus: 16
  },
  {
    id: 'storage-ring-5',
    displayName: '储物戒五阶扩容',
    stageMin: 6,
    requiresUpgradeId: 'storage-ring-4',
    costs: [
      { itemId: 'item.spirit-stone', count: 70 },
      { itemId: 'item.recipe-fragment', count: 4 },
      { itemId: 'item.array-core', count: 2 }
    ],
    inventoryCapacityBonus: 20
  },
  {
    id: 'tool-hoe-1',
    displayName: '凡铁锄加固',
    stageMin: 0,
    costs: [
      { itemId: 'item.spirit-stone', count: 6 },
      { itemId: 'item.broken-talisman', count: 1 }
    ],
    toolStaminaMult: { till: 0.75 },
    toolAreaBonus: { till: 4 }
  },
  {
    id: 'tool-pail-1',
    displayName: '灵水桶刻纹',
    stageMin: 0,
    costs: [
      { itemId: 'item.spirit-stone', count: 6 },
      { itemId: 'item.recipe-fragment', count: 1 }
    ],
    toolStaminaMult: { water: 0.75 },
    toolAreaBonus: { water: 4 }
  },
  {
    id: 'tool-sickle-1',
    displayName: '镰刀淬锋',
    stageMin: 0,
    costs: [
      { itemId: 'item.spirit-stone', count: 6 },
      { itemId: 'item.broken-talisman', count: 1 }
    ],
    toolStaminaMult: { harvest: 0.75 }
  },
  {
    id: 'tool-hoe-2',
    displayName: '凡铁锄·淬锋',
    stageMin: 4,
    requiresUpgradeId: 'tool-hoe-1',
    costs: [
      { itemId: 'item.spirit-stone', count: 20 },
      { itemId: 'item.broken-talisman', count: 2 },
      { itemId: 'item.array-core', count: 1 }
    ],
    toolStaminaMult: { till: 0.8 },
    toolAreaBonus: { till: 2 }
  },
  {
    id: 'tool-pail-2',
    displayName: '灵水桶·扩流',
    stageMin: 4,
    requiresUpgradeId: 'tool-pail-1',
    costs: [
      { itemId: 'item.spirit-stone', count: 20 },
      { itemId: 'item.recipe-fragment', count: 2 },
      { itemId: 'item.array-core', count: 1 }
    ],
    toolStaminaMult: { water: 0.8 },
    toolAreaBonus: { water: 2 }
  },
  {
    id: 'tool-sickle-2',
    displayName: '镰刀·再淬',
    stageMin: 4,
    requiresUpgradeId: 'tool-sickle-1',
    costs: [
      { itemId: 'item.spirit-stone', count: 20 },
      { itemId: 'item.broken-talisman', count: 2 },
      { itemId: 'item.array-core', count: 1 }
    ],
    toolStaminaMult: { harvest: 0.8 }
  },
  {
    id: 'tool-hoe-3',
    displayName: '凡铁锄·雷淬',
    stageMin: 6,
    requiresUpgradeId: 'tool-hoe-2',
    costs: [
      { itemId: 'item.spirit-stone', count: 38 },
      { itemId: 'item.array-core', count: 2 },
      { itemId: 'item.beast-core', count: 2 }
    ],
    toolStaminaMult: { till: 0.85 },
    toolAreaBonus: { till: 1 }
  },
  {
    id: 'tool-pail-3',
    displayName: '灵水桶·灵引',
    stageMin: 6,
    requiresUpgradeId: 'tool-pail-2',
    costs: [
      { itemId: 'item.spirit-stone', count: 38 },
      { itemId: 'item.array-core', count: 2 },
      { itemId: 'item.beast-core', count: 2 }
    ],
    toolStaminaMult: { water: 0.85 },
    toolAreaBonus: { water: 1 }
  },
  {
    id: 'tool-sickle-3',
    displayName: '镰刀·雷淬',
    stageMin: 6,
    requiresUpgradeId: 'tool-sickle-2',
    costs: [
      { itemId: 'item.spirit-stone', count: 38 },
      { itemId: 'item.array-core', count: 2 },
      { itemId: 'item.beast-core', count: 2 }
    ],
    toolStaminaMult: { harvest: 0.85 }
  },
  {
    id: 'farm-autoload-1',
    displayName: '巡守兽搬运与仓流联动',
    stageMin: 1,
    costs: [
      { itemId: 'item.spirit-stone', count: 14 },
      { itemId: 'item.array-core', count: 1 },
      { itemId: 'item.beast-core', count: 1 }
    ]
  },
  {
    id: 'greenhouse-nursery-1',
    displayName: '暖棚苗床扩建',
    stageMin: 7,
    requiresStayedInWorld: true,
    costs: [
      { itemId: 'item.spirit-stone', count: 18 },
      { itemId: 'item.array-core', count: 1 },
      { itemId: 'item.recipe-fragment', count: 1 },
      { itemId: 'herb.dewroot', count: 3 }
    ]
  },
  {
    id: 'greenhouse-nursery-2',
    displayName: '暖棚温渠加固',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'greenhouse-nursery-1',
    costs: [
      { itemId: 'item.spirit-stone', count: 26 },
      { itemId: 'item.array-core', count: 2 },
      { itemId: 'item.recipe-fragment', count: 2 },
      { itemId: 'herb.mistfern', count: 4 }
    ]
  },
  {
    id: 'greenhouse-nursery-3',
    displayName: '暖棚地脉稳养',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'greenhouse-nursery-2',
    costs: [
      { itemId: 'item.spirit-stone', count: 36 },
      { itemId: 'item.array-core', count: 3 },
      { itemId: 'item.recipe-fragment', count: 3 },
      { itemId: 'herb.frostmarrow', count: 2 },
      { itemId: 'herb.sunmoss', count: 4 }
    ]
  },
  {
    id: 'storage-satchel-stayed',
    displayName: '留世锦囊',
    stageMin: 1,
    requiresStayedInWorld: true,
    costs: [
      { itemId: 'item.spirit-stone', count: 20 },
      { itemId: 'item.spirit-compost', count: 2 },
      { itemId: 'item.sealed-herb', count: 1 }
    ],
    inventoryCapacityBonus: 12
  },
  {
    id: 'tool-area-stayed',
    displayName: '留世大开田',
    stageMin: 7,
    requiresStayedInWorld: true,
    costs: [
      { itemId: 'item.spirit-stone', count: 24 },
      { itemId: 'item.sealed-herb', count: 2 },
      { itemId: 'item.spirit-compost', count: 2 }
    ],
    toolAreaBonus: { water: 1, harvest: 1 }
  },
  {
    id: 'tool-stamina-stayed',
    displayName: '留世省力',
    stageMin: 7,
    requiresStayedInWorld: true,
    costs: [
      { itemId: 'item.spirit-stone', count: 22 },
      { itemId: 'item.herbal-wine', count: 2 },
      { itemId: 'item.spirit-compost', count: 2 }
    ],
    toolStaminaMult: { water: 0.85, harvest: 0.85 }
  },
  {
    id: 'storage-satchel-stayed-2',
    displayName: '留世锦囊·扩',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'storage-satchel-stayed',
    costs: [
      { itemId: 'item.spirit-stone', count: 40 },
      { itemId: 'item.sealed-herb', count: 3 },
      { itemId: 'item.herbal-wine', count: 2 }
    ],
    inventoryCapacityBonus: 16
  },
  {
    id: 'tool-area-stayed-2',
    displayName: '留世大开田·扩',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'tool-area-stayed',
    costs: [
      { itemId: 'item.spirit-stone', count: 40 },
      { itemId: 'item.sealed-herb', count: 3 },
      { itemId: 'item.array-core', count: 2 }
    ],
    toolAreaBonus: { water: 1, harvest: 1 }
  },
  {
    id: 'tool-stamina-stayed-2',
    displayName: '留世省力·深',
    stageMin: 7,
    requiresStayedInWorld: true,
    requiresUpgradeId: 'tool-stamina-stayed',
    costs: [
      { itemId: 'item.spirit-stone', count: 38 },
      { itemId: 'item.herbal-wine', count: 3 },
      { itemId: 'item.spirit-poultice', count: 1 }
    ],
    toolStaminaMult: { water: 0.85, harvest: 0.85 }
  }
];

export function upgradeFlag(upgradeId: string): string {
  return FLAG_PREFIX + upgradeId;
}

export function hasUpgrade(state: GameState, upgradeId: string): boolean {
  return state.flags.has(upgradeFlag(upgradeId));
}

export function getAvailableUpgrades(state: GameState): UpgradeDef[] {
  return UPGRADE_CATALOG.filter(u => {
    if (state.player.stage < u.stageMin) return false;
    if (u.requiresStayedInWorld && state.postAscension.mode !== 'stayed-in-world') return false;
    if (u.requiresUpgradeId && !hasUpgrade(state, u.requiresUpgradeId)) return false;
    return !hasUpgrade(state, u.id);
  });
}

export function farmExpansionTier(state: GameState): number {
  return UPGRADE_CATALOG.reduce((tier, upgrade) => {
    return upgrade.farmExpansionTier && hasUpgrade(state, upgrade.id) ? Math.max(tier, upgrade.farmExpansionTier) : tier;
  }, 0);
}

function applyFarmExpansion(state: GameState, tier: number): number {
  if (tier <= 0) return 0;
  const centerX = Math.floor(state.width / 2);
  const centerY = Math.floor(state.height / 2);
  const radius = tier + 1;
  let unlocked = 0;
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      const tile = tileAt(state, x, y);
      if (!tile) continue;
      if (tile.blockType === 'building' || tile.arrayId != null || tile.cropId != null) continue;
      const changed = tile.blockType !== 'none' || tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore';
      tile.blockType = 'none';
      tile.soilType = 'loam';
      tile.fertility = Math.max(tile.fertility, 40 * MILLI);
      tile.moisture = Math.max(tile.moisture, 30 * MILLI);
      tile.qiDensity = Math.max(tile.qiDensity, 30 * MILLI);
      if (changed) unlocked += 1;
    }
  }
  return unlocked;
}

export function toolStaminaMultiplier(state: GameState, action: ToolActionKind): number {
  return UPGRADE_CATALOG.reduce((mult, upgrade) => {
    const next = upgrade.toolStaminaMult?.[action];
    return next && hasUpgrade(state, upgrade.id) ? mult * next : mult;
  }, 1);
}

export function toolAreaSize(state: GameState, action: ToolActionKind): number {
  return UPGRADE_CATALOG.reduce((area, upgrade) => {
    const next = upgrade.toolAreaBonus?.[action];
    return next && hasUpgrade(state, upgrade.id) ? area + next : area;
  }, 1);
}

export function performUpgrade(state: GameState, upgradeId: string): UpgradeResult {
  const upgrade = UPGRADE_CATALOG.find(entry => entry.id === upgradeId) ?? null;
  if (!upgrade) return { ok: false, upgrade: null, reason: '无此升级' };
  if (hasUpgrade(state, upgrade.id)) return { ok: false, upgrade, reason: '已完成升级' };
  if (state.player.stage < upgrade.stageMin) return { ok: false, upgrade, reason: '阶段不足' };
  if (upgrade.requiresStayedInWorld && state.postAscension.mode !== 'stayed-in-world') {
    return { ok: false, upgrade, reason: '需留世后方可扩建' };
  }
  if (upgrade.requiresUpgradeId && !hasUpgrade(state, upgrade.requiresUpgradeId)) {
    return { ok: false, upgrade, reason: '需先完成前置扩建' };
  }

  for (const cost of upgrade.costs) {
    if (itemCount(state.player, cost.itemId) < cost.count) return { ok: false, upgrade, reason: '材料不足' };
  }

  for (const cost of upgrade.costs) mutateItem(state.player, cost.itemId, -cost.count);
  const unlockedTiles = upgrade.farmExpansionTier ? applyFarmExpansion(state, upgrade.farmExpansionTier) : 0;
  if (upgrade.inventoryCapacityBonus) state.player.inventoryCapacity += upgrade.inventoryCapacityBonus;
  state.flags.add(upgradeFlag(upgrade.id));
  emit(state, 'upgrade', {
    upgradeId: upgrade.id,
    costs: upgrade.costs,
    inventoryCapacity: state.player.inventoryCapacity,
    farmExpansionTier: upgrade.farmExpansionTier ?? 0,
    unlockedTiles
  });
  return { ok: true, upgrade };
}
