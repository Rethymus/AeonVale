# 38 · 开源与工程资源第五轮调研（2026-09-22）

> 方法：代码库缺口扫描（零 TODO 残留、覆盖率工具已在位、i18n 为 42 行
> 定制实现属合理规模）→ 选定两条未覆盖线索（测试质量度量、CI workflow
> 静态分析）→ WebFetch 仓库实证 + 本地试运行。原则同前四轮：采纳须可
> 验证收益，不采纳须留档证据。

## 一、两条线索与采纳判定

| 线索 | 来源/仓库 | 许可 | 判定 |
| ---- | -------- | ---- | ---- |
| StrykerJS 变异测试（含 Vitest runner） | stryker-mutator/stryker-js | Apache-2.0 | **当前环境不采纳**（试点证据见 §二） |
| actionlint（GitHub Actions 静态检查） | rhysd/actionlint | MIT | **已采纳**（一次性审计：全工作流零告警，见 §三） |

## 二、StrykerJS 变异测试：试点过程与不采纳判定

**动机**：1164 个测试的数量 ≠ 质量。变异测试（对被测代码注入微突变，
统计被测试杀死比例）是测试有效性的标准度量。项目核心资产
src/sim（确定性纯函数 + 1056 测试）是变异测试的理想对象。

**试点过程**（Apache-2.0，@stryker-mutator/core 10.0.0 +
@stryker-mutator/vitest-runner，官方 Vitest 插件自 v7 起支持）：

| 尝试 | 结果 |
| ---- | ---- |
| 1. scoped 到 beam.ts + buildCommand | 沙盒内 pnpm 符号链接的 typescript 不可见 → 移除 buildCommand（纯 TS 由 vitest 插件转译） |
| 2. pnpm 隔离布局下插件不可见 | `.npmrc` public-hoist `*@stryker-mutator*` + 重装 |
| 3. 显式 `plugins` 声明后 dry-run | 通过；但 `related:true` 找不到关联测试（测试经 barrel 导入 beam） |
| 4. `related:false` + 收窄 include | 管线跑通（170 变异体，3m21s）但 **score 0.00 假象**：vitest.stryker 配置缺 `@sim` 别名，6/8 测试文件加载失败，17 个无关测试通过——变异代码从未被执行 |
| 5. 补别名（对齐 vite.config.ts） | 81 测试全部加载 ✓；但 dry-run 超时/崩溃（全量 6 分钟 > Stryker 首轮容忍） |
| 6. timeout 15min + concurrency 2 | 仍快速失败，底层 vitest 进程崩溃（debug 日志未给出可行动信息） |

**不采纳判定**：四次修复揭出四层环境问题（pnpm 隔离布局 → 插件解析 →
沙盒 vitest 配置 → Windows 浅克隆 dry-run 不稳定），每层修复揭出下一层。
继续调优的边际成本远超「测得 beam.ts 一个文件的变异分数」的价值。

**重启条件**（满足其一）：仓库迁移 `node-linker=hoisted` 布局；或
Stryker 官方修复 pnpm workspace 解析。届时试点配置可直接复用
（本文档 §二记录了全部六次尝试的教训）。

**残余价值确认**：1164 测试已含快照/属性/黄金回放三层回归网；
test:fast 1164 全绿 + 变异分数未知 ≠ 无保护——只是保护强度未量化。

## 三、actionlint：已采纳（一次性审计）

MIT，活跃维护。静态检查 GitHub Actions：workflow 语法、`${{ }}`
expression 类型检查、action inputs 校验、**cron 语法**（正对本项目
perf-vertical 双 cron）、shellcheck 集成、脚本注入与硬编码凭证检查。

**结果**：对全部 6 个工作流（ci/pages/release/readme-media/m5-nightly
[已删]/perf-vertical）运行，**零告警**。已验证可执行命令：
`go install github.com/rhysd/actionlint/cmd/actionlint@latest` +
`actionlint`（仓库根目录）。未入 CI（引入需 Go 工具链或二进制下载步骤，
收益对 6 个简单工作流偏低）；perf-vertical.yml 的关键约束已由
github-workflows.test.ts 护栏断言锁死。

## 四、五轮调研台账汇总

| 轮次 | 文档 | 覆盖 | 采纳落地 |
| ---- | ---- | ---- | -------- |
| 一 | docs/33 | Sokoban 生态/PCG/确定性测试 | 文献锚定、死锁哨兵 |
| 二 | docs/35 | 修仙对标/顿悟机制/Web Audio | 绝缘玉封节点、HUD 计数、雷击空间音效 |
| 三 | docs/36 | web-vitals/cn-font-split/Boxoban/粒子 | perf-audit 方法论、TBT 勘误 |
| 四 | docs/37 | axe-core/pixi-filters/LXGW/Renovate | **a11y 回归门 + critical 修复** |
| 五 | docs/38（本篇） | 变异测试/CI 静态分析 | **actionlint 一次性审计通过** |

## 五、结论

- **StrykerJS**：质量度量方向正确，但当前 pnpm 隔离布局 + Windows
  沙盒下集成不稳定，不采纳并留档六次尝试证据与重启条件。
- **actionlint**：采纳为一次性审计（零告警），工作流关键约束已由
  护栏测试持续锁死。
- 项目处于设计稳态：性能监测（docs/32 §24）与无障碍门（docs/37）
  均已自动化；剩余事项为时点驱动（09-28 cron 第二周期）与真人门槛
  （docs/30 §六试玩、RUM 立项）。
