# 32 · 天劫 Sokoban 难度带全量扫描报告（docs/31 P3 数据底座）

> 状态：基线报告（2026-09-13）。工具：`tools/sokoban-sweep.ts`（只读驱动
> `@sim/sokoban` 纯函数，不改 sim）。运行：
> `node node_modules/tsx/dist/cli.mjs tools/sokoban-sweep.ts --salts 100 --stages 2-6`

## 1. 目的与方法

docs/31 §1.3 给生成器加了「难度带定向重试」：目标带 `center = 10 + 6·stage`、
半径 4，带内候选即刻采纳，32 次全带外则取离带心最近者。该设计在实施时只做了
小样本验证。本轮对其做全量扫描，量化三件事：

1. 各阶实际认证步数分布 vs 目标带（带内率）；
2. 生成成本（重试风暴）；
3. 劫式三型（快/缠/势）、阵型、必需石组合的多样性。

方法：对每 `(stage, seedSalt)` 调 `createPuzzle(stage, salt)`（与
`surface.ts` 的 `enterTribulation` 同一入口、同确定性种子协议），采集
`challenge.certifiedMoves/budgetSlack/firstMoveFanout/solverNodes/flavorTag/
archetype`、`moveBudget`、修饰附着数；另调 `generateBoard` 判模板兜底。
确定性抽验：同参数重跑 JSON 全等。

注意：真实游戏会把 `preparation.unlockedBlockKinds` 作为 `requiredBlockKinds`
传入（本扫描用空约束生成）——约束只会进一步限制候选空间，故带内率结论在
真实路径上不会更好。

## 2. 基线数据（n=20/阶）

| stage | 板面 | 带心 | 认证步中位 | 带内率 | 松紧比中位 | 劫式三型（快/缠/势） | 修饰附着 |
| ----- | ---- | ---- | ---------- | ------ | ---------- | -------------------- | -------- |
| 0 | 5×5 | 10 | 12 | 100% | 0.77 | 0/0/20 | 0/20 |
| 1 | 5×5 | 16 | 15 | 100% | 0.85 | 14/0/6 | 0/20 |
| 2 | 6×6 | 22 | 19 | 80% | 0.68 | 9/9/2 | 0/20 |
| 3 | 6×6 | 28 | 24 | 50% | 0.67 | 5/11/4 | 0/20 |
| 4 | 7×7 | 34 | 17 | **0%** | 1.14 | 15/4/1 | 11/20 |
| 5 | 7×7 | 40 | 16 | **0%** | 1.31 | 14/3/3 | 9/20 |
| 6 | 8×8 | 46 | 16 | **0%** | 1.50 | 11/6/3 | 7/20 |

确定性抽验通过（0 违例）；模板兜底 0（生成器从不失败，但代价见 §3）。

## 3. 核心发现

### F1 难度带公式在高阶失效（P0）

带心 `10 + 6·stage` 线性外推，但推箱+光路约束下板面可达认证步在高阶不增反降
（stage3 中位 24 → stage4-6 中位 16-17）：7×7/8×8 板面引入 conductor/insulator
复合必需石后，光路到达身体的最短路径反而更短。stage≥4 带内率 **0%**，32 次
重试全部带外，永远走「最近候选」保底。

### F2 带外重试风暴 = 生成成本爆炸（P0）

带内率 0% 意味着高阶每颗棋盘必跑满 32 次 `tryGenerate` + 有界重解。
扫描实测（含扫描工具自身双倍生成开销）：stage4-5 约 25-40s/20 颗、
**stage6 约 300s/20 颗**。折算真实游戏单次 `createPuzzle`：高阶天劫入场
**卡顿 ~7-15s**——这是玩家可感知的停顿（`enterTribulation` 同步调用）。

### F3 劫式三型被 insulator 支配（P2）

`deriveFlavorTag` 规则「requiredBlockKinds 含 insulator ⇒ swift」使 stage1 起快型
占优、高阶 55-75% 为 swift；momentum（势型）在高阶萎缩到 5-15%。「三型手感
多样性」的实际分布与设计预期（势型为默认）倒挂。

### F4 低扇出与重解成本高企（P2）

stage2+ 约 65% 样本 `firstMoveFanout ≤ 1`（首步错即死路），10/20 样本求解器
节点 ≥4000（有界上限）。低扇出本是 docs/31 §1.3 想压制的信号，未压住。

## 4. P3 建议（按性价比排序）

1. **带公式饱和化**（修 F1+F2 的一半）：`center = min(10 + 6·stage, 可达上限)`
   ——以 100-salt 实测分位数定各阶可达带心（stage4-6 约 16-20），让带内重试
   真正命中，重试次数自然回落。
2. **提前放弃**（修 F2 的另一半）：连续 K 次（如 8 次）带外即 break 取当前最近
   保底——即使不重校带，也把高阶生成成本封顶到 ~1/4。
3. **swift 判定去支配**（修 F3）：insulator⇒swift 改为「insulator 且
   slackRatio ≤ 0.5」，或给 momentum 加折点数权重，恢复三型分布。
4. **入场异步化**（兜底 UX）：`enterTribulation` 的同步生成挪出输入帧
   （loading 态占位），根治高阶卡顿感知。

> 1-3 需改 `src/sim/sokoban`（主模式活 sim，不属于阶段 3 门控），但会改变
> 同种子板面 → 需按 `golden-replay-update` skill 重授权 cultivation replay
> 夹具（若 replay 覆盖到天劫种子）。改动须落在下一轮带完整数据与回放
> 影响评估的独立提交。

## 5. 100-salt 确认数据（stages 2-6 × 100 seeds，总计 500 样本，3826s）

n=20 结论全部在大样本下成立且更显著：

| stage | 带心 | 认证步 min/p25/中位/p75/max | 带内率 | swift 占比 | 低扇出(≤1) | 重解(≥4000) |
| ----- | ---- | ---------------------------- | ------ | ---------- | ---------- | ------------ |
| 2 | 22 | 13 / 18 / 19 / 22 / 27 | 79% | 43% | 60% | 58% |
| 3 | 28 | 14 / 21 / 24 / 27 / 36 | 52% | 29% | 60% | 58% |
| 4 | 34 | 9 / 14 / **17** / 20 / 26 | **0%** | 69% | 62% | 60% |
| 5 | 40 | 10 / 14 / **16** / 19 / 28 | **0%** | 71% | 56% | 54% |
| 6 | 46 | 10 / 14 / **16** / 18 / 25 | **0%** | 65% | 61% | 60% |

确定性抽验：0 违例。生成成本实测：500 样本 3826s，其中 stage6 约 12.5s/样本
（含扫描工具双倍生成）——折算真实单次 `createPuzzle` 约 **6s/次**，且这是
无约束生成；真实路径带 requiredBlockKinds 约束只会更贵。

**可达带心经验表**（p75 口径，供带公式再校准参考）：
`stage2→22, stage3→27, stage4→20, stage5→19, stage6→18`。高阶可用难度
不升反降（7×7/8×8 板面 + 复合必需石缩短最短光路），线性带心公式
`10 + 6·stage` 在 stage≥4 完全脱锚。建议下一轮以「按阶查表带心 + 半径 4」
或饱和函数替代线性公式，并配合 §4-2 的提前放弃封顶成本；两者都改
`src/sim/sokoban`（主模式活 sim，非阶段 3 门控），但换种子板面 → 须经
`golden-replay-update` skill 重授权 `cultivation-run-lifecycle` 夹具。

## 6. 工具

`tools/sokoban-sweep.ts`：参数 `--salts N`、`--stages a-b`；stderr 输出进度，
stdout 输出逐阶统计与确定性抽验。后续复跑只需该命令，无需改 sim。

## 7. 修复实施与复测（2026-09-13，P3 §4-1/4-2/4-3 落地）

按 §4 前三项建议实施（`src/sim/sokoban/generator.ts`，主模式活 sim）：

1. **带心查表**：`SOKOBAN_BAND_CENTER_BY_STAGE = [10,16,22,27,20,19,18]`（§5
   经验表），超表尾取末位、负值夹表头；`bandCenterForStage` 导出。
2. **早停语义**：连续 8 次带外**且无更近候选**才放弃（`outOfBandStreak`
   仅在未刷新最近距离时递增，刷新即归零）——中阶候选持续逼近带心时保留
   搜索（实测初版"连续 8 次带外"一刀切会把 stage2/3 带内率压到 40%/30%，
   平台期语义恢复到 66%/44%）。
3. **swift 去支配**：insulator⇒swift 收紧为 `insulator && slackRatio ≤ 1.1`
   （阈值经 25 salt/阶 × 4 门限探针实测选定；0.9 门在高阶 swift 仍归零，
   1.1 门三型每阶齐备）。

**复测（n=50/阶 × 7 阶）**：

| stage | 带内率（前→后） | swift 占比（前→后） | 备注 |
| ----- | --------------- | ------------------- | ---- |
| 2 | 79% → 66% | 43% → 44% | 中位 19→18 |
| 3 | 52% → 44% | 29% → 24% | 带心 28→27 |
| 4 | **0% → 64%** | 69% → 30% | 中位 17 不变 |
| 5 | **0% → 64%** | 71% → 10% | |
| 6 | **0% → 76%** | 65% → 8% | 缠/势 46/46 平分 |

- 三型分布：每阶三型齐备（stage1 缠型结构性缺席——板面仅 1 灵草）。
- 成本：整链扫描 3826s → 1194s（2.6-3.2×）；纯 `createPuzzle` 高阶约
  **6s → 3-4s/次**（剩余为每尝试求解+扇出开销；入场异步化仍列 §4-4）。
- 确定性：0 违例。
- **Golden replay**：夹具两钉板（stage2/salt11、stage3/salt29）在新行为下
  不变——`replay:cultivation:update` 重授权后 **git diff 0 行**（数学证明
  不变，符合 golden-replay-update skill"预期内行为变更→更新零差异"路径）。

结论：§4-1/4-2/4-3 关闭；§4-4（入场异步化）为剩余 UX 项。

## 8. §4-4 入场异步化实施（2026-09-13，P3 收官）

`src/app/rogueliteProto/surface.ts`（UX 层，不碰 sim）：

1. **enterTribulation 拆分**：点击「现在引劫」后立即上屏占位层
   （`.rp-tribulation-loading`：天劫将至·雷云聚形，absolute 盖棋盘网格，
   静态样式守动效纪律），双 rAF 确认占位已绘制后才执行同步推演
   （buildTribulationBoard）——推演不再占用输入帧。
2. **半态防竞**：`tribulationBuilding` 窗口内 persistJourney 挂起（防空
   session 快照）、棋盘键盘输入挂起（防旧 state 错步）；棋盘就绪后补存。
3. **自愈**：恢复快照若落在推演窗口（session 为空），showTribulationBoard
   转入 enterTribulation 重建，而非渲染空盘。

**时序实测**（Playwright rAF 采集，stage1 全流程真点击）：点击 → 占位上屏
**51ms**（≤2 帧）；占位 → 棋盘就绪 35ms（低阶）。高阶推演时长不变
（3-4s），但已移出输入帧且全程有可见反馈。证据采集用一次性探针 spec
（走查 劫兆→两轮规划→结算→事件→参悟→劫抉→现在引劫 全链），数据留档
于此，探针不入库。

验证：单测 2039/2039；浏览器回归 44/44（roguelite 全家 + cultivation
keypoint 全过——CDP keypoint 用手作谜题不经生成路径，天然免疫异步化）；
治理/构建/preflight 通过。

**docs/32 §4 四项建议全部关闭。**

## 9. §4-4 视觉核查与残余同步生成点处置（2026-09-13）

**占位层视觉核查**（真入场流程截图，rAF 延迟钩子拉长窗口，DOM/CSS 全真）：
构图居中（kicker「天劫将至」宽字距·宋体大标题「雷云聚形，劫盘推演中……」
金色强调·分隔线下注语），暗色放射底与棋盘面板融合，右侧持久状态轨保留
上下文；就绪后截图与既有 portfolio 基准**字节级一致**（CDN 内容哈希去重
证实）——占位层零残留、棋盘渲染零漂移。

**残余同步 createPuzzle 调用点评估**（实测单次耗时）：

| 调用点 | stage | 耗时 | 处置 |
| ------ | ----- | ---- | ---- |
| 模块初始化（177） | 0 | 4ms | 保留 |
| beginCultivationRun | 0 | 4ms | 保留（无感） |
| 换代 transitionToHeir（2548） | 0 | 4ms | 保留（无感） |
| 测试 keypoint（1582/1619 等） | 0-2 | 4-64ms | 保留（测试 parity） |
| **beginStagePlanning** | 1→6 | 64ms-**3.9s** | **懒惰化移除** |

beginStagePlanning 的占位棋盘是丢弃型产物：规划屏不渲染棋盘，真入场
（buildTribulationBoard）按 `machineState.runState.stage` 重新生成。高阶
换阶（3→4 起）在结算继续键上同步阻塞 2.5-3.9s——本批直接删除该生成，
`state` 保持上一块有效棋盘作画布尺寸兜底（入场时 resizeCanvasForState
重设）。`state.board` 全部消费点（draw/ghost/bodyCenter）都在天劫屏内，
规划屏零读取；快照/恢复路径经入场重生成自洽。

验证：单测 2039/2039；浏览器回归 44/44；治理/构建/preflight 通过。

## 10. 健康指标刷新与休眠质量门修复（2026-09-13）

依 m5:report/balance 数据刷新触发巡检，发现**三个质量工具自 7abf33f
（发布治理工具链提交）起入口即坏**：`main;`（裸表达式）而非 `main();` ——
m5-certify/balance-scan/balance-tune 全部空转（零输出、恒 exit 0），**CI 的
m5:check 门从未真正执行过**。本批修复三处并激活：

- **m5 pr profile（镜像 CI 门）实跑 1.9s 通过**：结构零失败、
  mechanicalDeadlocks=0、确定性复跑通过——激活后 CI 保持绿。
- 指标快照（旧世界农庄 sim，64 seeds）：veteran ascension 79.7% [0.683,
  0.877]（目标带 0.75-0.85 内）；normal 26.6%（目标带 0.3-0.45 下沿之下，
  pr 样本不足 Wilson 认证）。
- balance 扫描：三组参数单调性正常（harvestCult 推进单调↑、tribulationBolts
  在扫描范围内惰性、lootChance 只抬收益不动妖兽税）。

**结论与迭代点裁定**：上述指标全部度量旧世界农庄 sim——按退役计划属阶段 3
删除范围，现在为其调参是给将删系统返工，不做。真正的缺口是**主模式（修途）
没有 m5/balance 覆盖**：tests/replay/cultivation-harness 已具备确定性全生命
周期驱动，补一层多种子指标汇总（stage 分布/死因分布/渡劫结果分布）即可成为
修途版 m5——留作下一轮迭代点（工具层，不碰 sim）。

## 11. 修途版 m5 健康指标工具（2026-09-13，§10 锁定项落地）

`tools/cultivation-metrics.ts` + `pnpm cultivation:metrics` / `cultivation:check`：

1. **驱动**：复用 tests/replay/cultivation-harness 同一确定性 sim 链路
   （agenda→event→insight→preparation→puzzle→session→settlement→epitaph→
   heir），自由生命周期循环（每次引劫前两轮日程；身死/封卷走劫灰传承
   换代续世；飞升终局）。渡劫 = solver 最优「天机代打」（有实体丹时
   开盾）；日程三型策略（balanced/herbalist/ascetic，按境界解锁替换）。
   全部派生选择走 Rng 命名流——同 (seed,policy) 复跑逐字节一致（已验证）。
2. **首校准基线**（seeds=8×3 策略×换代上限 4，171 次渡劫，25s）：
   - balanced/herbalist（无体魄训练）：**stage-0 过载身死 100%**，连继承
     换代也救不回——首劫对零训练策略是硬教学门（solver 直解 = 最短光路
     = 最大雷威，弱肉身必过载；符合"承雷先锻体"设计语义）。
   - ascetic（苦修系）：推进 3-4 境，perfect 52.3% / survived 35.5% /
     insufficient 12.1%，零过载零超时；最终资源枯竭封卷换代（gen 封顶）。
   - 朴素代理无人飞升（0%）——代理能力锚点，非趣味目标。
3. **sim 侧观察（只记录不改）**：事件标签 `ward-charge:+1` 授予的护持
   充能不含实体丹——0 丹开盾会使结算陷入 `invalid-consumption` 死局。
   代理已对齐真人（无丹不开盾）；若未来真人路径可达同态，需在 app 层
   置灰开盾或 sim 层让 tag 充能自带丹。
4. `--check` 与按策略基线带比对出带即红（当前全过）；未接 CI——带值
   与代理策略强耦合，先稳定几轮再考虑入夜扫。
