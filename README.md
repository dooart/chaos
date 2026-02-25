# Chaos Notes

A minimal, file-based personal knowledge system designed for AI-assisted workflows.

## Features

- **One note per idea** — notes evolve in place, no separate drafts
- **Stable IDs** — 21-character nanoid that never changes, even when renaming
- **Minimal metadata** — just id, title, optional status and tags
- **Git-backed** — optional automatic commit and push
- **AI-native** — works with any agent that can run shell commands
- **Web UI** — simple React app for human access

## Works With

- [OpenClaw](https://openclaw.ai/)
- [Claude Code](https://claude.ai/)
- [Codex](https://openai.com/codex)
- Any AI assistant with shell access

## Installation

Clone to your agent's skills directory:

```bash
# OpenClaw
git clone https://github.com/dooart/chaos.git ~/.openclaw/skills

# Claude Code
git clone https://github.com/dooart/chaos.git ~/.claude/skills

# Other agents - check your agent's docs for skills directory
git clone https://github.com/dooart/chaos.git /path/to/skills
```

**❗ After cloning, run `bun install` from the repo root** to install all dependencies (scripts + web). Then see **[SETUP.md](SETUP.md)** to configure the web UI and optional git backup. The data directory (`~/.chaos`) is created automatically on first use.

Follows the [AgentSkills](https://skill.md) format supported by most AI coding agents.

## Structure

```
~/.chaos/               # Your data (default location)
├── notes/             # Your notes
└── assets/            # Images

/path/to/skills/chaos/  # Skill directory
├── SKILL.md           # Agent instructions
├── SETUP.md           # Setup guide
├── scripts/           # Automation scripts
├── web/               # React web UI + server
└── data/              # Symlink to ~/.chaos
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

After setup, ask your AI agent:
- "Create a note about project ideas"
- "Search my notes for anything about AI"
- "Update my todo note with a new item"

Or use the CLI directly:

```bash
# Create a note
bun scripts/chaos.ts new "My First Note"

# Search notes
bun scripts/chaos.ts search "keyword"

# Start the web UI
cd web && bun run server.ts
```

## License

MIT
