/**
 * 角色/NPC 在世界层的「在场感」辅助（纯 render，零 sim）。
 * T2：朝向可读、脚底阴影、高灵气地块轻量灵气微粒。
 * T5：玩家可读色相（暖袍/肤色条带），避免纯黑剪影。
 */

export type Facing4 = 'up' | 'down' | 'left' | 'right';

/** left 镜像 scale.x = -1，其余 1。 */
export function facingScaleX(facing: Facing4): number {
  return facing === 'left' ? -1 : 1;
}

/** 朝向指示相对角色中心的像素偏移（与 TILE≈42 对齐）。 */
export function facingIndicatorOffset(facing: Facing4, distance = 12): { x: number; y: number } {
  switch (facing) {
    case 'left':
      return { x: -distance, y: 0 };
    case 'right':
      return { x: distance, y: 0 };
    case 'up':
      return { x: 0, y: -distance };
    case 'down':
      return { x: 0, y: distance };
  }
}

export interface FootShadowSpec {
  readonly width: number;
  readonly height: number;
  readonly alpha: number;
  readonly yOffset: number;
}

export function footShadowSpec(kind: 'player' | 'npc' = 'player'): FootShadowSpec {
  if (kind === 'npc') {
    return { width: 18, height: 6, alpha: 0.28, yOffset: 14 };
  }
  return { width: 22, height: 7, alpha: 0.34, yOffset: 15 };
}

/** 灵气微粒相位 0..1；ambient 驱动。 */
export function qiSparklePhase(ambientTimeMs: number, salt: number): number {
  const t = Number.isFinite(ambientTimeMs) ? ambientTimeMs : 0;
  const u = (t / 1800 + salt * 0.17) % 1;
  return u < 0 ? u + 1 : u;
}

/**
 * 高灵气地块是否绘制微粒（与 tileVisuals.qiGlowAlpha 同源阈值）。
 * qiDensity 为毫点。
 */
export function shouldDrawQiSparkles(qiDensityMilli: number, tilled: boolean): boolean {
  if (!tilled) return false;
  return qiDensityMilli >= 40_000;
}

// —— V1-T5：玩家可读色相（ISSUE-001 纯黑剪影）——

/**
 * 玩家精灵可读暖色 tint（乘在纹理上）。
 * 纹理若为纯黑则 tint 无效，需配合 spriteAlpha + underlay 条带。
 */
export function ensureReadablePlayerTint(): number {
  // 暖宣纸/肤色提亮，避免 0xffffff 冷白与 0x000000 纯黑
  return 0xffd2b0;
}

export type PresenceBandKind = 'robe' | 'head' | 'sash' | 'highlight';

export interface PresenceBand {
  readonly kind: PresenceBandKind;
  /** 0xRRGGBB */
  readonly color: number;
  readonly alpha: number;
  /** 相对角色中心的椭圆偏移 */
  readonly ox: number;
  readonly oy: number;
  readonly rx: number;
  readonly ry: number;
  /** under = 精灵下层暖底；over = 精灵上层半透明染色 */
  readonly layer: 'under' | 'over';
}

export interface PlayerPresenceOverlay {
  /** 精灵 multiply tint */
  readonly tint: number;
  /**
   * 纹理精灵透明度；<1 让下层服色透出。
   * 纯黑剪影贴图无法靠 tint 变色，必须降 alpha + underlay。
   */
  readonly spriteAlpha: number;
  readonly bands: readonly PresenceBand[];
}

function facingShift(facing: Facing4): { x: number; y: number } {
  switch (facing) {
    case 'left':
      return { x: -1.5, y: 0 };
    case 'right':
      return { x: 1.5, y: 0 };
    case 'up':
      return { x: 0, y: -1 };
    case 'down':
      return { x: 0, y: 1 };
  }
}

/**
 * 玩家在场色带：袍身朱砂/余烬、头肤暖色、鎏金腰带与高光。
 * facing 轻微偏移条带，强化朝向可读性。
 */
export function playerPresenceOverlay(facing: Facing4): PlayerPresenceOverlay {
  const shift = facingShift(facing);

  return {
    tint: ensureReadablePlayerTint(),
    spriteAlpha: 0.58,
    bands: [
      // 下层：暖底，透过半透明剪影读出服色分区
      {
        kind: 'robe',
        color: 0xc46a3a,
        alpha: 0.94,
        ox: shift.x * 0.4,
        oy: 6 + shift.y * 0.3,
        rx: 10,
        ry: 12,
        layer: 'under'
      },
      {
        kind: 'head',
        color: 0xe8c4a0,
        alpha: 0.96,
        ox: shift.x * 0.5,
        oy: -5 + shift.y * 0.4,
        rx: 7.5,
        ry: 7.5,
        layer: 'under'
      },
      // 上层：半透明朱砂/肤色/鎏金，强化分区与仙侠暖调
      {
        kind: 'robe',
        color: 0xb5482f,
        alpha: 0.36,
        ox: shift.x * 0.5,
        oy: 6,
        rx: 8.5,
        ry: 10,
        layer: 'over'
      },
      {
        kind: 'head',
        color: 0xf0d0b0,
        alpha: 0.32,
        ox: shift.x * 0.6,
        oy: -5,
        rx: 6.5,
        ry: 6.5,
        layer: 'over'
      },
      {
        kind: 'sash',
        color: 0xc9a14a,
        alpha: 0.4,
        ox: 0,
        oy: 9,
        rx: 7.5,
        ry: 2.5,
        layer: 'over'
      },
      {
        kind: 'highlight',
        color: 0xffe8c8,
        alpha: 0.28,
        ox: shift.x * 1.2 - 2,
        oy: -6,
        rx: 2.5,
        ry: 2.2,
        layer: 'over'
      }
    ]
  };
}
