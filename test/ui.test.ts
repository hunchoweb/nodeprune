import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { setImmediate } from 'node:timers/promises';
import { stripVTControlCharacters } from 'node:util';
import stringWidth from 'string-width';
import type { Candidate } from '../src/types.js';
import { compactAge, compactRoot, projectLabel, truncate, rows, keyboardHelp } from '../src/ui/layout.js';
import { dependencyPrompt, cleanupPrompt } from '../src/ui/interactive.js';
import { formatSize, DAY } from '../src/utils/format.js';
const root = path.resolve('virtual', 'demo');
const entries: Candidate[] = [
  ['monorepo/apps/web', 'npm'], ['shelf', 'pnpm'], ['long-project-name/'.repeat(8) + 'design-system', 'yarn'], ['中文项目/👨‍👩‍👧‍👦-é', 'bun'],
].map(([name, manager]) => ({ project: path.join(root, name!), root, path: path.join(root, name!, 'node_modules'), manager: manager as Candidate['manager'], bytes: 1024 ** 2, lastActive: Date.now() - 47 * DAY, device: 0, inode: 0, error: null }));
const plain = stripVTControlCharacters;
test('rows stay aligned and within terminal cells for long and Unicode project names', () => {
  for (const width of [24, 32, 40, 60, 80, 100, 120]) {
    for (const prefix of [2, 6]) {
      const layout = rows(entries, width, prefix);
      assert.ok(stringWidth(layout.header) + prefix < width);
      const sizeColumns: number[] = [];
      for (const entry of entries) {
        const row = plain(layout.render(entry));
        assert.ok(stringWidth(row) + prefix < width, `${width}: ${row}`);
        assert.ok(!row.includes(root));
        const position = row.indexOf('1.0 MB');
        if (position >= 0) sizeColumns.push(stringWidth(row.slice(0, position)));
      }
      assert.equal(new Set(sizeColumns).size, sizeColumns.length ? 1 : 0);
    }
    for (const line of keyboardHelp(width).split('\n')) assert.ok(stringWidth(line) < width);
  }
  assert.match(plain(rows(entries, 80, 6).render(entries[1]!)), /47d\s+pnpm/);
  assert.doesNotMatch(plain(rows(entries, 40, 6).render(entries[1]!)), /pnpm/);
});
test('compact labels preserve monorepo paths and disambiguate multiple scan roots', () => {
  assert.equal(projectLabel(entries[0]!, entries), 'monorepo/apps/web');
  assert.equal(compactRoot(path.join(path.parse(root).root, 'nclean-virtual', 'demo')), '.../demo');
  const roots = [path.resolve('first', 'Projects'), path.resolve('second', 'Projects')];
  const candidates = roots.map(root => ({ ...entries[0]!, root, project: path.join(root, 'web') }));
  assert.equal(projectLabel(candidates[0]!, candidates), '[1]/web');
  assert.equal(projectLabel(candidates[1]!, candidates), '[2]/web');
});
test('age and large-space formatting are compact without rounding away useful precision', () => {
  const now = Date.now();
  assert.equal(compactAge(now - 47 * DAY, now), '47d');
  assert.equal(compactAge(now - 120 * DAY, now), '4mo');
  assert.equal(compactAge(now - 400 * DAY, now), '1y');
  assert.equal(compactAge(null), 'unknown');
  assert.equal(formatSize(18.7 * 1024 ** 3), '18.7 GB');
  for (const width of [1, 3, 8, 15, 30]) assert.ok(stringWidth(truncate('中文项目/👨‍👩‍👧‍👦/é-long-project-name', width)) <= width);
});
function streams() {
  const input = new PassThrough();
  const output = new PassThrough();
  let transcript = '';
  output.on('data', chunk => { transcript += chunk.toString(); });
  return { input, output, context: { input, output }, transcript: () => plain(transcript), key: (name: string) => input.emit('keypress', '', { name }) };
}
test('selection updates its live total and finishes as a compact summary', async () => {
  const io = streams();
  const prompt = dependencyPrompt({ entries }, io.context);
  await setImmediate();
  assert.match(io.transcript(), /0 selected · 0 B/);
  io.key('space');
  assert.match(io.transcript(), /1 selected · 1.0 MB/);
  io.key('down');
  io.key('space');
  assert.match(io.transcript(), /2 selected · 2.0 MB/);
  io.key('a');
  assert.match(io.transcript(), /4 selected · 4.0 MB/);
  io.key('a');
  io.key('space');
  io.key('enter');
  assert.deepEqual(await prompt, [entries[1]]);
  assert.doesNotMatch(io.transcript(), /virtual/);
  assert.match(io.transcript(), /1 selected · 1.0 MB\s*$/);
});
test('Esc cancels selection and confirmation defaults to No', async () => {
  const selection = streams();
  const prompt = dependencyPrompt({ entries }, selection.context);
  await setImmediate();
  selection.key('space');
  selection.key('escape');
  assert.deepEqual(await prompt, []);
  const io = streams();
  const confirm = cleanupPrompt({}, io.context);
  await setImmediate();
  assert.match(io.transcript(), /Continue\? \[y\/N\]/);
  io.key('enter');
  assert.equal(await confirm, false);
});
test('confirmation only approves after explicit choice and Esc declines', async () => {
  for (const key of ['right', 'y', 'escape']) {
    const io = streams();
    const prompt = cleanupPrompt({}, io.context);
    await setImmediate();
    io.key(key);
    if (key === 'right' || key === 'y') io.key('enter');
    assert.equal(await prompt, key !== 'escape');
  }
});

test('custom wordmark and reclaimed-size hero fit narrow and desktop terminals', async () => {
  const { wordmark, sizeHero } = await import('../src/ui/typography.js');
  for (const width of [24, 40, 60, 80, 100]) {
    const mark = wordmark(width);
    assert.ok(mark.length > 1 || width < 50);
    for (const line of mark) assert.ok(stringWidth(line) + 2 < width);
    for (const size of ['0 B', '4.0 MB', '18.7 GB', '842 MB']) {
      for (const line of sizeHero(size, width).split('\n')) assert.ok(stringWidth(line) < width);
    }
  }
  assert.match(plain(keyboardHelp(80)), /\[space\] select.*\[a\] all.*\[enter\] clean.*\[esc\] cancel/);
});

test('bordered selection rows fit narrow terminals and preserve Unicode alignment', async () => {
  const { frame } = await import('../src/ui/layout.js');
  for (const width of [24, 40, 60, 80, 100]) {
    const layout = rows(entries, width - 6, 4);
    const panel = frame(entries.map(entry => `› ● ${layout.render(entry)}`), width, `    ${layout.header}`);
    assert.match(plain(panel), /┌.*┐/);
    for (const line of panel.split('\n')) assert.ok(stringWidth(line) < width, `${width}: ${plain(line)}`);
  }
});

test('hundreds of scan warnings collapse to a short notice; verbose preserves details', async () => {
  const { scanDiagnostics } = await import('../src/ui/diagnostics.js');
  const warnings = Array.from({ length: 120 }, (_, index) => `/private/protected/folder-${index}: EPERM: operation not permitted, opendir '/private/protected/folder-${index}'`);
  warnings.push('/private/other: EIO: input/output error');
  const failed = [{ ...entries[0]!, bytes: null, error: 'EACCES: permission denied' }];
  const summary = plain(scanDiagnostics(warnings, failed));
  assert.match(summary, /Partial scan/);
  assert.match(summary, /121 folders skipped/);
  assert.match(summary, /120 access denied/);
  assert.match(summary, /1 other warning/);
  assert.match(summary, /excluded from cleanup/);
  assert.match(summary, /--verbose/);
  assert.doesNotMatch(summary, /private\/protected|folder-119/);
  assert.ok(summary.split('\n').length < 10);
  const detail = plain(scanDiagnostics(warnings, failed, true));
  assert.match(detail, /folder-119/);
  assert.match(detail, /input\/output error/);
  assert.equal(scanDiagnostics([], []), '');
});
