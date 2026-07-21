# GitHub 首次公开与发布检查

## Private 初始化

- [ ] GitHub 开启 Keep my email addresses private 与 Block command line pushes that expose my email。
- [ ] 创建 Private 仓库 `AeonVale`，默认分支 `main`，不自动生成 README、License 或 `.gitignore`。
- [ ] 使用 GitHub 用户名 `AeonVale` 和账户对应的 noreply 邮箱建立全新三提交历史；不推送当前旧历史。
- [ ] 确认远端只允许 Squash merge，关闭 Merge commit 与 Rebase merge。
- [ ] 启用 Issues，关闭 Wiki 与 Discussions。

## Ruleset / 分支保护

- [ ] 保护 `main`，要求 Pull Request、解决所有对话和分支保持最新。
- [ ] Required checks：`Governance and repository hygiene`、`Typecheck, tests, build, and simulation`、`Chromium smoke`。
- [ ] 禁止 force push、删除和直接推送 `main`；不要求审批与签名提交。
- [ ] 启用 Dependabot alerts、Dependabot security updates、Secret scanning、Push protection 与 Private vulnerability reporting。

## 生成公开树前

- [ ] 使用 `pnpm prepare:public-tree <目标目录>` 从私有工作区生成干净公开树；不要手工复制 `docs/`。
- [ ] 不上传 `docs/` 设计包、路线图细案、世界观、叙事、数值、风险登记、测试策略或 `assets/ART-ASSETS-STATUS.md` 等设计/状态文档。
- [ ] 在公开树运行 `pnpm governance:public`，确认设计类文档已排除。
- [ ] 在公开树重新运行 `pnpm governance:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`，不能用私有工作区结果代替公开树验收。

## 转 Public 前

- [ ] 公开版 README 已审阅，未泄露设计包细节、内部路线图、Agent 状态、真实邮箱或私有治理内容。
- [ ] CI、浏览器冒烟、M5 结构门禁和生产构建全绿。
- [ ] `pnpm governance:check` 确认无 Agent 状态、密钥、环境文件、构建产物或 sourcemap 被跟踪。
- [ ] `pnpm governance:check` 同时确认工作区没有未跟踪的 Agent 状态、临时 Playwright 配置或其他公开禁物。
- [ ] `pnpm governance:public` 确认公开树不包含设计类文档。
- [ ] 下载并本地试玩 `web-dist` artifact；检查桌面 Chromium 首屏、核心操作、存档和声音。
- [ ] 仓库 Description、Topics 与 About 信息已填写。

## Public 与 Pages

- [ ] 将仓库可见性改为 Public。
- [ ] Settings -> Pages 的 Source 设为 GitHub Actions。
- [ ] 新建仓库变量 `ENABLE_PAGES=true`；Private 阶段不得设置为 true。
- [ ] 手动运行 Deploy GitHub Pages，确认 `https://AeonVale.github.io/AeonVale/` 可访问且无 `.map` 文件。
- [ ] 将仓库 Homepage 设置为试玩地址。

## v0.1.0

- [ ] `package.json` 版本、`CHANGELOG.md` 与输入版本一致。
- [ ] 从受保护的 `main` 手动运行 Release workflow。
- [ ] 检查 `v0.1.0` 标签、中文 Release Notes、英文摘要与 Web ZIP。
- [ ] 下载 Release ZIP 离线启动并完成首次发布验收。
