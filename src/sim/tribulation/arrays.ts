/**
 * 阵法系统（docs/05 §8 种田即布防）。
 * 引雷阵（需金属性灵草阵眼）把覆盖圈内天雷锁向阵心；绝缘阵把雷排斥开保护核心。
 * arrayModifierFor：该格的阵法权重乘子（乘性），供 targeting 使用。
 */
import type { GameState, ArrayInstance } from '@sim/world/state';
import { tileAt, nextEntityId, emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';

/** 该格被多少阵法覆盖 → 乘性权重乘子（docs/14 §5 R4）。 */
export function arrayModifierFor(state: GameState, tileId: number): number {
  let mod = 1;
  for (const arr of state.arrays.values()) {
    if (!arr.active) continue;
    if (arr.coverageTileIds.includes(tileId)) mod *= arr.modifier;
  }
  return mod;
}

/** 覆盖该格的激活引雷阵（modifier>1）。用于天劫中"阵法代接雷"判定（docs/05 §8.1）。 */
export function coveringRodArray(state: GameState, tileId: number): ArrayInstance | undefined {
  for (const arr of state.arrays.values()) {
    if (arr.active && arr.modifier > 1 && arr.coverageTileIds.includes(tileId)) return arr;
  }
  return undefined;
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
  emit(state, 'place-array', { defId, coreTileId: core.id });
  return { placed: true };
}
