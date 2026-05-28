---
name: list
description: List all saved browser recordings. Use when user says "list recordings", "列出录制", "show recordings".
allowed-tools:
  - Bash
  - Read
---

# List Recordings

List all saved browser recording scripts.

## Steps

1. Run the list command:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts list
```

2. Present the results to the user in a clear format showing:
   - Recording name
   - URL
   - Number of steps
   - Creation date
   - Description (if any)

3. If no recordings exist, suggest using `/record` to create one.

4. If the user wants machine-readable output:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts list --json
```
