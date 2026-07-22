# 24 · 灵韵叙录 UI/UX 对标调研与升级纲要

> 对照「成熟市场、同模式或近模式」作品，诊断当前简陋点，给出可执行升级。  
> 模式定位：**第一人称沉浸叙事 / 选择驱动 / 多结局 / 水墨境象 + 心声多声部 + 叙录图鉴 + 元叙事**，不是第三人称修仙模拟本体。

---

## 0. 一句话结论

成熟同类的共同标准是：

1. **境象占主权**（CG/场景 70%+），UI 是可消失的「读纸」  
2. **阅读工业件齐全**（姓名板、CTC、Auto/Skip/History/Hide、字号）  
3. **选项有分量**（位置、延迟、文案长度、锁因），不用数值条剧透  
4. **系统界面 diegetic**（玉简/识海/残卷），少用齿轮工具条  
5. **图鉴/回想保沉浸**（节点图 + 未解锁两档）
6. **分支先兑现再汇流**：重大结果来自选择串；即时、短期、终局三层回响缺一不可

灵韵叙录改造前同时存在两类问题：视觉上像「深色卡片里的 demo」，叙事上则是选项很快汇流、功法与终劫一笔带过、回访重复播放。升级必须同时处理阅读界面与因果结构，不能只换皮。

---

## 1. 对标作品卡片（精选）

### 1.1 Disco Elysium — 内心多声部
- **哲学**：对话是成瘾信息流；技能声 = 人格化旁白  
- **可抄**：六色声部 + 字重/斜体冗余（心魔/师尊/直觉）  
- **勿抄**：右下 Twitter 竖栏当主阅读区（CJK 长文与水墨 CG 不适合）  
- **落点**：心声条保持窄条；主文仍底栏横读  

### 1.2 VA-11 Hall-A — 第一人称工位
- **哲学**：界面即吧台工位；选择可被「调制」替代  
- **可抄**：次级交互用世界内物件承载（点唱机 → 玉简 Quick Menu）  
- **勿抄**：常驻宽侧栏 chrome  

### 1.3 Slay the Princess — CG 主权 + 右列选项
- **哲学**：UI 退到边缘，手绘 CG 与内在 Voice 主导  
- **可抄**：全屏境象；人物与内在 Voice 直接承认此前循环和选择；选项可右偏
- **勿抄**：全程高压恐怖动效（田园/荒村需暖留白）  

### 1.4 Scarlet Hollow — 关系不计量
- **哲学**：关系被感到，不被爱心条计量  
- **可抄**：bond/defiance 只用人物称呼、条件回响、氛围层反馈；开场必须先有情绪钩子，不能只完成教程功能；角色只在剧情真正需要时登场
- **勿抄**：`好感+5` 飘字  

### 1.5 ADV 工业标准（Key / Fate / 柚子社等）
- **哲学**：理想 UI 几乎不抢戏  
- **标准件**：底栏 Textbox 1/8–1/3、Nameplate、CTC、Skip/Auto/History/Hide/Save、字号  
- **可抄**：Hide 一键隐窗；已读 Skip；History 回看  
- **勿抄**：省略 History/Hide（长期被诟病）  

### 1.6 Pentiment — 字体即声音
- **哲学**：字体分层 = 社会身份与声部  
- **可抄**：旁白墨、心魔朱砂、师尊金楷、现代日记等宽；易读字体档  
- **勿抄**：默认难认古体  

### 1.7 隐形守护者 / Detroit 式节点
- **哲学**：选择后沉淀为故事线节点图  
- **可抄**：叙录 = 章节轨 + 节点 + 结局墙（已有骨架）  
- **勿抄**：真人 FMV 产能  

### 1.8 太吾 / 仙侠 UI 语境
- **哲学**：先清晰，再风格  
- **可抄**：宣纸半透、墨线、竖列选项、古风词  
- **勿抄**：信息过载灰选项伪自由  

### 1.9 Roadwarden — 有限资源与带伤前进

- **哲学**：旅途中每次援手、绕行和消耗都会改变后续可用准备；失败常改变局面，而非简单读档抹去
- **可抄**：让木哨、药、渠、阵法成为终劫真实物件；强行淬体也能前进，但留下颤抖、旧痛、寿元与走火代价
- **勿抄**：把所有路线扩成无法维护的开放世界文本量

### 1.10 80 Days — 选择串而非孤立按钮

- **哲学**：重大结果来自连续小选择、资源与关系共同累积；同一节点会根据此前旅程产生不同意义
- **可抄**：山道抉择先改变当场行动，再影响名声/木哨，最后进入记忆锚；终局不是突然检查单个 flag
- **勿抄**：为追求组合数量而制造只有措辞不同的伪分支

### 1.11 Suzerain — 决策链与后果回访

- **哲学**：政治选择会在中期事件、关系和最终国情中多次回响，玩家能追溯“为什么走到这里”
- **可抄**：采药女救/弃分成暖冷两条后续；夺阵的把握明确来自邻田代价；E6/E7 回看一整串行为
- **勿抄**：把隐藏数值直接做成仪表盘，提前暴露最优解

### 1.12 Ink / Yarn Spinner / ChoiceScript — 分支工程方法

- **哲学**：一次性选项、条件选项、局部 weave/foldback 与自动遍历共同控制组合爆炸
- **可抄**：`once` 选后消失；互斥路线静默隐藏；hub 回访只列剩余选项；自动校验全场景/全结局可达
- **勿抄**：迁移整个叙事引擎。现有 TypeScript 纯状态机足够，重点是补齐契约与测试

---

## 2. 灵韵叙录现状 vs 标杆

| 维度 | 成熟标准 | 当前（改造前） | 差距 |
|---|---|---|---|
| 画面主权 | CG 全屏/大面积 | 深色壳 + 42vh 相框插图 | **最大** |
| 对话框 | 底栏 22–28% 半透纸 | 有，但在卡片内 | 中 |
| Hide UI | 必有 | 无 | **大** |
| Quick Menu | 小、可隐、惯例词 | 六键调试条感 | **大** |
| 姓名板 | 独立名牌 | speaker-tag 弱 | 中 |
| 选项分量 | 右列/延迟/锁因 | 有锁因；布局仍工具感 | 中 |
| 标题第二模式入口 | 明确主功能 | 米色弱按钮 | **大** |
| 结局仪式 | 落版插画+标题 | 曾空图；现改善但仍素 | 中 |
| 叙录图鉴 | 节点+未解锁两档 | 已有 | 小 |
| 多声部 | 色+形+音 | 已有六色 | 小 |

### 2.1 叙事闭环对标结论

本模式采用以下统一公式：

`旧矛盾 → 有限准备 → 递进抉择 → 明确代价 → 带伤汇流 → 身体/关系/世界回收`

- **先独有兑现，再汇流**：救人与绕行先进入不同场景，不能刚选完就共用“义举传开”。
- **三层回响**：重要选择至少有即时回应、中段 flag/关系变化、终局物件或结局回收。
- **失败带伤前进**：六重淬体的稳妥/强行都能学会方法，但收益、伤势、寿元和走火不同。
- **证据补全，不伪造经历**：神农洞府可拿出新证据补缺，不能声称玩家亲历了未选择的线索。
- **幽默服从人物**：正式序章后只保留处境反差，禁用无因果网络梗；开场开发者信笺中的自贬、MuseFlow 私货与颜文字属于一次性的第四面墙语言，但界面不对其作额外解释。
- **角色按需登场**：Black Tabby 的重写复盘表明，“为了让玩家先见全员”而安排的跑腿只会稀释情绪；本模式因此删去菜单式支线巡礼，把人物放回伤势、荒年和终劫真正需要他们的位置。
- **选项先建立信任**：选项文案必须让玩家大致理解会影响谁、当下要付什么；不以模糊按钮诱骗严格劣解，也不靠读档才能理解后果。

---

## 3. 可执行升级清单（按优先级）

### P0 — 观感从 demo → 可展示 ADV（本轮并行落地）

1. **全屏境象布局**  
   - 问题：相框插图  
   - 参考：Slay the Princess / ADV 底栏  
   - 改法：CG 铺满 stage；dialog absolute 贴底；弱化 CG 边框  

2. **隐窗 Hide UI**  
   - 问题：无法纯赏画  
   - 参考：所有成熟 ADV  
   - 改法：按钮 + `V`；点舞台恢复；仍可推进  

3. **Quick Menu diegetic 短词**  
   - 问题：字速·即时…像调试器  
   - 参考：Yuzusoft 底栏小按钮  
   - 改法：`字速/字号/自动/快进/回想/隐窗/退出` + title 全名  

4. **标题入口第二主路径**  
   - 问题：入口太弱  
   - 参考：VN Extra / 第二模式入口  
   - 改法：印章/玉简按钮、金朱边、副标题清晰  

5. **结局卡仪式感**  
   - 问题：黑底小竖条  
   - 参考：Ending plate  
   - 改法：暗幕+大图+标题层次+主按钮返回  

### P1 — 精致度（本轮已落地）

6. ✅ 姓名板独立样式 + 中文映射；旁白隐藏  
7. ✅ 重大抉择由场景内真实自语承接；删除全局重复的「须自择一途」
8. ✅ 选项区右偏限宽决策条 `min(92%, 520px)` + stagger  
9. ⏳ 转场 280–320ms 纸墨溶解；章节切换翻页感（部分已有）  
10. ✅ 叙录 timeline + 同幕 SVG 边（移动端仅 timeline）  
11. ✅ UI 音效：ui-confirm / codex-page / ui-fontsize  
12. ✅ 已读选项 `◇` + opacity 0.75（跨周目保留）

### P2 — 深度 polish

13. Backlog 做「识海涟漪」全屏纸  
14. 神农线索 Rumor graph 第二视图  
15. 易读字体 brush/print 切换（Pentiment）  

---

## 4. 设计红线（升级时勿破）

- 不把 bond/defiance 做成爱心条  
- 不引入第七色（六色 token）  
- 心声条最多 2 条 FIFO  
- 氛围层 opacity ≤ 0.35，光敏安全  
- narration 不写 `src/sim/`  
- 元叙事破框只在头（自白）尾（E7），中段沉浸  

---

## 5. 本轮实施状态

| 项 | 状态 |
|---|---|
| 调研文档（本文） | ✅ |
| P0 全屏布局 + Hide | ✅ CG 全屏 cover；底栏对话；`V`/隐窗 |
| P0 Quick Menu diegetic | ✅ 短词：字速/字号/自动/快进/回想/隐窗/退出 |
| P0 标题入口第二主路径 | ✅ 「叙」印章 + 金朱边玉简按钮 |
| P0 结局卡仪式感 | ✅ 暗幕落版 + 终局 kicker + 朱红返回标题 |
| P1 姓名板 / 抉择承接 / 决策条 | ✅ 中文名牌；真实自语承接；纸上分行，保留 1–5 快捷键但不显示圈号 |
| P1 叙录 timeline + 边 | ✅ 左侧 timeline；桌面 SVG 边；只显示有痕迹的幕 |
| P1 UI 音效 + 已读选项 | ✅ ui-confirm 等；◇ 已读跨周目保留 |
| 开场开发者自白 | ✅ 文笔润色；保留自贬、MuseFlow 产品私货与颜文字；严格隔离在 intro 信笺 |
| 叙事因果重写 | ✅ 58 个运行时场景；第二幕线性主脊；多段独有回应 + 条件回响 + 五段终劫；三条完整终局路线约 9.5k–10.2k 可读字符 |
| 重复/叠层修复 | ✅ 退出 14 个菜单/清单节点；删除重复决策提示；正文与心声不复制；舞台无底部黑带 |
| 视觉回归 | ✅ 两份 `tools/visual-audit-*.mjs` 覆盖桌面全结局；`narration-flow.spec.ts` 覆盖移动端大字号几何 |
| 浏览器/治理门禁 | ✅ narration-flow 7 项 · governance 58/58 运行时场景、8/8 结局 · typecheck |

---

## 6. 参考索引（公开讨论与业界共识）

- Ink 官方写作指南（weave / gather / choice）：<https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md>
- Yarn Spinner Options：<https://docs.yarnspinner.dev/write-yarn-scripts/scripting-fundamentals/options>
- Yarn Spinner Once：<https://docs.yarnspinner.dev/write-yarn-scripts/scripting-fundamentals/once>
- Yarn Spinner Saliency：<https://docs.yarnspinner.dev/write-yarn-scripts/advanced-scripting/saliency>
- Roadwarden 设计复盘：<https://www.gamedeveloper.com/design/deep-dive-roadwarden>
- 80 Days 叙事与设计分享：<https://www.gamedeveloper.com/design/narrative-and-design-insights-from-i-80-days-i-writing-lead>
- Suzerain 分支叙事案例：<https://www.articy.com/en/showcase/suzerain/>
- ChoiceScript 条件与高级写法：<https://www.choiceofgames.com/make-your-own-games/choicescript-advanced/>
- ChoiceScript 自动测试：<https://www.choiceofgames.com/make-your-own-games/testing-choicescript-games-automatically/>
- Black Tabby Games：5 次重写复盘（开场钩子、按剧情需要引入角色、清晰选项）：<https://blacktabbygames.medium.com/5-rewrites-that-made-scarlet-hollow-a-better-game-5e12358b7f55>
- Black Tabby Games：隐藏关系系统（语境化回响、避免好感数值诱导元游戏）：<https://blacktabbygames.medium.com/creating-a-dynamic-relationship-system-in-scarlet-hollow-eb175aa899a8>
- Slay the Princess 官方 Press Kit（选择与认知改变角色和世界，角色记得此前发生的事）：<https://blacktabbygames.com/press-stp>

这些来源支持的是结构原则，不要求迁移引擎；具体验收仍以本文第 2.1、3、4 节及工程契约为准。
