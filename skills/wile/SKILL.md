---
name: wile
description: Run Wile autonomous coding agent on chaos projects. Use when the user wants to implement stories from a project's backlog using an AI coding agent.
---

# Wile — Autonomous Coding Agent

Wile is an autonomous AI coding agent that reads `.wile/prd.json` (stories backlog) and implements stories one by one using a coding agent CLI (Claude Code, Codex, Gemini CLI, or OpenCode). It runs in Docker.

Source code: `~/opensrc/repos/github.com/dooart/wile`

## Finding a Project from a Chaos Note

Chaos notes can link to a project via the `project:` frontmatter field. The path is relative to the chaos data directory (default `~/.chaos`).

Example:

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
        "Project builds successfully",
        "README exists with setup instructions"
      ],
      "dependsOn": [],
      "status": "done"
    },
    {
      "id": 2,
      "title": "Implement core feature",
      "description": "Build the main functionality.",
      "acceptanceCriteria": [
        "Feature works end to end",
        "Tests pass"
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
| `acceptanceCriteria` | string[] | List of criteria that must be met |
| `dependsOn` | number[] | IDs of stories that must be done first |
| `status` | string | `"pending"` or `"done"` |

Array position determines priority — earlier stories are implemented first.

## Running Wile

```bash
cd <project-dir> && bunx wile run
```

The project must have `.wile/secrets/.env` configured before running. For local projects (not cloned by Wile), set `WILE_REPO_SOURCE=local`.

## Setting Up `.wile/secrets/.env`

If `.wile/secrets/.env` doesn't exist in the project, walk the user through setup:

```bash
cd <project-dir> && bunx wile config
```

This interactive wizard will prompt for:

1. **`CODING_AGENT`** — which coding agent CLI to use:
   - `CC` — Claude Code
   - `CX` — Codex
   - `GC` — Gemini CLI
   - `OC` — OpenCode

2. **Credentials** — API keys or auth tokens for the chosen agent

3. **`WILE_REPO_SOURCE`** — set to `local` for local projects (the project repo already exists on disk)

## Monitoring Progress

While Wile is running, you can monitor its progress:

- **Learnings & progress:** check `.wile/progress.txt` in the project directory
- **Commits:** run `git log` in the project directory to see what Wile has committed
- **Story status:** check `.wile/prd.json` (Wile's working copy) for updated story statuses
