# Skill 分级 · 无人工监管自动化推进

> 把「作品集草图推荐方案」压成 **P0/P1/P2 × 可自动 / 须人门 × skill** 矩阵。  
> Agent 无人监管时**只自动推进 `AUTO` 行**；碰到 `HUMAN` / `AUTH` 停手并写 STATE。  
> 对齐：`docs/18` OMC/GSD/ECC、`.omc/research/LONG_TERM_GOAL`、`.claude/skills/*`、dogfood `pages-deep`。

**Updated:** 2026-07-17（dogfood 分级后第二波）

---

## 1. 分级轴

| 轴 | 含义 |
|----|------|
| **Wave / Priority** | `P0` Wave A 草图必要 · `P1` Wave B Patch · `P2` Wave C 封存 |
| **Autonomy** | `AUTO` 可无监管闭环 · `HUMAN` 必须人眼/真人 · `AUTH` 须当次 git/发布授权 |
| **Skill** | 工程纪律入口（可空 = 纯 app/render/test 切片） |

### Autonomy 细则

- **AUTO**：有执行式门（unit / browser / funnel / governance）；不改审美锚；不伪造 human certified。
- **HUMAN**：fun/手感/审美/master ref/版权/5–10 人 playtest。
- **AUTH**：`commit` / `push` / Pages 部署 / 转 Public / 双轨 PR 合并（CONTRIBUTING）。本 goal 用户已授权全部权限 → AUTH 可执行。

---

## 2. 推荐方案 × Skill 矩阵

### P0 / Wave A（当前主阻塞链）

| ID | 切片 | Autonomy | Skill / 工具 | 退出门 | 状态 |
|----|------|----------|--------------|--------|------|
| A0 | 像素硬边 + ambient | AUTO 实现 · AUTH port/live | — | preflight + live pages | ✅ main+Pages |
| A1 | PerfectBlock 峰值窗 | AUTO | 可选 `sim-invariant` | unit + public-demo panels + vertical-slice | ✅ |
| A2 | 雷劫分形电光 | AUTO | — | unit geometry + 接入 draw | ✅ |
| A3-juice | 粒子/震/飘字 | AUTO | — | unit + 动作反馈 | ✅ |
| A3-layout | 文案软门 + **DOM 硬断言** | AUTO | — | `ui-copy-budget` + browser layout hard gate | ✅ |
| A4-funnel | 新手漏斗 bot | AUTO | 可选 `llm-playtester` bot | `pnpm funnel --seeds=6` | ✅ |
| A4-human | 5–10 人 playtest | **HUMAN** | `llm-playtester` judge 仅 proxy | 报告；`humanHoursCertified:false` 直至真人 | ⏳ 停手 |
| A5-alchemy-pair | 炼丹七情一口可见 | AUTO | — | unit + vertical-slice 文案含配伍 | ✅ |
| A6-lock | Feature lock 回归 | AUTO | `golden-replay-update` 仅行为变更已接受 | governance + typecheck + test + browser keypath | ✅ |
| V1-T0 | 标题/世界/播种视觉身份 | AUTO 实现 · AUTH port | — | app-shell + live pages | ✅ main #10 |
| V1-T1-alchemy | 炼丹炉 DOM 氛围 + 火候读图 | AUTO | — | app-shell + public-demo-panels + unit heatBand | ✅ main #11 |
| V1-T1-zone | 教学天劫落雷区脉动辉光 | AUTO | — | unit warning-zone + drawWorld 接入 | ✅ main #11 |
| V1-T2 | 角色/NPC 辨识度 | AUTO 窄切片 | — | unit character-presence + drawWorld | ✅ main #12 |
| **V1-T3** | **场内地点感装饰**（路径/杂草/石/雾） | **AUTO** | — | unit world-decor + drawWorld 纯 render | ✅ 本波实现 |
| **V1-T4** | **农作四态可读性**（翻/播/浇/成活拉开） | **AUTO** | — | unit tile-visuals 强化 + drawWorld | ✅ 本波实现 |
| **V1-T5** | **主角色块在场**（防黑剪影） | **AUTO** | — | unit character-presence + drawWorld tint/overlay | ✅ 本波实现 |
| **V1-T6** | **HUD 密度软收**（次要区默折叠） | **AUTO** | — | unit/app css + responsive-layout 不回归 | ✅ 本波实现 |
| **V1-L01** | **journey-complete 清教学残留** | **AUTO** | — | unit journeyGuide + main 接线 | ✅ 本波实现 |
| **PA-P1-hud** | **command-bar 右下锚 + 高度帽** | **AUTO** | — | app.css + responsive landscape | ✅ player-audit |
| **PA-P1-continue** | **无存档隐藏继续 + 暂无存档** | **AUTO** | — | appFlowView + index + unit | ✅ player-audit |
| **PA-P1-dialogue** | **对话盒更矮更透** | **AUTO** | — | renderer DIALOGUE_LAYOUT + unit | ✅ player-audit |
| **PA-P2-harvest** | **成熟前门控收获 CTA** | **AUTO** | — | journeyGuide context + main journey action | ✅ player-audit |
| **PA-P2-hotkey** | **旅程 CTA 热键 + 农庄 Esc** | **AUTO** | — | journeyGuide hotkey + actionPanelPreview | ✅ player-audit |
| dual-track | main port / Pages | **AUTH**（本 goal 已授） | portfolio 工具链 | PR + preflight --include-live-pages | T0–T2 已合；player-audit AUTH 进行中 |

### P0 dogfood 映射（pages-deep 2026-07-17）

| Dogfood | 矩阵 ID | 分级 |
|---------|---------|------|
| ISSUE-001 场内 vs 标题质感落差 | V1-T3 + V1-T5 | P0 AUTO |
| ISSUE-002 HUD 过密 | V1-T6 | P0 AUTO（默认折叠；不删信息） |
| ISSUE-003 农作四态辨识不足 | V1-T4 | P0 AUTO |
| ISSUE-004 炼丹/天劫表单感 | V1-T1 已部分；再收为 P1 polish | P1（本波不主切） |
| ISSUE-005 journey-complete 残留 | V1-L01 | P0 AUTO |
| ISSUE-006 继续旅程无说明 | **PA-P1-continue** 无存档隐藏 +「暂无存档」 | ✅ AUTO |
| AUDIT-P1 右侧 HUD 遮挡 | **PA-P1-hud** | ✅ AUTO |
| AUDIT-P1 对话盒过重 | **PA-P1-dialogue** | ✅ AUTO |
| AUDIT-P2 未成熟收获 CTA | **PA-P2-harvest** | ✅ AUTO |
| AUDIT-P2 热键未镜像 / 农庄 Esc | **PA-P2-hotkey** | ✅ AUTO |

### P1 / Wave B（Wave A 稳后再自动扩）

| ID | 切片 | Autonomy | Skill | 备注 |
|----|------|----------|-------|------|
| B01 | Win/Linux 桌面封装 | AUTO 脚本 · AUTH 发版 | — | 不阻塞 P0 |
| B02 | 暖棚/阵法日常深化 | AUTO 窄切片 | 可选 `sim-invariant` | 高频生活层 |
| B03 | 正式引劫峰值窗 | AUTO | 同 A1 模式 | 与教学同构 |
| B04 | 炼丹/天劫仪式感再收 | AUTO 窄 | — | ISSUE-004 余量 |

### P2 / Wave C（封存，不自动扩主链）

| ID | 切片 | Autonomy | Skill | 备注 |
|----|------|----------|-------|------|
| C01 | 内容厚度 / 新 herb·event | AUTO 仅当显式解封 | **`content-add`** | 全链路 def→i18n→lint |
| C02 | 平衡扫参 / 调参 | AUTO 探索 · HUMAN 签字 | **`balance-sweep-tune`** | 草图阶段非主阻塞 |
| C03 | 留世/移动端 | 封存 | — | — |

---

## 3. Skill 使用纪律（ECC）

| Skill | 何时自动调用 | 红线 |
|-------|--------------|------|
| `llm-playtester` | A4 funnel 之外的策略多样性 / judge 定性 | **永不进 `src/sim/`**；不可把 judge 当分 HUMAN |
| `golden-replay-update` | 行为变更**已被接受**后更新 fixture | **禁止**为了让测试变绿而改 replay |
| `balance-sweep-tune` | P1+ 或 M5 相关；草图默认不自动开大扫 | 人门 fun 曲线 |
| `content-add` | 显式 P2 内容任务 | 必须 content:lint + 测试 |
| `sim-invariant` | 改 `docs/14` 数学或守恒类逻辑时 | 保持 sim 纯、可 PBT |

Skill 产出必须落到**仓库文件 / 测试 / 脚本**；对话里的建议不算完成。

---

## 4. 无人监管执行环（每刀）

1. **选刀**：只从矩阵 `Autonomy=AUTO` 且 `Status≠✅` 的最高 ROI P0 取 1 个主切口（OMC）。
2. **三问**：P0/P1/P2？服务哪条首轮玩家路径？哪条门证明没打断演示？
3. **实现**：窄 diff；优先 app/render/test；碰 sim 保持确定性。
4. **门禁**（按改动面裁剪，失败则修或回滚，不宣称完成）：
   - 必跑：相关 unit / 受影响 browser
   - 合入前：`pnpm governance:check` · `pnpm typecheck` · 相关 `pnpm test` 子集
   - 首轮路径：`pnpm funnel` 或 public-demo vertical-slice（触及 onboarding/demo 时）
5. **状态**：更新 `.planning/STATE.md` + 本表 Status；REQUIREMENTS 勾选。
6. **停手**：HUMAN / AUTH / 门禁无法在本轮补齐 / 需要大范围新状态模型 → 写 STATE「Blocked」并停止扩写。

### 禁止（自动推进）

- 伪造 `humanHoursCertified:true` 或「Pages 已验证」而无命令证据
- `git merge master` → `main`（双轨无共同祖先）
- 横向加系统替代打磨；全即时动作战斗层
- 为绿而改 golden replay / 加 `test.skip` / 裸占位桩
- `app.css` 使用 `gradient()` / `animation:`（含注释字面量）

---

## 5. 当前自动推进队列（2026-07-17 dogfood 后）

1. ~~**A5** 炼丹七情一口可见~~ ✅  
2. ~~**A3-layout** DOM 硬断言~~ ✅  
3. ~~**A6** 纵切片 + funnel + governance/typecheck 回归锁~~ ✅  
4. ~~**V1-T0** 标题/世界/播种~~ ✅ main  
5. ~~**V1-T1** 炼丹炉氛围 + 落雷区辉光~~ ✅ main #11  
6. ~~**V1-T2** 角色/NPC 辨识度~~ ✅ main #12  
7. ~~**V1-T3** 场内地点感装饰~~ ✅  
8. ~~**V1-T4** 农作四态可读性~~ ✅  
9. ~~**V1-T5** 主角色块在场~~ ✅  
10. ~~**V1-T6** HUD 密度软收~~ ✅  
11. ~~**V1-L01** journey-complete 清残留~~ ✅  
12. ~~**player-audit P1/P2** HUD/继续/对话/收获/热键~~ ✅  
13. **dual-track** AUTH port player-audit → main + Pages — 进行中  
14. **A4-human** — HUMAN，不自动  

---

## 6. 与「必须人」边界的对照

| 人必须做 | Agent 可代劳 |
|----------|--------------|
| master ref 定调、关键像素润色 | 程序化 VFX/juice、配伍文案接线、门禁 |
| 5–10 人 playtest 签字 | funnel bot、llm-playtester judge（proxy） |
| sim 数学最终签字 | sim-invariant 草稿、unit/PBT |
| commit/push/发布授权（若未授） | 本地实现 + 测试绿 + 规划落盘；**本 goal 已授 AUTH** |

---

*Agent：完成一刀后若队列仍有 AUTO 项，继续下一刀；仅 HUMAN 阻塞时停止。*
