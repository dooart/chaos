#!/bin/bash

# search-notes.sh <query>
# Searches notes by title, tags, and content
# Returns JSON array of matching notes

if [ -z "$1" ]; then
  echo "Usage: search-notes.sh <query>" >&2
  exit 1
fi

QUERY="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CHAOS_ROOT="$(dirname "$SCRIPT_DIR")"
NOTES_DIR="$CHAOS_ROOT/notes"
export PATH="$HOME/.bun/bin:$PATH"

# Find matching files
MATCHES=$(grep -ril "$QUERY" "$NOTES_DIR"/*.md 2>/dev/null | sort -u)

if [ -z "$MATCHES" ]; then
  echo "[]"
  exit 0
fi

# Build JSON output
echo "["
FIRST=true
for FILE in $MATCHES; do
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    echo ","
  fi
  
  FILENAME=$(basename "$FILE")
  
  # Parse frontmatter using gray-matter
  FM_JSON=$(bun "$SCRIPT_DIR/parse-frontmatter.ts" "$FILE" --json)
  ID=$(echo "$FM_JSON" | jq -r '.id // empty')
  TITLE=$(echo "$FM_JSON" | jq -r '.title // empty')
  STATUS=$(echo "$FM_JSON" | jq -r '.status // empty')
  TAGS=$(echo "$FM_JSON" | jq '.tags // []')
  
  printf '  {"id": "%s", "title": %s, "status": %s, "tags": %s, "filename": "%s", "path": "/chaos/note/%s"}' \
    "$ID" \
    "$(echo "$TITLE" | jq -Rs '.')" \
    "$([ -n "$STATUS" ] && echo "\"$STATUS\"" || echo "null")" \
    "$TAGS" \
    "$FILENAME" \
    "$ID"
done
echo ""
echo "]"
