# Claude Code Entry Point

Before taking any action in this repository, read and follow `CONTRIBUTING.md` in full.

Mandatory first-turn rules:

1. Treat `CONTRIBUTING.md` as the single source of truth for development, Git, security, and release policy.
2. Do not commit, push, rewrite history, tag, release, or alter Git identity unless the user explicitly authorizes that action in the current task.
3. Never publish local Agent state, secrets, real email addresses, generated artifacts, or production sourcemaps.
4. Preserve unrelated working-tree changes and run the required governance and quality checks before completion.

These rules apply regardless of the selected Claude model.

## Project agent skills

Bespoke workflow skills live in `.claude/skills/` (each is a self-contained `SKILL.md`). Read the matching skill when its trigger fires — they encode the project's non-obvious conventions (determinism red lines, content pipeline, balance/tuning pipeline, replay-update safety).

- `llm-playtester` — run an LLM as a playtester/balance surrogate over the headless sim (`.claude/skills/llm-playtester/`) or judge replay traces. Red line: the LLM never enters `src/sim/`.
- `golden-replay-update` — update `tests/replay` fixtures only after an accepted behavior change, never to make a test green.
- `balance-sweep-tune` — Monte-Carlo sweeps + CMA-ES/NSGA-II auto-tune over `docs/14 §11` params; commands `pnpm balance|tune|m5:check|m5:report|m5:certify`.
- `content-add` — add herb/pill/item/event/NPC the full way: def → registry → i18n → balance param → `pnpm content:lint` → tests → replay update.
- `sim-invariant` — derive fast-check properties from `docs/14` math (conservation/normalization/bounded/monotone/deterministic); keep the sim pure.

Note: `.claude/` is gitignored, so these are local-only. To persist them for the team/Codex across clones, mirror them into a tracked directory — see wiki page "纯代码无引擎游戏开发——前沿方向与 Agent Skill 适配".
