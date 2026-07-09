# 12 · 工程结构、依赖、构建、CI、内容管线、零干预开发循环

> 本文件定义《Aeon Vale》的**仓库布局、依赖清单、构建链、CI 流水线、内容创作管线**，以及最关键的——**「全程无人为干预」开发循环**的工程兑现。
> 上游：`10-technical-architecture.md`（语言=TS、分层）、`11-data-model.md`（数据 schema、内容表）。下游：`17-testing-and-automation.md`（测试细节）、`18-development-roadmap.md`（里程碑）。
> **本文档只产出工程决策与流程说明，不真正初始化代码工程、不写 package.json/构建配置文件。**

---

## 0. 总则

1. **呼应 §10 分层**：目录树严格映射「sim / render / content / io / tests」分层；依赖方向单向向上。
2. **C2 Vibe-Coding 友好**：每个目录单一职责，模块边界即文件边界，AI 可按目录逐个生成与验证。
3. **C4 可自动化测试**：CI 跑全部分层验证；无头模拟入口标准化。
4. **「零干预」承诺**：本文件 §6 定义 AI 端到端新增系统的标准 loop，每步可自动验证、失败可自动定位。
5. **包管理器**：**pnpm**（磁盘节省、严格依赖、workspace 友好）。Node LTS（≥ 20）。

---

## 1. 仓库目录布局

```
aeon-vale/
├── docs/                         # 设计文档（本目录）
│   ├── 00-DESIGN-BRIEF.md
│   ├── 10-technical-architecture.md
│   ├── 11-data-model.md
│   ├── 12-project-structure.md   ← 本文件
│   ├── 13-asset-art-audio.md
│   └── ...
│
├── src/
│   ├── sim/                      # 核心模拟层（PURE，无 IO 无渲染）
│   │   ├── world/
│   │   │   ├── GameState.ts          # 聚合根类型
│   │   │   ├── createWorld.ts        # 工厂：从 seed + content 构建
│   │   │   └── snapshot.ts           # 序列化/快照
│   │   ├── rng/
│   │   │   ├── Rng.ts                # 注入式 PRNG 接口
│   │   │   ├── mulberry32.ts         # 默认实现
│   │   │   └── streams.ts            # RNG 流（lightning/event/alchemy/...）
│   │   ├── farm/
│   │   │   ├── cropSystem.ts         # 作物生长系统
│   │   │   ├── tileSystem.ts         # 土壤/肥力
│   │   │   └── seasonSystem.ts
│   │   ├── alchemy/
│   │   │   ├── furnaceSystem.ts      # 丹炉推进
│   │   │   ├── recipeResolver.ts     # 配方解析（涌现）
│   │   │   └── propertyMath.ts       # 药性向量运算
│   │   ├── celestial/
│   │   │   ├── eventScheduler.ts     # 天象周期触发
│   │   │   └── causeChain.ts         # 因果链
│   │   ├── tribulation/
│   │   │   ├── lightningSystem.ts    # 雷生成/落下
│   │   │   ├── arraySystem.ts        # 阵法
│   │   │   └── temperingSystem.ts    # 淬体 buff
│   │   ├── progression/
│   │   │   ├── stageSystem.ts        # 偷天诀阶段
│   │   │   └── breakthroughSystem.ts
│   │   ├── economy/
│   │   │   ├── marketSystem.ts
│   │   │   └── storage.ts
│   │   ├── input/
│   │   │   └── InputFrame.ts         # 输入类型（离散化）
│   │   ├── events/
│   │   │   └── GameEvent.ts          # sim → render 的事件类型
│   │   ├── step.ts                   # 主 step()：按序调用各 system
│   │   └── index.ts                  # 公共导出
│   │
│   ├── content/                  # 静态数据驱动内容（只读）
│   │   ├── schemas/                  # Zod schema
│   │   │   ├── SpiritHerbDef.ts
│   │   │   ├── RecipeDef.ts
│   │   │   ├── PillDef.ts
│   │   │   ├── TribulationDef.ts
│   │   │   └── ...
│   │   ├── data/                     # 实际数据（.json 或 .ts 数据模块）
│   │   │   ├── herbs/
│   │   │   │   ├── base.json
│   │   │   │   ├── tier1.json
│   │   │   │   └── ...
│   │   │   ├── recipes/
│   │   │   ├── pills/
│   │   │   ├── items/
│   │   │   ├── tribulations/
│   │   │   ├── celestial-events/
│   │   │   ├── arrays/
│   │   │   └── beasts/
│   │   ├── ContentRegistry.ts       # 加载 + Zod 校验 + 跨引用检查
│   │   └── index.ts
│   │
│   ├── render/                   # 表现层（PixiJS）
│   │   ├── Renderer.ts               # 主渲染器
│   │   ├── layers/
│   │   │   ├── TileLayer.ts
│   │   │   ├── EntityLayer.ts
│   │   │   ├── FXLayer.ts            # 粒子/雷特效
│   │   │   └── UILayer.ts
│   │   ├── shaders/                  # WebGL 着色器（墨晕、抖动、辉光）
│   │   ├── sprites/                  # 精灵表索引/动画
│   │   ├── animation/                # 帧动画、插值
│   │   └── procedural/               # 程序化纹理/瓦片生成
│   │
│   ├── io/                       # 桥接层
│   │   ├── input/
│   │   │   ├── KeyboardMouse.ts     # DOM 事件 → InputFrame
│   │   │   └── InputQueue.ts
│   │   ├── audio/
│   │   │   ├── AudioEngine.ts       # Web Audio API 封装
│   │   │   ├── synth/               # SFX 程序化合成
│   │   │   └── bgm/                 # BGM 分层切换
│   │   ├── save/
│   │   │   ├── SaveService.ts       # 原子写 + 备份轮转
│   │   │   ├── migrate.ts           # 版本迁移管道
│   │   │   └── canonicalSerialize.ts
│   │   └── platform/
│   │       └── electron-main.ts     # Electron 主进程
│   │
│   ├── app/                      # 应用胶水
│   │   ├── GameLoop.ts               # fixed-timestep + 累加器
│   │   ├── bootstrap.ts              # 入口
│   │   └── config.ts                 # 全局常量（STEP、TPS、版本）
│   │
│   └── types/                    # 共享类型/枚举
│       ├── enums.ts
│       └── branded.ts               # branded types（int、fp 区分）
│
├── tests/
│   ├── unit/                     # 单元测试（per system）
│   │   ├── sim/
│   │   │   ├── farm.test.ts
│   │   │   ├── alchemy.test.ts
│   │   │   └── ...
│   │   └── content/
│   │       └── registry.test.ts     # 内容表校验
│   ├── property/                 # 属性测试（fast-check）
│   │   ├── rng-reproducibility.test.ts
│   │   ├── property-vector-laws.test.ts
│   │   └── balance-invariants.test.ts
│   ├── integration/              # 跨 system 集成
│   │   ├── full-tribulation.test.ts
│   │   └── farm-to-alchemy-loop.test.ts
│   ├── replay/                   # 确定性回放
│   │   ├── fixtures/                 # .replay.json
│   │   └── replay.test.ts
│   ├── headless/                 # 无头长时模拟
│   │   └── full-run.test.ts
│   └── balance/                  # 平衡回归
│       ├── monte-carlo.test.ts       # 蒙特卡洛（参考 Reddit gang city sim 案例）
│       └── economy-scan.test.ts
│
├── tools/                        # 离线工具
│   ├── content-lint.ts              # 内容表跨引用检查
│   ├── replay-recorder.ts           # 把手动玩的过程录成 .replay
│   ├── balance-scanner.ts           # 参数扫描 + 统计
│   ├── hash-diff.ts                 # 跨版本 state 哈希漂移检测
│   └── asset-pipeline.ts            # 占位资产打包
│
├── assets/                       # 静态资产（被 render/io 加载）
│   ├── sprites/
│   ├── audio/
│   ├── fonts/
│   └── manifest.json                # 资产清单 + 校验和
│
├── build/                        # 构建配置（不初始化，仅说明）
│   ├── electron/
│   └── icons/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                   # 主 CI
│       ├── balance.yml              # 夜间平衡回归
│       └── release.yml              # 发布打包
│
├── .omc/                         # OMC 运行时状态（不入版本控制）
├── .claude/                      # Claude Code 配置
├── docs/                         # 见上
├── (package.json)                # 占位说明：仅设计，不实际初始化
├── (tsconfig.json)
├── (vite.config.ts)
├── (vitest.config.ts)
└── README.md
```

**关键说明**：
- `()` 包裹的文件名表示**仅占位说明**——本设计阶段不创建。
- 每个目录有 `index.ts` 作为公共出口，外部只能 import 出口，禁止深路径 import（ESLint `no-internal-imports`）。

---

## 2. 依赖清单

### 2.1 运行时依赖（dependencies）

| 包 | 用途 | 备选 | 为何选它 |
|----|------|------|----------|
| **pixi.js** (v8) | WebGL2 渲染 | Phaser / Canvas2D 裸写 / Three.js | 是「库」非「框架」，不侵入 sim 架构；性能足够；社区大（参考 [Phaser vs Pixi.js](https://generalistprogrammer.com/tutorials/phaser-vs-pixijs-renderer-comparison)） |
| **@pixi/tilemap** | 瓦片批量绘制 | 自建 mesh | 单 draw call 出整张地图 |
| **@pixi/particle-emitter** | 雷劫粒子 | 自建 | 成熟、API 稳定 |
| **zod** (v4) | 运行时 schema 校验 | ajv / io-ts / valibot | TS 友好、原生 JSON Schema 导出、生态主流（参考 [Zod v4 迁移指南](https://dev.to/pockit_tools/migrating-to-zod-4-the-complete-guide-to-breaking-changes-performance-gains-and-new-features-3ll0)） |
| **electron** (主线) | 桌面打包 | Tauri / Neutralino / 纯 Web | 成熟、Chromium 一致性、AI 生成资料密集（参考 [Tauri vs Electron 2026](https://tech-insider.org/tauri-vs-electron-2026/)） |
| **electron-store** | 简单设置持久化 | lowdb | 轻量、原子写 |

### 2.2 开发依赖（devDependencies）

| 包 | 用途 | 备选 | 为何选它 |
|----|------|------|----------|
| **typescript** (≥5.4) | 类型系统 | - | 必须，strict 模式 |
| **vite** (v5+) | dev server + bundler | esbuild / webpack / Rollup | HMR 极快、配置简洁、Electron 集成成熟（参考 [Vite + Electron 教程](https://dev.to/ottoara/tauri-in-2026-build-cross-platform-desktop-apps-with-web-technologies-better-than-electron-11mo)） |
| **vitest** | 测试框架 | Jest / Mocha | 与 Vite 同构、ESM 原生、watch 模式快、内置覆盖率 |
| **@fast-check/vitest** | 属性测试 | 纯 fuzz | 种子化、可复现（参考 [fast-check + Vitest](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/)） |
| **electron-vite** | Electron + Vite 集成 | 手动配置 | 主/渲染/预加载三进程模板 |
| **electron-builder** | 跨平台打包 | electron-forge | 配置成熟、NSIS/dmg/AppImage 全覆盖 |
| **eslint** + **@typescript-eslint** | lint | biome | 生态成熟、自定义规则（如禁 `Math.random`） |
| **eslint-plugin-import** | 依赖方向强制 | - | 守住分层单向 |
| **prettier** | 格式化 | biome | AI 输出统一 |
| **husky** + **lint-staged** | pre-commit 钩子 | - | 阻止脏代码入库 |

### 2.3 依赖债防御

- **「最小依赖」原则**：每个新依赖必须在 PR 中说明「为何不能用现有 50 行代码替代」。
- **Bundle 分析**：`vite-bundle-visualizer` 每次 release 跑一次，包体异常增长即报警。
- **锁定文件**：`pnpm-lock.yaml` 入库，CI 用 `--frozen-lockfile`。
- **避免「框架陷阱」**：不引入 Phaser / Becsy / Redux 这类强加架构的库（违反 C2）。

---

## 3. 构建与开发

### 3.1 工具链总览

```
pnpm + Vite ─── dev server (HMR) ─── 浏览器预览
                ↓ production build
                dist/
                ↓ electron-builder
                Win/macOS/Linux 安装包
```

### 3.2 开发命令（约定）

| 命令 | 用途 |
|------|------|
| `pnpm dev` | 启 Electron + Vite dev server，HMR 热重载（代码 + 内容表） |
| `pnpm dev:web` | 仅 Web 预览（无 Electron，浏览器直接玩） |
| `pnpm test` | Vitest 单元 + 属性测试 |
| `pnpm test:watch` | watch 模式 |
| `pnpm test:headless` | 无头长时模拟（10k+ tick） |
| `pnpm test:replay` | 跑全部 replay fixture |
| `pnpm test:balance` | 蒙特卡洛平衡回归（夜间，CPU 密集） |
| `pnpm content:lint` | 内容表 schema + 跨引用校验 |
| `pnpm content:hot` | 监听内容表改动，触发热重载 |
| `pnpm build` | 生产构建到 `dist/` |
| `pnpm package:<platform>` | electron-builder 打包 |
| `pnpm lint` + `pnpm typecheck` | ESLint + tsc --noEmit |

### 3.3 产物目标

| 产物 | 路径 | 用途 |
|------|------|------|
| Web build | `dist/web/` | itch.io / GitHub Pages 试玩版 |
| Electron app | `dist/<platform>/` | 桌面三平台发行 |
| Replay fixtures | `tests/replay/fixtures/*.replay.json` | CI 跑 |
| Content registry | `dist/content.json`（打包后单文件） | 加载快 |

### 3.4 热重载

- **代码 HMR**：Vite 默认。
- **内容热重载**：监听 `src/content/data/**/*.json` → `ContentRegistry.reload()` → 通过事件总线通知 sim/render 重建缓存。
- **存档安全**：热重载不破坏存档（见 `11-data-model.md` §4.5）。

---

## 4. 内容创作格式与工具

### 4.1 策划/AI 编辑数据表的工作流

```
策划/AI 写 .json
   ↓
   pnpm content:lint  ──────► Zod schema 校验
   ↓                          ↓ pass
   跨引用检查               内容入注册表
   ↓                          ↓
   fix 错误 ◄──── fail ────── 报错位置精确到字段
```

### 4.2 JSON 编辑 vs TS 数据模块

| 形式 | 适合 | 决定 |
|------|------|------|
| `.json` | 大量同类条目（herbs/recipes/items） | **主选**，便于 AI 批量生成 |
| `.ts` 数据模块 | 需要计算的字段（如派生属性） | 仅当字段无法纯字面量时 |

**约定**：默认 `.json`；除非必须用表达式，才用 `.ts`（且只导出常量数组，不含函数）。

### 4.3 Schema 校验（防脏数据）

参考 [Why JSON Schema Is Underrated (2025)](https://peterhrynkow.com/ai/architecture/2025/02/01/schema-driven-platforms.html) + [Zod JSON Schema docs](https://zod.dev/json-schema)。

每个 Def 的 Zod schema 同时承担三种角色：
1. **运行时校验器**：`ContentRegistry.load()` 启动时 parse。
2. **类型来源**：`type SpiritHerbDef = z.infer<typeof SpiritHerbDefSchema>`。
3. **JSON Schema 导出**：可用 `zod.toJSONSchema()` 生成 `.schema.json` 给非 TS 工具消费。

### 4.4 内容 Lint 规则

| 规则 | 实现 |
|------|------|
| Schema 校验 | Zod parse |
| 跨引用完整性 | 所有 `defId` 引用必须存在（recipe.inputs → herb） |
| ID 唯一性 | 全局 Map 检测重复 |
| 命名规范 | regex 校验 kebab-case |
| 平衡护栏 | tier/growth/difficulty 在合理区间（如 tier ≤ 9、growthTicks ≥ 100） |
| 可玩性最小集 | 至少 1 个 tier-1 herb、1 个基础 recipe、1 个起始 tribulation |

CI 把所有 lint 失败转成「文件:行:字段」格式，AI 可直接定位修复。

### 4.5 未来：可视化编辑器

参考 [Charon](https://github.com/gamedevware/charon) 这类工具，若策划需要 GUI 编辑器，可后置引入（导出 JSON 即可，不侵入架构）。当前阶段以「AI/文本编辑」为主。

---

## 5. CI 流水线

### 5.1 阶段设计

```
┌──────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ lint │ → │ typecheck │ → │ unit     │ → │ integrat │ → │ replay   │ → │ headless │
│      │   │ tsc --noEm│   │ +content │   │ ion      │   │ (det.)   │   │ (10k tck)│
└──────┘   └───────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                                              ↓
                                                                      ┌──────────────┐
       夜间 job:                                                  ┌────►│ balance MC   │
       ┌─────────────┐                                           │     │ (param scan) │
       │ balance.yml │ ◄──────────── 每 6h / main 推送 ──────────┘     └──────────────┘
       └─────────────┘
```

| 阶段 | 命令 | 失败行为 | 时长预算 |
|------|------|----------|----------|
| **lint** | `pnpm lint` | 阻断 | < 30s |
| **typecheck** | `pnpm typecheck` | 阻断 | < 1min |
| **content-lint** | `pnpm content:lint` | 阻断 | < 30s |
| **unit** | `pnpm test unit/` | 阻断 | < 2min |
| **property** | `pnpm test property/` | 阻断（含 RNG 可复现性） | < 3min |
| **integration** | `pnpm test integration/` | 阻断 | < 5min |
| **replay** | `pnpm test:replay` | 哈希漂移即 fail | < 5min |
| **headless** | `pnpm test:headless`（10k tick × N 场景） | 异常状态/崩溃 fail | < 10min |
| **balance (夜间)** | `pnpm test:balance`（蒙特卡洛 1k run） | 通关率/经济指标漂移 > 阈值则警告（不阻断 main） | < 1h |

### 5.2 确定性回放 CI 跑法

参考 [Deterministic Simulation Testing — Antithesis](https://antithesis.com/docs/resources/deterministic_simulation_testing/) + [Reddit gang city sim 案例](https://www.reddit.com/r/gamedev/comments/1uqxdj1/we_built_a_living_gang_city_sim_heres_the/)（headless 跑上千随机种子）。

1. 每次内容/逻辑改动，CI 自动跑全部 `tests/replay/fixtures/*.replay.json`。
2. 任一 replay 的 `expectedFinalHash` 与实际哈希不符 → fail。
3. 失败时 CI 输出「漂移定位」：第一个分歧 tick + 该 tick 的事件 diff（哪个 system 哪个 RNG 流先变了）。
4. AI 拿到定位即可回到代码定位修改。

### 5.3 平衡回归（monte-carlo）

- **目的**：调参后确认「通关率分布」「平均死亡 tick」「丹炉炸炉率」等指标在期望区间。
- **跑法**：固定 1000 个种子，每种子用 AI-botted 策略（简单启发式：优先种 tier-1、按配方炼丹、雷前补避雷丹）跑到通关或死亡。
- **断言**：通关率 ∈ [30%, 70%]、平均死亡 tick ∈ [期望 ± 10%]。
- 漂移超阈值 → issue 自动创建，标签 `balance-regression`。

### 5.4 平台矩阵

- **CI OS**：Ubuntu（主，最快）。macOS/Windows 仅在 release 前跑一遍打包 smoke test。
- **Node 版本**：锁定 LTS（20.x），`engines` 字段强制。

### 5.5 失败定位的自动化

每个 fail 必须输出：
- 文件:行:列（lint/typecheck）
- 第一个分歧 tick + system + RNG 流（replay）
- 异常堆栈 + 上下文 5 行（test）
- 第一帧偏离期望哈希的位置（balance）

→ AI 读 CI 输出即可闭环修复，无需人工诊断。

---

## 6. 「无人干预」开发循环（核心承诺兑现）

> 这是 C2/C4 + 「全程不需要人为干预」承诺的工程化定义。
> 任何一次「新增系统」改动，AI 都按此 loop 执行；每步自动可验证；失败自动定位。

### 6.1 标准 Loop（以「新增一种灵草 + 配套丹方」为例）

```
   [1] 改数据表
       │ 策划/AI 编辑 src/content/data/herbs/tier2.json
       │            + src/content/data/recipes/xxx.json
       ▼
   [2] 内容校验
       │ pnpm content:lint
       │ 失败 → AI 读报错定位字段，回到 [1]
       ▼
   [3] 写/改 sim 纯函数（若需新机制）
       │ src/sim/farm/cropSystem.ts 或 alchemy/recipeResolver.ts
       ▼
   [4] 写测试
       │ tests/unit/sim/<system>.test.ts（含属性测试）
       │ tests/integration/<feature>.test.ts
       ▼
   [5] 单元 + 属性测试
       │ pnpm test unit/ property/
       │ 失败 → AI 读断言失败原因，回到 [3]/[4]
       ▼
   [6] 跑无头模拟
       │ pnpm test:headless（含新内容的场景）
       │ 崩溃/超时 → AI 读栈，回到 [3]
       ▼
   [7] 录新 replay fixture（若有手动验证需求）
       │ tools/replay-recorder.ts 生成 .replay.json
       ▼
   [8] 跑全部 replay（防回归）
       │ pnpm test:replay
       │ 哈希漂移 → AI 读漂移定位，回到 [3]
       ▼
   [9] 平衡回归（若改数值）
       │ pnpm test:balance
       │ 漂移超阈值 → AI 评估是「预期改进」还是「bug」
       │   - 预期：更新 expected 基线
       │   - bug：回到 [1]/[3]
       ▼
   [10] 提交（commit）
        │ 遵循 CLAUDE.md 的 commit 协议
        ▼
   [11] CI 复跑全部 [2]-[9]（最终保险）
        │ fail → AI 收到通知，回到对应步骤
        ▼
   ✓ 完成（无人工介入）
```

### 6.2 每步的「自动验证」契约

| 步 | 自动验证手段 | 失败信号 |
|----|--------------|----------|
| 改数据 | Zod schema + 跨引用 | 报错含字段路径 |
| 改 sim | 单元测试断言 | diff 期望 vs 实际 |
| 改机制 | 属性测试（fast-check） | 反例 + 种子 |
| 集成 | 跨 system 测试 | 第一个分歧点 |
| 无头 | 崩溃栈 + 性能护栏 | tick > 25ms 或异常 |
| 回放 | 哈希比对 | 第一个漂移 tick |
| 平衡 | 分布断言 | 漂移百分比 |

### 6.3 失败自动定位的工程化

每个失败必须能被 AI 自动归因：
- **Lint/Type 错误**：ESLint/tsc 输出 `file:line:col` —— 直接定位。
- **测试断言失败**：Vitest 输出期望/实际 diff —— 直接对比。
- **属性测试反例**：fast-check 输出最小化反例 + 种子 —— 复现。
- **Replay 哈希漂移**：CI 输出「第一个分歧 tick + system + RNG 流」—— 定位是哪个 system 的非确定改动。
- **崩溃栈**：源映射 → 行号 —— 定位。
- **性能超预算**：剖析输出最慢 system —— 定位。

→ **人类永远不需要手动调试**：所有失败信号机器可读，AI 自闭环。

### 6.4 AI 与人类分工边界

| 任务 | 负责 |
|------|------|
| 写新数据表 | AI（生成 JSON）+ content:lint 校验 |
| 写新机制代码 | AI（按 sim 纯函数规范）+ 单元测试 |
| 写测试 | AI（含属性测试的 invariant 推导） |
| 调平衡数值 | AI 跑 balance-scan + 提建议，**人最终拍板**（仅此处需人） |
| 故事/文案 | AI 生成 + 人审 |
| 视觉风格定调 | 人（一次性给美学锚点，见 `13`） |
| 紧急 hotfix | AI 直接走完整 loop |

**唯一需要人的点**：平衡的「趣味性」判断、叙事的「品味」判断、美学定调。其余全自动。

---

## 7. 开放问题

| # | 问题 | 倾向 |
|---|------|------|
| Q1 | pnpm vs npm/yarn | **pnpm**（节省磁盘、严格） |
| Q2 | Electron 主线 vs Tauri 迁移时机 | 首版 Electron；包体/内存问题显著再迁 |
| Q3 | monorepo 拆分（sim 单独发包） | 不需要；单 repo 即可，sim 包内部隔离足够 |
| Q4 | 内容表的 git diff 友好度 | 单文件 ≤ 100 条目；超出则按 tier 拆分文件 |
| Q5 | AI 跑 CI 的成本（GitHub Actions 分钟数） | 平衡 MC 仅夜间跑；headless 控场景数 |

---

## 参考资料

- [Phaser vs Pixi.js: Renderer vs Game Framework Comparison](https://generalistprogrammer.com/tutorials/phaser-vs-pixijs-renderer-comparison)
- [JS Game Rendering Benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Migrating to Zod 4: The Complete Guide](https://dev.to/pockit_tools/migrating-to-zod-4-the-complete-guide-to-breaking-changes-performance-gains-and-new-features-3ll0)
- [Zod JSON Schema docs](https://zod.dev/json-schema)
- [Why JSON Schema Is the Most Underrated Tool in Your Stack (2025)](https://peterhrynkow.com/ai/architecture/2025/02/01/schema-driven-platforms.html)
- [Charon — Game Development Data Modeling Tool](https://github.com/gamedevware/charon)
- [Data-Driven Design: Leveraging Lessons from Game Development](https://dev.to/methodox/data-driven-design-leveraging-lessons-from-game-development-in-everyday-software-5512)
- [Property-Based Testing with Vitest — fast-check](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/)
- [Deterministic Simulation Testing — Antithesis](https://antithesis.com/docs/resources/deterministic_simulation_testing/)
- [We built a living gang city sim — headless Monte Carlo regression (r/gamedev)](https://www.reddit.com/r/gamedev/comments/1uqxdj1/we_built_a_living_gang_city_sim_heres_the/)
- [Tauri vs Electron 2026 — tech-insider](https://tech-insider.org/tauri-vs-electron-2026/)
- [The Struggle of Packaging a JavaScript Game for PC](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript)
- [Tauri in 2026: Build Cross-Platform Desktop Apps](https://dev.to/ottoara/tauri-in-2026-build-cross-platform-desktop-apps-with-web-technologies-better-than-electron-11mo)
- [Game engines/frameworks with hot reload and fast iteration (r/gamedev)](https://www.reddit.com/r/gamedev/comments/1q0ggak/game_enginesframeworks_with_hot_reload_and_fast/)
