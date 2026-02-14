---
name: wile
description: Run Wile autonomous coding agent on chaos projects. Use when the user wants to implement stories from a project's backlog using an AI coding agent.
---

# Wile — Autonomous Coding Agent

Wile is an autonomous AI coding agent that reads `.wile/prd.json` (stories backlog) and implements stories one by one using a coding agent CLI (Claude Code, Codex, Gemini CLI, or OpenCode). It runs in Docker.

Source code: `~/opensrc/repos/github.com/dooart/wile`

## Finding a Project from a Chaos Note

Chaos notes can link to a project via the `project:` frontmatter field. The path is relative to the chaos data directory (default `~/.chaos`).

```yaml
---
id: abc123def456ghi789012
title: Little Errant
project: projects/little-errant
---
```

This resolves to `~/.chaos/projects/little-errant/`.

## PRD Format

Each project has a `.wile/prd.json`. This is the stories backlog that Wile processes.

```json
{
  "stories": [
    {
      "id": 1,
      "title": "Set up project scaffolding",
      "description": "Initialize the project with the basic structure.",
      "acceptanceCriteria": [
        "package.json exists with correct name",
        "`npm run build` exits with code 0",
        "README.md exists with setup instructions"
      ],
      "dependsOn": [],
      "status": "done"
    },
    {
      "id": 2,
      "title": "Implement core feature",
      "description": "Build the main functionality.",
      "acceptanceCriteria": [
        "`npm test` passes all assertions",
        "src/core.ts exports the main function",
        "`npm run typecheck` exits with code 0"
      ],
      "dependsOn": [1],
      "status": "pending"
    }
  ]
}
```

### Story Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Unique story identifier |
| `title` | string | Short summary of the story |
| `description` | string | Detailed description of what to implement |
| `acceptanceCriteria` | string[] | Concrete, verifiable checks (commands to run, files to check) |
| `dependsOn` | number[] | IDs of stories that must be done first |
| `status` | string | `"pending"` or `"done"` |
| `compactedFrom` | string? | Range of compacted story IDs, e.g. `"1..3,5"` (done stories only) |

Array position determines priority — earlier stories are implemented first.

## Configuring Wile in a Project

Before running Wile, the project needs a `.wile/` directory with configuration. Use the non-interactive config command:

```bash
cd <project-dir>

# Print config reference (all fields, requirements, examples):
bunx wile config --non-interactive

# Apply config with a JSON payload:
bunx wile config --non-interactive '<json>'
```

The `--non-interactive` flag prints full documentation of every field. Read that output to determine what JSON to pass.

### Configuration Workflow

When a user asks you to configure Wile for a project:

1. **Ask the user** which coding agent they want: Claude Code (CC), Codex (CX), Gemini CLI (GC), or OpenCode (OC).

2. **Determine repo source**: If the project is already on disk (typical for chaos projects), use `"repoSource": "local"`. If the user wants Wile to clone from GitHub, use `"repoSource": "github"` and ask for the repo URL.

3. **GitHub token** (only if `repoSource=github`):
   - Check if `gh` CLI is available and authenticated: `gh auth status`
   - If yes, create a fine-grained PAT automatically:
     ```bash
     gh auth token
     ```
     Use that token as `githubToken`. This avoids asking the user to manually create a token.
   - If `gh` is not available or not authenticated, ask the user to provide a GitHub token.

4. **Coding agent credentials**: Ask the user for the auth token or API key for their chosen agent. The `--non-interactive` help output lists exactly which fields are needed per agent.

5. **Apply the config**:
   ```bash
   cd <project-dir>
   bunx wile config --non-interactive '{"codingAgent": "CX", "repoSource": "local", ...}'
   ```

**Key principle:** Only ask the user for things you can't determine yourself. Preferences (agent, model) and secrets (tokens) come from the user. Everything else (branch name, iterations, paths) has sensible defaults.

## Running Wile

```bash
cd <project-dir> && bunx wile run
```

The project must have `.wile/secrets/.env` configured before running (see above).

## Monitoring Progress

While Wile is running:

- **Progress & learnings:** `.wile/progress.txt` in the project directory
- **Commits:** `git log` in the project directory
- **Story status:** `.wile/prd.json` — Wile marks stories as `"done"` as it completes them
- **Logs:** `.wile/logs/` — one log file per run

If the project is linked to a chaos note, progress and logs are also visible in the chaos web UI under the Backlog tab (Logs and Progress sub-tabs).
