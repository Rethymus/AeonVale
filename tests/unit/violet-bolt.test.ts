/**
 * 紫雷 VioletBolt 单元测试（docs/05 §5.2 / M5）。
 * 雷型演化：stage≥3 紫雷初现（BlastRadius=2，伤害×1.16/淬体×1.5）；stage4 紫雷为主。
 * 确定性（C3）：紫雷判定走 ctx.rng.lightning 流，仅 stage≥unlock 消费 rng（stage1–2 序列不变）。
 */
import { describe, it, expect } from 'vitest';
import { createWorld, createSimContext, DEFAULT_BALANCE, type BalanceParams } from '@sim';
import { buildRegistry } from '@content/registry';
import { runTribulation, violetChance } from '@sim/tribulation/tribulationSystem';

const FULL_BLAST = 100; // 强制所有雷命中玩家（无头确定性测试）

function withBolt(over: Partial<BalanceParams['lightning']['bolt']>): BalanceParams {
  return {
    ...DEFAULT_BALANCE,
    lightning: { ...DEFAULT_BALANCE.lightning, bolt: { ...DEFAULT_BALANCE.lightning.bolt, ...over } },
  };
}

describe('紫雷 VioletBolt（docs/05 §5.2 / M5）', () => {
  it('violetChance：stage<3 为 0；stage3=0.3/4=0.6/5=0.9；钳到 [0,1]', () => {
    expect(violetChance(0, DEFAULT_BALANCE)).toBe(0);
    expect(violetChance(2, DEFAULT_BALANCE)).toBe(0);
    expect(violetChance(3, DEFAULT_BALANCE)).toBeCloseTo(0.3);
    expect(violetChance(4, DEFAULT_BALANCE)).toBeCloseTo(0.6);
    expect(violetChance(5, DEFAULT_BALANCE)).toBeCloseTo(0.9);
    expect(violetChance(6, DEFAULT_BALANCE)).toBe(1); // 0.3 + 0.3×3 = 1.2 → clamp
    expect(violetChance(7, DEFAULT_BALANCE)).toBe(1);
  });

  it('紫雷伤害 ×1.16、淬体更高（强制全紫 vs 全青，同 stage/seed/单雷）', () => {
    const cyanP = withBolt({ violetUnlockStage: 99 }); // 永不解锁 → 全青雷
    const violetP = withBolt({ violetUnlockStage: 1, violetChanceBase: 1.0 }); // 必紫雷
    const seed = 42;
    const reg = buildRegistry();

    const sC = createWorld({ seed, width: 8, height: 8, content: reg, params: cyanP });
    sC.player.stage = 3; sC.player.wardMitigation = 0;
    const cC = createSimContext(seed, reg, cyanP);
    const hpBeforeC = sC.player.hp;
    const rC = runTribulation(sC, { stage: 3, boltCount: 1, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, cC);
    expect(rC.hits.violet).toBe(0);
    const cyanHpLoss = hpBeforeC - rC.finalHpMilli;

    const sV = createWorld({ seed, width: 8, height: 8, content: reg, params: violetP });
    sV.player.stage = 3; sV.player.wardMitigation = 0;
    const cV = createSimContext(seed, reg, violetP);
    const hpBeforeV = sV.player.hp;
    const rV = runTribulation(sV, { stage: 3, boltCount: 1, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, cV);
    expect(rV.hits.violet).toBe(1);
    const violetHpLoss = hpBeforeV - rV.finalHpMilli;

    // 紫雷伤害精确 ×1.16（M5 调参：docs/05 §5.2 原值 1.5 → 1.16，docs/18 §7.3 终局劝退）
    expect(violetHpLoss).toBe(Math.round(cyanHpLoss * 1.16));
    // 紫雷淬体更高（dmg×1.16 且 tempMult×1.5，叠加更低 HP→更高近死加成）
    expect(rV.temperingGainMilli).toBeGreaterThan(rC.temperingGainMilli);
  });

  it('默认配置 stage3 紫雷占比≈0.3：长天劫紫雷与青雷混合（确定性）', () => {
    const reg = buildRegistry();
    const state = createWorld({ seed: 7, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
    state.player.stage = 3;
    state.player.hp = 10_000_000; // 拉高 HP 避免提前阵亡中断循环
    state.player.maxHp = 10_000_000;
    const ctx = createSimContext(7, reg, DEFAULT_BALANCE);
    const res = runTribulation(state, { stage: 3, boltCount: 60, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, ctx);
    expect(res.hits.violet).toBeGreaterThan(0);
    expect(res.hits.violet).toBeLessThan(60);
  });

  it('stage1–2 无紫雷判定（rng 序列与旧版一致，不消费紫雷 rng）', () => {
    // stage1 不解锁紫雷 → hits.violet 恒 0；与未引入紫雷前的行为等价
    const reg = buildRegistry();
    const state = createWorld({ seed: 3, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
    state.player.hp = 10_000_000; state.player.maxHp = 10_000_000;
    const ctx = createSimContext(3, reg, DEFAULT_BALANCE);
    const res = runTribulation(state, { stage: 1, boltCount: 10, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, ctx);
    expect(res.hits.violet).toBe(0);
  });
});
