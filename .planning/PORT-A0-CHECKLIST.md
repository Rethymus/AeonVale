# A0 展示对齐 · 公开轨 port 清单

## 源（master）

- Commit: `01bf653 perf(render): 像素硬边渲染与世界层环境呼吸动效`
- Patch 备份：`.planning/patches/01bf653-pixel-ambient.patch`（仅本地规划；不进 public-tree）
- Files:
  - `src/app/main.ts`（`antialias:false` / `roundPixels` / `scaleMode:'nearest'` / `ambientTimeMs`）
  - `src/render/renderer.ts`（`ambientBobOffset` 等）
  - `tests/browser/smoke.spec.ts`
  - `tests/unit/render-scheduler.test.ts`

## 做法（双轨）

```text
git fetch origin
git checkout -b feat/render-pixel-ambient origin/main
# 推荐：
#   git apply --check .planning/patches/01bf653-pixel-ambient.patch
#   git apply .planning/patches/01bf653-pixel-ambient.patch
# 若上下文漂移：对照 master 同 4 文件手工移植
# PR → squash → 授权部署
pnpm portfolio:mvp-preflight -- --include-live-pages
```

## 验收

- [ ] live smoke idle 帧门绿  
- [ ] 像素边缘清晰  
- [ ] 空闲世界有微动  
- [ ] PR 不含 `docs/` / `.omc/` / `.planning/`  

## 现状（2026-07-17）

- `origin/main` tip 仍为 `antialias: true`（已核对）
- master 已含像素+ambient；**未**自动开 PR / push（需维护者授权）
- patch 已生成至 `.planning/patches/01bf653-pixel-ambient.patch`
