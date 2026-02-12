#!/bin/bash
# ensure-data-dir.sh
# Ensures ~/.chaos/notes and ~/.chaos/assets exist, and data symlink is set up.
# Source this from other scripts: source "$(dirname "$0")/ensure-data-dir.sh"

DATA_HOME="${CHAOS_DATA_DIR:-$HOME/.chaos}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_LINK="$SKILL_ROOT/data"

# Create data directories if they don't exist
mkdir -p "$DATA_HOME/notes" "$DATA_HOME/assets"

# Create symlink if it doesn't exist
if [ ! -e "$DATA_LINK" ]; then
  ln -s "$DATA_HOME" "$DATA_LINK"
fi

# Pull latest if data dir is a git repo
if [ -d "$DATA_HOME/.git" ]; then
  git -C "$DATA_HOME" pull --rebase --quiet 2>/dev/null || true
fi

# Export paths for use by calling script
export DATA_DIR="$DATA_HOME"
export NOTES_DIR="$DATA_HOME/notes"
export ASSETS_DIR="$DATA_HOME/assets"
