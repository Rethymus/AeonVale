# 机制一：天劫倒计时 + 避雷针阵法塔防 + 劫雷淬体

> 本文深挖《偷天换劫诀》引动天劫后的整套"塔防生存 + 淬体突破"玩法，颗粒度到可直接实现。
> 上游宪法：`00-DESIGN-BRIEF.md` §3 核心循环、§5.1、§7 硬约束（C3 确定性 / C4 可无头测试 / C6 数据驱动）。
> 兄弟文档：种田即布防的耦合见 `08-farming-system.md`；抗劫丹药见 `06-mechanic-alchemy.md`；阶段曲线见 `09-progression-system.md`；数值收口见 `14-game-balance-and-math.md`。

---

## 0. 设计意图（为什么这个机制"好玩"）

天劫是全游戏的**肾上腺素锚点**。它把 90% 慢节奏积累的安全感，瞬间压缩进 30–120 秒的极限生存。核心张力来自一个**三方博弈**：

```
        引雷阵/避雷草（保命但慢进度）
               /        \
        硬扛雷（快淬体但可能死）—— 控血丹药（续命但耗资源）
```

- 想推进《偷天换劫诀》→ 必须被雷劈中积累 `TemperingBuff`。
- 但凡骨脆弱 → 必须布阵、种避雷草、嗑抗雷丹来控血。
- 阵法护得太严 → 劈不到你 → 淬体停滞；护得太松 → 一雷归西。

**"种田即布防"**是本作最大的系统涌现卖点：你平时种灵草的布局，直接决定天劫时雷往哪劈。这不是两套独立系统，而是同一张农田地图的双重语义（见 §6 与 `08-farming-system.md` §5）。

---

## 1. 倒计时触发 (Tribulation Countdown Trigger)

### 1.1 触发条件

天劫不是随机事件，而是**功法进度的必然结果**。当玩家当前阶段的 `StageQi`（阶段修为/灵力值，见 `09-progression-system.md`）积累到阶段上限 `StageQiCap(stage)` 时，**强制触发**天劫倒计时。

```
trigger: StageQi >= StageQiCap(currentStage)
         AND not already in Tribulation
```

`StageQi` 来源：劫雷淬体（主要）、稀有丹药（次要）、灵脉共鸣（微弱）。详见 §4.2 与 `09-progression-system.md`。

### 1.2 倒计时时长规则

修为满的瞬间，屏幕正上方出现天劫倒计时 UI（见 §2）。倒计时基础时长随阶段递增，让玩家有越来越长的布防准备期（也越来越多雷要处理）：

```
CountdownSeconds(stage) = BaseCountdown + StageStep * (stage - 1)
```

- `【可调参数】BaseCountdown`（默认 90 s）—— 第一阶天劫准备时长。
- `【可调参数】StageStep`（默认 30 s /阶）—— 每升一阶增加的准备时长。
- `【可调参数】MaxCountdown`（默认 360 s）—— 上限，防止后期过长。

> 设计理由：低阶时玩家阵法/丹药不足，给较短倒计时制造紧迫感但雷少；高阶时玩家工具丰富，给长倒计时让塔防布阵有策略深度。

### 1.3 倒计时期间的天象干预（提前/推迟）

倒计时**默认不可主动取消**（凡人无法拒绝天道），但**动态天象**可以扰动它（见 `07-mechanic-celestial-events.md`）：

- **加速**（`HastenFactor`）：`雷暴天象` 活跃时，倒计时流速 ×（1 + HastenFactor），可提前 10–30%。叙事：天道感应到雷属性灵气浓集，提前降劫。
- **推迟**（`DelayFactor`）：`灵气枯竭/灾年` 期间，倒计时流速 ×（1 − DelayFactor），最多推迟 `MaxDelay` 秒。叙事：天地闭合，连天劫都暂缓。但推迟不是取消——时间一到仍要渡。
- **额外注入**：某些天象（`天谴余波`）直接给倒计时减去 `InjectSeconds`，模拟"天道催讨"。

倒计时流速公式：

```
EffectiveDeltat = RealDeltat * (1 + HastenFactor - DelayFactor)
clamp(EffectiveDeltat, 0.2, 3.0)   // 不允许完全停滞或瞬触发
```

- `【可调参数】HastenFactor`（默认 0.30）—— 雷暴期间倒计时加速比例。
- `【可调参数】DelayFactor`（默认 0.25）—— 灾年期间倒计时减速比例。
- `【可调参数】MaxDelay`（默认 60 s）—— 单次倒计时累计推迟上限。

### 1.4 玩家主动触发（"提前引劫"）

进阶玩法：玩家可在修为未满时，消耗特定丹药（`引雷丹`）或主动激发阵法，**提前触发天劫**。收益：在状态最佳时渡劫、跳过等待；风险：`StageQi` 未满，淬体收益基数低（见 §4.3）。这是高玩技巧，新手默认等满。

```
manual_trigger_allowed: stage >= 2   // 第一阶教学强制走完正常流程
```

---

## 2. 倒计时 UX 与模式切换

### 2.1 倒计时 UI

屏幕正上方居中，天劫倒计时显示为：
- **数字时钟**：`MM:SS`，受 `HastenFactor`/`DelayFactor` 影响时颜色变红（提前）/变蓝（推迟）。
- **劫云聚象**：倒计时数字下方是一团程序化生成的劫云（`TribulationCloud`），随时间推进越来越浓、面积越来越大、内部电弧越来越频繁——这是纯视觉的"压力计"，不传递精确数值但给情绪。
- **预计雷数徽章**：`⚡ × N`，N 由 §5 阶段 scaling 决定，让玩家知道要扛多少发。
- **音轨渐变**：BGM 从慢节奏种田主旋律，随倒计时剩余 < 50% / < 20% 切换到更紧张的变奏。

### 2.2 模式切换：从种田到塔防（关键设计决策）

倒计时归零的瞬间，进入 `TribulationPhase`。**模式切换协议**（建议，需主创拍板，见开放问题 Q1）：

采用 **"硬切换 + 短定格"** 而非"时间冻结"：

1. **归零瞬间**：游戏世界 **定格 1.5 s**（`FreezeDuration`，所有模拟 tick 暂停），画面褪色、劫云炸开、低频雷鸣 SFX、屏幕震动。
2. **定格期间**：弹出半透明提示 `「天劫降临」` + 当前波次信息（`Wave 1/3` 等），玩家不可操作但能看清局势。
3. **定格结束**：进入 **实时塔防生存**——世界恢复 tick，第一道雷开始 targeting（见 §3）。此时玩家可移动、可嗑丹、可激活阵法，但**不可种田/翻地/炼丹/收获**（见 §8 限制）。

> **为什么不完全冻结到玩家准备好？** 因为天劫的张力来自"不可控"。若允许玩家无限准备，就退化成回合制解谜，失去肾上腺素。定格 1.5 s 只给"看清局面"的呼吸，不给"重新布防"的余地——布防必须在倒计时期间完成。

- `【可调参数】FreezeDuration`（默认 1.5 s）—— 模式切换定格时长。
- `【可调参数】WaveIntermission`（默认 4.0 s）—— 多波次之间的喘息间隔（见 §5）。

### 2.3 退出条件

`TribulationPhase` 在以下任一条件满足时结束：
- **成功**：所有波次的雷全部 resolve（无论劈中什么），且玩家存活 → 进入 `BreakthroughPhase`（见 `09-progression-system.md` §3）。
- **失败**：玩家 HP ≤ 0 → 进入死亡/重伤流程（见 §7 与 `09-progression-system.md` §7）。
- **特殊**：`终极紫雷劫池` 有额外通过条件（见 §6）。

---

## 3. 天雷 Targeting 算法（可种子化）

这是塔防玩法的数学核心。**必须确定性可种子化**（C3），无头测试时同一 seed + 同一棋盘状态必须产生完全相同的落雷序列。

### 3.1 候选目标集

每次雷生成时，先构建候选目标集 `Candidates` = 当前农场地图上所有"可被劈中"的格子：

```
Candidates = { tile | tile in FarmGrid AND tile.Strikeable }
```

`Strikeable = true` 的格子包括：农田格（无论是否有作物）、放置的阵法格、玩家当前所在格、储物戒/丹炉等建筑格、裸地。水域和岩壁是否可被劈见 `08-farming-system.md` §5 导电性表（水域高导电会被劈）。

### 3.2 权重公式（核心）

对每个候选格 `t`，计算权重 `W(t)`：

```
W(t) = [ Conductivity(t) 
         + MetalAttraction(t) 
         + ArrayModifier(t) 
         + PlayerProximity(t) 
         + EpicenterBias(t) ]
       * RandomJitter(t, rng)
```

各项语义：

**(a) `Conductivity(t)` —— 地形基础导电性**
来自 `08-farming-system.md` §5 地块导电表。例：

| 地块类型 | Conductivity | 说明 |
|----------|-------------|------|
| 水域/水田 | 1.8 | 强导电 |
| 金属矿脉露头 | 1.5 | 强导电 |
| 湿润泥土 | 1.0 | 基准 |
| 普通农田 | 1.0 | 基准 |
| 干燥沙土 | 0.5 | 弱导电 |
| 岩石地面 | 0.3 | 弱导电 |
| 绝缘垫层（玩家铺设） | 0.1 | 几乎不导电 |

**(b) `MetalAttraction(t)` —— 金属性灵草避雷吸引**
遍历以 `t` 为中心、半径 `RodRadius` 内所有金属性灵草（`MetalAttr` tag），按距离衰减累加：

```
MetalAttraction(t) = Σ_{herb h in RodRadius(t)} h.MetalPower * falloff(dist(t, h))
falloff(d) = max(0, 1 - d/RodRadius)   // 线性衰减
```

- `【可调参数】RodRadius`（默认 3 格）—— 金属性灵草的避雷吸引半径（曼哈顿距离）。
- `【可调参数】MetalPowerBase`（默认 2.0）—— 一株成熟金属性灵草的吸引力（成长度按比例缩放）。

> 这是"金属性灵草作避雷针"的物理化建模——它把雷往自己身上引，保护周围。

**(c) `ArrayModifier(t)` —— 阵法增益/减损**
- 若 `t` 在某个 `引雷阵 (LightningRodArray)` 覆盖圈内：`× RodArrayMultiplier`（强吸引，把雷锁死到阵心）。
- 若 `t` 在某个 `绝缘阵 (InsulationArray)` 覆盖圈内：`× InsulationArrayMultiplier`（趋近 0，雷不劈这里）。
- 多阵法叠加取**乘积**（绝缘阵主导）。

```
ArrayModifier(t) = Π_{arrays A covering t} A.Modifier
```

- `【可调参数】RodArrayMultiplier`（默认 5.0）—— 引雷阵对覆盖格的权重倍率。
- `【可调参数】InsulationArrayMultiplier`（默认 0.05）—— 绝缘阵的减权倍率。

**(d) `PlayerProximity(t)` —— 玩家吸引力**
天道要劈的是渡劫者本人，所以玩家位置有基础吸引力，随距离衰减：

```
PlayerProximity(t) = PlayerBaseAttraction * falloff(dist(t, player))
```

- `【可调参数】PlayerBaseAttraction`（默认 1.5）—— 玩家自身格的额外吸引权重。
- 注意：此值不宜过大，否则阵法无意义；过小则"主动迎雷淬体"不可行。默认 1.5 让玩家格在没有阵法时是高权目标，但金属性草/引雷阵能压制它。

**(e) `EpicenterBias(t)` —— 中心偏置**
雷倾向于劈在农庄核心区（玩家通常把核心药草种在中心）：

```
EpicenterBias(t) = EpicenterWeight * (1 - dist(t, FarmCenter)/MapDiagonal)
```

- `【可调参数】EpicenterWeight`（默认 0.5）—— 中心偏置强度。

**(f) `RandomJitter(t, rng)` —— 可种子化噪声**
每格乘一个 `[1-Jitter, 1+Jitter]` 的随机噪声，由注入的 PRNG（如 SplitMix64 / PCG）生成，seed 来自 `(WorldSeed, TribulationId, StrikeIndex, tile_id)`。这一项保证确定性同时避免雷永远劈同一格。

- `【可调参数】Jitter`（默认 0.15）—— ±15% 随机扰动幅度。

### 3.3 采样与权重归一化

```
W(t) = max(0, W(t))                        // 防负
prob(t) = W(t) / Σ_{t' in Candidates} W(t') 
chosen = sample(Candidates, prob, rng)     // 用同一 PRNG
```

如果所有 `W(t)` 都被绝缘阵压到 0（玩家完美布防——几乎不可能），则 fallback：劈向最近的阵法边界格（"阵法被击穿"），并对该阵法造成结构损伤。

### 3.4 雷的预兆 (Telegraph)

雷一旦选定 `chosen`，**不立即落下**，先在该格显示 **预兆标记** `TelegraphMarker` 持续 `TelegraphSeconds`：

```
TelegraphSeconds(stage) = clamp(BaseTelegraph - stage * TelegraphDecay,
                                MinTelegraph, BaseTelegraph)
```

- `【可调参数】BaseTelegraph`（默认 2.5 s）—— 第一阶预兆时长（教学友好）。
- `【可调参数】TelegraphDecay`（默认 0.2 s/阶）—— 每阶缩短的预兆。
- `【可调参数】MinTelegraph`（默认 1.0 s）—— 高阶最短预兆（极限反应窗口）。

预兆标记视觉：地面浮现金色/紫色阵纹圆圈 + 上升的电弧粒子 + 渐强的电流声。半径 = 该雷的 `BlastRadius`，让玩家看清爆炸范围。

预兆期间玩家可：
- **移动出范围**（dodge，但会失去淬体机会）。
- **站定硬扛**（tank，吃满伤害 + 满淬体收益）。
- **边缘擦弹**（perfect block，见 §4.4）。

预兆结束 → 落雷 resolve → 计算 damage/tempering/溅射。

---

## 4. 劫雷淬体 (TemperingBuff) 与精准控血

### 4.1 命中分类（关键设计）

雷 resolve 时，按 `chosen` 格上有什么，分三类：

| 命中类型 | 触发条件 | 玩家伤害 | 淬体收益 |
|---------|---------|---------|---------|
| **DirectHit（玩家直接中）** | 玩家在 `BlastRadius` 内 | 满额 | **满额**（最高） |
| **RodHit（避雷草/引雷阵代接）** | `chosen` 是金属性草或引雷阵阵心，玩家不在范围内 | 0 | **少量**（见 4.2） |
| **InsulatedHit（绝缘阵减伤）** | 玩家在范围内但该格在绝缘阵内 | 减免后 | 中等（减半） |
| **Miss（空劈）** | `chosen` 是空地，玩家不在范围 | 0 | 0 |

**这是全机制的灵魂**：纯防御（RodHit）安全但淬体慢，纯硬扛（DirectHit）快但可能死。玩家必须在每道雷的预兆窗口里做决策。

### 4.2 淬体收益公式

```
TemperingGain = BaseTempering * ExposureCoeff * StageMultiplier * QualityBonus
```

- `【可调参数】BaseTempering`（默认 10）—— 一次满额淬体的基础值（单位：`StageQi` 点数）。
- `ExposureCoeff`（暴露系数，见下表）—— 命中类型决定。
- `StageMultiplier` —— 高阶雷淬体更多（见 `09-progression-system.md`）。
- `QualityBonus` —— 擦弹/完美抵挡加成（见 §4.4）。

| 命中类型 | ExposureCoeff |
|---------|--------------|
| DirectHit | 1.0 |
| InsulatedHit | 0.5 |
| RodHit | 0.25（金属性草/阵"代你挨"也能传少量淬体——叙事：雷气沿阵传到你身上） |
| Miss | 0 |

### 4.3 伤害公式

```
Damage = bolt.baseDamage(stage) * (1 - InsulationReduction)   // baseDamage(stage)=12+8×stage，见 14 §6.1 / R9
                                       * (1 - WardPillReduction)
                                       * DistanceFactor
                                       * OneShotProtection
```

- 单雷基值 `bolt.baseDamage(stage) = 12 + 8×stage`（stage1=20 … stage7=68；HP 基 100）。**单一真源见 `14` §6.1 / P017–P018**（早期固定 35 已废弃，见 `20` R9）。
- `StageMultiplier` —— 见 §5。
- `InsulationReduction` —— 来自绝缘阵 / 绝缘垫层（0–0.8）。
- `WardPillReduction` —— 来自 `避雷丹` buff（0–0.6，见 `06-mechanic-alchemy.md`）。
- `DistanceFactor` —— 距爆心比例：直接命中=1.0，边缘擦边=0.4。
- `OneShotProtection` —— **防一击必杀保护**：若 Damage ≥ PlayerHP 且 PlayerHP ≥ HPThresholdForOSI，则实际伤害 = PlayerHP − 1，留下 1 血活口（见 §7）。只在低阶（stage ≤ 2）生效，高阶取消保护。

### 4.4 精准控血玩法：擦弹 (Perfect Block)

如果玩家在预兆结束的 ±`PerfectBlockWindow` 秒内，**位于 BlastRadius 边缘 ± margin**（即"刚好擦到边"），触发 PerfectBlock：

- `DistanceFactor` 降为 `PerfectBlockDistanceFactor`（默认 0.3）。
- `QualityBonus = PerfectBlockQualityBonus`（默认 1.5×，满额淬体反而更多！）。
- 视觉：金色时停闪屏 + 清脆钟声。

- `【可调参数】PerfectBlockWindow`（默认 0.25 s）—— 容错窗口。
- `【可调参数】PerfectBlockEdgeMargin`（默认 0.3 格）—— 边缘判定厚度。
- `【可调参数】PerfectBlockDistanceFactor`（默认 0.3）。
- `【可调参数】PerfectBlockQualityBonus`（默认 1.5）。

> 这是高玩技巧：每道雷都擦弹 → 既低伤害又高淬体 → 极速推进功法。但窗口 0.25 s + 多雷并发时极难。这是"险而可破"曲线的体现。

### 4.5 TemperingBuff 的叠加与上限

`TemperingGain` 累加到玩家的 `TemperingStack`（淬体积淀）。该值：
- 单次天劫内**不衰减**。
- 提供 `TemperingBuff`：被动 +X% 灵草感知 / +Y% 丹药吸收 / +Z% 经脉开辟速度（具体效果见 `09-progression-system.md`）。
- 进入 `BreakthroughPhase` 时，`TemperingStack` 转化为 `StageQi` 与经脉开辟进度。
- **硬上限**：`TemperingCap(stage)`，防止单次天劫跳阶。超出部分转入"溢出淬体"，在下一次天劫中提供初始 `StageQi` 加成。

- `【可调参数】TemperingCap(stage)`（默认 = `StageQiCap(stage) * 1.2`）—— 单次天劫淬体上限。
- `【可调参数】OverflowRetention`（默认 0.3）—— 溢出淬体的保留比例。

---

## 5. 阶段 Scaling：从普通雷到紫雷

### 5.1 波次结构

单次天劫由 1–5 个 `Wave` 组成。每波之间有 `WaveIntermission`（4 s）喘息，玩家可移动、嗑丹、看下一波雷数预告。

```
WaveCount(stage) = clamp(1 + floor(stage/2), 1, 5)
```

- 第一阶：1 波，2–3 道雷。
- 第三阶：2 波，每波 3–5 道。
- 终局：5 波，每波 8+ 道。

### 5.2 雷的类型演化

| 出现阶段 | 雷类型 | 特性 |
|---------|--------|------|
| Stage 1–2 | `CyanBolt` 青雷 | 标准，单格 BlastRadius=1 |
| Stage 3–4 | `VioletBolt` 紫雷 | BlastRadius=2，伤害 ×1.5，淬体 ×1.5 |
| Stage 5–6 | `GoldBolt` 金雷 | 穿透绝缘阵（InsulationReduction 减半） |
| Stage 7+ (终局) | `DharmaBolt` 诛仙雷 | 追踪玩家（PlayerProximity ×3），必须靠阵法硬接 |
| 终极紫雷劫池 | `PurpleTribulationPool` | 见 §6 |

- `【可调参数】BoltTypeUnlock(stage)` —— 每种雷解锁的阶段（数据驱动表）。
- `【可调参数】BoltDamageMult(boltType)` —— 各雷伤害倍率（默认 Cyan=1.0, Violet=1.5, Gold=1.8, Dharma=2.5）。
- `【可调参数】BlastRadius(boltType)` —— 爆炸半径（默认 1/2/2/2 格）。

### 5.3 数量与节奏

```
StrikesPerWave(stage) = BaseStrikes + ScalingStrikes * (stage - 1)
StrikeInterval(stage) = max(MinInterval, BaseInterval - stage * IntervalDecay)
```

- `【可调参数】BaseStrikes`（默认 2）—— 第一阶每波雷数。
- `【可调参数】ScalingStrikes`（默认 1）—— 每阶增加的雷数。
- `【可调参数】BaseInterval`（默认 3.0 s）—— 第一阶雷间隔。
- `【可调参数】IntervalDecay`（默认 0.2 s/阶）—— 每阶缩窄的间隔。
- `【可调参数】MinInterval`（默认 0.6 s）—— 极限并发间隔（高阶几乎同时劈）。

---

## 6. 终局：终极紫雷劫池 (Purple Tribulation Pool)

`Stage 7`（飞升前夜）天劫的特殊规则：

- **无波次**：连续 60 s（`PoolDuration`）的持续雷暴，雷数无限生成，按 `StrikeInterval(7)` 节奏。
- **雷池机制**：场上有 `PoolHotspots`（3–5 个紫色阵眼），随机生成在玩家阵法覆盖薄弱处，持续吸引周围雷——玩家必须在劫池期间**移动重布阵**（但只能移动小型阵眼，不能新种草）。
- **通过条件**：不是"扛完所有雷"，而是**在 60 s 内累计达到 `FinalTemperingThreshold`**（默认 = `TemperingCap(7) * 1.5`）。叙事：你必须在雷池中淬体到凡骨崩解的临界点。
- **结局触发**：达到阈值 → 凡骨碎裂过场 → 飞升（通关）。
- **失败**：HP ≤ 0 → 走火入魔结局（见 `09-progression-system.md` §7）。

- `【可调参数】PoolDuration`（默认 60 s）。
- `【可调参数】PoolHotspots`（默认 4）—— 紫色阵眼数量。
- `【可调参数】FinalTemperingThreshold`（默认 = `TemperingCap(7) * 1.5`）。
- `【可调参数】HotspotRearmCost`（默认 1 个 `引雷阵`）—— 重布阵眼的消耗。

---

## 7. 边界情况与失败态

### 7.1 一击必杀保护 (One-Shot Immunity, OSI)

凡骨极脆，第一阶教学时若玩家没布阵/没嗑丹，一道青雷（35 伤）对 100 HP 就是 1/3，但仍可承受。真正风险在 stage 2+。`OneShotProtection`（§4.3）在 stage ≤ 2 时保证玩家至少留 1 血活口一次（每阶冷却一次）。这避免"开局即死"的劝退。

### 7.2 未布阵 / 农田为空

- 完全没阵法、没金属性草：雷完全按 `Conductivity + PlayerProximity + EpicenterBias` 劈，大概率直劈玩家或农田中心 → 高伤害高淬体。教学关会强制玩家在倒计时内至少放一个避雷草。
- 农田为空（刚收获完）：`MetalAttraction = 0`，雷更集中劈玩家和建筑。叙事："灵气散尽，雷直取渡劫者"。

### 7.3 同格多次受击

同一格在短时间（`RepeatHitWindow`，默认 5 s）内被多次选中时，权重 `W` 临时衰减 `RepeatDecay`（默认 0.5），避免"雷永远劈同一个阵心导致阵法瞬间击穿"。

### 7.4 玩家死亡

HP ≤ 0：
- **Stage 1–2**：触发"重伤昏迷"过场，醒来 HP=20%，损失当前 `TemperingStack` 的 50%，`StageQi` 倒退一级（见 `09-progression-system.md` §7 软重置）。不直接 Game Over。
- **Stage 3+**：进入真正的死亡流程，触发对应结局（凡人暴毙 / 走火入魔）。Roguelite 元素的取舍见 `09-progression-system.md` §7。

### 7.5 天劫期间的限制

进入 `TribulationPhase` 后，以下行为**禁用**：
- 种植 / 翻地 / 浇水 / 收获（农田冻结）。
- 进入丹炉界面（炼丹中断）。
- 打开储物戒交易。
- 离开农庄地图。

以下行为**允许**：
- 移动、闪避。
- 使用快捷栏丹药（避雷丹、生骨丹、引雷丹等即时生效）。
- 激活/移动阵眼（仅终局紫雷劫池允许重布）。
- 查看阵法覆盖预览（UI 层）。

---

## 8. 阵法系统（核心创新：种田即布防）

### 8.1 两类阵法

**`引雷阵 LightningRodArray`**
- 功能：把覆盖范围内的雷**锁死到阵心**（`ArrayModifier × 5.0`），代玩家承受。
- 布设：玩家在种田阶段用"阵盘"道具放置，需要一个**金属性灵草作为阵眼**（种在阵心）才能激活。阵眼草被劈中后会受损（生长度倒退或枯萎）。
- 覆盖：半径 `RodArrayRadius`（默认 4 格）的圆形覆盖。
- 损耗：每次代接雷，阵眼草耐久 `-RodDurabilityCost`（默认 25%）；耐久归零阵法失效。

**`绝缘阵 InsulationArray`**
- 功能：把覆盖范围内的格 `Conductivity × 0.05`，几乎不引雷；玩家在内时伤害减免 80%。
- 布设：需要**绝缘材料**（干草、沙土、特殊绝缘矿石）铺设；不依赖灵草。
- 覆盖：方形 3×3 或 5×5（升级后）。
- 损耗：每次减免雷，损耗 `InsulationDurabilityCost`（默认 10%）；损耗更慢但减伤更弱。

### 8.2 放置规则与覆盖判定

- 阵法只能放在玩家拥有的农庄地图内。
- 引雷阵阵心必须有种植物（金属性草），其他格可空。
- 覆盖判定：`tile in Array.CoverageTiles`（预计算的几何集合，运行时只查表）。
- 多阵法叠加：覆盖区取**乘积**（绝缘主导），阵心格取**引雷主导**（阵心是金属性草必被劈）。
- UI 覆盖预览：放置时半透明显示覆盖圈与权重热力图（红色=高吸引，蓝色=绝缘）。

### 8.3 与灵草种植的耦合（"种田即布防"）

这是本作最大的卖点，必须贯穿设计：

- **金属性灵草 = 活体避雷针**：平时是产出金属属性药性的炼丹材料，天劫时是吸引雷的避雷针。玩家种它的位置 = 阵法布局。
- **核心药草区 vs 外围避雷草区**：鼓励空间策略——把稀有/脆弱的核心药草（寒/热/温属性）种在中心（被绝缘阵保护），把金属性避雷草种在外围（吸引雷远离中心）。
- **药性需求 vs 防御需求的冲突**：如果当前丹方需要大量金属性草，你就得多种；但种太多避雷草会把雷全引到外围，淬体不足。反之亦然。这是涌现的策略空间。

详见 `08-farming-system.md` §6 种植布局的空间策略。

---

## 9. 算法步骤汇总（轻量伪代码，非实现源码）

天劫单次 resolve 主循环：

```
function runTribulation(stage, worldSeed, farmGrid, player):
    tribulationId = nextId()
    waves = WaveCount(stage)
    for w in 1..waves:
        strikes = StrikesPerWave(stage)
        for i in 1..strikes:
            boltType = pickBoltType(stage, rng)
            candidates = buildCandidates(farmGrid)
            for t in candidates:
                W[t] = computeWeight(t, boltType, player, stage, rng)
            chosen = sample(candidates, normalize(W), rng)
            showTelegraph(chosen, TelegraphSeconds(stage))
            wait(TelegraphSeconds(stage))
            resolveStrike(chosen, boltType, player)
                // 内部按 §4 计算 damage / TemperingGain / 溅射
            if player.HP <= 0: return DEATH
        wait(WaveIntermission)
    return SUCCESS
```

确定性保证：所有随机调用都传入 `rng`（PRNG 句柄），seed = `hash(worldSeed, tribulationId, w, i)`。无头测试时传入固定 seed 即可复现完整落雷序列。

---

## 10. 可调参数清单（移交 14-...md 收口）

| 参数 | 默认 | 单位 | 语义 |
|------|------|------|------|
| `BaseCountdown` | 90 | s | 第一阶倒计时基础时长 |
| `StageStep` | 30 | s/阶 | 每阶增加的倒计时 |
| `MaxCountdown` | 360 | s | 倒计时上限 |
| `HastenFactor` | 0.30 | 比例 | 雷暴期间加速比例 |
| `DelayFactor` | 0.25 | 比例 | 灾年期间减速比例 |
| `MaxDelay` | 60 | s | 累计推迟上限 |
| `FreezeDuration` | 1.5 | s | 模式切换定格 |
| `WaveIntermission` | 4.0 | s | 波次喘息 |
| `RodRadius` | 3 | 格 | 金属性草避雷半径 |
| `MetalPowerBase` | 2.0 | 权重 | 一株成熟金属性草吸引权重 |
| `RodArrayMultiplier` | 5.0 | 倍率 | 引雷阵权重倍率 |
| `InsulationArrayMultiplier` | 0.05 | 倍率 | 绝缘阵减权倍率 |
| `PlayerBaseAttraction` | 1.5 | 权重 | 玩家自身吸引 |
| `EpicenterWeight` | 0.5 | 权重 | 中心偏置 |
| `Jitter` | 0.15 | 比例 | 随机扰动幅度 |
| `BaseTelegraph` | 2.5 | s | 第一阶预兆时长 |
| `TelegraphDecay` | 0.2 | s/阶 | 每阶缩窄的预兆 |
| `MinTelegraph` | 1.0 | s | 最短预兆 |
| `BaseTempering` | 10 | StageQi | 满额淬体基础值 |
| `bolt.baseDamage(stage)` | `12 + 8×stage` | HP | 单雷基值（见 14 P017/018，R9） |
| `PerfectBlockWindow` | 0.25 | s | 擦弹容错窗口 |
| `PerfectBlockQualityBonus` | 1.5 | 倍率 | 擦弹淬体加成 |
| `BaseStrikes` | 2 | 道 | 第一阶每波雷数 |
| `ScalingStrikes` | 1 | 道/阶 | 每阶增加雷数 |
| `BaseInterval` | 3.0 | s | 第一阶雷间隔 |
| `IntervalDecay` | 0.2 | s/阶 | 每阶缩窄间隔 |
| `MinInterval` | 0.6 | s | 最小并发间隔 |
| `PoolDuration` | 60 | s | 紫雷劫池持续 |
| `FinalTemperingThreshold` | TemperingCap(7)×1.5 | StageQi | 通关门槛 |
| `RepeatHitWindow` | 5 | s | 同格衰减窗口 |
| `RepeatDecay` | 0.5 | 比例 | 同格权重衰减 |

---

## 11. 开放问题（需主创拍板）

- **Q1**：模式切换是否完全冻结时间？本文建议"硬切换 + 1.5 s 定格"，不允许玩家在定格内重布阵。若主创希望更宽松，可改为"定格期间允许移动阵眼但不许新种"。
- **Q2**：擦弹 (PerfectBlock) 是否保留？这是高玩核心技巧但实现/教学成本高。若取消，可改为"站在绝缘阵内自动减伤但不加淬体"。
- **Q3**：一击必杀保护 (OSI) 在哪一阶取消？本文默认 stage ≤ 2。若主创追求更硬核，可取消 OSI 或全阶保留。
- **Q4**：玩家死亡是 Game Over 还是软重置？见 `09-progression-system.md` §7，强烈影响节奏。

---

## 参考资料

- [Plants vs. Zombies Wiki - Target Zombie（塔防 targeting 参考）](https://plantsvszombies.fandom.com/wiki/Target_Zombie)
- [Stanford MCTS Applied to PvZ（塔防决策建模）](https://web.stanford.edu/class/aa228/reports/2020/final66.pdf)
- [Target Selection in Game AI Systems（权重 reservation 思路）](https://community.latenote.com/t/which-algorithm-works-best-for-target-selection-in-game-ai-systems/37134)
- [Kingdom Defense / Tower Defense targeting patterns（通用塔防参考）](https://gamedev.stackexchange.com/questions/9035/code-structure-level-design-plants-vs-zombies-game-level-dissection)
