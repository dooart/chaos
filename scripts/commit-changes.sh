#!/bin/bash
set -e

# commit-changes.sh <file>
# Validates frontmatter and commits changes to a note

if [ -z "$1" ]; then
  echo "Usage: commit-changes.sh <file>" >&2
  exit 1
fi

FILE="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAOS_ROOT="$(dirname "$SCRIPT_DIR")"
export PATH="$HOME/.bun/bin:$PATH"

if [ ! -f "$FILE" ]; then
  echo "Error: file '$FILE' not found" >&2
  exit 1
fi

# Parse frontmatter using gray-matter
FM_JSON=$(bun "$SCRIPT_DIR/parse-frontmatter.ts" "$FILE" --json 2>&1) || {
  echo "Error: failed to parse frontmatter" >&2
  echo "$FM_JSON" >&2
  exit 1
}

ID=$(echo "$FM_JSON" | jq -r '.id // empty')
TITLE=$(echo "$FM_JSON" | jq -r '.title // empty')
STATUS=$(echo "$FM_JSON" | jq -r '.status // empty')
TAGS=$(echo "$FM_JSON" | jq -r '.tags // []')

# Check required fields
if [ -z "$ID" ]; then
  echo "Error: missing required field 'id'" >&2
  exit 1
fi

if [ -z "$TITLE" ]; then
  echo "Error: missing required field 'title'" >&2
  exit 1
fi

# Validate ID format (21 chars, lowercase alphanumeric)
if ! echo "$ID" | grep -qE '^[a-z0-9]{21}$'; then
  echo "Error: invalid id format (must be 21 lowercase alphanumeric chars)" >&2
  exit 1
fi

# Validate status if present
if [ -n "$STATUS" ] && [ "$STATUS" != "building" ] && [ "$STATUS" != "done" ]; then
  echo "Error: invalid status '$STATUS' (must be 'building', 'done', or omitted)" >&2
  exit 1
fi

# Validate tags if present
if [ "$TAGS" != "[]" ]; then
  TAG_LIST=$(echo "$FM_JSON" | jq -r '.tags[]? // empty')
  for TAG in $TAG_LIST; do
    if ! echo "$TAG" | grep -qE '^[a-z0-9-]{1,20}$'; then
      echo "Error: invalid tag '$TAG' (must be lowercase alphanumeric with hyphens, max 20 chars)" >&2
      exit 1
    fi
  done
fi

# Validate filename matches ID
FILENAME=$(basename "$FILE")
if ! echo "$FILENAME" | grep -qE "^${ID}-.*\.md$"; then
  echo "Error: filename must start with id '${ID}-'" >&2
  exit 1
fi

# Extract slug for commit message
SLUG=$(echo "$FILENAME" | sed "s/^${ID}-//" | sed 's/\.md$//')

# Pull, add, commit, push
cd "$CHAOS_ROOT"
git pull --rebase 2>/dev/null || true
git add "$FILE"
git commit -m "updated note $ID-$SLUG"
git push

echo "committed $FILE"
