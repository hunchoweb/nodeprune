import path from 'node:path';
import pc from 'picocolors';
import stringWidth from 'string-width';
import type { Candidate } from '../types.js';
import { displayPath } from '../utils/paths.js';
import { DAY, formatSize, terminalText } from '../utils/format.js';
export const terminalWidth = (): number => Math.max(8, Math.min(100, process.stdout.columns || 80));
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
export function truncate(value: string, width: number): string {
  value = terminalText(value);
  if (width <= 0) return '';
  if (stringWidth(value) <= width) return value;
  const marker = width > 3 ? '...' : '.'.repeat(width);
  const remaining = width - marker.length;
  const chars = [...graphemes.segment(value)].map(part => part.segment);
  const take = (parts: string[], budget: number): string => {
    let result = '';
    for (const part of parts) {
      if (stringWidth(result + part) > budget) break;
      result += part;
    }
    return result;
  };
  const start = take(chars, Math.ceil(remaining * 0.4));
  const end = take(chars.toReversed(), remaining - stringWidth(start));
  return start + marker + [...graphemes.segment(end)].map(part => part.segment).reverse().join('');
}
export function pad(value: string, width: number, right = false): string {
  const fitted = truncate(value, width);
  const spaces = ' '.repeat(Math.max(0, width - stringWidth(fitted)));
  return right ? spaces + fitted : fitted + spaces;
}
export function compactRoot(root: string, width = terminalWidth() - 4): string {
  const display = displayPath(root);
  return truncate(display.startsWith('~') ? display : `.../${path.basename(root)}`, width);
}
export function projectLabel(entry: Candidate, entries: Candidate[]): string {
  const relative = path.relative(entry.root, entry.project).split(path.sep).join('/') || path.basename(entry.project);
  const roots = [...new Set(entries.map(item => item.root))];
  if (roots.length === 1) return terminalText(relative);
  const name = path.basename(entry.root);
  const sameName = roots.filter(root => path.basename(root) === name).length > 1;
  return terminalText(`${sameName ? `[${roots.indexOf(entry.root) + 1}]` : name}/${relative}`);
}
export function compactAge(time: number | null, now = Date.now()): string {
  if (time === null) return 'unknown';
  const days = Math.floor(Math.max(0, now - time) / DAY);
  if (days >= 365) return `${Math.floor(days / 365)}y`;
  if (days >= 90) return `${Math.floor(days / 30)}mo`;
  return `${days}d`;
}
export function rows(entries: Candidate[], width = terminalWidth(), prefixWidth = 2, metadata = true) {
  const space = Math.max(1, width - prefixWidth - 1); // Leave one cell to avoid terminal auto-wrap.
  const showSize = space >= 20;
  const showAge = metadata && space >= 38;
  const showManager = metadata && space >= 54;
  const sizeWidth = showSize ? entries.reduce((max, entry) => Math.max(max, stringWidth(entry.bytes === null ? 'unknown' : formatSize(entry.bytes))), 8) : 0;
  const ageWidth = showAge ? entries.reduce((max, entry) => Math.max(max, stringWidth(compactAge(entry.lastActive))), 8) : 0;
  const managerWidth = showManager ? 4 : 0;
  const extra = [sizeWidth, ageWidth, managerWidth].filter(Boolean).reduce((sum, value) => sum + value + 3, 0);
  const nameWidth = Math.max(1, Math.min(60, space - extra, entries.reduce((max, entry) => Math.max(max, stringWidth(projectLabel(entry, entries))), 22)));
  const compose = (name: string, size: string, age: string, manager: string, styled: boolean): string => {
    const cells = [pad(name, nameWidth)];
    if (showSize) cells.push(pad(size, sizeWidth, true));
    if (showAge) cells.push(styled ? pc.dim(pad(age, ageWidth, true)) : pad(age, ageWidth, true));
    if (showManager) cells.push(styled ? pc.dim(pad(manager, managerWidth)) : pad(manager, managerWidth));
    return cells.join('   ');
  };
  return {
    header: pc.dim(compose('Project', 'Size', 'Inactive', 'PM', false)),
    render: (entry: Candidate): string => compose(projectLabel(entry, entries), entry.bytes === null ? 'unknown' : formatSize(entry.bytes), compactAge(entry.lastActive), entry.manager, true),
  };
}
export function keyboardHelp(width = terminalWidth()): string {
  const controls = ['[space] select', '[a] all', '[enter] clean', '[esc] cancel'];
  const lines: string[] = [];
  let line = '';
  for (const control of controls) {
    const next = line ? `${line}     ${control}` : control;
    if (line && stringWidth(next) > width - 3) { lines.push(line); line = control; }
    else line = next;
  }
  if (line) lines.push(line);
  return pc.dim(lines.map(value => `  ${truncate(value, width - 3)}`).join('\n'));
}
// Static prose wraps at word boundaries; project rows always remain a single line.
export function textLines(value: string, width = terminalWidth()): string {
  const budget = Math.max(1, width - 3);
  return value.split('\n').flatMap(paragraph => {
    if (!paragraph) return [''];
    const lines: string[] = [];
    let line = '';
    for (const word of terminalText(paragraph).split(' ')) {
      if (line && stringWidth(`${line} ${word}`) > budget) { lines.push(`  ${line}`); line = ''; }
      const fitted = truncate(word, budget);
      line = line ? `${line} ${fitted}` : fitted;
    }
    if (line) lines.push(`  ${line}`);
    return lines;
  }).join('\n');
}

// One muted frame around a list, with a cell budget shared by all row renderers.
export function frame(lines: string[], width = terminalWidth(), header?: string): string {
  const boxWidth = Math.max(5, width - 3);
  const inner = boxWidth - 4;
  const edge = (left: string, right: string): string => `  ${pc.dim(`${left}${'─'.repeat(boxWidth - 2)}${right}`)}`;
  const line = (content: string): string => `  ${pc.dim('│')} ${content}${' '.repeat(Math.max(0, inner - stringWidth(content)))} ${pc.dim('│')}`;
  return [edge('┌', '┐'), ...(header ? [line(header), edge('├', '┤')] : []), ...lines.map(line), edge('└', '┘')].join('\n');
}
