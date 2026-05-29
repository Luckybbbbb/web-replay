import { record } from '../core/recorder.js';
import type { Command } from 'commander';

/**
 * Register the `record` subcommand on the Commander program.
 *
 * Usage:
 *   web-replay record --url <url> --name <name> [options]
 */
export function registerRecordCommand(program: Command): void {
  program
    .command('record')
    .description('Record a browser session')
    .requiredOption('--url <url>', 'Starting URL to navigate to')
    .requiredOption('--name <name>', 'Name for the recording')
    .option('--description <desc>', 'Description of the recording')
    .option('--headed', 'Run in headed mode (browser visible)', false)
    .option('--collect-analytics', 'Collect network/console/analytics data', false)
    .option('--analytics-domains <domains>', 'Comma-separated list of analytics domains to track')
    .action(async (options) => {
      try {
        const analyticsDomains = options.analyticsDomains
          ? String(options.analyticsDomains).split(',').map((d: string) => d.trim())
          : [];

        await record({
          url: options.url,
          name: options.name,
          description: options.description,
          headless: !options.headed,
          collectAnalytics: options.collectAnalytics,
          analyticsDomains,
        });
      } catch (err) {
        console.error('Record command failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
