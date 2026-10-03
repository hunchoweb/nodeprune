import { opendir, lstat } from 'node:fs/promises';
import path from 'node:path';
// One streamed walk per worker. Links are measured as links, never followed.
export async function directorySize(directory: string): Promise<number> {
  let bytes = 0;
  const seen = new Set<string>();
  async function walk(folder: string): Promise<void> {
    for await (const entry of await opendir(folder)) {
      const target = path.join(folder, entry.name);
      const stat = await lstat(target);
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) await walk(target);
      else if (stat.isFile()) {
        const key = `${stat.dev}:${stat.ino}`;
        if (stat.ino !== 0 && seen.has(key)) continue;
        seen.add(key);
        bytes += stat.size;
      }
    }
  }
  const stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Expected a real directory.');
  await walk(directory);
  return bytes;
}
