# 36 · 开源与工程资源第二轮调研（2026-09-17）

> 方法：WebSearch（外部搜索 API 当期限流，结论经内置知识 + WebFetch 仓库实证）
> + 最小探针实测。聚焦第一轮（docs/33）未覆盖的**工程资源角度**：性能测量库、
> CJK 字体工程、Sokoban 语料、Pixi 粒子生态。原则：避免过度造轮子，
> 同时避免为数十行自造代码引入失维护依赖。

## 一、四条线索与采纳判定

| 线索 | 来源/仓库 | 许可 | 判定 |
| ---- | -------- | ---- | ---- |
| web-vitals（Google 官方 CWV 库） | GoogleChrome/web-vitals v6.2.2 | Apache-2.0 | **RUM 场景采纳、实验室不采纳**（见 §二） |
| cn-font-split（中文网字计划） | KonghaYao/cn-font-split v7 | Apache-2.0 | **采纳为 backlog**（见 §三） |
| Boxoban 关卡数据集 | deepmind/boxoban-levels | Apache-2.0 | 不采用（见 §四） |
| @pixi/particle-emitter | pixijs/particle-emitter v5（v6 定位） | MIT | 不采用（见 §五） |

## 二、web-vitals：INP 直测试验与结论

**动机**：perf-audit 工具（docs/32 §24.1）的手搓 event-timing 采集在
headless Chromium 下取不到 interactionId 条目，INP 只能以 TBT 代理
（§24.6 口径）。web-vitals v3+ 的 attribution build 号称正确处理 INP
p98（input/processing/presentation 延迟分解 + LoAF）。

**试验过程**（Playwright + Chromium，全程实证）：
1. `pnpm add -D web-vitals@6.2.2`，IIFE 注入页面成功（`var webVitals`
   经 addInitScript 函数作用域可见，探针 `__registered=true`）；
2. `onINP` 注册成功；真实点击交互后等待——**回调永不触发**；
3. 最小探针（example.com + 动态按钮 + 点击 + 500ms 等待）复现：
   `{"hasGlobal":"undefined","registered":true}`（无 `__inp`）——
   本 headless Chromium 构建不产出带 interactionId 的 Event Timing
   条目，web-vitals 亦无从计算。**库选择不能绕过浏览器构建层限制**。

**判定**：
- **实验室审计工具不采纳**（依赖已移除，`pnpm remove web-vitals`）：
  在无头环境永不产出数据的依赖是治理负担；帧预算（rAF p95）+ TBT=0
  已覆盖响应性回归检测（§24.6/§24.7.1 实证）。
- **RUM 场景采纳待办**：未来若在应用内挂真实用户监测，web-vitals
  （attribution build）是标准答案——真实浏览器 Event Timing 完整，
  可同时补齐 docs/32 §24.6 挂起的「RUM 立项」与 INP 直测。

## 三、cn-font-split：CJK 字体分片（采纳为 backlog）

中文网字计划 v7，Rust 核心（Harfbuzz 绑定），Apache-2.0。把 CJK 字体
切成 unicode-range 分片 + CSS，浏览器按需下载实际用到的分片；
提供 `vite-plugin-font`（Vite 生态直配）与 CLI/库两种用法。

**对本项目的意义**：docs/32 §24.6 挂起的「字体 unicode-range 分片」
backlog 有了现成轮子——替代自研方案的完整路径：
1. `lxgw-wenkai` 完整 TTF（不在库内，subset-font.mjs 经 SRC_FONT 环境变量
   读取）→ cn-font-split 产出分片集；
2. `fontPreload.ts` 从「单 FontFace 文件 + await 全量」改为 CSS
   `@font-face` + `unicode-range`（浏览器只拉用到的分片），
   `display:'swap'` 语义保留；
3. 收益：移动 Slow4G 下字体载荷从 313KB 单文件降为按需分片
   （首屏 UI 字符集远小于全语料）；
4. 风险：历史教训「字体缺字→整站回退+文本溢出」（fontPreload.ts 注）——
   分片工具按字符全集切分（不按语料裁剪），覆盖风险低但需回归
   文本渲染测试。

**排期**：挂起待字体分片立项（依赖源字体获取），工具与插件选型已定。

## 四、Boxoban 数据集：不采用

DeepMind 出品（Guez et al. 2018），Apache-2.0，10×10 四箱 ASCII
谜面 90 万+，含 unfiltered/medium/hard 难度分层。**不采用**：
本项目 Sokoban 变体机制深度定制（光路折射/阵石/裂隙/灵草/步数预算），
Boxoban 谜面不承载这些语义；求解性能亦非瓶颈（哨兵 4 万节点与认证界
对齐，docs/32 §22）。记录在案的动机：若未来需要标准 Sokoban 求解器
基准，此数据集是现成外部语料。

## 五、@pixi/particle-emitter：不采用

MIT，但仓库定位 v6、官方未证 PixiJS 8 兼容（本项目为 v8）。
本项目粒子需求（spawnBurst 爆裂 + 推石反馈）为数十行自造代码且已满足
表现力；为引入失维护依赖替换自造代码违背「避免过度工程」原则。
若未来需要复杂粒子编排（雨/雪/火焰环境粒子），届时再评估 v8 生态新库。

## 六、结论

| 采纳 | 场景 | 触发条件 |
| ---- | ---- | -------- |
| web-vitals（attribution） | 应用内 RUM + INP 直测 | RUM 立项（docs/30 §六） |
| cn-font-split / vite-plugin-font | 字体分片 | 字体分片立项（需源 TTF） |
| Boxoban | 标准求解器基准 | 仅当出现求解性能需求 |
| @pixi/particle-emitter | 复杂粒子编排 | 仅当 v8 生态出现维护库且需求出现 |

**性能测量现状不变**：perf-audit 工具的 LCP/CLS/TBT 直采 + TBT(INP
代理) + 帧预算构成完整实验室口径；INP 直测与真实用户网络分布数据
同属 RUM 立项后的工作（docs/30 §六）。
