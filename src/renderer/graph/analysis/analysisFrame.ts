/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILookTuning } from 'common/customLooks';
import type { TLegendKey } from 'common/graphAnalysis';
import type { ResolvedGraphPalette } from 'common/graphStyles';
import { rampAt } from '../lookColours';

/**
 * What every measuring view is handed, and what it keeps between frames.
 *
 * The readings arrive NORMALISED, not in decibels and not in pixels: 0 is the
 * plot's floor and 1 its ceiling, which on this graph is eighty decibels
 * (`GRAPH_ANALYZER_RANGE_DB`). One number does for every view, the tilt is
 * already in it, and a view that wants decibels multiplies by eighty — so
 * nothing here can disagree with the right-hand scale the axis prints.
 *
 * Pixels come last, through `placeLevel`, because the wave controls (height,
 * position, mirrored, upside down) move the band a figure grows in and every
 * view has to obey them the same way. Doing it as a canvas transform instead
 * would squash the stereo view's meters and lettering along with the curve.
 */

/** Decibels between the plot's floor and its ceiling. */
export const ANALYSIS_RANGE_DB = 80;

export interface IAnalysisBand {
  /** The row a full reading reaches. */
  top: number;
  /** The row a reading of nothing rests on. */
  bottom: number;
  /** The figure hangs from `top` rather than standing on `bottom`. */
  flipped: boolean;
  /** How present this copy of the drawing is. */
  opacity: number;
}

export interface IAnalysisPlot {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface IAnalysisFrame {
  context: CanvasRenderingContext2D;
  /** Device pixels per CSS pixel, for the texture tiles and hairlines. */
  ratio: number;
  plot: IAnalysisPlot;
  band: IAnalysisBand;
  deltaMs: number;
  playing: boolean;
  tuning: ILookTuning;
  colours: readonly string[];
  /**
   * The right channel's copy of those stops, turned round the wheel.
   *
   * Always present, because a view that draws two figures must not have to
   * decide what the second one looks like — see `channelInk.ts`.
   */
  mate: readonly string[];
  palette: ResolvedGraphPalette;
  /**
   * The figure's outline, already resolved: the look's own stroke ordinarily,
   * euphoria's travelling hue while the rainbow border is on. Resolved by the
   * caller so this module never has to know the mode exists.
   */
  edge: {
    colour: string | CanvasGradient;
    width: number;
    /**
     * The colour above is euphoria's travelling hue rather than the look's.
     *
     * It matters because a reading's outline is normally the look's ramp
     * painted ALONG the figure — green over the bass, red at a peak, the
     * same colours as the body under it. Taking the ramp's hot end as one
     * flat colour drew a red line right round the spectrum, which reads as a
     * border somebody switched on (Ivan, 2026-09-23: "no rainbow border if
     * no rainbow mode"). Only the sweep is one colour, because the sweep is
     * one colour.
     */
    isEuphoria: boolean;
  };
  /** How hard the halo burns, 0 to 1. Zero outside euphoria. */
  glow: number;
  /** Each point's column, in CSS pixels. */
  xs: Float64Array;
  /**
   * Each point's frequency in hertz.
   *
   * The spectrum views never need it — their geometry is the columns — but
   * the note spectrum has to know which note a column is and the energy
   * bands have to cut at named frequencies, and neither can be answered from
   * pixels.
   */
  axis: Float64Array;
  /** The reading, eased by the look's attack and release. */
  levels: Float64Array;
  /** The same reading before that easing, for anything catching transients. */
  live: Float64Array;
  /** One reading per channel, when the look asked for two and both arrived. */
  split?: readonly [Float64Array, Float64Array];
  /** What the EQ is adding at each point, on the same scale as `levels`. */
  eqLift?: Float64Array;
  /** One block of samples per channel, for the stereo view. */
  scope?: readonly [Float32Array, Float32Array];
  /** What a reader calls each channel, for a legend or a meter. */
  channelLabels: readonly [string, string];
  /** What the key calls each reading, in the language on screen. */
  legend: Record<TLegendKey, string>;
  /**
   * Whether the view names its readings in a key at all. Not where it plays
   * behind another drawing — the player's equaliser screen — where the key
   * lands on the curve that screen is for (`paintLegend`).
   */
  keyed: boolean;
}

/** Where a reading of `level` lands, in CSS pixels. */
export const placeLevel = (band: IAnalysisBand, level: number): number => {
  const held = level > 1 ? 1 : level;
  const depth = band.bottom - band.top;
  return band.flipped
    ? band.top + (held > 0 ? held : 0) * depth
    : band.bottom - (held > 0 ? held : 0) * depth;
};

/**
 * The band cut in two, left above and right below.
 *
 * How the views that PRINT rather than draw — the spectrogram's raster, the
 * waterfall's stack — show two channels: overlaying two rasters would give a
 * picture of neither, and a stereo spectrogram is two strips stacked, which
 * is how every tool that has one draws it. The gap between them is a hair, so
 * the pair still reads as one instrument.
 */
export const halveBand = (
  band: IAnalysisBand,
): readonly [IAnalysisBand, IAnalysisBand] => {
  const middle = (band.top + band.bottom) / 2;
  const gap = 1;
  const upper = { ...band, bottom: middle - gap };
  const lower = { ...band, top: middle + gap };
  // The upper strip grows downward so the two meet in the middle, which is
  // what makes a difference between the channels read as a split rather than
  // as two unrelated pictures. A mirrored copy swaps them, like everything.
  return band.flipped
    ? [
        { ...lower, flipped: false },
        { ...upper, flipped: true },
      ]
    : [
        { ...upper, flipped: true },
        { ...lower, flipped: false },
      ];
};

export const clamp01 = (value: number): number => {
  if (value < 0) {
    return 0;
  }
  return value > 1 ? 1 : value;
};

/** The look's stops at `position`, with an alpha of the caller's choosing. */
export const rampRgba = (
  colours: readonly string[],
  position: number,
  alpha: number,
): string => {
  const [red, green, blue] = rampAt(colours, position);
  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
};

/**
 * The colour a reading of `level` is drawn in.
 *
 * The three ramps a look can be painted in say three different things, and a
 * measuring view has to honour the difference: by position across the axis
 * (rainbow), by how loud this point is (level and heat), or one colour for
 * the whole reading (signal). `across` is 0 at the left edge and 1 at the
 * right; `level` is the reading itself.
 */
export const readingColour = (
  frame: Pick<IAnalysisFrame, 'colours' | 'palette'>,
  across: number,
  level: number,
  alpha = 1,
): string => {
  if (frame.palette === 'rainbow') {
    return rampRgba(frame.colours, across, alpha);
  }
  if (frame.palette === 'signal') {
    return rampRgba(frame.colours, 0, alpha);
  }
  return rampRgba(frame.colours, level, alpha);
};

/**
 * What each view remembers between frames.
 *
 * One object rather than a ref per view, because the graph draws exactly one
 * of them at a time and switching views has to start the new one clean: a
 * waterfall that kept the peak holds of the analyser it replaced would draw
 * four seconds of somebody else's history the moment it appeared.
 */
/**
 * One scrolling picture: its own surface, the row its head is at, the row
 * buffer it writes through, and how long since it last took a row.
 *
 * One per channel, because two channels are two strips stacked rather than
 * two rasters overlaid — a raster has no transparency to lend the picture
 * behind it, so overlaid the top one simply hides the other.
 */
export interface IRasterStrip {
  surface: HTMLCanvasElement | undefined;
  row: number;
  image: ImageData | undefined;
  ageMs: number;
}

const emptyStrip = (): IRasterStrip => ({
  surface: undefined,
  row: 0,
  image: undefined,
  ageMs: 0,
});

export interface IAnalysisState {
  /** Which look this was last filled for; a change empties everything. */
  key: string;
  /** How many points the readings arrive as. */
  size: number;
  /**
   * The frame's own readings, written once per frame and handed to the view.
   *
   * Held here rather than built fresh because this runs sixty times a second
   * for the length of a song: six arrays of three hundred and twenty doubles
   * allocated per frame is twenty thousand collections an hour for numbers
   * that are overwritten before anything else could read them.
   */
  levels: Float64Array;
  live: Float64Array;
  xs: Float64Array;
  left: Float64Array;
  right: Float64Array;
  lift: Float64Array;
  axis: Float64Array;
  /** The two channels summed, for the scope's joined trace. */
  sum: Float32Array;
  /**
   * The phase history: correlation then width, each as long as that view's
   * own step count, with `historyHead` the newest column. One buffer rather
   * than two, for the reason every other pair here is one buffer.
   */
  history: Float64Array;
  historyHead: number;
  historyAgeMs: number;
  /**
   * The split figures as they are DRAWN: the two channels put through the
   * same attack and release the joined figure gets. Without them the split
   * was the raw analyser every frame and answered the look's ballistics not
   * at all, which reads as Left & right being quicker than Joined.
   */
  easedLeft: Float64Array;
  easedRight: Float64Array;
  /** Whether the eased buffers hold a measurement yet, rather than zeroes. */
  splitSeeded: boolean;
  seeded: boolean;
  /**
   * Where the split figures' nought is, in dBFS.
   *
   * The shared reading is drawn against the programme's own peak, and the
   * per-channel analysers here do not know what that peak was. So the louder
   * channel's loudest point is put exactly where the joined reading's is, and
   * the number is eased — jumping it every frame would make both figures
   * twitch against a peak that is only a few tenths of a decibel different.
   */
  reference: number;
  /**
   * How far the tilted display has been let down to fit, as a share of the
   * plot's depth. Never above zero. See `drawAnalysisView` for why.
   */
  room: number;
  /** Per point: the peak hold and how long it still has to hang. */
  hold: Float64Array;
  holdMs: Float64Array;
  /** Per point: the slow average and the high-water mark. */
  slow: Float64Array;
  crest: Float64Array;
  /** Per band of the third-octave view: its reading and its floating cap. */
  bands: Float64Array;
  bandHold: Float64Array;
  bandHoldMs: Float64Array;
  /** One scrolling raster per channel; the second is used only by a split. */
  strips: IRasterStrip[];
  /** The waterfall's history: `depth` slices, `sliceHead` the newest. */
  slices: Float64Array[];
  sliceHead: number;
  sliceAgeMs: number;
  /** The stereo view's needles, all eased rather than jumping. */
  correlation: number;
  meters: Float64Array;
  meterPeaks: Float64Array;
  meterPeakMs: Float64Array;
  loudness: number;
}

const EMPTY = new Float64Array(0);

export const createAnalysisState = (): IAnalysisState => ({
  key: '',
  size: 0,
  levels: EMPTY,
  live: EMPTY,
  xs: EMPTY,
  left: EMPTY,
  right: EMPTY,
  lift: EMPTY,
  axis: EMPTY,
  sum: new Float32Array(0),
  history: EMPTY,
  historyHead: 0,
  historyAgeMs: 0,
  easedLeft: EMPTY,
  easedRight: EMPTY,
  splitSeeded: false,
  seeded: false,
  reference: Number.NaN,
  room: 0,
  hold: EMPTY,
  holdMs: EMPTY,
  slow: EMPTY,
  crest: EMPTY,
  bands: EMPTY,
  bandHold: EMPTY,
  bandHoldMs: EMPTY,
  strips: [emptyStrip(), emptyStrip()],
  slices: [],
  sliceHead: 0,
  sliceAgeMs: 0,
  correlation: 0,
  meters: new Float64Array(2),
  meterPeaks: new Float64Array(2),
  meterPeakMs: new Float64Array(2),
  loudness: 0,
});

/**
 * Empty the state when the drawing it belongs to has changed.
 *
 * `key` carries the look AND the plot's size, because a raster is a picture
 * measured in pixels: resized, its rows no longer line up with the axis under
 * them, and stretching yesterday's picture over today's axis is worse than
 * starting again. The peak holds go with it for the same reason a fresh
 * figure fades in rather than arriving mid-fall.
 */
export const resetAnalysisState = (
  state: IAnalysisState,
  key: string,
  size: number,
): void => {
  if (state.key === key && state.size === size) {
    return;
  }
  state.key = key;
  state.size = size;
  state.levels = new Float64Array(size);
  state.live = new Float64Array(size);
  state.xs = new Float64Array(size);
  state.left = new Float64Array(size);
  state.right = new Float64Array(size);
  state.lift = new Float64Array(size);
  state.axis = new Float64Array(size);
  // Sized for the fast analyser's own block rather than for the readings:
  // the scope draws samples, and there are more of those than points.
  state.sum = new Float32Array(4096);
  state.history = EMPTY;
  state.historyHead = 0;
  state.historyAgeMs = 0;
  state.easedLeft = new Float64Array(size);
  state.easedRight = new Float64Array(size);
  state.splitSeeded = false;
  state.seeded = false;
  state.reference = Number.NaN;
  state.room = 0;
  state.hold = new Float64Array(size);
  state.holdMs = new Float64Array(size);
  state.slow = new Float64Array(size);
  state.crest = new Float64Array(size);
  state.bands = EMPTY;
  state.bandHold = EMPTY;
  state.bandHoldMs = EMPTY;
  state.strips = [emptyStrip(), emptyStrip()];
  state.slices = [];
  state.sliceHead = 0;
  state.sliceAgeMs = 0;
  state.correlation = 0;
  state.meters.fill(0);
  state.meterPeaks.fill(0);
  state.meterPeakMs.fill(0);
  state.loudness = 0;
};

/**
 * How far a follower moves toward its target in `deltaMs`.
 *
 * The same halving the trace itself uses, so a view's own slow average and
 * the look's attack are spoken in one language: milliseconds to cover half
 * the remaining distance, whatever the frame rate turns out to be.
 */
/**
 * `count` working arrays of `size`, for a view that needs a few more.
 *
 * Carved out of one buffer the state already holds, because the extra
 * arrays a view wants depend on what it is drawing at the time — a split
 * needs a second peak hold, a second average, a second high-water mark —
 * and allocating them per frame is a collection a second. Only one view is
 * ever on screen, and `resetAnalysisState` empties this when the view
 * changes, so there is nobody to share it with.
 */
export const scratch = (
  state: IAnalysisState,
  size: number,
  count: number,
): Float64Array[] => {
  if (state.bands.length !== size * count) {
    state.bands = new Float64Array(size * count);
  }
  return Array.from({ length: count }, (_unused, slot) =>
    state.bands.subarray(slot * size, (slot + 1) * size),
  );
};

/**
 * How the measuring views come DOWN: at a steady number of decibels a second,
 * not by halving the distance.
 *
 * Every other form on this graph eases toward its target, which is right for
 * a figure read by its shape — but a filled spectrum easing down from full
 * scale falls quickly at first and then crawls, so the first second of a
 * track filled the plot and stayed full while the tail of the ease let it
 * back (Ivan, 2026-09-23: "when the sound starts the graph goes crazy to top
 * over filling and then it lowers down"). A studio analyser falls at a
 * constant rate for exactly this reason, and it is also what makes one
 * readable: the distance a peak has dropped is the time since it happened.
 *
 * The look's Release is read as that rate rather than as a half-life. Eleven
 * times it is one whole plot depth, so the shipped 360 ms is eighty decibels
 * in four seconds — twenty a second, which is where a studio analyser's
 * medium setting sits. The slider's own ceiling then reaches about eighteen a
 * second and its floor a very quick sixty.
 */
export const FALL_SPAN = 11;

/**
 * One reading eased toward another: instant up to a peak, steady down from
 * one. Answers whether anything moved.
 */
export const followReadings = (
  shown: Float64Array,
  target: Float64Array,
  deltaMs: number,
  attackMs: number,
  releaseMs: number,
): boolean => {
  const rise = easeFactor(deltaMs, attackMs);
  const drop = deltaMs / Math.max(1, releaseMs * FALL_SPAN);
  let moved = false;
  for (let index = 0; index < shown.length; index += 1) {
    const want = target[index];
    const at = shown[index];
    if (want > at) {
      shown[index] = at + (want - at) * rise;
      moved = true;
    } else if (at - want > STILL_ENOUGH) {
      shown[index] = at - drop < want ? want : at - drop;
      moved = true;
    } else {
      shown[index] = want;
    }
  }
  return moved;
};

export const easeFactor = (deltaMs: number, halfLifeMs: number): number =>
  halfLifeMs <= 0 ? 1 : 1 - 2 ** (-deltaMs / halfLifeMs);

/**
 * A peak hold: instant up, a pause, then a steady fall.
 *
 * `fallPerSecond` is in units of the plot's depth, so 0.09 is about seven
 * decibels a second — slow enough that the eye arrives, quick enough that a
 * mark left by one loud note is gone before the next chorus.
 */
export const advanceHold = (
  hold: Float64Array,
  holdMs: Float64Array,
  levels: Float64Array,
  deltaMs: number,
  hangMs: number,
  fallPerSecond: number,
): number => {
  const drop = (fallPerSecond * deltaMs) / 1000;
  let highest = 0;
  for (let index = 0; index < hold.length; index += 1) {
    const level = levels[index];
    if (level >= hold[index]) {
      hold[index] = level;
      holdMs[index] = hangMs;
    } else if (holdMs[index] > 0) {
      holdMs[index] -= deltaMs;
    } else {
      hold[index] = Math.max(level, hold[index] - drop);
    }
    if (hold[index] > highest) {
      highest = hold[index];
    }
  }
  return highest;
};

/**
 * Below this a mark is on the floor and the frame loop may stop.
 *
 * A twentieth of a decibel on an eighty-decibel plot, which is the same
 * threshold the trace itself settles at — anything finer and something among
 * three hundred points is always drifting, so the canvas would redraw sixty
 * times a second through silence.
 */
export const STILL_ENOUGH = 0.0006;
