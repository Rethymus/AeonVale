# 机制三：动态因果 + 天象奇遇引擎

> 本文设计底层"天象大事件"引擎：周期性触发、权重可种子化、每个事件是**因果链**而非一次性 buff，玩家可对冲/利用。
> 上游宪法：`00-DESIGN-BRIEF.md` §3 核心循环（"贯穿全程的干扰层"）、§5.3、§7（C3 确定性 / C4 可无头测试 / C6 数据驱动）。
> 兄弟文档：事件对天劫倒计时的影响见 `05-mechanic-tribulation.md` §1.3；对灵草生长的影响见 `08-farming-system.md` §2；对资源经济的影响见 `16-economy.md`；事件内容表见 `15-content-tables.md`。

---

## 0. 设计意图

天象是**贯穿全程的干扰层**，调制核心循环。它服务三个目标：

1. **打破节奏单调**：种田→炼丹→天劫的固定循环，靠天象注入不可预测性。
2. **强化凡人挣扎感**：玩家无法阻止大势（天骄降世、灾年、魔修过境），但可"对冲/利用"——这是"蝼蚁偷生"叙事的核心载体。
3. **制造记忆点**：每个事件都是一段独立故事（连夜守田、舔包、囤粮过冬），高 эмоционаemachine 记忆密度。

**核心原则**：事件是**因果链**，不是一次性 buff。一个事件触发后，会引发一连串连锁后果，玩家在每个阶段都可介入。

---

## 1. 权重事件引擎（底层）

### 1.1 周期性触发

引擎以固定间隔（`EventCheckInterval`，默认 1 游戏日）检查是否触发新事件：

```
every EventCheckInterval:
    if activeEventCount < MaxConcurrentEvents:
        roll = rng.nextFloat01()    // seed = hash(worldSeed, dayCount)
        if roll < EventTriggerProbability(season, stage, history):
            event = sampleEvent(buildWeightTable(...), rng)
            startEvent(event)
```

- `【可调参数】EventCheckInterval`（默认 1 游戏日）—— 检查间隔。
- `【可调参数】MaxConcurrentEvents`（默认 2）—— 同时活跃事件上限（防堆叠过载）。
- `【可调参数】BaseTriggerProbability`（默认 0.35）—— 基础触发概率/日。

### 1.2 权重表构造（可种子化，C3）

每次检查时构建候选事件权重表：

```
Weight(event) = BaseWeight(event)
              + SeasonModifier(event, currentSeason)
              + StageModifier(event, currentStage)
              + HistoryModifier(event, eventHistory)
              + CooldownModifier(event, lastTriggeredDay)
              + ChainModifier(event, activeEvents)   // 事件联动
```

各项语义：

**(a) `BaseWeight(event)`** —— 事件固有稀有度。
- 喜/常态事件权重高（如 `天骄降世` base=10）。
- 悲/危机事件权重中（如 `灵气枯竭` base=6）。
- 罕见强事件权重低（如 `天谴余波` base=2）。

**(b) `SeasonModifier`** —— 季节适配。
- `灵气枯竭`：冬季权重 ×2（冬为枯候）。
- `灵雨`：春夏权重 ×2。
- `雷暴`：夏秋权重 ×1.5。

**(c) `StageModifier`** —— 玩家进度门控。
- 高危事件（`魔修过境`、`天谴余波`）在 stage ≤ 1 时权重 ×0（保护新手）。
- stage ≥ 3 时解锁更多事件类型。

**(d) `HistoryModifier`** —— 防重复与调节。
- 最近触发过的事件权重 ×`RecentEventSuppress`（默认 0.3），防止短期重复。
- 长期未触发的事件权重 ×`NeglectBoost`（默认 1.5，超 30 天未触发）。

**(e) `CooldownModifier`** —— 每事件有 `MinIntervalDays`（如灾年 60 天冷却），冷却内权重 = 0。

**(f) `ChainModifier`** —— 事件联动（见 §5）。
- 如 `灵气枯竭` 活跃时，`魔修过境` 权重 ×1.5（灾年魔修更易劫掠）。

### 1.3 采样

```
event = sample(events, normalize(WeightTable), rng)
```

所有 `rng` 调用 seed = `hash(worldSeed, dayCount, checkId)`。无头测试可完整复现事件序列。

### 1.4 预告机制

事件分**有预告**与**无预告**两类：
- **有预告（Forecasted）**：触发前 1–3 天显示"天象异动"提示（如"东方有黑云压境"），给玩家准备时间。多用于重大事件（灾年、魔修）。
- **无预告（Sudden）**：触发即生效，制造突发性。多用于局部小事件（游方散仙路过）。

- `【可调参数】ForecastLeadDays(event)`（默认 灾年=3, 魔修=2, 灵雨=0）。

---

## 2. 因果链设计（事件状态机）

### 2.1 状态机模型

每个事件是一个有限状态机 (FSM)：

```
States: Preview → Active → Climax → Resolution → Aftermath → Expired
```

| 状态 | 语义 | 玩家可介入 |
|------|------|----------|
| Preview | 预告期，异象显现，事件未生效 | 准备（抢收、布阵、囤丹） |
| Active | 事件主体效果持续 | 应对（守田、避战、舔包） |
| Climax | 关键节点（如妖兽群冲击农田） | 极限操作 |
| Resolution | 事件结束，后果结算 | — |
| Aftermath | 残留影响（如灾年后土壤贫瘠 N 天） | 恢复 |
| Expired | 完全清除 | — |

### 2.2 因果链建模

每个事件定义一条 `Stages: List<EventStage>`，每阶段有：

```
EventStage {
  Duration: game days
  Effects: List<Modifier>     // 对农场/玩家/经济的修改
  PlayerActions: List<Action> // 该阶段玩家可采取的应对
  BranchConditions: List<(cond, nextStage)>  // 玩家行动可分叉因果
}
```

玩家行动可改变下一阶段走向——这是"凡人对冲大势"的机制化。

---

## 3. 事件目录

每个事件标 `喜 / 悲 / 危 / 机` 四象标签（可多标签）。

### 3.1 `天骄降世 Genius Descends`（喜 + 机）

**叙事**：远方有大能突破引发灵气潮汐，山谷受惠。

**因果链**：
1. **Preview (2 天)**：远方霞光，灵气浓度缓升。
2. **Active (3 天)**：`灵气潮汐 QiTide` —— 全场灵草生长速度 ×2（见 `08-farming-system.md` §2）。`灵雨` 子效果触发。
3. **Climax (1 天)**：灵草成熟引來 `妖兽群 BeastSurge`（3–5 只妖兽抢食，进入连夜守田小关卡）。
   - 玩家行动：战斗/驱赶（消耗丹药/HP）/牺牲外围灵草引开。
4. **Resolution**：妖兽退去，存活灵草品质 +1。
5. **Aftermath (5 天)**：残留灵气，炼丹成功率 +10%。

**应对策略**：
- 提前抢收成熟灵草（避免被妖兽吃）。
- 在外围种"诱饵草"（廉价快熟的，给妖兽吃）。
- 备好驱兽丹 / 战斗用雷符。

**数值钩子**：
- `QiTideGrowthMultiplier`（默认 2.0）
- `BeastSurgeCount`（默认 3–5，随 stage 缩放）
- `BeastDamageToHerb`（默认 1 成熟度/击）
- `AftermathAlchemyBonus`（默认 0.10）

### 3.2 `灵气枯竭 / 灾年 Spirit Famine`（悲 + 机）

**叙事**：天地闭合，灵气断绝。

**因果链**：
1. **Preview (3 天)**：天色灰暗，灵草生长放缓。
2. **Active (10 天)**：`灵气断绝 QiSeverance` —— 灵草停止生长甚至枯萎（生长度每日 `-FamineDecayRate`）。灌溉无效（无灵气可吸）。丹炉难以起火（火候上限降）。
3. **Climax**：无固定 climax，但 `魔修过境` 联动概率大增（ChainModifier）。
4. **Resolution**：灵气缓慢恢复。
5. **Aftermath (15 天)**：土壤肥力受损（`SoilFertility -20`），需补肥。

**应对策略**：
- **囤粮**：灾年前抢收，靠存粮（普通食物 + 储备丹药）熬过。
- **挖灵脉**：灾年期间地下灵脉露头（唯一好处），可挖掘获灵气结晶（应急灵气源）+ 一次性 `-VeinDetoxPower` 丹毒（见 `06-...md` §1.2）。
- **靠存丹**：提前炼好净毒丹、生骨丹度过断灵期。

**数值钩子**：
- `FamineDuration`（默认 10 天）
- `FamineDecayRate`（默认 2 成熟度/天）
- `QiSeveranceFurnacePenalty`（默认 火候上限 -30）
- `VeinExposureCount`（默认 2–4 处）
- `SoilFertilityAftermathLoss`（默认 20）

### 3.3 `魔修过境 Demonic Cultivator Raid`（危 + 机）

**叙事**：正魔交战波及山谷。

**因果链**：
1. **Preview (2 天)**：天空血色，远处雷鸣。
2. **Active (2 天)**：战场波及——随机 2–4 格农田被战斗余波摧毁（灵草全毁，土壤变焦土）。战场边缘掉落 `破损法宝 BrokenArtifact` 与 `劫灰 TribulationAsh`（舔包）。
3. **Climax (1 天)**：偶有受伤魔修闯入农庄，玩家选择：
   - 藏匿（无奖励但安全）。
   - 救助（消耗丹药，后续或得报答）。
   - 趁火打劫（高奖励但风险走火入魔）。
4. **Resolution**：魔修离去。
5. **Aftermath**：焦土需翻新（消耗资源）才能复种；破损法宝可修复为强力道具（长线投资）。

**应对策略**：
- 提前在边界布"防御阵"减少波及格数。
- 冒险舔包 vs 明哲保身的取舍。
- 救助/打劫的道德选择影响后续叙事（见 `02-narrative-bible.md`）。

**数值钩子**：
- `RaidAffectedTiles`（默认 2–4）
- `LootDropChance`（默认 0.6）
- `BrokenArtifactRarity`（默认 rare）
- `CultivatorEncounterProb`（默认 0.4）

### 3.4 新增事件（设计 5 个）

#### 3.4.1 `异象种子天降 Anomalous Seed Fall`（机 + 喜）

**叙事**：天外陨星坠落，带来未知灵草种子。

**因果链**：
1. **Preview (0 天，突发)**：夜空流星，落地巨响。
2. **Active (1 天)**：陨石坑出现，可挖掘获 `异象种子 AnomalousSeed`（珍稀/未知品种，种后产出随机药性，可能是新丹方材料）。
3. **Climax**：陨石坑散发 `辐射灵气 ResidualQi`，周围灵草短期内异变（药性偏移 ±1）。
4. **Resolution**：辐射消散。
5. **Aftermath**：异象种子若成功培育，解锁新丹方链。

**应对**：冒险早挖（辐射伤 HP）vs 等消散（种子可能被其他生物抢走）。

**数值钩子**：`AnomalousSeedCount`(1-2), `RadiationDamage`(5 HP/s), `MutationRadius`(3 格), `MutationDuration`(3 天).

#### 3.4.2 `游方散仙交易 Wandering Cultivator Trade`（机，常态）

**叙事**：偶尔有散修路过山谷，愿意交易。

**因果链**：
1. **Preview (1 天)**：山道有人影。
2. **Active (1 天)**：散仙驻足，开放交易界面（可用灵草/丹药换稀有材料/丹方碎片/储物戒升级）。
3. **Resolution**：散仙离去（若未交易则错过）。
4. **Aftermath**：无。

**变体**：黑心散仙（高价）、诚心散仙（公道但货少）、神秘散仙（卖禁忌物但加 `天道注视 HeavenlyScrutiny` 值）。

**应对**：辨别类型（看装备/对话）决定交易深度；警惕禁忌物带来的天劫加成。

**数值钩子**：`WandererTypeWeights`(诚实40%/黑心40%/神秘20%), `TradeSlotCount`(3-5), `HeavenlyScrutinyGain`(神秘物品+5).

#### 3.4.3 `守田兽归巢 Guardian Beast Returns`（机 + 危）

**叙事**：妖兽潮后，一只受伤幼兽在田埂附近徘徊。传统体修不走正统驭兽术，但主角以现代"看门守院"思路喂养、训练，让它巡守灵草田。

**因果链**：
1. **Preview (1 天)**：田边有足印与低鸣，守田兽未直接现身。
2. **Active (3 天)**：幼兽会偷食低阶灵草；玩家可用废丹、凡食或妖兽内丹投喂，逐步建立巡逻路线。
3. **Climax**：第 3 天决定——驱赶（保守止损）、击杀（获 `妖兽内丹 BeastCore`）、驯养（长期守田资产）。
4. **Aftermath**：驯养成功后解锁 `守田兽巡逻位`，可降低妖兽潮啃田损失；它不提供正统驭兽战斗体系，也不替代阵法。

**应对**：权衡短期材料 vs 长期农场防线；避免把守田兽写成灵修宗门的驭兽路线。

**数值钩子**：`BeastHerbPerDay`(1-2 株), `GuardianFeedCost`(3 次投喂), `GuardianPatrolReduction`(妖兽啃田损失 -30%).

#### 3.4.4 `体修遗迹 Body Cultivator Ruin`（机 + 危）

**叙事**：没落体修没有当世宗门，传承多散落在世家藏书、破败遗迹、前辈坐化地或大能传承之所。玩家发现的不是完整门派，而是一处残缺炼体试炼。

**因果链**：
1. **Preview (2 天)**：山谷边缘露出古旧石碑，碑文只剩"炼骨"、"雷池"等残字。
2. **Active (1 天)**：探索遗迹，承受机关、重压、幻痛等体修试炼；成功得 `体修残页 BodyManualFragment`、淬体丹方或阵法残谱。
3. **Climax**：玩家可选择浅探（低风险少奖励）、深探（HP/丹毒高压）、临摹妖兽骨纹（高悟性收益，失败受伤）。
4. **Aftermath**：遗迹坍塌或沉寂，留下劫灰/石材，可作为阵法材料。

**应对**：备足生骨丹和净毒丹；把体修传承设计成奇遇与残篇拼接，而非加入体修宗门。

**数值钩子**：`RuinTrialDamage`(20-60 HP), `BodyFragmentDropChance`(0.8), `InsightBonusChance`(0.25), `RuinCollapseLoot`(1-3 件).

#### 3.4.5 `灵脉异动 Spirit Vein Shift`（机 + 危）

**叙事**：地下灵脉迁移，改变农场灵气分布。

**因果链**：
1. **Preview (2 天)**：地面微震，水井水位变化。
2. **Active (5 天)**：地图上某些区域 `灵气浓度 QiDensity` 大增（灵脉新过此处），另一些区域骤降。原有布局可能失效（高灵气区转移）。
3. **Climax**：玩家可选择挖掘新灵脉露头（获灵气结晶，但破坏地形）或顺应（迁移种植区）。
4. **Aftermath (10 天)**：新灵气分布稳定，需重新规划农庄布局。

**应对**：迁移核心药草区到新高灵气带；利用旧低灵气带种避雷草（金属草不需高灵气）。

**数值钩子**：`VeinShiftMagnitude`(±50% QiDensity), `HighQiZoneCount`(1-2), `LowQiZoneCount`(1-2), `CrystalLootPerDig`(2-4).

#### 3.4.6 `大限将近 Lifespan Limit Nears`（悲 + 危）

**叙事**：无灵根凡人的肉身会老、会衰。体修每次突破都能延寿，但若拖延太久，大限先一步逼近，天道也会借此催讨因果。

**因果链**：
1. **Preview (7 天)**：气血衰败，训练后恢复变慢，HUD 显示寿元警戒。
2. **Active (持续)**：`LifespanLimitRemaining` 每日下降；训练收益与 HP 恢复降低，`HeavenDebt` 催讨权重上升。
3. **Climax**：玩家选择主动引劫搏命、消耗稀有延寿灵物拖延，或继续囤资源承受更强催讨。
4. **Resolution**：突破成功则延寿并清除警戒；失败或拖到 0 则进入死亡/转世判定。

**应对**：大限不是单纯惩罚，而是逼迫玩家在"准备更充分"与"越拖越被天道收债"之间下注。

**数值钩子**：`LifespanWarningDays`(30), `AgingTrainingPenalty`(-20%), `AgingRestPenalty`(-30%), `HeavenDebtFromDelay`(+1/日).

#### 3.4.7 `天谴余波 Heavenly Wrath Aftershock`（危，罕见）

**叙事**：远处有大能逆天失败，天道余波扫荡。

**因果链**：
1. **Preview (0 天)**：天空血红，诡异寂静。
2. **Active (1 天)**：天道催讨倒计时**立即注入** `-InjectSeconds`（见 `05-...md` §1.3，默认 -30 s），强迫玩家提前面对雷劫！同时全场灵草药性暂时紊乱（±1 偏移）。随机 1 格农田被"天罚"摧毁。
3. **Resolution**：余波过。
4. **Aftermath**：被毁格变"天罚之地"，N 天内不可种植，但可挖掘获 `天罚之灰 DivineAsh`（极稀有炼丹材料，用于走火丹）。

**应对**：几乎无法阻止，只能即时调整——主动引劫体系要求玩家始终保持"准渡劫"状态（阵法常备、丹药常储），否则拖欠因果会被天道催讨。

**数值钩子**：`TribulationInjectSeconds`(30), `PropertyChaosMagnitude`(1), `DivinePunishmentTileCount`(1), `DivineAshYield`(1-2).

---

## 4. 玩家能动性（凡人对冲大势）

每个事件都给玩家**至少 2 种应对路径**，且都有代价：

| 事件 | 路径 A（保守） | 路径 B（冒险） | 路径 C（投机） |
|------|--------------|--------------|--------------|
| 天骄降世 | 抢收躲妖兽 | 主动猎妖获内丹 | 种诱饵草引妖 |
| 灵气枯竭 | 囤粮熬过 | 挖灵脉获结晶 | 灾年炼走火丹（极端药性易得） |
| 魔修过境 | 藏匿 | 舔包 | 救助/打劫 |
| 异象种子 | 等辐射消散 | 早挖伤 HP | — |
| 守田兽归巢 | 驱赶止损 | 击杀取内丹 | 驯养巡田 |
| 体修遗迹 | 浅探取残页 | 深探搏传承 | 临摹妖兽骨纹 |
| 灵脉异动 | 迁移顺应 | 挖掘获结晶 | — |
| 大限将近 | 稀有灵物拖延 | 主动引劫搏命 | 继续囤资源承受催讨 |
| 天谴余波 | 硬扛提前劫 | 挖天罚之地 | — |

**设计原则**：路径无对错，只有效用与风险权衡。这呼应"蝼蚁偷生"叙事——玩家始终在选择"如何被骗取生机"。

---

## 5. 事件间联动（ChainModifier）

事件可叠加/连锁：

- **灾年 + 魔修过境**：灾年中魔修更易劫掠（权重 ×1.5），且农田被毁后果加倍（已脆弱）。
- **天骄降世 + 守田兽归巢**：灵气潮汐吸引幼兽靠近农田，也让守田兽成长更快（更早 climax）。
- **体修遗迹 + 大限将近**：大限压力提高玩家冒险深探遗迹的收益诱惑；失败会让寿元线更紧。
- **灵脉异动 + 灵气枯竭**：灵脉迁移可能"恰好"绕开枯竭区，给玩家一线生机（罕见好联动）。
- **天谴余波 + 任意**：天谴余波的提前渡劫会打断其他事件的 Active 阶段（优先级最高）。

联动建模在 `ChainModifier(event, activeEvents)`，数据驱动（`15-content-tables.md` 的事件联动表）。

---

## 6. 数值钩子汇总（移交 14-...md 与 15-...md）

| 钩子 | 默认 | 事件 | 语义 |
|------|------|------|------|
| `EventCheckInterval` | 1 游戏日 | 引擎 | 检查间隔 |
| `MaxConcurrentEvents` | 2 | 引擎 | 并发上限 |
| `BaseTriggerProbability` | 0.35 | 引擎 | 基础触发概率 |
| `RecentEventSuppress` | 0.3 | 引擎 | 近期事件压制 |
| `NeglectBoost` | 1.5 | 引擎 | 长期未触发加成 |
| `ForecastLeadDays` | 事件特定 | 引擎 | 预告天数 |
| `QiTideGrowthMultiplier` | 2.0 | 天骄降世 | 生长倍率 |
| `BeastSurgeCount` | 3–5 | 天骄降世 | 妖兽数量 |
| `AftermathAlchemyBonus` | 0.10 | 天骄降世 | 后续炼丹加成 |
| `FamineDuration` | 10 天 | 灵气枯竭 | 持续 |
| `FamineDecayRate` | 2 成熟度/天 | 灵气枯竭 | 灵草衰减 |
| `QiSeveranceFurnacePenalty` | -30 | 灵气枯竭 | 炉火上限 |
| `VeinExposureCount` | 2–4 | 灵气枯竭 | 灵脉露头 |
| `SoilFertilityAftermathLoss` | 20 | 灵气枯竭 | 土壤损耗 |
| `RaidAffectedTiles` | 2–4 | 魔修过境 | 波及格 |
| `LootDropChance` | 0.6 | 魔修过境 | 掉落概率 |
| `BrokenArtifactRarity` | rare | 魔修过境 | 法宝稀有度 |
| `CultivatorEncounterProb` | 0.4 | 魔修过境 | 受伤魔修遭遇 |
| `AnomalousSeedCount` | 1–2 | 异象种子 | 种子数 |
| `RadiationDamage` | 5 HP/s | 异象种子 | 辐射伤 |
| `MutationRadius` | 3 格 | 异象种子 | 异变范围 |
| `WandererTypeWeights` | 40/40/20 | 游方散仙 | 类型分布 |
| `HeavenlyScrutinyGain` | +5 | 游方散仙 | 神秘物注视 |
| `BeastHerbPerDay` | 1-2 | 守田兽 | 未驯养期啃食量 |
| `GuardianFeedCost` | 3 次投喂 | 守田兽 | 驯养成本 |
| `GuardianPatrolReduction` | -30% | 守田兽 | 妖兽啃田损失减免 |
| `RuinTrialDamage` | 20-60 HP | 体修遗迹 | 试炼伤害 |
| `BodyFragmentDropChance` | 0.8 | 体修遗迹 | 体修残页掉落率 |
| `VeinShiftMagnitude` | ±50% | 灵脉异动 | 灵气偏移 |
| `LifespanWarningDays` | 30 天 | 大限将近 | 寿元预警窗口 |
| `HeavenDebtFromDelay` | +1/日 | 大限将近 | 拖延引发的天道催讨 |
| `TribulationInjectSeconds` | 30 | 天谴余波 | 提前注入 |
| `PropertyChaosMagnitude` | 1 | 天谴余波 | 药性紊乱 |
| `DivineAshYield` | 1–2 | 天谴余波 | 天罚灰产量 |

---

## 7. 算法步骤（轻量伪代码）

```
function eventEngineTick(dayCount, worldSeed, gameState):
    if activeEvents.size() >= MaxConcurrentEvents: return
    rng = PRNG(hash(worldSeed, dayCount))
    if rng.nextFloat01() >= EventTriggerProbability(...): return
    weights = {}
    for evt in EventCatalog:
        if cooldownActive(evt, dayCount): continue
        if stageGate(evt, gameState.stage): continue
        weights[evt] = computeWeight(evt, gameState, activeEvents)
    chosen = sample(weights, rng)
    if chosen.forecastDays > 0:
        scheduleForecast(chosen, dayCount + chosen.forecastDays)
    else:
        startEvent(chosen)

function advanceEvent(event, dt):
    stage = event.currentStage
    applyEffects(stage.effects, gameState)
    for action in stage.playerActionsOffered: offerToPlayer(action)
    if stage.duration elapsed:
        next = resolveBranch(stage, playerChoices)
        event.transitionTo(next)
```

确定性（C3）：所有随机走 `rng`，无头测试可复现整局事件序列。

---

## 8. 边界情况

- **事件 + 天劫同时**：若事件 Active 期间触发天劫，事件效果在天劫期间冻结（`TribulationPhase` 优先），天劫结束后恢复。例外：`天谴余波` 直接触发天劫（最高优先级）。
- **玩家死亡时事件**：事件继续在后台 tick（世界不因玩家死而停），软重置后玩家面对的可能是事件的 Aftermath。
- **存档加载**：事件 FSM 状态完整序列化（见 `11-data-model.md`），加载后从原 state 继续。
- **事件与季节边界**：跨季节的事件，SeasonModifier 按当前日重新计算。
- **多个 forecast 同时**：UI 顶部并列显示多个天象预告图标。

---

## 9. 开放问题（需主创拍板）

- **Q1**：`天谴余波` 这种"天道催讨提前渡劫"是否过于惩罚？是否给玩家一个"以 HP 换推迟"的赎买选项？本文保留惩罚以维持紧张感。
- **Q2**：事件是否影响叙事分支（救助魔修 → 后续 NPC 关系）？这需要与 `02-narrative-bible.md` 协同设计，可能扩大范围。
- **Q3**：`游方散仙交易` 是否构成游戏内主商店？若是，需配合 `16-economy.md` 经济平衡。
- **Q4**：事件目录规模——MVP 阶段建议先实现 5 个核心事件（天骄/灾年/魔修/异象/游方），其余进阶事件 stage 3+ 解锁。

---

## 参考资料

- [Progression Systems in Roguelite Games - Theseus Thesis（事件/meta 联动设计参考）](https://www.theseus.fi/bitstream/handle/10024/881994/2/Kammonen_Eino.pdf)
- [Meta-progression Thesis - DIVA Portal（事件调节难度曲线）](https://his.diva-portal.org/smash/get/diva2:2072480/FULLTEXT01.pdf)
- [Difficulty Systems in Modern Roguelikes（动态难度与玩家可控性）](https://www.youtube.com/watch?v=mImhJ1PqBgo)
- [How To Set Up Pacing, Difficulty, And Progression（事件节奏）](https://gamedev.net/blogs/entry/2294544-how-to-set-up-pacing-difficulty-and-progression-within-an-infinite-metagame/)
