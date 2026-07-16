/**
 * 高阶灵草获取路径—— 突破解锁 + 游方散仙赠种 + 猎妖掉种。
 * 修复真实通关阻断：飞升需 tier4-5 灵草，原本无获取路径。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyAction } from '@sim';
import { buildRegistry } from '@content/registry';
import { resolveEventGrants } from '@sim/celestial/celestialSystem';
import { MILLI } from '@sim/world/types';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('高阶灵草获取路径', () => {
  // 注：突破不发种（会灌满 16 格背包挤掉避雷丹/飞升丹发放）；种子经 游方散仙 + 猎妖掉落（rate-limited）获取。
  it('游方散仙 seed-by-stage 按 player.stage 选种（tier ≤ stage）', () => {
    const { state, ctx, reg } = setup();
    state.player.stage = 3;
    const def = reg.events.get('event.wandering-immortal')!;
    resolveEventGrants(state, def, ctx);
    const seeds = Object.entries(state.player.inventory).filter(([id]) => id.startsWith('seed.'));
    const total = seeds.reduce((s, [, slot]) => s + slot.count, 0);
    expect(total).toBe(2); // count: 2
    for (const [id] of seeds) {
      const herb = reg.seedToHerb.get(id);
      expect(herb?.tier, `${id} 应 ≤ stage 3`).toBeLessThanOrEqual(3);
    }
  });

  it('猎妖掉落 ~stage 阶种子', () => {
    const { state, ctx } = setup();
    state.beastSurge = { beastsRemaining: 12, daysLeft: 3 };
    state.player.stamina = 10_000 * MILLI;
    state.player.hp = 10_000 * MILLI;
    let seeded = false;
    for (let i = 0; i < 12 && state.beastSurge; i++) {
      state.events.length = 0;
      applyAction(state, { kind: 'hunt-beast' }, ctx);
      if (state.events.some(e => e.type === 'beast-seed')) {
        seeded = true;
        break;
      }
    }
    expect(seeded, '12 次猎妖内应至少掉一粒种子（seedDropChance=0.5/次）').toBe(true);
  });
});
