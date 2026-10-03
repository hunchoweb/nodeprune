#!/usr/bin/env node
import { Command, InvalidArgumentError } from 'commander';
import { scan } from './commands/scan.js';
import { clean } from './commands/clean.js';
import { banner, table } from './ui/output.js';
import { errorMessage, terminalText } from './utils/format.js';
import type { Options } from './types.js';
function days(value: string): number {
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new InvalidArgumentError('Use a non-negative whole number of days, e.g. 30.');
  return Number(value);
}
const program = new Command();
program.configureHelp({ showGlobalOptions: true });
program.name('nclean').description('Clean up forgotten Node.js dependencies.').version('0.1.0')
  .argument('[paths...]', 'Project directories (defaults: ~/Projects, ~/Code, ~/Developer, ~/dev)')
  .option('--older-than <days>', 'Only include projects inactive for at least this many days', days)
  .option('--dry-run', 'Preview candidates; never delete anything')
  .addHelpText('after', `\nExamples:\n  nclean                             Select dependencies interactively\n  nclean ~/Projects ~/Code           Scan specific directories\n  nclean --dry-run --older-than 30    Preview old dependencies\n  nclean scan ~/Projects             Report only\n  nclean clean ~/Projects --older-than 30\n  nclean clean ~/Projects --older-than 30 --yes\n\nDefault scans include all ages; nothing is preselected.\nCleanup always requires confirmation unless clean --yes is explicit.\nSizes are file bytes, not a guarantee of physical free disk space.\n`)
  .action(async (paths: string[], options: Options) => {
    banner();
    const result = await scan(paths, options);
    if (result.entries.length) await clean(result.entries, options, true);
  });
program.command('scan').description('Find dependencies and report their sizes without deleting')
  .argument('[paths...]', 'Project directories')
  .action(async (paths: string[], _options: unknown, command: Command) => {
    banner();
    const result = await scan(paths, command.optsWithGlobals<Options>());
    if (result.entries.length) table(result.entries);
  });
program.command('clean').description('Print matching directories and confirm bulk deletion')
  .argument('[paths...]', 'Project directories')
  .option('-y, --yes', 'Explicitly authorize deletion without a prompt')
  .action(async (paths: string[], _options: unknown, command: Command) => {
    banner();
    const options = command.optsWithGlobals<Options>();
    const result = await scan(paths, options);
    if (result.entries.length) await clean(result.entries, options, false);
  });
try { await program.parseAsync(); }
catch (error) {
  const name = error instanceof Error ? error.name : '';
  if (['ExitPromptError', 'AbortPromptError', 'AbortError'].includes(name)) console.log('\nCancelled. Nothing further was deleted.');
  else { console.error(`Error: ${terminalText(errorMessage(error))}`); process.exitCode = 1; }
}
