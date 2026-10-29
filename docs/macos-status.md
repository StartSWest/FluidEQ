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
  changes are committed and pushed only to `macos`, never to `main`.
  `main` is the Windows build and the base inherited by Mac and Linux.

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
  launch was performed. Live window/desktop checks remain open. Backend work
  is outside this Mac task. These changes stay on `macos`; `main` is unchanged.

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

## Native button-frame follow-up — 2026-10-24

- The user confirmed that the initial event/overlay correction still allowed
  the buttons to jump. AppKit changed the actual native titlebar frames without
  changing Electron's stored position or its computed overlay rectangle, so
  those events could not reliably detect the reset.
- The Mac now observes its own titlebar/button views through public AppKit
  frame and window-update notifications. It compares their real window-space
  position with the current app/player placement and reasserts that placement
  only when needed. Its own synchronous notifications are guarded against
  feedback; hidden, removed, fullscreen and destroyed controls are left alone.
  Recreated native views are rebound and observers/references released at close.
- Live native measurements caught the original 21-point top offset resetting
  to 9 points and verified its restoration. The user then confirmed that the
  buttons stay centered when switching between the full app and player.
  No Computer Use, screenshot or automatic app launch was used.
- Five focused suites passed (38 tests), including a native-only frame jump,
  stable geometry, synchronous callback feedback, current player placement,
  temporarily absent/hidden buttons, both fullscreen modes and observer cleanup.
  App TypeScript, lint and the production main build passed.

## Mac Dock reopening and icon sizing — 2026-10-24

- Dock activation used to create a window only when the main window was null.
  Closing FluidEQ hides its live window for background audio, so that check
  left a Dock click doing nothing. Activation now restores a minimized window,
  shows and focuses a hidden one, and recreates only a missing/destroyed window.
  Repeated clicks while a replacement loads share the same creation and wait
  for its first load rather than exposing a half-painted page.
- The shared icon's opaque body occupied 946 of 1024 pixels. The Mac-specific
  asset adds transparent surround to the same artwork: 828 pixels versus
  Calculator's 824 pixels. Development and packaged Mac builds use the same
  inset; Windows/Linux keep their original icon selection. The reproducible
  AppKit generator is `.erb/scripts/make-mac-app-icon.swift`.
- All 14 affected window/player/activation suites passed (117 tests), including
  hidden/minimized reopen, recreation, repeated clicks before the replacement
  page loads, failed-creation retry and existing Windows/fullscreen behavior.
  App TypeScript, lint, encoding, platform isolation, production main build and
  unsigned arm64 app-bundle packaging passed. The packaged icon's checksum
  matches the generated Mac ICNS, and the arm64 Koffi binding is unpacked.
- The user confirmed native button alignment, Dock reopening after hiding or
  minimizing, and the corrected icon size beside the other Dock icons. A later
  report identified a brief native-button flash for separate follow-up.
  No Computer Use or automatic app launch was performed. Signing/notarization
  is not established by the unsigned check.

## Fullscreen transitions and button flash — 2026-10-25

- The native button observer previously waited for Electron's completed
  fullscreen flag before yielding control. AppKit had already started moving
  its views, so a correction could interfere with the entry animation. Native
  will/did fullscreen notifications now suspend correction and view rebinding
  throughout entry, fullscreen and exit, then restore the latest windowed
  placement after the transition finishes.
- A resize/focus state push can also expose the fullscreen flag before the
  completed entry event assigns its owner. An entry without a page request is
  now reported as system-owned immediately, preventing the renderer from
  reversing the user's entry and leaving a compositor ghost. Page-requested
  fullscreen retains its existing ownership and exit behavior.
- Repeated focus/show/overlay placements no longer redraw an already aligned
  button container. Necessary corrections use a nested AppKit/Core Animation
  transaction with implicit animation disabled, avoiding interpolation through
  temporary native frames. No timer, polling, style change or global setting
  was introduced.
- The user restarted FluidEQ and confirmed that fullscreen stays open, exits
  cleanly and leaves neither a ghost nor a button flash. Dock reopening and
  icon sizing were also previously confirmed. No Computer Use or automatic
  application launch was performed.
- Window/player regressions passed (14 suites / 121 tests). A second batch
  covering video, visualizer, Studio fullscreen and the updated early-state
  announcement passed (4 suites / 19 tests, including a repeated placement
  suite). Cases cover the pre-completion native state, stale renderer exits,
  page-owned entry, transition suppression, queued placement and redundant
  redraws, alongside Windows behavior. App TypeScript, changed-file lint and
  the production main build passed. These changes stay on `macos`; `main`
  remains unchanged.

## Mac button siblings and desktop visibility — 2026-10-25

- The new screenshot showed the close button at the requested inset while
  minimize and fullscreen had returned to AppKit's default inset. Native
  placement had measured only the close button's vertical position, so it
  missed this partial reset. The observer now measures all three controls
  and aligns their centers in each button's actual parent coordinates. The
  correction stays inside the existing animation-free transaction and yields
  throughout native fullscreen transitions.
- On this Mac, Core Graphics reported a full-display Dock surface one level
  above desktop, the same level previously used for FluidEQ. The background
  now uses desktop-icons - 1, above that surface and still below Finder's
  icons and normal applications. Click-through and the desktop type's Spaces
  behavior remain in place.
- A second blank-desktop path removed the scene canvas when macOS reported
  document occlusion. A battery-paused scene then had no picture to reveal
  and no animated frame to replace it. A runner with an explicitly supplied
  pause state now retains its canvas across occlusion and idles its worker;
  ordinary graph scenes retain their existing hidden-scene disposal policy.
- Read-only checks of the running development app confirmed a retained
  2880 x 1800 canvas while hidden and battery-paused, with nonblank pixels in
  all 2560 sampled positions. Native metadata confirmed the new layer at
  -2147483604, below Finder's -2147483603 and above Dock's -2147483622.
  Only the built-in Retina monitor is connected. These checks do not replace
  the requested manual icon, Spaces, monitor and native-button checks.
- App TypeScript, changed-source lint and both production builds passed (the
  scene runner retains four existing console warnings). Visual confirmation, regression suites,
  commit and push for this correction are pending. No Computer Use, backend
  changes or automatic application launch was performed. These native
  corrections remain specific to `macos`.
- The menu-bar name `Electron` belongs to the stock development app bundle.
  The existing packaged bundle's display name and bundle name are FluidEQ.
  Runtime `app.setName` cannot change the OS name. The signed development
  host was left intact to preserve its capture-permission identity.

### Desktop test app — 2026-10-25

- Built the native helpers and both production bundles from the current
  `macos` working tree. TypeScript and source lint passed, with the scene
  runner's four existing console warnings. The test bundle includes the
  pending desktop corrections and the existing pending button alignment.
- Packaged an Apple Silicon app at
  `release/build/macos-desktop-test/mac-arm64/FluidEQ.app`, separate from
  the earlier build. Its name is FluidEQ, minimum OS is 14.4, and the DSP,
  engine, Share Audio and system-volume helpers plus the unpacked Koffi
  module are present for arm64. Strict deep signature verification passed.
- Local test signing uses a temporary entitlement file with library
  validation disabled for ad-hoc native modules. Production entitlements
  were not edited. The app was neither launched, notarized nor published;
  the user requested this build to perform the visual check themselves.
  Regression updates and the focused Mac commit/push await that feedback.

## Mac laptop layout and Analyzer selector — 2026-10-25

- The initial shared correction `c94cebbd5`, merged into `macos` as
  `232f894cd`, was reverted from `main` by `2985ba4dc`: Windows at 125%
  also has a 1536 x 864 logical viewport. After merging that rollback, the
  density tier is explicitly scoped to the Mac root. At logical widths
  1280–1560 and heights up to 900 it keeps application zoom at 100%, slightly
  reduces text density, and reserves the open right pane beside the EQ.
- The user confirmed both panes and the EQ fit comfortably on this Mac's
  1440 x 900 Retina desktop at 100%. The look selector now takes 144px, with
  ellipsis for long names; its complete menu remains available. The graph
  toolbar no longer reserves the already-docked pane twice and retains room
  for the right-hand level scale. An isolated 2x render confirmed one row.
- Stylesheet checks passed, as did 9 layout/media suites (85 tests) and the
  added transport conflict regression (14 tests). The conflict resolution
  keeps main's linked-group forwarding before this platform's local transport
  fallback; both Mac and Windows routes are covered. TypeScript passed after
  restoring the pending native corrections. No backend code was changed.
- The previous native button and desktop corrections are restored locally
  and remain separate, awaiting the user's visual confirmation before their
  regression coverage, commit and push. No Computer Use was performed.
- The Mac-only scope passed stylesheet compilation and the three existing
  band-layout suites (21 tests). Isolated previews of the current compiled
  CSS confirmed a 14.4px Mac root at 1440 x 807 / 2x, and normal 16px roots
  for Windows at 1536 x 864 / 1.25x and Linux at 1536 x 864 / 1x. FluidEQ
  was not running during this scope check and was not launched. The branch
  policy is recorded in `AGENTS.md`; this correction is pushed only to `macos`.

## Main sync and audio-only Mac capture — 2026-10-25

- Merged main's account/profile and curve updates through `3c67b45fc`, then
  its graph/import updates through `664a5e37e`, into `macos`. Account code
  comes from main as-is; no backend or generic account repair was made here.
  The merges and Mac laptop compatibility correction are pushed to `macos`
  at `6e1e746ba`. Neither the local main branch nor remote main was changed.
- Main stopped publishing the shared drawer-open workspace class. The
  confirmed Mac-only laptop rule now reads the actual open pane with `:has`,
  keeping its reserved column without restoring main's removed behavior.
  App, BandLayoutMenu and common bandLayouts passed (3 suites, 59 tests).
  An offline render of current production CSS, without the removed class,
  reported a 14.4px root and 132/968/340px columns on Mac at 1440 logical
  pixels / 2x. Windows at 1536 / 1.25x and Linux at 1536 / 1x retained their
  16px roots and floating-pane grids. All stylesheets compile.
- The first audio-only experiment used a legacy desktop-audio media request.
  The user's launch exposed Chromium's bad-IPC 263 rejection before that
  request ever reached Electron's media handler. That test app is superseded
  by the native capture replacement below; it must not be used for testing.
  The live permission notice already reads system-audio permission and
  describes audio-only access in all ten locales.
- Retaining the desktop canvas across occlusion is explicitly gated on the
  native Mac platform exposed by its isolated preload. Windows retains its
  existing hidden-scene disposal. The desktop/button/audio changes remain
  pending user verification before their regression suites, commit and push,
  following the repository's change-first workflow. TypeScript, changed-source
  lint and the complete production/native build pass (four existing scene
  runner console warnings). No FluidEQ launch, Computer Use, screen capture,
  backend changes, or unsolicited audio playback was performed.
- A fresh Apple Silicon test app is packaged at
  `release/build/macos-desktop-audio-test/mac-arm64/FluidEQ.app`, with a ZIP
  beside it. Its display name is FluidEQ; the four native helpers are arm64,
  and strict deep signature verification passed. Local test entitlements
  retain the ad-hoc library-validation exception; production entitlements
  are unchanged. This build includes main through `664a5e37e` and the pending
  Mac desktop/button/audio changes, and was not launched by the agent.

## Remove the Mac renderer-killing capture request — 2026-10-25

- The supplied log terminates the renderer with bad IPC 263 on every recovery,
  exhausting its reload budget. Chromium names this invalid stream-type
  combination: legacy desktop audio requires a desktop video type in the
  browser's validation, before Electron's downstream handler is reached.
  The prior inspection of Electron alone missed that validation. GPU mailbox
  and disposed-frame errors accompany the terminated renderer; no GPU flag
  or recovery budget was changed to hide the failure.
- Removed the Mac browser capture request entirely. The existing Mac native
  audio helper now owns a separate live-monitor tap, following the default
  output and rate through Core Audio notifications. The monitor hears received
  audio too, while outgoing Share Audio keeps its existing unmuted global tap
  and excludes helper playback and processed engine output. Separate commands,
  PCM reply types and stop acknowledgements keep closing/reopening the
  analyser independent of sending and receiving.
- A main-frame-validated private MessagePort owns the monitor lease. Replacing
  a renderer waits for the old capture's stop acknowledgement before opening
  its successor. Closing the port, abandoning an opening, hiding the last
  display owner, changing outputs or quitting releases the tap. The existing
  PCM worklet/resampler creates an audio-only stream for the existing graph;
  its only speaker connection has zero gain. No microphone, picture, browser
  media request, voice processing, timer or fallback to screen capture is used.
- TypeScript, changed-source lint, the complete native/production build and
  platform-isolation checks pass. The replacement Apple Silicon test app is
  at `release/build/macos-desktop-native-audio-test/mac-arm64/FluidEQ.app`.
  Strict deep signature verification passed; the updated native audio helper
  is arm64. The app was not launched by the agent, and no FluidEQ process or
  debugging endpoint was available for a live check. Desktop/button/audio
  confirmation, regressions, commit and push remain pending user feedback.
- The user's subsequent Keychain prompt names `fluideq-app Safe Storage`.
  Existing account and Share Audio stores use Electron's OS-backed encryption
  key. These local test builds have ad-hoc signatures, which can make macOS
  request access again between builds. No secret or Keychain entry was read,
  changed or bypassed, and no backend/account code was altered for this prompt.

## Mac Keychain recovery instead of an unsupported-system dead end — 2026-10-25

- The user reported the generic sign-in-unavailable card after macOS asked
  for access to `fluideq-app Safe Storage`. The account session rechecks its
  credential store; the false answer originates in Electron's Mac cipher.
  Electron 43.2.0 restores Chromium's synchronous Mac OSCrypt implementation
  in `revert_oscrypt_remove_sync_backend.patch`: `DeriveKey` marks Keychain
  tried after either success or failure and never retries a failed lookup
  in that process. Reopening a panel cannot clear this failure; a fresh app
  launch can retry it. The exact choice made in the user's native prompt has
  been requested and remains unconfirmed; it was not inferred as a denial.
- Added a Mac-only recovery notice using the existing account notice/button
  styles, with all ten translations. It describes inaccessible Keychain
  storage and offers Restart FluidEQ. Only a user click can request this
  restart; its Mac-only handler validates the owning window and main frame,
  and uses the normal quit/write-drain path. Development sessions are left
  to their owner and get explicit manual quit/reopen instructions.
- Account/session, credential store, encrypted JSON storage, remote services,
  and Windows/Linux unavailable-state behavior are unchanged. No secret or
  encrypted credential file was read, deleted or replaced. Keychain security
  was not bypassed, encryption was not weakened, and no application was
  launched or restarted by the agent.
- Available signing-certificate metadata reports zero valid code-signing
  identities on this Mac. Test bundles remain locally ad-hoc signed; a
  persistent Developer ID identity is not currently available. No certificate,
  Keychain trust setting, ACL or password was created or changed.
- App TypeScript, changed-source lint and the full native/production build
  pass (one existing single-export style warning in macPermissionBridge).
  Offline 2x renders of the new notice were inspected in English at 1098px
  and German/Japanese at 318px: text wraps, buttons remain readable, and the
  card has no horizontal overflow. These are fixtures, not captures of the
  user's desktop or a substitute for the pending live app check.
- Packaged `release/build/macos-keychain-recovery-test/mac-arm64/FluidEQ.app`
  with the prior native-audio, desktop and button corrections. Strict deep
  signature verification passes. The current running app can also retry by
  a full manual quit/reopen of that same bundle. The native Keychain decision
  stays with the user; permission/sign-in, desktop/buttons/audio checks,
  regression coverage and the focused Mac commit/push remain pending.

## Confirmed Keychain refusal and latest main merge — 2026-10-25

- Read-only macOS security diagnostics covering the actual launch identify
  the failure, rather than inferring the user's button choice. At 10:51:28
  securityd requested access for the new native-audio test bundle. Its
  existing FluidEQ Safe Storage ACL named the older test build's code hash.
  At 10:51:59 macOS recorded that access was not approved and rejected the
  lookup. No password or encryption-key value was read. A valid native
  Keychain authorization is still necessary to read the protected sign-in;
  resetting data, weakening encryption or impersonating the older signature
  is not a repair.
- The Mac recovery handler now queues at most one restart per process and
  reports a failed restart through the existing manual recovery path. This
  prevents repeated IPC while normal quit drains pending writes from
  scheduling multiple app instances and multiple Keychain requests.
- Merged main through `9c0c599e6` (eight new shared commits) into `macos`,
  preserving the pending Mac changes. The only conflict was a shared Studio
  test; current main's version was retained because its changes were shared
  Studio expectations, with no Mac adaptation to lose. Its four tests pass,
  as do TypeScript and the complete native/production build. Normal hooks
  passed, and merge `0dd567af5` is pushed only to `macos`. Local main remains
  `2985ba4dc`; no main or backend fix was authored here.
- The native monitor's extra PCM reply is explicitly decoded only on Darwin;
  Windows/Linux retain their original reply handling. The Mac desktop,
  buttons, native-audio and Keychain recovery changes remain uncommitted,
  awaiting the repository's required runtime confirmation and regressions.
  The up-to-date local test package is `release/build/macos-test/mac-arm64/FluidEQ.app`.
  No application was launched/restarted by the agent, no Computer Use was
  performed, and no Keychain approval or trust setting was changed.
- A final remote refresh found main's public/private add-on separation and
  detached developer tools (`844de9105`). These are now inherited too, in
  merge `7abeb9a13`, pushed only to `macos`. The ignore-file conflict retained
  both the existing scratch rule and main's add-on rule. Git's autostash
  restored every tracked Mac change; the two pre-existing stashes remain
  unchanged and no merge conflict remains.
- With the final merge, app TypeScript and the complete native/production
  build pass. Main's public-release checker confirms no private add-on code
  is bundled. The three developer-tools/window-reveal suites pass (18 tests),
  alongside the four Studio conflict-resolution tests from the previous
  merge. The refreshed Mac package passes strict deep signature verification.
  These checks validate the merges and build, not the pending user runtime
  checks or the unrun regression coverage for the new Mac features.

## Final public Mac package after main refresh — 2026-10-25

- Main is inherited through `844de9105`; final merge `7abeb9a13` is pushed
  only to `macos`, authored as StartSWest. The final ignore-file conflict
  retained both rules. Git applied the temporary autostash successfully;
  both pre-existing user stashes remain unchanged and the Mac work is intact.
- TypeScript, the full native/production build with add-ons disabled, main's
  public-release add-on checker and strict deep signature verification pass.
  Three developer-tools/window-reveal suites passed (18 tests), alongside
  the four Studio merge-resolution cases. Mac runtime checks and the new
  feature regressions are still pending and are not represented by this count.
- The current test app and ZIP are in `release/build/macos-test`. Its
  build-info records the merge and included main revision. The native-audio,
  desktop/button and Keychain recovery work is present in the app but remains
  uncommitted pending the required verification. macOS Keychain approval is
  an external requirement: the actual launch log records access not approved.
  No application was launched, no authentication was bypassed, and no backend
  repair was performed by this agent.

## Relay Share Audio and amp follow-up — 2026-10-26

- Main is inherited through `1519a62bb`, in merge `d972b687b`, pushed only to
  `macos`. This follows the earlier 14-commit refresh in `b096f9857`.
  The shared Share Audio routing/fallback and Windows restart changes came
  from main; no main/backend repair was authored on this Mac. The conflict
  retained both Mac and Windows IPC coverage, with 94 focused cases passing.
  All 60 pending files were preserved across the merge; only subsequent
  intentional Mac edits differ from the backup. The older two stashes remain.
- Relay task #6 is `9c3050a7-8e76-4761-9f82-d29d8a2b88d9`; amp task #7 is
  `fc80184b-e12f-4adf-a6fe-4daa586b4b2f`. Relay 0.4.0 now registers this chat
  separately on those tickets and overall coordination #3. Its code-only local
  listener reports `codex-app-tools` delivery with model polling disabled.
  Actual Windows handoffs and an owner status request reached this chat and
  have explicit Read receipts. This verifies receipt on this Mac, not setup
  on every peer. The old project route remains paused; no scheduler, other
  chat's inbox or global cursor was used. Delivery requires the desktop app
  and this local connection to remain running.
- The Mac now-playing helper uses platform notifications in a system Perl
  host, with the author's BSD-3-Clause MediaRemote declarations pinned at
  `0e82bf1c44ec39554fbfc402ec88a48c6ae2a0fd`. Licence and provenance are retained.
  No timed polling, screen capture, SIP/system-binary-signature/credential change, or new
  user-facing string is involved. Music/Spotify broadcasts remain a fallback.
  The framework is packaged as signed nested code in `Contents/Frameworks`;
  its script and licence are data under `Resources/native/mac-media`.
- Real macOS 26.5.1 check: Safari's title, playing state and elapsed position
  are read; WebKit's GPU process resolves to Safari. That stream advertises
  play/pause and no seek/next/previous, which are emitted truthfully. Explicit
  pause and play both acknowledged and produced state notifications; original
  playback was restored. Closing stdin exits the watcher with code zero.
  The user's amp screenshot also shows Netflix / Safari on the system card.
- The Mac output monitor mistakenly excluded the engine, whose muted process
  tap replaces the original playback. It now includes processed and received
  sound on the default output. Outgoing capture still excludes the engine and
  LAN playback, preserving raw sending and the no-feedback boundary. A monitor
  no longer needs its own process object when it excludes no processes.
- Through the running app's pre-granted audio API, a temporary work claim
  produced 12,288 real frames at 48 kHz with stereo peak amplitudes 0.3142 and
  0.3306. The analysis branch ended in a silent stream destination, no tone or
  output-volume change occurred, no audio file was written, and the claim was
  released. This proves the native monitor delivers sound while the window is
  hidden; it is not yet a visible amp/canvas verdict.
- Shared follow-ups were sent to the Windows coordinators: the amp dB reader
  reads only the direct frame even though sharing intentionally selects the
  sender's visible frame, and the system-media contract needs optional
  `canToggle` passthrough for sessions without that capability. These are main
  changes, not local Mac-only workarounds. Their replies remain pending.
- The new Mac implementation and earlier desktop/titlebar/audio/Keychain work
  remain uncommitted pending the required runtime feedback and Mac regressions.
  Native and public JS builds, TypeScript, ESLint, public add-on exclusion and
  platform isolation checks pass. No FluidEQ app was launched by the agent;
  the user-owned dev session and native diagnostic helpers were used instead.
- The final arm64 test app and ZIP in `release/build/macos-test` include these
  pending changes and main through `1519a62bb`. Both the app and nested media
  framework pass strict signature verification. The packaged helper also
  reads the real Safari session, reports its enabled controls, and exits zero
  on EOF. Only the helper was executed; the packaged FluidEQ app was not
  launched. Visible amp, cross-PC one-player, desktop/titlebar and Keychain
  checks, Mac regressions and the focused Mac commit/push remain pending.
- A final fetch also found six main commits through `0e51ad010` covering
  Compact player queue/reset behavior, Help and the tour. Merge `85dd86278`
  inherited them without conflicts. All 60 pending Mac files were restored;
  their changed lines match the pre-merge backup exactly. TypeScript, the
  full native/public JS build, public add-on exclusion and platform isolation
  checks pass; eight affected main suites pass all 101 cases. The refreshed
  package includes this revision. No shared amp readout correction has landed
  in that main range, so the main-owner follow-up remains open.

## Main refresh — 2026-10-27

- Merged 32 incoming main commits through `64d93517d` into `macos` as
  `1e484e59e`, keeping local main at `2985ba4dc`. The placement-test conflict
  retains both Mac native-fullscreen coverage and main's new stale-placement
  cases. Main's live Help panels require preserving the figure kind while
  applying Mac-only wording; the Mac adapter now narrows that kind explicitly.
  Inherited Windows tray-tint tests select Windows explicitly while retaining
  the Mac template-icon case. No backend or main repair was authored here.
- TypeScript and changed-source ESLint pass, as do ten integration suites
  with 118 cases, the complete native/public production build, platform
  isolation and public add-on exclusion. The normal pre-commit lint-staged
  hook passed. All 60 pending Mac files were restored with their exact changed
  lines intact; only `main.ts` also inherited upstream edits. Both older user
  stashes remain; only the verified temporary sync stash was dropped.
- Earlier Mac feature work remains uncommitted pending runtime feedback and
  regressions. This refresh builds production bundles; the packaged test app
  from the prior handoff remains based on `85dd86278`. No FluidEQ application
  was launched or restarted, and no Computer Use or credential access occurred.

## Mac output meter reads after Auto normalize — 2026-10-27

- Reproduced the reported positive reading at the native monitor boundary:
  +1.57 dB, with 183 full-scale samples in 30 seconds. A simultaneous passive
  Core Audio comparison measured the all-process device tap at +1.566 dB and
  the engine-only device tap at -1.004 dB, with no engine-output overloads.
  A second process tap still hears the originals silenced by the engine's
  muted tap; including them beside the processed copy double-counted music.
- The live monitor now includes only the running engine on the selected
  output, and returns to the direct device mix while the engine rests or is
  off. Core Audio process/output notifications update this selection; outgoing
  Share Audio keeps its existing raw-source exclusions. No normalization
  ceiling, recovery speed, initial gain or processing stage was changed.
- The user's current configuration resolves with its final guard enabled,
  Auto normalize on and a -5.07 dB start. An offline overload probe through
  the Mac wrapper remained below -4.02 dB; the shared graph's unprotected
  positive control reached +1.058 dB. The rebuilt helper produced meaningful
  processed audio, and the corrected running app captured 1,440,000 frames
  with stereo peaks of -5.66/-5.80 dB and no full-scale samples.
- TypeScript, changed-source ESLint, 50 focused JS cases, and six native
  checks passed: monitor source selection, the Mac configuration reader,
  graph processing, output transitions, output guard and graph crossing.
  The new native regression checks the real Core Audio tap description and
  its direct/processed/restarted-engine transitions beside the direct-mix
  control. Native helpers only were executed; the existing FluidEQ app and
  processing engine were not launched or restarted. Temporary diagnostic
  hooks and analysis claims were released after measurement.
