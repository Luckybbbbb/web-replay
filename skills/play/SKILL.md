---
name: play
description: Replay a recorded browser script. Use when the user wants to "replay a recording", "run a recorded test", "verify a bug fix", "play back", "回放", "重放", "run test", or mentions executing a previously recorded browser flow.
---

# Replay Recorded Script

## Purpose

Replay a previously recorded browser interaction script to verify bug fixes, run regression tests, or demonstrate captured behavior. Produces a detailed report including step results, network errors, console errors, and collected analytics events.

## When to Use

- User wants to replay a recorded script
- User wants to verify a bug is fixed by re-running the original flow
- User wants to run a regression test against a web application
- User says "play", "replay", "回放", "重放", "run test", "verify fix"

## Instructions

### 1. Identify the Recording

If the user specifies a recording name, proceed directly. Otherwise, list available recordings:

```bash
npx tsx src/index.ts list
```

Present the list to the user and ask which recording to replay.

### 2. Run the Playback Command

Execute the replay with the appropriate options:

```bash
npx tsx src/index.ts play <name> --headed
```

Options:
- `--headed` - Show the browser window during replay (recommended for debugging)
- Omit `--headed` for headless mode (faster, no visible browser)
- `--report-dir <dir>` - Override the report output directory

### 3. Wait for Completion

The replay runs through each recorded step sequentially. Wait for the process to complete. If it exits with an error, capture the error output for the report.

### 4. Read and Present the Replay Report

After playback completes, find the latest report in the `reports/` directory. Reports are saved as `reports/<timestamp>/report.json` with step screenshots in the same directory.

Present a structured summary covering:

- **Overall result**: Pass or fail, total steps vs. failed steps
- **Failed steps**: List each failed step with the error reason and screenshot path
- **Network errors**: Any HTTP errors (4xx, 5xx) or failed requests observed during replay
- **Console errors**: JavaScript errors logged to the browser console during replay
- **Analytics events**: Tracking/analytics requests collected during the session (if applicable)

### 5. Highlight Actionable Items

For any failures or errors found, provide:

- The specific step that failed and what was expected vs. what happened
- Suggested root causes based on the error messages
- Recommendations for fixing the issue or updating the recording
