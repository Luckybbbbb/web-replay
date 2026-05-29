#!/bin/bash
# Check if web-replay dependencies are installed.
# Outputs a reminder if setup is needed.

PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-.}"

if [ ! -d "$PLUGIN_ROOT/node_modules" ]; then
  echo "web-replay: Dependencies not installed. Run /setup to install them."
  exit 0
fi

if ! node -e "require('playwright')" 2>/dev/null; then
  echo "web-replay: Playwright not installed. Run /setup to install it."
  exit 0
fi

exit 0
