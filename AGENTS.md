# Agent Guide for Chaos Notes

This file helps AI coding assistants work on the Chaos Notes codebase.

## Overview

Chaos Notes is a skill/tool for managing personal notes. It works with any AI agent that can run shell commands (OpenClaw, Claude Code, Codex, etc.). Notes are markdown files with stable IDs, managed via a TypeScript CLI (`scripts/chaos.ts`).

## Key Directories

| Directory | Purpose |
|-----------|--------|
| `scripts/` | TypeScript CLI and libs for note CRUD |
| `web/` | React frontend + Hono/Bun server |
| `data/` | Symlink to user's data (notes + assets) |
| `tests/` | Test files |

## Working with Notes

For creating, editing, searching, or deleting notes, read:

```
SKILL.md
```

This contains the full API for note management. **Always use the CLI** — it handles validation and optional git commits.

## Architecture

### Scripts (`scripts/`)

- TypeScript CLI (`chaos.ts`) and library modules in `lib/`
- Each operation validates, modifies files, then commits/pushes if `data/.git` exists
- Uses `gray-matter` for frontmatter parsing, `sharp` for image processing

### Web (`web/`)

- **Server:** Hono framework on Bun, runs on port 24680
- **Frontend:** React + Vite, served from `/chaos/`
- **Auth:** Cookie-based sessions, credentials in `web/.env`
- **API:** REST endpoints at `/chaos/api/*`

Key files:
- `server.ts` — Hono server with all API routes
- `src/` — React components
- `.env` — `AUTH_USER` and `AUTH_PASSWORD` (required)

### Data (`data/`)

Symlink to `~/.chaos` (default) containing:
- `notes/` — All notes as `<id>-<slug>.md`
- `assets/` — Images (webp) with sibling `.md` metadata

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

## Setup for New Users

If the human needs help configuring Chaos, guide them to:

```
SETUP.md
```

## Common Tasks

### Adding a new API endpoint

1. Add route in `web/server.ts`
2. Follow existing patterns (auth middleware for `/chaos/api/*`)

### Modifying note validation

1. Update the relevant function in `scripts/lib/`
2. Update `SKILL.md` to reflect new rules

### Adding a new command

1. Add a function in `scripts/lib/`
2. Wire it up in `scripts/chaos.ts`
3. Follow pattern: validate → modify → git (if enabled)
4. Document in `SKILL.md`
