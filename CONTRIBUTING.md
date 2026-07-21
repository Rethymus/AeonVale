# 贡献指南

本文件是项目开发、Git 与 Agent 协作规范的唯一正式来源。`AGENTS.md` 和 `CLAUDE.md` 只作为工具入口，不得维护互相冲突的副本。

## 开发基线

- Node.js 22，pnpm 10；依赖安装使用 `pnpm install --frozen-lockfile`。
- 保持 `src/sim` 确定、无 IO、无渲染依赖；随机行为必须走项目 PRNG。
- 改动规模与测试覆盖相匹配。合并前至少运行 `pnpm governance:check`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- 不提交 `.env*`、密钥、真实邮箱、Agent 状态、存档、构建产物、覆盖率或 sourcemap。

## Agent 规则

- Claude Code 和 Codex 每次进入仓库后，必须先读取本文件，再读取与任务相关的源码和文档。
- 未经用户当次明确授权，不得执行 commit、push、force push、历史重写、打标签、创建 Release 或修改远端仓库设置。
- 不得修改仓库级或全局 Git 用户名、邮箱、签名配置。
- 不添加 `Co-authored-by` 或 AI 作者信息。维护者负责设计、审阅、测试与最终结果。
- 不提交 `.claude/`、`.omc/`、`.codex/`、`.agents/` 等本地状态。
- 工作区可能包含人工或其他 Agent 的未提交修改，不得回退不属于当前任务的改动。

## Commit

格式：`<type>(<scope>): <简体中文描述>`；scope 可省略。

允许类型：`feat`、`fix`、`docs`、`test`、`refactor`、`perf`、`build`、`ci`、`chore`、`revert`。

示例：

```text
feat(alchemy): 新增七情配伍冲突提示
fix(save): 修复旧版本存档迁移失败
docs(readme): 更新本地开发说明
```

- type/scope 使用英文小写，scope 使用 kebab-case。
- 描述必须包含简体中文，标题不超过 100 个字符，末尾不加句号。
- 一次提交只表达一个主要意图；禁止 `feat+test` 等组合类型。
- 破坏性变更使用 `!`，正文添加 `BREAKING CHANGE:`。
- 提交不签名；公开作者使用 GitHub 用户名和 GitHub noreply 邮箱，真实邮箱不得进入历史。

## 分支与 PR

- `main` 是远程展示与公开发布分支，只保留可公开的必要内容；不得包含创作设定、玩法细案、路线规划、美术状态、参考图、Agent 状态或其它本地资料。
- `dev` 是远程开发与备份分支，用于同步日常开发、设定文档和可复现资产来源；仍不得提交 `.env*`、密钥、真实邮箱、Agent 状态、存档、构建产物、覆盖率或 sourcemap。
- 从 `dev` 发布到 `main` 时，必须使用 `pnpm prepare:public-tree <目标目录>` 生成并检查公开树，或只挑选已确认可公开的必要路径；禁止把 `dev` 整体合并到 `main`。
- 临时功能改动可从 `dev` 新建 `feat/*`、`fix/*`、`docs/*`、`chore/*` 等短期分支提交 PR。
- 仅使用 Squash merge；PR 标题必须满足上述 Commit 格式，并成为最终提交标题。
- 合并前必须解决对话、更新到最新 `main` 并通过全部 Required Status Checks。
- 禁止直接推送、强制推送或删除 `main`。紧急绕过必须留下可审计说明。

## 发布

- Private 仓库完成 README、CI、规则集和首次发布检查后才转 Public。
- 公开仓库、Pages 与 Release 产物只使用 `pnpm prepare:public-tree <目标目录>` 生成并通过检查的公开树。
- README、贡献、安全、许可证、变更记录和 GitHub 模板属于可公开治理文档；创作设定、玩法细案、路线规划、美术状态等设计资料不得进入公开仓库、Pages 或 Release 产物。
- Public 后启用 GitHub Pages；生产构建必须关闭 sourcemap。
- Release 只从受保护的 `main` 手动触发，版本、`package.json` 与 `v*` 标签必须一致。
- 未经用户明确授权，Agent 不得发布版本。

## 授权

- 源代码使用 MIT License。
- 原创文本、世界观、叙事、数据表和美术内容使用 CC BY-NC 4.0，详见 `CONTENT-LICENSE.md`。
- 贡献即表示提交者有权提供相关内容，并同意其按对应许可发布。
