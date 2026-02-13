#!/bin/bash
set -e

# update-note.sh <id> [options] <content>
# Updates a note's content and optionally status/tags
#
# Options:
#   --status=building|done|clear   Set status (clear removes it)
#   --tags=tag1,tag2               Set tags (comma-separated, or empty to clear)
#
# Examples:
#   update-note.sh abc123 "New content"
#   update-note.sh abc123 --status=building "New content"
#   update-note.sh abc123 --status=done --tags=project,idea "New content"
#   update-note.sh abc123 --status=clear "Content"  # removes status field

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.bun/bin:$PATH"

# Ensure data directory exists
source "$SCRIPT_DIR/ensure-data-dir.sh"

# Parse arguments
ID=""
CONTENT=""
NEW_STATUS=""
NEW_TAGS=""
STATUS_SET=false
TAGS_SET=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --status=*)
      NEW_STATUS="${1#*=}"
      STATUS_SET=true
      shift
      ;;
    --tags=*)
      NEW_TAGS="${1#*=}"
      TAGS_SET=true
      shift
      ;;
    *)
      if [ -z "$ID" ]; then
        ID="$1"
      else
        CONTENT="$1"
      fi
      shift
      ;;
  esac
done

if [ -z "$ID" ]; then
  echo "Usage: update-note.sh <id> [--status=building|done|clear] [--tags=tag1,tag2] <content>" >&2
  exit 1
fi

# Find existing file by ID
FILE=$(find "$NOTES_DIR" -name "${ID}-*.md" -type f | head -n 1)

if [ -z "$FILE" ]; then
  echo "Error: note with id '$ID' not found" >&2
  exit 1
fi

# Parse frontmatter using gray-matter
FM_JSON=$(bun "$SCRIPT_DIR/parse-frontmatter.ts" "$FILE" --json)
CURRENT_ID=$(echo "$FM_JSON" | jq -r '.id // empty')
CURRENT_TITLE=$(echo "$FM_JSON" | jq -r '.title // empty')
CURRENT_STATUS=$(echo "$FM_JSON" | jq -r '.status // empty')
CURRENT_TAGS=$(echo "$FM_JSON" | jq -r 'if .tags then "[" + (.tags | join(", ")) + "]" else "" end')
CURRENT_PROJECT=$(echo "$FM_JSON" | jq -r '.project // empty')
CURRENT_BODY=$(echo "$FM_JSON" | jq -r '.body // empty')

# Determine final values
FINAL_STATUS="$CURRENT_STATUS"
if [ "$STATUS_SET" = true ]; then
  if [ "$NEW_STATUS" = "clear" ] || [ -z "$NEW_STATUS" ]; then
    FINAL_STATUS=""
  else
    FINAL_STATUS="$NEW_STATUS"
  fi
fi

FINAL_TAGS="$CURRENT_TAGS"
if [ "$TAGS_SET" = true ]; then
  if [ -z "$NEW_TAGS" ]; then
    FINAL_TAGS=""
  else
    # Convert comma-separated to YAML array format
    FINAL_TAGS="[$(echo "$NEW_TAGS" | sed 's/,/, /g')]"
  fi
fi

FINAL_BODY="$CURRENT_BODY"
if [ -n "$CONTENT" ]; then
  FINAL_BODY="$CONTENT"
fi

# Validate status if set
if [ -n "$FINAL_STATUS" ] && [ "$FINAL_STATUS" != "building" ] && [ "$FINAL_STATUS" != "done" ]; then
  echo "Error: invalid status '$FINAL_STATUS' (must be 'building', 'done', or 'clear')" >&2
  exit 1
fi

# Build new file content
{
  echo "---"
  echo "id: $CURRENT_ID"
  echo "title: $CURRENT_TITLE"
  [ -n "$FINAL_STATUS" ] && echo "status: $FINAL_STATUS"
  [ -n "$FINAL_TAGS" ] && echo "tags: $FINAL_TAGS"
  [ -n "$CURRENT_PROJECT" ] && echo "project: $CURRENT_PROJECT"
  echo "---"
  [ -n "$FINAL_BODY" ] && echo "" && echo "$FINAL_BODY"
} > "$FILE"

# Use commit-changes.sh to validate and commit
"$SCRIPT_DIR/commit-changes.sh" "$FILE"
