# 美术资产状态与交接（Art Asset Status & Handoff）

> 对应 docs/13 §1.1「必须手绘 vs 可程序化」分级。本文记录哪些美术资产已由代码/外部工具闭环、哪些仍阻塞、以及解锁步骤。
> 维护者与后续 Agent 据此决定下一步。最后更新：T0–T3 资产管线轮次。

---

## 总览

| 缺口 | 策略（docs/13） | 状态 | 交付物 |
|------|----------------|------|--------|
| 资产管线（manifest/loader/AssetId） | §5 程序化 | ✅ 已完成 | `src/io/assets.ts` + `assets/manifest.json`（11 测） |
| CJK 字体 | §1.1 字体文件（OFL） | ✅ 已完成 | LXGW WenKai 子集 313KB woff2 + @font-face（4 测） |
| 瓦片/雷劫/UI/粒子/阵法/炼丹视觉 | §1.1 程序化 | ✅ 既有 | renderer.ts 纯 PIXI.Graphics |
| 灵草/物品精灵 | §1.1 程序化优先 | ✅ 生成器完成 | `src/render/sprites.ts` + `palette.ts`（12 测），**待 renderer 接入** |
| SFX（雷/炸炉/收获/突破/UI…） | §4.3 程序化合成 | ✅ 既有 | `src/io/audio.ts`（11 种 SFX） |
| BGM（calm/tense 情绪曲线） | §4.3 程序化合成 | ✅ v1 既有 | `audio.ts` calm pad / tense 脉冲；**质量升级可选** |
| 结局 CG（飞升/暴毙水墨） | §1.3 AI 例外 / 手绘 | ⛔ 阻塞 | 见下「阻塞项」 |
| 角色精灵（玩家/NPC/妖兽） | §1.1 手绘像素 | ⛔ 阻塞 | 见下「阻塞项」 |

---

## 阻塞项（需外部资源，无法纯代码完成）

### 1. 结局 CG（飞升 / 暴毙 / 走火入魔，3–5 张水墨静态图）
- **为何阻塞**：纯代码程序化难以产出有情绪的叙事插画；需 AI 图像生成（API key）或人工作画。
- **文档边界**：docs/13 §1.3 **唯一允许 AI 生成图直接进游戏**的类别（须统一滤镜/调色板后入库）。
- **解锁步骤**（任一）：
  1. **AI 路线**：用 NightCafe Ink Wash / PromeAI Wuxia 等生成 1280×720 水墨图 → 在 Aseprite/PS 统一到 `src/render/palette.ts` 16 色 + 滤镜 → 放 `assets/cg/` → 在 `assets/manifest.json` 的 `sprites` 数组登记（id 如 `cg.ending-ascension`，license 字段记 "AI-generated, 公有领域/自有"，source 记工具与提示词）。
  2. **手绘路线**：人工水墨/像素创作 → 同上登记。
- **预留 AssetId**：`cg.ending-ascension`、`cg.ending-lifespan-death`、`cg.ending-possession`（仅约定，manifest 暂无条目——无文件不能造假 checksum）。

### 2. 角色精灵（玩家 + 3 NPC + 妖兽，~15 张 32×32+）
- **为何阻塞**：docs/13 §1.1 列为「必须手绘」（叙事载体，需性格）；AI 像素图被 §1.3 挡在游戏外（风格不一+版权）。
- **解锁步骤**：
  1. itch.io 取 CC0/CC-BY farming/xianxia 像素包 → Aseprite 重映射到 16 色调色板 → `assets/sprites/` → manifest `sprites` 登记（license/source 必填，§4.4 禁令）。
  2. 或人工 Aseprite 绘制。
- **接入**：renderer 用 `getSprite(AssetId)` 取 `SpritePixels` → `toRgba` → PIXI 纹理（与灵草精灵同一通路）。

### 3. BGM 质量升级（可选，非阻塞）
- 现状：`audio.ts` 已合成 calm/tense 双模式 + 11 种 SFX，docs/13 §4.3 程序化路径已落地，**首版可直接发布**。
- 若合成质量不达发行标准（§7 Q4）：授权 CC0/CC-BY 音乐库（OpenGameArt/ccMixter）或付费作曲 → `assets/audio/` → manifest `audio` 登记。注意 100% AI 音乐在美国属公有领域、无排他（Suno/Udio 付费档商用可，但版权弱）。

---

## 维护者接入 TODO（代码侧一行级，待人工合并）

1. **精灵接入 renderer**：`renderer.ts` 在绘制灵草处，由当前 `moveTo/lineTo` 线框改为 `const px = getSprite('sprite.herb.<id>'); if (px) draw via toRgba→PIXI texture`，否则回退线框。启动时遍历 `registry` 灵草 `registerSprite('sprite.herb.'+id, generateHerbSprite({id, tier, element}))`。
2. **canvas 文本字体**：PIXI Text 的 `fontFamily` 设为 `'LXGW WenKai'`（与 index.html DOM 字体一致；woff2 已通过 @font-face 加载）。
3. **CG 槽位**：结局触发处按 `AssetId` 取 CG 纹理，无则全文字（docs/13 §7 Q1 首版全文字已认可）。

> 以上三项均需改动 `renderer.ts`/`main.ts`，**这两文件当前含未提交的扩展改动**，故本轮未触碰；留待维护者在其工作分支合并。

---

## 版权与管线纪律（docs/13 §4.4 禁令）
- 任何资产入库前，`assets/manifest.json` 必须为该条目记 `license`（仅 OFL/MIT/Apache/CC0/CC-BY，schema 强制）+ `source` + `checksum`(SHA-256)。
- 完整字体不入库（用 `tools/subset-font.mjs` 子集化）；AI 生成图除结局 CG 外不进游戏（§1.3）。
- 来源不明资产禁止入库。
