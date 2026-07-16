/**
  * 平衡参数注册表 (Balance Parameter Registry) —— 单一真源。
 *
  * 对应当前机制参数表。
  * 所有"魔法数字"集中于此：带默认值 + 量纲。sim 系统纯函数 (state, input, params, rng) 消费之。
  * 蒙特卡洛调参以此为搜索空间：在 range 内搜索满足目标代理指标的组合。
 *
  * 设计铁律：凡人恒弱 / 险而可破 / 可调可测。
  * 量纲：HP 0–100、丹毒 0–100、灵气 0–100、药性毫点、火候 0–100。
 */

export interface BalanceParams {
 /** 时间 */
 time: {
 ticksPerDay: number; // 一个游戏日 = 多少逻辑 tick（30 TPS）
 daysPerSeason: number; // 28（对齐星露谷）
 seasonsPerYear: number; // 4
 };

/** 玩家 */
 player: {
 stageMaxHp: number[]; // 7 阶 maxHP：100/110/125/145/170/200/250（凡人恒弱：缓涨）
 staminaCap: number; // 100
 tillStaminaCost: number; // 8
 waterStaminaCost: number; // 2
 channelStaminaCost: number; // 5（供灵）
 };

/** 体修主轴：凡人无灵力，以苦练、丹药与天劫淬体推进。 */
 bodyCultivation: {
 foundationCap: number[]; // 各阶段体魄根基阈值（毫点），沿用旧 xCap 量级
 pushUpGain: number; // 俯卧撑百次：体魄根基毫点
 sitUpGain: number; // 仰卧起坐百次：体魄根基毫点
 squatGain: number; // 深蹲百次：体魄根基毫点
 longRunGain: number; // 十公里长跑：体魄根基毫点
 pushUpStaminaCost: number;
 sitUpStaminaCost: number;
 squatStaminaCost: number;
 longRunStaminaCost: number;
 endurancePerSet: number; // 每组训练耐力成长毫点
 willpowerPerSet: number; // 每组训练意志成长毫点
 tribulationWillpowerDivisor: number; // 天劫淬体收益折算意志
 heavenDebtPerInvoke: number; // 主动引劫增加因果债
 daoAttentionPerInvoke: number; // 主动引劫增加天道注视
 lifespanStartDays: number; // 大限倒计时起点
 lifespanDailyLoss: number; // 每日自然消耗
 lifespanBreakthroughGain: number; // 突破后争回寿元
 };

/** 工具耐久。
  * 工具为可选持有：无工具时凡人徒手操作（动作仍成功，sim 安全：headless bot 不持有工具→零回归）。
  * 持有工具时每次对应动作消耗 1 耐久，归零损毁并反馈；蒙特卡洛可调。 */
 tools: {
 hoeDurability: number; // 铁锈锄（翻地）
 sickleDurability: number; // 镰刀（收获）
 pailDurability: number; // 灵水桶（浇水，"每日限用"→高耐久）
 };

/** 丹毒 */
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

/** 灵气 */
 qi: {
 regenBase: number; // 1.5 Q/日（14 P001）
 qiDecayPerDay: number; // 0.5（14 P004）
 veinMultiplier: { normal: number; remnant: number; vein: number }; // 1.0/3.0/6.0
 };

/** 灵草生长 */
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

/** 鲜度 */
 freshness: {
 decayPerDay: number; // 1
 cabinetMultiplier: number; // 0.3
 };

/** 天劫 */
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
 /** 雷型演化。M5 实现青/紫雷。 */
 bolt: {
 violetUnlockStage: number; // 3
 violetChanceBase: number; // stage=unlock 时的紫雷占比（初现）
 violetChanceSlope: number; // 每阶增量（stage4 紫雷为主）
 violetDamageMult: number; // 1.5
 violetTemperingMult: number; // 1.5
 violetBlastRadius: number; // 2 格（青雷默认 1）
 };
 };

/** 突破 */
 breakthrough: {
 xCap: number[]; // 7 阶修为上限（毫点）：100k/200k/400k/700k/1.1M/1.6M/2.2M
 tTribBase: number; // 7 日准备窗（14 P028，R2 日级准备+秒级临战）
 successBase: number; // 0.5
 successPrepBonus: number; // 0.15
 successPoisonPenalty: number; // -0.20（14 P030）
 successXSurplus: number; // 0.10
 madnessCap: number; // 100
 harvestCultivationPerTier: number; // 收获灵草→偷天诀吸收的修为/阶（毫点）
 };

/** 天象 */
 celestial: {
 eventGateProbability: number; // 0.25/日（14 P032，平均 4 日一事件）
 /** 季节节日：日历强制事件；旧档/测试可 enabled:false 关闭（防御读取 ?? false）。 */
 festivals: { enabled: boolean };
 /** 妖兽潮因果链。 */
 beast: {
 surgeChancePerDay: number; // 灵气潮汐活跃且存在成熟作物时，每日触发妖兽潮的概率
 countMin: number; // 妖兽群最小数量
 countMaxBase: number; // 基础上限：countMax = countMaxBase + stage（随阶段缩放，高阶引更多兽）
 surgeDurationDays: number; // 妖兽潮最多持续天数（无食可吃则提前退去）
 huntStaminaCost: number; // 主动猎妖体力消耗
 huntDamage: number; // 每次猎妖承受的反击伤害（HP 点）
 lootChancePerBeast: number; // 主动猎杀每只妖兽遗留内丹的概率
 seedDropChance: number; // 主动猎杀掉落 ~stage 阶灵草种子的概率
 tameCoreCost: number; // 驯养一只巡守兽需要的妖兽内丹
 tameSpiritStoneCost: number; // 驯养一只巡守兽需要的灵石
 guardBeastLimitBase: number; // 基础巡守兽栏位
 guardBeastLimitStageBonus: number; // 每阶段额外栏位
 guardVigorMax: number; // 巡守兽精力上限
 guardVigorCostPerBlock: number; // 拦截一只来袭妖兽消耗的精力
 guardVigorRecoveryPerDay: number; // 每日恢复精力
 guardFeedVigorGain: number; // 投喂灵草恢复的精力
 guardFeedBondGain: number; // 投喂灵草增加的羁绊
 guardBondGainPerBlock: number; // 成功拦下一只来袭妖兽时增加的羁绊
 guardBondGainPerIncidentAssist: number; // 成功协防一次留世事件时增加的羁绊
 guardBondMax: number; // 巡守兽羁绊上限
 guardBondCostReductionThreshold: number; // 达到该羁绊后巡守更省力
 guardVigorCostReduced: number; // 高羁绊时拦截一只来袭妖兽的精力消耗
 };
 };

/** 炼丹 */
 alchemy: {
 explosionThresholdBase: number; // 14（14 P034，R7 = 14+2×stage）
 explosionThresholdStageSlope: number; // 2
 balanceNorm: number; // 20（14 P035）
 conflictRatio: number; // 0.6（ConflictThreshold = Explosion × 0.6）
 };

/** 死亡 */
 death: {
 liquidLossFraction: number; // 0.5（丹药/材料损失）
 qiLossFraction: number; // 0.5（当前阶段修为折损）
 retainTemperingFraction: number; // 0（混合制 C：修为折损非保留淬体）
 };
}

/**
  * 默认平衡参数。对应 注册表 + 各机制文档默认值的统一收口（经 20 R1–R10 对齐）。
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
 bodyCultivation: {
 foundationCap: [100_000, 200_000, 400_000, 700_000, 1_100_000, 1_600_000, 2_200_000],
 pushUpGain: 1200,
 sitUpGain: 1000,
 squatGain: 1400,
 longRunGain: 2600,
 pushUpStaminaCost: 8,
 sitUpStaminaCost: 8,
 squatStaminaCost: 10,
 longRunStaminaCost: 25,
 endurancePerSet: 700,
 willpowerPerSet: 400,
 tribulationWillpowerDivisor: 12,
 heavenDebtPerInvoke: 3000,
 daoAttentionPerInvoke: 5000,
 lifespanStartDays: 840,
 lifespanDailyLoss: 1,
 lifespanBreakthroughGain: 180,
 },
 tools: {
 hoeDurability: 50, // 铁锈锄
 sickleDurability: 80, // 镰刀
 pailDurability: 200, // 灵水桶（每日限用语义→高耐久，浇水为高频动作）
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
 stageSlope: 10, // 调参器发现：8→10 使终局HP更低→近死淬体加成更高→推进更快（death 仍 0）
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
 bolt: {
 violetUnlockStage: 3, //：stage3 紫雷初现
 violetChanceBase: 0.3, // stage3 紫雷占比 0.3（初现）
 violetChanceSlope: 0.3, // 每阶 +0.3 → stage4=0.6（紫雷为主）/ stage5=0.9 / stage6+=1.0
 violetDamageMult: 1.16, // M5 调参：1.5→1.16。辅助代理 veteran∈[0.75,0.85] 达标、normal 落在 0.30 临界；原值 1.5 见 / 14 §8
 violetTemperingMult: 1.5,
 violetBlastRadius: 2, // 格（青雷=1）
 },
 },
 breakthrough: {
 xCap: [100_000, 200_000, 400_000, 700_000, 1_100_000, 1_600_000, 2_200_000],
 tTribBase: 7,
 successBase: 0.7, // 调参器自动发现：0.6→0.7 使 stage=2.00/brk=1.00（fitness −1.55→−1.30）
 successPrepBonus: 0.15,
 successPoisonPenalty: -0.2,
 successXSurplus: 0.1,
 madnessCap: 100,
 harvestCultivationPerTier: 5000,
 },
 celestial: {
 eventGateProbability: 0.25,
 festivals: { enabled: true }, // 季节节日：默认开；旧档/测试缺字段时防御读取为关
 beast: {
 surgeChancePerDay: 0.35, // 潮汐期间约 1/3 概率/日引兽
 countMin: 3,
 countMaxBase: 5, // countMax = 5 + stage
 surgeDurationDays: 3,
 huntStaminaCost: 20,
 huntDamage: 8,
 lootChancePerBeast: 0.3, // 主动猎杀时约 30%/只遗留内丹
 seedDropChance: 0.5, // 猎妖约 50% 掉落一粒 ~stage 阶种子
 tameCoreCost: 2,
 tameSpiritStoneCost: 4,
 guardBeastLimitBase: 1,
 guardBeastLimitStageBonus: 1,
 guardVigorMax: 3,
 guardVigorCostPerBlock: 1,
 guardVigorRecoveryPerDay: 1,
 guardFeedVigorGain: 2,
 guardFeedBondGain: 10,
 guardBondGainPerBlock: 4,
 guardBondGainPerIncidentAssist: 6,
 guardBondMax: 100,
 guardBondCostReductionThreshold: 50,
 guardVigorCostReduced: 1,
 },
 },
 alchemy: {
 explosionThresholdBase: 14,
 explosionThresholdStageSlope: 2,
 balanceNorm: 20,
 conflictRatio: 0.6,
 },
 death: { liquidLossFraction: 0.5, qiLossFraction: 0.5, retainTemperingFraction: 0 },
};

/**
  * 旧回放/旧存档可能携带历史 BalanceParams 快照，缺少新机制字段。
  * 在 sim 入口统一补默认值，保持旧 fixture 可运行，同时保留调用方显式覆盖。
 */
export function withDefaultBalanceParams(params: BalanceParams): BalanceParams {
 return {
 ...DEFAULT_BALANCE,
 ...params,
 time: { ...DEFAULT_BALANCE.time, ...params.time },
 player: { ...DEFAULT_BALANCE.player, ...params.player },
 bodyCultivation: { ...DEFAULT_BALANCE.bodyCultivation, ...params.bodyCultivation },
 tools: { ...DEFAULT_BALANCE.tools, ...params.tools },
 pillPoison: { ...DEFAULT_BALANCE.pillPoison, ...params.pillPoison },
 qi: {
 ...DEFAULT_BALANCE.qi,
 ...params.qi,
 veinMultiplier: { ...DEFAULT_BALANCE.qi.veinMultiplier, ...params.qi?.veinMultiplier },
 },
 growth: { ...DEFAULT_BALANCE.growth, ...params.growth },
 freshness: { ...DEFAULT_BALANCE.freshness, ...params.freshness },
 lightning: {
 ...DEFAULT_BALANCE.lightning,
 ...params.lightning,
 targeting: { ...DEFAULT_BALANCE.lightning.targeting, ...params.lightning?.targeting },
 damage: { ...DEFAULT_BALANCE.lightning.damage, ...params.lightning?.damage },
 tempering: { ...DEFAULT_BALANCE.lightning.tempering, ...params.lightning?.tempering },
 bolt: { ...DEFAULT_BALANCE.lightning.bolt, ...params.lightning?.bolt },
 },
 breakthrough: { ...DEFAULT_BALANCE.breakthrough, ...params.breakthrough },
 celestial: {
 ...DEFAULT_BALANCE.celestial,
 ...params.celestial,
 festivals: { ...DEFAULT_BALANCE.celestial.festivals, ...params.celestial?.festivals },
 beast: { ...DEFAULT_BALANCE.celestial.beast, ...params.celestial?.beast },
 },
 alchemy: { ...DEFAULT_BALANCE.alchemy, ...params.alchemy },
 death: { ...DEFAULT_BALANCE.death, ...params.death },
 };
}
