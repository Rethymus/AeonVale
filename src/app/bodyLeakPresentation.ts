/**
 * 肉身漏勺展示（P1-2）：把 player.stage + bodyFoundation 派生为七层「封堵/正在压实/仍在泄漏」状态。
 *
 * 漏勺是 bodyFoundation 的叙事投影，不是新的逐洞 sim 字段（见 docs/20 D-34）。
 * 纯函数：只读 player + params，不读/写其余 GameState，不影响存档/回放确定性。
 *
 * 层级与境界映射（docs/20 R1：7 阶）：
 *   1 皮膜 · 2 骨架 · 3 经脉 · 4 髓海 · 5 血脉 · 6 雷骨 · 7 空窍·丹田
 * 规则（P1 spec §5.2）：
 *   - i <= stage            → sealed（金色实线，progress=1）
 *   - i === stage + 1       → progressing（金色进度段 + 红虚线，progress=bodyFoundation/cap(stage)）
 *   - i > stage + 1         → leaking（红虚线，progress=0）
 *   - stage 0（凡骨）       → 全泄漏；stage >= 7 → 全封堵
 */
import { bodyFoundationCap } from '@sim';
import type { BalanceParams } from '@sim/params';
import type { Player } from '@sim/world/player';

export type BodyLayerStatus = 'sealed' | 'progressing' | 'leaking';

export interface BodyLayerState {
  index: number; // 1..7
  name: string;
  status: BodyLayerStatus;
  /** 0..1：sealed=1，leaking=0，progressing=bodyFoundation/cap(stage) */
  progress: number;
}

export interface BodyLeakPresentation {
  stage: number;
  layers: readonly BodyLayerState[];
  sealedCount: number;
  /** 当前正在压实的层进度 0..1（stage 0 或 >=7 边界为 0 或 1） */
  currentProgress: number;
}

export const BODY_LAYER_NAMES = ['皮膜', '骨架', '经脉', '髓海', '血脉', '雷骨', '空窍·丹田'] as const;

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function bodyLeakPresentation(
  player: Pick<Player, 'stage' | 'bodyFoundation'>,
  params: BalanceParams
): BodyLeakPresentation {
  const rawStage = Math.floor(player.stage ?? 0);
  const stage = Math.max(0, Math.min(7, rawStage));
  const foundation = Number.isFinite(player.bodyFoundation) ? Math.max(0, player.bodyFoundation) : 0;

  const cap = bodyFoundationCap(stage, params);
  const ratio = Number.isFinite(cap) && cap > 0 ? foundation / cap : 0;
  const currentProgress = stage >= 7 ? 1 : stage === 0 ? 0 : clamp01(ratio);

  let sealedCount = 0;
  const layers: BodyLayerState[] = [];
  for (let i = 1; i <= 7; i += 1) {
    let status: BodyLayerStatus;
    let progress: number;
    if (i <= stage) {
      status = 'sealed';
      progress = 1;
      sealedCount += 1;
    } else if (i === stage + 1 && stage >= 1) {
      status = 'progressing';
      progress = currentProgress;
    } else {
      status = 'leaking';
      progress = 0;
    }
    layers.push({ index: i, name: BODY_LAYER_NAMES[i - 1] ?? `层${i}`, status, progress });
  }

  return { stage, layers, sealedCount, currentProgress };
}
