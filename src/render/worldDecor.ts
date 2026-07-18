/**
 * 世界地块「场所感」装饰（纯 render，零 sim）。
 * V1-T3 / ISSUE-001：路径石、草丛、卵石、远雾带、篱笆桩 ——
 * 稀疏、确定性、不挡中心作业区；不引入 PNG，只走 Graphics。
 */

import type { Graphics } from 'pixi.js';

/** 装饰种类。 */
export type WorldDecorKind = 'path-stone' | 'grass-tuft' | 'pebble' | 'mist-band' | 'fence-post';

/** 放置算法只读的瓦片视图（不绑死完整 Tile 结构，便于单测）。 */
export interface WorldDecorTileView {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly soilType: string;
  readonly tilled: boolean;
  readonly cropId: number | null;
  readonly blockType: string;
}

export interface WorldDecorPlacement {
  readonly kind: WorldDecorKind;
  readonly x: number;
  readonly y: number;
  /** 子格偏移 0..1（相对瓦片左上）。 */
  readonly ox: number;
  readonly oy: number;
  /** 形状变体 0..3。 */
  readonly variant: number;
}

export interface WorldDecorPlacementOptions {
  /** 场上已有设施时才铺篱笆桩（农庄边感）。 */
  readonly hasFacilities?: boolean;
}

/** 不可落装饰的土壤。 */
const BLOCKED_SOILS = new Set(['water', 'rock', 'metal-ore']);

/** 可落草/石的「草甸式」土壤。 */
const GRASS_LIKE_SOILS = new Set(['loam', 'wet-loam', 'spirit-loam', 'dry-sand', 'scorched', 'insulated']);

/** 密度上界：相对全图瓦片数（含不可用地），保证稀疏。 */
export const WORLD_DECOR_MAX_DENSITY = 0.28;

/** 绝对件数上界（防止超大图爆炸）。 */
export const WORLD_DECOR_HARD_CAP = 48;

/**
 * 确定性种子。
 * - `worldDecorSeed(tileId)`：仅一参
 * - `worldDecorSeed(x, y)`：坐标
 */
export function worldDecorSeed(a: number, b?: number): number {
  let n: number;
  if (b === undefined) {
    n = a | 0;
  } else {
    // 混入坐标，避免与 tileId 路径撞车
    n = ((a | 0) * 73856093) ^ ((b | 0) * 19349663);
  }
  // 32-bit avalanche（无 IO / 无 Math.random）
  let h = n >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function unit01(seed: number, lane = 0): number {
  const h = worldDecorSeed(seed ^ (lane * 0x9e3779b9));
  return (h % 10_000) / 10_000;
}

function isCenterCritical(x: number, y: number, width: number, height: number): boolean {
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  // 与 createWorld 中心 3×3 凡人居所对齐，外扩 1 环留给路径/角色活动
  return Math.abs(x - cx) <= 2 && Math.abs(y - cy) <= 2;
}

function isDecorEligible(tile: WorldDecorTileView, width: number, height: number): boolean {
  if (tile.blockType !== 'none') return false;
  if (tile.tilled) return false;
  if (tile.cropId != null) return false;
  if (BLOCKED_SOILS.has(tile.soilType)) return false;
  if (!GRASS_LIKE_SOILS.has(tile.soilType)) return false;
  if (isCenterCritical(tile.x, tile.y, width, height)) return false;
  return true;
}

function isSoftPathTile(x: number, y: number, width: number, height: number): boolean {
  // 软对角线：从左下农庄边到右上林缘，带宽 1
  const diag = x - y;
  const target = Math.floor(width / 2) - Math.floor(height / 2) - 1;
  if (Math.abs(diag - target) <= 0) return true;
  // 底边 / 左边一条「田间小径」
  if (y === height - 1 && x % 2 === 0) return true;
  if (x === 0 && y % 2 === 1) return true;
  return false;
}

function isFarMistRow(y: number, height: number): boolean {
  // 远景 = 上方（与 drawWorldBackdrop 远山同侧）
  return y <= Math.min(1, height - 1);
}

function isFarmsteadEdge(x: number, y: number, width: number, height: number): boolean {
  // 农庄边缘：外圈与中心外环之间的带
  const onRim = x === 0 || y === 0 || x === width - 1 || y === height - 1;
  if (onRim) return true;
  // 次外圈稀疏立桩
  const nearRim = x === 1 || y === 1 || x === width - 2 || y === height - 2;
  return nearRim && (x + y) % 3 === 0;
}

/**
 * 计算全图装饰落点。确定性：同宽高 + 同瓦片态 ⇒ 同结果。
 */
export function worldDecorPlacements(
  stateWidth: number,
  stateHeight: number,
  tiles: readonly WorldDecorTileView[],
  options: WorldDecorPlacementOptions = {}
): WorldDecorPlacement[] {
  if (stateWidth <= 0 || stateHeight <= 0 || tiles.length === 0) return [];

  const hasFacilities = options.hasFacilities === true;
  const out: WorldDecorPlacement[] = [];
  const occupied = new Set<number>(); // tileId 已占，避免同格叠多种

  const tryPush = (p: WorldDecorPlacement, tileId: number): void => {
    if (out.length >= WORLD_DECOR_HARD_CAP) return;
    if (occupied.has(tileId)) return;
    occupied.add(tileId);
    out.push(p);
  };

  // 第一遍：结构化装饰（路径 / 雾 / 篱笆）优先，保证场所骨架稳定
  for (const tile of tiles) {
    if (!isDecorEligible(tile, stateWidth, stateHeight)) continue;
    const seed = worldDecorSeed(tile.x, tile.y);
    const ox = 0.22 + unit01(seed, 1) * 0.56;
    const oy = 0.22 + unit01(seed, 2) * 0.56;
    const variant = seed % 4;

    if (isFarMistRow(tile.y, stateHeight) && unit01(seed, 3) < 0.55) {
      tryPush({ kind: 'mist-band', x: tile.x, y: tile.y, ox: 0.5, oy: 0.35 + unit01(seed, 4) * 0.3, variant }, tile.id);
      continue;
    }

    if (isSoftPathTile(tile.x, tile.y, stateWidth, stateHeight) && unit01(seed, 5) < 0.72) {
      tryPush({ kind: 'path-stone', x: tile.x, y: tile.y, ox, oy, variant }, tile.id);
      continue;
    }

    if (hasFacilities && isFarmsteadEdge(tile.x, tile.y, stateWidth, stateHeight) && unit01(seed, 6) < 0.4) {
      tryPush({ kind: 'fence-post', x: tile.x, y: tile.y, ox: 0.5, oy: 0.72, variant }, tile.id);
      continue;
    }
  }

  // 第二遍：散点草丛 / 卵石填空白
  for (const tile of tiles) {
    if (out.length >= WORLD_DECOR_HARD_CAP) break;
    if (!isDecorEligible(tile, stateWidth, stateHeight)) continue;
    if (occupied.has(tile.id)) continue;

    const seed = worldDecorSeed(tile.x, tile.y);
    const roll = unit01(seed, 7);
    // 稀疏：约 1/5 合格格再掷一次
    if (roll >= 0.22) continue;

    const ox = 0.2 + unit01(seed, 8) * 0.6;
    const oy = 0.25 + unit01(seed, 9) * 0.55;
    const variant = seed % 4;
    const kind: WorldDecorKind = unit01(seed, 10) < 0.55 ? 'grass-tuft' : 'pebble';
    tryPush({ kind, x: tile.x, y: tile.y, ox, oy, variant }, tile.id);
  }

  // 密度钳制（按全图瓦片数）
  const maxAllowed = Math.max(1, Math.floor(stateWidth * stateHeight * WORLD_DECOR_MAX_DENSITY));
  if (out.length > maxAllowed) {
    // 稳定截断：按 (y,x,kind) 排序后取前 maxAllowed，保持确定性
    out.sort((a, b) => a.y - b.y || a.x - b.x || a.kind.localeCompare(b.kind));
    return out.slice(0, maxAllowed);
  }

  // 稳定输出顺序
  out.sort((a, b) => a.y - b.y || a.x - b.x || a.kind.localeCompare(b.kind));
  return out;
}

/** 调色板色（hex 数值，对齐 palette.ts 1–15）。 */
const C = {
  mountain: 0x5c6b73,
  moss: 0x7a8c5a,
  leafdark: 0x3a6a28,
  loess: 0xa88b5c,
  soil: 0x6b4f2a,
  frost: 0x9fb6c4,
  moonwhite: 0xe8e8e0,
  ink: 0x1a1a1f,
  paper: 0xf4ecd8
} as const;

/**
 * 在给定瓦片像素原点绘制单件装饰（低 alpha，叠在地砖之上、实体之下）。
 *
 * `tMs` 为渲染时钟（毫秒），>0 时启用常驻微动（草摆 / 雾飘），让世界「会呼吸」；
 * 每件装饰的相位由其坐标确定性派生（无 RNG），故同一帧同位置仍可复现。纯 render 层，不影响 sim。
 */
export function paintWorldDecor(g: Graphics, placement: WorldDecorPlacement, tileOriginX: number, tileOriginY: number, tileSize: number, tMs = 0): void {
  const px = tileOriginX + placement.ox * tileSize;
  const py = tileOriginY + placement.oy * tileSize;
  const s = tileSize;
  const phase = tMs > 0 ? ((worldDecorSeed(placement.x, placement.y) % 1000) / 1000) * Math.PI * 2 : 0;

  switch (placement.kind) {
    case 'path-stone': {
      // 略提亮的小石板，增强路径对比
      const w = 5 + (placement.variant % 3);
      const h = 3 + (placement.variant % 2);
      g.roundRect(px - w / 2, py - h / 2, w, h, 1.2).fill({ color: C.loess, alpha: 0.55 });
      g.roundRect(px - w / 2 + 0.5, py - h / 2 + 0.4, w - 1, h - 1, 1).fill({ color: C.paper, alpha: 0.18 });
      g.roundRect(px - w / 2, py - h / 2, w, h, 1.2).stroke({ width: 0.8, color: C.soil, alpha: 0.35 });
      break;
    }
    case 'grass-tuft': {
      // 常驻微动：整簇随时间错相轻摆（位置确定性相位，无 RNG）
      const sway = tMs > 0 ? Math.sin(tMs * 0.003 + phase) * 1.8 : 0;
      const lean = (placement.variant % 2 === 0 ? -1.2 : 1.2) + sway;
      g.moveTo(px, py)
        .lineTo(px + lean, py - 5 - (placement.variant % 3))
        .stroke({ width: 1.2, color: C.leafdark, alpha: 0.42 });
      g.moveTo(px - 2, py)
        .lineTo(px - 2 + lean * 0.6, py - 3.5)
        .stroke({ width: 1.0, color: C.moss, alpha: 0.38 });
      g.moveTo(px + 2, py)
        .lineTo(px + 2 + lean * 0.5, py - 3.2)
        .stroke({ width: 1.0, color: C.moss, alpha: 0.34 });
      break;
    }
    case 'pebble': {
      const r = 1.4 + (placement.variant % 3) * 0.35;
      g.circle(px, py, r).fill({ color: C.mountain, alpha: 0.4 });
      g.circle(px - 0.4, py - 0.3, r * 0.45).fill({ color: C.moonwhite, alpha: 0.18 });
      break;
    }
    case 'mist-band': {
      // 远景雾带：横向柔条，随时间缓慢飘移（位置确定性相位）
      const bw = s * 0.85;
      const bh = 3 + (placement.variant % 2);
      const drift = tMs > 0 ? Math.sin(tMs * 0.0008 + phase) * 4 : 0;
      g.ellipse(tileOriginX + s / 2 + drift, py, bw / 2, bh).fill({ color: C.frost, alpha: 0.14 });
      g.ellipse(tileOriginX + s / 2 + 4 + drift, py + 2, bw / 2.4, bh * 0.7).fill({ color: C.moonwhite, alpha: 0.08 });
      break;
    }
    case 'fence-post': {
      g.rect(px - 1.2, py - 10, 2.4, 11).fill({ color: C.soil, alpha: 0.55 });
      g.rect(px - 1.2, py - 10, 2.4, 2).fill({ color: C.loess, alpha: 0.45 });
      // 横杆暗示（短）
      if (placement.variant % 2 === 0) {
        g.rect(px + 1.2, py - 7, 6, 1.2).fill({ color: C.soil, alpha: 0.35 });
      } else {
        g.rect(px - 7.2, py - 6, 6, 1.2).fill({ color: C.soil, alpha: 0.35 });
      }
      break;
    }
  }
}
