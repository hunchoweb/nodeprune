import path from 'node:path';

// Apply to the full path so choosing a protected subdirectory explicitly
// cannot bypass the same exclusions used during recursive discovery.
const generated = new Set(['node_modules', 'dist', 'build', 'coverage', 'vendor']);
const managed = new Set(['library', 'applications', 'appdata', 'program files', 'program files (x86)', 'programdata', 'windows']);
const systemRoots = ['/usr', '/opt', '/System', '/Applications', '/Library'];

export function projectScopeReason(folder: string): string | null {
  const absolute = path.resolve(folder);
  if (process.platform !== 'win32' && systemRoots.some(root => absolute === root || absolute.startsWith(`${root}/`))) {
    return 'system or installed-software directory';
  }
  for (const part of absolute.split(path.sep).filter(Boolean)) {
    if (part.startsWith('.')) return 'hidden or tool-managed directory';
    if (generated.has(part.toLowerCase())) return 'dependency or generated directory';
    if (managed.has(part.toLowerCase()) || /\.(?:app|framework|bundle)$/i.test(part)) return 'application or tool-managed directory';
  }
  return null;
}

export function assertProjectScope(folder: string): void {
  const reason = projectScopeReason(folder);
  if (reason) throw new Error(`Refusing project cleanup in a ${reason}. Choose a source project directory.`);
}
