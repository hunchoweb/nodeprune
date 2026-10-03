# nclean

**Clean up forgotten Node.js dependencies.**

Old side projects, client work, and abandoned experiments leave behind a lot of `node_modules`. Find them, see what they cost, and remove the dependencies you no longer need. Keep your projects ready to return to.

nclean is a focused, cross-platform Node.js CLI for macOS, Linux, and Windows. It cleans project `node_modules` directories only.

## A quick demo

Illustrative output (sizes vary by machine):

```text
$ nclean ~/Projects

nclean
Clean up forgotten Node.js dependencies.

Found 14 Node.js projects
Found 9 node_modules directories

Select dependencies to remove
 ◯ ~/Projects/shelf        2.1 GB   47 days ago   pnpm
 ◉ ~/Projects/old-client   3.4 GB   94 days ago   npm
 ◯ ~/Projects/transfa      1.2 GB   12 days ago   bun

↑/↓ navigate · Space select · A select all · Enter continue · Esc cancel

You are about to delete:
  ~/Projects/old-client/node_modules
    3.4 GB · last active 94 days ago · npm

Your project files and lockfiles will NOT be deleted.

? Continue? (y/N)
```

Nothing is preselected. You choose the projects, review the exact directories, and confirm.

## Install

Requires **Node.js 22 or newer**.

Once published to npm:

```sh
npm install --global nclean
nclean --help
```

Run the local checkout today, without a global install:

```sh
npm install
npm run build
node dist/cli.js --help
npm run dev -- scan ~/Projects
```

To try the global command from this checkout:

```sh
npm link
nclean
```

## Usage

```sh
nclean                                    # Interactive selection
nclean ~/Projects                         # A specific directory
nclean ~/Projects ~/Code                  # Multiple directories
nclean scan ~/Projects                    # Report only; no deletion
nclean --dry-run ~/Projects                # Preview only; no prompts or deletion
nclean --older-than 30 ~/Projects          # At least 30 days inactive
nclean clean ~/Projects --older-than 30    # Review and confirm all matches
nclean clean ~/Projects --older-than 30 --yes # Explicit unattended cleanup
nclean clean ~/Projects --older-than 30 --yes --dry-run
nclean --help
```

Options work before or after the subcommand. `--older-than` accepts non-negative whole days, including `30`, `60`, and `90`.

With no paths, nclean scans existing `Projects`, `Code`, `Developer`, and `dev` directories under your home directory. If none exist, it asks you to provide a path. It never defaults to your whole home directory or filesystem. Overlapping roots are deduplicated.

The default selection includes all ages. Use `--older-than` to narrow it down. Without a terminal, `nclean` prints a report and exits without deleting; `clean` requires either a terminal confirmation or explicit `--yes`. `--yes` is available only on `clean`. Confirmation defaults to **No**. Ctrl+C cancels prompts; Esc cancels selection.

## What counts as inactive?

A project has a regular `package.json` file. Its approximate last activity is the **newest** of:

- Its latest Git commit affecting the project, if Git is available.
- Modification times of `package.json` and lockfiles.
- Modification times of relevant source and configuration files, including JS, TS, Vue, Svelte, Astro, stylesheets, Markdown, JSON, YAML, and Prisma files.

nclean excludes dependencies, Git internals, and common generated directories such as `dist`, `build`, `.next`, and `coverage`. It also excludes nested projects from their parent's filesystem activity; each nested project is measured separately. Git history may conservatively keep a parent monorepo active.

This is an estimate, not a record of when you last opened your editor. A fresh clone or checkout may look active because its files have new timestamps. Reading files alone does not count as activity. `node_modules` timestamps never decide inactivity. If activity cannot be read reliably, nclean marks it **unknown** and excludes it from cleanup.

## Why dependencies can be removed

Dependencies include thousands of package files, compiled artifacts, and sometimes platform binaries. Every project can keep its own copy.

For a typical project, the manifest and lockfile describe how to reinstall dependencies. Removing `node_modules` leaves those files and source code intact. Locally edited dependencies, unpublished packages, or manually placed files inside `node_modules` may not be recoverable by an install, so review your selection. Projects without a lockfile can still be cleaned, but reinstalling may resolve different versions.

## Package managers and restoration

| Lockfile | Restore from the project directory |
| --- | --- |
| `package-lock.json` / `npm-shrinkwrap.json` | `npm install` |
| `pnpm-lock.yaml` | `pnpm install` |
| `yarn.lock` | `yarn install` |
| `bun.lock` / `bun.lockb` | `bun install` |
| No lockfile | `npm install` |

If multiple lockfiles exist, detection prefers pnpm, yarn, bun, then npm. After cleanup, nclean groups removed projects by restore command. For workspaces, run the appropriate install command at the workspace root if required by your package manager.

## Safety and sizing

- Only discovered, real `project/node_modules` directories can be deleted.
- Project folders, manifests, lockfiles, source code, and `.git` are preserved.
- Scanning and sizing never follow symbolic links or Windows directory junctions. Symlinked roots and symlinked dependency directories are skipped or rejected.
- Root containment, parent directories, project manifest, and directory identity are checked again before removal.
- `--dry-run` and `scan` never delete anything, even with `--yes`.
- Unknown activity or failed sizing makes a directory ineligible. Errors are reported; other entries continue.
- Nested workspace projects appear separately. Dependencies inside an already discovered `node_modules` are counted once within that tree.
- Directory listings are streamed; at most four projects are measured concurrently. Git checks have a timeout.

Sizes use logical file bytes, skip symlinks, and count hard links once per dependency directory. The cleanup total is measured again immediately before each successful removal. **Physical free disk space may differ** because of allocation, compression, sparse files, shared hard links, and filesystem snapshots. This MVP does not claim an exact physical disk-space delta. Failed or partially completed removals are not included in the success total.

Avoid changing or installing dependencies while a cleanup is running. Path checks reduce accidental deletion, but portable Node filesystem APIs cannot make path validation and recursive removal atomic against concurrent directory replacement.

Permission errors or failed removals return exit code `1`. Partial scan warnings also return `1`; normal reports, empty results, dry runs, and declined confirmation return `0`.

## Development

```sh
npm install
npm run dev -- --dry-run ~/Projects
npm run build
npm test
npm run lint
```

`npm run lint` runs strict TypeScript checking. Tests use isolated temporary directories and cover discovery, lockfiles, Git and filesystem activity, thresholds, sizes, symlink safety, cleanup boundaries, and CLI dry runs. The build emits ESM and type declarations into `dist/`.

The source is grouped into commands, scanning, cleanup, terminal UI, and small utilities. There is no configuration system or background service.

For a repeatable demo using fake projects only:

```sh
npm run demo:setup
# Copy the temporary directory printed by the script:
node dist/cli.js scan <printed-path>
node dist/cli.js <printed-path> --dry-run --older-than 30
node dist/cli.js <printed-path> --older-than 30
```

## Contributing

Small, focused improvements are welcome. Include a reproduction or temporary-directory test for bugs, keep deletion safety explicit, and run the build, tests, and type check before opening a pull request. Windows and Linux reports are especially useful. Cache cleaning and general system cleanup are outside this MVP's scope.

## Publishing

Before publishing, replace the `YOUR_USERNAME` repository placeholder in `package.json` with your actual repository and confirm npm name availability. This checkout has not been published.

```sh
npm run build
npm test
npm run lint
npm pack --dry-run
npm publish
```

Only compiled `dist/` files, this README, the MIT license, and npm package metadata ship. npm builds automatically before packing.

## License

MIT — see [LICENSE](LICENSE).
