# FluidEQ Room upgrade implementation plan

**Current handoff instruction (2026-09-19): implementation is approved. Continue in `D:/DEV/_PERSONAL/FluidEQ` on `main`. The prior worktree isolation and no-commit instructions are superseded by the user's request to commit, push and merge everything into main. Preserve concurrent edits and follow the repository checks and normal commit/push workflow. Newer main commit eeea63a3a retired Ocean and renamed Black to Dark; use current main theme tokens and do not restore retired themes from these historical mockup examples.**

> Implementation was approved and Tasks 1-4 are implemented. See README.md for the current main checkpoint and remaining work.

**Goal:** improve headphone Room rendering and add six FluidEQ listening profiles with a clear profile library, focused tuning and fit workflow.

**Architecture:** extend the existing shared C++ DSP core, version Room settings, preserve legacy sound, and reuse the current React Room components and native transport. Use only existing shipped measurements and dependencies.

**Tech stack:** C++20 DSP core/APO/Library host; TypeScript, React, SCSS, Jest, CMake/CTest.

**Spec:** [Room upgrade design](room-upgrade-design.md).

## Global constraints

- Design, mockup and implementation are already approved; preserve the first-screen speaker-editing clarification.
- Re-read `CLAUDE.md` and preserve concurrent changes. The user explicitly requested continuing on main; see README.md.
- No added libraries, SDKs, head datasets or driver. Preserve GPL/source-distribution requirements and current KEMAR notices.
- No allocations, locks, I/O, unbounded work or destruction of heap-backed DSP state on the audio callback. No timer-based UI fixes.
- Keep current presets, saved rooms and entitlement boundaries. No THX branding, quality score or zero-latency claim.
- Native DSP changes must be verified in both the system APO and Library host, with real playback as well as deterministic tests.

## 1. Establish the current baseline and version contract

**Read/modify:** `src/common/dsp/chain.ts`, `chainWire.ts`, `roomPresets.ts`; `src/renderer/dsp/savedRooms.ts`; `native/dsp-core/include/fluideq/room.h`, `chain.h`; `native/dsp-core/src/chain_decode.cpp` and host/APO settings consumers; existing common Room and wire tests.

- [ ] Record current settings/wire counts, legacy preset values, current Room impulses at all supported rates, low-latency behavior, output peak, CPU and native build identity. Identify which concurrent modifications must be included before choosing a base.
- [ ] Add a Room renderer-version field and explicit new fields described in the spec. Missing version remains legacy; featured profiles request the new path. Maintain stable old preset IDs and add new IDs without changing existing ordinal meanings.
- [ ] Update JS normalization, persistence, native types and wire parsing/count/version checks atomically. Preserve head/correction while applying a profile; retain the current full-reset contract separately.
- [ ] Write meaningful regression coverage for old settings and saved-room fixtures, unknown/invalid fields, bounds, mixed-version engine rejection, new-profile round trips and profile/reset ownership. Confirm old Room fixture output remains unchanged.

**Gate:** legacy saved rooms load and serialize correctly; old engines cannot misread the new payload; disabled/legacy Room behavior and unrelated processors remain unchanged.

## 2. Improve directional rendering first

**Modify:** `native/dsp-core/src/room_kernels.cpp`, `room_internal.h`, `room.cpp`; `native/dsp-core/tests/room_test.cpp`, `room_presets_test.cpp`; add `native/dsp-core/tests/room_interpolation_test.cpp` and register it in `native/CMakeLists.txt`. Touch `.erb/scripts/build-room-heads.ts` only if the verified asset pipeline requires new derived metadata, preserving source notices.

- [ ] Introduce delay-aligned adjacent-direction interpolation on the new renderer path, with smooth reconstructed delay and wraparound across the azimuth ring.
- [ ] Preserve diffuse-field correction and ear cues. Keep all estimation/preparation off the processing thread; reuse the existing state-handoff machinery.
- [ ] Add synthetic-head assertions with known ear delays, boundary/wraparound checks, continuous angle sweeps, mirrored-direction symmetry, representative real-head response comparisons and bad-input repair tests.
- [ ] Verify click-free movement and profile switching at 44.1/48/96/192 kHz in regular and low-latency modes.

**Gate:** stable tone and smooth movement without timing discontinuity; no real-time allocation/locking regressions. Compare against current Room audibly before layering ambience.

## 3. Separate space controls and add restrained ambience

**Modify:** `room.cpp`, `room_kernels.cpp`, `room_internal.h`, `room.h`; add `native/dsp-core/src/room_ambience.cpp` and `room_ambience.h`; register the source in `native/CMakeLists.txt`; extend `room_test.cpp` and add `room_ambience_test.cpp`.

- [ ] Make early-reflection energy independent from wall damping and distance, with a real off endpoint and a stable direct path.
- [ ] Implement an original preallocated feedback-delay network with normalized feedback, bounded decay/damping/mix, and sample-rate-safe delay sizing. Keep a hard dry path for zero ambience.
- [ ] Preserve compatible tail state and crossfade incompatible states without allocating or destroying DSP buffers in the callback. Keep cold/off behavior and silent inputs well-defined.
- [ ] Test impulse decay, prolonged bounded-noise drive, silence/denormals, parameter extremes, coefficient smoothing, head changes, rate changes, tail transfer, and CPU/memory bounds. Do not copy external reverb code.

**Gate:** stable decay and no clipping/underruns; listening confirms that low ambience improves externalization without blurring dialogue or cues. If the effect fails this gate, revise it before promoting the profiles; do not hide failure with a louder preset.

## 4. Protect localization and make comparison honest

**Modify:** `native/dsp-core/src/chain.cpp`, `chain_internal.h`, related public settings; `native/dsp-core/tests/chain_surround_test.cpp`, `chain_transfer_test.cpp`, `chain_latency_test.cpp`, `dimension_test.cpp`; `native/system-apo/src/dsp_chain.cpp` and `native/dsp-host/src/main.cpp` status where needed.

- [ ] Apply Preserve position only while Room is active, bypassing the downstream Dimension widening transform without overwriting its saved settings. Trace other post-Room stereo transforms and make any conflict explicit before altering them.
- [ ] Preserve sub/direct-path alignment and current low-latency selection/latency reporting. Profiles never change global performance mode.
- [ ] Add Room-only compare state with crossfaded, delay-aligned reference. Stereo uses the original pair; surround uses a named conventional stereo fold-down. Apply bounded comparison-only gain matching based on a sufficiently long captured segment; if no trustworthy estimate exists, show “level match unavailable,” not a false match.
- [ ] Test bypass/compare transitions, restoration of Dimension state, missing head, unsupported/mono layouts, actual channel masks, 5.1/7.1 folds, direct/sub alignment and both processing modes.

**Gate:** compare affects only Room's contribution, status is truthful, and measured/reported latency agrees. Do not publish a total “0 ms” estimate from Room's buffering alone.

## 5. Build and tune the profile library

**Modify:** `src/common/dsp/roomPresets.ts`, `chain.ts`; `src/renderer/dsp/savedRooms.ts`; `src/__tests__/unit_tests/common/dspRoomPresets.test.ts`, `dspRoomSpeakers.test.ts`; `native/dsp-core/tests/room_presets_test.cpp`.

- [ ] Add Reference, Music Space, Cinema (new versioned ID), Game World, Competitive and Live Venue using the new renderer. Retain all Classic entries and their values.
- [ ] Encode source-aware intent: stereo expansion where explicitly chosen, discrete-channel rendering for surround, short/off ambience for games. Keep numerical bounds centralized and mirror final profile values in native fixture coverage.
- [ ] Test profile selection, custom edits, save/restore, classic/new version coexistence, listener preference preservation, unavailable centre/sub controls and solo release when a speaker is no longer fed.
- [ ] Tune gains/decay on measured safe output and equal-level listening. Do not adjust several unrelated rack processors to manufacture profile differences.

**Gate:** every featured profile has a clear audible purpose and survives peak/colouration checks across representative material; no silent retuning of existing saved rooms.

## 6. Implement the approved interface

**Modify:** `src/renderer/dsp/DspRoomCard.tsx`, `DspRoomBar.tsx`, `DspRoomGraph.tsx`, `DspRoomSpeakerPanel.tsx`, `DspRoomLibrary.tsx`, `DspRoomFitDialog.tsx`; `src/renderer/styles/Dsp.scss` and the current Room partials if split before implementation; `src/common/i18n/*/dsp.ts`.

**Add focused components if required:** `src/renderer/dsp/DspRoomProfiles.tsx`, `DspRoomQuickControls.tsx`, `DspRoomCompare.tsx`. Keep existing native-meter subscriptions isolated; do not re-render the profile library every audio frame.

- [ ] Implement the approved Room/Tune/Fit composition, profile browser with Featured/Classic/Saved views and concise source truth labels.
- [ ] Wire quick controls to the physical parameter mapping, preserve existing drag/mute/solo and keyboard editing, and disable controls only for actual source/power/access constraints.
- [ ] Keep guided Fit's existing pair-order/tie rules unless a separate audio validation supports changing them. Explain size variants accurately; preserve manual head selection and correction behavior.
- [ ] Add explicit compare state, restore-profile vs full-reset actions and non-destructive save behavior. Keep UI transitions timer-free and respect reduced motion.
- [ ] Apply the existing Free/Plus checks and add locale text in the repository's required ten-locale batches; use actual Ocean/Black design tokens and system fonts.
- [ ] Extend `src/__tests__/unit_tests/renderer/dspRoomCard.test.tsx`, `dspRoomLibrary.test.tsx`, `dspRoomFitDialog.test.tsx`, `RoomOutputNotice.test.tsx` for the behavioral branches above. Add profile-browser coverage if it becomes a separate component. Avoid tests that merely restate markup.

**Gate:** desktop and narrow screenshots look like FluidEQ, keyboard access works, long translations fit, and source/entitlement/compare states are comprehensible.

## 7. Validate, listen, and land after approval

- [ ] Run focused renderer/common tests with `node node_modules/jest/bin/jest.js --runInBand --runTestsByPath` and explicit changed test paths. Do not use `pnpm test` as the first targeted check.
- [ ] Build native tests with the existing `.erb/scripts/build-native-dsp.ts --test` workflow. Run the relevant CTest Room, interpolation, ambience, surround, transfer, latency, Dimension and output-quality targets; then run required repository-wide gates and packaging checks once.
- [ ] Run TypeScript and changed-file lint/style checks with current repository scripts. Record unrelated pre-existing failures rather than weakening checks.
- [ ] Exercise actual system playback and Library playback on the verified new native builds. Test profile switching, source changes, head changes, low-latency/regular modes, output switching, bypass/compare, silence and sustained playback. Confirm meters describe what is audible.
- [ ] Record hardware, sample rate, buffer sizes, callback percentiles, total measured delay and underruns. Apply the performance acceptance gate in the spec.
- [ ] Run blinded, level-matched listening against current Room and, where legitimately available, THX. Measure positional errors separately from preference. User listening approval is required to call the sound successful; visual mockup approval alone does not establish sound quality.
- [ ] Review the final diff, stage only this work, complete repository hooks, commit and push as authorized by the implementation request. Report measured outcomes, audible verification and any remaining limitations plainly.

**Delivery boundary:** today delivers the design and interactive mockup only. No app code, DSP settings, audio assets, installed engine or Git history has been changed by this planning task.
