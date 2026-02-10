---
name: chaos
description: Manage personal notes in the Chaos Notes system. Use this skill whenever the user asks to create, edit, rename, delete, search, or manage notes. Also use it when the user wants to record ideas, thoughts, learnings, or any kind of personal knowledge.
---

# Chaos Notes System

A minimal, file-based personal knowledge system for managing notes. Every note is a markdown file with stable IDs that never change.

## When to Use This Skill

Activate this skill when the user:
- Wants to **create a new note** or record an idea/thought
- Wants to **edit or update** an existing note
- Wants to **rename** a note
- Wants to **delete** a note
- Wants to **search or find** notes
- Wants to **list** their notes
- Asks about their notes, ideas, or personal knowledge
- Mentions "chaos", "notes", or "my notes"

## Directory Structure

```
__CHAOS_HOME__/
├── notes/          # All notes live here
├── scripts/        # Automation scripts
├── skills/         # This skill
└── web/            # Web UI (for human use, not agents)
```

## Note Format

Notes are markdown files named `<id>-<slug>.md` in `__CHAOS_HOME__/notes/`.

```markdown
---
id: abc123def456ghi789012
title: My Note Title
status: building
tags: [tag1, tag2]
---

# Content starts here

Markdown body...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | Yes | 21-character nanoid (lowercase alphanumeric). Never changes. |
| `title` | Yes | Human-readable title |
| `status` | No | Either `building` (actively working) or `done` (finished). Omit for seed/draft notes. |
| `tags` | No | List of lowercase tags (a-z, 0-9, hyphens only, max 20 chars each) |

### Internal Links

- Link to another note: `[[id]]` — title resolves at read time
- Link with custom text: `[[id|my custom text]]`
- Broken links render as raw `[[id]]`

## Scripts

All scripts are in `__CHAOS_HOME__/scripts/`. They handle git commits automatically.

### Create a New Note

```bash
__CHAOS_HOME__/scripts/new-note.sh "Note Title"
```

Creates a new note with generated ID, commits it, and prints the file path.

### Update a Note

**Important:** don’t pass literal `\n` in a quoted string — it will render as backslash-n. Use a heredoc or temp file.

```bash
# Update content only (preferred)
cat > /tmp/note.md <<'EOF'
# Title

Real newlines here.
EOF
__CHAOS_HOME__/scripts/update-note.sh "<id>" "$(cat /tmp/note.md)"

# Update status only (keeps existing content)
__CHAOS_HOME__/scripts/update-note.sh "<id>" --status=building

# Update tags only
__CHAOS_HOME__/scripts/update-note.sh "<id>" --tags=tag1,tag2

# Update everything
__CHAOS_HOME__/scripts/update-note.sh "<id>" --status=done --tags=project,shipped "Final content here"

# Clear status (remove from frontmatter)
__CHAOS_HOME__/scripts/update-note.sh "<id>" --status=clear

# Clear tags
__CHAOS_HOME__/scripts/update-note.sh "<id>" --tags=
```

Options:
- `--status=building|done|clear` — Set or clear the status
- `--tags=tag1,tag2` — Set tags (comma-separated), or empty to clear
- Content argument is optional; omit to keep existing body

### Rename a Note

```bash
__CHAOS_HOME__/scripts/rename-note.sh "<id>" "New Title"
```

Updates the title in frontmatter and renames the file. The ID stays the same.

### Delete a Note

```bash
__CHAOS_HOME__/scripts/delete-note.sh "<id>"
```

### Add an Image to a Note

```bash
__CHAOS_HOME__/scripts/add-image-to-note.sh "<id>" "/path/to/image.jpg" "description of the image"
```

- Converts to webp (quality 95), auto-orients, strips EXIF, resizes to max 2048px
- Saves image + sibling metadata `.md` in `__CHAOS_HOME__/assets/`
- Appends markdown image link to the note
- Commits note + image + metadata together

### List Notes

```bash
ls -la __CHAOS_HOME__/notes/
```

### Search Notes

```bash
__CHAOS_HOME__/scripts/search-notes.sh "search term"
```

Returns JSON array of matching notes with id, title, status, tags, filename, and path.

Example output:
```json
[
  {"id": "abc123...", "title": "My Note", "status": "building", "tags": ["tag1"], "filename": "abc123-my-note.md", "path": "/chaos/note/abc123..."}
]
```

### Read a Note

```bash
cat __CHAOS_HOME__/notes/<id>-<slug>.md
```

## Status Values

- **(omitted)** — Seed/draft, default state for new ideas
- **building** — Actively working on or developing this note
- **done** — Finished, shipped, or complete

## Important Notes

1. **Always use the scripts** for create/rename/delete — they handle git commits
2. **IDs are permanent** — never change an ID, only the title/slug can change
3. **One note per idea** — notes evolve in place, no separate drafts
4. **Git-backed** — all changes are committed and pushed automatically
5. **Web UI exists** at `/chaos/` for human use (agents should use scripts)
6. **Permalinks** — path to a note: `/chaos/note/<id>`

## Web UI Access

The web server runs on port 24680 by default.

- **Local:** `http://localhost:24680/chaos/`
- **External:** `__EXTERNAL_URL__/chaos/`

Replace `__EXTERNAL_URL__` with your actual server address (e.g., `https://myserver.com:8000`) so permalinks work for the user.
