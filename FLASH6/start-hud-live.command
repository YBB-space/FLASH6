#!/bin/zsh
SCRIPT_DIR="${0:A:h}"
exec /usr/bin/env node "$SCRIPT_DIR/scripts/hud-live-relay.cjs"
