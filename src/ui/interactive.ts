import { checkbox, confirm } from '@inquirer/prompts';
import type { Candidate } from '../types.js';
import { displayPath } from '../utils/paths.js';
import { formatAge, formatSize } from '../utils/format.js';
export const isInteractive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);
export async function selectEntries(entries: Candidate[]): Promise<Candidate[]> {
  console.log('↑/↓ navigate · Space select · A select all · Enter continue · Esc cancel\n');
  const controller = new AbortController();
  const onKey = (chunk: Buffer) => { if (chunk.toString() === '\u001b') controller.abort(); };
  process.stdin.on('data', onKey);
  try {
    return await checkbox<Candidate>({
      message: 'Select dependencies to remove', pageSize: 12, loop: false,
      choices: entries.map(entry => {
        const details = `${formatSize(entry.bytes!)}  ${formatAge(entry.lastActive)}  ${entry.manager}`;
        const available = Math.max(16, (process.stdout.columns || 80) - details.length - 8);
        const fullPath = displayPath(entry.project);
        const label = fullPath.length > available ? `...${fullPath.slice(-(available - 3))}` : fullPath;
        return { name: `${label}  ${details}`, value: entry };
      }),
    }, { signal: controller.signal });
  } finally { process.stdin.off('data', onKey); }
}
export async function confirmCleanup(): Promise<boolean> {
  return confirm({ message: 'Continue?', default: false });
}
