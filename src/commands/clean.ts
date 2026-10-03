import pc from 'picocolors';
import type { Candidate, Options } from '../types.js';
import { removeCandidate } from '../cleanup/remove.js';
import { plan, restores, table, total } from '../ui/output.js';
import { selectEntries, confirmCleanup, isInteractive } from '../ui/interactive.js';
import { errorMessage, formatSize, terminalText } from '../utils/format.js';
import { displayPath } from '../utils/paths.js';
export async function clean(entries: Candidate[], options: Options, interactiveSelection: boolean): Promise<void> {
  const eligible = entries.filter(entry => entry.bytes !== null && entry.lastActive !== null && !entry.error);
  const skipped = entries.length - eligible.length;
  if (skipped) console.log(`Skipping ${skipped} directories with unknown activity or unreadable size.`);
  if (options.dryRun) {
    table(entries);
    console.log(`Dry run: ${eligible.length} directories eligible. Nothing was deleted.`);
    return;
  }
  if (!eligible.length) { console.log('No directories eligible for cleanup.'); return; }
  if (interactiveSelection && !isInteractive()) {
    table(entries);
    console.log('Selection requires an interactive terminal. Nothing was deleted.\nFor scripts: nclean clean <path> --older-than 30 --yes');
    return;
  }
  if (interactiveSelection) console.log(`${formatSize(total(eligible))} can be reclaimed across ${eligible.length} directories.\n`);
  const selected = interactiveSelection ? await selectEntries(eligible) : eligible;
  if (!selected.length) { console.log('Nothing selected. Nothing was deleted.'); return; }
  plan(selected);
  // --yes is only honored by the explicit clean command.
  if (!options.yes || interactiveSelection) {
    if (!isInteractive()) throw new Error('Confirmation requires an interactive terminal. Review with --dry-run, or explicitly use clean --yes. Nothing was deleted.');
    if (!await confirmCleanup()) { console.log('Cancelled. Nothing was deleted.'); return; }
  }
  const removed: Candidate[] = [];
  let bytes = 0;
  for (const entry of selected) {
    try {
      bytes += await removeCandidate(entry);
      removed.push(entry);
      console.log(pc.green(`Removed ${displayPath(entry.path)}`));
    } catch (error) {
      process.exitCode = 1;
      console.error(pc.red(`Could not remove ${displayPath(entry.path)}\nReason: ${terminalText(errorMessage(error))}`));
    }
  }
  console.log(`\n${pc.bold(`Removed ${removed.length} node_modules directories`)}\nReclaimed ${formatSize(bytes)} of measured dependency files.\nYour projects are untouched.`);
  if (removed.length) restores(removed);
}
