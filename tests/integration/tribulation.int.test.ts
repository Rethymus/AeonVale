/**
 * INT-03: 完整天劫流程端到端（docs/17 §3 / docs/05 / docs/14 §6）。
 *
 * 覆盖路径：准备状态 → 引劫 → 淬体 → 修为增长 → 突破判定 → 结局闭环。
 * 注：使用 blastRadius=100 保证所有雷击命中玩家（无头确定性测试，非真实地形博弈）。
 */
import { describe, it, expect } from 'vitest';
import {
  createWorld,
  createSimContext,
  DEFAULT_BALANCE,
} from '@sim';
import { buildRegistry } from '@content/registry';
import { runTribulation, nearDeathBonus, boltBaseDamage } from '@sim/tribulation/tribulationSystem';
import { breakthrough, readyForBreakthrough, stageQiCap } from '@sim/progression/progression';
import { applyPill } from '@sim/alchemy/pillSystem';
import { mutateItem } from '@sim/world/player';
import { roundTripEqual } from '@sim/serialize';

// blastRadius 足够大，确保所有雷击均命中玩家（无论玩家位置）
const FULL_BLAST = 100;

function setup(seed = 7, stage: 1 | 2 | 3 = 1) {
  const reg = buildRegistry();
  const state = createWorld({ seed, width: 8, height: 8, content: reg, params: DEFAULT_BALANCE });
  state.player.stage = stage;
  const ctx = createSimContext(seed, reg, DEFAULT_BALANCE);
  return { state, ctx, reg };
}

describe('INT-03: 天劫端到端', () => {
  it('基础天劫：3 雷全中，stage1 初始 HP 可存活，修为增长', () => {
    const { state, ctx } = setup();
    // stage1 baseDamage = (12+8×1)×1000 = 20000，3 雷最多 60000 HP 伤
    // 初始 HP = 100000，应能存活
    const cultBefore = state.player.cultivation;
    const res = runTribulation(state, {
      stage: 1, boltCount: 3,
      policy: { blockChance: 0 },
      blastRadius: FULL_BLAST,
    }, ctx);
    expect(res.survived).toBe(true);
    expect(res.finalHpMilli).toBeGreaterThan(0);
    expect(res.hits.direct).toBeGreaterThan(0);
    expect(state.player.cultivation).toBeGreaterThan(cultBefore);
    expect(res.temperingGainMilli).toBeGreaterThan(0);
  });

  it('20 雷全中 stage1：HP≤0 → survived=false', () => {
    const { state, ctx } = setup(1);
    // 20 雷 × 20000 = 400000 >> maxHp=100000，必死
    const res = runTribulation(state, {
      stage: 1, boltCount: 20,
      policy: { blockChance: 0 },
      blastRadius: FULL_BLAST,
    }, ctx);
    expect(res.survived).toBe(false);
    expect(state.player.hp).toBe(0);
  });

  it('避雷丹护体：wardMitigation=0.4 → 伤害减少 → 最终 HP 更高', () => {
    // 同种子两组，控制变量只有 wardMitigation
    const { state: s1, ctx: c1 } = setup(3, 1);
    const { state: s2, ctx: c2 } = setup(3, 1);

    // s2 直接设置护体（不走 applyPill 避免丹毒差异）
    s2.player.wardMitigation = 0.4;

    const r1 = runTribulation(s1, { stage: 1, boltCount: 3, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, c1);
    const r2 = runTribulation(s2, { stage: 1, boltCount: 3, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, c2);

    // 护体后 HP 更高
    expect(r2.finalHpMilli).toBeGreaterThan(r1.finalHpMilli);
    // 护体渡劫后消耗
    expect(s2.player.wardMitigation).toBe(0);
  });

  it('applyPill(ward-basic) 设置 wardMitigation=0.4', () => {
    const { state, ctx } = setup(1);
    mutateItem(state.player, 'pill.ward-basic', 1);
    applyPill(state, 'pill.ward-basic', ctx);
    expect(state.player.wardMitigation).toBeCloseTo(0.4);
  });

  it('擦弹（blockChance=1）：hits.blocked > 0，HP 高于完全受击', () => {
    const { state: sBlock, ctx: cBlock } = setup(5, 1);
    const { state: sNoBlock, ctx: cNoBlock } = setup(5, 1);

    const rBlock = runTribulation(sBlock, {
      stage: 1, boltCount: 5,
      policy: { blockChance: 1 },
      blastRadius: FULL_BLAST,
    }, cBlock);
    const rNoBlock = runTribulation(sNoBlock, {
      stage: 1, boltCount: 5,
      policy: { blockChance: 0 },
      blastRadius: FULL_BLAST,
    }, cNoBlock);

    expect(rBlock.hits.blocked).toBeGreaterThan(0);
    expect(rNoBlock.hits.blocked).toBe(0);
    // 擦弹伤害×0.3 → 最终 HP 更高（若未死亡）
    if (rBlock.survived && rNoBlock.survived) {
      expect(rBlock.finalHpMilli).toBeGreaterThan(rNoBlock.finalHpMilli);
    }
  });

  it('nearDeathBonus：(0,10%] HP 比 (50%,80%] HP 修为收益更高', () => {
    // 两组同种子：一组 HP 压到5%，一组 HP=60%，1 雷全中，比较修为增量
    const { state: sLow, ctx: cLow } = setup(4, 1);
    const { state: sHigh, ctx: cHigh } = setup(4, 1);

    sLow.player.hp = Math.floor(sLow.player.maxHp * 0.05);   // 5% HP
    sHigh.player.hp = Math.floor(sHigh.player.maxHp * 0.6);  // 60% HP

    const cultBeforeLow = sLow.player.cultivation;
    const cultBeforeHigh = sHigh.player.cultivation;

    // 0 bolt: 不打击，只测 nearDeathBonus 函数直接结果
    const bonusLow = nearDeathBonus(0.05, DEFAULT_BALANCE);
    const bonusHigh = nearDeathBonus(0.60, DEFAULT_BALANCE);
    expect(bonusLow).toBeGreaterThan(bonusHigh);

    // 实际1雷，确保有直接命中
    runTribulation(sLow, { stage: 1, boltCount: 1, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, cLow);
    runTribulation(sHigh, { stage: 1, boltCount: 1, policy: { blockChance: 0 }, blastRadius: FULL_BLAST }, cHigh);

    const cultGainLow = sLow.player.cultivation - cultBeforeLow;
    const cultGainHigh = sHigh.player.cultivation - cultBeforeHigh;
    // 低HP组收益应更高（nearDeathBonus 更大）
    if (sLow.player.hp > 0) { // 若未死亡
      expect(cultGainLow).toBeGreaterThan(cultGainHigh);
    }
  });

  it('修为满 + 存活天劫 → 可突破到 stage2', () => {
    let broke = false;
    for (let s = 0; s < 20 && !broke; s++) {
      const { state, ctx } = setup(s, 1);
      state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 1000;
      expect(readyForBreakthrough(state, DEFAULT_BALANCE)).toBe(true);

      const res = runTribulation(state, {
        stage: 1, boltCount: 2,
        policy: { blockChance: 0 },
        blastRadius: FULL_BLAST,
      }, ctx);
      if (!res.survived) continue;

      const r = breakthrough(state, ctx, true);
      if (r.success) {
        expect(state.player.stage).toBe(2);
        expect(state.player.hp).toBe(state.player.maxHp); // 突破回满
        broke = true;
      }
    }
    expect(broke).toBe(true);
  });

  it('丹毒高 → 突破成功率统计上更低', () => {
    let successClean = 0, successPoisoned = 0;
    const TRIALS = 30;
    for (let s = 0; s < TRIALS; s++) {
      {
        const { state, ctx } = setup(s, 1);
        state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 5000;
        state.player.pillPoison = 0;
        const r = breakthrough(state, ctx, true);
        if (r.success) successClean++;
      }
      {
        const { state, ctx } = setup(s, 1);
        state.player.cultivation = stageQiCap(1, DEFAULT_BALANCE) + 5000;
        state.player.pillPoison = DEFAULT_BALANCE.pillPoison.cap * 800;
        const r = breakthrough(state, ctx, true);
        if (r.success) successPoisoned++;
      }
    }
    expect(successClean).toBeGreaterThanOrEqual(successPoisoned);
  });

  it('天劫后状态可序列化往返', () => {
    const { state, ctx } = setup(9);
    runTribulation(state, {
      stage: 1, boltCount: 3,
      policy: { blockChance: 0 },
      blastRadius: FULL_BLAST,
    }, ctx);
    expect(roundTripEqual(state)).toBe(true);
  });

  it('boltBaseDamage 随阶段线性递增', () => {
    const P = DEFAULT_BALANCE;
    for (let s = 1; s <= 6; s++) {
      expect(boltBaseDamage(s + 1, P)).toBeGreaterThan(boltBaseDamage(s, P));
    }
    expect(boltBaseDamage(1, P)).toBe(
      (P.lightning.damage.base + P.lightning.damage.stageSlope * 1) * 1000,
    );
  });
});
