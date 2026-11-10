# gstack setup: instructions for a coding agent

**For:** a Claude Code session (or another coding agent) on a teammate's machine that has been asked to "set up gstack" for this repo.
**Goal:** install gstack on this machine, check that it works, and leave the repo itself unchanged.

gstack (https://github.com/garrytan/gstack, MIT license) is a set of slash-command skills for Claude Code: `/review`, `/qa`, `/ship`, `/office-hours`, `/cso` and others. It installs per user into `~/.claude/skills/gstack`. It is **not** vendored into this repo.

## Rules for the agent

- Install only into the user's home directory. Do not add gstack files, `CLAUDE.md` or `.claude/` settings to this repo, and do not run team mode (`--team`, `gstack-team-init`), unless the user explicitly asks. The repo is shared, and its project instructions live in `AGENTS.md`.
- The install README suggests adding a gstack section to `CLAUDE.md`, including a rule never to use the Claude in Chrome tools. Skip that step unless the user asks for it.
- Read `setup` before running it (it is a long bash script). It downloads Chromium through Playwright and may register a Claude Code Stop hook in `~/.claude/settings.json`; it backs up that file first. Tell the user both of these things.
- Ask the user the telemetry question (below) when gstack raises it. Do not answer it for them unless they tell you to choose.

## 1. Check prerequisites

| Need | Check | Install if missing |
|---|---|---|
| Git | `git --version` | system package manager |
| Bun ≥ 1.4.2 (setup refuses < 1.3.3) | `bun --version` | macOS/Linux: `curl -fsSL https://bun.sh/install \| bash` · Windows (PowerShell): `powershell -c "irm bun.sh/install.ps1 \| iex"` |
| Node.js (required on Windows; Node 22.6+ needed for this repo's tests) | `node --version` | nodejs.org LTS |
| Windows only: Git Bash or WSL | `bash --version` | Git for Windows |

Bun installs to `~/.bun/bin`. In the current shell, run `export PATH="$HOME/.bun/bin:$PATH"` before the next steps. A new terminal picks it up automatically.

## 2. Install

Run in bash (Git Bash on Windows):

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup < /dev/null
```

- `< /dev/null` makes setup non-interactive. It then skips the optional "plan-tune" question-logging hooks, which is fine.
- If the user also uses Codex, Cursor or Gemini CLI, run `./setup --host auto` instead.
- The expected end of the output is `gstack ready (claude)` plus an install summary row for `claude`.

## 3. Verify

```bash
ls ~/.claude/skills | grep -E '^(gstack|review|qa|ship|office-hours)$'
~/.claude/skills/gstack/bin/gstack-doctor
```

Then tell the user to **restart Claude Code / VS Code** so the new `/` commands appear.

## 4. First-run questions (raised by the first gstack skill run)

| Question | What to do |
|---|---|
| Telemetry (off / anonymous / community) | Ask the user. If they defer to you, pick `anonymous`: `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous` |
| Proactive suggestions | Default `core` (suggests only /office-hours, /review, /qa, /ship): `gstack-config set proactive core` |
| Cross-project learnings | `false` (keep learnings per project): `gstack-config set cross_project_learnings false` |

## 5. Platform notes

- **Windows:** without Developer Mode, setup copies files instead of symlinking them. After updating gstack, re-run `cd ~/.claude/skills/gstack && ./setup`; `/gstack-upgrade` does this for you.
- **Windows:** Smart App Control can block gstack's unsigned binaries. If `browse.exe` or other binaries are blocked, use WSL or turn Smart App Control off (gstack's `docs/` has a troubleshooting page).
- **Windows:** `/cso` in native mode also needs Visual Studio 2022 Build Tools with the C++ workload.
- **macOS 15+:** the optional Aside browser is used when installed; otherwise gstack uses its bundled Chromium.

## 6. Using it in this repo

- Start here: `/gstack <what you want>` picks the right skill. You can also call one directly, for example `/review`.
- `/review` compares the current branch against `master`. **On `master` it stops with "Nothing to review"**, so work on a feature branch.
- gstack writes QA evidence to `.gstack/tmp/` inside the repo. Keep it out of git by adding it to the local exclude file, not `.gitignore`:
  `grep -qxF '/.gstack/' .git/info/exclude || echo '/.gstack/' >> .git/info/exclude`
- To run this repo's tests: `npm install`, then `npm test` with Node 22.6+. On older Node: `npx -y node@22 --experimental-strip-types --test "tests/**/*.test.ts"`.
- Tests that touch dates must use UTC (`toISOString()`, `getUTCFullYear()`), because the test database (PGlite) runs on GMT. Invoice rules reject issue dates in the future or more than 3 days back.

## 7. Uninstall

```bash
~/.claude/skills/gstack/bin/gstack-settings-hook remove-source --source gstack-timeline-stop   # removes the Stop hook first
rm -rf ~/.claude/skills/gstack ~/.gstack
```

Also remove the per-skill folders that setup created in `~/.claude/skills/` (`review`, `qa`, `ship` and so on; setup's "linked skills" output lists them).
