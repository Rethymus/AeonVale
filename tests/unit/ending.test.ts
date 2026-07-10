import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, checkGameEnd, applyPill } from '@sim';
import { buildRegistry } from '@content/registry';
import { breakthrough } from '@sim/progression/progression';
import { mutateItem } from '@sim/world/player';
import { MILLI } from '@sim/world/types';

function setup(seed = 1, stage = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = stage as 1;
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('结局系统 (docs/02)', () => {
  it('突破至 stage 7 → 飞升结局（通关）', () => {
    let won = false;
    for (let s = 0; s < 80 && !won; s++) {
      const { state, ctx } = setup(s, 6);
      state.player.cultivation = 1_700_000; // > xCap[5]=1.6M
      const r = breakthrough(state, ctx, true);
      if (r.success && state.player.stage === 7) {
        expect(state.ending).toBe('ascension');
        expect(state.gameOver).toBe(true);
        won = true;
      }
    }
    expect(won).toBe(true);
  });

  it('HP≤0 → 陨于天劫', () => {
    const { state, ctx } = setup();
    state.player.hp = 0;
    checkGameEnd(state, ctx);
    expect(state.ending).toBe('tribulation-death');
    expect(state.gameOver).toBe(true);
  });

  it('丹毒满 → 暴毙', () => {
    const { state, ctx } = setup();
    state.player.pillPoison = DEFAULT_BALANCE.pillPoison.cap * MILLI;
    checkGameEnd(state, ctx);
    expect(state.ending).toBe('poison-death');
    expect(state.gameOver).toBe(true);
  });

  it('gameOver 后 checkGameEnd 幂等（不覆盖结局）', () => {
    const { state, ctx } = setup();
    state.player.hp = 0;
    checkGameEnd(state, ctx);
    const first = state.ending;
    state.player.pillPoison = DEFAULT_BALANCE.pillPoison.cap * MILLI;
    checkGameEnd(state, ctx);
    expect(state.ending).toBe(first); // 不被后续覆盖
  });

  it('走火丹累积走火值 → 突破时走火入魔结局（docs/02）', () => {
    const { state, ctx } = setup(1, 1);
    state.player.cultivation = 120_000; // 修为满
    mutateItem(state.player, 'pill.madness', 3);
    applyPill(state, 'pill.madness', ctx); // +40 走火
    applyPill(state, 'pill.madness', ctx); // +40
    applyPill(state, 'pill.madness', ctx); // +40 → madnessValue=120 > cap(100) → madnessChance=0.6
    // 多种子找一个走火触发
    let madness = false;
    for (let s = 0; s < 30 && !madness; s++) {
      const { state: st, ctx: c } = setup(s, 1);
      st.player.cultivation = 120_000;
      mutateItem(st.player, 'pill.madness', 3);
      for (let i = 0; i < 3; i++) applyPill(st, 'pill.madness', c);
      const r = breakthrough(st, c, true);
      if (r.madness) {
        expect(st.ending).toBe('madness');
        expect(st.gameOver).toBe(true);
        madness = true;
      }
    }
    expect(madness).toBe(true);
  });
});
