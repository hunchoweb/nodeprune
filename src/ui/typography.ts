import pc from 'picocolors';
import stringWidth from 'string-width';
import { terminalWidth, textLines } from './layout.js';
// Outlined, slanted letterforms: each stroke has two visible edges.
const outlined: Record<string, string[]> = {
  n: ['        ', '  ____  ', ' / __ \\ ', '/ / / / ', '/_/ /_/ '],
  c: ['        ', '  _____ ', ' / ___/ ', '/ /__   ', '\\____/  '],
  l: ['   __   ', '  / /   ', ' / /    ', '/ /__   ', '\\___/   '],
  e: ['        ', '  ____  ', ' / __ \\ ', '/ ____/ ', '\\___/   '],
  a: ['        ', '  ____  ', ' / __ | ', '/ /_/ / ', '\\__,_/  '],
};
export function wordmark(width = terminalWidth()): string[] {
  if (width < 50) return ['nclean'];
  const gap = width >= 60 ? '  ' : '';
  return outlined.n!.map((_, row) => [...'nclean'].map(char => outlined[char]![row]!.trimEnd().padEnd(7)).join(gap).trimEnd());
}
const digits: Record<string, string[]> = {
  '0': [' _ ', '| |', '|_|'], '1': ['   ', '  |', '  |'],
  '2': [' _ ', ' _|', '|_ '], '3': [' _ ', ' _|', ' _|'],
  '4': ['   ', '|_|', '  |'], '5': [' _ ', '|_ ', ' _|'],
  '6': [' _ ', '|_ ', '|_|'], '7': [' _ ', '  |', '  |'],
  '8': [' _ ', '|_|', '|_|'], '9': [' _ ', '|_|', ' _|'],
  '.': [' ', ' ', '.'],
};
export function sizeHero(size: string, width = terminalWidth()): string {
  const [value = '', unit = ''] = size.split(' ');
  const glyphs = [...value].map(char => digits[char]);
  const art = glyphs.every(Boolean) ? [0, 1, 2].map(row => glyphs.map(glyph => glyph![row]).join(' ')) : [];
  // The unit stays in native type, aligned with the enlarged number's baseline.
  const artWidth = art.length ? stringWidth(`${art[2]}  ${unit}`) : Infinity;
  const column = Math.min(64, width - 4);
  if (width < 48 || artWidth > column) return `\n${pc.bold(textLines(size, width))}\n${pc.dim(textLines('space reclaimed', width))}\n`;
  const indent = ' '.repeat(2 + Math.floor((column - artWidth) / 2));
  const lines = art.map((line, row) => pc.bold(`${indent}${line}${row === 2 ? `  ${unit}` : ''}`));
  const caption = 'space reclaimed';
  const captionIndent = ' '.repeat(2 + Math.max(0, Math.floor((column - caption.length) / 2)));
  return `\n${lines.join('\n')}\n\n${pc.dim(`${captionIndent}${caption}`)}\n`;
}
