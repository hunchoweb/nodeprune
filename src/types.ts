export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';
export interface Candidate {
  project: string;
  path: string;
  root: string;
  manager: PackageManager;
  lastActive: number | null;
  bytes: number | null;
  device: number;
  inode: number;
  error: string | null;
}
export interface ScanResult { projects: number; entries: Candidate[]; warnings: string[] }
export interface Options { olderThan?: number; dryRun?: boolean; yes?: boolean }
