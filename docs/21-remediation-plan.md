# 21 · 整改计划与当前状态

> 本文件只记录 2026-07 用户反馈后形成的整改计划，不替代 `18-development-roadmap.md` 的长期路线图。
> 判断口径：围绕“现有美术粗糙、地图和人物操作不常规、开场叙事单薄、背包只是文字描述、耕种比重过高、修仙生态不足”等问题，记录已整改、部分整改和待整改内容。
> 当前状态：第一轮整改垂直切片、R1 地图/操作逻辑切片与 R1.5 鼠标/触屏目标解耦切片已落地到本地工作区；仍未提交、未合并、未发布。

---

## 1. 整改目标

本轮整改不以“再堆更多系统”为目标，而是先修正首轮体验的方向偏差：

1. **美术重做**：从粗糙像素占位转向可辨识、有统一风格的角色、CG、地图、物品图标。
2. **序章演出重做**：用视觉小说结构呈现穿越、测灵失败、无灵根误判与现实落差，避免开局只有文字墙。
3. **背包系统重做**：从文本清单升级为具备常规游戏背包能力的交互面板。
4. **地图与人物操作重做**：建立常规玩家能理解的地点、对象、交互范围和人物表现。
5. **玩法重心修正**：耕种只是修仙生态的一环，主循环应逐步转向炼丹、体修、天劫、阵法、NPC、事件与镇守人间。
6. **质量门禁维持**：所有整改必须继续通过治理、类型、单测、构建和必要的浏览器回归。

---

## 2. 已完成

### 2.1 美术资产第一轮重做

已入库并接入 manifest 的新资产包括：

| 类型 | 数量 | 说明 |
|------|------|------|
| 序章 CG | 4 | 初醒、系统失败、测灵沉默、归谷等序章节点 |
| 结局 CG | 3 | 原有飞升/寿尽/暴毙结局图继续保留 |
| 人物立绘/头像 | 12 | 主角、忘言叟、萧无极、采药女、阵匠老陆、了尘等 |
| 地图图 | 3 | 农庄庭院、地点网络、山谷总览 |
| 地图精灵 | 6 | 地点/人物/服务层的小地图表现 |
| 背包图标 | 76 | 面向新背包卡片的 64x64 物品图标 |
| 参考图 | 3 | 美术方向与场景风格参考 |

当前 `assets/manifest.json` 统计：`227` 个 sprite 条目，其中 `inventory-icon` 为 `76` 个。

### 2.2 序章视觉小说结构

已新增序章 VN 数据和通用 VN 运行结构：

- `src/content/prologueScenes.ts`
- `src/app/prologueVN.ts`
- `src/app/storyVN.ts`

序章已从纯文字说明改为“假选择 + 反差反馈 + 收束到现实认知”的结构。玩家可以选择“高呼系统”“寻找戒指老爷爷”等熟悉梗，但结果都指向“似乎什么都没有发生”，最后回到无灵根误判和凡骨求生的现实。

### 2.3 第一幕叙事框架

已新增 `src/content/act1Scenes.ts`，覆盖斗法、劫灰、储物戒、残卷和《偷天换劫诀》引子。当前属于叙事数据和结构完成，不等于完整 CG 演出完成。

### 2.4 背包交互面板第一版

已新增 `src/app/inventoryUI.ts`，并接入主运行时。当前具备：

- 分类页签
- 搜索
- 物品堆叠展示
- 品质、数量、耐久显示
- 详情面板
- 使用
- 丢弃与数量选择
- 合成入口路由
- 种子/工具选择
- 拖拽换位的前端表现
- 背包图标加载
- 通过现有 `GameState` 与本地存档链路保留物品状态

### 2.5 第一轮质量门禁

上一轮整改后已通过：

- `pnpm governance:check`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:browser tests/browser/inventory-icons.spec.ts`

### 2.6 R1 地图与操作逻辑整改切片

已新增农庄场景语义并接入首轮可玩体验：

- 固定药田范围，不再把正式农庄的所有平地都当可耕种区域。
- 固定屋舍、仓储木箱、出货箱、丹炉、阵器棚和谷口出口。
- 对固定对象写入碰撞标记，避免画面是设施、逻辑却像空地。
- 面前格预览能识别对象、院道、药田和谷口。
- `空格/E` 先处理脚下拾取，再处理面前对象，最后才回退到热栏工具。
- 非药田区域会阻断翻地、播种、施肥等新农务行为。
- 仓储、出货、丹炉、建造/阵器、地点目录已能从场景对象进入。
- 已补 `tests/browser/farmstead-scene.spec.ts`，断言玩家面向对象按确认确实打开对应交互，并断言非药田确认不会被热栏回退误翻地。

### 2.7 R1.5 鼠标/触屏目标解耦切片

已针对“角色必须多走几步才能操作隔壁格”“键盘/手柄方案太复杂”“鼠标/触屏应与人物移动和操作目标解耦”的反馈完成第一轮修正：

- 鼠标/触屏左键可直接以点击格为操作目标，不再强制使用玩家面前格。
- 点击药田格会按上下文执行翻地、播种、浇水、供灵、收获或稳定提示。
- 点击农庄对象可直接打开仓储、出货、丹炉、阵器棚、屋舍或谷口入口，并自动面向目标。
- 点击地面掉落物可触发拾取；点击空白可通行格会排队寻路并以步行动画移动。
- 点击 canvas 地图外留白不再触发默认确认，避免误翻地、误播种或误拾取。
- 打开行囊、地图、修行、系统和常规交互面板时会取消正在排队的世界点击动作，关闭面板后不会继续执行旧目标。
- 打开地点/交互面板后，鼠标或触屏点击画布空白不再等同确认；只有点中可见面板区域或按 Enter 才执行确认，避免误购买、误出货或误触发服务。
- “更多入口”执行地图、行囊、丹炉等命令后会自动收起，返回农庄时不再保留展开态挤压 HUD。
- 世界 toast 从裸文字改为短宽度底板提示，横屏小视口不再横穿灵田和角色读图区。
- 渲染层新增指针悬停格提示，玩家能看到当前点选目标。
- 触屏横屏控件避开右侧世界命令栏，降低误挡“歇息”等主按钮的概率。
- 留世后的地点目录不再被首轮新手农务目标锁住。
- 留世委托在遗迹门口显式出现，Alt+Q/W/E 快捷入口可在已有日常面板上直接切换服务，减少 Esc 中转。
- 首轮收获未成熟时不再暗中自动过夜，改为提示玩家主动“歇息”。
- 旧存档进入时会迁移农庄场景布局，但终局存档保持原样，避免破坏结局页面。

---

## 3. 部分完成

### 3.1 美术方向

已有新资产初稿和 art bible 参考，但尚未完成最终风格锁定。当前资产可支撑继续整改和浏览器联调，但还不是发行级统一美术。

下一步需要做：

- 人工审美筛选。
- 重生成或图生图精修不合格角色。
- 统一 CG、头像、地图、图标的光影、线条、色阶和边缘处理。
- 明确最终比例：VN 立绘、头像、地图缩略、背包图标分别采用不同规格，不再混用。

### 3.2 地图与人物表现

已有地图图、地图缩略、地图精灵、地点预览链，以及 R1 农庄主场景对象交互、R1.5 鼠标/触屏点选目标交互。当前已解决“农庄到处能耕种”“面向设施仍像对地块操作”“必须走到目标前一格才能操作”的首要问题，但仍没有完成真正的多场景常规地图系统。

当前仍然缺：

- 多场景切换。
- 跨场景的一致碰撞和可交互边界。
- 人物在世界中的行走、停驻、日程和交互范围。
- 地点服务与真实场景对象之间的完整一一对应。
- 长距离点击寻路和跨场景点选移动。

### 3.3 背包系统

背包已经不再是纯文字，但还不是完整产品级背包。

本轮已完成：交互面板（分类页签/搜索/点选详情/使用/丢弃/拖拽换序/堆叠徽章）+ UX（悬停 tooltip / 容量进度条 / 排序控件）；场景掉落物拾取（sim `groundItems` + `pickup-ground-item` + 站格提示，Space 拾取）；掉落物本地存档（`groundItems` 序列化，旧档兼容）。

仍然缺（多数依赖「有序槽位数组」数据模型重构——等 art/preview 批次稳定后再做，避免与 `main.ts`/`actionPanelPreview.ts`/`renderer.ts` 的并发编辑冲突）：

- 持久化格子顺序（→ 槽位数组重构，29 处直接访问断点已定位、API 签名保不变）。
- 真正的分页容量规则（→ 重构后落地）。
- 拆分堆叠（→ 槽位数组）。
- 拖到快捷栏、仓库、商店、出货箱（跨容器拖拽，→ 重构后）。
- 合成配方网格、材料预览、产物预测与失败反馈。
- 批量操作（排序已完成）。
- 场景掉落物世界精灵（→ renderer 稳定后接，当前仅提示+拾取，无地面图标）。

### 3.4 玩法重心

项目已经有炼丹、天劫、阵法、地点、委托、关系、留世等系统基础，但首轮体验仍明显偏“农务闭环”。这与用户要求的丰富修仙生态还有距离。

---

## 4. 未完成

### 4.1 最终美术重做

- 主角最终形象未定稿。
- 核心 NPC 成套立绘未完成。
- 关键剧情 CG 不足，第一幕以后基本缺 CG。
- 地图还没有形成发行级场景资产。
- 背包图标已有覆盖，但需要统一品质、边框、稀有度、类型标识和风格校准。

### 4.2 地图/场景/人物操作后续重构

R1 已把农庄从“目录 + 平铺农田”推进到“场景 + 对象 + 交互范围”的第一版，R1.5 已把鼠标/触屏从“面前格确认”推进到“点选目标上下文交互”的第一版。但后续仍需继续从单场景扩到多场景、人物生态和完整寻路。

已完成的最小目标：

1. 农庄成为真实主场景，不是平铺可耕地。
2. 药田、屋舍、仓储、出货箱、丹炉、阵器棚、出口等对象都有固定位置。
3. 玩家靠近对象后显示交互提示。
4. `E/空格/鼠标左键` 统一为确认交互。
5. 右键/Esc 统一为取消或返回。
6. 耕种只在药田格生效，不再像整个平台都能耕种。
7. 地点目录开始作为谷口出口和快速导航入口，不再完全代替农庄场景。
8. 鼠标/触屏点击药田或对象时，目标与人物面向解耦，不再要求先走到目标前一格。
9. 农庄内点击可通行格、药田、掉落物和设施对象会进入寻路队列，并以逐格步行动画完成。
10. 留白点击不触发默认行动，打开模态面板会取消旧点击目标。
11. 留世后的高频地点服务可以通过明确入口或 Alt 快捷键连续切换，减少 Esc 中转。
12. 地点/交互面板的鼠标确认从“任意点击画布”收窄到“点击面板区域”，更多入口执行命令后自动收起。

仍未完成：

- 其他地点的真实场景。
- NPC 实体在场景中的日程、移动和对象化交互。
- 跨场景点击寻路、跨场景碰撞和地点间连续移动。
- 场景物件和地图贴图的最终美术替换。

### 4.3 耕种循环降权

当前种田相关操作已从纯按键操作推进到部分上下文动作，但整体权重仍偏高。后续需要：

- 继续把浇水、供灵、播种、收获改成更自然的上下文动作；R1.5 已覆盖鼠标/触屏点击药田的第一版。
- 默认动作由面前对象决定，而不是要求玩家记住大量按键。
- 药田服务于炼丹、阵法、天劫准备、NPC 交易与镇守，而不是成为唯一中心。
- 引入更轻的自动化或设施辅助，减少重复劳动。

### 4.4 修仙生态深化

后续应分期吸收竞品经验：

- 《觅长生》：境界、丹药、功法、突破风险。
- 《太吾绘卷》：人物关系、传承、世界状态与长期因果。
- 《鬼谷八荒》：奇遇、地图探索、机缘、抉择。
- 《了不起的修仙模拟器》：设施、风水/阵法、门派生态和风险管理。

本项目不能直接拼贴竞品表层玩法，应该围绕“凡骨体修 + 灵田 + 天劫 + 镇守人间”重组。

### 4.5 真人体验验证

旧计划里的真人样本测试仍未完成。整改后更需要补：

- 5-10 名真人首轮 15 分钟体验。
- 记录开场是否有吸引力。
- 记录是否理解当前目标。
- 记录背包是否能无说明使用。
- 记录地图和交互对象是否符合直觉。
- 记录是否认为耕种过重。

### 4.6 发布与合并

当前整改资产和代码仍处在本地未提交状态：

- 未 commit。
- 未开 PR。
- 未合并到 `main`。
- 未部署。
- 未跑线上 Pages 验证。

---

## 5. 下一阶段推荐切片

R1 + R1.5 已完成。下一步不建议马上扩新系统，优先做 **R2：背包/仓储/出货与场景拾取闭环**，把已有背包 UI 和场景对象进一步打通。

### R2 目标

把背包从“可打开、可浏览、可局部操作”推进到“玩家能自然拾取、整理、拖拽到仓储/出货、分页存档”的常规游戏背包。

### R2 范围

只做以下内容：

1. 背包格子顺序持久化。
2. 分页和容量规则落地。
3. 拆分堆叠、批量移动和排序。
4. 背包与仓储的拖拽互通。
5. 背包与出货箱的拖拽互通。
6. 场景掉落物图标化、拾取提示和本地存档。
7. 合成/炼丹材料从背包中可视化选择。
8. 补浏览器回归：场景拾取、拖拽入仓、拖拽出货、重载存档后位置和数量保持。

### R2 不做

- 不新增大地图寻路。
- 不新增完整 NPC 行走 AI。
- 不扩新境界、新功法、新事件池。
- 不生成第二批大规模美术。
- 不重写 `src/sim` 核心规则。
- 不引入联网、账号、云存档或后端。

### R2 完成标准

- 玩家能不看说明完成“拾取物品 -> 整理仓储 -> 出货 -> 过夜结算”。
- 背包格位、分页、堆叠和搜索在本地存档后保持。
- 仓储、出货箱、地面掉落物都不再只是文字入口。
- `pnpm governance:check`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过。
- 至少新增一个浏览器回归，断言拖拽/拾取/重载存档不会只停留在 UI 可见层。

---

## 6. 当前风险

1. **资产已入库但未定稿**：不能把“有图”误判为“美术达标”。
2. **背包 UI 已可用但存档粒度不够**：拖拽排序等表现还未完全进入持久化模型。
3. **地图仍有后续体验断层**：R1 解决了农庄主场景，R1.5 解决了点击目标解耦，但其他地点、NPC 和完整点击寻路还没完成。
4. **耕种权重需要重调**：否则项目仍会被误读成粗糙修仙版种田游戏。
5. **真人验证缺失**：自动化能保证不崩，但不能证明审美、节奏和直觉真正成立。
6. **密钥暴露风险**：此前用户在对话中提供过临时 API key，应视为已暴露并轮换。

---

## 7. 状态摘要

整改计划当前完成度判断：

- **第一轮基础设施整改**：已完成。
- **美术资产初稿覆盖**：已完成第一批，但未最终定稿。
- **序章 VN 化**：已完成第一版。
- **背包交互化**：已完成第一版，但未产品级闭环。
- **地图与操作逻辑整改**：R1 + R1.5 已完成；多场景、NPC 和完整点击/触屏寻路仍未完成。
- **修仙生态玩法重构**：未完成，应在地图与操作逻辑稳定后分期推进。
- **真人可玩性验证**：未完成。
- **发布上线**：未完成。

---

## 8. 视觉与细节审计轮（2026-09）

方法：以实机截图走查双模式全部关键界面（1280×720 桌面、820×430 与 1024×500 短横屏、竖屏），
逐张审读并放大可疑区域，再用几何探针定位根因。发现的问题均为既有自动化测试未覆盖的
"看得见、代码读不出"类缺陷。

### 8.1 本轮已修复

1. **短横屏视口修途日程不可用（P1）**：紧凑布局原先只按宽度断点切换（≤1120px 两栏 /
   ≤760px 堆叠），820×430 这类"宽度走两栏、高度不够"的窗口会裁切状态面板、压没活动
   选择区，且反馈段拦截活动按钮点击。现增加高度感知断点
   `@media (max-width:1120px) and (max-height:620px)` 复用堆叠布局，并以
   `@media (max-width:1120px) and (max-height:520px)` 再压一档（状态面板单行统计、
   隐藏 kicker）；天劫棋盘保留双栏布局（在 `max-height:760px` 辅助规则下恰好放入 430px）。
   新增 `tests/browser/roguelite-compact-viewport.spec.ts` 锁定：短横屏下活动可点、
   统计不裁切、可完整走到天劫棋盘。
2. **事件界面空反馈段渲染孤立竖条**：`.cr-event__feedback` 内容为空时左边框 +
   min-height 仍渲染出 3×21px 亮条。已按项目既有 `:empty` 惯例隐藏。
3. **过场画面 CG 图注对比度不足**：劫兆 / 引劫之问图注为白色 12px 直接压在浅色雷光画上。
   加深 `.cr-interlude__art::after` 底部渐变并给图注加 text-shadow。
4. **天劫 HUD 筹备行换行难看**：`护持 0 · 撤步 0` 等成对词被折行拆散。改为 nowrap
   分段（`.rp-hud-seg`），换行只发生在 `｜` 分隔处。
5. **修途日程初始文案过度约束**：原"先选中一格，再把活动写入竹简"暗示必须先选格；
   实际默认已选中第 1 格，直接点活动即写入并自动前移。文案已改为描述真实行为。

### 8.2 审计后保留的创作决定（不改）

- **开发者自白**（含 MuseFlow 提及与颜文字）是 docs/22 §2.2 明文设计的元叙事，
  只在头尾各出现一次，进入序章后完全让位给人物与处境。尊重原设计。
- **棋盘空格角标**是刻意的"黑玉命盘"雷篆美学（`surface.ts` 注释明确），非噪点。
- **"认证步数 / 余量"**术语是 README 公示的可复现性设计支柱，不视为内部术语泄漏。

### 8.3 专业视角的后续改进空间（记录，不在本轮实施）

- **信息揭示节奏（行为经济学）**：预见 0 时玩家在信息最少的第 1 劫做最不可逆的决定；
  可考虑首劫结算后赠予一次基础预见，降低首轮挫败而不破坏"劫兆需参悟"的核心循环。
- **双词表并存（信息一致性）**：旧世界模式 8 阶词表（`ui.hud.stages`）与修途 6 境
  （`CULTIVATION_REALMS`）并存；应随旧模式退役统一，避免翻译与文案双份维护。
- **i18n 卫生**：约 20 个无引用键（旧版标题 / 菜单 / HUD 残留）；动态键
  （`ending.*`、`narration.ending.*`）使"死键"判定需谨慎，建议在内容 lint 中
  增加动态键白名单机制后再清理。
- **过场竖向留白**：桌面 720p 下结算 / 事件 / 引劫之问下方约有 25–40% 空置区；
  当前留白符合"竹简"克制美学，若后续要加"上轮回顾"或活动详情，空间已预留。
- **短横屏天劫棋盘尺寸**：820×430 下棋盘画布约 650×188，可玩但偏扁；后续可为
  短横屏提供棋盘专用的紧凑 tile 尺寸，进一步提升可读性。
- **本机浏览器套件既有失败（本轮审计新发现）**：在本机（Windows + swiftshader 软渲染）
  完整运行浏览器套件时，`input-flow` / `touch-flow` / `inventory-management` 等
  旧世界模式用例存在 113 个确定性失败（应用启动 / 画布可交互 30s 超时为主）。
  已用 `git stash` 在干净 HEAD 上复跑对比子集，失败清单逐条一致，确认与本轮改动无关，
  属既有环境 / 回归问题；涉及旧世界模式在新主模式重构后的输入流维护，建议单独立案。

### 8.4 第二轮（同月续）：叙事模式深审与棋盘保真

方法：以 reducedMotion 预置 + 舞台推进脚本走通灵韵叙录全链（自白 → 序章双分支 →
E0 结局卡 → 叙录图鉴锁定/解锁态），补齐竖屏与短横屏叙事截图；并以宽高比探针
核查天劫棋盘画布。

#### 已修复

1. **天劫棋盘画布纵横比畸变（P1 视觉保真）**：画布位图为棋盘正方形（280×280），
   但 CSS 显式 `width:min(100%,650px)` + `max-height` 组合不会反推宽度——820×430 下
   被拉成 650×188（横向畸变 2.46 倍），桌面 1280×720 也有 7% 拉伸。现把画布包进
   铺满网格区的 `.rp-canvas-slot`，`fitCanvasCss()` 按 contain 公式写入 CSS 尺寸，
   ResizeObserver 响应容器变化；三档视口探针畸变全部归零（820×430 → 188×188，
   1280×720 → 606×606 且更清晰）。
2. **i18n 死键治理机制**：`tools/content-lint.ts` 新增词典键校验段——死键（词典有、
   剥离注释后的 src 无字符串引用、且不匹配 5 组动态前缀）、缺键（静态引用但词典
   缺失）、未登记动态前缀三向拦截；数组键视作叶节点。本轮共清理 30 个死键
   （旧版标题/菜单/行动/事件残留 + 叙录硬编码标签残留），`ui.hud.day/year` 保留为
   插值测试锚点并在工具内注明。
3. **标题屏「灵韵叙录」副标题孤行**：窄按钮下"时辰"两字孤行。改为按间隔号
   不可断行分段，断点稳定落在"第一人称叙事 ·"之后。

#### 审计结论（保留）

灵韵叙录的视觉品质过关：场景 CG、选择列表、结局卡、叙录图鉴（防剧透问号墙 +
已解锁卡）在桌面/短横屏/竖屏三档下均无发现需修复的缺陷；竖屏可读性声明成立。

#### 环境备注

本轮复跑确认 §8.3 末条：`app-flow` 5 例失败在干净 HEAD 上逐条复现，与本轮改动无关。

### 8.5 第三轮（同月）：旧世界 E2E 失败家族立案与修复

背景：§8.3 末条记录的 113 个本机浏览器失败，本轮完成根因家族分类并修复其中
可无歧义修复的部分。

#### 根因家族（对 216 用例全量运行的失败签名分类 + 单测隔离 + HEAD 对照）

1. **流程腐化（约 35 例）**：D27 主模式重构后，`#flow-title-new-game` 直达
   「偷天换劫」，但这批用例仍点击它并等待 `#flow-prologue-skip`（旧序章）。
   修复方式按测试意图分两档：
   - 世界语义用例（命令栏/键盘纪律/读屏/暂停焦点/触屏 HUD/响应式画布）改走
     `continueToWorld` 测试门（`enterLegacyWorld`），恢复其书写时的前置状态；
   - 断言"标题→序章"链本身的用例（app-flow）按现行产品契约重写：标题 →
     roguelite 开场 + 焦点落 `cr-opening-heading`，另以测试门断言旧世界仍可达。
2. **真 bug：Storage 被禁时启动中断（1 例 src 修复）**：
   `rogueliteProto/runSave.ts` 的 `hasCultivationJourney/loadCultivationJourney`
   在 try/catch 之外调用 `storage.getItem`（`storageOrNull` 只保护属性访问）。
   `Storage.prototype.getItem` 被禁时 boot 抛错 → 标题永不出现。已加
   `safeGetItem` 守卫；save-health「Storage 不可用」用例由失败转为通过。
3. **入口竞态加固**：`continueToWorld` 原以 `isVisible()` 瞬时判断标题按钮，
   早于 boot 完成时误判跳过测试门。现已先等按钮可见（20s 上限）再探测。
4. **夹具/经济漂移（约 78 例，未修复，已归档）**：`input-flow`(64)、
   `inventory-management`(12) 等使用种子存档夹具 + 旧经济算术（如种子数量
   期望 2、实际 5），以及 public-demo 的炼丹结果断言。逐条修复需按现行内容表
   重定契约，属下一轮专项。
5. **疑似世界渲染回归（2 例，未修复，已归档）**：`p0-terrain-semantics` 的
   月白选中蒙版亮度断言失败（选中格 meanLuma 90.7 < 裸土 103.9+2，但冷色
   边缘像素 12 > 8 说明蒙版边缘已绘制）。实拍与像素剖面已归档
   `.omc/artifacts/p0-2-terrain-semantics-*.png`，需对照 tileVisuals 选区
   渲染历史专项排查。本轮改动从未触及世界渲染器（归属既有）。

#### 本轮已修复明细

- `src/app/rogueliteProto/runSave.ts`：safeGetItem 守卫（真 bug）。
- `tests/browser/openGame.ts`：continueToWorld 等待标题就绪。
- `tests/browser/app-flow.spec.ts`：5 例全部修复（含 1 例按新契约重写）。
- `tests/browser/accessibility-shell.spec.ts`：startFreshWorld 改走门（2 例修复）。
- `tests/browser/save-health.spec.ts`：3 例按现行「继续旅程=入世录」契约重写
  /入口修复（4 例全部通过）。
- `tests/browser/touch-flow.spec.ts`（9 例）、`responsive-layout.spec.ts`
  （4 例）、`delivery-capture.spec.ts`（2 例，02 截图更名
  02-roguelite-opening）、`public-demo-vertical-slice.spec.ts`（入口修复；
  深处炼丹断言归入第 4 类）。

#### 负载敏感性实测（本机）

同机对照显示失败集合随负载漂移：touch-flow 单 worker 隔离运行 9/9 通过，
并入全量套件（workers=2）后 13 例超时；smoke / 视觉软门 / qi-flow /
keypoint-playability 在全量运行中出现、单独运行全数通过。旧世界用例的
30s 超时上限对本机并行负载高度敏感；CI（workers=1、干净 runner）与本机
全量运行的失败集合不可直接互推。后续专项应以「单 worker 隔离 + 全量
workers=1」两档结果为准。

### 8.6 第四轮（同月）：夹具失败族根因与测试门扩展

#### 根因

input-flow(64) / inventory-management(12) / inventory-icons(1) 的失败同源：
这些用例先向 localStorage 注入种子存档再进入旧世界，但旧世界入口
`start-new-game` 会无条件 `clearSave()` + `createFreshState()`——**种子存档
从未生效**，全部用例实际运行在全新初始世界上（例：期望苔藓种 2 颗、实际
5 颗 = 初始套件授予量）。世界渲染的 p0-terrain 月白蒙版断言失败则是
`TILE_ORIGIN` 陈旧：重构后网格水平锚定改为 content 区居中
（`renderer.ts` 的 OX），p0-terrain 仍按 world 区居中采样，偏差约 4 列
（qi-flow 同文件族已同步过、本文件漏改）。

#### 本轮修复

1. **测试门扩展**：appFlowMachine 新增 `enter-loaded-world` 事件（title→world、
   不清档），main.ts 测试门新增 `enterLoadedLegacyWorld()`（仅当 boot 已成功
   加载存档），openGame 新增 `continueToLoadedWorld` / `openGameWithLoadedSave`。
2. **p0-terrain-semantics**：TILE_ORIGIN 改为与 renderer OX 同源（content 区
   居中 + world 区顶部），2 例由失败转通过——世界渲染器本身从未损坏。
3. **inventory-management**（13 例全过）与 **inventory-icons**（1 例通过）
   迁移至 `continueToLoadedWorld`，种子存档生效。

#### 明确回退与归档

- **input-flow 维持 fresh 入口（openGame）**：实测迁移至种子存档入口后失败
  反而 64→74——其断言是按全新世界行为调校的，夹具状态会触发另一批不一致。
  该文件 94 用例的修复需逐条按现行内容表重写夹具与断言（下一轮专项），
  强行迁移只会把失败换个形态。
- **ending-flow（1 例）归档**：整例建立在旧「继续旅程=加载旧世界存档」接线
  上（现继续旅程=入世录）；需要产品决策后重写。
- **portfolio-capture（2 例）归档**：showcase 存档推进断言停在 first-till，
  同属夹具漂移族。

### 8.7 第五轮（同月）：input-flow 基线分类与数据驱动精确迁移

#### 方法

同机同参对 input-flow 全量 107 用例做「fresh 入口 vs 夹具入口」双档运行
（workers=1），提取逐用例失败差集：

- fresh 入口：90 败 / 17 过；夹具入口：74 败 / 33 过。
- 差集显示迁移并非一刀切：5 例仅夹具入口通过（second-sow-raw-front、
  hotbar-primary、ascension-choice×3），2 例仅 fresh 入口通过（875/898），
  其余在两种入口下皆败（断言与现行规则漂移，需逐条重写）。

#### 本轮修复

1. **input-flow 选择性迁移**：仅将 5 例夹具获益用例切至
   `openGameWithLoadedSave`（数据驱动，逐用例验证 4 稳过 + 1 例双档不稳定）；
   其余维持 fresh 入口。
2. **劫灰碑记 CG 图注对比度**：与 §8.2 interlude 同类的浅色水墨画白字问题——
   `.cr-legacy__art` 渐变加深（42%/72%/92% 三段）并补 text-shadow。
   实拍复查可读性达标。
3. **视觉审计扩区**：劫灰碑记与继承者新世（承火者·1）两界面实拍审读，
   除图注外无新增缺陷；归一飞升终局实拍留待下轮（需第六境 keypoint 链路）。

#### 量化快照（本机，workers=1，input-flow 全量）

| 入口 | 败 | 过 |
|---|---|---|
| fresh（现状基线） | 90 | 17 |
| 夹具（全量迁移，§8.6 实验） | 74 | 33 |
| 选择性迁移（本轮落地） | 预期 ≈85 | ≈22 |

input-flow 的根治仍需按现行内容表逐条重写夹具与断言（§8.5 第 4 类专项）。

### 8.8 第六轮（同月）：终局链路实拍与 ending-flow 重写

1. **归一终局实拍审计**：经第六境 keypoint 链路（ArrowRight 一行触发）实拍
   归一飞升棋盘、归一境成 aftermath、终局表面三屏。图注已受 §8.2 共享修复
   覆盖（ending/aftermath 均走 interludeSurfaceShared），无新增缺陷。
2. **ending-flow 按现行接线重写（1 例由失败转通过）**：终局存档经
   `enterLoadedLegacyWorld` 入世界；入世界副作用 `saveState` 内的
   `enterEndingIfNeeded` 会把终局状态转到 Ending 表面——接线已验证。
   相应放宽测试门返回判定（world 或 ending 均算成功），并按现行行为锁定
   「开始偷天换劫不清除旧世界存档（保留回滚）」的断言。

### 8.9 第七轮（同月）：input-flow 主导根因突破——legacyShortcuts 丢失

#### 主导根因

第四轮批量迁移时把 input-flow 的本地包装器 `openGame()`（其职责正是
`openProductGame(page, { legacyShortcuts: true })`）绕掉了——94 处用例改为
直接调用无 legacyShortcuts 的入口。而 storage/shop/farm-action 家族的
核心交互键（数字预选、Enter 确认、逗号、Shift+M 等）全部属于旧快捷键
体系：快捷键禁用 → 按键无效果 → waitForDebugState 30s 超时。
这解释了第五轮基线中 90 败的超时主导分布。

#### 修复

1. **input-flow 包装器恢复并升级**：本地 `openGame()` 统一改为
   `openGameWithLoadedSave(page, { legacyShortcuts: true })`——夹具存档生效
   （§8.6 的清档问题同解）+ 旧快捷键启用。94 处调用点全部归一到该包装器。
2. **post-ascension 三例**：reload 后重入改用 `continueToLoadedWorld`
   （greenhouse upkeep 由失败转通过）；ascension choice 1 的终局重入改走
   `enterLoadedLegacyWorld`（入世界副作用 `saveState` → `enterEndingIfNeeded`
   自动转到 Ending 表面），尾部断言按现行接线锁定「开始新一世不清除
   旧世界终局存档」。
3. **遗留**：commission board / tea shed 两例等待委托完成状态超时，
   属 §8.5 第 4 类（断言与现行规则漂移）的收尾工作。

#### 实测（workers=1，input-flow 全量 107）

- 第五轮基线（快捷键禁用 + 夹具失效）：17 过 / 90 败。
- 本轮（包装器恢复：夹具生效 + 旧快捷键启用 + 3 处定点修复）：**92 过 / 2 败**。
  余 2 例为 post-ascension commission / tea shed 的委托完成状态漂移，归档待重写。

### 8.10 第八轮（同月）：种子存档家族清尾与交付媒体修正

1. **portfolio-capture（2 例由失败转通过）**：showcase 存档同样被 fresh 入口
   清档丢弃——组合页截图实际拍的是新手农田（first-till）而非发达农庄
   （first-loop-complete）。迁移至 `openGameWithLoadedSave` 后 showcase 状态
   真正生效；「农务」按钮不可见时先展开「更多」飞出菜单（两种命令栏布局均健壮）。
2. **delivery-capture showcase 捕获修正**：同因迁移，交付截图现拍到真实的
   发达农庄状态（此前静默拍到新手态且无断言拦截）。
3. **input-flow 余 2 例（commission / tea shed）归档**：对白标记
   `narr-shennong-reveal`（stage≥5 新增节拍）补入夹具后，位置选择流程正常，
   但委托完成状态仍不达——post-ascension 的委托入口已被产品重构
   （快捷服务 `completeDailyCommissionWithToast` / 特殊委托面板），旧
   「位置目录 → show-commission」脚本路径不成立。重写需按现行入口重新
   编排（下一轮与 input-flow 断言重写专项合并）。

#### 全量实测（workers=2，本机）

216 用例：**211 过 / 4 败 / 1 跳过**。余 4 例全部属 §8.5 第 4 类
（断言与现行规则漂移）：input-flow commission/tea shed 的 post-ascension
委托状态、greenhouse nursery 扩建预选 deep-equality、public-demo 炼丹
结果 toast。第七~八轮合计 input-flow 由 90 败修复至 4 败。

### 8.11 第九轮（同月）：委托/茶棚面板确认机制迁移与叙事标记补全

1. **greenhouse nursery（1 例由失败转通过）**：`first-till` 叙事节拍由
   「存在已翻土瓦片」触发，post-ascension 夹具的翻土瓦片使该节拍在两次
   快照之间被标记，破坏 deep-equality。`markStageNarrativeCleared` 补标
   `narr-first-till`。
2. **commission / tea shed（2 例由失败转通过）**：实拍委托面板发现现行
   确认方式为「点击交付 · Esc 返回」（R1.5 指针解耦后的点击确认）——旧
   测试按 Enter 已不交付。两例在预选服务后补
   `clickCanvasLogical(page, 810, 380)`（可见预览区内点击交付）。
   **input-flow 全量复跑：94 过 / 0 败（exit=0），该文件测试完全清零。**
   全量套件干净复跑（workers=2）：**214 过 / 1 败 / 1 跳过**——余 1 例为
   public-demo 炼丹结果 toast（§8.5 第 4 类漂移收尾）。
3. **第九轮方法沉淀**：本轮 3 例的修复全部来自「实拍面板 + 读面板自述的
   操作提示 + 按现行交互重写驱动步骤」，是视觉能力与真实代码核查结合的
   直接范例。

### 8.12 第十轮（同月）：public-demo 根因实锤与真产品 bug 修复

public-demo 的失败经单跑复现与 CDP 探针定位，根因是**真产品 bug**：
`openFlowOverlay` 硬编码 `flow.screen !== 'world'` 即拒绝——教学天劫
（screen='tribulation'）暂停里的「设置」按钮点击被静默吞掉，而暂停
上下文文案明确承诺「只能调整设置」。玩家在教学天劫期间无法打开设置。

修复：`openFlowOverlay` 按 `canOpenOverlay` 的既有语义放行 tribulation 屏
的 pause/settings（其余 overlay 仍限 world）。public-demo 由失败转通过；
input-flow 暂停/Escape 相关 11 例与 app-flow/cultivation-keypoint 13 例
回归全部通过（无副作用）。

#### 全量收官实测（workers=2，本机）

216 用例：**215 过 / 0 败 / 1 跳过（exit=0）——浏览器套件十轮以来首次完全清零。**

#### 提交门阻塞现状（需维护者决策）

Mimosa PreToolUse 提交门（本机 9/4 安装，晚于仓库末次提交）对以下 3 个
既有开发工具高危强制拦截，且为**污点模型对工具设计模式的标记**，
校验类加固无法消除：

1. `bake-tile-textures.py:82` — 循环变量拼路径写 PNG 后 `open/read_bytes`
   计算校验和（工具按 9 种 soilType 循环烘焙，变量路径是设计必然）。
2. `postprocess-world-character-art.py:96/159` — process_one 以 argv 派生的
   Path 为入口（CLI 批处理工具的设计形态）。

已尝试且被模型拒绝的缓解：字符白名单校验、`..` 拒绝、resolve 规范化 +
项目根包含检查、relative_to 惯用法、Path.read_bytes、with-statement。
可选出路：(a) 调整 Mimosa 门对 tools/ 的启发式高危策略（基线/放行）；
(b) 重构两工具消除该模式（会改变工具形态）。二选一后即可完成提交同步。

### 8.13 第十一轮（同月）：Actions 提交同步与 CI 健康

1. **十轮成果入库**：按主题拆 10 个原子提交推送 origin/dev（fix×5 / feat(test) /
   test(browser) / chore(content) / docs / ci），工作区清洁。
2. **CI 健康修复**：
   - Secret scan 步曾因 gitleaks 把 `aeonvale-*-v1` 本地存储槽名（公开的
     localStorage 键）误报为 API 密钥而失败；新增仓库级 `.gitleaks.toml`
     精确白名单（仅该命名家族，其余默认规则不变）。
   - `actions/checkout`、`actions/setup-node` 升级 v4→v5（4 个 workflow），
     消除 Node 20 弃用告警的主体；`github-workflows.test.ts` 版本锁定断言同步。
3. **视觉审计扩展（叙录图鉴）**：桌面节点图（场景卡序列 + 未解锁抉择占位）
   与 820×430 紧凑布局实拍。紧凑下 `.codex-surface` 可滚动（无阻断缺陷），
   但「合上叙录」按钮需下滚才可见——记录为改进空间（吸底按钮或顶部关闭入口）。

### 提交门状态更新（替代 §8.12 末段）

经维护者授权，Mimosa PreToolUse 钩子已拆除（hooks 注册改名禁用 + 钩子脚本
替换为直通桩，原文件保留 `.disabled` 后缀可随时恢复）。拆除前已通过真实加固
清零全部高危；剩余 2 个中危为 m5-certify 静态启发式误报（仓库无 MongoDB，
`bot.name` 为硬编码常量标签，仅流入报告字段）。安全代价：commit/push 前的
自动扫描不再运行，CI 侧 gitleaks 与本地质量门仍全量在跑。

### 8.14 第十二轮（同月）：交付媒体审读与回看可读性修复

1. **交付截图审读（旧世界面板群）**：背包 / 丹炉 / 修行 / 山河图 / showcase
   农庄质量良好（山河图底部按钮带为可滚动容器未滚动位，轻微）。发现
   **05-pause.png 媒体缺陷**：捕获脚本用 `p`（软暂停，无菜单），拍到的是
   世界画面——改用 Esc 捕获真实暂停表面并断言 flowOverlay。
2. **回想（backlog）可读性缺陷（真实 UI 修复）**：backlog 行内联
   `SPEAKER_COLOR[speaker]` 作正文色，其中 narrator 的 inkUi 为亮纸底设计色，
   压在回看深底上几乎不可读（实拍证据 tmp/audit-r12-shots）。修复：正文统一
   纸色，说话人色改作左侧竖线标识（身份信息保留）。
3. **E7 诅咒标题实拍**：立绘隔屏凝视 + 入口文案改写完美落地（docs/22 §2.5），
   无缺陷。
4. **紧凑图鉴关闭入口吸底**：900px 单列下「合上叙录」sticky 常驻（平面
   shell 衬底，遵守 app.css 无渐变纪律），免去下滚寻找。

### 8.15 第十三轮（同月）：子代理批次一（按优先级驱动）

本 round 起改用「优先级表 + 并行子代理（文件所有权互斥）+ 中央验证」工作流。

#### 本批实施（P1×2 + P2×1，均已实拍/回归验证）

1. **[P1] CI 第三方 actions 升级**：gitleaks-action v2→v3、
   pnpm/action-setup v4→v6（4 workflow 7 处 + lint 断言同步），
   Node 20 弃用告警全部清除。
2. **[P1] 山河图/修行总览桌面溢出修复**（代理像素级测量归因）：根因是
   「槽 max-height 用 dvh 定值 + 看板 aspect-ratio 内容高 + fr 行高 +
   overflow:hidden + 计量条纵排」叠加把内容顶出裁切边界。修复：槽高改随
   视口缩放、看板限高让位、首推卡行高 auto、计量条 2×2、紧凑标题与操作
   行距。1280×720 下首排地点卡/服务按钮/四条计量数值/返回农庄全部完整
   可见（实拍 tmp/audit-r13-shots）。
3. **[P2] 首劫信息揭示补强（纯文案层）**：引劫之问界面在「本代第 1 劫且
   预见 0」时追加两行承雷三途指引（完美淬体/带伤承雷/过载灰飞烟灭 +
   甜蜜区间概念），术语全对齐既有文案；门控与 HUD「劫兆未明」同链路，
   零数值改动（§8.3 归档项的保守实现）。

#### 词表统一决策（P3 调研结论，采纳）

子代理调研关键事实：**旧世界模式已无玩家可达入口**（标题屏两入口均入
roguelite，旧 world 仅 `__AEON_TEST__.enterLegacyWorld` 测试钩子可达）——
玩家实际只见一套词表，双表并存是维护面问题而非体验问题。立即统一不可行
（旧 8 档 vs 新 7 档、同号不同义、golden 哈希必红）。决策：维持现状，
词表统一工单显式挂到「旧世界退役」epic（见 §8.16 草案）。

#### 环境受限项（本机不可执行，记录）

- README 实机 GIF 再生成依赖 PATH 上的 ffmpeg（tools/readme-gif.mjs
  spawnSync），本机未安装——README 媒体刷新需在带 ffmpeg 的环境或 CI 侧
  执行（`pnpm readme:media`）。

### 8.16 旧世界模式退役分期草案（P2 规划，未实施）

> 本节把 §8.15 挂到「旧世界退役」epic 的词表工单展开成分期草案。定位是规划文档：
> 依赖面与行号按 2026-09 当前工作区核实，但不代表已获授权动代码；「启动前置条件」
> 满足前，任何阶段都不得启动。

#### 出发点：旧世界已无玩家可达入口（已核实）

1. 标题屏全部入口均不入旧 world：「开始游戏」→ `start-roguelite-proto`
   （`index.html:122` 的 `data-flow-action`，`src/app/main.ts:5986` 注释确认主入口），
   「继续旅程」→ `continue-game`（恢复修途旅程，`index.html:123`），「灵韵叙录」→
   `start-narration`（`src/app/main.ts:5970`）。
2. 入 world 的 `start-new-game` / `enter-loaded-world` 两个事件仅由测试门
   `__AEON_TEST__.enterLegacyWorld` / `enterLoadedLegacyWorld` 派发
   （`src/app/main.ts:1688-1706`）；`tests/browser/readme-capture.spec.ts:4-6` 注释
   已明言旧 world「仅 `__AEON_TEST__.enterLegacyWorld` 可达，玩家不可达」。
3. 旧世界留存的明文依据是 docs/27 的对照承诺——「旧世界与旧规则模块仍保留用于对照与
   回退」（`docs/27:7`、`docs/27 §12.3`），`src/sim/roguelite` 半实时对照同此
   （`docs/27:621`）。退役的第一前置就是维护者显式撤销该承诺。

#### 阶段 0：事实基线（零代码改动）

**动机**：删除面横跨 sim、渲染、引导与三套测试资产，没有核实过的依赖清单就动手等于盲删。
本草案的盘点结果即为阶段 0 的预填答案，启动时只需复核而非重查。

**依赖面清单（本轮 grep/读码核实）**：

1. **E2E**：`tests/browser/` 共 29 个 spec，其中 12 个实际经测试门进入旧世界，合计约
   143 处用例调用点，约占 §8.12 全量套件（216 用例）的三分之二。按入口分两族：
   - fresh 入口（`continueToWorld` / `openGameWithLoadedSave` / `enterLegacyWorld`）9 个：
     input-flow（94 处，§8.7 曾按展开 107 用例计）、app-flow（6）、touch-flow（9）、
     responsive-layout（5）、save-health（5）、accessibility-shell（3）、
     delivery-capture（2）、portfolio-capture（2）、public-demo-vertical-slice（1）；
   - 读档入口（`continueToLoadedWorld` / `enterLoadedLegacyWorld`）3 个：
     inventory-management（14）、inventory-icons（1）、ending-flow（1）。
   其中 input-flow 两族并用（主体走 fresh，post-ascension 三例走读档门，§8.9）。
   公共封装在 `tests/browser/openGame.ts`；截图夹具 `tests/browser/showcaseSave.ts`
   构造 stage 3 发展态旧世界存档供 delivery/portfolio 捕获。readme-capture 仅在注释中
   声明不可达，不进入（其本身是退休范本：只拍玩家真实可达表面）。
2. **Golden replay**：唯一 fixture `tests/replay/fixtures/core-farm-save-resume.replay.json`
   （旧农务动作 + 中途存档/续跑边界），由 `tests/replay/golden.replay.test.ts` +
   `harness.ts` + `schema.ts` 消费，`pnpm replay:update`（`tools/update-golden-replay.ts`）
   更新。注意 runner 有「至少一条 fixture」断言（golden.replay.test.ts:9-11）。
3. **存档链**：`src/sim/serialize.ts`（394 行，GameState↔JSON、stateHash、saveGame/
   loadSave + schemaHash），槽位 `aeonvale-save-v1`（`src/app/main.ts:235`）；新主模式
   存档独立在 `aeonvale-cultivation-journey-v1`（`src/app/rogueliteProto/runSave.ts:1`）。
4. **sim 旧系统**：`src/sim/` 下 farm(5 文件)/alchemy(4)/celestial(2)/economy(4)/
   progression(7)/social(6)/exploration(2)/story(2)/tribulation(5)，加 world/inventory/
   buildings/collection/processing/storage 支撑层与 `index.ts` 出口（simulateDay/
   advanceDay/applyAction）。新主模式仅依赖 cultivation-run、roguelite、sokoban、params。
5. **渲染**：`src/render/renderer.ts`（2830 行）仅 `main.ts` 与 `previewTexture.ts`
   （仅类型引用）使用；ColorPalette/sprites/guardBeastPreview/tileAsset/arrayPreview/
   tutorialWarningZone/viewportLayout/renderScheduler 有旧世界应用层模块引用，
   其中 ColorPalette 被新主模式实引（`rogueliteProto/surface.ts:33`）。
6. **引导**：`main.ts`（6938 行）双模式引导，含 `LEGACY_SHORTCUTS_ENABLED`
   （`main.ts:239-240`，环境变量 + URL 参数，§8.9 的 input-flow 依赖它）。
7. **词表**：`ui.hud.stages` 旧 8 档（凡骨…飞升前夜）在 `main.ts:1228`、
   `surfacePanels.ts:230`、`renderer.ts:1846`、`renderer.ts:2523` 四处消费；
   新词表 `CULTIVATION_REALMS`（`cultivation-run/progression.ts:23`）。
8. **单测/性质测试**：`tests/unit` 189 个文件中 93 个 import 旧 sim 路径；
   `tests/property` 19 个文件引用 `@sim`（含 cultivation-run 自身）。
9. **平衡工具链**：`tools/headless-run.ts`、`balance-scan.ts`、`m5-certify.ts` 直接依赖
   旧 sim API（simulateDay/createWorld/DEFAULT_BALANCE，headless-run.ts:7、244）——
   m5 认证链跑在旧 sim 上，`DEFAULT_BALANCE.cultivationRun` 段（params.ts:373）除外。
10. **其它残留**：`.gitleaks.toml` 白名单正则含 `aeonvale-save-v1` 槽名分支；`.gitignore`
    本轮核实无旧世界专属条目。

**动作清单**：把上述清单固化为退役 epic 下的工单树（每个资产一条）；复核一轮行号与计数
是否有漂移（近期待办：main.ts 与 renderer 仍在活跃编辑）。

**完成判据**：`git grep -n "start-new-game" -- src/` 仅命中 appFlowMachine 定义与
main.ts 测试门；以第 1 条的五个钩子名做 `git grep -l`（范围 `tests/browser/`），
输出与该条清单一致；工单树建好并与本节互相链接。

**风险与回滚**：纯文档阶段，无代码风险；唯一风险是清单过期，靠完成判据的 grep 复核拦截。

#### 阶段 1：预退役（E2E 处置与词表冻结）

**动机**：退役最大的直接风险是测试覆盖塌方——三分之二浏览器用例挂在旧世界上。先用
skip 冻结而不是直接删除，保留逐条迁移的余地，也让套件从此不再掩盖旧世界的行为变化。

**动作清单**：

1. 逐 spec 判定用例归属：「世界通用语义」（键盘纪律、读屏、暂停焦点、触屏 HUD、响应式）
   → 迁移到 roguelite/叙录 surface 写等价断言（已有覆盖的注明后退役）；「旧世界专属」
   （农务流程、旧经济算术、终局存档迁移、showcase 截图）→ 按套件既有 skip 惯例标注
   skipped-with-reason（引用本节与工单号），保留代码待阶段 2 一并移除。
2. delivery-capture / portfolio-capture 的旧世界截图先做产品决策：交付媒体是否仍需要
   旧农庄画面；不需要则整族 skip，需要则并入上一档迁移。
3. 词表解耦点冻结：`ui.hud.stages` 四个消费点（见阶段 0 第 7 条）不得新增消费；
   i18n 死键清理（§8.4）继续推进但不动 `ui.hud.stages` 家族，避免退役时一次性爆量死键。
4. showcaseSave.ts 与读档入口封装标记 `@deprecated legacy-world`，注释指向本节。

**完成判据**：`pnpm test:browser` 全绿（或维持 §8.12 的既有基线），skip 计数与登记表
一致；`git grep -n "ui.hud.stages" -- src/` 仍为 4 处；每个 skip 均带工单引用。

**风险与回滚**：迁移用例可能语义漂移（在旧世界上调校的断言搬到新表面未必成立）——
逐条实跑验证，不迁移存疑者；skip 是纯标注，删除标注即回滚。

#### 阶段 2：代码退役（应用层 → 渲染 → sim）

**动机**：不可达入口 + skip 冻结后，代码本身只剩维护成本（双模式引导、双词表、三套测试
资产、每轮回归都要绕开）。分三步删是为了每步都能独立过全量质量门、独立提交、独立回退。

**动作清单（按序，每步一个独立提交）**：

1. **应用层**：拆 main.ts 双模式引导——移除 `__AEON_TEST__` 两个测试门
   （main.ts:1688-1706）、world/prologue/tribulation/aftermath 屏接线与
   `start-new-game` / `enter-loaded-world` 事件（appFlowMachine.ts:1、43、144-157
   收敛）、`LEGACY_SHORTCUTS_ENABLED`（main.ts:239-240）、旧存档链
   （`aeonvale-save-v1`，main.ts:235）；旧世界专属面板模块（inventoryUI、
   surfacePanels 旧段、farmsteadScene 等）与 openGame.ts 旧入口封装、被 skip 的用例
   一并移除。
2. **渲染**：移除 `renderer.ts` 与仅旧世界引用的渲染件（tileVisuals、worldDecor、
   npcWorldPreview、characterPresence 等）；保留面按「新主模式仍有引用」重算——
   已确认 ColorPalette 必留（rogueliteProto/surface.ts:33），其余届时以 import 图为准。
3. **sim 与词表统一**：整目录移除阶段 0 第 4 条所列旧系统 + `serialize.ts` +
   `index.ts` 出口收敛到 cultivation-run/roguelite/sokoban；params.ts 清理
   DEFAULT_BALANCE 旧段（保留 `cultivationRun` 段）；`ui.hud.stages` 词表随 renderer/
   surfacePanels 消费点消亡而退役，§8.15 词表统一工单在此落地（单表 =
   `CULTIVATION_REALMS`）。93 个旧 sim 单测与旧 property 套件同步移除。
4. **golden fixture 归档（建议）**：**随 sim 一并移除，以 git 历史为归档**。理由：
   (a) fixture 锁的是旧 sim 确定性哈希，sim 删除后永远不可能再通过，保留只会制造
   「看似可跑、实则必红」的僵尸资产；(b) runner 的「至少一条 fixture」断言
   （golden.replay.test.ts:9-11）使「留文件不跑」仍需改代码，并不更省；(c) 删除前
   末次通过绿线的 commit hash 在本节与退役提交信息中锚定，需要对照时 checkout 即得。
   `tests/replay/` 三件套与 `pnpm replay:update`、`tools/update-golden-replay.ts`
   同步移除；若未来 cultivation-run 需要 golden replay，以本套 harness/schema 方法论
   为模板重建（golden-replay-update skill 的适用对象随之转移）。

**完成判据**：三步各自通过全量四门（§2.5 的 governance/typecheck/test/build）；
应用层步后 `git grep "enterLegacyWorld" -- src/ tests/` 与
`git grep "aeonvale-save-v1" -- src/` 均为空；sim 步后 `src/sim/` 仅剩
cultivation-run、roguelite、sokoban（+ params 与新出口），
`git grep "ui.hud.stages" -- src/` 为空；浏览器套件用例数与迁移登记表一致且全绿。

**风险与回滚**：删除面大，靠三步切分与逐提交 `git revert` 回滚；sim 步是不可逆点——
docs/27 的回退承诺自该提交起失效，旧世界只能从 git 历史重建，因此 sim 步前必须取得
维护者第二个签字（见启动前置条件）。词表统一出现文案争议时，先合 sim 删除、词表工单
单独走，不互相阻塞。

#### 阶段 3：清理收尾

**动机**：主体删除后，残留引用会让 grep 治理与后续贡献者持续付认知税。

**动作清单**：复核 `.gitignore`（本轮已核实无旧世界条目，预期只需确认）；收窄
`.gitleaks.toml` 正则（去掉 `save|` 分支）；清理 package.json 死脚本（`replay:update`
等）与 playwright/vitest 配置的旧排除项；`tools/` 旧 sim 工具（headless-run、
balance-scan/tune、m5-*、simulation-metrics、playtest-report、onboarding-funnel）按
阶段 2 前置决策退役或重定向到 cultivation-run；docs/08、16 等旧世界设计文档头部加
「已随旧世界退役归档」状态注记（不删内容）；README 与交付媒体复核无旧世界入口表述
（本轮已核实 README 无命中）。

**完成判据**：对 `src/ tools/ tests/ .github/ package.json` 范围做
`git grep -iE "legacyworld|legacy-world|旧世界"`，仅剩刻意保留的迁移注记；
全量四门 + 浏览器套件绿；`.gitleaks.toml` 正则不再匹配已删槽名。

**风险与回滚**：低；工具脚本退役若误删仍在用者，由 typecheck 与 governance 门拦截，
按提交回退。

#### 启动前置条件（何时可以启动）

1. **阶段 1 门槛**：主模式通过 §4.5 的真人可玩性验证且 docs/27 §12.3 的真人 Go/No-Go
   样本给出 Go——「保留作对照与回退」的对照价值先衰减，退役才有正当性。
2. **维护者签字（两道）**：第一道撤销 docs/27 对照承诺、授权阶段 0-1；第二道在阶段 2
   sim 删除前（不可逆点）单独授权。未经当次明确授权不执行，与 AGENTS.md 的 Git 授权
   规则同口径。
3. **阶段 2 附加前置**：§8.15 词表统一工单与 m5 认证链去向（随旧 sim 退役，还是重定向
   到 `DEFAULT_BALANCE.cultivationRun`）已定案排期；AGENTS.md 技能清单中
   balance-sweep-tune / sim-invariant / golden-replay-update / content-add 的适用对象
   重定向方案已评审（AGENTS.md 是模型缓存断点，调整须一次到位）。
4. **全程质量门**：每阶段收口跑全量四门；阶段 2 每步另跑 `pnpm test:browser`，并以
   §8.5 的「单 worker 隔离 + 全量 workers=1」两档口径为准。

### 8.17 第十四轮（同月）：子代理批次二（P1 安全网 + P2×2）

1. **[P1] 修途主模式 golden 回放 fixture**（新增，非行为变更）：纯 sim 层
   驱动完整一世 65 步（三轮议程→事件×2→参悟×2→引劫→22 步渡劫含 undo→
   perfect 突破→二次渡劫 timeout 身亡→劫灰换代），canonicalSerialize+sha256
   逐步哈希；四次再生成字节级幂等。新 fixture 置于 fixtures/cultivation/
   子目录（旧 golden 测试按非递归 glob 扫描，互不可见）。src 零改动。
2. **[fix] 附带发现的存量 bug**：`tools/update-golden-replay.ts` 尾部
   `main;`（裸引用）——`pnpm replay:update` 自入库起一直是 no-op。修复为
   `main();` 并实跑验证：旧 fixture 再生成 JSON 规范化完全相等（差异仅为
   缩进格式规范化，语义零变化），二次运行字节稳定。
3. **[P2] 构建分包优化**：vite manualChunks 按 src 顶层领域重分组
   （app-sim/app-roguelite-proto/app-narration/app-render/app-content/
   app-io），主 chunk 1341kB→462kB，>650kB 警告消除，JS 总量 +0.04%，
   全静态 import 不改加载时序；分块构建下浏览器冒烟 17/17（smoke/
   narration/roguelite/app-flow，覆盖两个新应用 chunk）。
4. **[P2] §8.16 退役草案**：见上节（子代理产出，含 12 spec 依赖面修正）。

#### 本批中央验证

typecheck / governance(882) / 单测 2757（含新 4 例 replay）/ content:lint /
build（零警告）/ 浏览器冒烟 17-17 全绿；随后原子提交推送并 Actions 验证。
