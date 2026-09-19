# 37 · 开源与工程资源第四轮调研（2026-09-18）

> 方法：WebFetch 仓库实证 + 试运行探针。聚焦前三轮（docs/33/35/36）未覆盖的
> **可视化/无障碍/上游资源**三角度。原则同前：采纳须可验证收益，不采纳须留档。

## 一、四条线索与采纳判定

| 线索 | 来源/仓库 | 许可 | 判定 |
| ---- | -------- | ---- | ---- |
| @axe-core/playwright（axe 无障碍扫描） | dequelabs/axe-core-npm | MPL-2.0 | **已采纳落地**（见 §二，本轮最有价值产出） |
| pixi-filters（PixiJS 官方滤镜库 v6） | pixijs/filters | MIT | 参考留档（见 §三） |
| LXGW WenKai 上游 | lxgw/LxgwWenKai v1.522（2026-03-17） | OFL-1.1 | 无即时动作（见 §四） |
| Renovate（依赖自动化） | mend/renovate | AGPL-3.0（工具本体） | 参考，不启用（见 §五） |

## 二、@axe-core/playwright：无障碍自动扫描（已采纳）

**动机**：项目无障碍纪律（ARIA/焦点/aria-live）一直靠手写断言，覆盖
"我们想到要测的"，缺"标准规则全集"的回归网。axe-core 是业界事实标准
（Deque Systems），`withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa'])`
一行即扫 WCAG A/AA。

**首扫即抓到真实 critical 违规**：参悟面 8 个节点按钮携带
`aria-posinset`/`aria-setsize`——该属性组合不允许出现在 `button` 角色
（axe `aria-allowed-attr` 规则；合法承载为 listitem/option 等）。
修复：属性移至外层 `li`（listitem 角色），位置语义无损保留。修复后
**主链七面（标题/日程/结算/事件/参悟/引劫时机/天劫棋盘）零违规**。

**落地物**：
- `tests/browser/a11y-axe.spec.ts`（常驻）：主链七面扫描，零违规断言
  ——新违规即回归，修因不改门；
- `src/app/cultivationRun/insightSurface.ts`：aria 位置修复；
- `@axe-core/playwright` devDependency（MPL-2.0 对本项目无传染）。

**教训**：手写无障碍断言 + 标准扫描器互补——前者覆盖语义意图，
后者兜底角色-属性合法性的长尾规则。

## 三、pixi-filters：官方滤镜库（参考留档）

pixijs 官方组织维护，v6 支持 PixiJS 8（MIT），37 滤镜含 GlowFilter /
ShockwaveFilter / GodrayFilter。**不即时采纳**：天劫光路辉光已有自造
实现（beamGlow 调色分层），帧预算 p95=16.7ms 满分，滤镜层每帧 GPU 开销
对移动端是风险未量化项。触发条件：若出现需要环境粒子/全屏后处理的表现
需求（雨/雪/神光），GlowFilter+Godray 是现成轮子，届时按帧预算门评估。

## 四、LXGW WenKai 上游：无即时动作

上游最新 v1.522（2026-03-17），项目内子集为早期版本裁剪。不跟进更新：
subset-font.mjs 需 SRC_FONT 完整 TTF 才能重切，且现有子集渲染验证充分；
更新收益（新字形/修字）对本项目 UI 文本影响极低。触发条件：若未来
重建字体子集（如 cn-font-split 分片立项，docs/36 §三），顺带用最新版。

## 五、Renovate：参考不启用

自动依赖更新机器人（AGPL-3.0 云服务，自托管配置复杂）。本项目依赖面
刻意极小（Pixi/Tone/fast-check/playwright/zod），且治理门（governance
三检 + 全量测试）已覆盖升级验证。自动 PR 流程对单人维护节奏收益不抵
噪音，**不启用**；依赖安全靠既有 CI 门兜底。

## 六、结论

本轮落地：axe 无障碍回归门（新增第 46 个浏览器测试）+ 1 个真实 critical
修复 + 1 个 devDependency。四轮调研台账：docs/33（六源）→ docs/34/35
（算法/范式/音频）→ docs/36（工程工具）→ 本篇（可视化/无障碍/上游）。
