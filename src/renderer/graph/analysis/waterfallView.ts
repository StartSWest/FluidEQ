/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  clamp01,
  halveBand,
  rampRgba,
  type IAnalysisBand,
  type IAnalysisFrame,
  type IAnalysisPlot,
  type IAnalysisReading,
  type IAnalysisState,
} from './analysisFrame';
import { floorInk } from '../../utils/windowInk';

/**
 * The Waterfall: the last few seconds of spectrum, stacked into the distance.
 *
 * The same history the spectrogram prints, drawn as SHAPES instead of as a
 * picture — so a peak has a ridge you can follow back in time and a decay has
 * a slope you can read the length of. It is the drawing that answers "how
 * long does this room ring for" and "is that boom the record or the wall",
 * which neither a single trace nor a raster can.
 *
 * Built back to front, each slice a little smaller and a little higher than
 * the one in front of it, each filled opaquely so it hides the slices behind
 * it — which is the whole of what makes it read as depth rather than as a
 * stack of transparencies. Every slice keeps a lit top edge; that edge is the
 * only thing carrying the colour ramp, because a filled slice in the ramp
 * would put a bright band behind every ridge and flatten the picture.
 *
 * A line runs down every few columns from the horizon to the front, so the
 * ridges join into one wireframe surface rather than a pile of separate
 * curves, and each stretch of it is drawn before the slice in front of it
 * hides what that slice stands in front of. The front ridge is the reading
 * as it is now, every frame, lit from under by a glow of its own colour; the
 * stack glides back between one slice and the next instead of stepping. All
 * of that came from the Mesh, which drew the same history as a wireframe
 * with none of this view's alignment to the scale, and was retired into it
 * (Ivan, 2026-09-25: "deja la del meter pero mejorala como malla").
 *
 * With Left & right chosen it is two stacks, left above and right below,
 * each receding into its own half of the band.
 *
 * Laid out here for both painters: this file's canvas drawing, and the
 * engine's (`engineLooks/waterfallLook.ts`), which is handed every slice and
 * where each one stands.
 */

/**
 * How many slices of history are kept, and therefore drawn.
 *
 * Fifty-six was too many: at that density the ridges sat a pixel or two
 * apart and the stack read as a tangle of coloured wires rather than as a
 * surface. Thirty-two, a second and a half of history at one slice every
 * 45 ms, gives each ridge room to be one.
 */
export const WATERFALL_DEPTH = 32;

/** How often a new slice is taken, in milliseconds. */
const SLICE_MS = 45;

/** Never take more than this many after a stall. */
const MAX_CATCH_UP = 3;

/**
 * How much of the band the stack recedes into, and how far it narrows.
 *
 * Half the depth and a quarter of the width: enough perspective for the
 * eye to read distance, little enough that the oldest slice still spans most
 * of the frequency range — squeezed harder, the back of the stack stops
 * lining up with the axis under it and the view stops being a measurement.
 */
const RECEDE = 0.52;
const NARROW = 0.26;

/**
 * How much shorter a slice is drawn as it goes back.
 *
 * Without it every slice was the same height and the stack had no distance
 * in it at all — the ridges simply piled up the plot. Shrinking them as they
 * recede is the other half of the perspective, and it is what lets the front
 * ridge stand clear of the ones behind it.
 */
const SHORTEN = 0.42;

/**
 * The perspective, as the fraction of the way to the horizon.
 *
 * Curved rather than straight, so the near slices are spread out and the far
 * ones crowd together — which is what perspective does and what makes the
 * front of the stack readable instead of evenly sliced mush. It was
 * `distance ** 1.55`, which bends the other way: the front slices sat a pixel
 * apart in one thick band and the gaps opened toward the horizon, so the
 * stack read as a pile of lines rather than as ground running away.
 */
const depthOf = (distance: number) => 1 - (1 - distance) ** 1.55;

/** About how many lines run down the stack, whatever the ridges' points. */
const COLUMN_LINES = 32;

/** How strongly the front ridge lights the skin under it, at no fill. */
const FRONT_GLOW = 0.18;

/** The wireframe's lines: how solid within their slice, and how wide. */
export const WIRE_ALPHA = 0.45;
export const WIRE_WIDTH = 0.8;

/** The glow under the front ridge fades from and to the window's floor. */
export const FRONT_FADE: readonly (readonly [alpha: number, darker: number])[] =
  [
    [0, 0.4],
    [0.85, 0.4],
  ];

/**
 * The history, as one flat list: the left stack's slices then the right's,
 * so a split costs one allocation rather than a second set of buffers kept
 * for a setting most looks never turn on.
 */
const sizeSlices = (state: IAnalysisState, size: number, stacks: number) => {
  const wanted = WATERFALL_DEPTH * stacks;
  if (state.slices.length === wanted && state.slices[0].length === size) {
    return;
  }
  state.slices = Array.from({ length: wanted }, () => new Float64Array(size));
  state.sliceHead = 0;
  state.sliceAgeMs = 0;
};

/** The loudest reading in each slot of `levels`, written into `slice`. */
const takeSlice = (
  levels: Float64Array,
  slice: Float64Array,
  points: number,
) => {
  const last = levels.length - 1;
  for (let index = 0; index < points; index += 1) {
    // The loudest reading inside this slot rather than the nearest one: a
    // waterfall is read by its ridges, and dropping every other point would
    // make a narrow peak flicker in and out as it drifted between slots.
    const from = Math.floor((index * last) / points);
    const to = Math.max(from + 1, Math.floor(((index + 1) * last) / points));
    let peak = 0;
    for (let at = from; at <= to && at <= last; at += 1) {
      if (levels[at] > peak) {
        peak = levels[at];
      }
    }
    slice[index] = peak;
  }
};

/** How many points a slice holds, from the look's Pieces. */
export const waterfallPoints = (reading: IAnalysisReading): number =>
  Math.max(
    16,
    Math.min(reading.levels.length, Math.round(reading.tuning.columns)),
  );

/**
 * This frame's slices taken; answers how far the stack has glided toward
 * the next slice (`roll`, 0 to 1) and whether anything is still moving.
 */
export const advanceWaterfall = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): { roll: number; moving: boolean } => {
  const { levels, deltaMs, playing, split } = reading;
  const points = waterfallPoints(reading);
  sizeSlices(state, points, split ? 2 : 1);

  // The front slice is the reading as it is now, rewritten every frame, and
  // left behind as it stands when the next one is started — so the front
  // ridge follows the music at the frame rate rather than every 45 ms.
  const takeFront = () => {
    if (split) {
      takeSlice(split[0], state.slices[state.sliceHead], points);
      takeSlice(
        split[1],
        state.slices[WATERFALL_DEPTH + state.sliceHead],
        points,
      );
    } else {
      takeSlice(levels, state.slices[state.sliceHead], points);
    }
  };
  state.sliceAgeMs += deltaMs;
  let taken = 0;
  while (state.sliceAgeMs >= SLICE_MS && taken < MAX_CATCH_UP) {
    state.sliceAgeMs -= SLICE_MS;
    state.sliceHead = (state.sliceHead + 1) % WATERFALL_DEPTH;
    takeFront();
    taken += 1;
  }
  if (state.sliceAgeMs > SLICE_MS * MAX_CATCH_UP) {
    state.sliceAgeMs = 0;
  }
  if (taken === 0) {
    takeFront();
  }
  if (taken > 0) {
    // The tallest thing anywhere on the stack, so the frame loop knows when
    // the last of the music has travelled off the back and may stop. Counted
    // when a slice is taken — twenty-two times a second — rather than every
    // frame: between two slices only the front one changes, and the reading
    // that keeps the loop running while it does is `playing`.
    let tallest = 0;
    state.slices.forEach((slice) => {
      for (let index = 0; index < points; index += 1) {
        if (slice[index] > tallest) {
          tallest = slice[index];
        }
      }
    });
    state.loudness = tallest;
  }
  return {
    roll: Math.min(1, state.sliceAgeMs / SLICE_MS),
    // The stack keeps travelling for as long as there is anything on it,
    // which outlives the sound by the second and a half the last slice
    // takes to reach the back.
    moving: playing || state.loudness > STILL_ENOUGH,
  };
};

/** One stack: the band it recedes into, its slices, and whose colours. */
export interface IWaterfallStack {
  band: IAnalysisBand;
  slices: Float64Array[];
  mate: boolean;
}

/** The stacks, back to front: the right channel's lower one first. */
export const waterfallStacks = (
  reading: IAnalysisReading,
  state: IAnalysisState,
): IWaterfallStack[] => {
  const { band, split } = reading;
  if (split) {
    const [upper, lower] = halveBand(band);
    return [
      {
        band: lower,
        slices: state.slices.slice(WATERFALL_DEPTH),
        mate: true,
      },
      {
        band: upper,
        slices: state.slices.slice(0, WATERFALL_DEPTH),
        mate: false,
      },
    ];
  }
  return [{ band, slices: state.slices, mate: false }];
};

/** Where one slice of a stack stands, `age` slices back from the front. */
export interface IWaterfallSlice {
  /** How far to the horizon, 0 at the front and 1 at the back. */
  into: number;
  /** How much of it is left as it leaves at the back. */
  leaving: number;
  /** Its width against the front's, narrowed about the middle. */
  shrink: number;
  /** The row it stands on, and how tall a full reading reaches. */
  baseline: number;
  reach: number;
  /** Which way is up: -1 toward the top of the window, 1 down. */
  rise: number;
  /** How faded its lines are. */
  faded: number;
  /** Its ridge's place on the look's ramp, under every palette but rainbow. */
  ramp: number;
}

export const waterfallSlice = (
  band: IAnalysisBand,
  age: number,
  roll: number,
): IWaterfallSlice => {
  const depth = band.bottom - band.top;
  const foot = band.flipped ? band.top : band.bottom;
  const rise = band.flipped ? 1 : -1;
  // The stack glides back by the time since the last slice was taken, so
  // nothing steps twenty-two times a second; the last slice fades out at
  // the horizon over the same time instead of vanishing from it.
  const into = depthOf(Math.min(1, (age + roll) / (WATERFALL_DEPTH - 1)));
  const leaving = age === WATERFALL_DEPTH - 1 ? 1 - roll : 1;
  return {
    into,
    leaving,
    shrink: 1 - NARROW * into,
    baseline: foot + rise * (depth * RECEDE * into),
    reach: depth * (1 - RECEDE) * (1 - SHORTEN * into),
    rise,
    faded: (1 - into * 0.55) * leaving,
    ramp: clamp01(0.25 + (1 - into) * 0.75),
  };
};

/** Where point `index` of `points` of a slice stands. */
export const slicePoint = (
  plot: IAnalysisPlot,
  slice: IWaterfallSlice,
  index: number,
  points: number,
  value: number,
): { x: number; y: number } => {
  const width = plot.right - plot.left;
  const middle = plot.left + width / 2;
  const across = points === 1 ? 0.5 : index / (points - 1);
  return {
    x: middle + (plot.left + across * width - middle) * slice.shrink,
    y: slice.baseline + slice.rise * clamp01(value) * slice.reach,
  };
};

/** The glow under the front ridge, at no fill and the look's own. */
export const frontGlowAlpha = (fillOpacity: number): number =>
  FRONT_GLOW + fillOpacity * 0.2;

/** How solid a slice's skin is, before its leaving. */
export const skinAlpha = (fillOpacity: number): number =>
  0.72 + fillOpacity * 0.24;

/** The skin's floor colour: how solid, and how much darker, at `into`. */
export const skinInk = (into: number): readonly [number, number] => [
  0.72 + into * 0.24,
  0.25 + into * 0.45,
];

/** Which slots of a slice the wireframe's lines run down. */
export const wireIndices = (points: number): number[] => {
  const lines = Math.max(1, Math.min(COLUMN_LINES, points - 1));
  return Array.from({ length: lines + 1 }, (_unused, line) =>
    Math.round((line * (points - 1)) / lines),
  );
};

/**
 * The skin under the front ridge, lit in the ridge's own colour just under
 * it and darkening to nothing at its foot, so the newest reading stands out
 * as the edge of a surface rather than as one more line on the pile.
 */
const paintFrontGlow = (
  frame: IAnalysisFrame,
  band: IAnalysisBand,
  skirt: Path2D,
  ys: Float64Array,
  baseline: number,
  paint: string | CanvasGradient,
): void => {
  const { context, tuning } = frame;
  const upward = band.flipped ? 1 : -1;
  let crest = baseline;
  ys.forEach((y) => {
    crest = upward < 0 ? Math.min(crest, y) : Math.max(crest, y);
  });
  if (crest === baseline) {
    return;
  }
  context.globalAlpha = band.opacity * frontGlowAlpha(tuning.fillOpacity);
  context.fillStyle = paint;
  context.fill(skirt);
  const fade = context.createLinearGradient(0, crest, 0, baseline);
  FRONT_FADE.forEach(([alpha, darker], stop) =>
    fade.addColorStop(stop, floorInk(alpha, darker)),
  );
  context.globalAlpha = band.opacity;
  context.fillStyle = fade;
  context.fill(skirt);
};

/** One stack, back to front, inside its own band. */
const paintStack = (
  frame: IAnalysisFrame,
  { band, slices, mate }: IWaterfallStack,
  head: number,
  roll: number,
  points: number,
): void => {
  const { context, tuning, plot } = frame;
  const colours = mate ? frame.mate : frame.colours;

  context.globalAlpha = band.opacity;
  context.lineJoin = 'round';
  /**
   * Under the rainbow palette every ridge is lit across the axis, from one
   * gradient shared by the whole stack: the far slices are narrower, so the
   * same ramp compresses on them, which reinforces the depth rather than
   * fighting it. The other palettes light a ridge by how far away it is —
   * the near one in full colour, the horizon dim — because a level ramp
   * running up a ridge would put a bright band behind every peak and flatten
   * the picture it is supposed to give depth to.
   */
  const acrossPaint =
    frame.palette === 'rainbow'
      ? context.createLinearGradient(plot.left, 0, plot.right, 0)
      : undefined;
  if (acrossPaint) {
    for (let stop = 0; stop <= 12; stop += 1) {
      acrossPaint.addColorStop(stop / 12, rampRgba(colours, stop / 12, 1));
    }
  }
  // Where each point of the slice behind stands, and of the slice being
  // drawn, for the wireframe lines that join the two.
  let behindX = new Float64Array(points);
  let behindY = new Float64Array(points);
  let hereX = new Float64Array(points);
  let hereY = new Float64Array(points);
  const wires = wireIndices(points);
  for (let age = WATERFALL_DEPTH - 1; age >= 0; age -= 1) {
    const values = slices[(head - age + WATERFALL_DEPTH * 2) % WATERFALL_DEPTH];
    const slice = waterfallSlice(band, age, roll);
    const path = new Path2D();
    for (let index = 0; index < points; index += 1) {
      const { x, y } = slicePoint(plot, slice, index, points, values[index]);
      hereX[index] = x;
      hereY[index] = y;
      if (index === 0) {
        path.moveTo(x, y);
      } else {
        path.lineTo(x, y);
      }
    }
    const middle = (plot.left + plot.right) / 2;
    const rightEdge = middle + (plot.right - middle) * slice.shrink;
    const leftEdge = middle + (plot.left - middle) * slice.shrink;
    const skirt = new Path2D(path);
    skirt.lineTo(rightEdge, slice.baseline);
    skirt.lineTo(leftEdge, slice.baseline);
    skirt.closePath();
    const ridgePaint = acrossPaint ?? rampRgba(colours, slice.ramp, 0.9);

    // The wireframe's stretch from the slice behind to this one, drawn
    // before this slice's body, which then hides whatever part of it this
    // slice stands in front of.
    if (age < WATERFALL_DEPTH - 1) {
      const wire = new Path2D();
      for (let line = 0; line < wires.length; line += 1) {
        const index = wires[line];
        wire.moveTo(behindX[index], behindY[index]);
        wire.lineTo(hereX[index], hereY[index]);
      }
      context.globalAlpha = band.opacity * slice.faded * WIRE_ALPHA;
      context.lineWidth = WIRE_WIDTH;
      context.strokeStyle = ridgePaint;
      context.stroke(wire);
    }

    /**
     * The body has to HIDE the slice behind it, or there is no depth — only
     * fifty-odd translucent ridges over one another, which is what the first
     * version drew. So it is nearly opaque, and it darkens as it recedes,
     * which is what distance does to anything seen through air; it still
     * fades with distance, so the horizon dissolves instead of ending on a
     * hard rectangle.
     *
     * Nearly rather than fully: this graph paints no background of its own,
     * and a solid surface would be a black slab over whatever the user has
     * put behind the window.
     */
    context.globalAlpha =
      band.opacity * skinAlpha(tuning.fillOpacity) * slice.leaving;
    // The window's own floor, darkening toward the horizon.
    const [skin, darker] = skinInk(slice.into);
    context.fillStyle = floorInk(skin, darker);
    context.fill(skirt);
    if (age === 0) {
      paintFrontGlow(frame, band, skirt, hereY, slice.baseline, ridgePaint);
    }
    context.globalAlpha = band.opacity * slice.faded;
    context.lineWidth = age === 0 ? Math.max(1.4, frame.edge.width) : 1;
    context.strokeStyle =
      age === 0 && frame.edge.isEuphoria ? frame.edge.colour : ridgePaint;
    context.stroke(path);
    [behindX, hereX] = [hereX, behindX];
    [behindY, hereY] = [hereY, behindY];
  }
  context.globalAlpha = 1;
};

const drawWaterfallView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { roll, moving } = advanceWaterfall(frame, state);
  const points = waterfallPoints(frame);
  waterfallStacks(frame, state).forEach((stack) =>
    paintStack(frame, stack, state.sliceHead, roll, points),
  );
  return moving;
};

export default drawWaterfallView;
