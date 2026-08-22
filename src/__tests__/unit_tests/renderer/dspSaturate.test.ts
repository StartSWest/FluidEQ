/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createSaturator,
  fuzzDrive,
  saturateBlock,
  saturateSample,
} from '../../../renderer/dsp/saturate';

const SIZE = 2_048;
/** Low enough that its harmonics have room, for the "does it colour" tests. */
const BIN = 64;

const sine = (bin: number, amplitude = 0.5): Float32Array => {
  const out = new Float32Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) {
    out[i] = Math.sin((2 * Math.PI * bin * i) / SIZE) * amplitude;
  }
  return out;
};

/** One bin of a DFT. Enough to ask "is there energy at this frequency". */
const magnitudeAt = (signal: Float32Array, bin: number): number => {
  let real = 0;
  let imaginary = 0;
  for (let i = 0; i < SIZE; i += 1) {
    const angle = (2 * Math.PI * bin * i) / SIZE;
    real += signal[i] * Math.cos(angle);
    imaginary -= signal[i] * Math.sin(angle);
  }
  return (2 * Math.hypot(real, imaginary)) / SIZE;
};

const saturated = (input: Float32Array, drive: number): Float32Array => {
  const state = createSaturator(SIZE);
  const target = Float32Array.from(input);
  saturateBlock(state, target, drive);
  return target;
};

describe('the saturation stage', () => {
  it('adds harmonics that were not in the signal', () => {
    const input = sine(BIN);
    // NULL side: the input genuinely has nothing at the third harmonic, so
    // finding it afterwards means it was manufactured rather than passed. The
    // floor is 1e-7 rather than zero because the signal is Float32 and its own
    // rounding shows up at about 4e-9 — still four orders below what the
    // saturation puts there.
    expect(magnitudeAt(input, BIN * 3)).toBeLessThan(1e-7);
    expect(magnitudeAt(saturated(input, 4), BIN * 3)).toBeGreaterThan(1e-3);
  });

  /**
   * Even harmonics are the point of the asymmetry.
   *
   * A symmetric curve produces odd harmonics only. Warmth is the even ones, so
   * their absence would mean the offset had been lost and the character with
   * it.
   */
  it('produces even harmonics as well as odd', () => {
    const output = saturated(sine(BIN), 4);
    expect(magnitudeAt(output, BIN * 2)).toBeGreaterThan(1e-4);
    expect(magnitudeAt(output, BIN * 3)).toBeGreaterThan(1e-3);
  });

  it('colours more as it is driven harder', () => {
    const gentle = magnitudeAt(saturated(sine(BIN), 1.5), BIN * 3);
    const hard = magnitudeAt(saturated(sine(BIN), 8), BIN * 3);
    expect(hard).toBeGreaterThan(gentle * 2);
  });

  it('returns silence for silence', () => {
    // The offset would leave a DC step behind if it were not subtracted back
    // out, and a constant on the output is a click on every settings change.
    const quiet = saturated(new Float32Array(SIZE), 4);
    expect(Math.max(...Array.from(quiet).map(Math.abs))).toBeLessThan(1e-6);
  });

  /**
   * The reason the whole oversampler exists.
   *
   * A tone above a sixth of the sample rate has its third harmonic land past
   * Nyquist, and at the session rate that harmonic FOLDS BACK to `SIZE - 3*bin`
   * as an inharmonic tone that was never in the music. Oversampling puts the
   * fold-back point an octave higher, so it does not happen in the audible
   * result.
   */
  describe('aliasing', () => {
    const HIGH = 420;
    const foldedBin = SIZE - HIGH * 3;

    it('CONTROL: the same curve at the session rate does fold', () => {
      // Applied sample by sample with no oversampling, which is what the naive
      // version of this stage would be.
      const input = sine(HIGH);
      const naive = Float32Array.from(input, (value) =>
        saturateSample(value, 8),
      );
      expect(magnitudeAt(naive, foldedBin)).toBeGreaterThan(1e-3);
    });

    it('does not fold that harmonic back into the audible band', () => {
      const output = saturated(sine(HIGH), 8);
      const naive = Float32Array.from(sine(HIGH), (value) =>
        saturateSample(value, 8),
      );
      // Not zero — 2x cannot remove everything — but far below the naive path,
      // which is the claim being made.
      expect(magnitudeAt(output, foldedBin)).toBeLessThan(
        magnitudeAt(naive, foldedBin) / 8,
      );
    });
  });
});

/**
 * The dial has to stay colour and never become distortion.
 *
 * Reported as "it sounds like distortion, I want it fine". The cause was the
 * mapping rather than the curve: full scale drove it to 4, where the measured
 * third harmonic is 16.4% against a second of 6.5%. ODD harmonics overtaking
 * even ones is what the ear reads as grit, so the fix is a range where the
 * balance stays even-dominant throughout.
 */
describe('the fuzz dial', () => {
  const harmonics = (amount: number) => {
    const drive = fuzzDrive(amount);
    const input = sine(BIN);
    const out = Float32Array.from(input, (value) =>
      saturateSample(value, drive),
    );
    const fundamental = magnitudeAt(out, BIN);
    return {
      second: (magnitudeAt(out, BIN * 2) / fundamental) * 100,
      third: (magnitudeAt(out, BIN * 3) / fundamental) * 100,
    };
  };

  it('stays inside colour at full scale', () => {
    const { second, third } = harmonics(1);
    // Roughly 2.2% and 0.5% — the top of what analogue equipment adds, and an
    // order below the 16% the first attempt reached.
    expect(second).toBeLessThan(3);
    expect(third).toBeLessThan(1);
  });

  it('keeps the even harmonics dominant, which is what warmth is', () => {
    [0.25, 0.5, 1].forEach((amount) => {
      const { second, third } = harmonics(amount);
      expect(second).toBeGreaterThan(third * 3);
    });
  });

  it('is genuinely fine at the bottom of its travel', () => {
    // A quarter turn is under a tenth of a percent — present but not audible
    // as an effect, which is the whole point of the squared curve.
    expect(harmonics(0.25).second).toBeLessThan(0.2);
  });

  it('NULL TEST: zero is silence-clean', () => {
    expect(fuzzDrive(0)).toBe(0);
  });
});
