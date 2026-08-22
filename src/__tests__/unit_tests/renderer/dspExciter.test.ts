/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { separationFft } from '../../../common/karaoke/separationDsp';
import { buildShaperCurve } from '../../../renderer/dsp/exciter';

const SIZE = 2_048;
/** Period-locked, so the fundamental lands in exactly one bin and leaks none. */
const BIN = 64;

const sine = (): Float64Array => {
  const out = new Float64Array(SIZE);
  for (let i = 0; i < SIZE; i += 1) {
    out[i] = Math.sin((2 * Math.PI * BIN * i) / SIZE) * 0.5;
  }
  return out;
};

/** Push a signal through a shaper curve the way a WaveShaperNode does. */
const shape = (input: Float64Array, curve: Float32Array): Float64Array => {
  const out = new Float64Array(input.length);
  const last = curve.length - 1;
  for (let i = 0; i < input.length; i += 1) {
    const position = ((Math.max(-1, Math.min(1, input[i])) + 1) / 2) * last;
    const lower = Math.floor(position);
    const upper = Math.min(last, lower + 1);
    const fraction = position - lower;
    out[i] = curve[lower] * (1 - fraction) + curve[upper] * fraction;
  }
  return out;
};

const magnitudeAt = (signal: Float64Array, bin: number): number => {
  const real = Float64Array.from(signal);
  const imaginary = new Float64Array(signal.length);
  separationFft(real, imaginary, false);
  return Math.hypot(real[bin], imaginary[bin]) / signal.length;
};

/**
 * The identity curve is the control this whole file depends on.
 *
 * A null test alone cannot tell "the shaper generated no harmonics" from "the
 * measurement is broken and would report nothing whatever it was fed". Running
 * a curve that provably CANNOT generate harmonics through the same harness,
 * and requiring it to come back clean while the real curve does not, is what
 * separates those two. The separation packing bug passed a perfect-looking
 * null test by returning zero for every input; this is that lesson applied.
 */
const identityCurve = (): Float32Array => {
  const curve = new Float32Array(1_024);
  for (let i = 0; i < curve.length; i += 1) {
    curve[i] = (i / (curve.length - 1)) * 2 - 1;
  }
  return curve;
};

describe('exciter shaper curve', () => {
  it('POSITIVE CONTROL: an identity curve passes the fundamental and makes no harmonic', () => {
    const output = shape(sine(), identityCurve());
    expect(magnitudeAt(output, BIN)).toBeGreaterThan(0.2);
    expect(magnitudeAt(output, BIN * 3)).toBeLessThan(1e-3);
  });

  it('generates a third harmonic that was not in the input', () => {
    const input = sine();
    expect(magnitudeAt(input, BIN * 3)).toBeLessThan(1e-9);
    const output = shape(input, buildShaperCurve(6));
    expect(magnitudeAt(output, BIN * 3)).toBeGreaterThan(1e-2);
  });

  it('generates more harmonic energy as drive rises', () => {
    const gentle = magnitudeAt(shape(sine(), buildShaperCurve(2)), BIN * 3);
    const hard = magnitudeAt(shape(sine(), buildShaperCurve(9)), BIN * 3);
    expect(hard).toBeGreaterThan(gentle);
  });

  /**
   * Odd harmonics only, because the curve is symmetric.
   *
   * Asserted rather than assumed: an accidental asymmetry would add even
   * harmonics, which read as warmth in the low mids rather than as air, and
   * on a stage fed only the top octaves that is the wrong colour entirely.
   */
  it('makes odd harmonics and not even ones', () => {
    const output = shape(sine(), buildShaperCurve(6));
    expect(magnitudeAt(output, BIN * 2)).toBeLessThan(1e-3);
    expect(magnitudeAt(output, BIN * 3)).toBeGreaterThan(1e-2);
  });

  it('spans the full range at every drive, so drive changes colour not level', () => {
    [1, 5, 10].forEach((drive) => {
      const curve = buildShaperCurve(drive);
      expect(curve[curve.length - 1]).toBeCloseTo(1, 6);
      expect(curve[0]).toBeCloseTo(-1, 6);
    });
  });

  it('never leaves the -1..1 range a WaveShaper expects', () => {
    buildShaperCurve(10).forEach((value) => {
      expect(Math.abs(value)).toBeLessThanOrEqual(1);
    });
  });
});
