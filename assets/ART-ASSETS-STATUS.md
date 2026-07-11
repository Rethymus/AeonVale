# 美术资产状态与交接（Art Asset Status & Handoff）

> 对应 docs/13 §1.1「必须手绘 vs 可程序化」分级。本文记录哪些美术资产已由代码/外部工具闭环、哪些仍阻塞、以及解锁步骤。
> 维护者与后续 Agent 据此决定下一步。最后更新：T0–T3 资产管线轮次 + 结局 CG 生成轮次 + 角色精灵 AI 多重审核轮次 + 运行时接入差距标注。

> ⚠️ **运行时接入缺口（重要纠偏）**：下表「入库 ✅」仅表示文件入库 + Node 测试通过；**浏览器运行时至今未加载任何 PNG**——`src/` 中 `Assets.load`/`PIXI.Sprite`/`Texture`/`new AssetStore` 的引用数为 0。已入库的 3 张结局 CG + 5 张角色精灵 + 字体在玩家画面里都是「孤儿」（玩家=红圆点、NPC/巡守兽不渲染、结局画面=纯文字、灵草全圆点）。wiring（G1–G6）需改 `renderer.ts`/`main.ts`，而这两文件含维护者未提交改动，**按用户指示暂缓**，见 §「wiring 接入（暂缓）」。

---

## 总览

| 缺口 | 策略（docs/13） | 入库 | 运行时接入 |
|------|----------------|------|-----------|
| 资产管线（manifest/loader/AssetId） | §5 程序化 | ✅ | ⚠️ AssetStore 未在 main.ts 实例化（G6，间接层空跑） |
| CJK 字体 | §1.1 字体文件（OFL） | ✅ 313KB woff2 | ⚠️ DOM ✅；PIXI.Text 首帧字体竞态（G5，待 `document.fonts.load`） |
| 瓦片/雷劫/UI/粒子/阵法/炼丹视觉 | §1.1 程序化 | —（代码内） | ✅ 纯 Graphics（瓦片为 9 个 hex 色块，G10 美学待打磨） |
| 灵草/物品精灵 | §1.1 程序化优先 | ✅ 生成器（12 测） | ⛔ 未接入：0 次 `registerSprite`，24 灵草全圆点（G3） |
| SFX（雷/炸炉/收获/突破/UI…） | §4.3 程序化合成 | —（合成） | ⚠️ 8/11 触发，`till`/`sow`/`water` 死代码（G4）；5 项未定义（G9） |
| BGM（calm/tense 情绪曲线） | §4.3 程序化合成 | —（合成） | ✅ calm/tense 已接入 main.ts |
| 结局 CG（飞升/寿尽/暴毙水墨） | §1.3 AI 例外 | ✅ 3 张 | ⛔ 未接入：结局画面纯文字（G2） |
| 角色精灵（玩家/NPC/妖兽） | 用户授权 AI + 多重审核 | ✅ 5 张 | ⛔ 未接入：玩家=红圆点，NPC/巡守兽不渲染（G1） |
| 物品图标（种子/丹药/材料/工具） | AI + 多重审核 | ⛔ 全缺 | ⛔ 背包/箱/出货/hotbar 全文字（G7） |

---

## 批次状态与后续需求

### 角色精灵当前状态
- 当前首批 5 张角色精灵已经入库并由 `tests/unit/sprite-asset.test.ts` 锁定：`sprite.player`、`sprite.npc.wandering-cultivator`、`sprite.npc.herb-gatherer`、`sprite.npc.array-smith`、`sprite.guard-beast`。
- 这批资源已足够支撑浏览器联调、输入流测试、基础人物识别与巡守兽占位，不再属于当前代码开发阻塞项。
- 这批资源的定位仍是**开发期可用占位**，不是最终发行版风格锁定稿；后续可逐步重绘或扩图，但替换时必须保留 manifest 留痕并通过现有测试。

### 交给 Claude Code 的下一批美术需求
- NPC 扩充：补齐常驻市集、茶棚、加工、阵法、镇守线相关角色，命名遵循 `sprite.npc.<slug>`。
- 巡守兽扩充：至少再补 2-3 个变体，用于巡田、护院、节日展示或留世终局陪伴向内容。
- 设施精灵：补齐 `drying-rack`、`sealing-cabinet`、`talisman-furnace`、仓储容器、出货箱、阵旗/阵眼。
- 高频物件精灵：优先基础种子、主力灵草、丹药、巡守饲料、阵材，服务后续更接近《星露谷物语》的读图效率。

### 交付规格
- 统一使用透明底 `32x32` PNG。
- 颜色遵循 `docs/13` 限定调色板，避免高饱和偏离当前美术基调。
- 任一新增 `sprite.*` 资产都必须写入 `assets/manifest.json`，包含 `checksum`、`license`、`source`。
- 一旦登记进 manifest，CI 会通过 `tests/unit/sprite-asset.test.ts` 自动校验文件存在、尺寸、哈希和许可字段。

---

## 阻塞项（需外部资源，无法纯代码完成）

### 1. 结局 CG — ✅ 已完成（CG 生成轮次）
- ascension / lifespan-death / poison-death 三结局水墨图，由 gpt-image-2 经中转站生成（1024×1024），对应代码 ending 取值。
- `tools/gen-cg.mjs` 调用中转站 `/v1/images/generations`（最小 body；密钥只走 `CG_API_KEY` 环境变量，绝不入库）。
- manifest 以 `license=AI-Generated` + `source`（模型/端点/motif/提示词）留痕——§1.3 唯一允许 AI 图直接进游戏的类别。
- **可选后续**：AI 图未做 16 色调色板统一；如需更强风格一致，可用 Pillow 做一次调色板量化（非阻塞）。

### 2. 角色精灵首批占位 — ✅ 已完成（精灵生成轮次）
- player / 游方散修 / 采药女 / 阵匠老陆 / 守田兽 共 5 张 32×32，gpt-image-2 生成后降采样+量化入库（`assets/sprites/`）。
- **用户授权**：AI 用于角色精灵，覆盖 docs/13 §1.3 的 AI 限制；前提是**必须过自动化多重审核**（见下「AI 资产多重审核闸门」）。
- `tools/gen-sprite.mjs`（精准 prompt，调研模板，密钥走 `CG_API_KEY`）单 id 生成；`tools/review-ai-art.py` 量化+审核。
- **已知**：阵匠的 smith 专属特征（皮围裙/罗盘）在 32px 下偏弱，但仍为可读人形；如需更强辨识可后续按需重生成或重绘。
- **后续扩展**：更多 NPC、设施、巡守兽和高频物件仍需要后续批次补齐，但这属于内容扩充，不再阻塞当前代码推进。

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
- 完整字体不入库（用 `tools/subset-font.mjs` 子集化）；AI 生成图默认不直接进游戏，**但用户已明确授权且通过多重审核的开发期角色精灵占位批次除外**。
- 来源不明资产禁止入库。
