import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, checkGameEnd, applyPill, resolveAscensionChoice, invokeTribulation, advanceDay } from '@sim';
import { buildRegistry } from '@content/registry';
import { breakthrough } from '@sim/progression/progression';
import { mutateItem, itemCount } from '@sim/world/player';
import { MILLI } from '@sim/world/types';
import { roundTripEqual } from '@sim/serialize';

function setup(seed = 1, stage = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = stage as 1;
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('结局系统 ', () => {
  it('突破至 stage 7 → 飞升前夜；服飞升丹后进入飞升抉择', () => {
    let reached = false;
    for (let s = 0; s < 80 && !reached; s++) {
      const { state, ctx } = setup(s, 6);
      state.player.cultivation = 1_700_000; // > xCap[5]=1.6M
      const r = breakthrough(state, ctx, true);
      if (r.success && state.player.stage === 7) {
        // 飞升前夜：达 stage7 但不自动结局，需炼服飞升丹
        expect(state.ending).toBeNull;
        expect(state.gameOver).toBe(false);
        expect(state.events.some(e => e.type === 'eve-of-ascension')).toBe(true);
        // 服飞升丹 → 飞升结局（通关）
        mutateItem(state.player, 'pill.ascend', 1);
        const res = applyPill(state, 'pill.ascend', ctx);
        expect(res.applied).toBe(true);
        expect(state.ending).toBeNull;
        expect(state.gameOver).toBe(false);
        expect(state.postAscension.mode).toBe('choice-pending');
        expect(state.events.some(e => e.type === 'ascension-choice-available')).toBe(true);
        reached = true;
      }
    }
    expect(reached).toBe(true);
  });

  it('飞升抉择选择离界后，保留原飞升结局语义', () => {
    const { state, ctx } = setup(1, 7);
    mutateItem(state.player, 'pill.ascend', 1);
    const res = applyPill(state, 'pill.ascend', ctx);
    expect(res.applied).toBe(true);
    expect(state.postAscension.mode).toBe('choice-pending');

    expect(resolveAscensionChoice(state, 'ascend-away')).toBe(true);
    expect(state.postAscension.mode).toBe('ascended-away');
    expect(state.postAscension.victoryRecorded).toBe(true);
    expect(state.ending).toBe('ascension');
    expect(state.gameOver).toBe(true);
  });

  it('飞升抉择选择留世后，主线突破与引劫冻结但日常继续', () => {
    const { state, ctx } = setup(2, 7);
    state.player.bodyFoundation = 2_000_000;
    state.player.cultivation = 2_000_000;
    mutateItem(state.player, 'pill.ascend', 1);
    applyPill(state, 'pill.ascend', ctx);
    expect(resolveAscensionChoice(state, 'stay-in-world')).toBe(true);

    expect(state.postAscension.mode).toBe('stayed-in-world');
    expect(state.postAscension.victoryRecorded).toBe(true);
    expect(state.gameOver).toBe(false);
    expect(state.ending).toBeNull;
    expect(invokeTribulation(state, ctx)).toBe(false);

    const beforeDay = state.day;
    advanceDay(state, ctx);
    expect(state.day).toBe(beforeDay + 1);

    const br = breakthrough(state, ctx, true);
    expect(br.success).toBe(false);
    expect(state.player.stage).toBe(7);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('飞升前夜前服飞升丹被拒（不消耗通关道具）', () => {
    const { state, ctx } = setup(1, 5); // stage5，未达飞升前夜（stage7）
    mutateItem(state.player, 'pill.ascend', 1);
    const res = applyPill(state, 'pill.ascend', ctx);
    expect(res.applied).toBe(false); // 拒服
    expect(itemCount(state.player, 'pill.ascend')).toBe(1); // 通关道具保留
    expect(state.ending).toBeNull;
    expect(state.gameOver).toBe(false);
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

  it('走火丹累积走火值 → 突破时走火入魔结局', () => {
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
