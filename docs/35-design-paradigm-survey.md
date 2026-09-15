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
| 功法组合 | Scha Guang | 残卷系统已有 7 节点，可扩为组合技 |
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

### 6.1 绝缘玉封参悟节点（已落地）——修复 insulator 真实不可达

调研过程中发现比"安全练习板"更根本的问题：**绝缘石（insulator）在真实
对局中没有任何解锁入口**——`interpretCultivationTribulationTags` 只处理
`tribulation:block:thunder-guiding-stone`（引雷阵石 → conductor），
`insulator` 仅存在于测试 keypoint（surface.ts 的 `['conductor','insulator']`
硬编码）。生成器的绝缘封路构造（`installInsulatorSeal`）在真实游玩不可达。

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

- §五 2（BGM 离线渲染）、§五 3（雷声方向感）：待实施
- §五 1（安全练习板）：绝缘石已通过 DAG 前置（引雷→绝缘）获得
  "先易后难"渐进；首现无干扰练习板仍待真人试玩确认需求
- 真人试玩工作单：docs/30 §六（零苦练首劫死率 / ascetic 首劫死率 /
  「先锻体」引导触达）
