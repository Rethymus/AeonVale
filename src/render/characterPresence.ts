/**
 * 角色/NPC 在世界层的「在场感」辅助（纯 render，零 sim）。
 * T2：朝向可读、脚底阴影、高灵气地块轻量灵气微粒。
 * T5：玩家可读色相（暖袍/肤色条带），避免纯黑剪影。
 */

import { ColorPalette } from './ColorPalette';

export type Facing4 = 'up' | 'down' | 'left' | 'right';

export const PLAYER_WORLD_MAP_SPRITE_ID = 'map-sprite.player-v1' as const;

const NPC_WORLD_MAP_SPRITE_ID_BY_ASSET_ID: Readonly<Record<string, string>> = {
  'sprite.npc.wandering-cultivator': 'map-sprite.liaochen-v1',
  'sprite.npc.herb-gatherer': 'map-sprite.herb-gatherer-v1',
  'portrait.avatar.herb-gatherer-v1': 'map-sprite.herb-gatherer-v1',
  'sprite.npc.array-smith': 'map-sprite.array-smith-lu-v1',
  'portrait.avatar.array-smith-lu-v1': 'map-sprite.array-smith-lu-v1',
  'sprite.npc.market-merchant': 'map-sprite.market-merchant-v1',
  'sprite.npc.tea-shed-elder': 'map-sprite.tea-shed-elder-v1',
  'sprite.npc.processing-artisan': 'map-sprite.processing-artisan-v1',
  'sprite.npc.patrol-guard': 'map-sprite.patrol-guard-v1'
};

/** left 镜像 scale.x = -1，其余 1。 */
export function facingScaleX(facing: Facing4): number {
  return facing === 'left' ? -1 : 1;
}

export function playerWorldMapSpriteAssetId(): string {
  return PLAYER_WORLD_MAP_SPRITE_ID;
}

export function npcWorldMapSpriteAssetId(assetId: string): string | undefined {
  return NPC_WORLD_MAP_SPRITE_ID_BY_ASSET_ID[assetId];
}

export interface WorldCharacterSpriteMetrics {
  readonly width: number;
  readonly height: number;
  readonly yOffset: number;
}

export function worldCharacterSpriteMetrics(kind: 'player' | 'npc'): WorldCharacterSpriteMetrics {
  if (kind === 'player') return { width: 84, height: 84, yOffset: -26 };
  return { width: 74, height: 74, yOffset: -22 };
}

export interface WorldCharacterReadabilityHaloSpec {
  readonly width: number;
  readonly height: number;
  readonly yOffset: number;
  readonly fillAlpha: number;
  readonly strokeAlpha: number;
}

export function worldCharacterReadabilityHaloSpec(kind: 'player' | 'npc'): WorldCharacterReadabilityHaloSpec {
  if (kind === 'player') {
    return { width: 38, height: 72, yOffset: worldCharacterSpriteMetrics(kind).yOffset, fillAlpha: 0.16, strokeAlpha: 0.26 };
  }
  return { width: 34, height: 66, yOffset: worldCharacterSpriteMetrics(kind).yOffset, fillAlpha: 0.13, strokeAlpha: 0.22 };
}

export type NpcWorldFallbackRole = 'merchant' | 'elder' | 'artisan' | 'guard' | 'gatherer' | 'smith' | 'cultivator';

export interface NpcWorldFallbackPresentation {
  readonly role: NpcWorldFallbackRole;
  readonly robeColor: number;
  readonly trimColor: number;
  readonly propColor: number;
}

export function npcWorldFallbackPresentation(assetId: string): NpcWorldFallbackPresentation {
  if (assetId.includes('market') || assetId.includes('wandering')) {
    return { role: 'merchant', robeColor: ColorPalette.soil, trimColor: ColorPalette.gilt, propColor: ColorPalette.giltBright };
  }
  if (assetId.includes('tea') || assetId.includes('elder')) {
    return { role: 'elder', robeColor: ColorPalette.water, trimColor: ColorPalette.paperWarm, propColor: ColorPalette.qiBright };
  }
  if (assetId.includes('processing')) {
    return { role: 'artisan', robeColor: ColorPalette.soilDeep, trimColor: ColorPalette.moss, propColor: ColorPalette.ember };
  }
  if (assetId.includes('patrol') || assetId.includes('guard')) {
    return { role: 'guard', robeColor: ColorPalette.inkPanelDeep, trimColor: ColorPalette.qiFlow, propColor: ColorPalette.qiBright };
  }
  if (assetId.includes('array') || assetId.includes('smith')) {
    return { role: 'smith', robeColor: ColorPalette.soilDeep, trimColor: ColorPalette.gilt, propColor: ColorPalette.giltBright };
  }
  if (assetId.includes('herb') || assetId.includes('gatherer')) {
    return { role: 'gatherer', robeColor: ColorPalette.moss, trimColor: ColorPalette.success, propColor: ColorPalette.qiBright };
  }
  return { role: 'cultivator', robeColor: ColorPalette.mountain, trimColor: ColorPalette.paperWarm, propColor: ColorPalette.qiBright };
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

export interface WalkFootfall {
  readonly x: number;
  readonly y: number;
  readonly alpha: number;
}

export interface CharacterWalkCycle {
  readonly bodyScaleX: number;
  readonly bodyScaleY: number;
  readonly bodyTilt: number;
  readonly shadowScaleX: number;
  readonly shadowScaleY: number;
  readonly leftFoot: WalkFootfall;
  readonly rightFoot: WalkFootfall;
}

const STILL_WALK_CYCLE: CharacterWalkCycle = {
  bodyScaleX: 1,
  bodyScaleY: 1,
  bodyTilt: 0,
  shadowScaleX: 1,
  shadowScaleY: 1,
  leftFoot: { x: -5, y: 13, alpha: 0 },
  rightFoot: { x: 5, y: 13, alpha: 0 }
};

/** 单张世界角色图的伪行走相位：足影交替 + 身体轻微压缩摆动。 */
export function characterWalkCycle(facing: Facing4, progress: number, moving: boolean, reducedMotion = false): CharacterWalkCycle {
  if (!moving || reducedMotion) return STILL_WALK_CYCLE;
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const wave = Math.sin(p * Math.PI * 2);
  const stride = Math.cos(p * Math.PI * 2);
  const horizontal = facing === 'left' || facing === 'right';
  const dir = facing === 'left' || facing === 'up' ? -1 : 1;
  const leftStep = wave >= 0 ? 1 : -1;
  const rightStep = -leftStep;
  const travel = Math.abs(wave);

  return {
    bodyScaleX: 1 + travel * 0.018,
    bodyScaleY: 1 - travel * 0.024,
    bodyTilt: horizontal ? stride * 0.018 * dir : stride * 0.012 * dir,
    shadowScaleX: 1 + travel * 0.18,
    shadowScaleY: 1 - travel * 0.12,
    leftFoot: {
      x: horizontal ? -2 + leftStep * 4 * dir : -6,
      y: horizontal ? 14 + rightStep * 1.2 : 13 + leftStep * 3,
      alpha: 0.22 + Math.max(0, wave) * 0.28
    },
    rightFoot: {
      x: horizontal ? 2 + rightStep * 4 * dir : 6,
      y: horizontal ? 14 + leftStep * 1.2 : 13 + rightStep * 3,
      alpha: 0.22 + Math.max(0, -wave) * 0.28
    }
  };
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
  // 暖宣纸/肤色提亮，避免冷白与纯黑剪影。
  return ColorPalette.playerWarm;
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
        color: ColorPalette.playerSash,
        alpha: 0.94,
        ox: shift.x * 0.4,
        oy: 6 + shift.y * 0.3,
        rx: 10,
        ry: 12,
        layer: 'under'
      },
      {
        kind: 'head',
        color: ColorPalette.playerSkinLight,
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
        color: ColorPalette.danger,
        alpha: 0.36,
        ox: shift.x * 0.5,
        oy: 6,
        rx: 8.5,
        ry: 10,
        layer: 'over'
      },
      {
        kind: 'head',
        color: ColorPalette.playerSkin,
        alpha: 0.32,
        ox: shift.x * 0.6,
        oy: -5,
        rx: 6.5,
        ry: 6.5,
        layer: 'over'
      },
      {
        kind: 'sash',
        color: ColorPalette.playerGilt,
        alpha: 0.4,
        ox: 0,
        oy: 9,
        rx: 7.5,
        ry: 2.5,
        layer: 'over'
      },
      {
        kind: 'highlight',
        color: ColorPalette.playerHighlight,
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
