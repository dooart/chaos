#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export PATH="$HOME/.bun/bin:$PATH"
exec bun "$SCRIPT_DIR/chaos.ts" add-image "$@"
