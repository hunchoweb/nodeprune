<div align="center">

# nclean

**Node modules cleanup, without the drama.**

Find forgotten dependencies. Reclaim their space. Keep your projects.

[Quick start](#quick-start) · [Commands](#commands) · [Safety](#safety) · [Development](#development)

</div>

```text
                       __
    ____     _____    / /      ____     ____     ____
   / __ \   / ___/   / /      / __ \   / __ |   / __ \
  / / / /  / /__    / /__    / ____/  / /_/ /  / / / /
  /_/ /_/  \____/   \___/    \___/    \__,_/   /_/ /_/
```

Old side projects, finished client work, abandoned experiments: each can leave thousands of dependency files behind. **nclean finds `node_modules`, shows what they cost, and lets you choose what to remove.** Your source, manifests, lockfiles, and Git history stay in place.

Built with TypeScript for Node.js 22+ · macOS / Linux / Windows · MIT

## Quick start

Install with npm (Node.js 22 or newer):

```sh
npm install --global nclean
```

Then go to a project or the directory that holds your projects:

```sh
cd ~/Code
nclean
```

**No path required.** nclean scans the directory you ran it from, including nested projects. A path overrides that default:

```sh
nclean ~/Projects
nclean ~/Code ~/Work
```

Update to the latest release:

```sh
npm install --global nclean
```

The first npm release is being prepared; these registry commands become available once it is published. To try the source checkout now, follow [Development](#development).

## The experience

1. Discover projects in the current directory.
2. Measure dependencies with a live progress bar.
3. Select folders in a bordered, keyboard-driven list.
4. Review the selection and confirm with **Yes**.
5. See the measured space reclaimed and commands to restore dependencies.

Illustrative terminal excerpt; counts and sizes depend on your projects:

```text
$ nclean --older-than 30

  Scanning ~/Code...

  █████████████████████░░░░░░░░░░░  66%

  4/6 dependency folders measured

  7 projects scanned
  6 dependency folders found
  4 inactive projects

  4.0 MB reclaimable

  Select dependencies to remove

  ┌───────────────────────────────────────────────────────────────┐
  │     Project                      Size   Inactive   PM         │
  ├───────────────────────────────────────────────────────────────┤
  │ › ● monorepo/apps/web          1.0 MB        70d   npm        │
  │   ● shelf                      1.0 MB        47d   pnpm       │
  │   ○ old-client                 1.0 MB        3mo   npm        │
  │   ○ design-system              1.0 MB        60d   yarn       │
  └───────────────────────────────────────────────────────────────┘

  2 selected · 2.0 MB

  [space] select     [a] all     [enter] clean     [esc] cancel
```

Use ↑/↓ to navigate. **Nothing is preselected.** Enter opens the final review; it does not immediately delete your selection. Confirmation defaults to **No**. Choose `y`, then press Enter to approve, or press Esc to cancel.

During discovery, the bar moves without a percentage because the total is still unknown. Once discovery finishes, the percentage reflects completed dependency-folder measurements. Narrow terminals shorten paths and hide secondary columns.

## Commands

```sh
nclean                              # Select dependencies in the current directory
nclean scan                         # Report sizes and activity; never delete
nclean --dry-run                    # Preview eligible folders without prompts
nclean --older-than 30              # Show projects inactive for at least 30 days
nclean clean --older-than 30        # Review and confirm cleanup of all matches
nclean clean --older-than 30 --yes  # Explicitly authorize unattended cleanup
nclean --verbose                    # Include detailed scan warnings
nclean --help                       # Show usage and examples
nclean --version                    # Show the installed version
```

Every scan or cleanup command accepts optional paths:

```sh
nclean scan ~/Projects
nclean ~/Code ~/Work --older-than 60
nclean clean ./archive --older-than 90 --dry-run
nclean clean ./archive --older-than 90 --yes
```

| Option | Behavior |
| --- | --- |
| `--older-than <days>` | Include projects inactive for at least that many whole days. |
| `--dry-run` | Preview only. No deletion, even with `--yes`. |
| `--verbose` | Show full scan diagnostics and unreadable paths. |
| `-y, --yes` | Skip confirmation on the explicit `clean` command only. |

Options work before or after a subcommand. With no age filter, all known ages are eligible. In a noninteractive shell, the default command prints a report and deletes nothing; `clean` requires explicit `--yes` or a terminal confirmation.

### Choose your scan scope

The current working directory is the scan root. Run `nclean` inside one project to inspect that project and its workspaces; run it from `~/Code` to inspect projects beneath that directory. Running it from your home directory scans your home directory.

Explicit paths can be absolute, relative, or home-relative (`~`). Overlapping roots are deduplicated. Filesystem roots and paths inside `node_modules` are rejected. Symlinked scan roots are rejected.

### Partial scans

Protected or unreadable folders are skipped, with a compact notice:

```text
  Partial scan · 12 folders skipped (12 access denied).
  Use --verbose for details. Accessible projects are still shown.
```

Use `nclean scan --verbose` for the detailed paths. A partial scan does not claim your whole directory is clean. Unknown activity or unreadable size excludes a dependency folder from cleanup.

## How inactivity works

A project contains a regular `package.json`. nclean estimates its last activity using the **newest** of:

- The latest Git commit affecting the project, when Git is available.
- Manifest and lockfile modification times.
- Relevant source and configuration modification times, including JS, TS, Vue, Svelte, Astro, styles, Markdown, JSON, YAML, and Prisma files.

Dependency timestamps do not determine inactivity. Generated directories such as `dist`, `build`, `.next`, and `coverage`, along with `.git` internals, are excluded. Nested workspace projects are inspected separately; a parent's Git history can conservatively keep that parent active.

This is an estimate. A fresh checkout may look active, while simply opening or reading a project does not update its activity. When activity cannot be read reliably, nclean marks it **unknown** and skips cleanup.

## Restore dependencies

Run the detected package manager's install command in the project directory. nclean groups the restore instructions after cleanup.

| Lockfile | Restore command |
| --- | --- |
| `package-lock.json` / `npm-shrinkwrap.json` | `npm install` |
| `pnpm-lock.yaml` | `pnpm install` |
| `yarn.lock` | `yarn install` |
| `bun.lock` / `bun.lockb` | `bun install` |
| No lockfile | `npm install` |

For a workspace, install at the workspace root when your package manager requires it. If multiple lockfiles exist, detection prefers pnpm, yarn, bun, then npm.

## Safety

**Cleanup removes only discovered, real `project/node_modules` directories.** Project folders, source, manifests, lockfiles, and `.git` are preserved.

- Interactive cleanup always requires final confirmation, defaulting to No.
- `scan` and `--dry-run` never delete anything.
- Scanning and sizing never follow symlinks or Windows directory junctions.
- Root containment, parent directories, manifest, and directory identity are checked again before deletion.
- Unreadable or unknown entries are excluded. Removal failures are reported while other selected entries continue.
- Dependencies inside an already discovered `node_modules` are counted within that tree rather than reported again.

A normal project can reinstall dependencies from its manifest and lockfile. **Local edits or manually placed files inside `node_modules` may not be recoverable.** Without a lockfile, reinstalling may resolve different versions.

Sizes are logical file bytes. Symlinks are skipped and hard links count once per dependency directory. Successful removals are measured again before deletion; failed or partial removals do not contribute to the success total. Physical free space can differ because of shared hard links, compression, allocation, sparse files, and snapshots.

Avoid installing dependencies or replacing directories during cleanup. Portable Node APIs cannot make path checks and recursive removal atomic against concurrent directory replacement.

Exit code `1` indicates scan warnings, invalid input, or cleanup failures. Normal reports, empty results, dry runs, and declined confirmation return `0`.

## Development

```sh
npm install
npm run dev -- --dry-run
npm run build
npm link
npm test
npm run lint
```

The source is strict TypeScript and ESM. Directory listings are streamed; up to four projects are measured concurrently. Git checks have a timeout. `lint` performs TypeScript checking; tests use isolated temporary directories to exercise discovery, activity, sizing, paths, symlinks, cleanup, prompts, progress, and diagnostics.

### Record a demo

```sh
npm run build
npm run demo:setup
```

The script creates fake projects in a fresh temporary directory, with npm, pnpm, yarn, bun, a nested project, and different activity ages. Each fake dependency folder contains 1 MB. Copy the printed directory, then:

```sh
cd <printed-directory>
nclean --older-than 30
```

If you have not run `npm link`, use the absolute path to `dist/cli.js`. Run `npm run demo:setup` again for a fresh fixture after cleanup.

### Contribute

Keep changes focused on Node.js dependency cleanup. For bugs, include a reproduction or temporary-directory test. Run the build, tests, and type check before opening a pull request. Cross-platform testing reports are welcome.

### Publish

Maintainers publish a public package to the npm registry. Before the first release, confirm the package name is available and sign in with the npm account that will own it:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami
npm view nclean name version
npm pack --dry-run
npm publish --access public
```

An `E404` from the name lookup means no public package was found; npm decides whether the name can be claimed when publishing. Publishing runs the tests and type check, and packing builds automatically. Complete npm's authentication and two-factor prompts when requested.

The package includes compiled `dist/` files, the README, the MIT license, and package metadata. Runtime dependencies are installed by npm; users do not need TypeScript or a repository checkout. Test the packed tarball in an isolated install before releasing. For subsequent releases, bump the package version and CLI version together; npm does not allow reusing a published version.

## License

[MIT](LICENSE) © nclean contributors
