import pc from 'picocolors';
import type { Candidate } from '../types.js';
import { formatSize, terminalText } from '../utils/format.js';
import { compactRoot, projectLabel, rows, terminalWidth, textLines, truncate, frame } from './layout.js';
import { wordmark, sizeHero } from './typography.js';
export function banner(): void {
  console.log(`\n${pc.cyan(wordmark().map(line => `  ${line}`).join('\n'))}\n\n${pc.dim(textLines('Node modules cleanup, without the drama.'))}\n\n`);
}
export function total(entries: Candidate[]): number { return entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0); }
export function message(title: string, detail: string, tip?: string): void {
  const heading = title.toLowerCase().replace(/^./, char => char.toUpperCase());
  console.log(`\n${pc.bold(textLines(`${heading}.`))}\n\n${textLines(detail)}${tip ? `\n\n${pc.dim(textLines(tip))}` : ''}\n\n`);
}
export function note(value: string): void { console.log(pc.dim(textLines(value))); }
export function warning(value: string): void { console.error(textLines(value)); }
export function scanning(roots: string[]): void {
  if (roots.length === 1) console.log(textLines(`Scanning ${compactRoot(roots[0]!, terminalWidth() - 15)}...`));
  else {
    console.log(textLines('Scanning projects...'));
    for (const [index, root] of roots.entries()) note(`[${index + 1}] ${compactRoot(root, terminalWidth() - 8)}`);
  }
  console.log('\n');
}
export function scanComplete(projects: number, folders: number, entries: Candidate[], filtered: boolean): void {
  const eligible = entries.filter(entry => entry.bytes !== null && entry.lastActive !== null && !entry.error);
  console.log(textLines(`${projects} ${projects === 1 ? 'project' : 'projects'} scanned`));
  note(`${folders} dependency ${folders === 1 ? 'folder' : 'folders'} found`);
  if (eligible.length) {
    console.log(textLines(`${eligible.length} ${filtered ? 'inactive ' : 'eligible '}${eligible.length === 1 ? 'project' : 'projects'}`));
    console.log(`\n${pc.cyan(pc.bold(textLines(`${formatSize(total(eligible))} reclaimable`)))}`);
  }
  console.log('\n');
}
export function table(entries: Candidate[], minimal = false): void {
  const layout = rows(entries, terminalWidth() - 6, 0, !minimal);
  // Read-only reports need headings. Selection and confirmation rely on spacing.
  console.log(frame(entries.map(entry => layout.render(entry)), terminalWidth(), minimal ? undefined : layout.header));
  console.log('\n');
}
export function plan(entries: Candidate[]): void {
  console.log(`\n${pc.yellow(pc.bold(textLines('Ready to clean.')))}\n\n`);
  console.log(textLines(`${entries.length} node_modules ${entries.length === 1 ? 'directory' : 'directories'}`));
  console.log(pc.bold(textLines(formatSize(total(entries)))));
  console.log('\n');
  table(entries, true);
  note('Only node_modules in the listed projects will be removed.');
  note('Your project files and lockfiles will not be touched.');
  console.log('\n');
}
export function cleanupComplete(removed: Candidate[], bytes: number, failed: number): void {
  console.log(`\n${pc.bold(textLines(failed ? 'Cleanup finished with errors.' : 'Cleanup complete.'))}\n`);
  console.log(removed.length ? pc.green(sizeHero(formatSize(bytes))) : sizeHero(formatSize(bytes)));
  console.log(textLines(`${removed.length} node_modules removed${failed ? ` · ${failed} failed` : ''}`));
  note(`${removed.length} ${removed.length === 1 ? 'project' : 'projects'} untouched`);
  console.log('\n');
}
export function restores(entries: Candidate[]): void {
  note('Restore dependencies whenever you need them.');
  console.log();
  for (const manager of [...new Set(entries.map(entry => entry.manager))]) {
    console.log(`    ${pc.bold(`${manager} install`)}`);
    for (const entry of entries.filter(entry => entry.manager === manager)) console.log(pc.dim(`      ${truncate(projectLabel(entry, entries), terminalWidth() - 7)}`));
    console.log();
  }
  console.log(`\n${textLines('Done.')}\n`);
}
export function deletionFailure(entry: Candidate, entries: Candidate[], reason: string): void {
  console.error(pc.red(textLines(`Could not remove ${projectLabel(entry, entries)}/node_modules`)));
  console.error(pc.dim(textLines(`Reason: ${terminalText(reason)}`)));
}
