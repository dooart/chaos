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
CHAOS_ROOT="$(dirname "$SCRIPT_DIR")"
NOTES_DIR="$CHAOS_ROOT/notes"

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

# Pull, add, commit, push
cd "$CHAOS_ROOT"
git pull --rebase 2>/dev/null || true
git add -A
git commit -m "deleted note $ID-$SLUG"
git push

echo "deleted $FILE"
