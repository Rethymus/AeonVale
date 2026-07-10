import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, applyPill, type GameState, type SimContext } from '@sim';
import { buildRegistry } from '@content/registry';
import { mutateItem } from '@sim/world/player';
import { runTribulation } from '@sim/tribulation/tribulationSystem';

function setup(seed = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('丹药服用 (docs/06 §7.2)', () => {
  it('生骨丹回血', () => {
    const { state, ctx } = setup();
    state.player.hp = 30_000;
    mutateItem(state.player, 'pill.bone-basic', 1);
    const r = applyPill(state, 'pill.bone-basic', ctx);
    expect(r.applied).toBe(true);
    expect(state.player.hp).toBe(60_000); // +30_000
    expect(state.player.inventory['pill.bone-basic']).toBeUndefined();
  });

  it('净毒丹清丹毒（净效果 = 清毒 - 自身负荷）', () => {
    const { state, ctx } = setup();
    state.player.pillPoison = 50_000;
    mutateItem(state.player, 'pill.detox', 1);
    applyPill(state, 'pill.detox', ctx);
    // 清毒 25_000 - 自身负荷 2_000 = 净降 23_000 → 27_000
    expect(state.player.pillPoison).toBe(27_000);
  });

  it('避雷丹设置护体减伤', () => {
    const { state, ctx } = setup();
    mutateItem(state.player, 'pill.ward-basic', 1);
    applyPill(state, 'pill.ward-basic', ctx);
    expect(state.player.wardMitigation).toBe(0.4);
  });

  it('无丹药时不消耗', () => {
    const { state, ctx } = setup();
    const r = applyPill(state, 'pill.ward-basic', ctx);
    expect(r.applied).toBe(false);
  });

  it('护体减伤在天劫中生效且渡劫后消耗', () => {
    const reg = buildRegistry();
    const sA = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const sB = createWorld({ seed: 5, width: 6, height: 6, content: reg, params: DEFAULT_BALANCE });
    const cA = createSimContext(5, reg, DEFAULT_BALANCE);
    const cB = createSimContext(5, reg, DEFAULT_BALANCE);
    mutateItem(sA.player, 'pill.ward-basic', 1);
    applyPill(sA, 'pill.ward-basic', cA); // A 有护体
    const rA = runTribulation(sA, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cA);
    const rB = runTribulation(sB, { stage: 1, boltCount: 8, policy: { blockChance: 0 } }, cB);
    // A 受护体保护，掉血更少
    expect(rA.finalHpMilli).toBeGreaterThanOrEqual(rB.finalHpMilli);
    expect(sA.player.wardMitigation).toBe(0); // 渡劫后消耗
  });
});
