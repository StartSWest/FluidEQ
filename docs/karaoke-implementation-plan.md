# FluidEQ Karaoke — implementation plan

This plan implements the scope in `docs/karaoke-spec.md`. It intentionally
delivers a narrow vertical slice before broad format compatibility and scoring.
Every phase ends with a gate; a later phase does not hide a red earlier one.

## Current implementation status

Phase 1 was implemented on 2026-08-11. The Karaoke tab now sits after Media,
persists safely, mounts its workspace on first visit, owns the full center stage
without the shared EQ graph, and ships a responsive local-player surface in all
ten locales.

The Phase 2 foundation was implemented on 2026-08-11 without adding a third-
party dependency. It includes the canonical model, tested LRC/eLRC and
UltraStar parsers, generated/original fixtures, normalized local-file pairing,
file picker and drag/drop, renderer-owned object URL lifecycle, a media-backed
clock driven by one request-animation-frame coordinator, a bounded lyric
window with line/word/syllable progress, accessible play/pause/restart/seek/
lyric-jump/volume controls, structured import/playback errors, malformed-lyric
audio fallback, keyboard shortcuts, and playback that survives a tab change.
Focused parser, clock, file, workspace, microphone, and locale suites pass.
The follow-up session-playlist slice accepts whole folders and recursive folder
drops, pairs same-basename audio/lyrics only inside the same relative folder,
supports adding a matching lyric later, excludes unrelated covers/license
files from pairing, and provides selection, removal, mouse drag, keyboard
reordering, and end-of-song auto-advance. The supplied local `A Talk with
George` UltraStar TXT was validated in place (not copied into the repository):
it parses as 60 lyric lines and 376 target notes linked to its named MP3. Its
CC BY-NC content remains user-import-only and cannot ship with paid FluidEQ.
Lyric rows now stay keyed while gliding through a fixed center focus band with
opacity/scale continuity; upcoming rows remain more readable than completed
ones. Once the last timed token ends, the next phrase moves into focus during
the breathing gap without starting its karaoke fill early. The supplied song
has 59 such gaps (766 ms average, 5,132 ms maximum), so this behavior was
validated against its actual timing structure. Reduced-motion users receive
immediate transitions.
Real packaged-codec checks, a ten-minute drift measurement, ambiguous-pair
candidate UI, and minimum-window/real-file owner review remain open Phase 2
gate evidence; the app was not launched automatically.

The first Phase 3 slice was implemented on 2026-08-11: Karaoke now enumerates
microphone inputs without opening them, remembers the selected input, requests
audio access only from an explicit control, shows a local level meter, supports
live device switching, and releases the mic on tab leave, turn-off, disconnect,
or teardown. The remote Media partition remains default-deny. A generic strict
audio-only handler on the main session was tried and then removed because
Chromium presents FluidEQ's system-output loopback as a mixed display-media
handshake; the handler disabled the existing live output waves. An explicit
main-session policy that distinguishes the user-initiated microphone request
from FluidEQ's trusted loopback remains an open Phase 0/3 security task and
must not regress the graph again. Real Windows permission UI, hardware labels,
USB unplug/replug, and meter movement still require the owner's real-window
check.

The first Phase 4 slice was implemented on 2026-08-11 without adding a third-
party dependency. A pure, allocation-bounded YIN core detects synthetic tones
from 110–880 Hz within the 20-cent budget and rejects silence/low-confidence
frames. A standalone AudioWorklet uses a 2,048-sample window and a 2,304-sample
hop (about 43 ms and 48 ms respectively at 48 kHz), publishes at no more than
about 20 Hz, and reaches the Web Audio destination only through a zero-gain
node. Both webpack builds emit `pitch-worklet.js`; the microphone lifecycle
loads and tears it down with the selected input. The UI now shows note/cents,
a cyan live trace, an honest no-target tuner lane, and violet/gold/free
UltraStar target notes in all ten locales. Focused detector, worklet wiring,
pitch-lane, microphone, workspace, and locale suites pass. A real microphone
launch, actual production-runtime module load, worklet p95 time, sustained FPS,
long-task measurement, loopback coexistence, and the octave-display preference
remain open Phase 0/4 gate evidence; the app was not launched automatically.

## Working rules

- Preserve the current dirty worktree and keep Karaoke changes isolated from
  unrelated EQ work.
- Follow the repository's current architecture instead of introducing Vite,
  Zustand, Tailwind, Radix, Vitest, SQLite, FFmpeg, or a native audio backend.
- Add no advertised format without a real fixture and parser test.
- Add no dependency without the license/transitive/content gate in
  `docs/karaoke-licensing.md`.
- Keep realtime samples out of React state and DSP out of the main UI thread.
- Do not launch FluidEQ automatically. The repository owner performs and
  records real-window/microphone checks when a gate calls for them.
- Run focused tests during each phase, then the proportional full checks at the
  integration gate.

## Phase 0 — feasibility spikes and decisions

Complexity: medium
Production UI change: none

### Work

1. Add a short technical decision record under `docs/` with measured answers
   for:
   - which proposed audio extensions Electron 43 decodes in this build;
   - whether an imported AudioWorklet module is emitted and loaded correctly by
     the current webpack configuration;
   - how the main renderer's `getUserMedia` permission request appears to the
     Electron session handler, including `details.mediaTypes`;
   - whether input labels are available before/after permission and how
     `devicechange` behaves;
   - whether a media element + audio-context anchor survives play, pause, seek,
     rate change, and buffering without measurable drift;
   - whether the current loopback analyser and a mic AudioContext can coexist
     without device contention or feedback.
   - how the selected `fluideq.com` paid-binary + public GPL source model maps
     each installer/update to an immutable Git tag and source archive.
2. Implement throwaway test harnesses only if needed, keep them outside
   user-reachable code, and remove them after measurements are captured.
3. Decide the exact supported audio-extension list from evidence. Update the
   spec if the runtime result differs.

### Gate

- Worklet loads in a production renderer build.
- One real microphone can be granted to the main renderer while a request from
  the Media webview remains denied.
- A ten-minute clock test has a documented measurement method.
- Any unsupported codec is removed from the advertised picker before Phase 2.
- Candidate dependency versions, transitives, notices, and bundled assets pass
  the licensing gate before installation.

### Primary risk retired

This phase prevents building the UI around a worklet, permission policy, or
codec claim that the packaged Electron application cannot actually support.

## Phase 1 — tab and empty workspace

Complexity: small

### Files likely touched

- `src/renderer/App.tsx`
- `src/renderer/styles/App.scss`
- `src/renderer/styles/Karaoke.scss` (new)
- `src/renderer/karaoke/KaraokeWorkspace.tsx` (new)
- `src/common/i18n/en.ts` and the other nine locale files
- `src/__tests__/unit_tests/App.test.tsx`
- a new focused Karaoke workspace component test

### Work

1. Add `'karaoke'` to `TWorkspaceTab` and `WORKSPACE_TABS` immediately after
   `'video'`.
2. Add an accessible tab button labelled through `tabs.karaoke` and keep Config
   separated at the far edge.
3. Mount `KaraokeWorkspace` on first visit and render the empty/loading/error
   shell. Do not add sample lyrics or a fake curve.
4. Add `.workspace-tab-panel--karaoke` to the shared panel surface and implement
   the responsive skeleton.
5. When Karaoke is active, replace/suppress the shared frequency-response graph
   slot so the dedicated pitch area owns that region. Do not change the graph
   behavior on any other tab.
6. Add all new copy to English and provide all ten translations so the existing
   locale parity contract remains intact.
7. Add tab-order, active-state, persistence, invalid-storage, and keyboard-focus
   tests.

### Gate

- The tab order is exactly `… Media, Karaoke, Config`.
- Opening/reloading on Karaoke restores Karaoke; an unknown stored tab falls
  back to EQ.
- Existing Media lifecycle behavior is unchanged.
- Empty state is usable at the minimum window size and contains no hardcoded
  demo content.
- Focused tests, typecheck, and renderer build pass.

## Phase 2 — local files, parsers, clock, lyrics, and transport

Complexity: large

### Files likely added

- `src/common/karaoke/types.ts`
- `src/common/karaoke/lrc.ts`
- `src/common/karaoke/ultrastar.ts`
- `src/common/karaoke/files.ts`
- `src/common/karaoke/clock.ts`
- `src/renderer/karaoke/useKaraokeSession.ts`
- `src/renderer/karaoke/KaraokeLyrics.tsx`
- `src/renderer/karaoke/KaraokeTransport.tsx`
- `src/__tests__/data/read_only/karaoke/` fixtures
- focused common and component tests

### Work

1. Define the discriminated canonical model from the specification.
2. Implement pure LRC/eLRC parsing with BOM/CRLF, metadata, global offset,
   multiple line timestamps, enhanced word tags, ordering, and validation.
3. Implement pure UltraStar parsing for the subset explicitly advertised:
   metadata, BPM/GAP, note rows, note types, page/line breaks, tokens, and target
   MIDI notes. Reject unsupported variants with a specific result.
4. Implement explicit file selection and drag/drop with extension filtering,
   runtime audio decode checks, same-base-name pairing, and an ambiguity state.
5. Create/revoke an object URL for the selected audio and never overwrite the
   user files.
6. Implement `TrackClock` and one animation-frame coordinator. Re-anchor on all
   media state transitions and keep high-rate time out of React state.
7. Render a virtualized/limited lyric window, active line, adjacent context,
   and timed word/syllable fill according to actual precision.
8. Implement accessible transport: play/pause, restart, seek, timeline, time,
   lyric jump, and volume.
9. Keep audio playback alive while another FluidEQ tab is visited; unload and
   revoke resources only when the session is replaced or cleared.

### Tests

- One real fixture per advertised lyric family, plus malformed and edge-case
  fixtures.
- Parser table tests for all cases in the spec.
- Clock tests using a controllable fake media source.
- Object URL and event-listener cleanup tests.
- Component tests for open, ready, playing, paused, seek, ended, no-lyrics,
  malformed-lyrics, and unsupported-audio states.
- A test proving no interval or timeout advances the lyric timeline.

### Gate

- Audio-only, LRC, eLRC, and UltraStar each complete open → play → seek → end.
- Seek updates lyrics in the next rendered frame.
- Ten-minute measured clock drift is no more than 30 ms.
- Leaving Karaoke does not stop its audio; clearing/replacing the session does.
- No unsupported format appears in user copy.

## Phase 3 — microphone lifecycle and input UI

Complexity: medium to large

### Files likely touched/added

- `src/main/main.ts`
- `src/renderer/karaoke/useMicrophone.ts`
- `src/renderer/karaoke/KaraokeMicControls.tsx`
- `src/common/karaoke/microphone.ts` for pure device/state helpers
- focused main, common, and component tests

### Work

1. Add main-session permission check/request handlers that default-deny and
   allow only an audio media request from FluidEQ's main frame. Preserve the
   Media webview partition's existing denial of microphone access.
   The policy must distinguish the microphone action from the display-media
   loopback used by the live spectrum; a generic audio-only session rule is a
   known regression and is not an acceptable implementation.
2. Request mic permission only from an explicit `Turn on mic` action.
3. Enumerate `audioinput` devices, handle initially hidden labels, persist the
   selected id as a preference, refresh on `devicechange`, and fall back visibly
   if the input disappears.
4. Open a mono stream with voice enhancement constraints disabled when the
   platform honors them.
5. Add a level meter using allocation-stable data and a capped visual update
   rate.
6. Implement every teardown path: user off, tab leave, device ended, session
   replacement, component teardown, and AudioContext failure.
7. Add visible states for off, requesting, live, denied, unavailable,
   disconnected, and error. Playback must continue through mic failures.
8. Do not connect audible microphone monitoring.

### Gate

- No mic request occurs on application or tab load.
- The mic opens only after the user action and shows a persistent live
  indicator.
- Leaving Karaoke stops all mic tracks and closes its AudioContext; returning
  does not reopen it automatically.
- A USB input can be unplugged without interrupting song playback and can be
  selected again after reconnection.
- Camera access and Media-webview mic access remain denied.

## Phase 4 — realtime pitch detector and graph

Complexity: large

### Files likely added

- `src/common/karaoke/pitch.ts`
- `src/renderer/karaoke/pitch-worklet.ts`
- `src/renderer/karaoke/KaraokePitchLane.tsx`
- `src/renderer/karaoke/pitchPaint.ts`
- synthetic pitch fixtures/tests

### Work

1. Implement YIN or MPM as a pure detector core with a worklet adapter.
2. Use an approximately 40 ms analysis window and 10 ms hop as a starting point,
   then keep or change those values based on Phase 0/real-device measurements.
3. Add noise gating, confidence rejection, median smoothing, and gaps rather
   than guesses for rejected frames.
4. Publish a capped UI summary while retaining the recent high-rate trace in a
   ring buffer outside React.
5. Render the pitch lane with static grid/target notes and a separately painted
   live trace/playhead.
6. Center the target range around the active phrase; render a live tuner range
   when target notes do not exist.
7. Display target provenance (`UltraStar`) or an honest no-target state.
8. Add detected note/cents readout and an octave-display preference.
9. Measure allocations, long tasks, worklet p95 time, and sustained frame rate.

### Gate

- Clean tones from 110–880 Hz are within 20 cents for accepted frames.
- Detector processing is under 5 ms p95 on the baseline machine.
- Low-confidence/silent input creates a gap, not a held or fabricated note.
- An UltraStar fixture draws target notes; LRC/audio-only never does.
- Playback holds at least 58 fps during a measured pitch session and creates no
  main-thread task over 50 ms attributable to Karaoke.

## Phase 4A — Karaoke treatment for Euphoria mode

Complexity: medium
Dependency: the Canvas lyric and pitch renderers from Phase 4 are green

Euphoria must feel like the singer earned more light, not like a rainbow film
was placed over the interface. The white lyric core, time grid, note names, and
high/in-tune/low meaning remain readable in every frame. No separate Karaoke
toggle is added: the existing FluidEQ Euphoria state and `Ctrl+E` behavior are
the single source of truth.

### Visual treatment

1. Give the Karaoke stage and pitch-lane edges the existing travelling Euphoria
   hue, using the same 3.6-second sweep as the rest of FluidEQ. Do not tint the
   whole panel or place moving color behind text.
2. Keep upcoming lyrics neutral. Paint only the completed portion of the active
   lyric with a restrained spectral gradient while preserving a bright white
   glyph core and sufficient contrast.
3. Keep target notes blue at rest. When the singer is within the existing pitch
   tolerance, let the matching part of the note bloom into the current Euphoria
   hue. A white/cyan center line remains, so matching is still legible without
   relying on color.
4. Paint the singer trace as a thin semantic core plus a soft spectral halo.
   High and low states must continue to read as high and low; Euphoria decorates
   them and never replaces their accuracy colors.
5. Add a small comet head to the current singer trace and a short, pooled spark
   release when a phrase completes with a strong match. Sparks originate from
   the completed note blocks and stay below the lyric area; there is no
   full-screen confetti during normal singing.
6. In full-screen Karaoke, allow a stronger edge halo and slightly longer phrase
   release. In the normal workspace, use the same design at reduced intensity
   so the EQ graph and controls remain dominant.
7. For audio-only or line-timed songs with no melody targets, retain the stage
   edge, active-lyric gradient, and a low-intensity song-energy pulse. Never
   fabricate target matches or a performance celebration.

### Architecture and performance

1. Read the existing root Euphoria state through `useIsRootEuphoric`; do not
   create another store or persist another preference.
2. Animate `--euphoria-hue` on the two Karaoke canvases themselves and read the
   computed hue once per painted frame, following the existing live-trace Canvas
   pattern. Do not publish a frame-rate custom property on the document root.
3. Pass the Euphoria boolean into the lyric and pitch painters through stable
   refs so a color sweep never causes React to rebuild the Karaoke workspace.
4. Reuse the existing lyric and pitch canvases. The effect must add zero lyric,
   note, spark, or trace DOM nodes.
5. If song energy is needed for no-target sessions, isolate the existing live
   audio subscription in a null-rendering bridge that writes a quantized
   12-step energy value to a ref. Only the bridge may wake at analyser rate;
   neither workspace nor either Canvas owner may rerender for each audio frame.
6. Use a fixed particle pool of at most 48 entries, reuse hit/paint buffers, and
   stop the particle loop as soon as the last spark expires.
7. When Euphoria is off, skip hue reads, gradients, particle updates, and extra
   paint passes. The off path must remain visually and measurably identical to
   normal Karaoke.

### Accessibility and safety

- Under `prefers-reduced-motion`, hold one spectral accent color, disable the
  comet/sparks and hue travel, and keep the match bloom static.
- Preserve WCAG-readable lyric contrast and never reduce the white lyric core
  below its normal-mode opacity.
- Do not flash the full stage. Phrase celebrations use one eased rise and decay,
  with no rapid alternation or strobe frequencies.
- Microphone permission, pitch analysis, playback, scoring, and Euphoria unlock
  rules remain completely independent of this cosmetic treatment.

### Tests and gate

- Unit-test that toggling the existing Euphoria state changes Canvas paint mode
  without mounting additional lyric/note elements.
- Test target match, high, low, missed, no-target, paused, and microphone-off
  frames in normal and Euphoria modes.
- Test reduced motion and normal/full-screen intensity selection.
- Record a five-minute Euphoria Karaoke performance at 125% Windows scaling.
  It must hold at least 58 fps, add no Karaoke long task over 50 ms, and show no
  sustained heap growth after particle pools have settled.
- The phase passes only when lyrics stay as readable as normal mode and pitch
  direction remains understandable without the spectral halo.

## Phase 5 — broad import compatibility

Complexity: large, delivered as independent sub-phases
Dependency: the Phase 2 importer registry and clock are green

### Phase 5A — ZIP and CD+G

1. Add `fflate` only after its exact-version/transitive audit.
2. Add safe asynchronous ZIP inspection with entry-count, path, expansion-ratio,
   per-entry, and total-uncompressed limits.
3. Pair `.cdg` with audio by normalized base name and present ambiguity rather
   than guessing.
4. Implement a bounds-checked CD+G decoder and deterministic seek by snapshot +
   replay or measured full replay.
5. Test every used CD+G command against original/generated fixtures and one
   lawfully obtained real file pair.

Gate: a folder pair and ZIP pair complete import → play → seek → end; malformed
packets and hostile archives fail without blocking the UI or writing files.

### Phase 5B — KAR/MIDI and synthesis

1. Spike `spessasynth_core`/browser wrapper against `@tonejs/midi`; select the
   smallest solution that correctly exposes KAR lyrics, tempo maps, melody
   notes, seek, and synthesis.
2. Audit the exact library/transitive versions and exclude upstream demo songs,
   SoundFonts, and UI assets.
3. Support `.kar`, `.mid`, `.midi`, and `.rmi`; enable `.xmf`/`.mxmf` only if
   real fixtures pass.
4. Accept a user-supplied SoundFont/DLS initially. Bundle none until a separate
   asset-license record proves paid-product redistribution rights.
5. Normalize MIDI lyric events and real melody notes into the canonical model.

Gate: real KAR fixtures with tempo changes play and seek reproducibly, lyrics
stay synchronized, target notes identify their track/provenance, and missing or
invalid SoundFonts have an honest recoverable state.

### Phase 5C — subtitle, XML, and embedded lyrics

1. Add SRT and WebVTT pure parsers.
2. Parse the ASS/SSA karaoke timing subset (`\\k`, `\\K`, `\\kf`, `\\ko`) in
   pure TypeScript; use libass only if a later requirement needs faithful style
   rendering and the native packaging spike passes.
3. Add TTML/XML through a pinned, audited XML parser with DTD/external-entity
   rejection and resource limits.
4. Evaluate `music-metadata` for embedded unsynchronized/synchronized lyrics;
   add only the fields and containers verified by fixtures.

Gate: each enabled extension has a real fixture, malformed/security cases, and
an exact timing-precision label in the UI.

### Phase 5D — video and proprietary-format triage

1. Build a codec/container capability matrix from the packaged Electron runtime
   and enable only combinations that actually decode.
2. Support supported video plus same-base-name lyric overlays.
3. Add signature probes for KFN/KOK/other requested containers that return
   supported, recognized-unsupported, encrypted, malformed, or unknown.
4. Implement only lawfully readable, unencrypted variants.
5. Evaluate FFmpeg only as a separately approved milestone with a reproducible
   GPL-compatible build, exact corresponding source/config/notices, and codec-
   patent review. Never enable nonfree components.

Gate: the UI never promises “any file”; it reports why each selection did or did
not import, and encrypted/protected files are never bypassed.

## Phase 6 — scoring and calibration (follow-up release)

Complexity: medium to large
Dependency: Phases 0–4 green

### Work

1. Add deterministic score math only for songs with real target notes.
2. Compare cents within a documented tolerance, weight by duration, distinguish
   free/golden notes, and define how octave correction affects comparison.
3. Add phrase feedback and final result without obscuring lyrics.
4. Add a user-controlled lyric offset.
5. Add measured microphone/input latency calibration; store the result by input
   device and sample-rate context rather than as one universal number.
6. Keep scoring off/unavailable for sessions without a real target.

### Gate

- Synthetic in-tune performance scores materially higher than intentionally
  sharp/flat fixtures with exact expected ranges.
- A real calibrated 220 Hz run meets the 20-cent accuracy budget.
- Offset/calibration changes do not alter the source files.
- Scoring remains unavailable for LRC-only and audio-only sessions.

## Phase 7 — integration, regression, and release evidence

Complexity: medium

### Automated checks

Run after a clean build is present, respecting the repository's Jest setup:

```text
pnpm typecheck
pnpm typecheck:styles
pnpm build
pnpm test:unit -- --runInBand
pnpm lint
```

During development, prefer the smallest relevant Jest paths first. The final
gate must also cover existing App, Media, live-output, output-mirror, graph, and
i18n tests because Karaoke touches their host and audio-permission environment.

### Manual owner checks

1. Launch the development application and capture empty, LRC, UltraStar,
   no-target, mic-denied, and mic-live screenshots.
2. Verify at minimum size, 1920×1080, 125% Windows scaling, keyboard-only, and
   reduced motion.
3. Measure the ten-minute drift, detector accuracy, worklet time, frame rate,
   and long tasks using the method recorded in Phase 0.
4. Test built-in laptop mic and one USB mic, including unplug/replug.
5. Play Karaoke, switch through EQ and Media, return, and confirm playback/mic
   lifecycle matches the specification.
6. Confirm no karaoke file or mic data appears in network activity and no
   permission is granted to a remote Media page.
7. Confirm Equalizer APO engine-off/missing states do not disable Karaoke; local
   playback and mic analysis are independent of APO availability.
8. Exercise every enabled importer with the release fixture and verify that
   unsupported/protected files produce the documented diagnostic.
9. Produce the production SBOM, third-party notices, content provenance
   manifest, exact release source archive/build instructions, and corresponding
   source for every shipped GPL/LGPL component.
10. Verify that the `fluideq.com` product/download entry and auto-update release
    map the binary version to the immutable Git tag/source archive and impose no
    terms that contradict GPL rights.

### Gate

- All release criteria in the specification have evidence.
- No regression in Media playback persistence, output capture, mirroring,
  frequency graph, workspace sizing, or locale parity.
- Documentation lists only the formats and behaviors that passed.
- The paid-release license checklist passes; “free to download” is not accepted
  as commercial redistribution evidence for code or content.

## Recommended pull-request sequence

Keep reviews bounded and reversions safe:

1. **PR 1:** Phase 0 decision record only.
2. **PR 2:** Tab, empty state, styles, i18n, and host-layout tests.
3. **PR 3:** Canonical model, parsers, fixtures, loader, clock, lyrics, and
   transport.
4. **PR 4:** Electron permission policy, mic lifecycle, input selector, and
   level meter.
5. **PR 5:** Worklet pitch detector and pitch lane.
6. **PR 5A:** Canvas-only Euphoria treatment after the normal pitch lane is
   measured and stable.
7. **PRs 6A–6D:** One compatibility wave per PR: CD+G/ZIP, MIDI/KAR,
   subtitle/XML/embedded lyrics, then video/proprietary triage.
8. **PR 7:** Integration polish, licensing artifacts, documentation, and
   measured release evidence.
9. **Later PR:** Scoring and calibration after the base feature ships cleanly.

## Risk register

| Risk                                                              | Impact                                  | Mitigation / stop condition                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| AudioWorklet bundling fails in current webpack                    | Blocks pitch analysis                   | Retire in Phase 0. Prefer a small webpack asset rule; do not move the whole app to Vite.                                                          |
| Electron permission policy accidentally grants remote mic access  | Critical privacy/security defect        | Default-deny main session, verify requester/frame/media type, keep Media partition denial, add main-process tests and a manual remote-page check. |
| Mic path feeds output and causes feedback                         | Hearing/user trust risk                 | Zero-gain analysis path, no monitoring in first release, teardown tests.                                                                          |
| System loopback and mic contexts contend                          | Existing graph/mirror regression        | Coexistence spike and regression tests; if necessary pause only the Karaoke mic with an explicit message, never the system-wide EQ.               |
| Codec support differs from extension list                         | Broken import promise                   | Runtime capability/decode test and evidence-based picker list.                                                                                    |
| React rerenders at pitch rate                                     | Jank and memory growth                  | Worklet/ring buffer/canvas, capped UI summaries, performance gate.                                                                                |
| Shared graph layout becomes cramped                               | Poor Karaoke UI or EQ regression        | Replace only the center graph slot while Karaoke is active; preserve other tabs and test minimum-size behavior.                                   |
| UltraStar variants exceed initial parser                          | Incorrect notes/scoring                 | Advertise a documented subset; reject unknown variants honestly and expand only with fixtures.                                                    |
| A “free” library or SoundFont forbids commercial use              | Paid release violates third-party terms | Accept only exact audited licenses; maintain SBOM/notices and a separate content provenance manifest.                                             |
| Paid binary is not matched to exact public source                 | GPL distribution noncompliance          | Immutable tag/archive per installer and update; link it from the matching `fluideq.com` release and retain old source releases.                   |
| FFmpeg enables incompatible/nonfree components or patented codecs | License/patent exposure                 | Keep optional; require a GPL-compatible reproducible build, corresponding source/notices, no nonfree components, and patent review.               |
| Archive or binary importer processes hostile input                | Traversal, memory exhaustion, crash     | Bounded probes, worker execution, DataView checks, ZIP limits, XML entity rejection, fuzz/security fixtures.                                      |
| Existing dirty work overlaps App/i18n/main                        | Merge mistakes or lost user work        | Inspect diffs before every phase, patch narrowly, never reset unrelated changes, and split PRs by boundary.                                       |

## Definition of done

Karaoke is not done because a tab renders or because a unit test passes. It is
done when the first-release acceptance criteria in the specification pass, the
existing FluidEQ surfaces remain green, the owner has run the real application,
and the measured synchronization, pitch, permission, cleanup, and rendering
evidence is recorded.
