import type { Page, ElementHandle } from 'playwright';
import type { RecordingScript, RecordingStep } from '../types/index.js';
import { launchBrowser, closeBrowser, startRecording } from './playwright-adapter.js';
import { Collector } from './collector.js';
import { saveRecording } from './script-store.js';

// ---------------------------------------------------------------------------
// Selector generation helper
// ---------------------------------------------------------------------------

/**
 * Build a stable CSS selector for a DOM element by inspecting its attributes.
 * Priority: data-testid > aria-label > id > nth-child CSS selector path.
 *
 * This is evaluated inside the browser page context.
 */
async function generateSelector(
  page: Page,
  element: ElementHandle<Element>,
): Promise<string> {
  const selector = await page.evaluate((el: Element) => {
    // 1. data-testid (highest priority)
    const testId = el.getAttribute('data-testid');
    if (testId) return `[data-testid="${testId}"]`;

    // 2. aria-label
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return `[aria-label="${CSS.escape(ariaLabel)}"]`;

    // 3. id
    const id = el.getAttribute('id');
    if (id) return `#${CSS.escape(id)}`;

    // 4. Build an nth-child CSS selector path (up to 5 levels)
    const segments: string[] = [];
    let current: Element | null = el;
    let depth = 0;

    while (current && current !== document.body && depth < 5) {
      const tag = current.tagName.toLowerCase();
      const parent: Element | null = current.parentElement;

      if (!parent) {
        segments.unshift(tag);
        break;
      }

      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(
        (c) => c.tagName === current!.tagName,
      );

      if (sameTagSiblings.length > 1) {
        const index = sameTagSiblings.indexOf(current) + 1;
        segments.unshift(`${tag}:nth-child(${index})`);
      } else {
        segments.unshift(tag);
      }

      current = parent;
      depth++;
    }

    return segments.join(' > ');
  }, element);

  return selector ?? 'body';
}

// ---------------------------------------------------------------------------
// Ctrl+C / SIGINT waiter
// ---------------------------------------------------------------------------

/**
 * Returns a Promise that resolves when the user presses Ctrl+C (SIGINT).
 * Works on Windows (via stdin raw mode) and Unix (via process signal).
 */
function waitForInterrupt(): Promise<void> {
  return new Promise<void>((resolve) => {
    let resolved = false;

    const done = () => {
      if (resolved) return;
      resolved = true;
      resolve();
    };

    // Unix SIGINT
    const handler = () => done();
    process.on('SIGINT', handler);

    // Windows / interactive stdin fallback: detect Ctrl+C in raw mode
    if (process.stdin && process.stdin.isTTY) {
      const wasRaw = process.stdin.isRaw;
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.ref();

      const onData = (data: Buffer) => {
        // Ctrl+C is byte 0x03
        if (data.length === 1 && data[0] === 0x03) {
          cleanup();
          done();
        }
      };

      const cleanup = () => {
        process.stdin.removeListener('data', onData);
        if (!wasRaw) {
          process.stdin.setRawMode(false);
        }
        process.stdin.unref();
      };

      process.stdin.on('data', onData);

      // Also clean up on resolve from SIGINT
      process.once('SIGINT', () => {
        cleanup();
        process.removeListener('SIGINT', handler);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Main record function
// ---------------------------------------------------------------------------

/**
 * Launch a headed browser, navigate to the given URL, record user interactions,
 * and save the resulting script.
 *
 * Recording is always headed so the user can interact with the page.
 * Press Ctrl+C in the terminal to stop recording.
 */
export async function record(options: {
  url: string;
  name: string;
  description?: string;
  headless?: boolean;
  collectAnalytics?: boolean;
  analyticsDomains?: string[];
  baseDir?: string;
}): Promise<RecordingScript> {
  const baseDir = options.baseDir ?? process.cwd();

  // 1. Launch browser (headed for interactive recording, unless explicitly headless)
  const { browser, context, page } = await launchBrowser({ headless: options.headless ?? false });

  // Track whether we already cleaned up to avoid double-cleanup
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    try {
      await closeBrowser(browser);
    } catch {
      // Browser may already be closed — ignore
    }
  };

  try {
    // 2. Navigate to target URL
    await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 3. Create and attach Collector if analytics is enabled
    let collector: Collector | undefined;

    if (options.collectAnalytics) {
      collector = new Collector({
        network: true,
        console: true,
        analytics: {
          domains: options.analyticsDomains ?? [],
          events: [],
        },
      });
      collector.attach(page);
    }

    // 4. Start recording
    const recording = await startRecording(context, page);

    // 5. Notify the user
    console.log('');
    console.log('=== Recording started ===');
    console.log(`  URL:  ${options.url}`);
    console.log(`  Name: ${options.name}`);
    console.log('');
    console.log('Interact with the browser. Press Ctrl+C to stop recording.');
    console.log('');

    // 6. Wait for Ctrl+C
    await waitForInterrupt();

    console.log('');
    console.log('Stopping recording...');

    // 7. Stop recording and collect steps
    let steps: RecordingStep[];
    try {
      steps = await recording.stop();
    } catch {
      // If stop fails (e.g. page already closed), use whatever we captured
      steps = [];
    }

    // 8. Build RecordingScript
    const script: RecordingScript = {
      name: options.name,
      description: options.description ?? '',
      url: options.url,
      createdAt: new Date().toISOString(),
      steps,
      collectors: {
        network: options.collectAnalytics ?? false,
        console: options.collectAnalytics ?? false,
        analytics: {
          domains: options.analyticsDomains ?? [],
          events: [],
        },
      },
    };

    // 9. Save recording
    try {
      await saveRecording(baseDir, script);
      console.log(`Recording saved: ${options.name} (${steps.length} steps)`);
    } catch (err) {
      console.error('Failed to save recording:', err);
    }

    // 10. Close browser
    await cleanup();

    // 11. Return the script
    return script;
  } catch (err) {
    // On any error, attempt cleanup and re-throw
    console.error('Recording error:', err);

    // Attempt to save partial data if possible
    try {
      const partialScript: RecordingScript = {
        name: options.name,
        description: (options.description ?? '') + ' [interrupted]',
        url: options.url,
        createdAt: new Date().toISOString(),
        steps: [],
        collectors: {
          network: false,
          console: false,
          analytics: { domains: [], events: [] },
        },
      };
      await saveRecording(baseDir, partialScript);
    } catch {
      // Best-effort save of partial data
    }

    await cleanup();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Re-export generateSelector for use in other modules (e.g. replay)
// ---------------------------------------------------------------------------

export { generateSelector };
