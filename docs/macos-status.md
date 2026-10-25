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

- Implemented only on `macos`; no desktop changes were pushed to `main`. The existing
  scene rendering, monitor picker, tuning, scene ownership, audio analysis,
  pause policy and saved choices are reused. No extra audio playback or
  system wallpaper preference is created.
- Each selected monitor owns a frameless, non-focusable Electron Mac
  `desktop` window. Mouse input is ignored so Finder receives desktop clicks,
  selection, dragging and context menus. Stop destroys the owned window,
  revealing the existing wallpaper. Window bounds include the full monitor,
  including the area behind the menu bar and Dock.
- Electron 43.2's desktop type supplies
  `CanJoinAllSpaces | Stationary | IgnoresCycle`. Its initial level is below
  the system wallpaper and must be corrected as described below. No
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
- Live verification remains pending: the Mac was unlocked, but Computer Use
  still timed out while reading the running Electron window and explicitly
  denied Finder access. No application was launched by the agent. Finder interaction,
  Spaces/Mission Control/Stage Manager, fullscreen apps, actual multi-monitor
  hotplug and normal/extreme window sizes must still be observed on the
  unlocked Mac; automated tests alone are not a visual verdict. The user has
  since asked that Computer Use not be used; further visual checks are manual.

### Invisible desktop correction

- The desktop type alone was insufficient: Electron 43.2 explicitly sets
  `kCGDesktopWindowLevel - 1`, behind the system wallpaper. This is documented
  in [Electron's window options](https://www.electronjs.org/docs/latest/api/structures/base-window-options)
  and its versioned `native_window_mac.mm` implementation.
- The Mac host now reads the public Core Graphics desktop, icon and normal
  window levels through the already packaged Koffi dependency. It requests
  desktop + 1 through Electron's normal-level setter with a negative relative
  offset. It refuses invalid values or any position at/above the icons or
  normal apps. The desktop type's Spaces behavior and click-through remain.
  Placement is reasserted on the window's show event and its listener is
  removed at stop. No new native dependency, helper or timer was added.
- A read-only native check on this Mac returned wallpaper -2147483623,
  picture -2147483622, icons -2147483603 and normal apps 0. The corrected
  picture level lies strictly between the wallpaper and icons. This queries
  level constants only; it does not inspect or operate the desktop.
- All 22 desktop suites passed (171 tests), including level ordering,
  unsafe-level rejection and restoration after a show. App TypeScript,
  encoding, changed-file lint and the production main build passed. Actual
  visible placement, icon interaction, Spaces and multi-monitor behavior
  still need the user's manual verification; no application was launched.

## Share Audio group sync — 2026-10-24

- Merged `origin/main` at `41a93a5ce` into `macos`, including Share Audio
  groups, per-computer receive controls, the global send switch and automatic
  recovery. The local `main` branch was not moved and nothing was pushed to
  `main`.
- Retained native Mac two-way capture/playback and its exclusion of received
  audio and the local engine's processed output. The new group transport
  uses that existing path; the renderer does not add a second Mac capture.
- Resolved the IPC test conflict by retaining Windows and Mac coverage and
  adding the new resume/recovery check to both platforms.
- Focused validation covered 109 suites and 805 current tests: 108 suites
  passed in the combined run; the remaining Studio suite passed all four
  cases after updating its obsolete draft-mark expectations to main's
  existing local-preview behavior. This changed checks only, not Studio UI.
  The four-computer integration test used real local sockets and verified
  introductions, continued connections after an introducer left, saved-pair
  reconnection and unlink. Socket/pipe tests were run outside the sandbox
  after sandbox listeners were denied.
- Production native/main/renderer builds, app TypeScript, stylesheet,
  platform isolation, encoding and staged lint checks passed. Physical
  Windows/Mac two-way listening and desktop interaction remain unverified;
  the earlier backend-access blockers still apply.

## System volume and Share Audio isolation — 2026-10-24

- “This PC” was disabled because the shared system-volume service only
  located the Windows helper. On macOS it returned unavailable before
  querying an output; audio versus video was not involved.
- Added the native Mac helper and included it in build/package resources.
  The existing controls now read and write the default Core Audio playback
  output's real volume and mute, independently of media or sharing state.
  Default-output and external-control changes use native notifications.
  Writes query back the applied value; coalesced dragging keeps its existing
  acknowledgments. An output change clears old queued positions, drains an
  outstanding acknowledgment, and prevents writes crossing onto a new device.
- Volume and mute capabilities are independent. Unknown values remain
  unknown; fixed-level, read-only or unwatchable controls are disabled
  truthfully, with translated explanations. No player-volume substitute or
  synthetic mute was added. Existing classes and Windows/Linux helper
  selection remain intact.
- The existing process tap already captures before local output gain/mute
  and excludes the received-audio helper and the engine's processed output.
  This path was retained and documented. An optional native regression sweep
  now measures outgoing PCM and received-audio exclusion at 100%, 50%, zero,
  mute and unmute, restoring the original device settings afterward.
- Quiet-tone measurements on this Mac passed all five settings. Outgoing
  amplitude stayed within 0.001% of its reference; received-tone leakage
  measured zero with a positive rendered-playback control at every setting.
  The measurement itself has synthetic positive/null controls, clock drift,
  phase discontinuity and real gain-change coverage. No audio was saved.
- Silent hardware checks also passed external volume changes, queried-back
  applied levels and mute/unmute notifications. Live output switching was
  attempted but remains unverified: macOS kept the built-in speakers selected
  when asked to use the only alternative, Microsoft Teams Audio. Native and
  app regressions cover output changes, listener rebinding, missing
  capabilities, stale writes and acknowledgment ordering.
- Focused app tests passed 11 suites / 56 tests, and native control/meter
  tests passed. Production native/main/renderer builds, app/script TypeScript,
  platform isolation, encoding and staged lint checks passed. Existing Windows
  protocol and Linux-unavailable behavior have regression coverage; their
  physical audio devices were not tested on this Mac.
- Per the user's quiet-tone-only preference, real video playback and a
  physical receiving PC were not tested. The renderer regression mounts a
  video element without playback and verifies media-independent control and
  dragging; it is not a visual or listening check. No Computer Use or app
  launch was performed. Live window/desktop checks and backend-access blockers
  remain open. These changes stay on `macos`; `main` is unchanged.

## Mac wallpaper battery pause — 2026-10-24

- Read-only diagnostics of the running app found the actual remaining reason
  the background disappeared: this Mac was on battery and its saved
  `pauseOnBattery` choice was enabled. The scene had rendered, but the shared
  battery policy hid the whole window immediately.
- On Mac, battery pause now holds the rendered picture on the desktop and
  stops its animation/audio reads. Plugging in resumes the same scene;
  unplugging holds it again. Windows keeps its existing battery visibility
  behavior. No saved preference, style or default power-saving choice changed.
- After the existing dev watcher loaded the correction, read-only app
  diagnostics confirmed a visible 1440 × 900 surface with a 2880 × 1800
  canvas and nonblank pixels, still paused for battery. Native window metadata
  confirmed it was onscreen, fully opaque, covered the full display, and used
  level -2147483622, between the system wallpaper and Finder's icons. No
  Computer Use, screenshots, clicks or application launch were performed.
- All 24 desktop/layout suites passed (176 tests), including Mac and Windows
  battery start, resume and pause regressions. Main production build, app
  TypeScript and changed-file lint passed. Actual icon interaction, Spaces
  gestures and physical multi-monitor hotplug remain manual checks.

## Default-output switching follow-up — 2026-10-24

- The Microsoft Teams device is alive but Core Audio reports
  `DeviceCanBeDefaultDevice = 0`. Its set-default call returned success
  without changing the route. The Mac backend now rejects an output with
  that capability missing instead of claiming that it switched.
- Added an opt-in native fixture that creates a temporary aggregate of the
  original physical output. It waits for native default-output acknowledgments,
  restores the original route and removes its aggregate on exit. It plays
  no audio and is not registered as an automatic CTest or packaged resource.
- Silent hardware verification passed a real default switch from the built-in
  speakers to this aggregate and back. The volume watcher adopted the new
  identity, truthfully reported that the aggregate has neither volume nor
  mute controls, and refused the old output's volume command. External real
  level/mute checks and applied acknowledgments also passed. The original
  speakers and zero-volume/unmuted state were restored; no test device remained.
- The rebuilt production engine also rejected Teams with the explicit
  unsupported-default error. Native configuration, volume-control and calibrated
  meter checks passed. This closes the live switching gap on the available
  Mac; Bluetooth, HDMI and physical multi-device coverage remain unverified.

## Mac window-button alignment — 2026-10-24

- The renderer had already centered the traffic lights before the native
  window finished opening. AppKit could subsequently restore its titlebar
  layout while the DOM slot stayed unchanged, so the slot's cached position
  was not sent again. Mac show, restore, completed resize and focus events
  now request a fresh placement from the visible strip.
- Native Window Controls Overlay geometry changes also reassert the slot's
  position. Identical native geometry is ignored, and a hidden/zero-size
  overlay does not reposition fullscreen controls. Listeners are removed when
  their strip unmounts. No polling, timer, style or hardcoded new inset was
  introduced; Windows/Linux retain their existing event behavior.
- Read-only live diagnostics covered the full app's 40-point button slot
  inside a 56-point strip, then the user's player with a 33-point slot and
  34-point native overlay. These confirm each layout's geometry; they do not
  replace a visual check for a later native button jump.
- All 32 focused window/desktop/layout suites passed (246 tests), including
  native transition refreshes, overlay feedback suppression, teardown, both
  player styles and Windows behavior. App/script types, lint, encoding,
  platform isolation and production native/main/renderer builds passed.
  The user was asked to confirm the native buttons remain centered, with
  Computer Use still off; no automatic app launch or UI control occurred.
