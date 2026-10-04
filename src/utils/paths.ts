import path from 'node:path';
import os from 'node:os';
import { lstat, realpath } from 'node:fs/promises';
import { terminalText } from './format.js';
import { assertProjectScope } from './project-scope.js';
export function expandPath(input: string): string {
  if (input === '~') return os.homedir();
  return path.resolve(input.startsWith('~/') || input.startsWith('~\\') ? path.join(os.homedir(), input.slice(2)) : input);
}
export function within(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}
export function displayPath(value: string): string {
  const home = os.homedir();
  return terminalText(within(home, value) ? `~${value.slice(home.length)}` : value);
}
export async function scanRoots(inputs: string[]): Promise<string[]> {
  const roots: string[] = [];
  for (const input of inputs.length ? inputs : [process.cwd()]) {
    const resolved = expandPath(input);
    const stat = await lstat(resolved);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Scan root must be a real directory: ${displayPath(resolved)}`);
    const canonical = await realpath(resolved);
    if (canonical === path.parse(canonical).root) throw new Error('Scanning the filesystem root is not supported. Choose a project directory.');
    if (canonical.split(path.sep).includes('node_modules')) throw new Error('Choose a project directory, not a directory inside node_modules.');
    assertProjectScope(canonical);
    roots.push(canonical);
  }
  return [...new Set(roots)].filter(root => !roots.some(other => other !== root && within(other, root)));
}
export async function assertRealPath(root: string, target: string): Promise<void> {
  if (!within(root, target)) throw new Error('Path is outside the scan root.');
  let current = root;
  const parts = path.relative(root, target).split(path.sep).filter(Boolean);
  for (const part of ['', ...parts]) {
    if (part) current = path.join(current, part);
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Directory changed or is a symlink: ${displayPath(current)}`);
  }
  if (await realpath(target) !== target) throw new Error('Path resolves through a symlink.');
}
