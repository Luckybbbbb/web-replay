#!/usr/bin/env node

import { Command } from 'commander';
import { registerRecordCommand } from './cli/record.js';
import { registerPlayCommand } from './cli/play.js';
import { registerListCommand } from './cli/list.js';

const program = new Command();

program
  .name('web-replay')
  .description('Browser automation recording and playback tool')
  .version('0.1.0');

registerRecordCommand(program);
registerPlayCommand(program);
registerListCommand(program);

program.parse();
