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
- **Shell mangles `$` _and_ `\` in scripted edits.** Writing Sass through
  `node -e` with `$primary-lighter` in the string silently corrupts it, and so
  does a Windows path — `resources\equalizer-apo` came out as
  `resourcesequalizer-apo`, and a `\r` inside a search string stopped it
  matching. Both fail _quietly_: the replace simply does not happen. Use the
  editing tools for anything containing `$` or a backslash, which means every
  stylesheet and every `.nsh`.
- **`pnpm add` needs `-w`** at the workspace root.
- **Jest will not start without a build.** `setupFiles` runs
  `check-build-exists.ts`, which throws unless `dist` holds both bundles. Tests
  pass locally only because a build is always lying around, so any new CI job
  must run `pnpm build` before `pnpm test` — this is what the first weekly
  build failed on.
- **Do not stream a download through `pipeline`.** `fetch` + `pipeline` crashes
  inside Node's HTTP parser on `assert(!this.paused)` when the disk is slower
  than the socket. Every byte arrives first, so the file is complete and the
  process dies afterwards, which looks exactly like a flaky mirror and is not.
  `await response.arrayBuffer()` and write it; nothing fetched here is big
  enough for streaming to be worth the trouble.
- **Everything in `vendor/equalizer-apo` ships unless filtered.** The
  `extraResources` entry names its files explicitly for a reason: the APO
  source archive lives in that directory and rode along once, adding 38MB to
  every user's installer. It belongs in the release, not in the app.

## Equalizer APO is bundled

`pnpm package` runs `pnpm fetch-apo` first, which downloads the pinned
installer into `vendor/` (gitignored) and verifies its SHA-256. A checksum
mismatch is fatal on purpose — an installer we cannot identify is not one to
run on somebody's machine. Bumping the version in
`.erb/scripts/fetch-equalizer-apo.ts` means the hash and the byte count move
with it, and so does the source archive published with the next release.

`assets/nsis/installer.nsh` holds the two macros electron-builder inserts:

- `customInstall` runs **after** the app files are extracted, so
  `$INSTDIR\resources\equalizer-apo\` already exists by then.
- `customUnInstall` runs **before** anything is deleted, and must stay wrapped
  in `${IfNot} ${isUpdated}` — an update runs the old uninstaller first, and
  asking whether to tear out the audio engine mid-update is both alarming and
  wrong.

APO's installer is run visibly and unmodified. Do not add silent flags: it
attaches to individual audio endpoints and its Device Selector is where the
user says which, so a silent install attaches to nothing and the equaliser
looks broken.

## The weekly cold build

`.github/workflows/weekly-build.yml` builds the whole thing from an empty
checkout every Monday, and on demand via `gh workflow run weekly-build.yml`.
It publishes nothing — `--publish never` is in the `package` script itself, and
there is no upload step or token.

It exists because the way this project most likely dies is not a decision to
stop: it is a year of dependency churn, then a clean checkout that no longer
builds, at which point no one can pick it up. AQUA stopped with a full roadmap
and an open invitation to help; what it lacked was anything watching the tree.

The cache is off deliberately. A warm cache answers "does this build for
someone who already built it", which is not the question. If the job fails, fix
the tree — do not fix the job by making it easier.
