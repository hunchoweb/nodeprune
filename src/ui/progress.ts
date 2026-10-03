import ora from 'ora';
import pc from 'picocolors';
import type { ScanProgress } from '../types.js';
import { terminalWidth, truncate } from './layout.js';
export function progressBar(percent: number | null, width = 80, step = 0): string {
  const length = Math.max(4, Math.min(32, width - 18));
  if (percent !== null) {
    const filled = Math.round(length * Math.max(0, Math.min(100, percent)) / 100);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
  }
  const segment = Math.min(5, Math.max(1, Math.floor(length / 3)));
  const travel = Math.max(1, length - segment);
  const offset = travel - Math.abs((step % (travel * 2)) - travel);
  return '░'.repeat(offset) + '█'.repeat(segment) + '░'.repeat(length - segment - offset);
}
export function progressPercent(state: ScanProgress): number | null {
  return state.phase === 'measurement' && state.total !== null && state.total > 0
    ? Math.floor(state.completed / state.total * 100) : null;
}
interface ProgressView { percent: number | null; detail: (width: number) => string }
function startProgress(initial: ProgressView): { update: (state: ProgressView) => void; stop: () => void } {
  let current = initial;
  let frameKey = '';
  const spinner = ora({ indent: 2, color: 'cyan', isEnabled: Boolean(process.stderr.isTTY), isSilent: !process.stderr.isTTY });
  const update = (state: ProgressView): void => {
    current = state;
    const width = terminalWidth();
    const percent = state.percent;
    const key = `${width}:${percent}`;
    if (key !== frameKey) {
      spinner.spinner = {
        interval: 180,
        frames: percent === null
          ? Array.from({ length: 56 }, (_, index) => progressBar(null, width, index))
          : [progressBar(percent, width)],
      };
      frameKey = key;
    }
    const label = percent === null ? ' discovering' : ` ${pc.bold(`${percent}%`)}`;
    spinner.text = `${label}\n\n  ${pc.dim(truncate(state.detail(width), width - 6))}`;
  };
  update(current);
  spinner.start();
  const resize = () => update(current);
  process.stdout.on('resize', resize);
  return {
    update,
    stop: () => {
      process.stdout.off('resize', resize);
      if (spinner.isSpinning && current.percent === 100) {
        spinner.stopAndPersist({ symbol: pc.cyan(progressBar(100, terminalWidth())), text: pc.bold('100%') });
      } else spinner.stop();
      if (process.stderr.isTTY) console.log();
    },
  };
}
export function startScanProgress(): { update: (state: ScanProgress) => void; stop: () => void } {
  const view = (state: ScanProgress): ProgressView => ({
    percent: progressPercent(state),
    detail: width => state.phase === 'discovery'
      ? (width < 48 ? `${state.projects} projects, ${state.folders} dirs` : `${state.projects} projects · ${state.folders} dependency folders`)
      : `${state.completed}/${state.total} ${width < 48 ? 'measured' : 'dependency folders measured'}`,
  });
  const progress = startProgress(view({ phase: 'discovery', projects: 0, folders: 0, completed: 0, total: null }));
  return { update: state => progress.update(view(state)), stop: progress.stop };
}
export function startCleanupProgress(total: number): { update: (completed: number, failed: number) => void; stop: () => void } {
  const view = (completed: number, failed: number): ProgressView => ({
    percent: total > 0 ? Math.floor(completed / total * 100) : 100,
    detail: width => `${width < 48 ? 'Cleaning' : 'Cleaning dependencies'} · ${completed}/${total} processed${failed ? ` · ${failed} failed` : ''}`,
  });
  const progress = startProgress(view(0, 0));
  return { update: (completed, failed) => progress.update(view(completed, failed)), stop: progress.stop };
}
