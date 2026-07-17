# 公开试玩体验救援实施计划

规格：`docs/superpowers/specs/2026-07-16-public-demo-experience-rescue-design.md`  
状态：执行中  
提交策略：用户未授权 commit；实施、验证和审查完成后保留工作树改动

## 工作单元与依赖

### WU-1：应用状态、UI 互斥与响应式布局基础

文件范围：

- `src/app/appFlowMachine.ts`
- `src/app/uiMode.ts`
- `src/render/viewportLayout.ts`
- `tests/unit/app-flow-machine.test.ts`
- `tests/unit/ui-mode.test.ts`
- `tests/unit/responsive-layout.test.ts`

完成定义：

- Title → Prologue → World → Alchemy → Tribulation → Aftermath → World 可由纯状态转换表达。
- overlay 返回和焦点恢复目标可追踪。
- 任意输入状态只派生一个主 UI surface。
- 桌面、横屏、竖屏门的区域、safe-area 和 44px 触控边界可单测。

依赖：无。可与 WU-2 并行。

### WU-2：语义输入与四段旅程视图模型

文件范围：

- `src/app/semanticInputRouter.ts`
- `src/app/journeyGuide.ts`
- `tests/unit/semantic-input-router.test.ts`
- `tests/unit/journey-guide.test.ts`

完成定义：

- 键盘、鼠标和触控适配到同一 `GameCommand`，不伪造 KeyboardEvent。
- 旅程视图模型始终只输出一个当前动作、一个动机、一个 CTA 和四段进度。
- 现有十步农务 objective 被归并为“获得灵草”阶段，不能再冒充四段完成。

依赖：无。可与 WU-1 并行。

### WU-3：响应式 DOM 外壳、竖屏门和语义镜像

文件范围：

- `index.html`
- `src/app/app.css`
- `src/app/responsiveShell.ts`
- `tests/unit/responsive-shell.test.ts`

完成定义：

- `viewport-fit=cover`、`100dvh`、safe-area 和加载/错误状态齐全。
- 390×844 竖屏隐藏游戏交互并显示可读旋转门。
- 横屏渲染真实 `button` 触控层，目标至少 44×44 CSS px。
- DOM 语义镜像暴露日期、资源、目标、动作、当前页面和结果反馈。
- 触控只调用 WU-2 的命令分发接口。

依赖：WU-1、WU-2。

### WU-4：世界优先 Pixi 分层与按需渲染

文件范围：

- `src/render/renderer.ts`
- `src/render/furnacePanel.ts`
- `src/render/renderScheduler.ts`
- `tests/unit/renderer-layout.test.ts`
- `tests/unit/render-clear-regression.test.ts`

完成定义：

- stage 明确分为 world、screenFx、HUD、focus、toast 和 touch/semantic adapter 层。
- 世界占主要视觉面积，右侧目标轨只显示一个动作和一个动机。
- story/task/panel/pause/ending 主覆盖层计数恒为 0 或 1。
- `setTextIfChanged()` 防止 ticker 每帧重栅格化文本。
- 瓦片、作物、NPC 和设施按 ID 复用显示对象，不再每帧完整 destroy/recreate。
- 粒子/闪光活动时连续刷新；静止状态只在状态、输入或布局变化时刷新。

依赖：WU-1。

### WU-5：主运行时整合与可见页面入口

文件范围：

- `src/app/main.ts`
- `src/app/interactionPanels.ts`
- `src/app/keybindings.ts`
- `tests/unit/keybindings.test.ts`
- `tests/unit/interaction-panels.test.ts`（若现有文件名不同则扩展现有对应测试）

完成定义：

- main 组合 WU-1 至 WU-4，不再新增布局常量或独立覆盖层布尔分支。
- 启动进入 Title；新游戏进入短 Prologue；继续读取存档后进入 World。
- 农庄、地点、背包、修行、炼丹和设置具有可见入口与返回行为。
- 键盘快捷键与触控都调用同一语义命令。
- `__AEON_DEBUG__` 增加版本号、构建修订、当前 flow/surface、布局边界和渲染计数，同时保留必要兼容字段。

依赖：WU-1、WU-2、WU-3、WU-4。

### WU-6：真实炼丹、教学天劫与战后结算

文件范围在实施前依据现有模拟边界细化，预期包含：

- 应用层 Alchemy/Tribulation/Aftermath 视图模型与页面渲染
- 必要的纯 sim 教学天劫状态/事件及对应单元测试
- starter/tutorial 资源与失败补偿测试

固定教学契约：

- 新档已有的雾苔草 3、露根草 2 只用于农务/基础炼丹，不足以炼制避雷丹。
- 公开纵切片需提供一次性“教学丹方”或明确补充金松/霜髓的空间奖励；不得静默改写正式避雷丹方。
- 炼丹失败至少补回一组教学材料，直到首枚教学备劫丹成功，防止软锁。
- 教学天劫使用固定 3 雷、明确预警、非永久死亡、有限淬体奖励，不提升正式境界。
- 完成/失败都进入 Aftermath；成功奖励只发一次并持久化旗标。

依赖：WU-5。若修改正式 sim 行为，先使用 `sim-invariant` 与 `golden-replay-update` 技能判断影响；不能为了绿测直接更新 replay。

### WU-7：体验测试与发布门禁

文件范围：

- `tests/browser/responsive-layout.spec.ts`
- `tests/browser/touch-flow.spec.ts`
- `tests/browser/public-demo-vertical-slice.spec.ts`
- `tests/browser/openGame.ts`
- `tests/browser/portfolio-capture.spec.ts`
- `playwright.config.ts`
- 发布预检与相应单测

完成定义：

- 新档桌面和横屏触控四段纵切片不调用 `__AEON_TEST__`。
- 横屏触控用真实 tap/pointer，不调用 `page.keyboard`。
- 竖屏→横屏保留存档与流程状态。
- 修复全部 `toBeVisible;`、`click;`、`hover;` 等未调用 API，并加入静态防复发检查。
- Pages 契约先核对 `debugSchemaVersion` 与 `buildRevision`，再运行远端纵切片。

依赖：WU-3 至 WU-6。

## 视觉截图矩阵

不生成完整 5×7=35 组合；使用以下 12 张高风险代表基准覆盖所有页面与设备契约：

| 编号 | 视口          | 页面/状态          |
| ---- | ------------- | ------------------ |
| 01   | 1440×900      | Title              |
| 02   | 1440×900      | World 新档第一动作 |
| 03   | 960×540       | World 紧凑桌面     |
| 04   | 1440×900      | Alchemy            |
| 05   | 1440×900      | Tribulation 雷预警 |
| 06   | 1440×900      | Aftermath          |
| 07   | 960×540       | Inventory          |
| 08   | 960×540       | Pause/Settings     |
| 09   | 844×390 touch | World + 触控层     |
| 10   | 736×414 touch | Alchemy 或主菜单   |
| 11   | 390×844       | 竖屏旋转门         |
| 12   | 844×390 touch | 旋转后恢复原流程   |

每张基准同时配套几何断言；像素快照不单独承担可访问性或可操作性证明。

## 验证顺序

每个工作单元：实现 → 针对性单测/类型检查 → 主线程审查。所有工作单元完成后统一运行：

1. `pnpm governance:check`
2. `pnpm typecheck`
3. `pnpm test`
4. `pnpm build`
5. 新增的 Playwright 响应式、触控、纵切片与视觉套件
6. 本地公开树验证（仅在前述门禁稳定后运行一次）

不执行 commit、push、部署或远端设置修改。
