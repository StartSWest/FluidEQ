/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { rampAt } from '../lookColours';
import {
  clamp01,
  halveBand,
  type IAnalysisBand,
  type IAnalysisFrame,
  type IAnalysisState,
  type IRasterStrip,
} from './analysisFrame';

/**
 * The Spectrogram: the last few seconds of the song, as a picture.
 *
 * Frequency stays on the horizontal axis and TIME runs up the plot, newest
 * along the bottom. That is the other way round from a studio spectrogram and
 * it is deliberate: this drawing shares its box with the EQ curve and the
 * graph's own frequency ruler, and turning it ninety degrees would leave
 * every label underneath naming the wrong thing. Kept this way, a bright
 * column sits directly under the band of the EQ that would move it.
 *
 * The vertical axis is therefore time, not level, and the decibel scale down
 * the right-hand side is taken away while this view is showing: loudness here
 * is the COLOUR (`levelAxisSuitsLook`).
 *
 * Rows are kept in a ring — written at a moving head and drawn twice with two
 * offsets — rather than by copying the picture onto itself a row at a time:
 * self-copy is a full-surface blit per frame, and at 1440p that was the whole
 * frame budget for a drawing that changes by one line.
 *
 * With Left & right chosen it is two strips stacked, left above and right
 * below, each with its own ring. Overlaid instead they would simply hide one
 * another: a raster has no transparency to lend the picture behind it.
 */

/**
 * How often a row is printed, in milliseconds.
 *
 * A row per frame would make the picture's speed depend on the display: the
 * same passage would scroll twice as fast on a 120 Hz panel. Twenty-five
 * milliseconds is forty rows a second, which is finer than the eye resolves
 * and slow enough that a four-hundred-pixel plot holds ten seconds of music.
 */
const ROW_MS = 25;

/** Never print more than this many rows in one frame after a stall. */
const MAX_CATCH_UP = 4;

const surfaceFor = (
  strip: IRasterStrip,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const existing = strip.surface;
  if (existing && existing.width === width && existing.height === height) {
    return existing;
  }
  const surface = document.createElement('canvas');
  surface.width = width;
  surface.height = height;
  strip.surface = surface;
  strip.row = 0;
  strip.image = undefined;
  return surface;
};

/**
 * One row of the picture, written into the reusable `ImageData` and put down
 * at `row`.
 *
 * Written pixel by pixel rather than as a run of tiny `fillRect`s: the row is
 * a few hundred pixels wide and each one is a different colour, so that would
 * be a few hundred draw calls a row and sixteen thousand a second.
 */
const printRow = (
  frame: IAnalysisFrame,
  strip: IRasterStrip,
  levels: Float64Array,
  colours: readonly string[],
  surface: HTMLCanvasElement,
  context2d: CanvasRenderingContext2D,
  row: number,
): void => {
  /**
   * Which of the look's stops a pixel takes, by the colouring that was
   * CHOSEN rather than always by loudness.
   *
   * A raster's content is a ramp, so it is tempting to make that ramp the
   * level and have done — which is what the first version did, and it meant
   * the Colour by row did nothing here at all (Ivan, 2026-09-23:
   * "histobrahp need to use colors on settings too not just auto"). Every
   * other view honours the row, so this one does: across the axis under
   * rainbow, one colour under flat, by the reading otherwise. The ALPHA is
   * the reading whichever is chosen, because a raster with no loudness in it
   * is a rectangle.
   */
  const { palette } = frame;
  const { width } = surface;
  let { image } = strip;
  if (!image || image.width !== width) {
    image = context2d.createImageData(width, 1);
    strip.image = image;
  }
  const pixels = image.data;
  const { xs, plot } = frame;
  const span = Math.max(1, plot.right - plot.left);
  const last = levels.length - 1;
  let point = 0;
  for (let column = 0; column < width; column += 1) {
    // Which reading this column falls on. The points are log-spaced across
    // the plot already, so walking them alongside the columns is one pass
    // rather than a search per pixel.
    const x = plot.left + ((column + 0.5) / width) * span;
    while (point < last && xs[point + 1] < x) {
      point += 1;
    }
    let level = levels[point];
    if (point < last) {
      const from = xs[point];
      const to = xs[point + 1];
      if (to > from) {
        const toward = clamp01((x - from) / (to - from));
        level += (levels[point + 1] - level) * toward;
      }
    }
    const shown = clamp01(level);
    let stop = shown;
    if (palette === 'rainbow') {
      stop = width > 1 ? column / (width - 1) : 0;
    } else if (palette === 'signal') {
      stop = 0;
    }
    const [red, green, blue] = rampAt(colours, stop);
    const at = column * 4;
    pixels[at] = red;
    pixels[at + 1] = green;
    pixels[at + 2] = blue;
    /**
     * The floor is transparent, not black.
     *
     * The graph draws no background of its own — a video or a wallpaper shows
     * through it — so a spectrogram that painted its quiet end opaque would
     * be a black rectangle over whatever the user put behind the window.
     * Faded in over the bottom sixth of the range instead, so quiet passages
     * thin out rather than turning into a wall.
     */
    pixels[at + 3] = Math.round(255 * clamp01(shown * 6));
  }
  context2d.putImageData(image, 0, row);
};

/** One strip of picture, printed and then blitted into `band`. */
const drawStrip = (
  frame: IAnalysisFrame,
  strip: IRasterStrip,
  band: IAnalysisBand,
  levels: Float64Array,
  colours: readonly string[],
): void => {
  const { context, ratio, plot, deltaMs, tuning } = frame;
  const width = Math.max(1, Math.round((plot.right - plot.left) * ratio));
  const height = Math.max(1, Math.round((band.bottom - band.top) * ratio));
  const surface = surfaceFor(strip, width, height);
  const surface2d = surface.getContext('2d');
  if (!surface2d) {
    return;
  }

  strip.ageMs += deltaMs;
  let printed = 0;
  while (strip.ageMs >= ROW_MS && printed < MAX_CATCH_UP) {
    strip.ageMs -= ROW_MS;
    strip.row = (strip.row + 1) % height;
    printRow(frame, strip, levels, colours, surface, surface2d, strip.row);
    printed += 1;
  }
  if (strip.ageMs > ROW_MS * MAX_CATCH_UP) {
    // A window that was hidden or a display that stalled: the rows that
    // would have been printed are gone, and printing them all now would
    // stamp one moment across a second of picture.
    strip.ageMs = 0;
  }

  /**
   * The ring, unrolled: everything after the head is the older half and goes
   * on top, everything up to and including the head is the newer half and
   * goes underneath it, so the newest row lands along the strip's bottom.
   *
   * A mirrored copy is the same picture reflected about the band, not a
   * second clock running the other way, so the flip is a transform around
   * both chunks rather than a different order to place them in.
   */
  const head = strip.row;
  const older = height - 1 - head;
  const { left } = plot;
  const { top } = band;
  const cssWidth = plot.right - plot.left;
  const cssHeight = band.bottom - band.top;
  const perPixel = cssHeight / height;
  context.save();
  if (band.flipped) {
    context.translate(0, band.top + band.bottom);
    context.scale(1, -1);
  }
  context.globalAlpha = band.opacity * tuning.fillOpacity;
  context.imageSmoothingEnabled = false;
  if (older > 0) {
    context.drawImage(
      surface,
      0,
      head + 1,
      width,
      older,
      left,
      top,
      cssWidth,
      older * perPixel,
    );
  }
  context.drawImage(
    surface,
    0,
    0,
    width,
    head + 1,
    left,
    top + older * perPixel,
    cssWidth,
    (head + 1) * perPixel,
  );
  context.imageSmoothingEnabled = true;
  context.restore();
  context.globalAlpha = 1;
};

const drawSpectrogramView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { band, split, playing, mate, colours, levels } = frame;
  const [left, right] = state.strips;
  if (split) {
    const [upper, lower] = halveBand(band);
    drawStrip(frame, left, upper, split[0], colours);
    drawStrip(frame, right, lower, split[1], mate);
  } else {
    drawStrip(frame, left, band, levels, colours);
  }
  // The picture keeps scrolling while there is sound, and holds still once
  // the capture stops — which is what the pause and the silence both are.
  return playing;
};

export default drawSpectrogramView;
