/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { GRAPH_END, GRAPH_START } from './ChartController';
import { POINT_COUNT } from './liveSpectrumFrames';

/**
 * How a graph turns transforms into points: the arithmetic shared by the main
 * graph (`liveGraphBand.ts`), the Share Audio sender and the DSP EQ page.
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
 */

/**
 * Blackman's equivalent noise bandwidth, in bins: what `AnalyserNode` windows
 * every transform with, and the engine's meters too. The powers of a tone's
 * bins sum to this many times the power of its peak bin, so a slice's sum
 * divided by it reads a tone at the level its own bin shows.
 */
const BLACKMAN_ENBW_BINS = 1.7268;

/**
 * The narrowest slice a point stands for, in bins of the window reading it:
 * a tone's peak bin and both neighbours, 99% of its power — within 0.05 dB
 * of its own level at a bin's centre.
 */
const FLOOR_BINS = 3;

/** How much of an octave each point of the main graph stands for. */
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
const MAX_TIMING = 10 ** (MAX_TIMING_DB / 10);

/** One bin at the analyser's floor, so an empty span divides as silence. */
const EMPTY_POWER = 1e-10;

/**
 * `points` log-spaced points from the plot's left edge to its right edge, or
 * to Nyquist where that comes first: past Nyquist there is no sound to show.
 */
export const createGraphFrequencyAxis = (
  sampleRate: number,
  points: number = POINT_COUNT,
): number[] => {
  const logMin = Math.log10(GRAPH_START);
  const logMax = Math.log10(Math.min(GRAPH_END, sampleRate / 2));
  return Array.from(
    { length: points },
    (_value, index) =>
      10 ** (logMin + (index / (points - 1)) * (logMax - logMin)),
  );
};

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

/**
 * Where each point of the graph reads, in a fast window and a long one: the
 * spans of its own slice in each, and of the octave it is timed over.
 */
export interface IGraphBandLayout extends IGraphLevels {
  fast: ITransformPower;
  low: ITransformPower;
  lowDetail: Float64Array;
  lowTiming: Float64Array;
  fastDetail: Float64Array;
  fastTiming: Float64Array;
  /** How much of each point the fast window reads alone: 1 above the hand-over. */
  fastShare: Float64Array;
  /** The highest bin of the long window any point reads, for its sender. */
  highestLowEdge: number;
}

/** How a layout reads, where it is not the main graph's. */
export interface IGraphBandOptions {
  /** How many of the long window's bins arrive: all of them by default. */
  lowBins?: number;
  /** How much of an octave each point stands for. */
  detailOctaves?: number;
  /** How many points the axis has. */
  points?: number;
}

/**
 * The layout for a fast window `fastFftSize` wide and a long one
 * `lowFftSize` wide.
 *
 * Shared by the main graph, whose two windows are `AnalyserNode`s, and the
 * DSP EQ page, whose two arrive from the engine (`meters_eq_live.h`) — so a
 * record reads the same on both, and a fix to one is a fix to the other.
 */
export const createGraphBandLayout = (
  sampleRate: number,
  fastFftSize: number,
  lowFftSize: number,
  {
    lowBins = lowFftSize / 2,
    detailOctaves = DETAIL_OCTAVES,
    points = POINT_COUNT,
  }: IGraphBandOptions = {},
): IGraphBandLayout => {
  const axis = createGraphFrequencyAxis(sampleRate, points);
  const fastBinHz = sampleRate / fastFftSize;
  const lowBinHz = sampleRate / lowFftSize;
  // The fast window reads a point alone from where a slice holds its three
  // bins, and takes over across half an octave from there.
  const handOverHz = (FLOOR_BINS * fastBinHz) / spanHz(1, detailOctaves);
  const lowDetail = new Float64Array(axis.length * 2);
  const lowTiming = new Float64Array(axis.length * 2);
  const fastDetail = new Float64Array(axis.length * 2);
  const fastTiming = new Float64Array(axis.length * 2);
  const fastShare = new Float64Array(axis.length);
  let highestLowEdge = 0;
  axis.forEach((frequency, index) => {
    const detailHz = Math.max(
      spanHz(frequency, detailOctaves),
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
    fast: createTransformPower(
      fastBinHz,
      fastFftSize / 2,
      Math.max(...fastDetail, ...fastTiming),
    ),
    low: createTransformPower(lowBinHz, lowBins, highestLowEdge),
    lowDetail,
    lowTiming,
    fastDetail,
    fastTiming,
    fastShare,
    highestLowEdge,
    levels: new Float64Array(axis.length),
    reference: undefined,
  };
};

/**
 * The graph's levels, in decibels a tone reads at, from the two windows'
 * bins in dB, written into `band.levels`.
 */
export const readBandLevels = (
  band: IGraphBandLayout,
  fastData: Float32Array,
  lowData: Float32Array,
): Float64Array => {
  fillPower(band.fast, fastData);
  fillPower(band.low, lowData);
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

/** The same slices read from one transform, for a spectrum that arrives as one. */
export interface IGraphSliceReader extends IGraphLevels {
  sampleRate: number;
  fftSize: number;
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
  points: number = POINT_COUNT,
): IGraphSliceReader => {
  const axis = createGraphFrequencyAxis(sampleRate, points);
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
    fftSize,
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
