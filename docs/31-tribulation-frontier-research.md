# 31 · 天劫前沿算法与游戏设计范式调研

> 范围声明：围绕四大打磨目标（**手感 / 劫式多样性 / 引导可读性 / 残卷×阵石×灵草组合扩展**）
> 调研 Sokoban 生成、解谜引导设计、Roguelite 组合深度、玩家建模四线，产出参数级可实施建议。
> **不含配色**；动效参数归 `docs/29`，本文只谈机制与信息层。
> 本轮网络环境受限（详见附录）：仅 2 个源实读成功，其余凭知识降级标注。**重决策密度，轻文献综述。**

## 0. 基线与证据分级

### 0.1 证据分级

- **[A] 论文/规范**：同行评审论文、正式技术规范。
- **[B] 官方讲席/一手访谈**：设计师本人公开表述（本轮未取得原文处注明"凭记忆引述"）。
- **[C] 社区共识/知识降级**：稳定社区共识，或本轮 fetch 失败后凭知识补齐（显式标注）。
- **[W] 本轮 WebFetch 实读**：Wikipedia《Sokoban》《Glicko rating system》两篇。

### 0.2 实现基线（一句话 + 关键行号）

| 模块 | 现状 | 关键位置 |
|---|---|---|
| 生成器 | 构造式 cw 光路 + 单 mirror 后退扰动 + 有界 BFS 认证 + 强制初始未解 + 32 次重试 | `src/sim/sokoban/generator.ts`：buildPath L205、mirror 扰动 L370-386、solveBoard L131、MAX_SOLVE_NODES=40000 L27、MAX_GENERATED_SOLUTION_MOVES=96 L28、预算余量 L432-433 |
| 阵石接入 | 特性随 stage 概率解锁：p(绝缘)=min(0.45+0.04·stage, 0.75)、p(水石)=min(0.4+0.05·stage, 0.8) | `generator.ts` L335-346；水桥/绝缘闸构造 L303-333 |
| 手作模板 | 2 张兜底模板（TPL_A 单折 / TPL_B 双折+罚草） | `src/sim/sokoban/logic.ts` L35-57、回退 L115-136 |
| 准备适配 | 落位后逐一重解认证，无法安全落位显式进 ignored 标签 | `src/sim/sokoban/prepared-board.ts` L76-161、L210-219 |
| 会话编排 | undo 快照栈 + 护持开关；撤步按 P100 枚数折丹 | `src/sim/sokoban/tribulation-session.ts` L213-249 |
| 残卷 | 固定 7 节点 DAG，每轮日程最多解锁 1 节点 | `src/sim/cultivation-run/insight.ts` L10、L54-111 |
| 灵草 | **仅 1 种**（`conductive-moss`），只有数量轴 | `src/sim/cultivation-run/preparation.ts` L7、L135 |
| 引导 UI | 四格图例 + "认证 N 步 · 余量 M" 文本；R 撤步只写在帮助文案里 | `src/app/rogueliteProto/surface.ts` L2108、L2129 |

---

## 1. Sokoban 关卡生成前沿

### 1.1 前沿要点

1. **复杂度基线 [W/A]**：Sokoban 可解性判定 PSPACE 完全（Culberson 1997；Hearn 2006 博士论文）、NP-hard（Fryers & Greene 1995；Dor & Zwick 1999）。标准 XSokoban 90 题基准：解长 97-674 推、6-34 箱、分支因子 0-136——**本项目的 9×9、≤6 块板面在复杂度上是玩具规模，BFS 认证足够，不需要 SAT/ASP 求解器**（SAT/ASP 有界规划编码是学术正路 [C]，但对本规模属杀鸡用牛刀，且违反 sim 轻依赖原则）。
2. **求解器分层剪枝栈 [C]**（sokobano.de wiki，本轮 TLS 失败降级； existence [W]）：成熟求解器（Rolling Stone→Festival/FESS，2020 年首破全部基准 [W]）靠四层廉价剪枝压状态空间：
   - **简单死锁格预计算**：从每个目标格做"拉箱"反向 BFS，拉不到的格 = 死格；推箱入死格直接剪枝。O(格数) 一次性。
   - **冻结死锁**：推完后递归检查"横轴被墙/冻结箱挡 且 纵轴被挡"；2×2 箱阵是特例。局部、增量、可生成期用。
   - 区域封闭（corral）与二分图目标匹配为高阶剪枝；隧道宏合并等价推。
3. **生成范式三族 [C]**：
   - **过滤器式**：随机墙/箱布局 → 求解 → 按质量分留下（angusrail/generate-sokobanlevels 一类工具；本轮 404 降级 [C]）。简单但废品率高、难度不可控。
   - **构造式（解优先）**：先构造解路径再"反向拉开"（reverse pulling：从已解局面做 k 次逆推/拉），**构造上保证可解**，求解器只做质量分级而非可行性认证。学术界起点是 Murase/Matsubara/Hiraga 1996《Automatic Making of Sokoban Problems》[W]。
   - **声明式（SAT/ASP）**：把生成约束写成 ASP 规则由 clingo 求解（PCG-VG，Smith & Mateas 一脉 [C]）。约束表达力最强，工程依赖最重。
4. **难度分类器 [C]**：社区/学术共识用四个生成期指标刻画难度：解长（moves/pushes）、参考求解器展开节点数（搜索歧义度）、**首步扇出**（有多少个不同首步仍能在预算内得解——宽容度）、死锁密度（前 k 层内不可解状态占比）。

### 1.2 与本项目差距

- `solveBoard` 已算出 `exploredNodes`（L171）但 `generateBoard` 只取 `moves.length`，**两个现成的难度信号被丢弃**；首步扇出未测。
- 认证是"事后安全网"：32 次盲重试、不向目标难度带收敛；同一 stage 的 certifiedMoves 方差大 → 劫式体感不可控（对应 docs/30"节奏张弛"缺口）。
- 无任何死锁预判：玩家把 mirror 推入死角后只能靠 undo 预算自救，且**游戏不告知局面已死**（挫败感源头）。
- 单 mirror 扰动（L370-386 注释明言规避多 mirror 互挡）是劫式多样性的硬天花板；4 个 archetype 由 requiredBlockKinds 子集决定，实际只有 4 种"配方"。

### 1.3 建议（参数级）

| 优先级 | 建议 | 参数 |
|---|---|---|
| **P1** | 把 `exploredNodes` 与**首步扇出**（≤4 次额外求解，仅对最终采纳的候选执行）写入 `SokobanChallenge` | 扩 `SokobanChallenge` 2 字段：`solverNodes: number`、`firstMoveFanout: 0-4`；sim 成本 ≈ 5×现有单次求解 |
| **P1** | **死局面哨兵**：每次成功 move 后用剩余预算重解一次（有界 maxNodes=4000），不可解则 HUD 提示"此局已无解，建议撤步"并高亮 undo | 触发在 session 层（`tribulation-session.ts` move 分支后），不污染 sim 纯度；9×9 板单次求解毫秒级 |
| **P1** | **难度带定向重试**：32 次重试改为"带内优先，带外保底"——目标带 center=10+6·stage、半径 4；命中即取，耗尽取离 center 最近者 | `generator.ts` L424 循环改造，无新依赖；消除同 stage 步数方差 |
| P2 | **多 mirror 扰动（构造式）**：全部 mirror 放解位后，对后 2 个折点各做一次"后退一格"或合法逆拉，再走既有认证 | k=2 起步；保持 MAX_GENERATED_SOLUTION_MOVES=96 上界；求解器继续兜底多 mirror 互挡 |
| P2 | 生成期过滤"镜像冻结死锁"：扰动后若某 required mirror 四邻（除来向）均不可站/不可入则弃 | 与现有 remainsPlayable 同价的局部检查 |
| P3 | SAT/ASP 不引入。若未来要做**离线精选关卡库**（蒙特卡洛筛 top 板面烧进模板），再用过滤器式离线产 | 保持 `src/sim` 零求解器依赖红线 |

---

## 2. 解谜手感与引导可读性范式

### 2.1 前沿要点

1. **The Witness（Jonathan Blow）[B，凭记忆引述未逐字核实]**：零文字教学三律——**每面板只教一件事**；教学面板**构造性唯一解**（错误输入必须能被已学规则解释，否则玩家无法归因）；规则的"毕业面板"组合前两个规则。教学不是文案而是**面板序列的偏序**。
2. **A Monster's Expedition / draknek（Alan Hazelden）[C，本轮博客 404]**：可考的实践原则——谜题自包含、失败零惩罚（秒重置）；**难题放支路**（卡住可绕行，主径难度平滑）；"正确解在事后看来必须显然"（可读性判据）；首屏用**强制单选择交互**（一棵必然要推的树）完成机制教学，无一行文字。
3. **Baba Is You（Hempuli）[C]**：规则即物体 → 每关一个"词法惊喜"；关卡设计以动词组合为纲，先枚举规则交互再筛选可教性。
4. **Patrick's Parabox（Patrick Traynor）[C]**：每个世界引入恰好一个递归概念，概念间用视觉框架（世界门）隔离认知负荷。
5. **Stephen Lavelle（increpare）[C，原文未取得]**：长期实践"求解器在编辑器里"——作者工具链内嵌自动求解/可解性检查，关卡先满足约束再谈趣味；"生成-验证"是设计流本身。对本项目的直接印证：**认证器不是安全网，是设计面板**。
6. **WFC 在关卡生成的位置 [C，论文存在但本轮 fetch 失败]**：Karth & Smith《WaveFunctionCollapse is Constraint Solving in the Disguise of Machine Learning》论证 WFC 本质是约束传播+回溯——**擅长局部纹理（地形铺陈），不擅长全局硬约束（可解性）**。前沿共识是"局部用 WFC/纹理，全局用求解器"双轨。本项目 cw-构造 + BFS 认证的分轨与此同构，**无需改**。

### 2.2 与本项目差距

- 有静态图例（四格）与认证步数公示，**缺全部过程性引导**：无首步提示、无"推这里会怎样"预演、undo 不可见、余步紧张度无声（docs/30 问题 3 已被真人试玩清单点名）。
- **无教学曲线**：stage 0 即随机生成；TPL_A/B 只是失败兜底而非"第一课/第二课"。对比 Witness 三律，当前每个 stage 内的新机制（rift、绝缘闸）没有"唯一解教学面板"阶段。
- 帮助文案是"词典型"（一次说完所有规则），不是"序列型"（每关带一个新词）。

### 2.3 建议（参数级）

| 优先级 | 建议 | 参数 |
|---|---|---|
| **P1** | **首步提示 token**：当 `movesUsed ≥ ceil(certifiedMoves×0.75)` 或已用 ≥1 次 undo 时，可花 1 枚预告等级（复用 `insightPerPreviewLevel=4, maxPreviewLevel=3` 管道）换取"最优首步方向"高亮（只给方向不给格） | 挂 `tribulation:preview:violet-omen` 效果链；防刷：每次天劫限 1 次 |
| **P1** | **余步紧张度门**：`剩余步 ≤ ceil(budgetSlack×0.5)` 时 HUD 余步进入强调态（动效归 docs/29：脉冲/字号，非配色）+ toast 一次"步数过半，认证最短路 N 步" | 纯展示层；session 层算阈值 |
| **P2** | **ghost 预览**：玩家贴近可推阵石且面向确定时，对"推后板面"跑一次 `traceBeam`，以虚线画假想光路（含会烧到哪株灵草） | 0 新算法：simulateMove+traceBeam 皆现成；仅在 UI 态更新，不动 sim |
| **P2** | **undo 可视化**：HUD 显示 `undoChargesRemaining` 计数芯片 + 快照数；死局哨兵（§1.3 P1）触发时 R 键高亮 | session 层字段已存在 |
| P3 | **教学曲线**：stage 0-1 固定走 TPL_A→TPL_B（唯一解/单扰动教学序），随机生成从 stage 2 接入；新阵石首次出现的那一劫构造"该阵石唯一解"板（生成器加 `teachKind` 选项，把其他块清出板面） | `createPuzzle` 按 stage 与已解锁 kinds 决定走模板/教学参数 |

---

## 3. Roguelite 道具/词缀组合深度范式

### 3.1 前沿要点

1. **Slay the Spire relic [B/C]**：遗物交互控制的秘诀是**触发时机正交化**——效果挂在互不重叠的事件轴上（战斗开始/抽牌/休息/进层），本质是"离散事件上的线性修正量"，避免 N² 组合验证；稀有度分池（普通/罕见/稀有）控制出现曲线。
2. **Hades 双重恩赐 [B/C]**：**显式配方**——需要特定前置对组合才出现，玩家可查表追逐；供给予过滤（不出死选）。教学即图鉴。
3. **Dead Cells / build 弧线 [C]**：早期掉落偏向当前构筑、成长型道具放大早期选择 → 一局内"早期承诺、后期收割"的弧线。
4. **Caves of Qud / Dwarf Fortress 词缀 [C]**：**定性标签叠在定量基座上**（材质/成分语法），组合语义由标签系统涌现，不需要逐对测试——"成分"而非"条目"扩展。

### 3.2 本项目组合空间盘点（现状）

三轴现状极不对等：**残卷轴** 7 节点（活动升级 3 / 阵石 1 / 丹方 1 / 劫兆情报 1 / 叙事 1），仅做**合法性门**；**阵石轴** 3 kind、0 修饰（mirror 只会 cw 折、conductor 只跨单格 rift、insulator 永久阻断）；**灵草轴** 1 kind × 数量。有效劫式 = requiredBlockKinds 的 4 个子集 → **组合空间 ≈ 4 × stage**，"组合"实际只是"解锁先后"。preparation/prepared-board 已把"阵石必须被最短解使用"做实（placedBlockKinds 过滤），扩展缝很干净。

### 3.3 建议（参数级）：三轴正交契约 + 首批修饰

**正交契约（P1，先于任何新内容）**：残卷轴 = "什么能出现"（合法性/稀有度门）；阵石修饰轴 = "怎么作用"（beam 语义修饰）；灵草轴 = "要保什么"（目标结构/奖惩）。任何新内容只落一个轴，禁止跨轴复合（StS 事件轴纪律）。

| 优先级 | 建议 | 参数 |
|---|---|---|
| **P1** | **阵石修饰首批 3 种**（BlockKind 不动，加并行 `blockModifiers` 数组避免破坏旧种子回放）：①逆折镜（ccw 折）②宽脉桥（conductor 跨 2 连格 rift）③焚绝缘（阻断 1 次雷光后自毁） | 出现率对齐现有公式族：p=min(0.10+0.02·stage, 0.25)，stage≥4 起（L344 现有 fallback 同层）；落位复用 prepared-board tryPlaceBlock 安全网 |
| **P1** | **劫式配方公示**：archetype×修饰组合进图鉴/鉴（Hades 图鉴式），玩家可见"未遇过的组合" | 纯展示层，数据源 SokobanChallenge |
| P2 | **灵草 kind 扩展**（`PreparedHerbKind` 已留接口，preparation.ts L7）：雷引草（在光路上=淬体 power +15%/株，风险换收益）、护脉草（替身体挡一次雷=保险） | 每板 ≤1 种新草；`maxPreparedHerbs=3` 不变 |
| P2 | **稀有度曲线**：修饰阵石与灵草 kind 分两池——常规（mirror/conductor/insulator 基型）随 stage 线性；修饰池按上式且**残卷门控**（新节点 cost 4-5） | 与 insight 经济（每轮 1 节点）联动：修饰池上限 = 已解锁阵石类修饰节点数 |
| P3 | **显式配方节点**（Hades duo 式）：残卷新节点条件="曾在一劫中同时用修饰阵石 X 与灵草 kind Y 且 perfect" → 解锁复合板面生成权重 | legacy 记录达成；生成器加权重表 |

---

## 4. 玩家建模与难度适配（轻量）

### 4.1 前沿要点

- **Glicko [W]**：初值 rating 1500 / RD 350；q=ln10/400；RD 随期衰减 `min(√(RD₀²+c²t), 350)`，赢弱队涨分少、对手 RD 高时更新缩水——本质是**带置信度的难度估计**。用于"关卡当对手"的扩展在来源中无先例，属本项目自创（标注）。
- **IRT（项目反应理论）[C]**：心理测量学标准——题目难度×玩家能力双参数 logistic，从作答数据联合估计；游戏研究里是关卡难度标定的学术正路，但**需要玩家作答数据管道**。
- **RPD/规则式玩家建模 [C]**：用显式规则（行为计数）而非统计模型推断玩家状态；适合无数据冷启动。
- **关键约束**：本项目 sim 确定性红线（docs/00、CONTRIBUTING）+ 无在线数据管道 → **任何统计式建模只能活在 UI/记录层，不能进生成器**。

### 4.2 与本项目差距

已公示 certifiedMoves+budgetSlack（数值难度），但玩家读不懂"32 步"意味着什么；无跨世难度记忆；docs/30 的"挫败感控制 3 分"与首劫盲验证缺口都指向**难度表达缺人话层**。

### 4.3 建议（参数级）

| 优先级 | 建议 | 参数 |
|---|---|---|
| **P1** | **劫式三型标签**（生成期、确定性、零数据需求）：**快**（slackRatio=budgetSlack/certifiedMoves ≤0.35，或 required 含 insulator）；**缠**（preserveHerbsTarget≥2 且任一灵草与初始 beam 曼哈顿距离≤1——prepared-board L49-61 已算 beamDistance）；**势**（bends≥3 或 compound-array）。多命中取优先级 快>缠>势，HUD 一枚标签字 | 写入 `SokobanChallenge.flavorTag`；紫劫兆拓预览层显示标签而非数字（认知负荷减半） |
| P2 | **世内轻量自适应**：只动 budgetSlack（±2/次，区间 [4, 24]，对齐现 clamp），依据 = 本世此前各劫 result（perfect→-2、timeout→+2），在 preparation 层生效（有 `mortalHeartPerMoveBudgetBonus=25` 先例） | 不动 certifiedMoves 与生成器 → 确定性与回放不破 |
| P3 | 跨世 per-archetype 胜率记入 legacy（ash 链），下世"紫劫兆拓"对该 archetype 多显示一行情报（如"上世快型两败"） | 只增信息不增数值（硬传承红线 docs/25 §4）；不建 ELO 管道——单人离线场景 IRT/Glicko 无数据可估，[W] 公式仅备查 |

---

## 5. 综合路线图：组合扩展矩阵（未来 2-3 迭代）

三轴契约落地次序 = 先地基（标签/提示/修饰）→ 再扩轴（灵草/多扰动）→ 后配方（复合/预演）。

| 迭代 | 残卷节点（门） | × 阵石修饰 | × 灵草 kind | → 产生的新决策 |
|---|---|---|---|---|
| **1 组合地基** | 无新节点（既有 thunder-guiding-stone 继续做水石门） | 逆折镜（ccw） | —（仅基型） | 光路从"单向 cw 规划"变为"cw/ccw 双向规划"：同折点两种镜=两条解空间；玩家第一次在**阵石选择**层做决策 |
| 1 | 无新节点 | 焚绝缘（1 次阻断） | — | "闸门时序"决策：绝缘石从永久障碍变成可消耗资源，推入光路=换 1 步时序还是留作终局保险 |
| **2 正交扩展** | 引雷聚枢（cost 4，array-stone 支， prereq thunder-guiding-stone） | 宽脉桥（跨 2 格 rift） | 雷引草（光路上 power+15%/株） | 风险收益路径决策：绕开 vs 穿草增强淬体——第一次在**目标结构**层做决策（灵草从"保"变"用"） |
| 2 | 木灵册（cost 4，farming 支，prereq field-breathing） | —（基型 conductor） | 护脉草（挡一次雷） | 保险经济学：护脉草放哪格=赌哪段光路；与 ward 丹（会话层保险）形成"板面保险 vs 丹药保险"取舍 |
| **3 深度配方** | 分光拓（cost 5，prereq violet-omen-rubbing） | 逆折镜+宽脉桥复合板（显式配方：曾 perfect 达成过组合才解锁生成权重） | 雷引草×护脉草同板 | 三轴全开板：同板存在"增益草"与"保险草"，快解（少步）与增益（多穿）显式冲突 → perfect 判定从"命中甜区"升级为"甜区×草序"二阶优化 |
| 3 | 灰烬回脉（cost 5，prereq ash-annotated-vow） | 焚绝缘（多枚） | — | 死局面哨兵+多枚焚绝缘 → "烧桥断路"战术：主动制造一次性闸门链，undo 预算成为资源战 |

配套机制次序：迭代 1 随 §1.3 P1（难度带+死局哨兵）与 §2.3 P1（提示+紧张度）同车发布——修饰阵石必须先有可读性地基；迭代 2 随 §1.3 P2（多 mirror 扰动）扩大板面复杂度以容纳新草；迭代 3 随 §3.3 配方图鉴与 §2.3 ghost 预演收口。

## 附：源列表

**本轮 WebFetch 实读成功 [W]**

- <https://en.wikipedia.org/wiki/Sokoban>（复杂度、基准、求解器史、Murase 1996 生成研究）
- <https://en.wikipedia.org/wiki/Glicko_rating_system>（初值/公式/RD 衰减）

**fetch 失败降级 [C] 声明**（各源尝试 ≤2 次）

- sokobano.de wiki《Deadlocks》：TLS 自签证书失败（WebFetch + webReader 各 1 次）——死锁分类/检测法凭社区共识补。
- github.com/angusrail/generate-sokobanlevels 与 raw README：均 404（可能改名/删除）——过滤器式工具描述凭 [C]。
- draknek.org/blog（含 www 变体）：404——draknek 原则凭 [C]。
- export.arxiv.org API（Sokoban 生成检索）：ECONNRESET；Karth & Smith WFC 论文按记忆引标题、不注 arXiv 号。
- api.semanticscholar.org：429（两次）。
- WebSearch：配额耗尽（重置 2026-10-03），全部检索改直连 URL。
- The Witness（Blow 2011 讲席《Designing to Reveal the Nature of the Universe》）、StS/Hades/Dead Cells/Qud 设计表述：凭知识引述 [B/C]，未逐字核实。
