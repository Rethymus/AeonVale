import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE } from '@sim';
import { buildRegistry } from '@content/registry';
import { stageQiCap, readyForBreakthrough, breakthrough } from '@sim/progression/progression';
import { MILLI } from '@sim/world/types';

function setup(seed = 1, stage = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = stage as 1;
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx };
}

describe('进阶系统 (docs/09 / 14 §8)', () => {
  it('stageQiCap 取 7 阶表', () => {
    expect(stageQiCap(1, DEFAULT_BALANCE)).toBe(100_000); // 100 × MILLI
    expect(stageQiCap(7, DEFAULT_BALANCE)).toBe(2_200_000);
  });

  it('修为未满不可突破', () => {
    const { state, ctx } = setup();
    state.player.cultivation = 50_000; // < 100_000
    expect(readyForBreakthrough(state, DEFAULT_BALANCE)).toBe(false);
  });

  it('修为满 + 存活天劫 → 高概率突破成功', () => {
    // 用固定种子跑多次，成功率应较高（丹毒 0、有溢出）
    let successes = 0;
    const N = 50;
    for (let s = 0; s < N; s++) {
      const { state, ctx } = setup(s + 100);
      state.player.cultivation = 120_000; // 满 + 溢出
      const r = breakthrough(state, ctx, true);
      if (r.success) successes++;
    }
    expect(successes / N).toBeGreaterThan(0.45); // 基础成功率 ~0.6，样本波动
  });

  it('突破成功：阶段+1、maxHP 升、修为重置、丹毒减半', () => {
    const { state, ctx } = setup(12345);
    state.player.cultivation = 150_000;
    state.player.pillPoison = 40_000;
    // 跑到成功
    let r;
    for (let i = 0; i < 50; i++) {
      const { state: st, ctx: c } = setup(12345 + i);
      st.player.cultivation = 150_000;
      st.player.pillPoison = 40_000;
      r = breakthrough(st, c, true);
      if (r!.success) {
        expect(st.player.stage).toBe(2);
        expect(st.player.maxHp).toBe((DEFAULT_BALANCE.player.stageMaxHp[1] ?? 110) * MILLI); // 点→毫点（docs/14 §8.1）
        expect(st.player.hp).toBe(st.player.maxHp);
        expect(st.player.pillPoison).toBe(20_000); // 减半
        expect(st.player.cultivation).toBeLessThan(50_000); // 溢出保留后小
        return;
      }
    }
    expect.fail('50 次未突破成功');
  });

  it('高丹毒显著降低突破成功率（炼丹闭环）', () => {
    let clean = 0;
    let poisoned = 0;
    for (let s = 0; s < 60; s++) {
      const reg = buildRegistry();
      const a = createWorld({ seed: s, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
      const b = createWorld({ seed: s, width: 5, height: 5, content: reg, params: DEFAULT_BALANCE });
      const ca = createSimContext(s, reg, DEFAULT_BALANCE);
      const cb = createSimContext(s, reg, DEFAULT_BALANCE);
      a.player.stage = 1 as 1; b.player.stage = 1 as 1;
      a.player.cultivation = 110_000; b.player.cultivation = 110_000;
      b.player.pillPoison = 80_000; // 高丹毒
      if (breakthrough(a, ca, true).success) clean++;
      if (breakthrough(b, cb, true).success) poisoned++;
    }
    expect(clean).toBeGreaterThan(poisoned);
  });
});
