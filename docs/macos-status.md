# macOS review — 2026-10-23

The September port design describes an earlier, playback-only scope. The
current branch also contains a system-wide engine built on Core Audio process
taps. This page records the current implementation and its remaining limits.

## Supported build

- Apple Silicon, macOS 14.4 or later. Intel packages are not offered while
  the native port is validated only on arm64.
- The native helpers and the Electron bundle both target macOS 14.4. A build
  made on macOS 26 must not silently produce helpers that require macOS 26.
- `macos` and `macos-support` carry the same reviewed source, including
  the latest `origin/main`. The older branch's history is retained.

## Implemented

- Core Audio playback for the Library, and a process-tap engine for the
  system's stereo mix on the default output. The system engine follows output
  and sample-rate changes, stops with FluidEQ, and uses the shared EQ and DSP
  graph rather than a separate implementation.
- Real output enumeration, stable identities for profiles, and selecting the
  Mac's default output. Settings, Room heads and song-leveling files belong
  to each output.
- Engine status, DSP meters and the automatic preamp readout use the shared
  frame formats. Windows installation and audio-service repair controls are
  removed from the Mac engine choices and troubleshooting.
- Mac traffic lights, fullscreen and compact-player handling, Dock and menu
  bar artwork, sound/screen permission notices, and localized privacy strings.
- Music and Spotify track-change notifications and transport commands.
- A macOS Apple Silicon CI workflow builds the production bundles, runs the
  native processing tests, checks platform isolation and runs the app tests.

## Corrections made during this sync

- Resolved the startup bridge and native build conflicts with main while
  retaining the Mac permission bridge and main's current account features.
- Kept the Windows shared-memory second-output transport and its system
  libraries out of the shared Mac graph build.
- Updated both the running engine and its offline measurement command to
  read each output's Room head. Song announcements now read that output's
  programme file. Regression tests exercise the real Mac reader and graph:
  another output's head cannot fill in a missing one, and a song change does
  not rebuild the graph.
- Updated latency reporting for the current EQ and De-esser stages.
- Aligned native and app minimum OS versions, and removed the unsupported
  Intel package target. Replaced Apple's macOS-26-only floating-point parser
  with an explicitly C-locale parser on Mac; Windows keeps its existing
  parser. Both are checked against the same decimal grammar, including a
  comma-decimal process locale and malformed/non-finite values.
- Made the Windows-specific engine/tray tests declare their platform and
  checked the Mac tray's template icon through an update. Fixed the Studio's
  explicit Windows-path comparison to use Windows path syntax on any host.

## Work still needed before calling the Mac port complete

- **Native AAC/ALAC decoding.** The macOS Library host still links the
  unsupported platform decoder. MP3, FLAC, Ogg and PCM have shared native
  decoders; MPEG-4/AAC/ALAC require the macOS AudioToolbox implementation.
  Browser playback fallback is not proof of native DSP playback for them.
- **Library host CPU and memory readings.** Its macOS build still links the
  unsupported process-statistics implementation. The system engine's own
  process measurements are separate and already implemented.
- **Other Windows helpers.** Share Audio, simultaneous second-output
  routing, Dynamic Lighting, desktop visualizers, game detection and the
  Windows process meter do not acquire Mac implementations from this merge.
  Their Mac availability and visible controls need a separate capability pass.
- **System media coverage.** Browser tabs and arbitrary media players have
  no implementation here. Music/Spotify broadcasts supply no live playhead
  or artwork and may not name an already-playing song until its next change.
- **Distribution.** Verify Developer ID signing and notarization, including
  both native helpers, on the actual release pipeline. The unsigned local
  app-bundle check publishes nothing and does not establish Gatekeeper trust.
  Audio-permission preflight currently uses a private TCC symbol; signed
  distribution and supported OS versions still need compatibility validation.
- **Real-device checks.** Listen to EQ/rack changes, Room, output/rate changes,
  Bluetooth reconnection and quit/crash recovery; test first permission grant,
  refusal and later re-grant; inspect window restore, fullscreen, compact
  player and the menu bar at normal and extreme sizes. No running window was
  available during this review, and the app was not launched automatically.
- **Version coverage.** The development Mac cannot establish behavior on
  every supported macOS release or Intel hardware. Intel remains outside the
  offered package set.

## Verification

- Production build and unsigned arm64 app-bundle packaging passed. The bundle
  and both packaged native helpers declare macOS 14.4; their architecture is
  arm64. Nothing was published or launched as an application.
- App, scripting and end-to-end TypeScript checks, stylesheet compilation,
  UTF-8/encoding checks and platform isolation passed. Lint finished with no
  errors and 62 warnings.
- The full app suite was examined: 1,064 suites executed and one skipped.
  Windows-specific assumptions were corrected, and all affected suites passed
  on re-run. The additional Mac configuration-directory regression suite also
  passed. Tests requiring loopback sockets, process locks or macOS file-change
  notifications were re-run outside the sandbox; their assertions were kept.
- All 80 native CTest checks passed across two batches: the initial 46 checks
  and the remaining 34 in parallel. Once the final unique partition passed,
  the first runner's duplicate continuation was stopped. This is not a claim
  that the interrupted `test:native-dsp` shell command exited successfully.
- Native helper smoke checks passed for the protocol, malformed wire lengths,
  supervisor/restart behavior, orphan cleanup, PCM playback, malformed decoder
  headers, preset shapes and the real Core Audio device. The device hold
  rendered 5.9 seconds with zero reported dropouts and a 32 µs callback p99.
- Coverage limits: the six optional codec fixtures were absent. The analysis
  and crossfade smokes needed an unavailable ffmpeg and were skipped. The
  shared-audio and game-watch smokes are Windows-only. These skips do not
  establish native AAC support or a functioning Mac implementation of those
  Windows features.
- No running app window was available for the visual checks or permission
  flows, and no listening verdict has been made. The real-device smoke is an
  automated playback/lifecycle check, not a listening session.
