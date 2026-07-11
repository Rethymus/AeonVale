# 美术资产状态与交接（Art Asset Status & Handoff）

> 对应 docs/13 §1.1「必须手绘 vs 可程序化」分级。本文记录哪些美术资产已由代码/外部工具闭环、哪些仍阻塞、以及解锁步骤。
> 维护者与后续 Agent 据此决定下一步。最后更新：T0–T3 资产管线轮次 + 结局 CG 生成轮次 + 角色精灵 AI 多重审核轮次。

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
| 结局 CG（飞升/寿尽/暴毙水墨） | §1.3 AI 例外 | ✅ 已完成 | gpt-image-2 生成 3 张 1024px 水墨图，AI-Generated 留痕（3 测） |
| 角色精灵（玩家/NPC/妖兽） | 用户授权 AI + 多重审核 | ✅ 已完成 | 5 张 32×32（player/游方散修/采药女/阵匠/守田兽），gpt-image-2 经四重审核放行（5 测） |

---

## 阻塞项（需外部资源，无法纯代码完成）

### 1. 结局 CG — ✅ 已完成（CG 生成轮次）
- ascension / lifespan-death / poison-death 三结局水墨图，由 gpt-image-2 经中转站生成（1024×1024），对应代码 ending 取值。
- `tools/gen-cg.mjs` 调用中转站 `/v1/images/generations`（最小 body；密钥只走 `CG_API_KEY` 环境变量，绝不入库）。
- manifest 以 `license=AI-Generated` + `source`（模型/端点/motif/提示词）留痕——§1.3 唯一允许 AI 图直接进游戏的类别。
- **可选后续**：AI 图未做 16 色调色板统一；如需更强风格一致，可用 Pillow 做一次调色板量化（非阻塞）。

### 2. 角色精灵 — ✅ 已完成（精灵生成轮次）
- player / 游方散修 / 采药女 / 阵匠老陆 / 守田兽 共 5 张 32×32，gpt-image-2 生成后降采样+量化入库（`assets/sprites/`）。
- **用户授权**：AI 用于角色精灵，覆盖 docs/13 §1.3 的 AI 限制；前提是**必须过自动化多重审核**（见下「AI 资产多重审核闸门」）。
- `tools/gen-sprite.mjs`（精准 prompt，调研模板，密钥走 `CG_API_KEY`）单 id 生成；`tools/review-ai-art.py` 量化+审核。
- **已知**：阵匠的 smith 专属特征（皮围裙/罗盘）在 32px 下偏弱，但仍为可读人形；如需更强辨识可后续按需重生成。

### AI 资产多重审核闸门（用户指令：AI 可用，须过审核）
任何 AI 生成资产入库前须**全部通过**以下阶段（`tools/review-ai-art.py` + 视觉判定）：
1. **fmt** — PNG 合法 + 尺寸符合类（sprite 精确 32×32；cg 大尺寸）。
2. **palette** — Lab ΔE 贴合 16 色调色板（sprite 量化后 mean ΔE≈0；cg 仅记录）。
3. **content** — 不透明率/唯一色数/单色洪泛检测，剔除废生成。
4. **vision** — 视觉语义审核（主体正确、无 AI 伪影、32px 下可读）；本环境用 `analyze_image`（zai MCP 401 不可用）。
5. **provenance** — `license=AI-Generated` + `source`（模型/端点/motif）+ `checksum` 由 manifest schema 强制。
- 前沿量化管线（调研落地）：去背景 → 预乘 alpha → 高斯 σ0.8 → **LANCZOS** 降采样 → 取消预乘 → alpha 二值化 → **Lab 最近邻**贴 16 色（**不抖动**）→ 中值去噪 → 连通域去孤立点。

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
- 任何资产入库前，`assets/manifest.json` 必须为该条目记 `license`（schema 允许 OFL/MIT/Apache/CC0/CC-BY/CC-BY-NC/AI-Generated）+ `source` + `checksum`(SHA-256)。
- 完整字体不入库（用 `tools/subset-font.mjs` 子集化）；AI 生成图除结局 CG 外不进游戏（§1.3）。
- 来源不明资产禁止入库。
