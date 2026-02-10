#!/bin/bash
set -e

# new-note.sh <title>
# Creates a new note with the given title, commits it, and prints the path

if [ -z "$1" ]; then
  echo "Usage: new-note.sh <title>" >&2
  exit 1
fi

TITLE="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAOS_ROOT="$(dirname "$SCRIPT_DIR")"
NOTES_DIR="$CHAOS_ROOT/notes"

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

# Pull, add, commit, push
cd "$CHAOS_ROOT"
git pull --rebase 2>/dev/null || true
git add "$FILEPATH"
git commit -m "created note $ID-$SLUG"
git push

echo "$FILEPATH"
