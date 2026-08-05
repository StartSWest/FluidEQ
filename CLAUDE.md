# Working on FluidEQ

## Cutting a release

When I say **"create a release"** (or build/ship/publish one), do all of the
following without asking me to confirm the steps. Ask only if something is
genuinely ambiguous, like which version number to pick when it is not obvious.

### 1. Pick the version

Read the current one from `release/app/package.json`. Bump by what actually
changed since the last tag — `git log v<last>..HEAD --format=%s` is the input,
not a guess. New features are a minor bump, fixes alone are a patch.

Set the **same** version in both `package.json` and `release/app/package.json`.
electron-builder reads the second one; the first is what everything else reads,
and they must not disagree.

### 2. Write the release notes

They go in `CHANGELOG.md`, newest first, as a new `## <version>` section above
the previous one.

**That file IS the release note.** The app renders it in _What's new_, and the
GitHub release body is extracted from it, so there is exactly one place to
write and nothing to keep in sync.

Write it for somebody deciding whether to update, not as a list of commits.
Group under `### New`, `### Changed`, `### Fixed`, `### Faster` — skip any
heading with nothing under it. Say what changed and why it matters; a
performance entry should carry the actual number.

### 3. Verify before tagging

All of these, and do not tag if any fails:

```bash
pnpm typecheck && pnpm typecheck:e2e && pnpm test && pnpm exec prettier --check "src/**/*.{ts,tsx,scss}"
```

### 4. Commit, tag, push

```bash
git commit -am "Release <version>"
git tag -a v<version> -m "FluidEQ <version>"
git push origin main && git push origin v<version>
```

### 5. Build the installer

```bash
pnpm package
```

Run it in the background and redirect the output to a log — it takes minutes
and is far too noisy to read inline. Check the exit code and grep the log for
errors; do not paste the log.

Produces, in `release/build/`:

- `FluidEQ-Setup-<version>.exe`
- `FluidEQ-Setup-<version>.exe.blockmap`
- `latest.yml`

### 6. Publish to GitHub

```bash
gh release create v<version> --title "FluidEQ <version>" \
  --notes-file <extracted notes> \
  release/build/FluidEQ-Setup-<version>.exe \
  release/build/FluidEQ-Setup-<version>.exe.blockmap \
  release/build/latest.yml \
  vendor/equalizer-apo/EqualizerAPO-src-<apo version>.zip
```

Extract the notes from the changelog rather than retyping them:

```bash
awk '/^## <version>$/{f=1;next} /^## /{f=0} f' CHANGELOG.md | sed '/^---$/d'
```

**All four assets, every time.** The installer alone is not a release:

- `latest.yml` is what the in-app updater fetches to notice a new version
  exists, and the blockmap is what lets it download only the changed chunks
  instead of the whole hundred megabytes. Leave them out and existing users are
  never offered the update at all.
- `EqualizerAPO-src-<apo version>.zip` is a **licence obligation, not a
  courtesy.** Our installer bundles and runs Equalizer APO's installer, which
  makes us a distributor of a GPL binary, and a distributor must convey the
  corresponding source. GPLv3 §6(d) allows the source to sit beside the object
  code at the same place it is offered from — this release page — so the
  archive goes here. A link to SourceForge does not satisfy it. Fetch the one
  matching the pinned version:

  ```bash
  pnpm fetch-apo:source
  ```

  If `.erb/scripts/fetch-equalizer-apo.ts` ever pins a new APO version, the
  source archive published with the next release must move with it.

Afterwards, confirm with `gh release view v<version> --json assets` that all
four uploaded.

## Never read the built binaries

Do not `Read` any `.exe`, `.dll`, `.asar`, or anything else in
`release/build/`. They are a hundred megabytes of binary and reading one burns
an enormous amount of context for nothing.

Everything worth knowing about them is available through commands:

- size and timestamp — `ls -la`
- product name, version, company — `(Get-Item <path>).VersionInfo` in
  PowerShell
- whether the build worked — the exit code and the log

## Things that will bite you

- **Do not run the app yourself.** I run it. Tell me when something needs a
  real launch to confirm, and say plainly what has and has not been verified —
  passing tests are not the same as a working window.
- **The dev binary's name is stamped by `.erb/scripts/name-dev-electron.ts`.**
  It edits the version resource of `node_modules/electron/dist/electron.exe`
  and must never rename the file: Electron decides `app.isPackaged` from the
  basename, so a renamed binary puts development into packaged mode and the
  window stops opening.
- **Shell mangles `$` in scripted edits.** Writing Sass through `node -e` with
  `$primary-lighter` in the string silently corrupts it, and a search string
  that no longer matches fails quietly rather than loudly. Use the editing
  tools for stylesheets.
- **`pnpm add` needs `-w`** at the workspace root.
