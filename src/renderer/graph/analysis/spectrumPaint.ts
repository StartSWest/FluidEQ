/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  PICTURE_ALPHA,
  TEXTURE_ALPHA,
  fillTexturePattern,
} from '../fillTextures';
import {
  clamp01,
  placeLevel,
  rampRgba,
  type IAnalysisFrame,
} from './analysisFrame';

/**
 * The drawing every spectrum view is built out of: a body, an edge, the fill
 * it is painted in, and the pattern printed inside it.
 *
 * Four of the seven measuring views draw a spectrum, and drawing it four
 * times would be four chances for one of them to read the palette, the tilt
 * or the texture differently from the others — which on a page whose whole
 * job is measurement is not a style bug, it is a wrong reading.
 */

/** The curve itself, left open, for stroking. */
export const spectrumLine = (
  frame: IAnalysisFrame,
  levels: Float64Array,
): Path2D => {
  const path = new Path2D();
  const { xs, band } = frame;
  for (let index = 0; index < levels.length; index += 1) {
    const y = placeLevel(band, levels[index]);
    if (index === 0) {
      path.moveTo(xs[index], y);
    } else {
      path.lineTo(xs[index], y);
    }
  }
  return path;
};

/** The same curve closed down onto the band's baseline, for filling. */
export const spectrumBody = (
  frame: IAnalysisFrame,
  levels: Float64Array,
): Path2D => {
  const path = spectrumLine(frame, levels);
  const { xs, band } = frame;
  const foot = band.flipped ? band.top : band.bottom;
  path.lineTo(xs[xs.length - 1], foot);
  path.lineTo(xs[0], foot);
  path.closePath();
  return path;
};

/**
 * The band of mean readings this scale actually produces.
 *
 * Heat colours a whole figure by one number, and that number used to be the
 * mean of the readings on a forty-decibel display where a loud record filled
 * about half the plot. On the analyser's own eighty-decibel scale the
 * reading is measured against the programme's OWN peak, so almost anything
 * playing fills most of the plot and the mean sits between about a third and
 * four fifths — which put every record at the red end of the ramp and left
 * the palette saying nothing (Ivan, 2026-09-23: "you need to remesure heat
 * colors becasue now all show red since we have differnt scale now").
 *
 * So the mean is stretched from that band across the whole ramp: a quiet or
 * narrow passage reads cool, a broadband loud one reads hot, and silence —
 * where the mean really is zero — reads coldest of all.
 */
const HEAT_FLOOR = 0.33;
const HEAT_CEILING = 0.78;

/**
 * The mean reading, on the ramp's own scale: what the heat palette is a
 * picture of and what the halo pumps with. One pass over an array the caller
 * has just written.
 */
export const spectrumEnergy = (levels: Float64Array): number => {
  if (levels.length === 0) {
    return 0;
  }
  let total = 0;
  for (let index = 0; index < levels.length; index += 1) {
    total += levels[index];
  }
  const mean = total / levels.length;
  return clamp01((mean - HEAT_FLOOR) / (HEAT_CEILING - HEAT_FLOOR));
};

/**
 * What a spectrum body is painted with.
 *
 * `alpha` is the fill's own opacity at the top of the figure; every ramp
 * fades toward the baseline, because a body that is as solid at the floor as
 * it is at the peak hides the grid, the EQ curve and any figure drawn behind
 * it — and on these views there is always something behind it.
 */
export const spectrumFill = (
  frame: IAnalysisFrame,
  levels: Float64Array,
  alpha: number,
): string | CanvasGradient => {
  const { context, colours, palette, band, plot } = frame;
  if (palette === 'signal') {
    return rampRgba(colours, 0, alpha);
  }
  if (palette === 'heat') {
    return rampRgba(colours, spectrumEnergy(levels), alpha);
  }
  if (palette === 'rainbow') {
    // Across the axis: a column's colour says where in the range it sits, so
    // it runs left to right and does not fade with height at all.
    const across = context.createLinearGradient(plot.left, 0, plot.right, 0);
    for (let stop = 0; stop <= 12; stop += 1) {
      across.addColorStop(stop / 12, rampRgba(colours, stop / 12, alpha));
    }
    return across;
  }
  // Up the axis: the meter ramp, dimming toward the foot. Built from the
  // foot to the head rather than from the plot's bottom to its top, so a
  // mirrored copy ramps out of its own baseline instead of into it.
  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const up = context.createLinearGradient(0, foot, 0, head);
  const steps = 14;
  for (let stop = 0; stop <= steps; stop += 1) {
    const position = stop / steps;
    up.addColorStop(
      position,
      rampRgba(colours, position, alpha * (0.14 + position * 0.86)),
    );
  }
  return up;
};

/**
 * What a reading's OUTLINE is stroked with.
 *
 * The same ramp as the body underneath it and at full strength, so the line
 * is green where the figure is green and red where it is red. A single colour
 * taken off the ramp's hot end drew a red edge all the way round a spectrum
 * whose bass is green, which nobody reads as an outline — they read it as a
 * border that has been switched on.
 *
 * Euphoria's sweep is the one exception and the only case where the edge is
 * genuinely one colour: it IS one colour, travelling.
 */
export const spectrumInk = (
  frame: IAnalysisFrame,
  levels: Float64Array,
  alpha = 1,
): string | CanvasGradient => {
  const { context, colours, palette, band, plot, edge } = frame;
  if (edge.isEuphoria) {
    return edge.colour;
  }
  if (palette === 'signal') {
    return rampRgba(colours, 0, alpha);
  }
  if (palette === 'heat') {
    return rampRgba(colours, spectrumEnergy(levels), alpha);
  }
  if (palette === 'rainbow') {
    const across = context.createLinearGradient(plot.left, 0, plot.right, 0);
    for (let stop = 0; stop <= 12; stop += 1) {
      across.addColorStop(stop / 12, rampRgba(colours, stop / 12, alpha));
    }
    return across;
  }
  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const up = context.createLinearGradient(0, foot, 0, head);
  for (let stop = 0; stop <= 10; stop += 1) {
    up.addColorStop(stop / 10, rampRgba(colours, stop / 10, alpha));
  }
  return up;
};

/**
 * What a ROW OF PIECES is painted with — bars, bands, note columns.
 *
 * The same four answers `spectrumFill` gives a body, and shared for the same
 * reason: every view that draws pieces has to honour the Colour by row, and
 * three copies of this switch is three chances for one of them to ignore it
 * (Ivan, 2026-09-23: "allow all of them to have auto and those colors we
 * support exptrum etc").
 *
 * One gradient for the whole row rather than one per piece: the ramps run
 * along the plot's own axes, so a per-piece gradient would restart the ramp
 * inside every bar and the row would read as thirty-four copies of one
 * colour.
 */
export const piecePaint = (
  frame: IAnalysisFrame,
  colours: readonly string[],
  loudest: number,
  alpha: number,
): string | CanvasGradient => {
  const { context, palette, band, plot } = frame;
  if (palette === 'signal') {
    return rampRgba(colours, 0, alpha);
  }
  if (palette === 'heat') {
    return rampRgba(colours, loudest, alpha);
  }
  if (palette === 'rainbow') {
    const across = context.createLinearGradient(plot.left, 0, plot.right, 0);
    for (let stop = 0; stop <= 12; stop += 1) {
      across.addColorStop(stop / 12, rampRgba(colours, stop / 12, alpha));
    }
    return across;
  }
  const foot = band.flipped ? band.top : band.bottom;
  const head = band.flipped ? band.bottom : band.top;
  const up = context.createLinearGradient(0, foot, 0, head);
  for (let stop = 0; stop <= 12; stop += 1) {
    const position = stop / 12;
    up.addColorStop(
      position,
      rampRgba(colours, position, alpha * (0.22 + position * 0.78)),
    );
  }
  return up;
};

/**
 * What a BEAM is painted with: the scope's trace and the phase line.
 *
 * Neither grows out of a floor, so the level ramp cannot run up the plot the
 * way it does elsewhere — it is mirrored about the middle instead, which
 * makes the ramp mean the same thing it always does here: the further from
 * rest, the hotter. Across the axis under rainbow, one colour under flat.
 */
export const beamPaint = (
  frame: IAnalysisFrame,
  colours: readonly string[],
  alpha: number,
): string | CanvasGradient => {
  const { context, palette, band, plot } = frame;
  if (palette === 'signal' || palette === 'heat') {
    return rampRgba(colours, 0.8, alpha);
  }
  if (palette === 'rainbow') {
    const across = context.createLinearGradient(plot.left, 0, plot.right, 0);
    for (let stop = 0; stop <= 12; stop += 1) {
      across.addColorStop(stop / 12, rampRgba(colours, stop / 12, alpha));
    }
    return across;
  }
  const out = context.createLinearGradient(0, band.top, 0, band.bottom);
  out.addColorStop(0, rampRgba(colours, 1, alpha));
  out.addColorStop(0.5, rampRgba(colours, 0.15, alpha));
  out.addColorStop(1, rampRgba(colours, 1, alpha));
  return out;
};

/**
 * Print the look's pattern inside a figure.
 *
 * Clipped to the figure in the figure's own space and then filled across the
 * plot in the WINDOW's space, so a tile stays square however tall or short
 * the wave is drawn — painted inside the figure's geometry it stretches into
 * rectangles the moment the height slider moves.
 */
export const paintTexture = (
  frame: IAnalysisFrame,
  figure: Path2D,
  alpha: number,
): void => {
  const { context, tuning, ratio, plot } = frame;
  if (tuning.texture === 'none') {
    return;
  }
  const pattern = fillTexturePattern(context, {
    texture: tuning.texture,
    image: tuning.textureImage,
    scale: ratio,
  });
  if (!pattern) {
    return;
  }
  context.save();
  context.clip(figure);
  context.globalCompositeOperation =
    tuning.texture === 'image' ? 'source-atop' : 'overlay';
  context.globalAlpha =
    alpha * (tuning.texture === 'image' ? PICTURE_ALPHA : TEXTURE_ALPHA);
  context.fillStyle = pattern;
  context.fillRect(
    plot.left,
    plot.top,
    plot.right - plot.left,
    plot.bottom - plot.top,
  );
  context.restore();
};

/**
 * Body, pattern and edge in the order they have to go down.
 *
 * `edgeAlpha` is separate from the fill's: a reading that is faint inside can
 * still want a crisp outline — that is how a held peak, a long-term average
 * and a channel drawn behind another are told apart at a glance.
 */
export const paintSpectrum = (
  frame: IAnalysisFrame,
  levels: Float64Array,
  options: {
    fillAlpha: number;
    edgeAlpha: number;
    edgeWidth?: number;
    textured?: boolean;
  },
): void => {
  const { context, tuning, edge } = frame;
  const body = spectrumBody(frame, levels);
  if (tuning.filled && options.fillAlpha > 0) {
    context.globalAlpha = 1;
    context.fillStyle = spectrumFill(frame, levels, options.fillAlpha);
    context.fill(body);
    if (options.textured !== false) {
      paintTexture(frame, body, options.fillAlpha);
    }
  }
  if (options.edgeAlpha <= 0) {
    return;
  }
  const line = spectrumLine(frame, levels);
  context.globalAlpha = options.edgeAlpha;
  context.lineWidth = options.edgeWidth ?? edge.width;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = spectrumInk(frame, levels);
  context.stroke(line);
  context.globalAlpha = 1;
};

/**
 * The halo: the figure's own edge stroked wide and soft behind it.
 *
 * Canvas shadows are the cheap way to do this and the wrong one here — a
 * shadow is cast per draw call and the views draw several figures a frame, so
 * it would compound. Two wide translucent strokes cost one path each and stay
 * the same however many figures are on screen.
 */
export const paintHalo = (
  frame: IAnalysisFrame,
  line: Path2D,
  strength: number,
): void => {
  if (strength <= 0) {
    return;
  }
  const { context, edge } = frame;
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = edge.colour;
  context.globalAlpha = 0.16 * strength;
  context.lineWidth = edge.width + 10 * strength;
  context.stroke(line);
  context.globalAlpha = 0.26 * strength;
  context.lineWidth = edge.width + 4 * strength;
  context.stroke(line);
  context.globalAlpha = 1;
};
