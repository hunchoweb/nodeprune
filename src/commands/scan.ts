import ora from 'ora';
import type { Options, ScanResult } from '../types.js';
import { scanRoots, displayPath } from '../utils/paths.js';
import { discover } from '../scanner/discover.js';
import { oldEnough, terminalText } from '../utils/format.js';
export async function scan(inputs: string[], options: Options): Promise<ScanResult> {
  const roots = await scanRoots(inputs);
  if (!roots.length) {
    console.log('No default project directories found.\n\nChoose a directory:\n  nclean ~/Projects');
    return { projects: 0, entries: [], warnings: [] };
  }
  console.log(`Scanning ${roots.map(displayPath).join(', ')}...`);
  const spinner = ora({ text: 'Discovering projects', isEnabled: Boolean(process.stderr.isTTY), isSilent: !process.stderr.isTTY }).start();
  let result: ScanResult;
  try { result = await discover(roots, message => { spinner.text = message; }); }
  finally { spinner.stop(); }
  console.log(`\nFound ${result.projects} Node.js projects\nFound ${result.entries.length} node_modules directories\n`);
  for (const warning of result.warnings) console.error(`Warning: ${terminalText(warning)}`);
  if (result.warnings.length) process.exitCode = 1;
  if (!result.projects) console.log('No Node.js projects found.\n\nTry:\n  nclean ~/Projects');
  else if (!result.entries.length) console.log('No node_modules directories found. Your machine is already clean.');
  for (const entry of result.entries) {
    if (entry.error) {
      console.error(`Warning: ${displayPath(entry.path)}: ${terminalText(entry.error)}`);
      process.exitCode = 1;
    }
  }
  if (options.olderThan !== undefined) {
    const unknown = result.entries.filter(entry => entry.lastActive === null).length;
    result.entries = result.entries.filter(entry => oldEnough(entry.lastActive, options.olderThan!));
    if (unknown) console.log(`Skipped ${unknown} directories with unknown activity.`);
    if (result.projects && !result.entries.length) console.log('No inactive node_modules found.\n\nTry:\n  nclean --older-than 7');
  }
  return result;
}
