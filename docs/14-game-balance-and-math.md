# 14 · 核心数值公式与曲线（数值圣经）

> 本文件是《Aeon Vale: Song of the Dao》的**数值圣经**。所有系统的数学公式、默认系数、量纲、设计意图都收敛于此。
> 它同时是 `17-testing-and-automation.md` 蒙特卡洛自动调参的**输入接口**：文末的【平衡参数注册表】即调参搜索空间的权威清单。
> 遵守 `00-DESIGN-BRIEF.md` §7：C3 确定性、C4 可自动化测试、C5 凡人挣扎感、C6 数据驱动。
>
> **对齐说明**：本文档先于 `05-mechanic-tribulation.md` / `06-mechanic-alchemy.md` / `07-mechanic-celestial-events.md` / `08-farming-system.md` / `09-progression-system.md` 撰写。机制设计师若调整任一公式，必须同步回改本表，否则破坏单一真源。凡涉及他文档尚未定义的量，本文按设计意图先行给出一致默认值，并标注 **[待与 0X-... 对齐]**。

---

## 0. 数值设计总哲学

### 0.1 三条铁律

1. **凡人恒弱（C5 落地）**：玩家 HP / 抗性 / 产出的增长速率，**永远低于威胁的增长速率**。玩家每一阶段都相对更脆弱，靠策略而非数值碾压过关。
2. **险而可破（Pillar 2 落地）**：每个高风险动作（生食、控血接雷、炸炉赌博）的收益曲线，都在"差点出事但没出事"处取最大值——**奖励走钢丝，惩罚贪心与保守两端**。
3. **可调可测（C3/C4 落地）**：每个魔法数字都是具名参数（非字面常量），带量纲、范围、敏感度，可被种子化模拟复现、可被参数扫描搜索。

### 0.2 数值栈分层

```
玩家 / 世界状态 ──► 纯函数(参数表, 输入) ──► 新状态 + 事件流
                          ▲
                  【平衡参数注册表】(§11) = 单一真源
```

所有公式实现为**纯函数**：`(params, state, rng) -> (newState, events)`。`rng` 为可注入 PRNG（C3）。无副作用、无隐式全局。这是无头模拟与属性测试的前提（见 `17-testing-and-automation.md`）。

---

## 1. 规模与量纲基线

为避免数量级混乱，全局统一如下基线量纲（默认值即下文所有公式的默认上下文）：

| 量 | 符号 | 默认量纲 | 说明 |
|----|------|----------|------|
| 时间 | `t` | **game-day（游戏日）** | 1 日 = 昼夜循环；季节 = 28 日（对齐星露谷节奏感） |
| 玩家 HP | `HP` | **0–100 起步**（绝对值，非百分比） | 凡骨 100；每阶段微涨（见 §8） |
| 丹毒 | `P` | **0–100**（满即暴毙） | 见 §3 |
| 灵气浓度 | `Q` | **0–100**（无量纲指数） | 见 §2；0=死地，100=灵脉泉眼 |
| 土壤肥力 | `F` | **0–100** | 翻地/施肥改变；每季衰减 |
| 修为 | `X` | **0–stageCap**（累积量） | 突破货币；见 §8 |
| 药性强度 | `M` | **0–10**（每属性轴） | 寒/热/温/平四轴向量 |
| 火候 | `H` | **0–100**（炉温） | 炼丹操控维度 |
| 劫雷伤害 | `D` | **HP 单位**（与 HP 同量纲） | 见 §5 |

> 所有百分比在公式中以 **[0,1] 小数**表达，避免 `50%` 与 `50` 混淆。

---

## 2. 灵气浓度与再生模型（Qi Model）

> 对应 `08-farming-system.md` 的灵气层。**[待与 08 对齐]**

### 2.1 地块灵气浓度

每个地块 `tile` 持有当前灵气浓度 `Q_tile`（0–100）。每游戏日更新：

```
Q_tile(t+1) = clamp(
    Q_tile(t)
  + regenBase × veinMultiplier(tile) × celestialQiMod(t)        // 源：再生
  - Σ herbQiDemand(h, tile) for each herb h on tile              // 汇：灵草吸收
  - qiDecayPerDay × (Q_tile(t) / 100),                           // 汇：自然逸散（越浓逸散越快）
  0, 100)
```

**默认参数：**

| 参数 | 默认值 | 量纲 | 意图 |
|------|--------|------|------|
| `regenBase` | 1.5 | Q/日 | 普通地块缓慢回气；凡间地≈死地感 |
| `veinMultiplier` | 1.0（普通）/ 3.0（残脉）/ 6.0（灵脉泉眼） | 倍率 | 灵脉是稀缺战略资源 |
| `qiDecayPerDay` | 0.5 | Q/日（在满浓度时） | 高浓度不可无脑囤积，逸散制造"用进废退" |
| `celestialQiMod` | 1.0（常态） | 倍率 | 天象事件改写（见 §7、`07-mechanic-celestial-events.md`） |

**设计意图**：灵气是**流动的公共池**，不是静态库存。灵草长得越多，地块越贫——玩家必须在"多种多收"与"养地留气"间取舍。这是 C5 稀缺感的核心源。

### 2.2 灵草对灵气的需求

```
herbQiDemand(h, tile) = h.qiDrainPerDay × qiFactor(tile.Q, h)
```
其中 `qiFactor` 见 §4.1——灵气越足长得越快、吸得越多（正反馈）。即"灵气足→长得快→吸得多→灵气降"，构成自平衡负反馈环。

---

## 3. 丹毒模型（PillPoison）

> 对应 `06-mechanic-alchemy.md`。**[待与 06 对齐]**

凡骨无灵根，生食灵草不吸收反积毒；炼丹是"解毒 + 提纯"。

### 3.1 生食灵草的丹毒增量

```
poisonGain(h, stage) = h.propertyStrength × h.tier × rawEatMult(stage) × (1 - poisonResist)
```

| 参数 | 默认值 | 量纲 | 意图 |
|------|--------|------|------|
| `h.propertyStrength` | 1.0–8.0 | M（药性强度） | 见 `15-content-tables.md` 灵草表 |
| `h.tier` | 1–5 | tier | 越高阶越毒 |
| `rawEatMult(stage)` | `0.8 + 0.4 × stage` | 倍率 | 高阶段面对的高阶草对凡骨更致命（即使有功法） |
| `poisonResist` | 0.0（起步）/ 至多 0.3 | 比例 | 仅淬体/特定丹可小幅提升；**永远封顶 0.3**——凡骨就是凡骨（C5） |

> 设计意图：`rawEatMult` 随阶段上升，意味着玩家**永远不能**靠生食高阶草跳过炼丹环节。炼丹是刚需，不是可选优化。

### 3.2 丹毒衰减

```
P(t+1) = max(0, P(t) - decayBase × (1 + detoxPillBonus(t)) - restBonus(tileRest))
```

| 参数 | 默认值 | 量纲 | 意图 |
|------|--------|------|------|
| `decayBase` | 2.0 | P/日 | 自然代谢缓慢 |
| `detoxPillBonus` | 0–2.0 | 倍率 | 净毒丹加成；是主力清毒手段 |
| `restBonus` | 0–1.0 | P/日 | 在"静室"地块休息额外排毒（鼓励回家） |

### 3.3 暴毙阈值与预警

```
if P >= 100: 死亡（丹毒暴毙结局，见 02-narrative-bible.md）
if P >= 80 : 视觉/数值警告（屏幕泛紫、随机呕吐掉 HP）
if P >= 60 : 轻度惩罚（炼丹火候控制精度下降 20%）
```

**调参旋钮**：`decayBase` 是最敏感的旋钮。若模拟显示"玩家从不积累丹毒"则下调；若"人人暴毙"则上调。目标：到第 1 次天劫前，菜鸟玩家应有 1–2 次逼近 80 的惊险时刻。

---

## 4. 灵草生长公式（Herb Growth）

> 对应 `08-farming-system.md`。**[待与 08 对齐]**

灵草以**累积生长值** `G` 推进，达阈值成熟。

```
G(t+1) = G(t) + growthPerDay(h, tile, season, celestial)
```
```
growthPerDay = h.baseGrowth
             × qiFactor(Q_tile, h)            // 灵气因子
             × soilFactor(F_tile)             // 土壤因子
             × seasonFactor(h.affinity, season)
             × celestialFactor(celestialMod)
```
当 `G >= h.growthThreshold` 时成熟可收。

### 4.1 各因子定义

**qiFactor**（饱和曲线，带过载奖励）：
```
qiFactor(Q, h) = clamp(Q / h.qiNeed, 0, 2.0)
```
- `Q < h.qiNeed`：受抑制（长得慢但仍吸气）
- `Q == h.qiNeed`：正常（=1.0）
- `Q > h.qiNeed`：过载加速，最高 ×2.0（灵气充盈时的奖励）

**soilFactor**（肥力，带递减收益）：
```
soilFactor(F) = 0.3 + 0.7 × sqrt(F / 100)
```
贫瘠地（F=0）仍能长（×0.3），肥地（F=100）满加成（×1.0）。`sqrt` 给递减收益——前期翻地收益大，后期堆肥边际递减。

**seasonFactor**（药性-季节亲和）：

| 灵草药性 | 春 | 夏 | 秋 | 冬 |
|----------|-----|-----|-----|-----|
| 寒 Cold | 1.0 | 0.6 | 1.0 | **1.3** |
| 热 Hot | 0.6 | **1.3** | 1.0 | 0.6 |
| 温 Warm | **1.2** | 1.0 | 1.1 | 0.8 |
| 平 Neutral | 1.0 | 1.0 | 1.0 | 1.0 |

> 设计意图：季节强制玩家轮作。冬天种寒草、夏天种热草——天然制造"今年只能专注某几味丹"的稀缺，而非"全图鉴同时量产"。

**celestialFactor**：默认 1.0，由 `07-mechanic-celestial-events.md` 事件改写（如"灵气潮汐"→1.5）。

### 4.2 默认灵草生长参数（与 `15-content-tables.md` 对齐）

| tier | 代表草 | baseGrowth (G/日) | growthThreshold | qiNeed |
|------|--------|-------------------|-----------------|--------|
| 1 | 凡间青苔 Mossling | 8 | 40 | 5 |
| 2 | 寒髓草 Frostmarrow | 5 | 80 | 20 |
| 3 | 赤焰心 Emberheart | 4 | 120 | 35 |
| 4 | 金雷引 Metalpine | 3 | 200 | 55 |
| 5 | 紫极芝 Violet Ascendshroom | 2 | 360 | 80 |

> 解读：tier1 约 5 日熟（快反馈），tier5 约 180 日熟（近两季——战略级长线投资）。

---

## 5. 天雷 Targeting 权重（Lightning Targeting）

> 对应 `05-mechanic-tribulation.md`。**[待与 05 对齐]**

天劫期，每道劫雷独立选择落点。落点由**权重抽样**决定（确定性：用 PRNG 在归一化权重上轮盘）。

### 5.1 权重公式

```
weight(tile) = ( 1 + metalAttract(tile) )             // 金属/金属性灵草吸引（加性放大）
             × conductivity(tile)                     // 地形导电性（直接倍率，见 R5）
             × arrayModifier(tile, arrays)            // 阵法改写（引雷/绝缘）
             × playerProximity(tile, playerPos)       // 玩家位置权重
             × ( 1 + noise(rng, tile) )               // 确定性噪声，避免完全可解
```
归一化：`P(tile) = weight(tile) / Σ weight(allTargetableTiles)`。
> 合成方式为**乘性**（`20` R4 裁定）：防负、各项独立缩放、与"绝缘阵/绝缘垫趋零"语义一致。05 的各项物理内部算法（金属性草半径 falloff、阵法乘积叠加、玩家邻近衰减）保留，仅"如何合成总权重"用乘性。

### 5.2 各项默认值

| 项 | 公式 / 默认 | 意图 |
|----|-------------|------|
| `metalAttract` | 空地 0；金属性灵草 `0.8 × tier`；金属家具/法宝 `0.5–2.0` | **种田即布防**：金属性灵草=活避雷针，把雷引向它（Pillar："种田是塔防前置"） |
| `conductivity` | **水 1.8 / 金属矿 1.5 / 泥 1.0 / 干沙 0.5 / 绝缘垫 0.1**（`20` R5，对齐 05/08 的 0.1–1.8 语义，直接作乘子） | 地形改造影响落点；绝缘垫把该格权重压到 1/10 |
| `arrayModifier` | 引雷阵中心 `×4.0`（强吸引）；绝缘阵覆盖 `×0.3`（乘性削弱） | 玩家核心控制手段 |
| `playerProximity` | 切比雪夫距离 `d`：`1 + 0.4/(1+d)` | 雷略偏玩家——"天道盯你"；但非强引导，给布防留空间 |
| `noise` | `±0.1`（PRNG 抽 `[-0.1, 0.1]`） | 避免确定性可被完美解；保留紧张感 |

**设计意图**：权重各项**乘性合成**，意味着玩家能用一套阵法把雷"编排"到指定落区（绝缘垫/绝缘阵把保护区压到趋零、引雷阵+金属性草把雷拉到外围），但噪声与玩家邻近项保证**永远有意外**。这就是"险"的来源。

### 5.3 玩家被直接命中的特殊处理

若 `tile == playerPos`，权重额外 `× playerTargetBias`（默认 1.2）。玩家无法完全躲——必须靠护体丹和阵法减伤，而非纯走位（与塔防定位一致）。

---

## 6. 劫雷伤害与淬体增益（Damage & Tempering）

> 对应 `05-mechanic-tribulation.md`。**[待与 05 对齐]**
> 这是全游戏**最核心的张力公式**：奖励"差点死掉但没死"。

### 6.1 实际伤害

```
damage(bolt, tile, player) = bolt.baseDamage(stage)
                           × (1 - arrayReduction(tile, arrays))     // 阵法减伤
                           × (1 - pillMitigation(player))            // 护体丹减伤
                           × terrainAmplify(tile)                    // 地形放大
                           × temperingVariance(rng, bolt)            // ±10% 确定性扰动
```

| 参数 | 默认 | 量纲 | 意图 |
|------|------|------|------|
| `bolt.baseDamage(stage)` | `12 + 8 × stage` | HP | 见 §8 阶段表 |
| `arrayReduction` | 引雷阵吸收 0.6（被引的雷伤害被阵吃掉）；绝缘阵 0.3 | 比例 | 阵法是主要减伤，但有耐久消耗 |
| `pillMitigation` | 避雷丹 0.4（单次）/ 铁骨丹 0.2（持续） | 比例 | 丹药是第二防线 |
| `terrainAmplify` | 水面 1.3；干地 1.0；绝缘木台 0.7 | 倍率 | 环境微调 |
| `temperingVariance` | `0.9–1.1` | 倍率 | 防 Perfect Play，保留风险 |

### 6.2 淬体增益（Tempering Gain）——控血收益曲线

每道**实际命中玩家**（非被阵完全吸收）的雷，按"实受伤害"折算修为。统一公式（`20` R10 裁定，并入 05 的 `ExposureCoeff` 命中类型系数与 `QualityBonus` 擦弹系数）：

```
temperingGain(bolt) = damageActuallyTaken
                    × ExposureCoeff(hitType)        // 命中类型（见 05 §4.1）：DirectHit 1.0 / InsulatedHit 0.5 / RodHit 0.25
                    × temperingEff(stage)            // 阶段效率递减（本表）
                    × nearDeathBonus(finalHP)        // 控血收益（终局 HP 结算）
                    × QualityBonus(perfectBlock)     // 擦弹奖励（见 05 §4.4），默认 1.0，PerfectBlock 命中 1.5
```

> `ExposureCoeff` 与 `QualityBonus` 的结构与默认值取自 `05-mechanic-tribulation.md` §4；本节为二者与 `temperingEff`/`nearDeathBonus` 的**乘性合成**真源。`damageActuallyTaken` 作基数（奖励"实受伤害"，贴"以雷淬体"语义），是 `20` R10 对 05 固定基数 `BaseTempering=10` 的取代。

**`nearDeathBonus`**（在整场天劫结束后，按最终 HP 结算）：

| 最终 HP% | bonus | 名义 |
|----------|-------|------|
| `≤ 0`（死亡） | — | 暴毙（见 02 叙事） |
| `(0, 10%]` | **2.5** | 九死一生（峰值奖励） |
| `(10%, 25%]` | **2.0** | 险中求生 |
| `(25%, 50%]` | 1.3 | 浴火 |
| `(50%, 80%]` | 1.0 | 安稳过关 |
| `> 80%` | 0.6 | 未受淬炼（几乎白扛） |

**这是全游戏的灵魂曲线**：横轴"最终 HP%"，纵轴"淬体收益"，呈**倒钟形峰值在 5–10%**。玩家被诱导去走钢丝——但跨过 0% 就是死。叠加 05 的擦弹 `QualityBonus`（每雷 0.25s 窗口内 PerfectBlock 再 ×1.5）后，高玩有"每雷擦弹 + 终局控血"的双层走钢丝空间。

| 参数 | 默认 | 意图 |
|------|------|------|
| `temperingEff(stage)` | `1.1 - 0.1 × stage`（stage1=1.0 … stage7=0.4） | 高阶段每点伤害换更少修为——拖长后期、维持稀缺 |

### 6.3 控血设计的反滚雪球

注意 `temperingEff` 随阶段**下降**，而 `baseDamage` 随阶段**上升**。二者叠加意味着：**越后期，"硬扛换修为"越低效，越依赖阵法+丹药的"精算"**。这正是 C5——玩家始终弱小，后期不能靠血量 farm。

---

## 7. 天象事件权重（Celestial Event Weights）

> 对应 `07-mechanic-celestial-events.md`。**[待与 07 对齐]**

每游戏日，世界引擎以权重抽样决定是否触发天象事件。

```
weight(e) = e.baseWeight
          × seasonMod(e, season)
          × progressMod(e, stage)
          × cooldownFactor(e, daysSinceLast(e))
          × repeatPenalty(e, recentFires(e))
          × celestialResonance(e, currentQiTrend)
```

| 项 | 默认规则 | 意图 |
|----|----------|------|
| `baseWeight` | 各事件自带，见 `15-content-tables.md` | 基础稀有度 |
| `seasonMod` | 灾年类冬夏 ×1.3；灵气潮汐春秋 ×1.2 | 季节调味 |
| `progressMod` | 魔修过境 stage≥2 才有权重且 ×stage；天骄降世全期 | 阶段门控，避免新手遇超纲事件 |
| `cooldownFactor` | 触发后 `N` 日内置 0，之后线性恢复到 1 | 防刷屏 |
| `repeatPenalty` | 近 3 次中重复出现 ×0.4 | 防单调 |
| `celestialResonance` | 与当前灵气趋势耦合（如灵气暴涨→妖兽来袭 ×2） | 因果链触发器 |

**总触发概率**：每日对所有事件归一化后抽样，再以 `eventGateProbability`（默认 0.25/日）作为总闸——保证平均 4 日一事件，留出平静种田窗口（Pillar 3：慢节奏）。

---

## 8. 突破阈值与功法进度（Progression & Breakthrough）

> 对应 `09-progression-system.md`。**阶段结构以 09 为权威（7 阶制），经 `20-design-decisions-and-reconciliation.md` R1 裁定**；本节为各阶段默认数值（数值/公式单一真源 = 本文）。

《偷天换劫诀》分 **7 个实修阶段（stage 1–7）** + 飞升（stage 0 = 凡骨，前功法）。修为 `StageQi`（本文记 `X`）由淬体累积（§6.2），达阶段上限 `StageQiCap` 触发**强制天劫倒计时**。stage≥3 起每阶段另设**经脉开辟（Meridian）子进度**（见 09 §2），把修为增长具象为可数经脉里程碑。

### 8.1 阶段表（进度曲线总览，7 阶 —— 对齐 `20` R1 / `09` §1）

| Stage | 名称 | English / ID | StageQiCap (X) | 单场天劫雷数 | baseDamage/雷 (12+8×stage) | 玩家 maxHP | temperingEff (1.1−0.1×stage) | 经脉数 (stage≥3) | 预期游玩时长(累计) |
|-------|------|--------------|----------------|-------------|----------------------------|-----------|------------------------------|------------------|-------------------|
| 0 | 凡骨 | Mortal | — | — | — | 100 | — | — | 0–1 h（教程） |
| 1 | 淬皮 | Skin-Tempering | 100 | 3 | 20 | 110 | 1.0 | — | 1–4 h |
| 2 | 锻骨 | Bone-Forging | 200 | 4 | 28 | 125 | 0.9 | — | 4–8 h |
| 3 | 通脉 | Meridian-Opening | 400 | 5（青雷+紫雷初现） | 36 | 145 | 0.8 | 3 | 8–12 h |
| 4 | 凝丹（伪） | False-Core | 700 | 6（紫雷为主） | 44 | 170 | 0.7 | 5 | 12–16 h |
| 5 | 破丹 | Core-Shattering | 1100 | 7 | 52 | 195 | 0.6 | 7 | 16–20 h |
| 6 | 化神 | Spirit-Transformation | 1600 | 8 | 60 | 220 | 0.5 | 9 | 20–23 h |
| 7 | 飞升前夜 | Eve-of-Ascension | 2200 | 紫雷劫池（×8–12 波） | 68（紫雷 ×1.5） | 250 | 0.4 | 12 | 23–26 h（通关） |

> `StageQiCap` 系列采用 `20` R1 裁定值（近似 ×1.8 增长，对齐 `09` §1.3 `BaseQiCap=100, GrowthFactor≈1.8`）。

**曲线意图（险而可破）**：
- `maxHP` 增长**缓**（100→250，×2.5）；`baseDamage` 增长**陡**（20→68，×3.4，紫雷再 ×1.5）。**玩家相对越来越脆**（C5）。
- `temperingEff` 随阶段下降，配合 `StageQiCap` 上升，使每阶段耗时**递增但不爆炸**——避免后期 farm 感。
- 目标（对齐 `20` §4 / `17` §5.3）：**首劫（stage1）菜鸟存活率 60–75%**；stage3 难度跳点（紫雷初现）菜鸟死亡率显著上升；通关总时长 15–25 h。

### 8.2 天劫触发与倒计时

```
when X >= X_cap(stage):
    tribulationTimer = T_trib(stage)   // 默认 T_trib = 7 - min(stage,4) 日
    // 倒计时归零 → 强制切入塔防生存（见 05-mechanic）
```
倒计时给玩家"最后准备窗口"：补阵、炼丹、控毒。`T_trib` 随阶段**缩短**——后期更仓促，提升张力。

### 8.3 突破成功率与走火入魔

天劫**存活**后，进入突破判定（仅当 `X >= X_cap`）：

```
successRate = clamp(
    0.5                                              // 基础五五开
  + 0.15 × (prepScore)                               // 准备分：阵法完整度/丹药齐备度
  + 0.10 × (X_surplus_ratio)                         // 修为盈余比（超 cap 的部分）
  - 0.20 × (P / 100)                                 // 丹毒惩罚（带毒强行突破大忌）
  - 0.10 × (qiDeviationAccum)                        // 走火累积
  , 0.05, 0.95)
```

| 结果 | 条件 | 后果 |
|------|------|------|
| 突破成功 | `rng < successRate` | 进入下一 stage，maxHP 涨，解锁内容 |
| 走火入魔 | `rng > successRate` 且 `P` 高 | 负面结局分支或重创（见 02-narrative） |
| 险胜 | `rng > successRate` 但 `P` 低 | 留在原 stage，修为折损 30%，可重攒——**可挽回的局部失败**（C5） |

**设计意图**：`successRate` 永远在 [0.05, 0.95]——**没有百分百的突破**。丹毒是最大负权（-0.20），把"清毒"和"突破"强绑定，让炼丹的意义闭环。

---

## 9. 炼丹药性平衡（Alchemy Property Balance）

> 对应 `06-mechanic-alchemy.md`。**[待与 06 对齐]**
> 这是"涌现配方"的数学基础——非线性映射让同料异火出异丹。

### 9.1 药性向量与炉内聚合

每材料带四轴药性向量 `m = [cold, hot, warm, neutral]`（各 0–10）。投料后炉内聚合：

```
furnaceVec = Σ_i ( m_i × qty_i × extraction(heat, m_i) )
```
**`extraction(heat, material)`**（火候-材料提取曲线，**非线性**）：
```
extraction(H, m) = sin( π × clamp((H - m.idealHeatMin) / (m.idealHeatMax - m.idealHeatMin), 0, 1) )
```
- 在材料理想火候区间内，提取呈**拱形**（峰值在区间中点，两端归零）。
- 不同材料理想区间不同 → **同炉料在不同火候下，各成分提取比例不同** → 涌现配方。

### 9.2 平衡度评分

目标药性向量 `targetVec`（来自丹方，或"中和中心" `[0,0,0,k]`）：
```
balanceScore = clamp( 1 - ||furnaceVec - targetVec||_1 / balanceNorm , 0, 1 )
```
`balanceNorm` 默认 20（四轴总偏差归一化）。`balanceScore ≥ 0.85` 触发**完美成丹**（暴击产出）。

### 9.3 炸炉阈值

```
conflict = |furnaceVec.cold - furnaceVec.hot|          // 寒热冲突主轴
if conflict > explosionThreshold(stage, furnaceTier):   // 默认 14 + 2×stage
    explosion = true
```
另：火候偏离炉体耐久区间 → 概率性炸炉：
```
pExplosionHeat = max(0, (|H - H_ideal| - heatTolerance) / heatTolerance) × 0.5
```

| 参数 | 默认 | 意图 |
|------|------|------|
| `explosionThreshold` | 14 + 2×stage | 高阶段容差略升（炉更好），但高阶料冲突更猛 |
| `heatTolerance` | 15（炉温） | 玩家控火精度的容错窗 |

### 9.4 非线性产出映射（涌现核心）

```
outputPillId = hashNearest( furnaceVec, heat, recipeKnown? )
```
- 投料 + 火候 + 时序 → `furnaceVec` 落在**药性空间**的某点。
- 该点映射到**最近的已知丹方原型**（若在容差球内）或**涌现配方**（若落在未命名区域，按规则合成临时丹药）。
- 玩家"实验"= 在药性空间探索，发现新落点 → 解锁新丹方（写入 `Recipes` 表，见 `15-content-tables.md`）。

> 这是 Pillar 4（系统涌现）的数值化身：**药性空间是连续的，丹方是其离散采样**。

### 9.5 火候偏离惩罚

火候偏离任一材料的理想区间，扣产出：
```
yieldMultiplier = Π_i extraction(H, m_i)   // 各材料提取连乘
finalPills = round(baseYield × yieldMultiplier × balanceScore)
```
连乘意味着**多料炉对火候极敏感**——逼玩家控火，而非堆料。

---

## 10. 调参哲学（Knob Sensitivity & Target Feel）

每个公式都有"最敏感的旋钮"。下表给出**调参优先级**——当模拟偏离目标体验时，先拧哪个。

| 系统 | 最敏感旋钮 | 目标体验 | 调参信号 |
|------|-----------|----------|----------|
| 丹毒 §3 | `decayBase` | 菜鸟应 1–2 次逼近 80 | 模拟中位 `maxP` 应≈75 |
| 灵气 §2 | `regenBase` | 地块不应被无脑种满 | 第 30 日 `meanQ` 应≈30 |
| 生长 §4 | `qiFactor` 上限 2.0 | 灵脉地块=战略高地 | 灵脉地块产出应≈普通 ×2.5 |
| 雷权重 §5 | `metalAttract` 系数 | 金属性草能吸 ≥60% 的雷 | 单元测试断言 |
| 雷伤 §6 | `nearDeathBonus` 峰值 2.5 | 老练 bot 主动控血到 10% | bot 行为日志 |
| 淬体 §6 | `temperingEff(stage)` 斜率 | 后期不能靠血量 farm | stage5 修为/伤害比应 < stage1 的 0.5 |
| 突破 §8 | `successRate` 丹毒惩罚 -0.20 | 突破前必清毒 | bot 在 `P>50` 时突破成功率 < 40% |
| 事件 §7 | `eventGateProbability` 0.25 | 平均 4 日一事件 | 模拟事件间隔均值≈4，方差可控 |
| 炼丹 §9 | `extraction` 拱形宽度 | 同料异火出异丹 | 属性测试：存在 ≥3 种火候→≥2 种产出 |

**前 3 场天劫死亡率 ≈ 30%**（菜鸟 bot）是全游戏难度锚点——所有公式最终服务于这条曲线。若偏离，按上表自上而下排查。

---

## 11. 【平衡参数注册表】（Balance Parameter Registry）

> 这是 `17-testing-and-automation.md` 蒙特卡洛自动调参的**权威输入清单**。
> AI 调参 agent 读取本表，在 `range` 内搜索满足目标代理指标的参数组合。

| ID | 参数名 | 默认 | 量纲 | 范围 | 敏感度 | 意图 / 所属公式 |
|----|--------|------|------|------|--------|----------------|
| P001 | `regenBase` | 1.5 | Q/日 | [0.5, 4.0] | 高 | §2 灵气再生 |
| P002 | `veinMultiplier.normal` | 1.0 | × | [1.0, 2.0] | 中 | §2 普通地块 |
| P003 | `veinMultiplier.vein` | 6.0 | × | [3.0, 10.0] | 高 | §2 灵脉 |
| P004 | `qiDecayPerDay` | 0.5 | Q/日 | [0.1, 1.5] | 中 | §2 逸散 |
| P005 | `poisonDecayBase` | 2.0 | P/日 | [0.5, 5.0] | **高** | §3 丹毒衰减 |
| P006 | `rawEatMult.base` | 0.8 | × | [0.4, 1.5] | 高 | §3 生食毒增 |
| P007 | `rawEatMult.stageSlope` | 0.4 | ×/stage | [0.2, 0.8] | 高 | §3 阶段放大 |
| P008 | `poisonResist.cap` | 0.3 | 比例 | [0.0, 0.5] | 中 | §3 抗毒封顶 |
| P009 | `qiFactor.cap` | 2.0 | × | [1.5, 3.0] | 中 | §4 过载奖励 |
| P010 | `soilFactor.min` | 0.3 | × | [0.1, 0.5] | 低 | §4 贫瘠下限 |
| P011 | `seasonFactor.peak` | 1.3 | × | [1.1, 1.6] | 中 | §4 季节峰值 |
| P012 | `lightning.metalAttract.coef` | 0.8 | ×/tier | [0.4, 1.5] | **高** | §5 金属性吸雷 |
| P013 | `lightning.arrayRedirect` | 3.0 | × | [1.5, 5.0] | 高 | §5 引雷阵强度 |
| P014 | `lightning.arrayInsulate` | -0.7 | × | [-0.9, -0.3] | 高 | §5 绝缘阵 |
| P015 | `lightning.playerProximity.coef` | 0.4 | × | [0.1, 1.0] | 中 | §5 雷偏玩家 |
| P016 | `lightning.noise` | 0.1 | × | [0.0, 0.3] | 中 | §5 不确定性 |
| P017 | `bolt.baseDamage.base` | 12 | HP | [8, 20] | **高** | §6 雷伤基值 |
| P018 | `bolt.baseDamage.stageSlope` | 8 | HP/stage | [4, 14] | **高** | §6 雷伤阶段斜率 |
| P019 | `arrayReduction.redirect` | 0.6 | 比例 | [0.3, 0.85] | 高 | §6 阵法减伤 |
| P020 | `pillMitigation.ward` | 0.4 | 比例 | [0.2, 0.7] | 高 | §6 避雷丹 |
| P021 | `terrainAmplify.water` | 1.3 | × | [1.0, 1.6] | 低 | §6 水面放大 |
| P022 | `temperingEff.base` | 1.1 | × | [0.8, 1.4] | 高 | §6 淬体基值 |
| P023 | `temperingEff.stageSlope` | -0.1 | ×/stage | [-0.2, -0.05] | **高** | §6 后期效率下降 |
| P024 | `nearDeathBonus.peak` | 2.5 | × | [1.8, 3.5] | **高** | §6 控血峰值 |
| P025 | `nearDeathBonus.peakBand` | 0.10 | HP% | [0.05, 0.20] | 高 | §6 峰值区间 |
| P026 | `nearDeathBonus.safe` | 0.6 | × | [0.3, 0.9] | 中 | §6 安稳惩罚 |
| P027 | `X_cap` 各阶段 | 见 §8 | X | ±20% | 高 | §8 修为门槛 |
| P028 | `T_trib.base` | 7 | 日 | [3, 10] | 中 | §8 倒计时 |
| P029 | `successRate.base` | 0.5 | 比例 | [0.3, 0.7] | 高 | §8 突破基值 |
| P030 | `successRate.poisonPenalty` | -0.20 | 比例 | [-0.4, -0.1] | **高** | §8 丹毒惩罚 |
| P031 | `successRate.prepBonus` | 0.15 | 比例 | [0.05, 0.3] | 中 | §8 准备分 |
| P032 | `eventGateProbability` | 0.25 | /日 | [0.1, 0.5] | 中 | §7 事件闸 |
| P033 | `eventCooldown` | 见 15 | 日 | [2, 10] | 低 | §7 冷却 |
| P034 | `alchemy.explosionThreshold.base` | 14 | M | [8, 20] | 高 | §9 炸炉阈 |
| P035 | `alchemy.balanceNorm` | 20 | M | [10, 30] | 中 | §9 平衡归一 |
| P036 | `alchemy.extraction.width` | 由 idealHeat 区间定 | 炉温 | ±30% | **高** | §9 提取拱形 |
| P037 | `alchemy.yieldMultiplier.min` | 0 | × | [0, 0.3] | 低 | §9 产出下限 |

> **使用方式**（对接 `17-testing-and-automation.md`）：调参 runner 以本表为搜索空间，目标函数见 `17` §4（首劫存活率、通关时长分布等），用进化算法/参数扫描搜索。敏感度"高"的参数优先扰动。

---

## 12. 与兄弟文档的对齐清单

| 本文公式 | 依赖文档 | 状态 |
|----------|----------|------|
| §2 灵气 | `08-farming-system.md` | **待对齐**（本文先行给默认） |
| §3 丹毒 | `06-mechanic-alchemy.md` | **待对齐** |
| §4 生长 | `08-farming-system.md` | **待对齐** |
| §5–6 天雷/淬体 | `05-mechanic-tribulation.md` | **待对齐** |
| §7 天象 | `07-mechanic-celestial-events.md` | **待对齐** |
| §8 进阶 | `09-progression-system.md` | **待对齐**（阶段名/数量以本文 5 阶段为基线） |
| §9 炼丹 | `06-mechanic-alchemy.md` | **待对齐** |
| §11 注册表 | `17-testing-and-automation.md` | 本文为输入，17 为消费方 |

机制设计师落地时，若需偏离默认值，须：①在本文 §11 改默认并记版本；②在机制文档反向引用本文参数 ID（如 `P024`）。

---

## 参考资料

- [Monte-Carlo Simulation Balancing (Silver et al., ICML 2009)](https://icml.cc/Conferences/2009/papers/500.pdf) —— 蒙特卡洛策略平衡的奠基方法，本文 §11 调参的学术依据。
- [Monte-Carlo Simulation Balancing in Practice (Coulom, 2010)](https://www.remi-coulom.fr/CG2010-Simulation-Balancing/SimulationBalancing.pdf) —— 实践化落地。
- [A Monte Carlo Approach to Skill-Based Automated Playtesting (Stratabots, Horn et al., AIIDE 2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6319931/) —— 分层策略 bot 模型，本文 §6 控血曲线与 `17` bot 设计依据。
- [Demonstrating the Feasibility of Automatic Game Balancing (Volz et al., GECCO 2016)](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2016/GECCO/proceedings/p269.pdf) —— 多目标进化算法自动平衡，本文 §11 + `17` §4 调参算法选型。
- [Exploring Game Space via Parameter Tuning (Nealen et al.)](http://www.nealen.net/papers/08030128.pdf) —— 参数空间探索生成难度变体。
- [Economy Design in Simulation Games (altheragames)](https://altheragames.com/en/blog/simulation-game-economy-design) —— 对数进度曲线（非指数），本文 §8 曲线意图。
- [Deterministic Simulation Testing (Antithesis)](https://antithesis.com/docs/resources/deterministic_simulation_testing/) —— 确定性回放回归，本文 C3 + `17` §5 依据。
- [What is Property-Based Testing? (fast-check)](https://fast-check.dev/docs/introduction/what-is-property-based-testing/) —— 属性测试不变式，`17` §6 依据。
