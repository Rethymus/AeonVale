# 《Aeon Vale: Song of the Dao》永恒山谷：大道之歌

> 纯代码（不依赖 Unity/Cocos/Godot 等通用引擎）的 2D 修仙种田 + 炼丹 + 天劫塔防生存游戏。
> **全程中文（zh-CN）**，面向国内市场；**MIT 开源**。

## 这是什么

一款以「凡人修仙的挣扎感与偷天的快感」为核心的独立游戏：你是没有灵根的凡人，种田是为了炼丹，炼丹是为了活过天劫，活过天劫是为了偷天——最终以凡骨硬撼天道、白日飞升。

## 技术栈

- **TypeScript (strict)** + **PixiJS v8** (WebGL2) + **Vite**
- **Vitest + fast-check**（属性测试 + 无头模拟）
- **Zod**（数据驱动内容 schema 校验）
- 确定性核心：固定步长 (30 TPS) + 种子化 PRNG（Mulberry32，多流）+ 记录输入回放
- 分层：`sim`（纯逻辑，无 IO/渲染）← `render` / `io` / `tools` / `tests`

## 目录

- `docs/` — 完整设计文档包（22 份）。**入口：`docs/00-README.md`**（含 Vibe Coding 执行手册与零干预自动化开发 SOP）。
- `src/sim/` — 核心模拟（纯逻辑，可无头测试）
- `src/render/` — PixiJS 表现层
- `src/content/` — 数据驱动内容 + zh-CN locale
- `src/io/` — 输入/音频/存档
- `tests/` — unit / property / integration / replay / headless
- `tools/` — content-lint / headless-run / balance-scan

## 开发

```bash
pnpm install
pnpm dev          # 浏览器开发
pnpm test         # 全测试
pnpm test:fast    # unit + 属性测试（快）
pnpm typecheck
pnpm headless     # 无头模拟一局
```

## 设计文档

所有设计决策、机制、数值、测试策略见 `docs/`。冲突裁定见 `docs/20-design-decisions-and-reconciliation.md`。
