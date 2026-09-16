# 35 · 修仙游戏设计对标 / 益智顿悟机制 / Web Audio 程序化音乐（2026-09-15）

> 方法：Web Audio API MDN 实测抓取 + itch.io/Baba Is You/Wikipedia 领域
> 知识综合（部分源超时/403 已标注）。目标：为修途系统、天劫解谜、
> BGM 生成三域找可参考的设计范式与技术方案。

## 一、修仙/仙侠游戏设计对标

### 1.1 修仙游戏核心循环谱系

修仙题材游戏的核心循环普遍围绕**境界突破**展开，变体在于：
- **资源积累型**（Amazing Cultivation Simulator）：种田/炼丹/打坐 → 突破
- **文字/按钮型**（按钮修仙/想不想修真）：纯数值增长 + 事件选择
- **Roguelite 型**（太吾绘卷/鬼谷八荒）：随机世界 + 传承 + 构建
- **放置型**（一念逍遥）：挂机 + 境界推进

本项目（永恒山谷）的核心循环：日程六格 → 事件 → 参悟 → 天劫 →
渡劫/身死 → 劫灰传承 → 后来人——与太吾绘卷/鬼谷八荒的 roguelite 型
最接近，但用 Sokoban 解谜替代了传统战斗。

### 1.2 天劫系统对标

| 游戏 | 天劫/突破机制 | 与本项目对比 |
| ---- | ------------ | ----------- |
| 鬼谷八荒 | 雷劫 QTE（走位躲避） | 本项目 = 推箱折射（策略性 > 反应性） |
| 太吾绘卷 | 内力催关 + 随机事件 | 本项目 = 确定性棋盘（可规划性更强） |
| Scha Guang | 功法组合 + 五行相克 | 本项目 = 阵石类型组合（约束更明确） |
| 了不起的修仙模拟器 | 五行聚灵阵 + 天劫 QTE | 本项目 = 推箱折射（无 QTE） |

**设计差异**：本项目将天劫从"战斗/反应"转为"推箱解谜"，
在同题材中为独创——保留了"肉身承受雷威"的修仙感，
但用确定性策略替代了反应性 QTE。

### 1.3 可借鉴设计范式

| 范式 | 来源 | 本项目适配 |
| ---- | ---- | --------- |
| 五行相克 | 鬼谷八荒/了不起的修仙 | 阵石已有 mirror/conductor/insulator，可扩展五行属性 |
| 功法组合 | Scha Guang | 残卷系统已有 8 节点（§6.1 扩绝缘玉封），可扩为组合技 |
| 灵根/资质 | 鬼谷八荒 | 凡骨/灵根设定已有，但未影响开局资源分配 |
| 心魔/道心 | 太吾绘卷 | 凡心/心压已有，可扩展为天劫中的额外干扰机制 |
| 双修/宗门 | 鬼谷八荒 | 需扩 NPC 交互系统，成本高 |

## 二、益智游戏"顿悟"机制研究

### 2.1 Baba Is You：规则操作 = 顿悟引擎

Baba Is You 的核心创新：**游戏规则本身是可操作的对象**（"BABA IS YOU"
可以推改）。每个谜题的"顿悟时刻"来自玩家发现"哪个规则可以改"。

**本项目对标**：天劫棋盘的顿悟时刻 = 玩家发现"哪个镜应该推、推到哪、
光路怎么折"。生成器已确保可解且难度带控制，但"顿悟感"取决于：
- 初始局面是否让玩家看到"错误的配置"（镜不在光路上）
- 正确推序是否存在一个"突然理解"的时刻
- 错误尝试是否给出足够信息（而不是纯粹的试错）

**改进方向**：在 HUD 的劫式描述中增加一行"当前镜位置偏移提示"
（如"折雷镜偏离光路 2 格"），帮助新手建立空间推理。

### 2.2 The Witness：环境教学 + 约束渐进

The Witness 的教学面板从不使用文字——玩家通过解简单面板自然理解规则，
然后遇到需要组合多个规则的复杂面板。关键设计原则：
- **每个新机制先单独出现**（无干扰）
- **然后与已有机制组合**（渐进复杂度）
- **最后出现需要"逆向思维"的变体**（真正考验理解）

**本项目对标**：stage 0 = 单镜基础折（教学）；stage 1-2 = 加绝缘/导雷
（组合）；stage 3+ = 多镜+宽脉桥（组合+逆向）。生成器已有难度带控制，
但缺少**每个新阵石类型的首次出现**是否配有"安全练习板"的保证。
**建议**：为 conductor/insulator/wide 的首次出现生成无干扰练习板。

### 2.3 Outer Wilds：知识即进度

Outer Wilds 的核心理念：**没有升级系统，玩家的"进度"就是他们对
世界的理解**。每个谜题的解法需要玩家将不同来源的信息组合。

**本项目对标**：残卷（参悟）系统 = 知识收集机制；不同残卷组合影响
天劫准备（预见面板/护脉丹/撤步）。这与 Outer Wilds 的"知识组合解锁
新路径"高度同构。**改进方向**：让残卷组合在天劫棋盘上产生**视觉
差异**（如已参悟的节点对应的阵石有特殊标记），强化"知识改变游戏"
的感知。

## 三、Web Audio 程序化音乐生成

### 3.1 原生 Web Audio API 能力

| 能力 | API | 项目现状 |
| ---- | --- | ------- |
| 振荡器合成 | OscillatorNode + PeriodicWave | generativeMusic 已用 |
| 精确调度 | AudioParam scheduling | generativeMusic 已用 |
| 效果链 | BiquadFilter/Convolver/Delay/Compressor | bgm.ts 已用部分 |
| 空间音频 | PannerNode/StereoPannerNode | 未使用 |
| 自定义 DSP | **AudioWorklet**（离主线程） | 未使用 |
| 离线渲染 | **OfflineAudioContext** | 未使用 |

### 3.2 对本项目的建议

| 方向 | 技术方案 | 价值 | 成本 |
| ---- | -------- | ---- | ---- |
| 离线渲染 BGM | OfflineAudioContext 预渲染 stem | 消除实时合成 CPU 开销 | 低 |
| 空间音频 | PannerNode 让天劫雷声有方向感 | 沉浸感↑ | 低 |
| AudioWorklet 自定义合成 | 绕过主线程的实时合成 | 高阶 BGM 无卡顿 | 中 |
| 程序化环境音 | OscillatorNode + Noise + Filter 生成风声/雨声 | 替代静态音频文件 | 中 |

**当前 io/bgm.ts 已使用 Tone.js**（Web Audio 高层框架），底层即
Web Audio API。Tone.js 的 Transport 调度和 Instrument 抽象已覆盖
大部分需求。**建议**：仅在需要自定义 DSP 或离线渲染时引入原生
Web Audio API，否则继续使用 Tone.js。

## 四、采纳判定汇总

| 资源/范式 | 判定 | 动作 |
| --------- | ---- | ---- |
| 修仙游戏天劫系统对标 | 参考 | 本项目推箱折射在同题材中为独创 |
| 新阵石类型安全练习板 | **采纳建议** | 生成器为 conductor/insulator/wide 首现生成无干扰练习板 |
| Baba Is You 顿悟设计 | 参考 | HUD 加镜位偏移提示（低成本） |
| The Witness 约束渐进 | 参考 | 生成器已有难度带控制，可强化"新机制首现"保证 |
| Outer Wilds 知识即进度 | 参考 | 残卷已有，可加棋盘视觉差异标记 |
| Web Audio OfflineAudioContext | **采纳建议** | 预渲染 BGM stem 消除实时合成开销 |
| PannerNode 空间音频 | 参考 | 天劫雷声方向感（沉浸感↑） |
| AudioWorklet 自定义 DSP | 不适用 | Tone.js 已覆盖需求 |

## 五、下一轮行动计划

1. **生成器新阵石安全练习板**：conductor/insulator/wide 首次出现时
   生成无干扰教学板（改 generator 或 cultivation-run 的 requiredBlockKinds）
2. **BGM 离线渲染**：用 OfflineAudioContext 预渲染 BGM stem，
   消除实时合成开销（改 io/bgm.ts）
3. **天劫雷声方向感**：PannerNode 让雷声从实际雷击方向传来（改 io/audio.ts）
EOF

## 六、执行记录（2026-09-15 当轮落地）

### 6.1 绝缘玉封参悟节点（已落地）——补全绝缘石的知识解锁链

调研过程中发现参悟 DAG 与阵石解锁链的断层：`interpretCultivationTribulationTags`
只处理 `tribulation:block:thunder-guiding-stone`（引雷阵石 → conductor），
**不存在解锁绝缘石的参悟节点**。当时误判为「绝缘石真实不可达」——实际上
旧 `selectedFeatureKinds` 有 stage 概率注入（stage≥1 约 49% 概率白送绝缘特性），
绝缘板早已出现，只是**玩家无法控制、与知识进度脱钩**（§6.5 据此实施严格知识
门控）。本节修复把绝缘石变成确定性解锁，方向正确；动机表述以本勘误为准。

修复（The Witness"约束渐进"范式落地：阵石支系 引雷阵石 → 绝缘玉封，
玩家先在 conductor 板建立折射直觉，再引入阻断约束）：

| 文件 | 变更 |
| ---- | ---- |
| `src/sim/cultivation-run/insight.ts` | 七节点 → 八节点 DAG：新增 `insulating-jade-seal`（绝缘玉封，cost 4，前置 thunder-guiding-stone，tag `tribulation:block:insulating-jade-seal`） |
| `src/sim/cultivation-run/tribulation-effects.ts` | 新 tag → `unlockedBlockKinds` 增加 `'insulator'`（去重） |
| `src/sim/cultivation-run/legacy.ts` | `knowledge:insulating-jade-seal` 碑记知识候选（继承解锁 + 悟痕 2） |
| `src/app/cultivationRun/insightSurface.ts` | 效果文案 + 参悟图网格布局（阵石支上行：引雷→绝缘，col4/row1；丹方支下行不变） |
| `tools/cultivation-metrics.ts` | bot 参悟策略改显式优先级表 `INSIGHT_UNLOCK_PRIORITY`：与旧七节点有效解锁序前缀一致，绝缘石排末位（仅 ≥8 次参悟的超长对局进入棋盘），保基线带可比 |

**教训**：向 `CULTIVATION_INSIGHT_NODE_IDS` 中部插入节点会改变所有
"按数组序遍历"的策略工具行为——`cultivation:check` 首跑出带
（hybrid.ascensionRate 0.500 < 0.65 下界，bot 提前花 4 悟痕解锁绝缘石、
推迟护脉/紫兆所致）。前缀稳定优先级表修复后回到 75.0%（带内）。

**验证**：typecheck / 全量 1062 单测+属性 / content:lint /
golden replay 4/4 / cultivation:check 基线带 / governance 三门，全部通过。

### 6.2 后续待办

- §五 3（雷声方向感）：**已落地**（见 §6.3）
- §五 1（安全练习板）：绝缘石已通过 DAG 前置（引雷→绝缘）获得
  "先易后难"渐进；首现无干扰练习板仍待真人试玩确认需求
- §五 1（安全练习板）：绝缘石已通过 DAG 前置（引雷→绝缘）获得
  "先易后难"渐进；首现无干扰练习板仍待真人试玩确认需求
- 真人试玩工作单：docs/30 §六（零苦练首劫死率 / ascetic 首劫死率 /
  「先锻体」引导触达）

### 6.3 雷击空间音效（已落地）＋ BGM 离线渲染否决记录（2026-09-16）

**§五 3 落地**：主模式天劫棋盘原本没有任何"雷落"瞬时的声音——只有结算后的
突破/爆炸音。本轮补齐最后一声雷：

| 文件 | 变更 |
| ---- | ---- |
| `src/io/audio.ts` | 新增 `'thunder-strike'` SfxId 与合成层（近场 Farnell 变体：噪声高通 2.5k→400 劈击 + 正弦 70→40Hz 雷体 + 0.45s 程序化 IR 尾）；新增 `playSfxAt(id, pan)`——临时 StereoPannerNode 汇点（`sfxSink`），`tone`/`noiseBurst`/`sfxrSynth` 三帮助器优先接 sink，同步派发后还原 |
| `src/app/rogueliteProto/surface.ts` | `RogueliteProtoAudio` 桥加 `playSfxAt?`；`syncTribulationSession` 在 outcome 首现（唯一收口点）时按「光路源 - 肉身」横向偏移计算 pan（clamp ±0.8）发声；`timeout`（步数耗尽，无雷落）不发声 |
| `src/app/main.ts` | roguelite 桥装配 `playSfxAt` |

**§五 2 否决（有据）**：Tone.js 的 Synth 建立在原生 WebAudio 节点
（OscillatorNode/增益包络）上，逐样本 DSP 跑在浏览器音频线程的原生代码里，
主线程只承担 Transport/Part 的事件调度——"实时合成开销"比预想小一个量级。
离线预渲染需付出缓存内存（每 context 键 ~14MB float32 立体声）、资产重量或
过渡接缝的代价，收益不成比例。维持 docs/35 §三 判定原文："仅在需要自定义
DSP 或离线渲染时引入原生 Web Audio API，否则继续使用 Tone.js"。

**验证**：typecheck / 1015 单测 / 浏览器 45/45（keypoint 用例在真实
Chromium + 真实 WebAudio 下驱动天劫结算，新路径执行无错）全部通过。

### 6.4 HUD「未入光路」计数（已落地，2026-09-16）

§2.3 Baba Is You 顿悟设计的第一刀：天劫 HUD 新增「未入光路 N」段——
未被当前光路触及的**折光/导雷**阵石数。光路本就逐帧可见，此计数只省去
逐格点数的认知负荷（"看见错误配置"），不泄露解法位置。

**语义修正（实现中发现）**：绝缘石不计入——`installInsulatorSeal` 把
绝缘石推入直路封断，正解光路绕行，绝缘石在终局布局中恰恰常在光路之外；
计入会让"归零"启发式误导玩家。绝缘石的"入径"语义是封位而非导光。

| 文件 | 变更 |
| ---- | ---- |
| `src/app/rogueliteProto/surface.ts` | `syncHud` preparationSegments 增「未入光路 N」段（mirror+conductor，绝缘石豁免） |
| `tests/browser/roguelite-proto.spec.ts` | 天劫 HUD 断言 `/未入光路 \d/` |

**附带巡检**：全库可达性扫描（76 文件，入口 src/app/main.ts）报 9 个
不可达候选，逐一甄别均为正当消费者（tools/单测/环境声明），无真孤儿——
应用包不含任何死模块。docs/27 §705 与 docs/35 §一 的「7 节点」陈旧计数
已同步为 8。

**验证**：typecheck / 浏览器 45/45（含新 HUD 断言）/ 桌面+844×390 截图
确认单行渲染无溢出。

### 6.5 严格知识门控（已落地，2026-09-16）——§6.1 勘误的工程结论

§6.1 的勘误（stage 概率注入使绝缘板与知识进度脱钩）引出本轮主改动：
**移除旁路，阵石特性严格由参悟 DAG 声明**。

| 文件 | 变更 |
| ---- | ---- |
| `src/sim/sokoban/generator.ts` | `selectedFeatureKinds` 移除 stage 概率注入；`installConductorBridge` wide 双道筛选（实际附着率 ~1.7% → 22.5%，对齐调参 20%） |
| `tests/unit/sokoban-generator.test.ts` | 新增「知识门控」钉子测试（无 options 恒 ['mirror']）；劫式组合测试改显式请求 |
| `tests/unit/sokoban-frontier-upgrades.test.ts` | 带收敛/宽脉桥测试改显式请求（保留原测试意图） |
| `tests/replay/fixtures/cultivation/…replay.json` | 生成序列变化，按策略 `--init` 全新重授权 |
| `docs/32` §23 | 门控后分阶分群体数据 + 基线带免重校准证据 |

**设计依据**：docs/31 §3.3 正交契约（残卷轴=合法性门）+ §3.3 P2（稀有度
残卷门控）+ The Witness「新机制首现可控」（§2.2）。玩家现在必须参悟
引雷阵石/绝缘玉封才会见到对应劫式——知识获得与机制登场严格同步。

**数据结论**：解锁群体 stage 2-6 全带内；未解锁群体中盘低于带心（预期
代价，预算自适应补偿）；`cultivation:check` 基线带**免重校准**带内
（hybrid 飞升率 87.5%）。细节见 docs/32 §23。

### 6.6 绝缘玉封可达性核查（2026-09-16）

`cultivation-metrics` 新增「参悟解锁分布」统计（LifeOutcome.insightUnlocks
按代累计聚合）。seeds=8 × 换代上限 4 实测：

| 策略 | 解锁分布 |
| ---- | -------- |
| hybrid（飞升代理） | foundation:8 field:8 clear-furnace:8 **thunder:8** warding:7 violet:2 **insulating-jade-seal:2** ash:1 |
| ascetic | foundation:8 field:4 clear-furnace:1 |
| balanced / herbalist | foundation:14 / 13（早期过载身死，参悟经济未展开） |

判读：绝缘玉封在 bot 的**故意末位**优先级下于 2/8 飞升 campaign 可达；
对玩家它是 cost 4、紧随引雷阵石的可选深度节点——想要绝缘内容可主动提前
解锁（真实玩家路径不受 bot 优先级约束）。内容价值真实，非摆设。
bot 端 thunder-guiding-stone 8/8 全解锁 ⇒ 严格门控后 conductor 板照常
进入 bot 对局，与 §23 基线带免重校准的结论互洽。

### 6.7 新阵石首现教学板（已落地，2026-09-16）

§6.5 严格门控的后续一刀（§2.2 The Witness 式首现可控的最后一块）：玩家
campaign 中**首次结算含某阵石特性的劫式之前**，该类特性首现的棋盘保证
无干扰构造——关闭全部修饰（wide/mirror-ccw/burning）并把生成器灵草封顶
1 株，首现注意力留给新机制本身。

| 文件 | 变更 |
| ---- | ---- |
| `src/sim/sokoban/generator.ts` | `GenerateBoardOptions.teaching`：修饰全关 + 灵草 ≤1 |
| `src/sim/cultivation-run/types.ts` | `conductorBoardsSettled` / `insulatorBoardsSettled` 可选计数（历代累计，旧档缺省 0） |
| `src/sim/cultivation-run/agenda.ts` | 创建状态初始化 0/0 |
| `src/sim/cultivation-run/tribulation-settlement.ts` | 请求可选 `boardKinds`，结算时累计；**身死未结算不计数——继承者首见教学板会重新触发（重教语义）** |
| `src/app/rogueliteProto/surface.ts` | `buildTribulationBoard` 按「已解锁 ∧ 从未结算」计算 teaching；结算回写 boardKinds |
| 测试 | generator teaching（无修饰/灵草≤1/仍可解 + 对照）、settlement 计数（旧档从 0 起计/缺省不触碰）、agenda 默认状态形状 |

**判定语义**：教学触发条件 =「该特性已解锁 ∧ 该特性从未被结算」。换代保留
计数：一旦某特性在任意一世结算过一次，后世不再重复教学；若玩家死在首块
教学板上（无结算），继承者面对的同特性首板仍是教学板。

**验证**：typecheck / 1067 全量 / 浏览器 45/45 / 基线带免重校准 /
golden replay `--init` 重授权 4/4（state 序列化新增两字段）全部通过。
