---
name: setup
description: Install web-replay dependencies (Playwright Chromium). Use when the plugin is first installed or when encountering "playwright not found" errors.
allowed-tools:
  - Bash
---

# Setup Web Replay

Install required dependencies for the web-replay plugin. This only needs to be run once after installing the plugin.

## Steps

1. Run the setup command:

```bash
cd $CLAUDE_PLUGIN_ROOT && npm install && npx playwright install chromium
```

2. Verify the installation succeeded:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx playwright --version
```

3. Tell the user:
   - "Web Replay setup complete. You can now use /record, /play, /list, and /replay-bug commands."
   - If installation failed, suggest checking Node.js version (18+ required) and network connectivity.
