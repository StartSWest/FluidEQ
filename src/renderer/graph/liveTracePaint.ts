/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Which colour every stroke and fill of the live trace ends up being.
 *
 * Split out of the canvas renderer because these are decisions rather than
 * drawing, and because they used to be spread across three places that could
 * disagree: a `paint` computed in the component, a presentation attribute on
 * each path, and a stylesheet rule that overrode some of them and not others.
 * On a canvas there is no cascade to appeal to — whatever is decided here is
 * what gets painted — so the rules the cascade used to express are written out
 * as functions, in the order the cascade resolved them.
 *
 * Pure, and takes no context, so the whole colour model can be tested without
 * a canvas or a document.
 */

import { GraphPalette } from 'common/graphStyles';
import { BAND_SPECTRUM_STOPS } from '../utils/bandColors';
import { ILiveCurveData } from './ChartController';

/**
 * A gradient described rather than built.
 *
 * The coordinates are in the plot's own space, which on a canvas means they
 * have to be handed to `createLinearGradient` *inside* the transform the figure
 * is drawn under — otherwise a mirrored wave would carry an unmirrored ramp.
 * Describing it here and building it there is what keeps that ordering
 * requirement in one place instead of in the caller's head.
 */
export interface ITraceGradient {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stops: readonly { offset: number; colour: string }[];
}

/** A flat colour, or a ramp to be built against the plot. */
export type TracePaint = string | ITraceGradient;

export const isTraceGradient = (paint: TracePaint): paint is ITraceGradient =>
  typeof paint !== 'string';

/** The plot's own edges, in pixels, taken from the scales rather than props. */
export interface IPlotBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * The trace's colour, before euphoria gets a say.
 *
 * Pinned to the plot, not to the figure. That was a `userSpaceOnUse` gradient
 * in the SVG version and it is the same argument here: stretched to fit
 * whatever shape the current frame happens to be, the top of the tallest bar
 * would be fully red whether it was deafening or barely off the floor, and the
 * colour would say "the loudest thing on screen right now" instead of "this
 * many decibels". Against the axis, a level is a colour and stays that colour.
 *
 * Level runs up the decibel axis: first stop on the floor, last at the ceiling.
 * Rainbow runs along the frequency axis, left to right.
 */
export const resolveTracePaint = (
  palette: GraphPalette,
  colours: readonly string[],
  fallback: string,
  plot: IPlotBox,
): TracePaint => {
  // One colour is a flat fill whatever the palette is called, and no colours at
  // all means "the ones already on screen" — neither needs a gradient built.
  if (palette !== 'signal' && colours.length > 1) {
    const isLevel = palette === 'level';
    return {
      x1: isLevel ? 0 : plot.left,
      x2: isLevel ? 0 : plot.right,
      y1: isLevel ? plot.bottom : 0,
      y2: isLevel ? plot.top : 0,
      stops: colours.map((colour, index) => ({
        colour,
        // Evenly spaced, which is what the SVG version's `<stop>` list was.
        offset: index / Math.max(1, colours.length - 1),
      })),
    };
  }
  const [first] = colours;
  if (first) {
    // One stop, or a flat palette that has somehow been handed several. The
    // first is the answer either way — falling through to the curve's own
    // colour would silently discard a colour somebody chose.
    return first;
  }
  if (palette === 'rainbow') {
    // The app's full spectrum, deliberately not the EQ gradient — that one
    // carries a stop per band and so covers whatever slice of the axis the
    // user's bands happen to occupy.
    return {
      x1: plot.left,
      x2: plot.right,
      y1: 0,
      y2: 0,
      stops: BAND_SPECTRUM_STOPS.map((stop) => ({
        offset: stop.offset,
        colour: stop.color,
      })),
    };
  }
  return fallback;
};

/**
 * Whether a look carries a colour scheme of its own, which is what decides if
 * euphoria may recolour it.
 *
 * Rainbow counts even with no stops of its own: its colours are the app's
 * shared spectrum. Tested on the colours rather than on the palette's name as
 * well, so a flat look somebody has deliberately coloured is covered too.
 */
export const isSelfColouredLook = (
  palette: GraphPalette,
  colours: readonly string[],
): boolean => colours.length > 0 || palette === 'rainbow';

/** Whether euphoria is on, and where in the wheel it currently is. */
export interface IEuphoriaPaint {
  isOn: boolean;
  hue: number;
}

/**
 * The travelling hue, in the two weights the mode uses.
 *
 * Comma-separated rather than the modern space-separated form: both are legal
 * CSS colours and Chromium accepts either, but a canvas fill style is parsed by
 * whatever is running the code — including jsdom under test — and the older
 * form is the one nothing argues about.
 */
export const euphoriaTraceColour = (hue: number): string =>
  `hsl(${hue}, 95%, 66%)`;

export const euphoriaOutlineColour = (hue: number): string =>
  `hsl(${hue}, 90%, 62%)`;

/**
 * What the figure is stroked with, or nothing.
 *
 * This is the cascade the stylesheet used to run, written down. In the SVG
 * version there were three rules of decreasing reach and their order mattered:
 *
 *  1. Euphoria recolours any live trace that has no colours of its own. It won
 *     on specificity, and it applied even where the attribute said `stroke:
 *     none` — which is why a filled look grows an outline in the mode.
 *  2. Failing that, a look asking for the cycling border gets the sweep at the
 *     outline's own weight.
 *  3. Otherwise the look decides: a painted form has no stroke at all unless it
 *     asked for the border, in which case there has to be something for the hue
 *     to run along.
 */
export const resolveFigureStroke = (
  paint: TracePaint,
  isFilled: boolean,
  hasBorder: boolean,
  isSelfColoured: boolean,
  euphoria: IEuphoriaPaint,
): TracePaint | undefined => {
  if (euphoria.isOn && !isSelfColoured) {
    return euphoriaTraceColour(euphoria.hue);
  }
  if (euphoria.isOn && hasBorder) {
    return euphoriaOutlineColour(euphoria.hue);
  }
  if (isFilled && !hasBorder) {
    return undefined;
  }
  return paint;
};

/**
 * Whether the stroke the resolver just handed back is euphoria's rather than
 * the look's own.
 *
 * The two euphoria branches of `resolveFigureStroke` above, asked as a question
 * — because where a stroke is *placed* depends on whose it is. A look's own edge
 * is part of the drawing and belongs centred on the path, the way it has always
 * been. Euphoria's is decoration laid over somebody else's picture, and centred
 * it eats half its width out of the fill it is decorating: at the border's
 * eight-pixel ceiling that is four pixels into a bar about six wide, so a
 * spectrum or a level ramp is simply gone and the figure reads as one travelling
 * hue. The caller draws this one outside the figure instead; see the two
 * branches at the drawing end for how.
 */
export const isEuphoriaFigureStroke = (
  hasBorder: boolean,
  isSelfColoured: boolean,
  euphoria: IEuphoriaPaint,
): boolean => euphoria.isOn && (!isSelfColoured || hasBorder);

/**
 * How much heavier the trace is drawn when it is the only thing on the grid.
 *
 * A multiplier rather than a width, because the weight it scales is the user's
 * own: a look tuned to a hairline and one tuned to a slab should both come
 * forward by the same proportion, where a fixed width draws them identically
 * and quietly discards the tuning. 1.3 is the old fixed 2.6 over the default 2,
 * so a look nobody has tuned lands exactly where it used to.
 *
 * Small on purpose. Solo already takes the trace from a supporting half opacity
 * to full and that is most of the change; the weight is what stops a line
 * chosen so five curves do not read as a tangle from looking thin once four of
 * them are gone.
 */
export const SOLO_STROKE_WIDTH_SCALE = 1.3;

/**
 * The weight the figure is heading for: the look's own, heavier while soloed.
 *
 * Kept apart from the resolver below because this is a target rather than a
 * width to draw with — the canvas eases toward it, so entering the mode is
 * something the drawing moves into rather than a frame where it is abruptly
 * thicker.
 */
export const resolvePresentedStrokeWidth = (
  strokeWidth: number,
  isSolo: boolean,
): number => (isSolo ? strokeWidth * SOLO_STROKE_WIDTH_SCALE : strokeWidth);

/**
 * How heavy that stroke is.
 *
 * The border replaces the look's own weight rather than adding to it, which is
 * what the `stroke-width` in the euphoria rule did.
 *
 * What it means at the drawing end is "how much border there is", not "how wide
 * the pen is set": the border is laid outside the figure now rather than
 * straddling its edge, so the canvas asks for twice this and masks the inner
 * half away, or lays a casing this much proud of a line on each side. Either
 * way this many pixels of border end up visible, which is the number a person
 * moving the slider is choosing.
 */
export const resolveFigureStrokeWidth = (
  strokeWidth: number,
  borderWidth: number,
  hasBorder: boolean,
  isEuphoric: boolean,
): number => (isEuphoric && hasBorder ? borderWidth : strokeWidth);

/**
 * What the halo is stroked with.
 *
 * The trace's own paint, which is the point: for a gradient look that is the
 * very same gradient, so the glow round a spectrum is a spectrum and the glow
 * round a level ramp reddens with it. It carries the trace's opt-out too, and
 * must — without it the sweep would recolour the halo while the figure kept its
 * gradient, which is a spectrum haloed in one travelling hue.
 */
export const resolveGlowStroke = (
  paint: TracePaint,
  isSelfColoured: boolean,
  euphoria: IEuphoriaPaint,
): TracePaint =>
  euphoria.isOn && !isSelfColoured ? euphoriaTraceColour(euphoria.hue) : paint;

/**
 * What a lit tip is stroked with.
 *
 * Unlike the figure and its halo, the accents never claimed to be
 * self-coloured, so the mode reaches them whatever the look is painted in.
 * Their fills are left alone — the tip stays the trace's colour with a white
 * core, and only the edge joins the sweep.
 */
export const resolveAccentStroke = (
  fallback: TracePaint,
  euphoria: IEuphoriaPaint,
): TracePaint => (euphoria.isOn ? euphoriaTraceColour(euphoria.hue) : fallback);

/** How present the wide, faint half of a lit tip is, by mode. */
export const ACCENT_HALO_OPACITY = 0.28;
export const ACCENT_HALO_EUPHORIC_OPACITY = 0.5;
export const ACCENT_CORE_OPACITY = 0.92;

/**
 * Which way up a live curve is drawn, as a translate and a vertical scale.
 *
 * Mirrored as a drawing, not as data.
 *
 * Negating the gain was the first attempt and it gives the *negative* of the
 * wave: every style draws upward from a baseline at the bottom of the plot, so
 * a negated value makes a tall bar short rather than making it hang. The shape
 * inverts instead of the picture.
 *
 * Reflecting the rendered geometry about the plot keeps the shape exactly and
 * turns it upside down, which is what hanging from the ceiling means. Translate
 * then scale, because a bare flip would send it off the top of the viewport.
 *
 * Half height anchors at the middle instead of at an edge, so the two copies of
 * a mirrored wave grow away from each other rather than both taking the whole
 * plot and crossing through one another.
 */
export interface IWaveTransform {
  translateY: number;
  scaleY: number;
}

export const getWaveTransform = (
  curve: Pick<ILiveCurveData, 'isFlipped' | 'isHalfHeight' | 'isFromCentre'>,
  plotHeight: number,
): IWaveTransform => {
  if (!curve.isFlipped && !curve.isHalfHeight) {
    return { translateY: 0, scaleY: 1 };
  }
  if (!curve.isHalfHeight) {
    return { translateY: plotHeight, scaleY: -1 };
  }
  if (curve.isFromCentre) {
    // Baseline at the middle, peaks reaching the edges. The upper copy is a
    // plain half-scale — its baseline already lands on the centre line — and
    // the lower one is that reflected about the bottom.
    return curve.isFlipped
      ? { translateY: 0, scaleY: 0.5 }
      : { translateY: plotHeight, scaleY: -0.5 };
  }
  // Baseline at the edges, peaks meeting in the middle.
  return {
    translateY: plotHeight / 2,
    scaleY: curve.isFlipped ? -0.5 : 0.5,
  };
};

/**
 * The hue the sweep is currently at, read off an element that animates it.
 *
 * `--euphoria-hue` is a registered `<angle>` that deliberately does not
 * inherit — see the comment on the `@property` declaration for why that word is
 * the difference between an animation and a memory leak — so it can only be
 * read from an element carrying the keyframes itself. The canvas carries them
 * for exactly this reason: it is one element, animated by the compositor, and
 * reading it is how a drawing outside the cascade stays in step with every
 * other surface the mode lights up.
 */
export const readEuphoriaHue = (style: CSSStyleDeclaration): number => {
  const raw = parseFloat(style.getPropertyValue('--euphoria-hue'));
  return Number.isFinite(raw) ? raw : 0;
};
