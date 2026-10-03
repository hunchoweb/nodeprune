import { lstat } from 'node:fs/promises';
import path from 'node:path';
import type { PackageManager } from '../types.js';
export const lockfiles: [string, PackageManager][] = [
  ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm'],
];
export async function detectManager(project: string): Promise<PackageManager> {
  for (const [file, manager] of lockfiles) {
    try { if ((await lstat(path.join(project, file))).isFile()) return manager; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  return 'npm';
}
