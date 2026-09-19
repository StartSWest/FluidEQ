> Historical implementation evidence from before consolidation. Paths, branch hashes and pending Git actions below describe that earlier checkpoint. README.md is authoritative for current location, authorization and fresh verification.

# Task 3 report: independent early space, late ambience, and bounded ownership

Implemented only in C:/Users/ivanc/.codex/worktrees/room-spatial-upgrade/FluidEQ against Task 2 snapshot 35947cd58e5a7fb5429e0af0189e3b195110c615. No staging, commits, push, original D: edits, subagents, dependencies, copied reverb implementation, new measurement data, UI, profiles, or comparison behavior. Native build is idle after final checks.

## Signal design

- V1 kernel construction keeps its original fixed 2048 taps, integer distance cap, absorption arithmetic, and sample addition order. The new late parameters remain zero for V1. Controller owns independent frozen-bank SHA256 verification; this report does not claim it was rerun here.
- V2 Space is a gain applied only to the four reflected arrivals. -60 dB skips them completely, including their send. Direct HRIR, distance gain/delay, sub routing, bass crossover and latency reporting are untouched by Space.
- V2 Walls retains physical absorption, multiplying images by 1-walls, and also applies a one-pole low-pass to each reflected HRIR. Corner = 12000*(1/12)^walls Hz, capped at .45*rate: 12 kHz at hard walls, 1 kHz at fully absorbed walls (which are silent). This intentionally resolves the old amplitude-only field into absorption plus spectral damping for version 2 only; saved version 1 rooms retain their old wall model. Filter tails below 1e-12 amplitude are set to zero during preparation; direct responses receive no such filter or threshold.
- V2 capacity is ceil(2048*rate/48000), with a defensive minimum of 513 for API rates below the supported sweep. This preserves a 42.667 ms physical window and a 21.333 ms direct-delay allowance across 44.1/48/96/192 kHz; the entire allowed 5.5 m distance spread now fits. Task 2 interpolation receives this budget, including its FFT and output buffer sizing. Exact-zero kernel suffixes are trimmed, while retaining at least the direct-head split plus one tail sample. Replacement warmup takes the maximum over every prepared ear/source, because trimmed lengths can differ.
- The original four-delay FDN uses 29.7/37.1/41.1/43.7 ms integer-rounded delays, a normalized Hadamard matrix, one-pole feedback damping, and per-line feedback exp(-ln(1000)*delay/decay). H is orthogonal, the low-pass has gain no greater than one, and every feedback gain is below one. This is a contractive network without a limiter. Excitation is scaled by (1-maxFeedback)/4, stereo output projections by 1/8, and source image sends by 1/7. Decay is bounded .1..1.8 s; damping 1..12 kHz is capped below Nyquist. Subnormal-scale history below 1e-24 is zeroed, with finite guards. Results are deterministic.
- The send comes from each rendered source after its bass high-pass. It uses actual image-source delays, distance/level/centre gain, Space and speaker mutes. The derived music feeds use the same path; LFE and the managed sub bus never enter it. Regular mode adds the convolver's 512-frame buffering offset to image-send delays; low latency adds none. This prevents the late field from arriving a partition early relative to ears and bass.
- Four delay buffers, the eight source-history rings, and block send scratch are allocated at create. Send rings include the physical window, regular buffering offset, and max block length, so clearing the next block cannot erase a near-window delayed sample. No callback allocation, locks, randomization or I/O is introduced.

## Tail and coefficient policy

Space zero stops new reflected excitation after the existing prepared-set crossfade; an already audible late tail drains naturally. Ambience zero is an exact hard-dry late stage: the state is cleared once, excitation is disabled, and re-enable cannot uncover an unheard stored late tail. The room crossfades the mix sample by sample; the FDN does not add a second lagging mix smoother that would still be audible when the exact-zero endpoint arrives. Feedback/damping/injection coefficients slew over 20 ms. The initial state is empty and starts at its prepared coefficients, preserving mode-compensated impulse timing.

Ordinary dial/chain changes retain the room-owned late and send histories. Compatible chain transfer exchanges audio-owned kernel sets, preallocated history storage, and scalar cursors without allocation or destruction. The outgoing room owns displaced prepared state for control-thread cleanup. Same-rate head changes and buffering-mode changes preserve the existing decaying field. Explicit reset clears late/send and all existing source histories. Inactive boundaries always clear new late/send state; broad source/bass reset applies only when the outgoing or incoming prepared renderer is v2, preserving pure-v1 frozen histories; existing early convolvers keep their legacy reset convention. A rate/width/block-size mismatch cannot share histories: ownership stays with its original graph and the fresh graph fades in over 21 ms. The old graph's destroy thread owns cleanup.

## Lifetime design and backpressure proof

The four return slots remain four; this is not a larger probabilistic ring. There is one serialized audio producer (process/transfer) and one serialized control consumer/configurer per room, as required by the existing API. Destroy requires that neither is concurrently using that room.

- Audio counts empty slots with acquire loads before consuming ownership. Control only changes occupied slots to empty, so it cannot reduce a reservation. Audio is the sole producer and publishes a retired pointer by release store into an observed empty slot. Control takes it by acq_rel exchange, then destroys it. Same-thread atomic coherence prevents the producer from observing an old empty value before its own occupied store. The scan is bounded at four; there are no CAS retry loops.
- Adoption reserves for all possible displaced pointers before taking the handoff. If capacity is unavailable, the published target stays owned by the handoff. Audio-owned pending targets can reserve their exact known demand. Completion with no retirement slot keeps both owners and outputs the fully faded replacement until capacity returns; it never destroys or leaks the older owner.
- Compatible transfer exchanges live/next owners and histories with the outgoing room. Existing published and pending targets stay in their rooms; a primed prepared room without either retains its newest set in pending before the exchange. No transfer retirement slots are required, even with both queues full. Concurrent publication never sees a pointer republished by audio. A precise pending reservation still lets adoption use its exact known slot demand.
- Control sweeps before building and again after publishing. The latter matters: callbacks can retire older sets while preparation runs; the final dial write must not leave its new target stuck behind those owners waiting for another write.
- A saturated compatible transfer carries the exact outgoing live/fading state and histories into prepared. Previous now owns displaced prepared live/next sets and can be destroyed immediately on control. Published/pending targets remain owned; full return slots backpressure their adoption while the carried audio continues. The next control reclamation/publication permits adoption. No additional ring, overflow slot, allocation, or retry loop is added. Only a format-incompatible transfer keeps the separate fresh-output fade-in policy.
- Owned state is bounded by live, next, pending, handoff and four retirement slots per room, plus a control-thread construction temporary. No overflow owner is dropped. All destruction occurs at control publish/sweep or final destroy. An impossible reservation violation terminates instead of silently losing ownership; all observed paths and adversarial fixtures preserve the invariant.

## Verification

First test build succeeded; pre-implementation room-ambience exited 1 with three expected failures: Space-off reflection removal, presence of a late tail, and retirement backpressure. See task-3-red.log. The expanded mode test then found an initial mix-smoothing timing difference up to 8.41e-6 between compensated regular/low modes; initializing the empty network at prepared gain corrected it without weakening the assertion. Exact final output differences are below 4.6e-16.

Commands from the isolated worktree:

1. `cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd` (Visual Studio vcvars64 and bundled CMake, --build native/.build --parallel 4): native build successful. Final product build and tests ran after all behavioral edits; only a trailing blank line was removed afterward.
2. `C:/Program Files/Microsoft Visual Studio/18/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/ctest.exe --test-dir native/.build --output-on-failure -R "^(room|room-presets|room-contract|room-interpolation|room-ambience|chain-surround|chain-transfer|chain-latency)$"`: 8/8 passed, exit 0, 17.13 s. Evidence: task-3-ctest.log; detailed final ambience output copied to task-3-final-ambience.log.
3. `node .superpowers/sdd/room-upgrade-plan/task-3-diff-check.cjs`: all ten scoped files clean, exit 0. This compares actual current files with exact blobs extracted from the controller snapshot, including new files via empty baselines; it neither stages nor changes Git state.

Coverage includes supported rates and both latency modes; full 5.5 m direct-delay spread; impulse early/late separation; Space gain; exact Ambience zero and re-enable; actual reflected wall spectrum; broadband decay and 8 kHz damping; six seconds of amplitude-4 DC/sine/deterministic noise; coefficient extremes/transitions; reset; head/rate/buffering changes; exact compatible tail transfer; all-muted derived music feeds; 5.1 and 7.1 LFE-only inputs; managed-bass rejection; callback block sizes 1 and 128; saturated process/transfer; a fully populated last inactive handover with no further control write; concurrent 80-publication process and repeated transfer stress.

Global new/delete counters surround actual feq_room_process and feq_room_transfer. All callback allocation and destruction deltas were zero. The final global heap-owner balance returned to its pre-fixture value, including publication, saturated queues, and transfer paths. Counters cover the current new/delete-backed DSP storage; this is not an OS scheduler/lock profiler or a thread-sanitizer run.

## Measurements

- Regular/low-latency full impulse agreement after 512-frame compensation: maximum differences 4.41e-16, 4.51e-16, 2.64e-16, and zero at 44.1/48/96/192 kHz respectively.
- Compatible late-tail transfer: maximum sample difference zero against uninterrupted reference.
- At maximum 1.8 s decay, standalone impulse late energy after 2.5 s was 9.43e-14 / 8.38e-14 / 3.88e-14 / 1.90e-14 across the four rates, versus early energy 4.56e-5 / 4.12e-5 / 1.82e-5 / 8.68e-6. At .1 s decay the measured late energy was zero. Maximum standalone unit-impulse peak was .01828; maximum amplitude-4 prolonged-drive wet peak was .29573. These are wet-network measurements, not a guarantee of full-room peak unity for arbitrary multi-channel levels.
- The 1 kHz versus 12 kHz damping setting reduced sustained 8 kHz late energy to .001323 of the high-damping-corner case.
- Reflected 8 kHz/DC power ratio was .018418 for walls .9 versus .422227 for walls .1, after isolating reflections; this verifies a spectral change beyond absorption.
- At 20 Hz, enabling source bass management reduced late-send energy to 1.514e-5 of the unmanaged case. Surround LFE-only wet/dry outputs were exactly equal.

Preallocated additional history (128-frame max block, excluding vector/object metadata and prepared kernels):

| Rate   | FDN doubles | Source-ring floats | Send scratch doubles | Approx KiB |
| ------ | ----------: | -----------------: | -------------------: | ---------: |
| 44100  |        6686 |              20184 |                  128 |     132.08 |
| 48000  |        7278 |              21512 |                  128 |     141.89 |
| 96000  |       14554 |              37896 |                  128 |     262.73 |
| 192000 |       29106 |              70664 |                  128 |     504.42 |

These buffers are prepared for every Room, including a currently legacy/dry room, so changing settings never needs callback allocation. Prepared v2 convolution storage can increase at high rates with the restored physical window; exact silent-tail trimming reduces that where applicable.

The test times 1,200 stereo 128-frame callbacks with a synthetic impulse head, paired v2 Ambience 0/1, on the controller's i9-14900HX environment. Final run:

| Rate   | Regular wet p50/p95 us | Regular median delta us | Low-latency wet p50/p95 us | Low-latency median delta us |
| ------ | ---------------------- | ----------------------: | -------------------------- | --------------------------: |
| 44100  | 8.3 / 110.1            |                     3.7 | 47.8 / 152.7               |                          .6 |
| 48000  | 8.4 / 113.6            |                     3.8 | 50.1 / 160.2               |                         4.9 |
| 96000  | 8.5 / 113.0            |                     3.9 | 77.6 / 241.3               |                         4.2 |
| 192000 | 8.5 / 179.1            |                     3.9 | 77.9 / 260.6               |                        34.8 |

This is not an isolated benchmark. Other successful runs printed typical additional medians 2.4..6.5 us, with scheduling/frequency changes producing .6 and 34.8 us exceptions. The detailed log includes p99/max. It establishes added work, not real-device headroom. Controller must repeat its shipped-head stereo/5.1/7.1 cost and preparation matrix; its existing 192 kHz/eight-channel baseline already misses the half-buffer CPU gate, which remains an explicit limitation. No all-rate performance pass is claimed.

## Exact product/test files

- native/CMakeLists.txt
- native/dsp-core/include/fluideq/room.h (lifetime/reset documentation)
- native/dsp-core/src/room.cpp
- native/dsp-core/src/room_internal.h
- native/dsp-core/src/room_kernels.cpp
- native/dsp-core/src/room_interpolation.h
- native/dsp-core/src/room_interpolation.cpp
- native/dsp-core/src/room_ambience.h (new)
- native/dsp-core/src/room_ambience.cpp (new)
- native/dsp-core/tests/room_ambience_test.cpp (new)

Scratch scripts/reports/logs are under .superpowers/sdd/room-upgrade-plan and are not product changes. The controller's manually enumerated benchmark source list must include room_ambience.cpp as well as room_interpolation.cpp.

## Remaining integration limits

Controller review, frozen-v1 bank comparison, shipped-head cost/preparation measurements, listening and actual-device underrun validation are outside this implementation subtask. No THX superiority, zero total device latency, click-free exceptional saturation, or perceptual room realism claim. The three independently reproduced engine-dsp-chain game-mode failures remain unchanged and were not included in this eight-target run. No unrelated changes were made to address them.

## Review fix round 1 (reviewed tree 93874d35744378597dad1c322242314c96f2432f)

Both Important findings were reproduced and fixed. This section supersedes the initial implementation's saturated cold-fade fallback and its disable/reset claims. Product scope for this round is only native/dsp-core/src/room.cpp, native/dsp-core/include/fluideq/room.h, and native/dsp-core/tests/room_ambience_test.cpp. No commits, staging, original D: changes or subagents.

### Inactive history replay

Inactive processing returns without advancing its source rings. Previously inactive adoption cleared only the FDN, leaving reflection-send history frozen. Low latency also left its direct-FIR source reach frozen, which could replay early arrivals on re-enable. Inactive/initial incompatible adoption now calls the existing allocation-free Room reset so send history/cursor, FIR source history, upmix and bass histories are cleared together. Ordinary compatible active changes keep their tails.

The integrated regression sends an impulse for one 128-frame block, disables Room, processes one second of silence, then enables Room and records another second with no input. Before the fix, replay energy was 3.28348195e-7 in regular mode and .0309439519 in low latency. Both are exactly zero after the fix. This exercises actual feq_room_process/configure, not only the standalone FDN.

### Saturated audible handover

The old fallback could not preserve continuity: fading a fresh graph in did not fade or retain the outgoing tail. Compatible transfer now exchanges live, next, blend, warmup, handover gain, FDN/source histories, bass/upmix states, FIR reach and sub-delay storage with previous. Sub-delay descriptors, including their buffer pointers, move with the exchanged vector storage. This uses existing owner fields in both rooms and requires no return-slot capacity. Previous owns displaced prepared live/next sets; its immediate control-thread destruction cannot invalidate anything now used by prepared. Published and pending pointers are not exchanged or republished, and a prepared room with no such target saves its primed newest set in pending before the exchange.

Full queues retain the existing adoption backpressure semantics. Audio continues using the transferred outgoing state and its in-progress fade; it does not drop the tail or restart at a cold gain. Control reclamation clears return slots before a later publication/adoption. There are still at most live/next/pending/handoff plus four retired owners per room; the exchange creates no additional state or owner.

The final regression populates both rooms' four retired slots and prepared's live, next, pending and newer handoff target. It checks distinct owners, confirms previous owns both displaced prepared sets, destroys previous immediately, then compares 8192 output frames to an uninterrupted reference. It repeats with a verified partially completed fade. Before the fix, peak sample error was 8.37481912e-6 in both cases, including a first-sample error 2.83718151e-7 during the active fade. After the fix, maximum and first-sample errors are exactly zero in both cases; reference tail energies are 1.06184178e-8 and 7.63852292e-9.

A subsequent control publication of Space-off becomes the live state after reclamation. The test lets the intentionally preserved 1.8-second tail drain, then verifies a unit direct impulse and no reflected energy, with no pending or fading target left. An initial test assertion sampled that direct impulse before the preserved tail had drained (1.00000024 / 1.00000012); inspection confirmed zero reflected gain and no queued target. The fixture was corrected to drain the tail and strengthened to assert post-direct reflected energy as well. No signal tolerance was relaxed. Repeated concurrent transfer/publication also verifies distinct owners after the producer joins. Callback new/delete deltas remain zero, and final total heap-owner balance returns to its initial value.

### Exact verification

1. Build via cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd succeeded. New regressions before the production fix exited 1 with four expected failures (two disable/re-enable modes, two saturated tail cases). The fade fixture was corrected to stop on an observed partial fade before this recorded red run. Evidence: task-3-fix1-red-build.log and task-3-fix1-red.log.
2. Final build succeeded; fluideq-room-ambience-test.exe exited 0. Evidence: task-3-fix1-build.log and task-3-fix1-green.log.
3. The same eight-target CTest expression documented above passed 8/8, zero failures, exit 0,23.62seconds. Evidence: task-3-fix1-ctest.log and native/.build/Testing/Temporary/LastTest.log.
4. node .superpowers/sdd/room-upgrade-plan/task-3-fix1-diff-check.cjs compared actual files with the reviewed93874d snapshot: all scoped files whitespace-clean, exit 0, no Git-state changes.

Controller independently confirmed all16 original Task3 legacy impulse banks byte-identical to its frozen baseline before this review round. This round's early sample arithmetic is unchanged, and the existing room/room-presets/interpolation/chain tests pass; an independent post-fix bank comparison remains controller-owned. Broad profiling and listening remain controller-owned. Native build is idle.

## Review fix round 2 (reviewed tree adef5137ab902c5423effcd576e52093a188ca99)

The reviewer identified that fix1's broad inactive reset also changed legacy off/on samples. This round restores pure-v1 transitions without restoring v2 stale replay. It is limited to this regression and its verification; no ownership-exchange or ambience algorithm changes were made.

### Prepared metadata and exact transition rule

FeqRoomKernels now carries immutable renderer_version metadata, default 1. room_build_kernels assigns it from the validated control settings immediately after allocation, before any inactive/no-head/mono early return. The audio callback never reads concurrently mutable room settings to decide the reset policy.

At the existing outright-adoption boundary:

- When both outgoing and incoming sets are active, the existing compatible late-tail behavior remains unchanged.
- Otherwise, new late FDN and reflection-send history/cursor are always cleared.
- The broad existing feq_room_reset also clears bass, sub-delay, upmix and low-latency FIR histories only if either the outgoing live set or incoming prepared set has renderer_version 2.
- A pure-v1 inactive transition clears only the newly introduced late/send state. Its legacy bass/sub/FIR/upmix histories remain exactly as the frozen implementation left them.
- An explicit public feq_room_reset still clears all histories according to its existing contract; only automatic adoption behavior is version-gated.

The old version is inspected before retiring its set. This covers v2 active to v1 inactive as well as v1 inactive to v2 active; metadata is present on inactive sets too. Tests now cover v2/off-v2/v2, v2/off-v1/v2 and v1/off-v1/v2, in regular and low latency. All six re-enable-silence energies are exactly zero.

### Frozen legacy off/on evidence

Added a C-API-only fixture shared by the persistent regression and an external frozen-source capture executable. Four cases drive separate legacy histories before an off/silence/on transition: managed bass, a delayed HRIR reaching into FIR source history, music upmix, and a six-channel LFE/sub path. Each runs regular and low latency. It records 4096 stereo frames after re-enable per case, totaling 65,536 float output samples across eight cases.

The frozen executable links the controller-provided read-only baseline-native-build/fluideq-dsp-core.lib and includes baseline-source/native/dsp-core/include, corresponding to frozen tree 37d5c2d0ad370f6cb2aee3f47697ef7fc55df145. All new executables, object files and output captures were written alongside the task scratch files, never inside baseline evidence directories. The current executable uses the same fixture with current headers and native/.build/fluideq-dsp-core.lib.

Before the fix, seven of eight cases failed. The regular delayed-FIR case is inherently silent and was the positive zero control. Maximum differences from frozen output included .399001 for managed bass, 1.125 for low-latency FIR history, .0786908 for upmix and .310910 for sub history. Current capture SHA256 was 8a39d2abd3999ab73c34db2476849cddf303ce389b35826850f9a700589b4a90.

After the fix, every byte of all 65,536 float samples matches the frozen capture. Both SHA256 values are:

`185b61e4bca773c7a6cafb51031a1bb6e5cc1feb2f5a58600f93ad7121655470`

The persistent regression stores frozen per-case energy and 24 sample probes, with ordinary floating-point tolerance for different build backends; this MSVC run matched every probe and total energy exactly. The independent full-output comparison provides the stronger byte-identity evidence without adding a large binary corpus to the product tree. The v2 exact-zero replay regressions remain active and passed; no tolerance was relaxed.

### Files and verification

Exact product/test scope:

- native/dsp-core/src/room_internal.h: prepared renderer metadata.
- native/dsp-core/src/room_kernels.cpp: metadata assignment before inactive returns.
- native/dsp-core/src/room.cpp: separated late/send clearing and version-gated broad adoption reset.
- native/dsp-core/tests/room_ambience_test.cpp: frozen legacy and mixed-version regression calls.
- native/dsp-core/tests/room_legacy_transition_fixture.h: new shared C-API transition fixture.
- native/dsp-core/tests/room_legacy_transition_golden.h: new frozen energy/sample expectations with source-tree provenance.

Commands/results:

1. cmd /c .superpowers\sdd\room-upgrade-plan\task-3-fix2-capture.cmd built and ran the frozen/current capture pair before the fix. Baseline evidence directories were read-only. task-3-fix2-red-capture.log records the mismatches and hashes.
2. Native build via build-task-2.cmd succeeded; pre-fix room-ambience exited 1 with seven expected new legacy failures. Evidence: task-3-fix2-red-build.log and task-3-fix2-red.log.
3. After the product fix, native build succeeded and room-ambience exited 0. task-3-fix2-current-capture.cmd relinked only the current capture. Direct Buffer.equals over the two 262,144-byte outputs returned true; hashes matched. Evidence: task-3-fix2-green.log and task-3-fix2-green-capture.log.
4. Final native build succeeded after adding mixed-version coverage. The same focused eight-target CTest command documented above passed 8/8, exit 0, 18.94 seconds. Evidence: task-3-fix2-build.log, task-3-fix2-ctest.log and task-3-fix2-final-tests.log. Existing saturated handover continuity, distinct-owner, zero callback allocation/destruction and final heap-owner reclamation checks also passed.
5. node .superpowers/sdd/room-upgrade-plan/task-3-fix2-diff-check.cjs compared the six actual files against reviewed tree adef5137: all whitespace-clean, exit 0, no Git-state mutation.

No staging, commits, subagents or D: edits. Native build is idle. Broad profiling, final listening and integration remain controller-owned; this round changes no runtime ambience cost beyond the metadata check at adoption.
