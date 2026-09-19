> Historical implementation evidence from before consolidation. Paths, branch hashes and pending Git actions below describe that earlier checkpoint. README.md is authoritative for current location, authorization and fresh verification.

# Task 4: comparison, position protection, actual telemetry, capability

## Scope and handoff

Implementation is confined to the authorized room-spatial-upgrade worktree, relative to controller snapshot a4c610bff9bc968cc840077c780f946a72887861. No staging, commits, push, original D: edits, subagents, app launch, engine installation or audio restart. Native/.build is idle and released to the controller. Final UI design, device/listening validation and integration remain controller-owned.

## Audio behavior and ownership

A dedicated RoomComparison helper owns two 513-frame reference delay rings and two max-block reference scratch planes. All storage is allocated in Room creation, including on currently inactive/legacy rooms. A regular reference delays exactly feq_convolver_latency() (512 samples); low latency uses zero extra reference delay. No new DSP guard latency is added. Physical per-speaker propagation remains Room's contribution, so it is not duplicated in Original. Existing direct/sub alignment stays intact.

Stereo Original is the independent input left/right pair immediately before Room, after all earlier rack processing. For discrete multichannel sources the actual prepared channel map controls the fold-down: FL goes to left at1, FR to right at1, C to both at1/sqrt(2), SL/RL to left at1/sqrt(2), SR/RR to right at1/sqrt(2). LFE is deliberately omitted: no +10dB convention, low-pass or Room bass-management feed is smuggled into a conventional reference. There is no extra normalization of this fold-down; downstream rack master/safety remains active. The report identifies it as conventionalFoldDown. Unknown/partial/duplicate invalid maps and mono return untouched with inactive/zero planning latency, rather than emitting silent ears under an active claim.

Comparison does not bypass the Room DSP execution. Kernels, reflection history and late ambience continue processing, so return to wet is warm. A linear20ms sample-domain ramp blends Room into Original and back, independent of callback size. Only Original receives the learned gain. Wet at blend0 is left arithmetically untouched. Reference gain slews6dB per100ms. No permanent makeup/normalizer and no UI timers were added.

The capture requires at least1.5 seconds of contiguous blocks whose mean sum-of-ear-square energy exceeds1e-8 (-80dB) in BOTH wet and reference. Nonfinite samples invalidate learning. Silent/insufficient capture never sets matchAvailable. Kernel warmup/fades do not contribute to the capture. The estimate is10log10(sum wet energy/sum reference energy), clamped to[-6,+6]dB. This is a paired-energy estimate, not a LUFS or perceptual equivalence claim; the clamp can leave residual level difference. Once captured it stays fixed until invalidated, rather than continuously normalizing the program. Comparison and preserve-position toggles alone keep a valid capture. A control-computed value hash of physical Room settings, head samples, rate, latency mode and layout/source preference invalidates the audio-owned estimate on adopted change. Source/seek reset clears capture and reference delay. Reset retains the current A/B blend so an Original seek cannot briefly expose the legacy convolver tail. Fresh/inactive processing resets comparison state normally.

Immutable prepared metadata now includes comparison identity, the three option flags, speaker map and LFE channel, also on inactive sets. The callback uses its adopted live/next set, never mutable control settings, for these options. A saturated handoff cannot change protection or comparison merely because feq_room_active's planning atomic has changed. LFE routing follows the newest actually adopted set; using only the fading-out set delayed LFE routing and was caught by the existing interpolation/sub alignment test.

Compatible transfer swaps the entire comparison state together with the existing live/fading Room state; vectors transfer ownership without callback allocation/free. This preserves reference delay contents, blend and learning. Format-incompatible transfers use fresh preallocated state. feq_room_active and feq_room_latency_frames remain documented CONTROL planning APIs; feq_room_report and feq_room_position_protected are AUDIO snapshots.

## Position protection and post-Room audit

The native stage order is Room -> Dimension -> linked compressor -> Maximizer -> master trim/leveling/headroom -> output safety. Position protection changes only Dimension's effective enabled value when the processed Room report is active and preserve_position is set. Its saved enabled/width/decorrelation values stay intact. Existing Dimension fade-out and settled-off reset drain then clear all-pass history; Room off, missing head, unsupported layout or manual source bypass restore its ordinary stored behavior. Original holds the same protection, so A/B does not switch two transforms.

System Graph then processes eq_phase, curve_phase, per-channel convolution and graphic curves, ordinary biquads/preamp, its output guard and nonfinite fault boundary. Inspection of graph.cpp shows the same coefficient/kernel designs used on all channels with separate state; no additional cross-ear spatial transform was found there. No unrelated EQ/dynamics were disabled. Such filters can change spectrum and linked nonlinear gain can change the final perceived comparison, so positionProtected means Dimension protection, not a guarantee about arbitrary downstream audio processing or binaural fidelity. No stronger THX/device/perceptual claim is made.

source_already_spatial is strictly the user's manual bypass preference. It makes Room inactive and adds no Room latency; it never detects source content. Other rack stages continue. Comparison cannot defeat it. Library remains stereo; discrete layout is from the actual map.

## Exact native/wire/renderer contract

FeqRoomReport is { uint32_t flags; float reference_gain_db; }. feq_meters_publish_room packs both into ONE lock-free atomic<uint64_t>; feq_meters_read_room reads a coherent pair. The build asserts that64-bit atomics are always lock-free. The chain publishes after Room processing and publishes inactive on rack bypass. Both Library main.cpp and system APO analysis_snapshot.cpp use the same feq_wire_room_report encoder.

FeqWireAnalysisFrame stays560 bytes with every old offset unchanged. Static assertions verify reserved_tail at116 and bass_reserved_tail at396. reserved_tail now carries uint32 tag0x524d0100 plus low bits:1 active,2 Original contribution currently audible (also during a return fade),4 trustworthy capture available,8 conventional fold-down,16 position protection,32 manual source bypass. bass_reserved_tail carries the smoothed reference gain dB. Older writers' zero tag means unavailable. Readers reject unknown tags/bits, contradictory active/bypass states, nonfinite gain and gain outside[-6,+6] while retaining the rest of the meter frame. Existing old readers ignore these reserved words.

IHostAnalysis.room?: IHostAnalysisRoom in common/dsp/analysisWire.ts has exactly:

- active: boolean
- original: boolean
- matchAvailable: boolean
- referenceGainDb: number
- conventionalFoldDown: boolean
- positionProtected: boolean
- sourceBypassed: boolean

Absent is unknown/unavailable, not inactive or matched. src/renderer/dsp/roomTelemetry.ts exports readDspRoomReport(), subscribeDspRoomReport(listener), setDspRoomReport(report | undefined). It stores an immutable snapshot and notifies only on value change, separately from the rack/profile settings store. createNativeMeters clears it on owner creation, absent/legacy frames and release of the current owner; clearDspMeterTelemetry clears it as well. Existing system bridge disconnect/output/visibility cleanup calls release, without stale-timeout inference. A retired owner cannot erase a newer owner's received report. The actual bridge regression covers owner replacement, identical-frame notification dedupe, legacy frame clearing and release, and existing system-meter tests remain included.

A560-byte fixture emitted by the real C++ meter/shared encoder is frozen as base64 in roomReportNativeFixture.ts and decoded by the normal TS decoder test. The actual encoder test also validates its report and frame size. This is not a hand-assembled expected-only native fixture.

## Installed-engine contract

The concurrent main-branch latency work reserved 1.10 for game-mode capability without a Room trailer decoder. A dedicated regression reproduced its erroneous acceptance by the first 1.10 Room gate, so Room now requires 1.11. The DLL fixed resource version is now 1.11.0.0 (verified on the built DLL metadata). ENGINE_ROOM_SINCE=[1,11] and engineSupportsRoomUpgrade(version) use the existing strict version parser. ENGINE_STATUS_SINCE remains1.1 and ENGINE_CARRIED_SINCE remains1.9.

SET_SYSTEM_DSP_CHAIN validates before compatibility handling. A supported installed engine gets the extended payload unchanged. Old (including 1.10)/missing/malformed version capability returns the single typed 'update-required' result for an audible new Room command and writes no unsupported payload. Plain legacy payloads do not incur a capability lookup. If the root rack is off (including Library ownership), Room is off, or the manual spatial-source bypass is selected, a compatible payload removes the inaudible trailer; manual bypass also turns Room off in that wire copy. Other rack values and saved v2 settings are preserved. Thus an old engine still receives rack-off and cannot remain processing Library underneath its host. False game-mode padding is removed with the trailer; a requested legacy game-mode flag is preserved.

Capability is cached after the existing status read; concurrent initial requests share one promise. Existing GET/status/install/update paths refresh the cache and use a generation guard so older status answers cannot overwrite newer ones. No setup helper per dragged setting, no polling, install or restart added. Renderer installed-version changes retry the current rack through the existing event-driven status hook.

readSystemDspChainResult()/subscribeSystemDspChainResult() in renderer/dsp/systemChain.ts expose the latest result, including 'update-required'; undefined means no current confirmation. Each new non-deduplicated write clears old confirmation. Request generations reject stale successes/failures, including A->B->A with reused arrays. Duplicate pending arrays retain the original request result. Reset invalidates pending results; retries use current values. Task6 should consume this state and existing engine status for one localized update-required notice; no new static UI text/layout was introduced in Task4.

Library uses its existing actual applyChain acknowledgement: supervisor.applyChain returns true only for HOST_STATUS.applied, and the bundled host's native decoder rejects malformed trailers before configuration. No unsupported accepted-state claim is inferred from a UI switch or a filesystem write.

## Verification and evidence

Native red task-4-red.log:24 expected failures across4 rates x2 latency modes for Original identity, manual bypass and active/latency truth. task-4-layout-red.log:2 unsupported-layout failures. task-4-reset-red.log:4 regular-mode Original reset history failures. task-4-result-red.log: actual systemChain deferred A->B->A reproducer published an obsolete update-required result. All have corresponding green implementation/coverage.

During fixture development, a hardcoded minus6dB expected capture was too exact for the enabled bass crossover at44.1kHz (measured-5.99556dB); it was replaced by a stricter useful assertion against the actual paired captured energies with less than.05dB residual and the6dB bound. The repeated-toggle fixture initially assumed direct DC gain while default bass management summed its low bus; explicitly disabling bass management in this direct-path fixture made its unchanged crossfade bound correct. These were fixture corrections, not weakened product checks. Existing LFE alignment coverage caught a real temporary live-vs-adopted routing regression; final routing uses adopted metadata and the full focused suite passes.

Commands run from the worktree:

1. cmd /c .superpowers\sdd\room-upgrade-plan\build-task-2.cmd: native full build successful after final functional edit. task-4-final-build.log.
2. Bundled CTest --test-dir native/.build --output-on-failure -R '^(room|room-presets|room-contract|room-interpolation|room-ambience|room-comparison|chain-surround|chain-transfer|chain-latency|meters)$':10/10 passed,18.74s, exit0. task-4-final-ctest.log. Includes frozen-v1 off/on corpus, saturated/concurrent ownership and allocation-free transfer coverage inherited from Task3.
3. New room-comparison executable covers independent signed stereo impulses at processing delay,4 rates x2 modes, real reordered5.1/7.1 fold-down/LFE handling, fresh silence/short capture/nonfinite/reset/physical invalidation, preserve-position and stored Dimension restoration, unsupported/mono pass-through, pending-publication backpressure, repeated toggles, exact Original handover, live ambience return, actual meter/wire record, and callback new/delete counters (both zero).
4. Initial focused Jest run:7 suites/153 tests passed, task-4-ts-focused.log. A dependency repair in another task temporarily removed the shared node_modules links; this task did not alter/install dependencies. Final results are appended below.
5. TypeScript --noEmit initially reported ONLY the frozen3 baseline errors: two IHostTelemetry.processingLatency test references and missing VoicingQuickPick groupLabel. task-4-typecheck.log. No Task4 type errors in that run. Final result appended below.
6. Direct bundled-Node stripTypeScriptTypes execution of the actual current report decoder passed the real native fixture and inactive/manual/contradictory flags while dependencies were unavailable. The actual systemChain module with controlled deferred bridge promises passed duplicate pending payload, newest A-B-A ownership and failure clearing after the recorded red. task-4-result-green.log. Persisted Jest counterparts are included.

Native final test runs do not include the3 frozen unrelated engine-dsp-chain rack-off game-mode failures; no baseline test was removed or weakened. No broad unrelated suite was repeated.

## Files

- native/CMakeLists.txt
- native/dsp-core/include/fluideq/room.h
- native/dsp-core/include/fluideq/meters.h
- native/dsp-core/src/room.cpp
- native/dsp-core/src/room_internal.h
- native/dsp-core/src/room_kernels.cpp
- native/dsp-core/src/room_comparison.h
- native/dsp-core/src/room_comparison.cpp
- native/dsp-core/src/chain.cpp
- native/dsp-core/src/chain_stages.cpp
- native/dsp-core/src/meters.cpp
- native/dsp-core/tests/room_comparison_test.cpp
- native/dsp-host/src/wire.h
- native/dsp-host/src/main.cpp
- native/system-apo/src/analysis_snapshot.cpp
- native/system-apo/src/engine.rc
- src/common/audioEngine.ts
- src/common/engineHealth.ts
- src/common/dsp/analysisWire.ts
- src/common/dsp/chainWire.ts
- src/common/dsp/roomReport.ts
- src/main/dspHost/wire.ts
- src/main/ipc/audioEngine.ts
- src/renderer/dsp/nativeMeters.ts
- src/renderer/dsp/roomTelemetry.ts
- src/renderer/dsp/store.ts
- src/renderer/dsp/systemChain.ts
- src/renderer/utils/useAudioEngineStatus.ts
- src/**tests**/unit_tests/main/dspHostAnalysisWire.test.ts
- src/**tests**/unit_tests/main/audioEngineIpc.test.ts
- src/**tests**/unit_tests/main/roomReportNativeFixture.ts
- src/**tests**/unit_tests/renderer/dspNativeMeters.test.ts
- src/**tests**/unit_tests/renderer/audioEngineStatusStore.test.tsx
- src/**tests**/unit_tests/renderer/roomChainResult.test.ts
- src/**tests**/unit_tests/dsp/systemDspChain.test.tsx

Scratch reports/scripts/logs are under .superpowers/sdd/room-upgrade-plan, including task-4-files.json and task-4-diff-check.cjs. The controller's standalone benchmark source list must add room_comparison.cpp.

## Limits and pending controller work

No running app, physical device, underrun, perceptual level/spatial or final UI validation is claimed. No hardware/host install occurred. Existing all-rate CPU/preparation constraints remain controller-owned; the new comparison adds bounded sample loops and preallocated memory, and no full-device headroom claim follows from the functional tests. Position protection only guarantees the native Dimension override described above. The match is a bounded captured paired-energy estimate rather than continuous/perceptual normalization. Final visual/localized update-required presentation is Task6. Review, frozen full impulse comparison if desired, audition/device validation, focused commit/push and integration remain controller-owned.

## Final checkpoint verification

- Final focused Jest: 8 suites / 160 tests passed, exit 0, 11.502 s. task-4-final-ts.log. Suites: dspHostAnalysisWire, audioEngineIpc, dspNativeMeters, dspSystemMeters, engineHealth, audioEngineStatusStore, systemDspChain and roomChainResult. This includes version 1.10 refusal, 1.11 recovery, real native fixture decoding, report ownership and deferred-result races.
- Final scoped ESLint over all 19 touched TS source/test files: exit 0, no errors or warnings. task-4-final-lint.log (empty means clean).
- Final tsc --noEmit: exactly the same 3 frozen baseline errors in dspHostLatencyWire.test.ts and VoicingQuickPick.tsx, no Task4 error. task-4-final-typecheck.log.
- Final resource-only rebuild succeeded after moving the version gate; the built DLL fixed metadata reads 1.11.0.0. task-4-version-build.log. No audio functional code changed after the 10/10 native pass in task-4-final-ctest.log.
- Exact scoped raw-file whitespace comparison against a4c610bff9bc968cc840077c780f946a72887861: all 35 files clean, exit 0. task-4-diff-check.log. Untracked copied baseline files are compared using their snapshot blobs rather than misreported as deleted by the ordinary index.
- task-4-final-sha256.json records the stable scoped file checkpoint. Work is now stopped for the controller to integrate current main; no merge/reset/stage/commit was performed. Native/.build is idle.

## Review fix round 1: overlapping initial capability reads

Base: frozen Task4 checkpoint 1c9e03558ca4ff16eccba7c3f34a933535d0a979. Only src/main/ipc/audioEngine.ts and src/**tests**/unit_tests/main/audioEngineIpc.test.ts changed in this round. No renderer/native change, native build, installation, stage, commit or integration.

Cause: a chain's initial capability read could be superseded by a GET status read. The generation check discarded the first result, but its consumer returned the initial false capability before the newer read completed. Two supported 1.11 results could therefore produce update-required and omit the chain write indefinitely.

Fix: retain the latest status promise as the capability cache. Every refresh replaces that promise synchronously. A waiting chain follows superseding promises until its awaited result is still current; obsolete successes and failures cannot decide capability. A successful current result remains cached between settings edits. A failed current read propagates the real IPC failure to existing waiters, instead of claiming update-required or letting one waiter silently retry. A new command retries after failure. A later status refresh invalidates both fulfilled and failed cache states. Promise wrapping captures synchronous helper exceptions through the same failure path. Renderer retry logic is unchanged.

Regression cases cover supported A then supported B resolved A-before-B, newer unsupported status, obsolete failures in either completion order, latest failures in either order, subsequent recovery/invalidation, and a shared initial failure across two chain requests followed by an explicit new-command retry. All supported fixtures use 1.11; unsupported fixtures retain 1.10.

Exact commands ran from the isolated worktree using C:/Users/ivanc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe (node below):

- Red: node node_modules/jest/bin/jest.js --runInBand --runTestsByPath src/**tests**/unit_tests/main/audioEngineIpc.test.ts. Exit 1; 4 failed / 49 passed / 53 total, 4.138 s. task-4-fix1-red.log.
- Additional failure-boundary red, same command after adding shared-failure regression: exit 1; 1 failed / 53 passed / 54 total, 3.427 s. task-4-fix1-failure-red.log. This caught the first draft invalidating the failed promise too early and retrying inside an existing waiter.
- Final green, same command after fixes: exit 0; 1 suite, 54/54 tests passed, 3.115 s. task-4-fix1-green.log. Expected fault-path console noise remains.
- node node_modules/eslint/bin/eslint.js src/main/ipc/audioEngine.ts src/**tests**/unit_tests/main/audioEngineIpc.test.ts: exit 0, clean. task-4-fix1-lint.log.
- node node_modules/typescript/bin/tsc --noEmit: exit 2, exactly the three frozen baseline errors: dspHostLatencyWire.test.ts:38 and :40 missing IHostTelemetry.processingLatency; VoicingQuickPick.tsx:19 missing RichPick groupLabel. No new error. task-4-fix1-typecheck.log. The only subsequent edit moved existing test recovery assertions outside a conditional and added one call-count assertion; final focused Jest and lint ran after that edit.
- git diff --check 1c9e03558ca4ff16eccba7c3f34a933535d0a979 -- src/main/ipc/audioEngine.ts src/**tests**/unit_tests/main/audioEngineIpc.test.ts: exit 0, no whitespace errors (read-only git global-ignore permission warning).

Final SHA256 checkpoint (also task-4-fix1-final-sha256.json):

- src/main/ipc/audioEngine.ts: e2a6cec28550360de1bd557863ee70b1441d7ecd0029b2107226a10276572176
- src/**tests**/unit_tests/main/audioEngineIpc.test.ts: a90d91ae3e9691eaa5146ed5c4a6d18696980ce7d5988f89bbe8a423437a3855

Stopped editing after this checkpoint. Controller owns review and integration. The unchanged renderer status store did not require a rerun, and no native build was needed for this TS-only fix.
