---
name: replay-bug
description: Replay a recorded bug and verify if it is fixed. Use when user says "verify fix", "验证修复", "replay bug", "regression test".
argument-hint: "<name>"
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Replay Bug & Verify Fix

End-to-end workflow: replay a recorded bug script, analyze the report, and determine if the bug is fixed.

## Steps

1. If the user hasn't specified a recording name, list available recordings:

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts list
```

Ask which recording corresponds to the bug being verified.

2. Run playback in headless mode (no browser window needed for verification):

```bash
cd $CLAUDE_PLUGIN_ROOT && npx tsx src/index.ts play "<name>"
```

3. Wait for playback to complete. Check the exit code:
   - Exit code 0 = all steps passed (bug likely fixed)
   - Exit code 1 = some steps failed (bug may still exist)

4. Read the latest report:

```bash
ls -t $CLAUDE_PLUGIN_ROOT/reports/ | head -1
```

Read the `report.json` in that directory.

5. Analyze and present verdict:

**If status is "passed":**
- All steps completed successfully
- The bug appears to be fixed
- Note: this confirms the recorded flow works, but may not cover all edge cases

**If status is "failed":**
- List each failed step with error details
- Compare errors to the original bug description
- The bug may still be present, or the page structure may have changed
- Suggest: re-record the flow if the page has changed significantly

6. Highlight any noteworthy data from the report:
   - Network errors (5xx responses, timeouts)
   - Console errors (JavaScript exceptions)
   - Missing analytics events (if the recording tracked them)

7. Recommend next steps based on the verdict.
