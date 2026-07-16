# GitHub 仓库公开化与协作治理设计

状态：已确认，待实施  
适用项目：Aeon Vale: Song of the Dao / 永恒山谷：大道之歌  
计划仓库名：`AeonVale`

## 1. 目标

本设计用于将当前本地项目整理为适合作品集展示、外部审阅和长期维护的 GitHub 仓库，并为 Claude Code、Codex 与人工开发建立统一约束。

目标包括：

- 建立干净、真实且不泄露本地开发状态的公开 Git 历史。
- 公开仓库可以上传 `README.md`、贡献指南、安全说明、许可证、变更记录、Issue/PR 模板和必要 Agent 入口；`docs/` 设计包、路线图细案、世界观、数值表、资产状态和其他设计类文档全部保留在私有工作区，不进入公开历史。
- 统一提交、分支、Pull Request、CI/CD、Release 和文档规范。
- 让 Claude Code 与 Codex 遵循同一规范源，并由自动化校验兜底。
- 在 Private 仓库完成全部验收后再转为 Public。
- 将 GitHub Pages 作为作品集试玩入口，而不是中国大陆市场的唯一正式发行渠道。
- 明确源代码与原创内容的不同授权边界。

## 2. 非目标

本次公开化不包含：

- 保留或公开当前 44 个本地开发提交。
- 公开 `docs/` 下的设计文档、路线图、世界观、叙事、数值、测试策略或风险登记。
- 公开 `docs/` 下的设计文档、路线图、世界观、叙事、数值、测试策略、风险登记或资产状态文档。
- 伪造项目逐步开发的公开历史。
- 在 Private 阶段正式发布 GitHub Pages。
- 首次公开时同步支持移动端、触控操作、Windows/Linux 桌面客户端打包或 macOS 正式封装。
- 引入自动版本发布、CLA、DCO、GitHub Discussions 或复杂社区治理。
- 将 AI 辅助开发作为项目的主要宣传卖点。

## 3. 仓库身份与元数据

- GitHub 仓库名：`AeonVale`。
- 项目英文标题：`Aeon Vale: Song of the Dao`。
- 项目中文标题：`永恒山谷：大道之歌`。
- 默认分支：`main`。
- npm package 名保留为 `aeon-vale-song-of-the-dao`，无需与仓库名完全一致。
- GitHub Description 使用简洁中文，说明这是以修仙、种田、炼丹与天劫生存为核心的 2D 纯代码离线单机游戏项目；浏览器是当前开发、测试与公开展示载体。
- Topics 控制在 8 至 12 个，候选包括 `game`、`indie-game`、`typescript`、`pixijs`、`vite`、`vitest`、`farming-sim`、`tower-defense`、`xianxia`、`chinese` 和 `open-source`。
- 初期关闭 Wiki 和 Discussions，启用 Issues。
- 仓库转为 Public 并完成 Pages 部署后，将 Homepage 设置为试玩地址。

## 4. Git 身份与新历史

### 4.1 公开身份

- Commit author name 使用项目维护者的 GitHub 用户名。
- Commit author email 使用 GitHub 提供的 `noreply` 邮箱。
- 不公开真实邮箱，不使用当前占位邮箱 `dev@aeonvale.local`。
- `package.json` 的 `author`、README 维护者信息和版权信息统一使用 GitHub 用户名。
- 不使用 GPG 或 SSH commit signing，不要求 Signed Commits。
- 实施前开启 GitHub 的邮箱隐私保护和阻止命令行推送暴露邮箱选项。

具体 GitHub 用户名和 `noreply` 地址是实施阶段参数，不在本设计中猜测填写。

### 4.2 历史重建

当前历史不推送到 GitHub。公开仓库从清理后的当前项目状态建立新历史，只创建以下 3 个语义真实的初始化提交：

```text
chore: 导入项目源码与设计文档
ci: 建立质量检查与自动部署流程
docs: 完善项目说明与贡献规范
```

- 第一条提交包含清理后的源码、测试和工具，但不包含 `docs/` 设计包或资产状态类 Markdown 文档。
- 第二条提交包含 CI、Pages、Release、commitlint、Git hooks、Dependabot 和仓库卫生校验。
- 第三条提交包含 README、CONTRIBUTING、CHANGELOG、Agent 入口及社区文件，但不包含任何设计类文档。
- 首次初始化是唯一一次不通过 PR 进入 `main` 的操作。
- 旧 `.git`、Agent 状态和工作树归档必须放在新仓库目录之外，且永不推送。

## 5. 提交与 Pull Request 规范

### 5.1 提交格式

采用 Conventional Commits 的结构，英文类型和作用域配合简体中文描述：

```text
<type>(<scope>): <简体中文描述>
```

示例：

```text
feat(alchemy): 新增七情配伍冲突提示
fix(save): 修复旧版本存档迁移失败
test(tribulation): 补充紫雷目标选择属性测试
docs(readme): 更新本地开发说明
```

允许的类型：

```text
feat fix docs test refactor perf build ci chore revert
```

规则：

- `type` 和 `scope` 使用英文小写。
- `scope` 使用英文小写 `kebab-case`，不设置固定白名单。
- 描述必须包含简体中文；代码标识符、文件名、命令和技术名可保留英文。
- 标题不超过 100 个字符，末尾不加句号。
- 禁止 `feat+test`、`fix+balance` 等组合类型。
- 一次提交只有一个主要意图，必要时拆分提交。
- 破坏性变更使用 `!`，并在正文添加 `BREAKING CHANGE:`。
- Dependabot 等受信任机器人提交可配置有限豁免。

### 5.2 自动强制

- 使用 commitlint 校验 Conventional Commits 结构。
- 使用共享自定义规则或脚本校验中文描述，避免本地与 CI 标准漂移。
- 使用 `simple-git-hooks` 安装 `commit-msg` hook。
- GitHub Actions 校验 PR 标题和 PR 中的提交信息，防止 `--no-verify` 绕过。
- 因为采用 Squash merge，PR 标题必须满足最终提交格式。

### 5.3 分支和合并

- `main` 是唯一长期分支，必须保持可构建、可测试、可部署。
- 所有日常改动使用短期分支，例如 `feat/alchemy-feedback`、`fix/save-migration`。
- 所有日常改动通过 Pull Request 进入 `main`。
- 只允许 Squash and merge，关闭 Merge commit 和 Rebase merge。
- 不要求 PR 审批和 Code Owner 审批，避免个人维护者无法自行合并。
- 必须通过 Required Status Checks、更新到最新 `main` 并解决全部 PR 对话。
- 禁止直接推送、强制推送和删除 `main`。
- 管理员原则上遵守规则；紧急绕过必须留下 Issue 或文字说明。

## 6. Claude Code 与 Codex 协作

- `CONTRIBUTING.md` 仍作为正式开发与 Git 规范源，可以进入公开仓库。
- 根目录 `AGENTS.md` 与 `CLAUDE.md` 可作为 Codex / Claude Code 入口进入公开仓库，但不得包含设计包内容、真实邮箱、本地状态或私有路径。
- 公开前必须在清理后的公开树运行 `pnpm governance:public`，确认设计类文档已排除。
- Claude Code 和 Codex 未经当次任务明确授权，不得提交、推送、重写历史、创建标签或发布 Release。
- Agent 不得修改仓库级 Git 用户名、邮箱或签名配置。
- AI 不默认添加 `Co-authored-by`；公开历史使用维护者身份。
- README 透明但克制地披露 AI 辅助开发，强调维护者负责设计决策、代码审查、测试验证与最终结果。

## 7. CI 设计

### 7.1 PR 强制门禁

每个 Pull Request 至少运行：

1. 冻结安装依赖。
2. PR 标题和提交信息校验。
3. TypeScript 类型检查。
4. 内容 Schema 和内容规则校验。
5. 单元测试。
6. 属性测试。
7. 集成测试。
8. Golden Replay。
9. 生产构建。
10. 基础无头冒烟测试。
11. Chromium 浏览器冒烟测试。
12. 仓库卫生与敏感信息检查。

所有适合阻塞合并的任务注册为 Required Status Checks。暂不把覆盖率百分比设置为硬门槛。

### 7.2 `main` 合并后

- 重新执行完整 CI。
- 生成 `dist` artifact，Private 阶段保留 7 至 14 天供下载验收。
- Public 阶段仅在验证成功后部署 GitHub Pages。
- Pages 部署任务依赖测试和构建任务，不允许失败代码上线。

### 7.3 定时深度检查

定时任务运行：

- 大规模无头模拟。
- 平衡认证与报告。
- 多种子确定性验证。
- 完整覆盖率报告。

定时任务失败需要清晰可见，但不直接阻塞普通 PR。现有 `m5-nightly.yml` 重构为不绑定里程碑的长期命名，例如 `nightly.yml`。

### 7.4 工作流约束

- 固定 Node.js 22 和 pnpm 10。
- 使用 `pnpm-lock.yaml` 和 `pnpm install --frozen-lockfile`。
- Actions 使用最小权限。
- 同一 PR 的新提交到达时取消旧任务。
- GitHub Actions 依赖由 Dependabot 定期更新。

## 8. GitHub Pages

- Private 阶段不正式启用 Pages，只验证静态构建和 artifact。
- 仓库转为 Public 后，在 Settings -> Pages 中将 Source 设置为 GitHub Actions。
- 每次 PR 合并到 `main` 且完整 CI 成功后，自动更新在线试玩版。
- 不维护独立的 `gh-pages` 分支，不把 `dist/` 提交进 `main`。
- 使用 GitHub 官方 Pages Actions，并授予最小权限：`contents: read`、`pages: write`、`id-token: write`。
- Pages URL 预计为 `https://<username>.github.io/AeonVale/`。
- Vite 部署路径通过构建环境确定，避免把个人用户名硬编码到通用配置中。
- Pages 和 Release 的生产构建关闭 sourcemap。
- GitHub Pages 是作品集 Demo，不承诺中国大陆访问速度和稳定性，也不是唯一正式发行渠道。
- 首次不购买自定义域名，不引入 Vercel、Cloudflare Pages 等额外平台。

## 9. 版本、Changelog 与 Release

- 从 `v0.1.0` 开始采用 Semantic Versioning。
- `0.x` 阶段由维护者根据可玩版本和重要系统变化决定 minor/patch。
- 标签只从受保护的 `main` 创建，并使用 `v` 前缀。
- 不随每次合并自动发布版本。
- 使用手动触发的 GitHub Actions Release 工作流。
- 发布前校验输入版本、`package.json` 版本和 Git 标签一致。
- 发布前重新执行完整 CI，失败时不得创建标签或 Release。
- Release Notes 以中文为主并附简短英文摘要。
- 首次 Release 只提供 Web 构建 ZIP。
- `CHANGELOG.md` 面向玩家和使用者记录有效变化，不罗列所有内部重构和测试调整。
- `main` 对应最新稳定开发状态，Release 对应人工确认的版本快照。

存档兼容规则：

- patch 版本原则上向后兼容同一 minor 的存档。
- 破坏存档兼容性必须在 Release Notes 中显著说明。
- 公开测试后，存档 Schema 变化应提供迁移逻辑，不得无提示丢弃玩家数据。

## 10. 授权与贡献边界

采用混合授权：

- 程序代码使用 MIT License，包括模拟、渲染、工具、测试和构建配置。
- 项目名称、Logo、世界观、剧情、角色、中文文案、玩法设定文本、美术、音乐、音效及其他原创内容保留版权。
- 设计文档默认属于保留版权内容，允许阅读和合理引用，不允许直接复制用于其他游戏或商业项目。
- 第三方素材继续遵循各自许可证。
- 根目录保留代码 `LICENSE`，新增内容授权说明，例如 `LICENSE-CONTENT.md`。
- README 不再笼统声称“整个项目 MIT 开源”，改为“源代码采用 MIT License”。

贡献策略：

- 接受 Issue、缺陷报告和代码 Pull Request。
- 提交代码表示贡献者有权提交，并同意代码按 MIT 发布。
- 剧情、世界观、美术、音乐和音效等内容贡献必须事先通过 Issue 确认授权方式。
- 初期不引入 CLA 或 DCO。

## 11. 安全与隐私

### 11.1 Agent 状态隔离

- `.gitignore` 排除 `.omc/`、`docs/.omc/`、`.claude/worktrees/`、Agent 会话、缓存、日志和本地状态。
- `.claude/` 默认忽略，只有明确具有共享价值的配置才通过白名单纳入。
- Codex 只公开根目录 `AGENTS.md`，不提交本地 Codex 状态目录。
- `.env*` 默认忽略，只允许提交不含真实值的 `.env.example`。

### 11.2 凭据和仓库卫生

- CI 和发布配置不得包含 PAT、Cookie、私钥、凭据或本机绝对路径。
- Pages 和 Release 优先使用 GitHub `GITHUB_TOKEN`，遵循最小权限。
- 按账户能力启用 Secret scanning、Push protection 和 Dependabot alerts。
- 启用 Private Vulnerability Reporting，不要求公开安全联系邮箱。
- CI 阻止常见会话目录、密钥文件、构建产物、超大文件和敏感模式进入 Git。
- 首次公开前扫描新历史和当前文件内容，包括 README、日志、测试 fixture 和构建产物。
- 检查用户名、家庭目录、真实邮箱、内部路径和提示词记录是否泄露。

## 12. README 与作品集展示

README 采用中文主文加精简英文摘要：

- 首屏展示项目名称、真实游戏画面和 Public 后的在线试玩入口。
- 说明核心玩法、项目状态、技术架构、运行方式、测试体系、授权边界和浏览器要求。
- 不写死容易过期的测试数量和里程碑状态。
- 控制徽章数量，只保留 CI、License、Pages 和版本等高价值状态。
- AI 辅助开发说明保持透明和克制。
- 明确移动端暂不支持。

公开前必须完成：

- 一张项目封面图，并适配 GitHub Social Preview，建议约 `1280 x 640`。
- 3 至 5 张真实游戏截图，覆盖种田、炼丹、天劫、阵法和 HUD。
- 一个不超过 15 秒的核心玩法演示 GIF 或短视频。
- 一张说明 `sim` 与 `render/io/tools/tests` 分层的技术架构图。
- 展示素材存放在 `docs/assets/`，使用相对路径，不依赖外部图床。
- 实机截图和概念素材必须明确区分，不使用概念图冒充实机画面。
- 截图不得出现调试工具、本机路径、个人账户或开发环境隐私。
- 所有展示素材归入保留版权内容。

## 13. 首发展示与平台支持范围

- 首次公开定位为离线单机多端项目的浏览器首发展示版。
- 正式支持最新版 Chrome、Edge 和 Firefox。
- Safari 为尽力兼容，不作为首发硬门禁。
- 要求启用 JavaScript，并提供 WebGL2。
- 使用键盘操作，推荐显示宽度至少 `1280px`。
- 移动浏览器和触控操作暂不正式支持。
- CI 使用 Chromium 自动冒烟测试。
- 公开前人工试玩 Chrome、Firefox，并在条件允许时检查 Edge。
- Windows 与 Linux 桌面端封装属于公开后的下一阶段目标，前提是同一套离线单机核心循环已在浏览器展示版中稳定验证。

## 14. 社区文件

首次公开包含：

- `CONTRIBUTING.md`。
- `.github/PULL_REQUEST_TEMPLATE.md`。
- `.github/ISSUE_TEMPLATE/bug_report.yml`。
- `.github/ISSUE_TEMPLATE/feature_request.yml`。
- `.github/ISSUE_TEMPLATE/content_proposal.yml`。
- `.github/ISSUE_TEMPLATE/config.yml`。
- `SECURITY.md`。
- `CHANGELOG.md`。

首次公开暂不添加：

- `CODE_OF_CONDUCT.md`。
- `SUPPORT.md`。
- `CODEOWNERS`。
- GitHub Discussions。

## 15. Dependabot

- 每周一检查 npm 和 GitHub Actions 依赖更新。
- 限制同时打开的 Dependabot PR 数量，避免维护噪声。
- 不自动合并依赖更新。
- 所有依赖更新必须通过与普通 PR 相同的 CI 门禁。

## 16. Private 转 Public 硬性验收

### 16.1 仓库与历史

- [ ] 新历史只有 3 个规范初始化提交。
- [ ] Author 和 Committer 均为 GitHub 用户名及 `noreply` 邮箱。
- [ ] 不含旧 `.git`、Agent 状态、worktree、构建产物或敏感信息。
- [ ] 默认分支为 `main`，合并策略和规则正确。

### 16.2 工程质量

- [ ] 冻结安装、类型检查、全部测试、Golden Replay、内容校验和生产构建通过。
- [ ] Chromium 自动冒烟测试通过。
- [ ] Chrome、Edge 和 Firefox 完成人工试玩。
- [ ] 定时深度任务至少成功运行一次。
- [ ] `dist` artifact 可下载，并能作为静态站点正常启动。

### 16.3 文档与授权

- [ ] README 中文主文与英文摘要完成。
- [ ] CONTRIBUTING、SECURITY、CHANGELOG 和 Agent 入口完成。
- [ ] MIT 代码许可与内容保留版权边界明确。
- [ ] PR 模板和三类 Issue 模板可用。
- [ ] README 不含过期数据或误导性功能声明。

### 16.4 作品集展示

- [ ] 封面和 GitHub Social Preview 完成。
- [ ] 3 至 5 张实机截图完成。
- [ ] 15 秒以内核心演示完成。
- [ ] 技术架构图完成。
- [ ] 素材不含本地路径、个人账户或调试信息。

### 16.5 GitHub 设置

- [ ] Description、Topics 和其他仓库元数据完成。
- [ ] Secret scanning、Push protection 和 Dependabot alerts 按可用能力开启。
- [ ] Private Vulnerability Reporting 开启。
- [ ] 分支 Ruleset 已配置，或准备在转 Public 后立即启用。
- [ ] Pages 工作流已完成静态审查，但尚未正式发布。

### 16.6 发布演练

- [ ] 手动 Release 工作流以不创建正式版本的方式验证。
- [ ] `package.json`、标签和 Release 版本一致性校验有效。
- [ ] 存档兼容性说明完成。
- [ ] Public 转换步骤和回滚方案记录完成。

## 17. 转为 Public 后的执行顺序

1. 检查 `main` Ruleset 是否仍然生效。
2. 在 Settings -> Pages 中选择 GitHub Actions 作为发布源。
3. 手动运行完整 CI 和首次 Pages 部署。
4. 验证试玩 URL、HTTPS、资源路径、WebGL2、键盘输入和 localStorage 存档。
5. 设置仓库 Homepage 为 Pages 地址。
6. 确认公开仓库页面、README、Social Preview、Issue 模板和安全报告入口。
7. Pages 验证完成后再创建 `v0.1.0` Release。

## 18. 实施顺序

实施阶段应按以下顺序推进：

1. 在仓库外归档旧历史和 Agent 状态。
2. 清理源码树并建立严格 `.gitignore`。
3. 补齐统一规范、授权、README 和社区文件。
4. 增加提交校验、仓库卫生检查、CI、nightly、Pages 和 Release 工作流。
5. 完成展示素材和浏览器冒烟测试。
6. 运行本地完整验收。
7. 使用 GitHub 用户名和 `noreply` 邮箱创建 3 个初始化提交。
8. 创建 Private `AeonVale` 仓库并首次推送。
9. 配置 GitHub 元数据、安全设置和分支规则。
10. 在 Private 状态完成硬性验收。
11. 转为 Public，启用并验证 Pages。
12. 验证完成后发布 `v0.1.0`。

## 19. 变更控制

本设计中的关键决策已由项目维护者确认。实施过程中如需变更以下事项，应先更新本设计并重新确认：

- 公开历史结构。
- 提交语言和格式。
- 分支与合并模式。
- 授权边界。
- Pages 部署触发方式。
- Release 自动化程度。
- 首发浏览器和平台支持范围。
- Private 转 Public 的硬性验收条件。
