# ROADMAP · portfolio-sketch-wave-a

> GSD 波次 + 仓库 OMC 窄切片。Phase 编号本里程碑内连续。  
> **Mode:** mvp（垂直切片，非水平摊大饼）

## Milestone Goal

把「可跑的纵切片」打磨成「可感的草图」：展示轨活感对齐 + 招牌擦弹一口 + 基础 VFX/juice + 体验门诚实。

## Phase Map

### Phase 1 — A0 展示对齐（P0）

**Status:** ready to PR（patch 已备；未 push）  
**Slices:**

1. ✅ master 已有像素+ambient；`.planning/patches/01bf653-pixel-ambient.patch`  
2. ✅ port 清单：`.planning/PORT-A0-CHECKLIST.md`  
3. ⏳ 从 `origin/main` 开 PR / 部署 / live 复验（需维护者授权）

**Exit:** REQ-A0-01..03（live 待授权）  
**OMC 切口:** 世界层读图链（渲染采样 + 常驻帧）

### Phase 2 — A1 教学天劫 PerfectBlock（P0）

**Status:** implemented on master（2026-07-17）  
**Slices:**

1. ✅ sim：`resolve-tutorial-bolt` + `perfectBlock`（区内 → `blockChance:1`，确定性）  
2. ✅ UI：区内主按钮「擦弹·第 N 雷」；区外「确认第 N 雷」  
3. ✅ 测试：unit 区内 blocked / 区外 miss；public-demo-panels aftermath「擦弹」  
4. ✅ browser 纵切片：`public-demo-vertical-slice` 至少 1 雷擦弹（dpad 走位 + 主按钮）

**Exit:** REQ-A1-01..03  
**OMC 切口:** 招牌玩法可玩（教学天劫路径）

### Phase 3 — A2 雷劫 VFX 最小集（P0）

**Status:** implemented on master（2026-07-17）  
**Slices:**

1. ✅ `src/render/lightningBolt.ts` 分形中点位移 + 白芯紫边描边  
2. ✅ `triggerTribBolt` + drawWorld 衰减绘制；全屏白闪降权  
3. ✅ 教学确认落雷 / 开场预警 / 正式引劫中心电光接入  
4. ✅ unit：`tests/unit/lightning-bolt.test.ts`

**Exit:** REQ-A2-01  
**OMC 切口:** 修仙视觉语言

### Phase 4 — A3 juice + 布局门（P0）

**Status:** implemented on master（2026-07-17，软门为主）  
**Slices:**

1. ✅ 农务成功：spawnBurst + SFX + `triggerShake`  
2. ✅ 雷劫 `triggerTribBolt` 联动 shake  
3. ✅ 飘字：`spawnFloatText` / `updateFloatTexts`（农务标签 + 擦弹/劫雷）  
4. ✅ 文案宽度软门：`uiCopyBudget` + unit（Playwright bbox 全量仍可后补）

**Exit:** REQ-A3-01 ✅；REQ-A3-02 ◐（软门齐，DOM 硬断言可后补）  

### Phase 5 — A4 体验门 + 真人样本（P0）

**Status:** partial（2026-07-17）  
**Slices:**

1. ✅ 新手漏斗 completeness：6/6 全通 `first-loop-complete`  
2. ✅ funnel CLI 支持 `--seeds=1..N` 区间解析（修 NaN）  
3. ⏳ browser 纵切片全量 / pages-slice  
4. ⏳ 5–10 人真人 playtest（保持 `humanHoursCertified:false`）

**Exit:** REQ-A4-01 ✅（bot）；REQ-A4-02 待人  

### Phase 6 — Feature lock 打磨（P0 收口）

**Status:** pending  
只允许润色/回归；对照草图 DoD 检查表。

## Wave B / C

见 REQUIREMENTS P1/P2；**不在本里程碑自动扩写**。

## Dependency Graph

```
Phase1 (display) ─┬► Phase3 (VFX) ─┐
                  │                ├► Phase5 (gates) ► Phase6 (lock)
Phase2 (PerfectBlock) ─────────────┘
Phase4 (juice/layout) ─────────────► Phase5
```

Phase1 与 Phase2 **可并行**（不同轨：main port vs master 实现）。  
本会话在 **master** 优先 **Phase2**（玩法缺口）；Phase1 需展示轨 PR（不自动 push）。
