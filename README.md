<p align="center">
  <img src="assets/logo/logo-emblem.png" alt="永恒山谷：大道之歌 徽记" width="200">
</p>

# 永恒山谷：大道之歌 · Aeon Vale: Song of the Dao

> **凡骨种灵田，七情炼仙丹，硬抗九重天劫。**
>
> 在这里，种田不是休闲，是备战——你种下的每一株灵草，都是天劫之夜的弹药与阵眼。

[![License: MIT](https://img.shields.io/badge/代码-MIT-blue.svg)](LICENSE)
[![Content: CC BY-NC 4.0](https://img.shields.io/badge/内容-CC%20BY--NC%204.0-orange.svg)](CONTENT-LICENSE.md)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg)
![PixiJS](https://img.shields.io/badge/PixiJS-8-red.svg)
![中文原生](https://img.shields.io/badge/全程中文-zh--CN-green.svg)

**[当前体验入口](#快速体验)** · **[English Summary](#english-summary)** · **[贡献指南](CONTRIBUTING.md)** · **[公开优先级](#公开优先级)** · **[路线图](#路线图)** · **[许可证](#许可证)**

---

## 这是一款什么游戏？

你是一个**没有灵根的凡人**。

灵修之路对你永远关闭。没落的体修之路只剩一卷残书、一身苦练、以及头顶那片迟早劈下来的天劫。

种田是为了炼丹。炼丹是为了淬体。淬体是为了**主动引劫**——以凡人之躯扛过天道降下的雷霆，把惩罚变成肉身的资粮，一步一个血印地走向那场终极紫雷劫。

**最终，以凡骨与天道对弈、逆天改命。**

> 《永恒山谷：大道之歌》是一款**全程中文、离线单机、纯代码开发**的修仙种田 + 炼丹 + 天劫塔防生存游戏。你经营灵田、调配七情丹药、布置阵法，在**确定性、可回放**的天劫中硬扛飞升。当前版本以浏览器作为开发、测试与公开展示载体，但项目的平台目标始终是**离线单机、多端同核**：后续优先封装桌面端（Windows / Linux），再评估更远期的移动端适配；所有核心系统都先围绕本地离线运行构建。MIT 开源，每一场天劫都能复盘，每一个机制都能 fork 改造。

## English Summary

**Aeon Vale: Song of the Dao** is a Chinese-first offline farming, alchemy, and tribulation-survival game built with TypeScript and PixiJS. You cultivate spirit herbs, refine risky pills, arrange defensive arrays, and deliberately invoke heavenly tribulations to temper a mortal body into an ascendant one.

The project currently offers a browser-playable public demo target with deterministic simulation, replay-friendly systems, and GitHub Pages deployment checks. The long-term direction is a solo-developed indie game that moves closer to the life-sim density of *Stardew Valley* while using xianxia cultivation as its mechanical core.

---

## 为什么做这款游戏？

因为我们玩遍了修仙游戏，却始终在等一款**不肝、不崩、不锁 Mod、全程中文原生**的作品。

| 品类痛点 | 我们的回答 |
|---|---|
| **过度肝度 / 重复 grind** | 种田即布防——每一株灵草同时是塔防弹药，种田本身就是策略，不是无脑重复 |
| **Bug 崩溃 / 存档损坏** | 确定性 PRNG + Golden Replay：每一场天劫都能逐字节复现、调试、回放 |
| **Mod 平台被垄断** | MIT 开源——**fork 就是你的 Mod 平台**，不需要任何人批准 |
| **翻译质量差** | 全程中文原生——界面、叙事、系统表达以简体中文为第一语言，无翻译损耗 |
| **美术外包风格断裂** | 纯代码主导的定制资产管线——程序化绘制与已入库定制素材共存，风格与运行时链路保持可控 |

---

## 核心特色

### 🌾 种田即布防
> 你的灵田就是你的战场。

灵草吸引雷电、阵法偏转落点、土壤决定生长——你种下的每一株草、翻的每一块地，都在为天劫之夜布阵。这不是"修仙版星露谷"，而是**种田的产物就是你抵御天劫的弹药**。

### 🔥 七情炼丹
> 投料、控火、平衡药性、险中求丹。

四轴药性（寒热温平）+ 配伍相克 + 火候曲线 + 丹毒风险——炼丹不是按配方点按钮，而是一场**非线性解谜**。同料异火出异丹，老手能从残卷中悟出新丹方。

### ⚡ 逆天引劫
> 不是天劫来找你，是你去找天劫。

阶段圆满、体魄淬足后，由你**主动引劫**。引早了——被劈死；引晚了——寿元耗尽。每一次引劫都是一场赌上一切的塔防生存战，扛过去就是淬体突破，扛不过就是暴毙走火。

### 🎭 凡人的挣扎
> 你开局是蝼蚁，每一步都是悬崖边。

吃错灵草会中毒、被天雷擦边即重伤、大势不可逆。失败惩罚真实但可学习——每一次暴毙都让你更懂这片天道。**走钢丝般的控血曲线**（HP 维持在低位以获得最大淬体收益）是灵魂机制。

### 🌊 慢与快的极致张力
> 90% 时间治愈种田，10% 时间生死一线。

春日灵田的温润 → 天劫倒计时的窒息 → 雷霆撕裂的肾上腺素 → 突破成功的释放 → 回到更强的慢节奏。两种极端情绪用同一个场地（你的农庄）联结。

### 🎨 纯代码匠心
> 纯代码主导底层，按需接入定制资产。

不用 Unity / Cocos / Unreal。PixiJS 8 渲染 + Web Audio API 合成 15 种 SFX + 双模式 BGM。16 色限定调色板 + 水墨留白美学。项目核心价值不在于“所有像素都由 TypeScript 生成”，而在于**底层逻辑、渲染链路、资产接入与发布流程都由代码掌控**；程序化视觉与已入库 PNG 素材按需共存，服务当前公开试玩版的首屏读图与后续独立游戏化迭代。

---

## 快速体验

公开试玩版验收目标地址：`https://Rethymus.github.io/AeonVale/`。当前处于公开前验收阶段；本地公开树已通过 GitHub Pages 子路径 smoke，真实 Pages URL 需要在重新部署公开树后复跑 `pnpm test:browser:pages`。后续若转为 Public 或发布 Release，仍必须重新走授权、公开树和泄露检查流程。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

当前浏览器形态用于本地开发、自动化回归与公开展示；它是现阶段最方便的体验入口，但不是项目的最终平台定义。近期目标是先把同一套离线单机核心稳定封装到桌面端（Windows / Linux 优先），浏览器版继续承担试玩、演示与 GitHub Pages 展示职责；Android 作为更后续的扩展方向，macOS 暂不作为当前阻塞项。打开 `http://127.0.0.1:5173` 即可体验。要求 Node.js 22 + pnpm 10。

质量检查：

```bash
pnpm governance:check
pnpm typecheck
pnpm content:lint
pnpm test
pnpm build
pnpm test:browser
```

公开前完整验收会重新生成 `.public-tree`，并在公开树内完成治理、类型检查、发布检查、构建和 dist 检查：

```bash
pnpm verify:public-tree
```

GitHub Pages 启用并部署后，用真实公开地址复跑最低试玩 smoke；该命令不会启动本地 preview，只访问 `https://Rethymus.github.io/AeonVale/`：

```bash
pnpm test:browser:pages
```

若要直接卡住首屏播种键位这类“测试绿但不可玩”的回归，本地可额外运行 CDP 状态注入门：

```bash
pnpm test:browser:keypoint
```

部署后的真实 Pages URL 还应补跑一遍首屏真实输入可玩性验证：

```bash
pnpm test:browser:pages-playable
```

如果真实 Pages smoke 失败，先运行只读诊断区分是部署漂移、线上旧 bundle、GitHub Action 状态，还是当前代码的首屏布局问题；该命令只读取本地 Git、GitHub Actions 和真实 Pages URL，不提交、不推送、不部署、不修改远端设置：

```bash
pnpm portfolio:pages-diagnose
pnpm portfolio:pages-diagnose -- --json
```

等待远端 CI 或 Pages 部署时，先用只读 watch 汇总状态，避免把等待 Action 变成重复跑本地流水线；它会读取最新 main CI、Pages Action、github-pages deployment、Pages Source 和线上 bundle，判断是否是 CI 仍在跑、Pages 未触发、deployment 落后、线上旧 bundle 或本地 HEAD 尚未进入 `origin/main`。该命令不提交、不推送、不部署、不修改远端设置：

```bash
pnpm portfolio:pages-watch
pnpm portfolio:pages-watch -- --json
pnpm portfolio:pages-watch -- --wait --json
```

公开试玩版上线前可跑一键预检：先拒绝密钥风险路径，再生成审核截图，验证 GitHub Pages 公开树，最后打印非部署发布清单；该命令只做本地检查，不提交、不推送、不部署：

```bash
pnpm portfolio:mvp-preflight
```

当前发布预检已经覆盖公开树生成、审核截图、公开树浏览器 smoke、GitHub Pages 子路径构建、dist 泄露检查和维护者发布清单回显；真实 Pages URL 必须在重新部署后通过 `pnpm test:browser:pages`，且失败时应先用 `pnpm portfolio:pages-diagnose` 归因复核，才可宣称 GitHub Pages 闭环完成。后续若转为 Public、创建 Release 或修改远端设置，仍需要维护者当次明确授权。

需要快速同步当前 P0/P1/P2 位置时，可打印公开安全的状态矩阵；它只复述可审证据、Pages 验证状态、《星露谷物语》对标口径和 No-Go 边界，不提交、不推送、不部署、不修改 GitHub 设置：

```bash
pnpm portfolio:status
```

需要让发布前检查或外部脚本读取同一份状态时，可输出机器可读 JSON；内容仍只包含公开安全的 P0/P1/P2 位置、对标维度、证据命令、证据产物和 No-Go 边界。`evidenceArtifacts` 会列出 `public-demo-evidence-json`、`public-demo-screenshot-set` 和 `live-pages-smoke`，用于复核可审证据、截图绘制统计和真实 Pages smoke 状态：

```bash
pnpm portfolio:status -- --json
```

准备公开操作前可先打印发布清单，复核授权边界、可公开文档、设计文档禁传范围和 Pages 上线后的真实 URL 验证步骤；该命令只输出清单，不提交、不推送、不部署、不修改 GitHub 设置：

```bash
pnpm portfolio:release-checklist
```

发布清单同样支持机器可读 JSON，供发布前脚本复核 `requiredEvidence`、`authorizationRequired`、`runtimeSignals.todayBriefingProof`、`screenshotEvidence`、`pnpm test:browser:pages` 和远端操作授权边界等 P0 证据与 No-Go 闸门；输出仍只包含公开安全信息：

```bash
pnpm portfolio:release-checklist -- --json
```

当前工作区公开前可先运行只读审查，把未提交改动按公开候选、私有设计资料、本地 Agent 状态、生成物和密钥风险分类；公开候选会进一步按治理文件、运行时、玩法模拟、测试和工具管线分组，方便整理发布分支时确认哪些文件会进入公开树，避免误把设计文档放入公开树：

```bash
pnpm audit:public-worktree
```

需要完整清单时可加 `--json`；准备发布分支时可加 `--fail-on-secret-risk` 让 `.env*` 等密钥风险直接失败。

公开候选内容还可以做只读泄露审查，统计私有文档引用和 Agent 状态引用，把需要发布前复核的 `actionable` 引用与治理测试/工具中用于证明排除规则的 `reviewed-guardrail` 样例分开，并在发现密钥形态或生产 sourcemap 引用等高风险内容时阻断发布预检：

```bash
pnpm audit:public-content
```

审核截图可本地生成到 `test-results/portfolio/`，用于公开前审核和 README 展示素材筛选；该目录属于生成物，不进入公开树。截图脚本会抓取 canvas 的 CSS 实际渲染结果，覆盖桌面首屏、地点目录、农事面板和 736x414 横屏小视口键盘优先首屏（为兼容既有证据路径仍保留 `04-mobile-farm-loop.png` 文件名，但不代表触控或移动端可玩性），并写出 `test-results/portfolio/portfolio-mvp-evidence.json`，记录首轮闭环、今日简报 `todayBriefingProof`、截图实际尺寸、非空绘制比例、颜色数、修仙差异化和远端操作授权边界，方便维护者复核证据：

```bash
pnpm portfolio:capture
```

### 公开试玩路径

公开试玩的第一目标不是展示全部系统，而是让访客在 3-5 分钟内看懂“修仙农庄”的差异化闭环：种田取得灵草，灵草进入出货和炼丹资源链，资源再服务后续淬体、阵法和主动引劫。

| 步骤 | 玩家体验 | 公开演示价值 |
|---|---|---|
| 1 | 按首屏今日简报和目标提示完成翻地、播种、浇水 | 证明农务不是静态背景，而是可操作的第一层循环 |
| 2 | 过夜等待灵草成熟并收获 | 展示季节/日期/作物状态和确定性模拟推进 |
| 3 | 把首批灵草投入出货箱，过夜结算灵石 | 对齐《星露谷物语》的低门槛经济闭环 |
| 4 | 前往山谷集市补种，再回农庄播下第二轮 | 证明循环能自我续航，而不是一次性教程 |
| 5 | 继续进入炼丹、阵法、淬体和主动引劫 | 展示本作和传统农场生活模拟的核心分叉：种田即备战 |

最低可验收试玩路径先由浏览器 smoke 覆盖：`pnpm test:browser:smoke`；首屏播种键位与 onboarding 快捷操作再由 `pnpm test:browser:keypoint` 和 `pnpm test:browser:pages-playable` 兜底。公开 Pages 路径会通过 `pnpm verify:public-tree` 在 `.public-tree` 内再次构建和复测。

---

## 工程哲学

| 选择 | 理由 |
|---|---|
| **纯 TypeScript，不用游戏引擎** | 完全可控、可测试、可确定；不依赖引擎黑盒 |
| **sim / render / io 严格分层** | 核心模拟零 DOM/GPU 依赖，可在 Node 无头环境跑 1000 局回归 |
| **确定性 PRNG（mulberry32）** | 同种子 → 逐字节相等，支撑 Golden Replay 与自动化平衡调参 |
| **Zod Schema 驱动内容** | 灵草/丹方/事件全数据驱动，改 JSON 不改代码即可扩展 |
| **定制美术管线** | 程序化绘制 + 定制 PNG 资产 + 量化审核链路并行，按玩法读图优先级逐步接入运行时 |

---

## 路线图

```
✅ M0–M5 工程骨架 → 序章 → 炼丹 → 天劫核心 → 天象引擎 → 紫雷飞升
✅ M6 程序化美术打磨 + 季节节日 + 内容广度扩充
🔄 当前 P0 公开试玩版：运行时资产接入、首屏读图强化、离线单机闭环打磨
⬜ 下一步 保持浏览器展示入口稳定，同时推进桌面端封装（Windows/Linux 优先）
⬜ 后续 从可试玩纵切片发展到独立游戏首版，再按补丁 / DLC 式节奏逐步扩展
```

**长期参照系**：《星露谷物语》的长期生活感与循环厚度，但路径是修仙农庄——种田、炼丹、引劫、飞升。

---

## 公开优先级

当前公开试玩阶段不追求一次性复刻《星露谷物语》的体量，而是优先证明：核心循环能玩、差异化成立、工程质量可信、GitHub Pages 可以稳定展示。更深的剧情、人物关系、长期经营与开放式内容，会在独立游戏化阶段按补丁 / DLC 式节奏继续扩展。

| 对标维度 | 《星露谷物语》的强项 | 当前公开进展 | 优先级 |
|---|---|---|---|
| 日常循环 | 播种、浇水、收获、出售形成低门槛日循环 | 已有农务、出货、过夜、集市补种与新手动线 | **P0：继续打磨首轮 5 分钟可读性** |
| 差异化核心 | 农场生活与矿洞冒险互相补给 | 种田产物直接服务炼丹、阵法和主动引劫 | **P0：突出“种田即备战”的首屏表达** |
| 长期成长 | 技能、设施、背包、工具和社区中心带来中长期目标 | 已有体魄境界、设施、仓储、加工、主线与终局飞升 | **P1：压缩成试玩版可理解的目标链** |
| 社交与委托 | NPC、节日、礼物、请求构成长期生活感 | 已有地点、NPC 信号、委托、礼物、生辰与节日框架 | **P2：独立游戏阶段扩展人物厚度** |
| 世界与事件 | 季节、天气、节日、随机事件改变每日决策 | 已有天象、节令、妖兽潮、遗迹与留世事件 | **P1：优先保留能改变玩法的事件** |
| 内容规模 | 大量作物、鱼类、矿物、配方、建筑和收藏 | 已有灵草、丹药、道具、设施、阵法、地点与图鉴化资产 | **P2：按补丁持续扩容，避免先堆量** |
| 可发布性 | 多平台稳定运行，玩家能直接下载或打开 | 浏览器展示、确定性测试、公开树、Pages/Release 门禁已建立 | **P0：先完成 GitHub 公开展示闭环** |
| 竞品参照 | 不适用 | 参考《鬼谷八荒》的境界成长、《觅长生》的丹药策略、《了不起的修仙模拟器》的阵法与经营压力、《太吾绘卷》的长期人物/世界驱动 | **P1/P2：只吸收适合纯代码单人项目的部分** |

当前排序：**P0 公开试玩版与 GitHub Pages 部署** → **P1 独立游戏首版的可持续循环** → **P2 补丁 / DLC 式内容扩展**。所有公开发布仍只使用通过检查的公开树，私有设计资料和长期细案不进入公开仓库或 Pages 产物。

### 当前进度快照

这份状态用于公开说明项目离可试玩纵切片的距离，不包含私有设计文档、剧情细案或长期路线规划。

| 范围 | 当前判断 | 还差什么 | 预计投入 |
|---|---|---|---|
| P0-A 本地可审版本 | **约 85%-90%**。核心循环、首屏提示、公开树、截图、测试与构建门禁已经具备本地可审基础 | 维护者人工试玩、截图可读性复核、少量首屏文案/视觉微调 | 0.5-2 天 |
| P0-B GitHub Pages 公开展示 | **待复验**。本地公开树已通过 `/AeonVale/` 子路径 smoke；当前真实 Pages URL 仍需重新部署后通过 smoke 才可作为验收入口 | 取得授权后重新部署公开树，并复跑 `pnpm test:browser:pages`、README 措辞和公开边界检查 | 授权后约 0.5-1 天复核 |
| 更强公开试玩版 | **纵切片已成形，但还可更锋利**。访客能看懂种田、出货、补种与修仙分叉 | 把炼丹、阵法、主动引劫压成更直观的 3-5 分钟展示链 | 3-7 天 |
| 独立游戏首版 | **不是当前阶段**。已有系统骨架多，但内容厚度、长期目标和人物生活感仍远少于成熟生活模拟 | 补长期目标链、NPC 记忆点、更多设施/地点/事件和桌面端封装 | 以月计 |

诚实结论：当前项目已经接近公开前验收的可试玩纵切片门槛，本地公开树可在 GitHub Pages 子路径下启动；但真实 GitHub Pages 链接当前仍未通过 smoke，必须重新部署后复验，且它还不能被称为完整独立游戏首版。现阶段最有意义的工作是继续收束 P0 体验：保护私有设计资料、保持公开树和 Pages 稳定、让首屏与 5 分钟试玩更清楚；随后再进入 P1/P2 的长期内容扩展。

### 当前差距与优先级

| 优先级 | 和《星露谷物语》相比还缺什么 | 当前处理策略 |
|---|---|---|
| P0 | 首次进入时还不够像完整产品，需要更强的“我该做什么、为什么做” | 继续压缩前 5 分钟路径，优先打磨今日简报、目标提示、首屏读图和 GitHub Pages 真机验证 |
| P0 | 公开试玩需要持续保证真实 URL 可访问，而不只是本地构建通过 | 只从通过检查的公开树部署 Pages；每次部署后复跑浏览器 smoke、截图和 dist 泄露检查 |
| P1 | 长期目标链还没有《星露谷物语》那种一眼可见的季度/年度牵引 | 把境界、设施、炼丹、引劫压缩成更清晰的中期目标，不急着堆内容数量 |
| P1 | NPC 与节日已有框架，但生活感和记忆点还薄 | 先保留能改变每日选择的 NPC 信号、委托、生辰和节日，再逐步扩写人物厚度 |
| P2 | 作物、地点、收藏、事件规模远小于成熟生活模拟游戏 | 公开试玩阶段不追求体量；独立游戏阶段按补丁 / DLC 式节奏扩容 |
| P2 | 缺少专业引擎和团队带来的编辑器、美术产能和多平台成熟度 | 保持纯代码、确定性和自动化测试优势，优先做小而硬的可验证系统 |

### 公开发布收束

当前项目已经不是从零搭骨架，而是在把可运行纵切片收束成可以公开试玩的版本。发布前判断标准不是“像《星露谷物语》一样大”，而是访客打开页面后能在数分钟内看懂三件事：这是修仙农庄、农务会形成经济闭环、经济闭环会通向炼丹/阵法/主动引劫。

| 阶段 | 必须先完成什么 | 完成后说明 |
|---|---|---|
| P0-A 本地可审版本 | 首屏读图、今日简报、首轮农务、出货、补种、公开树、截图和浏览器 smoke 全部通过 | 可以作为本地可审版本，请维护者人工试玩和确认公开范围 |
| P0-B GitHub Pages 部署 | 仅从 `pnpm prepare:public-tree` 生成的公开树构建，启用 Pages 后用 `pnpm test:browser:pages` 复跑真实 URL smoke，再复核截图和 dist 泄露检查 | 真实 URL smoke 通过后才可作为可试玩 Demo 验收入口；转 Public 前仍需重新复核 |
| P1 独立游戏首版 | 把炼丹、设施、阵法、境界和主动引劫整理成更清晰的中期目标链 | 从“展示纵切片”转向“可持续游玩” |
| P2 补丁 / DLC 扩展 | 扩充 NPC 记忆点、节日、地点、作物、收藏、事件和长期叙事 | 逐步靠近《星露谷物语》的生活密度，而不是一次性堆量 |

截至当前自动化证据已经覆盖：本地构建、单元/集成/属性/回放/无头测试、浏览器 smoke、审核截图、公开树生成、公开树构建、公开内容审查、dist 泄露检查、非部署发布清单回显。真实 GitHub Pages URL 需要在重新部署后复跑 smoke；Agent 不会自行公开仓库、创建 Release、打 tag 或更改远端设置，这些动作仍需要维护者当次明确授权。

### 公开试玩验收清单

这份清单只描述公开试玩需要达到的可验证状态，不包含私有设定、剧情细案或长期路线规划。

| 优先级 | 验收项 | 当前状态 | 公开验证方式 |
|---|---|---|---|
| P0 | 首屏能看出“修仙农庄”而不是通用 demo | 已有标题、Logo、地点/物品资产、中文 HUD 与今日简报 | `pnpm portfolio:capture` 审核截图 |
| P0 | 首轮农务能跑通播种、浇水、收获、出货、过夜、补种 | 已有 onboarding 目标、动作提示、里程碑、日结反馈和浏览器首屏 smoke | `pnpm test:browser:smoke` |
| P0 | 玩家知道今天先做什么 | 今日简报已按主线、农务、备劫、订单、社交输出优先级 | `pnpm test tests/unit/today-briefing.test.ts` |
| P0 | GitHub Pages 构建不泄露设计资料 | 公开树排除 docs、Agent 状态、sourcemap 和非白名单 Markdown | `pnpm verify:public-tree` |
| P1 | 农务产物能接到修仙核心 | 炼丹、阵法、体魄、主动引劫已形成可测试链路 | `pnpm test tests/integration/tribulation.int.test.ts tests/unit/alchemy.test.ts` |
| P1 | 每日世界不只是静态农场 | 已有 NPC 信号、委托、节日、生辰、天象和留世事件 | `pnpm test tests/unit/location-npc-signals.test.ts tests/unit/calendar.test.ts tests/unit/staying-world-incidents.test.ts` |
| P2 | 长期内容厚度接近生活模拟 | 已有扩展入口，但内容规模应在独立游戏阶段按补丁扩容 | 后续补丁 / DLC 式迭代 |

---

## 开发哲学

本项目由 **AI 辅助开发**（Claude Code + Codex），维护者负责全部设计决策、审阅与测试。这不是"AI 替代人工"，而是**一个人 + AI 协作推进一款纯代码离线游戏**：先完成稳定、可验证、可试玩的公开纵切片，再在可控范围内逐步演进为更完整的独立游戏作品。

- **透明开发**：公开仓库展示可运行源码、测试与构建链路；创作资料与长期规划细案保留在私有工作区，避免泄露项目核心创意资产
- **可自动化验证**：1300+ 个测试（unit / property / integration / replay / headless / browser），天劫平衡用蒙特卡洛 bot 自动调参
- **社区驱动**：MIT 开源，fork 就是你的——改内容、改平衡、改美术，不需要任何人批准

---

## 目录结构

| 目录 | 职责 |
|---|---|
| `src/sim/` | 确定性核心模拟（零 DOM/GPU 依赖） |
| `src/render/` | PixiJS 8 表现层（纯 Graphics + Sprite） |
| `src/content/` | 内容定义、Zod Schema、中文本地化 |
| `src/io/` | Web Audio 音频引擎 + 平台 IO |
| `tools/` | 内容校验、平衡扫描、字体子集化、AI 资产生成/审核管线 |
| `tests/` | unit / property / integration / replay / headless / browser |
| `assets/` | 美术资产（瓦片/灵草/角色/物品/丹药/CG/地点/种子/设施）+ manifest |

---

## 贡献与安全

提交、分支、PR、Agent 和发布规则见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。安全问题请按 [`SECURITY.md`](SECURITY.md) 私下报告。

公开发布时只上传由 `pnpm prepare:public-tree <目标目录>` 生成并通过检查的公开树。README、贡献、安全、许可证、变更记录和 GitHub 模板属于可公开治理文档；创作设定、玩法细案、路线规划、美术状态等设计资料保留在私有工作区，不进入公开仓库或 Pages 构建产物。

---

## 许可证

- **源代码**：[MIT License](LICENSE) — 自由使用、修改、分发。
- **原创内容**（世界观/叙事/数据表/美术）：[CC BY-NC 4.0](CONTENT-LICENSE.md) — 允许非商业使用与改编，须署名。
- 第三方依赖与资产保留各自许可

---

> *"种田是为了炼丹，炼丹是为了淬体，淬体是为了主动引劫——最终以凡骨与天道对弈、逆天改命。"*
>
> 这不只是口号，是每一行代码、每一个机制、每一场天劫的设计原点。
>
> **如果你也相信凡骨能逆天——欢迎加入。** ⚡
