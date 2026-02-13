#!/bin/bash
# ensure-data-dir.sh
# Legacy script — env setup is now handled by lib/env.ts
# Kept for backward compatibility with tests and external scripts.

DATA_HOME="${CHAOS_DATA_DIR:-$HOME/.chaos}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_LINK="$SKILL_ROOT/data"

mkdir -p "$DATA_HOME/notes" "$DATA_HOME/assets"

if [ ! -e "$DATA_LINK" ]; then
  ln -s "$DATA_HOME" "$DATA_LINK" 2>/dev/null || true
fi

if [ -d "$DATA_HOME/.git" ]; then
  git -C "$DATA_HOME" pull --rebase --quiet 2>/dev/null || true
fi

export DATA_DIR="$DATA_HOME"
export NOTES_DIR="$DATA_HOME/notes"
export ASSETS_DIR="$DATA_HOME/assets"
