# Working on FluidEQ

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
- **In dev, the renderer hot-reloads and the main process does not.** Main runs
  through `ts-node` on `dev-main.cjs` and is restarted by electronmon, which is
  told what to watch by the `electronmon.patterns` list in `package.json` —
  everything is excluded and then a few paths are added back. `src/common` is
  now one of them, and was not: the renderer picked up a change there instantly
  while main kept running the copy it loaded at startup, so the two processes
  disagreed about the same module. That fails _quietly and wrongly_ rather than
  loudly — a new voicing profile came back from `SET_VOICING` as an invalid
  parameter because main's copy of the profile list was minutes old, and the
  quick pick reverted with no message. If a change to `src/common` seems not to
  have taken effect, restart `pnpm dev` before believing anything else; the
  pattern list only takes effect when electronmon starts.
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
