# Denoise — design

Date: 2026-08-30
Branch: `claude/noise-reduction-filter-a41ca7`
Status: implemented. Not launched — nothing here has been through speakers.

## What changed between the design and the build

Four things were settled by measurement rather than by the plan, and each is
written up where the code lives:

- **The spectral module's floor conversion was off by N/2.** The profile is a
  density, and turning it back into a bin power takes the whole one-sided
  bandwidth, not the bin width. It measured as a denoiser that ran, reported
  plausible gains and removed nothing.
- **The scan's floor estimator is a histogram, not a tracker.** A
  multiplicative tracker can travel about eight decibels across a whole file,
  so wherever it starts is roughly where it ends. Its bias constant is measured
  (21.77 dB) rather than derived; the idealised figure was wrong twice over.
- **The click detector could not bootstrap.** Its scale learned only from
  unflagged samples, and from zero every sample is flagged.
- **The Voice module loads the ONNX Runtime by path** instead of linking it.
  The app already ships it for karaoke, so the audio host gains no build
  dependency and a machine without it has no Voice module rather than no host.

A restoration stage for the DSP rack. Four independent modules behind one
card, fed by one file scan: broadband hiss, mains hum, clicks, and a neural
speech denoiser.

## Why this is one stage and not four

The four share exactly two things, and nothing else: the point in the chain
where they run, and the file scan that measures the material. Their algorithms
have nothing in common, so they are four separate processors in series rather
than one engine with mode flags. A listener with only mains buzz must not pay
the spectral module's 21 ms of latency and its artefacts to remove it.

## Placement

```
input gain (Normalizer) → DENOISE → Exciter → EQ → Compressor → Dimension
                                  → Maximizer → Master → safety
```

**Below the input gain, not above it.** The Normalizer's gain is derived from a
cached whole-file true-peak measurement. Anything that alters the waveform
upstream of that gain makes the measurement describe a signal that no longer
exists, and the ceiling guarantee silently stops holding — the failure is
inaudible until a track clips. Below it, the same constant gain applies to the
noise profile too, so the scan stays exact for the cost of one addition.

**Above every creative stage.** Denoising after the Exciter means generating
harmonics from hiss and then trying to remove the result. Denoising after the
EQ means removing noise that a boost has already amplified past the profile.

Rail position: immediately after Normalizer. Both are "fix the source" stages,
and `DSP_SECTIONS` orders pages by workflow rather than by sample scheduling.

## Engine

**Native C++ only.** `native/dsp-core`, with its own ctest property tests,
disabled in the parity fixtures — the Dimension precedent. No TypeScript
worklet twin.

The parity corpus exists to hold a C++ port to a TypeScript reference that was
the specification during the migration. That migration is finished, the native
engine is the shipped default, and the worklet is a passthrough that never
processes. A TypeScript twin of four new processors would be a second
implementation with no consumer, kept in agreement with the first by hand.

**Consequence, and it must be visible:** when the native host fails to start,
the worklet fallback carries the audio and this entire card does nothing. The
DSP panel header already says so in general terms (`dsp.engineFallback`, landing
on `claude/typescript-usage-review`). That is not enough on its own — it tells
the listener why the sound changed, not which card is the dead one. So the card
reads `useDspNativeState()` and, on `'failed'`, disables its four module
sections and shows its own amber `.dsp-engine-fallback` hint saying this stage
is bypassed because it exists only in the native engine.

It needs its own string rather than reusing the header's. The comment above
`.dsp-engine-fallback` in `Dsp.scss` explains the amber as "every effect is
still applied. Only the engine doing the arithmetic changed" — and that sentence
is exactly what stops being true here.

## The four modules

### 1 · Hiss — STFT spectral gain

Decision-directed _a priori_ SNR estimation (Ephraim–Malah) driving a Wiener
gain. **Not** naive spectral subtraction: subtraction leaves isolated surviving
bins that warble between frames, and that artefact — musical noise — is the
difference between a denoiser that sounds clean and one that sounds like a
broken gate.

1024-point Hann, hop 256 at 48 kHz. The window is scaled with sample rate to
hold the window near 21 ms rather than to hold the bin count fixed: constant
time resolution is the right invariant, because a longer window smears
transients and a noise floor is smooth enough that frequency resolution is not
the binding constraint. Latency 21.3 ms, paid only while this module is on.

Controls:

- **Amount** — over-subtraction factor.
- **Reduction limit**, default −18 dB. The most important control on the card:
  it caps how far any bin may be attenuated, so a low level of the original
  noise always survives to mask what the processing leaves behind. Set to
  −∞ this module sounds worse, not better.
- **Sensitivity** — dB above the profile a bin must reach to count as signal.
- **Smoothing** — the decision-directed smoothing constant.

Profile source, a two-option segmented control:

- **Scanned** — per-band noise magnitudes from the file scan.
- **Adaptive** — live minimum-statistics tracking (Martin), for streams,
  video and un-analyzed files.

Scanned falls back to Adaptive when no scan exists, **and the card says which
one is actually running**. A control that has quietly stopped doing what it
says is the failure mode the Normalizer card's `limitedBy` line already exists
to prevent.

### 2 · Hum — comb of notches

Zero latency, no transform, built from the existing biquad.

The scan measures the **exact** fundamental by peak-picking a fine transform
around 50 and 60 Hz. A notch nailed to 50.0 Hz misses a hum sitting at 50.2,
and widening the notch until it does not is how a hum filter starts removing
bass. It also reports which harmonics stand above the local floor, and **only
those are notched** — a notch at 400 Hz where there is no hum is pure damage.

Controls: **Frequency** (Auto / 50 / 60), **Harmonics**, **Depth** (default
24 dB, deliberately not a full null), **Width**.

Known and documented failure: a sustained musical bass note at the hum
fundamental is attenuated with the hum. Depth-limited notches keep this from
being a hole, and the Isolate control below is how a listener checks it.

### 3 · Clicks — outlier detect and repair

LPC prediction error against a running median; samples whose error exceeds the
threshold are flagged and the run is repaired by interpolation. Fixed-size ring
buffer, no allocation, small lookahead.

The detector requires the outlier to be **narrow**. The failure mode of every
click repairer is eating snare transients, and the property that separates a
click from a snare is not amplitude, it is that a click's energy does not
persist into the following samples.

Controls: **Sensitivity**, **Max repair length**.
Readout: **clicks repaired per second**, measured rather than asserted.

### 4 · Voice — DPDFNet, real-time in the native chain

Model: **DPDFNet** (`ceva-ip/DPDFNet`), Apache-2.0, `dpdfnet2_48khz_hr` —
2.58 M parameters, 2.42 GMACs/s, 10.0 MB ONNX. Full-band 48 kHz, causal,
stateful streaming at 480-sample blocks.

Chosen over the alternatives for reasons that should survive the next person
asking "why not the newest one":

| Candidate                             | Rejected because                                                                                                                                                                                                                              |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LavaSR (Interspeech 2026, Apache-2.0) | A bandwidth-extension model. Its benchmarks are 8→48 kHz upsampling against AudioSR and NU-Wave2; denoising is an off-by-default flag. It _generates_ high frequencies never present in the source. That is fabrication, not noise reduction. |
| GTCRN (MIT, ICASSP 2024)              | Technically excellent — 48 K parameters beating DeepFilterNet on PESQ — but 16 kHz. On a full-band player it band-limits everything above 8 kHz.                                                                                              |
| `facebookresearch/denoiser`           | **CC-BY-NC. Non-commercial. Disqualified**, this app is sold.                                                                                                                                                                                 |
| RNNoise v0.1.1                        | 2017. Superseded on every metric by all of the above.                                                                                                                                                                                         |
| RNNoise current                       | Weights are a 58.6 MB tarball hosted off-repo with no licence statement of their own. Undocumented is not permissive.                                                                                                                         |
| DeepFilterNet3 (dual MIT/Apache-2.0)  | Clean licence, 48 kHz, would have worked. DPDFNet _is_ its successor — DeepFilterNet2 plus dual-path RNN, from 2025/26, with official ONNX and third-party streaming integration.                                                             |

**Licence compliance.** Apache-2.0 is one-way compatible with GPLv3, so it may
be included in this GPL-3.0-or-later work. It is **not** compatible with GPLv2,
which is why this was checked rather than assumed. Obligations are attribution
and preserving the notice; `NOTICE.md` carries it. Weights are published by the
author under the same repo licence — verified at `ceva-ip/DPDFNet`, not at a
mirror.

**The model is downloaded on demand, never bundled.** The Voice module is
unavailable until the user asks for it and the download completes — the pattern
`karaokeSeparation.ts` already establishes: a pinned SHA-256, a `.download`
temporary that is renamed only on a verified hash, progress reported from the
first second, cancellable. 10 MB is small enough that this is a courtesy rather
than a necessity, and that is the point: the installer does not grow, and a user
who never touches Voice never pays for it.

**Runtime: the onnxruntime C++ API linked into `dsp-host`.** Inference does not
run on the audio thread. A worker thread consumes 480-sample blocks from a
lock-free ring and publishes enhanced blocks back; the audio thread reads with a
fixed latency of four blocks (40 ms).

**On worker underrun the audio thread passes the dry signal through and
increments a counter that the card displays.** It never stalls and never emits a
partial block. Half a block of audio followed by whatever was in the buffer is
worse than a dropout, because it sounds like the material — the reasoning
`feq_chain_process` already applies to oversized blocks.

At sample rates other than 48 kHz the module resamples in and out through
`feq_resampler`, adding its latency and cost. This is stated on the card rather
than hidden.

Control: **Amount**, a dry/wet blend. Full strength on anything but speech is
destructive, and this is a music player.

The card labels this module for voice and podcast material plainly. It removes
cymbals and reverb tails from music, and a user who discovers that by accident
will reasonably call it a bug.

## Isolate — the control that makes the stage trustworthy

One toggle: play what is being **removed** instead of what is kept.

Every other control on this card asks the listener to take the processing on
faith. Isolate is how they hear whether they are removing hiss or removing the
hi-hat, whether the hum notch caught a bass note, whether the click detector ate
a snare. Reuses the existing `eq.isolate` / `exciter.isolate` name and pattern.

## The scan

A new `createNoiseProfileAnalyzer(sampleRate, channels)` in
`src/renderer/dsp/noiseAnalysis.ts`, fed inside the existing loop in
`analyzeInputTrack` alongside the loudness meter and the programme-edge
detector. The decode is the expensive half and it is already happening; a second
pass over the file would double the cost of playing an unanalyzed track to
measure something the first pass had in its hands.

It produces:

- ~40 quarter-octave band levels, the noise floor. Not the raw 1024 bins: a
  noise floor is smooth by nature, and 1024 floats per track is roughly 8 KB
  serialized — 80 MB across a ten-thousand-track library, in a file that is read
  at startup.
- The exact hum fundamental in Hz, and per-harmonic levels above the local
  floor.
- Click density per minute, so the card can say the file has clicks before
  anything is switched on.
- The broadband noise floor in dBFS — the headline number, beside the
  Normalizer's measured peak and integrated loudness.

Cached as `noise?: ILibraryNoiseAnalysis` on `ILibraryTrack.normalization`.

**No `ANALYSIS_VERSION` bump.** The precedent is `edges`, and the comment there
states the rule: the loudness numbers already cached are still correct, and
throwing away an analyzed library to learn something new about it costs every
user a re-measure of every track they own. The field is fetched lazily on the
same condition — re-decode only when the feature that needs it is on and the
field is absent.

## Wire

**The profile does not travel in the settings snapshot.** It arrives through its
own `feq_chain_set_noise_profile()`, alongside `feq_chain_set_eq_kernel` and
`feq_chain_set_track_level_gains`. Those two established the category: values
that come from analysis rather than from a dial, and that change once per track
rather than once per knob-drag. A second variable-length array inside a
fixed-lead flat layout would also be a decoder bug waiting to be written.

Chain scalars: **18**, so `CHAIN_PARAM_LEAD` 77 → 95, asserted on both sides as
the existing comment demands.

### Two collisions to resolve before implementing

1. **`claude/dsp-bass-maximizer-filters-baecbc` moves the same constant 77 → 91.**
   Both branches start from 77. Whoever lands second **renumbers rather than
   merges**: band offsets are computed from the lead, so keeping one branch's
   constant alongside both sets of scalars pushes every EQ band one slot along
   and still decodes into something plausible. This is a plan step, not a merge
   note — a diff tool can resolve it wrongly and silently.
2. **`src/main/dspHost/wire.ts:204` held a second constant of the same name at
   69, as a floor ("expected at least")** — eight behind, and structurally
   unable to catch a scalar added above it and forgotten. Being fixed on
   `claude/typescript-usage-review`, with a test that reads
   `FEQ_CHAIN_PARAM_LEAD` out of `chain.h` and asserts the two agree. Nothing to
   do here beyond not re-introducing it.
3. **`ANALYSIS_HEADER_BYTES` is the same trap, with less protecting it.**
   `src/common/dsp/analysisWire.ts:37` is 120, and the analysis frame is read at
   hard-coded byte offsets in `src/main/dspHost/wire.ts` — `dimensionGuard` at
   60, Auto Headroom at 64 and 68, the safety pair at 72 and 76. This stage
   publishes five scalars (reduction dB, noise floor, clicks repaired, voice
   underruns, profile ready), taking it to 140, and the bass branch takes the
   same constant to 196.

   Worse than the chain lead, because **both guards are floors**:
   `frame.length < ANALYSIS_HEADER_BYTES` at `wire.ts:341` and `wire.ts:396`. A
   mismatch does not fail — it reads whatever float happens to sit at the old
   offset and hands the panel a plausible number. The constant, the C++
   publisher in `meters.cpp`, and the reader must move in one commit, and **new
   fields go after every existing offset on both sides** so nothing already
   decoded shifts. Whoever lands second renumbers.

### Native parameter ids: 2200–2299, claimed

`2000–2199` are claimed by the bass branch. Ids are permanent — a removed one is
burnt rather than reissued, because a host and a renderer from different builds
can briefly speak to each other during an update and the version handshake
cannot catch a recycled id.

```
2201-2203  stage   enabled, isolate, profileSource
2211-2215  hiss    enabled, amount, floorDb, sensitivityDb, smoothing
2221-2225  hum     enabled, mode, harmonics, depthDb, quality
2231-2233  click   enabled, sensitivity, maxRepairSamples
2241-2242  voice   enabled, amount
```

Gaps between runs are deliberate: a fifth hiss dial extends 2215 to 2216 rather
than reaching into the hum run.

## Meters

A new `denoise` stage in `ANALYSIS_STAGES`, plus fields for reduction dB,
current noise floor, clicks repaired, voice underruns, and profile-ready.

That feeds the card's graph — live spectrum with the noise profile drawn beneath
it as a filled floor and the removed energy shaded. A denoiser whose only
feedback is a dial position cannot be judged; this and Isolate are the two
things that let a listener see and hear what the stage is doing.

## Files

**Native.** `include/fluideq/denoise.h`; `src/denoise_spectral.cpp`,
`denoise_hum.cpp`, `denoise_click.cpp`, `denoise_voice.cpp`, `chain_denoise.cpp`;
`tests/denoise_test.cpp`. Four files rather than one because the 500-line
ceiling is real and these are four unrelated algorithms.

**Common.** `dsp/chain.ts` (settings, defaults, clamps), `dsp/chainWire.ts`,
`dsp/analysisWire.ts`, `dsp/noiseProfile.ts` (band edges shared by scan and
wire), `dsp/nativeParameters.ts`, `library/types.ts`, and `i18n/*/dsp.ts` across
all ten locales in the same commit.

**Renderer.** `dsp/noiseAnalysis.ts`, `dsp/DspDenoiseCard.tsx`,
`dsp/DspDenoiseGraph.tsx`, plus edits to `sections.ts`, `DspPanel.tsx`,
`DspSectionIcon.tsx`, `store.ts`, `styles/Dsp.scss`, and
`library/player/LibraryPlayerContext.tsx`.

**Main.** `dspHost/wire.ts`, `ipc/dspHost.ts`, a model-download module modelled
on `karaokeSeparation.ts`, and `native/dsp-host/src/main.cpp` + `wire.h` for the
profile command and the model path.

## Testing

Every null test carries a positive control beside it. The separation packing bug
passed a perfect-looking null test by returning zero for every input, and that
is the class of mistake this section exists to prevent.

- **Hiss.** A 1 kHz tone at −20 dBFS over white noise at −60: the tone survives
  within 0.5 dB and the floor drops by at least the requested amount. The
  positive control is the same assertion with the module bypassed, which must
  **fail** — otherwise the test is measuring nothing.
- **Hum.** Injected 50 Hz plus harmonics drops ≥ 30 dB. The documented
  counter-case — a sustained bass note at the fundamental — is asserted as a
  known attenuation rather than left to be discovered.
- **Clicks.** Injected clicks: ≥ 90 % repaired. A clean drum loop: zero repairs,
  with the click-injected twin as its positive control proving the detector is
  not simply switched off.
- **Voice.** The worker-underrun path asserts dry passthrough and a counter
  increment, never a partial block. Model absent asserts the module is
  unavailable rather than silent.
- **Bypassed.** Bit-identical passthrough, all four modules.
- **Real-time safety.** No allocation inside `feq_chain_process`.
- **Jest.** Profile serialization round-trip, band interpolation, the wire lead
  assertion, and the Scanned→Adaptive fallback.

## Open items

1. **A real launch.** Nothing in this stage will have been through speakers when
   the tests pass. That is a finding, not a formality — every UI defect this
   project shipped passed the whole suite.
2. **`dsp.engineFallback`** does not exist in this worktree yet; it lands on
   `claude/typescript-usage-review`. If that branch merges second, the merger
   must know this card depends on the key.
3. **Three shared constants move under this feature** — `CHAIN_PARAM_LEAD`,
   `ANALYSIS_HEADER_BYTES`, and the native parameter id block — and the bass
   branch moves two of the three. See the collision section; none of it is
   resolvable by a merge tool.
4. ~~Where the `.onnx` bytes come from.~~ **Settled.** Ceva's repository ships
   export scripts and has no release assets, so the bytes come from the
   `sherpa-onnx` speech-enhancement-models release — `dpdfnet2_48khz_hr.onnx`,
   10,596,848 bytes, SHA-256 `0b399f8a…944928`, pinned in `denoiseModel.ts`.
   The licence is still answered at the author's repository; the mirror is a
   byte source and the hash is what keeps that distinction safe. No export step
   in the build.
5. **The audible result is unverified.** Every number in this feature comes
   from tests and offline measurement. In particular the Voice module's
   front-end — a 960-sample Vorbis window at half-overlap, matching what the
   network was trained against — has been built to the author's own inference
   script but never heard, and the same is true of the spectral module's
   voicing. The failure modes are all safe (dry passthrough, counted
   underruns), so what a launch can find is "wrong", not "broken".
