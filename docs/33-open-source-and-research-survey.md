# 33 · 开源与学术资源调研：可复用性判定（2026-09-14）

> 方法：npm registry API / GitHub topics / Wikipedia / 作者主页 / PCG 书站
> 逐源实测抓取（WebFetch），未验证源明确标注。目标：为天劫生成器/求解器、
> 平衡调参、确定性回放三域找"可参考、可复用、可适配"的外部资源，
> 避免过度造轮子——结论先行：**该生态没有可直接白捡的轮子，自研即常态；
> 真正的收益是把我们的做法锚定到发表过的方法上，并确认升级方向的先后**。

## 一、Sokoban 生成器/求解器生态

### 1.1 学术脉络（已验证源）

- **Murase, Matsubara & Hiraga (1996) "Automatic Making of Sokoban Problems"**：
  自动出题的最早记录（经 Wikipedia Sokoban 条目引文核实存在性）。
- **Taylor & Parberry (2011) "Procedural Generation of Sokoban Levels"**
  （GAMEON-NA；作者主页 ianparberry.com/research/sokoban 已抓取）：
  构造式生成 + 内建可解认证（"guaranteed to be solvable"——构造即可解，
  而非生成后再筛选）；指数时间但"离线使用足够快"；难度按集合内由易到难排序。
  **→ 与本项目生成器（构造式 cw 光路 + BFS 认证 + 难度带定向重试）同构**，
  属已发表方法的独立重实现，且难度带定向比"事后排序"更强。
- **Jarusek & Pelánek (2010)**：Sokoban 难度评分研究（Wikipedia 引文）——
  与本项目"认证步数=难度度量"同思路。
- **复杂度谱系**（Wikipedia 核实）：可解性判定 NP-hard（Fryers & Greene 1995;
  Dor & Zwick 1999）、PSPACE-complete（Culberson 1997; Hearn 2006）；
  XSokoban 90 题解长 97-674 推——解释了为什么阶段 3 前的 stage≥4
  "认证步 16-26"对推箱是合理量级。

### 1.2 工程生态（已验证源）

- **npm**：唯一专用包 `sokoban-generator`（anoxic，2018 年停更，**GPLv3**，
  月下载 ~35）。判定：**不采纳**——许可证不兼容 + 无难度控制 + 停更；
  且其"生成后过滤"路线弱于本项目构造式。
- **npm 求解器面**：z3-solver / yalps / logic-solver 可编码推箱约束，
  但本项目认证问题（有界步数内可解）用 BFS 即**完备精确**，引 WASM/SAT
  属过度工程。判定：**不采纳**。
- **GitHub topics/sokoban?l=typescript**（16 仓库已扫）：全部是完整游戏
  （TypeGame 284⭐ 编译期推箱属炫技；其余 React/Angular/Phaser 壳），
  **无独立求解器/生成器库**。判定：自研即生态常态，无可白捡轮子。
- **求解器谱系**（Wikipedia）：Rolling Stone（U Alberta，首个自动求解器，
  **死锁检测为核心增强**）→ Festival（FESS 算法，首个全解 XSokoban）。
  Culberson 组 GAMES 页面已核实存在。判定：**概念锚定**——本项目
  session 的 deadlocked 哨兵与该谱系同源；若未来需要更强活局检测，
  Festival/FESS 与 freeze/corral 死锁分类学是升级路线（本轮未实现，
  收益/成本比对生成器认证低）。
- **未验证源**：sokobano.de（TLS 证书错误）、sourcecode.se/YASS（bot 墙）、
  Antithesis DST 文章（404）——均如实标注，未据此下结论。

## 二、程序化内容生成（PCG）方法论

- **《Procedural Content Generation in Games》（Shaker/Togelius/Nelson,
  Springer 2016，pcgbook.com 全章免费 PDF）**：第 2 章 search-based PCG、
  第 6 章 rules & mechanics（= 游戏平衡）、第 12 章 generator 评估。
  判定：**方法论引用锚**——docs/32 的"复合罚爬山 + 基线带 + 种子窗
  稳定性"即第 2/12 章做法的工程化实例；已在 docs/32 §21 引用。
- **PCGML 综述（Summerville et al. 2018, arXiv:1702.00539）**：需要训练
  语料（人类关卡库），本项目无人类关卡数据且生成空间可枚举。判定：
  **不适用**——除非未来要学"玩家手感分布"，否则不引入。
- **经验驱动 PCG（ch.10）**：以玩家模型驱动生成——正是 docs/30 真人
  试玩工作单（首劫死率/苦练采纳落点）的方法论先例；待真人数据后可按
  该章"玩家态→内容适配"框架做 DDA 评估。

## 三、确定性回放/仿真测试工程

本轮抓取的两个候选源未取到（Antithesis 404、sokobano.de 证书失败）。
基于已实现事实记录：本项目 golden replay（canonicalSerialize+sha256 逐步
哈希 + 固定种子确定性 harness）与业界 deterministic simulation testing
（FoundationDB/TigerBeetle 一脉）同构：种子化 RNG、无环境噪声、失败可
逐哈希二分。此域**无需外部依赖**——缺口只在"主模式外的覆盖率"，已随
旧世界退役一并解决。

## 四、采纳判定汇总

| 资源 | 判定 | 动作 |
| ---- | ---- | ---- |
| Parberry 2011 / Murase 1996 生成谱系 | 参考+锚定 | generator.ts 头注补文献锚（本轮） |
| Rolling Stone 死锁检测先例 | 参考+锚定 | session 死锁哨兵注释补谱系（本轮） |
| Jarusek & Pelánek 难度评分 | 参考 | 认证步数度量已有；不加评分器 |
| PCG 书 ch2/6/12 | 方法论引用 | docs/32 已引；后续调参沿用该框架 |
| PCGML 综述 | 不适用 | 无训练语料 |
| npm sokoban-generator（GPLv3/停更） | 不采纳 | 许可证+质量双排除 |
| z3-solver / yalps | 不采纳 | 有界 BFS 已完备，引依赖属过度工程 |
| TS 生态 16 仓库 | 不采纳 | 全是游戏壳，无库可复用 |
| Festival/FESS + freeze/corral 死锁分类 | 未来方向 | 若活局误报率上升再评估 |

## 五、成本复盘

本轮总投入：约 8 次源抓取 + 本报告。避免的浪费：① 引 GPLv3 停更包的
合规/维护陷阱；② 引 z3 WASM 的体积/构建复杂度；③ 照搬 CMA-ES 于
33 格离散空间（§21 已证穷举更优）。获得的资产：三条文献锚（生成器
谱系、难度度量、死锁先例）使自研组件"有出处可引"，以及一条已被
文献验证的方法论边界（构造式认证生成 = 发表过的 SOTA）。
