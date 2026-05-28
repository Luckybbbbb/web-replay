import { promises as fs } from 'fs';
import { mkdirSync } from 'fs';
import path from 'path';
import type { Page } from 'playwright';

import { launchBrowser, closeBrowser } from './playwright-adapter.js';
import { Collector } from './collector.js';
import { getRecording } from './script-store.js';
import type {
  RecordingStep,
  RecordingScript,
  StepResult,
  ReplayReport,
  CollectedData,
} from '../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a timestamped report directory under `baseDir/reports/`.
 * Returns the absolute path to the created directory.
 */
export function ensureReportDir(baseDir: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(baseDir, 'reports', timestamp);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Save a ReplayReport as a JSON file in the given directory.
 * Returns the path to the written file.
 */
export async function saveReport(
  report: ReplayReport,
  dir: string,
): Promise<string> {
  const filePath = path.join(dir, 'report.json');
  const json = JSON.stringify(report, null, 2);
  await fs.writeFile(filePath, json, 'utf-8');
  return filePath;
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

/**
 * Execute a single recording step on the Playwright page.
 * Throws on failure so the caller can record the error.
 */
async function executeStep(page: Page, step: RecordingStep): Promise<void> {
  const timeout = step.timeout ?? 30_000;

  switch (step.action) {
    case 'navigate':
      if (!step.url) throw new Error('navigate step missing url');
      await page.goto(step.url, { timeout, waitUntil: 'domcontentloaded' });
      break;

    case 'click':
      if (!step.selector) throw new Error('click step missing selector');
      await page.click(step.selector, { timeout });
      break;

    case 'fill':
      if (!step.selector) throw new Error('fill step missing selector');
      if (step.value === undefined) throw new Error('fill step missing value');
      await page.fill(step.selector, step.value, { timeout });
      break;

    case 'type':
      if (!step.selector) throw new Error('type step missing selector');
      if (step.value === undefined) throw new Error('type step missing value');
      await page.type(step.selector, step.value, { timeout });
      break;

    case 'pressKey':
      if (!step.key) throw new Error('pressKey step missing key');
      await page.keyboard.press(step.key);
      break;

    case 'waitForSelector':
      if (!step.selector)
        throw new Error('waitForSelector step missing selector');
      await page.waitForSelector(step.selector, { timeout });
      break;

    case 'waitForTimeout':
      if (!step.timeout)
        throw new Error('waitForTimeout step missing timeout');
      await page.waitForTimeout(step.timeout);
      break;

    case 'hover':
      if (!step.selector) throw new Error('hover step missing selector');
      await page.hover(step.selector, { timeout });
      break;

    case 'select':
      if (!step.selector) throw new Error('select step missing selector');
      if (step.value === undefined) throw new Error('select step missing value');
      await page.selectOption(step.selector, step.value, { timeout });
      break;

    default:
      throw new Error(`unknown action: ${(step as { action: string }).action}`);
  }
}

// ---------------------------------------------------------------------------
// Main play function
// ---------------------------------------------------------------------------

/**
 * Replay a recorded script and generate a detailed report.
 *
 * @param options - Playback options
 * @param options.name     - Name of the recording to replay
 * @param options.headless - Run browser in headless mode (default true)
 * @param options.baseDir  - Base directory for recordings lookup (default cwd)
 * @param options.reportDir - Override the report output directory
 * @returns A {@link ReplayReport} with step results and collected data
 */
export async function play(options: {
  name: string;
  headless?: boolean;
  baseDir?: string;
  reportDir?: string;
}): Promise<ReplayReport> {
  const baseDir = options.baseDir ?? process.cwd();
  const reportDir = options.reportDir ?? ensureReportDir(baseDir);

  // 1. Load the recording script
  const script: RecordingScript | null = await getRecording(baseDir, options.name);

  // 2. Throw if not found
  if (!script) {
    throw new Error(`Recording not found: "${options.name}"`);
  }

  const startTime = Date.now();
  const stepResults: StepResult[] = [];
  let overallStatus: ReplayReport['status'] = 'passed';

  // 3. Launch browser
  const { browser, page } = await launchBrowser({
    headless: options.headless ?? true,
  });

  try {
    // 4. Create and attach Collector
    const collector = new Collector(script.collectors);
    collector.attach(page);

    // 5. Execute each step
    for (let i = 0; i < script.steps.length; i++) {
      const step = script.steps[i]!;
      const stepStart = Date.now();

      try {
        // a. Screenshot before action
        const screenshotName = `step-${String(i).padStart(3, '0')}-before.png`;
        const screenshotPath = path.join(reportDir, screenshotName);
        try {
          const buffer = await page.screenshot({ type: 'png' });
          await fs.writeFile(screenshotPath, buffer);
        } catch {
          // Screenshot may fail on about:blank or restricted pages
        }

        // b. Execute the action
        await executeStep(page, step);

        // c. Record success
        const duration = Date.now() - stepStart;
        stepResults.push({
          index: i,
          action: step.action,
          status: 'passed',
          duration,
          screenshot: screenshotName,
        });
      } catch (err: unknown) {
        // d. Record failure
        const duration = Date.now() - stepStart;
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        const screenshotName = `step-${String(i).padStart(3, '0')}-error.png`;

        // Try to capture an error screenshot
        try {
          const buffer = await page.screenshot({ type: 'png' });
          const errorScreenshotPath = path.join(reportDir, screenshotName);
          await fs.writeFile(errorScreenshotPath, buffer);
        } catch {
          // Best-effort screenshot
        }

        stepResults.push({
          index: i,
          action: step.action,
          status: 'failed',
          duration,
          error: errorMessage,
          screenshot: screenshotName,
        });

        overallStatus = 'failed';

        // Stop playback on first failure
        break;
      }
    }

    // 6. Collect all data from Collector
    const collected: CollectedData = collector.getData();
    collector.detach();

    // 7. Build ReplayReport
    const totalDuration = Date.now() - startTime;

    const report: ReplayReport = {
      scriptName: script.name,
      status: overallStatus,
      duration: totalDuration,
      timestamp: new Date().toISOString(),
      steps: stepResults,
      collected,
    };

    // 8. Save report
    await saveReport(report, reportDir);

    // 10. Return the report
    return report;
  } finally {
    // 9. Close browser (always, even on error)
    await closeBrowser(browser);
  }
}
