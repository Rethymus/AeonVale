/**
 * 世界层程序化地点感装饰（纯 render，零 sim）。
 * V1-T3：路径石 / 杂草 / 小石 / 远雾 / 栅栏柱 — 缓解空网格观感。
 */

export type WorldDecorKind = 'path-stone' | 'grass-tuft' | 'pebble' | 'mist-band' | 'fence-post';

export interface WorldDecorPlacement {
  readonly kind: WorldDecorKind;
  readonly x: number;
  readonly y: number;
  /** 0..1 用于 alpha / 偏移抖动 */
  readonly salt: number;
}

export interface WorldDecorTileLike {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly soilType: string;
  readonly tilled: boolean;
  readonly cropId: number | null;
  readonly blockType: string;
}

/** 确定性 0..1 噪声（Mulberry32 风格，仅 render）。 */
export function worldDecorUnit(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function worldDecorSeed(x: number, y: number, salt = 0): number {
  return (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
}

function isDecoratable(tile: WorldDecorTileLike): boolean {
  if (tile.tilled || tile.cropId != null) return false;
  if (tile.blockType !== 'none') return false;
  if (tile.soilType === 'water' || tile.soilType === 'rock' || tile.soilType === 'metal-ore') return false;
  return true;
}

/**
 * 稀疏装饰：密度有界，同 seed 字节级可复现。
 * 远雾仅贴 y 最小的两行；路径石沿弱对角线；栅栏柱贴农场外缘。
 */
export function worldDecorPlacements(
  width: number,
  height: number,
  tiles: readonly WorldDecorTileLike[],
  options: { readonly maxDensity?: number } = {}
): readonly WorldDecorPlacement[] {
  const maxDensity = options.maxDensity ?? 0.22;
  const out: WorldDecorPlacement[] = [];
  if (width <= 0 || height <= 0 || tiles.length === 0) return out;

  const byCoord = new Map<string, WorldDecorTileLike>();
  for (const t of tiles) byCoord.set(`${t.x},${t.y}`, t);

  for (const t of tiles) {
    if (!isDecoratable(t)) continue;
    const u = worldDecorUnit(worldDecorSeed(t.x, t.y, 1));
    if (u > maxDensity) continue;

    // 路径石：沿 y≈x 或 y≈x+2 的弱带
    const onPath = Math.abs(t.y - t.x) <= 1 || Math.abs(t.y - t.x - 2) === 0;
    if (onPath && u < 0.12) {
      out.push({ kind: 'path-stone', x: t.x, y: t.y, salt: u });
      continue;
    }

    // 远雾：顶两行
    if (t.y <= 1 && u < 0.18) {
      out.push({ kind: 'mist-band', x: t.x, y: t.y, salt: u });
      continue;
    }

    // 栅栏柱：贴边
    if ((t.x === 0 || t.y === 0 || t.x === width - 1 || t.y === height - 1) && u < 0.1) {
      out.push({ kind: 'fence-post', x: t.x, y: t.y, salt: u });
      continue;
    }

    if (u < 0.08) {
      out.push({ kind: 'pebble', x: t.x, y: t.y, salt: u });
    } else if (u < 0.16) {
      out.push({ kind: 'grass-tuft', x: t.x, y: t.y, salt: u });
    }
  }

  // 密度硬上限：防止超大图刷满
  const hardCap = Math.max(8, Math.floor(width * height * maxDensity));
  if (out.length > hardCap) return out.slice(0, hardCap);
  return out;
}

export function worldDecorDensity(placements: readonly WorldDecorPlacement[], tileCount: number): number {
  if (tileCount <= 0) return 0;
  return placements.length / tileCount;
}
