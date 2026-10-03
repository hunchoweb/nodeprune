import ora from 'ora';
import type { Candidate, Options } from '../types.js';
import { removeCandidate } from '../cleanup/remove.js';
import { plan, restores, table, message, note, cleanupComplete, deletionFailure } from '../ui/output.js';
import { selectEntries, confirmCleanup, isInteractive } from '../ui/interactive.js';
import { errorMessage } from '../utils/format.js';
import { truncate, terminalWidth } from '../ui/layout.js';
export async function clean(entries: Candidate[], options: Options, interactiveSelection: boolean): Promise<void> {
  const eligible = entries.filter(entry => entry.bytes !== null && entry.lastActive !== null && !entry.error);
  const skipped = entries.length - eligible.length;
  if (skipped) note(`Skipping ${skipped} directories with unknown activity or unreadable size.`);
  if (options.dryRun) {
    table(entries);
    message('DRY RUN', `${eligible.length} eligible ${eligible.length === 1 ? 'directory' : 'directories'}. Nothing was deleted.`);
    return;
  }
  if (!eligible.length) { message('NOTHING TO CLEAN', 'No directories eligible for cleanup.'); return; }
  if (interactiveSelection && !isInteractive()) {
    table(entries);
    note('Selection requires an interactive terminal. Nothing was deleted.');
    note('For scripts: nclean clean <path> --older-than 30 --yes');
    console.log();
    return;
  }
  const selected = interactiveSelection ? await selectEntries(eligible) : eligible;
  if (!selected.length) { message('CANCELLED', 'Nothing selected. Nothing was deleted.'); return; }
  plan(selected);
  // --yes is only honored by the explicit clean command.
  if (!options.yes || interactiveSelection) {
    if (!isInteractive()) throw new Error('Confirmation requires an interactive terminal. Review with --dry-run, or explicitly use clean --yes. Nothing was deleted.');
    if (!await confirmCleanup()) { message('CANCELLED', 'Nothing was deleted.'); return; }
  }
  const removed: Candidate[] = [];
  const failures: { entry: Candidate; reason: string }[] = [];
  let bytes = 0;
  const spinner = ora({ text: truncate('Cleaning dependencies...', terminalWidth() - 6), spinner: { interval: 300, frames: ['.', '..', '...'] }, color: 'gray', indent: 2, isEnabled: Boolean(process.stderr.isTTY), isSilent: !process.stderr.isTTY }).start();
  try {
    for (const entry of selected) {
      try {
        bytes += await removeCandidate(entry);
        removed.push(entry);
      } catch (error) {
        process.exitCode = 1;
        failures.push({ entry, reason: errorMessage(error) });
      }
      spinner.text = truncate(`Cleaning dependencies · ${removed.length + failures.length}/${selected.length}`, terminalWidth() - 6);
    }
  } finally { spinner.stop(); }
  cleanupComplete(removed, bytes, failures.length);
  for (const failure of failures) deletionFailure(failure.entry, selected, failure.reason);
  if (removed.length) restores(removed);
}
