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

**This is the first task, and it is infrastructure the rest depends on.** A 4×
oversampled block — polyphase FIR up, process, FIR down — serves the exciter,
the compressor's detector and the limiter alike.

A test can prove it: a pure tone through the shaper, FFT the result, and assert
there is no energy at the _fold-back_ frequency. With a positive control that
shows the un-oversampled path does produce it, because otherwise "no aliasing"
and "no signal" read identically.

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
- **Matched-Z / Orfanidis correction** near Nyquist. A plain bilinear-transform
  biquad warps: a 16 kHz bell at 44.1 kHz lands measurably narrow and low. This
  is the difference between an EQ that is accurate and one that is only
  accurate below 10 kHz.
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

## Out of scope

- Replacing Equalizer APO on Windows. It stays.
- System-wide audio on any platform. The rack processes FluidEQ's own player.
- AI restoration — closed in `2026-08-21-dsp-processor-design.md` and unchanged.
- Reordering the chain from the UI.
