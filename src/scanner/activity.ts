import { opendir, lstat } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { projectScopeReason } from '../utils/project-scope.js';
const exec = promisify(execFile);
export const ignored = new Set(['node_modules', '.git', '.next', '.nuxt', '.cache', '.turbo', 'dist', 'build', 'coverage', 'vendor']);
const relevant = /\.(?:[cm]?[jt]sx?|vue|svelte|astro|json|ya?ml|toml|html|css|scss|md|graphql|prisma)$/i;
export async function lastActivity(project: string): Promise<number | null> {
  let newest: number | null = null;
  const record = (stamp: number): void => { newest = Math.max(newest ?? 0, stamp); };
  try {
    const { stdout } = await exec('git', ['-C', project, 'log', '-1', '--format=%ct', '--', '.'], { timeout: 3000, maxBuffer: 4096, windowsHide: true });
    const stamp = Number(stdout.trim()) * 1000;
    if (stdout.trim() && Number.isFinite(stamp) && stamp > 0) record(stamp);
  } catch { /* Git is optional; filesystem signals remain usable. */ }
  let reliable = true;
  async function walk(folder: string): Promise<void> {
    for await (const entry of await opendir(folder)) {
      if (entry.isSymbolicLink() || ignored.has(entry.name)) continue;
      const target = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (projectScopeReason(target)) continue;
        // Nested projects have their own activity signals.
        try { if ((await lstat(path.join(target, 'package.json'))).isFile()) continue; }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        await walk(target);
      } else if (entry.isFile() && (relevant.test(entry.name) || /^(?:yarn\.lock|bun\.lockb?|npm-shrinkwrap\.json)$/.test(entry.name))) {
        const stat = await lstat(target);
        if (stat.isFile()) record(stat.mtimeMs);
      }
    }
  }
  try { await walk(project); } catch { reliable = false; }
  // Incomplete signals must never make a project appear safely inactive.
  return reliable ? newest : null;
}
