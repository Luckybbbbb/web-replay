---
name: record
description: Record a browser session. Use when user says "record", "录制", "capture browser", "记录操作".
argument-hint: "--url <url> --name <name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Record Browser Session

You are triggering the web-replay recording tool. This opens a browser window for the user to interact with, capturing all clicks, inputs, and navigation into a reproducible JSON script.

## Steps

1. If the user hasn't provided a URL and name, ask for them:
   - **URL** (required): The starting page to record
   - **Name** (required): A short identifier for the recording (alphanumeric, hyphens, underscores only)

2. Ask optional preferences:
   - Should analytics/tracking data be collected? If yes, which domains? (e.g., google-analytics.com)

3. Build and run the command:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts record --url "<url>" --name "<name>" --headed --collect-analytics --analytics-domains "<domains>"
```

Remove `--collect-analytics` and `--analytics-domains` if the user doesn't need analytics tracking.

4. Tell the user:
   - "A browser window has opened. Please reproduce your issue or perform the flow you want to record."
   - "When finished, press Ctrl+C in this terminal to stop recording."

5. Wait for the recording process to exit (user presses Ctrl+C).

6. After recording stops, read the saved script:

```bash
cat $CLAUDE_PLUGIN_ROOT/recordings/<name>.json
```

7. Summarize for the user:
   - Number of steps recorded
   - Types of actions (navigate, click, fill, etc.)
   - URLs visited
   - Suggest next steps (replay with /play, edit the JSON, etc.)
