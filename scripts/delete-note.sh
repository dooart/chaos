#!/bin/bash
set -e

# delete-note.sh <id>
# Deletes a note by ID

if [ -z "$1" ]; then
  echo "Usage: delete-note.sh <id>" >&2
  exit 1
fi

ID="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$SKILL_ROOT/data"
NOTES_DIR="$DATA_DIR/notes"

if [ ! -d "$NOTES_DIR" ]; then
  echo "Error: data/notes directory not found. Run setup first." >&2
  exit 1
fi

# Find existing file by ID
FILE=$(find "$NOTES_DIR" -name "${ID}-*.md" -type f | head -n 1)

if [ -z "$FILE" ]; then
  echo "Error: note with id '$ID' not found" >&2
  exit 1
fi

# Extract slug for commit message
FILENAME=$(basename "$FILE")
SLUG=$(echo "$FILENAME" | sed "s/^${ID}-//" | sed 's/\.md$//')

# Remove the file
rm "$FILE"

# Git operations (only if data dir has .git)
if [ -d "$DATA_DIR/.git" ]; then
  cd "$DATA_DIR"
  git pull --rebase 2>/dev/null || true
  git add -A
  git commit -m "deleted note $ID-$SLUG"
  git push
fi

echo "deleted $FILE"
