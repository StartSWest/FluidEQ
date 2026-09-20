# FluidEQ Room upgrade — resume from main

## State after the 2026-09-19 evening session (read this first)

Tasks 5 and 6 are built and the integration review is done. What follows below this section is the handoff that session started from; where the two disagree, this section is current.

- **Integration review (Task 4):** two independent read-only reviews, native and TypeScript, no finding. One symmetry fix folded in (`feq_chain_reset_room` clears `denoise_align_line` too).
- **Two engine faults found by measuring, both fixed:** the Room played 6 dB louder on a 96 kHz output and 12 dB louder at 192 kHz (heads resampled as sounds, not filters; the 192 kHz doubling likewise), and the new Ambience tail sat 40-52 dB under the walls that feed it at every setting. See the two Room bullets in CLAUDE.md. The heads were regenerated; the medium head's 48 kHz block is byte-identical to what shipped.
- **Task 5:** six featured rooms after `custom` on the wire, measured by `room_profiles_test.cpp` (CTest `room-profiles`) through the shipped head at four rates, three streams, both bufferings. Walls / tail relative to a speaker's direct sound on 7.1: Reference -36 / none, Music Space -28 / -38, Cinema -25 / -33, Game World -32 / -42, Competitive none / none, Live Venue -21 / -26.5 dB. A loud 7.1 programme at -20 dBFS a channel peaks at -13 dBFS; a full-scale stereo record peaks at +2.0 to +3.0 dBFS, so it needs that much headroom upstream. Saved rooms never overwrite.
- **Task 6:** the approved mockup's emblem header, Browse library and Room/Tune/Fit tabs were built, shown to the user, and **rejected** in favour of the app's own idiom: the standard preset bar, one page, everything visible, filling the width. CLAUDE.md records what stands and what must not come back. The first-screen speaker requirement holds: the selected speaker's pane is the first band and is that speaker's from the press of a drag. Library DSP updates coalesce (one in flight, the newest waiting, engage/disengage as barriers).
- **Still open:** real listening to the six rooms and Ambience; the Library playback host relinked (it was held open by the running app during the last full native build — the engine DLL and every test built); the help guide's Room chapter, which still pictures the old page (`helpGuide.ts`, `32-dsp-room.png`, the `help.room.*` strings); hardware CPU/underrun measurement from `task-7-qa.md`.

Updated 2026-09-19 after the user explicitly requested saving and pushing main, merging the Room worktree into main, and handing off to Claude there. **The Git consolidation is done; the Room feature is still unfinished.**

## Start here

Continue in **D:/DEV/\_PERSONAL/FluidEQ**, branch **main**. Read CLAUDE.md and this handoff first. Inspect current Git status before editing: other tasks share this checkout, so do not assume it stays clean.

- Main's existing changes were saved in **f53c904b8c9205b4d045089e17cd8266bede6f52** and pushed before the Room merge. This includes the existing Room speaker/solo foundations and account/Plus/style work. The earlier scene/pet commit is retained.
- The complete Room implementation was committed as **f35614c483a2994fdea42d6dfa6b894455db6904** and merged into main. No worktree source is waiting to be cherry-picked.
- Concurrent theme commit **eeea63a3a** was also preserved in merge **250e32fed**. It retired Ocean and renamed Black to Dark. Use current main themes/tokens; older Ocean/Black mockup and QA examples are historical and must not restore retired themes.
- The approved design, plan, interactive mockup, remaining task briefs and prior implementation reports are now alongside this file in **docs/handoffs/room-upgrade/**.
- The old C: worktree is retained for historical logs/benchmarks only. Do not resume development there or repeat its old private-index reconciliation.
- Current user instructions supersede older instructions to avoid D:, exclude account changes, or defer committing/merging. Normal implementation, regression coverage, checks, focused commits and normal pushes are already authorized. Preserve later concurrent work.

## User-approved product direction

Improve Room with our own spatial DSP and attractive listening profiles, using existing dependencies and shipped measurements. No THX SDK/branding, new head dataset, new driver or licensing dependency. Retain current GPL-3.0-or-later distribution and KEMAR notices. Do not promise superiority over THX or total zero latency; real listening is pending.

**Binding UI requirement:** speakers stay draggable by hand on the FIRST Room screen. Clicking or beginning to drag a speaker immediately shows its angle, distance, level, mute and solo settings in the improved pane beside/below the diagram. Keep that pane visible and updating while dragging. Preserve paired movement, Shift/Ctrl independent movement, and keyboard interaction. Keep the proposed advanced Room/Tune/Fit settings too. No further design approval is needed for this agreed direction.

## Implemented, and what remains

Tasks 1-4 are implemented and previously reviewed. Do not redo them:

1. Versioned Room settings/persistence and bounded tagged wire extension. Missing version stays v1; old leading wire values and legacy behavior remain compatible.
2. V2 direction interpolation over existing measurements, aligned ear delays and head scaling; legacy nearest-direction path preserved.
3. Reflections-only Space and original bounded four-line late ambience. Rate-scaled kernels, preallocated callback state, bounded retirement/transfer and legacy lifecycle preservation.
4. Delay-aligned Original/reference fold-down (no LFE), captured paired-energy matching bounded to +/-6 dB after at least 1.5 seconds of useful signal, native status reporting, Dimension position protection without rewriting saved settings, and old-engine gates/race fixes.

The integration with newer main is implemented but **its separate source review remains pending**. The user requested committing this checkpoint and handing off now. Read task-4-main-integration-report.md, inspect actual current source, and review this before new profiles/UI:

- Game mode capability remains 1.10; new Room requires 1.11; DLL version is 1.11. Status 1.1/carried 1.9 gates remain.
- Library protocol 8 and 192-byte telemetry remain separate from 560-byte analysis/Room reports.
- Game metadata is read at its fixed slot before the Room trailer; writer fallback must not remove the trailer's final scalar.
- Control-thread planned stages and callback adopted/processed Room/Dimension stages are separate.
- Callback-owned raw-sharing routing clears Room capture/reference/tails and queued Room-related audio across route boundaries; raw processing delay is zero, not total device/network delay. Full-chain reset is intentionally avoided because voice reset may allocate.
- Changed Room reports publish even without meter windows, with dedupe and reconnect handling.
- Warmed route allocation counters passed. Initial EQ handoff still has a pre-existing callback deletion in chain_linear.cpp; do not claim the entire rack is allocation/destruction free.

Then complete these steps in order:

### Task 5: profiles and non-destructive saves

Read [task-5-brief.md](task-5-brief.md). Add six distinct v2 Featured profiles: Reference, Music Space, Cinema with a new ID, Game World, Competitive, Live Venue. Keep all 11 Classics' IDs/values/sounds exact. Append new IDs AFTER existing custom to retain every old wire ordinal; this specific compatibility decision overrides older generic advice about insertion order.

Profiles own the complete Room shape, preserving personal head/correction, already-spatial preference, comparison selection, global Game mode and other processors. All Featured profiles preserve position. Reference/Competitive late ambience is exactly off. Measure actual shipped-head output across rates/layouts/modes and use the real TS values in fixtures. Save without overwriting existing rooms: case-insensitive unique names within 40 characters and honest storage failures. Update all 10 locales together.

### Task 6: first-screen editor and advanced UI

Read [task-6-brief.md](task-6-brief.md) and [fluid-room-preview.html](fluid-room-preview.html). Implement compact diagram plus immediate selected-speaker pane, advanced Room/Tune/Fit, Featured/Classic/Saved browser, Restore profile versus full Reset, keyboard/pointer cancel behavior, and truthful comparison/source/update-required states. The old layout's graph pushed the editor below the screen; SVG speakers lacked keyboard semantics. Classic v1 cannot present apparently working v2 controls without explicit upgrade.

Preserve existing Free/Plus boundaries, current Dark theme tokens, reduced motion and all 10 locales. No timers or meter-driven whole-card rerenders. Add completion-driven latest-value coalescing for Library DSP updates: one in flight plus latest pending, preserving engage/disengage/cross-controller barriers, failures and final drag value. Keep main's newer latency handling. Distinguish actual LFE from derived stereo in Sub availability; do not change legacy bass routing.

### Task 7: final proof

Use [task-7-qa.md](task-7-qa.md). Run final native/TS/build/CI gates, legacy bank comparisons, actual profile measurements, responsive/accessibility/console UI checks, broad review and normal commits/pushes. Physical playback/listening and underrun checks remain open. Do not call the whole feature done before profiles/UI/review/validation are complete.

## Fresh consolidation verification

Source tree tested for the merge: **9508ed82a8c9122df28ac9da253a30f06d766206**, based on saved main f53c904b8. The three-way merge was conflict-free and preserved all newer main changes. The feature delta is 65 paths (4,392 additions, 155 deletions).

- Before saving main: TypeScript, stylesheet/token and UTF-8/encoding checks passed; 6 focused Jest suites / 74 tests passed; normal pre-commit hooks passed.
- Combined Room/main source: TypeScript passed; 21 focused Jest suites / 328 tests passed.
- After preserving the newer theme commit: its 2 focused suites / 22 tests passed; final TypeScript and style checks passed again.
- Native build/test result: The native build stage reconfigured and built the merged source successfully; all 12 focused Room/contract/interpolation/ambience/comparison/transfer/surround/latency/meter/APO groups passed (20.57 seconds). The exhaustive 68-group run was deliberately stopped during the long preset-safety-chains test after its first 24 groups had passed; its interrupted exit is not a passing full-suite result. Finish that full gate during Task 7 (CTEST_PARALLEL_LEVEL can run independent partitions in parallel). No app launch or audio device was used.
- Final normal commit hooks and encoding check: Both passed for the implementation commit; see the normal hook output and room-consolidation-encoding.log.

Logs are in the artifact directory below as room-consolidation-native-focused.log, room-consolidation-native.log and room-consolidation-jest.log. These checks validate the committed foundation, not the unfinished profiles/UI or real listening. The full native catalogue suite, full JavaScript suite, production bundles and final feature acceptance remain Task 7 work.

## Existing evidence and tools

Artifact directory: **C:/Users/ivanc/.codex/visualizations/2026/09/19/01a0ba24-bfc0-72d0-a269-4376df2bf665**.

Historical scratch: **C:/Users/ivanc/.codex/worktrees/room-spatial-upgrade/FluidEQ/.superpowers/sdd/room-upgrade-plan**. The source reports are copied here; full logs, manifests, benchmarks and legacy banks remain in scratch. The old complete frozen tree is 5f591cfd25a2f37a1e2cb199ccc4b51f362945e2; incoming snapshot was 4f22dbba71a6e5fee985709f1800dbebd5ecdc55; integration review base was 29fd47deb35f6a13db5e14b6924d65d144800dc1. These are historical references, not additional changes to merge.

- Real-component UI harness: room-ui-harness.tsx, build-room-ui.cjs and entitlement/engine API substitutes in artifacts. It uses real components with explicitly simulated reports and no audio. Helpers currently reference the old C: source root (including imports and ts-loader rootDir); adapt all those references to main before rebuilding. Old loopback server may still serve port 62621. Do not mistake its stale bundle or the mockup for current product UI.
- Offline real-host smoke: room-host-offline-smoke.cjs takes the repository path. Prior eight-transition run covered matched Room, Original, raw bypass/return/relearning, spatial bypass, restore and off. It used actual host/wire/FrameReader without START or any device. Prior binary hashes/results are under room-audio-samples/host-smoke. Processing delay is unavailable offline because main requires a running endpoint.
- Audition helpers: prepare-room-auditions.py, export-room-audition-profiles.cjs and scratch bench/room_audition.cpp. Original synthetic music/directional source exists; final six-profile renders wait for Task 5. Prior Original smoke matched source plus silence exactly. No clips have been listened to.
- Prior 16 legacy impulse banks and 65,536-sample lifecycle check were byte-identical. Room-only 48 kHz p99 was roughly 136-195 us stereo / 510-964 us 7.1 against a 2,667 us block period. At 192 kHz/7.1 both legacy and v2 exceeded the 667 us period under some loads. Preparation reached about 240 ms at 192 kHz. Re-measure under matched conditions; no final hardware headroom claim.
- A residual-phase-unwrapping experiment was deliberately rejected. Do not merge scratch direction-probe code.

Use the existing dependencies; do not reinstall/clean them. Direct Jest: node node_modules/jest/bin/jest.js --runInBand --runTestsByPath <paths>. Native build/tests: node node_modules/ts-node/dist/bin.js .erb/scripts/build-native-dsp.ts --test. This builds/tests only; avoid pnpm test for focused work because it also invokes device/audio smokes. Read .github/workflows/test.yml for final required gates. Run normal hooks and never weaken checks.

Hook/runtime note: the original C: worktree lacked Husky's ignored generated launcher. The final Room commit was recreated with the normal repository hook enabled, and lint passed on all 28 changed JS/TS files. pnpm exec automatically refreshed the shared dependency installation while bootstrapping; postinstall warned that the development Electron branding rename hit EPERM because the running binary was locked, then completed successfully. No running app was closed or restarted. That development branding warning is not a Room test failure; do not reinstall or stop the user's app solely for this handoff.

Bundled Node: C:/Users/ivanc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe. Python is under the same dependency root at python/python.exe. A fresh main native build is required before trusting main's executables; consolidation's native verification ran in the retained worktree on the identical merged source. Do not copy stale CMake caches between roots.

CLAUDE.md says **“Do not run the app yourself. I run it.”** Do not launch another FluidEQ window, install the system engine, or restart Windows audio automatically. Prepare all independently verifiable work first, then leave only the real launch/listening action for the user.

## Immediate resume order

1. Verify main status, read CLAUDE.md, this file and the integration report.
2. Review the implemented main integration and resolve substantive findings.
3. Complete Task 5, then Task 6 with first-screen speaker editing.
4. Run Task 7, commit/push normal focused changes, and state the remaining real listening gate honestly.

Codex stopped feature development for this handoff. There is no need to re-create a worktree, repeat old merges or request design approval again.
