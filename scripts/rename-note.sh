#!/bin/bash
set -e

# rename-note.sh <id> <new-title>
# Renames a note: updates frontmatter title and filename

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: rename-note.sh <id> <new-title>" >&2
  exit 1
fi

ID="$1"
NEW_TITLE="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAOS_ROOT="$(dirname "$SCRIPT_DIR")"
NOTES_DIR="$CHAOS_ROOT/notes"
export PATH="$HOME/.bun/bin:$PATH"

# Find existing file by ID
OLD_FILE=$(find "$NOTES_DIR" -name "${ID}-*.md" -type f | head -n 1)

if [ -z "$OLD_FILE" ]; then
  echo "Error: note with id '$ID' not found" >&2
  exit 1
fi

# Parse current frontmatter
FM_JSON=$(bun "$SCRIPT_DIR/parse-frontmatter.ts" "$OLD_FILE" --json)
CURRENT_ID=$(echo "$FM_JSON" | jq -r '.id // empty')
CURRENT_STATUS=$(echo "$FM_JSON" | jq -r '.status // empty')
CURRENT_TAGS=$(echo "$FM_JSON" | jq -r 'if .tags then "[" + (.tags | join(", ")) + "]" else "" end')
CURRENT_BODY=$(echo "$FM_JSON" | jq -r '.body // empty')

# Generate new slug from title
NEW_SLUG=$(echo "$NEW_TITLE" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//')
NEW_FILENAME="${ID}-${NEW_SLUG}.md"
NEW_FILEPATH="$NOTES_DIR/$NEW_FILENAME"

# Rebuild file with new title
{
  echo "---"
  echo "id: $CURRENT_ID"
  echo "title: $NEW_TITLE"
  [ -n "$CURRENT_STATUS" ] && echo "status: $CURRENT_STATUS"
  [ -n "$CURRENT_TAGS" ] && echo "tags: $CURRENT_TAGS"
  echo "---"
  [ -n "$CURRENT_BODY" ] && echo "" && echo "$CURRENT_BODY"
} > "$OLD_FILE"

# Rename file if slug changed
if [ "$OLD_FILE" != "$NEW_FILEPATH" ]; then
  mv "$OLD_FILE" "$NEW_FILEPATH"
fi

# Pull, add, commit, push
cd "$CHAOS_ROOT"
git pull --rebase 2>/dev/null || true
git add -A
git commit -m "renamed note $ID to $NEW_SLUG"
git push

echo "$NEW_FILEPATH"
