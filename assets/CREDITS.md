# 音频资产署名（CREDITS）

本文件记录 AeonVale 音频资产（`assets/audio/**`）的来源、许可与生成方式，对应
`assets/manifest.json` 的 `audio` 桶。原则：**零委约、零下载、程序化优先**（C7 + 音频调研 Path B），
规避 Suno/Udio 等生成式音乐服务的版权与署名风险。

## 程序化茎（第一刀·已上线）

**许可**：MIT（与本仓库 `CONTENT-LICENSE.md` 自有原创内容一致）。

**生成方式**：本仓库 `tools/render-bgm.ts` 离线烘焙，由 `src/io/generativeMusic.ts` 的
`generatePhrase`（马尔可夫旋律 + 生成式和声文法 + 四季调色板）驱动，经
`renderPhraseToFloat32`（确定性 PCM 合成）→ WAV → `ffmpeg loudnorm + libvorbis` → ogg。
确定性保证：`-fflags+bitexact -flags+bitexact` 关闭 ogg 随机 serial，相同 seed ⇒ 字节级相同产物。

**回放驱动**：
- 程序化 SFX（雷/钟/低语/呼吸/glitch/UI）：`src/io/audio.ts` 的 `playSfx`，WebAudio 原生节点合成。
- 世界 BGM（四季自适应）：`src/io/bgm.ts` 的 `GenerativeBgm`，Tone.js 实时回放。
- 灵韵叙录 narration 茎：`src/io/narrationTrack.ts` 的 `NarrationTrackPlayer`，Tone.Player 循环 + 独立 gain crossfade。

### 茎清单（`assets/audio/bgm/`）

| AssetId | 用途 | generatePhrase 参数 | 备注 |
| --- | --- | --- | --- |
| `bgm.signature-dao-song` | 签名主题曲「大道之歌」 | `seed=SIGNATURE_THEME_SEED, spring, farm, calm, bars:8` | 飞升结局同路生成 |
| `bgm.season.spring/summer/autumn/winter` | 四季自适应 BGM | `seed=season, <season>, farm, calm, bars:4` | 仿星露谷四季调色板 |
| `bgm.narration.prologue` | 序章迷茫空灵 | `seed=narration:prologue, spring, farm, calm, bars:8` | 灵韵叙录·序章 |
| `bgm.narration.village` | 荒村古朴 | `seed=narration:village, spring, market, calm, bars:4` | 借 market 密度乘子 1.18 |
| `bgm.narration.road` | 修仙路沉思 | `seed=narration:road, autumn, forest, calm, bars:4` | 多利亚调色板 + forest 稀疏 |
| `bgm.narration.combat` | 打斗紧张 | `seed=narration:combat, autumn, tribulation, tense, bars:4` | TENSE_BPM_BOOST 1.16 |
| `bgm.narration.tribulation` | 渡劫威压 | `seed=narration:tribulation, autumn, tribulation, tense, bars:4` | 运行时叠 narration-thunder SFX |
| `bgm.narration.finale` | 终局苍凉 | `seed=narration:finale, autumn, forest, calm, bars:4` | forest 0.74 密度 |
| `bgm.narration.ending-ascension` | 飞升超脱 | `seed=narration:ending-ascension, spring, forest, calm, bars:8` | 长延迟收尾 |

每条茎的 SHA-256 checksum + provenance 残留在 `.omc/artifacts/audio-provenance.json`，
manifest 条目残留 in `.omc/artifacts/audio-manifest-entries.json`（均 gitignored，本地可复现）。

### SFX 清单（程序化合成，无文件）

`src/io/audio.ts` 的 `playSfx(id)` 实时合成：

- **数据驱动（sfxr/jsfxr 风格）**：`coin`, `spirit-stone`, `cultivate`, `array-place`,
  `ui-confirm`, `ui-chapter`, `codex-page`, `codex-unlock`, `ui-fontsize`
  （参数登记在 `SFX_PRESETS`，由 `renderSfxrSamples` 离线渲染为 AudioBuffer 回放）。
- **WebAudio 原生节点合成**（灵韵叙录叙事 SFX，音频调研）：
  - `narration-thunder`：Farnell 4 层雷模型（sub-bass sine 45Hz + N-wave 指数扫频劈击 + 距离 LP + 卷积 IR）。
  - `narration-bell`：FM 撞击 + 7 模态泛音 [0.5,1,1.2,1.5,2,2.9,3.8]，衰减 [12,9,6,5,4,2.5,2] 秒。
  - `narration-whisper`：Klatt 并联共振峰（噪声驱动 4 bandpass + 6.5Hz 亚音频 tremolo）。
  - `narration-breath`：粉噪 lowpass + bandpass ~500Hz + 慢 swell。
  - `incense`：柔基音 + 轻烟爆裂。
  - `e7-glitch`：BitCrusher(4)→Chebyshev(50)→Distortion(0.8) WaveShaper 链 + PitchShift(-2)（playbackRate）
    + 30Hz 方波 ring-mod 硬切 + self-eating buffer stutter（playbackRate 跳变）。

## 第三方依赖

- **Tone.js** (`tone`, npm `^15.1.22`)：MIT 许可。用于世界 BGM 实时回放（`GenerativeBgm`）与
  narration 烘焙茎回放（`NarrationTrackPlayer`，Tone.Player 循环 + 独立 gain crossfade）。
  来源：<https://github.com/Tonejs/Tone.js>
- **ffmpeg** (`libvorbis` 编码 + `loudnorm` 滤镜)：LGPL/GPL（系统级工具，不打包进产物）。
  仅在 `tools/render-bgm.ts` 离线烘焙时调用，运行时不依赖。

## 真实录音叠层（第二刀·占位）

后续若引入真实录音叠层（人声/乐器/采样），将在此处补 **CC-BY-4.0 / CC-BY-SA-4.0 / OFL-1.1** 等
第三方署名条目，并在 `manifest.json` 的对应 `audio` 条目写明 `source`（来源 URL）+ `license` +
`ai_disclosed`。第二刀之前，本仓库 **不下载任何外部音频文件**，全部音频走程序化合成（同路生成、
零委约、避 Suno/Udio）。

## 第一人称 CG（灵韵叙录 · `assets/cg/first-person/`）

本仓库 **不下载任何外部图片**。`cg.first-person.*-v2` 全部为 **AI-Generated**（gpt-image-2，经
中转站 `https://fast.qianxing.us.ci` 离线生成；user-authorized project asset），对应 `manifest.json`
的 `sprites` 桶。每条的完整 prompt / model / endpoint / seed 留存在该条目 `src` 字段（人审与复现
依据），`checksum` 与文件 sha256 一致（governance:check 校验）。

**许可**：`AI-Generated`（manifest `license` 字段），`ai_disclosed:true`，`human_edits:[]`，
`status:'published'`。

### 第一批 -v2（14 条，主线四幕骨架图）

序章 3 + 第一幕 2 + 渡劫 1 + 八结局 8：`prologue.valley/village/sect-v2`、
`act1.storage-ring/script-v2`、`tribulation.purple-v2`、`ending.e0-mushroom/ascension/poison-death/
tribulation-death/madness/lifespan-death/e6-sacrifice/e7-usurp-v2`。

### 第二批 -v2（14 条，子场景细化 + 道心氛围层 + NPC 立绘 + 梗意象）

| AssetId | 用途 | 备注 |
| --- | --- | --- |
| `cg.first-person.npc.wangyan-v2` | NPC 立绘·忘言叟 | 序章递锄头的老者 |
| `cg.first-person.npc.xiao-v2` | NPC 立绘·萧无极 | 顺天道的剑修宿敌 |
| `cg.first-person.npc.ni-v2` | NPC 立绘·逆 | 化劫灰的异乡人先驱 |
| `cg.first-person.npc.farmer-v2` | NPC 立绘·农门 | 凡人农家的接济 |
| `cg.first-person.npc.heart-demon-v2` | NPC 立绘·心魔 | 识海低语的执念之声（V1 备用，未强接心声条） |
| `cg.first-person.scene.village-dawn-v2` | 场景·荒村拂晓 | act2.village.hub/ditch/song |
| `cg.first-person.scene.spirit-farm-v2` | 场景·灵田布防 | act2.farm-lore（灵气规整的田埂） |
| `cg.first-person.scene.market-v2` | 场景·坊市 | act2.village.market（红伞白杆反转梗） |
| `cg.first-person.scene.shennong-cave-v2` | 场景·神农洞府 | act3.cave.entrance/lab/light（根脉顶开的洞府） |
| `cg.first-person.scene.faceless-statue-v2` | 场景·无面石像特写 | act3.cave.faceless（神农自愿匿名） |
| `cg.first-person.ambience.defiance-v2` | 道心氛围·逆天朱砂 | defiance bucket 'high'（≥66）时叠层 |
| `cg.first-person.ambience.bond-v2` | 道心氛围·红尘金光 | bond bucket 'high'（≥66）时叠层 |
| `cg.first-person.ambience.void-root-v2` | 道心氛围·空灵根吞吐 | 空灵根路由点（act1.ring.flash/act2.temper.stage1/act3.cave.*） |
| `cg.first-person.meme.mushroom-v2` | 梗意象·红伞白杆特写 | prologue.deep（E0 早夭支线）bg |

**氛围层叠层规范**（docs/23 §5）：bg → 道心氛围（`opacity ≤ 0.35` + `mix-blend-mode: overlay`）
→ 对话框；每 8s ≥ 2s 静止帧（静态 PNG 天然满足，光敏安全 WCAG 2.3.1）；`prefers-reduced-motion`
瞬切（app.css reduced-motion 块）。

**-v1 占位**（14 条，`status:'draft'`）：保留作历史回溯与降级兜底，不参与运行时选图
（narrationScenes `CG.*` 常量全部指向 -v2 published 条目）。
## Music / Stems — Creative Commons / MIT (第二刀)

### Procedural (MIT)
- All narration ambient stems (Eno / Reich / Sparse) — generated by tools/render-bgm.ts + src/io/generativeAmbient.ts
- All generatePhrase-based narration stems (first knife) — tools/render-bgm.ts

### Creative Commons Attribution-ShareAlike 4.0
- 「二泉映月」 performed by Zhang Peijian — https://commons.wikimedia.org/wiki/File:%E4%BA%8C%E6%B3%89%E6%98%A0%E6%9C%88.ogg — CC-BY-SA 4.0
- 「江河水」 performed by Zhang Peijian — https://commons.wikimedia.org/wiki/File:%E6%B1%9F%E6%B2%B3%E6%B0%B4.ogg — CC-BY-SA 4.0

### Creative Commons Zero
- DiZi Chinese Flute Sample by Gorgoroth6669 — https://commons.wikimedia.org/wiki/File:DiZi_Chinese_Flute_Sample.ogg — CC0

### Download failures (procedural fallback)
- RafaelCaro Guqin-song (CC-BY) — freesound OAuth required; prologue uses Eno bed only
- jobro Taiko drums (CC-BY) — freesound OAuth required; tribulation uses Reich bed only
- BlueDelta Heavy Thunder (CC0) — freesound OAuth required; use procedural narration-thunder SFX

## 第一人称 CG · 第三批（场景/NPC/梗意象）
全部 gpt-image-2 离线生成，`license: AI-Generated`，`ai_disclosed: true`，prompt 见 manifest `src`。
- cg.first-person.scene.battle-duel-v2 — 两修士斗法
- cg.first-person.scene.ni-ash-v2 — 逆化劫灰
- cg.first-person.scene.farm-autumn-v2 — 灵田秋景
- cg.first-person.scene.sect-gate-v2 — 太一宗山门
- cg.first-person.scene.mortal-montage-v2 — 凡人蒙太奇
- cg.first-person.scene.purple-sky-v2 — 紫雷劫天穹
- cg.first-person.npc.wangyan-old-v2 — 忘言叟老去
- cg.first-person.npc.xiao-sword-v2 — 萧无极剑光
- cg.first-person.npc.farmer-wife-v2 — 农家大娘
- cg.first-person.npc.village-child-v2 — 村童
- cg.first-person.meme.storage-ring-v2 — 储物戒特写
- cg.first-person.meme.wooden-whistle-v2 — 木哨特写
