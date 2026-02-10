#!/bin/bash
set -e

# new-note.sh <title>
# Creates a new note with the given title and prints the path
# If data dir has .git, commits and pushes

if [ -z "$1" ]; then
  echo "Usage: new-note.sh <title>" >&2
  exit 1
fi

TITLE="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$SKILL_ROOT/data"
NOTES_DIR="$DATA_DIR/notes"

if [ ! -d "$NOTES_DIR" ]; then
  echo "Error: data/notes directory not found. Run setup first." >&2
  exit 1
fi

# Generate nanoid (21 chars, lowercase alphanumeric)
ID=$(cat /dev/urandom | tr -dc 'a-z0-9' | fold -w 21 | head -n 1)

# Generate slug from title (lowercase, alphanumeric and hyphens only)
SLUG=$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')

FILENAME="${ID}-${SLUG}.md"
FILEPATH="$NOTES_DIR/$FILENAME"

# Create frontmatter-only note
cat > "$FILEPATH" << EOF
---
id: $ID
title: $TITLE
---
EOF

# Git operations (only if data dir has .git)
if [ -d "$DATA_DIR/.git" ]; then
  cd "$DATA_DIR"
  git pull --rebase 2>/dev/null || true
  git add "$FILEPATH"
  git commit -m "created note $ID-$SLUG"
  git push
fi

echo "$FILEPATH"
