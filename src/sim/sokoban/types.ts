/**
 * R4′ 布阵导流（Sokoban × 折射雷光）—— 渡劫解谜切片：类型与常量。
 *
 * 熟悉机制容器（docs/26）：推-only Sokoban 的底 + 一招鲜扭转"把雷光折射进自己身体淬炼"。
 * 纯回合、无实时、零随机（beam/推箱都是板面状态的纯函数）—— 直击 R4-a"看不懂"问题。
 * 守 docs/00 C3/C4：sim 层无 IO、无 Math.random/Date.now。棋盘生成用项目 Rng。
 */
import type { Vec2 } from '@sim/world/types';

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIR_VECTORS: Readonly<Record<Dir, Vec2>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

/** 顺时针旋转（金阵石折射方向）。 */
export function rotateCW(dir: Dir): Dir {
  switch (dir) {
    case 'up':
      return 'right';
    case 'right':
      return 'down';
    case 'down':
      return 'left';
    case 'left':
      return 'up';
  }
}

/** 固定地形。rift=断裂雷脉，只有水阵石压在其上时雷光才能通过。 */
export type Terrain = 'empty' | 'wall' | 'source' | 'body' | 'herb' | 'rift';

/** 可推阵石。mirror=金阵石(折90°cw)、conductor=水阵石(直通)、insulator=绝缘石(阻断)。 */
export type BlockKind = 'none' | 'mirror' | 'conductor' | 'insulator';

export interface SokobanBoard {
  readonly width: number;
  readonly height: number;
  terrain: Terrain[]; // length w*h，索引 = y*width+x
  blocks: BlockKind[]; // length w*h，'none'=无阵石
  readonly sourcePos: Vec2;
  readonly sourceDir: Dir;
}

/** 雷光追踪结果（板面状态的纯函数）。 */
export interface BeamTrace {
  readonly cells: readonly Vec2[];
  readonly reachedBody: boolean;
  readonly herbsHit: readonly Vec2[];
}

export type SokobanStatus = 'playing' | 'won' | 'lost';

export type SokobanArchetype = 'turning-rune' | 'sealed-meridian' | 'broken-meridian' | 'compound-array';

/** 生成器签发的可玩性证书；不含文案，避免 sim 反向依赖 UI。 */
export interface SokobanChallenge {
  readonly archetype: SokobanArchetype;
  readonly requiredBlockKinds: readonly Exclude<BlockKind, 'none'>[];
  readonly certifiedMoves: number;
  readonly budgetSlack: number;
  readonly preserveHerbsTarget: number;
}

export interface SokobanState {
  readonly stage: number;
  board: SokobanBoard;
  player: Vec2;
  beam: BeamTrace;
  scorched: boolean[]; // 已被雷光烧毁的灵草格
  readonly herbsTotal: number;
  moveBudget: number;
  movesUsed: number;
  status: SokobanStatus;
  readonly challenge?: SokobanChallenge;
}

export type SokobanAction = { kind: 'move'; dir: Dir };

export interface SokobanActionOutcome {
  readonly ok: boolean;
  readonly reason?: string;
}
