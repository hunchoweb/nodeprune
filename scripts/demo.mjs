import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root = await mkdtemp(path.join(tmpdir(), 'nclean-demo-'));
const examples = [
  ['shelf', 'pnpm-lock.yaml', 47],
  ['old-client', 'package-lock.json', 94],
  ['design-system', 'yarn.lock', 60],
  ['transfa', 'bun.lock', 12],
  ['active', 'package-lock.json', 0],
  ['monorepo/apps/web', 'package-lock.json', 70],
  ['no-dependencies', 'package-lock.json', 90],
];
for (const [name, lock, days] of examples) {
  const folder = path.join(root, name);
  await mkdir(folder, { recursive: true });
  const stamp = new Date(Date.now() - days * 86400000);
  for (const [file, content] of [['package.json', '{"private":true}'], [lock, '# demo lockfile'], ['index.ts', 'export {};']]) {
    await writeFile(path.join(folder, file), content);
    await utimes(path.join(folder, file), stamp, stamp);
  }
  if (name !== 'no-dependencies') {
    await mkdir(path.join(folder, 'node_modules', 'demo'), { recursive: true });
    await writeFile(path.join(folder, 'node_modules', 'demo', 'data'), Buffer.alloc(1024 * 1024));
  }
}
console.log(`Created fake projects only. Each dependency folder contains 1 MB.\n\n${root}\n\nPreview: node dist/cli.js "${root}" --dry-run --older-than 30\nSelect:  node dist/cli.js "${root}" --older-than 30`);
