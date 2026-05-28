import type { Page, Request, Response, ConsoleMessage } from 'playwright';
import type {
  CollectorConfig,
  CollectedData,
  NetworkEntry,
  ConsoleEntry,
  AnalyticsEntry,
} from '../types/index.js';

/**
 * Collector captures network requests, console messages, and analytics events
 * from a Playwright page during recording or playback sessions.
 */
export class Collector {
  private collected: CollectedData;
  private config: CollectorConfig;
  private page: Page | null = null;

  // Bound listener references so we can remove them in detach()
  private onRequest: (request: Request) => void;
  private onResponse: (response: Response) => void;
  private onConsole: (msg: ConsoleMessage) => void;

  constructor(config: CollectorConfig) {
    this.config = config;
    this.collected = this.createEmptyData();

    this.onRequest = this.handleRequest.bind(this);
    this.onResponse = this.handleResponse.bind(this);
    this.onConsole = this.handleConsole.bind(this);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Attach to a Playwright page and start collecting data. */
  attach(page: Page): void {
    this.detach();
    this.page = page;

    if (this.config.network) {
      page.on('request', this.onRequest);
      page.on('response', this.onResponse);
    }

    if (this.config.console) {
      page.on('console', this.onConsole);
    }
  }

  /** Return a copy of all collected data. */
  getData(): CollectedData {
    return {
      network: [...this.collected.network],
      console: [...this.collected.console],
      analytics: [...this.collected.analytics],
    };
  }

  /** Clear all collected data. */
  reset(): void {
    this.collected = this.createEmptyData();
  }

  /** Remove all listeners from the attached page. */
  detach(): void {
    if (!this.page) return;

    this.page.off('request', this.onRequest);
    this.page.off('response', this.onResponse);
    this.page.off('console', this.onConsole);
    this.page = null;
  }

  // ---------------------------------------------------------------------------
  // Request / Response handlers
  // ---------------------------------------------------------------------------

  private handleRequest(request: Request): void {
    // Capture analytics from request (URL params or POST body)
    this.captureAnalytics(request);
  }

  private async handleResponse(response: Response): Promise<void> {
    const request = response.request();
    const resourceType = request.resourceType();

    const entry: NetworkEntry = {
      url: request.url(),
      method: request.method(),
      status: response.status(),
      timing: this.extractTiming(response),
    };

    // Capture request body for POST/PUT with payloads
    const postData = request.postData();
    if (postData) {
      entry.requestBody = postData;
    }

    // Only capture response body for XHR / Fetch requests to avoid huge payloads
    if (resourceType === 'xhr' || resourceType === 'fetch') {
      try {
        const body = await response.text().catch(() => undefined);
        if (body !== undefined) {
          entry.responseBody = body;
        }
      } catch {
        // Body may not be available for some responses
      }
    }

    this.collected.network.push(entry);
  }

  // ---------------------------------------------------------------------------
  // Console handler
  // ---------------------------------------------------------------------------

  private handleConsole(msg: ConsoleMessage): void {
    const entry: ConsoleEntry = {
      type: msg.type(),
      text: msg.text(),
      location: this.formatLocation(msg.location()),
      timestamp: Date.now(),
    };

    this.collected.console.push(entry);
  }

  // ---------------------------------------------------------------------------
  // Analytics capture
  // ---------------------------------------------------------------------------

  private captureAnalytics(request: Request): void {
    const domains = this.config.analytics.domains;
    if (!domains.length) return;

    const url = request.url();

    // Check if the URL matches any configured analytics domain
    const isAnalytics = domains.some(
      (domain) => url.includes(domain),
    );
    if (!isAnalytics) return;

    const entry = this.parseAnalyticsRequest(url, request);
    if (entry) {
      this.collected.analytics.push(entry);
    }
  }

  private parseAnalyticsRequest(
    url: string,
    request: Request,
  ): AnalyticsEntry | null {
    let params: Record<string, string> = {};

    // 1. Parse query-string based analytics (e.g. Google Analytics image hits)
    try {
      const parsedUrl = new URL(url);
      parsedUrl.searchParams.forEach((value, key) => {
        params[key] = value;
      });
    } catch {
      // Invalid URL — fall through to body parsing
    }

    // 2. Parse POST body for analytics payloads (e.g. GA4 Measurement Protocol)
    const postData = request.postData();
    if (postData && Object.keys(params).length === 0) {
      try {
        const json = JSON.parse(postData) as Record<string, unknown>;
        params = this.flattenAnalyticsPayload(json);
      } catch {
        // Not JSON — store raw body as a single param
        params = { body: postData };
      }
    }

    return {
      url,
      params,
      timestamp: Date.now(),
    };
  }

  /** Flatten a JSON payload into key-value pairs for analytics entry. */
  private flattenAnalyticsPayload(
    obj: Record<string, unknown>,
    prefix = '',
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (value === null || value === undefined) {
        result[fullKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, this.flattenAnalyticsPayload(
          value as Record<string, unknown>,
          fullKey,
        ));
      } else if (Array.isArray(value)) {
        result[fullKey] = JSON.stringify(value);
      } else {
        result[fullKey] = String(value);
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private createEmptyData(): CollectedData {
    return {
      network: [],
      console: [],
      analytics: [],
    };
  }

  private extractTiming(
    response: Response,
  ): NetworkEntry['timing'] {
    try {
      const request = response.request();
      const t = request.timing();
      return {
        dns: this.positiveOrUndefined(t.domainLookupEnd - t.domainLookupStart),
        tcp: this.positiveOrUndefined(t.connectEnd - t.connectStart),
        ssl: this.positiveOrUndefined(t.connectEnd - t.secureConnectionStart),
        ttfb: this.positiveOrUndefined(t.responseStart - t.requestStart),
        download: this.positiveOrUndefined(t.responseEnd - t.responseStart),
        total: this.positiveOrUndefined(t.responseEnd),
      };
    } catch {
      return undefined;
    }
  }

  /** Return the value if positive, otherwise undefined (filters out -1 sentinel values). */
  private positiveOrUndefined(ms: number): number | undefined {
    return ms > 0 ? ms : undefined;
  }

  private formatLocation(loc: {
    url?: string;
    lineNumber?: number;
    columnNumber?: number;
  }): string {
    if (!loc.url) return '';
    const line = loc.lineNumber ?? 0;
    const col = loc.columnNumber ?? 0;
    return `${loc.url}:${line}:${col}`;
  }
}
