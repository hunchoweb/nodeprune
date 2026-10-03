import type { Candidate } from '../types.js';
import { terminalText } from '../utils/format.js';
import { textLines } from './layout.js';
import pc from 'picocolors';
export function scanDiagnostics(warnings: string[], entries: Candidate[], verbose = false): string {
  const unreadable = entries.filter(entry => entry.error);
  if (!warnings.length && !unreadable.length) return '';
  const restricted = warnings.filter(value => /\b(?:EPERM|EACCES):/.test(value)).length;
  const lines: string[] = [];
  if (warnings.length) {
    const other = warnings.length - restricted;
    const reasons = [restricted ? `${restricted} access denied` : '', other ? `${other} other ${other === 1 ? 'warning' : 'warnings'}` : ''].filter(Boolean).join(', ');
    lines.push(`Partial scan · ${warnings.length} ${warnings.length === 1 ? 'folder' : 'folders'} skipped (${reasons}).`);
  }
  if (unreadable.length) lines.push(`${unreadable.length} dependency ${unreadable.length === 1 ? 'folder is' : 'folders are'} unreadable and excluded from cleanup.`);
  const result = [pc.yellow(textLines(lines.join('\n')))];
  if (verbose) {
    for (const value of warnings) result.push(textLines(`Scan warning: ${terminalText(value)}`));
    for (const entry of unreadable) result.push(textLines(`${entry.path}: ${terminalText(entry.error!)}`));
  } else result.push(pc.dim(textLines('Use --verbose for details. Accessible projects are still shown.')));
  return `${result.join('\n')}\n`;
}
