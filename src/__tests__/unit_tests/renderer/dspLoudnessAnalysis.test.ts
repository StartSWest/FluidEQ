/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createLoudnessAnalyzer } from '../../../renderer/dsp/loudnessAnalysis';

const RATE = 48_000;
const SECONDS = 5;
const FRAMES = RATE * SECONDS;

const sine = (hz: number, amplitude: number): Float32Array[] => {
  const channel = new Float32Array(FRAMES);
  for (let at = 0; at < FRAMES; at += 1) {
    channel[at] = Math.sin((2 * Math.PI * hz * at) / RATE) * amplitude;
  }
  return [channel, Float32Array.from(channel)];
};

const measure = (channels: Float32Array[]) => {
  const analyzer = createLoudnessAnalyzer(RATE, channels.length);
  analyzer.feed(channels, 0, channels[0].length);
  return analyzer.finish();
};

describe('BS.1770 loudness measurement', () => {
  /**
   * The absolute anchor, and the only external number in this file.
   *
   * A stereo 1 kHz sine at -23 dBFS reads -23 LUFS on a conforming meter, which
   * is EBU R128's own calibration case. Getting there needs three things right
   * at once and the arithmetic says so: the two channels sum in the mean square
   * (+3.01), the -0.691 offset comes off, and the K-weighting adds +0.667 dB at
   * 1 kHz. Those last two nearly cancel, which is the whole point of the offset.
   *
   * This is the test that caught the meter being wrong: with the RBJ cookbook
   * shelf the weighting contributed +0.451 instead of +0.667 and the reading
   * came out at -23.22, low by a fifth of a LU on a signal where a conforming
   * meter has no freedom at all.
   */
  it('reads a stereo 1 kHz sine at -23 dBFS as -23 LUFS', () => {
    const measured = measure(sine(1_000, 10 ** (-23 / 20)));

    expect(measured.integratedLufs).toBeGreaterThan(-23.05);
    expect(measured.integratedLufs).toBeLessThan(-22.95);
  });

  it('follows a level change by exactly the change', () => {
    const loud = measure(sine(1_000, 10 ** (-20 / 20)));
    const quiet = measure(sine(1_000, 10 ** (-26 / 20)));

    expect(quiet.integratedLufs - loud.integratedLufs).toBeCloseTo(-6, 3);
  });

  it('reports silence rather than negative infinity', () => {
    const measured = measure([
      new Float32Array(FRAMES),
      new Float32Array(FRAMES),
    ]);

    expect(measured.integratedLufs).toBe(-120);
    expect(measured.truePeakDbtp).toBe(-120);
  });

  /**
   * The gates are the whole reason integrated loudness is not an average.
   *
   * One second of programme followed by four of silence: 47 blocks form, of
   * which 37 are pure silence. The absolute gate at -70 LUFS drops all 37, and
   * what remains is the seven blocks wholly inside the programme plus the three
   * that straddle its end at 75%, 50% and 25% energy. The mean of those ten is
   * 0.85 of the programme's own, so the reading lands 0.71 dB below it — that
   * number is arithmetic, not tolerance, and the assertion is bounded tightly
   * enough to notice if a gate stopped firing.
   *
   * An ungated mean over all 47 blocks would be 7.4 dB lower, which is the size
   * of the error this is here to catch: every track with a fade-out would be
   * measured as quiet and then over-boosted to meet its target.
   */
  it('gates out the silence after a passage instead of averaging it in', () => {
    const amplitude = 10 ** (-20 / 20);
    const [left, right] = sine(1_000, amplitude);
    left.fill(0, RATE);
    right.fill(0, RATE);

    const gated = measure([left, right]);
    const continuous = measure(sine(1_000, amplitude));
    const drop = continuous.integratedLufs - gated.integratedLufs;

    expect(drop).toBeGreaterThan(0.6);
    expect(drop).toBeLessThan(0.8);
  });

  /**
   * Inter-sample peak, which is the number the whole true-peak ceiling exists
   * for. A half-rate square alternates +A/-A and the reconstructed waveform
   * overshoots between the samples, so the true peak must exceed the sample
   * peak — a port measuring sample peak alone would return exactly 0 dBFS here
   * and look correct.
   */
  it('measures a true peak above the sample peak on an alternating signal', () => {
    const channel = new Float32Array(FRAMES);
    for (let at = 0; at < FRAMES; at += 1) {
      channel[at] = at % 2 === 0 ? 0.5 : -0.5;
    }
    const measured = measure([channel, Float32Array.from(channel)]);

    // -6.02 dBFS is the sample peak of a 0.5 square.
    expect(measured.truePeakDbtp).toBeGreaterThan(-6.02);
  });

  it('measures the same track fed in one call and in chunks', () => {
    const channels = sine(440, 0.4);
    const whole = measure(channels);

    const chunked = createLoudnessAnalyzer(RATE, channels.length);
    // Deliberately not a divisor of the 19200-frame block or the 4800-frame
    // hop: a chunk boundary that only ever fell on a block boundary would hide
    // an analyser that reset its rolling sum per call.
    for (let from = 0; from < FRAMES; from += 7_331) {
      chunked.feed(channels, from, Math.min(FRAMES, from + 7_331));
    }
    const measured = chunked.finish();

    expect(measured.integratedLufs).toBeCloseTo(whole.integratedLufs, 10);
    expect(measured.truePeakDbtp).toBeCloseTo(whole.truePeakDbtp, 10);
  });
});
