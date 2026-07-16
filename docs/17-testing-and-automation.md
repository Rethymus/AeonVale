# 17 · 测试与自动化策略（Testing & Automation）

> 本文件是《Aeon Vale》**"全程无人为干预的自动化调试与测试"** 承诺的核心兑现方案（`00-DESIGN-BRIEF.md` §0 开发范式；C3 确定性、C4 可自动化测试）。
> 它直接消费 `14-game-balance-and-math.md` §11【平衡参数注册表】作为调参输入，并消费 `16-economy.md` §8 经济指标作为目标函数。
> **立场**：我们不只是"写测试"，我们建一套能**自己发现不好玩、自己定位到参数、自己改参数再验证**的闭环。

---

## 0. 核心原则

1. **逻辑/渲染解耦（C4 的前提）**：所有游戏逻辑（生长/炼丹/雷权重/丹毒/经济）实现为**纯函数** `(params, state, rng) -> (newState, events)`，住在 `sim/` 层，**零 DOM / 零 GPU 依赖**。渲染层只读 sim 状态。无头测试可直接 `import` sim 层跑。（对接 `10-technical-architecture.md`）
2. **确定性优先（C3）**：所有随机经可注入 PRNG（如 `mulberry32` / `xoshiro`）。任何"看起来随机"的数若绕过 PRNG 即为 bug。固定种子 = 可复现 = 可回归。
3. **属性优于示例**：能用不变式表达的，不用手写用例。不变式覆盖无穷输入空间（`14` §9 药性守恒、§5 权重归一化等天然适合）。
4. **模拟即平衡**：单测保证"正确"，长周期无头模拟保证"平衡且好玩"——后者是无人干预开发的真支柱。

---

## 1. 测试金字塔

```
                    ▲
                   / \
                  /   \  视觉/Snapshot 回归（§7）
                 /─────\  少量：截图/布局/调色板对比
                /       \
               /         \ 模拟 Simulation（§4）
              /───────────\ 中量：种子化长周期 bot 对局
             /             \
            /               \ 集成 Integration（§3）
           /─────────────────\ 中量：日循环/一次炼丹/一场天劫端到端
          /                   \
         /                     \ 单元 Unit（§2）
        /───────────────────────\ 海量：纯函数 + 属性测试
```

### 1.1 各层占比与运行时机

| 层 | 占比 | 单次耗时 | 运行时机 | 失败=阻塞? |
|----|------|----------|----------|------------|
| Unit + Property | ~60% | < 10 s | 每次提交（pre-commit）/ CI | 是 |
| Integration | ~20% | 30–90 s | 每次 CI | 是 |
| Simulation (短) | ~10% | 2–5 min | 每次 CI（抽样种子） | 是（趋势）/ 否（单种子） |
| Simulation (长, 蒙特卡洛) | ~5% | 30 min–数 h | 每夜 / 手动触发 | 否（报告，不阻塞） |
| 视觉 Snapshot | ~5% | 10–30 s | 每次 CI | 软阻塞（需人工/脚本审核） |

---

## 2. 单元测试 + 属性测试（Pyramid 底座）

### 2.1 纯函数单测（示例性清单）

| 模块 | 函数 | 关键断言 |
|------|------|----------|
| 药性向量 | `furnaceAggregate(materials, heat)` | 已知输入→精确输出（`14` §9.1） |
| 生长 | `growthPerDay(herb, tile, season, celestial)` | qi=need 时 =baseGrowth；qi=2×need 时 =2×base |
| 雷权重 | `targetingWeights(tiles, arrays, playerPos, rng)` | 权重全 > 0；归一化和 = 1 |
| 丹毒 | `poisonDecay(P, bonuses)` | 不越界 < 0；封顶 100 |
| 突破 | `breakthroughRoll(X, P, prep, rng)` | successRate ∈ [0.05, 0.95] |

### 2.2 属性测试（Property-Based，fast-check 风格）

> 用 [fast-check](https://fast-check.dev/)（JS/TS）或等价框架。每个属性 = 一个对所有合法输入都成立的不变式。

| 属性 ID | 不变式 | 任意输入 |
|---------|--------|----------|
| PBT-01 | **药性和守恒**：炉内聚合向量 = 各材料向量按提取系数加权和（无凭空产生） | 任意材料组合 + 任意火候 |
| PBT-02 | **炸炉判定确定性**：相同 `(furnaceVec, heat, stage, furnaceTier, rngSeed)` → 炸炉布尔值唯一 | 任意合法炉态 |
| PBT-03 | **雷权重归一化**：`Σ P(tile) == 1.0`（容差 1e-9） | 任意地块配置 + 任意阵法 |
| PBT-04 | **丹毒不越界**：`P ∈ [0, 100]` 恒成立 | 任意服丹/衰减序列 |
| PBT-05 | **修为单调**：淬体只增不减（除突破/死亡事件） | 任意雷击序列 |
| PBT-06 | **存档往返**：`deserialize(serialize(state)) == state`（结构相等） | 任意合法游戏状态 |
| PBT-07 | **种子确定性**：相同 `(seed, params, inputActions)` → 完全相同的事件流 | 任意动作序列 |
| PBT-08 | **控血收益单峰**：`nearDeathBonus(finalHP)` 在 `(0,10%]` 取全局最大，两侧单调不增 | 任意 finalHP |
| PBT-09 | **突破率有界**：任意合法状态，successRate ∈ [0.05, 0.95] | 任意 (X, P, prep) |
| PBT-10 | **时间前进**：日推进后 `t` 单调 +1，且无事件凭空跳变 | 任意日序列 |

> **为何属性测试**：`14` 的公式多带"守恒/归一化/有界/单峰"等数学性质，正是 PBT 的强项。一个属性 = 无穷个用例，且天然适配"无人干预"——AI 改公式后，PBT 自动验证不变式未被破坏。

### 2.3 反例最小化（Shrinking）

fast-check 自动把失败的随机输入**收缩到最小反例**（如"火候=73, 材料=[X], 种子=42"）。这是自动化调试的第一跳——失败种子直接喂给 §6 的回放定位器。

---

## 3. 集成测试（端到端片段）

每个集成测试跑一个**完整机制片段**，验证系统间拼装正确（非平衡）。

| 集成 ID | 场景 | 步骤 | 断言 |
|---------|------|------|------|
| INT-01 | 一个完整日循环 | 推进 1 日：灵气更新→生长→可选炼丹→事件判定 | 状态迁移符合预期；无未处理事件 |
| INT-02 | 一次炼丹全流程 | 投料→控火→聚合→平衡评分→炸炉判定→出丹 | 产出丹药 id 与药性空间落点一致（`14` §9.4） |
| INT-03 | 一场完整天劫 | 倒计时归零→切塔防→逐雷 targeting→伤害结算→淬体→突破判定 | 雷数固定；存活/死亡/突破分支正确 |
| INT-04 | 季节轮换 | 跨季 28 日 | 温/热草按 `seasonFactor` 受损；种子保留 |
| INT-05 | 死亡→恢复 | 制造丹毒暴毙→加载损失→重玩 | 知识保留；修为清零；资产损失 50%（`16` §7） |
| INT-06 | 存档往返（长） | 玩 100 日→存档→读档→再玩 1 日 | 与连续玩 101 日状态**逐字节相等**（C3） |

> INT-06 是确定性回归的集成版——任何非确定性（浮点漂移、迭代顺序、隐式全局）会在此暴露。

---

## 4. 无头模拟 Harness（核心基建）

> 这是无人干预开发的**引擎**。能跑成千上万局种子化对局，产出统计，喂给蒙特卡洛调参。

### 4.1 Harness 结构

```
┌─────────────────────────────────────────────────────────┐
│  Simulation Runner (headless, no DOM/GPU)                │
│                                                          │
│  输入:                                                   │
│    • seed (PRNG 种子)                                    │
│    • paramsSnapshot (来自 14 §11 注册表的一份快照)        │
│    • botPolicy (策略 bot，见 §5)                          │
│    • maxDays / exitConditions                            │
│                                                          │
│  引擎:                                                   │
│    for day in 1..maxDays:                                │
│      actions = botPolicy(state)            // bot 决策    │
│      (state, events) = simStep(params, state, actions,    │
│                                rng)         // 纯函数推进  │
│      metricsCollector.observe(state, events)              │
│      if exitConditions(state): break                      │
│                                                          │
│  输出:                                                   │
│    • outcome {died/survived/ascended, stageReached, days} │
│    • metricsTrace (按日/事件的经济+战斗指标时序)          │
│    • eventLog (确定性事件流, 可 golden replay)            │
└─────────────────────────────────────────────────────────┘
```

### 4.2 批量运行与聚合

```
for seed in seedBatch(N=1000):
    for bot in [rookie, normal, veteran]:
        result = runOne(seed, params, bot)
        aggregate(result)
report = summarize(aggregate)   // 存活率/阶段分布/经济指标分布
```

- **并行**：每局独立无状态，可多进程/多 worker 并行（对接 `12-project-structure.md` CI 分片）。
- **缓存**：`(seed, paramsHash, botId)` → 结果可哈希缓存；params 未变则复用。
- **确定性**：相同三元组 → 相同 result，是 golden replay 的基础。

### 4.3 伪流程（runner 主循环）

```
function runMonteCarlo(params, botSet, N, targetMetrics):
    results = []
    for i in 1..N:
        seed = deriveSeed(baseSeed, i)          // 可复现种子族
        for bot in botSet:
            results.push(runOne(seed, params, bot))
    stats = computeStats(results)
    deltas = compare(stats, targetMetrics)      // 对接 §4 目标
    return { stats, deltas, failingSeeds }
```

`failingSeeds`（偏离目标区间的种子）→ 喂给 §6 自动化调试闭环 + §8 golden replay 库。

---

## 4.4 M5 assisted campaign proxy（当前实现）

`pnpm m5:check` 使用固定 64 种子对 normal/veteran 运行长周期 **assisted campaign proxy**：它必须走真实的紫雷前兆、突破与 `pill.ascend` 结局路径，并报告 Wilson 95% 区间、紫雷机械死锁、超时和辅助资源使用量。该 proxy 明确记录为合成资源辅助（阶段修为、渡劫准备、stage7 飞升丹），**不是自然内容获取或真实玩家通关率**。

- PR：只阻断结构回归（无飞升、veteran 低于 normal、紫雷死锁或非确定性）。
- 夜间：`pnpm m5:certify` 以 1,000 个独立 holdout 种子评估 M5 的 normal/veteran 代理通过率区间，`m5-nightly` 仅报告、不阻断。
- M5 工具以**点估计落入目标带**作为 `provisional` 合格；Wilson 95% 区间完整落带才标记 `certified`。前者是当前代理工具的可用门槛，不等于统计学严格认证；严格 Wilson 标准推迟到 M6 人类 playtest 对照完成代理校准后执行（`18` §8）。
- 时长单位固定为 `game-days`，并以 timeout horizon 计算 restricted mean；18–25 真人小时仍待 M6 人类 playtest 校准，不能由日数直接换算。

### 4.5 HP 继承代理原型（M6 校准输入）

`pnpm m5:hp-inheritance` 比较既有“渡劫前回满”代理与“渡劫间继承 HP + 有限治疗”变体；它不修改正式游戏突破回满规则。固定 holdout `seed=40001..40128`、每点 128 局、扫描 `violetDamageMult=1.145..1.170` 时，60% maxHP 有限治疗得到：

- normal：通过率 `0.2266 → 0.1484`，最大相邻跳变 `0.0391`；回满基线最大跳变为 `0.1406`。
- veteran：通过率 `0.7344 → 0.7109`，最大相邻跳变 `0.0156`。

因此该原型使 normal 曲线更平滑且仍有可测动态范围，但绝对通过率下移；它只能作为 M6 人类 playtest 校准的候选模型，不能解释为真实玩家通过率。40% 治疗过于严苛，80% 与回满基线过近，均保留在工具扫描中作为反例。

---

## 5. 策略 Bot 分层（Stratabots 式）

> 参考 Horn et al. (2018) [Stratabots](https://pmc.ncbi.nlm.nih.gov/articles/PMC6319931/)：用不同技能水平的自动玩家模型，模拟真实玩家 cohort 的通过率分布，发现难度死角。

### 5.1 三层 Bot 定义

| Bot | 技能模型 | 行为特征 | 模拟的玩家 |
|-----|----------|----------|-----------|
| `rookie` 菜鸟 | 不懂控血、不布阵、乱服丹 | 天劫站桩挨雷；生食灵草；从不炼净毒丹 | 新手 / 不读引导者 |
| `normal` 普通 | 会基本布阵+炼丹，但控血保守 | 避雷阵布核心区；天劫尽量满血过；按残卷炼丹 | 大多数玩家 |
| `veteran` 老练 | 精算控血 + 阵法编排 + 涌现配方 | 主动控血到 10–20%；实验涌现丹方；雷汛收雷种 | 高手 / 二周目 |

### 5.2 Bot 行为参数化

每个 bot 是一个**策略函数** `botPolicy(state) -> actions`，由可调权重组成：

| 权重 | rookie | normal | veteran |
|------|--------|--------|---------|
| 布阵倾向 | 0.0 | 0.6 | 0.9 |
| 控血目标 HP% | 1.0（满血） | 0.5 | 0.15 |
| 炼丹实验意愿 | 0.1 | 0.4 | 0.8 |
| 清毒纪律（P 阈值） | 从不 | 60 | 40 |
| 种子保留率 | 0.3 | 0.6 | 0.8 |

### 5.3 目标通过率分布（难度锚点）

| 场景 | rookie 存活 | normal 存活 | veteran 存活 |
|------|-------------|-------------|--------------|
| 第 1 次天劫 (stage1) | 55–65% | 85–92% | 98%+ |
| 第 3 次天劫 (stage2–3) | 25–35% | 65–75% | 90%+ |
| 通关 (stage5) | < 5% | 30–45% | 75–85% |

> **设计意图**：rookie 高死亡率建立"凡人脆弱"叙事可信度；normal 是主力调参对象（通关 30–45% = 有挑战但可达）；veteran 高通关但控血收益曲线让他们追求"更险"而非"更稳"。**前 3 场天劫菜鸟死亡率 ≈ 30–45%**（`14` §10 锚点的细化）。

### 5.4 难度死角检测

若某场景三层 bot **全部死亡** → 该种子/参数组合存在**难度死角**（必死锁）。报告并降级处理：
- 若是设计（如紫雷劫）→ 标注"预期高难"。
- 若非设计 → 触发调参或公式审查。

---

## 6. 蒙特卡洛平衡自动调参（核心算法）

> 应用学术界方法：[Silver 2009 蒙特卡洛平衡](https://icml.cc/Conferences/2009/papers/500.pdf)、[Bakkes/CIG2016 自动平衡](https://www.semanticscholar.org/paper/Automated-game-balancing-of-asymmetric-video-games-Beau-Bakkes/b44ab94aaa162ff99af6138b53044bf7d794d805)、[Volz 2016 多目标进化](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2016/GECCO/proceedings/p269.pdf)。

### 6.1 问题形式化

- **搜索空间**：`14` §11 注册表的参数向量 `θ`（37 维，每维带 range）。
- **目标**：多目标，部分来自 `16` §8 经济指标 + §5.3 通过率：

| 目标 ID | 描述 | 目标区间 | 来源 |
|---------|------|----------|------|
| O1 | stage1 首劫 rookie 存活率 | [0.55, 0.65] | §5.3 |
| O2 | stage3 normal 存活率 | [0.65, 0.75] | §5.3 |
| O3 | veteran 通关率 | [0.75, 0.85] | §5.3 |
| O4 | 平均通关时长 (normal) | [18, 25] h | `16` §1 |
| O5 | 第 30 日灵石等价 ≤ 40 | [≤40] | E001 |
| O6 | 炸炉率 (normal 主动) | [0.05, 0.15] | E009 |
| O7 | 净丹药库存 stage3 后斜率 ≤ 0 | [≤0] | E004 |
| O8 | 难度死角种子比例 | [≤ 0.02] | §5.4 |

- **适应度**：每个目标转成"偏离惩罚" `penalty_i = max(0, |measured - targetCenter| - targetHalfWidth)`，加权和 = 总惩罚（越低越好）。或用 Pareto 前沿（Volz 2016 路线）保留多解。

### 6.2 算法选型

| 方法 | 适用 | 选型理由 |
|------|------|----------|
| **网格/随机扫描** | 粗调，2–3 个高敏感参数 | 简单、可解释、建直觉。先用 P017/P018（雷伤）、P024（控血峰值）、P005（丹毒衰减）扫描 |
| **进化策略 (CMA-ES / 简单 GA)** | 精调，多参数耦合 | Volz 2016 验证可行；CMA-ES 适合连续参数、自适应协方差 |
| **贝叶斯优化** | 评估昂贵的黑盒 | 每次蒙特卡洛评估贵（1000 局）；BO 样本效率高 |
| **Pareto 多目标 (NSGA-II)** | 目标冲突时 | O1（菜鸟存活）与 O3（老练通关）可能冲突，需前沿而非单解 |

**推荐混合管线**：
```
1. 网格扫描 3 个最敏感参数 → 锁定大区间
2. CMA-ES 在锁定区间精调其余参数 → 最小化加权惩罚
3. NSGA-II 在冲突目标上输出 Pareto 前沿 → 人类/AI 选偏好解
4. 锁定 θ*，跑大规模验证 (N=10000) → 确认鲁棒
```

### 6.3 评估预算与加速

- 每次 `evaluate(θ)` 跑 N=1000 局（3 bot × ~333 种子），约 1–5 min。
- CMA-ES 一代 ~20 评估 → 一代 ~30 min；收敛 ~50 代 → ~25 h（可夜跑）。
- **加速**：① 早停（某 θ 下 rookie 全死 → 直接淘汰）；② 代理模型（surrogate，Volz 研究方向）拟合适应度面，减少真评估；③ 增量评估（先小 N 粗筛， promising θ 再大 N）。

### 6.4 过拟合防护

- **分离种子集**：调参用 seedBatch A；验证用 seedBatch B（未见过）。若 A 上好、B 上差 → 过拟合参数，降维/正则。
- **bot 多样性**：不只调 normal，三层 bot 同时作为约束——防止参数只对一种玩法生效。
- **人工抽检**：最终 θ* 抽 10 局生成"可视化回放"（渲染层回放事件流），人/AI 看一眼确认"像不像好玩"（见 §9 proxy metric）。

---

## 7. 确定性回归：Golden Replay

> 参考 [确定性模拟测试（Antithesis 模式）](https://antithesis.com/docs/resources/deterministic_simulation_testing/)。

### 7.1 Golden Replay 库

- Fixture 存放于 `tests/replay/fixtures/*.replay.json`，schema/harness 位于 `tests/replay/schema.ts` 与 `tests/replay/harness.ts`。
- 每个 fixture 固化完整 `BalanceParams` 快照、种子、世界尺寸、初始库存、逐日动作、逐步完整事件流与 `stateHash`，避免测试随 `DEFAULT_BALANCE` 漂移后自我更新。
- 核心农场 fixture 将 `celestial.eventGateProbability` 与 `celestial.beast.surgeChancePerDay` 置为 `0`，隔离天象/妖兽随机链，并在指定步骤执行 `serializeState` → `deserializeState` → `createSimContextFromState` 后验证余下回放逐步一致。
- CI 独立运行 `pnpm test:replay`；任何事件或状态哈希差异立即失败并阻塞合并。测试只读 fixture，不会隐式重写 golden。
- 只有明确接受行为变化时，开发者才可在本地运行 `pnpm replay:update -- --fixture <path>` 或 `pnpm replay:update -- --all`。更新器检测到 `CI` 环境变量时拒绝运行，更新后的 JSON diff 必须随代码审查。

### 7.2 漂移定位

事件流以结构化日志记录（带 day/tick/system 标签）。diff 出第一个分歧点 → 定位到具体系统/公式 → 对应 §6 闭环修复。

---

## 8. 自动化调试闭环（失败 → 定位 → 修复）

```
  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │    1. 测试/模拟失败（单测/属性/模拟指标越界/golden 漂移）  │
  │           │                                              │
  │           ▼                                              │
  │    2. 收集最小反例（fast-check shrink / 失败种子）        │
  │           │                                              │
  │           ▼                                              │
  │    3. 回放定位器：逐系统 diff 事件流，锁定首个分歧系统    │
  │           │                                              │
  │           ▼                                              │
  │    4. 参数/公式归因：分歧系统 → 14 §11 参数 ID 候选        │
  │       （如"stage3 存活率低" → P017/P018/P024 嫌疑）       │
  │           │                                              │
  │           ▼                                              │
  │    5. AI 修复 agent：在候选参数上做局部搜索/公式审查      │
  │       （读 14 §10 调参旋钮表，按敏感度优先扰动）          │
  │           │                                              │
  │           ▼                                              │
  │    6. 重跑验证（单测→集成→小模拟→确认指标回正）          │
  │           │                                              │
  │           ▼  通过                                         │
  │    7. 提交（θ 变更记入 14 §11，版本化）                   │
  │           │                                              │
  └───────────┘  未通过则回退并扩大候选参数集 / 报告人类 ────┘
```

**与注册表的联动**：每条失败都映射到 `14` §11 的参数 ID 与 §10 的敏感度表——AI 知道"先拧哪个旋钮最可能生效"。这是无人干预能成立的关键元数据。

**升级路径**：若 AI 修复连续 3 次未通过 → 升级为"需人类决策"（见 `19-risk-register.md`），不要无限自动循环。

---

## 9. CI 集成

> 对接 `12-project-structure.md` 的流水线。

### 9.1 流水线阶段与门禁

| 阶段 | 内容 | 触发 | 门禁 |
|------|------|------|------|
| Lint/Type | 类型检查 + lint | 每提交 | 硬阻塞 |
| Unit+Property | §2 全部 | 每提交 | 硬阻塞 |
| Integration | §3 全部 | 每提交 | 硬阻塞 |
| Sim-Short | 抽样 50 种子 × 3 bot，~3 min | 每提交/PR | 软阻塞（趋势告警） |
| Golden Replay | §7 全黄金种子 | 每提交 | **硬阻塞**（确定性铁律） |
| Sim-Nightly | 完整蒙特卡洛 N=10000 + 调参候选 | 每夜 | 报告（不阻塞），生成 θ 候选 PR |
| Snapshot | 视觉/布局回归 | 每提交 | 软阻塞（diff 需审核） |

### 9.2 长模拟拆分与缓存

- **分片**：1000 种子拆 10 个 CI job 并行（每 job 100 种子），结果聚合。
- **缓存**：`hash(seed, θHash, botId)` 为 key 缓存 result；θ 未变的 seed 重跑直接命中。
- **增量**：夜跑只对"自上次后 θ 变化的参数关联系统"重跑对应种子子集（依赖图来自 `14` §12 对齐表）。

---

## 10. "测试通过但不好玩"——Proxy Metrics

> 最难的问题：绿了≠好玩。需定义**可量化的好玩代理指标**，让"好玩"也能被模拟度量。

### 10.1 代理指标清单

| Proxy | 定义 | 健康区间 | 直觉 |
|-------|------|----------|------|
| **险胜率** | 天劫结束时 HP ∈ (0, 25%] 的比例 | 20–35% | 越多"差点死"，越刺激（Pillar 2） |
| **决策多样性** | 不同 bot 策略在同种子的 stage 到达方差 | 中等 | 全一致=无选择空间；全发散=无平衡 |
| **涌现配方发现率** | veteran bot 解锁 emergent 丹方比例 | ≥ 60% | 验证 §9.4 涌现可达 |
| **"再来一次"信号** | 死亡后 1 h 内再次达同 stage 的比例 | ≥ 70% | 死亡不劝退 = 可玩性 |
| **经济紧张度** | 日均被迫二选一次数（E003） | ≥ 3 | 稀缺制造心流 |
| **节奏张弛** | 慢（种田）与快（天劫）时长比 ≈ 9:1 | [8:1, 11:1] | Pillar 3 张力 |
| **控血使用率** | veteran 主动控血到 < 25% 的天劫比例 | ≥ 50% | 验证控血曲线被感知 |
| **无脑策略无效** | "只种最便宜草无限 farm" 的通关率 | < 5% | 验证无滚雪球 |

### 10.2 元评估：proxy 本身的可信度

- **对照基准**：proxy 不能只自洽，需与**人类 playtest 小样本**对照（即便无人干预开发，发布前仍需少量人工试玩校准 proxy）。建立"proxy 分 ↔ 人类好评率"的初步映射。
- **反作弊**：防止调参 agent 为了满足 proxy 而钻空子（如"险胜率"靠"必死局"刷高）——用联合约束（O1–O8 + proxy）相互制约。
- **proxy 演化**：随开发推进，proxy 清单本身要 review——发现新的"好玩信号"就加入；失效的就淘汰。

---

## 11. 测试可信度自检

| 风险 | 防护 |
|------|------|
| 测试通过但游戏崩 | §10 proxy + 少量人工抽检 |
| 确定性漂移未被发现 | §7 Golden Replay（硬阻塞） |
| 调参过拟合 | §6.4 分离种子集 + 多 bot 约束 |
| 属性测试找不到好不变式 | `14` §9/§5/§8 的数学性质天然适合（守恒/归一化/有界） |
| bot 太弱或太强 | §5.3 通过率分布作为 bot 校准锚点 |
| 长模拟太慢跑不起 | §9.2 分片+缓存+增量 |
| AI 修复乱改参数 | §8 升级路径 + §6.4 验证集 |

---

## 12. 与兄弟文档对齐

| 本节 | 依赖 | 状态 |
|------|------|------|
| §2 PBT 不变式 | `14` §5/§8/§9 数学性质 | 已对齐 |
| §4 调参输入 | `14` §11 注册表 | 已对齐（消费方） |
| §4 目标函数 | `16` §8 经济指标 | 已对齐 |
| §3 INT 集成 | `10-technical-architecture.md` 分层 | **待对齐**（sim/render 层边界） |
| §9 CI 流水线 | `12-project-structure.md` | **待对齐** |
| §10 proxy | `02-narrative-bible.md` Pillar | 已对齐（Pillar 2/3） |

---

## 参考资料

- [Monte-Carlo Simulation Balancing (Silver et al., ICML 2009)](https://icml.cc/Conferences/2009/papers/500.pdf) —— §6 蒙特卡洛平衡学术源头。
- [Monte-Carlo Simulation Balancing in Practice (Coulom, 2010)](https://www.remi-coulom.fr/CG2010-Simulation-Balancing/SimulationBalancing.pdf) —— §6 实践化。
- [A Monte Carlo Approach to Skill-Based Automated Playtesting — Stratabots (Horn et al., AIIDE 2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6319931/) —— §5 分层 bot 模型。
- [Automated Game Balancing of Asymmetric Video Games (Beau & Bakkes)](https://www.semanticscholar.org/paper/Automated-game-balancing-of-asymmetric-video-games-Beau-Bakkes/b44ab94aaa162ff99af6138b53044bf7d794d805) —— §4/§6 蒙特卡洛自动平衡。
- [Demonstrating the Feasibility of Automatic Game Balancing (Volz et al., GECCO 2016)](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2016/GECCO/proceedings/p269.pdf) —— §6 多目标进化算法选型。
- [Exploring Game Space via Parameter Tuning (Nealen et al.)](http://www.nealen.net/papers/08030128.pdf) —— §6.1 参数扫描探索。
- [Automatic Playtesting for Game Parameter Tuning via Active Learning (FDG 2014)](http://www.fdg2014.org/papers/fdg2014_paper_39.pdf) —— §6.3 代理模型加速。
- [What is Property-Based Testing? (fast-check)](https://fast-check.dev/docs/introduction/what-is-property-based-testing/) —— §2.2 PBT。
- [fast-check GitHub](https://github.com/dubzzz/fast-check) —— 框架与 shrinking。
- [Deterministic Simulation Testing (Antithesis)](https://antithesis.com/docs/resources/deterministic_simulation_testing/) —— §7 Golden Replay 模式。
- [Deterministic Simulation Testing: A Practical Guide (Green Report)](https://www.thegreenreport.blog/articles/deterministic-simulation-testing-a-practical-guide-for-qa-engineers/deterministic-simulation-testing-a-practical-guide-for-qa-engineers.html) —— §7 漂移定位。
- [What's the big deal about DST? (Eaton)](https://notes.eatonphil.com/2024-08-20-deterministic-simulation-testing.html) —— §7 种子回放回归。
