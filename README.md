# 《Aeon Vale: Song of the Dao》永恒山谷：大道之歌

> 纯代码（不依赖 Unity/Cocos/Godot 等通用引擎）的 2D 修仙种田 + 炼丹 + 天劫塔防生存游戏。
> **全程中文（zh-CN）**，面向国内市场；**MIT 开源**。

## 这是什么

一款以「凡人修仙的挣扎感与偷天的快感」为核心的独立游戏：你是没有灵根的凡人，种田是为了炼丹，炼丹是为了活过天劫，活过天劫是为了偷天——最终以凡骨硬撼天道、白日飞升。

## 技术栈

- **TypeScript (strict)** + **PixiJS v8** (WebGL2) + **Vite**
- **Vitest + fast-check**（属性测试 + 无头模拟）
- **Zod**（数据驱动内容 schema 校验）
- 确定性核心：固定步长 (30 TPS) + 种子化 PRNG（Mulberry32，多流）+ 记录输入回放
- 分层：`sim`（纯逻辑，无 IO/渲染）← `render` / `io` / `tools` / `tests`

## 实现进度（M0–M4 已完成 · M5 破立终局进行中）

游戏核心已可玩、可测、确定性可复现（`pnpm dev` 浏览器运行 / `pnpm test` 189 测试全绿 / `pnpm headless` 无头模拟）：

- **确定性核心**：Mulberry32 PRNG + 多流、固定步长、canonicalSerialize + Golden Replay 基础、sim/render 严格解耦（纪律测试强制）。
- **种田系统**（docs/08）：灵气生长 / 土壤导电性（种田即布防）/ 季节 / 照料 / 翻地播种收获。
- **炼丹系统**（docs/06）：药性四轴 + 中医**七情配伍**（相须增效 / 相杀净毒 / 相反必炸）/ 非线性配方解析（同料异火出异丹）/ 炸炉。
- **天劫系统**（docs/05）：乘性 targeting 权重 / 劫雷淬体近死倒钟曲线（5–10% HP 峰值）/ 擦弹 PerfectBlock / BlastRadius。
- **进阶系统**（docs/09）：7 阶偷天诀 / 突破（成功率·丹毒惩罚·走火·险胜）/ 凡人恒弱曲线。
- **天象引擎**（docs/07）：周期触发事件（近 3 次反重复惩罚），调制全局灵气/生长；妖兽潮因果链（灵气潮汐→引兽→啃食）+ 主动猎妖掉内丹。
- **丹药系统**（docs/06 §7）：服用（回血/清毒/避雷护体/强骨）+ 炼丹/服丹 UI。
- **阵法系统**（docs/05 §8）：引雷阵（吸雷·需金属性阵眼·代接损耗）/绝缘阵（排雷），"种田即布防"。
- **结局系统**（docs/02）：飞升（飞升前夜 stage7 → 服飞升丹通关）/ 走火入魔 / 丹毒暴毙 / 陨于天劫，遮罩+重启。
- **程序化音频**（docs/10 §10）：Web Audio SFX + BGM 慢/急自动切换。
- **存档/读档**：localStorage 持久化 + 版本兼容。
- **渲染层**：PixiJS v8 + 中文 HUD（C8）+ 键盘即时操作；vite build 通过。
- **完整核心循环端到端验证**：farm→炼丹→天劫→突破，无头 bot 120 日推进至 stage 2、确定性哈希稳定。
- **蒙特卡洛平衡扫描器**（docs/17 §6）：参数→代理指标网格扫描，自动定位平衡甜区。

## 目录
- `docs/` — 完整设计文档包（22 份）。**入口：`docs/00-README.md`**（含 Vibe Coding 执行手册与零干预自动化开发 SOP）。
- `src/sim/` — 核心模拟（纯逻辑，可无头测试）
- `src/render/` — PixiJS 表现层
- `src/content/` — 数据驱动内容 + zh-CN locale
- `src/io/` — 输入/音频/存档
- `tests/` — unit / property / integration / replay / headless
- `tools/` — content-lint / headless-run / balance-scan

## 开发

```bash
pnpm install
pnpm dev          # 浏览器开发
pnpm test         # 全测试
pnpm test:fast    # unit + 属性测试（快）
pnpm typecheck
pnpm headless     # 无头模拟一局
```

## 设计文档

所有设计决策、机制、数值、测试策略见 `docs/`。冲突裁定见 `docs/20-design-decisions-and-reconciliation.md`。
