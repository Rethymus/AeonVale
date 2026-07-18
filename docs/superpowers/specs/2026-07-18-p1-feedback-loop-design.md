# P1 玩法反馈闭环设计

> 状态：修订稿 v2（已吸收规格复核阻断项，待全新规格 reviewer 与五角色设计门）  
> 日期：2026-07-18  
> 范围：仅 P1-1、P1-2、P1-3；实现必须按 P1-1 → P1-2 → P1-3 串行。  
> 前置：P0 总门已通过。本文不授权提交、推送或发布。

## 1. 问题、用户与成功标准

P0 已让土地、选择目标和灵气浓度可读，但玩家仍难以把分散在多日里的动作理解为同一条因果链：种下一株草、等待成长、收获抗劫材料、用丹药临时补漏、准备天劫并争取寿元。

P1 把这条链压缩为持续可见、可验证的反馈：

```text
播种朱砂草
  → 25/50/75/100% 阶段回应
  → 收获显示“雷抗+5 / 可炼制避雷丹”
  → 修行面板显示真实肉身层与丹药目标
  → 常驻命数 HUD 显示劫期、大限与准备度
```

### 1.1 用户用例

1. **新玩家**想在约 15 秒的证据片段里看懂一株朱砂草从播种到成熟、收获和用途，**从而**确认等待不是无反馈空窗；**当**真实播种、生长、成熟事件和真实收获发生时，画面与声音逐层增强。
2. **准备炼丹/渡劫的玩家**想知道当前肉身哪一层仍在漏、手中某枚丹会临时作用于哪一处，**从而**把“空灵根如漏勺”的设定与真实阶段、丹药效果联系起来；**当**鼠标、键盘或触屏选择丹药时，人体示意给出同一数据预览。
3. **经营中的玩家**想在所有游戏页面持续看到天劫、大限和准备度，**从而**决定继续种田、炼丹、布阵还是引劫；**当**日期、劫态、丹药或阵法变化时，HUD 同步更新且不伪造不存在的日期。

### 1.2 成功标准

- P1-1 产出一段 15±1 秒、同时包含视频轨和非静音 Opus 音轨的 WebM，覆盖真实播种、25%、50%、75%、唯一一次 100% 成熟事件、真实按键收获和精确用途提示。
- P1-2 在 1440×900、960×540、844×390 均可读；移除所有文字后，独立审查者仍能在 2 秒内把主体识别为正面墨线人体/经络图。
- P1-2 的永久封堵、当前淬炼、丹药候选与已服 buff 均来自真实状态或 `PillDef` 元数据；stage 7 绝不伪装为全部封堵。
- P1-3 在活跃游戏过程中始终挂载在 shell 层，在 world、inventory、map、cultivation、alchemy、tribulation、aftermath、pause 及游戏内 settings 均保持可见；title/prologue/boot/error/ending/portrait-blocked/gameOver 不伪装成可继续操作的游戏 HUD。
- P1-3 的正式活动倒计时继续位于屏幕顶部居中，右侧/底部命数卡只做常驻压力补充，绝不替代正典倒计时。
- 所有 presenter/query 都可对冻结输入调用且不写 `GameState`；所有 test-only 能力从生产构建移除或严格关闭。
- P1 完成截图/视频必须比 P0 出现新的因果层级，而不只是更多文字。

## 2. 决策与范围

### 2.1 采用：真实内容元数据 + 只读展示层

P1 不再采用“完全 UI-only 映射”。明确需求中的朱砂草、雷抗、丹药目标和劫期真值必须落到内容或模拟边界，再由纯展示层消费：

- 新增真实 `herb.cinnabar` / `seed.cinnabar`、雷抗字段、可达种植路径和真实避雷丹方。
- 新增稳定 `BodySealPartId` 与 `PillDef.bodyTarget`，但不新增逐部位存档、漏失率或吞吐量状态。
- 抽出真正只读的天劫资格/调度查询；mutation 入口仍负责旧档 normalize。
- DOM controller 只保存 UI 选择，不回写模拟状态。

### 2.2 不采用

- 不用雷击木替代朱砂草，也不把 `metalAttract` 冒充雷抗。
- 不按丹药中文名、ID 前缀或“丹药族”在 UI 中猜目标部位。
- 不用 presenter 最终态注入、静音视频、SFX 日志或截图拼接冒充真实 15 秒闭环。
- 不为 idle 未就绪状态编造绝对劫期。正典规定天劫在资格/催讨条件成立后才排期；若未来产品坚持所有状态都有绝对日期，必须另立“周期性强制天劫”机制决策并单独做平衡、存档和回放迁移。

## 3. 数据契约与边界

### 3.1 内容契约

```ts
interface SpiritHerbDef {
  // 现有字段……
  lightningResistancePoints?: number; // 炼制避雷丹时贡献的“雷抗点”
}

interface RecipeDef {
  // 现有字段……
  minLightningResistancePoints?: number; // 候选丹方的真实雷抗投料门槛
}

type BodySealPartId = 'skin' | 'bone-frame' | 'meridian-web' | 'marrow-sea' | 'blood-channel' | 'thunder-bone' | 'final-aperture';

type PillBodyTargetMode = 'temporary-seal' | 'repair' | 'cleanse' | 'temper' | 'reinforce' | 'destabilize' | 'ascension-key' | 'none';

type PillBodyTarget = { kind: 'parts'; partIds: readonly BodySealPartId[] } | { kind: 'current-stage-part' } | { kind: 'none' };

interface PillDef {
  // 现有字段……
  bodyTarget: {
    effectKind: PillEffectKind | null;
    mode: PillBodyTargetMode;
    target: PillBodyTarget;
  };
}
```

内容 schema/lint 必须验证：

- `lightningResistancePoints` / `minLightningResistancePoints` 为 0..100 的有限数。
- 所有生产丹药都有 `bodyTarget`。
- 非空 `effectKind` 必须真实存在于该丹药 `effects`。
- 所有 `partIds` 合法；`none` 不得携带部位。
- 新内容注册后，旧 `schemaHash` 进入 `compatibleSchemaHashes`；实现时先读取并断言 P1 前 hash（当前预期 `8a0a2feb`），禁止凭记忆填写。

### 3.2 只读查询

新增或重构以下纯查询：

```ts
cropGrowthFeedbackState(crop, herb, options): CropGrowthFeedbackState
bodySealPresentation(snapshot, content, params): BodySealPresentation
readTribulationEligibility(state, params): TribulationEligibility
readTribulationSchedule(state, params): TribulationScheduleSnapshot
readTribulationPrepSnapshot(state): TribulationPrepSnapshot
tribulationPressurePresentation(snapshot): TribulationPressurePresentation
```

约束：

- 查询不得调用会执行 `normalizeBodyCultivation()` 的 `readyToInvokeTribulation()`。
- 把资格、准备窗、因果债、注视度和寿元阈值抽成共享纯函数；mutation 与 query 共用，不能在 app 复制公式。
- `readyToInvokeTribulation` / `readyForBreakthrough` 改为委托只读资格查询；旧档迁移只在 create/load/apply/day/start 等 mutation 边界显式执行。
- `computePrepScore` 改为委托 `readTribulationPrepSnapshot`；后者一次返回 wardReady、activeArrayCount、requiredArrayCount 与 score，HUD、突破和建议文案共同消费。
- 旧档 fallback 使用空值合并和 `max(bodyFoundation, cultivation)` 读取，不写输入。
- 单测以 `deepFreeze` 和调用前后结构相等证明只读。
- 只读库存计数必须覆盖普通库存与三档品质库存；必要时把现有 `itemCount` 的读取路径改为无副作用。

### 3.3 DOM 与 sim 依赖

```text
content/sim state
  ├─ crop feedback query ──────────────> Pixi 作物表现
  ├─ body seal query + PillDef metadata -> 修行 DOM controller
  └─ tribulation schedule query ───────> shell 命数 HUD controller

src/sim 不依赖 src/app 或 src/render
controller.destroy() 必须移除全部 listener / observer / audio tap
```

## 4. P1-1：朱砂草三段式种植反馈

### 4.1 真实朱砂草内容链

新增：

- `herb.cinnabar`，显示名“朱砂草”。
- `seed.cinnabar`，必须进入 `SHOP_CATALOG` 或真实交易来源，并进入生产可达的选种/热栏路径；不能只注册后靠测试 hook 播种。
- `lightningResistancePoints: 5`，`metalAttract: 0`。前者是炼丹投料雷抗点，后者是田中吸雷权重，二者语义绝不混用。
- `recipe.ward-cinnabar`，设置 `minLightningResistancePoints: 5`，输入至少含 `herb.cinnabar ×1`，输出 `pill.ward-basic`。推荐配伍为“朱砂草×1 + 和合叶×1”，保留现有 `recipe.ward-pill` 以避免破坏教学、存档和回放。

精确内容值：

```ts
herb.cinnabar = {
  displayName: '朱砂草',
  tier: 2,
  baseProperty: { cold: 3000, hot: 0, warm: 1000, neutral: 2000 },
  baseGrowth: 6000,
  growthThreshold: 75000,
  qiNeed: 18000,
  qiDrainPerDay: 1000,
  metalAttract: 0,
  lightningResistancePoints: 5,
  seedId: 'seed.cinnabar',
  rawPoisonValue: 6000,
  yield: [
    { itemId: 'herb.cinnabar', count: 1 },
    { itemId: 'seed.cinnabar', count: 1, chance: 0.5 }
  ]
}

recipe.ward-cinnabar = {
  inputs: [
    { herbId: 'herb.cinnabar', qty: 1 },
    { herbId: 'herb.balmleaf', qty: 1 }
  ],
  idealHeatRange: [45000, 60000],
  targetProperty: { cold: 3000, hot: 1000, warm: 2000, neutral: 5000 },
  minLightningResistancePoints: 5,
  outputPillId: 'pill.ward-basic',
  difficulty: 2,
  reveal: 'known'
}
```

朱砂草不设 preferred/weak season；`SHOP_CATALOG` 使用 stageMin=1、price=5。52500 火候下该配方必须稳定进入成丹区，并以公式级单测锁定。

“雷抗+5”必须被正式炼丹链真实消费：`resolveBrew` 对实际投料按数量汇总 `lightningResistancePoints`，在配方打分前排除未达到 `minLightningResistancePoints` 的候选。这样朱砂草的 5 点直接决定该避雷丹方是否成立，不是 display-only 字段，也不新增玩家存档状态。现有无 UI 入口的 `eat-raw` 不作为本任务唯一验收路径；若后续给生食补正式入口，可再复用该字段做弱护体效果。

完整可达链还必须覆盖 `brewRecipes`/丹炉可选列表，以及 `icon.herb.cinnabar`、`icon.seed.cinnabar` 的 manifest/程序化素材；“可买但不能种”“可种但不能炼”“Toast 无图”任一情况均为失败。

热栏采用明确的 11 槽方案：保留现有 10 槽，在末尾追加 `seed.cinnabar`。数字 1–0 仍直选前 10 槽，Q 可循环全部 11 槽；HUD/帮助文案必须改为“1–0 直选，Q 循环全部槽位”，不得在第 11 槽仍谎称可用数字直选。15 秒证据用真实键盘从第 10 槽 Q 一次选中朱砂草，再按 Z 播种。

实现前必须完整阅读项目 `.claude/skills/content-add/SKILL.md`，按其内容新增管线补齐 schema、registry、获取路径、热栏/选种、图标/程序化素材、i18n、内容 lint、测试和兼容 hash。

### 4.2 成长反馈状态

唯一真源：

```text
ratio = clamp(growth / growthThreshold, 0, 1)
```

| 比例     | 状态           | 视觉                                        | 声音/意义          |
| -------- | -------------- | ------------------------------------------- | ------------------ |
| 0–<25%   | `planted`      | 播种土壤局部变暗、种子点保留                | 真实播种土/木短音  |
| 25–<50%  | `qi-gathering` | 根部 1 条向植株收束的聚灵线                 | 正在吸收灵气       |
| 50–<75%  | `sprout`       | 明确出芽轮廓，尺寸首次明显跃迁              | 等待产生生命变化   |
| 75–<100% | `coloring`     | 叶脉由灰褐转朱砂红/冷青边光，出现第二层纹理 | 雷抗药性成形       |
| ≥100%    | `mature`       | 金青辉光、低频脉冲、轻微上扬                | 唯一一次清亮“叮”声 |

边界必须严格覆盖 24.9/25、49.9/50、74.9/75、99.9/100；不得把现有粗粒度 `CropStage` 当作 P1 阶段真源。

每株作物终身只允许首次跨入成熟时发出一个 `crop-mature`。当前过熟衰减会把 growth 降回阈值下方并在次日重新进入生长分支；P1-1 必须用既有 `crop.stage === 'mature'` 锁定衰减路径，使成熟株继续衰减/枯萎而不“返青再成熟”。不新增存档字段；旧档中 stage=mature 但 growth<阈值的作物也继续衰减。

### 4.3 性能与 reduced motion

- 继续复用既有作物 Graphics/Sprite 路径；不得每帧创建纹理、滤镜、Sprite 或 listener。
- 每株最多 2 条聚灵线，每条有限段数；全图预算和 P0 气流层共同验收。
- 成熟脉冲周期 1200–1600ms，不能盖过选中态和收获 halo。
- reduced motion 保留五个静态状态差异，冻结聚灵漂移和成熟相位。
- 同一状态、种子和时间输入逐字节稳定。

### 4.4 成熟声与收获反馈

- 新增 `SfxId = 'crop-mature'`；`endDaySfxQueue` 只从真实 `crop-mature` 事件排队，并对同一日批次有界去重。
- 播种、成熟、收获三个音色必须在人耳与波形特征上可辨。
- 收获前后用无副作用总量查询统计普通 + 品质库存；只有真实 `harvest` 事件、作物已移除且 delta>0 才展示成功链。
- 朱砂草验收文本为：

```text
朱砂草×1（雷抗+5），可炼制避雷丹
```

实际通用 presenter 使用真实 delta；关联丹方由 registry 反查 recipe → pill，不硬编码中文配方名。背包满、未成熟或失败时不得显示成功提示。

现有收获主产物进入 `qualityInventory`；Toast 必须读取 normal + mortal + spirit + treasure breakdown 后比较 total。首次收获里程碑或工具损坏提示不得覆盖 P1 用途链，应组合显示或给予因果用途更高的可见优先级。

### 4.5 15 秒有声音画证据

时间线：

```text
0–2s    真实键盘 Z 选择/播种朱砂草
2–4s    生产 advanceDay/合法 sim 推进到 25%
4–6s    推进到 50%
6–8s    推进到 75%
8–11s   生产逻辑跨入 100%，保留成熟脉冲与“叮”
11–14s  按 V 真实收获并显示精确用途
14–15s  停留在作物已移除和库存结果
```

录制要求：

- `#game-canvas.captureStream(30)` 与 `AudioEngine` 可释放的 `MediaStreamAudioDestinationNode` capture tap 合并。
- 使用浏览器支持的 VP8/VP9 + Opus WebM；若不支持则该证据门失败，不允许静音 fallback。
- 播种键首先完成 Web Audio 用户手势解锁，再开始关键动作。
- 录制完成后停止 tracks、断开 audio node，并销毁 test controller。
- `ffprobe` 断言视频轨 + Opus 音轨；`ffmpeg volumedetect` 或等价分析断言非静音，且播种/成熟/收获窗口存在能量峰。
- test-only 关键帧控制只可把真实 crop 放到某阈值前 1 单位，并设置合法照料/Qi 前置；25/50/75/100 每次“跨线”都必须调用生产 `advanceDay`。禁止直接写最终 ratio、`mature`、`crop-mature` 事件、收获库存、Toast 或 presenter 状态。
- 100% 后不再过日，避免过熟路径干扰；当前事件批必须恰有一个真实 `crop-mature`，重绘不能触发声音。
- 最终产物固定为 `.omc/artifacts/p1-1-cinnabar-growth.webm`；`max_volume` 不得为 `-inf`，目标至少 -45dB。

## 5. P1-2：“肉身漏勺”数据面板

### 5.1 正典部位

| `BodySealPartId` | 中文     | 必须可见的几何                       | 当前淬炼 stage |
| ---------------- | -------- | ------------------------------------ | -------------- |
| `skin`           | 皮膜     | 头、躯干、双臂、双腿完整外轮廓       | 1              |
| `bone-frame`     | 筋骨     | 颅骨、脊柱、肋骨、四肢骨             | 2              |
| `meridian-web`   | 经脉     | 胸腹向双掌双足分叉的对称经络         | 3              |
| `marrow-sea`     | 髓海     | 颅内、胸骨、骨盆、长骨髓芯           | 4              |
| `blood-channel`  | 心血     | 心口节点与主血脉                     | 5              |
| `thunder-bone`   | 雷骨     | 颅—胸骨—脊柱中轴雷纹，独立 SVG group | 6              |
| `final-aperture` | 最后一窍 | 下腹丹田开口环                       | 仅真实胜利封合 |

SVG 不能退化成七个抽象圆点。桌面人体高至少 180px，844×390 至少 128px。

### 5.2 阶段与封堵真值

`stage` 表示“正在淬炼这一层”，不是“这一层已经封住”：

- stage 0：全部 `open`。
- stage 1–6：
  - `player.stage > part.stage` → `sealed`。
  - `player.stage === part.stage` → `tempering`，进度为 `bodyFoundation / bodyFoundationCap(stage)`。
  - 其余 → `open`。
- 当前层达到 100% 仍显示“根基已满，待天劫固化”，不能改成永久金线。
- stage 7：前六层 `sealed`，`final-aperture` 仍 `open`；绝不能读取 `bodyFoundationCap(7)` 伪造最后一窍进度。
- `choice-pending`：最后一窍仅加月白 halo 和“天门已开，抉择未定”。
- 全金仅在 `postAscension.victoryRecorded === true` 且 mode 为 `ascended-away` / `stayed-in-world`；旧档可兼容真实 `ending==='ascension' && gameOver`。
- 天劫死亡、丹毒、走火、大限死亡等结局绝不能全金。

视觉三分且颜色不是唯一信号：

- 永久封堵：金色连续实线 + 实心印记。
- 当前淬炼：红虚线底 + 灵气青进度段 + 空心印记。
- 所有 `open` / 未封堵部位：朱砂红虚线 + 空心节点，不叠加金线；覆盖 stage0 全部部位、stage1–6 的未来部位和 stage7 `final-aperture`。
- 丹药候选：月白/灵气青 halo；不能复用金线。

### 5.3 现有丹药完整数据映射

| 丹药 ID               | 真实效果        | mode             | 目标                              |
| --------------------- | --------------- | ---------------- | --------------------------------- |
| `pill.ward-basic`     | `lightningWard` | `temporary-seal` | `skin`                            |
| `pill.ward-greater`   | `lightningWard` | `temporary-seal` | `skin`                            |
| `pill.ward-heaven`    | `lightningWard` | `temporary-seal` | `skin`                            |
| `pill.bone-basic`     | `heal`          | `repair`         | `bone-frame`                      |
| `pill.detox`          | `detox`         | `cleanse`        | `meridian-web`                    |
| `pill.deep-detox`     | `detox`         | `cleanse`        | `marrow-sea` + `meridian-web`     |
| `pill.temper`         | `temperBoost`   | `temper`         | 当前 stage 部位                   |
| `pill.temper-supreme` | `temperBoost`   | `temper`         | 当前 stage 部位                   |
| `pill.iron-bone`      | `ironBone`      | `reinforce`      | `bone-frame` + `thunder-bone`     |
| `pill.madness`        | `madness`       | `destabilize`    | `meridian-web` + `final-aperture` |
| `pill.ascend`         | `ascend`        | `ascension-key`  | `final-aperture`                  |
| `pill.neutral-pearl`  | `maxHpUp`       | `reinforce`      | `bone-frame` + `blood-channel`    |
| `pill.cold-mud`       | 无玩家效果      | `none`           | 无                                |

候选详情同时从真实 `effect.power`、持续/消费语义和 `pill.load` 派生。飞升丹在 stage<7 显示真实拒服门槛；stage7 也只预亮最后一窍。未知或缺 metadata 的丹显示“用途未标注”，不高亮、不抛错。

`current-stage-part` 只在 stage1–6 解析为对应部位。stage0 返回 `none` 并显示“尚未踏入偷天诀”；stage7 返回 `none` 并显示“飞升前夜无常规淬体层”，不得把淬体丹误指向 `final-aperture`。最后一窍只由 `ascension-key` 候选预亮。

### 5.4 已服 buff 与候选分离

- `wardMitigation > 0`：skin 显示“生效中”的青色护层。
- `temperBoostMult > 1`：高亮当前 stage 部位。
- `ironBoneMitigation > 0`：高亮 bone-frame / thunder-bone。
- 这些状态绝不改写永久 `sealed`。
- heal/detox/maxHpUp 没有可追踪来源，服后不伪造持续药效。

### 5.5 单一入口与交互

- 只保留一个修行 DOM controller。
- C 键、世界命令栏“修行”、暂停菜单“修行”全部打开同一个 `[data-app-surface='cultivation']`。
- 旧 Pixi `layers.cultivation` 文本面板退役，或仅保留不可见兼容壳；不允许双真源。
- 暂停菜单进入修行时保存单层 return context（pause surface + 原“修行”按钮）。Escape/关闭修行后重新打开 pause 并聚焦该按钮；C 键和世界命令栏则分别恢复到原 canvas/命令按钮。不能用“先关 pause 再忘记来源”的现有路径冒充焦点恢复。
- 每枚携带丹药使用原生 `button`。
- 有效预览优先级：`hovered ?? focused ?? committedSelection`；pointerleave/blur 回到 click/tap/Enter/Space 固定的选择。
- 按钮至少 44×44px；Tab/Shift+Tab 进入现有 focus trap；Escape 关闭并按入口恢复焦点。
- 无丹时仍显示人体和说明性空状态。

### 5.6 可访问性与视觉门

- SVG 有文本镜像：当前阶段、永久封堵列表、当前层百分比、候选丹名/mode/目标/真实数值/丹毒风险。
- 只在语义 tuple 变化时更新 `aria-live='polite'`，禁止每帧播报。
- 截掉全部文字后的独立截图必须可辨识为正面人体/经络图。
- 同屏必须出现红虚线、金实线、月白候选 halo；灰阶下仍由线型、线宽、空/实心节点区分。
- 低高度横屏可垂直滚动但无水平滚动。

## 6. P1-3：天劫/寿元命数 HUD

### 6.1 Shell 常驻架构

在 `#game-shell` 下、所有 `[data-app-surface]` 与 `#app` 之外增加：

```html
<aside id="fate-hud-layer">
  <section id="fate-pressure-card"></section>
  <section id="active-tribulation-countdown"></section>
</aside>
```

- controller 的可见性基于底层 `flow.screen` 和“是否为活跃游戏”，不能只看当前 surface。
- `#fate-hud-layer` 不带 `data-app-surface`，层级为 surface 上方，`pointer-events: none`；压力卡和顶部条都不成为输入目标。
- world 及 inventory/map/cultivation/pause/settings overlay、alchemy、tribulation、aftermath 都可见；settings 只有从活跃游戏打开时显示，从 title 打开时不显示。
- boot、boot-error、title、prologue、ending、portrait-blocked 与 `gameOver` 不显示；这些状态不存在可继续操作的游戏 HUD。
- 命数卡无可操作控件，不抢焦点、不拦截世界输入。
- world 模式把现有 objective rail 下移到命数卡下方；flow frame 在 HUD 可见时预留右侧 rail 宽度，活动倒计时可见时再预留顶部高度。960×542 与 736×414 必须用实际 bounding box 断言无遮挡。
- 因现有页面使用 `aria-modal`，overlay/screen 激活时视觉 HUD 保持显示，但其可访问摘要镜像到当前 surface 内的 sr-only 节点；避免让屏幕阅读器越出 modal。world 模式下由 HUD 自身提供 status 摘要。

### 6.2 只读调度快照

`readTribulationSchedule(state, params)` 返回：

```ts
interface TribulationScheduleSnapshot {
  phase: 'unscheduled' | 'ready' | 'countdown' | 'due' | 'closed';
  eligibilityBlocker: 'mortal' | 'foundation' | 'purple-omen' | 'ascension-eve' | 'post-ascension' | null;
  stage: number;
  foundation: number;
  foundationCap: number | null;
  windowDays: number | null;
  daysRemaining: number | null;
  totalDays: number | null;
  progress: number | null;
  forcedCountdownStartsInDays: number | null;
  latestResolutionInDays: number | null;
  source: TribulationCountdownSource;
  lifespanRemainingDays: number;
  lifespanWarningDays: number;
  lifespanPreemptsTribulation: boolean;
}
```

idle 已就绪时的条件上界按“从现在起只过夜、不做其他动作”计算：

```text
W = max(3, tTribBase - min(max(stage - 1, 0), 4))
delayStart = max(1, W - readyDays)
lifeStart = lifespan <= warning
  ? 1
  : ceil((lifespan - warning) / lifespanDailyLoss) + 1
forcedStart = min(delayStart, lifeStart, 当前已越线的 debt/attention 来源)
latestResolution = forcedStart + W - 1
```

app 只能消费该快照，不能复制公式。查询必须在冻结 state 上无写入。

### 6.3 文案与数字真值

第一大行始终保留“下次天劫”槽位：

| 状态                     | 文案                                                     |
| ------------------------ | -------------------------------------------------------- |
| countdown                | `距下次天劫：N日`                                        |
| due                      | `距下次天劫：0日（天劫已至）`                            |
| idle 且已就绪            | `距下次天劫：最迟 N日`，副文案“若不主动引劫，按当前劫势” |
| stage 0                  | `尚未踏入偷天诀`，并显示“成劫后催讨窗：最多 N日”         |
| idle 未满根基            | `距下次天劫：尚未定日`，并显示“成劫后催讨窗：最多 N日”   |
| stage 7 / choice-pending | `飞升前夜·不再排常规劫期` / `天门已开，抉择未定`         |
| stayed-in-world          | `此界劫数已定·不再引劫`                                  |

这里的“尚未定日”是正典真值：未达资格前，玩家训练和资源动作可无限改变成劫日，不能伪造绝对数字。
未排期状态显示的“成劫后催讨窗”不是当前日期预测，而是从取得资格那一刻起的条件上界 `2W - 1` 日；必须明确写“成劫后/最多”，不得省略限定词。

第二大行始终显示：

```text
距大限：N日
```

N 直接来自 `lifespanRemainingDays`；推进一天按真实 loss 减少，突破/任务延寿后立即增加，归零显示“大限已至”。`stayed-in-world` 只冻结常规引劫进度，寿元仍按 `advanceLifespanDay` 真实下降，绝不能写成“寿元冻结”。

第三组显示：

```text
备劫 80% · 丹✓ · 阵1/2
建议：先补绝缘阵再引劫
```

准备度复用共享纯 `computePrepScore` 真值，丹药覆盖三种避雷丹或已服 ward，阵法使用真实 active 数量。建议不得与真实 pill/array 状态冲突。

### 6.4 顶部活动倒计时不可被替代

- `#active-tribulation-countdown` 独立于压力卡，屏幕顶部居中。
- `state.tribulation.status === 'countdown'` 时显示大字号“N日”、来源、进度条和剩余/总日数。
- `due` 时显示“天劫已至”；正式实时 `MM:SS` 状态只有在模拟提供权威时钟时才显示，P1 不用 `Date.now()` 或 app 层假时钟伪造。
- 右侧/底部压力卡仍显示寿元与准备度，但不能遮挡或替代顶部条。
- 当前世界 T 键必须改走真实 `applyAction({kind:'invoke-tribulation'})`；禁止继续直接调用 `recordTribulationInvocation() + runTribulation() + breakthrough()` 绕过准备窗。
- 日期推进由生产 `advanceDay` 真实递减；到期沿用真实 due 结算。
- 旧即时 T 路径现有的雷光/粒子、tribulation SFX、突破/存活/死亡 Toast 必须迁到日终真实事件消费：`tribulation-end`、`tribulation-due-resolved`、`breakthrough`、`ending`。普通 day summary 不得覆盖劫后结果。
- 当前生产 `advanceDay` 会在 due 后立即结算并 clear；`0日` 是容错/事件瞬间文案，不能假设玩家可长期停留在 due 页面。正常路径重点验收“N=1 → 劫后结果反馈”。

### 6.5 危险等级、响应式与播报

`tribulationPressurePresentation` 输出 `calm | warning | critical`，取天劫与大限中更严重且更早到来的压力：

- calm：灵气青 + “尚有余裕”。
- warning：金色 + “需尽快补足”。
- critical：朱砂红 + “天劫/大限迫近”。

若活动天劫剩余日数大于寿元，危险源必须由大限主导并显示“**大限早于劫期**”；不能因为 countdown 已启动就声称仍有 N 日安全准备。该组合需覆盖旧档、任务改寿元和测试夹具。

颜色之外同步改变边框线型、图标、标题和数字字重。遵守 app-shell 无 CSS animation/gradient 约束；P1-3 不新增声明式脉冲。

响应式：

- 960×542：右侧纵向卡 + 顶部居中倒计时。
- 736×414 / 844×390：底部横向紧凑卡，建议压为一行；不遮挡命令栏、触控区和主按钮。
- portrait gate 不显示游戏 HUD，保持既有横屏阻断语义。

可访问摘要在以下语义 tuple 任一变化时更新：劫期/来源、寿元、准备度、丹药、阵法、建议、危险级、终局状态。禁止每帧 `aria-live`。

## 7. 错误、兼容与安全边界

- 缺失 Herb/Recipe/Pill 定义：显示安全 ID/“用途未识别”，不抛渲染异常。
- `growthThreshold <= 0`、NaN 或越界 growth：纯 query 钳到 0..1；测试记录，不污染 sim。
- 一次结算多株成熟：每株视觉更新，成熟声按批次有界合并。
- 背包没有丹药：身体图继续显示真实进度。
- 库存变化后，若已选择丹药不再存在，回到第一枚可用丹或空状态。
- `destroy()` 移除 DOM listener、observer、MediaStream track 和 AudioNode 连接。
- 动态文本一律使用 `textContent`/属性 API，不把内容字符串送入 `innerHTML`。
- test-only 快进、音频 tap 和调试快照必须在生产构建 tree-shake 掉，或由编译期 DEV/E2E 门双重关闭；输入必须校验有限值与合法 ID。
- 新 `PillDef.bodyTarget` 只属内容/表现 metadata，不进入 `GameState`、存档或 replay；朱砂草内容会改变内容 hash，必须做兼容登记。
- 不改随机流顺序；真实 `crop-mature` 和收获证据使用固定 seed 并复跑 golden replay。

## 8. TDD、自动门与证据

每项按 RED → GREEN → REFACTOR：

1. 先写失败的纯函数/内容/DOM 单测。
2. 再写失败的浏览器真实交互门。
3. 实现最小生产路径使专项门通过。
4. 重构后复跑专项、`test:fast`、类型、格式、治理与相关回放。
5. 主代理亲自运行验证；实现 agent 不能自证完成。

### 8.1 P1-1 门

- 内容：朱砂草/种子/商店或交易/选种路径/丹炉可选丹方/图标 manifest/雷抗字段/schemaHash 兼容。
- 热栏：11 槽可由 Q 完整循环，1–0 语义与帮助文案真实；浏览器从第 10 槽按 Q 选到朱砂草并按 Z 成功播种。
- sim：真实投料雷抗点汇总；达到 5 点时 `recipe.ward-cinnabar` 可进入候选，低于 5 点时被排除；现有避雷丹方行为不变。
- 集成：`seed.cinnabar` 生产可选 → Z 真实播种 → 真实成熟/收获进入品质库存 → 丹炉选择 `recipe.ward-cinnabar` → `brewPills` 真实扣除朱砂草/和合叶 → 产出 `pill.ward-basic`。把朱砂草 points 改成 0 时配方必须被拒，证明“+5”不是装饰字段。
- presenter：五段边界、单调、reduced-motion、无效阈值。
- SFX：真实 `crop-mature` 唯一排队，多株成熟有界去重。
- 生命周期：同一株成熟后继续推进多日只会衰减/枯萎，永不再次发 `crop-mature`；存档恢复后同样成立。
- Browser：真实按键播种，生产 day API 跨四阈值；100% 仅一个 `crop-mature`；按 V 收获；作物移除；普通+品质总库存 delta=1。
- 证据：15±1 秒 WebM、五阶段截图、事件审计；WebM 必须有非静音 Opus 音轨。

### 8.2 P1-2 门

- presenter：stage0；stage1–6 的 0/50/100%；stage7；choice-pending；两种 victory；所有非飞升死亡。
- 断言封堵单调、当前层 100% 非金、stage7 非全金、final-aperture 不读 cap7。
- 表驱动覆盖 13 丹、未知丹、无库存、active buff 与候选分离。
- SVG/DOM 绑定：按 `[data-body-part-id]` 查询每个 group，逐部位断言 open=红虚线/空心、sealed=金实线/实心、tempering=红虚线底+青进度、candidate=独立 halo；禁止只测 presenter 不测实际图形属性。
- DOM：hover/focus/click/tap、pointerleave/blur 回退、库存移除回退、destroy 后不响应。
- 入口返回：C、世界命令栏、暂停菜单三条路径分别验证关闭后的 surface 与精确焦点恢复；暂停路径覆盖单层 return context。
- Browser：三种尺寸、三条真实入口、focus trap、Escape/焦点恢复、无水平溢出、44px。
- 人眼：带文字完整截图 + 去文字纯人体截图；2 秒可辨识门。

### 8.3 P1-3 门

- query：deep-freeze 下覆盖 stage0、idle 未就绪/已就绪、delay/debt/attention/lifespan、countdown、due、stage7、留世与 closed；调用前后 state 深相等。
- migration：旧 `cultivation` → `bodyFoundation` 的兼容写入只由显式 normalize 测试覆盖；任何 read query 均不得顺便迁移。
- 倒计时：真实 T 键进入 countdown；同日重复 T 不重置；推进一天 N 精确减 1；到期进入 due/真实结算。
- 劫后反馈：真实 `tribulation-end` / `tribulation-due-resolved` / `breakthrough` / `ending` 恢复旧即时路径拥有的音画和结果文案，且不被普通日结 Toast 覆盖。
- 准备度：0/20/40/60/80/100%，三种 ward pill、已服 ward、阵法 0/1/2+，建议一致。
- DOM：semantic tuple 变化才播报；overlay modal 使用 surface-local 摘要镜像；destroy 清理。
- Browser：逐一穿越 world → inventory → map → cultivation → alchemy → tribulation → aftermath → pause → 游戏内 settings，并断言同一 shell HUD 可见、数值未复制漂移；进入 ending/gameOver 后断言 HUD 隐藏。
- 尺寸：960×542、736×414、844×390；calm/warning/critical/due；无遮挡。

### 8.4 P1 总门

- P1-1、P1-2、P1-3 专项门全部通过。
- 音画视频、肉身面板桌面/移动/纯人体截图、命数 HUD 三危险级与跨 surface 证据通过独立人眼审查。
- `pnpm governance:check`、`pnpm typecheck`、`pnpm test:fast`、构建、关键浏览器流程和 `git diff --check` 全通过。
- 复跑 first-loop、公开试玩纵切片、触屏流程、golden replay 和 P0 视觉门。
- 无未授权颜色字面量、随机渲染、`src/sim → render/app` 依赖或生产 debug 后门。
- P1 总门和独立审查通过前不得开始 P2。

## 9. 实现顺序

1. **P1-1**：按 content-add 管线加朱砂草与真实雷抗/丹方/可达种植路径 → 生长 presenter → SFX/收获反馈 → 浏览器真实闭环 → 有声 WebM → 独立审查。
2. **P1-2**：`BodySealPartId` / `PillDef.bodyTarget` → 纯 presenter → 单一修行 DOM controller → 三入口统一 → 响应式/a11y → 截图审查。
3. **P1-3**：只读调度 query → 修正 T 键接线 → shell HUD + 顶部活动倒计时 → 跨 surface/a11y/响应式 → 截图审查。
4. P1 总门通过后才进入 P2。

## 10. 明确不做

- 不新增独立吞吐量、漏失率、净留存或逐部位存档。
- 不把 stage7、服飞升丹或 choice-pending 画成已经全身封堵。
- 不引入周期性绝对天劫日期、未就绪强制渡劫或 app 假时钟；这类机制变更需另立决策。
- 不重做整个 HUD，不引入前端框架或新渲染依赖。
- 不改变现有避雷丹、雷击木和教学丹方的既有行为；朱砂草走增量内容与兼容路径。
- 不提交、推送、开 PR 或发布，除非用户另行明确授权。
