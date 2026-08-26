# FluidEQ DSP handover and native-engine migration

**Date:** 2026-08-26
**Repository:** `D:\DEV\_PERSONAL\FluidEQ`
**Branch at handover:** `main`
**Last committed revision observed:** `22503c2d7 Rebuild DSP flow and close dev sessions cleanly`

This document is the handoff for the remaining DSP work and the migration from
the TypeScript AudioWorklet implementation to an isolated, multicore C++ audio
engine. It is written so another coding agent can continue without reconstructing
the decisions from chat history.

## Executive decision

The final architecture should **not** call a native Node addon from React and
should **not** send PCM audio through Electron IPC.

Build two native targets:

1. `fluideq-dsp-core`: a platform-independent C++20 library containing all
   sample processing and analysis.
2. `fluideq-dsp-host`: a standalone native process that owns decoding, the
   playback device, the real-time callback, DSP state and telemetry.

Electron main supervises the host. The renderer sends small, versioned control
messages and receives rate-limited telemetry. No audio samples enter React,
Electron IPC, JSON or a Node callback.

This is the only clean way to satisfy all four requirements together:

- DSP processing cannot freeze the Electron UI.
- DSP failure cannot crash the renderer.
- the engine may use multiple CPU cores for suitable work;
- real-time audio does not pay an inter-process copy and scheduling penalty on
  every 128-frame quantum.

The current TypeScript engine remains the behavioral reference and temporary
fallback until the native backend passes parity tests.

## Important real-time clarification

The native host should be multicore, but the ordered audio callback itself
should normally remain on **one real-time thread**. Splitting a 128-frame block
between arbitrary worker threads creates synchronization deadlines shorter than
the DSP it is meant to accelerate.

Use other cores for work that can finish asynchronously:

- file decoding and read-ahead;
- whole-track LUFS and true-peak analysis;
- FFT and graph telemetry;
- linear-phase kernel construction and partition preparation;
- library cache validation;
- diagnostics formatting and disk logging;
- optional offline export/rendering.

Use SIMD inside the real-time thread. Partitioned convolution may use a worker
only when the audio thread can consume a previously completed partition without
waiting. The audio thread must never join, wait on a future or take a contended
lock.

## Current verification state

The working tree is intentionally dirty and contains the current DSP/UI work.
Do not reset, checkout or replace these files. Inspect `git status --short`
before changing anything and preserve unrelated edits.

Verified during the last work session:

- focused crossfade/player tests: 2 suites, 17 tests passed;
- TypeScript typecheck passed after the latest LUFS and handoff changes;
- targeted ESLint passed after the latest changes;
- renderer production build passed;
- `dsp-worklet.js` built successfully at approximately 50.5 KiB;
- `git diff --check` passed.

Not verified:

- the Electron app was not launched, as required by the repository rules;
- no listening test has been performed for the latest signed LUFS correction;
- no listening test has been performed for the latest post-crossfade two-second
  Normalizer/LUFS handoff;
- focused regression tests for those two latest changes have not yet been
  added or run;
- the full suite was green before the latest LUFS/handoff edits, but it has not
  been rerun after them.

A full restart is required before evaluating the current build because common
DSP code and the AudioWorklet changed.

## What the current engine does

The current library-audio topology is:

```text
two hidden HTMLAudioElement decks
        │
per-deck Web Audio GainNodes (crossfade)
        │
      mixer
        │
TypeScript AudioWorkletProcessor
        │
AudioContext destination
```

The AudioWorklet receives planar `Float32Array` audio, normally two channels,
in Chromium render quanta of 128 frames. The current processing order is:

```text
source
  → track Normalizer gain
  → Exciter (Timing + Low/Mid/High + Organic, stereo/mid/sides)
  → EQ (minimum/linear phase, stereo/mid/sides, dynamic bands)
  → multiband compressor (currently hidden in UI)
  → maximizer
  → post-filter Auto Headroom
  → Master output gain + Master LUFS correction
  → emergency output safety / DC repair / invalid-sample repair
  → speakers
```

The worklet also exposes analyser-only stage outputs:

- final Master;
- Normalizer;
- Exciter;
- EQ;
- compressor;
- maximizer.

The DSP math is roughly 6,100 lines across the worklet and pure TypeScript DSP
modules. The largest pieces are the worklet coordinator, exciter, limiter,
EQ engine, analysis, convolution and oversampling.

## Current behavior completed or materially improved

- A real two-deck crossfade exists; Next and Previous do not replace the one
  decoder in place.
- Crossfade scheduling prefers the Web Audio clock and has a safe frame-based
  fallback if the mixer or `AudioParam` automation is unavailable.
- Crossfade curves now keep their combined linear gain at unity, preventing a
  midpoint volume lift.
- A fast background blob-cache read can no longer replace the incoming
  element's `src` while its first `play()` promise is pending. That replacement
  was aborting playback and leaving the previous track playing forever.
- New-track playback begins immediately. File analysis remains background work
  and is never permission to start playback.
- Track-level Normalizer and Master LUFS corrections are sent as one pair and
  use one two-second progress clock.
- During crossfade, the outgoing track-level pair remains active through the
  overlap. The incoming pair begins its smooth transition only after the new
  deck owns playback.
- Master LUFS correction is now signed. A target such as `-18 LUFS` can attenuate
  a louder track instead of merely reducing boost to zero.
- Master LUFS analysis can be requested even when the input Normalizer mode is
  Off.
- DSP diagnostics now have a stable numeric schema intended for a future native
  lock-free event queue.

## Known remaining behavior work

### P0 — listen and lock the latest level behavior

In a full restart, verify all of the following with real tracks:

1. Next begins immediately and crossfades immediately, cached or uncached.
2. Previous restarts the current song after ten seconds and changes tracks
   inside the first ten seconds.
3. A new analysis result never makes an instantaneous level step.
4. With crossfade enabled, the old gain remains through the overlap and the
   incoming correction starts afterward over two seconds.
5. A Master target of `-18 LUFS` audibly attenuates a track measured louder than
   `-18 LUFS`.
6. A quieter target and a louder target both move in the correct direction.
7. Normalizer and Master LUFS do not fight one another or expose an intermediate
   gain when both are enabled.
8. Rapid Next/Previous cancels stale decoding and stale analysis without an old
   completion callback taking playback ownership.

After the sound is accepted, add direct tests for:

- signed `masterLoudnessGainDb` above and below target;
- no analysis, silence-gated analysis, disabled Master and disabled LUFS mode;
- renderer and worklet acceptance of negative Master LUFS gain;
- the two-second phase-locked transition with one positive and one negative
  component;
- a crossfade source boundary preserving the current pair rather than snapping;
- Master-only analysis while Normalizer is Off;
- `play()` being issued before track bytes or analysis resolve;
- rapid track changes preventing stale analysis and blob swaps.

### P0 — true idle / white-noise startup

No white-noise generator was found. The app currently wakes audio hardware while
idle in two independent places:

1. `useLiveOutputSpectrum` automatically starts system-loopback capture and an
   `AudioContext` when the root provider mounts, whether or not its graph is
   visible.
2. Once the Library provider mounts, `useDspEngine` creates and resumes a
   playback `AudioContext`, captures both hidden decks and connects the mixer to
   the destination even when root DSP is Off.

DSP Off is therefore a filter bypass, not an engine shutdown. A headset or DAC
may leave its low-power state and expose its analog noise floor even while every
digital meter reads silence.

Required behavior:

- opening FluidEQ with no playback and no live feature requesting capture must
  not open an output stream;
- root DSP Off must consume no DSP CPU;
- loopback capture starts only while a visible meter/graph, Smart EQ, a second
  output or another declared consumer needs it;
- all consumers use reference-counted capture ownership;
- the last consumer releases loopback and its context;
- the native host process may remain alive while its audio device stream is
  closed;
- starting playback may open the output stream, because playback necessarily
  wakes the device.

The current `createMediaElementSource` path is irreversible for the lifetime of
an element. Do not fix shutdown by closing that context and expecting the same
element to resume direct playback. Either defer capture until DSP is required or
replace the decks during a controlled backend handoff.

### P0 — define honest LUFS semantics

The current Master target uses cached whole-file source LUFS plus input
Normalizer gain. It does not measure the completed signal after Exciter and EQ.
Consequences:

- it cannot mathematically guarantee exact final integrated LUFS after creative
  processing;
- a true-peak ceiling may prevent an aggressive target;
- positive Output gain may be countered by Auto Headroom when peaks already
  occupy the available ceiling;
- the graph currently combines manual Output gain and automatic LUFS makeup in
  places where the labels imply one value.

Before changing the algorithm, choose and document one product contract:

1. **Recommended:** Master target means the source-referenced programme target,
   Output gain is a manual post-target offset, and the ceiling always wins.
2. Exact post-chain LUFS, which requires analysing the fully processed chain for
   each materially different settings signature or introducing a slow live
   loudness servo. The latter risks the pumping and song-intention problems the
   design has repeatedly rejected.

Whichever contract is selected, display these separately:

- manual Output gain;
- automatic LUFS correction;
- Auto Headroom reduction;
- final applied gain.

Do not promise an exact target when the ceiling or a creative stage makes it
unreachable without changing dynamics.

## Native process architecture

```text
┌──────────────────────────────── Electron renderer ────────────────────────────────┐
│ React controls, presets, graphs, meters                                            │
│                                                                                    │
│ settings → external store → preload bridge                                         │
│ telemetry ← rate-limited typed records ← preload bridge                            │
└───────────────────────────────┬────────────────────────────────────────────────────┘
                                │ small control/telemetry messages only
┌──────────────────────────── Electron main process ─────────────────────────────────┐
│ starts/stops/supervises native host; owns trusted file/device requests              │
│ translates renderer IPC to a local versioned transport                             │
└───────────────────────────────┬────────────────────────────────────────────────────┘
                                │ named pipe / Unix-domain socket + shared telemetry
┌──────────────────────────── fluideq-dsp-host process ───────────────────────────────┐
│ Control thread          validates settings, builds immutable state snapshots        │
│ Decode/read-ahead pool  reads and decodes current/next tracks                       │
│ Analysis pool           whole-track LUFS, true peak, signatures, FFT work           │
│ Kernel worker           linear-phase kernels / partition preparation                │
│ Telemetry thread        drains lock-free rings; formats diagnostics                  │
│                                                                                     │
│ REAL-TIME AUDIO THREAD  decks → crossfade → fluideq-dsp-core → device               │
│                        no allocation, locks, logging, IPC or filesystem              │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### Why a standalone executable instead of a `.node` addon

- It is isolated from renderer and main crashes.
- It does not depend on Electron's Node ABI.
- It can own real-time thread priority and the audio device directly.
- Electron updates do not require rebuilding an ABI-specific addon wrapper.
- The host can be restarted and health-checked independently.
- PCM never needs to cross a renderer/main boundary.

A native addon remains acceptable for offline tests or utilities, but it should
not be the real-time audio path.

## Native core boundaries

Move into C++:

- deck mixing and crossfade curves;
- input track gain trajectory;
- biquads, EQ engines and dynamic EQ;
- crossover and mid/side transforms;
- Exciter Low/Mid/High/Organic and its guards;
- compressor and maximizer processing, even while the compressor UI is hidden;
- oversampling and sample-rate-aware factor selection;
- true-peak detection and linked limiting;
- linear-phase convolution runtime;
- Master gain, Auto Headroom and emergency safety;
- DC protection and invalid-sample repair;
- phase correlation, band activity, peak and gain-reduction accumulation;
- whole-track loudness and true-peak analysis once parity exists.

Keep in TypeScript/React:

- UI components and layout;
- localization;
- preset names, descriptions and selection;
- settings validation at the renderer trust boundary;
- library queue and product behavior;
- persistence/import/export;
- static response-curve drawing where it is cheaper to derive from settings;
- Electron main supervision and permission prompts.

Do not put preset policy into C++. The native core consumes one fully resolved,
clamped settings snapshot. That keeps per-filter presets and future chained
profiles composable without recompiling the audio engine.

## Core API shape

Use a small versioned C ABI over the C++ classes so the same core can be driven
by native tests, an offline renderer and an optional WebAssembly reference
build.

```cpp
struct FeqEngine;

FeqEngine* feq_engine_create(
    uint32_t sample_rate,
    uint32_t channels,
    uint32_t maximum_block_frames);

void feq_engine_destroy(FeqEngine* engine);

FeqStatus feq_engine_prepare_config(
    FeqEngine* engine,
    const FeqConfigV1* config);

void feq_engine_commit_prepared_config(FeqEngine* engine);

void feq_engine_reset(FeqEngine* engine, FeqResetReason reason);

void feq_engine_process_planar(
    FeqEngine* engine,
    const float* const* input,
    float* const* output,
    uint32_t frames);

uint32_t feq_engine_latency_frames(const FeqEngine* engine);
bool feq_engine_try_read_telemetry(FeqEngine* engine, FeqTelemetryV1* out);
bool feq_engine_try_read_diagnostic(FeqEngine* engine, FeqDiagnosticV1* out);
```

`prepare_config` runs on a control/kernel thread. It may allocate and build
coefficients. `commit_prepared_config` publishes an immutable prepared snapshot
that the audio thread adopts at a block boundary. Retire old snapshots outside
the callback. Do not parse JSON or rebuild long convolution kernels inside
`process_planar`.

## Asynchronous UI control protocol

The renderer must have no synchronous native calls. Every request is
asynchronous, versioned and ordered within one engine session.

Use an envelope equivalent to:

```text
ControlRequest {
  protocolVersion
  engineSessionId
  requestId
  settingsRevision
  command
  payload
}

ControlAck {
  protocolVersion
  engineSessionId
  requestId
  acceptedRevision
  appliedAtSampleFrame
  status
  optionalSanitizedValue
}
```

The UI updates its external store optimistically. It never blocks a pointer
event waiting for an acknowledgement. The final value at gesture end requires
an acknowledgement, and a rejection publishes the native sanitized value back
to the store.

Two settings paths are required:

1. **Atomic full snapshot:** presets, imports, reset and multi-control mode
   changes. The complete clamped chain is prepared off the audio thread and
   becomes audible at one block boundary. No stage may observe half a preset.
2. **Fast parameter update:** dial, slider and graph dragging. Send a compact
   numeric parameter id, optional band/path index, value and revision. The host
   coalesces unapplied updates for the same parameter and the DSP smooths the
   latest value. Never preserve a backlog of every pointer pixel.

Continuous controls such as EQ gain, frequency, Q, Exciter amount and Master
gain need click-free per-sample or short-ramp smoothing. Structural controls
such as band count, phase engine, oversampling, convolution kernel and routing
mode are prepared on a worker and swapped atomically when ready.

Do not expose one handwritten transport implementation per UI widget. Generate
numeric parameter ids and TS/C++ definitions from one schema so a renamed field
cannot silently point the UI at a different native value.

### Required command endpoints

Engine and capability commands:

```text
engine.hello
engine.getCapabilities
engine.start
engine.suspend
engine.resume
engine.stop
engine.getState
engine.setOutputDevice
engine.setTelemetrySubscription
engine.shutdown
```

Transport and deck commands:

```text
transport.loadDeck
transport.unloadDeck
transport.play
transport.pause
transport.stop
transport.seek
transport.setVolume
transport.prepareNext
transport.cancelPreparation
transport.crossfade
transport.cancelCrossfade
transport.getState
```

DSP configuration commands:

```text
dsp.applySnapshot
dsp.setParameter
dsp.setRootBypass
dsp.resetStage
dsp.resetAll
dsp.setAuditionState
dsp.setTrackIdentity
dsp.setTrackLevelTargets
dsp.prepareLinearPhaseKernel
dsp.cancelPreparedChange
dsp.getAppliedSnapshot
```

Analysis and cache commands:

```text
analysis.measureTrack
analysis.cancelTrack
analysis.getTrackStatus
analysis.invalidateTrack
analysis.measureProcessedReference
```

Diagnostics commands:

```text
diagnostics.getHealth
diagnostics.getPerformanceSnapshot
diagnostics.setDevelopmentSafetyBypass
diagnostics.flushNonRealtimeLog
```

### Required parameter coverage

`dsp.setParameter` or `dsp.applySnapshot` must cover every field currently
accepted by `IDspSettings`, including:

- root DSP enable/bypass;
- Normalizer mode, true-peak ceiling and loudness target;
- crossfade enabled state, duration and curve;
- Exciter enable, isolate, stereo/mid/sides routing, Timing and every
  Low/Mid/High/Organic control;
- EQ enable, isolate, model/character, oversampling, stereo/mid/sides routing,
  serial/parallel engine, minimum/linear phase, subsonic, fuzz, mono-below and
  every per-band enabled/type/frequency/gain/Q/dynamic/Exciter field;
- compressor state even while its UI is hidden;
- maximizer enable, ceiling, look-ahead and release;
- Master enable, Output gain, LUFS maximize, loudness target, ceiling and
  release;
- development safety A/B where permitted by the build.

Presets remain TypeScript data. Selecting a preset resolves all of its settings
in the renderer, validates them and sends one `dsp.applySnapshot`. Do not fire
twenty independent parameter calls for one preset.

### Latency and responsiveness rules

- Parameter messages are small control packets; PCM is never included.
- A drag publishes at most once per animation frame and always publishes its
  final value.
- The host control thread drains commands into a bounded latest-value table.
- The real-time thread reads only a prepared immutable snapshot or bounded
  lock-free command ring at a block boundary.
- The audio callback never sends an acknowledgement directly. It records the
  applied revision/sample frame in a preallocated event ring for the telemetry
  thread.
- UI state must not depend on polling a synchronous getter.
- Stale acknowledgements from an older engine session or settings revision are
  ignored.
- A disconnected host makes controls visibly unavailable while preserving the
  renderer's last requested snapshot for a supervised restart.

Acceptance target: ordinary continuous parameter changes become audible by the
next audio block plus their intentional smoothing ramp, while pointer/scroll
rendering remains within the normal UI frame budget.

## Audio-host responsibilities

Define platform-neutral interfaces before selecting dependencies:

```text
IAudioOutputBackend
IAudioDecoder
ILoopbackCapture
IHostControlTransport
ITelemetryTransport
```

The host must support:

- the formats FluidEQ Library currently accepts;
- two simultaneous decoders for crossfade;
- immediate seek and Next/Previous cancellation;
- automatic output sample rate, including high-rate devices;
- 1×/2×/4× nonlinear oversampling capped at 192 kHz internal rate, matching
  the current `oversampleFactorForSampleRate` behavior;
- stereo-linked processing without image drift;
- output-device changes;
- gap-free buffer ownership and bounded read-ahead;
- a clean idle state with the device closed;
- crash recovery or explicit fallback to the legacy player during migration.

Do a format and licensing audit before choosing decoder/audio dependencies.
FluidEQ is GPL-3.0-or-later, but packaged codec and platform-library obligations
still need to be recorded in `NOTICE.md` and release artifacts.

## Real-time rules

The audio callback may not:

- allocate or free heap memory;
- grow a vector or hash table;
- log or format a string;
- touch the filesystem;
- call Electron, Node or JavaScript;
- take a mutex that another thread can hold;
- wait on worker completion;
- parse settings;
- throw an exception;
- make an OS IPC call per block.

Prepare all buffers at stream start using the maximum negotiated block size.
Treat block size as variable up to that maximum. Use double precision for
coefficients and sensitive filter state where the TypeScript reference uses
`Float64Array`; use float planar buffers at the host boundary.

Thread priorities should be explicit:

- audio callback: platform real-time/pro-audio priority;
- decoder/read-ahead: normal-high, bounded ahead of the playhead;
- control and telemetry: normal;
- LUFS scan, FFT history, cache validation and logging: background.

Leave at least one logical core available to the OS/Electron UI. If callback
deadlines come under pressure, pause or throttle background analysis and lower
telemetry publication frequency. Do **not** reduce DSP quality, silently disable
oversampling or change a user's filter settings. Device-buffer sizing may adapt
at stream creation, but the chosen processing result must stay identical.

Recommended build posture:

- C++20;
- CMake presets for Windows x64, macOS x64/arm64 and Linux x64;
- exceptions and RTTI disabled in the DSP core;
- no global mutable state;
- denormal handling and finite-sample guards;
- compiler SIMD with explicit scalar parity tests;
- do not enable global unsafe fast-math because invalid-sample repair and
  true-peak safety depend on IEEE behavior.

## UI and telemetry contract

React must never receive per-sample data or render at audio-block frequency.

The real-time thread accumulates small fixed-size statistics and pushes them to
a preallocated single-producer/single-consumer ring. A telemetry/FFT thread
drains that ring and publishes at a bounded rate, initially 20–30 Hz.

Telemetry must cover every current UI feature:

- sample rate and negotiated block size;
- engine state, backend name and latency frames;
- current/next deck state and crossfade progress;
- final spectrum bins;
- Normalizer input/output peaks and applied gain;
- Exciter Low/Mid/High/Organic activity;
- EQ per-band output levels and dynamic amount;
- compressor and maximizer gain reduction;
- Master manual gain, LUFS correction, Auto Headroom and final applied gain;
- true peak per channel and stereo-linked reduction;
- phase correlation and scatter points;
- DC correction, repaired samples and emergency-safety activation;
- oversampling factor and linear-phase latency;
- xrun/underrun count, telemetry drops and DSP callback duration percentiles;
- structured diagnostics using the existing numeric schema.

Rules for UI delivery:

- one external-store publication per telemetry frame, not one React state update
  per field;
- reuse typed arrays and double-buffer identities;
- coalesce settings drags to the latest complete snapshot;
- never queue an unbounded history of knob positions;
- graphs interpolate visually between telemetry frames;
- expensive FFT work occurs in the native analysis thread, not React;
- disk logging occurs on the host telemetry thread or Electron main, never the
  audio callback.

The existing `src/common/dsp/diagnostics.ts` contract already establishes
numeric codes, severity, origin and sample-frame position. Extend it without
renumbering existing codes.

## Capturing all live audio for graphs

There are two different signals and they must not be confused:

1. **FluidEQ Library playback:** the native host owns the signal and can expose
   exact taps at every DSP stage.
2. **Spotify, YouTube and other applications:** FluidEQ can observe only the
   final system-output loopback unless a separate system-wide routing driver or
   APO component is built.

For the first native milestone, keep current system-loopback capture if it is
stable, but give it reference-counted lifecycle ownership so it does not wake
the device with no consumer. It can continue feeding the final-output graph
while native telemetry feeds stage-specific DSP graphs.

Later, platform adapters may move loopback capture into `fluideq-dsp-host`:

- Windows output-loopback adapter;
- macOS output-capture adapter with the required permission model;
- Linux PipeWire/Pulse monitor adapter.

Captured primary output is analysis-only. Never route it back to the same
endpoint; that creates feedback. The existing second-output feature must keep
its explicit different-sink check.

Moving the library DSP to C++ does **not** automatically apply Exciter, Master
or other FluidEQ Library filters to Spotify/YouTube. Doing that cross-platform
is a separate virtual-device/system-plugin project. Equalizer APO remains the
Windows system-EQ path.

## Performance acceptance gates

Establish measured gates before replacing the TypeScript backend:

- zero audio underruns in a 30-minute stress run;
- zero renderer long tasks attributable to DSP processing;
- UI remains responsive during 15-band dragging, preset changes, analysis,
  crossfade and linear-phase updates;
- p99 audio callback time stays below 50% of the device callback deadline on
  the declared low-end reference machine;
- no allocation and no lock contention in an instrumented callback build;
- telemetry publication remains bounded when the renderer is hidden or busy;
- rapid Next/Previous cancels obsolete decode and analysis jobs;
- process memory reaches a stable plateau during repeated track changes;
- native and reference outputs meet the parity tolerances below.

At 48 kHz, 128 frames represent about 2.67 ms. At 192 kHz they represent about
0.67 ms. Benchmark every supported rate; success at 48 kHz does not establish
success at 192 kHz.

## Behavioral parity suite

Before porting processors, create deterministic reference fixtures from the
TypeScript engine:

- digital silence and near-denormal signals;
- impulses at multiple positions;
- sine sweeps and fixed sines near every crossover;
- deterministic seeded broadband and pink-noise blocks;
- stereo, mono, mid-only, side-only and anti-phase signals;
- DC offset and invalid samples;
- intersample true-peak probes;
- transients followed by silence for release behavior;
- 44.1, 48, 88.2, 96, 176.4 and 192 kHz;
- 1×, 2× and 4× effective oversampling;
- every shipped EQ and Exciter preset;
- minimum- and linear-phase EQ;
- isolate and root bypass.

Compare:

- output samples where exact parity is reasonable;
- magnitude response and impulse response;
- RMS/LUFS/true peak;
- maximum absolute error;
- latency frames;
- stereo correlation;
- gain-reduction envelopes;
- finite output for every finite or repaired input.

Do not require bit-identical output across all compilers. Define tight numeric
tolerances per processor and require null-test residuals below an agreed level.
Every null test needs a positive control proving that the harness detects a
deliberately changed processor.

## Migration sequence

### Phase 0 — lock current behavior

- [ ] Perform the P0 listening checklist above.
- [ ] Add the missing LUFS/handoff regression tests.
- [ ] Resolve the true-idle startup defect.
- [ ] Decide and document Master target versus Output-gain semantics.
- [ ] Build deterministic TypeScript golden fixtures.
- [ ] Record CPU, callback and UI baseline measurements.

### Phase 1 — native scaffold and identity engine

- [ ] Create `native/dsp-core/` and `native/dsp-host/` CMake targets.
- [ ] Implement the versioned C ABI and identity processor.
- [ ] Implement process supervision from Electron main.
- [ ] Implement version handshake and capability negotiation.
- [ ] Implement fixed-size control and telemetry transports.
- [ ] Ship platform binaries through `electron-builder` `extraResources`.
- [ ] Add code signing/notarization coverage for the host executable.
- [ ] Prove start, stop, crash, restart and idle-device-close behavior.

### Phase 2 — primitives

Port in dependency order, with reference parity after every unit:

- [ ] delay line and smoothing;
- [ ] biquad and coefficient builders;
- [ ] crossover and mid/side transforms;
- [ ] oversampling and rate cap;
- [ ] true-peak detector;
- [ ] linked limiter;
- [ ] saturation/diode primitives;
- [ ] convolution runtime;
- [ ] FFT/analysis utilities.

### Phase 3 — processors

- [ ] track Normalizer gain and two-second paired trajectory;
- [ ] Exciter Low/Mid/High and Organic;
- [ ] EQ static, dynamic and linear-phase paths;
- [ ] compressor and maximizer;
- [ ] Auto Headroom and Master gain;
- [ ] output safety, DC protection and invalid-sample repair;
- [ ] per-stage telemetry accumulators.

### Phase 4 — native player ownership

- [ ] Decoder interface and complete format coverage.
- [ ] Two native decks and read-ahead queues.
- [ ] Immediate play/seek/Next/Previous cancellation.
- [ ] Native audio-clock crossfade.
- [ ] Output-device selection and automatic system sample rate.
- [ ] Background whole-track analysis cache integration.
- [ ] Remove PCM ownership from hidden HTML audio elements only after parity.

### Phase 5 — UI parity and rollout

- [ ] Map every current graph and meter to native telemetry.
- [ ] Add a development-only backend selector: TypeScript reference or native.
- [ ] Never run both audible backends simultaneously.
- [ ] Add callback timing, xrun and telemetry-drop diagnostics.
- [ ] Stress-test low-end hardware and high sample rates.
- [ ] Make native the default only after the complete acceptance matrix passes.
- [ ] Retain one release of fallback before deleting TypeScript processing.

### Phase 6 — cleanup

- [ ] Delete duplicated TypeScript DSP math after native parity is established.
- [ ] Keep portable fixture readers and settings encoders for tests.
- [ ] Update architecture docs, NOTICE, packaging and support diagnostics.
- [ ] Remove the backend selector after one stable release if telemetry shows no
      native-specific regressions.

## Proposed repository layout

```text
native/
  CMakeLists.txt
  CMakePresets.json
  dsp-core/
    include/fluideq/dsp.h
    include/fluideq/config.h
    include/fluideq/telemetry.h
    src/engine.cpp
    src/eq/
    src/exciter/
    src/dynamics/
    src/analysis/
    tests/
  dsp-host/
    src/main.cpp
    src/control_transport.cpp
    src/telemetry_transport.cpp
    src/decode/
    src/platform/windows/
    src/platform/macos/
    src/platform/linux/
src/common/dsp/
  nativeProtocol.ts
src/main/dspHost/
  supervisor.ts
  transport.ts
src/renderer/dsp/
  nativeStore.ts
  nativeTelemetry.ts
```

Keep platform headers out of `dsp-core`. The core must compile in native unit
tests and, optionally, to WebAssembly for differential tests.

## Process supervision and failure behavior

Electron main owns the native host lifecycle.

- Start the process lazily when playback or an explicitly requested live feature
  needs it.
- Perform a protocol-version handshake before sending settings.
- Use an authenticated per-launch local endpoint with a random token.
- Pass trusted media handles/paths from main; do not expose arbitrary filesystem
  access to the renderer.
- Heartbeats and health telemetry are control-thread work, never audio-thread
  work.
- If the host exits, mark the engine failed once, stop sending commands and
  surface one actionable diagnostic.
- During migration, fall back to the existing player only through an explicit
  transport handoff. Never let both backends play the same track.
- Do not restart in an unbounded loop.
- Preserve the host crash log separately from renderer logs.

## Packaging implications

The current package already unpacks `.node` and `.dll`, but a standalone host
must be copied explicitly for each platform. Add the built host and required
runtime libraries to platform-specific `extraResources`; do not place them in
ASAR.

The build must produce:

- Windows x64 host;
- macOS x64 and arm64 host, included in signing/notarization;
- Linux x64 host for AppImage;
- symbols stored outside release packages for crash diagnosis.

Add build scripts with these responsibilities:

```text
pnpm build:native-dsp        configure and compile the current platform host
pnpm build:native-dsp:clean  clean only the scoped native build directory
pnpm test:native-dsp         run C++ unit/parity tests
pnpm build                   build native DSP, main, preload and renderer
pnpm package                 fail if the expected native host is absent
```

`pnpm build` must compile the C++ engine as part of the ordinary FluidEQ build;
the host may never be a separately documented manual prerequisite. Development
should use an incremental CMake build and copy the resulting host to one known
development runtime directory. Production resolves the executable beneath
`process.resourcesPath`, never from the current working directory.

Add platform-specific `electron-builder` `extraResources` entries for the host
and only the runtime libraries it actually needs. Add a build-time manifest
containing protocol version, DSP-core version, target architecture and build
revision. Electron main must reject a host whose handshake version does not
match the JavaScript protocol instead of failing later on an unknown command.

Add a cold-build CI job that starts with no CMake/compiler cache, compiles the
native target, runs native tests, builds Electron, verifies the packaged host is
present and inspects its architecture. The normal package job must depend on
that same native build path so CI and local release builds cannot drift.

## First task for the next agent

Do not begin by porting the Exciter. Begin with Phase 0 and an identity native
host:

1. Read `AGENTS.md` and `CLAUDE.md` completely.
2. Inspect and preserve the dirty working tree.
3. Have Ivan perform the P0 listening checks after a full restart.
4. Add the missing signed-LUFS and crossfade-handoff tests once the sound is
   accepted.
5. Write a short protocol/spec document for the native host.
6. Implement a native identity engine that opens only on Play, outputs exact
   input, publishes timing telemetry and closes the device at idle.
7. Prove the renderer stays responsive and the host produces zero underruns
   before moving one DSP primitive.

The migration is complete only when the native backend reproduces current
sound, safety, graphs and transport behavior without making the UI or audio
thread wait on the other.
