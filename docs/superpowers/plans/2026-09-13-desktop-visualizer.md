# Desktop visualizer implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the independent Windows host and review, with integration performed in this session.

**Goal:** Let a Plus member set an installed visualizer as a Windows desktop background, choose a monitor, and stop it from FluidEQ.

**Architecture:** A dedicated sandboxed Electron window draws the existing scene renderer. A small Windows helper places that window behind Explorer's icons and reports fullscreen visibility using Windows events. The main window supplies fresh audio on demand; its capture is held only while a wallpaper needs it. Main owns scene loading, entitlement, window lifetime, monitor placement, and power policy.

**Tech stack:** Electron, React, TypeScript, existing WebGL scene workers, Win32 C++20.

**Spec:** Approved conversation design: Windows first; reuse Plus scenes; monitor selection; clickable desktop icons; continued music response while minimized; pause for fullscreen apps, screen lock, and optional battery saving; restore the ordinary wallpaper when stopped. macOS and Linux implementation follows separately.

## Constraints

- Preserve the current checkout's concurrent changes; capture a baseline and stage only this feature's exact diff.
- No new timers or polling loops: use IPC, animation frames, native events, and process completion.
- No arbitrary paths or shader source accepted from the renderer. Main resolves installed scene IDs and checks entitlement.
- A wallpaper window receives a restricted preload and no audio playback or broad application bridge.
- All user-facing strings have all ten translations.
- Do not launch FluidEQ; use an existing running instance for inspection. A fresh launch and desktop interaction verification may require the user.
- Follow the repository's implementation-first preview order; typecheck/lint/build now, regression suite once the user is satisfied, before commit and push.

## Task 1: Native Windows desktop host

Create `native/wallpaper/` with an event-driven helper executable `FluidEQ-Wallpaper.exe`.

- [x] Implement decimal Electron HWND and expected owner PID validation before mutation.
- [x] Implement desktop placement and physical coordinate mapping for conventional WorkerW and raised Progman layouts.
- [x] Report newline-delimited `ready`, `active`, `paused`, or `error:<reason>` messages; fullscreen detection applies to the wallpaper's monitor.
- [x] Implement hidden shutdown on parent/stdin loss, desktop destruction, or attachment failure.
- [x] Build with existing strict compiler settings.
- [ ] Verify real desktop placement, clickable icons, mixed DPI placement, and safe shutdown; add meaningful native policy coverage after preview acceptance.

## Task 2: Main lifecycle and restricted renderer protocol

Create `src/common/wallpaper.ts`, `src/main/wallpaper/`, and `src/main/wallpaperBridge.ts`; integrate main/preload/build packaging.

- [x] Define validated start requests (`lookId`, `displayId`, `pauseOnBattery`) and state (support, displays, phase, current selection, pause reason, error).
- [x] Resolve the scene from existing installed stores; check Plus and member scene visibility before starting and on account/scene changes.
- [x] Guard replacement callbacks by surface identity; stop on missing monitor, renderer failure, owner disappearance, or native helper failure.
- [x] Apply lock/suspend/battery/fullscreen policy without pausing audio playback; accept draw readiness only for the current rendering generation.
- [x] Restrict all mutations and frame replies to the main window; restrict scene bootstrap, frame requests, and draw readiness to the owned wallpaper window.
- [x] Bound audio requests to one in flight and clear them on lifecycle changes.

## Task 3: Reuse scene rendering and expose desktop controls

Create `src/renderer/wallpaper/` and integrate graph/Plus scene controls and main audio provider.

- [x] Offer Set as desktop background for an installed Plus scene, with monitor selection, battery saving, clear pending/error/paused state, and Stop; translate all ten locales.
- [x] Render only the full-bleed scene in the wallpaper window with existing quality and brightness safeguards.
- [x] Share a narrow scene-audio context so both the graph and wallpaper use the same runner without a second audio capture or DSP chain.
- [x] Use wallpaper animation-frame requests to obtain fresh local or shared audio even when the main window is hidden, including normalization decay.
- [x] Verify typecheck, scoped lint, native compilation, renderer/preload production builds, encoding, stylesheet compilation, formatting, and diff whitespace.
- [ ] Verify controls in the running app and actual Windows desktop behavior.

## Task 4: Review, regression, commit and push

- [x] Review lifecycle, authorization, power policy, and packaging; fix findings, including rapid pause/resume readiness races and stale UI replies.
- [ ] Add behavioral coverage for request validation, stale starts, helper failure, entitlement loss, unauthorized IPC, pause reasons, and audio request cleanup.
- [ ] After user preview satisfaction, run the relevant and full required suites, inspect the exact staged diff, commit, and push normally.

## Progress

- Design approved by the user's “cont” following the feasibility recommendation.
- Implementation uses current checkout to integrate with the existing scene/audio changes and running dev app. No unrelated files are reverted or staged.
- Native build succeeded with strict MSVC settings; TypeScript and both production bundle builds succeeded. Scoped ESLint has no errors and retains four pre-existing console warnings in `useSceneRunner.ts`. Encoding, stylesheet, formatting, and whitespace checks passed.
- Live Electron inspection was denied by the Computer Use tool. No wallpaper has been attached to the user's desktop, and no app was launched by the agent.
- A user restart of the development session is needed for the new webpack entry points. `CLAUDE.md:42-55` requires preview satisfaction before reading, adding, or running test suites; `CLAUDE.md:307-309` reserves launches for the user. Tests, exact staging, commit, and push remain pending under that order.
- Original shared-file snapshots are in `C:/Users/ivanc/.codex/visualizations/2026/09/13/01a09c0d-a72e-70f3-8e12-17ca3e3ba6ad/wallpaper-baseline/`. Concurrent Plus gifts, ambient/scene, process meter, and native audio work must not be included in this feature's staged diff. The root CMake change is only `add_subdirectory(wallpaper)`; the package change is only the wallpaper executable resource filter.

## Black desktop and multiple monitors (continued 2026-09-13)

- **Black desktop, root cause.** Chromium marks a window's compositor visible only through its own show path; the helper's native `SWP_SHOWWINDOW` never reached it, so the desktop composited the window's background colour and the page's main-thread animation frames starved. Proven with a scratch test pattern attached through the real helper: native show alone gave the background colour on every run (occlusion tracking off made no difference); `showInactive()` after attachment gave the page, moving, between DefView and WorkerW, with no focus taken. `surface.ts` now calls it once, after `ready` and the first visibility report.
- **Coverage.** Windows clamped the hidden top-level window to the work area (2560 × 1392 on a 2560 × 1440 monitor) and Chromium's frame styles added insets; the helper placed the child where the window stood, so the taskbar strip kept the ordinary wallpaper. The helper now places the child over the whole monitor rectangle; verified on a 96-DPI and a 144-DPI monitor.
- **Several monitors.** One surface per monitor (`surface.ts`), owned by `register.ts`; a different visualizer per monitor, or the same one on every monitor. Each helper only keeps its own window somewhere between DefView and WorkerW (`stacked_between`), because demanding the slot directly under DefView made two helpers reorder each other forever; two surfaces ran side by side with no helper CPU time while idle.
- **Controls.** The monitor dropdown is gone: a map of the monitors as Windows arranges them, pressed to choose, with an All monitors toggle; a Manage dialog lists what each monitor shows with Stop per monitor and Stop all. `display.nativeOrigin` is not physical on Windows (a 150% monitor reported -1707), so positions come from `screen.dipToScreenRect`.
- Verified: native build, TypeScript, lint, stylesheet compile, headless renders of the dialogs across layouts, widths and three locales. Ivan confirmed it working in the running app.
- **Back at launch.** `desktop-backgrounds.json` in the app's data folder remembers what each monitor was last set to show, with the monitor's name, position and resolution, plus the battery choice; only Stop removes a monitor from it. The window's first state request brings them back (it is what answers the audio reads), or the membership arriving later does. A monitor is found by its id, then as the same model and resolution nearest to where it stood, then as the same resolution in the same place, because Chromium's id follows Windows' output numbering. A remembered monitor that is not connected is listed as waiting, with a Stop, and comes back when plugged in. Split for size: `manager.ts` (lifecycle), `backgrounds.ts` (surfaces and failures), `arrangement.ts` (file and matching), `conditions.ts` (power), `register.ts` (channels). Proven with the real main code under ts-node: set two monitors, quit, relaunch — both came back on their own; Stop all, relaunch — nothing came back.
- **Wave height and position.** A background is set with the graph's wave as set for watching (`getWatchedGraphWave`, the big modes' shared value, which the pane's sliders write too) and draws its band with `studioSpectrumRect` — the desktop is a stage with no gutters, as the Studio's is. Setting a visualizer again on a monitor already showing it moves the band on the running surface (`setWave`), with no restart; the wave is remembered per monitor and restored at launch, and a file written before waves were kept means the whole band. The page used to hand every scene `[0, 0, 1, 1]`, a band with no width on the top edge (the purple line along the top of Alpine in the first captures). Proven with Alpine, the one harness scene that reads the band: the sky spectrum shortened and lifted when set again, stayed running, and came back that way after a relaunch.
- **Calm motion.** Each monitor is set with `motion: 'music' | 'calm'` (Set dialog: two radio cards; Manage: a Calm switch per playing row; tiles show swells instead of bars and say Calm). A calm page never asks for the music and main refuses its reads anyway. It hears `calmMotion.ts` instead: breaths in 7 s + 9 s pairs, the higher bands trailing the bass, slow swells and a drifting tilted spectrum, no beat and so no accent; every period divides the scene clock's hour. Switching a running background eases between the two over about a second and a half, with no restart. Remembered per monitor; older files mean music. Measured in a lab that drives each scene's own shader through the runner's shaper and response (12 scenes, 192x108): calm moves more than silence and far less jumpily than the showcase music — worst frame-to-frame step within 1.2x of the typical one (music: up to 9x), 1-second drift between silence and music (aurora 3.8 / 9.1 / 9.7, nebula 7.6 / 13.2 / 16.9). On the real desktop: 51 audio reads in 2 s following the music, 0 in 3 s after switching to calm without a restart, 43% of pixels moved over 2 s, and it came back calm after a relaunch with no reads.

## Committed, and scene failures on the desktop (2026-09-14)

- **Committed as c4bc86e8e** after the full check on an exact export of the commit (TypeScript, full Jest, lint, native build and its test, and eleven positive controls, each caught by an assertion rather than a compile error).
- **A scene failing on the desktop is refused like one failing in the graph.** The scene refusals that landed beside it (`sceneRefusals.ts`) keep a scene's code from running again anywhere once it failed in the graph, because a scene resetting the graphics driver a few times a minute takes Windows down. Desktop backgrounds already honoured them (both stores' `load` refuse, and the announcement stops a background showing that scene), but their own failures were not written down: the page reported any runner failure without a reason, main kept it as a renderer failure, and a monitor changing shape or the next launch ran the same code again. The page now passes the runner's reason (`compile`, `context-lost`, `gpu-reset`); main marks the monitor `refused` and reports the look to the store it belongs to (`wallpaper/scenes.ts` routes premium and member looks), which quarantines it, refuses its source and announces, so every other monitor showing it stops too. A refused monitor is never retried on its own — not on a monitor change and not when the looks change — only at the next launch, if its store no longer refuses it, or when somebody sets it. It says why ("failed on this computer's graphics, so it won't be played here again"), offers Stop and no retry, and the status line beside the Visualizers title carries the whole sentence on hover. A page or machine failing without a scene reason is still a renderer failure and still retried.

## Remaining preview and regression checks

1. Restart the dev session, open an installed Plus visualizer, and choose **Set as desktop background**. Confirm monitor/battery choices, focus handling, and visible status.
2. Verify selected-display coverage, clickable desktop icons, other monitors unchanged, and no taskbar window. Exercise a display with negative coordinates or mixed DPI if available.
3. Play Library and external audio, minimize FluidEQ, and confirm continued scene movement and quieter-track response. Repeat while sharing audio.
4. Exercise fullscreen entry/exit (including quick repeats), lock/unlock, suspend/resume, and battery policy. Confirm the wallpaper resumes only after a new frame and music playback is unaffected.
5. Stop and replace scenes; confirm the ordinary desktop returns. Exercise scene removal, entitlement loss, monitor removal, owner/renderer failure, and shell restart with safe fixtures where destructive runtime actions would disrupt work.
6. Done: lifecycle, IPC and native regression coverage, scene-runner mocks for the narrow context, the full suites, and the exact wallpaper changes committed and pushed (c4bc86e8e and the scene-failure follow-up).

macOS and Linux adapters remain a later phase; the Windows implementation exposes no start controls there.
