/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { NumberValue } from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { GRAPH_END, GRAPH_START, IChartPointData } from './ChartController';
import {
  POINT_COUNT,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
} from './liveSpectrumFrames';

/**
 * The live spectrum the graphs draw: the plot's whole width, each point the
 * power in its own twelfth of an octave, timed by the fastest window there
 * is.
 *
 * NOT THE SHARED FRAME'S POINTS. Those run from 20 Hz to 20 kHz, and the rest
 * of the app reading them is tuned to exactly that span — the Studio scenes
 * stretch the points across their texels by position — so they stay as they
 * are. A graph places each point at its own frequency, from 10 Hz to Nyquist,
 * and a graph is where the Tone panel's cuts have to be seen working (Ivan,
 * 2026-09-23: "I want to show the real sound info on the graphs").
 *
 * POWER IN A SLICE OF AN OCTAVE, THE WAY AN RTA READS. Each point is the
 * power in a twelfth of an octave around it, or three bins of the long window
 * where a twelfth is narrower than that, normalised so a tone reads its own
 * level (`BLACKMAN_ENBW_BINS`). It used to be the level of the bin under the
 * point, which is a different quantity in every window: the long window read
 * broadband sound up to 9 dB lower than the fast one, and the join between
 * them drew a cliff at 40 to 80 Hz that no record has (Ivan, 2026-09-23: "why
 * these peaks?"). A slice sums several bins wherever it is wider than one,
 * so the grain of a single transform — a few decibels from one bin to the
 * next — averages out, and pink noise lies flat.
 *
 * DETAIL FROM THE LONG WINDOW, TIMING FROM THE FAST ONE. A twelfth of an
 * octave below 1.2 kHz needs bins the fast window (2048 points, 21 ms behind)
 * does not have, and the long one (16384 points) that has them is 171 ms
 * behind: read alone, every kick landed a sixth of a second late at the
 * bottom. So below the hand-over the shape comes from the long window and its
 * loudness from the fast one: each point's slice is scaled by how much louder
 * or quieter the fast window hears the octave around it than the long window
 * does (`TIMING_OCTAVES`). A hit is up within the fast window; the detail
 * catches up behind it. Held steady, the two agree and the scale is one.
 *
 * EIGHTY DECIBELS DEEP, ON ITS OWN SCALE. The EQ keeps its ±20 dB down the
 * left; the analyser gets the right-hand side to itself, the way a
 * professional equaliser draws one (Ivan, 2026-09-23: "shall this graph be
 * profesional displaying the full range? and their numbers at the same time
 * that we do our +-20 db on EQ?"), measured from the loudest slice.
 */

/** How far below the programme's peak the graphs' analyser reaches. */
export const GRAPH_ANALYZER_RANGE_DB = 80;

/** Plot units per decibel of the analyser: the EQ's 40 across its 80. */
const PLOT_PER_ANALYZER_DB = (MAX_GAIN - MIN_GAIN) / GRAPH_ANALYZER_RANGE_DB;

/**
 * `levels` as the graphs plot them: the programme's peak on the top rule,
 * `GRAPH_ANALYZER_RANGE_DB` below it on the bottom one. Written into `target`,
 * whose objects are reused.
 */
export const writeGraphPoints = (
  target: IChartPointData[],
  axis: readonly number[],
  levels: Float64Array,
  referenceDb: number,
): IChartPointData[] => {
  for (let index = 0; index < target.length; index += 1) {
    const level = levels[index];
    const plotted = Number.isFinite(level)
      ? MAX_GAIN + (level - referenceDb) * PLOT_PER_ANALYZER_DB
      : MIN_GAIN;
    const point = target[index];
    point.x = axis[index];
    point.y = Math.min(MAX_GAIN, Math.max(MIN_GAIN, plotted));
  }
  return target;
};

/**
 * The right-hand scale's numbers while the graphs' analyser is what is drawn:
 * decibels below the programme's peak, `GRAPH_ANALYZER_RANGE_DB` deep.
 * Module scope for the reason `levelTickFormat` is.
 */
export const graphLevelTickFormat = (domainValue: NumberValue) =>
  `${Math.round((Number(domainValue) - MAX_GAIN) / PLOT_PER_ANALYZER_DB)} dB`;

/**
 * Blackman's equivalent noise bandwidth, in bins: what `AnalyserNode` windows
 * every transform with. The powers of a tone's bins sum to this many times
 * the power of its peak bin, so a slice's sum divided by it reads a tone at
 * the level its own bin shows.
 */
const BLACKMAN_ENBW_BINS = 1.7268;

/**
 * The narrowest slice a point stands for, in bins of the window reading it:
 * a tone's peak bin and both neighbours, 99% of its power — within 0.05 dB
 * of its own level at a bin's centre.
 */
const FLOOR_BINS = 3;

/** How much of an octave each point stands for. */
const DETAIL_OCTAVES = 1 / 12;

/**
 * The span the fast window times the long one over: an octave, and at least
 * six of the fast window's bins. Narrower, a slice would take in the fast
 * window's leakage from a note just outside it — its main lobe is six bins
 * wide — and lift the bottom octave under every bass note.
 */
const TIMING_OCTAVES = 1;
const TIMING_FLOOR_BINS = 6;

/**
 * The most the timing may move the long window's shape, either way: a hit
 * out of silence, and no further, so a window of nothing cannot divide into
 * a number.
 */
const MAX_TIMING_DB = 40;

/** One bin at the analyser's floor, so an empty span divides as silence. */
const EMPTY_POWER = 1e-10;

/** The widest bin the bottom may be read in, which sets the long window. */
const LOW_BAND_BIN_HZ = 3;

/** The largest transform an `AnalyserNode` takes. */
const MAX_ANALYSER_FFT_SIZE = 32768;

export const lowBandFftSize = (sampleRate: number): number =>
  Math.min(
    MAX_ANALYSER_FFT_SIZE,
    2 ** Math.ceil(Math.log2(sampleRate / LOW_BAND_BIN_HZ)),
  );

/**
 * `POINT_COUNT` log-spaced points from the plot's left edge to its right edge,
 * or to Nyquist where that comes first: past Nyquist there is no sound to show.
 */
export const createGraphFrequencyAxis = (sampleRate: number): number[] => {
  const logMin = Math.log10(GRAPH_START);
  const logMax = Math.log10(Math.min(GRAPH_END, sampleRate / 2));
  return Array.from(
    { length: POINT_COUNT },
    (_value, index) =>
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin)),
  );
};

/**
 * Silence across the whole plot, as `SILENT_POINTS` is across the shared
 * axis: a figure that rests on the floor rather than leaving the graph.
 */
export const GRAPH_SILENT_POINTS: readonly IChartPointData[] = Object.freeze(
  createGraphFrequencyAxis(GRAPH_END * 2).map((frequency) =>
    Object.freeze({ x: frequency, y: MIN_GAIN }),
  ),
);

/** Width in hertz of a span `octaves` wide around `frequency`. */
const spanHz = (frequency: number, octaves: number): number =>
  frequency * (2 ** (octaves / 2) - 2 ** (-octaves / 2));

/**
 * A span in one transform's edge coordinates: bin k covers [k, k + 1], the
 * frequencies half a bin either side of its own.
 */
const edgesOf = (
  frequency: number,
  widthHz: number,
  binHz: number,
): [number, number] => [
  Math.max(0, (frequency - widthHz / 2) / binHz + 0.5),
  (frequency + widthHz / 2) / binHz + 0.5,
];

/** One transform, as the power of each bin and the running sum of those. */
interface ITransformPower {
  binHz: number;
  /** The highest bin any span reaches, so no more are converted. */
  lastBin: number;
  /** `sums[k]` is the power of bins 0 to k - 1. */
  sums: Float64Array;
}

const createTransformPower = (
  binHz: number,
  binCount: number,
  highestEdge: number,
): ITransformPower => {
  const lastBin = Math.min(binCount - 1, Math.ceil(highestEdge));
  return { binHz, lastBin, sums: new Float64Array(lastBin + 2) };
};

const fillPower = (transform: ITransformPower, data: Float32Array) => {
  const { lastBin, sums } = transform;
  let sum = 0;
  sums[0] = 0;
  for (let bin = 0; bin <= lastBin; bin += 1) {
    const db = data[bin];
    sum += Number.isFinite(db) ? 10 ** (db / 10) : 0;
    sums[bin + 1] = sum;
  }
};

/** The power between two edges, each bin's taken in proportion. */
const powerBetween = (
  { lastBin, sums }: ITransformPower,
  from: number,
  to: number,
): number => {
  const at = (edge: number) => {
    if (edge <= 0) {
      return 0;
    }
    if (edge >= lastBin + 1) {
      return sums[lastBin + 1];
    }
    const bin = Math.floor(edge);
    return sums[bin] + (edge - bin) * (sums[bin + 1] - sums[bin]);
  };
  return Math.max(0, at(to) - at(from));
};

/** What a graph's scale follows: the last read's levels, and its zero. */
export interface IGraphLevels {
  axis: number[];
  levels: Float64Array;
  /**
   * The loudest slice lately, where the right-hand scale's zero stands:
   * each read raises it at once and lets it fall `followGraphReference`'s
   * release.
   */
  reference: number | undefined;
}

export interface ILiveGraphBand extends IGraphLevels {
  /** The long window, on the same source as the fast analyser. */
  lowAnalyser: AnalyserNode;
  /** Reused on every read. */
  lowData: Float32Array<ArrayBuffer>;
  fast: ITransformPower;
  low: ITransformPower;
  /**
   * Per point, the edges of its spans: its own slice in each window, and the
   * octave it is timed over in each.
   */
  lowDetail: Float64Array;
  lowTiming: Float64Array;
  fastDetail: Float64Array;
  fastTiming: Float64Array;
  /** How much of each point the fast window reads alone: 1 above the hand-over. */
  fastShare: Float64Array;
}

/**
 * The graph band for one reader, beside its fast analyser `fastFftSize` wide.
 *
 * One per reader, never shared: an `AnalyserNode` averages each read with the
 * one before it, which is why the drawing already keeps a twin of the pump's
 * fast analyser (`liveFrameReader.ts`). The long window is not averaged at
 * all — read thirty times a second, consecutive windows are nine tenths the
 * same audio already.
 */
export const createLiveGraphBand = (
  context: BaseAudioContext,
  source: AudioNode,
  fastFftSize: number,
): ILiveGraphBand => {
  const { sampleRate } = context;
  const lowAnalyser = context.createAnalyser();
  lowAnalyser.fftSize = lowBandFftSize(sampleRate);
  lowAnalyser.minDecibels = -100;
  lowAnalyser.maxDecibels = 0;
  lowAnalyser.smoothingTimeConstant = 0;
  source.connect(lowAnalyser);

  const axis = createGraphFrequencyAxis(sampleRate);
  const fastBinHz = sampleRate / fastFftSize;
  const lowBinHz = sampleRate / lowAnalyser.fftSize;
  // The fast window reads a point alone from where a twelfth of an octave
  // holds its three bins, and takes over across half an octave from there.
  const handOverHz = (FLOOR_BINS * fastBinHz) / spanHz(1, DETAIL_OCTAVES);
  const lowDetail = new Float64Array(axis.length * 2);
  const lowTiming = new Float64Array(axis.length * 2);
  const fastDetail = new Float64Array(axis.length * 2);
  const fastTiming = new Float64Array(axis.length * 2);
  const fastShare = new Float64Array(axis.length);
  let highestLowEdge = 0;
  axis.forEach((frequency, index) => {
    const detailHz = Math.max(
      spanHz(frequency, DETAIL_OCTAVES),
      FLOOR_BINS * lowBinHz,
    );
    const timingHz = Math.max(
      spanHz(frequency, TIMING_OCTAVES),
      TIMING_FLOOR_BINS * fastBinHz,
    );
    const share = Math.min(
      1,
      Math.max(0, Math.log2(frequency / handOverHz) / 0.5),
    );
    fastShare[index] = share;
    lowDetail.set(edgesOf(frequency, detailHz, lowBinHz), index * 2);
    lowTiming.set(edgesOf(frequency, timingHz, lowBinHz), index * 2);
    fastDetail.set(
      edgesOf(frequency, Math.max(detailHz, FLOOR_BINS * fastBinHz), fastBinHz),
      index * 2,
    );
    fastTiming.set(edgesOf(frequency, timingHz, fastBinHz), index * 2);
    if (share < 1) {
      highestLowEdge = Math.max(
        highestLowEdge,
        lowDetail[index * 2 + 1],
        lowTiming[index * 2 + 1],
      );
    }
  });
  return {
    axis,
    lowAnalyser,
    lowData: new Float32Array(lowAnalyser.frequencyBinCount),
    fast: createTransformPower(
      fastBinHz,
      fastFftSize / 2,
      Math.max(...fastDetail, ...fastTiming),
    ),
    low: createTransformPower(
      lowBinHz,
      lowAnalyser.frequencyBinCount,
      highestLowEdge,
    ),
    lowDetail,
    lowTiming,
    fastDetail,
    fastTiming,
    fastShare,
    levels: new Float64Array(axis.length),
    reference: undefined,
  };
};

/** The same slices read from one transform, for a spectrum that arrives as one. */
export interface IGraphSliceReader extends IGraphLevels {
  sampleRate: number;
  read: (data: Float32Array) => Float64Array;
}

/**
 * The graphs' slices from a single transform `fftSize` wide — the Share
 * Audio sender's, which makes one and sends it. No long window, so where a
 * twelfth of an octave is narrower than three of its bins the slice holds at
 * three, and the bottom octaves are as coarse as that transform is.
 */
export const createGraphSliceReader = (
  sampleRate: number,
  fftSize: number,
): IGraphSliceReader => {
  const axis = createGraphFrequencyAxis(sampleRate);
  const binHz = sampleRate / fftSize;
  const edges = new Float64Array(axis.length * 2);
  axis.forEach((frequency, index) => {
    edges.set(
      edgesOf(
        frequency,
        Math.max(spanHz(frequency, DETAIL_OCTAVES), FLOOR_BINS * binHz),
        binHz,
      ),
      index * 2,
    );
  });
  const transform = createTransformPower(
    binHz,
    fftSize / 2,
    Math.max(...edges),
  );
  const levels = new Float64Array(axis.length);
  return {
    sampleRate,
    axis,
    levels,
    reference: undefined,
    read: (data) => {
      fillPower(transform, data);
      for (let index = 0; index < levels.length; index += 1) {
        const power = powerBetween(
          transform,
          edges[index * 2],
          edges[index * 2 + 1],
        );
        levels[index] =
          power > 0 ? 10 * Math.log10(power / BLACKMAN_ENBW_BINS) : -Infinity;
      }
      return levels;
    },
  };
};

const MAX_TIMING = 10 ** (MAX_TIMING_DB / 10);

/**
 * The graph's levels, in decibels a tone reads at, from the fast analyser's
 * `fastData` and a fresh read of the long window, written into `band.levels`.
 */
export const readGraphLevels = (
  band: ILiveGraphBand,
  fastData: Float32Array,
): Float64Array => {
  fillPower(band.fast, fastData);
  band.lowAnalyser.getFloatFrequencyData(band.lowData);
  fillPower(band.low, band.lowData);
  const {
    fast,
    low,
    lowDetail,
    lowTiming,
    fastDetail,
    fastTiming,
    fastShare,
    levels,
  } = band;
  for (let index = 0; index < levels.length; index += 1) {
    const edge = index * 2;
    const share = fastShare[index];
    let power = 0;
    if (share < 1) {
      const shape = powerBetween(low, lowDetail[edge], lowDetail[edge + 1]);
      const heard =
        powerBetween(fast, fastTiming[edge], fastTiming[edge + 1]) +
        EMPTY_POWER;
      const late =
        powerBetween(low, lowTiming[edge], lowTiming[edge + 1]) + EMPTY_POWER;
      const timing = Math.min(
        MAX_TIMING,
        Math.max(1 / MAX_TIMING, heard / late),
      );
      power += (1 - share) * shape * timing;
    }
    if (share > 0) {
      power +=
        share * powerBetween(fast, fastDetail[edge], fastDetail[edge + 1]);
    }
    levels[index] =
      power > 0 ? 10 * Math.log10(power / BLACKMAN_ENBW_BINS) : -Infinity;
  }
  return levels;
};

/** The scale's fall between reads: the shared frame's, one decibel a second. */
const REFERENCE_RELEASE_DB_PER_MS =
  TRACK_REFERENCE_RELEASE_DB / UPDATE_INTERVAL_MS;

/**
 * The right-hand scale's zero after a read: the loudest slice of `band.levels`
 * at once, and otherwise the last one less the release over `elapsedMs` of
 * audio — so the scale follows a quieter passage down and never lets a hit
 * run off the top. Timed by the audio that passed rather than by reads, so a
 * reader that slept through a loud passage wakes to the music now playing.
 * Undefined while nothing has been heard.
 */
export const followGraphReference = (
  band: IGraphLevels,
  elapsedMs: number,
): number | undefined => {
  let loudest = -Infinity;
  band.levels.forEach((level) => {
    if (level > loudest) {
      loudest = level;
    }
  });
  if (!Number.isFinite(loudest)) {
    return band.reference;
  }
  band.reference =
    band.reference === undefined
      ? loudest
      : Math.max(
          loudest,
          band.reference - elapsedMs * REFERENCE_RELEASE_DB_PER_MS,
        );
  return band.reference;
};
