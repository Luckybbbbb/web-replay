---
name: play
description: Replay a recorded browser session. Use when user says "play", "replay", "回放", "重放", "run test".
argument-hint: "<name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Replay Recorded Session

You are triggering the chrome-debug-agent playback tool. This replays a previously recorded browser script and generates a detailed report with step results, network data, and screenshots.

## Steps

1. If the user hasn't specified a recording name, list available recordings:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts list
```

Present the list and ask which one to replay.

2. Run the playback:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts play "<name>" --headed
```

Use `--headed` so the user can observe the browser. Remove it for headless (faster, invisible).

3. Wait for playback to complete.

4. Find and read the latest report:

```bash
ls -t $CLAUDE_PLUGIN_ROOT/reports/ | head -1
```

Then read `report.json` in that directory.

5. Present a structured summary:

- **Overall**: Passed or failed, total steps, duration
- **Failed steps**: Error message and screenshot path for each
- **Network errors**: Any HTTP 4xx/5xx responses
- **Console errors**: JavaScript errors from the browser console
- **Analytics events**: Any tracking requests captured

6. For failures, suggest:
   - Root cause based on error messages
   - Whether the recording needs updating
   - Whether to retry with `--headed` for visual debugging
