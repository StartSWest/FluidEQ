# Working on FluidEQ

## Every request gets attempted, in the order it was asked

Ivan interrupts mid-task with new requests. None of them are cancellations of
what is already running, and none of them are optional.

- **Acknowledge immediately, in one line.** "Copied — finishing X first." He is
  not asking for a status report, he is checking the request landed. Silence
  reads as ignored.
- **Then finish the thing already in hand** before starting the new one, unless
  he says he wants it now — in which case the new one goes first and the
  interrupted one goes back on the list.
- **Keep the list.** Every outstanding request stays on it until it is done or
  he drops it. Do not silently reorder it, do not quietly narrow it, and never
  end a turn having done four of the six things without saying which two are
  still open and why.
- Ending on the easy half and calling it done is the failure this rule exists
  to prevent. It has happened repeatedly and it is what he asks for by name:
  _"attempt all my requests"_.

## The change first. Tests after he is happy with it

What he asked for goes in, and he gets to look at it. Only once he is
satisfied does the suite get run, read or added to.

- **Do not stop mid-request to chase a red suite.** A failing test while he is
  waiting to see a change is a detour, and he has said so while waiting:
  _"I am waiting for this no tests"_.
- Type-check and lint as you go — those are seconds, and they catch what would
  otherwise reach his window broken. Running the whole suite, reading its
  failures and writing new cases is the part that waits.
- When he says the change is right, run everything, fix what broke, and add
  the cases that would have caught it. Nothing gets committed with the suite
  unexamined — the rule is about the order, not about skipping it.

## Response format

- Yes/no question → the direct answer in the FIRST sentence.
- Simple fix → 1–3 sentences. Complex task → short bullets.
- Never re-explain what Ivan just said, never enumerate options when one is
  clearly best — recommend it in one sentence.
- Final line of every response is a verdict, nothing after it:
  - `Status: DONE`
  - `Status: IN PROGRESS — <what remains>`
  - `Status: BLOCKED — <what is needed>`

## UI work — the rules the tests cannot enforce

Every UI defect that shipped this project passed the whole test suite: an
unsized SVG that filled the tab, buttons with no class, a panel buried in a
closed popover, three waveforms crushed into a 27px strip, the loud style on
the decline button. Tests query by role; they cannot see size, colour,
placement or taste. Therefore:

- **Verify visually before claiming done.** In dev the app exposes DevTools on
  `127.0.0.1:9222`; probe the DOM, computed styles and canvas pixels of the
  running window. "Compiles and tests pass" is not a UI verdict.
- **Reuse the app's existing classes; never invent a style.** `button small` is
  the filled accent, `button small subtle` the quiet outline — measured, not
  assumed: when a style misbehaves, read `getComputedStyle` in the live window
  instead of reasoning about the cascade.
- **Results and controls live on the surface where the work happens.** A stems
  panel inside a closed popover, a fader hidden behind a menu — each read as
  "the feature did nothing". If it is the product of a long-running action, it
  must be visible when the action completes.
- **Any long-running action shows progress from its first second**, is
  cancellable, and can be sent to the background; a click that visibly does
  nothing is a bug regardless of what runs underneath.
- **Emphasis follows recommendation**: the suggested action wears the loud
  style, the decline wears the quiet one.

## Verification discipline

- A null test needs a positive control beside it, or "found nothing" is
  indistinguishable from "removed everything". The separation packing bug
  passed a perfect-looking null test by returning zero for every input.
- When a runtime fails opaquely and a proven alternative exists, switch —
  three instrumented attempts on onnxruntime-web lost to onnxruntime-node,
  which a bench had already validated on this machine.
- Model/weight licences are verified at the author's own repository, never a
  mirror's tag. Undocumented is not permissive; this app is sold.

## Coding standards (the generic core)

- Strict TS: no `any` (use `unknown` + guards), no `!` non-null, no
  `@ts-ignore`, no `==`, no `var`, no empty `catch`, no dead code, no
  `console.log` left in source (the one exception: context-rich
  `console.error` before an error is flattened for the user).
- No `eslint-disable` without an inline justification.
- Files stay under 500 lines unless there is genuinely no seam.
- Comments state what the code cannot: constraints, measured numbers, the
  failure the code prevents — never what the next line does.
- Reusable, but never flag-driven: a component that needs mode flags to behave
  two ways is two components.
- Every user-facing string goes through i18n, all ten locales in the same
  commit.

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
- **Scripted edits through `node -e` inside Bash mangle `$` too** — template
  literals in generated code (`` `${x}` ``) come out as empty holes and the
  file is silently corrupted mid-expression. Same rule as below: anything
  containing `$`, a backslash or a template literal goes through the Write and
  Edit tools, never through a shell-quoted script.
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
