import { play } from '../core/player.js';
import type { Command } from 'commander';

/**
 * Register the `play` subcommand on the Commander program.
 *
 * Usage:
 *   web-replay play <name> [options]
 */
export function registerPlayCommand(program: Command): void {
  program
    .command('play')
    .description('Play back a recorded browser session')
    .argument('<name>', 'Name of the recording to play')
    .option('--headed', 'Run in headed mode (browser visible)', false)
    .option('--report-dir <dir>', 'Directory to save the replay report')
    .action(async (name: string, options) => {
      try {
        const report = await play({
          name,
          headless: !options.headed,
          reportDir: options.reportDir,
        });

        console.log('');
        console.log(`Playback finished: ${report.status}`);
        console.log(`  Steps: ${report.steps.length}`);
        console.log(`  Duration: ${report.duration}ms`);

        if (report.status === 'failed') {
          const failedStep = report.steps.find((s) => s.status === 'failed');
          if (failedStep?.error) {
            console.error(`  Error: ${failedStep.error}`);
          }
          process.exit(1);
        }
      } catch (err) {
        console.error('Play command failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
