/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  SEPARATION_CHUNK_SAMPLES,
  SEPARATION_FFT_SIZE,
  SEPARATION_FRAMES,
  SEPARATION_FREQ_BINS,
  SEPARATION_HOP,
  SEPARATION_PACKED_ROWS,
  SEPARATION_SAMPLE_RATE,
  SEPARATION_STEP_SAMPLES,
  separationApplyMask,
  separationHannWindow,
  separationIstft,
  separationNormalisationGain,
  separationPackedRow,
  separationStft,
} from 'common/karaoke/separationDsp';

/** Peak and RMS of a signal, in dBFS, for stating results the way audio is. */
const level = (samples: Float64Array) => {
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
    sum += samples[i] * samples[i];
  }
  const decibels = (value: number) =>
    value > 0 ? 20 * Math.log10(value) : -Infinity;
  return {
    peak: decibels(peak),
    rms: decibels(Math.sqrt(sum / Math.max(1, samples.length))),
  };
};

/** Broadband content: a sweep, noise and a click, so no bin stays empty. */
const testSignal = (length: number) => {
  const samples = new Float64Array(length);
  let seed = 12345;
  // A fixed generator rather than Math.random, so a failure here is always the
  // same failure and can be re-run. Modulo instead of a mask keeps it readable
  // without a bitwise exemption.
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 0x7fffffff;
    return seed / 0x7fffffff - 0.5;
  };
  for (let i = 0; i < length; i += 1) {
    const seconds = i / SEPARATION_SAMPLE_RATE;
    samples[i] =
      0.4 * Math.sin(2 * Math.PI * (200 + (3000 * seconds) / 11) * seconds) +
      0.1 * random() +
      (i % SEPARATION_SAMPLE_RATE === 0 ? 0.5 : 0);
  }
  return samples;
};

/**
 * The transform contract the separation model was trained with.
 *
 * None of this is arrived at by reasoning — every constant is a number baked
 * into the exported graph, and getting one wrong produces no error at all, just
 * a mask computed for a spectrogram that was never supplied. The symptom is
 * audio that sounds slightly wrong, which is exactly the kind of defect that
 * survives review. So each expectation below states the consequence.
 */
describe('the vocal separation transform', () => {
  it('produces exactly the tensor shape the model declares', () => {
    // The exported graph has no dynamic axis: its input is [1, 2050, 1101, 2].
    // A mismatch here is a hard failure at inference rather than bad audio,
    // but it is worth pinning so a "harmless" constant change is caught here.
    expect(SEPARATION_FREQ_BINS).toBe(1025);
    expect(SEPARATION_PACKED_ROWS).toBe(2050);
    expect(SEPARATION_FRAMES).toBe(1101);
    expect(SEPARATION_FFT_SIZE / 2 + 1).toBe(SEPARATION_FREQ_BINS);
  });

  it('covers 11.01 seconds per inference and steps by exactly 800 hops', () => {
    // The step has to land on a hop boundary. If it does not, every chunk after
    // the first starts mid-frame and the overlap-add cross-fades two signals
    // that disagree about where the frames are.
    expect(SEPARATION_CHUNK_SAMPLES).toBe(485_100);
    expect(SEPARATION_CHUNK_SAMPLES / SEPARATION_SAMPLE_RATE).toBeCloseTo(
      11,
      2,
    );
    expect(SEPARATION_STEP_SAMPLES % SEPARATION_HOP).toBe(0);
    expect(SEPARATION_STEP_SAMPLES / SEPARATION_HOP).toBe(800);
    // Chunks must overlap, or the model's weak edges meet and seam.
    expect(SEPARATION_STEP_SAMPLES).toBeLessThan(SEPARATION_CHUNK_SAMPLES);
  });

  it('interleaves the packed tensor as 2 * bin + channel', () => {
    // Channel-major was tried here and is wrong, though it passed a test that
    // looked far stronger than this one: on a vocal-free instrumental it
    // suppressed by 52 dB against interleaved's 4 dB. It was not separating —
    // it returns near-zero for every input, and a vocal-free file cannot tell
    // that apart from a perfect job. On a real mix, interleaved gives a vocal
    // stem at -18 dB RMS and channel-major gives -45 dB.
    //
    // The pair of adjacent rows per bin is the whole point: left and right sit
    // next to each other so the network sees the two channels of one frequency
    // together.
    expect(separationPackedRow(0, 0)).toBe(0);
    expect(separationPackedRow(1, 0)).toBe(1);
    expect(separationPackedRow(0, 1)).toBe(2);
    expect(separationPackedRow(1, 1024)).toBe(2049);
    // Every row is used exactly once.
    const rows = new Set<number>();
    for (let channel = 0; channel < 2; channel += 1) {
      for (let bin = 0; bin < SEPARATION_FREQ_BINS; bin += 1) {
        rows.add(separationPackedRow(channel, bin));
      }
    }
    expect(rows.size).toBe(SEPARATION_PACKED_ROWS);
  });

  it('normalises only a signal that exceeds full scale', () => {
    // Loud masters decode above +/-1.0 and the model was not trained there.
    // The track this was measured on peaked at 1.42.
    const hot = Float64Array.from([0, 1.42, -1.1]);
    expect(separationNormalisationGain(hot, hot)).toBeCloseTo(1 / 1.42, 12);
    // Anything already in range is left exactly alone rather than lifted to
    // full scale, which would change the level of the stems.
    const quiet = Float64Array.from([0, 0.2, -0.3]);
    expect(separationNormalisationGain(quiet, quiet)).toBe(1);
  });

  it('uses a periodic Hann window rather than the symmetric one', () => {
    // They differ in one sample, and this is the only test that sees it. The
    // round trip below cannot: its inverse divides by the summed squared
    // window, so it reconstructs perfectly through whichever window it is
    // given. Confirmed by substituting the symmetric window — this test goes
    // red and the round trip stays green. What the wrong window actually costs
    // is a spectrogram the model was not trained on, so the damage is a worse
    // mask rather than anything audible in a round trip.
    const window = separationHannWindow(8);
    expect(window[0]).toBeCloseTo(0, 12);
    expect(window[4]).toBeCloseTo(1, 12);
    // Symmetric would return to 0 here; periodic does not.
    expect(window[7]).toBeGreaterThan(0.1);
    expect(window[1]).toBeCloseTo(window[7], 12);
  });

  it('reconstructs the original signal through a forward and inverse pass', () => {
    // If the padding, the hop, the Hermitian rebuild or the envelope
    // normalisation is wrong, the round trip stops being the identity. It is
    // deliberately not the guard for the window shape — see the test above for
    // why it cannot be.
    const original = testSignal(SEPARATION_CHUNK_SAMPLES);
    const spectrogram = separationStft(original);
    const restored = separationIstft(
      spectrogram.real,
      spectrogram.imaginary,
      original.length,
    );
    let worst = 0;
    for (let i = 0; i < original.length; i += 1) {
      worst = Math.max(worst, Math.abs(original[i] - restored[i]));
    }
    // Double-precision arithmetic, so this is the numerical floor rather than a
    // tolerance anyone chose. It measured 9.05e-15 when written.
    expect(worst).toBeLessThan(1e-9);
    // And the level is unchanged, which the sample-wise check above would also
    // catch but states the failure in the units a listener would notice.
    expect(level(restored).rms).toBeCloseTo(level(original).rms, 6);
  });

  it('reconstructs the leading and trailing frames at full level', () => {
    // Fewer windows overlap at the edges. Assuming the envelope sums to one
    // instead of dividing by it makes a song fade in over the first 23 ms and
    // out over the last — subtle, and permanent in the exported stem.
    const original = testSignal(SEPARATION_CHUNK_SAMPLES);
    const spectrogram = separationStft(original);
    const restored = separationIstft(
      spectrogram.real,
      spectrogram.imaginary,
      original.length,
    );
    const edge = SEPARATION_FFT_SIZE;
    [0, 1, 17, edge - 1, original.length - edge, original.length - 1].forEach(
      (i) => {
        expect(Math.abs(original[i] - restored[i])).toBeLessThan(1e-9);
      },
    );
  });

  it('treats the mask as complex, so it rotates phase and not just level', () => {
    // A real-only mask is the plausible mistake here: it looks like a gain and
    // mostly works, while costing several dB of separation because the model
    // uses phase to pull apart sources that share a bin. A pure +90 degree
    // rotation (0 + 1i) must move the signal into the imaginary axis, not
    // silence it.
    const spectrogram = {
      real: Float64Array.from([1, 0, 3]),
      imaginary: Float64Array.from([0, 2, 4]),
    };
    separationApplyMask(
      spectrogram,
      Float32Array.from([0, 0, 0]),
      Float32Array.from([1, 1, 1]),
    );
    expect(Array.from(spectrogram.real)).toEqual([0, -2, -4]);
    expect(Array.from(spectrogram.imaginary)).toEqual([1, 0, 3]);
  });

  it('silences the signal when the model returns an empty mask', () => {
    // What a correct run on vocal-free audio looks like: the mask is ~0 and the
    // stem must be silence. This is the shape of the null test that found the
    // packing bug, reduced to something a unit test can assert.
    const original = testSignal(SEPARATION_CHUNK_SAMPLES);
    const spectrogram = separationStft(original);
    const zeros = new Float32Array(spectrogram.real.length);
    separationApplyMask(spectrogram, zeros, zeros);
    const restored = separationIstft(
      spectrogram.real,
      spectrogram.imaginary,
      original.length,
    );
    expect(level(restored).peak).toBeLessThan(-200);
  });
});
