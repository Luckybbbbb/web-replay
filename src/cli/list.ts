import { listRecordings } from '../core/script-store.js';
import type { Command } from 'commander';

/**
 * Register the `list` subcommand on the Commander program.
 *
 * Usage:
 *   chrome-debug-agent list [options]
 */
export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all saved recordings')
    .option('--json', 'Output as JSON', false)
    .action(async (options) => {
      try {
        const recordings = await listRecordings(process.cwd());

        if (options.json) {
          console.log(JSON.stringify(recordings, null, 2));
          return;
        }

        if (recordings.length === 0) {
          console.log('No recordings found.');
          return;
        }

        console.log(`Found ${recordings.length} recording(s):\n`);

        for (const rec of recordings) {
          const stepCount = rec.steps.length;
          const created = rec.createdAt ? new Date(rec.createdAt).toLocaleString() : 'unknown';
          console.log(`  ${rec.name}`);
          console.log(`    URL: ${rec.url}`);
          console.log(`    Steps: ${stepCount}`);
          console.log(`    Created: ${created}`);
          if (rec.description) {
            console.log(`    Description: ${rec.description}`);
          }
          console.log('');
        }
      } catch (err) {
        console.error('List command failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
