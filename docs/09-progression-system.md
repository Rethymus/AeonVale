# 进阶系统：《偷天换劫诀》阶段 / 经脉 / 突破曲线

> 本文设计修炼阶段阶梯、经脉开辟子进度、突破机制、功法进度与天劫次数耦合、难度曲线、终局飞升、失败态与软重置。
> 上游宪法：`00-DESIGN-BRIEF.md` §3 核心循环、§5、§7（C3 确定性 / C5 凡人挣扎感 / C4 可无头测试）。
> 兄弟文档：天劫机制见 `05-mechanic-tribulation.md`；淬体 buff 来源见 `05-...md` §4；炼丹见 `06-mechanic-alchemy.md`；天象见 `07-mechanic-celestial-events.md`；种田见 `08-farming-system.md`；数值收口见 `14-game-balance-and-math.md`；叙事结局见 `02-narrative-bible.md`。

---

## 0. 设计意图

进阶系统是**贯穿全游戏的主干进度轴**。它服务三个目标：

1. **目标感**：从凡骨到飞升的清晰阶梯，每阶都有明确质变（解锁内容 + 更强天劫）。
2. **节奏控制**：每阶对应一段稳定积累期 + 一次高风险突破，匹配核心循环的"慢→快"张力。
3. **险而可破**：随阶段难度递增（雷更强/丹毒更险/资源更稀），但玩家工具也递增（更多阵法/丹方/设施），始终给出"刚好能过"的破解空间。

核心模型：**阶段（Stage）→ 阶段内经脉开辟（Meridian）→ 修为满 → 天劫 → 突破 → 下一阶段**。

---

## 1. 阶段阶梯 (Cultivation Stages)

### 1.1 七阶设计

采用 7 阶制（呼应"七阶渡劫飞升"套路）。每阶段对应《偷天换劫诀》一层功法境界：

| Stage | 中文名 | English / ID | 解锁内容 | 天劫强度 | 修为上限 StageQiCap |
|-------|-------|--------------|---------|---------|---------------------|
| 0 | 凡骨 | MortalBone | 序章：凡间作物种田 | 无（教学） | — |
| 1 | 淬皮 | SkinTempering | 灵草种植、基础炼丹、第一阶天劫 | 青雷 ×2–3 | 100 |
| 2 | 锻骨 | BoneForging | 辅槽位、生骨丹、绝缘阵 | 青雷 ×3–5 | 200 |
| 3 | 通脉 | MeridianOpening | 经脉开辟子玩法、引雷阵、紫雷出现 | 青雷+紫雷 ×5–8 | 400 |
| 4 | 凝丹（伪） | FalseCore | 淬体增效丹、走火丹 | 紫雷为主 ×8–12 | 700 |
| 5 | 破丹 | CoreShattering | 金雷出现、驯化雷兽 | 紫+金雷 ×12–18 | 1100 |
| 6 | 化神 | SpiritForm | 诛仙雷、游方散仙神秘交易 | 金+诛仙雷 ×18–25 | 1600 |
| 7 | 碎凡骨 / 飞升前夜 | AscensionEve | 终极紫雷劫池（通关） | 紫雷劫池（60s） | 2200 |

### 1.2 阶段解锁原则

每阶段解锁**一类核心能力**：
- Stage 1：基础循环（种灵草 + 炼基础丹 + 第一阶天劫）。
- Stage 2：进阶炼丹（辅槽 + 生骨丹）+ 绝缘阵。
- Stage 3：经脉子玩法 + 引雷阵 + 紫雷（难度跳点）。
- Stage 4–6：依次解锁高级丹药、阵法升级、特殊事件（驯兽/交易）。
- Stage 7：终局，全部工具齐备，通关考验。

解锁内容"刚刚好"配合下一阶天劫——玩家永远在面对"用现有工具破解更强雷"的挑战。

### 1.3 修为 (StageQi) 上限曲线

```
StageQiCap(stage) = round(BaseQiCap * GrowthFactor^(stage-1))
```

- `【可调参数】BaseQiCap`（默认 100，stage 1）。
- `【可调参数】GrowthFactor`（默认 1.8）—— 每阶修为上限约 ×1.8。
- 上表的 100/200/400/700/1100/1600/2200 即按此生成（取整）。

指数增长保证后期突破需要更多次天劫（更多淬体），节奏自然拉长。

---

## 2. 经脉开辟 (Meridian) —— 阶段内子进度

### 2.1 经脉模型

每阶段（stage ≥ 3）内，玩家有 `MeridianCount(stage)` 条经脉可开辟。经脉开辟是**阶段内的子进度**，由天雷淬体推进：

```
MeridiansPerStage(stage):
  stage 3: 3 条
  stage 4: 5 条
  stage 5: 7 条
  stage 6: 9 条
  stage 7: 12 条
```

每开辟一条经脉 = 阶段进度推进 `StageQiCap / MeridiansPerStage`。

### 2.2 经脉开辟机制

```
TemperingStack 累积到 MeridianThreshold 时:
    open next Meridian
    StageQi += StageQiCap / MeridiansPerStage
    解锁该经脉对应的被动加成
```

即"每扛 N 道雷开一脉"。这把抽象的"修为增长"具象化为可数的经脉里程碑，给玩家清晰的进度反馈。

### 2.3 经脉加成示例

每条经脉开辟提供一个小永久加成（数据驱动）：

| 经脉类型 | 加成 |
|---------|------|
| 灵脉 (SpiritMeridian) | +灵气感知（灵草生长 +5%） |
| 药脉 (HerbMeridian) | +丹药吸收（炼丹 score +5%） |
| 体脉 (BodyMeridian) | +HP 上限（+10 HP） |
| 御雷脉 (LightningMeridian) | +雷伤减免（-5%） |
| 神脉 (MindMeridian) | +擦弹窗口（+0.05 s） |

玩家可在 stage 内**选择开辟顺序**（部分自由度），实现 build 差异化。

- `【可调参数】MeridianBonusPerType`（上表，数据驱动）。

---

## 3. 突破机制 (Breakthrough)

### 3.1 触发条件

```
StageQi >= StageQiCap(currentStage)
         AND 刚完成一次成功天劫
         → trigger Breakthrough
```

突破紧接天劫成功之后（同一次天劫既是淬体来源也是突破考验）。叙事：扛过天劫 = 功法突破。

### 3.2 突破流程

1. **过场**：天劫结束 → 屏幕白光 → 凡骨碎裂/重塑动画 → 显示 `突破至 [下一阶]`。
2. **结算**：
   - `currentStage += 1`
   - `StageQi = OverflowRetention * (StageQi - StageQiCap)`（溢出保留，见 `05-...md` §4.5）。
   - `TemperingStack = 0`（重置，新阶段从头淬）。
   - 解锁新阶段内容。
   - 经脉加成永久保留。
3. **状态恢复**：HP 全回，丹毒 -50%（突破时排毒）。

### 3.3 突破失败后果

突破本身不"失败"（成功天劫 = 成功突破），但**天劫中死亡**会触发失败态（见 §7）。另外引入"走火入魔"风险：

- 若玩家服用 `走火丹 MadnessPill` 过多或 `MadnessValue`（走火值）累积超阈，突破时有 `BreakthroughMadnessChance` 概率走火入魔：
  - 修为倒退一级（StageQi -= StageQiCap/2）。
  - 永久负面 buff（如 HP 上限 -10%）。
  - 极端情况触发"走火入魔结局"（见 `02-narrative-bible.md`）。

- `【可调参数】MadnessValueCap`（默认 100）。
- `【可调参数】BreakthroughMadnessChance`（默认 = MadnessValue / 200，即满走火值 50% 概率）。

---

## 4. 功法进度与天劫次数的耦合

### 4.1 一次天劫推进多少进度？

```
TemperingGainPerStrike = 见 05-...md §4.2 (默认满额 10 StageQi)
StrikesPerTribulation(stage) = 见 05-...md §5.3
TotalGainPerTribulation = TemperingGainPerStrike * StrikesPerTribulation * ExposureAvg
```

例：stage 3，每波 5 道，2 波 = 10 道。假设平均 ExposureCoeff = 0.6（部分硬扛部分代接）：
`TotalGain = 10 * 10 * 0.6 = 60 StageQi`。
stage 3 上限 400 → 一次天劫推进 15% → 约需 6–7 次天劫完成 stage 3。

### 4.2 进度曲线（关键）

每阶段需要的天劫次数：

```
TribulationsToClear(stage) ≈ StageQiCap(stage) 
                           / (TotalGainPerTribulation(stage))
```

设计目标曲线（"险而可破"）：

| Stage | 修为上限 | 估计每次天劫收益 | 估计天劫次数 | 累计时长 |
|-------|---------|----------------|------------|---------|
| 1 | 100 | 30 | 3–4 | ~1 小时 |
| 2 | 200 | 50 | 4–5 | ~2 小时 |
| 3 | 400 | 70 | 6–7 | ~4 小时 |
| 4 | 700 | 100 | 7–8 | ~6 小时 |
| 5 | 1100 | 140 | 8–9 | ~9 小时 |
| 6 | 1600 | 180 | 9–10 | ~13 小时 |
| 7 | 2200 | 劫池一次性 | 1（终局） | ~15 小时通关 |

总时长目标 15–20 小时主线。每次天劫间隔由玩家种田/炼丹节奏决定（积累资源 → 渡劫 → 突破）。

- `【可调参数】TargetTotalHours`（默认 18 小时）—— 用于反推各项倍率。

---

## 5. 难度曲线（险而可破）

### 5.1 三轴递增

随阶段，三条难度轴同步上升：

**(a) 天劫强度轴**：
- 雷数 ↑（见 `05-...md` §5.3）。
- 雷类型升级（青→紫→金→诛仙）。
- 预兆时间 ↓（反应窗口收紧）。

**(b) 丹毒风险轴**：
- 高阶丹方材料药性更极端（更易炸炉）。
- 走火丹等危险品诱惑增加。
- 灾年/魔修事件频率 ↑。

**(c) 资源稀缺轴**：
- 高阶灵草种子更稀有。
- 高阶阵法材料更难获取。
- 经济通胀（散仙物价 ↑）。

### 5.2 玩家工具递增（同步）

对冲难度上升，玩家工具也递增：

| Stage | 新增防御 | 新增丹药 | 新增设施 |
|-------|---------|---------|---------|
| 1 | — | 避雷丹、净毒丹 | 基础丹炉 |
| 2 | 绝缘阵 | 生骨丹 | 储物保鲜 |
| 3 | 引雷阵 | 淬体增效丹 | 聚灵阵 |
| 4 | 阵法升级 | 强骨丹 | 灵气管 |
| 5 | 驯化雷兽 | 引雷丹 | 高级炉 |
| 6 | 神秘交易 | 走火丹 | 阵眼重布 |
| 7 | 全部 | 全部 | 全部 |

### 5.3 "险而可破"曲线设计原则

每个阶段的难度峰值应满足：**用该阶段解锁的全部工具，存在至少一种稳定通关 build**。验证方法（移交 `17-testing-and-automation.md`）：用蒙特卡洛无头模拟，对每阶段运行 1000 次"理论最优 build"渡劫，要求胜率 ≥ 70%（可调）。

- `【可调参数】MinClearRateTarget`（默认 0.7）—— 自动平衡的目标胜率。

---

## 6. 终局：终极紫雷劫池 + 飞升

### 6.1 通过条件（详见 `05-...md` §6）

Stage 7 修为满 → 触发**终极紫雷劫池**（非普通天劫）：
- 持续 60 s 的雷池，无限雷生成。
- 通过条件：累计 `TemperingStack ≥ FinalTemperingThreshold`（默认 `TemperingCap(7) * 1.5`）。
- 失败：HP ≤ 0 → 走火入魔结局。

### 6.2 飞升结局

达到阈值 → 触发"凡骨碎裂、白日飞升"过场：
- 凡骨崩解，玩家以"借天淬炼"之体超脱。
- 显示通关画面 + 总用时 + 统计（渡劫次数、炸炉次数、丹毒峰值等）。
- 解锁 New Game+（可选，见 §7.4）。

### 6.3 其他结局（非通关）

详见 `02-narrative-bible.md`：
- **凡人暴毙**：HP 归 0（stage ≥ 3）。
- **走火入魔**：MadnessValue 累积超阈 + 突破时触发。
- **低阶飞升**：在 stage 5/6 主动选择"小飞升"，提前结束游戏（次优结局）。
- **归隐**：放弃偷天，回归凡人生活（隐藏结局）。

---

## 7. 失败态与软重置（roguelite 元素取舍）

### 7.1 死亡的后果（按阶段分级）

| 阶段 | HP ≤ 0 后果 |
|------|-----------|
| Stage 0–1 | 教学保护，无死亡（剧情强制存活） |
| Stage 2 | 重伤昏迷：HP=20% 醒来，损失 50% TemperingStack，StageQi 倒退半级 |
| Stage 3–4 | 真正死亡：触发"凡人暴毙"结局（建议存档回退，见 §7.2） |
| Stage 5–7 | 死亡 + 高概率走火入魔结局 |

### 7.2 推荐方案：存档 + 软损失（非 roguelite permadeath）

**推荐**：采用**手动存档 + 死亡回退到上次存档**模式，而非纯 roguelite permadeath。

理由：
1. **本作节奏慢**（15–20 小时主线），permadeath 会让玩家因一次失误损失数小时，劝退。
2. **核心循环是策略积累**（种田/炼丹/布阵），不是反应（如 Hades）。策略游戏更适合"读档重试 + 优化布局"。
3. **凡人挣扎感已由 HP 脆弱/丹毒/天劫难度提供**，不需要 permadeath 加码。
4. **C4 可自动化测试**不需要 permadeath（无头模拟可单独跑天劫序列）。

具体规则：
- 玩家可任意时刻手动存档（无限制）。
- 死亡时自动回退到**上次存档**（"轮回"叙事：天劫中陨落，灵识回溯）。
- 软损失：回退后保留 10% 的本次会话 TemperingStack（"虽死有悟"），降低纯损失感。
- 关键节点（突破后、天象触发）自动存档。

- `【可调参数】DeathRetainTemperingFraction`（默认 0.10）。

### 7.3 备选方案：roguelite meta progression（不推荐但留选项）

若主创希望更硬核，可启用 roguelite 模式：
- 死亡 = 永久损失当前 run。
- 但保留 meta 货币（`道痕 DaoMark`），可在新 run 解锁永久加成（如 +初始 HP、+种子数、+丹方碎片）。
- meta 加成必须**有限且不影响策略深度**（避免"靠 grind 通关"）。

参考 Hades / Dead Cells 的 meta 设计：meta 加成主要提供**早期加速**而非**后期通关**，保证后期仍是策略考验。

- 若启用：`【可调参数】MetaProgressionEnabled`（默认 false）。

### 7.4 New Game+（通关后）

通关后解锁 NG+：
- 保留全部经脉加成。
- 难度全面提升（雷数 ×1.3、丹毒衰减 ×0.7、种子稀缺 ×1.5）。
- 解锁隐藏结局/隐藏灵草品种。
- 给硬核玩家"再来一遍"的理由。

- `【可调参数】NGPlusDifficultyMultiplier`（默认 1.3）。

---

## 8. 阶段状态机（轻量伪代码）

```
state PlayerProgression:
    stage: int = 0
    stageQi: int = 0
    temperingStack: int = 0
    openedMeridians: List[Meridian] = []
    madnessValue: int = 0

function onTribulationSuccess(tribulation):
    temperingStack += tribulation.totalGain
    // 开经脉
    while temperingStack >= MeridianThreshold(stage) 
          AND openedMeridians.size < MeridiansPerStage(stage):
        openMeridian(nextMeridianChoice())
        stageQi += StageQiCap(stage) / MeridiansPerStage(stage)
        temperingStack -= MeridianThreshold(stage)
    // 阶段满
    if stageQi >= StageQiCap(stage):
        breakthrough()

function breakthrough():
    if madnessCheck():   // 走火入魔检定
        applyMadnessPenalty()
        return
    stage += 1
    stageQi = round((stageQi - StageQiCap(stage-1)) * OverflowRetention)
    temperingStack = 0
    unlockStageContent(stage)
    hp = hpMax
    pillPoison *= 0.5
    saveAuto()
```

---

## 9. 可调参数清单（移交 14-...md 收口）

| 参数 | 默认 | 单位 | 语义 |
|------|------|------|------|
| `StageQiCap(stage)` | 100/200/400/700/1100/1600/2200 | StageQi | 各阶修为上限 |
| `BaseQiCap` | 100 | StageQi | stage 1 基准 |
| `GrowthFactor` | 1.8 | 倍率/阶 | 修为指数增长 |
| `MeridiansPerStage` | 3/5/7/9/12 | 条 | stage 3+ 经脉数 |
| `MeridianThreshold` | StageQiCap/Meridians | StageQi | 开一脉所需 |
| `MeridianBonusPerType` | 见 §2.3 | — | 经脉加成（数据驱动） |
| `OverflowRetention` | 0.3 | 比例 | 突破后溢出保留 |
| `MadnessValueCap` | 100 | 走火值 | 走火阈值 |
| `BreakthroughMadnessChance` | Madness/200 | 概率 | 突破走火概率 |
| `TargetTotalHours` | 18 | 小时 | 主线目标时长 |
| `MinClearRateTarget` | 0.7 | 比例 | 自动平衡目标胜率 |
| `FinalTemperingThreshold` | TemperingCap(7)×1.5 | StageQi | 终极劫池通过门槛 |
| `DeathRetainTemperingFraction` | 0.10 | 比例 | 死亡保留淬体 |
| `NGPlusDifficultyMultiplier` | 1.3 | 倍率 | NG+ 难度 |
| `MetaProgressionEnabled` | false | — | roguelite 模式开关 |

---

## 10. 开放问题（需主创拍板）

- **Q1（最重要）**：死亡是**读档**还是 **roguelite permadeath + meta 进度**？本文强烈推荐**读档 + 软损失**（理由 §7.2）。若主创追求硬核 roguelite 受众，可启用 meta 模式（§7.3），但需配合 `17-testing-and-automation.md` 重新平衡。
- **Q2**：阶段数 7 阶是否合适？太多则后期拖沓；太少则节奏太快。本文 7 阶对应 ~18 小时主线，可按 `TargetTotalHours` 调整。
- **Q3**：经脉加成是固定还是可选？本文部分可选（玩家选开辟顺序），实现 build 差异化；若简化可改固定顺序。
- **Q4**：低阶飞升（stage 5/6 提前通关）是否保留？本文保留作为"次优结局"，给厌战玩家出口；若主创希望强制通关 stage 7，可移除。
- **Q5**：走火入魔结局是否过 punishing？它是服用走火丹的代价，设计上是"赌徒的归宿"。若主创认为过严，可改为可恢复的负面 buff 而非结局。

---

## 参考资料

- [Progression Systems in Roguelite Games - Theseus Thesis（阶段曲线与 meta 设计）](https://www.theseus.fi/bitstream/handle/10024/881994/2/Kammonen_Eino.pdf)
- [Meta-progression Thesis - DIVA Portal（meta 进度与难度曲线平滑）](https://his.diva-portal.org/smash/get/diva2:2072480/FULLTEXT01.pdf)
- [Difficulty Systems in Modern Roguelikes（Hades heat / Dead Cells boss cells 参考）](https://www.youtube.com/watch?v=mImhJ1PqBgo)
- [Roguelikes, Persistency, and Progression（永久升级设计）](https://www.youtube.com/watch?v=G9FB5R4wVno)
- [5 Essential Tips to Make Your Roguelite Game Work（基础机制与难度平衡）](https://entaltostudios.com/5-essential-tips-to-make-your-roguelite-game-work/)
- [Meta progression with gradual tutorial（meta 作为渐进教程）](https://notes.hamatti.org/gaming/video-games/meta-progression-with-gradual-tutorial-in-roguelike-games)
