# Codex Usage

This repo was designed around Claude Code, but a large part of the system is just:

- markdown instructions in `CLAUDE.md` and `modes/`
- your data in `cv.md`, `config/profile.yml`, `modes/_profile.md`, and `portals.yml`
- utility scripts for PDF generation and tracker maintenance

That means you can use Codex here too, but it is not a perfect drop-in replacement.

## What Works Well With Codex

- Editing and customizing the user files
- Generating and refining reports, CV text, and tracker data
- Running the Node and Go utility scripts
- Batch execution through `codex exec` using the Codex backend in `batch/batch-runner.sh`

## What Is Still Claude-Specific

- `.claude/skills/career-ops/SKILL.md`
- The `/career-ops ...` command UX
- Some prompt text still carries Claude-era wording, though the repo now ships `career-browser.mjs` as the concrete Playwright replacement
- Documentation that says "open Claude Code" or "run claude"

In practice: the data pipeline is reusable, but the command surface is still Claude-oriented.

## Interactive Codex Workflow

Open Codex in the repo root and tell it to use the repo instructions as context:

1. Read `CLAUDE.md`
2. Read `modes/_shared.md`
3. Read `.claude/skills/career-ops/SKILL.md`
4. Read the mode file you want, for example `modes/scan.md` or `modes/oferta.md`
5. Then perform the task

Examples:

- "Read `CLAUDE.md`, `.claude/skills/career-ops/SKILL.md`, `modes/_shared.md`, and `modes/scan.md`, then scan the companies in `portals.yml`."
- "Read `CLAUDE.md`, `modes/_shared.md`, and `modes/oferta.md`, then evaluate this JD against `cv.md` and save the report."

## Browser Automation Replacement

Instead of Claude-only browser tool names, use the repo-local Playwright helper:

```cmd
cmd /c node career-browser.mjs jd "https://jobs.example.com/role/123" --json
cmd /c node career-browser.mjs listings "https://jobs.ashbyhq.com/company" --company="Company" --json
```

This is the intended Codex-compatible replacement for:
- rendered JD extraction
- active/closed job verification
- career page listing discovery

## Batch With Codex

The batch runner now supports a Codex backend.

### Bash

```bash
CAREER_OPS_AGENT_BACKEND=codex batch/batch-runner.sh --parallel 2
```

### If Codex is installed somewhere non-standard

```bash
CAREER_OPS_AGENT_BACKEND=codex \
CAREER_OPS_CODEX_JS="/path/to/@openai/codex/bin/codex.js" \
batch/batch-runner.sh
```

The Codex backend uses `codex exec --full-auto` through the local Node entrypoint.

## Windows Note

If `codex` fails in PowerShell because script execution is disabled, use the Node entrypoint directly:

```powershell
node "$env:APPDATA\\npm\\node_modules\\@openai\\codex\\bin\\codex.js" --help
```

or run the batch runner from Bash.

## Current Limitation

Codex support here is practical, not native. The repo has not been fully migrated from Claude conventions yet.

If you want a full migration, the next steps are:

1. Replace the `.claude` skill/router with a Codex-native entry workflow
2. Add a first-class Codex launcher or wrapper command
3. Update README and setup docs to treat Codex as a supported runtime, not an alternative
4. Replace the remaining Claude-branded UX and command naming where desired
