# FluidEQ Karaoke — product and technical specification

Status: Draft for implementation review
Target: FluidEQ 1.x on Windows
Source reviewed: the provided master Karaoke prompt

## 1. Decision summary

FluidEQ should gain a `Karaoke` workspace tab immediately after `Media` and
before `Config`. The tab is a local, account-free karaoke player that uses the
visual language already established by FluidEQ. Its first useful release loads
audio and lyrics supplied by the user, keeps lyrics synchronized to playback,
accepts a selectable microphone input, displays the singer's detected pitch,
and shows a target pitch only when the song file contains real pitch data.

This is an addition to FluidEQ, not a second application embedded inside it.
The existing Electron, React, TypeScript, webpack, Sass, Jest, context bridge,
theme, localization, and test conventions remain in place.

## 2. Review of the source prompt

### Keep

The following ideas fit FluidEQ and should survive the adaptation:

- A clock abstraction read on every `requestAnimationFrame`, never lyric
  advancement driven by `setInterval` or `setTimeout`.
- One canonical song model between file parsers and the UI.
- Honest pitch provenance: target notes from UltraStar or another real source,
  and an explicit “no target pitch” state when none exists.
- Pitch detection outside the React render loop, using an `AudioWorklet`.
- Microphone processing with browser voice enhancement disabled for accurate
  pitch measurement.
- Local-first operation with user-owned content and no bundled copyrighted
  songs or lyrics.
- A dark, lyric-first interface with a separate pitch lane, transport, keyboard
  access, reduced-motion support, and measurable performance gates.
- A fixture and parser test for every format advertised in the UI.

### Adapt to the current repository

| Source-prompt assumption                            | FluidEQ decision                                                                                                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create a new Electron + Vite application            | Extend the existing Electron 43 + webpack application. No build-system migration.                                                                                            |
| Zustand state, Tailwind and Radix                   | Use React state/context and existing Sass/widgets. Add a state library only if measured complexity later justifies it.                                                       |
| Vitest and a new project layout                     | Use the existing Jest suite and repository layout. Pure karaoke code lives under `src/common/karaoke`; UI and realtime audio live under `src/renderer/karaoke`.              |
| Cross-platform release from the first milestone     | Treat Windows as the supported product target because FluidEQ is built around Equalizer APO. Keep browser-level karaoke code portable, but do not claim macOS/Linux support. |
| Two clocks from day one                             | Implement only the track-backed clock the Karaoke product needs. Do not carry unused clock modes into the model.                                                             |
| SQLite library and every format in one milestone    | Begin with session-based local files, then add importer waves. A format is enabled only after a fixture, parser/decoder test, and real-file run pass.                        |
| Subscription and entitlements                       | Exclude. FluidEQ currently promises free, open-source, account-free software with no paywall.                                                                                |
| FFmpeg, native multichannel audio and AI separation | Exclude from the first release; each adds packaging, licensing, performance, and platform risk.                                                                              |

### Reject as an initial implementation plan

The source prompt is coherent as a vision document for a new commercial
product, but it is not executable as one FluidEQ feature. Its H0–H12 sequence
would rebuild technology FluidEQ already has, introduce conflicting frameworks,
and combine Karaoke, licensing, billing, content import, DSP, cloud/team
features, and signed distribution in one critical path. That
scope would delay validation of the requested tab and make regressions in the
existing equalizer much more likely.

## 3. Product goals

1. Let a user open local songs, matching lyric files, or a whole selected
   folder as a session playlist without creating an account or importing it
   into a permanent library.
2. Present lyrics in a polished, highly readable Karaoke workspace that feels
   native to FluidEQ.
3. Capture a microphone chosen by the user and show input level and detected
   pitch without recording or uploading audio.
4. Keep lyric and pitch visuals synchronized during play, pause, seek, and
   playback-rate changes.
5. Continue song playback while the user briefly visits another FluidEQ tab,
   matching the useful persistence of the existing Media player.
6. Fail honestly and locally: malformed lyrics, unsupported codecs, denied mic
   permission, lost devices, and absent pitch data all have explicit states.
7. Grow toward the widest practical karaoke-file compatibility through isolated
   import adapters rather than binding the UI to one vendor format.
8. Use dependencies whose licenses are audited for commercial distribution and
   keep an exact notice/source-compliance record for everything shipped.

## 4. Scope

### 4.1 First useful release

- `Karaoke` tab after `Media`, remembered through the existing workspace-tab
  preference.
- Empty state with `Open song`, `Add folder`, and recursive drag-and-drop.
- A session-only playlist of audio files, each with zero or one unambiguous
  matching lyric file. Users can select, remove, and reorder entries; playback
  advances to the next entry when one ends.
- Audio formats offered by the picker: MP3, WAV, OGG, FLAC, and M4A. Support is
  confirmed at runtime with the media element; a format the current Chromium
  build cannot decode produces an unsupported-codec message and is not called
  supported merely because the extension matched.
- Lyric formats:
  - `.lrc`: line timestamps.
  - enhanced `.lrc`/`.elrc`: word timestamps when present.
  - UltraStar `.txt`: lyric syllables, note duration, BPM/GAP, and real target
    pitch.
- Metadata from the selected files or parser: title, artist, duration, lyric
  precision, and pitch source.
- Play/pause, seek, elapsed/remaining time, volume, previous/next lyric line,
  and restart.
- Synchronized lyric list with active-line focus and progressive word/syllable
  fill when timing precision supports it.
- Selectable microphone, explicit on/off control, live level meter, detected
  note/cents, and live pitch trace.
- Target pitch lane only for a source that supplies target notes. LRC-only and
  audio-only sessions show a useful live tuner with “No target pitch in this
  song,” not a decorative target curve.
- Keyboard control and complete localization through the existing ten-locale
  key-parity system.
- No network requirement and no network call from the Karaoke feature.

### 4.2 Follow-up release

- Deterministic scoring for UltraStar songs.
- Global lyric offset calibration stored as a preference.
- Per-input microphone latency calibration.
- The compatibility waves in section 4.3.
- A small recent-file list if a safe reopen mechanism is designed; no silent
  filesystem scan.
- Optional microphone monitoring only after latency and feedback safeguards are
  measured on real hardware.

### 4.3 Import compatibility waves

The goal is broad practical import, not a misleading `*.*` picker. Each wave is
independent and ships as soon as its own tests and legal gate pass.

| Wave                         | File families                                                                                        | Planned behavior                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation                   | Audio + `.lrc`, `.elrc`, UltraStar `.txt`                                                            | Local playback, line/word/syllable timing, UltraStar target notes.                                                                                          |
| A — packaged classic karaoke | `.cdg` + matching audio; `.zip` containing the pair                                                  | Decode CD+G commands to a 300×216 surface synchronized to the audio clock. ZIP import is size/path constrained.                                             |
| B — MIDI karaoke             | `.kar`, `.mid`, `.midi`, `.rmi`; later `.xmf`/`.mxmf` if the selected engine proves them             | Parse lyric/meta events and melody; synthesize with a commercially redistributable SoundFont/DLS or one explicitly supplied by the user.                    |
| C — subtitle lyrics          | `.srt`, `.vtt`, `.ass`, `.ssa`, `.ttml`, compatible `.xml`                                           | Normalize line, word, or karaoke-tag timing. Unsupported styling is ignored safely while timing/text survives.                                              |
| D — embedded metadata        | Unsynchronized/synchronized lyrics embedded in supported audio containers                            | Extract metadata without modifying the source; report the actual timing precision.                                                                          |
| E — video karaoke            | `.mp4`, `.webm`, and any additional container the shipped decoder proves it can open; sidecar lyrics | Play embedded-video lyrics as-is and optionally overlay a same-base-name supported lyric file. Do not advertise extensions on assumption.                   |
| F — legacy/proprietary       | `.kfn`, `.kok`, and other detected containers                                                        | Inspect and import only documented or lawfully readable, unencrypted content. Encrypted/DRM material is reported as unsupported; no protection is bypassed. |

For an unknown file, the importer performs bounded signature detection and
returns one of `supported`, `recognized-but-unsupported`, `encrypted`,
`malformed`, or `unknown`. It never guesses a format solely from an extension.

### 4.4 Explicitly out of scope

- A permanent song library, watched folders, SQLite, cloud sync, or 10,000-song
  indexing.
- Subscription, accounts, telemetry, catalog or content downloads.
- Vocal removal, stem separation, transposition, tempo-preserving DSP, effects,
  pads, recording, duet, and multichannel in-ear routing.
- Circumvention of encryption, DRM, access control, passwords, or proprietary
  protections.
- Bundled commercial songs, lyrics, videos, or SoundFonts without a separately
  verified right to redistribute them in a paid product.

## 5. User experience

### 5.1 Placement and shell behavior

Tab order:

`EQ · AutoEQ · Voicing · Convolution · Media · Karaoke · Config`

`Config` retains its visual separation at the far end. The tab uses the same
semantics, focus treatment, persistence, and active-state styling as the other
workspace tabs.

When Karaoke is active, the shared frequency-response chart is replaced in the
center workspace by the karaoke pitch lane. Showing two unrelated graphs would
be confusing and would leave neither enough vertical space. The left engine
rail and right output/profile rail remain available on wide windows so users
can see the active system path; responsive rules may collapse them at narrow
widths. Full-window Karaoke focus mode can be added after the base layout is
proven.

The Karaoke player mounts on first visit and remains mounted while a song is
loaded, so switching to EQ does not stop playback. Microphone capture is more
privacy-sensitive: leaving Karaoke turns the microphone off and releases its
tracks. Returning never reopens a microphone without another explicit press.

### 5.2 Main layout

```text
┌ Song / artist ─ source badges ─────────── Open song · settings ┐
│  00:12.4  previous lyric                                      │
│▶ 00:16.8  CURRENT LYRIC, with timed fill                  ●   │
│  00:21.2  next lyric                                          │
├ Target and live pitch ─────────────── Mic input · level · note ┤
│  +12 ───── target notes / arrows ───────────────────────────   │
│    0 ───── live singer trace ───────────────────────────────   │
│  -12 ───────────────────────────────────────────────────────   │
├ Open/restart · play · timeline · time · volume ───────────────┤
└────────────────────────────────────────────────────────────────┘
```

The layout borrows the source prompt's strong hierarchy but uses FluidEQ's
existing cyan, violet, amber, and near-white palette. Red and green do not mean
“down” and “up”: those colors would be read as wrong and right. Pitch direction
uses arrows and line shape, with color as a secondary cue.

### 5.3 States

- **Empty:** explains the accepted pair of files and offers open/drop actions.
- **Loading:** parses metadata and lyrics without showing fabricated progress.
- **Ready/paused:** current line and start control are prominent.
- **Playing:** lyric focus, timed fill, playhead, target notes, and live trace
  update from one animation-frame snapshot.
- **Mic permission required:** no browser-style surprise prompt on load; the
  request follows an explicit `Turn on mic` press.
- **Mic denied/unavailable:** playback and lyrics continue; retry and system
  guidance are local to the mic control.
- **Mic disconnected:** stop the affected tracks, keep playback running, and
  offer the refreshed input list.
- **No lyrics:** audio transport and live tuner remain usable.
- **No target pitch:** live tuner remains usable; scoring is unavailable.
- **Malformed lyrics:** name the file and parser error, keep the audio usable,
  and do not partially claim unsupported timing.
- **Unsupported audio:** preserve the lyric selection but disable playback and
  explain that this Chromium build could not decode the file.

### 5.4 Keyboard and accessibility

- `Space`: play/pause when focus is not in a control that consumes Space.
- `Left` / `Right`: seek by five seconds; modified arrows may seek farther.
- `Home`: restart.
- `M`: microphone on/off only when Karaoke is the active tab.
- Tab order follows header, lyrics, mic controls, pitch controls, transport.
- Active lyric is exposed with `aria-current`; transport controls have explicit
  names and state.
- Time values use tabular numerals, contrast meets WCAG AA, and color is never
  the only pitch or status signal.
- `prefers-reduced-motion` removes decorative transitions but not the functional
  playhead or timed lyric indication.

## 6. Canonical model

```ts
type KaraokeTimingPrecision = 'none' | 'line' | 'word' | 'syllable';

interface KaraokeToken {
  text: string;
  startMs?: number;
  endMs?: number;
  targetMidi?: number;
  kind?: 'normal' | 'golden' | 'free';
}

interface KaraokeLine {
  id: string;
  startMs?: number;
  endMs?: number;
  tokens: KaraokeToken[];
}

type KaraokePitchTarget =
  | { kind: 'notes'; source: 'ultrastar' | 'midi'; notes: KaraokeToken[] }
  | { kind: 'none'; reason: 'missing' | 'unsupported' | 'invalid' };

interface KaraokeAsset {
  id: string;
  role: 'audio' | 'video' | 'lyrics' | 'cdg' | 'midi' | 'soundfont';
  file: File;
  extension: string;
}

interface KaraokeSong {
  id: string;
  title: string;
  artist?: string;
  durationMs?: number;
  assets: KaraokeAsset[];
  timingPrecision: KaraokeTimingPrecision;
  lines: KaraokeLine[];
  pitch: KaraokePitchTarget;
  meta: {
    sourceFormat:
      | 'audio-only'
      | 'lrc'
      | 'elrc'
      | 'ultrastar'
      | 'cdg'
      | 'midi'
      | 'subtitle'
      | 'ttml'
      | 'video';
    gapMs: number;
    bpm?: number;
  };
}
```

`File` is a renderer-session handle, not durable library storage. Object URLs
created for playback are revoked when replaced or when the workspace unmounts.
The original file is never modified.

## 7. Technical architecture

### 7.1 Modules

Suggested boundaries:

- `src/common/karaoke/types.ts` — canonical data and discriminated unions.
- `src/common/karaoke/lrc.ts` — pure LRC/eLRC parser.
- `src/common/karaoke/ultrastar.ts` — pure UltraStar parser.
- `src/common/karaoke/importers/` — one adapter per additional format family,
  all returning the canonical model and structured diagnostics.
- `src/common/karaoke/clock.ts` — clock contract and pure time math.
- `src/common/karaoke/pitch.ts` — note/cents conversion, confidence filtering,
  trend and scoring math.
- `src/renderer/karaoke/KaraokeWorkspace.tsx` — composition and visible states.
- `src/renderer/karaoke/useKaraokeSession.ts` — playback/session lifecycle.
- `src/renderer/karaoke/useMicrophone.ts` — permission, devices, tracks, and
  cleanup.
- `src/renderer/karaoke/KaraokeLyrics.tsx` — virtualized lyric presentation.
- `src/renderer/karaoke/KaraokePitchLane.tsx` — static target plus live trace.
- `src/renderer/karaoke/KaraokeTransport.tsx` — accessible transport.
- `src/renderer/karaoke/pitch-worklet.ts` — realtime F0 detector.
- `src/renderer/styles/Karaoke.scss` — FluidEQ-native presentation.

Component names may change, but the pure parsers/math, React UI, realtime work,
and Electron permission policy must remain separate.

### 7.2 Clock and synchronization

```ts
interface KaraokeClockSnapshot {
  nowMs: number;
  durationMs: number;
  state: 'empty' | 'loading' | 'paused' | 'playing' | 'ended' | 'error';
}

interface KaraokeClock {
  read(): KaraokeClockSnapshot;
  play(): Promise<void>;
  pause(): void;
  seek(nextMs: number): void;
}
```

The first implementation is a track-backed clock anchored to the media element
and audio context. Play, pause, seek, rate change, `waiting`, and `ended`
re-anchor it. One `requestAnimationFrame` loop reads one snapshot and supplies
the lyric playhead and pitch lane for that frame. React state receives coarse
status changes; it does not receive a 60/100 Hz stream.

The feature includes a user-visible lyric offset but does not pretend that
`outputLatency` alone can identify every hardware/driver delay. A future
calibration flow can sit behind the same clock without changing parsers or UI.

### 7.3 Microphone pipeline

The microphone does not reuse `LiveAudioProvider`. That provider captures the
system output for FluidEQ's spectrum and mirror features; a singer's input is a
different source, permission, lifecycle, sampling rate, and privacy boundary.

On an explicit user action:

1. Request one audio track with the chosen device id and, when honored by the
   platform, `echoCancellation: false`, `noiseSuppression: false`,
   `autoGainControl: false`, and `channelCount: 1`.
2. Create an interactive-latency `AudioContext` and a media-stream source.
3. Send mono samples to an `AudioWorklet` running YIN or MPM pitch detection.
4. Apply a noise gate and confidence threshold before publishing pitch frames.
5. Post a throttled visual summary to the renderer; retain high-rate samples in
   a ring buffer outside React.
6. Connect through zero gain when the browser requires an output connection for
   worklet processing. Do not audibly monitor the mic in the first release.
7. On off, tab leave, device loss, or teardown: stop every track, disconnect
   nodes, close the context, clear buffers, and update the visible state.

The existing loopback capture may continue independently. Karaoke must not feed
the microphone into it and must not create a feedback route to the selected
output.

### 7.4 Pitch lane

- Vertical scale defaults to ±12 semitones around the active phrase center and
  expands when real target notes exceed it.
- Horizontal scale is a sliding time window with the playhead slightly left of
  center so upcoming notes have more room.
- Static grid and target notes may use SVG/DOM; the live trace and playhead use
  Canvas or a similarly allocation-stable layer.
- Target notes show lyric tokens where space permits and expose direction with
  arrows.
- The singer trace is visually distinct, with low-confidence gaps left empty.
- Octave correction is a scoring/view preference, never a rewrite of the raw
  detected value.
- Without target notes, the lane becomes a live tuner and history trace rather
  than hiding behind fake data.

### 7.5 File acquisition and importer registry

The first release uses explicit renderer file/folder inputs and recursive
drag/drop. This keeps filesystem access scoped to entries the user selected and
avoids adding a broad path-reading IPC API. Folder contents remain session-only
`File` handles. Pairing rules are:

1. Prefer an explicitly selected audio + lyric pair.
2. For a multi-file/folder import, pair a lyric and audio file with the same
   normalized base name and relative parent directory.
3. For UltraStar, honor its audio metadata only when the named file is among
   the files selected by the user; never read an arbitrary sibling path.
4. If pairing is ambiguous, show the candidates and require a choice.
5. Ignore covers, backgrounds, license text, and other unrelated siblings for
   lyric pairing; do not mistake a generic `License.txt` for song lyrics.
6. Adding a matching lyric later updates the existing playlist entry rather
   than creating a second song.

No recent path is persisted in this release because a browser `File` cannot be
safely reopened after restart. A later recent-files feature requires a narrow,
typed main-process contract and stale/missing-file handling.

Additional formats plug into an importer registry:

```ts
interface KaraokeImporter {
  id: string;
  probe(files: readonly File[]): Promise<KaraokeProbeResult>;
  import(files: readonly File[]): Promise<KaraokeImportResult>;
}
```

Probe work is bounded by byte and time limits. ZIP entries reject absolute
paths, `..` traversal, excessive expansion ratios, excessive entry counts, and
oversized uncompressed totals. XML disables/rejects DTD and external entities.
Binary parsers use `DataView` with explicit bounds checks. One importer failure
does not crash the registry or discard other files selected by the user.

### 7.6 Electron permission boundary

The main session must have explicit permission request/check handlers before the
feature ships. They may grant microphone media access only when all of these are
true:

- the requester is FluidEQ's main renderer/main frame;
- the request is for audio media, never camera/video;
- the request follows the feature's explicit user action;
- the requester is not the persistent Media webview partition or one of its
  remote pages.

All other permission requests remain denied. The renderer gets no Node access,
parsers treat lyric input as text, and lyric content is rendered as text rather
than injected HTML.

## 8. Commercial distribution and dependency licensing

The commercial/licensing strategy is part of the architecture, not a final
release chore. The detailed policy and candidate audit are in
`docs/karaoke-licensing.md`.

The selected model is an official paid FluidEQ build on `fluideq.com` with the
complete corresponding source public on GitHub under GPL-3.0-or-later.
Recipients retain GPL source, modification, build, and redistribution rights.
Each paid binary version links to an immutable matching source tag/archive,
license, notices, and build instructions; website terms do not add restrictions
that conflict with the GPL.

New Karaoke dependencies default to MIT, ISC, BSD-2/3-Clause, Apache-2.0, CC0,
or public-domain code. GPL-3.0-compatible and LGPL components are also allowed
when their exact source, notices, linking/replacement rules, and combined-work
requirements are fulfilled. GPL-2.0-only, unapproved AGPL, noncommercial,
incompatible proprietary/freeware, and unlicensed code are rejected.

Licensing code does not license content. Every bundled song, lyric, video,
SoundFont, model, font, and fixture needs its own redistribution and commercial
use evidence. User-imported content remains the user's responsibility and is
never redistributed by FluidEQ.

## 9. Persistence and privacy

Persist only preferences:

- last selected microphone device id, with a fallback when it disappears;
- lyric offset;
- pitch-view preferences;
- last volume.

Do not persist microphone samples, detected pitch history, lyrics, audio bytes,
raw paths, or scores in the first release. Karaoke performs no network request,
records no audio, and provides no monitoring until explicitly added later. A
visible mic-active state exists whenever a track is live.

## 10. Performance and quality budgets

| Metric                                                   | Required result                                      |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Lyric/playhead drift against the track clock             | ≤ 30 ms after 10 minutes                             |
| Seek to corrected lyric and graph                        | Next animation frame after the seek event            |
| Active playback rendering                                | ≥ 58 fps sustained on the supported baseline machine |
| Pitch detector error on clean sine fixtures, 110–880 Hz  | ≤ 20 cents for accepted frames                       |
| Pitch worklet processing                                 | < 5 ms p95 per analysis hop on the baseline machine  |
| Microphone start after permission already exists         | < 1.5 s                                              |
| React updates from pitch stream                          | ≤ 20 per second; canvas/worklet may run faster       |
| Main-thread long tasks caused by Karaoke during playback | none > 50 ms in the measured run                     |

Numbers must be measured; unit tests alone do not prove real-device microphone
latency or rendered frame rate.

## 11. Test contract

### Unit

- LRC: BOM, CRLF, multiple timestamps, metadata, offset, out-of-order and
  negative timestamps, empty lines, enhanced word timing, malformed tags.
- UltraStar: BPM, GAP, relative/absolute modes if supported, note types,
  syllable joining, missing audio metadata, malformed note rows.
- Importer registry: signature/extension disagreement, structured unsupported
  results, cancellation, byte/time limits, and isolation between importers.
- ZIP/CD+G when enabled: traversal, zip bomb limits, command bounds, palette,
  memory preset, transparent color, scroll/copy packets, and clock seek/replay.
- MIDI/KAR when enabled: lyric encodings, tempo changes, track selection,
  SysEx bounds, missing SoundFont, and seek reconstruction.
- Subtitle/XML when enabled: karaoke timing tags, overlapping cues, BOM/CRLF,
  malformed markup, DTD/entity rejection, and unsupported-style fallback.
- Pairing: accents, suffixes, ambiguous base names, unrelated selected files.
- Clock math: play, pause, seek, buffering, rate change, end, and offset.
- Pitch math: Hz/MIDI/cents, confidence threshold, median smoothing, octave
  preference, trend classification.
- Cleanup: object URLs revoked, media tracks stopped, worklet/context closed.
- Tab: order, selection, remembered value, invalid stored value, and Media plus
  Karaoke independent lifecycle.
- Localization: existing key-parity test remains green for all ten locales.

### Component/integration

- Open LRC + audio and render correct initial state.
- Play, pause, seek, and line transition without timer-based advancement.
- Open UltraStar + audio and show real target notes and source badge.
- Deny mic, retry, select another input, simulate device loss, and recover.
- LRC-only session never enables scoring or invents target notes.
- Keyboard and focus behavior in empty, ready, playing, and error states.

### Manual evidence required

Per repository guidance, the developer running the application performs the
real-window checks:

- screenshots at the smallest supported window and at 1920×1080;
- a ten-minute synchronization run with measured drift;
- a clean generated tone and a real microphone pitch check;
- unplug/replug of a USB microphone during playback;
- switching Karaoke → EQ → Karaoke while audio plays and confirming the mic was
  released;
- confirmation that the Media webview never receives microphone permission;
- a playback performance trace demonstrating the frame/long-task budgets.

## 12. Release acceptance criteria

The first useful release passes only when:

1. `Karaoke` is after `Media`, accessible, localized, and safely persisted.
2. Audio-only, LRC, enhanced LRC, and UltraStar sessions each have a tested,
   honest UI state.
3. Lyrics follow play/pause/seek without timer-driven drift.
4. The mic is opened only on explicit action, has a visible state, can be
   changed, and is fully released on off/tab leave/device loss.
5. A clean 220 Hz input is reported within 20 cents on the baseline system.
6. UltraStar notes produce the target lane; formats without pitch do not.
7. Playback remains local and no karaoke file or mic data is sent over the
   network.
8. Typecheck, build, style check, lint for touched files, and the relevant Jest
   suites pass.
9. The owner has launched the app and supplied the manual evidence above; code
   review and jsdom tests are not treated as a working microphone/window.
10. The shipped dependency manifest, exact license texts/notices, corresponding
    source obligations, and content provenance pass the release license gate.
