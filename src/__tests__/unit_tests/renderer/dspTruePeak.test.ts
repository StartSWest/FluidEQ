/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createTruePeakState, truePeak } from '../../../renderer/dsp/truePeak';
import { oversampleFactorForSampleRate } from '../../../renderer/dsp/oversample';

const RATE = 48_000;

const samplePeak = (signal: Float32Array): number =>
  signal.reduce((highest, value) => Math.max(highest, Math.abs(value)), 0);

const tone = (hz: number, length: number, phase = 0): Float32Array => {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    out[i] = Math.sin((2 * Math.PI * hz * i) / RATE + phase);
  }
  return out;
};

const measure = (signal: Float32Array): number =>
  truePeak(createTruePeakState(), signal);

describe('true peak', () => {
  it('caps internal interpolation at 192 kHz without changing the session rate', () => {
    expect(
      [44_100, 48_000, 88_200, 96_000, 176_400, 192_000].map(
        oversampleFactorForSampleRate,
      ),
    ).toEqual([4, 4, 2, 2, 1, 1]);
  });

  /**
   * The measurement this whole file exists for.
   *
   * A tone at exactly a quarter of the sample rate, offset so no sample lands
   * on a crest, sits well below full scale in its samples and reaches full
   * scale between them. That gap is what a converter reconstructs, what a
   * resampler clips, and what every streaming service's meter reports — and
   * what a sample-peak limiter is blind to.
   */
  it('sees a peak the samples miss', () => {
    const signal = tone(12_000, 4_096, Math.PI / 4);
    const samples = samplePeak(signal);
    expect(samples).toBeLessThan(0.72);
    expect(measure(signal)).toBeGreaterThan(0.95);
  });

  /**
   * NULL TEST: nothing is invented where there is nothing between the samples.
   *
   * DC has no inter-sample motion at all, so once the filter has settled its
   * true peak IS the sample peak. A filter whose taps did not sum to one would
   * read something else here, and the test above would be measuring its own
   * gain error rather than a real inter-sample peak.
   *
   * The first block is skipped, and that is the filter rather than the code: a
   * FIR starts with a window full of zeros, so while it fills, the negative
   * taps are multiplying nothing while the positive ones are multiplying
   * signal, and the sum briefly overshoots — measured at 0.558 against a 0.5
   * input. It lasts twelve samples, a quarter of a millisecond, once per
   * stream. The crossover's tests skip their own settling for the same reason.
   */
  it('NULL TEST: reads a constant signal at its own level once settled', () => {
    const state = createTruePeakState();
    truePeak(state, new Float32Array(64).fill(0.5));
    expect(truePeak(state, new Float32Array(2_048).fill(0.5))).toBeCloseTo(
      0.5,
      3,
    );
  });

  it('is never below the sample peak', () => {
    [
      tone(1_000, 2_048),
      tone(7_000, 2_048),
      tone(19_000, 2_048, 0.9),
      new Float32Array(2_048).fill(-0.3),
    ].forEach((signal) => {
      // Skip the filter's own start-up, where the history is still filling.
      const settled = signal.subarray(64);
      expect(measure(signal)).toBeGreaterThanOrEqual(
        samplePeak(settled) - 1e-3,
      );
    });
  });

  it('reads silence as silence', () => {
    expect(measure(new Float32Array(512))).toBeCloseTo(0, 6);
  });

  /**
   * The reason this carries state rather than being a pure function.
   *
   * A peak straddling a block boundary must not be lost: the filter needs the
   * samples before the boundary to interpolate across it. Fed in two halves,
   * the answer has to match feeding it whole.
   */
  it('finds the same peak across a block boundary as in one pass', () => {
    const signal = tone(12_000, 2_048, Math.PI / 4);
    const whole = measure(signal);

    const state = createTruePeakState();
    const first = truePeak(state, signal.subarray(0, 1_024));
    const second = truePeak(state, signal.subarray(1_024));
    expect(Math.max(first, second)).toBeCloseTo(whole, 3);
  });

  /**
   * POSITIVE CONTROL for the boundary test.
   *
   * A fresh state on the second half cannot see across the seam, so it must
   * differ — otherwise the test above would pass even if the state were doing
   * nothing at all.
   */
  it('POSITIVE CONTROL: a discarded history loses the samples before the seam', () => {
    const signal = tone(12_000, 2_048, Math.PI / 4);
    const carried = createTruePeakState();
    truePeak(carried, signal.subarray(0, 1_024));
    const withHistory = truePeak(carried, signal.subarray(1_024, 1_040));
    const withoutHistory = truePeak(
      createTruePeakState(),
      signal.subarray(1_024, 1_040),
    );
    expect(withHistory).not.toBeCloseTo(withoutHistory, 3);
  });
});
