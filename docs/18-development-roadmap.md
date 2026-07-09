# 18 · 开发路线图（Development Roadmap）

> 本文件定义《Aeon Vale》从空仓库到飞升结局的**里程碑序列**、每阶段的**垂直切片**、**退出标准**与**风险前置**策略。
> 它服务于"Vibe Coding + 全程无人为干预"范式：每个里程碑都必须能被 `17-testing-and-automation.md` 的 harness 自动验证，否则不算完成。
> 工作量以**理想人日 (ideal dev-day, idd)** 估算，假设 AI 辅助编码、人工仅做方向决策与抽检。粗估 ±50%，勿当承诺。

---

## 0. 路线图总览

```
M0 工程骨架 ─► M1 序章 ─► M2 第一幕 ─► M3 偷天核心 ─► M4 天象引擎 ─► M5 破立终局 ─► M6 打磨
   (基建+测试)   (凡田教程)  (炼丹+戒)   (天劫塔防)      (奇遇因果)     (紫雷+飞升)    (平衡+音美)
   ~15 idd        ~10         ~18         ~25             ~15            ~12            ~20      = ~115 idd
```

| 里程碑 | 名称 | 核心交付 | 估计 idd | 退出标准（见各节） |
|--------|------|----------|----------|-------------------|
| M0 | 工程骨架 | 分层架构 + 游戏循环 + 无头测试基建 | ~15 | harness 跑 1000 局空壳对局 |
| M1 | 序章教程 | 凡间种田闭环 + 基础叙事 | ~10 | rookie bot 完成 5 日教程 |
| M2 | 第一幕 | 储物戒 + 灵草 + 炼丹 + 丹毒 | ~18 | 一次完整炼丹出丹，属性测试绿 |
| M3 | 偷天核心 | 天劫塔防 + 淬体 + 突破（核心循环） | ~25 | MVP 垂直切片可玩可测（§1） |
| M4 | 天象引擎 | 动态因果 + 奇遇事件 | ~15 | 妖兽潮/灵气潮汐因果链触发 |
| M5 | 破立终局 | 紫雷劫 + 飞升结局 | ~12 | veteran bot 通关率达标 |
| M6 | 打磨 | 平衡/音频/美术/UX | ~20 | 蒙特卡洛调参收敛 + proxy 达标 |

> **关键**：M3 是**最高风险里程碑**（三大机制首次全部联动）。路线图刻意把 M3 前置风险验证（见 §9），若 M3 的"种田即布防 + 控血"不好玩，整个项目需重新定向。

---

## 1. MVP 垂直切片定义（在 M3 交付）

> 最小可玩闭环，证明"核心循环好玩"。**这是项目成败的判定局**。

### 1.1 切片包含

```
翻地 → 种 1 种灵草(Frostmarrow) → 灵气生长 → 收获
  → 炼 1 种丹(避雷丹方) → 控火出丹
  → 引 1 次小天劫(stage1, 3 雷)
  → 布设 1 个引雷阵 + 1 个绝缘阵
  → 控血接雷(目标 HP 15%)
  → 扛过 → 看到修为 X 增长 + nearDeathBonus 结算
```

### 1.2 切片排除（严守范围）

| 排除项 | 理由 |
|--------|------|
| 序章叙事/UI 精修 | M1 已做基础；MVP 只需能跑 |
| 多 tier 灵草/丹方 | 只验证 1 条链足够 |
| 天象奇遇 | M4；MVP 用固定无事件 |
| 飞升/终局 | M5 |
| 音频/美术 | 用占位色块 |
| 存档系统 | MVP 用进程内状态（M6 补存档） |
| 交易系统 | 明确不做（`16` §5） |

### 1.3 为何这样切

- **单链纵切**：从翻地到突破，穿透所有三大机制，验证"联动是否产生乐趣"——而非横向铺内容。
- **stage1 only**：最小数值面，但仍含控血曲线（`14` §6.2）这一灵魂机制。
- **可测**：整个切片可被 `rookie`/`normal`/`veteran` bot 跑通，产出通过率（`17` §5.3）。

---

## 2. M0 · 工程骨架（~15 idd）

### 2.1 交付物

| 项 | 说明 | 对接 |
|----|------|------|
| 仓库布局 | `sim/` `render/` `content/` `test/` `tools/` 分层 | `12-project-structure.md` |
| 游戏循环 | 固定 tick + 日推进 + 事件队列 | `10-technical-architecture.md` |
| PRNG 注入 | `mulberry32`/`xoshiro`，全 sim 层强制经 rng | C3 |
| 参数注册表 | `14` §11 落地为 `params.json` + TS 类型 | `14` |
| 内容加载器 | 读 `15` 的 JSON 表 → 强类型对象 | `11-data-model.md` |
| 无头 harness 骨架 | `17` §4 runner，能跑空壳对局 | `17` |
| CI 流水线 | lint/type/unit/property/golden 阶段 | `17` §9 |
| 空壳 sim | 只有"推进日 + 计数"的最小逻辑，供 harness 验证 | — |

### 2.2 退出标准（Exit Criteria）

- [ ] `sim/` 层零 DOM/GPU 依赖（`17` INT-06 等价检查通过）
- [ ] harness 跑 1000 局空壳对局（每局 100 日）< 60 s，结果可哈希缓存
- [ ] CI 全绿，含 1 条 golden replay
- [ ] 参数注册表加载 + 类型检查通过
- [ ] 内容加载器解析 `15` 全部表无错

### 2.3 风险前置（M0 即验证）

- **确定性**：空壳对局固定种子 → 逐字节相等。若失败，立刻修——这是后续一切的地基。
- **sim/render 解耦**：空壳能在无头环境跑。若耦合，重构。

---

## 3. M1 · 序章教程（~10 idd）

### 3.1 交付物

| 项 | 说明 |
|----|------|
| 凡间种田 | 翻地/浇水/施肥/收获 `item.mortal-rice` + `herb.mossling` |
| 灵气层（凡间版） | `Q≈0` 的凡间地块；仅 `regenBase` 微量 |
| 季节系统 | 28 日/季，季节轮换毁温热草（凡间版只换贴图感） |
| 基础 UI | 翻地/种植/收获的最小交互 |
| 教程叙事 | 绝灵之体被扫地出门、回村种地（`02-narrative-bible.md` 序章） |
| 工具耐久 | 锄/镰/桶耐久系统 |

### 3.2 退出标准

- [ ] rookie bot 能完成 5 日教程（翻地→种→收→吃米回 HP）
- [ ] 季节轮换单测 + 属性测试绿
- [ ] 工具耐久耗尽有正确反馈
- [ ] 一次 short sim（50 种子）无崩溃

### 3.3 并行机会

- 叙事文本（`02`/`03`）可与 sim 并行撰写
- 凡间美术占位可并行

---

## 4. M2 · 第一幕（~18 idd）

### 4.1 交付物

| 项 | 说明 |
|----|------|
| 储物戒 | 16 格容器 + 堆叠规则（`16` §4） |
| 灵草系统 | `15` §1 tier1–2 灵草落地；生长公式 `14` §4 |
| 灵气系统（灵气版） | `Q` 0–100 完整模型 `14` §2；灵脉地块 |
| 炼丹系统 | 投料/控火/聚合/平衡/炸炉/出丹 `14` §9；炉 `item.furnace-basic` |
| 丹毒系统 | `14` §3 全模型；暴毙结局触发 |
| 丹方 | `15` §2 tier1–2 配方（避雷/生骨/净毒丹方） |
| 属性测试 | `17` PBT-01/04/06/10 |

### 4.2 退出标准

- [ ] 一次完整炼丹端到端（INT-02）通过
- [ ] 属性测试 PBT-01（药性和守恒）绿
- [ ] 丹毒暴毙 + 净毒丹清毒闭环可复现
- [ ] sim 100 局（normal bot 炼丹）无炸炉率异常（E009 ∈ [0.05,0.15]）
- [ ] 储物戒往返序列化测试绿

### 4.3 风险前置（M2 即验证）

- **炼丹非线性是否有趣**：`extraction` 拱形（`14` §9.1）是否真产生"同料异火出异丹"？M2 末做一次 bot 涌现配方发现率测试——若 veteran 解锁率 < 30%，拱形宽度（P036）需调宽。

---

## 5. M3 · 偷天期核心循环（~25 idd，最高风险）

### 5.1 交付物

| 项 | 说明 |
|----|------|
| 天劫倒计时 | `14` §8.2；满 X 触发倒计时 |
| 塔防生存模式 | 切场 + 雷逐道 targeting `14` §5 |
| 阵法系统 | 引雷阵/绝缘阵布设 + 耐久 `15` §5 |
| 劫雷伤害 | `14` §6.1 全模型 |
| 淬体增益 | `14` §6.2 控血收益曲线（**灵魂机制**） |
| 突破系统 | `14` §8.3 successRate + 走火 + 险胜 |
| 进阶系统 | stage1→2 突破；maxHP 涨；解锁 tier2 内容 |
| **MVP 垂直切片** | §1 定义的最小闭环 |

### 5.2 退出标准

- [ ] **MVP 垂直切片可玩**：人能从翻地玩到 stage1 突破
- [ ] INT-03（完整天劫）通过
- [ ] **控血曲线被验证**：veteran bot 主动控血到 < 25% 的天劫比例 ≥ 50%（proxy）
- [ ] **首劫存活率达标**：rookie 55–65% / normal 85–92%（`17` §5.3）
- [ ] Golden replay 覆盖首劫场景
- [ ] 险胜率（HP ∈ (0,25%]）∈ [0.20, 0.35]（proxy）

### 5.3 风险前置（M3 是 Go/No-Go 关卡）

- **"种田即布防"是否好玩**：金属性灵草吸雷（`14` §5）+ 阵法编排，是否让"种田"成为有意义的塔防前置？M3 末做人类抽检 + bot 决策多样性 proxy。
- **控血是否产生张力**：nearDeathBonus（P024）峰值是否让玩家"想走钢丝"？
- **若失败**：这是项目最大的转向点。选项：① 调 targeting/阵法权重让布防更有掌控感；② 强化控血收益曲线；③ 最坏情况——重新评估三大机制组合是否成立（见 `19-risk-register.md`）。

### 5.4 并行机会

- 阵法视觉/雷击特效（render 层）与 sim 并行
- stage2 内容表扩充与 sim 并行

---

## 6. M4 · 天象奇遇引擎（~15 idd）

### 6.1 交付物

| 项 | 说明 |
|----|------|
| 事件权重引擎 | `14` §7 全模型 |
| 天象事件 | `15` §4 全表落地（灵气潮汐/妖兽潮/魔修过境/残脉…） |
| 因果链 | 事件→后果链（如潮汐→妖兽→守田） |
| 妖兽系统 | 简单 AI（路径+吃草+被陷阱伤） |
| 散仙交易（最小） | `16` §5 事件版交易 |
| 舔包战利品 | `15` §5 战利品表 |

### 6.2 退出标准

- [ ] 妖兽潮因果链（潮汐→翻倍成熟→引兽）可触发可复现
- [ ] 事件间隔均值 ≈ 4 日（E003 相关），无刷屏
- [ ] 散仙交易 3 bot 均能利用（E008 买入率 60–80%）
- [ ] 天象 weight 属性测试（PBT-03 等价）绿
- [ ] sim 500 局无难度死角（全 bot 死亡种子 < 2%）

### 6.3 并行机会

- 天象美术/音效与 sim 并行
- 妖兽 AI 与事件引擎部分并行

---

## 7. M5 · 破立期终局（~12 idd）

### 7.1 交付物

| 项 | 说明 |
|----|------|
| stage3–5 进阶 | `14` §8 全阶段表落地 |
| 高 tier 内容 | `15` tier3–5 灵草/丹方/丹药 |
| 紫雷劫 | `event.purple-omen` + stage5 强化天劫 |
| 飞升结局 | `pill.ascend` + 飞升叙事（`02`） |
| 走火入魔分支 | 负面结局（`02`） |
| 终局炉/阵 | `item.furnace-heaven` / Ironwill Thorn 阵 |

### 7.2 退出标准

- [ ] veteran bot 通关率 ∈ [0.75, 0.85]（`17` §5.3）
- [ ] normal bot 通关率 ∈ [0.30, 0.45]
- [ ] 平均通关时长（normal）∈ [18, 25] h（O4）
- [ ] 紫雷劫无必死锁（有 veteran 策略可过）
- [ ] 飞升结局触发 + 叙事完整

### 7.3 风险

- **终局数值陡升劝退**：`baseDamage` 陡涨（`14` §8）可能让 normal bot 集体卡 stage4。退出标准若不达 → 调 `temperingEff` 斜率（P023）或 stage4→5 的 `X_cap`。

---

## 8. M6 · 打磨（~20 idd）

### 8.1 交付物

| 项 | 说明 |
|----|------|
| 蒙特卡洛调参 | `17` §6 全管线跑通，θ* 锁定 |
| 存档系统 | 完整序列化 + 往返测试（PBT-06） |
| 音频管线 | 慢→急情绪曲线配乐 + 音效（`13-asset-art-audio.md`） |
| 美术统一 | 调色板/程序化/留白（C7） |
| UX 打磨 | 教程引导/反馈/可读性 |
| 死亡经济 | `16` §7 混合制 C 落地（已定 `20` D-03：损 50% 流动资产 / 保留知识 / 不回档） |
| proxy 校准 | `17` §10.2 小样本人类 playtest 对照 |

### 8.2 退出标准

- [ ] 蒙特卡洛 θ* 在验证集（未见过种子）上达标
- [ ] 存档往返百万次属性测试绿
- [ ] proxy 指标全部达标（`17` §10.1）
- [ ] 人类抽检 5 局，"好玩"主观评分 ≥ 4/5
- [ ] CI 夜跑稳定，无确定性漂移

---

## 9. 风险前置策略（Risk Front-Loading）

> 最高风险最早验证，避免"做完才发现不好玩"。

| 风险 | 验证里程碑 | 验证方式 | 若失败的应对 |
|------|-----------|----------|--------------|
| **种田即布防不好玩** | M3 | 人类抽检 + bot 决策多样性 proxy | 调 targeting/阵法权重；最坏重评机制组合 |
| **炼丹非线性无趣** | M2 末 | 涌现配方发现率 bot 测试 | 调 extraction 拱形宽度 P036 |
| **控血不产生张力** | M3 | 险胜率 proxy + veteran 控血使用率 | 调 nearDeathBonus 峰值 P024/区间 P025 |
| **确定性漂移** | M0 | 空壳逐字节相等 | 立刻修，阻断后续 |
| **性能（天劫期实体峰值）** | M3 | 雷击峰值帧率 profile | 降实体数/分帧 |
| **终局劝退** | M5 | normal 通关率 | 调 stage4–5 曲线 |
| **调参过拟合** | M6 | 验证集对照 | 扩 seed 集/降维 |

### 9.1 依赖与并行图

```
M0 ──► M1 ──► M2 ──► M3 (MVP) ──► M4 ──► M5 ──► M6
                  │           │
                  │           ├─► (M3 后可并行) 高 tier 内容扩充
                  │           ├─► 美术/音频管线（独立轨）
                  └─► (M2 后可并行) 叙事文本批量撰写
```

- **M0 必须串行**：所有后续依赖 sim 骨架 + harness。
- **M1/M2 部分串行**：M2 的灵草依赖 M1 的翻地。
- **M3 后大量并行**：内容扩充、美术、音频、叙事可多轨推进。
- **M6 必须最后**：调参需全部内容就位。

---

## 10. 里程碑对照表（与 `12-project-structure.md` 协同）

| 里程碑 | 主要代码目录 | 主要内容表 | 主要测试 |
|--------|-------------|-----------|----------|
| M0 | `sim/` `test/` `tools/runner` | params.json | unit + property + golden |
| M1 | `sim/farming` `render/ui-basic` | mortal items | unit + short sim |
| M2 | `sim/alchemy` `sim/qi` | herbs t1-2, recipes t1-2 | PBT-01/04 + INT-02 |
| M3 | `sim/tribulation` `sim/progression` | arrays, pills | INT-03 + MVP proxy |
| M4 | `sim/events` `sim/beast` | celestial events, loot | weight PBT + 死角检测 |
| M5 | `sim/progression`(高阶) | tier3-5 全表 | 通关率 + 时长 |
| M6 | 全栈 | 全表最终化 | 蒙特卡洛 + proxy + 人类抽检 |

---

## 11. 与兄弟文档对齐

| 本节 | 依赖 | 状态 |
|------|------|------|
| §1 MVP 切片 | `14`/`15`/`16` 核心 | 已对齐 |
| §2–8 退出标准 | `17` §5/§9/§10 | 已对齐 |
| §9 风险 | `19-risk-register.md` | 互引 |
| §10 目录 | `12-project-structure.md` | **待对齐** |
| 各里程碑内容 | `02`–`09` 机制/叙事 | **待对齐**（M0 骨架先行无依赖） |

---

## 参考资料

- [How to Scope an Indie Game (Generalist Programmer)](https://generalistprogrammer.com/tutorials/how-to-scope-an-indie-game) —— MVP/垂直切片/MoSCoW 范围管理，本文 §1/§0 主框架。
- [Scope: Why You Shouldn't Always Be Afraid of It (r/gamedev)](https://www.reddit.com/r/gamedev/comments/xzop29/scope_why_you_shouldnt_always_be_afraid_of_it/) —— 垂直切片优先策略。
- [The Next Thing After MVP? A Vertical Slice? (Medium)](https://medium.com/wannabe-indie-game-developer/the-next-thing-to-aim-for-after-an-mvp-a-vertical-slice-db6b90a25568) —— MVP→垂直切片递进。
- [Scope Creep in Videogame Development (tonogameconsultants)](https://tonogameconsultants.com/scope-creep/) —— §1 排除项纪律。
- [Three Main Phases of Farm Simulators (kinglink-reviews)](https://kinglink-reviews.com/2020/02/23/how-stardew-valley-work-the-three-main-phases-of-farm-simulators/) —— 里程碑节奏对照。
- [A Monte Carlo Approach to Skill-Based Automated Playtesting — Stratabots (Horn et al., 2018)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6319931/) —— §5.3 通过率锚点方法。
- [Demonstrating the Feasibility of Automatic Game Balancing (Volz et al., GECCO 2016)](http://www.cmap.polytechnique.fr/~nikolaus.hansen/proceedings/2016/GECCO/proceedings/p269.pdf) —— §8 调参可行性。
