export const DAY = 86_400_000;
export function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes < 100 && i > 0 ? bytes.toFixed(1) : Math.round(bytes)} ${units[i]}`;
}
export function formatAge(time: number | null, now = Date.now()): string {
  if (time === null) return 'unknown';
  const days = Math.floor(Math.max(0, now - time) / DAY);
  return days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`;
}
export function oldEnough(time: number | null, days: number, now = Date.now()): boolean {
  return time !== null && now - time >= days * DAY;
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
// Prevent filenames from injecting terminal escape sequences or extra rows.
export function terminalText(value: string): string { return value.replace(/[\x00-\x1f\x7f-\x9f]/g, '?'); }
