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
- **A script that rewrites a source file in place can kill the running app,
  and the error names neither the file nor the script.** A file is briefly
  half-written — on Windows it is extended before the bytes land, so it reads
  as thousands of NUL bytes — and anything that loads it in that instant sees
  garbage. Main loaded a locale file mid-write and died on
  `RangeError: Invalid string length`, thrown inside TypeScript's own
  diagnostic formatter while it tried to render an error for a file of nulls:
  no filename anywhere in the trace, and by the time anyone looks the file is
  whole again and the tree type-checks clean. It cost a window and twenty
  minutes. Anything that edits a source file — a locale script, a codemod —
  writes to a temp file beside it and renames, the way `asyncWriter` and the
  Studio's notes writer already do.
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
- **A DSP preset's tone is a curve in the main EQ, never a stage of its
  rack.** Each factory preset carries `curve` beside `settings`, and a pick
  sends the curve as the Preset layer (a `dsp:<id>` voicing, written as
  `fluideq-<slug>-preset.txt`) on both engines; the rack's own EQ keeps only
  what supports its other stages — dynamic bands (the de-essers, the
  late-night bass guard), bass mono, harmonic colour, a Room copy's
  compensation (`presetCurve.ts`). The engine applies its layers after the
  rack, so the curve lands where Equalizer APO plays it. Inside the rack it
  sat ahead of the compressor and limiter with every chain's level matched,
  and Pop against Metal was reported as "not noticeable at all" on the
  FluidEQ Engine while obvious on APO (2026-09-21). Do not move a preset's
  tone back into its rack; the DSP EQ is the listener's own. Under APO an
  EQ-page pick holds the rack off (`rackHeldForApo.ts`) and
  `RackFollowsEngine` puts it back at the switch to the FluidEQ Engine.
- **A preset's curve is the machine's, like its rack, never the output's.**
  Switching output while the app runs keeps the Preset layer that is
  playing (`voicingForDevice` in `deviceProfiles.ts`, given `playing` by
  both switch paths in `ipc/profiles.ts`): it used to come back as whatever
  preset the new output's profile was saved with, so the picker named one
  preset and the chip beside it another (Ivan, 2026-09-24: "we dont save
  presets on the output switch we replay current preset always"). A preset
  cleared by its chip stays cleared; somebody's own voicing is still the
  output's; the launch, with nothing playing yet, restores the profile's.
  `presetFollowsMachine.test.ts` holds all three.
- **A preset's curve rides the rack's line, so the rack limits through it.**
  The rack's line (`fluideq-dsp.txt`, and the Library host's) ends with a TONE
  trailer — the Preset layer's bands exactly as the writer builds them
  (`presetTone.ts`: its group's strength, band shape and Double's second pass,
  matched as that group's Treble plays) — and the rack puts that curve on in
  front of the Maximizer and takes it off with its exact inverse behind the
  Master (`chain_tone.cpp`). A preset then lands on the ceiling once its curve
  has played, where it used to go 2-5 dB over and Auto normalize turned
  everything down: measured over the catalogue, 0.85 LU louder than not told,
  no overs, no more pumping. A new curve glides in over 20 ms and the old one
  out (a hard switch clicked at -49 dBFS; now under -104). The trailer stands
  after the game word and the Room trailer; an engine older than 1.16 refuses a
  longer line and bypasses the whole rack, so main strips it for one
  (`ENGINE_PRESET_TONE_SINCE`), and a switched-off rack carries none. Only bells
  and shelves travel; a preset curve's subsonic high pass is in the rack, in
  front of the Maximizer. Change how the Preset layer is written and
  `presetToneOf` changes with it, or the rack limits a curve nobody hears.
- **The Preset layer writes each band at its curve's model Q** (`eqModel.ts`,
  `presetVoicing.ts`): the main EQ has no Wide or Proportional model, and the
  genre curves were fitted through theirs. From 09-21 to 09-23 every Wide
  curve played bands at the dial's Q — narrow bumps where a tilt was drawn.
- **Every chain's stage profiles are its own, and a loudness target only
  where the name says level.** Default carried the Master's streaming target
  (-14 LUFS) and played loud records up to 5 LU under DSP Off; the two
  restorations borrowed the Master's lathe profile (Vinyl, -3 dBTP) and its
  comparison tool (Reference, -18 LUFS), and the Character group's Tape and
  Vinyl EQ curves — so picking those Character entries gave a repair curve,
  and the repairs added the characters' fuzz. Now Default has the
  Maximizer's `default` (1 dB), the restorations the EQ's `tapeRestore` and
  `vinylRestore` (repair group, no harmonics) and the Maximizer's `tape` and
  `vinyl`, and Character Tape and Vinyl are their 2026-08-22 curves again:
  +0.6, +0.5 and +0.4 LU over DSP Off on the corpus, nothing past -0.86 dBTP
  after the curve. Repair compressed shared the Character group's Air curve
  (+4 dB at 16 kHz, into the octave where an encoder leaves its swirl) and
  now has `lossyRestore` and the Maximizer's `lossy` (+0.46 LU); Air had the
  Speakers width, built for two boxes across a room, and now has its own
  (`air`, only the top opened). A Master target stays in Reference, Speech,
  Podcast and Audiobook. A new chain gets profiles of its own, never another
  purpose's that happens to share a name.
- **Bass Forge is a harmonic generator, so a genre that takes no exciter
  takes no Forge.** Its Presence dial makes harmonics, its Drive saturates
  and its octave divider makes a subharmonic, and it ran in ten genres whose
  research forbids exciter or saturation — hip-hop, rap, reggae, dub,
  dancehall, reggaeton, corridos, Afrobeats, Amapiano, downtempo — putting
  13-16% of generated content on a 60 Hz note (`genre/thd_probe.cpp`, four
  tones through the rack and then the curve). Each of those offers its
  profile under its own name and leaves it off (`offered`), and the bass
  support is the curve's, which generates nothing. It cost no loudness: all
  ten came out the same or up to 0.04 LU louder, because the stage is
  level-neutral by design — what it added was only the distortion. Trap
  keeps it for the research's own exception (the 80/120/160 Hz overtones of
  an 808 a phone cannot play) with `subAmount` 0, and Car keeps the
  harmonics alone, no octave and no Drive: a cabin already lifts the note.
  The audit's "no exciter" rule fails on Forge too now.
- **The rack's EQ has the main EQ's Treble choice** (`IEqSettings.treble`,
  Precise by default). Precise builds every band that has a matched design
  analog-matched — the character model's Q first, then
  `feq_biquad_coefficients_designed` — in the cascade, the oversampled
  cascade, the dynamic bands and the linear-phase kernel alike. It is the
  listener's, like the surround switch: factory, saved and chain picks all
  keep it, and changing it leaves the preset's name alone. It rides the
  Room's retired headphone slot on the wire, which every engine decodes and
  none before 1.16 read, so an older engine plays the cookbook and no layout
  moved; natively it defaults to the cookbook, which the parity fixtures
  were frozen from. The page draws Precise only where it is heard
  (`rackPlaysMatched`, `ENGINE_RACK_TREBLE_SINCE`) from `biquadMatched.ts`,
  the native design transcribed (`dspBiquadMatched.test.ts` holds it to the
  engine's own coefficients, 9 decimals) — change the two together, and
  `playsAnalogMatched`'s rule with them.
- **Every change to the rack's EQ fades too, and every band keeps its
  history** (`chain_eq_fade.cpp`). The histories were kept by a band's place
  among the live bands, so switching one on or off, or adding one, clicked
  at -37 dBFS; a ±6 dB flip at 700 Hz clicked at -73 and the Treble choice
  at -66. It is the main EQ's rule now: a history found again by type,
  frequency and Q (then type and frequency, then type in place), the old
  rack playing beside the new for 20 ms on an equal-gain raised cosine, a
  fade already crossing carrying on, the EQ switched on fading in from the
  sound as it arrives and switched off playing out into it — every case at
  the steady floor, in the engine's handover and the Library host's
  configure alike. A fresh chain takes its first rack as it is. Not faded,
  as before: a change of phase mode, oversampling factor or stereo
  arrangement, and anything in the linear kernel, whose kernels fade
  themselves. The DSP EQ page's spectrum reads the main graph's twelfth-
  octave slices (`createGraphSliceReader`) on its own fixed dBFS scale,
  because its thresholds are dBFS.
- **The treble plays as drawn unless the layer's Treble row says Classic.**
  The cookbook (what Equalizer APO builds every band from)
  squeezes a band toward Nyquist: Ivan's five treble bands played 1.5 dB
  short at 8 kHz and 3.8 dB at 20 kHz on a 48 kHz output, invisible on a
  graph drawn at 96 kHz. Every layer file carries
  `# FluidEQFilterDesign: MATCHED` (`filterDesign.ts`), scoped like the phase
  directives — its file and what that file includes — and the engine builds
  those bands analog-matched (`biquad_matched.cpp`: bells and pass filters,
  Butterworth shelves; everything else, and anything unstable, stays
  cookbook; a cut is the exact reciprocal of its boost). The custom file
  carries none: it names no layer and no row speaks for it. A headphone
  correction first stayed on the cookbook whatever the choice, because
  AutoEQ fits with it (0.14 dB from its fit that way, 0.89 dB matched); Ivan
  wanted the Curves row to move his correction, in the sound and on the
  graph, so it follows that row, and the row's note says Classic is how
  AutoEQ tunes one. `playsAnalogMatched` in the graph's `utils.ts` mirrors the
  engine's rule — change both together. The graph draws matched only over
  an engine that plays it (`useMatchedDesign`, `ENGINE_MATCHED_DESIGN_SINCE`
  1.13, read from the status the window already holds, never a new ask on
  mount), and draws cookbook bands at the output's real rate
  (`useOutputRate`), holding the Nyquist value above Nyquist. Ivan heard the
  result as "APO has better bass"; measured on his files the bass was APO's
  to 0.002 dB and only the treble differed. He chose to keep it ("we need to
  be unique"), and asked for both ("I want both mode some how"): the EQ mode
  menu's Treble row, Precise or Classic for Your EQ and for the curves, kept
  in `fluideq-eq-treble.txt` and `fluideq-curve-treble.txt` beside the phase
  files and read by the engine from 1.14 (`ENGINE_TREBLE_CHOICE_SINCE`);
  Classic keeps that group on the cookbook. Only the exact word `classic`
  counts, on both sides (`config.cpp`, `main/ipc/trebleDesign.ts`), or the
  menu shows one design while the other plays. The graph
  follows each group (`groupPlaysMatched`), and the window holds one copy of
  the choice (`useTrebleDesigns`) so the menu and every graph agree. Main
  reads the files only while the FluidEQ Engine is chosen: asking for that
  engine's folder creates it.
- **The Tone panel's two cuts are a file of their own, and 24 dB/oct is the
  steepest.** Low cut at 20 Hz, high cut at 20 kHz, each a Butterworth of 0,
  12 or 24 dB/oct (`eqCuts.ts`); 36 and 48 were offered and Ivan found them
  "too aggressive" (a Q 2.56 section ringing at the corner). They are
  `fluideq-cuts.txt`, included by every device file after the preamp and its
  directives: no layer, no MATCHED directive, so both engines build them on the
  cookbook, and they are in neither the preamp nor Auto normalize's input.
  `toEqCuts` reads a stored slope the dials no longer offer as the steepest
  left, and the saved-state schema takes any `eqCuts` object — a state file
  that fails validation is rebuilt by a recovery that drops the headphone
  layer, and a cut setting must never be what triggers it. The graph draws
  them on the final output alone, floored at the plot's bottom
  (`eqCutLine.ts`): the cyan EQ line is the bands and nothing else, as the
  Tone beside it is a line of its own (Ivan, 2026-09-23).
- **The Tone is a layer of its own, in Your EQ's group.** Bass, Mid and
  Treble are three filters written as `fluideq-<slug>-tone.txt` (`tone.ts`),
  never fitted into the bands: turning Treble used to rewrite a tuning made
  by hand. Saved with the profile (`getCurrentPreset`, and restored by
  `getStateForAudioDevice`), drawn as its own chartreuse line at full
  strength, with a chip in Also applied whose × clears it alone; Clear EQ
  clears it with the bands, the EQ chip's × does not. The shapes are
  Butterworth shelves at 100 Hz and 10 kHz and a 1 kHz bell at Q 0.7 —
  Butterworth because that is the only shelf the engine builds
  analog-matched, so Your EQ's Precise/Classic moves all three dials (a Q of
  0.5 left the shelves on the cookbook whatever the choice). The EQ mode
  menu's groups are `layerGroupOf`: the headphone correction alone follows
  the Corrections row (the custom file and an impulse too, having no layer);
  the bands, the Tone, a preset, the driver and Smart EQ follow Your EQ's —
  strength, Band Q, phase and Treble, in the file's tag and on the graph.
- **A headphone correction plays as published, past a slider's ±20 dB.**
  The editor's range is a taste limit; a correction is somebody's fit
  (Ivan: "we just need to be able to do more than that if those eq curves do
  it"). `correctionRange.ts` bounds only the headphone layer, at the preamp's
  own reach (`-PREAMP_MIN_GAIN`, 60 dB): OPRA picks, a Squiglink paste to the
  correction layer, the correction's shield, its file, Studio's 1.5x, the
  graph and adoption of an edited file all use `layerGainLimit`. The library
  used to hold bands to ±12 dB (±8 below 25 Hz and above 14 kHz), which
  changed 822 of its 12,594 curves; its largest band is -21 dB and its widest
  chain 30.7 dB.
- **The hand-set preamp reaches -60 dB too, like Auto normalize** (Ivan,
  2026-09-23: "manual yes -60"). It is the sum of every layer that has to be
  cancelled, so the preamp's floor is `clampPreAmp`'s and never a band's
  `clampGain`: the send (`setMainPreAmp`), main's gate (`SET_PREAMP`) and
  every path that stores or reads one (`flush.ts`'s live state, the saved
  state file and both preset formats) used the band clamp, so a level deep
  enough to hold a published correction was cut to -20 on its way to disk and
  again on its way back. The side panel's dial and its field take the full
  range, and so does the player's Pre fader — held to ±20 it could not even
  show a level set deeper elsewhere, and the first touch wrote -20 over it.
  Unity stays at the top of the dial and the middle of the fader all the same
  (Ivan, 2026-09-24: "center 0 on top not to the side, make 60 some how
  compress"): `centredSweep` gives each side of 0 half the travel, the +20
  side evenly and the -60 side compressed, as fine as the +20 side where it
  leaves 0 (-10 dB 18% below the centre, -20 at 28%, -40 at 41%) — an even
  travel put 0 three quarters of the way round, where a level doing nothing
  reads as one turned up. A ±20 band's travel is the even one it always was.
  The player's printed scale stands beside the bands it describes rather than
  at the head of the row, where it read as the preamp's as well.
- **The graphs have two fixed scales and their own analyser.** The EQ's ±20 dB
  on the left never stretches (`gainScale`); the analyser gets 80 dB below the
  programme's peak on the right (`liveGraphBand.ts`, `graphLevelTickFormat`),
  as professional equalisers draw it, because the top octave of most records
  lies more than 40 dB down and a high cut drew nothing there. The graphs draw
  `graphPoints`, not the shared `points`: the plot's whole width (10 Hz to
  Nyquist), each point the power in a twelfth of an octave (three bins of the
  long window at least), divided by Blackman's noise bandwidth so a tone reads
  its own level whichever window reads it. Below the hand-over (~1.2 kHz at
  48 kHz) the shape comes from a 16384-point window and the loudness from the
  fast one over an octave, so a kick lands ~100 ms sooner than the long window
  alone. Reading each point as the bin under it made the two windows disagree
  by up to 9 dB on dense sound, drawn as a cliff at 40-80 Hz ("why these
  peaks?"); keep every window on one quantity. The pump takes its graph
  points from the drawing's reader, so one long transform runs per block of
  audio. The shared `points`
  stay 20 Hz to 20 kHz on the old 40 dB mapping, because the Studio scenes
  stretch them across their texels by position and Smart EQ's presence marks
  read them — change those only with the scenes' calibration. The plot spans
  10 Hz to 25 kHz with the grid on and 20 Hz to 16 kHz with it off (and in
  the player's gridless decks), `graphFrequencyRange`, labelled on the 1-2-5
  series.
- **Every change the engine hears fades, and every band keeps its history.**
  A graph is rebuilt on each config write, and the previous one is freed two
  blocks after the swap, so the fade lives in the new graph: `IirCascade`
  crossfades 20 ms from a copy of the outgoing bands, and each band that is
  still there carries its filter state over (same type, frequency and Q; then
  type and frequency; then type at the same index). The preamp ramps over the
  same 20 ms. A bass +6 → −6 click fell from -68 to -91 dBFS, adding an
  unrelated band from -49 to -104 dBFS. An edit landing mid-fade (a drag)
  keeps fading from the sound before it and switches its incoming side at
  once, so a matched band at 0 dB is unity on its own poles, never a
  pole-less identity that jumps from the band's output to the input in one
  sample: +6 → −6 → 0 leaves -90 dBFS (`graph_test.cpp`,
  `an_edit_landing_mid_fade_on_zero_does_not_click`). The rack's EQ fades
  the same way (`chain_eq_fade.cpp`).
- **A preset switch never steps, and one that moves the delay crosses
  over** (Ivan, 2026-09-25: "make sure the engine when switch preset doesnt
  sound crac and is smooth"). Measured under four low tones through the
  engine's own graph, every factory chain to the next and back, to None and
  to Default: 534 of 636
  switches moved the delay — each preset carries its own Maximizer
  look-ahead, None drops the rack, Game mode and the curves stage change it
  too — and landed at -24 to -30 dBFS above 5 kHz; now none passes -80. Such
  a graph takes nothing from the one before: that one plays on, fed the same
  input, while the new one fills from silence, and after its delay and 40 ms
  the sound crosses over 30 ms (`graph.h`, `start_crossing`; sharing a rack,
  the rack runs once and the old graph plays from after it). A graph still
  filling when the next switch lands is passed over, so held arrows never
  play more than two graphs. The watcher frees no graph a kept one is still
  crossing from (`graph_reclaim.cpp`), and a test that hands over has to keep
  the replaced graph alive the same way (`phase_test.cpp`). Into a longer
  delay, what was heard just before the cross is heard again after it — the
  delay grew by that much — never on top of it. A switch that keeps the delay
  still carries the state, and the rack's stages no longer step there: the
  mono maker runs after the EQ on its own mid/side and crosses in 20 ms (it
  sat inside the EQ's, so turning it on moved every band from left/right to
  mid/side: -42 dBFS), the Maximizer's drive glides and a stage switched off
  lets its reduction go over 50 ms, Bass Forge fades out until its level
  normaliser is back at unity, and Dimension holds its decorrelation off for
  160 ms while an empty all-pass network fills. Held by
  `chain_switch_test.cpp` and `graph_crossing_test.cpp`, each case beside
  the same two outputs spliced unsmoothed as its control.
- **Dimension's Spread makes side out of the centre** (Ivan, 2026-09-25:
  "really add widening stereo fx"). The widths only scale a record's own
  side, so a mono record stayed mono under every profile. The mid above the
  bass corner — through a Linkwitz-Riley high-pass, so the bass stays mono
  (-45 dB at 60 Hz under a 200 Hz corner) — goes through an all-pass network
  of its own and joins the side BEFORE the band split, so the widths act on
  it as on the record's side and the guard closes it; the mono sum stays the
  input's. The network's instantaneous return is taken off first: a copy of
  the centre with no delay in the side is a pan, not a width. Spread 0.5 at
  unity makes a mono record about as wide as an ordinary stereo mix. A
  profile whose centre carries speech or a position (Movie, Gaming) keeps
  the made side 10 dB or more under the centre between 500 Hz and 2 kHz.
- **Auto normalize starts at the curve's own level and climbs back.** The
  app's `Preamp:` becomes the start (`auto_preamp_start_db`, captured at the
  directive so a Preamp in the custom file stays a fixed gain); after 5 s of
  room the level recovers 0.15 dB/s toward 0 dB. Ivan's own design ("don't
  touch my auto normalizer", "recover to 0 dB"); 0.3 dB/s after 3 s made a
  jazz track 10 dB dirtier in its worst second, which is how the rate was
  chosen on five songs.
- **An edit's level is predicted, never climbed to** (engine 1.16, Ivan
  2026-09-23: "jump straight to it and then the auto normalize just
  finetune"). The engine keeps the last 10 s of music as it leaves the rack
  (`input_history.h`, 8 MiB per output at most) and, before publishing an
  edit's graph, replays that music through the new EQ and moves the level
  once at the handover by how much louder or quieter its loudest true peak
  comes out than the chain playing (`level_prediction.h`, `shift_level`).
  The chain playing is judged by the peaks the guard measured on it when it
  has played through the whole window in minimum phase, and replayed
  otherwise — within a drag, by the previous step's replay (the shadow), so
  the steps telescope instead of counting the earlier ones again. Replays are
  always minimum phase (linear costs 8x and shifts peaks up to 1.8 dB) and
  judge 4 s instead of 10 when a curve or impulse is convolved. No music
  heard, Auto normalize off on either side, or a handover from a graph other
  than the one predicted against: the old drop by the worst case and climb.
  On his five songs, 25 edits: the level still moving 2.14 dB in the ten
  seconds after an edit became 0.51; 35–60 ms per edit on the watcher thread.
  What happens after the handover — overloads, the 0.15 dB/s give-back — is
  untouched.
- **With every curve in minimum phase the curves stage adds no delay.** It
  used to keep a linear design's half length in front of every output —
  55 ms with `# FluidEQCurveStage: ON`, curve or not; the minimum-phase
  kernel (16384 taps at 48 kHz, APO's resolution) leaves one partition,
  12.7 ms on his chain. Decided by the phase settings alone, never by which
  curves are present, or adding a curve would move the delay mid-song. With
  no curve at all the stage is a ring of that length, not a convolver
  (`CurveStage`): the 16384-tap kernel with one tap in it was two thirds of
  the engine's work on his chain, 0.13 ms of every 10 ms block against 0.05.
  The ring is fed in both states; a first curve plays the delay until its
  convolvers are warm and then fades in over 20 ms, a last one fades out to
  the delay, and a curve of another length keeps playing until its
  successor is warm (`curve_stage_test.cpp`). A
  linear-phase stage starts on its FIR, which is what stopped it replaying
  the first 0.7 s of every stream. `APOProcess` turns denormals off for its
  call and restores them (`denormals.h`): silence from a paused player cost
  13x the EQ's work without it.
- **Every Linear group shares one filter and one delay** (engine 1.15,
  `ENGINE_SHARED_LINEAR_SINCE`). The bands of each group set to Linear go into
  one `EqPhaseStage` (`linear_phase_`, run first), minimum-phase groups after
  it, so Your EQ and the curves both on Linear cost 352 ms at 48 kHz rather
  than 704 (Ivan: "adding layers wont make it crazy"). The delay is counted
  once, a group leaving Linear hands the stage over without a jump
  (`a_layer_leaving_linear_keeps_the_shared_delay`), and the menu says
  "shared" only over an engine that does it. The sampled-curve stage still
  adds its own 53 ms in Linear; folding it in is open.
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
- **The helper's per-output answer is a snapshot, and an output missing
  from it is unknown, not off.** `status` lists every render endpoint the
  machine had when it ran, so a headset connected since is simply absent —
  and read as "not attached" the side panel said NOT ON THIS OUTPUT, in red,
  over an engine processing it perfectly; pressing the card's button only
  looked like a repair because running the helper re-read the list (Ivan's
  Bluetooth headset, 2026-09-24). `engineOnOutput` answers `undefined` for
  an output with no entry, and `useEngineTrouble` asks the helper again on
  every `fluideq-output-changed` — never on mount, where the status store
  already asks.
- **Under the FluidEQ Engine the app never restarts Windows audio by
  itself, and never enables an output by itself.** The engine on the output
  being listened to but not running, which a restart fixes, gets the trouble
  card ("The FluidEQ Engine isn't running on …") and its Restart button,
  and nothing else. It used to be restarted without a press, once a session
  (`useRestartWhenEngineOff`, gone) — and that restart is an elevated run
  of the setup helper, so every change of output to one Windows had built
  before the engine was on it put an administrator prompt up with nobody
  having asked; Ivan took it out on 2026-09-16 evening ("when changing
  output, if the engine is not activated for that output it needs to ask
  the user"). Do not put it back. The
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
  processing. The trouble card for that state (`neverRan`, its own
  key) drops the restart button, says what FluidEQ already repaired and what
  is left — security software or the sound card's driver — and leads with
  Equalizer APO, the only thing on it that processes sound there. It no longer opens the restart card either: a dialog nobody asked
  for, in the middle of listening, is noise when the restart works; the card
  appears by itself when it fails. The trouble notice is now dismissed for
  the rest of the session per trouble, because the live capture stops with
  the DSP page and starts with it, so the same trouble ended and began on
  every visit and the card came back every time.
- **A DSP rack the engine could not start is mended by a fresh engine, never
  by a restart.** The rack is the one part of the engine the app talks to
  over a wire both sides have to agree on (`fluideq-dsp.txt`), so an engine
  older than the app cannot start it — and on a machine where setup left an
  older or half-installed engine, the EQ played while every DSP effect was
  silently off. Restarting Windows audio starts the same engine again and
  fails the same way; a user hit exactly that, and what mended it was the
  help page's own "put the engine in place" step, found by hand.
  `dsp-rack` is therefore `ONLY_A_NEW_ENGINE` in `engineTrouble.ts`, and
  the card leads with "Update engine" (`handleTroubleshootEnableEngine`,
  the same step) with the restart demoted to the quiet style beside it. It
  adds `engineHealth.engineIsOld` only where main's comparison of the two
  engines by content says so (`IAudioEngineStatus.fluidUpdateReady`, which
  the trouble hook now takes as its third argument) — an engine it could
  not compare is not called old. Equalizer APO comes off that card
  entirely: it has no rack at all, so beside the offer that can bring the
  rack back it is strictly less, and a fourth button spilled the row onto a
  second line in French and Russian (measured in the window at the card's
  620px).
- **Which slot a driver builds is not written down anywhere, so the app
  tries them, newest to oldest, on the machine itself — the slot ladder.**
  An effect can be registered in eight places: the EFX, MFX and SFX lists
  (pids 15, 14, 13) Windows 8.1 and later read, the same three as one class
  id each (pids 7, 6, 5), and the GFX and LFX values (pids 2, 1) everything
  before Windows 8.1 read. The middle three joined the ladder on
  2026-09-19: a Bluetooth headset carried Windows' own two effects in pids
  5 and 6 with no list anywhere on the endpoint, the ladder stepped from the
  lists straight to pids 1 and 2, and the engine came to rest in a value
  that endpoint is never read from — attached on every reading, created by
  Windows not once. They are written under the same rule as pids 1 and 2
  (`is_single_slot`, `plan_attach`): only where the value holds nothing or
  Windows' own default effect, never over a vendor's, and creating no list
  on the way, because a list is the newer generation and its existence is
  what stops an endpoint being read from its singles. `write_fx_values`
  admits them for our own class id on the same terms. And because the ladder
  only ever walked downwards, an output that had already reached the bottom
  would never have been offered a rung added to the middle: the helper's
  per-output memory now holds every slot it was asked for by name, one per
  line, oldest last (`remembered_slots`), the status reports it as
  `slotsTried`, and `nextSlot` picks the first rung nobody has tried — with
  the old ladder's walk implied for a memory written before that. The names
  are `efx-single`, `mfx-single` and `sfx-single` on the command line and in
  that file, so the app gates them on the installed helper's version
  (`ENGINE_SINGLE_SLOTS_SINCE`, engine 1.12): an older one refuses a slot
  name it does not know, which costs an administrator prompt and mends
  nothing. The RME DAC a user tested
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
  the one-value slots are taken only where nothing is registered or where
  Windows' own default effect is ("WM LFX APO" / "WM GFX APO" —
  `kWindowsDefaultApoClsids`, and there are **four** of those, not two:
  `wdmaudio.inf`'s `FX_PREMIX_CLSID`/`FX_POSTMIX_CLSID` and a second pair
  Windows registers beside them, all four resolving to the same
  `WMALFXGFXDSP.dll` under the same two names, with which pair an endpoint
  carries varying by machine. Knowing only the first pair refused every
  one-value rung on a machine carrying the second — "already holds another
  effect", naming a class id that was Windows' own; verify a new one at
  `HKLM\SOFTWARE\Classes\CLSID\<id>\InprocServer32` before adding it), and
  `write_fx_values` admits our own class id and those there and nothing
  else — a vendor's registration is
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
  adds lists), to the newest takeable single on one first found with pids 5
  to 7 and no list (`is_single_only`), to MFX on an output Windows has
  combined (Equalizer APO's rule, the same property) and to EFX otherwise.
  The device list's probe reads all eight values for the engine's id
  (`windows-audio-devices.ps1`, `EngineSlotValues`); reading only ,15 and
  ,14 called a moved engine "not attached" and enabled it again on every
  launch, and ,7 ,6 ,5 joined it with the rungs. Bounded:
  each step is to a rung this output has not been put in before, the gate
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
  `chain_surround_test.cpp` hold both. The card's eleven classic rooms
  (`roomPresets.ts`) are pinned by value in `dspRoomPresets.test.ts` and
  again in `room_presets_test.cpp`, which runs the engine's room through
  them: retune a room on both sides in one commit. `ROOM_PRESETS` in
  `chain.ts` is wire order (the engine logs the index), so an index keeps
  its meaning for good: the eleven and `custom` are the first twelve, the six
  featured rooms came after `custom` was already the twelfth and stand after
  it, and anything newer goes after them — never between. Saved rooms
  (`savedRooms.ts`) keep the shape and never the head, like the presets, and
  a save never replaces a room of the same name: it is numbered
  (`uniqueRoomName`). Bass management
  (`bass_management`, `crossover_hz`, the twenty-fourth and twenty-fifth of
  the room's forty-two wire scalars; `FEQ_CHAIN_PARAM_LEAD` was 140 when
  they landed and is 157 now) is a Linkwitz-Riley 4th-order
  high-pass on every speaker channel and the same low-pass on their sum
  into the sub's path, both ears alike at unity; its coefficients ride the
  kernel set (so a crossover change lands with the set), its histories live
  on the room and cross a handover; the LFE keeps its own 120 Hz one-pole.
  Like the head it is the listener's: no preset or saved room touches it.
  The music upmix (`music_upmix`, `upmix_amount`, the two scalars after
  those; LEAD 142) applies only to a two-channel stream on the front pair:
  the kernel set then holds a kernel for every speaker at the speaker's own
  index, and `feq_room_process` derives seven feeds from the pair — the
  fronts untouched, the centre `0.25·amount·(L+R)`, the side signal
  `0.5·(L−R)` high-passed at 150 Hz through a ring to the sides (10 ms,
  `0.8·amount`, opposite polarities) and the rears (22 ms, `0.6·amount`,
  low-passed at 6 kHz) — and renders each through `render_source`, which
  is also the surround path. The engine reports the state as `music`
  (`ROOM_STATES` on the app side), and the 7.1 offer treats it as a stereo
  fold like `front-stage`. After the upmix's two come each speaker's own
  distance (`speaker_distance_m[7]`, 0 meaning the ring's) and eight mutes
  (`mute[8]`, the sub's last; LEAD 157). The nearest speaker that will be
  heard is the kernel's origin: it arrives at once and at unity, every
  other speaker later by its extra path and quieter by inverse distance
  (`arrivals_for`'s `reference`, capped at half the kernel so a far
  speaker never falls off its end), and the reflections keep their
  geometry from that origin — with every speaker on the ring nothing
  changes, which is what keeps `room_presets_test.cpp` true. A muted
  speaker gets no kernel and the muted sub a zero gain; a room with every
  speaker muted is still active (latency, status). On the card the selected
  speaker's pane (`DspRoomSpeakerPanel`) is always there and becomes a
  speaker's on the press itself; travel past `PRESS_TRAVEL_PX` makes the
  press a drag; Solo is spelled as mutes on the other six
  and never the sub, whose path carries every speaker's managed bass. Held by `room_test.cpp`: nothing after the direct
  sound on a dead-walled front stage, a later ring with the upmix, no side
  signal from a mono record. Which channel is
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
  `assets/room/heads/LICENSES.md`), never HeSuVi's recordings, and
  diffuse-field equalised at build: the raw measurement carries the dummy
  head's ear-canal resonance (+9 dB at 2.5 kHz, -7 dB at 100 Hz on the
  average over the ring), headphones deliver to the listener's own ear
  canal, and the room sounded "mid-like" with it counted twice. The
  average over every direction and ear is inverted (third-octave smoothed,
  80 Hz to 16 kHz, ±12 dB, minimum phase) and `roomHeadsDiffuseField.test.ts`
  holds each head flat within 2.5 dB on that average — rebuild the heads
  with the script, never edit the files. Held by
  `room_test.cpp` (a synthetic head whose delays are known frame counts:
  the left speaker reaches the right ear 16 frames later at 48 kHz, dead
  walls leave nothing after the direct path, a wall change mid-stream
  makes no step beyond either steady room's) and `chain_surround_test.cpp`
  (a six-channel chain folds and reports +512 frames).
- **A head is a filter, and the Room is as loud at 192 kHz as at 48.** It was
  not: `build-room-heads.ts` resampled the heads as if they were sounds —
  the taps kept their height, so a block with twice the taps summed to twice
  as much — and the engine's 192 kHz doubling did the same. A 1 kHz tone
  left the room at -3.8 dB on a 48 kHz output, +2.2 dB at 96 and +8.3 dB at
  192, on both renderers, and the large head played about 1 dB louder than
  the small one inside Fit, where the louder of two sounds is the one that
  gets picked. Every block is now levelled by the inverse of its resampling
  ratio (the rate's and the head size's), anchored so the medium head's
  48 kHz block is the numbers it shipped as; the doubling halves
  (`head_response`, `RoomInterpolation`). `room_profiles_test.cpp` holds the
  same tone within 0.3 dB across the four rates on both renderers.
- **The featured rooms are measured through the shipped head, from the
  app's own table.** `room_profiles_test.cpp` reads
  `room_profiles_fixture.h`, which `generate-room-profiles-fixture.ts` writes
  out of `roomPresets.ts` and `dspRoomProfiles.test.ts` holds to it byte for
  byte: retune a featured room, regenerate the header, same commit. "Off" is
  measured there as a difference — a room whose tail is off renders the same
  samples whatever the tail's decay is set to, with a room whose tail is on
  as the control — because the bass crossover rings on every room and a
  quiet window proves nothing. The tail's loudness is a rule, not a taste:
  at full Ambience it carries what the walls that feed it carry, whatever
  its length (`kLateDrive` in `room_ambience.cpp`, injection by energy). It
  used to sit 40 to 52 dB under those walls — 70 dB under the direct sound,
  heard by nobody at any setting, and quieter the longer it was asked to be.
- **The Room's page hides nothing, and its picker is the one every stage
  has.** A first version put the rooms behind a "Browse" library with a
  profile emblem in the header, and what a room is made of behind "Tune" and
  "Fit" tabs; Ivan sent all of it back on 2026-09-19 ("I want same profile
  select as other filters do on the left top", "is hard to find things tune
  etc", "all filters ui fills the width make this one does"). Do not bring
  them back. The header is the standard `dsp-eq-bar` (`DspRoomBar`: one
  RichPick under three headings — Featured, Classic rooms, Yours — the
  arrows, Reset, Restore profile only while there is one, Save, Delete on a
  saved room); under it a status line saying what is playing (Compare stood
  at its other end, and "My source is already spatial" in the Stereo band,
  until Ivan took both off on 2026-09-19 — each "is same as off" —
  and `clampDspSettings` holds both false, because the engine still reads
  them and a room stored with one on would pass the sound through with
  nothing on the page to say why); then the picture on the left, sticky, and six bands beside
  it in three, two or one columns and never four (six divides by those; four
  left a hole the size of two bands at a 2560px window), each row's name
  over its controls so nothing breaks in two. The selected speaker's pane is
  the first band and is there from the press of a drag; its angle is a typed
  field laid out as a dial, because a knob cannot be typed into. Space and
  Ambience are not drawn on a classic room — they would turn and change
  nothing — and a classic room moves to the new renderer only on its own
  button (`roomOnNewRenderer`). Restore is offered only while the room on the
  card is the card's own last edit of a room it remembers applying
  (`roomProfileMemory.ts`); a custom room met after a restart gets none
  rather than a guess. `.claude/harness-room` (launch entry `room-harness`)
  mounts the real card with a simulated source, account and engine report.
- **Never make the featured rooms wetter by arithmetic, and never add a room
  that measures as another one.** On 2026-09-19 the four rooms with air were
  lifted from walls at -28 dB and a tail at -38 dB to about -21 and -22 —
  still 16 dB under the direct sound, every check green, no third octave
  moved by more than 1.4 dB — and Ivan heard "too much echo on all those and
  same sounding... it was so nice before" within minutes; the values went
  back the same evening. The tail is four delay lines between 30 and 44 ms:
  raised to where it can be picked out, what is picked out is its repeats,
  and it is the same four lines in every room. Live Venue (walls -21, tail
  -26.5) is the wettest room he has called nice and no room exceeds it; a
  wetter one needs a denser tail in the engine first. What tells rooms apart
  is where the speakers stand and what is sent to them, and
  `no_two_rooms_are_one_room` (`room_profiles_test.cpp`) measures it: level,
  width at the ears from 700 Hz to 4 kHz, top against bottom, and on 7.1 the
  centre, a side and a rear against the front above 250 Hz. Three rooms
  written that night measured as copies of others and were taken out again.
  The same measuring found that the sub dial does nothing to a stereo record
  (it is the LFE's; managed bass is at unity), that a speaker's level does
  not reach the managed bass, and that a record leaves every room about 3 dB
  louder and 3 to 4 dB darker than it came — which the rack's Room copies
  answer with five EQ bands in front of the Room (`roomTone.ts`, held by
  `a_room_copy_keeps_its_chains_tone` with the room alone as its control),
  and the Room switched on by hand does not. The whole answer is a tone hold
  inside the second renderer, and it wants his ears before it ships.
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
- **A 3D world is a scene program like any shader, on the same context.**
  A pack's optional `world` (`common/sceneWorld.ts`, format in
  `docs/scene-worlds.md`) is drawn by three.js from `graph/world/`, a bundle
  of its own (`scene-world.js`) that a scene worker `importScripts` only when
  a world arrives, so shader scenes never parse it. `compileScene` builds the
  world or, failing that, the shader — which is also what every older FluidEQ
  plays from the same pack, and why a world pack keeps a real shader as its
  sky. `draw` renders into its own targets and composites into whatever
  framebuffer and scissor the worker left bound, then leaves the context
  reset: that is the whole contract, and it is why FSR, supersampling, FXAA
  and the brightness limiter work on worlds unchanged. Four things measured
  the hard way: the target wrapping the worker's framebuffer
  (`setRenderTargetFramebuffer`) must never be disposed, or three deletes the
  worker's framebuffer; three sizes points from the canvas it was made on,
  never the drawn size, so points read `uWorldPointScale` and never go under
  three pixels (smaller, a star field was invisible); the composite works in
  linear light and adds the world's light to the sky, because keeping only
  light where geometry covered the pixel threw away every glow over empty
  sky; and a still drawn band by band reuses the world rendered for the same
  frame, or each band cost the whole world. A member's world GLSL answers to
  the scene rules (`checkMemberWorldHook`); a world that breaks one plays its
  shader.
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
