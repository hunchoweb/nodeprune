import { opendir, lstat } from 'node:fs/promises';
import path from 'node:path';
import type { Candidate, ScanResult } from '../types.js';
import { detectManager } from '../utils/package-manager.js';
import { errorMessage } from '../utils/format.js';
import { ignored, lastActivity } from './activity.js';
import { directorySize } from './size.js';
export async function discover(roots: string[], progress: (message: string) => void = () => {}): Promise<ScanResult> {
  const result: ScanResult = { projects: 0, entries: [], warnings: [] };
  async function walk(folder: string, root: string): Promise<void> {
    try {
      let isProject = false;
      try { isProject = (await lstat(path.join(folder, 'package.json'))).isFile(); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      if (isProject) {
        result.projects++;
        try {
          const modules = path.join(folder, 'node_modules');
          const stat = await lstat(modules);
          if (stat.isSymbolicLink()) result.warnings.push(`Skipped symlink: ${modules}`);
          else if (stat.isDirectory()) result.entries.push({ project: folder, path: modules, root, manager: 'npm', lastActive: null, bytes: null, device: stat.dev, inode: stat.ino, error: null });
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      }
      progress(`Discovering projects · ${result.projects} found`);
      for await (const entry of await opendir(folder)) {
        if (entry.isDirectory() && !entry.isSymbolicLink() && !ignored.has(entry.name)) await walk(path.join(folder, entry.name), root);
      }
    } catch (error) { result.warnings.push(`${folder}: ${errorMessage(error)}`); }
  }
  for (const root of roots) await walk(root, root);
  let next = 0, complete = 0;
  async function worker(): Promise<void> {
    while (next < result.entries.length) {
      const entry = result.entries[next++]!;
      try {
        entry.manager = await detectManager(entry.project);
        entry.lastActive = await lastActivity(entry.project);
        entry.bytes = await directorySize(entry.path);
      } catch (error) { entry.error = errorMessage(error); }
      progress(`Measuring dependencies · ${++complete}/${result.entries.length}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, result.entries.length) }, worker));
  result.entries.sort((a, b) => (b.bytes ?? -1) - (a.bytes ?? -1));
  return result;
}
