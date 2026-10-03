import pc from 'picocolors';
import type { Candidate } from '../types.js';
import { displayPath } from '../utils/paths.js';
import { formatAge, formatSize, terminalText } from '../utils/format.js';
export function banner(): void {
  console.log(`\n${pc.bold('nclean')}\n${pc.dim('Clean up forgotten Node.js dependencies.')}\n`);
}
export function total(entries: Candidate[]): number { return entries.reduce((sum, entry) => sum + (entry.bytes ?? 0), 0); }
export function table(entries: Candidate[]): void {
  console.log(pc.dim('  PROJECT / DEPENDENCIES                        SIZE       LAST ACTIVE    MANAGER'));
  for (const entry of entries) {
    console.log(`  ${pc.bold(displayPath(entry.project))}`);
    console.log(`    node_modules  ${pc.cyan(entry.bytes === null ? 'unknown size' : formatSize(entry.bytes))}  ·  ${formatAge(entry.lastActive)}  ·  ${entry.manager}${entry.error ? pc.red(`  ·  ${terminalText(entry.error)}`) : ''}`);
  }
  console.log(`\n${pc.bold(formatSize(total(entries)))} in measured dependencies\n`);
}
export function plan(entries: Candidate[]): void {
  console.log(pc.yellow('You are about to delete:'));
  for (const entry of entries) console.log(`  ${displayPath(entry.path)}\n    ${formatSize(entry.bytes!)} · last active ${formatAge(entry.lastActive)} · ${entry.manager}`);
  console.log(`\n  ${entries.length} node_modules directories · ${formatSize(total(entries))}\n\nYour project files and lockfiles will NOT be deleted.\n`);
}
export function restores(entries: Candidate[]): void {
  console.log('\nRestore dependencies when you need a project again:');
  for (const manager of [...new Set(entries.map(entry => entry.manager))]) {
    console.log(`\n  Run ${pc.bold(`${manager} install`)} in:`);
    for (const entry of entries.filter(entry => entry.manager === manager)) console.log(`    ${displayPath(entry.project)}`);
  }
}
