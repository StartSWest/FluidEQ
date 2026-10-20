/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * How a graph turns two transforms into points (`graphSlices.ts`), held on
 * the DSP EQ page's own reading: the engine's short window and its long one
 * at a twenty-fourth of an octave, with the long window cut to the bins the
 * engine sends. Spectra are made here the way the engine and `AnalyserNode`
 * make theirs — a Blackman window, magnitudes over the size, in dB — so a
 * pass is the arithmetic being right, not two copies of one mistake.
 */
import fftInPlace from '../../../../common/dsp/fft';
import {
  ANALYSIS_EQ_DETAIL_BINS,
  ANALYSIS_EQ_DETAIL_WINDOW,
} from '../../../../common/dsp/analysisWire';
import {
  createGraphBandLayout,
  createGraphFrequencyAxis,
  createGraphSliceReader,
  readBandLevels,
} from '../../../../renderer/graph/graphSlices';
import {
  EQ_SPECTRUM_OCTAVES,
  EQ_SPECTRUM_POINTS,
} from '../../../../renderer/dsp/dspEqSpectrum';
import {
  GRAPH_END,
  GRAPH_START,
} from '../../../../renderer/graph/ChartController';

const RATE = 48000;
const SHORT = 2048;
/** Every shared-mode rate the engine is measured at (`rate_sweep_test.cpp`). */
const RATES = [44100, 48000, 88200, 96000, 176400, 192000, 352800, 384000];

type TSignal = (seconds: number) => number;

const tone =
  (hz: number, amplitude: number): TSignal =>
  (seconds) =>
    amplitude * Math.sin(2 * Math.PI * hz * seconds);

const mix =
  (...parts: TSignal[]): TSignal =>
  (seconds) =>
    parts.reduce((total, part) => total + part(seconds), 0);

/** The lowest `bins` bins an analyser shows for the window `size` long. */
const analyserDb = (
  signal: TSignal,
  size: number,
  bins: number,
  rate = RATE,
): Float32Array => {
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  for (let at = 0; at < size; at += 1) {
    const phase = (2 * Math.PI * at) / (size - 1);
    const blackman = 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
    real[at] = signal(at / rate) * blackman;
  }
  fftInPlace(real, imaginary, false);
  return Float32Array.from({ length: bins }, (_unused, bin) =>
    Math.max(
      -200,
      20 * Math.log10(Math.hypot(real[bin], imaginary[bin]) / size),
    ),
  );
};

const eqPageLayout = (rate = RATE, lowBins = ANALYSIS_EQ_DETAIL_BINS) =>
  createGraphBandLayout(rate, SHORT, ANALYSIS_EQ_DETAIL_WINDOW, {
    lowBins,
    detailOctaves: EQ_SPECTRUM_OCTAVES,
    points: EQ_SPECTRUM_POINTS,
  });

const nearest = (axis: readonly number[], hz: number): number =>
  axis.reduce(
    (best, value, index) =>
      Math.abs(Math.log(value / hz)) < Math.abs(Math.log(axis[best] / hz))
        ? index
        : best,
    0,
  );

/** A tone of amplitude 0.5: half of it in each sideband, times Blackman's 0.42. */
const TONE_DB = 20 * Math.log10(0.25 * 0.42);

describe("the DSP EQ page's reading of the engine's two windows", () => {
  it('reads a tone at its own level in the bass, the middle and the top', () => {
    const layout = eqPageLayout();
    [50, 1000, 6000].forEach((hz) => {
      const signal = tone(hz, 0.5);
      const levels = readBandLevels(
        layout,
        analyserDb(signal, SHORT, SHORT / 2),
        analyserDb(signal, ANALYSIS_EQ_DETAIL_WINDOW, ANALYSIS_EQ_DETAIL_BINS),
      );
      const level = levels[nearest(layout.axis, hz)];
      expect({ hz, off: Math.abs(level - TONE_DB) < 1 }).toEqual({
        hz,
        off: true,
      });
    });
  });

  it('shows two bass notes 20 Hz apart as two, with a valley between', () => {
    const signal = mix(tone(40, 0.3), tone(60, 0.3));
    const short = analyserDb(signal, SHORT, SHORT / 2);
    const layout = eqPageLayout();
    const levels = readBandLevels(
      layout,
      short,
      analyserDb(signal, ANALYSIS_EQ_DETAIL_WINDOW, ANALYSIS_EQ_DETAIL_BINS),
    );
    const valley = (read: Float64Array, axis: readonly number[]) =>
      Math.min(read[nearest(axis, 40)], read[nearest(axis, 60)]) -
      read[nearest(axis, 50)];
    expect(valley(levels, layout.axis)).toBeGreaterThan(20);

    // Control: the short window alone, which is all an older engine sends,
    // cannot tell the two apart.
    const alone = createGraphSliceReader(RATE, SHORT, EQ_SPECTRUM_POINTS);
    expect(valley(alone.read(short), alone.axis)).toBeLessThan(3);
  });

  it('parts two partials a sixteenth of an octave apart, which the main graph merges', () => {
    // 1000 and 1044 Hz: a piano's neighbouring partials in its middle octaves.
    const signal = mix(tone(1000, 0.3), tone(1044, 0.3));
    const short = analyserDb(signal, SHORT, SHORT / 2);
    const long = analyserDb(
      signal,
      ANALYSIS_EQ_DETAIL_WINDOW,
      ANALYSIS_EQ_DETAIL_BINS,
    );
    const valleyAt = (detailOctaves: number) => {
      const layout = createGraphBandLayout(
        RATE,
        SHORT,
        ANALYSIS_EQ_DETAIL_WINDOW,
        {
          lowBins: ANALYSIS_EQ_DETAIL_BINS,
          detailOctaves,
          points: EQ_SPECTRUM_POINTS,
        },
      );
      const levels = readBandLevels(layout, short, long);
      const between = Math.sqrt(1000 * 1044);
      return (
        Math.min(
          levels[nearest(layout.axis, 1000)],
          levels[nearest(layout.axis, 1044)],
        ) - levels[nearest(layout.axis, between)]
      );
    };
    expect(valleyAt(EQ_SPECTRUM_OCTAVES)).toBeGreaterThan(10);
    // Control: the main graph's twelfth of an octave draws them as one.
    expect(valleyAt(1 / 12)).toBeLessThan(3);
  });

  it('reads no further into the long window than the bins the engine sends, at every rate', () => {
    RATES.forEach((rate) => {
      expect({
        rate,
        within: eqPageLayout(rate).highestLowEdge < ANALYSIS_EQ_DETAIL_BINS,
      }).toEqual({ rate, within: true });
    });
    // Control: a slice half as wide would need more than the engine sends.
    expect(
      createGraphBandLayout(RATE, SHORT, ANALYSIS_EQ_DETAIL_WINDOW, {
        detailOctaves: EQ_SPECTRUM_OCTAVES / 2,
        points: EQ_SPECTRUM_POINTS,
      }).highestLowEdge,
    ).toBeGreaterThan(ANALYSIS_EQ_DETAIL_BINS);
  });

  it('reads the same from the bins sent as from the whole long window', () => {
    const notes = Array.from({ length: 40 }, (_unused, index) =>
      tone(30 * 2 ** (index / 4), 0.02),
    );
    const signal = mix(...notes);
    const short = analyserDb(signal, SHORT, SHORT / 2);
    const whole = analyserDb(signal, ANALYSIS_EQ_DETAIL_WINDOW, 8192);
    const full = Float64Array.from(
      readBandLevels(eqPageLayout(RATE, 8192), short, whole),
    );
    const sent = readBandLevels(
      eqPageLayout(),
      short,
      whole.subarray(0, ANALYSIS_EQ_DETAIL_BINS),
    );
    const worst = (other: Float64Array) =>
      full.reduce(
        (most, level, index) => Math.max(most, Math.abs(level - other[index])),
        0,
      );
    expect(worst(sent)).toBeLessThan(1e-9);

    // Control: a quarter of the bins is not enough, and shows it.
    const cut = readBandLevels(
      eqPageLayout(RATE, 512),
      short,
      whole.subarray(0, 512),
    );
    expect(worst(cut)).toBeGreaterThan(1);
  });

  it('lays as many points as asked across the same plot', () => {
    const axis = createGraphFrequencyAxis(RATE, EQ_SPECTRUM_POINTS);
    expect(axis).toHaveLength(EQ_SPECTRUM_POINTS);
    expect(axis[0]).toBeCloseTo(GRAPH_START, 9);
    expect(axis[axis.length - 1]).toBeCloseTo(Math.min(GRAPH_END, RATE / 2), 6);
  });
});
