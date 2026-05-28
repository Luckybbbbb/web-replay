---
name: collect
description: Collect network requests, console logs, and analytics events from a web page. Use when the user wants to "collect network data", "capture analytics", "monitor requests", "采集网络数据", "捕获埋点", "监听请求".
---

# Collect Web Page Data

## Purpose

Open a web page and collect all network requests, console messages, and analytics/tracking events during a specified duration or user interaction session.

## When to Use

- User wants to inspect network requests from a web page
- User wants to verify analytics/tracking events are firing correctly
- User wants to capture console errors from a specific page
- User says "collect", "采集", "capture network", "捕获埋点", "monitor"

## Instructions

### 1. Gather Parameters

Ask the user:

- **Target URL** (required): The page to monitor
- **Analytics domains** (optional): Domains to filter for analytics events (e.g., google-analytics.com, facebook.com)
- **Duration** (optional): How long to monitor (default: until user stops with Ctrl+C)

### 2. Create a Temporary Recording

Since the CLI doesn't have a standalone `collect` command yet, use the `record` command with analytics enabled:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts record --url "<url>" --name "collect-<timestamp>" --collect-analytics --analytics-domains "<domains>"
```

Or for a quick automated collection, create a recording JSON manually and play it:

```bash
cat > $CLAUDE_PLUGIN_ROOT/recordings/collect-temp.json << 'EOF'
{
  "name": "collect-temp",
  "description": "Temporary collection script",
  "url": "<url>",
  "createdAt": "<now>",
  "steps": [
    { "action": "navigate", "url": "<url>" },
    { "action": "waitForTimeout", "timeout": 5000 }
  ],
  "collectors": {
    "network": true,
    "console": true,
    "analytics": { "domains": [<domains>], "events": [] }
  }
}
EOF
```

Then play it:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts play collect-temp
```

### 3. Present Results

Read the report from `reports/` and present:

- **Network requests**: Total count, HTTP errors, response times
- **Console messages**: Errors, warnings (filter by severity)
- **Analytics events**: All tracking requests with parameters
- **Performance**: Page load timing from network data

### 4. Clean Up

Remove the temporary recording and report if no longer needed.
