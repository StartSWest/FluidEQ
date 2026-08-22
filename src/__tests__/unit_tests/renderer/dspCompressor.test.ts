/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBandSettings } from '../../../common/dsp/chain';
import {
  createCrossoverState,
  splitBands,
} from '../../../renderer/dsp/crossover';
import {
  createCompressorState,
  processBand,
} from '../../../renderer/dsp/compressor';

const RATE = 48_000;
const CORNERS: readonly [number, number] = [200, 3_000];

/** Long enough for the biquads to settle before anything is compared. */
const SETTLED = 1_024;

const signal = (length: number): Float32Array => {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.sin(i / 3) * 0.3 + Math.sin(i / 40) * 0.3;
  }
  return out;
};

describe('linkwitz-riley crossover', () => {
  /**
   * The property no listening test could have caught.
   *
   * Independent lowpass and highpass filters each add their own phase shift
   * and their sum notches at the corner — about a decibel, which nobody
   * reports as a bug because it does not sound like one. It sounds like the
   * music being thin, and the compressor after it gets the blame.
   */
  it('sums its three bands back to the input, sample for sample', () => {
    const input = signal(4_096);
    const low = new Float32Array(input.length);
    const mid = new Float32Array(input.length);
    const high = new Float32Array(input.length);
    splitBands(createCrossoverState(), input, low, mid, high, CORNERS, RATE);
    for (let i = SETTLED; i < input.length; i += 1) {
      expect(low[i] + mid[i] + high[i]).toBeCloseTo(input[i], 5);
    }
  });

  /**
   * POSITIVE CONTROL for the reconstruction test above.
   *
   * A `splitBands` that put the whole input in `low` and zeroed the other two
   * would reconstruct perfectly and split nothing at all. This requires every
   * band to carry energy and none of them to be a copy of the input.
   *
   * It deliberately does NOT assert that a band holds less energy than the
   * input. That is not a property of a subtractive crossover: near a corner
   * the residual `sample - lowpassed` sums in phase with the original and the
   * band genuinely exceeds it. Asserting otherwise failed here on a test
   * signal whose two components sat at 191Hz and 2546Hz — right on the 200
   * and 3000 corners — and the assertion was wrong, not the crossover.
   */
  it('POSITIVE CONTROL: every band carries signal and none is a copy of the input', () => {
    const input = signal(4_096);
    const low = new Float32Array(input.length);
    const mid = new Float32Array(input.length);
    const high = new Float32Array(input.length);
    splitBands(createCrossoverState(), input, low, mid, high, CORNERS, RATE);
    const energy = (band: Float32Array): number =>
      band.subarray(SETTLED).reduce((sum, value) => sum + value * value, 0);
    const distance = (band: Float32Array): number =>
      band
        .subarray(SETTLED)
        .reduce(
          (sum, value, index) => sum + (value - input[SETTLED + index]) ** 2,
          0,
        );

    [low, mid, high].forEach((band) => {
      expect(energy(band)).toBeGreaterThan(0);
      expect(distance(band)).toBeGreaterThan(energy(input) * 0.01);
    });
  });

  it('puts a low tone in the low band and a high tone in the high band', () => {
    const tone = (hz: number): Float32Array => {
      const out = new Float32Array(8_192);
      for (let i = 0; i < out.length; i += 1) {
        out[i] = Math.sin((2 * Math.PI * hz * i) / RATE) * 0.5;
      }
      return out;
    };
    const peakOf = (band: Float32Array): number =>
      band
        .subarray(4_096)
        .reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);

    const bands = () => [
      new Float32Array(8_192),
      new Float32Array(8_192),
      new Float32Array(8_192),
    ];

    const [lowA, midA, highA] = bands();
    splitBands(
      createCrossoverState(),
      tone(50),
      lowA,
      midA,
      highA,
      CORNERS,
      RATE,
    );
    expect(peakOf(lowA)).toBeGreaterThan(peakOf(highA));

    const [lowB, midB, highB] = bands();
    splitBands(
      createCrossoverState(),
      tone(10_000),
      lowB,
      midB,
      highB,
      CORNERS,
      RATE,
    );
    expect(peakOf(highB)).toBeGreaterThan(peakOf(lowB));
  });
});

describe('band compressor', () => {
  const SETTINGS: IBandSettings = {
    thresholdDb: -20,
    ratio: 4,
    attackMs: 1,
    releaseMs: 50,
    makeupDb: 0,
  };

  it('NULL TEST: a signal below threshold passes through unchanged', () => {
    const buffer = new Float32Array(2_048).fill(0.01);
    const before = Float32Array.from(buffer);
    processBand(createCompressorState(), buffer, SETTINGS, RATE);
    buffer.forEach((value, index) => {
      expect(value).toBeCloseTo(before[index], 6);
    });
  });

  /**
   * Without this the null test above is satisfied by doing nothing at all.
   */
  it('POSITIVE CONTROL: a signal above threshold is turned down', () => {
    const buffer = new Float32Array(2_048).fill(0.5);
    processBand(createCompressorState(), buffer, SETTINGS, RATE);
    expect(buffer[2_000]).toBeLessThan(0.4);
    expect(buffer[2_000]).toBeGreaterThan(0);
  });

  it('reduces a louder signal more than a quieter one', () => {
    const at = (level: number): number => {
      const buffer = new Float32Array(2_048).fill(level);
      processBand(createCompressorState(), buffer, SETTINGS, RATE);
      return level / buffer[2_000];
    };
    expect(at(0.8)).toBeGreaterThan(at(0.2));
  });

  it('makeup gain lifts a band that is not being compressed', () => {
    const buffer = new Float32Array(2_048).fill(0.01);
    processBand(
      createCompressorState(),
      buffer,
      { ...SETTINGS, makeupDb: 6 },
      RATE,
    );
    expect(buffer[2_000]).toBeCloseTo(0.01 * 10 ** (6 / 20), 5);
  });

  it('a ratio of 1 changes nothing however loud the input', () => {
    const buffer = new Float32Array(2_048).fill(0.9);
    processBand(
      createCompressorState(),
      buffer,
      { ...SETTINGS, ratio: 1 },
      RATE,
    );
    expect(buffer[2_000]).toBeCloseTo(0.9, 5);
  });
});
