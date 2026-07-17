# 视觉身份 Wave 计划 · portfolio-visual-identity

> 由 2026-07-17 线上玩家视角深度核查驱动。分级推进、自动化无监管开发。
> 依据：`portfolio-visual-gap` 记忆 + `/tmp/aeon-player-audit/` 截图证据。
> 红线：sim 层零改动（确定性/回放不变）；只动 render/app/content(io) 表现层；每级过全套门禁。

## 分级原则
- **T0**：访客前 60 秒必见的"常驻可见层"，性价比最高，零/低新美术风险。先做。
- **T1**：招牌时刻可视化（炼丹/天劫/突破），把修仙差异化"卖"出来。
- **T2**：打磨与深度（精灵升级、季节色调、内容厚度），作品集达标后按月扩。

每级 DoD = `pnpm governance:check` + `pnpm typecheck` + `pnpm test`(至少 unit/property/replay) + `pnpm build` + `pnpm test:browser:smoke` 全绿；视觉项额外 `pnpm portfolio:capture` 截图前后对比。

## T0 · 首印抢救（feat/visual-identity-wave-v1）
- [ ] **T0-1 标题屏视觉身份**（命中 🔴-1）：标题层加程序化水墨纵深背景（宣纸→远山→苔青渐变 + 远山剪影 + 飘雾粒子，纯 CSS/Canvas，零新 PNG，尊重 reduced-motion）；裸红方块"永"替换为已公开 `logo-emblem`；版本行收掉裸 sha（只留"试玩构建"，sha 进 title 属性/控制台）；logo 轻呼吸。
- [ ] **T0-2 世界"地点感"最小集**（命中 🔴-2）：`drawWorld` 程序化加农舍剪影、木栅栏、点景树、小径、池塘波光、远山黛地平线（全用 `palette.ts` 16 色，零新 PNG，不动 sim）。目标：落地是"山谷"不是"棋盘"。
- [ ] **T0-3 农务音效与冒芽**（命中 🟡-1）：复核并激活 till/sow/water SFX（G4/G9）；播种后冒一帧嫩芽（复用 cropSprites 首阶）。

## T1 · 招牌时刻可视化（feat/visual-wave-v2）
- [ ] **T1-1 炼丹炉可视化**：`facility.talisman-furnace` 精灵入面板 + 程序化火焰(cinnabar/ember，火候驱动) + 理想区间在火候条高亮 + 炉内 `icon.herb.*`；七情配伍单独成块。
- [ ] **T1-2 天劫氛围与空间化**：背景压暗+紫红 tint + 落雷区脉动辉光圈(替代文本坐标) + 玩家格高亮 + lightningBolt 联动微闪(光敏安全 ≤3Hz) + 擦弹即时金光。
- [ ] **T1-3 突破结算奇观**：鎏金全屏 flash + 突破光柱 + 擦弹奖杯式呈现。

## T2 · 打磨与深度（按月）
- [ ] 玩家精灵从占位升级；世界作物关键品种 sprite 化。
- [ ] 季节/昼夜色调偏移；水面波光、树影。
- [ ] NPC 记忆点/节日/内容厚度（README 标 P2）。

## 推进纪律
- 每个子项一个原子 commit（`feat(render)/feat(app)` 等，简体中文，无 Co-authored-by）。
- 分支 `feat/visual-identity-wave-v1`（off master）→ 过门禁 → push → PR 到 main（squash）。push/PR 已获用户当次授权。
- 不直接推/强推/删 main；不动 git identity；不提交 secrets/agent 状态/sourcemap。
- golden-replay：T0-2/T0-3 若改变可见帧序列，只在"接受的行为变更"后更新 fixture，绝不为绿而改。
