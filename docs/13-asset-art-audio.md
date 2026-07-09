# 13 · 美术与音频管线（Asset, Art & Audio）

> 本文件定义《Aeon Vale》的**视觉与听觉哲学、资产清单、调色板、程序化优先策略、音频模型与可访问性**。
> 上游：`00-DESIGN-BRIEF.md` §2 支柱 5（东方仙侠美学与留白）、§7 C7（美学统一）、`10-technical-architecture.md`（渲染=PixiJS、音频=Web Audio API）、`03-world-and-lore.md`（世界观锚点）。
> 下游：`12-project-structure.md`（assets/ 目录、资产管线工具）、`15-content-tables.md`（资产 ID 引用）。
> **本文档只产出设计原则、清单、流程与可访问性规范，不含可运行实现源码。**

---

## 0. 总则（艺术哲学）

**核心命题**：纯代码项目，单人 + AI 开发，**美术资源是最大的成本与版权风险**。我们的策略是：

1. **程序化优先（Procedural First）**：能用代码生成的（瓦片纹理、粒子、雷特效、UI 图形、调色板变体）绝不手绘。
2. **极简像素 / 水墨占位（Placeholder-Aware）**：必须手绘的（角色、灵草精灵、关键叙事图）用极简像素或水墨笔触占位，后续可平滑替换。
3. **限定调色板（Limited Palette）**：全场共用 16–32 色调色板，统一美学、降低决策成本、保证色盲友好。
4. **音频程序化合成（Synthesized Audio）**：SFX 全合成；BGM 走极简序列 + 短循环样本，避免依赖第三方音乐包。
5. **留白即风格（Negative Space as Style）**：东方水墨的「计白当黑」呼应修仙主题；不堆砌细节，用构图说话。

参考 [Modern Pixel Art Games (DiVA Portal PDF)](https://www.diva-portal.org/smash/get/diva2:832803/FULLTEXT01.pdf) 关于像素美学的学术分析。

---

## 1. 程序化优先策略

### 1.1 必须手绘 vs 可程序化

| 资产类别 | 策略 | 理由 |
|---------|------|------|
| 瓦片纹理（土壤/草地/水） | **程序化**（噪声 + 调色板 LUT） | 种类多、需要 tile 变体；shader 友好 |
| 雷劫特效（闪电、辉光、墨晕） | **程序化**（自定义着色器 + 粒子） | 动态、需可控参数（频率/分叉）；零美术依赖 |
| UI 图形（按钮/边框/进度条） | **程序化**（PixiJS Graphics + 9-slice） | 风格统一、易改主题 |
| 字体渲染（汉字） | **字体文件**（开源黑体 + 像素体） | 汉字无法手绘全部；选 1–2 套字体 |
| 灵草精灵（每品阶 1–9） | **手绘像素**（16×16 或 32×32） | 主题核心辨识，需要性格 |
| 角色精灵（玩家、NPC、妖兽） | **手绘像素**（32×32 起步） | 叙事载体 |
| 关键叙事 CG（飞升、暴毙） | **水墨静态图**（可选） | 仅结局需要；首版可全文字 |
| BGM | **MIDI 序列 + 极短样本** | 减少版权与体积 |
| SFX | **程序化合成** | 雷/UI/收获等触发型最合适 |

### 1.2 程序化生成的技术路径

| 类型 | 实现 |
|------|------|
| 瓦片纹理 | GLSL fragment shader：value noise + 调色板 LUT 采样 → 一次性烘焙到 `RenderTexture`，运行时复用 |
| 闪电特效 | 着色器：基于 seed 的 L-system / midpoint displacement 生成分叉路径 + 辉光（bloom）+ 抖动 |
| 墨晕粒子 | `@pixi/particle-emitter` 配合自定义 sprite（白噪声 + 模糊），alpha 渐隐 |
| UI 图形 | `PIXI.Graphics` 矢量绘制 + 9-slice 缩放；像素描边 |
| 占位角色/灵草 | 极简像素（5–8 色调色板） + 简单帧动画（idle/breathe） |
| 调色板变体（季节/昼夜） | 同一 sprite，shader 内做 HSV 偏移；不重画资源 |

### 1.3 「AI 辅助占位资产」的边界

参考 [PromeAI Wuxia/Xianxia Generator](https://promeai.pro/cases/poster-design/Asian%2520%2526%2520Eastern_Wuxia%2520Style) 与 [NightCafe Ink Wash Generator](https://creator.nightcafe.studio/tools/chinese-ink-wash-painting-generator) —— 可用 AI 生成**参考图与灵感板**，但：

- **不直接进游戏**：AI 生成图风格不一致、版权模糊、分辨率不齐。
- 仅作为「调色板」「构图」「笔触」的灵感来源，最终美术由人或像素工具（Aseprite）落地。
- **唯一例外**：结局静态 CG 可考虑 AI 生成 + 后期统一滤镜（保持风格一致）。

---

## 2. 资产清单（数量级估算）

### 2.1 视觉资产

| 类别 | 数量 | 单尺寸 | 总占用估算 |
|------|------|--------|-----------|
| 瓦片（土壤变体） | ~20 | 32×32 | ~50KB（程序化烘焙后） |
| 灵草精灵 | ~40（每 tier 4–5 种 × 9 tier） | 32×32 | ~200KB |
| 角色（玩家 + NPC + 妖兽） | ~15 | 32×32 / 64×64 | ~150KB |
| 物品图标（丹药/材料/工具） | ~60 | 16×16 / 32×32 | ~100KB |
| UI 元素（边框/按钮/图标） | ~30（程序化） | 矢量 | ~20KB |
| 雷劫粒子（程序化） | ~5（参数化变体无限） | 8×8 / 着色器 | ~30KB |
| 字体（汉字 + 拉丁） | 2 套 | - | ~3MB（汉字字体为主） |
| 结局 CG（可选） | 3–5 | 1280×720 | ~1MB |
| **总计（首版）** | - | - | **~5MB** |

**结论**：资产总占用极小（< 10MB），加上 Electron 运行时（~80MB），总包体 ~100MB 量级。

### 2.2 音频资产

| 类别 | 数量 | 来源 | 占用 |
|------|------|------|------|
| BGM（慢/治愈） | 3–5 循环 | 程序化 MIDI 序列 + 短样本 | ~500KB |
| BGM（急/紧张） | 2–3 循环 | 同上 | ~300KB |
| SFX（雷/炸炉/收获/UI/种田/突破） | ~20 | 全程序化合成（OscillatorNode） | ~0（代码生成） |
| Stinger（突破成功/失败/飞升） | 3–5 | 程序化 + 短样本 | ~200KB |
| **总计（首版）** | - | - | **~1MB** |

---

## 3. 调色板与美学锚点

### 3.1 设计支柱映射（呼应 §00 支柱 5）

> 「东方仙侠美学与留白」+「凡人挣扎感」+「慢与快的张力」。

视觉上需要同时表达：
- **慢/治愈**（90% 时间）：温润、留白、田园感。
- **急/天劫**（10% 时间）：黑云压顶、雷电撕裂、生死一线。
- **凡人渺小**：玩家精灵相对世界小一号；UI 克制不喧宾夺主。

### 3.2 限定调色板（主调 + 状态调）

**全局主调（16 色）** —— 参考 [PromeAI Wuxia Style](https://promeai.pro/cases/poster-design/Asian%2520%2526%2520Eastern_Wuxia%2520Style) 的「水墨 × 高度幻想」意象：

| 角色 | 色相区间 | 用途 |
|------|----------|------|
| 宣纸底（Paper） | 米黄 / 暖白（#F4ECD8 区间） | 背景、UI 底 |
| 墨黑（Ink） | 偏冷黑（#1A1A1F） | 文字、描边、夜 |
| 远山黛（Distant Mountain） | 蓝灰（#5C6B73） | 远景、阴影 |
| 苔青（Moss Green） | 低饱和绿（#7A8C5A） | 草地、灵气 |
| 灵气青（Qi Cyan） | 冷青（#4A8C9C） | 灵气、阵法 |
| 朱砂（Cinnabar） | 暖红（#B5482F） | 警示、关键 UI、丹炉火 |
| 鎏金（Gilt） | 暖金（#C9A14A） | 修为、突破、稀有 |
| 玄黄（Loess） | 土黄（#A88B5C） | 土壤、瓦片 |
| 雪青（Pale Purple） | 冷紫（#7B6C8A） | 紫雷劫、危险 |
| 月白（Moon White） | 冷白（#E8E8E0） | 月光、清冷 |
| …… | …… | （合计 16 色，留余量） |

**状态调（覆盖层，3–4 色）**：
- 天劫期：暗化 + 紫红色调偏移（global tint shader）。
- 暴毙/Game Over：去饱和 + 朱砂出血。
- 突破：鎏金辉光全屏 flash。

### 3.3 慢/急模式的视觉对比

| 维度 | 慢模式（种田/炼丹） | 急模式（天劫） |
|------|---------------------|----------------|
| 亮度 | 明亮、暖光 | 暗化（亮度 -30%） |
| 饱和 | 中等、温润 | 紫红偏移、对比拉高 |
| 节奏 | 缓慢呼吸（背景微动） | 快速抖动、屏幕震 |
| 元素密度 | 留白多 | 粒子密集（雷/火星） |
| 字体描边 | 细 | 粗 + 辉光 |
| 调色板 | 主调（16 色） | + 紫雷/朱砂点缀 |

切换方式：天劫倒计时 ≤ 30s 触发 global tint shader 渐变（500ms 过渡）。

### 3.4 美学禁忌

- **避免 AI 通病**：彩虹色、过饱和、塑料质感。坚持低饱和 + 限定调色板。
- **避免堆砌**：不画每个瓦片的细节，让构图说话（水墨留白）。
- **避免风格漂移**：所有手绘资产必须能在同一 16 色调色板内表达；超出即返工。

---

## 4. 音频模型

### 4.1 BGM 分层（情绪曲线服务）

参考 [MDN: Audio for Web Games](https://developer.mozilla.org/en-US/docs/Games/Techniques/Audio_for_Web_Games) + [web.dev: Web Audio for Games](https://web.dev/articles/webaudio-games)。

| 层 | 风格 | 乐器（合成模拟） | 触发 |
|----|------|------------------|------|
| **A: 慢/治愈** | 古琴 + 笛 + 环境 pad | 正弦波 + 软包络 + 混响 | 默认（种田/炼丹/探索） |
| **B: 急/紧张** | 鼓点 + 低频脉冲 + 不和谐音 | 锯齿波 + 噪声 + 低通滤波 | 天劫倒计时 ≤ 30s |
| **C: Stinger** | 短促高光（突破/飞升） | 钟铃合成（多谐波叠加） | 关键叙事节点 |

**慢→急切换**：
- 倒计时 ≤ 30s：BGM-A 500ms 淡出，BGM-B 渐入 + 全屏 tint shader 同步。
- 劫后 5s：反向，BGM-B 淡出 → A 回归，伴随视觉恢复。

### 4.2 SFX 清单

| SFX | 触发 | 合成思路 |
|-----|------|----------|
| 雷击（白/紫） | `Lightning` 进入 STRIKE | 噪声 burst + 低通扫频 + 短延迟回声 |
| 雷预警（前 1s） | `Lightning` WARN 出现 | 高频嘶声渐强 |
| 炸炉 | `Furnace.state = EXPLODING` | 低频爆 + 金属共振 |
| 收获灵草 | `cropSystem.harvest` | 软「啵」+ 上行小二度音 |
| 翻地/种植 | `tileSystem.till/plant` | 沙沙噪声 + 短促敲击 |
| UI 点击/悬停 | 输入事件 | 极短正弦「tick」 |
| 突破成功 | `breakthroughSystem` | 钟铃 + 上行琶音 |
| 玩家受伤 | Player.hp 下降 | 低频闷击 |
| 妖兽出现 | `beast.spawn` | 不和谐低吼（噪声 + 共振） |
| 季节变化 | `seasonSystem` | 风声渐变 |

### 4.3 程序化合成实现路径

Web Audio API 节点图（示意）：

```
OscillatorNode (sine/sawtooth) ──┐
                                 ├─→ GainNode (ADSR envelope) ─→ Filter ─→ Destination
BufferSource (noise) ────────────┘
```

- 每种 SFX 是一个工厂函数 `createSfx_X(audioCtx): AudioBuffer`，预渲染到 buffer（避免实时合成卡顿）。
- BGM 用极简序列器（pattern + step sequencer），旋律数据存 `assets/audio/patterns/*.json`，可热重载。

### 4.4 资产来源与版权

| 资产 | 来源 | 版权策略 |
|------|------|----------|
| 字体 | **思源黑体 / 方正像素体**（OFL/MIT） | 明确开源许可 |
| 短音频样本（如有） | freesound.org / ccMixter | 仅 CC0 / CC-BY，注明来源 |
| 程序化 SFX | 自合成 | 无版权风险 |
| BGM 序列 | 自创 | 无版权风险 |
| 灵感参考图 | AI 生成 / 公开素材 | **不进游戏**，仅作 mood board |

**禁令**：任何来源不明的资产禁止入库；`assets/manifest.json` 必须为每条资产记录 `license` 与 `source` 字段。

---

## 5. 资产管线

### 5.1 Manifest（资产清单）

```ts
interface AssetManifest {
  version: int;
  sprites: AssetEntry[];      // 精灵表
  audio: AssetEntry[];
  fonts: AssetEntry[];
  shaders: AssetEntry[];
}

interface AssetEntry {
  id: str;                    // 引用 key（如 "herb-spirit-grass-low"）
  path: str;                  // 相对 assets/ 路径
  type: 'png' | 'json' | 'wav' | 'mp3' | 'ogg' | 'ttf' | 'glsl';
  checksum: str;              // SHA-256，启动校验
  license: str;
  source?: str;
}
```

### 5.2 加载流程

```
启动
  ↓
读取 manifest.json
  ↓
并发加载所有资产（PixiJS Assets API）
  ↓
校验 checksum（防损坏）
  ↓
失败 → 提示 + 降级到 fallback 资产（程序化）
  ↓
进入 GameLoop
```

### 5.3 打包

- 开发：`assets/` 直接读盘（Vite dev server）。
- 生产：Vite 把 `assets/` 打入 `dist/`；electron-builder 包进 app 包。
- 字体子集化：仅打包游戏实际用到的汉字（用 fontmin 等工具），把 5MB 字体压到 1MB 内。

### 5.4 未来替换为正式资产的接口预留

- 所有资产通过 `AssetId`（字符串 key）引用，render 层不直接 import 文件。
- 替换时只改 `assets/` 内容 + `manifest.json`，不改代码。
- 「正式美术包」可作为 DLC / mod 覆盖。

---

## 6. 可访问性（Accessibility）

参考通用游戏无障碍指南（如 [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/)，公开标准）。

### 6.1 色盲安全

- **不用颜色单独传达关键信息**：雷类型（白/紫）除颜色外用**形状/图标**区分（白雷直线下行、紫雷分叉）。
- 调色板提供 **Daltonize 模式**（shader 后处理，对红绿色盲偏移色相）。
- UI 状态（HP/丹毒条）除颜色外加图标 + 数值。

### 6.2 雷光闪烁安全（防光敏性癫痫）

**这是天劫机制的硬约束**——高频雷光可能触发光敏性癫痫发作（photosensitive epilepsy）。国际标准（IEC 6841 / WCAG 2.3.1）要求：

| 规则 | 阈值 | 实现 |
|------|------|------|
| 闪烁频率 | **不超过 3 次/秒** | 雷粒子 alpha 动画频率上限 3Hz |
| 闪烁面积 | 全屏闪烁 < 任何瞬间超过屏幕 25% 像素 | 单次雷击全屏 flash ≤ 1 帧 + 强度 ≤ 30% |
| 对比度 | 亮暗反差 < 10:1 时较安全 | flash 使用半透明白而非纯白 |
| 红色闪烁 | 红光尤其危险（光敏触发率最高） | 紫雷红色成分 ≤ 30% 饱和度 |

**实现**：
- 全局 `PhotosensitivityFilter`（PixiJS shader）在所有雷特效之上包一层，强制把任意 > 3Hz 的明暗变化平滑（低通滤波）。
- 提供「降低闪烁」选项（设置开关），进一步压到 1Hz。
- CI 跑「闪烁安全审计」：扫描所有雷特效资产/动画参数，断言符合阈值。

### 6.3 字幕与音效可视化

- 所有叙事文本（对话/事件描述）以**字幕形式**呈现，可调字号（小/中/大）。
- 关键 SFX 提供**视觉提示**（如雷击前 1s 屏幕边缘脉冲、炸炉前炉口闪烁），不依赖听觉。
- BGM/SFX 音量独立调节；提供「全静音仍可玩」保证（视觉反馈覆盖所有关键事件）。

### 6.4 操作可访问性

- **全键盘可玩**（见 `10-technical-architecture.md` §8）。
- 键位可重映射。
- 鼠标点击容差（点击阵眼附近也算命中）。
- 塔防期可设置「时间减速 0.7×」（仅单机，不破坏排行榜——本游戏无在线排行）。

### 6.5 文本对比度

- 文字与背景对比度 ≥ 4.5:1（WCAG AA）。
- 暗背景上用米黄/鎏金文字；亮背景上用墨黑。

---

## 7. 开放问题

| # | 问题 | 倾向 |
|---|------|------|
| Q1 | 是否在首版引入结局 CG | 首版全文字 + 极简动画；CG 后置 |
| Q2 | 字体子集化的具体工具 | `fontmin` 或 `fonttools`（CI 跑） |
| Q3 | 调色板具体 hex 是否现在锁定 | 等首张概念图（人或 AI mood board）后锁定，再写入 `13` 附录 |
| Q4 | BGM 是否引入第三方素材 | 首版全自合成；若质量不足再考虑授权库 |
| Q5 | 「降低闪烁」是默认开还是默认关 | 默认开（更安全）；高级玩家可关 |

---

## 参考资料

- [Audio for Web Games — MDN](https://developer.mozilla.org/en-US/docs/Games/Techniques/Audio_for_Web_Games)
- [Developing game audio with the Web Audio API — web.dev](https://web.dev/articles/webaudio-games)
- [Procedural audio using the Web Audio API (AES)](https://aes.digitellinc.com/p/s/procedural-audio-using-the-web-audio-api-2413)
- [Procedural audio generation explained — SFX Engine](https://sfxengine.com/blog/procedural-audio-generation-explained)
- [Modern Pixel Art Games (DiVA Portal PDF)](https://www.diva-portal.org/smash/get/diva2:832803/FULLTEXT01.pdf)
- [AI Wuxia Style Generator — PromeAI](https://promeai.pro/cases/poster-design/Asian%2520%2526%2520Eastern_Wuxia%2520Style)
- [Chinese Ink Wash Painting Generator — NightCafe](https://creator.nightcafe.studio/tools/chinese-ink-wash-painting-generator)
- [Top games tagged Pixel Art and xianxia — itch.io](https://itch.io/games/tag-pixel-art/tag-xianxia)
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/)
- [WCAG 2.1 — Seizures and Physical Reactions (2.3.1)](https://www.w3.org/WAI/WCAG21/Understanding/seizures-and-physical-reactions.html)
- [PixiJS v8 Documentation](https://pixijs.com/)
- [Procedural Content Generation in Games (survey)](https://www.researchgate.net/publication/221478064_Procedural_Content_Generation_in_Games)
