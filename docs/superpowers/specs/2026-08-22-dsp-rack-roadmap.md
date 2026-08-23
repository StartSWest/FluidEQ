# The DSP rack — roadmap

Date: 2026-08-22
Status: proposed, not started

## What this is for

A complete processing rack in FluidEQ's own audio path: an EQ, dynamics,
saturation and metering, each built to the best method actually available for
its job rather than the easiest one, presented as blocks on the DSP tab.

The long game is portability. Everything here is Web Audio and plain
arithmetic — no Equalizer APO, no Windows. That does **not** replace APO and is
not meant to: APO is what lets FluidEQ touch every application's sound on
Windows, and nothing in this document can do that. What it does is make the
processing itself platform-independent, so a macOS build has a real feature
rather than an empty tab. See "The honest truth about macOS" below, because
the gap is bigger than it looks.

## Fix first: the exciter aliases

Before any new block, the one that ships today has a measurable defect.

`buildShaperCurve` is a non-linearity running at the session rate. A shaper fed
a 7 kHz tone at 48 kHz produces harmonics at 21 kHz, 35 kHz, 49 kHz — and
everything above 24 kHz **folds back down** as inharmonic content that was
never in the music and does not move with it. That is aliasing, and it is
exactly why every commercial saturator, exciter, clipper and limiter
oversamples.

The exciter is the worst case because it is deliberately harmonic-rich and
deliberately aimed at the top octaves, where there is least room before
Nyquist.

**DONE for the exciter, and it needed no FIR of our own.** `WaveShaperNode`
carries an `oversample` property — `'none' | '2x' | '4x'` — and Chromium
resamples, applies the curve and filters back down in C++. The default is
`'none'`, which was the whole bug. The graph now sets `'4x'`.

Measured rather than assumed: the property was probed in a running window
before the code was written, and `dspExciter.test.ts` demonstrates the folding
on the un-oversampled path — a 3rd harmonic landing at `SIZE - 3*BIN` — with an
identity curve beside it proving a linear path folds nothing.

**Still needed, for the worklet.** There is no native node inside an
`AudioWorkletProcessor`, so the true-peak limiter (block 5) still needs a
polyphase FIR interpolator of our own. Only its detector runs oversampled; the
audio path does not, which is what a true-peak limiter actually requires.

## The blocks

In build order. Each is a card on the DSP tab and each is independently
useful — nothing here is a prerequisite for the next except the oversampling
above.

### 1. Oversampling core

Not a visible block. 4× polyphase FIR, half-band, ~96 dB stopband. Every
non-linear stage runs inside it.

### 2. Parametric EQ

The block that makes this a rack rather than an effects strip, and the one
FluidEQ has the most reason to get right.

- **Biquads by RBJ's cookbook** for the shapes, which is what APO itself uses,
  so an EQ curve reads the same on both paths.
- **Matched-Z / Orfanidis correction** near Nyquist — and the size of the
  problem is now measured rather than assumed, which changes how urgent it is.
  `dspBiquad.test.ts` records what the plain cookbook actually does at 44.1 kHz:

  | Case                                                  | Drift          |
  | ----------------------------------------------------- | -------------- |
  | 1 kHz bell, symmetry an octave either side            | 0.01 dB        |
  | 16 kHz bell, symmetry an octave either side           | **0.60 dB**    |
  | 16 kHz high shelf asked for +6 dB, measured at 20 kHz | 5.92 dB — fine |

  **The shelf row used to read "delivers 3–6 dB" and that was wrong.** It was
  reading the shelf's own corner frequency — where a shelf is _defined_ to be
  half its gain — as a shortfall. Measured again directly: at 44.1 kHz a 16 kHz
  shelf asked for +6 dB delivers 5.92 at 20 kHz and a full 6 at Nyquist, and
  48 kHz behaves the same. There is nothing there to correct.

  What genuinely is squeezed is the **bell's upper skirt**: at 16 kHz the octave
  below carries 0.6 dB of a +6 boost while the octave above carries 0.03. That
  asymmetry is what cramping means here. An "analog matched" model was written
  against the old claim, measured, and deleted rather than shipped as a placebo
  — the correction moved the result by hundredths of a decibel.

- **Optional linear phase** via FFT convolution, using the machinery already in
  `src/main/convolution.ts`. Pre-ringing is the trade and the UI must say so.
- Bands: high/low pass, low/high shelf, bell, notch, band pass.

Presets: the correction curves FluidEQ already ships (OPRA, voicings) become
selectable here, so the two paths agree.

### 3. Exciter — rebuilt on the oversampling core

Plus what the current one lacks: selectable character. Even harmonics
(asymmetric, "tube") read as warmth, odd (symmetric, "tape") as edge. Today it
is symmetric only, which is correct for air and wrong for anything else.

### 4. Compressor — the real thing

The current one is a peak detector with one time constant pair. What separates
a studio compressor from a peak limiter with a slow release:

- **RMS + peak detection blended**, because the ear responds to both.
- **Soft knee**, measured in dB, not a hard corner.
- **Program-dependent release** — the behaviour that makes an 1176 or an LA-2A
  sound "musical" is a release that lengthens with how long the signal has been
  over threshold.
- **Sidechain filter**, so bass does not duck the whole mix.
- **Gain-reduction metering**, because a compressor you cannot see is one you
  cannot set.

### 5. True-peak limiter

The current limiter is sample-peak. A signal limited to exactly -1 dBFS in the
samples can reconstruct above that between them, which is what every streaming
service measures and rejects. ITU-R BS.1770 true-peak means oversampling the
detector — 4× is the standard.

### 6. De-esser

A compressor whose sidechain is band-passed at the sibilance range, acting only
on that band. Falls out of blocks 2 and 4 almost for free.

### 7. Stereo width

Mid/side, with a **mono-below** control. Widening the bass is the single most
common way to make a mix fall apart on a phone speaker, so the block that
offers width has to offer the bass safety with it.

### 8. Loudness — EBU R128 / LUFS

Measure integrated loudness and offer to normalise to a target. This is the
honest version of "make it louder": it says what the number is.

### 9. Convolution reverb

`convolutionCatalog.ts` and the impulse machinery already exist for room
correction. Same maths, different intent.

### 10. Analyser

Spectrum and gain-reduction, live. A rack without meters is a rack you set by
guessing.

## The UI

Blocks on the DSP tab, and the arrangement is the design decision.

- **A rack, in signal order, top to bottom.** The order matters audibly and the
  page should be the order.
- **Each block is a card**, as now: switch, name, and its dials. The card's
  border carries its state.
- **Collapsed by default past the first two.** Ten blocks of dials is a wall.
  A collapsed card still shows its name, its switch and a one-line summary of
  what it is doing, so the rack reads as a chain before it reads as controls.
- **Drag to reorder** is deliberately NOT in scope. Signal order is a real
  audio decision and a fixed, sensible one is better than an arbitrary one a
  user can break silently.
- **Every dial is `LabelledKnob`** — one control, learned once, Ctrl+click home.
- **Meters live on the block they belong to**, not in a separate panel. A
  compressor's gain reduction next to its threshold is the only place it means
  anything.

## Presets

Two kinds, and they are not the same thing:

- **Per-block presets** — a compressor setting named for what it does
  ("vocal glue", "drum punch"), chosen inside that block's card.
- **Whole-rack presets** — the current `DSP_PRESETS`, which set every block at
  once. These are what most people will use.

Sourced honestly: derived from published targets where they exist (EBU R128 for
loudness, the OPRA curves for EQ) and from measurement otherwise. A preset
named after a genre with nothing behind it is decoration.

## The honest truth about macOS

**This rack does not, on its own, give FluidEQ a macOS product.**

The processing is portable — Web Audio is Web Audio. What is not portable is
_getting the system's audio_. On Windows that is Equalizer APO, which is why it
is bundled. macOS has no equivalent that can simply be installed alongside: it
needs an **Audio Server Plug-In** (a virtual output device the user selects,
which the app then reads), signed and notarised, plus a user who is willing to
change their system output device.

So the sequence for macOS is:

1. This rack — the processing exists and is proven.
2. A virtual device — a separate, substantial project, and the actual blocker.
3. Only then does "FluidEQ on macOS" mean what it means on Windows.

Step 1 is worth doing on its own merit for the Library player. Step 2 should
not be started on the assumption that step 1 implies it.

## Taking the rack system-wide — the route, on all three platforms

Investigated 2026-08-22. Still out of scope for this rack; written down because
the answer turned out to be different from what everyone assumes.

### Loopback cannot do it, and that is topology rather than policy

The obvious idea is to capture the system's own output, process it, and play it
back. It cannot work anywhere. A loopback capture is a **tap, not an insert**:
it hands back a copy of what the endpoint has already been sent, so the
unprocessed audio is on its way to the speakers before you have a sample of it.
Playing your processed version produces both at once, and your version is then
captured too.

To replace the audio you have to be _in_ the path before the mix reaches the
device. Every platform has such a place; none of them is loopback.

### Why the rack is player-only today is a FORMAT limit, not a reach limit

Equalizer APO's config is a list of linear operations — `Filter`, `Preamp`,
`GraphicEQ`, `Convolution`. Every biquad in this rack fits, and linear phase
fits as convolution. **Dynamic EQ, fuzz, per-band thresholds and the adaptive
regulator do not**, because they are code deciding per sample rather than
filters. That is the whole reason these blocks stop at FluidEQ's own player.

### The insert point on each platform

|             | where the processing goes                                                                                                                                                                                                                                  |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Windows** | An **APO** — a user-mode COM DLL implementing `IAudioProcessingObject`, loaded by the audio engine. No kernel driver. This is what Equalizer APO is.                                                                                                       |
| **macOS**   | An **Audio Server Plug-In** — a user-space bundle in `/Library/Audio/Plug-Ins/HAL/` presenting a virtual output device, which forwards to the real one. Runs in `coreaudiod`; kernel extensions are not involved. This is what BlackHole and Loopback are. |
| **Linux**   | A **PipeWire filter node** inserted into the graph. No driver, no device to install, no privileged component at all.                                                                                                                                       |

Linux is by far the easiest of the three and it is worth saying so plainly,
because the usual assumption is the opposite. macOS is the hardest — not
because the plug-in is hard, but because the user has to change their output
device, which Windows and Linux users never do.

### The shape that generalises

One **portable DSP core** in C++ — the same processors this rack already
defines, ported once — behind three thin host shims: an APO, an Audio Server
Plug-In, and a PipeWire node. The core is where the work is; the shims are
adapters. Building any one of them without that split means building the
processors three times.

### The VST shortcut is real and is probably closed

Equalizer APO added VST plugin support in **1.3**, in mainline, driven from its
Configuration Editor — and its official configuration reference does not
document the command at all. The support is **VST2**. Native VST3 has been an
open request for years (ticket #275) and exists only in a third-party fork.

Steinberg no longer issues VST2 SDK licences, so a new VST2 plugin is very
likely not a route this project can take. **Verify at Steinberg's own terms
before anyone writes a line of it** — this was not confirmed, only recalled.

### Ours would coexist with Equalizer APO

APOs chain by design: an endpoint holds lists of them, and Equalizer APO works
by inserting into those lists. Ours placed after it would process the
already-EQ'd signal.

The real risk is not Windows. It is that **two components would own the same
registry list** — Equalizer APO's Configurator writes the endpoint's APO list
and so would ours, and the last writer wins unless they are designed to
cooperate. Also worth knowing: a crash in either takes down `audiodg` and drops
all system audio until it restarts, so two APOs is two chances at that.

### The bigger prize, deliberately not the first step

If a FluidEQ APO exists, it could carry the parametric EQ as well and Equalizer
APO would stop being needed on Windows at all. The cost is reimplementing what
the app's EQ path speaks today — the preamp resolution, the layer rendering,
the auto-normalize, and the import/export compatibility users expect.

Build it as a **second** APO first. That proves the registration and the
processors against a working system, and absorbing the EQ can be considered
once it runs.

## Out of scope

- Replacing Equalizer APO on Windows. It stays.
- System-wide audio on any platform. The rack processes FluidEQ's own player.
  The route for taking it further is written down above, and taking it is a
  separate project rather than a later phase of this one.
- AI restoration — closed in `2026-08-21-dsp-processor-design.md` and unchanged.
- Reordering the chain from the UI.
