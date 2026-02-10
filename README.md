# Chaos Notes

A minimal, file-based personal knowledge system designed for AI-assisted workflows.

Recommended setup: [OpenClaw](https://openclaw.ai/) and [exe.dev](https://exe.dev).

## Features

- **One note per idea** — notes evolve in place, no separate drafts
- **Stable IDs** — 21-character nanoid that never changes, even when renaming
- **Minimal metadata** — just id, title, optional status and tags
- **Git-backed** — every change is committed and pushed automatically
- **AI-native** — designed for agents to read and write notes via scripts
- **Web UI** — simple React app for human access

## Structure

```
chaos/
├── notes/          # All notes as <id>-<slug>.md
├── assets/         # Images (webp) with metadata
├── scripts/        # Automation scripts (create, update, delete, search)
├── skills/         # AI agent skill definitions
├── web/            # React web UI + Hono server
└── tests/          # Test files
```

## Note Format

```markdown
---
id: abc123def456ghi789012
title: My Note Title
status: building
tags: [tag1, tag2]
---

# Content here

Markdown body with [[links]] to other notes by ID.
```

## Quick Start

See [SETUP.md](SETUP.md) for full installation and configuration instructions.

```bash
# Create a note
./scripts/new-note.sh "My First Note"

# Search notes
./scripts/search-notes.sh "keyword"

# Start the web UI
cd web && bun run server.ts
```

## For AI Agents

See [AGENTS.md](AGENTS.md) for guidance on working with this codebase, and [skills/chaos/SKILL.md](skills/chaos/SKILL.md) for the full note management API.

## License

MIT
