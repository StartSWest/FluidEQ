/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../../common/constants';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
  createBiquadState,
  processBiquad,
} from '../../../renderer/dsp/biquad';

const RATE = 48_000;

const at = (
  spec: Parameters<typeof biquadCoefficients>[0],
  frequency: number,
  rate = RATE,
): number => biquadMagnitudeDb(biquadCoefficients(spec, rate), frequency, rate);

const bell = (frequency: number, gainDb: number, quality = 1) => ({
  type: FilterTypeEnum.PK,
  frequency,
  gainDb,
  quality,
});

describe('biquad response', () => {
  it('puts a bell’s full gain at its own centre', () => {
    expect(at(bell(1_000, 6), 1_000)).toBeCloseTo(6, 2);
  });

  it('leaves a bell’s gain behind well away from it', () => {
    expect(at(bell(1_000, 6), 40)).toBeCloseTo(0, 1);
    expect(at(bell(1_000, 6), 18_000)).toBeCloseTo(0, 1);
  });

  it('cuts as accurately as it boosts', () => {
    expect(at(bell(1_000, -9), 1_000)).toBeCloseTo(-9, 2);
  });

  /**
   * NULL TEST: a band with no gain is not a filter.
   *
   * A peaking biquad at 0 dB must be flat everywhere, not merely flat at its
   * centre — the coefficients reduce to a pure pass-through.
   */
  it('NULL TEST: a bell at 0 dB is flat across the band', () => {
    [20, 200, 2_000, 12_000, 20_000].forEach((frequency) => {
      expect(at(bell(3_000, 0), frequency)).toBeCloseTo(0, 6);
    });
  });

  it('POSITIVE CONTROL: the same band with gain is not flat', () => {
    expect(Math.abs(at(bell(3_000, 6), 3_000))).toBeGreaterThan(5);
  });

  it('narrows as Q rises', () => {
    const wide = at(bell(1_000, 12, 0.7), 1_400);
    const narrow = at(bell(1_000, 12, 6), 1_400);
    expect(narrow).toBeLessThan(wide);
  });

  it('places a shelf’s full gain past its corner', () => {
    const low = {
      type: FilterTypeEnum.LSC,
      frequency: 200,
      gainDb: 6,
      quality: 0.7,
    };
    expect(at(low, 20)).toBeCloseTo(6, 1);
    expect(at(low, 10_000)).toBeCloseTo(0, 1);
  });

  it('passes a low pass below its corner and stops it above', () => {
    const low = {
      type: FilterTypeEnum.LPQ,
      frequency: 1_000,
      gainDb: 0,
      quality: 0.7,
    };
    expect(at(low, 100)).toBeCloseTo(0, 1);
    expect(at(low, 10_000)).toBeLessThan(-30);
  });

  it('takes a notch to the floor at its centre', () => {
    const notch = {
      type: FilterTypeEnum.NO,
      frequency: 1_000,
      gainDb: 0,
      quality: 8,
    };
    expect(at(notch, 1_000)).toBeLessThan(-40);
    expect(at(notch, 200)).toBeCloseTo(0, 1);
  });
});

/**
 * How far the cookbook drifts near Nyquist, measured rather than asserted.
 *
 * The bilinear transform that turns an analogue prototype into a biquad warps
 * the frequency axis: the whole infinite analogue range is squeezed into the
 * finite digital one, and the squeeze is worst approaching Nyquist. A bell
 * asked for at 16 kHz on a 44.1 kHz stream is not the bell that was asked for.
 *
 * These tests do not assert the drift is acceptable. They record what it IS,
 * so that when the roadmap's Orfanidis correction lands, the improvement is a
 * number rather than an opinion — and so that anyone reading knows the current
 * EQ is honest below roughly 10 kHz and approximate above it.
 */
describe('cookbook accuracy near Nyquist', () => {
  const CD = 44_100;

  it('is exact at the centre well below Nyquist', () => {
    expect(at(bell(1_000, 6), 1_000, CD)).toBeCloseTo(6, 3);
  });

  /**
   * The centre gain survives; the SHAPE around it does not.
   *
   * A bell's skirts are what warping distorts, and the measure of that is how
   * much of the requested gain is left an octave away on each side. Down at
   * 1 kHz the two sides match to within 0.01 dB. Up at 16 kHz they do not,
   * because Nyquist is barely half an octave above and the response is forced
   * flat there.
   *
   * **Measured at 0.60 dB, not the "well over a decibel" the roadmap assumed.**
   * Worth stating precisely: it is a real asymmetry and it is smaller than
   * eyeballing the maths suggested. The shelf below is the case that actually
   * hurts.
   */
  it('loses its symmetry once Nyquist is within an octave', () => {
    const lowBand = bell(1_000, 6);
    const lowAsymmetry = Math.abs(
      at(lowBand, 500, CD) - at(lowBand, 2_000, CD),
    );
    expect(lowAsymmetry).toBeLessThan(0.02);

    const highBand = bell(16_000, 6);
    const highAsymmetry = Math.abs(
      at(highBand, 8_000, CD) - at(highBand, 22_049, CD),
    );
    expect(highAsymmetry).toBeCloseTo(0.6, 1);
    expect(highAsymmetry).toBeGreaterThan(lowAsymmetry * 20);
  });

  /**
   * The one number worth quoting: a high shelf cannot reach its own gain.
   *
   * The cookbook forces a shelf's response to flatten at Nyquist, so a shelf
   * placed high has nowhere left to rise. Asked for +6 dB at 16 kHz on a
   * 44.1 kHz stream, this is what it actually delivers at 20 kHz.
   */
  it('under-delivers a high shelf placed close to Nyquist', () => {
    const shelf = {
      type: FilterTypeEnum.HSC,
      frequency: 16_000,
      gainDb: 6,
      quality: 0.7,
    };
    const delivered = at(shelf, 20_000, CD);
    expect(delivered).toBeLessThan(6);
    expect(delivered).toBeGreaterThan(3);
  });
});

describe('biquad processing', () => {
  const impulse = (length: number): Float32Array => {
    const out = new Float32Array(length);
    out[0] = 1;
    return out;
  };

  it.each([
    FilterTypeEnum.PK,
    FilterTypeEnum.NO,
    FilterTypeEnum.LSC,
    FilterTypeEnum.HSC,
    FilterTypeEnum.LPQ,
    FilterTypeEnum.HPQ,
    FilterTypeEnum.BP,
  ])(
    'keeps %s stable when a preset corner reaches or exceeds Nyquist',
    (type) => {
      [16_000, 18_500, 20_000].forEach((frequency) => {
        const coefficients = biquadCoefficients(
          { type, frequency, gainDb: 6, quality: 0.707 },
          32_000,
        );
        // The second-order stability inequalities fail before a pole outside
        // the unit circle can turn a short impulse into sustained distortion.
        expect(1 + coefficients.a1 + coefficients.a2).toBeGreaterThan(0);
        expect(1 - coefficients.a1 + coefficients.a2).toBeGreaterThan(0);
        expect(1 - coefficients.a2).toBeGreaterThan(0);
        const signal = impulse(32_000);
        processBiquad(createBiquadState(), signal, coefficients);
        expect(signal.every(Number.isFinite)).toBe(true);
        expect(
          signal.subarray(30_000).every((value) => Math.abs(value) < 1e-5),
        ).toBe(true);
      });
    },
  );

  it('still passes programme below an out-of-band low-pass corner', () => {
    const signal = impulse(32_000);
    processBiquad(
      createBiquadState(),
      signal,
      biquadCoefficients(
        {
          type: FilterTypeEnum.LPQ,
          frequency: 18_500,
          gainDb: 0,
          quality: 0.707,
        },
        32_000,
      ),
    );
    expect(signal[0]).toBeGreaterThan(0.9);
  });

  /**
   * The processed signal has to match the response the coefficients describe,
   * or `biquadMagnitudeDb` is measuring something the audio path does not do.
   */
  it('produces the gain its own magnitude function predicts', () => {
    const spec = bell(1_000, 6, 2);
    const coefficients = biquadCoefficients(spec, RATE);
    const length = 8_192;
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      signal[i] = Math.sin((2 * Math.PI * 1_000 * i) / RATE);
    }
    processBiquad(createBiquadState(), signal, coefficients);
    // Measure after the filter has settled.
    const settled = signal.subarray(4_096);
    const peak = settled.reduce((high, v) => Math.max(high, Math.abs(v)), 0);
    expect(20 * Math.log10(peak)).toBeCloseTo(6, 1);
  });

  it('NULL TEST: a 0 dB bell returns the signal unchanged', () => {
    const signal = impulse(64);
    const before = Float32Array.from(signal);
    processBiquad(
      createBiquadState(),
      signal,
      biquadCoefficients(bell(1_000, 0), RATE),
    );
    signal.forEach((value, index) => {
      expect(value).toBeCloseTo(before[index], 6);
    });
  });

  it('is stable: a high-Q filter low down decays rather than runs away', () => {
    const signal = impulse(48_000);
    processBiquad(
      createBiquadState(),
      signal,
      biquadCoefficients(bell(30, 12, 8), RATE),
    );
    const tail = signal.subarray(40_000);
    tail.forEach((value) => {
      expect(Number.isFinite(value)).toBe(true);
      expect(Math.abs(value)).toBeLessThan(0.01);
    });
  });
});
