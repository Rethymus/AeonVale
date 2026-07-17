# 视觉身份 Wave V1 路线

**Updated:** 2026-07-17  
**Status:** T0 合入 main（#10 · `62f6f33`）；**T1 已实现于 master**；T2 待办

## 核查结论（访客 60 秒）

工程地基准专业级，但常驻层读起来像原型：

| 优先级 | 缺陷 | 处置 |
|--------|------|------|
| 🔴-1 | 标题纯色虚空 + 裸红「永」方块 | T0-1 山谷剪影 + logo-emblem ✅ |
| 🔴-2 | 世界空网格 / 无场景感 | T0-2 drawWorld 底层背景 ✅ |
| 🟡-1 | 播种后地块「空」 | T0-3 种子放大 + 回退嫩芽 ✅ |
| 🟡-2 | 炼丹纯文本面板 / 无炉体 | **T1-a** facility 精灵 + 火候带 ✅ master |
| 🟡-3 | 天劫落雷靠坐标文案 | **T1-b** 落雷区脉动紫辉 ✅ master |

## 分级

- **T0（#10）**：标题 / 世界 / 播种 —— 合入 main ✅  
- **T1（本轮）**：炼丹炉 DOM 氛围、天劫空间感（canvas juice） —— master ✅ · port AUTH  
- **T2**：角色/NPC 辨识度、环境 hum  

## T1 实现要点

- **炼丹**：`index.html` 挂 `./facilities/talisman-furnace.png`；`demo-heat-track` 用 CSS 变量画理想区 + 指针；`data-heat-band=low|ideal|high` 驱动火焰块色/高（**无** `gradient()` / `animation:`）
- **天劫**：`tutorialWarningZone.ts` + `drawWorld` 在 `tutorialTribulation.phase==='active'` 时画中心+八邻域脉动区；与 `isPlayerInTutorialWarningZone` Chebyshev r≤1 对齐
- **sim 零改**；确定性 / 回放路径未动

## 约束

- 只动 render/app 表现层；sim 零改  
- `app.css` 禁止 `gradient()` / `animation:`（含注释字面量）  
- 不引新美术依赖；复用 `facility.talisman-furnace`  
- dual-track：feature 自 `origin/main` rebase，避免 master 积压进 PR  

## 诚实纠偏

`ART-ASSETS-STATUS.md`「SFX：till/sow/water 死代码（G4）；5 项未定义（G9）」已过期 —— `src/io/audio.ts` 已实现且 `main.ts` 调用；`performSowAction` 含 sfx + 粒子 + 飘字 + 屏震。未在本波改文档，留给维护者复核。
