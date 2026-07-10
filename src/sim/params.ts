/**
 * 平衡参数注册表 (Balance Parameter Registry) —— 单一真源。
 *
 * 对应 docs/14-game-balance-and-math.md §11（P001–P037）+ 05/06/08/09 各机制参数。
 * 所有"魔法数字"集中于此：带默认值 + 量纲。sim 系统纯函数 (state, input, params, rng) 消费之。
 * 蒙特卡洛调参（docs/17 §6）以此为搜索空间：在 range 内搜索满足目标代理指标的组合。
 *
 * 设计铁律（14 §0.1）：凡人恒弱 / 险而可破 / 可调可测。
 * 量纲见 14 §1（HP 0–100、丹毒 0–100、灵气 0–100、药性毫点、火候 0–100）。
 */

export interface BalanceParams {
  /** 时间（docs/14 §1：game-day 为基准单位） */
  time: {
    ticksPerDay: number; // 一个游戏日 = 多少逻辑 tick（30 TPS）
    daysPerSeason: number; // 28（对齐星露谷）
    seasonsPerYear: number; // 4
  };

  /** 玩家（docs/09 §1.1 七阶；docs/14 §8） */
  player: {
    stageMaxHp: number[]; // 7 阶 maxHP：100/110/125/145/170/200/250（凡人恒弱：缓涨）
    staminaCap: number; // 100
    tillStaminaCost: number; // 8
    waterStaminaCost: number; // 2
    channelStaminaCost: number; // 5（供灵）
  };

  /** 丹毒（docs/06 §1 / 14 §3） */
  pillPoison: {
    cap: number; // 100（满即暴毙）
    softCapThreshold: number; // 0.7（开始负面状态）
    decayBase: number; // 2.0 P/日（14 P005，R8 已统一为/日）
    detoxPillBonusMax: number; // 净毒丹加成上限
    restBonusMax: number; // 静室休息排毒上限
    rawEatMultBase: number; // 0.8（14 P006）
    rawEatMultStageSlope: number; // 0.4（14 P007，高阶草更致命）
    poisonResistCap: number; // 0.3（凡骨永远封顶）
  };

  /** 灵气（docs/14 §2 / 08） */
  qi: {
    regenBase: number; // 1.5 Q/日（14 P001）
    qiDecayPerDay: number; // 0.5（14 P004）
    veinMultiplier: { normal: number; remnant: number; vein: number }; // 1.0/3.0/6.0
  };

  /** 灵草生长（docs/08 §2 / 14 §4） */
  growth: {
    qiFactorCap: number; // 2.0（14 P009，过载奖励）
    qiOptimum: number; // 50（08，理想灵气）
    soilFactorMin: number; // 0.3（14 P010，贫瘠下限）
    fertilityOptimum: number; // 80
    fertilityDrain: number; // 2/日/株
    baseTillFertility: number; // 60
    continuousPenaltyRate: number; // 0.5/季
    rotationRecoverBonus: number; // 20
    overripeDecay: number; // 3/日
    seasonOptimalBonus: number; // 1.5
    seasonWeakPenalty: number; // 0.5
  };

  /** 鲜度（docs/08 §7.4） */
  freshness: {
    decayPerDay: number; // 1
    cabinetMultiplier: number; // 0.3
  };

  /** 天劫（docs/05 / 14 §5–6） */
  lightning: {
    targeting: {
      metalAttractCoef: number; // 0.8/tier（14 P012）
      arrayRedirect: number; // 4.0（引雷阵，乘性，14 §5.2）
      arrayInsulate: number; // 0.3（绝缘阵，乘性削弱）
      playerProximityCoef: number; // 0.4（14 P015）
      noise: number; // 0.1（14 P016）
      playerTargetBias: number; // 1.2
      epicenterWeight: number; // 0.5
      repeatHitWindow: number; // 5s
      repeatDecay: number; // 0.5
    };
    damage: {
      base: number; // 12（14 P017，R9）
      stageSlope: number; // 8（14 P018）
      arrayReductionRedirect: number; // 0.6
      pillMitigationWard: number; // 0.4（14 P020）
      terrainAmplifyWater: number; // 1.3
      oneShotProtectMaxStage: number; // 2（OSI 仅 stage≤2）
    };
    tempering: {
      effBase: number; // 1.1（14 P022）
      effStageSlope: number; // -0.1（14 P023，后期效率下降）
      nearDeathPeak: number; // 2.5（14 P024，控血峰值）
      nearDeathPeakBand: number; // 0.10（14 P025）
      nearDeathSafe: number; // 0.6（14 P026，安稳惩罚）
      exposureDirect: number; // 1.0
      exposureInsulated: number; // 0.5
      exposureRod: number; // 0.25
      perfectBlockWindow: number; // 0.25s
      perfectBlockQualityBonus: number; // 1.5
    };
  };

  /** 突破（docs/09 / 14 §8） */
  breakthrough: {
    xCap: number[]; // 7 阶修为上限（毫点）：100k/200k/400k/700k/1.1M/1.6M/2.2M
    tTribBase: number; // 7 日准备窗（14 P028，R2 日级准备+秒级临战）
    successBase: number; // 0.5
    successPrepBonus: number; // 0.15
    successPoisonPenalty: number; // -0.20（14 P030）
    successXSurplus: number; // 0.10
    madnessCap: number; // 100
    harvestCultivationPerTier: number; // 收获灵草→偷天诀吸收的修为/阶（毫点，docs/09 §1）
  };

  /** 天象（docs/07 / 14 §7） */
  celestial: {
    eventGateProbability: number; // 0.25/日（14 P032，平均 4 日一事件）
  };

  /** 炼丹（docs/06 / 14 §9） */
  alchemy: {
    explosionThresholdBase: number; // 14（14 P034，R7 = 14+2×stage）
    explosionThresholdStageSlope: number; // 2
    balanceNorm: number; // 20（14 P035）
    conflictRatio: number; // 0.6（ConflictThreshold = Explosion × 0.6）
  };

  /** 死亡（docs/16 §7 / 20 D-03 混合制 C） */
  death: {
    liquidLossFraction: number; // 0.5（丹药/材料损失）
    qiLossFraction: number; // 0.5（当前阶段修为折损）
    retainTemperingFraction: number; // 0（混合制 C：修为折损非保留淬体）
  };
}

/**
 * 默认平衡参数。对应 docs/14 §11 注册表 + 各机制文档默认值的统一收口（经 20 R1–R10 对齐）。
 * 这是蒙特卡洛调参的起点 θ₀。
 */
export const DEFAULT_BALANCE: BalanceParams = {
  time: { ticksPerDay: 900, daysPerSeason: 28, seasonsPerYear: 4 },
  player: {
    stageMaxHp: [100, 110, 125, 145, 170, 200, 250],
    staminaCap: 100,
    tillStaminaCost: 8,
    waterStaminaCost: 2,
    channelStaminaCost: 5,
  },
  pillPoison: {
    cap: 100,
    softCapThreshold: 0.7,
    decayBase: 2.0,
    detoxPillBonusMax: 2.0,
    restBonusMax: 1.0,
    rawEatMultBase: 0.8,
    rawEatMultStageSlope: 0.4,
    poisonResistCap: 0.3,
  },
  qi: {
    regenBase: 1.5,
    qiDecayPerDay: 0.5,
    veinMultiplier: { normal: 1.0, remnant: 3.0, vein: 6.0 },
  },
  growth: {
    qiFactorCap: 2.0,
    qiOptimum: 50,
    soilFactorMin: 0.3,
    fertilityOptimum: 80,
    fertilityDrain: 2,
    baseTillFertility: 60,
    continuousPenaltyRate: 0.5,
    rotationRecoverBonus: 20,
    overripeDecay: 3,
    seasonOptimalBonus: 1.5,
    seasonWeakPenalty: 0.5,
  },
  freshness: { decayPerDay: 1, cabinetMultiplier: 0.3 },
  lightning: {
    targeting: {
      metalAttractCoef: 0.8,
      arrayRedirect: 4.0,
      arrayInsulate: 0.3,
      playerProximityCoef: 0.4,
      noise: 0.1,
      playerTargetBias: 1.2,
      epicenterWeight: 0.5,
      repeatHitWindow: 5,
      repeatDecay: 0.5,
    },
    damage: {
      base: 12,
      stageSlope: 8,
      arrayReductionRedirect: 0.6,
      pillMitigationWard: 0.4,
      terrainAmplifyWater: 1.3,
      oneShotProtectMaxStage: 2,
    },
    tempering: {
      effBase: 1.1,
      effStageSlope: -0.1,
      nearDeathPeak: 2.5,
      nearDeathPeakBand: 0.1,
      nearDeathSafe: 0.6,
      exposureDirect: 1.0,
      exposureInsulated: 0.5,
      exposureRod: 0.25,
      perfectBlockWindow: 0.25,
      perfectBlockQualityBonus: 1.5,
    },
  },
  breakthrough: {
    xCap: [100_000, 200_000, 400_000, 700_000, 1_100_000, 1_600_000, 2_200_000],
    tTribBase: 7,
    successBase: 0.6, // 调参器自动发现：0.6 比 0.5 更贴目标（stage 1.88→2.00, fitness −1.55→−1.30）
    successPrepBonus: 0.15,
    successPoisonPenalty: -0.2,
    successXSurplus: 0.1,
    madnessCap: 100,
    harvestCultivationPerTier: 5000,
  },
  celestial: { eventGateProbability: 0.25 },
  alchemy: {
    explosionThresholdBase: 14,
    explosionThresholdStageSlope: 2,
    balanceNorm: 20,
    conflictRatio: 0.6,
  },
  death: { liquidLossFraction: 0.5, qiLossFraction: 0.5, retainTemperingFraction: 0 },
};
