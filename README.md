# web-replay

Browser automation recording, playback and data collection plugin for Claude Code. Based on Playwright.

Record user interactions in a browser, replay them automatically, and capture network requests, console logs, and analytics/tracking events along the way.

## Features

- **Interactive Recording** — Open a browser, interact with it, and all clicks, inputs, and navigation are captured into a reproducible JSON script
- **Automatic Playback** — Replay recorded scripts in headed or headless mode with step-by-step screenshots
- **Full-chain Data Collection** — Capture network requests (XHR/Fetch), console messages, and analytics/tracking events
- **Replay Reports** — Detailed JSON reports with per-step status, duration, screenshots, and collected data
- **Bug Reproduction** — Record a bug reproduction flow once, replay it anytime to verify fixes
- **Analytics Validation** — Filter and capture analytics requests by domain to verify tracking events fire correctly

## Prerequisites

- Node.js 18+
- Claude Code CLI

Playwright browsers are installed automatically during `npm install` (postinstall).

## Installation

### As a Claude Code Plugin

Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "plugins": {
    "web-replay": {
      "source": "github:Luckybbbbb/web-replay",
      "enabled": true
    }
  }
}
```

### Local Development

```bash
git clone https://github.com/Luckybbbbb/web-replay.git
cd web-replay
npm install
npx playwright install chromium
```

## Usage

### CLI Commands

```bash
# Record a browser session (opens browser for interaction)
npx tsx src/index.ts record --url https://example.com --name my-test

# Record with analytics collection
npx tsx src/index.ts record --url https://example.com --name my-test --collect-analytics --analytics-domains "google-analytics.com"

# List all recordings
npx tsx src/index.ts list

# Replay a recording (headless by default)
npx tsx src/index.ts play my-test

# Replay with visible browser
npx tsx src/index.ts play my-test --headed
```

### Claude Code Slash Commands

Once installed as a plugin:

| Command | Description |
|---------|-------------|
| `/record` | Start an interactive browser recording session |
| `/play` | Replay a recorded browser script |
| `/list` | List all saved recordings |
| `/replay-bug` | Replay a bug recording and verify if it's fixed |

### Claude Code Skills

The plugin provides auto-activating skills:

- **record** — Activates when you mention "record", "录制", "capture browser", "记录操作"
- **play** — Activates when you mention "replay", "回放", "重放", "run test", "verify fix"
- **collect** — Activates when you mention "collect network", "采集网络", "捕获埋点", "monitor requests"

## Typical Workflow

1. **Discover a bug** — Use chrome-devtools-mcp to explore and find the issue
2. **Record reproduction** — `/record` the exact steps to reproduce
3. **Verify reproducibility** — `/play` the recording to confirm it fails consistently
4. **Fix the code** — Make your changes
5. **Regression test** — `/replay-bug` to verify the fix works

## Project Structure

```
web-replay/
├── .claude-plugin/plugin.json    # Plugin manifest
├── commands/                     # Claude Code slash commands
│   ├── record.md
│   ├── play.md
│   ├── list.md
│   └── replay-bug.md
├── skills/                       # Auto-activating skills
│   ├── record/SKILL.md
│   ├── play/SKILL.md
│   └── collect/SKILL.md
├── src/                          # TypeScript source
│   ├── index.ts                  # CLI entry point
│   ├── cli/                      # Command handlers
│   ├── core/                     # Core services
│   │   ├── recorder.ts           # Recording engine
│   │   ├── player.ts             # Playback engine
│   │   ├── collector.ts          # Network/console/analytics capture
│   │   ├── script-store.ts       # Recording file management
│   │   └── playwright-adapter.ts # Playwright wrapper
│   └── types/                    # Type definitions & Zod schemas
├── recordings/                   # Saved recording scripts (JSON)
└── reports/                      # Generated replay reports
```

## Recording Format

Recordings are stored as JSON files in `recordings/`:

```json
{
  "name": "my-test",
  "description": "Test login flow",
  "url": "https://example.com/login",
  "createdAt": "2026-05-28T10:30:00Z",
  "steps": [
    { "action": "navigate", "url": "https://example.com/login" },
    { "action": "fill", "selector": "#username", "value": "user@test.com" },
    { "action": "fill", "selector": "#password", "value": "secret" },
    { "action": "click", "selector": "#login-btn" },
    { "action": "waitForSelector", "selector": ".dashboard", "timeout": 5000 }
  ],
  "collectors": {
    "network": true,
    "console": true,
    "analytics": {
      "domains": ["google-analytics.com"],
      "events": []
    }
  }
}
```

## Replay Report

Reports are saved to `reports/<timestamp>/report.json` with step screenshots:

```json
{
  "scriptName": "my-test",
  "status": "passed",
  "duration": 3240,
  "steps": [
    { "index": 0, "action": "navigate", "status": "passed", "duration": 450, "screenshot": "step-000-before.png" }
  ],
  "collected": {
    "network": [{ "url": "...", "method": "POST", "status": 200 }],
    "console": [{ "type": "error", "text": "..." }],
    "analytics": [{ "url": "...", "params": { "t": "event", "ea": "click" } }]
  }
}
```

## Selector Strategy

Recordings use a priority-based selector strategy for stability:

1. `data-testid` attribute (most stable)
2. `name` attribute (form elements)
3. `id` attribute
4. CSS path (fallback)

## Integration with chrome-devtools-mcp

web-replay and chrome-devtools-mcp are complementary tools:

| Scenario | Tool |
|----------|------|
| Explore/debug a page | chrome-devtools-mcp |
| Record reproduction steps | web-replay |
| Automated playback & data collection | web-replay |
| Analytics/tracking validation | web-replay |

Both tools can share the same Chrome instance via CDP.

## License

MIT
