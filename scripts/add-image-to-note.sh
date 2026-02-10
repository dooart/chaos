#!/bin/bash
set -euo pipefail

# add-image-to-note.sh <note-id> <image-path> <description>
# Converts image to webp, strips exif, writes metadata, appends markdown to note, commits all.

if [ $# -lt 3 ]; then
  echo "Usage: add-image-to-note.sh <note-id> <image-path> <description>" >&2
  exit 1
fi

ID="$1"
SRC="$2"
DESC="$3"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Ensure data directory exists
source "$SCRIPT_DIR/ensure-data-dir.sh"

if [ ! -f "$SRC" ]; then
  echo "Error: image not found: $SRC" >&2
  exit 1
fi

NOTE_FILE=$(find "$NOTES_DIR" -name "${ID}-*.md" -type f | head -n 1)
if [ -z "$NOTE_FILE" ]; then
  echo "Error: note with id '$ID' not found" >&2
  exit 1
fi

mkdir -p "$ASSETS_DIR"

# Generate asset name
STAMP=$(date +%s)
BASE="${ID}-${STAMP}"
OUT_WEBP="$ASSETS_DIR/${BASE}.webp"
OUT_META="$ASSETS_DIR/${BASE}.md"

# Convert + normalize (auto-orient, strip exif, resize)
# mogrify outputs to ASSETS_DIR with .webp extension
mogrify -auto-orient -strip -resize 2048x2048\> -quality 95 -format webp -path "$ASSETS_DIR" "$SRC"

# mogrify keeps basename; move/rename to stable base
TMP_WEBP="$ASSETS_DIR/$(basename "${SRC%.*}").webp"
if [ ! -f "$TMP_WEBP" ]; then
  echo "Error: conversion failed" >&2
  exit 1
fi
mv "$TMP_WEBP" "$OUT_WEBP"

# Write metadata description
cat > "$OUT_META" <<EOF
---
image: ${BASE}.webp
description: |
  ${DESC}
---
EOF

# Append markdown to note
echo -e "\n![${DESC}](/chaos/assets/${BASE}.webp)" >> "$NOTE_FILE"

# Validate frontmatter like commit-changes.sh (minimal)
FRONTMATTER=$(sed -n '/^---$/,/^---$/p' "$NOTE_FILE")
ID_FM=$(echo "$FRONTMATTER" | grep '^id:' | sed 's/^id:[[:space:]]*//')
TITLE_FM=$(echo "$FRONTMATTER" | grep '^title:' | sed 's/^title:[[:space:]]*//')
if [ -z "$ID_FM" ] || [ -z "$TITLE_FM" ]; then
  echo "Error: missing required frontmatter" >&2
  exit 1
fi

# Git operations (only if data dir has .git)
if [ -d "$DATA_DIR/.git" ]; then
  cd "$DATA_DIR"
  git pull --rebase 2>/dev/null || true
  git add "$NOTE_FILE" "$OUT_WEBP" "$OUT_META"
  SLUG=$(basename "$NOTE_FILE" | sed "s/^${ID}-//" | sed 's/\.md$//')
  git commit -m "updated note ${ID}-${SLUG} with image"
  git push
fi

echo "added image ${BASE}.webp to $NOTE_FILE"
