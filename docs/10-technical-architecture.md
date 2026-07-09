# 10 · 技术架构（Technical Architecture）

> 本文件是工程的"宪法第二修正案"：在 `00-DESIGN-BRIEF.md` §7 的硬约束（C1–C7）之下，给出**语言、渲染、循环、范式、分层、确定性、输入/音频/性能/分发**的全部基础决策与权衡。
> 后续 `11-data-model.md`（数据模型）、`12-project-structure.md`（工程结构）、`13-asset-art-audio.md`（美术音频）、`17-testing-and-automation.md`（测试）都依赖本文档。
> **本文档只产出架构决策、分层图、流程与接口签名示意，不含可运行游戏源码。**

---

## 0. 决策摘要（TL;DR）

| 维度 | 决策 |
|------|------|
| **主语言** | **TypeScript（strict 模式）**，运行于 **Node.js / 浏览器 / Electron** |
| **次选（备胎）** | Rust + macroquad（仅当 TS 在峰值场景性能不达标时切换，见 §1.4） |
| **渲染** | **PixiJS v8（WebGL2，含 Canvas2D fallback）** —— 自研薄渲染适配层 |
| **游戏循环** | 固定时间步（fixed-timestep）= **30 TPS（逻辑）**，渲染独立解耦至 60–144 FPS，累加器 + 插值 |
| **架构范式** | **混合**：纯逻辑层用「扁平结构体 + 系统（system）函数」的**轻量 ECS 风格**；不用重型 ECS 框架 |
| **确定性** | 注入式种子化 PRNG（**Mulberry32 / xoshiro128**）+ 浮点纪律（**整数毫点 Q12.20** 用于经济/药性，比较走 ε 容差） |
| **测试** | Vitest + @fast-check/vitest（属性测试）+ 无头模拟 harness（详见 17） |
| **打包** | **Electron**（首版，成熟稳定），产物 Win/macOS/Linux（详见 12） |

> **一句话理由**：TypeScript 在「AI 可干净生成/验证」「自动化测试成熟度」「数据驱动内容管线（Zod + JSON Schema）」「跨平台分发（Electron）」四项 Vibe-Coding 关键指标上同时拿到高分；Rust 在确定性与性能上略胜但 AI 生成失败率显著更高且单人维护成本陡增，**不值得为 2D 像素级负载付出**。

---

## 1. 语言与技术栈决策矩阵

### 1.1 评分维度（权重反映本项目优先级）

| # | 维度 | 权重 | 说明 |
|---|------|------|------|
| D1 | Vibe-Coding / AI 友好度 | **★★★★★** | AI 生成正确率、上下文窗口友好度、错误可定位性、社区语料密度 |
| D2 | 自动化测试成熟度 | **★★★★★** | 单测/属性测试/无头模拟/CI 集成（C4） |
| D3 | 2D 性能 | ★★★ | 像素级瓦片 + 上百同屏实体 + 粒子，远未触及 3D 瓶颈 |
| D4 | 确定性可控性 | ★★★★ | 种子化 PRNG、浮点可控、跨平台可复现（C3） |
| D5 | 分发与跨平台 | ★★★★ | 桌面三平台，安装包体积（C1） |
| D6 | 生态与库 | ★★★ | 渲染/输入/音频/schema/测试库的成熟度 |
| D7 | 单人维护成本 | **★★★★★** | 一人 + AI，依赖、构建、调试都要简单 |

### 1.2 评分表（0–5 分，加权 = Σ维度分 × 权重归一）

| 语言 | D1 AI友好 | D2 测试 | D3 2D性能 | D4 确定性 | D5 分发 | D6 生态 | D7 维护 | **加权** |
|------|-----------|---------|-----------|-----------|---------|---------|---------|----------|
| **TypeScript** | **5** | **5** | 4 | 3.5 | 4 | 5 | 5 | **4.61** ★推荐 |
| Rust | 3 | 4 | 5 | **5** | 4 | 3.5 | 2 | 3.46 |
| C++ | 2 | 3 | 5 | 4 | 3 | 4 | 1.5 | 2.86 |
| C# (.NET) | 3.5 | 4 | 4.5 | 4 | 3.5 | 4 | 3 | 3.74 |
| Go | 3 | 3.5 | 2.5 | 4 | 4 | 3 | 3.5 | 3.23 |
| Python | 4 | 4 | 2 | 3 | 2 | 4 | 4 | 3.40 |

### 1.3 推荐：**TypeScript（strict）** —— 理由

1. **D1 Vibe-Coding 友好度第一**：TypeScript 是当前 LLM 训练语料最密集的语言之一，AI 生成正确率与可定位错误信息（带类型签名）显著优于 Rust/C++。类型系统充当"AI 的实时校验器"——错配立刻红线，无需运行。
2. **D2 自动化测试最成熟**：Vitest + @fast-check/vitest 提供工业级的属性测试；fast-check **本身即种子化、可复现**，与 C3 天然契合。无头模拟仅是 `node` 跑 `sim` 包，零额外基础设施（C4）。
3. **D6 数据驱动内容管线（C6）最佳**：Zod v4 原生支持 JSON Schema 转换；灵草/丹方表既可以是 `.json` 也可以是 `.ts` 数据模块（带类型）；热重载通过 Vite 即开即用。
4. **D7 单人维护成本最低**：单一工具链（pnpm + Vite + Vitest + tsc），无跨编译、无链接器、无 borrow-checker 调试。
5. **D5 分发**：Electron 包体偏大（~80–120MB），但对桌面单机游戏完全可接受；后续若需要轻量化可迁移到 **Tauri 2.x**（Rust 后端 + WebView，包体 ~10MB），代价是引入 Rust 工具链。

**唯一硬伤：D4 确定性**。JS 引擎的 IEEE 754 双精度浮点本身是确定性的（同引擎同操作顺序），但跨 V8/SpiderMonkey/JSCore 不保证（FMA 优化、操作重排）。**对策在 §6**：用种子化 PRNG（`Math.random()` 禁止进入模拟层）+ 关键经济/药性数值用整数毫点（Q12.20）+ 容差比较。在"单平台 Electron 内同版本 V8"的约束下，确定性回放是可达的，本项目不需要跨架构 lockstep。

### 1.4 次选：**Rust + macroquad**（不放弃，留备胎）

**何时切换**：若性能剖析显示 30 TPS 下天劫峰值（>500 雷实例 + 粒子 + 上千瓦片）在 V8 中持续超过 12ms / tick，且优化无解。

**为何 Rust 而非 C++/C#**：`rand` crate 提供跨平台确定性 PRNG（ChaCha8Rng）；macroquad 是为 2D 游戏设计的极简库（~API 表面积小，AI 友好度高于 wgpu 裸写）；内存安全避免 C++ 一类段错误调试地狱。

**为何不默认选 Rust**：
- AI 生成 Rust 的失败率显著高于 TS（borrow checker、生命周期、异步运行时选择）；
- 单人维护两套工具链（cargo + 内容 schema 工具）成本高；
- 2D 像素负载不足以让 Rust 的性能优势兑现成体验差异。

### 1.5 明确放弃的语言与理由

- **C++**：无 GC + 模板 + 手动内存 = AI 失败率最高，单人维护噩梦。性能对 2D 过剩。
- **C# (.NET)**：生态成熟但脱离 Unity 后的纯 .NET 桌面游戏分发链路（AOT、自包含）对 AI 生成不友好；语言本身没显著优于 TS。
- **Go**：2D 渲染生态薄弱（raylib-go 是绑定，非一等公民），泛型历史包袱，不适合游戏循环。
- **Python**：性能（GIL + 解释）撑不起 30 TPS 的实时模拟；分发（PyInstaller）痛苦。仅可作为内容表生成的脚本工具。

---

## 2. 渲染方案

### 2.1 选型：**PixiJS v8（WebGL2 主路径，Canvas2D fallback）**

| 方案 | 用途 | 优点 | 缺点 | 结论 |
|------|------|------|------|------|
| **PixiJS v8** | 主渲染层 | WebGL2 批渲染、~200KB、精灵池、滤镜（墨晕/抖动）、有 tilemap 插件 | 抽象层有学习曲线 | **选** |
| Canvas2D 原生 | fallback | 零依赖、可读 | 上千精灵会掉帧 | 仅作降级 |
| Phaser 3 | 框架 | 自带物理/动画/Tilemap | 是"框架"非"库"，强加架构；与 C2 模块清晰原则相悖 | 不选 |
| WebGL 裸写 | 极致性能 | 完全可控 | 工程量大、AI 易错 | 不选 |
| Three.js | 3D | — | 对 2D 过重 | 不选 |

**为何 PixiJS 而非 Phaser**：Phaser 是「框架」强加场景树/物理/输入模型，与我们的「自研薄引擎层 + 纯逻辑 sim」架构冲突（见 §5）。PixiJS 是「渲染库」，只管画，不侵入逻辑层，依赖方向干净。参考 [Phaser vs Pixi.js 比较](https://generalistprogrammer.com/tutorials/phaser-vs-pixijs-renderer-comparison)。

### 2.2 渲染分层实现

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (表现层)                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐         │
│  │ TileLayer  │  │ EntityLayer│  │ FXLayer    │ ← 粒子/雷│
│  │ (瓦片/阵法)│  │ (玩家/作物/│  │ (墨晕/闪电)│         │
│  │            │  │  妖兽/丹炉)│  │            │         │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘         │
│        └────────────────┴────────────────┘               │
│                          ↑ draw(state, alpha)            │
│  ┌─────────────────────────────────────────┐             │
│  │       UILayer (HUD/倒计时/丹炉面板)      │             │
│  └─────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────┘
```

- **TileLayer**：用 `@pixi/tilemap`（或自建 mesh）批量绘制瓦片，单 draw call 出整张地图。瓦片数预算 §9。
- **EntityLayer**：精灵池（`ParticleContainer`/`SpritePool`），帧动画通过精灵表（spritesheet）索引。
- **FXLayer**：雷劫用粒子 + 自定义着色器（WebGL shader 实现「抖动 + 辉光 + 分叉」效果，纯代码可控、零美术依赖，呼应 C7）。
- **UILayer**：DOM 不参与游戏内 UI（性能 + 风格统一）；用 PixiJS 的 `Graphics`/`Text` 绘制 HUD/倒计时/丹炉面板。可选 `@pixi/ui` 加速。

### 2.3 性能预算（渲染侧）

- 目标：**60 FPS @ 1080p**，谷底帧不低于 30 FPS（天劫峰值）。
- 同屏精灵峰值：瓦片 ~1500（30×50 可视区）+ 实体 ~200 + 粒子 ~1500（雷劫）≈ 3200。
- PixiJS v8 在桌面 WebGL2 下，5k 精灵可稳 60 FPS（见 [JS Game Rendering Benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)），预算有余量。

---

## 3. 游戏循环（Game Loop）

### 3.1 模式：固定时间步 + 累加器 + 渲染插值

经典 Gaffer "Fix Your Timestep" 模式（参考 [Gaffer On Games](https://gafferongames.com/post/fix_your_timestep/)）。**为何此模式对 C3/C4 至关重要**：

1. **逻辑确定性**：update 永远以固定 `dt` 推进，结果与机器无关，可重放。
2. **无头测试**：测试不依赖 `requestAnimationFrame`，直接 `for (i=0; i<N; i++) sim.step(input[i])`。
3. **渲染平滑**：插值用累加器余数，不影响逻辑。

### 3.2 步长选择

| 频率 | 用途 | 理由 |
|------|------|------|
| **30 TPS**（dt=1/30s≈33.33ms） | 主逻辑步（种田/丹炉/天象/雷移动） | 种田/炼丹是慢节奏，30 够用；塔防雷移动虽急但插值补足视觉平滑 |
| **10 TPS** | 「慢逻辑」子步（天象周期、季节、NPC AI 决策） | 进一步降本 |
| **60–144 FPS** | 渲染（独立） | 跟随显示器 |

> 天劫塔防期的「快速操作」（玩家布阵）通过**输入缓冲 + 即时响应（input 预测）** 而非提高 TPS 实现：玩家点击的「放置阵法」立即乐观渲染，下一逻辑步确认。避免 30→60 TPS 的运行时切换破坏确定性。

### 3.3 循环骨架（伪代码示意，非实现源码）

```ts
// 接口签名示意
interface GameLoop {
  readonly sim: Simulation;        // 纯逻辑
  readonly renderer: Renderer;     // 表现层
  readonly inputQueue: InputQueue; // 缓冲输入
  readonly accumulator: number;    // 累加器
  readonly STEP: 1 / 30;           // 固定步长
  start(): void;
  halt(): void;                    // 无头模式可立即停
}

// 每帧：
//   accumulator += realDelta;
//   while (accumulator >= STEP) {
//     sim.step(inputQueue.drain(STEP));   // ← 纯函数推进，可被测试替换
//     accumulator -= STEP;
//     if (spiralOfDeathGuard()) clamp();  // 防死亡螺旋
//   }
//   renderer.draw(sim.snapshot(), accumulator / STEP); // alpha 插值
```

**死亡螺旋防护**：累加器上限 5 步（~166ms），超出则丢弃剩余——宁可掉帧不可雪崩。

### 3.4 无头模式

无头 harness 完全绕过 `GameLoop`/`requestAnimationFrame`：

```ts
// 测试/CI 路径
for (let i = 0; i < TICKS; i++) sim.step(recordedInputs[i]);
expect(sim.snapshot()).toEqualReplay(expectedSnapshot); // 容差比较
```

详见 `17-testing-and-automation.md`。

---

## 4. 架构范式：ECS vs OOP vs 混合

### 4.1 实体规模评估

| 场景 | 实体数 | 复杂度 |
|------|--------|--------|
| 平时种田 | 瓦片 ~1000 + 作物 ~50 + 玩家 1 | 低 |
| 天劫峰值 | 上述 + 雷 ~500 + 阵法 ~30 + 妖兽 ~20 + 粒子(渲染侧)~1500 | 中 |
| 上限 | < 3000 模拟实体 | 远未到 ECS 性能必要性门槛 |

**结论**：我们**不需要** Bevy/hecs/Specs 这类高性能 ECS 框架（参见 [Rust ECS 比较](https://www.reddit.com/r/rust_gamedev/comments/x75eo9/ecs_comparison/)——它们的性能优势在 10 万实体级才显现，且 TS 生态的 ECS 库如 Becsy/bitecs 虽快但增加抽象债）。

### 4.2 推荐：**混合「扁平结构体 + 系统函数」（轻量 ECS 风格）**

- **实体**：仅是一个 `number` ID（或字符串 ID）。
- **组件**：扁平的 typed-array 友好的结构体（如 `Tile[]`、`CropInstance[]`、`Lightning[]`），存在 `World` 中。
- **系统**：纯函数 `(world, input, rng) => world`，按固定顺序在 `sim.step()` 内调用：`farmSystem` → `alchemySystem` → `celestialSystem` → `tribulationSystem` → `progressionSystem`。

**为何不用全 OOP 继承**：继承树在「同一实体兼具多种行为」（如带导电性的灵草瓦片同时是阵法节点）时变成菱形地狱。组合优于继承。

**为何不用全 ECS 框架**：抽象成本、AI 生成时的「查询 DSL 学习债」、调试栈过深。扁平结构体 + 函数 = 最易 AI 生成与可读调试。

### 4.3 C4 落地：逻辑层纯函数化、无渲染依赖

**硬规则**：
1. `sim/` 包**禁止** `import` 任何 `render/`/`pixi.js`/`DOM`。ESLint 规则强制（`no-restricted-imports`）。
2. `sim.step()` 是纯函数：`(state, input, rngStreams) => newState`。无副作用、无 IO。
3. 所有「派生表现」（坐标插值、动画帧、粒子生成）在 `render/` 层从 `sim.snapshot()` 推导。
4. 时间不进 sim：禁止 `Date.now()`/`performance.now()`/`Math.random()`，全部由参数注入。

---

## 5. 模块/分层架构

### 5.1 分层图（ASCII）

```
┌──────────────────────────────────────────────────────────────────┐
│  tests/   (Vitest + fast-check + 无头模拟 + 平衡回归)               │
│      │  imports sim only                                          │
│      ▼                                                            │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  src/sim/  核心模拟层 (PURE, no IO, no rendering)          │    │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────┐ ┌─────────┐ │    │
│  │  │ farm/      │ │ alchemy/ │ │ celestial/ │ │ tribulat│ │    │
│  │  │ crop/tile/ │ │ furnace/ │ │ events/    │ │ lightning│ │    │
│  │  │            │ │ recipe/  │ │ causes/    │ │ array/   │ │    │
│  │  └────────────┘ └──────────┘ └────────────┘ └─────────┘ │    │
│  │  ┌────────────┐ ┌──────────┐ ┌────────────────────────┐ │    │
│  │  │progression/│ │economy/  │ │ world/  GameState根     │ │    │
│  │  │stages/经脉 │ │storage/  │ │ rng/    注入式 PRNG     │ │    │
│  │  └────────────┘ └──────────┘ └────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
│          ▲                                       ▲               │
│          │ reads via snapshot (read-only)         │ reads        │
│  ┌───────┴──────────────┐              ┌──────────┴──────────┐  │
│  │  src/render/  表现层   │              │  src/content/       │  │
│  │  PixiJS适配/精灵/粒子/ │              │  数据驱动内容(只读)  │  │
│  │  UI/动画/插值/着色器   │              │  herbs/recipes/...  │  │
│  └──────────────────────┘              └─────────────────────┘  │
│          ▲                                       ▲               │
│  ┌───────┴──────────────┐              ┌──────────┴──────────┐  │
│  │  src/io/  桥接层       │              │  tools/              │  │
│  │  input/audio/savefile │              │  内容校验/批量生成    │  │
│  │  electron主进程       │              │  平衡蒙特卡洛         │  │
│  └──────────────────────┘              └─────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                            （依赖方向：向上单向，禁反向）
```

**依赖硬规则**：
- `sim` ← `tests`、`render`、`io`、`tools`（被依赖，自身不依赖任何上层）。
- `render`、`io`、`tools` 可读 `sim` + `content`，**禁止互相依赖**（除非通过 `sim` 提供的事件接口）。
- `content` 是纯数据，可被任何层只读引用。

### 5.2 各层职责

| 层 | 职责 | 不允许做 |
|----|------|----------|
| **sim** | 推进世界状态、计算机制、产出事件 | IO、DOM、渲染、读取系统时钟 |
| **render** | 把 `sim.snapshot()` 转成画面、播放动画 | 改写世界状态、做游戏决策 |
| **content** | 静态数据表（灵草/丹方/奇遇/物品定义） | 包含运行时状态 |
| **io** | 输入采集、音频播放、存档读写、Electron IPC | 业务逻辑 |
| **tests/tools** | 验证、剖析、内容生成、平衡扫描 | 进入生产产物 |

---

## 6. 确定性策略（C3 落地）

### 6.1 三层确定性

| 层级 | 含义 | 我们的目标 |
|------|------|-----------|
| L1 单机可复现 | 同种子 + 同输入 → 同结果 | **必须**（测试要求） |
| L2 跨版本可复现 | 同版本号 build 之间可复现 | **争取**（CI 回放对比） |
| L3 跨架构可复现 | V8 vs JSCore 一致 | **不追求**（Electron 锁 V8，足够） |

### 6.2 种子化 PRNG 注入点

- **算法**：`Mulberry32`（速度快、统计够用、TS 实现简单）作为默认；**xoshiro128++** 作为可替换的更强选项。
- **封装**：`Rng` 类，构造时注入 `seed: number` 或 `seedStr: string`（字符串经 hash 转 u32）。
- **禁令**：ESLint `no-restricted-globals` 禁用 `Math.random`；`Date.now`/`performance.now` 仅允许 `io` 层使用。
- **测试钩子**：`sim.createWorld({ seed })` 即可确定性复现整个世界。

### 6.3 RNG 流（stream）分段

参考 Factorio / Spelunky 的做法：**每个独立随机子系统用自己的子种子**，调参一处不影响其他。

```ts
interface RngStreams {
  readonly world: Rng;            // 地图生成
  readonly lightning: Rng;        // 雷落点
  readonly alchemy: Rng;          // 炸炉判定
  readonly celestial: Rng;        // 天象事件
  readonly beast: Rng;            // 妖兽行为
  readonly drop: Rng;             // 掉落
}
// 派生：const streams = deriveStreams(masterSeed);
// 每个流独立推进，互不干扰
```

**价值**：平衡测试时只重播种 `lightning` 不影响其他变量，单变量分析。

### 6.4 浮点纪律

参考 [Bruce Dawson: Floating-Point Determinism](https://randomascii.wordpress.com/2013/07/16/floating-point-determinism/) 与 [Gaffer: Floating Point Determinism](https://gafferongames.com/post/floating_point_determinism/)。

| 数值类别 | 表示 | 理由 |
|---------|------|------|
| 经济（金币、灵气量） | **整数**（基础单位 = 10⁻³ 灵气） | 经济无需小数 |
| 药性向量（寒热温平） | **整数毫点 Q12.20** 或 0–1000 整数 | 比较与求和不漂移 |
| HP / 修为 | 整数 | 离散刻度即可 |
| 物理坐标（雷/妖兽移动） | **浮点（double）**，但每 tick 内仅做线性插值；比较走 ε=1e-6 | 容忍 V8 内一致即可 |
| 概率比较 | `rng.next() < p`，p 用 0–65535 整数 | 避免 0.1+0.2 陷阱 |

**比较函数**：`approxEq(a, b, eps=1e-6)` 用于断言；存档里浮点字段保留 6 位小数四舍五入。

### 6.5 回放（Replay）设计

- **最小回放单元**：`{ masterSeed, version, inputs[] }`。
- **inputs[]** 是用户每 tick 的输入帧（按键、点击坐标的离散化）。
- 重放：`const world = createWorld({seed: replay.seed, version: replay.version}); for (const i of replay.inputs) world.step(i);`
- **存档 vs 回放**：存档是完整 `GameState` 快照（含派生态）；回放是「种子+输入」的极简形式，用于测试与平衡回归。

---

## 7. 状态管理

### 7.1 World / GameState 聚合根

详见 `11-data-model.md`。此处只给架构角色：

- `GameState` 是**单一聚合根**，包含所有可变状态。
- 修改路径只有一条：`sim.step(state, input, rng)` → 返回新 state（或原地变更 + 显式 `mutation log`，性能取舍见下）。

### 7.2 不可变 vs 原地变更

**推荐：原地变更 + 事件日志（mutation events）**
- 理由：30 TPS 下深拷贝整个 World 成本太高（上千瓦片）。
- 妥协：sim 内部可原地改，但每次 step 结束产出 `events: GameEvent[]`（雷落、炸炉、收获、突破…），render 层订阅事件驱动动画。
- 快照：定期 `serializeState(state)` 落盘，避免每次都序列化。

### 7.3 快照用途

| 场景 | 形式 |
|------|------|
| 存档 | 完整 `GameState` JSON（含派生态） |
| 测试断言 | 关键字段子集 + 容差比较 |
| 平衡回归 | `hash(canonicalSerialize(state))` 比对期望哈希 |
| 回放 | 仅存 `seed + inputs[]`（极小） |

---

## 8. 输入/控制方案

### 8.1 输入抽象层

```ts
interface InputFrame {
  readonly tick: number;            // 哪个逻辑步
  readonly keys: ReadonlySet<KeyCode>;
  readonly mouse: { x: number; y: number; buttons: number };
  readonly actions: PlayerAction[]; // 离散化后的高级动作
}
```

- `io/input.ts` 把 DOM/键盘事件 → `InputFrame` 入队。
- 测试可**直接构造** `InputFrame[]` 注入 sim，无需真实输入。

### 8.2 键鼠映射（塔防期快速操作）

| 操作 | 平时 | 塔防期 |
|------|------|--------|
| 移动光标 | WASD/方向键 | 同左 |
| 选择工具 | 1–9 数字键 | 同左（数字键切阵法类型） |
| 放置/使用 | 鼠标左键 | 鼠标左键（拖拽连放） |
| 取消 | 右键/Esc | 同左 |
| 暂停 | P | **禁用**（塔防期不可暂停） |
| 加速 | - | 不提供（破坏确定性回放） |

**塔防期优化**：
- 「拖拽连放」：按住左键拖动 = 在每个穿越瓦片上执行放置（如布绝缘阵）。
- 快捷栏 1–9 + Q/E 翻页。

### 8.3 无障碍

- 完全键盘可玩（鼠标仅辅助）。
- 详见 `13-asset-art-audio.md` §可访问性。

---

## 9. 性能预算

| 资源 | 预算 | 备注 |
|------|------|------|
| 目标帧率 | 60 FPS（渲染） | 谷底 ≥30 FPS |
| 逻辑步长 | 30 TPS | 单步预算 ≤ 25ms |
| 瓦片同屏 | ≤ 1500 | 30×50 可视区，相机裁剪 |
| 模拟实体峰值 | ≤ 3000 | 含雷/妖兽/作物 |
| 粒子峰值（渲染） | ≤ 2000 | PixiJS `ParticleContainer` |
| 内存 | ≤ 512MB | Electron 基线 ~150MB + 游戏 |
| 包体 | ≤ 150MB | 含 Electron 运行时 + 资产 |

**预算护栏**：CI 跑「压力场景回放」（最大天劫），断言单 tick ≤ 25ms；超出即 fail。

---

## 10. 音频架构

### 10.1 技术栈：**Web Audio API**

- **为何**：浏览器原生、零依赖、可程序化合成（呼应 C7 程序化优先）、Tone.js 可选作高级序列。
- 不依赖音频文件初始：SFX（雷/炸炉/UI）可全合成（振荡器 + 噪声 + 滤波）；BGM 走极简 MIDI-like 序列或短循环样本。

### 10.2 分层

| 层 | 内容 | 触发 |
|----|------|------|
| **BGM-A**（慢/治愈） | 古琴/笛/环境 pads | 平时 + 缓解态 |
| **BGM-B**（急/紧张） | 鼓点/低频脉冲 + 不和谐音 | 天劫倒计时归零前 30s |
| **SFX** | 雷/炸炉/收获/UI 点击/种田 | 事件驱动（订阅 sim events） |
| **Stinger** | 突破成功/失败/飞升 | 关键叙事节点 |

**慢→急切换**：天劫倒计时 ≤ 30s 时，BGM-A 渐弱（500ms 淡出）+ BGM-B 渐入；劫后反向。音频信号本身强化 §3 设计支柱的张力曲线。

### 10.3 程序化合成示例（接口示意）

```ts
interface AudioEngine {
  playSfx(id: SfxId): void;             // 雷/炸炉/UI
  setBgmMode(m: 'calm' | 'tense'): void;
  // 内部用 OscillatorNode + GainNode + Filter 合成
}
```

详见 `13-asset-art-audio.md`。

---

## 11. 构建/分发概览

> 细节在 `12-project-structure.md`。此处只给架构层结论。

| 平台 | 方案 | 包体 |
|------|------|------|
| Windows x64 | Electron + electron-builder (NSIS) | ~120MB |
| macOS (Universal) | Electron + dmg | ~140MB |
| Linux x64 | Electron + AppImage/deb | ~110MB |

**未来路径**：若需轻量，迁移至 **Tauri 2.x**（WebView + Rust 后端），包体降至 ~15MB；代价是引入 Rust 工具链与 WebView 跨平台一致性测试。仅当 Electron 包体成为发布阻碍时执行。

**Web 试玩版**：纯 TS + PixiJS 可直接部署 itch.io / GitHub Pages 作为 demo（无 Electron），有商业价值。

---

## 12. 开放问题（待拍板）

| # | 问题 | 备选 | 倾向 |
|---|------|------|------|
| Q1 | **主语言最终选择** | TS（默认） / Rust 备胎 | **TS**，Rust 仅作性能不达标时的逃生通道 |
| Q2 | **Electron vs Tauri** | Electron（稳）/ Tauri（轻） | 首版 Electron，包体问题再迁 |
| Q3 | **ECS 框架 vs 裸结构体** | Becsy/bitecs / 裸结构体 + 函数 | 裸结构体（除非实体规模失控） |
| Q4 | **逻辑层不可变 vs 原地** | 不可变（强可测）/ 原地 + 事件 | 原地 + 事件日志（性能） |
| Q5 | **浮点策略严格度** | 全整数毫点 / 浮点 + ε | 经济/药性用整数毫点，物理用浮点+ε |

---

## 13. 中文化与本地化 (i18n / CJK 字体 / IME) — `00` C8 落地

> 本游戏**全程中文（zh-CN）**，面向国内市场（`00` C8；`20` D-25）。纯代码无引擎架构下，中文化有三个工程关键点：**字符串外化、CJK 字体渲染、中文输入法**。本节给出可落地方案。

### 13.1 字符串外化（i18n 键值层）
- 一切可见文本走 **i18n 键**，**禁止**硬编码中文字符串进 `sim`/`render` 逻辑（C2 + C8）。
- 方案：扁平 JSON locale（`src/content/locales/zh-CN.json`），键如 `ui.tribulation.countdown`、`pill.ward-basic.desc`、`event.qi-tide.title`、`tutorial.day1.till`。库选 `i18next` 或自写轻量 map（项目规模下自写 ~50 行即够，零依赖）。
- 默认 locale = `zh-CN`；预留 `en` 槽位以便未来扩展（`20` D-25 允许，不阻塞）。
- 内容表（`15`）的 `displayName`/`description` 直接存中文；UI 标签/对话/教程/事件文案走 locale 键。Zod schema 同时校验 locale 文件（键完备性）。

### 13.2 CJK 字体（最关键工程点）
PixiJS/WebGL 渲染中文与拉丁文不同——必须显式处理，否则首屏"豆腐块"(tofu)：
- **选型**：**霞鹜文楷 LXGW WenKai**（开源 OFL，楷体，契合水墨/丹青美学 `13`）作正文/对话/叙事；**思源黑体 Source Han Sans** 作 HUD/数字/倒计时（清晰、等宽感）。两者均 OFL，可随开源项目自由分发（C9）。
- **渲染方式**：① **MSDF/Bitmap 字体**（`msdf-bmfont` 生成，GPU 批渲染性能最佳，但 CJK 字数多需分页/按需加载，复杂）；② **Canvas `FontFace` 动态加载**（实现简单，PixiJS `Text`/`BitmapText` 直接用，适合首版）。**首版推荐 ②**，性能瓶颈再迁 ①。
- **预加载铁律**：首帧渲染前 `document.fonts.load('1em LXGW WenKai')` 完成，否则中文先闪方块。
- **体积**：完整 CJK 字体 5–15MB；**子集化**（仅打包常用 3500 字 + 游戏专有字，用 `fonttools`/`subset-font` 离线生成）或运行时按需子集。开源整包分发亦可接受（纳入 `assets/fonts/`）。
- **排版**：中文标点全角；CJK 行首禁则（句号/逗号不出现在行首）；HUD 数字可用拉丁数字+等宽。

### 13.3 中文输入法（IME）合成
玩家文本输入（存档名、角色自定义名）需 IME 合成（拼音候选框）：
- Canvas 内直接处理 IME 较麻烦——**推荐隐藏 DOM `<input>` 覆盖层**捕获 `compositionstart`/`compositionupdate`/`compositionend`，再把合成结果同步到 PixiJS 文本显示。Electron 下原生支持，跨平台一致。
- 约束：名字长度（如 ≤ 6 汉字）；可选敏感词过滤（国内合规）。

### 13.4 本地化格式
- 日期：`第 N 日 · 春 · 第 Y 年`（游戏化，非 ISO）。
- 货币：`灵石 ×N`（整数，无小数）。
- 序数/量词：中文习惯（"第一阶·淬皮"、"三株寒髓草"）。

### 13.5 可访问性与中文阅读
- 最小字号比拉丁文大一档（中文笔画密，等效 ≥ 16px）；行高 ≥ 1.5；文本缩放可访问性选项（`04` §8）。

### 13.6 开放子问题
| # | 问题 | 倾向 |
|---|------|------|
| L1 | 自写 i18n map vs i18next | 首版自写（零依赖），内容膨胀再迁 i18next |
| L2 | 字体整包 vs 子集化 | 首版整包（简单），发布前子集化压体积 |
| L3 | 是否做竖排文本（卷轴/楹联美学） | post-MVP（增美术张力，非必需） |

---

## 参考资料

- [Fix Your Timestep! — Gaffer On Games](https://gafferongames.com/post/fix_your_timestep/)
- [Taming Time in Game Engines (2025) — André Leite](https://andreleite.com/posts/2025/game-loop/fixed-timestep-game-loop/)
- [Floating-Point Determinism — Bruce Dawson](https://randomascii.wordpress.com/2013/07/16/floating-point-determinism/)
- [Floating Point Determinism — Gaffer On Games](https://gafferongames.com/post/floating_point_determinism/)
- [Cross-Platform RTS Synchronization and Floating Point Indeterminism — Game Developer](https://www.gamedeveloper.com/programming/cross-platform-rts-synchronization-and-floating-point-indeterminism)
- [Phaser vs Pixi.js Renderer Comparison](https://generalistprogrammer.com/tutorials/phaser-vs-pixijs-renderer-comparison)
- [JS Game Rendering Benchmark](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [ECS Comparison (r/rust_gamedev)](https://www.reddit.com/r/rust_gamedev/comments/x75eo9/ecs_comparison/)
- [Is game development in Rust one big mirage? (r/rust)](https://www.reddit.com/r/rust/comments/1mw8k2g/is_game_development_in_rust_one_big_mirage/)
- [Game Dev Without An Engine: The 2025/2026 Renaissance — SitePoint](https://www.sitepoint.com/game-dev-without-an-engine-2025-2026/)
- [Property-Based Testing with Vitest — fast-check](https://fast-check.dev/docs/tutorials/setting-up-your-test-environment/property-based-testing-with-vitest/)
- [Deterministic Simulation Testing — Antithesis](https://antithesis.com/docs/resources/deterministic_simulation_testing/)
- [Audio for Web Games — MDN](https://developer.mozilla.org/en-US/docs/Games/Techniques/Audio_for_Web_Games)
- [Developing game audio with the Web Audio API — web.dev](https://web.dev/articles/webaudio-games)
- [Tauri vs Electron 2026 — tech-insider](https://tech-insider.org/tauri-vs-electron-2026/)
- [The Struggle of Packaging a JavaScript Game for PC](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript)
