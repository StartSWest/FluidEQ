# DSP processor — design

Date: 2026-08-21
Status: approved for planning

## What this is

A studio-grade dynamics and enhancement chain — exciter, multiband
compressor, maximizer — that runs **in real time on FluidEQ's own playback**,
with the same engine reusable to render a processed file.

It is the answer to a plain request: make a 96 kbps track sound good. The
research that preceded this design established that no AI model can be
shipped for that job, and the reasoning is recorded below so nobody repeats
the search.

## Why not an AI restoration model

A survey of the 2026 audio-super-resolution literature reduces to one table:

| Model                              | Blocker                                                                                                           |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| NVIDIA A2SB                        | NonCommercial licence, code and weights both                                                                      |
| MusicHiFi, FiPA-SR, FLowHigh-music | no weights published                                                                                              |
| UniverSR, AudioSR                  | trained on 4–12 kHz sources; a 96 kbps MP3 keeps ~16 kHz, so they would discard real audio to hallucinate it back |
| Apollo                             | the only open, commercially usable model trained on codec damage — auditioned and rejected on sound               |

Apollo remains the only candidate if this is revisited. It is 66 MB, CC
BY-SA 4.0, and has no ONNX export; converting it would make our export
adapted material that must itself be published under CC BY-SA 4.0. That is
acceptable — `NOTICE.md` already carries the OPRA dataset on those terms —
but it was not worth doing for the audition result.

## Why not Equalizer APO

APO is where FluidEQ's existing processing lives, and it cannot host this.

- APO 1.4.2 offers `Filter:`, `Preamp:`, `Convolution:`, `Copy:`, `Delay:`,
  `Stage:`, `GraphicEQ:`. **Every one is linear.** A linear operation cannot
  compress dynamics and cannot synthesise a frequency that was not present.
  That is a theorem, not a gap in APO.
- The one escape is `VSTPlugin:`, which loads a **VST 2.4** DLL.
  `VSTPluginFilterFactory` tests `command == L"VSTPlugin"` and there is no
  `Plugin` command in 1.4.2 — already documented in `src/common/chainBundle.ts`.
- **Steinberg withdrew the VST2 SDK in October 2018 and signs no new
  licences.** JUCE removed it. A new developer cannot lawfully distribute a
  VST2 binary, and FluidEQ is sold, so the grey path is closed for the same
  reason Demucs was.

A third-party APO fork with VST3 exists. Adopting it would replace the
official installer we pin and hash-verify in
`.erb/scripts/fetch-equalizer-apo.ts`, which is a worse trade than the
feature is worth.

**Consequence, stated plainly:** this feature does not affect Spotify,
YouTube, games, or any other system audio. It processes what FluidEQ itself
plays. The UI must say so; see "Honest scope" below.

## Architecture

### Insertion point

`LibraryPlayerContext.tsx` builds playback on a bare `new Audio()` held in a
ref and deliberately never rendered. There is no Web Audio graph today, so
the chain is free:

```
new Audio()  →  MediaElementAudioSourceNode  →  [DSP chain]  →  destination
```

Two hazards this creates, both of which the implementation must handle
before anything else:

1. **`createMediaElementSource` may be called once per element, ever.** A
   second call throws and playback dies. The source node is created with the
   element, in the same ref, and never rebuilt.
2. **Once the element is routed into Web Audio it no longer reaches the
   speakers by itself.** If the `AudioContext` is suspended — which it is
   until a user gesture — audio stops entirely. The graph must be built with
   the context resumed, and a failure to resume must fall back to the
   unrouted element rather than leave a silent player.

The video element in the same context is out of scope; it keeps its current
direct path.

### One engine, two contexts

The chain is described declaratively and built by one function that accepts
either context type:

| Context               | Use                                            |
| --------------------- | ---------------------------------------------- |
| `AudioContext`        | live, while listening                          |
| `OfflineAudioContext` | render a processed file, faster than real time |

`AudioWorkletNode` works in both. Nothing is written twice.

### The chain

Signal order, which is the order that matters:

1. **Input trim** — `GainNode`. Unity by default.
2. **Exciter** — band-split at a detected corner, `WaveShaperNode` on the
   upper band only, mixed back. This is the module that generates harmonics
   that were not in the source, and the reason the feature exists at all.
3. **Multiband compressor** — Linkwitz-Riley crossovers built from
   `BiquadFilterNode` pairs, three bands, each into an `AudioWorklet`
   detector with real attack/release. Not `DynamicsCompressorNode`, whose
   parameters are not a studio compressor's and whose knee is not ours.
4. **Maximizer** — look-ahead limiter in an `AudioWorklet`. The look-ahead
   delay is the reason this cannot be a native node.
5. **Output ceiling** — `GainNode`, see headroom below.

Each module is bypassable and each bypass is a real graph reconnection, not
a zeroed parameter, so a bypassed module costs nothing.

### Headroom against APO

FluidEQ's playback leaves by the endpoint **where APO is already applying
that device's profile**. Our chain therefore runs _before_ APO, and a
maximizer pushing to 0 dBFS followed by an APO boost clips.

The output ceiling defaults to leave headroom equal to the active profile's
maximum boost. `SmartHeadroomEngine.tsx` already computes that quantity for
its own purpose and is the source of truth; this must read it rather than
re-derive it.

This is the single most likely defect in the feature and it is silent when
wrong — clipping on loud passages only. It needs a measured test, not an
argument.

## Files

New, all under the 500-line limit:

- `src/common/dsp/chain.ts` — the declarative chain and its parameter ranges
- `src/common/dsp/presets.ts` — factory presets
- `src/renderer/dsp/graph.ts` — builds the graph for either context
- `src/renderer/dsp/exciter.ts` — the shaper curve, derived not guessed
- `src/renderer/dsp/worklets/maximizer.worklet.ts`
- `src/renderer/dsp/worklets/multibandCompressor.worklet.ts`
- `src/renderer/dsp/useDspEngine.ts` — lifecycle, resume, bypass
- `src/renderer/dsp/DspPanel.tsx` — the UI
- `src/renderer/dsp/renderToFile.ts` — `OfflineAudioContext` → WAV
- `src/common/i18n/<locale>/dsp.ts` — ten locales, same commit

Modified:

- `src/renderer/library/player/LibraryPlayerContext.tsx` — source node and
  chain insertion
- `src/renderer/App.tsx` — the new tab

Worklets are loaded with `audioWorklet.addModule(url)`, which needs webpack
to emit them as separate assets. `whisper.worker.ts` and the
`@fluideq/whisper-wasm` alias are the existing precedent for that.

## UI, and honest scope

Ivan asked for this inside the EQ tab. It goes there as a sixth pill beside
`eq`, `presets`, `voicing`, `convolution`, `config` in `EQ_GROUP_TABS`.

**That placement carries a real risk and the panel must answer it.** Every
other pill in that group configures APO and therefore all system audio.
This one does not — it affects FluidEQ's player only. A user who assumes
otherwise will report the feature as broken. The panel states its scope in
its own header, in text, not in a tooltip.

Controls follow the existing classes: `button small` for the suggested
action, `button small subtle` for the quiet one. Nothing invented.

Every long-running action — the file render — shows progress from its first
second, is cancellable, and can be backgrounded.

## State

DSP settings are **not** part of `IState`. `IState` is what gets rendered
into APO config, and none of this reaches APO. A separate store keyed
`fluideq.dsp.v1`, with the same preset shape the EQ presets use.

## Testing

- Chain description, parameter clamping and preset round-trips: plain unit
  tests.
- The graph builder: jsdom has no Web Audio, so it is tested against a
  structural interface the way `outputMirror.ts` tests `IMirrorSink`.
- The worklet DSP: pure functions extracted from the processor and tested
  on buffers, with **a positive control beside every null test** — a
  compressor that returns its input unchanged passes a badly written null
  test, which is exactly how the separation packing bug survived.
- Headroom against APO: measured, on real output, not argued.

## Out of scope

- System-wide audio. Named here so it is not rediscovered as a surprise.
- The video element's audio path.
- AI restoration. Recorded above, closed for now.
- Per-instrument stem separation, which Ivan raised as a possible future
  karaoke feature and is a separate design.
