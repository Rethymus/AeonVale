import type { GameState } from '@sim/world/state';
import { emit } from '@sim/world/state';
import type { SimContext } from '@sim/world/context';
import { runTribulation, type TribulationResult } from '@sim/tribulation/tribulationSystem';
import { breakthrough, type BreakthroughResult } from './progression';
import { clearTribulationCountdown, normalizeBodyCultivation } from './bodyCultivation';

export interface DueTribulationResolution {
  resolved: boolean;
  tribulation: TribulationResult | null;
  breakthrough: BreakthroughResult | null;
}

export function standardTribulationBoltCount(stage: number): number {
  switch (stage) {
    case 1:
      return 3;
    case 2:
      return 4;
    case 3:
      return 5;
    case 4:
      return 6;
    case 5:
      return 7;
    case 6:
      return 8;
    default:
      return 8;
  }
}

/**
 * 日级准备窗归零后的第一版自动渡劫结算。
 *
 * 先用现有 deterministic 天劫系统跑完整场，再进入突破判定；
 * 这是秒级临战 UI 接入前的纯 sim 闭环实现。
 */
export function resolveDueTribulation(state: GameState, ctx: SimContext): DueTribulationResolution {
  normalizeBodyCultivation(state, ctx.params);
  if (state.tribulation.status !== 'due') {
    return { resolved: false, tribulation: null, breakthrough: null };
  }

  const source = state.tribulation.source;
  const stage = state.tribulation.stage || state.player.stage;
  const boltCount = standardTribulationBoltCount(stage);
  emit(state, 'tribulation-forced-start', { source, stage, boltCount });

  const tribulation = runTribulation(
    state,
    {
      stage,
      boltCount,
      policy: { blockChance: 0 }
    },
    ctx
  );

  let breakthroughResult: BreakthroughResult | null = null;
  if (tribulation.survived) {
    breakthroughResult = breakthrough(state, ctx, true);
  }

  emit(state, 'tribulation-due-resolved', {
    source,
    stage,
    boltCount,
    survived: tribulation.survived,
    breakthrough: breakthroughResult?.success ?? false,
    madness: breakthroughResult?.madness ?? false
  });
  clearTribulationCountdown(state);

  return {
    resolved: true,
    tribulation,
    breakthrough: breakthroughResult
  };
}
