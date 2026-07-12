/**
 * 程序化像素精灵（docs/13 §1.1「程序化优先」/ §1.2）。
 *
 * 给定 AssetId + tier + 元素，**确定性**生成 32×32 灵草像素（调色板索引），
 * 替代 renderer 当前的线框色块占位——这是本项目「能用代码生成的不手绘」哲学的直接落地。
 *
 * - 确定性：同一 id 永远产出同一像素（hash(id) → mulberry32 种子），保证 sprite 跨会话稳定。
 * - 调色板约束：所有像素值 ∈ [0,15]（palette.ts），符合 §3.4 美学禁忌。
 * - 与 sim 解耦：render 侧自带 mulberry32（与 docs/10 sim PRNG 同算法但独立实例），
 *   不依赖 sim，避免渲染引入 IO/随机耦合。
 *
 * 输出 SpritePixels（纯数据），由 toRgba 转 RGBA 供 canvas/PIXI 烘焙为 Texture（调用方负责，
 *   见 docs/13 §5.4 间接引用）。本模块不 import pixi，可在 Node 测试环境运行。
 */
import { PALETTE } from './palette';

export const SPRITE_SIZE = 32;

/** 像素数据：data 为 width*height 个调色板索引，0=透明。 */
export interface SpritePixels {
  width: number;
  height: number;
  data: Uint8Array;
}

/** 元素 → 花/果配色索引（docs/14 药性 cold/hot/warm/neutral + 灵/qi）。 */
const ELEMENT_COLOR: Record<string, number> = {
  cold: 13, // 寒霜
  hot: 6, // 朱砂
  warm: 14, // 余烬
  neutral: 7, // 鎏金
  qi: 5, // 灵气青
};

export interface HerbSpriteOptions {
  /** 唯一 id（如 'herb.frostmarrow'），hash 后作 PRNG 种子。 */
  id: string;
  /** 品阶 1–9，越高叶越多、花越大、越有点缀。 */
  tier: number;
  /** 元素 cold/hot/warm/neutral/qi；未知则默认鎏金。 */
  element?: string;
}

/** mulberry32（与 docs/10 §PRNG 同算法，render 侧独立实例）。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 字符串哈希 → 32-bit 种子。 */
function hashId(id: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 确定性生成 32×32 灵草像素。结构：根/土 → 茎 → 对称叶 → 花/果 → 品阶点缀。 */
export function generateHerbSprite(options: HerbSpriteOptions): SpritePixels {
  const size = SPRITE_SIZE;
  const data = new Uint8Array(size * size);
  const rng = mulberry32(hashId(options.id));
  const tier = Math.max(1, Math.min(9, Math.floor(options.tier)));
  const elementColor = ELEMENT_COLOR[options.element ?? ''] ?? 7;

  const set = (x: number, y: number, idx: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) data[y * size + x] = idx;
  };

  const cx = size >> 1;
  const STEM = 4; // 苔青
  const LEAF = 11; // 深叶
  const SOIL = 12; // 深土

  // 根/土座（底部一抹）。
  for (let x = cx - 2; x <= cx + 2; x++) set(x, size - 2, SOIL);
  set(cx - 2, size - 3, SOIL);
  set(cx + 2, size - 3, SOIL);

  // 茎（高度随种子微变）。
  const stemTop = 8 + Math.floor(rng() * 3);
  for (let y = size - 3; y >= stemTop; y--) set(cx, y, STEM);

  // 对称叶（对数随 tier：1–4 对），越往上越短。
  const leafPairs = Math.min(4, 1 + Math.floor(tier / 2));
  const stemLen = size - 3 - stemTop;
  for (let i = 0; i < leafPairs; i++) {
    const t = (i + 1) / (leafPairs + 1);
    const y = size - 3 - Math.floor(t * stemLen);
    const len = 3 + Math.floor(rng() * 2) + (tier >= 5 ? 1 : 0);
    const dir = i % 2 === 0 ? 1 : -1;
    for (let lx = 1; lx <= len; lx++) {
      set(cx + dir * lx, y, LEAF);
      set(cx + dir * lx, y - 1, LEAF);
    }
    set(cx + dir * len, y - 1, STEM); // 叶尖高光回苔青
  }

  // 花/果（顶部圆形，元素色）。
  const bloomR = 2 + Math.floor(tier / 3);
  for (let dy = -bloomR; dy <= bloomR; dy++) {
    for (let dx = -bloomR; dx <= bloomR; dx++) {
      if (dx * dx + dy * dy <= bloomR * bloomR + 1) {
        const px = cx + dx;
        const py = stemTop - 1 + dy;
        if (py >= 0) set(px, py, elementColor);
      }
    }
  }

  // 高品阶点缀：鎏金顶点（稀有感，§鎏金=稀有）。
  if (tier >= 5) {
    set(cx, stemTop - 1 - bloomR, 7);
    set(cx - 1, stemTop - 1, 7);
    set(cx + 1, stemTop - 1, 7);
  }
  // 极品阶：雪青紫雷气息（呼应紫雷劫主题）。
  if (tier >= 7) {
    set(cx - bloomR - 1, stemTop + bloomR - 1, 9);
    set(cx + bloomR + 1, stemTop + bloomR - 1, 9);
  }
  return { width: size, height: size, data };
}

/**
 * 程序化种子图标：椭圆种子体（元素色）+ 高光 + 顶端小芽。32×32 调色板索引。
 * 与灵草图标同生成器家族，确定性（hash(id)→mulberry32），palette-perfect（无需去 AI 味）。
 * 低频资产，用纯程序化（不叠 AI 精修，省付费调用）。
 */
export interface SeedSpriteOptions {
  id: string;
  element?: string;
}

export function generateSeedSprite(options: SeedSpriteOptions): SpritePixels {
  const size = SPRITE_SIZE;
  const data = new Uint8Array(size * size);
  const rng = mulberry32(hashId(options.id));
  const elem = ELEMENT_COLOR[options.element ?? ''] ?? 7;
  const set = (x: number, y: number, idx: number) => {
    if (x >= 0 && x < size && y >= 0 && y < size) data[y * size + x] = idx;
  };
  const cx = size >> 1;
  const cy = (size >> 1) + 2;
  const w = 3 + Math.floor(rng() * 3); // 3-5
  const h = 5 + Math.floor(rng() * 3); // 5-7
  const inBody = (dx: number, dy: number) => (dx * dx) / (w * w) + (dy * dy) / (h * h) <= 1;
  // 种子体：椭圆，元素色
  for (let dy = -h; dy <= h; dy++) {
    for (let dx = -w; dx <= w; dx++) {
      if (inBody(dx, dy)) set(cx + dx, cy + dy, elem);
    }
  }
  // 斑点（per-id 随机位置，墨色）——拉大区分度，避免不同种子撞图
  const spots = 1 + Math.floor(rng() * 3); // 1-3 斑
  for (let i = 0; i < spots; i++) {
    const sx = Math.floor(rng() * (2 * w - 1)) - (w - 1);
    const sy = Math.floor(rng() * (2 * h - 1)) - (h - 1);
    if (inBody(sx, sy)) set(cx + sx, cy + sy, 2);
  }
  set(cx - 1, cy - h + 3, 10); // 月白高光
  // 顶端小芽：苔青，长度 per-id
  const sprout = 1 + Math.floor(rng() * 2);
  for (let s = 0; s <= sprout; s++) set(cx, cy - h - 1 - s, 4);
  return { width: size, height: size, data };
}

/**
 * AssetId → 精灵像素 索引（docs/13 §5.4 间接引用：render 层不直接 import 文件）。
 * 程序化精灵在启动时 register；未来手绘资产替换时，只改此处映射，不改消费方。
 */
const spriteStore = new Map<string, SpritePixels>();

export function registerSprite(id: string, pixels: SpritePixels): void {
  spriteStore.set(id, pixels);
}

export function getSprite(id: string): SpritePixels | undefined {
  return spriteStore.get(id);
}

export function clearSprites(): void {
  spriteStore.clear();
}

/** 像素 → RGBA（供 canvas putImageData / PIXI ImageDataResource 烘焙）。纯函数，可测。 */
export function toRgba(pixels: SpritePixels): Uint8ClampedArray {
  const out = new Uint8ClampedArray(pixels.width * pixels.height * 4);
  for (let i = 0; i < pixels.data.length; i++) {
    const idx = pixels.data[i] ?? 0; // noUncheckedIndexedAccess：Uint8Array 读为 number|undefined
    const entry = PALETTE[idx];
    const a = idx === 0 || !entry ? 0 : 255;
    const [r, g, b] = entry ? entry.rgb : ([0, 0, 0] as const);
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
  return out;
}
