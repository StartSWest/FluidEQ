# Raw sharing and truthful processing delay

> Continue in the main task only. The user asked to stop using agents; their
> partial work is preserved and will be reviewed and completed here.

**Goal:** Send unprocessed audio without requiring any sender EQ, DSP, or mode;
apply processing once on the receiver; show the actual known processing delay.

**Approved design:** The September 19 investigation and the user's follow-up
approve raw capture, nonblocking transport handoff, adaptive receiver buffering,
native shared-mode playback, and a truthful common EQ/DSP readout. A processing
delay is the samples held by the processing graph, not a claim of physical or
network end-to-end latency. Unmeasured contributions remain explicitly unknown.

**Constraints:** Preserve the existing dirty checkout. No audio-service restart,
driver change, or second app window. No timers for readiness or recovery. Preserve
PCM samples on the sending side and authenticate/encrypt the existing transport.
Receiver playback stays in shared mode with endpoint effects enabled. Library
processing must be bypassed before its output can be captured for sharing.

## Deliverables

- [x] Common accurate latency display: engine frame count and actual sample rate,
      correct selected endpoint, EQ/DSP subtotals, retained buffers labeled as buffers,
      known bypass distinguished from unknown data, no fixed linear-phase fallback.
      Test output changes, stale reads, DSP bypass, and absent/legacy telemetry.
- [x] Nonblocking native capture: fixed-capacity packet queue, approximately 5 ms
      packets, dedicated stdout writer, explicit sequence gaps on discontinuity or
      overflow, cancellation without waiting for a blocked pipe. Test byte-preserving
      ordering, capacity bounds, resets, and multiple supported rates.
- [x] Native receiver: bounded continuous mixer, high-quality rate conversion,
      clock-drift correction, adaptive buffering, click-free underrun handling, and
      WASAPI shared-mode periods selected from the device's supported range. Test
      impulses, stereo/multichannel routing, drift, packet loss, and recurrent bursts.
- [x] Main/renderer integration: authenticated packets reach native playback on
      Windows without routing through the renderer. Reuse IPcmMixer's lifecycle API
      for output selection, volume, failure, and stop; retain the existing non-Windows
      worklet. Send raw packets regardless of legacy saved mode and remove sender
      mode controls. Bypass Library DSP while sending and restore saved settings on
      stop. Test reconnect, role switching, late requests, and failure cleanup.
- [x] Low-latency processing control independent of sound presets/rack power;
      preserve active effect delay and count only the running graph. Gaming picks
      turn the switch on; manual off persists until another explicit Gaming pick.
- [x] Hide the latency badge when the engine is off. Left-align its popup and
      show every active processing stage, including zero-buffer stages.
- [x] Replace Voicing with DSP favorites: one preset source and application
      path, curated initial favorites, reactive stars for factory and saved chains,
      no duplicate legacy voicing curve when selecting a DSP favorite.
- [x] Add permanent classic and worldwide genre presets beside favorites, with
      Default, Reference, Music first; Country and Modern Country; None bypass;
      saved/factory favorites; full-width rows with hover/focus stars.
- [x] Keep related styles adjacent in the DSP, quick-preset and EQ-stage lists,
      including Country immediately followed by Modern Country.
- [x] Apply a static preset EQ curve under Equalizer APO and hide Game mode there.
- [x] Preview Linear phase delay before enabling it, using the output sample rate
      and the native kernel sizes; refresh when bands change.
- [x] Keep older engine presets readable. Game-mode capability comes from live
      telemetry as well as release version, including development DLLs stamped 1.9.
- [x] Final source verification of the isolated audio change set and exact staging.
- [ ] Existing-window visual review and two-PC listening/latency verification.
      The user prohibited computer control and audio-service/driver changes; these
      require the user's own device test.

## Verification already completed

- All 64 native CTest entries passed, including capture queue, native receiver,
  processing-delay impulses, drift, underrun fades and the full preset sweep.
- A fresh isolated native build and all 10 affected native test entries passed,
  including the Room, crossover, capture queue, receiver and engine status tests.
- Receiver protocol smoke passed without opening an audio device.
- Isolated production main and renderer builds and TypeScript passed. Styles,
  encoding, configured source lint, and explicit lint of the new smoke script passed.
- The final full JavaScript run on the isolated change set passed 657 suites and
  7,463 tests. One unrelated scene-preview source-wiring assertion failed in
  `sceneGuardedSurfaces.test.tsx`: it expects an inline ownership expression,
  while ScenePage now passes `madeBy`. The test and all eight scene sources it reads
  are byte-identical to base commit `349903a20`. Update that assertion alongside
  the separate scene work; no test or scene behavior was weakened here.
- All six focused compatibility, linear-phase, playback lifecycle and preset-order
  suites passed (47 tests). Related genres stay adjacent in both preset catalogs.
- An additional forced lint of the normally excluded legacy native-build script
  reports its existing `for...of` / `continue` style violations in CRT copying.
  The new helper check follows the configured rules; this unrelated loop was retained.
- Latest installed-engine report after the capability correction: Game mode on,
  192 processing-delay frames at 48 kHz (4 ms). This excludes device and network
  delay and is not a physical end-to-end measurement.

## Shared-audio validation still needed

Use two real PCs to confirm source EQ/DSP does not alter the transmitted samples,
receiver-only EQ/DSP and Game mode work, default/output changes and reconnects
recover, and sustained Ethernet/Wi-Fi playback has acceptable delay and no audible
dropouts. The receiver starts with 30 ms of jitter buffering and adapts between
15 and 160 ms; that buffer, Windows device buffering and the network still add
delay even when processing reports 0 ms. Zero total delay is not claimed.

The source was built in an isolated verification directory. The user's running
app, installed engine and audio services were not replaced or restarted. Load the
rebuilt app/native helpers and engine before doing the visual and listening checks.

## Playback interface

`FluidEQ-LAN-Playback.exe --parent-pid N` accepts bounded binary commands with a
24-byte little-endian header: magic 0x31504c46, kind, id, sample rate, channel count
(u16), frame count (u16), and payload bytes. OPEN(1) carries a strict endpoint GUID
or empty for default; AUDIO(2) carries sequence(u32) then Float32 PCM; REMOVE(3),
VOLUME(4), RESET(5), and CLOSE(6) manage lifecycle. Replies expose READY(1),
ACK(3), FAILURE(4), METER(5), and OUTPUT_STATUS(6). No packet can request DSP.

New native code belongs in native/remote-audio-playback; process/protocol ownership
belongs in src/main/nativeRemoteAudioPlayback*.ts, IPC in the remote-audio IPC
module, and the renderer adapter in src/renderer/remoteAudio/nativePcmMixer.ts.
