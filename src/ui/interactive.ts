import { createPrompt, useState, useKeypress, useEffect, isUpKey, isDownKey, isSpaceKey, isEnterKey, usePagination } from '@inquirer/core';
import pc from 'picocolors';
import type { Candidate } from '../types.js';
import { formatSize } from '../utils/format.js';
import { rows, terminalWidth, keyboardHelp, truncate, textLines, frame } from './layout.js';
export const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);
interface SelectionConfig { entries: Candidate[] }
export const dependencyPrompt = createPrompt<Candidate[], SelectionConfig>((config, done) => {
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [finished, setFinished] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [width, setWidth] = useState(terminalWidth());
  useEffect(() => {
    const resize = () => setWidth(terminalWidth());
    process.stdout.on('resize', resize);
    return () => { process.stdout.off('resize', resize); };
  }, []);
  useKeypress(key => {
    if (isUpKey(key)) setActive(Math.max(0, active - 1));
    else if (isDownKey(key)) setActive(Math.min(config.entries.length - 1, active + 1));
    else if (isSpaceKey(key)) {
      const next = new Set(selected);
      if (next.has(active)) next.delete(active); else next.add(active);
      setSelected(next);
    } else if (key.name === 'a') setSelected(selected.size === config.entries.length ? new Set() : new Set(config.entries.map((_, index) => index)));
    else if (key.name === 'escape') { setCancelled(true); setFinished(true); done([]); }
    else if (isEnterKey(key)) { setFinished(true); done(config.entries.filter((_, index) => selected.has(index))); }
  });
  const layout = rows(config.entries, width - 6, 4);
  const page = usePagination({
    items: config.entries, active, loop: false,
    pageSize: Math.max(1, Math.min(10, (process.stdout.rows || 24) - 15)),
    renderItem: ({ item, index, isActive }) => {
      const marker = selected.has(index) ? '●' : '○';
      const cursor = isActive ? pc.cyan('›') : ' ';
      return `${cursor} ${selected.has(index) ? pc.cyan(marker) : pc.dim(marker)} ${layout.render(item)}`;
    },
  });
  const bytes = config.entries.reduce((sum, entry, index) => sum + (selected.has(index) ? entry.bytes ?? 0 : 0), 0);
  const summary = `${selected.size} selected · ${formatSize(bytes)}`;
  // Finish as one compact sentence, never a comma-joined list of paths.
  if (finished) return pc.dim(`  ${truncate(cancelled ? 'Selection cancelled' : summary, width - 3)}`);
  const position = config.entries.length > 10 ? `  ${active + 1}/${config.entries.length}\n` : '';
  return `  ${pc.bold(width < 40 ? 'Select dependencies' : 'Select dependencies to remove')}\n\n\n${frame(page.split('\n'), width, `    ${layout.header}`)}\n${position}\n\n  ${pc.cyan(pc.bold(truncate(summary, width - 3)))}\n\n\n${keyboardHelp(width)}\n`;
});
export async function selectEntries(entries: Candidate[]): Promise<Candidate[]> {
  return dependencyPrompt({ entries });
}
// A restrained Yes / No prompt; default and initial focus are always No.
export const cleanupPrompt = createPrompt<boolean, Record<string, never>>((_config, done) => {
  const [yes, setYes] = useState(false);
  const [finished, setFinished] = useState(false);
  useKeypress(key => {
    if (key.name === 'left' || key.name === 'right' || key.name === 'tab' || isSpaceKey(key)) setYes(!yes);
    else if (key.name === 'y') setYes(true);
    else if (key.name === 'n') setYes(false);
    else if (key.name === 'escape') { setYes(false); setFinished(true); done(false); }
    else if (isEnterKey(key)) { setFinished(true); done(yes); }
  });
  if (finished) return `  ${pc.dim(`Continue? ${yes ? 'Yes' : 'No'}`)}`;
  return `  ${pc.bold('Continue?')} [y/N] ${yes ? 'y' : ''}\n\n${pc.dim(textLines('[y] yes   [n] no   [enter] confirm', terminalWidth()))}`;
});
export async function confirmCleanup(): Promise<boolean> { return cleanupPrompt({}); }
