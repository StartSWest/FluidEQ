/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Music-shaped programme for a checkout that has no music in it.
 *
 * `smoke-presets.ts` defaulted to a song at the repository root that
 * `.gitignore` excludes, so `pnpm test` could not pass on a clean tree — which
 * is exactly the tree the weekly cold build checks out, and exactly the
 * failure that build exists to notice rather than to suffer. Skipping the pass
 * outright when the file is absent would be worse than failing: CI would
 * report a pass for a matrix it never ran.
 *
 * What this is for, and what it is NOT for. It carries the shape-safety pass —
 * every profile renders finite, unclipped, un-silent, DC-free audio through the
 * real engine — and that check does not care which programme it is given. It
 * cannot carry the level windows: those say the catalogue is level-neutral
 * against ONE song, tuned against that song's own spectrum, level and
 * dynamics, and `smoke-presets.ts` runs them only when a real file is present.
 * Fitting this generator until it satisfied a bound tuned on a recording would
 * be tuning the evidence to the answer, and it would have to be redone every
 * time the catalogue moved.
 *
 * Two properties are still load-bearing, because a fair source is the point
 * even for a shape check, and neither is obvious:
 *
 * **Every component is tonal.** A noise bed is the obvious way to fill a
 * spectrum and it is the one thing this cannot have, because the Denoise
 * profiles are asserted not to hollow out CLEAN music. Against a source that
 * is partly noise floor they would remove precisely what they are built to
 * remove and fail a check that was right.
 *
 * **The harmonic series is dense and spread.** Six partials on a low triad
 * reached 1.1 kHz and left a forty-decibel hole between 2 and 4 kHz, which is
 * where most of the catalogue works — measured, on an octave-band analysis of
 * the generated file. Sixteen partials at a gentle roll-off plus a spread
 * upper register put it within a few decibels of a pink tilt from 60 Hz to
 * 14 kHz.
 *
 * Deterministic by construction — there is no generator state and no seed, so
 * two machines render the same samples.
 */
import { writeFileSync } from 'fs';


/** One bar of the progression, in seconds. Four bars, then it repeats. */
const BAR_SECONDS = 2.5;

/** Root triads, low enough that sixteen partials each still land in band. */
const CHORDS: readonly (readonly number[])[] = [
  [110.0, 138.59, 164.81],
  [98.0, 123.47, 146.83],
  [87.31, 110.0, 130.81],
  [123.47, 155.56, 185.0],
];

/** The upper register, above where the chord's partial series runs out. */
const TOP_PARTIALS: readonly number[] = [
  2_200, 3_100, 4_400, 6_200, 8_700, 12_300,
];

/**
 * Where the finished file sits, stated as RMS because RMS is what a threshold
 * sees.
 *
 * Normalised by loudness rather than by peak on purpose. Every threshold in the
 * Compressor catalogue is absolute, so the operating point decides whether a
 * profile engages gently or sits five decibels into gain reduction, and a peak
 * normalisation leaves that to whatever crest factor the synthesis happened to
 * produce. -26 dBFS is where the song this stands in for renders.
 */
const TARGET_RMS = 0.05;

/**
 * Soft-clip drive, and it is the number that makes this usable at all.
 *
 * A delivered master has been through a limiter and this has to have been too,
 * or the dynamics are not a listener's dynamics. Together with `BED` it sets
 * the crest factor: 0.9 and 0.55 measure 10.1 dB over the whole file, which is
 * where ordinary music sits. Unshaped the same programme is nearer 15 and
 * squashed at 2.2 it is 5.3.
 *
 * `tanh` rather than anything with memory, because it folds harmonics onto the
 * partials that are already there rather than adding a floor — see the tonal
 * rule at the top of this file.
 */
const DRIVE = 0.9;

/** How much of the chord is held rather than struck — the crest control. */
const BED = 0.55;

const TWO_PI = 2 * Math.PI;

/**
 * A plucked envelope: fast enough to be a transient, long enough to ring.
 *
 * The attack is a rise rather than a step because a step is a click, and a
 * click is broadband — which would put back the noise the tonal rule exists
 * to keep out.
 */
const pluck = (phase: number): number =>
  Math.exp(-phase / 0.28) * (1 - Math.exp(-phase / 0.004));

/** The mastering a real delivery has had, and this needs, to reach 10 dB. */
const shape = (sample: number): number =>
  Math.tanh(DRIVE * sample) / Math.tanh(DRIVE);

/**
 * Write a stereo 16-bit PCM WAV of synthesised programme.
 *
 * Sixteen-bit rather than float because the container is the point: this is
 * fed to the native decoder, and the decoder that reads it is the one the
 * player uses. 44.1 kHz for the same reason — it makes the host resample, the
 * way an actual library does.
 */
export const writeProgrammeFixture = (
  file: string,
  rate = 44_100,
  seconds = 24,
): void => {
  const frames = Math.round(rate * seconds);
  const left = new Float64Array(frames);
  const right = new Float64Array(frames);
  let peak = 0;
  let sumSquared = 0;

  for (let at = 0; at < frames; at += 1) {
    const t = at / rate;
    const chord = CHORDS[Math.floor(t / BAR_SECONDS) % CHORDS.length];
    // Notes retrigger twice a second, so every render window holds several
    // attacks — a compressor or a transient stage measured over a single
    // sustained note is measured on the one thing it does not act on.
    const notePhase = t % 0.5;
    const envelope = pluck(notePhase);
    // A held bed under the plucks. Without it the programme is silent between
    // attacks, which is what put the crest factor at 15 dB and every profile
    // outside its window.
    const bed = 0.75 + 0.25 * Math.sin(TWO_PI * 0.37 * t);
    let mix = 0;
    let spread = 0;
    for (let note = 0; note < chord.length; note += 1) {
      const frequency = chord[note];
      // Panned by note so the chord is wide without being decorrelated: a
      // width stage needs a difference between the channels to work on, and
      // an anti-correlated source would make every one of them read as a fold
      // rather than as a spread.
      const pan = (note - 1) * 0.45;
      let voice = 0;
      for (let partial = 1; partial <= 16; partial += 1) {
        // Sixteen partials at a gentle roll-off rather than six at a steep
        // one. Six reached 1.1 kHz and left a forty-decibel hole from 2 to
        // 4 kHz, which is the region most of the catalogue works in — so every
        // bass-boosting profile measured three or four decibels of gain that
        // real music spreads across a full spectrum, and left its window.
        voice +=
          Math.sin(TWO_PI * frequency * partial * t) / partial ** 0.9;
      }
      voice *= BED * bed + (1 - BED) * envelope;
      mix += voice;
      spread += voice * pan;
    }

    // Low end on the beat, for the two bass stages and the crossover they
    // share. One second apart so it is never masked by its own tail.
    const kickPhase = t % 1.0;
    const kick = Math.exp(-kickPhase / 0.1) * Math.sin(TWO_PI * 55.0 * kickPhase);

    // Top end, tonal rather than a noise burst for the same reason everything
    // else here is, and spread from 2.2 to 12 kHz rather than clustered above
    // 6: the partial series above runs out around 3 kHz, and the octave
    // between them is where a treble profile is judged. Part struck and part
    // held, so the region is not purely percussive.
    const topPhase = (t + 0.25) % 0.5;
    const topEnvelope = 0.25 + 0.75 * Math.exp(-topPhase / 0.06);
    let top = 0;
    for (let partial = 0; partial < TOP_PARTIALS.length; partial += 1) {
      top +=
        Math.sin(TWO_PI * TOP_PARTIALS[partial] * t) /
        (partial + 1) ** 0.5;
    }
    top *= topEnvelope;

    const centre = 0.3 * mix + 0.25 * kick + 0.16 * top;
    left[at] = shape(centre - 0.32 * spread - 0.02 * top);
    right[at] = shape(centre + 0.32 * spread + 0.02 * top);
    peak = Math.max(peak, Math.abs(left[at]), Math.abs(right[at]));
    sumSquared += left[at] * left[at] + right[at] * right[at];
  }

  const gain = TARGET_RMS / Math.sqrt(sumSquared / Math.max(1, frames * 2));
  if (peak * gain >= 1) {
    throw new Error('programme fixture: normalised past full scale');
  }
  const data = Buffer.alloc(frames * 4);
  for (let at = 0; at < frames; at += 1) {
    data.writeInt16LE(Math.round(left[at] * gain * 32_767), at * 4);
    data.writeInt16LE(Math.round(right[at] * gain * 32_767), at * 4 + 2);
  }

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(2, 22);
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
};
