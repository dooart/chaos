# Agent Guide for Chaos Notes

This file helps AI coding assistants work on the Chaos Notes codebase.

## Overview

Chaos Notes is a minimal, file-based personal knowledge system. Notes are markdown files with stable IDs, managed via bash scripts that auto-commit to git.

## Key Directories

| Directory | Purpose |
|-----------|--------|
| `notes/` | All notes as `<id>-<slug>.md` |
| `assets/` | Images (webp) with sibling `.md` metadata |
| `scripts/` | Bash scripts for note CRUD (auto-commit) |
| `skills/` | AI skill definitions |
| `web/` | React frontend + Hono/Bun server |
| `tests/` | Test files |

## Working with Notes

For creating, editing, searching, or deleting notes, read the skill file:

```
skills/chaos/SKILL.md
```

This contains the full API for note management. **Always use the scripts** — they handle git commits and validation.

## Architecture

### Scripts (`scripts/`)

- Pure bash + `bun` for frontmatter parsing
- Each script validates, modifies files, then commits and pushes
- `parse-frontmatter.ts` — TypeScript helper using `gray-matter`

### Web (`web/`)

- **Server:** Hono framework on Bun, runs on port 24680
- **Frontend:** React + Vite, served from `/chaos/`
- **Auth:** Cookie-based sessions, credentials in `web/.env`
- **API:** REST endpoints at `/chaos/api/*`

Key files:
- `server.ts` — Hono server with all API routes
- `src/` — React components
- `.env` — `AUTH_USER` and `AUTH_PASSWORD` (required)

### Note Format

```markdown
---
id: abc123def456ghi789012  # 21 chars, never changes
title: Note Title
status: building           # optional: building | done
tags: [tag1, tag2]         # optional
---

Markdown content with [[id]] links to other notes.
```

## Development

### Prerequisites

- Bun (JavaScript runtime)
- jq (JSON processing)
- ImageMagick (for image processing)

### Running the web server

```bash
cd web
bun install
bun run server.ts
```

### Building frontend

```bash
cd web
bun run build
```

Production files go to `web/dist/`, served by the Hono server.

## Setup for New Users

If the human needs help configuring Chaos for themselves (new repo, git auth, etc.), guide them to:

```
SETUP.md
```

## Common Tasks

### Adding a new API endpoint

1. Add route in `web/server.ts`
2. Follow existing patterns (auth middleware for `/chaos/api/*`)

### Modifying note validation

1. Update `scripts/commit-changes.sh` (validates frontmatter)
2. Update `skills/chaos/SKILL.md` to reflect new rules

### Adding a new script

1. Create `scripts/your-script.sh`
2. Follow pattern: validate → modify → git pull → git add → git commit → git push
3. Document in `skills/chaos/SKILL.md`
