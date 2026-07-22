# 23 · 灵韵叙录：工程契约与开发护栏（自主开发遵循）

> 配套 `docs/22-narration-mode.md`（设计定稿）。本文件是叙事层 schema、UI 规范、图集产线、CI 护栏的**可执行契约**，自主开发各轮以此为准。与 `00-DESIGN-BRIEF.md` 宪法冲突时宪法优先。

## 0. 红线（不可越）

- narration 层**只读不写 `src/sim/`**；选图/判定用纯函数，**副作用只走 `effects` 声明**，禁止文本埋隐式变量改动。
- **运行时绝不调用 AI 模型**（CI 静态扫 `src/app` + `src/render` "无运行时 fetch/AI SDK"硬保证）。
- `ai_disclosed:true` 100% + `license` 非空（合规 + 口碑双红线）。
- 图集 `-vN` 版本化，**禁止原地覆盖旧图**（保护旧存档）。
- 回看模式隔离（`__REPLAY__` flag，sim 只读快照，写操作全拦截）。

## 1. Scene/节点 schema（扩展现有 `{cgAssetId,lines,choices,converge}`）

- `line` 补：`requires?`，用于在后续场景按既往选择插入真实回响句；不满足的行不进入打字队列/Backlog。
- `choice` 补：`requires?`（guard，如 `'defiance>=60 && bond<50'`）/ `effects?: Effect[]`（声明式副作用 `{set,add,flag,unflag,lore}`）/ `responseLines?: NarrationLine[]`（独有后果全部演完才汇流）/ `once?`（Ink `*` 一次性）/ `tags?[]` / `speaker?` / `ends?`。
- `tags:['hide-when-unavailable']` 专用于互斥人生与终局矩阵：守卫不满足时不渲染 DOM，不能用灰锁项泄露另一条路线；普通 `requires` 仍可显示锁因。
- `scene` 补：`id`（命名空间 `act3.tribulation.question`）/ `act` / `layerKeys?`（分层合成）/ `revisitMode?:'choices-only'` / `onEnter?: Effect[]` / `ends?: EndingId` / `status: 'draft'|'review'|'approved'` / `locale`。
- `revisitMode:'choices-only'`：首次完整播放 `lines`，回访 hub 直接列出尚余选项，不重播开场、不残留上一场正文。
- `onEnter` 只在该 scene **首次进入**时结算；回访不能重复加 bond/defiance/丹毒等数值。可重复收益必须显式建模成新的有限事件，不得靠循环刷同一节点。
- 把 `speaker` 从文本里拎出到 `Line={text,speaker?}`。
- CI 拒 `status!=='approved'` 的 Scene 进 `narrationScenes.ts` 入口。
- 变量一律进入 `NarrationState` 类型并由 `initialState()` 给出显式初值（对标 Yarn `<<declare>>`），禁止文本或 DOM 私藏状态。

## 2. 分层选图（数据驱动查表，禁脚本 `if`）

- `assets/manifest.json` 增 `cg.composite` 桶：`layers:[bg,daoAmbience,npc,tribulation]`。
- 连续变量**离散化分桶**（`defiance/bond` → low/med/high 三段），组合 ≤ 9 个氛围层。
- Scene 写 `layerKeys`，`daoAmbience:'auto'` 时由 `firstPersonView` 纯函数分桶查表。
- 写手只填 `layerKeys` 键名，美术只补 manifest 表项，**键名契约对接**。

## 3. 抗组合爆炸

- 四幕 = **线性 Gauntlet + 局部 Foldback**：第二幕按“六劫 → 人物/村落后果 → 下一劫”连续推进，只在村落半日、劫前赴约等明确时限处给有限分支，不再提供可反复清单式 storylet hub。每条分支先用 2–4 段 `responseLines` 独有兑现，再携 flag/伤势/关系进入汇流。
- 8 结局 = E0 支线 + 4 类中途失败（丹毒 / 渡劫 / 走火 / 寿终）+ 终局三路（飞升 / E6 / E7）；终局由 `(defiance≥60?, bond≥50?)` 阈值矩阵选出唯一可见路线。
- 心志抉择嵌入主脊，不单独做“任务菜单”；错过的人与物以空位、条件行和终局准备缺席呈现。
- **微差异用图层不用分支**（换道心氛围层一张图，不新写 Scene）。

## 4. 叙录界面

- 三区：顶栏章节轨(`X/4` 幕) / 主区节点图 / 侧栏图鉴墙(`X/8`)。
- 节点编码：`●`剧情 `◆`抉择 `■`场景 `▲`汇流 `✕`劫损 `🔒`跨章。形状差异兜底色盲。
- **未解锁两档**：Detroit 档（`???`无文案 = 当前周目邻路）/ VN 档（`?`+≤14 字线索 = 跨周目未触发）。
- 线索红线：**≤14 字、无专名、无数字、无因果连接词**（`content-lint` 强制）。
- 状态机：`seen`(当前存档标志) / `unlocked`(任意周目历史有，本周目未走) / `locked`(从未触发，`clue=undefined` 渲染纯问号)。
- 防剧透工程化：本周目/跨周目数据**物理分离两张表** + locked CG 不进首屏 chunk（按 id 动态 import）+ clue lint + 回看隔离。
- 先实"状态机 + locked 占位渲染"骨架，再迭代连线与动效。

## 5. 主玩法 UI/UX（对齐既有 `storyVN` 38ms + `app.css` 六色 token）

- **自白作用域**：`intro.letter` / `intro.followup` 是开发者元叙事信笺，允许一次性自贬、MuseFlow 产品私货与颜文字；界面不显示解释性身份标签，这些内容也不得进入 `NARRATION_SCENES` 或在正式序章后重复。
- **对话框**：屏幕下沿通栏 22-28%、纸色半透透 15-18% 背景、CJK 衬线 `clamp(18px,2.4vw,22px)`、`line-height:1.85`、单行≤40 全角字、**禁 letter-spacing**。
- **打字机**：38(标准)/60(慢)/18(快)/0(即时,reducedMotion 自动) ms + 标点 `，。！？；：—` 停顿×2.5 + blip 每 3 字一次按发声分轨。
- **选项**：≤5、竖列、纸上分行；界面不显示圈号，仍保留 `1..5` 数字键直选与 `aria-keyshortcuts`；四态（默认/悬停/已选/禁用锁）、触屏≥44px。
- **图层 z 序**：bg → 道心氛围(`opacity≤0.35`，每 8s≥2s 静止，光敏安全 WCAG 2.3.1) → NPC 立绘 → 渡劫 → 对话框；转场 320/280/120ms。
- **内心内阁六色严格映射**（不引入第七色，守色律）：墨旁白 / 金师尊(斜体衬线) / 朱砂心魔(粗+微抖) / 靛直觉 / 气青自语 / 纸系统。字体变形(italic/weight)外化声音。禁止为每个多选节点自动重复“须自择一途”；只有真实角色心声或道心脉象可占第二阅读层。
- **单一正文主权**：同一 `NarrationLine.text` 同一时刻只能出现在主阅读面或识海浮纹之一，严禁把 `self` 行同时复制到两处；心声条只承载独立的状态脉象/提示。
- **底部阅读坞**：心声条、对话框、Quick Menu 必须处于同一正常文档流 Grid，顺序固定为上→下；长正文/长选项在对话框内部滚动，禁止用多组 `bottom:calc(...)` 猜高度。桌面与 390×844 大字号均须做几何不相交断言。
- **Backlog**：环形 200 行、`H`/`Ctrl` 唤出、Skip Read/All、Auto(行末停 800-2500ms)、Rollback(滚轮上)。
- **无障碍**：字号 3 档(16/19/24)、打字含即时、对比度墨 on 纸≥7:1(AAA)、reduced-motion 瞬切、`aria-live=polite`、em 单位（WCAG 1.4.12）。
- **diegetic**：Quick Menu 做成"玉简/符箓"、心声条"识海浮纹"水墨笔触（古风词表一致）。

## 6. 离线图集产线（tools/）

- **三层一致性锁**：master reference（`gen-master-ref.mjs`，人工签 off 只读）+ 身份锁（`model+LoRA+seed 桶`，**把现有 `seed:null` 全部填实**）+ 风格锁（固定 prompt 模板 + `review-ai-art.py` 16 色 Lab ΔE 量化）。
- **manifest 加 `status`**：`draft→generated→vision_passed→human_signed→published`。批处理按 status 排队恢复，**绝不重新生成已 approved**（核心论点「文件存在 ≠ 完成」）。
- **命名**：`references/master-<subject>-vN.png` / `sprites/<subject>/<pose>-<seed>.png` / `cg.<ending>-<motif>.png`。`-vN` 必须在 id 与文件名，旧版禁原地覆盖。
- **精修**：必人修（手指/脸畸变/纹样/文字乱码）；自动检（NSFW 三档 allow/review/block、wrong hands/extra limbs、pHash 同人相似度、水印）；抽检（立绘 100%、氛围 30%）。
- **防泔水**：词表门（`content-lint`，ban "as you know" 等 AI 习惯语）+ voice card（词汇域/节奏/回避话题）+ 剧透控制（已揭示事实作 state 传给润色 prompt）。
- **成本**：单图 $0.02-0.1、单次迭代（~100 张）$5-10、月级 ~$20。

## 7. CI 护栏（`governance-check.mjs` 扩展）

- manifest schema 完整性 + checksum 重算（防图被替换未登记）+ `ai_disclosed` 100% + license 非空。
- 孤儿引用（`master_ref/ref_imgs/path` 必须在仓内）。
- status 机（`published` 必有 `signer`，`approved` 不可被后续 attempt 覆盖）。
- **结局可达性**（Scene `choices+requires` 建图 BFS，8 结局全可达，无孤儿节点）。
- 58 个运行时场景全部 `approved`；打字机正文与 `responseLines` 无空键。
- **叙事一致性门**：长文案零无意精确重复；循环节点必须使用 `once` 或 `revisitMode:'choices-only'`；生硬梗词按零/低预算静态扫描。
- **状态级结局路径**：除静态 BFS 外，以运行时同样的 `requires/effects/onEnter/失败态优先` 顺序执行 8 条认证路径，防止“图上有边、实际先毒死/寿尽”的假可达。
- 一次性选项选后从 DOM 消失；互斥 `hide-when-unavailable` 选项不得以锁项泄露。
- 渲染使用 epoch/代次令牌废弃旧 timer，场景切换后旧打字机不得写回新场景。
- **风格指纹漂移**（published 图 pHash vs master，超阈值 fail，防 LoRA 被偷换）。
- **运行时无 fetch/AI SDK**（静态扫 `src/app` + `src/render`）。
- 类型检查 + 纯函数快照（`fast-check`：`defiance∈[0,100]` 单调有界、`effects` 应用后状态合法、`(defiance,bond)` 阈值矩阵路由正确）。

## 8. 自主开发 Do / Don't

**Do**：先架构后内容、先骨架后图、垂直切片验证管线、每刀 CI 全绿、写手/图集解耦、`-vN` 版本化、占位图先行；重大选择按“即时回应 → 中段 flag 回响 → 终局准备/结局回收”验收。

**Don't**：为 CI 绿改图集（金回放红线同样适用图）、混模型/混 LoRA、用 `ls` 判完成、自由 prompt、省人工抽检、原地覆盖旧图、藏 `ai_disclosed`、运行时调模型、文本埋隐式变量改动、回访重复结算、用灰锁项展示玩家从未走过的互斥人生。
