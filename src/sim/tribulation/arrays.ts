/**
  * 阵法系统。
  * 引雷阵（需金属性灵草阵眼）把覆盖圈内天雷锁向阵心；绝缘阵把雷排斥开保护核心。
  * arrayModifierFor：该格的阵法权重乘子（乘性），供 targeting 使用。
 */
import type { GameState, ArrayInstance } from '@sim/world/state';
import { tileAt, nextEntityId, emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { itemCount, mutateItem } from '@sim/world/player';

export interface ArrayCost {
 itemId: string;
 count: number;
}

export interface PlaceArrayOptions {
 free?: boolean;
}

export const ARRAY_BUILD_COSTS: Record<string, readonly ArrayCost[]> = {
 'array.lightning-rod': [
 { itemId: 'item.array-core', count: 1 },
 { itemId: 'item.spirit-stone', count: 4 },
 ],
 'array.insulation': [
 { itemId: 'item.array-core', count: 1 },
 { itemId: 'item.spirit-stone', count: 2 },
 ],
};

export function activeArraysCoveringTile(state: GameState, tileId: number): ArrayInstance[] {
 const covering: ArrayInstance[] = [];
 for (const arr of state.arrays.values()) {
 if (!arr.active) continue;
 if (arr.coverageTileIds.includes(tileId)) covering.push(arr);
 }
 return covering;
}

export function hasActiveArrayCoverage(state: GameState, tileId: number, defId: string): boolean {
 return activeArraysCoveringTile(state, tileId).some((arr) => arr.defId === defId);
}

export function activeArrayCount(state: GameState, defId: string): number {
 let count = 0;
 for (const arr of state.arrays.values()) {
 if (!arr.active) continue;
 if (arr.defId === defId) count += 1;
 }
 return count;
}

export function insulationClimateControlBonus(state: GameState): {
	careGainBonus: number;
	neglectBuffer: number;
} {
 const insulationCount = activeArrayCount(state, 'array.insulation');
 if (insulationCount >= 2) {
 return { careGainBonus: 2, neglectBuffer: 2 };
 }
 if (insulationCount >= 1) {
 return { careGainBonus: 1, neglectBuffer: 1 };
 }
 return { careGainBonus: 0, neglectBuffer: 0 };
}

/** 该格被多少阵法覆盖 → 乘性权重乘子。 */
export function arrayModifierFor(state: GameState, tileId: number): number {
 let mod = 1;
 for (const arr of activeArraysCoveringTile(state, tileId)) {
 mod *= arr.modifier;
 }
 return mod;
}

/** 覆盖该格的激活引雷阵（modifier>1）。用于天劫中"阵法代接雷"判定。 */
export function coveringRodArray(state: GameState, tileId: number): ArrayInstance | undefined {
 return activeArraysCoveringTile(state, tileId).find((arr) => arr.modifier > 1);
}

export interface PlaceResult {
 placed: boolean;
 reason?: string;
}

/** 在 (coreX,coreY) 放置阵法。引雷阵需金属性灵草作阵眼。 */
export function placeArray(
 state: GameState,
 defId: string,
 coreX: number,
 coreY: number,
 ctx: SimContext,
 options: PlaceArrayOptions = {},
): PlaceResult {
 const def = ctx.content.arrays.get(defId);
 if (!def) return { placed: false, reason: '无此阵法' };
 const core = tileAt(state, coreX, coreY);
 if (!core || core.blockType !== 'none') return { placed: false, reason: '不可放置' };
 if (def.needsMetalCore) {
 const crop = core.cropId != null ? state.crops.get(core.id) : undefined;
 const herb = crop ? ctx.content.herbs.get(crop.defId) : undefined;
 if (!herb || herb.metalAttract <= 0) return { placed: false, reason: '引雷阵需金属性灵草作阵眼' };
 }
 const costs = ARRAY_BUILD_COSTS[defId] ?? [];
 if (!options.free) {
 for (const cost of costs) {
 if (itemCount(state.player, cost.itemId) < cost.count) return { placed: false, reason: '阵法材料不足' };
 }
 for (const cost of costs) mutateItem(state.player, cost.itemId, -cost.count);
 }
 const coverage: number[] = [];
 for (let dy = -def.radius; dy <= def.radius; dy++) {
 for (let dx = -def.radius; dx <= def.radius; dx++) {
 const t = tileAt(state, coreX + dx, coreY + dy);
 if (t && t.blockType === 'none') coverage.push(t.id);
 }
 }
 const id = nextEntityId(state);
 const inst: ArrayInstance = {
 id,
 defId,
 modifier: def.modifier,
 coreTileId: core.id,
 coverageTileIds: coverage,
 power: 100,
 active: true,
 };
 state.arrays.set(id, inst);
 emit(state, 'place-array', { defId, coreTileId: core.id, costs: options.free ? [] : costs });
 return { placed: true };
}
