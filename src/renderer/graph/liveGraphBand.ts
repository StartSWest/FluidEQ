/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { NumberValue } from 'd3';
import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { GRAPH_END, IChartPointData } from './ChartController';
import {
  createGraphBandLayout,
  createGraphFrequencyAxis,
  IGraphBandLayout,
  IGraphLevels,
  readBandLevels,
} from './graphSlices';
import signedTick from './signedTick';
import {
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
} from './liveSpectrumFrames';

/**
 * The live spectrum the graphs draw: the plot's whole width, each point the
 * power in its own twelfth of an octave, timed by the fastest window there
 * is. How a point is read is `graphSlices.ts`; this is the main graph's side
 * of it — its two `AnalyserNode`s and its scale.
 *
 * NOT THE SHARED FRAME'S POINTS. Those run from 20 Hz to 20 kHz, and the rest
 * of the app reading them is tuned to exactly that span — the Studio scenes
 * stretch the points across their texels by position — so they stay as they
 * are. A graph places each point at its own frequency, from 10 Hz to Nyquist,
 * and a graph is where the Tone panel's cuts have to be seen working (Ivan,
 * 2026-09-23: "I want to show the real sound info on the graphs").
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
  `${signedTick(Math.round((Number(domainValue) - MAX_GAIN) / PLOT_PER_ANALYZER_DB))} dB`;

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
 * Silence across the whole plot, as `SILENT_POINTS` is across the shared
 * axis: a figure that rests on the floor rather than leaving the graph.
 */
export const GRAPH_SILENT_POINTS: readonly IChartPointData[] = Object.freeze(
  createGraphFrequencyAxis(GRAPH_END * 2).map((frequency) =>
    Object.freeze({ x: frequency, y: MIN_GAIN }),
  ),
);

export interface ILiveGraphBand extends IGraphBandLayout {
  /** The long window, on the same source as the fast analyser. */
  lowAnalyser: AnalyserNode;
  /** Reused on every read. */
  lowData: Float32Array<ArrayBuffer>;
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
  const lowAnalyser = context.createAnalyser();
  lowAnalyser.fftSize = lowBandFftSize(context.sampleRate);
  lowAnalyser.minDecibels = -100;
  lowAnalyser.maxDecibels = 0;
  lowAnalyser.smoothingTimeConstant = 0;
  source.connect(lowAnalyser);
  return {
    ...createGraphBandLayout(
      context.sampleRate,
      fastFftSize,
      lowAnalyser.fftSize,
    ),
    lowAnalyser,
    lowData: new Float32Array(lowAnalyser.frequencyBinCount),
  };
};

/**
 * The graph's levels from the fast analyser's `fastData` and a fresh read of
 * the long window, written into `band.levels`.
 */
export const readGraphLevels = (
  band: ILiveGraphBand,
  fastData: Float32Array,
): Float64Array => {
  band.lowAnalyser.getFloatFrequencyData(band.lowData);
  return readBandLevels(band, fastData, band.lowData);
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
