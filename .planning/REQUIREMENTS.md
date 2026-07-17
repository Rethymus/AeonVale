# REQUIREMENTS · Milestone portfolio-sketch-wave-a

> GSD 作用域需求。ID 稳定，供 phase plan / 验收引用。  
> 分级：`P0` = Wave A MVP 必要；`P1` = Wave B；`P2` = Wave C。

## P0 / Wave A — 作品集草图可感闭环

| ID | 需求 | 退出标准（执行式） | 证据命令 / 产物 |
|----|------|-------------------|-----------------|
| **REQ-A0-01** | 公开展示轨具备像素硬边渲染 | live/local public tree：`antialias:false` + `roundPixels` + texture `nearest` | PR port `01bf653`；截图无 LINEAR 发虚 |
| **REQ-A0-02** | 世界层空闲仍有环境呼吸 | smoke idle 帧门：空闲后 `renderFrameCount` 继续增长；作物/角色 bob 可见 | `pnpm test tests/browser/smoke.spec.ts`；`tests/unit/render-scheduler.test.ts` |
| **REQ-A0-03** | 部署后 Pages 复验 | `mvp-preflight --include-live-pages` 绿（维护者部署后） | `pnpm portfolio:mvp-preflight -- --include-live-pages` |
| **REQ-A1-01** ✅ | 教学天劫支持玩家擦弹 | 在预警区内确认落雷且 `perfectBlock:true` → `hitType==='blocked'`；区外 → 非 blocked（走位/承伤规则不变） | `tests/unit/tutorial-tribulation.test.ts` |
| **REQ-A1-02** ✅ | 擦弹为显式峰值输入 | UI 文案/按钮在「区内」提示擦弹；不引入全动作层；确定性（无隐藏技巧 RNG） | `publicDemoPanels` + `resolve-tutorial-bolt.perfectBlock` |
| **REQ-A1-03** ✅ | 战后可读 blocked | aftermath `hitLabel` 区分擦弹与走位/正面 | `tests/unit/public-demo-panels.test.ts` |
| **REQ-A2-01** ✅ | 雷劫招牌镜头 | 教学落雷至少一次几何电光（非仅全屏白闪） | `lightningBolt.ts` + `triggerTribBolt`；unit 几何测 |
| **REQ-A3-01** ✅ | 农务 juice 保持并加强 | 翻/浇/收：粒子+SFX+轻震+飘字；天劫擦弹飘字 | `spawnFloatText` + `triggerShake` + unit |
| **REQ-A3-02** ✅ | 布局不溢出 | 文案宽度软门 + responsive-layout DOM 硬门（无水平溢出 / 面板不互穿） | `uiCopyBudget` + `tests/unit/ui-copy-budget.test.ts` + `tests/browser/responsive-layout.spec.ts` |
| **REQ-A4-01** ✅ | 漏斗无阻断 | bot N 局达 `first-loop-complete` | `pnpm funnel --seeds=6` → completeness PASS |
| **REQ-A4-02** | 真人样本 | 5–10 人「美/好玩/清楚」；未完成前禁止 human certified | playtest 报告；`humanHoursCertified:false` |
| **REQ-A5-01** ✅ | 炼丹七情一口可见 | 教学丹方面板展示配伍关系文案（相使/相须/…）；不扩 sim 规则 | `pairingLabel` + unit + vertical-slice |
| **REQ-V1-T1-01** ✅ | 炼丹面板可见炉体与火候读图 | 面板含 `facility.talisman-furnace` 图；理想火候区+指针；`heatBand` low/ideal/high | main #11；`index.html` furnace + unit |
| **REQ-V1-T1-02** ✅ | 教学天劫落雷区空间感 | active 阶段世界层绘制中心+八邻域脉动区（非仅坐标文案） | main #11；`tutorialWarningZone.ts` + unit |
| **REQ-V1-T2-01** ✅ | 角色/NPC 在场感 | 玩家朝向可读（镜像+尖头）+脚影；NPC 脚影；高灵气 sparkle | main #12；`characterPresence.ts` + unit |
| **REQ-V1-T3-01** ✅ | 场内地点感装饰 | 空地稀疏路径石/草/石/远雾/栅栏；确定性；不盖关键操作格 | main #13；`worldDecor.ts` + unit |
| **REQ-V1-T4-01** ✅ | 农作四态可读 | 空/翻/播/浇视觉拉开（边框、水洼、种子点、收获抬升） | main #13；`tileVisuals` + unit |
| **REQ-V1-T5-01** ✅ | 主角色块在场 | 非纯黑剪影：暖袍/肤色底层 + 贴图 tint | main #13；`playerPresencePalette` + unit |
| **REQ-V1-T6-01** ✅ | HUD 密度软收 | 次要入口默折叠；完成后简报/帮助压缩 | main #13；`#world-command-more` |
| **REQ-V1-L01** ✅ | journey-complete 无教学残留 | 完成后自由经营文案；停灌教学对白 | main #13；`isJourneyTeachingActive` + main 清对白 |

## P1 / Wave B — Patch（草图稳后）

| ID | 需求 | 备注 |
|----|------|------|
| REQ-B01 | Windows/Linux 桌面封装 | 不阻塞 P0 |
| REQ-B02 | 暖棚/阵法日常深化 | 高频生活层 |
| REQ-B03 | 正式主动引劫峰值窗 | 与教学同构，日级被动可仍简化 |

## P2 / Wave C — DLC / 远期封存

| ID | 需求 | 备注 |
|----|------|------|
| REQ-C01 | NPC/节日/内容厚度 | 封存 |
| REQ-C02 | 留世终局深挖 | 封存 |
| REQ-C03 | 移动端 | 封存 |

## OMC 切片约束（每轮必答）

1. 属于 `P0 / P1 / P2` 哪一级？  
2. 服务哪条真实玩家高频路径？  
3. 哪条门禁证明没有打断首轮演示？

## 非目标（写入避免回流）

- 不做全即时弹幕战斗  
- 不横向加系统替代打磨  
- 不伪造 Pages 已验证 / 人类已认证  
