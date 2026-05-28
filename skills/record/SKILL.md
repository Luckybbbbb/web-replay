---
name: record
description: Record browser interactions. Use when the user wants to "record a browser flow", "capture user actions", "create a test script", "录制浏览器操作", "记录用户行为", or mentions recording/reproducing a bug by capturing browser interactions.
---

# Record Browser Interactions

## Purpose

Capture a user's browser interactions into a reproducible JSON script. The recording produces a structured sequence of page navigations, clicks, input events, and network/console activity that can later be replayed for bug verification or regression testing.

## When to Use

- User wants to record a browser flow for bug reproduction
- User wants to create a reusable test script from real user behavior
- User wants to capture analytics/tracking events during interaction
- User says "record", "录制", "capture", "记录", "reproduce the issue"

## Instructions

### 1. Gather Recording Parameters

Ask the user for the following information:

- **Target URL** (required): The starting page for the recording
- **Recording name** (required): A short identifier used for the output filename
- **Analytics tracking** (optional): Whether to collect analytics/tracking requests and which domains to watch

### 2. Run the Recording Command

Execute the recording with the gathered parameters:

```bash
npx tsx src/index.ts record --url <url> --name <name>
```

Additional options:
- `--description <desc>` - Add a description to the recording
- `--headed` - Show browser window (default: browser is visible for interactive recording)
- `--collect-analytics` - Enable network/console/analytics data collection
- `--analytics-domains <domain1,domain2>` - Comma-separated list of analytics domains to track

### 3. Guide the User Through Recording

Once the browser window opens, instruct the user:

1. Interact with the browser to reproduce the issue or perform the desired flow
2. All clicks, inputs, navigation events are captured automatically
3. When finished, press **Ctrl+C** in the terminal to stop the recording
4. The recording is saved to `recordings/<name>.json`

### 4. Present the Recording Summary

After the recording stops, read and display the generated file at `recordings/<name>.json`. Summarize:

- Total number of steps recorded
- Types of actions captured (click, type, navigate, etc.)
- URLs visited during the recording
- Any errors or warnings encountered during capture

### 5. Suggest Next Steps

Offer the user these follow-up actions:

- Replay the recording using the `play` skill
- Edit the recording JSON to adjust or remove steps
- Share the recording file with teammates for bug reproduction
