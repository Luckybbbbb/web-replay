import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { RecordingStep } from '../types/index.js';

// ---------------------------------------------------------------------------
// Recording state held while a recording session is active
// ---------------------------------------------------------------------------

interface RecordingSession {
  steps: RecordingStep[];
  cleanup: Array<() => Promise<void> | void>;
}

/**
 * Build a reasonably-stable CSS selector for a DOM element.
 * Prefers data-testid, then id, then a concise tag-based path.
 */
function buildSelector(el: Element): string {
  // 1. data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  // 2. id
  const id = el.getAttribute('id');
  if (id) return `#${CSS.escape(id)}`;

  // 3. name attribute (useful for form elements)
  const name = el.getAttribute('name');
  if (name) {
    const tag = el.tagName.toLowerCase();
    return `${tag}[name="${CSS.escape(name)}"]`;
  }

  // 4. Walk up the tree to build a path
  const segments: string[] = [];
  let current: Element | null = el;
  let depth = 0;
  while (current && current !== document.body && depth < 5) {
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    let selector = tag;

    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName,
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector = `${tag}:nth-of-type(${index})`;
      }
    }

    segments.unshift(selector);
    current = parent;
    depth++;
  }

  return segments.join(' > ');
}

/**
 * Injected script that listens for user interactions and records them.
 * Communication happens via window.__recordingSteps array which the host
 * reads via page.evaluate().
 */
const RECORDING_INJECT = `
(function () {
  if (window.__recordingActive) return;
  window.__recordingActive = true;
  window.__recordingSteps = [];

  function buildSelector(el) {
    if (!el || el === document.body || el === document.documentElement) return 'body';
    var testId = el.getAttribute && el.getAttribute('data-testid');
    if (testId) return '[data-testid="' + testId + '"]';
    var id = el.getAttribute && el.getAttribute('id');
    if (id) return '#' + CSS.escape(id);
    var name = el.getAttribute && el.getAttribute('name');
    if (name) {
      var tag = el.tagName.toLowerCase();
      return tag + '[name="' + CSS.escape(name) + '"]';
    }
    var segments = [];
    var current = el;
    var depth = 0;
    while (current && current !== document.body && depth < 5) {
      var tag2 = current.tagName.toLowerCase();
      var parent = current.parentElement;
      var sel = tag2;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function (c) { return c.tagName === current.tagName; });
        if (siblings.length > 1) {
          var idx = siblings.indexOf(current) + 1;
          sel = tag2 + ':nth-of-type(' + idx + ')';
        }
      }
      segments.unshift(sel);
      current = parent;
      depth++;
    }
    return segments.join(' > ');
  }

  function isEditable(el) {
    if (!el) return false;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable;
  }

  // Click
  document.addEventListener('click', function (e) {
    var target = e.target;
    if (!target) return;
    var selector = buildSelector(target);
    window.__recordingSteps.push({ action: 'click', selector: selector });
  }, true);

  // Input / fill (only record on blur or Enter to avoid flooding)
  var lastInputSelector = null;
  var lastInputValue = '';

  document.addEventListener('input', function (e) {
    var target = e.target;
    if (!isEditable(target)) return;
    lastInputSelector = buildSelector(target);
    lastInputValue = target.value || target.innerText || '';
  }, true);

  document.addEventListener('change', function (e) {
    if (!lastInputSelector) return;
    var target = e.target;
    if (!isEditable(target)) return;
    var selector = buildSelector(target);
    var value = target.value || target.innerText || '';
    if (target.tagName === 'SELECT') {
      window.__recordingSteps.push({ action: 'select', selector: selector, value: value });
    } else {
      window.__recordingSteps.push({ action: 'fill', selector: selector, value: value });
    }
    lastInputSelector = null;
    lastInputValue = '';
  }, true);

  // Key press (capture Enter separately for inputs)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && lastInputSelector) {
      window.__recordingSteps.push({ action: 'fill', selector: lastInputSelector, value: lastInputValue });
      lastInputSelector = null;
      lastInputValue = '';
    } else if (e.key === 'Tab' || e.key === 'Escape') {
      // non-action keys we ignore for recording
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // regular printable character - handled by input event
    } else {
      // special keys like ArrowDown, etc.
      var target = e.target;
      if (target && isEditable(target)) return; // skip for editable fields
      var selector = buildSelector(target);
      window.__recordingSteps.push({ action: 'pressKey', selector: selector, key: e.key });
    }
  }, true);

  // Hover (debounced)
  var hoverTimer = null;
  document.addEventListener('mouseover', function (e) {
    var target = e.target;
    if (!target) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      var selector = buildSelector(target);
      var last = window.__recordingSteps[window.__recordingSteps.length - 1];
      if (!last || last.action !== 'hover' || last.selector !== selector) {
        window.__recordingSteps.push({ action: 'hover', selector: selector });
      }
    }, 500);
  }, true);
})();
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Launch a new Chromium browser instance with a fresh context and page.
 */
export async function launchBrowser(options?: {
  headless?: boolean;
}): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({
    headless: options?.headless ?? false,
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  return { browser, context, page };
}

/**
 * Connect to an already-running Chrome instance via CDP.
 */
export async function connectToBrowser(
  cdpUrl: string,
): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.connectOverCDP(cdpUrl);

  const contexts = browser.contexts();
  const context = contexts.length > 0 ? contexts[0]! : await browser.newContext();

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0]! : await context.newPage();

  return { browser, context, page };
}

/**
 * Close the browser instance.
 */
export async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close();
}

/**
 * Start recording user interactions on the given page.
 *
 * Returns a `stop` function that, when called, ends the recording and returns
 * all captured steps.
 *
 * The approach combines:
 *  - Injected client-side script for DOM event capture (click, fill, select,
 *    hover, keypress).
 *  - Playwright `page.on('load')` / `framenavigated` listeners for navigation
 *    tracking (which survives full-page navigations that would wipe the
 *    injected script).
 */
export async function startRecording(
  context: BrowserContext,
  page: Page,
): Promise<{ stop: () => Promise<RecordingStep[]> }> {
  const session: RecordingSession = { steps: [], cleanup: [] };

  // ----- Navigation tracking via Playwright events (survives page reloads) ---
  const currentUrl = (): string => page.url();

  const onFrameNavigated = (frame: { url: () => string; name: () => string }) => {
    // Ignore about:blank and data: URLs
    const url = frame.url();
    if (!url || url === 'about:blank' || url.startsWith('data:')) return;
    if (frame.name() !== '' && frame !== page.mainFrame()) return; // skip sub-frames

    const steps = session.steps;
    const lastStep = steps[steps.length - 1];
    // Deduplicate consecutive navigations to the same URL
    if (lastStep?.action === 'navigate' && lastStep?.url === url) return;

    steps.push({ action: 'navigate', url });
  };

  // Attach navigation listener
  page.on('framenavigated', onFrameNavigated);
  session.cleanup.push(() => {
    page.off('framenavigated', onFrameNavigated);
  });

  // ----- Inject recording script on every page load -------------------------
  const injectScript = async () => {
    try {
      await page.evaluate(RECORDING_INJECT);
    } catch {
      // page might be navigating or on a restricted URL; ignore
    }
  };

  page.on('load', injectScript);
  session.cleanup.push(() => {
    page.off('load', injectScript);
  });

  // Also inject immediately for the current page state
  await injectScript();

  // ----- Poll interval to collect steps from the injected script ------------
  const pollInterval = setInterval(async () => {
    try {
      const clientSteps: RecordingStep[] | undefined = await page.evaluate(
        'window.__recordingSteps ? window.__recordingSteps.splice(0) : []',
      );
      if (clientSteps && clientSteps.length > 0) {
        for (const step of clientSteps) {
          // Deduplicate: skip if last step is identical
          const last = session.steps[session.steps.length - 1];
          if (
            last &&
            last.action === step.action &&
            last.selector === step.selector &&
            last.value === step.value
          ) {
            continue;
          }
          session.steps.push(step);
        }
      }
    } catch {
      // page may be navigating; ignore
    }
  }, 300);

  session.cleanup.push(() => {
    clearInterval(pollInterval);
  });

  // Record the initial navigation
  const initialUrl = currentUrl();
  if (initialUrl && initialUrl !== 'about:blank') {
    session.steps.push({ action: 'navigate', url: initialUrl });
  }

  // ----- stop() function ----------------------------------------------------
  const stop = async (): Promise<RecordingStep[]> => {
    // Run all cleanup
    for (const fn of session.cleanup) {
      try {
        await fn();
      } catch {
        // best-effort cleanup
      }
    }
    session.cleanup = [];

    // Final collection of any remaining client-side steps
    try {
      const remaining: RecordingStep[] | undefined = await page.evaluate(
        'window.__recordingSteps ? window.__recordingSteps.splice(0) : []',
      );
      if (remaining && remaining.length > 0) {
        for (const step of remaining) {
          const last = session.steps[session.steps.length - 1];
          if (
            last &&
            last.action === step.action &&
            last.selector === step.selector &&
            last.value === step.value
          ) {
            continue;
          }
          session.steps.push(step);
        }
      }
    } catch {
      // best-effort
    }

    // Mark recording inactive
    try {
      await page.evaluate('window.__recordingActive = false');
    } catch {
      // ignore
    }

    return session.steps;
  };

  return { stop };
}
