# 机制二：凡骨丹毒 + 药性相克的非线性炼丹

> 本文深挖"必须炼丹"的刚需来源（丹毒）、药性相克的数值化、丹炉槽位与火候解谜、涌现配方规则。
> 上游宪法：`00-DESIGN-BRIEF.md` §3 核心循环、§5.2、§7（C3 确定性 / C4 可无头测试 / C6 数据驱动）。
> 兄弟文档：灵草药性来源见 `08-farming-system.md`；抗劫丹药用途见 `05-mechanic-tribulation.md`；丹方内容表见 `15-content-tables.md`；数值收口见 `14-game-balance-and-math.md`。

---

## 0. 设计意图

炼丹是连接**种田**与**天劫**的中枢系统。它必须满足三个目标：

1. **制造刚需**：凡人无灵根，生食灵草不吸收反积 `PillPoison`（丹毒），满即暴毙。→ 玩家**必须**炼丹。
2. **解谜深度**：药性寒热温平的相克 + 火候控制 + 投料顺序，构成非线性配方空间，玩家可"实验性发现"配方而非查表。
3. **抗劫出口**：炼丹的产出（避雷丹、生骨丹、净毒丹、淬体增效丹）直接服务于天劫。形成 `种田 → 炼丹 → 抗劫 → 突破` 的闭环。

灵感坐标：`Potion Craft`（火候 + 研磨 + alchemy map 涌现）× 中医四气理论（寒热温凉）× 修仙炼丹套路。

---

## 1. 丹毒 (PillPoison) 模型——"必须炼丹"的刚需

### 1.1 来源

玩家是「绝灵之体」无灵根，无法像修士那样直接吸收天地灵气与灵草精华。当玩家**生食灵草**（直接吃未炼制的灵草）或**误食残丹/废丹**时，无法消化的灵气在体内郁结为 `PillPoison`。

```
PillPoison += RawHerbPoisonValue * RawAbsorptionPenalty
```

- `RawHerbPoisonValue`：每种灵草的生食毒值（数据驱动，见 `15-content-tables.md`），与药性强度正相关。
- `【可调参数】RawAbsorptionPenalty`（默认 1.0）—— 凡骨生食的毒吸收率（100% 反噬）。

炼制过的丹药（合格品）`PillPoisonValue = 0` 或极低（残丹/废丹有部分毒，见 §8）。

### 1.2 积累/衰减/清除

**积累**：生食、误食废丹、炸炉反噬（见 §7）。

**衰减（被动）**：随时间缓慢代谢。

```
PillPoison -= decayBase * DeltaDays     // 2.0/游戏日（见 14 P005，R8）
```

- 丹毒被动衰减 `decayBase = 2.0 /游戏日`（**见 `14` §3.2 / P005**；旧 0.05/分钟折算 72/日远超 100 上限，已废弃，见 `20` R8）。极慢，靠时间清不现实，逼玩家炼净毒丹。

**清除（主动）**：
- `净毒丹 DetoxPill`：服用后立即 `-DetoxPillPower`（默认 30）。
- `灾年挖灵脉`：灾年期间（见 `07-mechanic-celestial-events.md`），灵脉露头，挖掘可"泄毒入地"，一次性 `-VeinDetoxPower`（默认 50）。
- `特定天象`：`灵雨` 天象期间被动衰减率 ×3。

### 1.3 暴毙阈值

```
if PillPoison >= PillPoisonCap: trigger DeathByPoison()
```

- `【可调参数】PillPoisonCap`（默认 100）—— 满值暴毙。
- 进阶玩法：PillPoison 越接近上限，玩家获得递增的负面状态（HP 上限 ↓、移动速度 ↓、丹药吸收 ↓），制造"险境操作"。

```
PoisonDebuff(PillPoison) = scale(PillPoison / PillPoisonCap)
  → HPMax multiplier, Speed multiplier, PillAbsorption multiplier
```

- `【可调参数】SoftCapThreshold`（默认 0.7）—— 达到 70% 开始出负面状态。

> 这给玩家一个"在暴毙前赌一把炼出净毒丹"的极限操作空间，呼应"凡人挣扎感"。

---

## 2. 药性体系（四气 + 平性）

### 2.1 四气理论参考（中医）

中医"四气"指药物的**寒、热、温、凉**（凉即微寒，温即微热），外加**平**性（中性）。寒凉药清热解毒，温热药温里散寒，平性药平和。详见参考资料。本作简化为四档 + 平：

### 2.2 药性向量模型

每种灵草带一个 `Property` 标签与一个 `Potency`（药性强 度）。为方便数值化，把药性投影到**一维药性轴**（"寒热轴"）：

```
PropertyAxisValue:
  寒 Cold   = -2.0  (强寒)
  凉 Cool   = -1.0  (微寒)
  平 Neutral =  0.0
  温 Warm   = +1.0  (微热)
  热 Hot    = +2.0  (强热)
```

每株灵草：

```
Herb {
  PropertyAxis: enum {Cold, Cool, Neutral, Warm, Hot}
  PropertyAxisValue: float    // 上表
  Potency: int                // 药性强 度 1..10，决定影响丹药强度
}
```

灵草对炉内药性总和的贡献：

```
Contribution(herb) = herb.PropertyAxisValue * herb.Potency * HerbFreshnessFactor
```

- `HerbFreshnessFactor`：刚采收=1.0，储存 N 天后递减（见 `08-farming-system.md` §7 收获储存）。

### 2.3 复合药性（高级）

进阶玩法：少数灵草带**双属性**（如"寒中带温"），表示为主轴 + 副轴：

```
Herb {
  PrimaryProperty: ...
  SecondaryProperty: ...  // 可选，强度仅 30%
}
```

这是后期涌现配方的来源之一。

### 2.4 中医七情配伍映射（药性相克的理论骨架）⭐ 差异化设计

> 中医**配伍七情**（源自《神农本草经》）描述两味药合用的七种关系。本作把它作为"为什么有些组合炸炉、有些净毒、有些增效"的**理论骨架与数据规则**，而非任意阈值。这把抽象的"药性冲突"落到有据可依、可学习、可数据驱动的成对规则上。详见 `20-design-decisions-and-reconciliation.md` R6 与参考资料。

七情与机制映射：

| 七情 | 中医含义 | 本作机制映射 | 数值效果（结构，默认值见 `14` §9） |
|------|---------|-------------|-------------------------------|
| **单行** | 单味独用 | 单方丹（§9.1 入门） | 单材料 + 辅料即可出最简丹 |
| **相须** | 两味**功效相似**者合用，强强增效 | **增效**：同类药性叠加放大 | `potencyMult = 1 + 相须Bonus`（如同为强寒） |
| **相使** | 一药为主、另一药**辅佐**增效 | **辅效**：副料提升主料提取 | 主料 `extraction × (1 + 辅效Bonus)` |
| **相畏** | 一种药的**毒副作用被另一种抑制** | **减毒**：降低有毒料的 PillPoison | 该料 `poisonValue × (1 − 畏减毒)` |
| **相杀** | 一种药能**消除**另一种的毒性 | **净毒**：净毒丹的理论根源（§1.2） | 产出丹自带 `−Detox` 或服后清丹毒 |
| **相恶** | 两药合用使**原有疗效降低/丧失** | **废丹**：score 大幅下降 | `score × 相恶Penalty`（如 0.3）→ 落入废丹区 |
| **相反** | 两药合用**产生毒性/剧变** | **炸炉**：寒热极端冲突 | 触发 `ExplosionThreshold`（§5.2 / 14 §9.3） |

**配伍规则的数据驱动落地**（C6）：七情不是硬编码逻辑，而是一张**成对兼容性表** `CompatibilityTable`，由内容表 `15-content-tables.md` 提供并经 Zod 校验：

```
interface CompatibilityRule {
  herbA: HerbId;  herbB: HerbId;
  relation: '相须'|'相使'|'相畏'|'相杀'|'相恶'|'相反';
  modifier: number;   // 增益/惩罚倍率
}
```

- `resolvePill`（§6.3）在打分前先查这张表，把所有成对关系折算进 `score` 与 `poison`。
- **十八反 / 十九畏 式"必炸药对"**：少数被标记 `relation=相反` 的特定药对（如 `Griefvein` 断肠藤 的寒热同体内部冲突、或设计上的禁忌对），命中即**无视火候强制炸炉**——给玩家"绝对禁忌"可学习，也制造黑色幽默（"凡人也知道这两样不能一起炼"）。这些禁忌对在 `15` 标注 `guaranteedExplosion: true`。
- **学习曲线**：玩家首次触发某七情关系，UI 弹出一句中医化提示（如"寒热同炉，相反成毒"），把知识显性化——失败可学习（Pillar 1）。

**与四轴/一维的关系**（呼应 `20` R6）：七情在**内部四轴** `[cold,hot,warm,neutral]` 上判定（相须=同轴同向强叠加；相反=寒热对轴极端冲突）；玩家面只看到**一维寒热轴**的平衡条与炸炉警告。即"理论用四轴，体验看一维"。

> 设计价值：七情把"非线性炼丹"从"调参凑阈值"升级为"有中医逻辑的配方推理"——玩家能像半个药师一样思考"这味太寒，得配点温的相使提效、再加相杀的解毒草"，这正是修仙炼丹的灵魂手感，也是本作区别于 Potion Craft 纯空间探索的差异化卖点。

---

## 3. 丹炉槽位系统 (Furnace Slots)

### 3.1 槽位布局

丹炉界面为**可视化槽位 + 火候条 + 药性平衡条**：

```
┌─────────────────────────────┐
│   [投入槽1] [投入槽2] [投入槽3]   │  ← 3 个主投料槽（初始解锁）
│   [投入槽4] [投入槽5]            │  ← 2 个辅槽（进阶解锁，stage 3+）
│                               │
│   火候条: ▓▓▓▓░░░░░░ [当前温度]   │
│   理想区间: ░░░▓▓▓▓▓░░░ [丹方定义]  │
│                               │
│   药性平衡条:  寒 ←——|——→ 热       │
│   冲突警告:    ⚠ 极端冲突!         │
│                               │
│   [起火] [控火] [出丹]            │
└─────────────────────────────┘
```

- `【可调参数】MainSlotCount`（默认 3）—— 初始主槽位数。
- `【可调参数】AuxSlotCount`（默认 2）—— stage 3+ 解锁的辅槽位。
- 每个槽位可放**一份灵草**（一株或一组，视丹方而定），或一种**辅料**（水/油/矿粉等基底）。

### 3.2 投料顺序的影响（非线性来源之一）

**投料顺序显著影响产出**。这是涌现配方的核心机制之一。

建模为：每次投料触发一次 `PropertyShift`（药性偏移）+ `HeatDelta`（火候变化），不同顺序导致中间状态不同，最终药性平衡与火候轨迹不同 → 不同产出。

```
on insert(herb, slot, order_index):
    current.PropertySum += herb.Contribution
    current.Heat += herb.HeatEffect * OrderHeatWeight(order_index)
    // 先投入的草"奠基"，后投入的草"调性"
    if order_index == 1: current.Foundation = herb.PropertyAxisValue
```

举例：
- **先寒后热**：寒奠基 → 热调和 → 出"平衡的祛寒丹"。
- **先热后寒**：热奠基 → 寒压制 → 出"激发性的爆丹"（可能炸炉）。
- 同样的两株草，顺序不同产出不同。

- `【可调参数】OrderHeatWeight(order)`（默认 [1.0, 0.7, 0.5, 0.3, 0.2]）—— 投料顺序对火候的影响权重。

### 3.3 投料时机（实时）

炼丹是**实时操作**（不暂停）：玩家在火候动态变化时投入材料。投料瞬间锁定该槽的贡献，但**药性会随火候变化而演变**（见 §4.3 加热演变）。这制造"看准时机下料"的反应式玩法。

> 备选方案（需主创拍板，见开放问题 Q2）：若希望更策略、更不反应，可改为"投料后自动炼制 N 秒"。本文推荐实时以保留紧张感。

---

## 4. 火候 (Heat) 控制

### 4.1 温度维度

丹炉温度 `FurnaceHeat` 是一个 0–100 的实时变化值：

```
FurnaceHeat in [0, 100]
0 = 冷炉    50 = 文火    80 = 武火    100 = 焚炉（炸炉风险）
```

### 4.2 玩家控火

玩家通过三个动作控制：
- `起火 Ignite`：温度从 0 升到 `IgniteTemp`（默认 30）。
- `鼓风 Bellows`：瞬时 `+BellowsBoost`（默认 +8），有冷却。
- `封火 Bank`：缓慢降温 `-BankRate`（默认 -2/s）。

温度自然漂移：炉子会缓慢向 `AmbientHeat`（默认 20）回归，玩家需持续维持。

- `【可调参数】HeatDriftRate`（默认 0.5/s）—— 自然漂移速度。
- `【可调参数】BellowsBoost`（默认 8）。
- `【可调参数】BellowsCooldown`（默认 1.5 s）。
- `【可调参数】BankRate`（默认 2/s）。

### 4.3 药性随火候演变（关键非线性来源）

炉内药性不是投料后冻结，而是**随温度演变**：

```
HeatPropertyShift = f(currentHeat)
  if currentHeat in [60, 80]: PropertySum drifts toward Hot (+DriftRate/s)
  if currentHeat in [10, 30]: PropertySum drifts toward Cold (-DriftRate/s)
  if currentHeat in [30, 60]: PropertySum stable (文火稳定区)
```

- `【可调参数】HeatDriftRate`（默认 0.3/s）—— 高/低温下药性漂移速度。

> 这意味着：同样的材料，在武火下炼出偏热的丹，在文火下炼出偏寒的丹。涌现配方由此而来。

### 4.4 理想火候区间

每个丹方定义一个 `IdealHeatRange`：

```
Recipe {
  IdealHeatRange: (min, max)   // e.g. 避雷丹要求 (55, 70)
  HeatDeviationPenalty: f(|avgHeat - IdealCenter|)  // 偏离降低成丹品质
}
```

平均火候 `AvgHeat` 在炼制全程记录，出丹时计算偏离：

```
HeatDeviation = |AvgHeat - IdealCenter| / (IdealHeatRange.width / 2)
QualityMultiplier = clamp(1 - HeatDeviation * HeatPenaltyFactor, 0, 1)
```

- `【可调参数】HeatPenaltyFactor`（默认 0.8）。

---

## 5. 药性平衡条与炸炉判定

### 5.1 平衡条 UI

屏幕中实时显示当前炉内 `PropertySum`（药性轴总和）：

```
寒 ━━━━━━━━━━━|━━━━━━━━━━ 热
        -10      0    +10
```

- 中心 0 = 完美平衡（平性丹）。
- 偏向寒/热 = 该属性的丹。
- 接近极端（|PropertySum| > `ConflictThreshold`）= 冲突警告，即将炸炉。

### 5.2 炸炉判定

```
if |PropertySum| >= ExplosionThreshold: trigger Explosion()
elif |PropertySum| >= ConflictThreshold: warning state ( escalating risk )
```

- `【可调参数】ConflictThreshold`（默认 15）—— 开始警告。
- `ExplosionThreshold = 14 + 2×stage`（**见 `14` §9.3 / P034**；阶段缩放；旧固定 25 已废弃，见 `20` R7）—— 必炸。

炸炉概率模型（在冲突区时每 tick 掷骰）：

```
P(explode per tick) = max(0, (|PropertySum| - ConflictThreshold)
                          / (ExplosionThreshold - ConflictThreshold))
                     * ExplosionRateBase
```

- `【可调参数】ExplosionRateBase`（默认 0.05/tick）—— 冲突区每 tick 炸炉基础概率。

**火候加剧**：当 `currentHeat > 80`（焚炉区）时，`ExplosionThreshold` 临时降低 `HeatExplosionAggr`（默认 5），更易炸。

### 5.3 炸炉后果

炸炉触发：
1. 材料全部损失（投入槽清空）。
2. `PillPoison += ExplosionPoisonBacklash`（默认 +20，丹毒反噬）。
3. 玩家 HP `-ExplosionDamage`（默认 -15，炸伤）。
4. 丹炉耐久 `-FurnaceDurabilityCost`（默认 -25%）；耐久归零丹炉损毁，需修复或更换。
5. 若炸炉规模大（`|PropertySum|` 远超阈值），波及相邻建筑（破坏 nearby 农田格 / 阵法）。

- `【可调参数】ExplosionPoisonBacklash`（默认 20）。
- `【可调参数】ExplosionDamage`（默认 15 HP）。
- `【可调参数】FurnaceDurabilityCost`（默认 25%）。
- `【可调参数】BigExplosionPropertyThreshold`（默认 ExplosionThreshold × 1.5）—— 波及环境的阈值。

---

## 6. 非线性产出：输入域 → 产出映射

### 6.1 不只是 A+B=C

本作的核心设计：**同一组材料在不同火候/顺序/辅料下产出不同丹药**。建模为多维输入 → 离散产出的映射函数。

### 6.2 输入域维度

```
InputVector = {
  HerbSet:      set of herbs placed (multiset, 无序集合)
  OrderVector:  sequence of insertion (有序序列)
  AvgHeat:      平均火候
  HeatTrajectory: 火候轨迹特征 (e.g. 是否经过焚炉区、是否恒温)
  PropertySum:  最终药性总和
  Adjuvant:     辅料类型 (水/油/矿粉)
  Duration:     炼制总时长
}
```

### 6.3 产出判定算法（步骤）

```
function resolvePill(input):
    // 1. 候选丹方筛选
    candidates = []
    for recipe in KnownRecipes:
        if recipe.herbSetMatch(input.HerbSet):   // 材料集合匹配（多对一）
            candidates.append(recipe)
    
    // 2. 相似度打分（每个候选丹方对输入向量的匹配度）
    for recipe in candidates:
        score[recipe] = w1 * herbSetSimilarity
                      + w2 * heatRangeMatch(input.AvgHeat, recipe.IdealHeatRange)
                      + w3 * propertyAlignment(input.PropertySum, recipe.TargetProperty)
                      + w4 * orderPatternMatch(input.OrderVector, recipe.ExpectedOrder)
                      + w5 * adjuvantMatch(input.Adjuvant, recipe.RequiredAdjuvant)
    
    // 3. 选择最高分（若并列则涌现优先级见 §6.4）
    if max(score) < MinPillScore: return 废丹 (WastePill)
    else: return argmax(score) with quality = max(score)
```

- `【可调参数】ScoreWeights` (w1..w5, 默认 0.3/0.25/0.2/0.15/0.1) —— 各维度权重。
- `【可调参数】MinPillScore`（默认 0.4）—— 低于此产出废丹。

### 6.4 涌现配方优先级

当多个丹方得分接近（差值 < `EmergenceEpsilon`，默认 0.05）时，按**"未发现优先"**原则：若玩家尚未发现某丹方（残卷状态，见 §9），优先产出它并标记为"新发现"。这是鼓励实验的机制。

### 6.5 举例（结构，具体丹方见 `15-content-tables.md`）

输入：`金属性草 ×1 + 水属性辅料 + 文火 (AvgHeat=45)`
- 顺序 [金草, 水] + AvgHeat=45 → **避雷丹** (LightningWardPill)
- 顺序 [水, 金草] + AvgHeat=45 → **凝神丹** (次要配方)
- 顺序 [金草, 水] + AvgHeat=70 (武火) → **引雷丹** (引劫用，危险)
- 同上但 AvgHeat=90 (焚炉) → 炸炉

---

## 7. 丹方与残缺丹谱 (Recipe Discovery)

### 7.1 丹方作为可发现内容

丹方分三类状态：
1. **未知 Unknown**：玩家从未见过，无法主动炼制（只能靠实验涌现发现）。
2. **残卷 Fragment**：玩家有部分信息（如知道主料但不知火候/顺序），可尝试炼制，成功率低。
3. **完整 Known**：完全掌握，UI 显示理想火候区间与推荐顺序。

丹方来源：
- 储物戒初始的《残缺丹谱》（开局给 2–3 个残卷）。
- 天象掉落（`异象种子天降` 偶带丹方碎片）。
- 舔包（魔修过境战场边缘的破损玉简）。
- 实验解锁（涌现发现后自动补全为 Known）。

### 7.2 丹药品类（功能与天劫用途）

| 丹药 | 功能 | 天劫用途 | 主要材料倾向 |
|------|------|---------|------------|
| `避雷丹 LightningWardPill` | 服后 60s 内雷伤减免 40–60% | 渡劫前服下 | 金属性草 + 水辅料 |
| `生骨丹 BoneForgingPill` | 回血 + 临时提升 HP 上限 | 渡劫中续命 | 温/热属性 + 矿物辅料 |
| `净毒丹 DetoxPill` | 立即 -30 丹毒 | 炸炉后/生食后急救 | 平性 + 解毒草 |
| `淬体增效丹 TemperingBoostPill` | 下次天劫淬体收益 ×1.5 | 渡劫前服，加速突破 | 罕见雷属性草 |
| `引雷丹 LightningBaitPill` | 主动提前触发天劫（见 `05-...md` §1.4） | 高玩主动引劫 | 金属性草 + 武火 |
| `强骨丹 MarrowPill` | 永久 +HP 上限 | 阶段性投资 | 多种草 + 长 时文火 |
| `走火丹 MadnessPill` | 危险：临时大幅增淬体但累积走火值 | 赌徒玩法 | 极端药性 |

具体配方数据在 `15-content-tables.md`。

---

## 8. 炸炉失败与废丹用途

### 8.1 部分成功：废丹 (WastePill)

炼制 score 在 `WastePillScoreRange`（默认 0.2–0.4）区间内产出废丹：
- 服之：微量回血/微量毒（取决于材料），用途有限。
- 可作为**肥料**施入农田（提供灵气，见 `08-farming-system.md` §3 肥料）。
- 可作为**阵法燃料**（投入引雷阵增强阵眼，见 `05-...md` §8）。
- 可拆解（高阶解锁）回收部分材料。

> 设计：失败不是纯损失，废丹有多条回收通路，呼应"凡人节俭"叙事。

### 8.2 完全失败：炸炉

见 §5.3。炸炉是真正的惩罚，鼓励玩家在冲突区及时封火/调药。

### 8.3 残丹 (FlawedPill)

score 接近合格但未达（如 0.4–0.6 但火候严重偏离）：产出"残丹"——效果只有完整丹的 50–70%，且带少量 `PillPoison`。是"凑合用"的选项。

---

## 9. 边界情况

### 9.1 空炉 / 单材料

- **空炉起火**：温度上升但无材料 → 等候玩家投料，超时（`EmptyFurnaceTimeout` 默认 30 s）自动封火。
- **单材料出丹**：只有一株草 + 辅料，能产出最简单的"单方丹"（如纯寒草 + 水辅料 = 祛火丹）。设计上保留单方丹作为入门。

### 9.2 极端药性

- 全寒/全热投入：`PropertySum` 立即超 `ConflictThreshold`，几乎必炸。教学关会警告。

### 9.3 连续操作 / 状态污染

- 上一次炼制未清炉就投新料：残留药性 `PropertyResidue` 污染下一炉（`PropertySum` 初始非 0）。玩家需手动 `清炉 CleanFurnace`（耗时 +消耗水/布）。
- 玩家离开丹炉界面：炼制**暂停**（不继续 tick），但已投入材料不返还。

### 9.4 储物戒材料不足

投料时若储物戒内该灵草数量不足，槽位置灰，禁止起火。

### 9.5 天劫期间禁入

进入 `TribulationPhase` 后丹炉界面锁定（见 `05-...md` §7.5）。渡劫前必须备好丹药在快捷栏。

---

## 10. 算法步骤汇总（轻量伪代码）

```
function alchemyTick(furnace, dt):
    furnace.Heat = driftToward(furnace.Heat, AmbientHeat, HeatDriftRate, dt)
    for herb in furnace.Slots:
        if herb: furnace.PropertySum += heatEvolution(herb, furnace.Heat, dt)
    if |furnace.PropertySum| >= ExplosionThreshold:
        return explode()
    elif |furnace.PropertySum| >= ConflictThreshold:
        if rng.next() < explodeProb(furnace.PropertySum, furnace.Heat): return explode()
    return continue

function resolvePillOnCollect(furnace):
    input = buildInputVector(furnace)
    candidates = [r for r in KnownRecipes if r.herbSetMatch(input.HerbSet)]
    if not candidates: return WastePill
    scores = {r: scoreRecipe(r, input) for r in candidates}
    best = argmax(scores)
    if scores[best] < MinPillScore: return WastePill
    if scores[best] < KnownThreshold: return FlawedPill(best, quality=scores[best])
    return Pill(best, quality=scores[best])
```

确定性（C3）：所有 `rng` 调用传入 seed = `hash(worldSeed, furnaceId, sessionTick)`，无头测试可复现炸炉序列。

---

## 11. 可调参数清单（移交 14-...md 收口）

| 参数 | 默认 | 单位 | 语义 |
|------|------|------|------|
| `RawAbsorptionPenalty` | 1.0 | 比例 | 生食毒吸收率 |
| `decayBase` | 2.0 | /游戏日 | 丹毒被动衰减（见 14 P005，R8） |
| `DetoxPillPower` | 30 | PillPoison | 净毒丹清除量 |
| `VeinDetoxPower` | 50 | PillPoison | 灵脉挖掘清除量 |
| `PillPoisonCap` | 100 | PillPoison | 暴毙阈值 |
| `SoftCapThreshold` | 0.7 | 比例 | 开始负面状态 |
| `MainSlotCount` | 3 | 个 | 初始主槽位 |
| `AuxSlotCount` | 2 | 个 | 进阶辅槽位 |
| `OrderHeatWeight` | [1.0,0.7,0.5,0.3,0.2] | 权重 | 投料顺序火候权重 |
| `HeatDriftRate` | 0.5 | /s | 温度自然漂移 |
| `HeatPropertyDriftRate` | 0.3 | /s | 高低温下药性漂移 |
| `BellowsBoost` | 8 | Heat | 鼓风加温 |
| `BellowsCooldown` | 1.5 | s | 鼓风冷却 |
| `BankRate` | 2 | /s | 封火降温 |
| `HeatPenaltyFactor` | 0.8 | 比例 | 火候偏离惩罚 |
| `ConflictThreshold` | 15 | PropertySum | 冲突警告阈值 |
| `ExplosionThreshold` | `14 + 2×stage` | M | 炸炉阈值（见 14 P034，R7） |
| `ExplosionRateBase` | 0.05 | /tick | 冲突区炸炉概率 |
| `HeatExplosionAggr` | 5 | PropertySum | 焚炉区炸炉加剧 |
| `ExplosionPoisonBacklash` | 20 | PillPoison | 炸炉反噬 |
| `ExplosionDamage` | 15 | HP | 炸炉伤害 |
| `FurnaceDurabilityCost` | 25 | % | 炸炉炉损 |
| `ScoreWeights` | [.3,.25,.2,.15,.1] | 权重 | 配方打分权重 |
| `MinPillScore` | 0.4 | 分 | 废丹阈值 |
| `EmergenceEpsilon` | 0.05 | 分 | 涌现优先级窗口 |
| `EmptyFurnaceTimeout` | 30 | s | 空炉超时封火 |

---

## 12. 开放问题（需主创拍板）

- **Q1**：投料是实时（反应式）还是回合（策略式）？本文推荐实时，保留紧张感与火候解谜。若主创希望更接近 Potion Craft 的"策略性 alchemy map"，可改为离散步骤。
- **Q2**：药性是一维（寒热轴）还是二维（寒热 + 升降/补泄等更多中医维度）？本文一维求简洁，二维可增深度但提高调参与 UI 复杂度。
- **Q3**：废丹的回收通路是否全保留？肥料/阵法燃料/拆解三条都开会让失败惩罚过轻。建议至少保留一条。
- **Q4**：丹方发现的"涌现优先级"是否会让玩家无意中跳阶获得强力丹？需配合 stage gating（高阶丹方材料本身 stage-locked）。

---

## 参考资料

- [中医四气（寒热温凉）理论 - Baiduwiki Four Natures](https://baike.baidu.com/en/item/Four%20Natures/96092)
- [A Song of Ice and Fire: Cold and Hot Properties of TCMs (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7851091/)
- [Molecular bases of cold and hot properties of TCM (ScienceDirect)](https://www.sciencedirect.com/science/article/pii/S2667142522000847)
- [Potion Craft Wiki - 火候/研磨/alchemy map 机制](https://potion-craft.fandom.com/wiki/Potion_Craft)
- [Potion Craft Gameplay Reflections（炼丹解谜设计反思）](https://gameplayreflections.wordpress.com/potion-craft-alchemist-simulator/)
- [Ping Ming Health - 寒热温凉食物分类参考](https://www.pingminghealth.com/article/581/warming-and-cooling-characteristics-of-common-foods/)
