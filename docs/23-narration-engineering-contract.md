# 23 · 灵韵叙录：工程契约与开发护栏（自主开发遵循）

> 配套 `docs/22-narration-mode.md`（设计定稿）。本文件是叙事层 schema、UI 规范、图集产线、CI 护栏的**可执行契约**，自主开发各轮以此为准。与 `00-DESIGN-BRIEF.md` 宪法冲突时宪法优先。

## 0. 红线（不可越）

- narration 层**只读不写 `src/sim/`**；选图/判定用纯函数，**副作用只走 `effects` 声明**，禁止文本埋隐式变量改动。
- **运行时绝不调用 AI 模型**（CI 静态扫 `src/app` + `src/render` "无运行时 fetch/AI SDK"硬保证）。
- `ai_disclosed:true` 100% + `license` 非空（合规 + 口碑双红线）。
- 图集 `-vN` 版本化，**禁止原地覆盖旧图**（保护旧存档）。
- 回看模式隔离（`__REPLAY__` flag，sim 只读快照，写操作全拦截）。

## 1. Scene/节点 schema（扩展现有 `{cgAssetId,lines,choices,converge}`）

- `choice` 补：`requires?`(guard，如 `'defiance>=60 && bond<50'`) / `effects?: Effect[]`(声明式副作用 `{set,add,flag,lore}`) / `once?`(Ink `*`一次性) / `tags?[]` / `speaker?`
- `scene` 补：`id`(命名空间 `act2.tribulation.grip-1`) / `act` / `layerKeys?`(分层合成) / `onEnter?: Effect[]` / `ends?: EndingId` / `status: 'draft'|'review'|'approved'` / `locale`
- 把 `speaker` 从文本里拎出到 `Line={text,speaker?}`。
- CI 拒 `status!=='approved'` 的 Scene 进 `narrationScenes.ts` 入口。
- 变量一律在 `firstPersonView.ts` 顶部 `declare`（类型化 + 初值，对标 Yarn `<<declare>>`）。

## 2. 分层选图（数据驱动查表，禁脚本 `if`）

- `assets/manifest.json` 增 `cg.composite` 桶：`layers:[bg,daoAmbience,npc,tribulation]`。
- 连续变量**离散化分桶**（`defiance/bond` → low/med/high 三段），组合 ≤ 9 个氛围层。
- Scene 写 `layerKeys`，`daoAmbience:'auto'` 时由 `firstPersonView` 纯函数分桶查表。
- 写手只填 `layerKeys` 键名，美术只补 manifest 表项，**键名契约对接**。

## 3. 抗组合爆炸

- 四幕 = **Gauntlet + Foldback**（每幕末汇流到下一幕开场，唯一真分支点 = 终局天道诘问）。
- 7 结局 = `(defiance≥60?, bond≥50?)` **2×2 阈值矩阵** + 5 失败态（任意幕触发即收敛到"死得明白"模板）。
- 支线心志抉择 = **storylet**（`requires` 入池，仅 `defiance/bond` 两 quality 驱动，Quality Parsimony）。
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

- **对话框**：屏幕下沿通栏 22-28%、纸色半透透 15-18% 背景、CJK 衬线 `clamp(18px,2.4vw,22px)`、`line-height:1.85`、单行≤40 全角字、**禁 letter-spacing**。
- **打字机**：38(标准)/60(慢)/18(快)/0(即时,reducedMotion 自动) ms + 标点 `，。！？；：—` 停顿×2.5 + blip 每 3 字一次按发声分轨。
- **选项**：≤5、竖列、`①②③④⑤`数字键直选、四态（默认/悬停/已选`✓`/禁用锁）、触屏≥44px。
- **图层 z 序**：bg → 道心氛围(`opacity≤0.35`，每 8s≥2s 静止，光敏安全 WCAG 2.3.1) → NPC 立绘 → 渡劫 → 对话框；转场 320/280/120ms。
- **内心内阁六色严格映射**（不引入第七色，守色律）：墨旁白 / 金师尊(斜体衬线) / 朱砂心魔(粗+微抖) / 靛直觉 / 气青自语 / 纸系统。字体变形(italic/weight)外化声音。心声条独立窄条不抢主框，最多叠 2 条 FIFO。**三重冗余**（色+形+音）色盲安全。
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
- 打字机文本无空键。
- **风格指纹漂移**（published 图 pHash vs master，超阈值 fail，防 LoRA 被偷换）。
- **运行时无 fetch/AI SDK**（静态扫 `src/app` + `src/render`）。
- 类型检查 + 纯函数快照（`fast-check`：`defiance∈[0,100]` 单调有界、`effects` 应用后状态合法、`(defiance,bond)` 阈值矩阵路由正确）。

## 8. 自主开发 Do / Don't

**Do**：先架构后内容、先骨架后图、垂直切片验证管线、每刀 CI 全绿、写手/图集解耦、`-vN` 版本化、占位图先行（图集精修是人审环节，不阻塞代码）。

**Don't**：为 CI 绿改图集（金回放红线同样适用图）、混模型/混 LoRA、用 `ls` 判完成、自由 prompt、省人工抽检、原地覆盖旧图、藏 `ai_disclosed`、运行时调模型、文本埋隐式变量改动。
