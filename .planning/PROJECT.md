# Aeon Vale · 作品集草图

## What This Is

个人向、离线单机浏览器试玩的「星露谷式雏形 + 修仙一小口」作品集草图。确定性 sim 驱动农务日循环，公开试玩纵切片展示种田即备战。

## Core Value

首轮 10–15 分钟能清楚、好看、好玩地走完：农务闭环 → 炼丹教学 → **可操作教学天劫（走位 + 擦弹）** → 战后结算；视觉有 cozy 活感，差异化可被玩家亲手触到。

## Requirements

### Validated

- 确定性 sim + PBT + golden + 公开树/Pages 基建
- 首轮农务 onboarding 到 `first-loop-complete`
- 公开 4 段 journeyGuide（农务 / 炼丹 / 教学天劫走位 / 战后）
- master：像素硬边 + ambient bob（尚未全部进入 `origin/main` / Pages）
- 程序化 BGM/SFX、体验门工具（漏斗 / playtest / snapshot 软门）

### Active（本里程碑 Wave A）

- [x] A0 展示对齐：像素硬边 + ambient 进入公开展示轨并 live 复验
- [x] A1 教学天劫 PerfectBlock 峰值窗（站在落雷区时可擦弹）
- [x] A2 修仙 VFX 最小集（雷劫几何电光；可选丹炉焰）
- [x] A3 juice 增强 + 布局防溢出门（软门 + DOM 硬门）
- [x] A5 炼丹七情一口可见（教学丹方配伍文案）
- [ ] A4 体验门：bot 漏斗 ✅；5–10 人 playtest 映射仍欠（`humanHoursCertified` 诚实）
- [ ] A6 Feature lock 回归（对照 DoD + SKILL-AUTOMATION 队列）

### Out of Scope（本里程碑）

- 8 阶全曲线 / 留世终局深挖 / 多 NPC / 节日 — 稀释草图
- 全即时动作战斗层 — 鬼谷级坑；只做天劫塔防峰值窗
- EA / Steam / 愿望单 / 桌面封装（P1 Wave B）
- `git merge master` 进 `main` — 双轨无共同祖先

## Context

- 北极星：`.omc/research/LONG_TERM_GOAL-2026-07-17.md`
- 缺陷锚点：`.omc/research/deep-review-2026-07-17-v2.md`
- 双轨：`.omc/research/dual-track-branch-workflow-2026-07-17.md`
- 仓库规程：`docs/18-development-roadmap.md` OMC/GSD/ECC 节
- 展示 tip：`origin/main`；开发 tip：`master`

## Constraints

- **确定性**：`src/sim` 纯函数、注入 PRNG、无 IO/渲染；LLM 不进 sim
- **双轨**：公开改动从 `origin/main` 开 PR；禁止整树 merge master
- **授权**：commit/push/部署/转 Public 需用户当次授权（CONTRIBUTING）
- **完成声明**：须过执行式门；`humanHoursCertified:false` 直至真人测

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 草图 > 完整游戏 | 精致 > 完整；竞品血泪 | ✓ |
| PerfectBlock 仅教学峰值窗 | 收窄实时战斗风险 | — Active |
| 视觉/手感优先于加系统 | charm 是卖点 | ✓ |
| 暖调 cozy 水墨，去 ACS 既视感 | 抄袭舆论风险 | — Pending master ref |

---
*Last updated: 2026-07-17 after portfolio-sketch grading*
