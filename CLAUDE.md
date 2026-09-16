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

## Go all the way. Come back when it is done, or when you are stuck

Ivan does not want progress reports. He wants the work finished. Coming back
mid-task with a fragment — one file changed, a cause named, a question that has
an obvious answer — is what he calls _de buchito en buchito_, and it is the
thing he asks for by name to stop.

- **Interrupt him for exactly one reason: you cannot advance.** A real block —
  a decision only he can make, a credential, something that needs his ears or
  his window. Not "here is what I found so far", not "shall I continue", not a
  summary of half the work.
- **Everything else, keep going.** Found the cause? Fix it. Fix needs four
  files? Change four files. Type-check fails? Fix it. Suite red? Fix it. Then
  come back, once, with the whole thing done.
- **A question you can answer yourself is not a question.** Pick the sensible
  option, say which one you picked in the final answer, and move on.
- The failure this prevents: a turn that ends with the diagnosis written up
  and nothing repaired. He has to read it, say "yes obviously", and wait
  again — twice the time for the same result.

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

**Ivan does not read the code.** He is not looking at the diff, the files or
the symbols, so a report written in those terms tells him nothing and costs him
a round trip to ask what it meant. Write every answer for somebody who will
only ever see the running app.

- **Say what changed in terms of what he can see, hear or do** — "the loudness
  readout showed a plus in front of a minus number", not the identifier of the
  string that did it. No file paths, no function names, no flags, no protocol
  or wire detail, no class names. If a name has to appear at all, it is because
  he has to type it.
- **Do not narrate the reasoning.** He wants the result and anything he has to
  act on. The measurements, the mechanism and the trade-offs belong in the
  commit message and the code comments, where they are already required — not
  in his terminal.
- **Decide the small things.** A choice he has no stake in is not a question:
  pick it, say which in one line, and move on. Bring him a decision only when
  it is genuinely his — money, a release, something destructive, or something
  only his ears can settle.
- Yes/no question → the direct answer in the FIRST sentence.
- Simple fix → 1–3 sentences. Complex task → short bullets.
- Never re-explain what Ivan just said, never enumerate options when one is
  clearly best — recommend it in one sentence.
- Final line of every response is a verdict, nothing after it:
  - `Status: DONE` — **only when nothing at all is outstanding.** Not one
    request left on the list, nothing owed, nothing waiting on Ivan, no test
    unwritten, no check unrun, no "pending your launch". If a single item is
    still open, this is the wrong verdict.
  - `Status: IN PROGRESS — Pending work: <what remains>` — required work is
    still open and the agent can advance it. Keep working while it can.
  - `Status: BLOCKED — Pending work: <items>; Needed: <input or external change>`
    — the agent cannot advance without it.

- **Never use `TASK DONE`, or combine a completion verdict with pending
  work.** Completing a review, diagnosis, implementation step, or individual
  request does not complete the whole outstanding request list. A review alone
  can be done when that is all Ivan requested; it does not complete a requested
  fix. Required implementation, regression coverage, verification, commit and
  push remain part of a change request until completed or explicitly removed
  from scope by Ivan. Required visual or listening verification also counts;
  waiting for his window, ears or approval means blocked, not done.
- **Do not invent an approval step.** A request to fix or change something
  authorizes the ordinary implementation and relevant verification. A request
  only to review or explain remains read-only. Ask only for a genuinely missing
  decision, access, or action that is not already authorized.

- **Whenever anything is outstanding, say what, on the verdict line.**
  `Pending work:` then the actual items — every request still on the list,
  every check not yet run, every thing needing Ivan's window, his ears or his
  decision. Name them; "some follow-up remains" is not a list.

  The failure this exists to stop is a turn that reads as finished while work
  is still open. `Status: DONE — pending your launch` is the exact shape of
  it: the verdict says done, the clause after it says otherwise, and the open
  item is one dash away from invisible. It is also how four of six requests
  get reported as six.

## UI work — the rules the tests cannot enforce

Every UI defect that shipped this project passed the whole test suite: an
unsized SVG that filled the tab, buttons with no class, a panel buried in a
closed popover, three waveforms crushed into a 27px strip, the loud style on
the decline button. Tests query by role; they cannot see size, colour,
placement or taste. Therefore:

- **Verify visually before claiming done.** In dev the app exposes DevTools on
  `127.0.0.1:9222`; probe the DOM, computed styles and canvas pixels of the
  running window. "Compiles and tests pass" is not a UI verdict.
- **Every UI change gets reviewed on screen, however small.** A fifth pill
  added to a row of four overflowed the look editor and squeezed the other
  four into unreadable stubs; one line of markup, and nothing in the suite
  could see it. Before claiming any UI change done — a new control, a new
  option in a list, a label, a spacing tweak — look at it in the running
  window at the normal size AND at the extremes it can reach (fullscreen,
  the narrowest panel, the longest translation), and confirm it wraps or
  scrolls rather than clipping, keeps the design's spacing and emphasis, and
  breaks nothing around it. If it cannot be looked at, say so; do not report
  it done.
- **Impressive, never basic.** The first version of a visualizer, a scene
  or a control is never the one to show: a row of rhombi, a straight cable,
  a grey wedge for a headlight beam, a hairline for a firework tail — every
  one of those shipped to the window and every one was sent back as "sucks".
  Before showing anything visual, look at it as the harshest critic in the
  room would: does it read as the real thing (a bridge with foundations,
  cables that drape, a road with markings and a dashed centre line), does it
  move with the music in more than one way (level, beat, bass and treble
  separately), does it keep its shape at every size and in the mirror, does
  it have depth and light. If the honest answer to any of these is no, it is
  not ready — fix it before the screenshot, not after the complaint.
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

## Typography

FluidEQ ships on Windows, macOS and Ubuntu and uses each one's system font, so
the same CSS renders in three different families with three different sets of
cuts. All of these were earned the expensive way.

- **Never name a font family that is not shipped.** `Inter` sat at the front of
  the stack for the life of this project without ever being bundled. The list
  resolved to Segoe UI anyway, so every size, padding and letter-spacing in the
  app was tuned against a font that was never on screen — and nobody noticed,
  because the failure is silent by construction.
- **No raw `font-weight` numbers. Use the `$weight-*` scale in `_theme.scss`.**
  The app had grown eighteen distinct literals — 650, 680, 720, 730, 750, 760,
  780, 820, 840, 850, 880, 950 among them — which measured as exactly four
  faces in the running window. `check-styles.ts` now rejects a raw value; it
  has to keep letting `font-weight: 100 900` through, which is a variable axis
  range in `@font-face` and not a weight.
- **`$weight-bold` is the ceiling at UI sizes, on every platform.** Segoe UI has
  no cut between Bold and Black, so 800 and 900 both land on `Segoe UI Black` —
  a poster face whose counters close up below roughly 20px. That is what the
  titlebar tabs looked like when this was reported as the fonts being
  _apastadas_, and 74 other declarations at 8-16px had the same bug unnoticed.
  macOS could render more steps; taking them would make the same panel heavier
  on one machine than another for no reason a user could name.
- **`$weight-display` is 900 and belongs above ~20px only** — karaoke lyric and
  score text. There is deliberately no 800 token.
- **A stack names one native family per platform**, in resolution order:
  `-apple-system` for macOS, `Segoe UI` for Windows, then `Ubuntu`, `Cantarell`,
  `Noto Sans`, `DejaVu Sans` for Linux. Without the Linux names the stack ran
  out and fell to generic `sans-serif`, which fontconfig answers with DejaVu
  Sans. `ui-sans-serif` is deliberately absent: Chromium does not resolve it on
  Windows, and on Linux it answers from fontconfig ahead of the named families,
  which is the opposite of choosing them.
- **Monospace goes through `$font-mono`,** and `ui-monospace` is never the last
  real name in it: alone on Windows it falls through to Times New Roman, a
  proportional serif, in the one place where fixed width is the whole point.
  Three separate stacks had drifted apart here and painted the same kind of
  evidence text in two different faces.
- **Do not bundle a webfont for UI text.** Inter and Cascadia Mono were both
  bundled and both taken back out. Windows leans on TrueType hinting at the
  9-15px this UI lives at and the system fonts are hinted for exactly that; an
  unhinted variable woff2 has nothing to compete with, and it was visibly softer
  on screen — worst on bold text, where there is more stem area to blur. A
  bundled display face for headings alone is still open; UI text is settled.
- **Any font swap must keep `font-variant-numeric: tabular-nums` on the shell.**
  Segoe UI carries no proportional figures at all, so every readout in this app
  has been tabular by accident of the fallback. A font with proportional digits
  — Inter spreads "111" against "000" by 30px at 40px — makes a gain counting
  1.1 → 8.8 shove its neighbours every frame while a band is dragged. No test
  can see it.

Two ways of checking that are worth the keystrokes, because both caught things
reasoning did not:

- **`CSS.getPlatformFontsForNode` over the CDP socket says which real file
  painted a node**, including `isCustomFont`. Computed style only says what was
  asked for. That is what proved the tabs were being drawn in Segoe UI Black
  while every control beside them was Segoe UI.
- **Measure DOM text, never canvas text.** Chromium rasterises them on
  different paths. A canvas-based sharpness comparison reported Inter as level
  with Segoe UI at 400 and 600; on screen it plainly was not, and the wrong
  conclusion survived until Ivan looked at the window.

## Verification discipline

- A null test needs a positive control beside it, or "found nothing" is
  indistinguishable from "removed everything". The separation packing bug
  passed a perfect-looking null test by returning zero for every input.
- When a runtime fails opaquely and a proven alternative exists, switch —
  three instrumented attempts on onnxruntime-web lost to onnxruntime-node,
  which a bench had already validated on this machine.
- Model/weight licences are verified at the author's own repository, never a
  mirror's tag. Undocumented is not permissive; this app is sold.

## Fix the cause. Never the symptom, and never with a timer

A fix that makes the symptom go away without naming what caused it is not a
fix — it is the bug, rescheduled. Ivan calls these crappy solutions and he is
right: every one of them costs a second debugging session on the same defect,
later, with less context.

- **NO `setTimeout`. NO `setInterval`. NO EXCEPTIONS.** Not to "let state
  settle", not to retry until something is ready, not to defer work until
  after a render, not as a deadline, not as a fallback, not "just this once
  because the event might not come". If you are about to write a duration in
  milliseconds to decide _when_ something happens, stop: you are guessing at
  another machine's speed and you will guess wrong on the machine that needed
  you to be right. Wait on the event, the promise, or the state that actually
  says the thing is ready. If no such signal exists, that is the bug — find it
  or add it.

  This rule used to carry an exception for "a real deadline", and the
  exception is what produced timers. It is gone. Do not reintroduce it, do not
  argue the case in a comment, and do not smuggle one in as a "watchdog". An
  `AbortSignal`, an event listener, a promise, or `requestAnimationFrame` tied
  to something being painted are how waiting is spelled here.

  `src/renderer/library` and `src/common/library` contain none, and the queue
  bug reported as "a timer going crazy" turned out to be `shuffle()` putting
  the playhead at a random index. That is the pattern: what looks timed is
  almost always something recomputing itself.

- **Read the function that is wrong before patching the one that calls it.**
  The same queue bug got a real but secondary fix in `retargetQueue` first —
  it did re-shuffle on every track change and that needed fixing — while the
  actual cause sat in `shuffle()`, four lines that contradicted the doc
  comment directly above them. When a function's comment and its body
  disagree, the body is the bug; do not work around it from outside.
- **A fix you cannot explain is not finished.** State the cause in one
  sentence — "the playhead landed at a random index because the whole run was
  shuffled and then searched" — and put it in the code as a comment. If that
  sentence cannot be written, the cause has not been found yet.
- **Do not narrow a request to the part that is easy to fix.** Reporting the
  symptom gone while the cause is untouched is the same failure as ending a
  turn on four of six requests.

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
- **The engine DLL has to live outside the user profile.** `audiodg.exe` runs
  as LOCAL SERVICE, which has no read access anywhere under a user's own
  profile. A DLL installed to `%ProgramFiles%\FluidEQ Engine` is where LOCAL
  SERVICE can actually open it; anywhere under `C:\Users\...` and the effect
  attaches cleanly, reports success, and never makes a sound — silently,
  because loading a DLL the process cannot read fails the same way as no
  effect being registered at all.
- **An `FxProperties` edit needs both `Audiosrv` and `AudioEndpointBuilder`
  restarted before it takes effect.** Windows reads an endpoint's effect list
  once and holds it, so a registry write with nothing after it changes what is
  on disk and not what is playing. The helper's `--restart-audio` restarts
  both services and waits on `NotifyServiceStatusChange`'s own signal that
  each one actually stopped — never a `Sleep` guessing how long that takes,
  which is the timer this project forbids everywhere else too.
- **Never write pids 5, 6 or 7 — only the composite lists, pids 13, 14, 15.**
  5/6/7 are the single-effect `FxProperties` values, and Windows only reads
  them when the composite lists are absent. Writing one directly replaces
  whatever a vendor already registered there instead of adding to it, and the
  vendor's own control panel then reads its registration as gone — silently,
  on somebody else's driver.
- **Quitting FluidEQ turns the engine off; launching turns it back on.** Both
  engines live inside Windows' audio service and keep applying what they last
  read, so an EQ used to outlive the app. `engineQuitReset.ts` now writes the
  "nothing to do" root and deletes the DSP rack on `before-quit`, and on the
  window's `session-end` (Windows sends no `before-quit` at shutdown), after
  sealing the directory in `asyncWriter` so a late write cannot bring the EQ
  back. Two things depend on it: every engine-config write must go through
  `asyncWriter`, or the seal cannot refuse it; and the launch must write the
  state back — the health check's flush does the EQ, and `App.tsx` republishes
  the rack, which the DSP page alone would only send once it was opened. The
  uninstaller does the same to both engines' roots (`NeutraliseEngineConfigs`).
  End task, a crash or a power cut run none of that, so the FluidEQ Engine
  also refuses to apply anything unless FluidEQ is alive: the app serves
  `\\.\pipe\FluidEQ-Engine-Owner` from startup (`engineOwnerPipe.ts`, awaited
  before the window exists) and the DLL holds one connection to it per
  process (`owner_link.h`); the pipe breaking is the signal, no heartbeat.
  The engine only looks for the pipe again when its config folder changes,
  which is why the app writes `fluideq-owner.txt` there once it is serving.
  Every DLL test serves that pipe (`OwnerPipe` in `dll_test_support.h`) — a
  new one that expects processing without it will only ever see pass-through.
- **The DLL waits on `FindFirstChangeNotification`, not a poll.** It is told a
  config changed, never guesses when to check again. That also means a change
  to how `deviceProfiles.ts` lays the config text out is a change to what the
  DLL parses on the other end of that notification: extend
  `native/system-apo/tests/config_test.cpp` in the same commit.
- **`fluideq-dsp.txt` is the chain wire between the app and the engine.**
  `native/system-apo/tests/dsp_chain_test.cpp` freezes a reference line
  produced by the real encoder (`encodeChainSettings`) rather than a
  hand-written one, because a layout the two sides disagree about does not
  fail loudly — it decodes a Q as a threshold and still sounds like music.
  Bumping `FEQ_CHAIN_PARAM_LEAD` moves every index after it, so regenerate
  that reference line in the same commit or the test compares one stale
  layout against another and proves nothing.
- **Live leveling in the engine knows which song is playing, and outlives
  its chain.** Windows re-locks an output's effect every time a stream starts,
  stops or changes format — eight times in thirteen minutes of ordinary
  listening — and each lock builds a new chain, so a leveler that lived in its
  chain went back to unity mid-song. The learned state now lives in a
  per-output `FeqLevelingMemory` (`leveling_memory.h`, kept for the life of
  audiodg by `leveling_board.h`) that every chain adopts and publishes to, on
  blocks that carry sound only — an idle stream on the same output publishing
  its copy would overwrite what the playing one learned. The app names the song
  in `fluideq-programme.txt` (`songProgramme.ts`: a hash of player, title and
  artist, never the title), outside the chain signature so a new song never
  rebuilds the rack; the engine reports each finished song as `lastSong` in its
  status, and `songLevels.ts` remembers it so the next play is levelled from
  its first second. Within a song the gain only goes down; the next song keeps
  it unless it is much quieter. The programme text is pinned on both sides
  (`leveling_board_test.cpp`, `songProgramme.test.ts`), like the status.
- **Under the FluidEQ Engine the rack runs in exactly one place.** The
  Library player's host while the Library plays, the engine the rest of the
  time, and nowhere while FluidEQ is switched off or the engine is off
  (`rackPlacement.ts`). Both used to run it, so every Library track went
  through the rack twice, and FluidEQ's switch left the rack playing on
  everything. The DSP store is the only sender of the engine's copy and
  switches it off at the root when it belongs elsewhere; anything else that
  sends a rack to the engine brings the doubling back.
- **`status-{GUID}.json` is the engine telling the app what it is doing.**
  The DLL writes one per output into its root (`status_file.h`) inside
  `LockForProcess` — before any audio passes — and again on every change and
  unlock; `src/main/engineHealth.ts` reads it. The text is pinned on both
  sides (`status_test.cpp`, `engineHealth.test.ts`): a field renamed on one
  side reads as "the engine is not running" on a machine where it is, so
  extend both in the same commit. The notice built on it
  (`EngineTroubleNotice`) calls the engine off only once the live capture
  has heard sound, and only from a read made after that sound — not running
  is the normal state of every output nothing is playing on. And only when
  the installed engine is one that writes statuses at all: the binary
  version in `engine.rc` (1.1 and up; everything before was 1.0.0.0) is what
  the setup helper reports as `dllVersion`, and `engineReportsStatus` checks
  it. A `pnpm dev` started before an engine change keeps the old DLL
  installed while the window takes the new code, and without that check the
  notice called an audibly working engine off. Raise the minor whenever the
  app starts depending on something new from the engine, and move
  `ENGINE_STATUS_SINCE` only with it (`engineVersion.test.ts` holds them
  together).
- **An app update never replaces the installed engine — the app does, after
  launch.** An update runs setup silently, often with nobody at the machine,
  and a Windows prompt there has no one to answer it, so `installer.nsh`
  leaves both engines alone (the `keep` path). `src/main/engineUpdate.ts`
  compares every DLL beside the setup helper with the installed copies by
  SHA-256 — the version resource cannot tell two builds apart — and
  `EngineUpdateNotice` offers `install --restart-audio`, without
  `--attach-all`, so every output stays as the user left it. `pnpm dev`'s
  `sync-dev-engine` asks the same question of the engine it just compiled.
  A DLL added beside the helper joins the comparison by itself, because
  `install` copies every DLL there.
- **The engine build has to be reproducible, or every release nags.** The
  comparison above is by bytes, and the MSVC linker stamps the time of the
  link into every file unless told not to: two builds of an unchanged tree
  hashed differently, so each release — built afresh — would have offered an
  engine update nobody needed. `/Brepro` in `native/CMakeLists.txt` puts a
  content hash there instead, and three builds from two folders and two
  copies of the tree then came out identical. Nothing that varies per build —
  `__DATE__`, `__TIME__`, a git revision, an absolute path — may reach the
  engine or the DSP core it links; `FEQ_BUILD_REVISION` goes into the host
  alone. `engineUpdate.test.ts` holds both.
- **The setup helper is a windowed program, not a console one.** Run it from
  an interactive shell without piping or capturing its output and the shell
  returns before a single line prints. `FluidEQ-Engine-Setup.exe status |
Out-String` (or any other capture) is what actually waits for it and shows
  the answer.
- **An engine command is tried three times before anyone is told it failed,
  and Windows — not a clock — decides when the next try runs.** Switching
  engines failed mostly while Windows audio was still restarting from the
  install, and the same step a moment later works. Every elevated helper
  command retries inside its one run (`setup/retry.h`) — retrying from the app
  would put the permission prompt up again — and `status` retries its endpoint
  read the same way. The switch itself retries in main (`engineRetry.ts`).
  Between tries both wait on `settle`, which returns once `Audiosrv` and
  `AudioEndpointBuilder` are no longer pending, as the service control
  manager reports; a stopped service counts as settled, or a disabled one
  would hang the wait. Only the last failure reaches the window, so the
  switch and status requests carry no deadline. Ivan chose this over a fixed
  pause on 2026-09-13; do not add one.
- **Under the FluidEQ Engine the app restarts Windows audio by itself,
  once, and never enables an output by itself.** The engine on the output
  being listened to but not running, which a restart fixes, gets Windows
  audio restarted (`useRestartWhenEngineOff`) — once a session, never during
  the engine update, and only from a status read after sound was heard. The
  output Windows plays through, read as not attached, gets the notice and
  its Enable button and nothing else: it used to be enabled without a press
  (one Windows prompt, audio restarted onto it, once per output a session),
  and every change of output and every output unplugged then put an
  administrator prompt up with nobody having asked — Ivan took it out on
  2026-09-16; do not put it back. A declined prompt or a failure leaves the
  notice and its reason; nothing asks again on its own.
- **One engine in Windows' effect lists at a time.** Both engines are ordinary
  system effects and a machine can carry both registrations on the same
  output; which one a stream then goes through depends on the slot each landed
  in and the mode the stream uses, and on a user's machine Equalizer APO's
  entry ran while the FluidEQ Engine's never did — both reported attached,
  neither reporting a fault. So the app runs `suspend-apo` itself: at the
  switch, and again whenever the output list (re-read every few seconds)
  shows Equalizer APO on an output while the engine is chosen — once a
  session, one Windows prompt, because Equalizer APO's own Device Selector
  can be run at any time afterwards and a rule that only holds at the moment
  of the switch is not a rule (`createApoGuard`). It takes Equalizer APO's
  class ids out of the composite lists after mirroring the vendor's own
  entries forward, **and out of the old single values (pids 5/6/7) and the
  legacy pair**, which is where its "Install as SFX/MFX" troubleshooting
  option writes it — Windows ignores those wherever a list exists, so they
  change no sound, but they are what every "is Equalizer APO here" answer is
  read from. `write_fx_values` still refuses every other change to those
  slots: Equalizer APO's own id may be removed and put back, never replaced,
  so a machine's own audio vendor (THX, Nahimic, Realtek) keeps its
  registration byte for byte. Each output is recorded exactly as it was under
  `<engine root>\apo-off`; switching back runs `restore-apo`,
  which writes that state again and re-applies our own attach if it is still
  there. `uninstall` restores it too — leaving somebody else's equalizer
  disabled by a program that is gone is not a thing an uninstaller may do.
  Neither command runs unless there is something to do
  (`apoSwitchOff.ts`), because each costs a Windows prompt, and a refusal
  leaves the switch made and the other engine registered, which is where every
  version before this left it. The APO class ids are written down twice — in
  `fx_list.cpp` and in `windows-audio-devices.ps1` — and must agree.
- **Installed, attached, and never once created by Windows is its own state,
  and the app repairs it.** Two machine-wide things decide whether
  `audiodg.exe` will load this effect at all: `DisableProtectedAudioDG`, and
  the C++ runtime sitting in the engine's own folder (Windows searches there
  and in its own directory, never ours). A feature update, a driver's
  installer or an audio "repair" tool can undo either long after setup, and
  then everything reports healthy — installed, registered, attached on every
  output — while the EQ does nothing, because an effect that is never created
  writes no status and no log. `status` now answers `unsignedAllowed`,
  `runtimeBeside`, `serviceCanWrite` (the engine root's DACL grants write to
  LOCAL SERVICE / Users / Authenticated Users / Everyone, deny entries
  honoured — without it the engine loads into a folder it can neither read a
  configuration from nor write a status to, and passes everything through)
  and `everRan` (engine.log OR any `status-*.json`: a swept `%ProgramData%`
  has no log and has certainly run). The report carries all four.
  `engineLoadRepair.ts` re-runs `install --restart-audio` once a session
  when any of the first three is explicitly false — never on an unknown from
  an older helper, and never on "attached and never ran", because from that
  read a machine Windows has never created the engine on is identical to one
  where setup finished a minute ago and nothing has played; a prompt seconds
  after an install is its own bug. That case is the window's
  (`useRepairWhenEngineNeverRan`): once the live capture has heard sound go
  past an attached engine that wrote nothing — on this output, which is an
  output the engine has never written a status for, whatever it did
  elsewhere — it asks main (`REPAIR_FLUID_ENGINE_OUTPUT`,
  `engineOutputRepair.ts`), silently, under `useEngineMaintenance`'s lock
  (`repairEngine`) so a manual restart cannot overlap it. `createApoGuard`
  likewise requires the FluidEQ Engine to be attached somewhere, not merely
  chosen: a machine that picked it in setup and declined the prompt has the
  preference and no engine, and taking Equalizer APO off it leaves nothing
  processing. `useRestartWhenEngineOff` does not restart at all when
  `everRan` is false — there is nothing to restart into the chain — and its
  "once" lives in `sessionStorage`, not a ref, so a crash-recovery reload
  cannot reach it again. The trouble card for that state (`neverRan`, its own
  key) drops the restart button, says what FluidEQ already repaired and what
  is left — security software or the sound card's driver — and leads with
  Equalizer APO, the only thing on it that processes sound there. It no longer opens the restart card either: a dialog nobody asked
  for, in the middle of listening, is noise when the restart works; the card
  appears by itself when it fails. The trouble notice is now dismissed for
  the rest of the session per trouble, because the live capture stops with
  the DSP page and starts with it, so the same trouble ended and began on
  every visit and the card came back every time.
- **Which slot a driver builds is not written down anywhere, so the app
  tries them, newest to oldest, on the machine itself — the slot ladder.**
  An effect can be registered in five places: the EFX, MFX and SFX lists
  (pids 15, 14, 13) Windows 8.1 and later read, and the GFX and LFX single
  values (pids 2, 1) everything before that read. The RME DAC a user tested
  on never created the engine in the EFX list, enhancements on, every
  machine-wide fact in order; Equalizer APO's own installer carries rules
  for the same thing (a mode effect where Windows 11 combined a Bluetooth
  output, the old values where a driver registered only those) and still
  has users for whom only the old values work. There is no rule that covers
  every driver, so `engineOutputRepair.ts` moves the engine one rung down
  each time the window hears sound go past a silent engine on that output
  (`attach <guid> --slot <next> --restart-audio`), after first re-installing
  where a machine-wide fact is false. The helper's `status` reports each
  output's `slot`; `plan_move` takes ours out of wherever it is and puts it
  in the slot asked for (a move into a legacy value also takes away the
  lists the first attach created, because a driver that reads the old
  values may only do so while no list exists; the vendor's own lists stay);
  the two legacy values are taken only where nothing is registered or where
  Windows' own default effect is ("WM LFX APO" / "WM GFX APO", the two
  `wdmaudio.inf` registers on every endpoint whose driver brings none —
  `kWindowsDefaultApoClsids`), and `write_fx_values` admits our own class
  id and those two there and nothing else — a vendor's registration is
  never replaced, and the backup puts Windows' effect back on detach. That
  is the RME case exactly: the driver registered only pids 1 and 2, holding
  Windows' two defaults, Windows read only those whatever lists were added,
  and Equalizer APO installed "as LFX/GFX" worked there while nothing in a
  list ever ran. A slot named on the command line is remembered per output
  under `<engine root>\slots`, so the next attach with no slot named (the
  app enabling the output again, an install with `--attach-all`) does not
  put the engine back where it was never loaded; an attach with no memory
  goes straight to GFX on an endpoint first found legacy-only with a
  takeable GFX (`default_slot_for`, read from the backup — the first attach
  adds lists), to MFX on an output Windows has combined (Equalizer APO's
  rule, the same property) and to EFX otherwise. The device list's probe
  reads all five values for the engine's id (`windows-audio-devices.ps1`,
  `EngineSlotValues`); reading only ,15 and ,14 called a moved engine "not
  attached" and enabled it again on every launch. Bounded:
  each step is to the rung after the one the helper reports, the gate
  allows `move-slot` four runs a session, and the window asks once per
  (output, slot), in `sessionStorage`. Silent: the trouble notice for that
  state stays away (`isTryingSlots`) until an ask has come back with nothing
  done, or a change was followed by the same slot heard failing again; only
  then does the card say what is left. The first rung that is heard stays.
- **The Room is a stage of the rack that folds every channel onto the
  front pair, and it needs a head file to do anything.** `FeqRoom`
  (`room.h`, `room.cpp`, `room_kernels.cpp`) runs after Bass Punch and
  before Dimension: each channel with a speaker on the ring goes through
  the head's ear responses for its direction plus four image-source wall
  reflections, the LFE is low-passed into both ears, and channels 2 and up
  leave silent; everything below it then runs on the binaural pair. The
  kernels are built on the control thread and adopted through an atomic
  exchange, warmed for the convolver's warm-up and faded in over its
  blend, and the sets the audio thread finishes with are handed back to be
  freed (`retired`), never freed on the audio thread. The engine rebuilds
  the whole chain on every rack change and `feq_chain_transfer_state` runs
  on the audio thread at the swap, so the room is part of that handover
  (`feq_room_transfer`: the previous room's live set and tail move to the
  prepared one, whose own set goes back into `handoff` to be adopted as the
  replacement) — without it every dial move put one partition of silence
  into the sound, and the surround alignment lines (`denoise_align`,
  `punch_align`) emptied the same way; `chain_transfer_test.cpp` and
  `chain_surround_test.cpp` hold both. The card's eleven rooms
  (`roomPresets.ts`) are pinned by value in `dspRoomPresets.test.ts` and
  again in `room_presets_test.cpp`, which runs the engine's room through
  them: retune a room on both sides in one commit. `ROOM_PRESETS` in
  `chain.ts` is wire order (the engine logs the index), so a new room goes
  before `custom`, never between. Saved rooms (`savedRooms.ts`) keep the
  shape and never the head, like the presets. The engine's room has no bass
  management: every speaker channel reaches the ears full range and only
  the LFE is low-passed (120 Hz). Which channel is
  which speaker comes from the stream's mask (`speaker_of_channel`), the
  head from `fluideq-room-head.txt` beside the rack (`room_head.h`, written
  by main from the rack message itself — `roomHeadOnWire` — only when the
  head changes, because the engine reloads every output on any write in
  that folder), and the twenty-three room scalars ride the wire before the
  surround switch (`FEQ_CHAIN_PARAM_LEAD` is 138). No head, or a mono
  stream, or no channel with a speaker, and the room is inactive whatever
  its switch says — `feq_chain_room_active` says which, the status carries
  `channels` and `room` (`off`, `no-head`, `front-stage`, `5.1`, `7.1`,
  `on`) for the card's chip, and the engine log gets one `room on/off:`
  line per chain build. The shipped heads are MIT KEMAR at three sizes
  (`build-room-heads.ts` from the compact set, mirrored for the left half;
  `assets/room/heads/LICENSES.md`), never HeSuVi's recordings. Held by
  `room_test.cpp` (a synthetic head whose delays are known frame counts:
  the left speaker reaches the right ear 16 frames later at 48 kHz, dead
  walls leave nothing after the direct path, a wall change mid-stream
  makes no step beyond either steady room's) and `chain_surround_test.cpp`
  (a six-channel chain folds and reports +512 frames).
- **The Library's DSP host reads the room's head from the shipped folder,
  not from the wire.** The host is spawned with `--room-heads <dir>`
  (`supervisor.ts`, `roomHeadsDir()`), and `apply_room_head` in the host's
  `main.cpp` parses `<dir>/<small|medium|large>.txt` with the engine's own
  `room_head.cpp` (shared through the `fluideq-dsp-host` target's sources)
  whenever the settings arrive with the room on and a head it has not
  loaded; a head file that cannot be read leaves the room inactive and a
  line on stderr. The head text travels twice — main writes it beside the
  engine's rack, the host reads it from assets — because the engine reloads
  every output on any write in its folder and the host has no folder.
- **Fit renders its listening pairs in the window, offline, never through
  either engine.** `DspRoomFitDialog` reads each shipped head's text over
  `READ_ROOM_HEAD` (`roomHeadText.ts` parses the 48 kHz block), renders one
  buffer per head with `OfflineAudioContext` — the same pink burst at 0°,
  90°, 180°, 270° through a two-channel `ConvolverNode` (`roomFitAudio.ts`)
  — and plays the buffers through one `AudioContext` opened on the first
  press. Which pairs are asked and who wins is `roomFit.ts` (three opening
  pairs, then the top two again with the sides swapped, medium on a tie),
  pinned by `roomFit.test.ts`; the dialog's own test mocks the audio. The
  heads load once per opening: the card hands the dialog a new close
  callback every render, so the loading effect reads it through a ref
  rather than depending on it.
- **An output's format is set to 7.1 for the Room through PolicyConfig, not
  the registry, and only where the driver takes it.**
  `windows-audio-format.ps1` reads an output's shared-mode format, asks the
  driver in exclusive mode whether it takes a 7.1 format at the output's own
  depth or the three common ones (or whether Windows already knows the
  output as six or more physical speakers), and sets or restores the format
  through `IPolicyConfig::SetDeviceFormat` — the call Sound settings makes,
  no administrator, Windows restarts the streams itself. `outputFormat.ts`
  remembers the first "before" per output in `output-formats.json` under
  userData so Undo puts back exactly that; `RoomOutputNotice` offers the
  press only when the engine's status says the room is folding a stereo
  stream on the output being played through (`front-stage`) and the driver
  said yes, and steps aside for the engine notice. Ivan's outputs all say no
  (a USB headset dongle and a Realtek jack), so the notice was tested and
  not seen; it reuses the engine notice's layout.
- **The rack runs on every channel of a surround output, up to eight, and
  the front pair stays bit-for-bit the stereo chain.** `FEQ_CHAIN_MAX_CHANNELS`
  is 8; `FEQ_CHAIN_CHANNELS` (2) now means "the front pair", not the width.
  Per-channel stages (EQ, exciter, compressor, maximizer, restoration) run
  on each channel; every level stage links its detector across all of them
  so the mix keeps its balance; the stereo-only stages (Dimension, Bass
  Forge and Punch, Mid/Side) touch the front pair alone. Two things that
  are not obvious: the pair's own stages delay it (the restoration's
  modules, Punch's FIR), so the channels beyond it are held back by the
  same amount at each of those two points (`denoise_align`, `punch_align`
  in `chain_internal.h`; the restoration's delay line has to be sized for
  `FEQ_DENOISE_MAX_LATENCY_FRAMES` because its latency changes with the
  settings, and a line resized on the control thread is one the audio
  thread is reading), and the exciter skips the LFE — the engine works out
  which channel that is from the stream's channel mask (`lfe_channel_of`)
  and tells the chain (`feq_chain_set_lfe_channel`). The rack's
  `surround_all_channels` (the DSP header's switch beside the power switch,
  wire slot `FEQ_CHAIN_PARAM_LEAD - 2`) turns this off, which is the
  first-two-channels behaviour every version before had. Held by
  `chain_surround_test.cpp`: the six-channel front pair identical to the
  stereo chain, a surround channel identical to the front it copies, one
  gain decision, impulses aligned across channels, the LFE unexcited —
  measured against a chain with no exciter and every linked stage off,
  because a linked limiter passing the centre's harmonics on to the LFE
  is the design, not the exciter.
- **The EQ and the rack are measured at 44.1, 48, 96 and 192 kHz**
  (`rate_sweep_test.cpp`). Every other measured engine test builds its graph
  at 48 kHz, so a coefficient or a stage that assumed one rate would pass all
  of them and be heard only on somebody's 96 kHz DAC. Measured: the same
  −20 dB peak, the same shelf and preamp, and the rack within 0.2 dB across
  all four.
- **Windows' "Audio enhancements" switch beats everything either engine does.**
  Off (per output, `PKEY_AudioEndpoint_Disable_SysFx`), Windows loads no
  system effect there at all: the registry still says attached, the engine is
  never loaded so writes no status, and the app used to call that output
  processed. The device list now reads that property (`effectsEnabled`), the
  output panel says so and offers Windows' own Sound page, and the engine
  trouble card stays away — restarting Windows audio cannot help.
- **Every automatic elevated run goes through one gate** (`automaticSetup.ts`,
  created once in main). Four things run the helper with nobody pressing
  anything — Equalizer APO switched off after a switch and again from the
  output list, the install repaired from a status read, and repaired again
  from the window once sound was heard past an engine that never ran — and
  with a private "once" each, two of them reached the same conclusion from
  the same facts seconds apart: two prompts, two audio restarts, for one
  action, and a declined first prompt no defence against the second. The
  gate's rules: nothing automatic starts while another automatic run is in
  flight, and each kind runs once a session, except that `suspend-apo` and
  `restore-apo` undo each other's "once" (a user may switch engines twice in
  one sitting), and that `move-slot` — the slot ladder — may run four times,
  one per rung below the first. The window's own repair goes through
  `REPAIR_FLUID_ENGINE_OUTPUT`, where main decides and the gate refuses; a
  pressed update on `UPDATE_FLUID_ENGINE` is never refused. `suspend-apo`
  fails like
  `--attach-all` (every output refusing), `restore-apo` fails on ANY output
  it could not put back — that record is all that is left of somebody
  else's equaliser — and `uninstall` carries on past a failed restore but
  reports it and never purges the `apo-off\` records then. The DACL reader
  skips inherit-only entries, which say nothing about the folder itself.
- **A bug report carries everything since the previous one, never a tail.**
  A user's report held a hundred and twenty lines of the playback host and
  nothing about an engine that had failed an hour earlier. Main now takes
  every entry from the last delivered report's gather moment onward
  (`takeLogSince`, capped at 2000 newest lines with a count of what was
  left out) from both halves of the app log (`main.log` rotates into
  `main.old.log` at a megabyte), the engine's own `engine.log`, and the
  helper's `setup.log` — one line per elevated run, appended by the helper
  itself (`note_run`), including a declined prompt. The mark is
  `bug-report-mark.json` in userData, written only when the window says the
  report left (`BUG_REPORT_DELIVERED`, sent on copy, mail and issue) with the
  `gatheredAt` that report carried — a dialog closed without sending must not
  move it, or the lines it showed are in no report at all. The app log is
  local time without a zone and the native logs are UTC; `lineTime` reads
  both as instants, and a line with no timestamp belongs to the entry above.
- **A bug report has to be able to answer "the engine is on and I hear
  nothing".** Reports could not: the app threw away the engine's own `reason`
  for passing an output through, logged nothing about the engine at all, and
  attached a hundred and twenty lines of whatever had happened last. The
  report now carries an Outputs section built from all three sources
  (`common/engineReport.ts`: Windows' device list, the setup helper, the
  engine's statuses) and the tail of the engine's own `engine.log`, and main
  logs every engine status change, every helper command and result, the
  automatic enable and the automatic restart. Anything added to that section
  is somebody's machine in a public issue: keep it to what a diagnosis needs,
  and it goes through `redact` like the logs.

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

APO is now one of two engines, so setup asks first: an nsDialogs page declared
at file scope in `installer.nsh` — **not** through `customPageAfterChangeDir`,
which electron-builder only reaches from the assisted installer and this
one-click build never includes — offers the FluidEQ Audio Processing Engine or
Equalizer APO, and writes the answer to `audio-engine.json` in the installed
app's data folder for it to read at startup. It is skipped, leaving both engines
untouched, under `${Silent}`, under `${isUpdated}`, and whenever that file
already exists.

**The installed app's data folder is `%APPDATA%\fluideq-app`, not
`%APPDATA%\FluidEQ`** — that one is `pnpm dev`'s. Electron names it after
`release/app/package.json`, which has a `name` and no `productName`. Setup used
to write the choice into `FluidEQ`, so the installed app never saw it: pick the
FluidEQ Engine on a machine with Equalizer APO, and the engine got installed
while the app came up on APO. `installer.nsh` now builds every path from
`FLUIDEQ_DATA` (`$APPDATA\${APP_PACKAGE_NAME}`), and `installerPaths.test.ts`
fails if a path is spelled by hand or the package grows a `productName`. And
if the choice is ever missing while the engine is installed, the app picks the
FluidEQ Engine rather than APO (`migrateAudioEnginePreference`).
`customUnInstall` removes our engine first and without asking — it is ours, and
`FluidEQ-Engine-Setup.exe uninstall` puts every output's effect list back — and
only then asks the "Also uninstall Equalizer APO?" question, and only when APO
is actually installed.

Two things about that macro are easy to get wrong and were:

- **What says the engine is installed is the installed DLL, not the helper.**
  `FluidEQ-Engine-Setup.exe` ships in every build, so gating on it raised a
  consent prompt on every uninstall — Equalizer APO users included — and then
  told them to hand-run the removal of something they never had. The gate is
  `$PROGRAMFILES64\FluidEQ Engine\FluidEQ-Engine.dll` (where `install_dir()`
  puts it), and the helper is checked as well only because it is what does the
  removing.
- **A `MessageBox` in the uninstaller must not carry `/SD`.** electron-builder's
  `un.onInit` runs `SetSilent silent` right after its own "are you sure" box, so
  every ordinary one-click uninstall is silent by the time `customUnInstall`
  runs, and NSIS answers a `/SD` box with its default instead of showing it.
  `/SD IDNO` therefore meant the APO question was asked of nobody, always
  answered No. The cost of dropping it is that a real `/S` uninstall now stops
  on the box.

Both helper runs go through `${StdUtils.ExecShellWaitEx}` and
`${StdUtils.WaitForProcEx}` rather than `ExecShellWait`, which reports only
through the error flag and cannot tell a helper that ran and failed from one
that never started. The exit codes are the helper's own — 0 done, 1 bad command
line, 2 consent declined, 3 ran and failed — and every run writes
`FluidEQ Engine setup exited with code N` to the install log. `StdUtils.nsh` is
included by electron-builder's shared header ahead of `installer.nsh`, so it is
available in both the installer and the uninstaller pass; the plug-in hard-codes
`SW_SHOWNORMAL`, which needs the helper to be a windowed-subsystem executable —
one with no window ever shows nothing, rather than the console flash an
earlier build had.

The ten translations live in `assets/nsis/engine-strings.nsh`, pulled in with
`!include /CHARSET=UTF8`. That is load-bearing: electron-builder passes
`-INPUTCHARSET UTF8` for the main script only, so a BOM-less include is read
in the machine's ANSI code page and every non-ASCII character arrives mangled.
A BOM would also fix it and `pnpm typecheck:encoding` rejects one.

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

- **A new build-time variable blanks the running dev window.** `process.env.X`
  in the renderer is replaced at compile time by the list in
  `.erb/configs/public-env.ts`, read once when `pnpm dev` starts. Add a key to
  that list and reference it from a renderer-reachable module, and the dev
  server already running leaves the raw `process.env.X` in the bundle — the
  renderer has no `process`, the module throws on load, and the window goes
  white with nothing in the console that names the cause. Restart `pnpm dev`
  before believing anything else; this is what emptied the window when
  `FLUIDEQ_API_URL` was added.
