import type { Options, ScanResult } from '../types.js';
import { scanRoots } from '../utils/paths.js';
import { discover } from '../scanner/discover.js';
import { oldEnough } from '../utils/format.js';
import { scanning, scanComplete, message, note } from '../ui/output.js';
import { startScanProgress } from '../ui/progress.js';
import { scanDiagnostics } from '../ui/diagnostics.js';
export async function scan(inputs: string[], options: Options): Promise<ScanResult> {
  const roots = await scanRoots(inputs);
  scanning(roots);
  const progress = startScanProgress();
  let result: ScanResult;
  try { result = await discover(roots, (_message, state) => progress.update(state)); }
  finally { progress.stop(); }
  const folderCount = result.entries.length;
  const diagnostics = scanDiagnostics(result.warnings, result.entries, options.verbose);
  if (diagnostics) {
    console.error(diagnostics);
    process.exitCode = 1;
  }
  if (options.olderThan !== undefined) {
    const unknown = result.entries.filter(entry => entry.lastActive === null).length;
    result.entries = result.entries.filter(entry => oldEnough(entry.lastActive, options.olderThan!));
    if (unknown) note(`Skipped ${unknown} ${unknown === 1 ? 'directory' : 'directories'} with unknown activity.`);
  }
  scanComplete(result.projects, folderCount, result.entries, options.olderThan !== undefined);
  if (!result.projects && result.warnings.length) message('SCAN INCOMPLETE', 'No Node.js projects found in the accessible folders.', 'Try a specific project directory: nclean ~/Projects');
  else if (!result.projects) message('NO NODE PROJECTS FOUND', "We couldn't find any package.json files here.", 'Try: nclean ~/Projects');
  else if (!folderCount && result.warnings.length) message('SCAN INCOMPLETE', 'No dependency folders found in the accessible projects.', 'Skipped folders could not be checked.');
  else if (!folderCount) message('ALL CLEAN', 'No node_modules directories found.\nNothing to remove.');
  else if (!result.entries.length && result.warnings.length) message('NO MATCHES IN SCANNED FOLDERS', 'No inactive node_modules found in the accessible projects.', 'Skipped folders could not be checked.');
  else if (!result.entries.length) message('ALL CLEAN', 'No inactive node_modules found.\nNothing to remove.', 'Tip: try --older-than 7 to find recently inactive projects.');
  return result;
}
