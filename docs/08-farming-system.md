# 种田系统：灵气驱动的生长 + 土壤导电性 + 空间布防

> 本文设计种田核心流程、灵气生长模型、土壤系统、季节历法、地形导电性（与天雷/阵法耦合），以及"种田即布防"的空间策略。
> 上游宪法：`00-DESIGN-BRIEF.md` §3 核心循环、§5、§7（C3 确定性 / C4 可无头测试 / C6 数据驱动）。
> 兄弟文档：灵草药性见 `06-mechanic-alchemy.md` §2；导电性如何影响天雷见 `05-mechanic-tribulation.md` §3.2；天象对生长的影响见 `07-mechanic-celestial-events.md`；内容表见 `15-content-tables.md`。

---

## 0. 设计意图

种田是**核心循环的入口与地基**。它承担三重身份：

1. **资源产地**：灵草是炼丹唯一主料来源。
2. **防御布局**（本作最大创新）：灵草种植位置 = 天劫时阵法布局。种田不是孤立的治愈玩法，而是**平时布防**。
3. **慢节奏锚点**：90% 游戏时间在种田，提供治愈感与掌控感，反衬天劫的失控。

灵感坐标：星露谷物语（翻地/浇水/季节/收获循环）× 修仙灵气设定 × 塔防前置布局。

---

## 1. 核心流程

### 1.1 凡间作物 vs 灵草

游戏区分两类可种植物：

| 类型 | 凡间作物 (MortalCrop) | 灵草 (SpiritHerb) |
|------|---------------------|------------------|
| 灵气需求 | 无 | 必需 |
| 用途 | 食物（玩家饥饿度）/出售 | 炼丹材料 / 阵法阵眼 / 避雷草 |
| 生长速度 | 快（3–7 天） | 慢（7–30 天） |
| 失败惩罚 | 低（重种即可） | 高（种子稀缺） |
| 导电性 | 中性（普通植物） | 因属性而异（金属草高导电） |
| 来源 | 普通种子（村落购买） | 储物戒/天象掉落/舔包 |

序章教学用凡间作物；第一幕获得储物戒后引入灵草。

### 1.2 标准循环（六步）

```
翻地(Till) → 播种(Sow) → 照料(Tend: 浇水/供灵) → 生长(Grow) → 收获(Harvest) → 处理(留种/炼丹/出售)
```

1. **翻地 Till**：消耗体力，把裸地变可种植的农田格（`FarmTile`）。翻地可选施加底肥（影响初始肥力）。
2. **播种 Sow**：把种子放入翻好的格。每格一株。
3. **照料 Tend**：
   - **浇水 Water**：凡间作物必需（无水不长）。
   - **供灵 ChannelQi**：灵草必需（无灵气不长）。供灵方式：自然灵气浓度、人工引导（消耗玩家灵力/灵气结晶/阵法）、肥料。
4. **生长 Grow**：每日 dayChange 时结算（参考星露谷），按 §2 生长模型推进。
5. **收获 Harvest**：成熟后采收，得灵草 + 可能得种子。
6. **处理**：留种（自循环）、炼丹（核心出口）、出售（次要）、做阵眼（金属性草）。

### 1.3 体力与日限

玩家每日有 `StaminaCap`（默认 100）体力：
- 翻地 `-TillStaminaCost`（默认 8）。
- 浇水 `-WaterStaminaCost`（默认 2）。
- 供灵 `-ChannelStaminaCost`（默认 5 + 灵力消耗）。
- 体力归零 → 强制休息（结束当日，进入次日）。

- `【可调参数】StaminaCap`（默认 100）。
- 体力恢复靠睡眠/食物。

---

## 2. 灵气驱动的生长模型

### 2.1 公式结构

灵草每日 `dayChange` 时生长度推进：

```
GrowthDelta = BaseGrowth 
            * QiFactor(tile.QiDensity)
            * SoilFactor(tile.Fertility)
            * SeasonFactor(herb, currentSeason)
            * EventFactor(activeEvents)
            * CareFactor(tile.watered, tile.channeled)
            * HerbAffinity(herb)
```

每株灵草有 `GrowthProgress`（0–100），满 100 视为成熟可收。生长可分阶段视觉（幼苗 → 茎叶 → 花蕾 → 成熟，参考星露谷 stage 切换）。

### 2.2 各因子语义

**(a) `BaseGrowth`** —— 基础日生长。
- `【可调参数】BaseGrowthPerDay`（默认 5.0）—— 标准灵草 20 天成熟。

**(b) `QiFactor(QiDensity)`** —— 灵气浓度因子（核心）。
```
QiFactor = clamp(QiDensity / QiOptimum, 0, 2.0)
```
- `QiDensity`：该格的灵气浓度，来自天地灵气基底 + 灵脉加成 + 肥料 + 阵法引导（见 §3）。
- `【可调参数】QiOptimum`（默认 50）—— 灵草理想灵气浓度，达此值生长正常。
- 低于 QiOptimum 生长减缓；高于则加速（上限 2.0）；极高（>QiToxicThreshold）反而伤草（灵气过载）。

**(c) `SoilFactor(Fertility)`** —— 土壤肥力因子。
```
SoilFactor = clamp(Fertility / FertilityOptimum, 0.2, 1.5)
```
- 肥力每日消耗 `FertilityDrain`（默认 2/天/株），需补肥恢复。
- 肥力归零 → `SoilFactor = 0.2`（生长几近停滞）。

**(d) `SeasonFactor`** —— 季节适配（见 §4）。

**(e) `EventFactor`** —— 天象调节（见 `07-...md`）。
- 灵气潮汐：×2。灵气枯竭：×0（甚至负衰减）。灵雨：×1.5。

**(f) `CareFactor`** —— 玩家照料。
- 已浇水 + 已供灵：1.0。
- 漏浇水：×0.5。
- 漏供灵：×0.3（灵草无灵不长）。
- 双漏：×0.1（几近枯死）。

**(g) `HerbAffinity`** —— 灵草本性和药性偏好。
- 寒性草在冷季 +0.2 加成；热性草在热季 +0.2 加成。
- 金属性草对灵气需求低（×1.2 通用，可在贫瘠地种）—— 这正是它适合做外围避雷草的原因。

### 2.3 过熟与枯萎

- **过熟 Overripe**：成熟后未收，每日 `OverripeDecay`（默认 -3 成熟度/天），降到 0 枯萎。某些丹方反而要"过熟草"（如走火丹），制造延迟收获的策略。
- **枯萎 Wilted**：成熟度 0 且持续缺水缺灵 N 天，灵草死亡，种子可能保留（50%）。
- **天象枯萎**：灾年期间强制每日 `-FamineDecayRate`（见 `07-...md`）。

- `【可调参数】OverripeDecay`（默认 3 成熟度/天）。
- `【可调参数】WiltThreshold`（默认 0 持续 3 天）。

---

## 3. 土壤系统

### 3.1 肥力 (Fertility)

每格 `FarmTile` 有 `Fertility` 值（0–100）：
- 初始：翻地后 = `BaseTillFertility`（默认 60）。
- 底肥加成：翻地时施 ` compost ` 等 +N。
- 消耗：每株每日 `-FertilityDrain`（默认 2）。
- 恢复：
  - **轮作 CropRotation**：种过一季后留空一季（或种凡间豆科作物），肥力 +`RotationRecover`（默认 20）。
  - **施肥 Fertilize**：投入 compost / 灵气肥料 / 废丹（见 `06-...md` §8.1）+N。
  - **灵脉过境**：自动恢复（见 `07-...md` 灵脉异动）。

### 3.2 连作惩罚 (Continuous Cropping)

同一格连续种同种灵草（或同属性）多季，触发 `ContinuousPenalty`：
- 第二季：肥力消耗 ×1.5。
- 第三季：×2.0 且生长 -20%。
- 鼓励轮作与多区域种植。

- `【可调参数】ContinuousPenaltyRate`（默认 0.5/季）。
- `【可调参数】RotationRecoverBonus`（默认 20 肥力）。

### 3.3 土壤类型与导电性（关键耦合！）

不同土壤类型有不同 `Conductivity`，直接服务于天雷 targeting（见 `05-...md` §3.2）。这是种田与塔防的耦合点：

| 土壤类型 | 来源 | Conductivity | 肥力上限 | 备注 |
|---------|------|-------------|---------|------|
| 湿润泥土 WetLoam | 浇水后/水边 | 1.8（强导电） | 80 | 高肥但易引雷 |
| 普通农田 Loam | 标准翻地 | 1.0（基准） | 100 | 默认 |
| 干燥沙土 DrySand | 干旱地/沙地 | 0.5（弱导电） | 50 | 低肥但抗雷 |
| 焦土 Scorched | 雷击/魔修过境 | 1.2 | 30 | 需翻新才能复种 |
| 绝缘垫层 Insulated | 玩家铺设（消耗材料） | 0.1 | 70 | 主动绝缘，保护核心 |
| 金属矿露头 MetalOre | 矿脉地 | 1.5 | 0（不可种） | 强引雷，影响邻格 |
| 岩石 Rocky | 山岩 | 0.3 | 0 | 不可种 |

> 设计：玩家可主动改造土壤（铺绝缘垫、引水变湿泥土），但每种改造有 trade-off。例如把核心药草区铺成绝缘垫层抗雷，但肥力上限降到 70，需更频繁施肥。这就是"种田决策 = 防御决策"。

- `【可调参数】SoilTypeConductivity`（上表，数据驱动）。
- `【可调参数】InsulatedLayerCost`（默认 5 单位绝缘材料/格）。
- `【可调参数】ScorchedRenewCost`（默认 10 体力 + 灵气结晶）。

---

## 4. 季节与历法

### 4.1 历法

参考星露谷：一年 4 季，每季 28 天。
- **春 Spring**：万物生，多数灵草生长正常。
- **夏 Summer**：热性草加成，雷暴多发（影响天劫倒计时）。
- **秋 Autumn**：金属性草加成，魔修活跃。
- **冬 Winter**：寒性草加成，灾年易发，灵气稀薄。

- `【可调参数】DaysPerSeason`（默认 28）。
- `【可调参数】SeasonsPerYear`（默认 4）。

### 4.2 季节对灵草影响

```
SeasonFactor(herb, season):
  if herb PreferredSeason == season: return SeasonOptimalBonus (1.5)
  elif herb WeakSeason == season: return SeasonWeakPenalty (0.5)
  else: return 1.0
```

- 寒性草：PreferredSeason = Winter，WeakSeason = Summer。
- 热性草：PreferredSeason = Summer，WeakSeason = Winter。
- 金属性草：PreferredSeason = Autumn（秋金）。
- 平性草：无偏好（稳定但慢）。

### 4.3 季节性天象

每季有不同天象概率分布（见 `07-...md` §1.2 `SeasonModifier`）：
- 春：灵雨多发（喜）。
- 夏：雷暴多发（影响天劫）。
- 秋：游方散仙多发（交易窗口）。
- 冬：灾年多发（生存压力）。

---

## 5. 地形与导电性：种田即布防

### 5.1 地块导电性表

整合 §3.3 与其他地形元素：

```
FarmGrid tile.Conductivity 来源：
  base = SoilType.conductivity
  + MoistureBonus (if watered in last N hours: +0.5)
  + MetalOreProximity (相邻金属矿: +0.3/邻居)
  + WaterProximity (相邻水域: +0.4/邻居)
  + ArrayEffect (引雷阵/绝缘阵)
  * WeatherWetness (雨天全场 ×1.2)
```

雨天全场导电性 +20% —— 雨天渡劫更危险！这是种田玩家会观察的天气情报。

### 5.2 空间布局策略（核心玩法）

鼓励玩家规划核心区 vs 外围区：

```
┌────────────────────────────────┐
│  [避雷草区外围]  [避雷草]         │  ← 金属性草 + 引雷阵，吸引雷
│  [金属矿]                        │
│  ┌──────────────────────┐      │
│  │ [绝缘垫层]            │      │  ← 绝缘阵保护核心
│  │ [核心药草区]           │      │  ← 稀有寒/热/温草，高灵气
│  │ [丹炉][储物戒]         │      │
│  │ [玩家家]              │      │
│  └──────────────────────┘      │
│  [水域]  [避雷草]                │  ← 水域天然引雷，外侧布置避雷草
└────────────────────────────────┘
```

**空间策略原则**：
- **核心药草区**：稀有/脆弱/高产灵草，种在中心，被绝缘阵保护，土壤铺绝缘垫层（牺牲肥力换安全），高灵气带。
- **外围避雷草区**：金属性草环绕，种在外围/金属矿旁/水域边（天然高导电处），把雷锁死在外。
- **诱饵区**：便宜快熟的凡间作物或低级灵草，故意种在引雷阵心，给雷劈（保护核心）。

### 5.3 与天雷 targeting 的耦合（具体）

回顾 `05-...md` §3.2 权重公式：
- 玩家把金属性草种在金属矿旁 → `MetalAttraction` 叠加 → 雷必劈外围。
- 核心区铺绝缘垫 → `Conductivity × 0.1` → 雷几乎不劈核心。
- 水域天然高导电 → 玩家可在水域旁种避雷草"双重吸引"。

**这就是"种田即布防"**：玩家平时的每一锄头、每一粒种子的位置，都在为天劫布阵。无需切换到"防御模式"——种田的布局就是防御的布局。

---

## 6. 种植布局的空间策略

### 6.1 三大区域规划

| 区域 | 位置 | 土壤 | 灵草 | 阵法 | 灵气 |
|------|------|------|------|------|------|
| 核心药草区 | 中心 | 绝缘垫/普通 | 稀有寒/热/温草 | 绝缘阵覆盖 | 高（灵脉/肥料） |
| 外围避雷草区 | 外环 | 普通或金属矿邻 | 金属性草 ×多 | 引雷阵阵眼 | 中低（金草耐受） |
| 诱饵/缓冲区 | 引雷阵心 | 普通 | 廉价凡间作物 | — | 低 |

### 6.2 布局博弈

布局不是一劳永逸：
- **阶段升级**：高阶天劫需要更强避雷草（紫雷需更多金草），核心区可能需要扩建绝缘阵。
- **天象扰动**：`灵脉异动` 会改变灵气分布，可能迫使玩家迁移核心区。
- **季节调整**：冬种寒草要移到核心（避雷需求小），夏秋雷多发要加强外围。
- **魔修波及**：随机摧毁格，可能破坏精心布局——保留冗余/备份区。

### 6.3 灵气引导设施

玩家可建造设施引导灵气流向核心区：
- **聚灵阵 QiGatherArray**：被动把周围 N 格灵气汇集到阵心（核心药草区）。
- **灵气管 QiChannel**：连接灵脉到核心区，线性提升 QiDensity。
- 代价：消耗资源，且聚灵会**降低外围 QiDensity**（影响避雷草生长，但金草耐受低灵气，故可承受）。

- `【可调参数】QiGatherRadius`（默认 5 格）。
- `【可调参数】QiGatherEfficiency`（默认 0.6 比例汇聚）。

---

## 7. 收获与种子循环

### 7.1 收获产出

成熟灵草收获得：
- **主产物**：灵草本体 ×`HerbYield`（默认 1–3 株，视品质）。
- **副产物（几率）**：种子 ×`SeedDropChance`（默认 0.5）。
- **品质**：`Quality = f(GrowthCompleteness, SoilFertilityAvg, CareConsistency)`，影响炼丹 score（见 `06-...md` §6）。

### 7.2 留种机制

- 收获时可选择"留种模式"：消耗一株灵草，得 `Seeds ×SeedFromStockMode`（默认 2）。
- 种子属性继承母株（可能微小变异）。
- 留种是种子自循环的主要途径，减少对外部种子源的依赖。

### 7.3 种子来源与稀缺性

| 来源 | 数量 | 稀缺度 | 备注 |
|------|------|-------|------|
| 储物戒初始 | 2–3 种 ×5 粒 | 启动 | 序章后获得 |
| 留种 | 自循环 | 主要 | 主稳定来源 |
| 天象掉落（异象种子） | 1–2 | 稀有 | 可能是新品种 |
| 舔包（魔修战场） | 随机 | 偶发 | 可能含破损种子（成活率低） |
| 游方散仙交易 | 1–3 | 偶发 | 需货币/丹药换 |
| 灵脉挖掘 | 1 | 罕见 | 古代种子（强属性） |

**种子稀缺性是凡人挣扎感的核心**：种子不能随便买，损失一季种子意味着该品种可能断种。玩家会小心翼翼保护留种区。

### 7.4 储存与新鲜度

灵草收获后进入储物戒，有 `Freshness` 衰减：
- 每日 `-FreshnessDecay`（默认 1/day）。
- 新鲜度影响炼丹 `HerbFreshnessFactor`（见 `06-...md` §2.2）。
- 鲜度 0 灵草变"陈草"，药性 -50%。
- **储存设施**：建"灵气保鲜柜"减缓衰减（×0.3）。

- `【可调参数】FreshnessDecay`（默认 1/day）。
- `【可调参数】FreshCabinetDecayMultiplier`（默认 0.3）。

---

## 8. 边界情况

- **未翻地直接播种**：禁止（UI 灰）。
- **灵草种在水域/岩石**：禁止；UI 提示"不可种植"。
- **同格多株**：禁止（每格一株，鼓励空间规划）。
- **种子为 0 时播种**：禁止。
- **天劫期间种植/收获**：禁用（见 `05-...md` §7.5）。
- **过熟草被妖兽啃食**：妖兽优先吃成熟/过熟草（见 `07-...md` 天骄降世）。
- **跨季节种植**：在季节最后一天播种，第二天换季时按新季节 `SeasonFactor` 计算（可能立即进入 weak season）。
- **储物戒满**：收获时若储物戒满，提示"无法收获"，灵草留在地里继续过熟。

---

## 9. 可调参数清单（移交 14-...md 收口）

| 参数 | 默认 | 单位 | 语义 |
|------|------|------|------|
| `StaminaCap` | 100 | 体力 | 每日体力上限 |
| `TillStaminaCost` | 8 | 体力 | 翻地消耗 |
| `WaterStaminaCost` | 2 | 体力 | 浇水消耗 |
| `ChannelStaminaCost` | 5 | 体力 | 供灵消耗 |
| `BaseGrowthPerDay` | 5.0 | 成熟度/天 | 基础日生长 |
| `QiOptimum` | 50 | QiDensity | 灵气理想值 |
| `QiToxicThreshold` | 150 | QiDensity | 灵气过载伤草 |
| `FertilityOptimum` | 80 | 肥力 | 肥力理想值 |
| `FertilityDrain` | 2 | 肥力/天/株 | 肥力消耗 |
| `BaseTillFertility` | 60 | 肥力 | 翻地初始肥力 |
| `ContinuousPenaltyRate` | 0.5 | /季 | 连作惩罚递增 |
| `RotationRecoverBonus` | 20 | 肥力 | 轮作恢复 |
| `OverripeDecay` | 3 | 成熟度/天 | 过熟衰减 |
| `WiltThreshold` | 0 持续3天 | — | 枯萎条件 |
| `DaysPerSeason` | 28 | 天 | 每季天数 |
| `SeasonsPerYear` | 4 | 季 | 每年季数 |
| `SeasonOptimalBonus` | 1.5 | 倍率 | 当季加成 |
| `SeasonWeakPenalty` | 0.5 | 倍率 | 弱季惩罚 |
| `HerbYield` | 1–3 | 株 | 收获产量 |
| `SeedDropChance` | 0.5 | 概率 | 收获掉种子 |
| `SeedFromStockMode` | 2 | 粒 | 留种产出 |
| `FreshnessDecay` | 1 | /天 | 鲜度衰减 |
| `FreshCabinetDecayMultiplier` | 0.3 | 倍率 | 保鲜柜衰减 |
| `InsulatedLayerCost` | 5 | 材料/格 | 绝缘垫铺设 |
| `ScorchedRenewCost` | 10+结晶 | 体力+资源 | 焦土翻新 |
| `QiGatherRadius` | 5 | 格 | 聚灵阵半径 |
| `QiGatherEfficiency` | 0.6 | 比例 | 聚灵效率 |
| `SoilTypeConductivity` | 见 §3.3 表 | 权重 | 土壤导电（数据驱动） |

---

## 10. 开放问题（需主创拍板）

- **Q1**：凡间作物（食物）是否保留？本文保留以提供序章教学与"饥饿度"压力；若主创希望聚焦修仙，可移除凡间作物，灵草直接作主粮（需简化炼丹外的食用机制）。
- **Q2**：灵气浓度是逐格独立还是全场统一？本文逐格（支持空间策略）；若简化可全场统一 + 灵脉修正。
- **Q3**：种子稀缺度——是否过于 punishing？本文偏严（凡人挣扎感）；若主创希望更治愈，可放宽留种产出或增加商人供种。
- **Q4**：土壤导电性的改造深度——是否允许玩家任意铺设绝缘垫？这影响"种田即布防"的灵活度。本文允许但限制材料成本。
- **Q5**：季节长度 28 天是否合适？太短则灵草（默认 20 天成熟）几乎只能种一季；可考虑延长到 35–40 天。

---

## 参考资料

- [Stardew Valley Wiki - Fertilizer（肥料与生长机制）](https://stardewvalleywiki.com/Fertilizer)
- [Stardew Valley Crop Growth Math（生长公式）](https://steamcommunity.com/sharedfiles/filedetails.html?id=3591825263)
- [Stardew Valley Farming Overview（种田循环参考）](https://stardewvalley.fandom.com/wiki/Farming)
- [Stardew Valley Crop Planner（生长周期可视化）](https://exnil.github.io/crop_planner/)
- [Five Qi (TCM Four Properties) Theory（药性理论基础）](https://baike.baidu.com/en/item/Four%20Natures/96092)
