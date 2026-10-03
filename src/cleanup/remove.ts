import { lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import type { Candidate } from '../types.js';
import { assertRealPath } from '../utils/paths.js';
import { directorySize } from '../scanner/size.js';
export async function removeCandidate(entry: Candidate, dryRun = false): Promise<number> {
  if (path.basename(entry.path) !== 'node_modules' || path.dirname(entry.path) !== entry.project) throw new Error('Refusing to remove anything except project/node_modules.');
  if (entry.bytes === null || entry.error || entry.lastActive === null) throw new Error('Size or activity is unknown; refusing cleanup.');
  await assertRealPath(entry.root, entry.path);
  const manifest = await lstat(path.join(entry.project, 'package.json'));
  if (!manifest.isFile() || manifest.isSymbolicLink()) throw new Error('Project manifest is missing or changed.');
  const stat = await lstat(entry.path);
  if (stat.dev !== entry.device || stat.ino !== entry.inode) throw new Error('node_modules changed since scanning; scan again.');
  if (dryRun) return 0;
  const measured = await directorySize(entry.path);
  await assertRealPath(entry.root, entry.path);
  const latest = await lstat(entry.path);
  if (latest.dev !== entry.device || latest.ino !== entry.inode) throw new Error('node_modules changed before cleanup.');
  await rm(entry.path, { recursive: true, force: false, maxRetries: 2 });
  return measured;
}
