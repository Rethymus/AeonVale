import { describe, expect, it } from 'vitest';
import { buildRegistry } from '@content/registry';
import { createSimContext, createWorld, DEFAULT_BALANCE } from '@sim';
import { stateHash } from '@sim/serialize';
import { runTribulation } from '@sim/tribulation/tribulationSystem';

describe('正式天劫行为回归', () => {
  it('抽取单雷 primitive 后仍保持既有整场结果、事件与 RNG 消费顺序', () => {
    const content = buildRegistry();
    const state = createWorld({ seed: 7, width: 8, height: 8, content, params: DEFAULT_BALANCE });
    const ctx = createSimContext(7, content, DEFAULT_BALANCE);
    state.player.stage = 1;
    state.player.wardMitigation = 0.4;

    expect(ctx.rng.lightning.snapshot()).toBe(1_351_893_774);

    const result = runTribulation(state, { stage: 1, boltCount: 3, policy: { blockChance: 0 }, blastRadius: 100 }, ctx);

    expect(result).toEqual({
      survived: true,
      finalHpMilli: 60_400,
      bolts: 3,
      temperingGainMilli: 39_600,
      hits: { direct: 3, rod: 0, miss: 0, blocked: 0, violet: 0 }
    });
    expect(ctx.rng.lightning.snapshot()).toBe(513_081_913);
    expect(state.player).toMatchObject({
      hp: 60_400,
      cultivation: 39_600,
      bodyFoundation: 39_600,
      willpower: 3_300,
      temperingStack: 39_600,
      wardMitigation: 0
    });
    expect(state.events).toEqual([
      {
        type: 'tribulation-end',
        tick: 0,
        day: 1,
        payload: {
          survived: true,
          tempering: 39_600,
          hits: { direct: 3, rod: 0, miss: 0, blocked: 0, violet: 0 }
        }
      }
    ]);
    expect(stateHash(state)).toBe('dc37dca3');
  });
});
