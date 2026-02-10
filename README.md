# Chaos Notes

A minimal, file-based personal knowledge system designed for AI-assisted workflows.

## Features

- **One note per idea** — notes evolve in place, no separate drafts
- **Stable IDs** — 21-character nanoid that never changes, even when renaming
- **Minimal metadata** — just id, title, optional status and tags
- **Git-backed** — optional automatic commit and push
- **AI-native** — designed for [OpenClaw](https://openclaw.ai/) agents
- **Web UI** — simple React app for human access

## Installation

```bash
cd ~/.openclaw/skills
git clone https://github.com/dooart/chaos.git
```

See [SETUP.md](SETUP.md) for full configuration instructions.

## Structure

```
chaos/                  # Skill directory
├── SKILL.md           # Agent instructions
├── SETUP.md           # Setup guide
├── scripts/           # Automation scripts
├── web/               # React web UI + server
└── data/              # Symlink to your data
    ├── notes/         # Your notes
    └── assets/        # Images
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

After setup, ask your OpenClaw agent:
- "Create a note about project ideas"
- "Search my notes for anything about AI"
- "Update my todo note with a new item"

Or use scripts directly:

```bash
# Create a note
./scripts/new-note.sh "My First Note"

# Search notes
./scripts/search-notes.sh "keyword"

# Start the web UI
cd web && bun run server.ts
```

## License

MIT
