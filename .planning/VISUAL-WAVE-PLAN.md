# 视觉身份 Wave V1 路线

**Updated:** 2026-07-17  
**Status:** T0 合入 main（#10 · `62f6f33`）；T1/T2 待办

## 核查结论（访客 60 秒）

工程地基准专业级，但常驻层读起来像原型：

| 优先级 | 缺陷 | T0 处置 |
|--------|------|---------|
| 🔴-1 | 标题纯色虚空 + 裸红「永」方块 | T0-1 山谷剪影 + logo-emblem |
| 🔴-2 | 世界空网格 / 无场景感 | T0-2 drawWorld 底层背景 |
| 🟡-1 | 播种后地块「空」 | T0-3 种子放大 + 回退嫩芽 |

## 分级

- **T0（本 PR）**：标题 / 世界 / 播种 —— 合入 ✅  
- **T1**：炼丹炉 DOM 氛围、天劫空间感（canvas juice）  
- **T2**：角色/NPC 辨识度、环境 hum  

## 约束

- 只动 render/app 表现层；sim 零改  
- `app.css` 禁止 `gradient()` / `animation:`  
- 不引新美术依赖；`references/` 主参考因公开树排除未用  
- dual-track：feature 自 `origin/main` rebase，避免 master 积压进 PR  

## 诚实纠偏

`ART-ASSETS-STATUS.md`「SFX：till/sow/water 死代码（G4）；5 项未定义（G9）」已过期 —— `src/io/audio.ts` 已实现且 `main.ts` 调用；`performSowAction` 含 sfx + 粒子 + 飘字 + 屏震。未在本波改文档，留给维护者复核。
