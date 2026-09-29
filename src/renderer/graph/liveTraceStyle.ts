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

import { readAccentLight } from '../utils/theme';
import { TracePaint, isTraceGradient } from './liveTracePaint';

// How the live graph's figure is inked: the halo's brightness and reach
// over the beat, how fast the trace settles into a change, its widths and
// glow in each mode, and the two helpers every layer paints through.

/** How bright and how wide the halo (`figureGlow.ts`) is, over the pump. */
export const GLOW_FLOOR = 0.3;

export const GLOW_REACH = 2.4;

export const GLOW_WIDTH_FLOOR = 0.45;

export const GLOW_WIDTH_REACH = 1.1;

/**
 * How the halo answers the music.
 *
 * Deliberately lopsided, and that is the whole difference between a glow that
 * pumps and one that merely wobbles: it snaps to a hit almost instantly and
 * sags back over a quarter of a second, so a kick throws light out and the
 * light then falls away on its own. Matched attack and release would breathe
 * in and out symmetrically, which reads as a pulsing lamp rather than as
 * something being struck.
 *
 * The floor is what stops it dying between beats — at nothing at all the glow
 * would blink out completely in every gap, which flickers rather than pumps.
 */
export const GLOW_ATTACK_MS = 4;

export const GLOW_RELEASE_MS = 260;

/**
 * How long the trace takes to come forward, and to go back.
 *
 * Wave only takes the trace from a supporting layer to the subject of the
 * graph: brighter, and a little heavier. Snapping between the two reads as a
 * glitch — the drawing is already moving with the music, so an instant change
 * of weight looks like a frame was dropped rather than like a mode changed.
 *
 * This was a 420ms CSS transition on the path's `opacity` and `stroke-width`.
 * A canvas has no cascade to transition, so the two are eased here instead, at
 * a half-life that arrives in about the same time. It is one of the few pieces
 * of this file that is a reimplementation rather than a move.
 */
export const PRESENTATION_SETTLE_MS = 120;

/** Below these the eased presentation values have arrived and are snapped. */
export const OPACITY_EPSILON = 0.002;

export const STROKE_WIDTH_EPSILON = 0.01;

/**
 * How near its shape a look preview has to rise before it counts as shown, in
 * dB: a few pixels on this plot. The 0.05 dB the easing settles to takes ten
 * half-lives, over a second on a look with a slow attack, and nobody sees the
 * last of it; the preview would hang at the top for no visible reason.
 */
export const PREVIEW_REACHED_DB = 1;

/**
 * The fluid's wave, stroked the titlebar's way and only the titlebar's way.
 *
 * One heavy round-capped line over a soft shadow — no halo pass under it. A
 * pair of strokes was tried and is what the wide grey aura came from: two
 * widths of the same curve read as a line with a second, blurrier line
 * around it rather than as a lit one. The shadow does that job properly and
 * costs one stroke.
 *
 * Rainbow gets the wider line and the SMALLER blur: the gradient is already
 * doing the work there, so the glow does not have to.
 */
export const TRACE_WIDTH_RAINBOW = 4.2;

export const TRACE_WIDTH_CYAN = 3.2;

export const TRACE_BLUR_RAINBOW = 14;

export const TRACE_GLOW_RAINBOW = 'rgba(255, 60, 172, 0.55)';

export const traceGlowCyan = () =>
  readAccentLight(0.66, 'rgba(156, 255, 244, 0.66)');

/**
 * Canvas ignores an alpha outside 0..1 and keeps the last one, which is worse
 * than clamping would be: a glow driven past full would silently leave every
 * later stroke at the previous frame's opacity.
 */
export const setAlpha = (context: CanvasRenderingContext2D, alpha: number) => {
  context.globalAlpha = Math.max(0, Math.min(1, alpha));
};

/**
 * Hand the context a flat colour, or build the ramp one describes.
 *
 * Built inside the figure's own transform rather than once per frame, because a
 * gradient is painted through the matrix in force when it is used — so a
 * mirrored copy has to be given its own, or the level ramp would run the wrong
 * way up under the wave that is upside down.
 */
export const toCanvasPaint = (
  context: CanvasRenderingContext2D,
  paint: TracePaint,
): string | CanvasGradient => {
  if (!isTraceGradient(paint)) {
    return paint;
  }
  const gradient = context.createLinearGradient(
    paint.x1,
    paint.y1,
    paint.x2,
    paint.y2,
  );
  paint.stops.forEach((stop) => {
    gradient.addColorStop(Math.max(0, Math.min(1, stop.offset)), stop.colour);
  });
  return gradient;
};
