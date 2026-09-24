/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import type { ILookTuning } from 'common/customLooks';
import {
  TILT_PIVOT_HZ,
  type TAnalysisStyle,
  type TLegendKey,
} from 'common/graphAnalysis';
import type { ResolvedGraphPalette } from 'common/graphStyles';
import type { IChartPointData } from '../ChartController';
import { getLineGainAtFrequency } from '../utils';
import {
  ANALYSIS_RANGE_DB,
  clamp01,
  easeFactor,
  followReadings,
  resetAnalysisState,
  type IAnalysisBand,
  type IAnalysisFrame,
  type IAnalysisPlot,
  type IAnalysisState,
} from './analysisFrame';
import { mateColours, paintChannelLegend } from './channelInk';
import drawAnalyzerView from './analyzerView';
import drawEnergyView from './energyView';
import drawMidSideView from './midSideView';
import drawNotesView from './notesView';
import drawPhaseView from './phaseView';
import drawScopeView from './scopeView';
import drawAverageView from './averageView';
import drawCompareView from './compareView';
import drawLoudnessView from './loudnessView';
import drawRtaView from './rtaView';
import drawSpectrogramView from './spectrogramView';
import drawWaterfallView from './waterfallView';

/**
 * The one door into the measuring views.
 *
 * Everything that has to be true of all seven happens here and nowhere else:
 * the readings are put on one scale, the display slope is applied once, the
 * EQ's own response is turned into the same units, and the wave controls
 * (height, position, mirrored, upside down) are turned into the band each
 * figure grows in. A view that did any of that for itself would be a view
 * that could disagree with the six beside it about where 0 dB is.
 */

/**
 * How fast the split figures' nought comes back down, in decibels per
 * millisecond: one a second, which is the rate the graph's own scale falls
 * at (`followGraphReference`), so the joined and split views drift together
 * rather than one of them chasing the other.
 */
const REFERENCE_FALL_DB_PER_MS = 0.001;

/**
 * How slowly the display comes back up after the slope has pushed it down.
 *
 * Long, because coming back is the direction nobody should be able to see: a
 * quick recovery makes the whole spectrum breathe on every quiet bar, which
 * reads as the analyser being wrong rather than as the music being quiet.
 */
const ROOM_HALF_LIFE_MS = 1400;

/**
 * How far off the floor a reading has to be before the slope moves it, as a
 * share of the plot's depth. Six decibels: below that there is nothing to
 * tilt, and the bend it puts in the very bottom of the range is under the
 * width of the line drawing it.
 */
const FLOOR_GRIP = 0.075;

export interface IAnalysisRequest {
  style: TAnalysisStyle;
  context: CanvasRenderingContext2D;
  ratio: number;
  plot: IAnalysisPlot;
  /** One per copy of the drawing: two when the wave is mirrored. */
  bands: readonly IAnalysisBand[];
  deltaMs: number;
  playing: boolean;
  tuning: ILookTuning;
  colours: readonly string[];
  palette: ResolvedGraphPalette;
  /** What a reader calls each channel, for the legend on a split view. */
  channelLabels: readonly [string, string];
  /** What the key calls each reading, in the language on screen. */
  legend: Record<TLegendKey, string>;
  edge: IAnalysisFrame['edge'];
  glow: number;
  /** The reading as it is drawn, eased by the look's attack and release. */
  points: readonly IChartPointData[];
  /** The same reading as it arrived. */
  live: readonly IChartPointData[];
  /** Each point's column in CSS pixels, already projected. */
  columns: readonly (readonly [number, number])[];
  /**
   * The pair of readings this view is drawing in dBFS, when one is being
   * measured: left and right for the split, mid and side for Mid & side.
   * One field because the two are the same shape and no view wants both.
   */
  channels?: readonly [Float64Array, Float64Array];
  /** One block of samples per channel, for the stereo view. */
  scope?: readonly [Float32Array, Float32Array];
  /** The EQ's total response in decibels, for Before & after. */
  eqResponse?: IChartPointData[];
  state: IAnalysisState;
}

const VIEWS: Record<
  TAnalysisStyle,
  (frame: IAnalysisFrame, state: IAnalysisState) => boolean
> = {
  analyzer: drawAnalyzerView,
  compare: drawCompareView,
  spectrogram: drawSpectrogramView,
  rta: drawRtaView,
  average: drawAverageView,
  waterfall: drawWaterfallView,
  loudness: drawLoudnessView,
  scope: drawScopeView,
  midside: drawMidSideView,
  notes: drawNotesView,
  energy: drawEnergyView,
  phase: drawPhaseView,
};

/** A reading in plot gain units as a fraction of the plot's depth. */
const asFraction = (gain: number) => (gain - MIN_GAIN) / (MAX_GAIN - MIN_GAIN);

const drawAnalysisView = (request: IAnalysisRequest): boolean => {
  const { state, points, live, columns, tuning, style } = request;
  const size = points.length;
  if (size < 2 || columns.length < size || live.length < size) {
    return false;
  }
  resetAnalysisState(
    state,
    `${style}|${Math.round(request.plot.right - request.plot.left)}x${Math.round(
      request.plot.bottom - request.plot.top,
    )}`,
    size,
  );

  /**
   * The display slope, as a share of the plot's depth per point.
   *
   * Computed here rather than inside a view because every reading in the
   * frame has to carry the same one — the live curve, the peak hold, the
   * before-curve and the EQ's own response all move together, or the
   * comparison between them stops meaning anything.
   */
  const { tilt } = tuning;
  const slope = (frequency: number) =>
    tilt === 0
      ? 0
      : (tilt * Math.log2(frequency / TILT_PIVOT_HZ)) / ANALYSIS_RANGE_DB;

  /**
   * The slope lets go of the floor.
   *
   * A band with no sound in it reads at the very bottom, and tipping THAT up
   * draws a rising diagonal across an empty plot — a line with no music
   * behind it, which is what silence looked like with the slope on (Ivan,
   * 2026-09-23: "I dont like that tilt line when no music playin"). So the
   * slope fades in over the bottom few decibels of the range: full strength
   * anywhere there is something to read, nothing at all where there is not.
   */
  const grip = (level: number) =>
    level >= FLOOR_GRIP ? 1 : Math.max(0, level) / FLOOR_GRIP;

  let tallest = 0;
  for (let index = 0; index < size; index += 1) {
    const lift = slope(points[index].x);
    const now = asFraction(live[index].y);
    state.live[index] = now + lift * grip(now);
    if (state.live[index] > tallest) {
      tallest = state.live[index];
    }
    const [column] = columns[index];
    state.xs[index] = column;
    state.axis[index] = points[index].x;
  }

  /**
   * Room for the slope.
   *
   * The reading arrives measured against the programme's own peak, which on
   * nearly every record is a bass note — so the top rule is where the bass
   * sits, and tipping the display up by six decibels an octave lifts the
   * treble straight through the ceiling. Untouched, four kilohertz upward
   * came out as a flat plateau along the top rule with the peak marks strung
   * across it: not a loud record, a clipped picture.
   *
   * So the whole display is let DOWN by however much the slope pushed it
   * past the top, at once, and comes back slowly when the music stops
   * needing the room. Only ever downward: with the slope off, nothing
   * exceeds the top and this is exactly zero, which is the drawing as it was
   * before the control existed.
   */
  const wanted = tallest > 1 ? 1 - tallest : 0;
  state.room =
    wanted < state.room
      ? wanted
      : state.room +
        (wanted - state.room) * easeFactor(request.deltaMs, ROOM_HALF_LIFE_MS);
  for (let index = 0; index < size; index += 1) {
    state.live[index] = clamp01(state.live[index] + state.room);
  }

  /**
   * The measuring views do their OWN easing, from the reading as it arrived.
   *
   * The shared buffer the ordinary forms are drawn from halves the distance
   * to its target, which crawls the last of the way down; these fall at a
   * steady rate instead (`followReadings`). Reading the raw frame here rather
   * than the eased one also keeps the two paths from easing the same numbers
   * twice, which is lag nobody asked for.
   */
  let moving = false;
  if (state.seeded) {
    moving = followReadings(
      state.levels,
      state.live,
      request.deltaMs,
      tuning.attackMs,
      tuning.releaseMs,
    );
  } else {
    // The first measurement arrives whole rather than growing off the floor.
    state.levels.set(state.live);
    state.seeded = true;
  }

  let eqLift: Float64Array | undefined;
  if (style === 'compare' && request.eqResponse?.length) {
    const response = request.eqResponse;
    for (let index = 0; index < size; index += 1) {
      state.lift[index] =
        getLineGainAtFrequency(response, points[index].x) / ANALYSIS_RANGE_DB;
    }
    eqLift = state.lift;
  }

  let split: readonly [Float64Array, Float64Array] | undefined;
  // Mid & side is a split into a different pair, so it draws two figures
  // whichever way the Channels row is set; everything else waits to be asked.
  if (
    request.channels &&
    (tuning.channels === 'split' || style === 'midside')
  ) {
    const [leftDb, rightDb] = request.channels;
    if (leftDb.length === size && rightDb.length === size) {
      /**
       * The split figures are measured against THEIR OWN loudest point, by
       * the same rule the joined reading follows: the top of the plot is the
       * programme's peak, and it falls a decibel a second when the music goes
       * quieter (`followGraphReference`).
       *
       * Taken from the joined reading's peak instead — which is what the
       * first version did — the two scales could disagree by the whole depth
       * of the plot, and then every point clamped at the ceiling and the view
       * was a solid block of colour (Ivan, 2026-09-23: "see it start full not
       * good"). There is no arrangement of the two readings that can do that
       * here, because only one of them is consulted.
       */
      let loudest = -Infinity;
      for (let index = 0; index < size; index += 1) {
        if (leftDb[index] > loudest) {
          loudest = leftDb[index];
        }
        if (rightDb[index] > loudest) {
          loudest = rightDb[index];
        }
      }
      if (Number.isFinite(loudest)) {
        state.reference = Number.isNaN(state.reference)
          ? loudest
          : Math.max(
              loudest,
              state.reference - request.deltaMs * REFERENCE_FALL_DB_PER_MS,
            );
        for (let index = 0; index < size; index += 1) {
          const lift = slope(points[index].x);
          const left =
            1 + (leftDb[index] - state.reference) / ANALYSIS_RANGE_DB;
          const right =
            1 + (rightDb[index] - state.reference) / ANALYSIS_RANGE_DB;
          state.left[index] = clamp01(left + lift * grip(left));
          state.right[index] = clamp01(right + lift * grip(right));
        }
        /**
         * Put through the look's own attack and release, exactly as the
         * joined figure is.
         *
         * The two channels are read straight off their analysers, so drawn
         * as they arrive they answered Attack and Release not at all — and
         * against a joined figure that does, Left & right simply looked
         * quicker (Ivan, 2026-09-23: "why left & right is faster than
         * joined"). The first measurement arrives whole rather than growing
         * out of the floor, which is how the joined trace starts too.
         */
        if (state.splitSeeded) {
          moving =
            followReadings(
              state.easedLeft,
              state.left,
              request.deltaMs,
              tuning.attackMs,
              tuning.releaseMs,
            ) || moving;
          moving =
            followReadings(
              state.easedRight,
              state.right,
              request.deltaMs,
              tuning.attackMs,
              tuning.releaseMs,
            ) || moving;
        } else {
          state.easedLeft.set(state.left);
          state.easedRight.set(state.right);
          state.splitSeeded = true;
        }
        split = [state.easedLeft, state.easedRight];
      }
    }
  }

  const draw = VIEWS[style];
  /**
   * The right channel's stops, turned once for the whole frame rather than
   * per copy of the drawing: a mirrored wave draws the same view twice and
   * six colours through HSL and back is not work worth doing again.
   */
  const mate = mateColours(request.colours);
  request.bands.forEach((band, copy) => {
    /**
     * Only the first copy advances time.
     *
     * A mirrored wave draws the same view twice in one frame, and three of
     * these views step a clock: the spectrogram prints a row, the waterfall
     * takes a slice, every peak hold falls. Given the frame's own delta twice
     * they would all run at double speed the moment somebody mirrored the
     * wave — the reflection would be the same picture at a different rate,
     * which is not a reflection. The second copy is drawn at the same instant
     * as the first, so it is handed no time at all.
     */
    const frame: IAnalysisFrame = {
      context: request.context,
      ratio: request.ratio,
      plot: request.plot,
      band,
      deltaMs: copy === 0 ? request.deltaMs : 0,
      playing: request.playing,
      tuning,
      colours: request.colours,
      mate,
      palette: request.palette,
      edge: request.edge,
      glow: request.glow,
      xs: state.xs,
      axis: state.axis,
      levels: state.levels,
      live: state.live,
      split,
      eqLift,
      scope: request.scope,
      channelLabels: request.channelLabels,
      legend: request.legend,
    };
    moving = draw(frame, state) || moving;
    // Named once per copy, over the drawing it belongs to. Only where there
    // are two figures to tell apart — the stereo view says L and R on its
    // own meters, and one figure needs no key at all.
    if (split && style !== 'loudness') {
      paintChannelLegend(frame, request.channelLabels);
    }
  });
  return moving;
};

export default drawAnalysisView;
