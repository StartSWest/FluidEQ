# macOS review — 2026-10-23

The September port design describes an earlier, playback-only scope. The
current branch also contains a system-wide engine built on Core Audio process
taps. This page records the current implementation and its remaining limits.

## Supported build

- Apple Silicon, macOS 14.4 or later. Intel packages are not offered while
  the native port is validated only on arm64.
- The native helpers and the Electron bundle both target macOS 14.4. A build
  made on macOS 26 must not silently produce helpers that require macOS 26.
- `macos` is the sole Mac branch and includes the latest `origin/main`.
  The redundant `macos-support` branch is retired; its history remains
  in `macos`. Shared Share Audio fixes land on `main` first and are merged
  into `macos`; Core Audio capture/playback stays on `macos`. Mac-specific
  work is never merged wholesale into `main`.

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
- Desktop visualizers use native Mac desktop windows, one per selected
  monitor, with pointer input passed through to Finder. The desktop window
  type joins Spaces without changing FluidEQ's normal application/Dock type.
- Two-way Share Audio with native Core Audio capture and playback. An
  unmuted system tap sends raw local sound and excludes the LAN playback
  process and the system engine's processed copy. Received sound stays out
  of the outgoing stream even when both directions run at once. The tap
  follows default output/rate changes and updates engine/helper exclusions
  when processes change; capture leases are shared across links.
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
- **Other Windows helpers.** Simultaneous second-output
  routing, Dynamic Lighting, game detection and the
  Windows process meter do not acquire Mac implementations from this merge.
  Their Mac availability and visible controls need a separate capability pass.
- **System media coverage.** Browser tabs and arbitrary media players have
  no implementation here. Music/Spotify broadcasts supply no live playhead
  or artwork and may not name an already-playing song until its next change.
- **Distribution.** Verify Developer ID signing and notarization, including
  all three native helpers, on the actual release pipeline. The unsigned local
  app-bundle check publishes nothing and does not establish Gatekeeper trust.
  Audio-permission preflight currently uses a private TCC symbol; signed
  distribution and supported OS versions still need compatibility validation.
- **Real-device checks.** Listen to EQ/rack changes, Room, output/rate changes,
  Bluetooth reconnection and quit/crash recovery; test first permission grant,
  refusal and later re-grant; inspect window restore, fullscreen, compact
  player and the menu bar at normal and extreme sizes. A Windows/Mac listening
  session must confirm two-way sharing on the actual computers. The running
  development app could not be inspected because Computer Use permission
  was unavailable; the app was not launched automatically.
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
- The running app window could not be inspected for visual checks or permission
  flows, and no listening verdict has been made. The real-device smoke is an
  automated playback/lifecycle check, not a listening session.
- The initial sync also includes main's updated Share Audio interface and
  multi-computer links. All 25 affected app suites passed (187 tests), as did
  the app and script TypeScript checks and platform isolation. The native
  sources are unchanged from the 80-check review above.

## Two-way Share Audio follow-up

- Shared lifecycle/status fixes were committed on `main` as `4acdc53e4` and
  merged into `macos`. A reloaded window retains sending status, a refused
  capture reports failure, and disconnected renderer worklets stop.
- The new Mac helper is built and packaged as `FluidEQ-LAN-Playback`.
  Capture and incoming playback share one process; no Chromium loopback is
  used on macOS. It uses the same bounded capture queue and peer playback
  mixer/resampler as Windows. It does not change the system output or volume.
- The live Core Audio duplex test passed while the system engine was running.
  A quiet test tone rendered by the LAN helper was rejected by the send tap;
  the same tone from a separate process was captured. The matched measurement
  found the incoming tone below the existing background noise and below 1%
  of the external positive control. The test uses audio frame counts rather
  than timers and stores no captured audio.
- This verifies native capture/playback isolation on this Mac. It does not
  replace a Windows/Mac listening session, permission-flow checks, or supported
  macOS version coverage.
- All 30 Share Audio app suites passed (216 tests), including Mac native
  routing, concurrent capture leases, reconnects and Windows regressions.
  Capture queue, peer playback and Mac engine configuration native checks
  passed. App/script TypeScript, platform isolation, encoding and changed-file
  lint passed, as did the production build and unsigned app-bundle packaging.
  The packaged LAN helper is arm64 and targets macOS 14.4, alongside the
  existing DSP and engine helpers. All ten Mac privacy descriptions now
  disclose sharing with linked computers when Share Audio is enabled.

## Errors from the supplied launch log

- The absent preset-directory startup error is already repaired on `main`
  and this branch; its regression test passed.
- The system engine starts and processes 48 kHz stereo successfully.
- The live backend is missing `public.listening_choices` (PostgREST
  `PGRST205`), and `scene_catalogue` exceeds its database statement timeout
  (`57014`). Scene-play reporting also returned HTTP 403 in the supplied log.
  These remain unresolved: backend source/deployment access is required to
  repair the schema/query/authorization, rather than hiding client errors.

## Desktop visualizer follow-up — 2026-10-24

- Implemented only on `macos`; `main` remains at `4acdc53e4`. The existing
  scene rendering, monitor picker, tuning, scene ownership, audio analysis,
  pause policy and saved choices are reused. No extra audio playback or
  system wallpaper preference is created.
- Each selected monitor owns a frameless, non-focusable Electron Mac
  `desktop` window. Mouse input is ignored so Finder receives desktop clicks,
  selection, dragging and context menus. Stop destroys the owned window,
  revealing the existing wallpaper. Window bounds include the full monitor,
  including the area behind the menu bar and Dock.
- Electron 43.2's desktop type supplies the native desktop level and
  `CanJoinAllSpaces | Stationary | IgnoresCycle`. No always-on-top operation,
  application activation or Dock/process-type transformation is used.
  `hiddenInMissionControl` is deliberately omitted: it maps to `Transient`,
  which AppKit forbids combining with the desktop's `Stationary` behavior.
- Mac window occlusion is reported by the isolated preload to its owning
  WebContents. Only that main frame's boolean visibility reports are accepted.
  Covering one monitor pauses that monitor independently, with no timer or
  foreground-window polling. Lock/sleep/battery policies use the existing
  power events. The host tracks requested visibility instead of re-showing a
  covered window whenever native visibility changes.
- Mac monitor positions and sizes stay in logical points throughout layout;
  physical pixel dimensions are separate picker labels. This prevents a
  Retina monitor from overlapping an adjacent non-Retina monitor in the
  picker. Display changes rebuild only the affected surface and remember
  its new geometry. Unplugged monitors retain their scene choices for
  reconnect; saved choices are restored at launch.
- Regression coverage exercises native desktop options and pointer
  pass-through, isolated per-monitor visibility and sender validation,
  synchronous Mac attachment, mixed Retina layouts, reconnect, resize/scale,
  relaunch and existing Windows behavior. All 21 desktop suites passed
  (162 tests). Production native/main/renderer builds, changed-file lint,
  app/script TypeScript, platform isolation and encoding checks passed.
- Live verification remains pending: Computer Use reported that the Mac was
  locked. No application was launched by the agent. Finder interaction,
  Spaces/Mission Control/Stage Manager, fullscreen apps, actual multi-monitor
  hotplug and normal/extreme window sizes must still be observed on the
  unlocked Mac; automated tests alone are not a visual verdict.
