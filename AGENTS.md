# Codex Entry Point

Before taking any action in this repository, read and follow `CONTRIBUTING.md` in full.

Mandatory first-turn rules:

1. Treat `CONTRIBUTING.md` as the single source of truth for development, Git, security, and release policy.
2. Do not commit, push, rewrite history, tag, release, or alter Git identity unless the user explicitly authorizes that action in the current task.
3. Never publish local Agent state, secrets, real email addresses, generated artifacts, or production sourcemaps.
4. Preserve unrelated working-tree changes and run the required governance and quality checks before completion.

These rules apply regardless of the selected Codex model.

## Project agent skills

Bespoke workflow skills live in `.claude/skills/` (each is a self-contained `SKILL.md`). Codex does not auto-load Claude Code skills, so when a trigger below fires, open the matching `.claude/skills/<name>/SKILL.md` and follow it.

- `llm-playtester` — judge replay traces（旧 world 驱动已随阶段 3 退役；主模式轨迹见 `tests/replay/cultivation-harness`）。Red line: the LLM never enters `src/sim/`.
- `golden-replay-update` — update `tests/replay` fixtures only after an accepted behavior change, never to make a test green. 主模式路径：`pnpm replay:cultivation:update -- --init`（参数/生成器变更后必须 --init 全新授权；默认模式只刷哈希，会用夹具内嵌旧参数复放）。
- `balance-sweep-tune` — 旧 world 工具已随阶段 3 退役。主模式等价物：`pnpm cultivation:metrics`（四类分布）、`pnpm cultivation:check`（基线带门，已接 CI）、`tools/cultivation-tune.ts`（邻域 hill-climb 与 --exhaustive 全景观）；方法论与数据链见 docs/32 §14-§21。
- `content-add` — 旧世界内容管线已退役（content-lint 仅保留 manifest/narration 资产校验）。主模式内容 = cultivation-run 定义 + narrationScenes 文案，新增走单测 + 治理门。
- `sim-invariant` — 旧世界属性套件已退役。纯度纪律继续适用：主模式 sim（sokoban / cultivation-run / roguelite）禁 IO/时钟/Math.random，确定性由 cultivation:check 与 golden replay 守护。

Note: `.claude/` is gitignored, so these are local-only. To persist them for the team/Codex across clones, mirror them into a tracked directory — see wiki page "纯代码无引擎游戏开发——前沿方向与 Agent Skill 适配".

## Vibe-coding playbook (token / quality / deploy)

Before multi-session feature work, read `.omc/research/vibe-coding-playbook.md`. Highest-ROI rules:

1. **Cap retry loops** — same failing fix ≤2 attempts, then stop and report (retry storms = #1 token leak).
2. **Route by difficulty** — hard/research/debug on `gpt-5.6-sol` (`--profile sol`, high reasoning); routine dev on `gpt-5.5` (`--profile dev`); set via `~/.codex/<name>.config.toml` (model/profile/auth keys are user-level only). Pin AGENTS.md+skills as a GPT-5.6 cache breakpoint — don't edit them often (edits invalidate the ~87.5% cache saving).
3. **"Tests green" ≠ playable** — add a CDP state-injection gate per critical input (e.g., set `semanticGameState`→seed-sow, fire Z, assert plant fired). Details: playbook §B.

Note: `.omc/` is gitignored (local-only, like `.claude/`). To share the playbook across clones, mirror it into a tracked dir.
