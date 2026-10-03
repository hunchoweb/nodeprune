import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, lstat, symlink, utimes, rm, link, chmod, rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { discover } from '../src/scanner/discover.js';
import { lastActivity } from '../src/scanner/activity.js';
import { directorySize } from '../src/scanner/size.js';
import { removeCandidate } from '../src/cleanup/remove.js';
import { detectManager } from '../src/utils/package-manager.js';
import { expandPath, scanRoots, within } from '../src/utils/paths.js';
import { DAY, oldEnough, formatAge, terminalText } from '../src/utils/format.js';
const exec = promisify(execFile);
async function fixture(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'nclean-test-'));
  // Canonical paths matter on macOS, where /var is a symlink.
  const { realpath } = await import('node:fs/promises');
  t.after(() => rm(root, { recursive: true, force: true }));
  return realpath(root);
}
async function project(root: string, name: string, lock = 'package-lock.json', modules = true): Promise<string> {
  const target = path.join(root, name);
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, 'package.json'), '{}');
  if (lock) await writeFile(path.join(target, lock), '{}');
  await writeFile(path.join(target, 'index.ts'), 'export {};');
  if (modules) {
    await mkdir(path.join(target, 'node_modules', 'dependency'), { recursive: true });
    await writeFile(path.join(target, 'node_modules', 'dependency', 'index.js'), 'hello');
  }
  return target;
}
async function age(target: string, days: number): Promise<void> {
  const stamp = new Date(Date.now() - days * DAY);
  for (const file of ['package.json', 'package-lock.json', 'index.ts']) await utimes(path.join(target, file), stamp, stamp);
}
test('detect projects, all package managers, nested projects, and prune dependencies', async t => {
  const root = await fixture(t);
  for (const [name, lock] of [['npm', 'package-lock.json'], ['pnpm', 'pnpm-lock.yaml'], ['yarn', 'yarn.lock'], ['bun', 'bun.lock'], ['bun-binary', 'bun.lockb']] as const) {
    const target = await project(root, name, lock);
    assert.equal(await detectManager(target), name.startsWith('bun') ? 'bun' : name);
  }
  const parent = await project(root, 'mono');
  await project(parent, 'apps/web');
  await project(root, 'no-deps', '', false);
  await writeFile(path.join(parent, 'node_modules', 'dependency', 'package.json'), '{}');
  const result = await discover([root]);
  assert.equal(result.projects, 8);
  assert.equal(result.entries.length, 7);
  assert.equal(result.warnings.length, 0);
});
test('activity uses source, manifests and lockfiles; node_modules is excluded', async t => {
  const root = await fixture(t);
  const target = await project(root, 'old');
  await age(target, 60);
  assert.ok(oldEnough(await lastActivity(target), 30));
  await writeFile(path.join(target, 'node_modules', 'fresh.js'), 'new');
  assert.ok(oldEnough(await lastActivity(target), 30));
  await writeFile(path.join(target, 'index.ts'), 'changed');
  assert.ok(!oldEnough(await lastActivity(target), 30));
  await age(target, 60);
  await writeFile(path.join(target, 'package-lock.json'), 'changed');
  assert.ok(!oldEnough(await lastActivity(target), 30));
  await age(target, 60);
  await writeFile(path.join(target, 'package.json'), '{}');
  assert.ok(!oldEnough(await lastActivity(target), 30));
});
test('recent Git commit protects files whose mtimes are old', async t => {
  const root = await fixture(t);
  const target = await project(root, 'git');
  await exec('git', ['init', target]);
  await exec('git', ['-C', target, 'add', 'package.json', 'package-lock.json', 'index.ts']);
  await exec('git', ['-C', target, '-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
  await age(target, 60);
  assert.ok(!oldEnough(await lastActivity(target), 30));
});
test('age threshold boundaries and unknown activity are conservative', () => {
  assert.ok(oldEnough(1000, 30, 1000 + 30 * DAY));
  assert.ok(!oldEnough(1001, 30, 1000 + 30 * DAY));
  assert.ok(!oldEnough(null, 0));
  assert.ok(!oldEnough(Date.now() + DAY, 0));
  assert.equal(formatAge(null), 'unknown');
  assert.equal(terminalText('evil\u001b[31m\n'), 'evil?[31m?');
});
test('streamed sizes do not follow links and deduplicate hard links', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'modules'));
  const file = path.join(root, 'modules', 'file');
  await writeFile(file, 'hello');
  await link(file, path.join(root, 'modules', 'hardlink'));
  await writeFile(path.join(root, 'outside'), 'do not count');
  await symlink(path.join(root, 'outside'), path.join(root, 'modules', 'link'));
  assert.equal(await directorySize(path.join(root, 'modules')), 5);
});
test('path handling rejects invalid roots, links, root filesystem and overlapping roots', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'nested'));
  assert.equal(expandPath('~'), os.homedir());
  assert.ok(within(root, path.join(root, 'nested')));
  assert.ok(!within(root, `${root}-other`));
  assert.deepEqual(await scanRoots([root, path.join(root, 'nested'), root]), [root]);
  await assert.rejects(scanRoots([path.join(root, 'missing')]));
  await assert.rejects(scanRoots([path.parse(root).root]));
  await symlink(path.join(root, 'nested'), path.join(root, 'alias'), 'dir');
  await assert.rejects(scanRoots([path.join(root, 'alias')]));
});
test('scanner skips symlink projects and node_modules; cleanup preserves external data', async t => {
  const root = await fixture(t);
  const external = await fixture(t);
  const target = await project(root, 'linked', 'package-lock.json', false);
  await project(external, 'external');
  await symlink(external, path.join(root, 'linked-root'), 'dir');
  await symlink(external, path.join(target, 'node_modules'), 'dir');
  const result = await discover([root]);
  assert.equal(result.entries.length, 0);
  assert.equal(result.projects, 1);
  assert.equal(result.warnings.length, 1);
  assert.ok((await lstat(path.join(external, 'external', 'package.json'))).isFile());
});
test('cleanup only removes node_modules and dry run does not delete', async t => {
  const root = await fixture(t);
  const target = await project(root, 'safe');
  await mkdir(path.join(target, '.git'));
  const external = path.join(root, 'outside-dependencies');
  await mkdir(external);
  await writeFile(path.join(external, 'keep'), 'preserve me');
  await symlink(external, path.join(target, 'node_modules', 'external-link'), 'dir');
  const entry = (await discover([root])).entries[0]!;
  assert.equal(await removeCandidate(entry, true), 0);
  assert.ok((await lstat(entry.path)).isDirectory());
  assert.equal(await removeCandidate(entry), 5);
  await assert.rejects(lstat(entry.path), { code: 'ENOENT' });
  for (const file of ['package.json', 'package-lock.json', 'index.ts', '.git']) assert.ok(await lstat(path.join(target, file)));
  assert.ok(await lstat(path.join(external, 'keep')));
});
test('cleanup rejects forged targets, symlink swaps, unknown values and replaced ancestors', async t => {
  const root = await fixture(t);
  const target = await project(root, 'safe');
  const entry = (await discover([root])).entries[0]!;
  await assert.rejects(removeCandidate({ ...entry, path: target }));
  await assert.rejects(removeCandidate({ ...entry, root: path.join(root, 'different') }));
  await assert.rejects(removeCandidate({ ...entry, bytes: null }));
  await assert.rejects(removeCandidate({ ...entry, lastActive: null }));
  await assert.rejects(removeCandidate({ ...entry, inode: -1 }));
  await rm(entry.path, { recursive: true });
  const external = await fixture(t);
  await writeFile(path.join(external, 'keep'), 'keep');
  await symlink(external, entry.path, 'dir');
  await assert.rejects(removeCandidate(entry));
  assert.ok(await lstat(path.join(external, 'keep')));
});
test('CLI dry run, scan, invalid paths, threshold, refusal without confirmation and explicit cleanup', async t => {
  const root = await fixture(t);
  const target = await project(root, 'old');
  await age(target, 60);
  await project(root, 'active');
  const cli = path.resolve('dist/cli.js');
  const run = (...args: string[]) => exec(process.execPath, [cli, ...args]);
  const dry = await run('clean', root, '--older-than', '30', '--yes', '--dry-run');
  assert.match(dry.stdout, /1 eligible directory/);
  assert.ok(await lstat(path.join(target, 'node_modules')));
  assert.match((await run('scan', root, '--older-than', '30')).stdout, /old/);
  await assert.rejects(run('clean', root, '--older-than', '30'), /Confirmation requires/);
  await assert.rejects(run('scan', path.join(root, 'missing')));
  await assert.rejects(run('--older-than', '-1'), /whole number/);
  assert.match((await run(root)).stdout, /Nothing was deleted/);
  assert.match((await run('clean', root, '--older-than', '30', '--yes')).stdout, /1 node_modules removed/);
  assert.ok(await lstat(path.join(root, 'active', 'node_modules')));
  assert.ok(await lstat(path.join(target, 'package.json')));
});


test('changed ancestor directories are rejected before cleanup', async t => {
  const root = await fixture(t);
  const target = await project(root, 'safe');
  const entry = (await discover([root])).entries[0]!;
  await rename(target, path.join(root, 'moved'));
  await symlink(path.join(root, 'moved'), target, 'dir');
  await assert.rejects(removeCandidate(entry), /symlink/);
  assert.ok(await lstat(path.join(root, 'moved', 'node_modules')));
});

test('permission failures produce unknown sizes and cleanup continues with other entries', async t => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('POSIX permissions require an unprivileged user'); return; }
  const root = await fixture(t);
  const blocked = await project(root, 'blocked');
  await project(root, 'readable');
  const folder = path.join(blocked, 'node_modules', 'dependency');
  await chmod(folder, 0);
  t.after(() => chmod(folder, 0o755).catch(() => {}));
  const result = await discover([root]);
  const entry = result.entries.find(entry => entry.project === blocked)!;
  assert.equal(entry.bytes, null);
  assert.match(entry.error!, /EACCES|EPERM/);
  await assert.rejects(removeCandidate(entry));
  assert.equal(result.entries.find(entry => entry.project !== blocked)!.bytes, 5);
  await chmod(folder, 0o755);
});

test('CLI summarizes permission warnings by default and exposes details with --verbose', async t => {
  if (process.platform === 'win32' || process.getuid?.() === 0) { t.skip('POSIX permissions require an unprivileged user'); return; }
  const root = await fixture(t);
  const blocked = path.join(root, 'blocked-private-folder');
  await mkdir(blocked);
  await chmod(blocked, 0);
  try {
    for (const verbose of [false, true]) {
      await assert.rejects(exec(process.execPath, [path.resolve('dist/cli.js'), 'scan', root, ...(verbose ? ['--verbose'] : [])]), error => {
        const result = error as Error & { code: number; stdout: string; stderr: string };
        assert.equal(result.code, 1);
        assert.match(result.stderr, /Partial scan/);
        assert.match(result.stderr, /1 folder skipped/);
        assert.match(result.stdout, /Scan incomplete/);
        assert.equal(result.stderr.includes('blocked-private-folder'), verbose);
        return true;
      });
    }
  } finally { await chmod(blocked, 0o755); }
});
